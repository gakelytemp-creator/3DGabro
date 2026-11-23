# GSE-001 — Phase 0 prototype (no learning)

Isolated prototype for [protocol #2](https://github.com/gakelytemp-creator/3DGabro/issues/2) and [preregistration #3](https://github.com/gakelytemp-creator/3DGabro/issues/3).

**What it DOES:** 16×16×16 sampled-occupancy toy geometry; seeded Box/Cylinder Boolean union/subtraction programs; a fixed exhaustive search baseline; separate geometry and parametric-edit scores; deterministic JSONL and manifest; unit tests.

**What it DOES NOT:** exact CAD solids, arbitrary orientations, complete CSG equivalence proofs, a neural network, actual self-play/RL, GPU use, unseen held-out reconstruction benchmarks, any claim about questionnaires. It must not be used as evidence that N beats search. No production Snark/editor files touched.

## Run (Python 3.10+, no dependencies)

From `experiments/gse001/`:

```sh
python -m unittest -v
python run.py --seed 7 --count 100 --output artifacts/phase0
```

The `episodes.jsonl` stores each program, predicted program, both scores and enumeration cost. `manifest.json` stores digest and averages. No timestamps in replayable core output. The output directory is intentionally not committed.

## Important limitations for next PR

1. The catalogue is deliberately small and in-distribution; exact enumeration is expected to solve its samples. This is a **plumbing smoke test** and not a meaningful test of generalization.
2. Edit intervention names are semantically aligned in this toy DSL; arbitrary real CAD programs need a well-defined parameter correspondence and multiple editing tests.
3. Voxel IoU is not continuous geometric equivalence. Replace with a better geometry kernel/representation before scientific claims.
4. Add held-out *program families/combinations* and a learnable model only in subsequent, audited stages.
5. All hidden test parameter sets remain outside this public repository; publish their SHA-256 commitment separately after generation and before main results.

See Issues #2 and #3 for phase gates and evaluation requirements.
