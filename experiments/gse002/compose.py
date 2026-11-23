"""GSE-002: predict untested symmetries by composing observed ones.

Two learners receive the SAME initial observations about an unnamed plate
(angle about z -> yes/no). Neither receives the plate's shape or name.

- memorizer: answers only what it has seen; unseen angles are U.
- composer:  if a and b preserve the set, so does a+b (positive closure);
             every derived answer carries its provenance chain.

Predictions are made BEFORE the independent referee checks them. 0/360 is
excluded from scoring: it holds for every shape and is not knowledge about
the object. Only positive composition is allowed here (no inference of 'no').
"""
from __future__ import annotations

import random
from math import cos, radians, sin, sqrt

from probe import witness_verdict

FULL = 360
THICKNESS = 0.1


# ------------------------------------------------------------ referee world

def _regular(n: int, r: float) -> list[tuple[float, float]]:
    return [(r * cos(radians(90 + k * 360 / n)), r * sin(radians(90 + k * 360 / n)))
            for k in range(n)]


PLATES = {  # referee-only: polygons (counter-clockwise), centred at origin
    "plate_a": [(-1., -1.), (1., -1.), (1., 1.), (-1., 1.)],          # square
    "plate_b": [(-1.5, -.7), (1.5, -.7), (1.5, .7), (-1.5, .7)],      # rectangle
    "plate_c": _regular(3, 1.2),                                      # fixed in advance
}


def _outside(poly, x: float, y: float) -> float:
    """Signed distance outside a convex CCW polygon (<=0 inside)."""
    worst = -1e9
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        ex, ey = x2 - x1, y2 - y1
        length = sqrt(ex * ex + ey * ey)
        worst = max(worst, (ex * (y - y1) - ey * (x - x1)) / -length)
    return worst


def residual(plate: str, p) -> float:
    x, y, z = p
    return max(0., _outside(PLATES[plate], x, y), abs(z) - THICKNESS)


def witnesses(plate: str, n: int = 48, seed: int = 5):
    poly, rng, pts = PLATES[plate], random.Random(seed), []
    xs, ys = [v[0] for v in poly], [v[1] for v in poly]
    while len(pts) < n:
        p = (rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys)),
             rng.uniform(-THICKNESS, THICKNESS))
        if residual(plate, p) == 0.:
            pts.append(p)
    return pts


def referee(plate: str, angle: int, seed: int) -> str:
    """Independent check with fresh witnesses: yes / no / U."""
    c, s = cos(radians(angle)), sin(radians(angle))
    verdicts = {witness_verdict(residual(plate, (c * x - s * y, s * x + c * y, z)),
                                1e-9, 1e-6)
                for x, y, z in witnesses(plate, seed=seed)}
    return "no" if "no" in verdicts else ("U" if "U" in verdicts else "yes")


# ------------------------------------------------------------ learners

def _norm(a: int) -> int:
    return a % FULL


def memorizer(observed: dict[int, str], query: int) -> dict:
    a = _norm(query)
    return {"angle": a, "answer": observed.get(a, "U"),
            "provenance": ["observed"] if a in observed else []}


def composer(observed: dict[int, str], query: int) -> dict:
    """Breadth-first positive closure; returns the shortest observed chain."""
    a = _norm(query)
    if a in observed:
        return {"angle": a, "answer": observed[a], "provenance": ["observed"]}
    generators = sorted(k for k, v in observed.items() if v == "yes" and k % FULL)
    chains = {g: [g] for g in generators}
    frontier = list(generators)
    while frontier:
        nxt = []
        for x in frontier:
            for g in generators:
                y = _norm(x + g)
                if y and y not in chains:
                    chains[y] = chains[x] + [g]
                    nxt.append(y)
        frontier = nxt
    if a in chains:
        chain = chains[a]
        return {"angle": a, "answer": "yes",
                "provenance": [f"observed {g}° -> yes" for g in sorted(set(chain))]
                + [" ∘ ".join(f"{g}°" for g in chain) + f" = {a}°"],
                "status": "derived_untested"}
    return {"angle": a, "answer": "U", "provenance": []}


# ------------------------------------------------------------ experiment

DESIGN = {  # fixed before any result was seen
    "plate_a": {"observed": [90], "tests": [180, 270, 45]},
    "plate_b": {"observed": [180, 90], "tests": [270, 60]},
    "plate_c": {"observed": [120, 90], "tests": [240, 60]},
}


def run(design=DESIGN, observe_seed: int = 5, check_seed: int = 99) -> dict:
    report = {}
    for plate, spec in design.items():
        observed = {_norm(a): referee(plate, a, observe_seed) for a in spec["observed"]}
        rows = []
        for t in spec["tests"]:
            preds = {name: fn(observed, t) for name, fn in
                     (("memorizer", memorizer), ("composer", composer))}
            truth = referee(plate, t, check_seed)  # independent, after prediction
            for p in preds.values():
                if p.get("status") == "derived_untested":
                    p["status"] = {"yes": "confirmed", "no": "refuted"}.get(truth, "U")
            rows.append({"angle": t, "truth": truth, **preds})
        report[plate] = {"observed": observed, "tests": rows}
    return report


def score(report: dict) -> dict:
    out = {}
    for learner in ("memorizer", "composer"):
        s = {"correct_yes": 0, "false_yes": 0, "U": 0, "correct_no": 0}
        for plate in report.values():
            for row in plate["tests"]:
                ans, truth = row[learner]["answer"], row["truth"]
                if ans == "U":
                    s["U"] += 1
                elif ans == "yes":
                    s["correct_yes" if truth == "yes" else "false_yes"] += 1
                elif ans == "no" and truth == "no":
                    s["correct_no"] += 1
        out[learner] = s
    return out


if __name__ == "__main__":
    import json
    r = run()
    print(json.dumps({"report": r, "score": score(r)}, indent=2, ensure_ascii=False))
