"""Local content KNN service. Optional classifier must be trained on real swipe events."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors


def features(profile, book):
    return [int(book.get('category', book.get('subject')) in profile.get('interests', [])),
            int(profile.get('educationLevel') not in (None, 'ทั่วไป') and book.get('educationLevel') == profile.get('educationLevel')),
            float(book.get('distanceKm', 0))]


def rank(payload, classifier=None):
    profile = payload['profile']
    books = payload['books']
    if not books:
        return {'ranking': [], 'engine': 'content-knn'}
    if classifier is not None and payload.get('useClassifier', True):
        model = classifier['model']
        positive = list(model.classes_).index(1)
        scores = model.predict_proba([features(profile, b) for b in books])[:, positive]
        return {'ranking': [{'id': b['id'], 'score': float(score)} for b, score in zip(books, scores)],
                'engine': classifier['name'], 'syntheticDemo': classifier.get('data_source') == 'synthetic-demo'}
    def document(book):
        category = book.get('category', book.get('subject', ''))
        return ' '.join([book.get('title', ''), category * 2, book.get('educationLevel', '') if book.get('educationLevel') != 'ทั่วไป' else ''])
    level = profile.get('educationLevel', '')
    query = ' '.join(profile.get('interests', [])) + ' ' + (level if level != 'ทั่วไป' else '')
    liked = [document(book) for book in payload.get('likedBooks', [])]
    texts = [document(book) for book in books]
    # Character n-grams support Thai text without assuming whitespace tokenization.
    vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 4), max_features=12000)
    matrix = vectorizer.fit_transform(texts + [query] + liked)
    target = np.asarray(matrix[len(books):].mean(axis=0))
    neighbors = NearestNeighbors(metric='cosine', algorithm='brute', n_neighbors=len(books))
    neighbors.fit(matrix[:len(books)])
    distances, indices = neighbors.kneighbors(target)
    ranking = [{'id': books[int(index)]['id'], 'score': max(0.0, float(1 - distance))} for index, distance in zip(indices[0], distances[0])]
    return {'ranking': ranking, 'engine': 'content-knn'}


class Handler(BaseHTTPRequestHandler):
    classifier = None
    def respond(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        if self.path != '/health':
            return self.respond(404, {'error': 'Not found'})
        self.respond(200, {'engine': self.classifier['name'] if self.classifier else 'content-knn',
                           'syntheticDemo': bool(self.classifier and self.classifier.get('data_source') == 'synthetic-demo')})
    def do_POST(self):
        if self.path != '/rank':
            return self.respond(404, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 1000000:
                return self.respond(413, {'error': 'Invalid payload size'})
            payload = json.loads(self.rfile.read(length))
            self.respond(200, rank(payload, self.classifier))
        except (ValueError, KeyError, TypeError):
            self.respond(400, {'error': 'Invalid feature data'})
    def log_message(self, *_args):
        pass


if __name__ == '__main__':
    model_path = os.environ.get('ML_MODEL_PATH')
    if model_path:
        # Load only a locally trained, trusted artifact. Never accept model uploads.
        Handler.classifier = joblib.load(Path(model_path))
        if Handler.classifier.get('data_source') == 'synthetic-demo' and os.environ.get('ALLOW_SYNTHETIC_MODEL') != '1':
            raise SystemExit('Synthetic demo model is disabled by default. Set ALLOW_SYNTHETIC_MODEL=1 only for a local demonstration.')
    host = os.environ.get('ML_HOST', '127.0.0.1')
    port = int(os.environ.get('ML_PORT', '4190'))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f'Recommendation service on http://{host}:{port}', flush=True)
    server.serve_forever()
