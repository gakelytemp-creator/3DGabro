# 3DGabro Editor — 00

Early, isolated prototype of a Corel-like parametric 3D editor inside the 3DGabro repository.

## Model

- Parent: a box with center-local origin (0, 0, 0), exact X/Y/Z dimensions, world position and Euler rotation.
- Feature: a cylinder anchored to one of the six parent faces, with local U/V offsets, diameter, and extrusion height.
- Face attachment means parent transforms carry the feature along automatically.
- ADD produces a single joined closed triangle surface for the box and protruding cylinder.
- CUT produces a through bore in the box, not a blind pocket.
- Changes rebuild the generated geometry deterministically. JSON exports the *construction parameters*, not a triangulated mesh.

## Use

Open `index.html` with an internet connection (the 3D library loads from a CDN). Adjust values on the left. Drag to rotate, right-drag to pan, wheel to zoom. Save the construction as JSON.

## Explicit limitations

- Not a generic Boolean/CSG engine. ADD and CUT support one cylinder fully contained within a box face, perpendicular to it.
- Currently only one parent box and one cylinder feature.
- No re-import of JSON, CAD/BREP export, undo history, nested assemblies, snapping to arbitrary faces, or partial-depth cavities yet.
- The model's local origin is the parent's center. Cylinder placement is described in face-local coordinates.
- The runtime must be tested in a browser; a successful GitHub commit is not a browser validation.

## Next small steps

1. Validate all six faces, ADD/CUT, parent rotation, center offsets and exported JSON.
2. Add precise selection and alignment by symmetry axes and face centers.
3. Add multiple features and reversible operation history.
4. Only then integrate with the 3DGabro reconstruction/recognition pipeline.

The existing reconstruction code is intentionally untouched.
