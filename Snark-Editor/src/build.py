#!/usr/bin/env python3
"""Build a Snark editor version: the template with the Snark core inlined, one HTML file that needs no server.

    python3 src/build.py            -> Snark_00.html next to src/
    python3 src/build.py Snark_01   -> Snark_01.html (the name also goes into the page title and messages)
"""
import re, sys, pathlib
src = pathlib.Path(__file__).resolve().parent
core = (src / 'snark_core.js').read_text(encoding='utf-8')
core = re.sub(r'^export (const|function|let) ', r'\1 ', core, flags=re.M)
core = re.sub(r'^export \{[^}]*\};?\s*$', '', core, flags=re.M)
assert 'export ' not in re.sub(r'//.*|/\*[\s\S]*?\*/', '', core).replace('exported', ''), 'an export statement was left in the core'
html = (src / 'template.html').read_text(encoding='utf-8')
assert html.count('/*__CORE__*/') == 1
name = sys.argv[1] if len(sys.argv) > 1 else 'Snark_00'
out = src.parent / (name + '.html')
out.write_text(html.replace('/*__CORE__*/', core).replace('Snark_00', name), encoding='utf-8')
print('built', out.name, out.stat().st_size, 'bytes')
