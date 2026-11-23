"""Counterexample tests for the deterministic GSE-002 motion probe."""
import unittest
from math import pi, sin, cos
from probe import (examples, rank, rotation, surface, sample_surface,
                   motion_question, witness_verdict)

class ProbeTests(unittest.TestCase):
    def test_independence_not_extent(self):
        cases=examples()["local_freedom"]
        self.assertEqual(cases["point_translation"]["after"],1)
        self.assertEqual(cases["segment_parallel_extension"]["classification"],"dependent_motion")
        self.assertEqual(cases["segment_transverse_2D"]["after"],2)
        self.assertEqual(cases["segment_rotation_nonaxis"]["after"],2)
        self.assertEqual(cases["axis_fixed_rotation"]["classification"],"fixed_point")

    def test_rank_handles_dependent_vectors(self):
        self.assertEqual(rank([(1,0,0),(2,0,0),(0,1,0)]),2)

    def test_order(self):
        d=examples()["composition_order_gap"]
        self.assertLess(d["same_axis_translation_rotation"],1e-12)
        self.assertGreater(d["orthogonal_rotations"],.01)

    def test_multiple_surface_witnesses(self):
        m=examples()["surface_witness_membership"]
        for name in ("plane","sphere","cylinder","torus"):
            for axis in ("x_rotation","z_rotation"):
                self.assertEqual(m[name][axis]["checks"],128)
        for name in ("plane","cylinder","torus"):
            self.assertEqual(m[name]["x_rotation"]["status"],"no")
        for name in ("plane","cylinder","torus","sphere"):
            self.assertEqual(m[name]["z_rotation"]["status"],"yes")
        self.assertEqual(m["sphere"]["x_rotation"]["status"],"yes")

    def test_off_axis_sphere_witnesses(self):
        pts=sample_surface("sphere",n=32,seed=7)
        self.assertTrue(any(abs(p[1])>0.1 or abs(p[2])>0.1 for p in pts))
        self.assertTrue(all(surface("sphere",p) for p in pts))
        self.assertEqual(motion_question("sphere",pts,"x",(.3,.8,pi))["status"],"yes")

    def test_pi_plane_rotation_is_discrete_exception(self):
        pts=sample_surface("plane",n=30,seed=13)
        self.assertEqual(motion_question("plane",pts,"x",(pi,))["status"],"yes")
        self.assertEqual(motion_question("plane",pts,"x",(.3,pi))["status"],"no")

    def test_three_valued_verdict_and_invalid_witness(self):
        self.assertEqual(witness_verdict(0.),"yes")
        self.assertEqual(witness_verdict(4e-7),"U")
        self.assertEqual(witness_verdict(1e-4),"no")
        self.assertEqual(motion_question("plane",[],"x",(.3,))["status"],"U")
        with self.assertRaises(ValueError):
            motion_question("sphere",[(0.,0.,0.)],"x",(.3,))

    def test_torus_has_two_intrinsic_periods_but_not_two_ambient_rotations(self):
        torus=lambda u,v:((2+.5*cos(v))*cos(u),(2+.5*cos(v))*sin(u),.5*sin(v))
        for u,v in [(0,0),(.2,1.2),(1.7,2.4)]:
            self.assertLess(sum((a-b)**2 for a,b in zip(torus(u,v),torus(u+2*pi,v))),1e-25)
            self.assertLess(sum((a-b)**2 for a,b in zip(torus(u,v),torus(u,v+2*pi))),1e-25)
            self.assertTrue(surface("torus",torus(u,v)))
        self.assertFalse(surface("torus",rotation("x",.3)(torus(pi/2,0.))))

if __name__=="__main__": unittest.main()
