import tempfile
import unittest
from pathlib import Path
from world import Program, catalogue, edit, generate, iou, occupancy, scores, exhaustive_search
from run import run

class TestWorld(unittest.TestCase):
    def test_determinism(self):
        self.assertEqual(generate(12, 100), generate(12, 100))
        self.assertNotEqual(generate(12, 100), generate(13, 100))

    def test_exhaustive(self):
        for p in catalogue():
            best, fit, cost = exhaustive_search(occupancy(p))
            self.assertEqual(fit, 1.)
            self.assertEqual(cost, len(catalogue()))
            self.assertEqual(scores(p, p)['edit_response_iou'], 1.)

    def test_edit_sensitive(self):
        a, b = Program('cut', 1., .25, 0.), Program('cut', 1., .375, 0.)
        self.assertLess(iou(occupancy(a), occupancy(b)), 1.)
        self.assertNotEqual(occupancy(edit(a, 'offset')), occupancy(a))

    def test_replay(self):
        with tempfile.TemporaryDirectory() as root:
            a, b = Path(root)/'a', Path(root)/'b'
            self.assertEqual(run(7, 100, a), run(7, 100, b))
            self.assertEqual((a/'episodes.jsonl').read_bytes(), (b/'episodes.jsonl').read_bytes())

if __name__ == '__main__':
    unittest.main()
