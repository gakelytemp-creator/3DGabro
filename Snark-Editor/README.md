# Snark Editor

**მოკლედ.** Snark-ის სხეულების გამოსაცდელი რედაქტორი (ბოლო ვერსია Snark_02): კუბი, ცილინდრი და სფერო; წიბოები სპლაინით, რკალით ან ფასკით; ფიჩერები ბრტყელ ზედაპირებზე — გუმბათი, ორმო, ბოსი, კრატერი — გამეორებით (ბადე, ფიჭა, წრე) და შერწყმის წესებით; ფაილის ჩაწერა და წაკითხვა, ფაილი მეხსიერებაში და ეკრანზე გამოტანა. ერთი HTML ფაილია, ბრაუზერში იხსნება.

Test bench for Snark bodies and the first reference reader and writer of the [Snark standard](../standards/snark/SNARK.md) (draft 0.1). One HTML file: open it in a browser with an internet connection (three.js loads from a CDN).

## Versions

| file | date | what is new |
|---|---|---|
| [`Snark_00.html`](Snark_00.html) | 2026-11-18 | first version: cube, cylinder, sphere; edge rules; write ⇄ read; memory view; display options |
| [`Snark_01.html`](Snark_01.html) | 2026-11-18 | animation for showing: the bodies turn slowly and the edge setback grows from 1 to 20 mm and back |
| [`Snark_02.html`](Snark_02.html) | 2026-11-18 | point features (L2): dome, dimple, boss, pocket, crater or any profile on box faces and cylinder caps; repeats (grid, honeycomb, circle); the blend rules of §8 where they overlap; in the animation they breathe from boss to dimple |

## What it does

- **Scene:** colours, light and room of EDITOR_35, with Z up as in Cripp: the walls are the coordinate planes, nothing is drawn below zero unless a body goes there, and the room only grows. Labels are off by default.
- **Bodies:** box, cylinder, sphere, with centre, size and rotation in the bottom bar. Selected body yellow.
- **Edge rules:** sharp, round R, chamfer or spline. *Setback* (დახევა) is how far from the edge the rounding starts; *fullness* k shapes the spline: 0 is straight, 0.55 almost a circle, 1 almost sharp. Edge sets: all, vertical, top, bottom, top + vertical for a box; both, top or bottom rim for a cylinder.
- **One pipeline on every change:** objects → SnarkDoc → text → SnarkDoc → recognised bodies → exact surfaces → screen. The status bar says whether writing and reading back gives exactly the same text and objects.
- **Text panel:** the file exactly as it will be written. It can be edited and applied; reading it reports every remark and Boojum (§13 of the standard).
- **Memory panel:** the SnarkDoc as it is held in memory, the recognised bodies, what was drawn and the checks.
- **Display:** precision (chord) 0.5 … 0.001 mm; *Snark reader* or *plain OBJ program (L0)* — what a program that knows only OBJ (Rhino, for example) shows from the same file; patch colours; triangles; edge lines (sharp edges, and faint seams where a rounding starts).
- **Features** (from Snark_02): the second row of the bottom bar. ＋, then a click on a flat face of the selected body, puts a dome there; a click on a feature in the scene selects it. Shape: dome (a dimple when h < 0), boss (a pocket when h < 0) or crater, with radius R, height h and fullness (rounding for a boss, rim for a crater); a profile from a file is kept and can be scaled. The small drawing next to the fields is the profile itself. *Repeat*: grid, honeycomb or circle, with pitch, or count and radius; the copies whose collision square fits on the flat part are made (§9). *Blend* (§8): sum, mix, mix with a crease, union (max:0.5), union of pits (min:0.5), or the rule of the file. A feature that does not fit on the flat part is reported and not drawn. The file gets `#@profile`, `#@feature` and `#@pattern` lines, so any Snark reader draws the same shape.
- **Animation** (from Snark_01): the ▶ button in the header. The bodies turn slowly (one turn in 20 s), and every edge setback grows from 1 to 20 mm and back (10 s); a body stops at half its smallest size, so the 40 mm cube becomes a ball, or before its features (from Snark_02), whose heights breathe from h to −h and back. Only the picture changes: the objects, the file and the history stay as they are. ⛶ full screen; ■ or Esc stops.
- **Files:** open `.snark` or `.obj`; save `.snark` (base mesh with rules); export `.obj` for other programs (final mesh with cards); STL.

## Source

| file | what it is |
|---|---|
| `src/snark_core.js` | the Snark core: reader, writer, in-memory SnarkDoc, recognition with the Boojum checks, evaluation of edge rules, final export, STL. An ES module without dependencies, usable from Node. |
| `src/template.html` | the editor page (three.js 0.180.0); the latest version is built from it |
| `src/build.py` | puts the core into the page: `python3 src/build.py Snark_02` makes `Snark_02.html` (without a name: `Snark_00.html`) |
| `src/test_core.mjs`, `src/test_page.cjs` | tests, below |

## How it was checked

- **`node src/test_core.mjs`** — 71 checks, Node only: rotations round-trip; both example files of the standard are read and written back unchanged on the second pass; objects → file → objects gives the same objects and the same text; every evaluated surface is closed at three precisions, and its volume lies within one chord of the exact formula (Steiner's formula for rounded boxes, Pappus for rounded cylinders); normals do not break at seams; round corners lie on their sphere and chamfer corners are flat; the exported final mesh is closed, has the same volume, and every vertex lies on its card; disagreements follow the trust order of §13. Features (26 of the checks): each shape on a box face is closed, comes back the same from its file, and its volume agrees with the exact 2π∫r·h dr; six features with spline edges; patterns (7 × 7 = 49 copies, honeycomb, circle); two overlapping domes under every rule (with `sum` the volumes add); `max:k` has no step where two borders cross (below); 500 random flat parts with up to 12 holes are triangulated exactly, and the flat part around blended features has no needle triangles; caps of cylinders; a feature that does not fit; `min` on raised features is reported; heights turned over (the animation); example 1 with its boss and 12 dimples; the final export with features.
- **`node src/test_page.cjs`** — 65 checks in headless Chromium (Playwright), and no page errors: every control, picking in the scene, undo/redo, text editing with a Boojum, both examples, precision 0.001 mm, the L0 view, Save / Export / STL read back, the animation (the setback runs 1 → 20 mm, the cube at 20 mm is a ball within 0.1 mm, Esc leaves everything as it was), features (placing with a click, every shape, the three repeats, the five rules, picking, undo, a copy of a body, every animation frame closed, example 1), memory view, language and theme. `node src/test_page.cjs Snark_01.html` runs the 40 checks that apply to Snark_01, and `Snark_00.html` the 36 of the first version.
- All passed on 2026-11-18 in a cloud container with a software renderer; one animation frame took 5–15 ms there. Gakely tried Snark_00 on his own computer the same day; Snark_02 has not yet been tried on a real graphics card.

## Explicit limitations

- One edge rule per body; a profile must be symmetric, with the same setback on both faces.
- Corners follow the product rule of SNARK.md §7.4. Three chamfers meet in a small flat triangle; most CAD programs let the three planes meet at a point instead. Which one Snark wants is open.
- Recognised are only whole boxes (6 plane cards), cylinders (2 planes and a `cyl` card) and spheres. Any other body is shown and kept as its stored mesh; its cards are not used to re-tessellate it.
- Features are drawn only as point features on flat faces of recognised boxes and cylinder caps, inside the flat part left by the edge rounding. A feature that would run over an edge (§7.5) is reported and not drawn; so are overlapping features whose combined circle touches the border of the flat part.
- A single feature is exact: its rings follow the profile, walls included. Where features overlap, the blended heights are evaluated on a polar grid (at the default precision its spacing is 1/16 of the smallest radius), so walls and creases there are approximate.
- `max:k` and `min:k` (§8.2) as written leave a step of k/4 at the two points where the borders of two features cross. Snark_02 multiplies k′ by s/(s + k/4), s = |h₁| + |h₂|: no step, and almost the same rounding where the features are taller than k. This is a proposal (SNARK.md §18), not yet the standard.
- Curve features (the groove of example 1, pockets of any outline), `fade=`, `grow=`, `region=curve`, curves, creases, levels and seams are kept in the file as written, but not drawn. Recipe `cut` and `int` steps are kept but not evaluated: there is no Boolean engine.
- A recipe step that turns a body differently from its cards cannot be followed yet: the cards are followed and a Boojum is reported.

## Next small steps

1. Decide the chamfer corner (triangle, or the three planes meeting at a point), and the rounding of `max` / `min` where borders cross (SNARK.md §18).
2. Curve features on planes: the groove of example 1, and pockets and bosses of any outline (§7.3).
3. Features over an edge (§7.5), and on curved hosts (the side of a cylinder, a sphere).
4. Different rules on the edges of one body; profiles that are not symmetric.
5. Re-tessellate stored patches from their cards, for example the ⌀12 hole of example 2.
