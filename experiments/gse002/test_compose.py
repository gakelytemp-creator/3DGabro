"""Referee tests for the composition-vs-memory experiment."""
import unittest

from compose import DESIGN, composer, memorizer, referee, run, score


class ComposeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = run()
        cls.score = score(cls.report)

    def test_referee_ground_truth(self):
        self.assertEqual(referee("plate_a", 90, 1), "yes")
        self.assertEqual(referee("plate_a", 45, 1), "no")
        self.assertEqual(referee("plate_b", 180, 1), "yes")
        self.assertEqual(referee("plate_b", 90, 1), "no")
        self.assertEqual(referee("plate_b", 270, 1), "no")
        self.assertEqual(referee("plate_c", 120, 1), "yes")
        self.assertEqual(referee("plate_c", 60, 1), "no")

    def test_same_observations_for_both_learners(self):
        obs = self.report["plate_a"]["observed"]
        self.assertEqual(obs, {90: "yes"})
        for row in self.report["plate_a"]["tests"]:
            self.assertIn("answer", row["memorizer"])
            self.assertIn("answer", row["composer"])

    def test_composer_predicts_unseen_and_is_confirmed(self):
        a = {r["angle"]: r for r in self.report["plate_a"]["tests"]}
        self.assertEqual(a[180]["composer"]["answer"], "yes")
        self.assertEqual(a[270]["composer"]["answer"], "yes")
        self.assertEqual(a[270]["composer"]["status"], "confirmed")
        self.assertEqual(a[270]["memorizer"]["answer"], "U")
        c = {r["angle"]: r for r in self.report["plate_c"]["tests"]}
        self.assertEqual(c[240]["composer"]["status"], "confirmed")

    def test_no_false_yes_and_rectangle_stays_unknown(self):
        self.assertEqual(self.score["composer"]["false_yes"], 0)
        b = {r["angle"]: r for r in self.report["plate_b"]["tests"]}
        self.assertEqual(b[270]["composer"]["answer"], "U")
        self.assertEqual(b[270]["truth"], "no")

    def test_composer_beats_memorizer(self):
        self.assertGreater(self.score["composer"]["correct_yes"],
                           self.score["memorizer"]["correct_yes"])
        self.assertEqual(self.score["memorizer"]["correct_yes"], 0)

    def test_provenance_chain(self):
        p = composer({90: "yes"}, 270)
        self.assertEqual(p["provenance"][-1], "90° ∘ 90° ∘ 90° = 270°")
        self.assertEqual(p["status"], "derived_untested")
        self.assertEqual(memorizer({90: "yes"}, 270)["answer"], "U")

    def test_trivial_full_turn_not_in_design(self):
        for spec in DESIGN.values():
            self.assertFalse({0, 360} & {t % 360 or 360 for t in spec["tests"]})


if __name__ == "__main__":
    unittest.main()
