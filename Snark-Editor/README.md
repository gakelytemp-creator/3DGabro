# Snark Editor

**მოკლედ.** Snark_00 Snark-ის სხეულების გამოსაცდელი რედაქტორია: კუბი, ცილინდრი და სფერო; წიბოები სპლაინით, რკალით ან ფასკით; ფაილის ჩაწერა და წაკითხვა, ფაილი მეხსიერებაში და ეკრანზე გამოტანა. ერთი HTML ფაილია, ბრაუზერში იხსნება.

Test bench for Snark bodies and the first reference reader and writer of the [Snark standard](../standards/snark/SNARK.md) (draft 0.1). One HTML file: open it in a browser with an internet connection (three.js loads from a CDN).

## Versions

| file | date | what is new |
|---|---|---|
| [`Snark_00.html`](Snark_00.html) | 2026-11-18 | first version: cube, cylinder, sphere; edge rules; write ⇄ read; memory view; display options |
| [`Snark_01.html`](Snark_01.html) | 2026-11-18 | animation for showing: the bodies turn slowly and the edge setback grows from 1 to 20 mm and back |

## What it does

- **Scene:** colours, light and room of EDITOR_35, with Z up as in Cripp: the walls are the coordinate planes, nothing is drawn below zero unless a body goes there, and the room only grows. Labels are off by default.
- **Bodies:** box, cylinder, sphere, with centre, size and rotation in the bottom bar. Selected body yellow.
- **Edge rules:** sharp, round R, chamfer or spline. *Setback* (დახევა) is how far from the edge the rounding starts; *fullness* k shapes the spline: 0 is straight, 0.55 almost a circle, 1 almost sharp. Edge sets: all, vertical, top, bottom, top + vertical for a box; both, top or bottom rim for a cylinder.
- **One pipeline on every change:** objects → SnarkDoc → text → SnarkDoc → recognised bodies → exact surfaces → screen. The status bar says whether writing and reading back gives exactly the same text and objects.
- **Text panel:** the file exactly as it will be written. It can be edited and applied; reading it reports every remark and Boojum (§13 of the standard).
- **Memory panel:** the SnarkDoc as it is held in memory, the recognised bodies, what was drawn and the checks.
- **Display:** precision (chord) 0.5 … 0.001 mm; *Snark reader* or *plain OBJ program (L0)* — what a program that knows only OBJ (Rhino, for example) shows from the same file; patch colours; triangles; edge lines (sharp edges, and faint seams where a rounding starts).
- **Animation** (from Snark_01): the ▶ button in the header. The bodies turn slowly (one turn in 20 s), and every edge setback grows from 1 to 20 mm and back (10 s); a body stops at half its smallest size, so the 40 mm cube becomes a ball. Only the picture changes: the objects, the file and the history stay as they are. ⛶ full screen; ■ or Esc stops.
- **Files:** open `.snark` or `.obj`; save `.snark` (base mesh with rules); export `.obj` for other programs (final mesh with cards); STL.

## Source

| file | what it is |
|---|---|
| `src/snark_core.js` | the Snark core: reader, writer, in-memory SnarkDoc, recognition with the Boojum checks, evaluation of edge rules, final export, STL. An ES module without dependencies, usable from Node. |
| `src/template.html` | the editor page (three.js 0.180.0); the latest version is built from it |
| `src/build.py` | puts the core into the page: `python3 src/build.py` makes `Snark_00.html`; `python3 src/build.py Snark_01` makes the next version |
| `src/test_core.mjs`, `src/test_page.cjs` | tests, below |

## How it was checked

- **`node src/test_core.mjs`** — 45 checks, Node only: rotations round-trip; both example files of the standard are read and written back unchanged on the second pass; objects → file → objects gives the same objects and the same text; every evaluated surface is closed at three precisions, and its volume lies within one chord of the exact formula (Steiner's formula for rounded boxes, Pappus for rounded cylinders); normals do not break at seams; round corners lie on their sphere and chamfer corners are flat; the exported final mesh is closed, has the same volume, and every vertex lies on its card; disagreements follow the trust order of §13.
- **`node src/test_page.cjs`** — 40 checks in headless Chromium (Playwright), and no page errors: every control, picking in the scene, undo/redo, text editing with a Boojum, both examples, precision 0.001 mm, the L0 view, Save / Export / STL read back, the animation (the setback runs 1 → 20 mm, the cube at 20 mm is a ball within 0.1 mm, Esc leaves everything as it was), memory view, language and theme. `node src/test_page.cjs Snark_00.html` runs the 36 checks that apply to the first version.
- Both passed on 2026-11-18 in a cloud container with a software renderer; one animation frame took 5–15 ms there. Gakely tried Snark_00 on his own computer the same day.

## Explicit limitations

- One edge rule per body; a profile must be symmetric, with the same setback on both faces.
- Corners follow the product rule of SNARK.md §7.4. Three chamfers meet in a small flat triangle; most CAD programs let the three planes meet at a point instead. Which one Snark wants is open.
- Recognised are only whole boxes (6 plane cards), cylinders (2 planes and a `cyl` card) and spheres. Any other body is shown and kept as its stored mesh; its cards are not used to re-tessellate it.
- Features, patterns, curves, creases, levels and seams are kept in the file as written, but not drawn. Recipe `cut` and `int` steps are kept but not evaluated: there is no Boolean engine.
- A recipe step that turns a body differently from its cards cannot be followed yet: the cards are followed and a Boojum is reported.

## Next small steps

1. Decide the chamfer corner (triangle, or the three planes meeting at a point).
2. Point features on plane hosts — the boss and the dimples of example 1 (the order planned in SNARK.md §16).
3. Different rules on the edges of one body; profiles that are not symmetric.
4. Re-tessellate stored patches from their cards, for example the ⌀12 hole of example 2.
