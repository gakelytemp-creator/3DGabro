# HOUSE-01 — EXPERIMENT SPECIFICATION
Version: 0.1. Status: PLANNED, UNTRAINED.

## Mission
With a small neural network, recover ideal thin sections and planar geometric parameters from thick moving slabs of noisy surface point clouds. The long-term CAD goal is accurate planes then inferred intersections/finite edges. **HOUSE-01 must establish whether a small model outperforms conventional geometric estimation; it must not presuppose that it does.**

## Data and manual precedent
- `detal_original.obj`: original triangulated reference body.
- `detal_cloud_clean.ply`: 30,000 sampled surface points without additive noise.
- `detal_cloud_noisy.ply`: noisy version.
- `index_slice_fixed.html`: last working, user visually confirmed offline WebGL manual demonstration with X/Y/Z slabs and thickness control. Preserve this HTML unchanged. The user saw interpretable patterns even on noisy point clouds. No automatic recognition was performed.

Do not train/test on slightly perturbed copies of the same object in different partitions. Use this supplied part as an independent demonstration or held-out example.

## Physical measurement
For axis k in {X,Y,Z}, center t and total thickness h, collect points with |p_k - t| <= h/2. Record in-plane coordinates, residual along sweep axis, point counts/densities, axis, t and h. All coordinate conventions must be consistent. No information leakage from hidden source geometry into network input.

Ideal targets must come from analytic surface intersections or the exact triangle-plane intersections of reference geometry. A finite 'clean' point cloud does **not** equal an exact contour.

## Geometric signatures to test
- Plane parallel to sweep slab: dense broad planar occupancy appearing briefly near its coordinate, not a moving narrow line.
- Plane perpendicular to sweep slab: approximately stationary straight line over multiple steps; finite extents can begin/end.
- Oblique plane: translating straight line, whose direction and rate constrain the plane normal.
- Intersecting planar faces/notch: multiple linear traces, joining or terminating at finite boundaries.
- Cylinder along sweep axis: recurring closed/curved contour; cylinder transverse: changing arcs/chords and potential tangencies. Cylinder is an early false-plane stress case, **not necessarily training target in version 1**.
- Sphere: circle sizes grow and shrink; defer to later tests.
- Empty/background: do not hallucinate planes.

If z=ax+by+c, a thin z=t intersection gives ax+by=t-c; perpendicular slice-line speed in xy = 1/sqrt(a^2+b^2), where defined. The near-parallel case requires a separate broad-patch detector.

## Experiment stages
1. Parse and validate OBJ/PLY bounds, sample counts, units, correspondence, and orientations.
2. Create a synthetic generator of analytic planar patches, rotated planes, multi-plane solids and simple notched prisms with varying number of points, noise, outliers and slab thickness.
3. Create deterministic train/validation/test partitions **by source geometry** prior to slicing or introducing rotations/noise.
4. Implement classical baseline with robust 3D plane fitting (e.g. RANSAC + least-squares refinement), plus basic 2D slab pattern fitting where appropriate. Use same observation data in baseline and network.
5. Implement a *small* PyTorch CNN using a 2D multi-channel raster (occupancy/count/depth summary) or compact point network. Predict plane existence and/or plane normal/offset, and reconstruct ideal contour from prediction. Keep model small enough for a **single NVIDIA RTX 4060**, check available VRAM.
6. Run real training and evaluation with fixed seeds. Tune only on validation, report truly held-out test metrics.
7. Visualize side-by-side noisy slab, ideal intersection, neural prediction and baseline result at fixed axis/position/thickness, for best and worst cases. Inspect supplied part only at final demonstration phase.

## Metrics
- Angular normal error (sign invariant, `acos(|n_pred dot n_true|)` for normalized normals).
- Plane offset or signed distance discrepancy at reference coordinate, with aligned sign convention.
- 2D contour distances (Chamfer or equivalent), false negatives/missed lines, false-positive face detections.
- Noise and thickness sweeps, object/orientation generalization.
- Runtime, parameter count, max GPU VRAM and train time.
- Specifically report bad cases, ambiguity and conditions where baseline wins.

## Reproducibility and output
Provide `src/` implementation, `configs/` run configuration and seeds, `results/HOUSE01_REPORT.md`, example images, saved model/checkpoint, and `logs/` training trace. Avoid committing huge training datasets/checkpoints without reason; document how to reproduce them.

Final status must be one of PASS / PARTIAL / FAIL / NOT_EVALUABLE, with documented evidence. Do not report PASS merely because an example looks clean or because the network trained.

## Workflow for Claude at workplace
Claude: Read `CLAUDE_START_HERE.md`, this specification and `PATTERN_ATLAS.md`; do the minimal smoke test and proceed to implementation and actual train/eval on RTX 4060. Choose sensible technical parameters without burdening the user with repeated questions; explain only genuine blockers. The user will bring the real result back for independent review.
