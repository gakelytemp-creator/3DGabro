# HOUSE-01 Pattern Atlas (predicted signatures, not learned results)

The measurement object is a 3-D slab centered at position t, of thickness h, sweeping along X, Y or Z. For a sampled surface point p, it enters the slab when |p_axis - t| <= h/2. Project selected points onto the other two axes, retaining their displacement along slab axis for the model. The same coordinate frame applies to thin ideal targets.

| Surface and orientation | Expected temporal pattern | Caution |
|---|---|---|
| Plane parallel to measurement slab | Short-lived dense / broad 2-D patch | Not a translating line. Height of burst depends on noise and h. |
| Plane perpendicular to slab | Nearly stationary thin line across successive positions | Finite surface makes line start/stop. |
| Oblique plane | Straight line translating across successive frames | Both velocity direction and magnitude are needed to infer 3-D plane normal. |
| Two intersecting planes | Multiple lines; changes in endpoints and crossings | Plane intersection is infinite; finite edge must be verified by support boundaries. |
| Rectangular fork/notch | Repeated and terminating straight segments | Multiple faces may overlap when slab thick. |
| Cylinder parallel to sweep | Similar circular contour persists along height | Tangency and triangulated facets can imitate planes locally. |
| Cylinder transverse to sweep | Chords/arcs moving and changing width | Do not label a tangency as a real planar face. |
| Sphere | Circular sections expanding then contracting | Outside primary HOUSE-01 scope. |
| Empty region | No coherent surface | Must measure false positives, not force a classification. |

## Geometry check

For a plane z = a x + b y + c, a thin slice z = t gives a x + b y = t - c. The slice line travels in XY perpendicular to itself at ds/dt = 1/sqrt(a^2+b^2). For a nearly horizontal plane a and b approach zero and this moving-line representation becomes ill-conditioned; detect broad simultaneous occupation instead.

## Roadmap

HOUSE-01: plane estimation, denoised thin sections, classical baseline comparison.
HOUSE-02 (only if justified): multiple-plane assignments, intersections, finite edge verification, CAD constraints.

This atlas describes **hypotheses to test**, not automatically proven signatures or a finished system.