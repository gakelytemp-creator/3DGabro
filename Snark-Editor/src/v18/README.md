# Sources of Snark_18

`Snark_18.html` is built from `Snark_05.html` (which `src/template.html` and `src/snark_core.js` make) and the files of this folder. Of the versions between 05 and 18, `Snark_06.html`, `Snark_07.html` and `Snark_08.html` are kept as files (added on 19 November, with the scripts that built 07 and 08 in [`../../step/`](../../step/README.md)); the others were working steps of two days and are not kept. What each added is listed in [the editor's README](../../README.md).

Added to the repository on 20 November 2026 from `snark_18_github.zip`, which Gakely sent from another Claude session (on a friend's account). Its files are kept as they came. Here this README got notes about the repository (the paragraph above, and the line on `step_snark.mjs` below), and `snark_core.js` was added: one line that passes on the core from `../snark_core.js`, so that the two converters also run in place.

## Build

```
cd Snark-Editor/src/v18
npm install        # once: Manifold 3.5.5 (and three.js + Playwright for the tests)
sh build.sh        # writes ../../Snark_18.html
```

The build is a chain of small Python scripts. Each one runs the one before it and then changes the page by exact text replacements; every replacement asserts that its target is found exactly once, so a change of the page underneath cannot pass unnoticed.

| script | what it adds to the page |
|---|---|
| `embed07.py` | starts from `Snark_05.html`; puts in the two STEP converters (`snark_step.mjs`, `step_snark.mjs`) |
| `embed08.py` | File menu (New, Open, Save, Import, Export), STL import, bodies coloured by how they are built with a palette to edit, smooth shading of stored meshes |
| `embed10.py` | the LightWave reader (`lwo_snark.mjs`); one patch name = one body on import; the list groups many stored bodies |
| `embed11.py` | the interface in English by default |
| `embed12.py` | the manipulator, roles and crossings (`gizmo.js`); stored bodies can be selected, moved and deleted |
| `embed13.py` | Manifold built into the page; the running line; unchanged bodies are not worked out again; the history of Boolean results in the file (`#@bool`, `#@part`); `role=tool` in the recipe; the slicer (`slicer.js`); the map of the file at the top of the script |

This chain is the honest record of how the page grew, not a good way to keep it. The next tidy-up is to fold these changes into `src/template.html` and `src/snark_core.js`, so that one `build.py` makes the page again.

## Modules

| file | what it is | can run alone |
|---|---|---|
| `step_snark.mjs` | STEP (AP203 / AP214 / AP242 boundary representation) → Snark. Reads the Part 21 text, makes a mesh of every face in its own (u, v), and writes each face as a patch with its card: `plane`, `cyl`, `cone`, `sph`, `torus`, or `free` for NURBS and surfaces of revolution. `stepToSnark(text, { chord?, title })` | yes, in Node (`snark_core.js` here passes on `../snark_core.js`) |
| `snark_step.mjs` | Snark → STEP with exact surfaces: planes, cylinders, spheres, rounded edges as surfaces of revolution and B-splines, features. `snarkToStep(text, name)` | yes, in Node |
| `lwo_snark.mjs` | LightWave object (`.lwo`: LWOB, and LWO2 written from the specification) → Snark as a plain mesh, one patch per surface. `lwoToSnark(buffer, fileName, scale)` | yes |
| `gizmo.js` | the manipulator (move, size, turn), Object ↔ Tool, the rule that objects do not enter each other, the Boolean operations with Manifold, the history kept with a result, Take apart, the red crossings | no: it is a part of the page and uses its state |
| `slicer.js` | `snarkSlice({ z, stepX, stepY })`: outlines in a plane Z = const, made from the history of Boolean results, on the steps of the machine; the panel, DXF and SVG | no: a part of the page |

## Tests

Headless Chromium through Playwright; three.js is served from `node_modules`, so no network is needed. Run from this folder, after the build:

```
node tests/test_boolean.cjs    # Cut / Join / Common on simple bodies, volumes against exact numbers
node tests/test_history.cjs    # the history: written, read back, moved, taken apart (the heavy demo, about a minute)
node tests/test_slice.cjs      # the slicer: areas, the grid of the steps, DXF and SVG
```

They print what they measured; they do not yet say PASS or FAIL by themselves. The numbers of 20 November 2026 are in the editor's README.

## Third-party code inside the page

- **three.js 0.180.0** (MIT) — loaded from a CDN when the page opens.
- **Manifold 3.5.5** (Apache-2.0, https://github.com/elalish/manifold) — its JavaScript and its WebAssembly (as base64) are copied into the page, so Boolean operations and the slicer work without a network.
