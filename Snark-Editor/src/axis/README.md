# axis_profile — cylinders on one axis read as one bore

A pure module (no three.js) for the step after SnarkScan_09's cylinders. Not yet wired into the page.

1. **Families:** cylinders of SnarkScan_09 (`{k, i0, j0, c, zm, slope, r, z0, z1}`) whose axes are parallel and pass close to each other become one axis family.
2. **Profile:** about that axis every scan point within `Rmax` is kept as (t, ρ): along the axis and from it. The turn θ is dropped, so the bore settles into a 2D profile, and views that each reach only part of a deep hole fill each other in.
3. **Reading per slice:** wall radius (nearest surface to the axis, median over 36 sectors), coverage of the turn, and a flat face across the axis (*mouth* if it runs outward from the wall, *floor* if it runs in to the axis). A slice with too little of the turn is a gap, never "no wall".
4. **Verdict:** two mouths on opposite faces with the wall carried between them is one through hole (stepped if the diameter changes). A floor or web inside contradicts it. If the middle was not seen, the verdict is `hypothesized` and the unseen range is listed.

Status words follow the SnarkScan_09 journal: `inferred` / `hypothesized`; claims `supported` / `contradicted` / `untested`. `t` is measured from the family's point `axis.a` along `axis.d`.

    node --test Snark-Editor/src/axis/axis_profile.test.mjs

Tests use synthetic plates (12 mm) with: a counterbore over a through hole with the middle unseen; the same seen through; two blind holes with a web between; a blind hole; parallel and slightly leaning axes.

Not done: drill-point cone at a blind floor, threads, patterns of equal bores, wiring into `SnarkScan_09.html`, a run on a real scan (01.obj).

## First real scan: 01.obj

`node dump_cylinders.cjs SnarkScan_09.html 01.obj outdir` (Playwright + Chrome, three@0.180.0 in `node_modules`) writes the cylinders and the oriented points; then `boresOf` on them. Result in `results/01obj_bores.txt`: the 10 cylinders form **4 bores at the corners of a 97 × 79 mm rectangle**. The two front ones are seen all through (Ø8.5 – Ø19 – Ø8.5 …, inferred); the two rear ones are one Ø8.4 hole whose middle (~23 mm) no side saw — kept as *hypothesized* with the unseen range.

Changes forced by the real scan: axes are compared at their own middles, not extrapolated along a lean (a short cylinder's lean was 14°); a lean above 5° is treated as unmeasured; faces are judged only in a ring beside the wall and floors only close to the axis (other walls of the part and the shelf of a counterbore had read as faces/floors); a slice where no wall of this bore is seen counts as unseen even if other surfaces are there.
