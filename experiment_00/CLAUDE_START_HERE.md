# HOUSE-01 — Claude execution brief (RTX 4060)

**Do the engineering work; do not request a long conceptual explanation from the user.** Read the full package's `README.md`, `EXPERIMENT_SPEC.md`, and `PATTERN_ATLAS.md`. The source data and last working offline HTML viewer are committed **directly in this same `experiment_00/` directory** (not in subdirectories).

Goal: Learn plane evidence / ideal thin cross-sections from thick noisy slabs sweeping through surface point clouds along X/Y/Z, and test whether a tiny neural network is actually better than classical geometry.

1. Inspect `detal_original.obj`, `detal_cloud_clean.ply`, `detal_cloud_noisy.ply`: sample count, units/bounds, correspondence and mesh properties. OBJ is a triangle mesh, **not** full parametric CAD.
2. Preserve `index_slice_fixed.html` unchanged: it was visually tested by the user; it is not a trained model.
3. Generate varied source objects: random planes and planar patches, crossing faces and simple composite shapes; vary rotation, axis, slab thickness, point density, noise and outliers. Start with simple **planes**. Include cylinders only as OOD/false-plane stress cases initially.
4. Compute ideal targets from **analytic planes or exact reference-mesh section**, not from arbitrary sparse noise-free PLY slices.
5. Implement compact PyTorch model. An initial CNN on multi-channel 2-D slab images (occupancy, counts, depth mean/variance) is fine. Preserve known axis, slab position and thickness. Predict plane presence, normal/offset (where identifiable) and/or ideal section contour. Distinguish coincident/parallel slab cases from line motion.
6. Implement baselines: raster smoothing+robust line detection, and 3-D RANSAC/robust plane fit using precisely the same slab points as the network.
7. Partition by source geometry **before slicing**, and keep replicated noise/rotation variants within source group. Train, validate and evaluate on held-out source objects and compositions. The provided OBJ is an independent final demo, not a training object.
8. For three-axis passes, look for: nearly parallel plane → brief broad occupancy burst; perpendicular plane → persistent line; oblique plane → translating line; junction → multiple/terminating lines; cylinder → curved/tangent-like patterns. **Translation direction and relative speed together** constrain plane normal. See `PATTERN_ATLAS.md`.
9. Evaluate plane normal angular error, positional distance error, section contour error, plane detection false positives, sensitivity to noise and thickness, runtime/RTX 4060 VRAM. Include misdetections and honest comparison to baselines.
10. Save executable data generator, training/evaluation scripts, configuration/seed, `README_RUN.md`, real logs and `results/HOUSE01_REPORT.md` with side-by-side images: noisy input / exact target / network output / baseline. Report PASS/PARTIAL/FAIL/NOT_EVALUABLE according to the detailed protocol.

**Begin directly with data inspection, a minimal smoke test, then actual training and evaluation if GPU available. No invented training outputs.**