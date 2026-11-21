"""python3 embed14.py Snark_05 Snark_31 — embed13 plus the Scan room (scan.js): a second room of the editor for noisy
   files (scans of real parts), with its own tools, panel and scene; a Bench | Scan switch in the header.
   What this script does to the page: puts scan.js in before the keyboard handlers; adds the switch, the hidden file
   input, the tool column and the side panel; adds the styles of the room (body.scan hides the Bench); and guards two
   pointer handlers of the Bench so that they do nothing while the Scan room is open."""
import re, sys, subprocess, pathlib
base, name = sys.argv[1], sys.argv[2]
subprocess.run([sys.executable, 'embed13.py', base, name], check=True)
p = pathlib.Path(name + '.html'); h = p.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global h
    assert h.count(a) == n, (h.count(a), a[:90]); h = h.replace(a, b)
rep("\n/* ── keyboard ── */", "\n" + pathlib.Path('scan.js').read_text(encoding='utf-8') + "\n/* ── keyboard ── */")
rep('  <div id="status"></div>', '  <span id="desk"><button id="deskBench" class="on" title="The bench: Snark bodies, tools, Boolean operations, the slicer">Bench</button><button id="deskScan" title="The scan room: noisy files of real parts, and their recognition">Scan</button></span>\n  <div id="status"></div>')
rep('<input id="fileImp" type="file"', '<input id="fileScan" type="file" accept=".obj" class="hide"><input id="fileImp" type="file"')
rep('  <div id="busy"><i></i></div>', '''  <div id="busy"><i></i></div>
  <div id="scanTools">
    <button data-tool="open"><b>1</b> Open scan…</button>
    <button data-tool="orient"><b>2</b> Orient</button>
    <button data-tool="signature"><b>3</b> Signature</button>
    <button data-tool="sections"><b>4</b> Sections</button>
    <button data-tool="recognise" title="Planes: runs in the sections, their inheritance, retreat from the edges, intersections"><b>5</b> Recognise</button>
    <button data-tool="groups" title="not built yet"><b>6</b> Groups</button>
    <button data-tool="bench" title="not built yet"><b>7</b> To bench</button>
    <div id="scanMsg"></div>
  </div>
  <div id="scanSide"></div>''')
rep("#boolBox .note.bad{color:var(--err);font-weight:600}", """#boolBox .note.bad{color:var(--err);font-weight:600}
#desk{display:inline-flex;margin:0 8px 0 6px;border:1px solid var(--line);border-radius:5px;overflow:hidden}
#desk button{border:0;background:transparent;color:var(--muted);padding:2px 11px;font:inherit;cursor:pointer}
#desk button.on{background:var(--accent);color:#fff;font-weight:600}
#scanTools,#scanSide{display:none}
body.scan #viewWrap{grid-column:1/-1}
body.scan #tools,body.scan footer,body.scan #side,body.scan #fileMenu,body.scan #viewMenu,body.scan #objectStrip,body.scan #bAnim,body.scan #bCut,body.scan #bSlice,body.scan #chord,body.scan .top-right .lbl,body.scan #bText,body.scan #bMemory{display:none}
body.scan #scanTools{display:flex;flex-direction:column;gap:3px;position:absolute;left:8px;top:8px;z-index:6;width:150px;padding:6px;background:var(--panel);border:1px solid var(--line);border-radius:7px;box-shadow:0 3px 12px #0002;font-size:12px}
#scanTools button{text-align:left;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--text);padding:5px 7px;cursor:pointer;font:inherit}
#scanTools button b{display:inline-block;width:14px;color:var(--muted);font-weight:600}
#scanTools button:hover:not(:disabled){background:var(--bg)} #scanTools button.on,#scanTools button.on:hover{background:var(--accent)!important;color:#fff} #scanTools button.on b{color:#fff}
#scanTools button:disabled{opacity:.4;cursor:default}
#scanMsg{min-height:14px;color:var(--muted);font-size:11px;padding:2px 4px}
body.scan #scanSide{display:block;position:absolute;right:8px;top:8px;bottom:8px;z-index:6;width:324px;overflow:auto;padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:7px;box-shadow:0 3px 12px #0002;font-size:12px}
#scanSide .ttl{font-weight:600;margin:10px 0 4px} #scanSide .ttl:first-child{margin-top:0}
#scanSide .note{color:var(--muted);font-size:11px;line-height:1.45;margin:3px 0}
#scanSide .cut{display:flex;align-items:center;gap:6px;margin:3px 0} #scanSide .cut label{display:flex;align-items:center;gap:4px;width:38px} #scanSide .cut input[type=range]{flex:1;width:auto;min-width:0} #scanSide .cut input[type=number]{width:66px}
#scanSide .view{gap:12px} #scanSide .view label{display:flex;align-items:center;gap:4px} #scanSide .lays{display:block} #scanSide .lays label.lay{display:grid;grid-template-columns:18px 14px 1fr auto;align-items:center;gap:6px;padding:2px 0} #scanSide .lays i{width:12px;height:12px;border-radius:2px;display:inline-block} #scanSide .lays b{font-weight:500;opacity:.7} #scanSide .lsep{height:0;border-top:2px solid rgba(120,130,150,.45);margin:12px 0 4px} #scanSide .lgrp .ttl{font-size:13px;letter-spacing:.02em}
#scanSide .how{font-size:11px;line-height:1.45;margin:2px 0 6px} #scanSide .how b{display:inline-block;width:12px;font-family:var(--mono)} #scanSide .ttl2{color:var(--muted);margin-top:4px}
#scanSide .kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px} #scanSide .kv span{color:var(--muted)} #scanSide .kv b{font:500 12px var(--mono);text-align:right}
#scanSide canvas{display:block;width:300px;background:var(--bg);border:1px solid var(--line);border-radius:4px;margin:4px 0;cursor:crosshair}
#scanSide table.lv{width:100%;border-collapse:collapse;font:11px var(--mono)} #scanSide table.lv td,#scanSide table.lv th{text-align:right;padding:1px 4px} #scanSide table.lv th{color:var(--muted);font-weight:400} #scanSide table.lv tr[data-k]{cursor:pointer} #scanSide table.lv tr[data-k]:hover{background:var(--bg)}
#scanSide .row{display:flex;gap:5px;align-items:center;margin:4px 0} #scanSide .row button{border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--text);padding:2px 9px;cursor:pointer} #scanSide .row button.on{background:var(--accent);border-color:var(--accent);color:#fff}
#scanSide input[type=number]{width:74px;font:12px var(--mono);padding:2px 4px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--text)} #scanSide input[type=range]{width:300px}""")
# the bench does not pick or drag while the scan room is open
rep("function gzDown(e) {", "function gzDown(e) { if (DESK === 'scan') return;")
rep("canvas.addEventListener('pointerup', e => {\n  if (!down ||", "canvas.addEventListener('pointerup', e => {\n  if (DESK === 'scan') { down = null; return; }\n  if (!down ||")
p.write_text(h, encoding='utf-8'); print(name + '.html', len(h))
pathlib.Path(name + '.check.mjs').write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
