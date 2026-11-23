"""GSE-002 minimal geometry probe: deterministic, no learning or dependencies.

Uses local tangent rank, not new occupancy pixels, to separate independent
freedom from new extent along an existing direction. Surface witnesses are
counterexample checks, not a proof of global symmetry.
"""
from __future__ import annotations
import json
from math import cos, sin, sqrt
from typing import Callable

Vec = tuple[float, float, float]
Move = Callable[[Vec], Vec]
EPS = 1e-7

def add(a: Vec, b: Vec) -> Vec: return tuple(x+y for x, y in zip(a,b))
def sub(a: Vec, b: Vec) -> Vec: return tuple(x-y for x, y in zip(a,b))
def scale(t: float, a: Vec) -> Vec: return tuple(t*x for x in a)
def dot(a: Vec, b: Vec) -> float: return sum(x*y for x, y in zip(a,b))
def norm(a: Vec) -> float: return sqrt(dot(a,a))

def rank(vectors: list[Vec], tolerance: float = EPS) -> int:
    """Numerical local span rank by Gram-Schmidt."""
    basis: list[Vec] = []
    for vector in vectors:
        residual = vector
        for b in basis:
            residual = sub(residual, scale(dot(residual,b), b))
        length = norm(residual)
        if length > tolerance:
            basis.append(scale(1/length, residual))
    return len(basis)

def translate(v: Vec) -> Move:
    return lambda p: add(p,v)

def rotation(axis: str, angle: float) -> Move:
    c,s = cos(angle),sin(angle)
    if axis == "z": return lambda p: (c*p[0]-s*p[1],s*p[0]+c*p[1],p[2])
    if axis == "x": return lambda p: (p[0],c*p[1]-s*p[2],s*p[1]+c*p[2])
    raise ValueError("axis must be x or z")

def tangent(p: Vec, family: Callable[[float], Move], h: float = 1e-5) -> Vec:
    return scale(1/(2*h),sub(family(h)(p),family(-h)(p)))

def freedom(base_tangents: list[Vec], p: Vec,
            family: Callable[[float], Move]) -> dict:
    """Local test only; not a global intrinsic-dimension estimator."""
    v=tangent(p,family)
    before=rank(base_tangents)
    after=rank(base_tangents+[v])
    classification=("new_independent" if after>before else
                    "fixed_point" if norm(v)<EPS else "dependent_motion")
    return {"before":before,"after":after,"classification":classification}

def order_gap(g: Move, h: Move, p: Vec) -> float:
    return norm(sub(g(h(p)),h(g(p))))

def surface(name: str, p: Vec, tolerance: float = 1e-8) -> bool:
    """Implicit infinite plane/cylinder, unit sphere, ring torus (R=2,r=.5)."""
    x,y,z=p
    if name=="plane": return abs(z)<tolerance
    if name=="sphere": return abs(x*x+y*y+z*z-1)<tolerance
    if name=="cylinder": return abs(x*x+y*y-1)<tolerance
    if name=="torus": return abs((sqrt(x*x+y*y)-2)**2+z*z-.25)<tolerance
    raise ValueError(name)

def examples() -> dict:
    along_x=lambda t:translate((t,0.,0.))
    along_y=lambda t:translate((0.,t,0.))
    r_z=lambda t:rotation("z",t)
    cases={
      "point_translation":freedom([],(0.,0.,0.),along_x),
      "segment_parallel_extension":freedom([(1.,0.,0.)],(0.,0.,0.),along_x),
      "segment_transverse_2D":freedom([(1.,0.,0.)],(0.,0.,0.),along_y),
      "segment_rotation_nonaxis":freedom([(1.,0.,0.)],(1.,0.,0.),r_z),
      "axis_fixed_rotation":freedom([],(0.,0.,1.),r_z),
    }
    transforms={"z_rotation":rotation("z",.3),"x_rotation":rotation("x",.3)}
    # Pick witnesses NOT on the x-axis: otherwise x-rotation fixes a point
    # even when it does not preserve the plane, cylinder or torus as a set.
    witnesses={"plane":(1.,1.,0.),"sphere":(1.,0.,0.),
               "cylinder":(0.,1.,0.),"torus":(0.,2.5,0.)}
    membership={name:{op:surface(name,fn(p)) for op,fn in transforms.items()}
                for name,p in witnesses.items()}
    rz=rotation("z",.4)
    rx=rotation("x",.3)
    tz=translate((0.,0.,.2))
    order={"same_axis_translation_rotation":order_gap(rz,tz,(1.,2.,3.)),
           "orthogonal_rotations":order_gap(rz,rx,(1.,2.,3.))}
    return {"local_freedom":cases,"surface_witness_membership":membership,
            "composition_order_gap":order,
            "limits":"Finite witnesses do not prove global symmetry; no learner or discovered cut."}

if __name__=="__main__":
    print(json.dumps(examples(),indent=2,sort_keys=True))
