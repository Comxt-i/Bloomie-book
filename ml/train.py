"""Compare supervised models using real, deduplicated user/book swipe events.
Usage: python train.py swipes.json --output models
"""
import argparse
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.model_selection import GroupShuffleSplit
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import f1_score, precision_score, recall_score


def ranking_metrics(labels, probabilities, users, k=5):
    precision, recall = [], []
    for user in set(users):
        index = np.where(users == user)[0]
        top = index[np.argsort(-probabilities[index])[:k]]
        precision.append(float(labels[top].sum() / len(top)))
        if labels[index].sum():
            recall.append(float(labels[top].sum() / labels[index].sum()))
    return {'precision_at_5': float(np.mean(precision)), 'recall_at_5': float(np.mean(recall)) if recall else None}


def train(events, output, *, synthetic=False):
    # Repeated swipes on one book cannot appear on both sides of an evaluation split.
    unique = {}
    for row in sorted(events, key=lambda row: row['createdAt']):
        unique[(row['userId'], row['bookId'])] = row
    rows = list(unique.values())
    if len(rows) < 100 or len({r['userId'] for r in rows}) < 15 or len({r['label'] for r in rows}) < 2:
        raise ValueError('Need at least 100 rated pairs, 15 users, and both LIKE/DISLIKE labels. No model or accuracy claim was produced.')
    x = np.asarray([[r['subjectMatch'], r['levelMatch'], r['distanceKm']] for r in rows], dtype=float)
    y = np.asarray([r['label'] for r in rows])
    groups = np.asarray([r['userId'] for r in rows])
    train_val, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(x, y, groups))
    train_rel, val_rel = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=43).split(x[train_val], y[train_val], groups[train_val]))
    training, validation = train_val[train_rel], train_val[val_rel]
    if any(len(np.unique(y[index])) != 2 for index in [training, validation, test]):
        raise ValueError('Each user-disjoint split needs both labels. Collect more balanced real data.')
    models = {
        'knn-classifier': make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5, weights='distance')),
        'decision-tree': DecisionTreeClassifier(max_depth=4, min_samples_leaf=5, class_weight='balanced', random_state=42),
        'logistic-regression': make_pipeline(StandardScaler(), LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42)),
    }
    validation_scores = {}
    for name, model in models.items():
        model.fit(x[training], y[training])
        validation_scores[name] = float(f1_score(y[validation], model.predict(x[validation]), zero_division=0))
    winner = max(validation_scores, key=validation_scores.get)
    model = models[winner]
    model.fit(x[train_val], y[train_val])
    pred = model.predict(x[test]); scores = model.predict_proba(x[test])[:, list(model.classes_).index(1)]
    report = {
        'data_source': 'synthetic-demo' if synthetic else 'real-swipes',
        'selected_model': winner, 'validation_f1': validation_scores,
        'held_out_test': {'f1': float(f1_score(y[test], pred, zero_division=0)), 'precision': float(precision_score(y[test], pred, zero_division=0)), 'recall': float(recall_score(y[test], pred, zero_division=0)), **ranking_metrics(y[test], scores, groups[test])},
        'counts': {'training': len(training), 'validation': len(validation), 'test': len(test)},
        'method': 'User-disjoint 60/20/20 split; choose by validation F1; one final evaluation on untouched test users.',
        'limitation': ('SYNTHETIC DEMO ONLY: These metrics measure how well the model reproduced invented labels. They do not estimate performance with real people, successful loans, or timely returns.' if synthetic else 'Ranking metrics cover rated books only, not the full catalog. Exposure/selection bias remains. These metrics do not measure successful loans or timely returns.'),
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    joblib.dump({'name': winner, 'model': model, 'data_source': report['data_source']}, output / 'selected.joblib')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('events', type=Path)
    parser.add_argument('--output', type=Path, default=Path('models'))
    args = parser.parse_args()
    try:
        print(json.dumps(train(json.loads(args.events.read_text()), args.output), indent=2))
    except ValueError as error:
        parser.exit(2, str(error) + '\n')
