"""Counterexample-oriented tests for GSE-002's first small motion probe."""
import unittest
from math import pi, sin, cos
from probe import examples, rank, rotation, surface

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

    def test_surface_witnesses(self):
        m=examples()["surface_witness_membership"]
        self.assertEqual(m["torus"],{"x_rotation":False,"z_rotation":True})
        self.assertEqual(m["sphere"],{"x_rotation":True,"z_rotation":True})
        self.assertEqual(m["plane"],{"x_rotation":False,"z_rotation":True})
        self.assertEqual(m["cylinder"],{"x_rotation":False,"z_rotation":True})

    def test_torus_has_two_intrinsic_periods_but_not_two_ambient_rotations(self):
        torus=lambda u,v:((2+.5*cos(v))*cos(u),(2+.5*cos(v))*sin(u),.5*sin(v))
        for u,v in [(0,0),(.2,1.2),(1.7,2.4)]:
            self.assertLess(sum((a-b)**2 for a,b in zip(torus(u,v),torus(u+2*pi,v))),1e-25)
            self.assertLess(sum((a-b)**2 for a,b in zip(torus(u,v),torus(u,v+2*pi))),1e-25)
            self.assertTrue(surface("torus",torus(u,v)))
        self.assertFalse(surface("torus",rotation("x",.3)(torus(pi/2,0.))))

if __name__=="__main__": unittest.main()
