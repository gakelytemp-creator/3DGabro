"""Tests for the hidden-cut detector. Tests are the referee: they may know pi."""
import ast
import inspect
import random
import unittest
from math import pi

import hidden_cuts
from hidden_cuts import candidate_cuts, discover, execute, raw_table

ANGLES = (0.3, 0.8, 1.4, pi)


class HiddenCutTests(unittest.TestCase):
    def test_finds_cut_hidden_by_summary(self):
        for name in ("plane", "cylinder", "torus"):
            out = discover(raw_table(name, "x", ANGLES), {"surface": name, "axis": "x"})
            self.assertEqual(out["summary"]["result"], "no")
            q = out["question"]
            self.assertIsNotNone(q, name)
            self.assertEqual(q["executable"]["attr"], "angle")
            self.assertAlmostEqual(q["executable"]["value"], pi, places=9)
            self.assertEqual(q["evidence"]["group_size"], 32)
            self.assertLess(q["evidence"]["control"]["p"], 0.01)

    def test_nothing_hidden_when_summary_already_yes(self):
        for name, axis in (("sphere", "x"), ("sphere", "z"), ("plane", "z")):
            out = discover(raw_table(name, axis, ANGLES), {"surface": name, "axis": axis})
            self.assertEqual(out["summary"]["result"], "yes")
            self.assertIsNone(out["question"])

    def test_shuffled_tables_yield_no_accepted_cut(self):
        real = raw_table("plane", "x", ANGLES)
        verdicts = [r["verdict"] for r in real]
        accepted = 0
        for s in range(20):
            rng = random.Random(1000 + s)
            v = verdicts[:]
            rng.shuffle(v)
            rows = [{"attrs": r["attrs"], "verdict": x} for r, x in zip(real, v)]
            if discover(rows, {"surface": "?", "axis": "x"}, n_perm=200, seed=s)["question"]:
                accepted += 1
        self.assertEqual(accepted, 0)

    def test_no_single_witness_or_region_is_a_pure_group(self):
        cuts = candidate_cuts(raw_table("plane", "x", ANGLES))
        self.assertEqual({c["attr"] for c in cuts}, {"angle"})

    def test_question_is_reusable_and_logged(self):
        q = discover(raw_table("plane", "x", ANGLES), {"surface": "plane", "axis": "x"})["question"]
        self.assertTrue(q["id"].startswith("q:"))
        self.assertEqual(execute(q, "cylinder")["status"], "yes")
        self.assertEqual(execute(q, "torus")["status"], "yes")
        self.assertEqual([h["step"] for h in q["history"]], ["proposed", "executed", "executed"])
        self.assertEqual(q["origin"]["summary_rule"], "all_yes")

    def test_summary_event_keeps_raw_reference(self):
        rows = raw_table("plane", "x", ANGLES)
        ev = discover(rows, {"surface": "plane", "axis": "x"})["summary"]
        self.assertEqual(ev["rows"], 128)
        self.assertEqual(ev["counts"], {"yes": 32, "no": 96, "U": 0})
        self.assertEqual(len(ev["table"]), 16)

    def test_detector_functions_contain_no_target_angle(self):
        tree = ast.parse(inspect.getsource(hidden_cuts))
        for fn in (n for n in tree.body if isinstance(n, ast.FunctionDef)):
            for node in ast.walk(fn):
                if isinstance(node, ast.Name):
                    self.assertNotEqual(node.id, "pi", fn.name)
                if isinstance(node, ast.Constant) and isinstance(node.value, float):
                    self.assertGreater(abs(node.value - pi), 1e-3, fn.name)


if __name__ == "__main__":
    unittest.main()
