"""GSE-002 motion probe: deterministic. Finite witnesses do not prove symmetry."""
from __future__ import annotations
import json
import random
from math import cos, sin, sqrt, pi
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

def translate(v: Vec) -> Move: return lambda p: add(p,v)
def rotation(axis: str, angle: float) -> Move:
    c,s = cos(angle),sin(angle)
    if axis == "z": return lambda p: (c*p[0]-s*p[1],s*p[0]+c*p[1],p[2])
    if axis == "x": return lambda p: (p[0],c*p[1]-s*p[2],s*p[1]+c*p[2])
    raise ValueError("axis must be x or z")

def tangent(p: Vec, family: Callable[[float], Move], h: float = 1e-5) -> Vec:
    return scale(1/(2*h),sub(family(h)(p),family(-h)(p)))

def freedom(base_tangents: list[Vec], p: Vec,
            family: Callable[[float], Move]) -> dict:
    """Local test only, not a global intrinsic-dimension estimator."""
    v=tangent(p,family)
    before=rank(base_tangents)
    after=rank(base_tangents+[v])
    classification=("new_independent" if after>before else
                    "fixed_point" if norm(v)<EPS else "dependent_motion")
    return {"before":before,"after":after,"classification":classification}

def order_gap(g: Move, h: Move, p: Vec) -> float:
    return norm(sub(g(h(p)),h(g(p))))

def surface_residual(name: str, p: Vec) -> float:
    """Implicit residual, zero on surface; units differ across surfaces."""
    x,y,z=p
    if name=="plane": return abs(z)
    if name=="sphere": return abs(x*x+y*y+z*z-1)
    if name=="cylinder": return abs(x*x+y*y-1)
    if name=="torus": return abs((sqrt(x*x+y*y)-2)**2+z*z-.25)
    raise ValueError(name)

def surface(name: str, p: Vec, tolerance: float = 1e-8) -> bool:
    return surface_residual(name,p)<tolerance

def sample_surface(name: str, n: int = 32, seed: int = 7) -> list[Vec]:
    """External referee supplies on-surface witnesses, not learner labels."""
    if n<1: raise ValueError("n must be positive")
    rng=random.Random(seed)
    points=[]
    for _ in range(n):
        u=2*pi*rng.random()
        if name=="plane": p=(3*(rng.random()-.5),3*(rng.random()-.5),0.)
        elif name=="sphere":
            z=2*rng.random()-1
            r=sqrt(max(0.,1-z*z))
            p=(r*cos(u),r*sin(u),z)
        elif name=="cylinder": p=(cos(u),sin(u),3*(rng.random()-.5))
        elif name=="torus":
            v=2*pi*rng.random()
            p=((2+.5*cos(v))*cos(u),(2+.5*cos(v))*sin(u),.5*sin(v))
        else: raise ValueError(name)
        points.append(p)
    return points

def witness_verdict(residual: float, yes_tolerance: float=1e-8,
                    no_tolerance: float=1e-6) -> str:
    """Yes/No/U for one witness; intermediate band remains unresolved."""
    if not 0 <= yes_tolerance < no_tolerance:
        raise ValueError("tolerances must satisfy 0 <= yes < no")
    if residual <= yes_tolerance: return "yes"
    if residual >= no_tolerance: return "no"
    return "U"

def motion_question(name: str, points: list[Vec], axis: str, angles: tuple[float,...],
                    yes_tolerance: float=1e-8, no_tolerance: float=1e-6) -> dict:
    """Finite screen: 'yes' means all sampled checks passed, not global proof."""
    counts={"yes":0,"no":0,"U":0}
    max_residual=0.
    for p in points:
        if surface_residual(name,p)>yes_tolerance:
            raise ValueError("invalid source witness")
        for angle in angles:
            residual=surface_residual(name,rotation(axis,angle)(p))
            max_residual=max(max_residual,residual)
            counts[witness_verdict(residual,yes_tolerance,no_tolerance)]+=1
    status="no" if counts["no"] else ("U" if counts["U"] or not points or not angles else "yes")
    return {"status":status,"checks":sum(counts.values()),"counts":counts,
            "max_residual":max_residual,"meaning":"finite_screen_only"}

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
    angles=(.3,.8,1.4,pi)
    membership={name:{axis+"_rotation":motion_question(name,sample_surface(name),axis,angles)
                      for axis in ("x","z")}
                for name in ("plane","sphere","cylinder","torus")}
    rz=rotation("z",.4)
    rx=rotation("x",.3)
    tz=translate((0.,0.,.2))
    order={"same_axis_translation_rotation":order_gap(rz,tz,(1.,2.,3.)),
           "orthogonal_rotations":order_gap(rz,rx,(1.,2.,3.))}
    return {"local_freedom":cases,"surface_witness_membership":membership,
            "composition_order_gap":order,
            "limits":"Finite samples do not prove global symmetry; no learner or discovered cut."}

if __name__=="__main__":
    print(json.dumps(examples(),indent=2,sort_keys=True))
