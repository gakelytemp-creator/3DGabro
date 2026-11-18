# Internal standards

**შიდა სტანდარტები** — file formats and conventions shared by the Gabro projects: 3DGabro, the Cripp editor, the scan-to-drawing tools and the Gabro-CNC-Controller.

## Standards

| standard | file | extension | status |
|---|---|---|---|
| **Snark** — mesh with meaning: an OBJ mesh that also carries exact surfaces, profiles, features and the construction recipe | [snark/SNARK.md](snark/SNARK.md) | `.snark` | draft 0.1 — partly implemented: the Snark editor (Snark_00 … Snark_02, [Snark-Editor/](../Snark-Editor/README.md)) reads and writes it |

Related standard kept in another repository: the `.gabro` package and Gabro Dispatch (Gabro-CNC-Controller, `spec/GABRO_PACKAGE.md`, draft 0.1).

## Rules for this folder

1. **One standard, one subfolder:** `<name>/<NAME>.md`, with examples in `<name>/examples/`.
2. **Status words.** *Concept:* ideas, no syntax yet. *Draft:* syntax proposed, may change at any time. *Frozen:* never changes — any change makes a new version.
3. **Versions** are `major.minor`. A reader of version X.Y must read every X.y with y ≤ Y.
4. **Honesty about testing.** Every standard states what has been tested and how, and what has not.
5. **Language:** English text, with a Georgian glossary of the key terms and a short Georgian summary.
6. **Credits.** Every standard records whose ideas it contains and when they were worked out.
