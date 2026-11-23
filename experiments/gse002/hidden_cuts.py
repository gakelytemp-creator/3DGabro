"""GSE-002: find cuts that a summary rule hid in raw yes/no/U checks.

The detector is given raw check records and a set of generic grouping
operations (group by any attribute present in the records). It is NOT given
any target value: no angle, axis or surface name is searched for. Surface
names are used only to call the external referee (`probe`), never by the
detector itself.

Pipeline:
  raw table -> summary event (addressable, rule + table hash)
            -> candidate cuts (pure-'yes' groups hidden by a global 'no')
            -> permutation control (verdicts shuffled against attributes)
            -> addressable, executable question with provenance and history
"""
from __future__ import annotations

import hashlib
import json
import random
from collections import defaultdict

from probe import motion_question, rotation, sample_surface, surface_residual, witness_verdict


def _digest(obj) -> str:
    text = json.dumps(obj, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- raw table

def raw_table(name: str, axis: str, angles: tuple[float, ...],
              n: int = 32, seed: int = 7) -> list[dict]:
    """One record per (witness, angle). Attributes are generic descriptors."""
    rows = []
    for i, p in enumerate(sample_surface(name, n, seed)):
        for a in angles:
            residual = surface_residual(name, rotation(axis, a)(p))
            rows.append({
                "attrs": {"witness": i, "angle": round(a, 12),
                          "x_pos": p[0] > 0, "y_pos": p[1] > 0, "z_pos": p[2] > 0},
                "verdict": witness_verdict(residual),
                "residual": residual,
            })
    return rows


# ---------------------------------------------------------- summary as event

def summarize_all_yes(rows: list[dict]) -> str:
    verdicts = [r["verdict"] for r in rows]
    if not verdicts:
        return "U"
    if "no" in verdicts:
        return "no"
    return "U" if "U" in verdicts else "yes"


def summary_event(rows: list[dict], context: dict) -> dict:
    counts = {v: sum(r["verdict"] == v for r in rows) for v in ("yes", "no", "U")}
    return {"op": "summarize", "rule": "all_yes", "table": _digest(rows),
            "rows": len(rows), "counts": counts,
            "result": summarize_all_yes(rows), "context": context}


# ---------------------------------------------------------- candidate cuts

def candidate_cuts(rows: list[dict], min_size: int = 2) -> list[dict]:
    """Groups (by any attribute) that are entirely 'yes' and a proper subset."""
    keys = sorted({k for r in rows for k in r["attrs"]})
    found = []
    for key in keys:
        groups = defaultdict(list)
        for r in rows:
            groups[r["attrs"].get(key)].append(r["verdict"])
        if len(groups) < 2:
            continue  # the cut does not split anything
        for value, verdicts in groups.items():
            if len(verdicts) >= min_size and all(v == "yes" for v in verdicts):
                found.append({"attr": key, "value": value, "size": len(verdicts)})
    return sorted(found, key=lambda c: (-c["size"], c["attr"], str(c["value"])))


def strongest(rows: list[dict]) -> int:
    cuts = candidate_cuts(rows)
    return cuts[0]["size"] if cuts else 0


def permutation_control(rows: list[dict], n_perm: int = 500, seed: int = 11) -> dict:
    """Shuffle verdicts against attributes; keeps counts, destroys structure."""
    observed = strongest(rows)
    rng = random.Random(seed)
    verdicts = [r["verdict"] for r in rows]
    null = []
    for _ in range(n_perm):
        shuffled = verdicts[:]
        rng.shuffle(shuffled)
        null.append(strongest([{"attrs": r["attrs"], "verdict": v}
                               for r, v in zip(rows, shuffled)]))
    at_least = sum(x >= observed for x in null)
    return {"observed": observed, "n_perm": n_perm, "seed": seed,
            "null_max": max(null), "null_mean": sum(null) / n_perm,
            "p": (1 + at_least) / (1 + n_perm)}


# ---------------------------------------------------------- questions

def discover(rows: list[dict], context: dict, alpha: float = 0.01,
             n_perm: int = 500, seed: int = 11) -> dict:
    """Return the summary event, and a question only if a hidden cut survives."""
    event = summary_event(rows, context)
    out = {"summary": event, "question": None, "control": None}
    if event["result"] != "no":
        return out  # nothing hidden by an all-yes rule that already says yes
    cuts = candidate_cuts(rows)
    if not cuts:
        return out
    control = permutation_control(rows, n_perm, seed)
    out["control"] = control
    if control["p"] > alpha:
        return out
    best = cuts[0]
    executable = {"op": "motion_subset_preserves", "axis": context["axis"],
                  "attr": best["attr"], "value": best["value"]}
    out["question"] = {
        "id": "q:" + _digest(executable),
        "kind": "cut_question",
        "executable": executable,
        "origin": {"event": "hidden_by_summary", "summary_table": event["table"],
                   "summary_rule": event["rule"], "source": context},
        "evidence": {"group_size": best["size"], "global_counts": event["counts"],
                     "other_candidates": cuts[1:5], "control": control},
        "status": "candidate",
        "history": [{"step": "proposed", "table": event["table"]}],
    }
    return out


def execute(question: dict, name: str, n: int = 32, seed: int = 23) -> dict:
    """Reuse a stored question on another (unnamed to the detector) surface."""
    ex = question["executable"]
    if ex["attr"] != "angle":
        result = {"status": "U", "reason": f"attribute '{ex['attr']}' does not transfer"}
    else:
        r = motion_question(name, sample_surface(name, n, seed), ex["axis"], (ex["value"],))
        result = {"status": r["status"], "checks": r["checks"], "counts": r["counts"]}
    question["history"].append({"step": "executed", "target": name, "seed": seed, **result})
    return result


def run(angles: tuple[float, ...], surfaces=("plane", "sphere", "cylinder", "torus"),
        axes=("x", "z")) -> dict:
    report = {}
    for name in surfaces:
        for axis in axes:
            rows = raw_table(name, axis, angles)
            report[f"{name}/{axis}"] = discover(rows, {"surface": name, "axis": axis})
    return report


if __name__ == "__main__":
    from math import pi  # experiment design (same angles as probe.examples), not detector
    design_angles = (0.3, 0.8, 1.4, pi)
    print(json.dumps(run(design_angles), indent=2, sort_keys=True, default=str))
