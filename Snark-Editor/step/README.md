# Snark ↔ STEP

**მოკლედ.** Snark-ის ფაილი STEP-ად გადადის ზუსტი ზედაპირებით, STEP-ის ფაილი კი Snark-ად იკითხება. ამავე ხელსაწყოებით აეწყო Snark_07 და Snark_08. ეს ყველაფერი გაკელიმ სხვა Claude-სესიაში გააკეთა (მეგობრის ანგარიშზე), 2026 წლის 19 ნოემბერს.

Made by Gakely with another Claude session (on a friend's account) on 19 November 2026, and added to the repository from the files he sent: `snark_step_v03.zip`, `snark_step_v04.zip` and the pages `Snark_06.html`, `Snark_07.html`, `Snark_08.html`. Version 04 of the zip holds every file of 03 unchanged, plus `embed08.py` and `test08.cjs`; the six sample STEP files came only in 03.

Only paths were changed so that the scripts run here. The converters import `../src/snark_core.js`, which is byte for byte the core they were written against, and the build scripts read and write next to `Snark-Editor/`.

## Files

| file | what it is |
|---|---|
| `snark_step.mjs` | Snark → STEP AP214, a B-rep with exact surfaces: `node snark_step.mjs in.snark [out.step] [chord]`. The evaluated mesh gives only the topology (which patch touches which); every face gets its exact surface from the Snark description (cards, edge rules, profiles), and borders become exact lines, circles or cubic Bézier curves. A point feature on a flat face becomes one face per profile segment (plane, cylinder, cone, sphere, torus, or a surface of revolution). Features over a rounded edge become B-spline nets fitted to the exact shape. |
| `step_snark.mjs` | STEP (AP203, AP214, AP242 B-rep) → Snark with `mesh=final`: `node step_snark.mjs in.step [out.snark] [chord]`. A face on a plane, cylinder, cone, sphere or torus becomes a patch with its exact card. Neighbouring faces on the same surface become one patch. Line and circle edges become seams. Faces on other surfaces (NURBS, revolution, extrusion) are kept as their mesh, with the card `free`. Lengths are converted to millimetres. |
| `embed07.py`, `embed08.py` | build `Snark_07.html` and `Snark_08.html` from `Snark_05.html` with both converters inside: `cd step && python3 embed08.py Snark_05 Snark_08` |
| `rt.mjs`, `check_mesh.mjs` | checks of STEP → Snark: closedness, volume, how far the points lie from their cards; open or wrongly turned edges |
| `check_step.py` | reads a STEP file with OpenCascade (`pip install cadquery-ocp`) and reports solids, validity, free edges, volume and the kinds of surfaces |
| `mk_occ.py`, `mk_occ2.py` | make STEP files with OpenCascade, another kernel, to read back |
| `samples/` | six such files: a bracket with fillets, a box with a spherical hollow, a NURBS bracket, a sphere with a blind hole, a part in inches, a vase with a hole |
| `test07.cjs`, `test08.cjs` | the browser runs of that session, kept as they were. They print what happens, without pass or fail, and use that session's paths and files. |

`Snark_06.html` was built with an earlier writer (0.2) whose script did not come with the files; it is kept as it came.

## Checked here, 19 November 2026

- **The pages match their sources.** `embed07.py` and `embed08.py`, run here on the repository's `Snark_05.html`, give `Snark_07.html` and `Snark_08.html` byte for byte as Gakely sent them.
- **Snark → STEP**, read back by OpenCascade (cadquery-ocp 8.0.1): every solid valid, with no free edges.
  - Example 2 (`plate_hole.snark`): 8 faces (6 planes, 2 cylinders), 22 869.03 mm³. That is exactly 60·40·10 − π·6²·10; the stored mesh of the file, whose hole is a 32-gon, gives 22 876.28.
  - Example 1 (`plate_bump.snark`): 57 faces (planes, cylinders, tori, spheres, surfaces of revolution), 24 148.05 mm³. Snark's own mesh gives 24 143.06 at 0.02 mm and 24 146.79 at 0.005 mm.
  - The demo scene of Snark_05: three solids of 302, 94 and 109 faces, with B-spline nets where features go over edges (the writer reports them fitted within 1.4·10⁻⁴ mm). Volumes are 63 266.31, 40 452.02 and 38 857.41 mm³, against 63 262.71, 40 449.41 and 38 850.60 from Snark's skins. The file is 9.7 MB and took 35 s here.
- **STEP → Snark** on the six samples: every mesh closed; points within 3·10⁻⁶ mm of their cards; volumes within 0.12 % of OpenCascade's (the importer meshes at a chord of 1/2500 of the part's size, 0.05 mm on a part some 120 mm across); the file in inches scaled by 25.4; the editor recognises a box and a sphere where they come whole.

## Limits

These are the writers' own notes, and what the checks above show.

- Blended groups of features, and edge profiles of more than one segment, have no exact surface yet. They are written as flat facets, and this is reported.
- STEP has no features, edge rules or recipe. A read STEP file is patches with cards, plus `free` patches for NURBS, revolution and extrusion surfaces. Recognising features in it is a later step.
- A scene with features over edges makes a large STEP file (10 MB for the demo) and takes tens of seconds.
