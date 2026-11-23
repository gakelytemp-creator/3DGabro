"""Deterministic toy CSG world for GSE-001 Phase 0.

Discrete sampled occupancy, NOT an exact CAD/CSG kernel.
No real scans, neural networks or sealed exam cases are included.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict, replace
from itertools import product
import random

GRID = tuple((i + .5) / 8 - 1 for i in range(16))
POINTS = tuple(product(GRID, repeat=3))
OFFSETS = (-.5, 0., .5)
RADII = (.25, .375)
HEIGHTS = (.75, 1.)

@dataclass(frozen=True)
class Program:
    kind: str  # box | cut | union
    height: float = 1.
    radius: float = .25
    offset: float = 0.

    def __post_init__(self):
        if self.kind not in ('box', 'cut', 'union'):
            raise ValueError('invalid CSG operation')
        if self.height not in HEIGHTS or self.radius not in RADII or self.offset not in OFFSETS:
            raise ValueError('out-of-domain parameter')

    def to_dict(self):
        return asdict(self)


def occupancy(program: Program) -> frozenset[int]:
    occupied = []
    for i, (x, y, z) in enumerate(POINTS):
        base = abs(x) <= .75 and abs(y) <= .625 and abs(z) <= program.height / 2
        cylinder = (x - program.offset)**2 + y*y <= program.radius**2 and abs(z) <= .625
        inside = base if program.kind == 'box' else (base and not cylinder if program.kind == 'cut' else base or cylinder)
        if inside:
            occupied.append(i)
    return frozenset(occupied)


def catalogue() -> tuple[Program, ...]:
    return (Program('box'),) + tuple(
        Program(kind, height, radius, offset)
        for kind in ('cut', 'union')
        for height, radius, offset in product(HEIGHTS, RADII, OFFSETS)
    )


def generate(seed: int, count: int) -> list[Program]:
    rng = random.Random(seed)
    pool = catalogue()
    return [pool[rng.randrange(len(pool))] for _ in range(count)]


def iou(a: frozenset[int], b: frozenset[int]) -> float:
    return len(a & b) / len(a | b) if (a or b) else 1.


def edit(program: Program, intervention: str) -> Program:
    if intervention == 'height':
        return replace(program, height=HEIGHTS[1] if program.height == HEIGHTS[0] else HEIGHTS[0])
    if intervention == 'radius':
        return replace(program, radius=RADII[1] if program.radius == RADII[0] else RADII[0])
    if intervention == 'offset':
        return replace(program, offset=OFFSETS[(OFFSETS.index(program.offset) + 1) % len(OFFSETS)])
    raise ValueError('unknown edit')


def scores(target: Program, proposal: Program) -> dict[str, float]:
    geometry = iou(occupancy(target), occupancy(proposal))
    edit_scores = [iou(occupancy(edit(target, name)), occupancy(edit(proposal, name)))
                   for name in ('height', 'radius', 'offset')]
    return {'geometry_iou': geometry, 'edit_response_iou': sum(edit_scores) / len(edit_scores)}


def exhaustive_search(target_observation: frozenset[int]) -> tuple[Program, float, int]:
    """No-learning baseline; scores observation only, never hidden edit outcomes."""
    best, quality, evaluations = None, -1., 0
    for candidate in catalogue():
        evaluations += 1
        fit = iou(target_observation, occupancy(candidate))
        if fit > quality:
            best, quality = candidate, fit
    assert best is not None
    return best, quality, evaluations
