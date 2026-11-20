"""python3 embed13.py Snark_05 Snark_14 — embed12 plus: the Boolean library (Manifold, its WebAssembly included) built into the page instead of loaded from the net, and a running line at the top
   of the window while a file is opened, imported, exported or a Boolean operation is done."""
import re, sys, subprocess, pathlib, base64
base, name = sys.argv[1], sys.argv[2]
subprocess.run([sys.executable, 'embed12.py', base, name], check=True)
p = pathlib.Path(name + '.html'); h = p.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global h
    assert h.count(a) == n, (h.count(a), a[:90]); h = h.replace(a, b)
h, k = re.subn(r',\n  "three-mesh-bvh":"[^"]+",\n  "three-bvh-csg":"[^"]+"', '', h); assert k == 1
mf = pathlib.Path('node_modules/manifold-3d/manifold.js').read_text(encoding='utf-8'); assert '</script' not in mf and mf.rstrip().endswith('export default Module;')
mf = mf.rstrip()[:-len('export default Module;')] + 'window.__MF = Module;'
wasm = base64.b64encode(pathlib.Path('node_modules/manifold-3d/manifold.wasm').read_bytes()).decode()
rep('</script>\n</body>', '</script>\n<script type="module">/* Manifold 3.5.5 (Apache-2.0, github.com/elalish/manifold): robust Boolean operations on solids; sets window.__MF */\n' + mf + '\n</script>\n<script>/* manifold.wasm, base64 */window.__MFWASM="' + wasm + '";</script>\n</body>')
rep('.chip{border-left-width:5px}', '''.chip{border-left-width:5px}
#busy{position:fixed;left:0;right:0;top:0;height:4px;z-index:50;overflow:hidden;background:#2f6fde33;display:none;pointer-events:none}
#busy.on{display:block}
#busy i{position:absolute;top:0;bottom:0;left:0;width:28%;background:var(--accent);will-change:transform;animation:busyRun 1.1s linear infinite}
@keyframes busyRun{from{transform:translateX(-100%)}to{transform:translateX(460%)}}
#boolBox .note.bad{color:var(--err);font-weight:600}
#boolBox button.op.apart{margin-top:4px;border-style:dashed}
.chip .boolMark{font:700 12px var(--mono);margin-left:4px;color:var(--accent)}''')
rep('  <div id="colorBox" class="hide"></div>', '  <div id="busy"><i></i></div>\n  <div id="colorBox" class="hide"></div>')
rep("$('file').onchange = async e => {", '''/* the running line at the top: shown before long work starts (the page gets one frame to draw it; the line itself
   is moved by the compositor, so it keeps running while the script is busy) and hidden when the work is over */
let BUSY = 0;
async function busy(fn) {
  const b = $('busy'); BUSY++; b.classList.add('on'); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 40)));
  try { return await fn(); } finally { if (!--BUSY) b.classList.remove('on'); }
}
$('file').onchange = async e => {''')
rep("try { if (/\\.(step|stp|p21|stl|obj|lwo)$/i.test(f.name)) await importFile(f); else loadText(onePatchOneBody(await f.text())); } catch",
    "try { await busy(async () => { if (/\\.(step|stp|p21|stl|obj|lwo)$/i.test(f.name)) await importFile(f); else loadText(onePatchOneBody(await f.text())); }); } catch")
rep("try { await importFile(f); } catch (err) { alert(t('openErr')", "try { await busy(() => importFile(f)); } catch (err) { alert(t('openErr')")
# ── unchanged bodies are not worked out again: evaluate() keeps the pieces of the last two runs by the content of a body
rep("""function evaluate(doc, chord, rec = recognise(doc)) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const out = [];
  for (const b of rec.bodies) {
    let pieces, issues = [...b.issues];
    try {
      pieces =""", """/* A body that has not changed is not worked out again: its pieces (and the edge lines drawn from them) are kept by a
   signature of its content — for a stored body its points and patch names, for a primitive its whole description.
   Two generations are kept, so that Undo right after a change is also instant. */
const EVC = { now: new Map(), old: new Map() };
function bodySig(doc, b, chord) {
  try {
    if (b.kind !== 'box' && b.kind !== 'cyl' && b.kind !== 'sph') { let h = 0, n = 0; const names = new Set();
      for (const fi of b.faces) { const f = doc.faces[fi]; names.add(f.patch); for (const k of f.v) { h = (h * 1.0000003 + doc.pos[3 * k] * 12.9898 + doc.pos[3 * k + 1] * 78.233 + doc.pos[3 * k + 2] * 37.719) % 1e9; n++; } }
      return 'M' + b.faces.length + ':' + n + ':' + h + ':' + [...names].join(','); }
    return 'P' + chord + JSON.stringify(b, (k, v) => k === 'issues' || k === 'obj' ? undefined : v);
  } catch (e) { return null; }
}
function evaluate(doc, chord, rec = recognise(doc)) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const out = [], next = new Map();
  for (const b of rec.bodies) {
    let pieces, issues = [...b.issues];
    const sig = bodySig(doc, b, chord), hit = sig && (EVC.now.get(sig) || EVC.old.get(sig));
    if (hit) { next.set(sig, hit); issues.push(...hit.extra); out.push({ body: b, pieces: hit.pieces, issues, tris: hit.pieces.reduce((s, p) => s + p.idx.length / 3, 0), skin: hit.pieces.skin || null }); continue; }
    let ok = true; const n0 = issues.length;
    try {
      pieces =""")
rep("""    } catch (e) { issues.push({ level: 'error', msg: 'evaluation failed: ' + e.message }); pieces = evalStored(doc, b); }
    out.push({ body: b, pieces, issues,""", """    } catch (e) { ok = false; issues.push({ level: 'error', msg: 'evaluation failed: ' + e.message }); pieces = evalStored(doc, b); }
    if (ok && sig) next.set(sig, { pieces, extra: issues.slice(n0) });
    out.push({ body: b, pieces, issues,""")
rep("  return { bodies: out, ms: (typeof performance !== 'undefined' ? performance : Date).now() - t0, issues: rec.issues };", "  EVC.old = EVC.now; EVC.now = next;\n  return { bodies: out, ms: (typeof performance !== 'undefined' ? performance : Date).now() - t0, issues: rec.issues };")
rep("const L = B.skin ? (B.skin.lineCache || (B.skin.lineCache = B.skin.lines())) : bodyLines(B),", "const L = B.skin ? (B.skin.lineCache || (B.skin.lineCache = B.skin.lines())) : (B.pieces.lineCache || (B.pieces.lineCache = bodyLines(B))),")
# ── a very long text is not put into the text box whole (that alone takes a second): its beginning is shown, read-only
rep("  if (!textDirty) { $('text').value = text; setTextNote(); }\n  showIssues(); renderChips();", """  if (!textDirty) { const big = text.length > 2e6; $('text').readOnly = big;
    $('text').value = big ? text.slice(0, 2e5) + '\\n\\n# … the rest is not shown here: the text is ' + (text.length / 1048576).toFixed(1) + ' MB. File → Save writes all of it.' : text; setTextNote(); }
  showIssues(); renderChips();""")
# ── a Boolean result keeps its two operands (fb.bool = { op, chord, a, b }); in the file they are #@bool / #@part lines
rep("        default: keep(doc.unknown); I.push(", "        case 'bool': case 'part': keep(doc.unknown); break;      // the history of a Boolean result: read by docToState\n        default: keep(doc.unknown); I.push(")
rep("function buildDoc(state) {", """/* ═══ the history of a Boolean result ═══
   The mesh of a result is only its picture. What it exactly is, is said by the two bodies it was made from, kept with
   it as they were at that moment (size, place, edges, features — or, for a stored body, its own mesh and history):
     #@bool B1 cut|join|int result=<a patch of the result> mesh=preview chord=0.2      (SNARK.md §12.1)
     #@part B1 a <one line of the Snark text of the first body>      … as many lines as that text has
     #@part B1 b <one line of the Snark text of the second body>
   The text of a part is a whole Snark file of one body, so a part that is itself a result carries its own #@bool lines.
   A reader that needs the exact shape (a slicer, an exact export) works from the parts, not from the mesh. */
function buildDoc(state) {
  const doc = buildDoc0(state); let n = 0;
  for (const fb of (state.foreign || {}).bodies || []) { if (!fb.bool || !fb.patches.length) continue; const id = 'B' + ++n, B = fb.bool;
    doc.unknown.push({ raw: `#@bool ${id} ${B.op === 'common' ? 'int' : B.op} result=${fb.patches[0].name} mesh=preview chord=${fmt(B.chord)}`, note: '' });
    for (const k of ['a', 'b']) { const P = B[k], st = { objects: P.kind === 'obj' ? [P.o] : [], foreign: { bodies: P.kind === 'obj' ? [] : [P.fb] }, header: state.header, meta: {}, preamble: [] };
      for (const ln of writeSnark(buildDoc(st)).split('\\n')) if (ln.trim()) doc.unknown.push({ raw: `#@part ${id} ${k} ${ln}`, note: '' }); } }
  if (n && !doc.header.uses.includes('L4')) doc.header.uses.push('L4');
  return doc;
}
function buildDoc0(state) {""")
rep("function docToState(doc) {", """function docToState(doc) {
  const st = docToState0(doc), bools = new Map(), rest = [];
  for (const r of st.foreign.unknown || []) { const m = /^#@bool\\s+(\\S+)\\s+(\\S+)\\s+(.*)$/.exec(r.raw), p = /^#@part\\s+(\\S+)\\s+([ab])\\s(.*)$/.exec(r.raw);
    if (m) bools.set(m[1], { op: m[2], kv: m[3], a: [], b: [] }); else if (p) { if (bools.has(p[1])) bools.get(p[1])[p[2]].push(p[3]); } else rest.push(r); }
  st.foreign.unknown = rest;
  for (const B of bools.values()) { const res = /result=(\\S+)/.exec(B.kv), ch = /chord=(\\S+)/.exec(B.kv), fb = res && st.foreign.bodies.find(b => b.patches.some(pt => pt.name === res[1])); if (!fb) continue;      // the result was recognised as a primitive: it needs no history
    const part = lines => { try { const s2 = docToState(parseSnark(lines.join('\\n'))); return s2.objects[0] ? { kind: 'obj', o: s2.objects[0] } : s2.foreign.bodies[0] ? { kind: 'body', fb: s2.foreign.bodies[0] } : null; } catch (e) { return null; } };
    const a = part(B.a), b = part(B.b); if (a && b) fb.bool = { op: B.op === 'int' ? 'common' : B.op, chord: ch ? +ch[1] : 0.2, a, b }; }
  return st;
}
function docToState0(doc) {""")
# ── the role of a primitive (object or tool) is written into its recipe step
rep("          if (kv.name !== undefined) r.name = kv.name;\n          doc.recipe.push(r);", "          if (kv.name !== undefined) r.name = kv.name;\n          if (kv.role !== undefined) r.role = kv.role;\n          doc.recipe.push(r);")
rep("""    if (r.name !== undefined) s += ' name="' + String(r.name).replace(/"/g, "'") + '"';""", """    if (r.name !== undefined) s += ' name="' + String(r.name).replace(/"/g, "'") + '"';\n    if (r.role !== undefined) s += ' role=' + r.role;""")
rep("doc.recipe.push({ id: String(oi + 1), op: 'solid', prim: o.kind, dims, p: c.slice(), q, name: o.name || undefined, note: '' });", "doc.recipe.push({ id: String(oi + 1), op: 'solid', prim: o.kind, dims, p: c.slice(), q, name: o.name || undefined, role: o.role === 'tool' ? 'tool' : undefined, note: '' });")
rep("      edge, names: { ...b.names }, note: isAuto ? '' : firstNote, issues: b.issues, features });", "      edge, names: { ...b.names }, note: isAuto ? '' : firstNote, issues: b.issues, features, ...(b.recipe && b.recipe.role === 'tool' ? { role: 'tool' } : {}) });")
# ── the slicer (slicer.js): a button beside Section, a small panel, the outline drawn in the scene
rep("\n/* ── keyboard ── */", "\n" + pathlib.Path('slicer.js').read_text(encoding='utf-8') + "\n/* ── keyboard ── */")
rep('    <button id="bCut" data-tt="cutT">✂ <span data-t="cut"></span></button>', '    <button id="bCut" data-tt="cutT">✂ <span data-t="cut"></span></button>\n    <button id="bSlice" title="The outline of the bodies in a plane Z = const, with the steps of the machine">≡ Slice</button>')
rep('  <div id="boolBox" class="hide"></div>', """  <div id="boolBox" class="hide"></div>
  <div id="sliceBox" class="hide">
    <div class="ttl"><span>Slice · plane Z = const</span><button id="sliceOff">×</button></div>
    <div class="row"><label>Z <input id="sliceZ" type="number" step="0.1"> mm</label></div>
    <div class="row"><label title="the step of the machine along X">step X <input id="sliceSX" type="number" step="0.001" min="0.0001" value="0.01"> mm</label><label title="the step of the machine along Y">step Y <input id="sliceSY" type="number" step="0.001" min="0.0001" value="0.01"> mm</label></div>
    <div class="row"><button id="sliceGo" class="go">Slice</button><button id="sliceDxf">DXF</button><button id="sliceSvgB">SVG</button></div>
    <div id="slicePic"></div><div class="note" id="sliceInfo"></div>
  </div>""")
rep("#boolBox .note.bad{color:var(--err);font-weight:600}", """#boolBox .note.bad{color:var(--err);font-weight:600}
#sliceBox{position:absolute;right:8px;bottom:8px;z-index:6;display:flex;flex-direction:column;gap:6px;padding:9px 11px;background:var(--panel);border:1px solid var(--line);border-radius:7px;box-shadow:0 3px 12px #0003;font-size:12px;max-width:300px}
#sliceBox .ttl{display:flex;justify-content:space-between;gap:16px;font-weight:600}
#sliceBox .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#sliceBox input{width:70px;font:12px var(--mono);padding:2px 4px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--text)}
#sliceBox button{border:1px solid var(--line);border-radius:5px;background:var(--bg);color:var(--text);cursor:pointer;padding:3px 9px}
#sliceBox button.go{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
#sliceBox .note{color:var(--muted);font-size:11px} #sliceBox .note.bad{color:var(--err);font-weight:600}
#slicePic svg{display:block;max-height:220px;width:100%;background:var(--bg);border:1px solid var(--line);border-radius:4px}""")
# ── a map of the whole file at the top of the script
rep("""<script type="module">
import * as THREE from 'three';""", """<script type="module">
/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   """ + name + """ — the Snark editor in one file. A map of this script, in the order of the text:

     Snark core (no DOM, no three.js)
       1  SnarkDoc: the file in memory            5  objects → SnarkDoc (builder)
       2  text → SnarkDoc (reader)                   · the history of a Boolean result (#@bool / #@part, SNARK.md §12.1)
       3  SnarkDoc → text (writer)                6  SnarkDoc → bodies (recognition, the Boojum checks)
       4  profiles: drawing numbers → points      7  bodies → surfaces (evaluation; 7a features on planes, 7b skins)
                                                  8  a final-mesh file for other programs
     The bench (the page)
       · state S, history (Undo), the three.js scene, the pipeline objects → doc → text → doc → bodies → screen
       · animation, section (the clip plane), the list of bodies, the inspector, features
       · the manipulator: move / size / turn, Object ↔ Tool, Boolean operations (Manifold), red crossings
       · the slicer: snarkSlice({ z, stepX, stepY }) — outlines from the history, on the steps of the machine
       · open and import: STEP (step_snark), LightWave (lwo_snark), STL, OBJ; colour by how a body is built
       · export: STEP (snark_step), OBJ, STL; the text and memory panels; keyboard
     After this script: Manifold 3.5.5 (its JavaScript, then its WebAssembly as base64) — the solid Boolean engine.

   Conventions: millimetres, Z up, quaternions [x, y, z, w]. Every change of the bench goes commit() → rebuild():
   the scene is written to Snark text and read back, and what is drawn is what was read (status: write ⇄ read ✓).
   The sources this file is built from are in Snark-Editor/src (see the README there).
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';""")
rep("btn.textContent = '… STEP'; btn.disabled = true;", "btn.textContent = '… STEP'; btn.disabled = true; $('busy').classList.add('on');")
rep("btn.textContent = label; btn.disabled = false;\n  }, 50);", "btn.textContent = label; btn.disabled = false; $('busy').classList.remove('on');\n  }, 50);")
p.write_text(h, encoding='utf-8'); print(name + '.html', len(h))
pathlib.Path(name + '.check.mjs').write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
