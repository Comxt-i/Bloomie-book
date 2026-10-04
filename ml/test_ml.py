import tempfile
import unittest
from pathlib import Path
import joblib
from demo_train import create_demo, synthetic_swipes
from service import rank
from train import train

class RecommendationTests(unittest.TestCase):
    def test_thai_content_matches_interests(self):
        result = rank({'profile': {'interests':['คณิตศาสตร์'],'educationLevel':'ม.6'}, 'books':[
            {'id':'math','title':'คณิตศาสตร์ ม.6','subject':'คณิตศาสตร์','educationLevel':'ม.6'},
            {'id':'english','title':'English grammar','subject':'ภาษาอังกฤษ','educationLevel':'มหาวิทยาลัย'}], 'likedBooks':[]})
        self.assertEqual(result['ranking'][0]['id'], 'math')
        self.assertTrue(all(0 <= item['score'] <= 1 for item in result['ranking']))
    def test_no_books(self):
        self.assertEqual(rank({'profile':{},'books':[]})['ranking'], [])
    def test_broad_category_matches_general_reader(self):
        result = rank({'profile': {'interests': ['นิยายและวรรณกรรม'], 'educationLevel': 'ทั่วไป'}, 'books': [
            {'id': 'fiction', 'title': 'เรื่องเล่าของเรา', 'category': 'นิยายและวรรณกรรม', 'educationLevel': 'ทั่วไป'},
            {'id': 'study', 'title': 'สรุปคณิตศาสตร์', 'category': 'การเรียนและสอบ', 'educationLevel': 'ม.6'},
        ], 'likedBooks': []})
        self.assertEqual(result['ranking'][0]['id'], 'fiction')
    def test_catalog_uses_content_similarity_even_when_a_classifier_is_loaded(self):
        result = rank({'profile': {'interests': ['นิยายและวรรณกรรม'], 'educationLevel': 'ทั่วไป'},
                       'useClassifier': False, 'books': [
                           {'id': 'fiction', 'title': 'นิยายอ่านสนุก', 'category': 'นิยายและวรรณกรรม'},
                           {'id': 'comic', 'title': 'การ์ตูน', 'category': 'การ์ตูนและมังงะ'}]},
                      classifier={'name': 'decision-tree', 'model': object()})
        self.assertEqual(result['engine'], 'content-knn')
        self.assertEqual(result['ranking'][0]['id'], 'fiction')
    def test_does_not_invent_evaluation_without_data(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                train([], Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])
    def test_synthetic_demo_is_labeled_and_kept_separate(self):
        events = synthetic_swipes()
        self.assertEqual(len(events), 600)
        self.assertEqual(len({event['userId'] for event in events}), 30)
        self.assertEqual({event['label'] for event in events}, {0, 1})
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'synthetic-demo'
            report = create_demo(output)
            self.assertEqual(report['data_source'], 'synthetic-demo')
            self.assertIn('SYNTHETIC DEMO ONLY', report['limitation'])
            self.assertTrue((output / 'swipes.synthetic.json').exists())
            artifact = joblib.load(output / 'selected.joblib')
            self.assertEqual(artifact['data_source'], 'synthetic-demo')
            prediction = rank({'profile': {'interests': ['นิยายและวรรณกรรม'], 'educationLevel': 'ทั่วไป'},
                               'books': [{'id': 'demo', 'title': 'นิยาย', 'category': 'นิยายและวรรณกรรม',
                                          'educationLevel': 'ทั่วไป', 'distanceKm': 5}]}, artifact)
            self.assertTrue(prediction['syntheticDemo'])
            with self.assertRaises(FileExistsError):
                create_demo(output)

if __name__ == '__main__':
    unittest.main()
