# SnarkScan_10 — sources

`SnarkScan_10.html` = `SnarkScan_09.html` + `../axis/axis_profile.js` + three exact replacements in `build10.py`:
the name; the module (wrapped as `AX10`) and `c10Bores` at the head of the main script; after Recognise the bores go into
the journal (cards of kind `bore`) and into `SCAN.rec.bores`; the panel of Recognise gets a table **Bores** before Planes.
The recognition of 09 is not changed.

    python3 build10.py SnarkScan_09.html ../axis/axis_profile.js SnarkScan_10.html
    node run10.cjs SnarkScan_10.html 01.obj out.json      # Playwright + Chrome, three@0.180.0 in node_modules

Run of 25 November 2026 on 01.obj (`run10_01obj.json`): 10 cylinders → 4 bores, 4 journal cards, panel shown, no page errors.
