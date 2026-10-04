"""Create reproducible fake swipe events and train a DEMO model only.

Usage: python ml/demo_train.py [--output ml/models/synthetic-demo]
Never use its evaluation numbers as evidence of real-world recommendation quality.
"""
import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from train import train


def synthetic_swipes(seed=42, user_count=30, books_per_user=20):
    rng = random.Random(seed)
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    events = []
    for user_index in range(user_count):
        personal_bias = rng.uniform(-0.45, 0.45)
        for book_index in range(books_per_user):
            category_match = rng.randrange(2)
            level_match = rng.randrange(2)
            distance_km = round(rng.uniform(0.5, 50), 2)
            invented_preference = (
                1.4 * category_match + 0.35 * level_match
                - 0.035 * distance_km + personal_bias + rng.gauss(0, 0.8) - 0.35
            )
            events.append({
                'userId': f'synthetic-user-{user_index:02d}',
                'bookId': f'synthetic-book-{book_index:02d}',
                'subjectMatch': category_match,
                'levelMatch': level_match,
                'distanceKm': distance_km,
                'label': int(invented_preference > 0),
                'createdAt': (start + timedelta(minutes=len(events))).isoformat(),
            })
    return events


def create_demo(output):
    if output.exists():
        raise FileExistsError(f'{output} already exists; choose a new --output directory to avoid overwriting files')
    events = synthetic_swipes()
    output.mkdir(parents=True)
    (output / 'swipes.synthetic.json').write_text(json.dumps(events, ensure_ascii=False, indent=2), encoding='utf-8')
    return train(events, output, synthetic=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train a clearly labeled synthetic demo model')
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'models' / 'synthetic-demo')
    args = parser.parse_args()
    try:
        result = create_demo(args.output)
        print(json.dumps({'output': str(args.output), 'data_source': result['data_source'],
                          'selected_model': result['selected_model'], 'counts': result['counts'],
                          'warning': result['limitation']}, ensure_ascii=False, indent=2))
    except (ValueError, FileExistsError) as error:
        parser.exit(2, str(error) + '\n')
