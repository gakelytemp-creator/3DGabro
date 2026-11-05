# HOUSE-01 | experiment_00

**Status: experimental handoff; no network trained yet.** This is the first small neural-network test for 3DGabro/Noepedia.

## Aim
Recover **planar geometry** from thick moving measurement slabs through a noisy 3-D surface point cloud. The user has already visually confirmed that patterns remain intelligible in the last working offline WebGL HTML viewer. This is observation, not proof of trained model quality.

We aim to fit planes from many noisy samples, then later obtain candidate edges as intersections of verified planes. Infinite plane intersections are not necessarily finite physical CAD edges.

## Dataset package (already committed to GitHub)
All files are located directly in **`experiment_00/`** (no `data/` or `viewer/` subfolders):
- `detal_original.obj` — triangulated reference part
- `detal_cloud_clean.ply` — 30,000 surface points
- `detal_cloud_noisy.ply` — corresponding noisy point cloud
- `index_slice_fixed.html` — user-tested, offline WebGL manual slice demonstration

These files are already uploaded to the repository. Use their existing locations and do not move or overwrite the originals.

## Runtime
Execute implementation and training on an NVIDIA RTX 4060 in the user's workplace (detect actual available VRAM). Preferred Python + PyTorch. Claude should implement generator, simple baselines, small neural architecture, tests, and report, without repetitive planning discussions.

## Critical validity conditions
- Use analytic or mesh/plane-intersection **ideal targets**; clean finite PLY slices are not perfect ground truth.
- Keep alignment, coordinates, position and slab thickness consistent.
- Train/validation/test separation must be by underlying source object, not by adjacent slices.
- Compare a small network against robust conventional plane fitting on the **same input information**.
- Report angular error of plane normal, positional plane error, contour error, failure cases, runtime and memory.
- Never invent measurements or announce success before actually running training and held-out tests.
- Hold out the user's supplied part as an independent demonstration; synthetic randomized shapes supply training examples.

Start from `CLAUDE_START_HERE.md` in the current **GitHub experiment_00 directory**.