"""python3 embed08.py Snark_05 Snark_08 — embed07 (both converters) plus the tidy-up of the File and View menus:
   File: New / Open (.snark) / Save (.snark) / Import (STEP, OBJ, STL: added to the scene) / Export (STEP, OBJ, STL);
   View: bodies coloured by how they are built (Snark box / cylinder / sphere, CAD surfaces, plain mesh) with a palette to edit."""
import re, sys, subprocess, pathlib
base, name = sys.argv[1], sys.argv[2]
subprocess.run([sys.executable, 'embed07.py', base, name], check=True)
p = pathlib.Path(name + '.html'); h = p.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global h
    assert h.count(a) == n, (h.count(a), a[:80]); h = h.replace(a, b)

# ── File menu ──
rep('''      <button id="mNew" data-t="new"></button>
      <button id="mDemo" data-t="demo"></button>
      <button id="mOpen" data-t="open"></button>
      <button id="mSave" data-t="save"></button>
      <hr>
      <button id="mObj" data-t="exportObj"></button>
      <button id="mStl" data-t="exportStl"></button>
      <button id="mStep" data-t="exportStep"></button>
''', '''      <button id="mNew" data-t="new"></button>
      <button id="mOpen" data-t="open"></button>
      <button id="mSave" data-t="save"></button>
      <hr>
      <div class="cap" data-t="import"></div>
      <button id="mImport" data-t="importAny"></button>
      <hr>
      <div class="cap" data-t="export"></div>
      <button id="mStep" data-t="exportStep"></button>
      <button id="mObj" data-t="exportObj"></button>
      <button id="mStl" data-t="exportStl"></button>
''')
rep('<input id="file" type="file" accept=".snark,.obj,.txt,.step,.stp,.p21" class="hide">',
    '<input id="file" type="file" accept=".snark,.txt" class="hide"><input id="fileImp" type="file" accept=".step,.stp,.p21,.obj,.stl" class="hide">')
# ── View menu ──
rep('''      <label><input type="checkbox" id="vPatches"><span data-t="patches"></span></label>
''', '''      <label><input type="checkbox" id="vOrigin" checked><span data-t="origin"></span></label>
      <button id="vColors" data-t="colors"></button>
      <hr>
      <label><input type="checkbox" id="vPatches"><span data-t="patches"></span></label>
''')
rep('  <div id="cutBox" class="hide">', '  <div id="colorBox" class="hide"></div>\n  <div id="cutBox" class="hide">')
rep('.hide{display:none!important}', '''.items .cap{padding:2px 10px 0;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
#colorBox{position:absolute;left:8px;bottom:8px;z-index:5;display:grid;grid-template-columns:auto auto;gap:5px 10px;align-items:center;padding:8px 10px;background:var(--panel);border:1px solid var(--line);border-radius:7px;box-shadow:0 3px 12px #0002;font-size:12px}
#colorBox .ttl{grid-column:1/3;font-weight:600;display:flex;justify-content:space-between;gap:16px}
#colorBox .grp{grid-column:1/3;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:3px}
#colorBox input[type=color]{width:38px;height:22px;padding:0;border:1px solid var(--line);border-radius:4px;background:none;cursor:pointer}
#colorBox button{border:1px solid var(--line);border-radius:5px;background:var(--bg);cursor:pointer;padding:1px 7px}
#colorBox .row2{grid-column:1/3;text-align:right}
.chip{border-left-width:5px}
.hide{display:none!important}''')
# ── words ──
rep("open:'გახსნა… (.snark, .step)'", "open:'გახსნა… (.snark)', import:'იმპორტი (ემატება სცენას)', importAny:'STEP / OBJ / STL…', export:'ექსპორტი', origin:'ფერი აგების წესით', colors:'ფერები…', colTitle:'ფერები აგების წესით', colSnark:'სნარკი', colOther:'შემოტანილი', clsNurbs:'CAD ზედაპირები (NURBS)', clsMesh:'მეში', colReset:'საწყისი', impNote:'შემოტანილია: '")
rep("open:'Open… (.snark, .step)'", "open:'Open… (.snark)', import:'Import (added to the scene)', importAny:'STEP / OBJ / STL…', export:'Export', origin:'Colour by how it is built', colors:'Colours…', colTitle:'Colours by how a body is built', colSnark:'Snark', colOther:'Imported', clsNurbs:'CAD surfaces (NURBS)', clsMesh:'mesh', colReset:'reset', impNote:'imported: '")
rep(" exportStep:'STEP ექსპორტი (ზუსტი ზედაპირები)',", " exportStep:'STEP (ზუსტი ზედაპირები)',")
rep(" exportStep:'Export STEP (exact surfaces)',", " exportStep:'STEP (exact surfaces)',")
for a, b in (("exportObj:'OBJ ექსპორტი", "exportObj:'OBJ"), ("exportStl:'STL ექსპორტი'", "exportStl:'STL (მეში)'"), ("exportStl:'Export STL'", "exportStl:'STL (mesh)'")):
    if h.count(a) == 1: h = h.replace(a, b)
rep("exportObj:'სხვა პროგრამებისთვის (.obj)'", "exportObj:'OBJ (სხვა პროგრამებისთვის)'"); rep("exportObj:'For other programs (.obj)'", "exportObj:'OBJ (for other programs)'")
h = re.sub(r" demo:'[^']*',", '', h)
# ── the demo item goes; the scene the page starts with stays ──
m = re.search(r"\$\('mDemo'\)\.onclick = .*\n", h); assert m; h = h.replace(m.group(0), '')

# ── open / import ──
m = re.search(r"\$\('file'\)\.onchange = async e => \{\n[\s\S]*?\n\};\n", h); assert m
io = r'''/* ═══════════════════ open and import ═══════════════════
   Open takes a Snark file and replaces the scene. Import takes another format (STEP, OBJ, STL), turns it into
   Snark and ADDS its bodies to the scene: a part is often brought in to be fitted against one already there. */
$('file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { if (/\.(step|stp|p21|stl|obj)$/i.test(f.name)) await importFile(f); else loadText(await f.text()); } catch (err) { alert(t('openErr') + err.message); }
};
$('mImport').onclick = () => $('fileImp').click();
$('fileImp').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { await importFile(f); } catch (err) { alert(t('openErr') + err.message); } };
async function importFile(f) {
  const ext = (/\.([^.]+)$/.exec(f.name) || [, ''])[1].toLowerCase(); let text, note = '';
  if (ext === 'stl') text = stlToSnark(await f.arrayBuffer(), f.name);
  else {
    const raw = await f.text();
    if (/^(step|stp|p21)$/.test(ext) || /^\s*ISO-10303-21/.test(raw)) {      // a STEP file: its faces become patches with cards, its mesh is made here
      const r = StepSnark.stepToSnark(raw, { title: f.name }); text = r.snark;
      note = `STEP → Snark: ${r.bodies} / ${r.faces} → ${r.patches}` + (r.skipped ? ` (−${r.skipped})` : '') + (r.log.length ? '\n\n' + r.log.join('\n') : '');
    } else text = raw;                                                        // OBJ: the Snark reader takes it as it is
  }
  addToScene(text); if (note) alert(note);
}
/* binary or text STL → a plain mesh (points that coincide are joined, so the mesh is closed where the STL was) */
function stlToSnark(buf, fileName) {
  const dv = new DataView(buf), n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0, P = [], F = [], at = new Map();
  const vid = (x, y, z) => { const k = Math.round(x * 1e5) + ',' + Math.round(y * 1e5) + ',' + Math.round(z * 1e5); let i = at.get(k); if (i === undefined) { i = P.length; at.set(k, i); P.push([x, y, z]); } return i; };
  const tri = (a, b, c) => { if (a !== b && b !== c && a !== c) F.push([a, b, c]); };
  if (n && buf.byteLength === 84 + 50 * n) for (let i = 0; i < n; i++) { const o = 84 + 50 * i + 12, v = k => vid(dv.getFloat32(o + 12 * k, true), dv.getFloat32(o + 12 * k + 4, true), dv.getFloat32(o + 12 * k + 8, true)); tri(v(0), v(1), v(2)); }
  else { const s = new TextDecoder().decode(buf), re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, q = []; let m; while ((m = re.exec(s))) { q.push(vid(+m[1], +m[2], +m[3])); if (q.length === 3) { tri(q[0], q[1], q[2]); q.length = 0; } } }
  if (!F.length) throw new Error('no triangles in the STL');
  const g = (fileName.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'stl').slice(0, 24);
  return `# ${fileName}: ${F.length} triangles from STL\ng ${g}\n` + P.map(p => 'v ' + p.map(fmt).join(' ')).join('\n') + '\n' + F.map(t3 => 'f ' + t3.map(i => i + 1).join(' ')).join('\n') + '\n';
}
/* the bodies of another file join the scene: their patches get names that are free, their points go after ours */
function addToScene(text) {
  if (!S.objects.length && !(S.foreign.bodies || []).length) { loadText(text); return; }
  const A = parseSnark(PIPE.text), B = parseSnark(text), used = new Set(A.patches.keys()), bmap = new Map(), nmap = new Map();
  let maxB = Math.max(0, ...S.objects.map(o => o.id), ...[...used].map(nm => +(/^b(\d+)_/.exec(nm) || [0, 0])[1]));
  for (const nm of B.patches.keys()) {
    const m = /^b(\d+)_(.*)$/.exec(nm); let nn;
    if (m) { if (!bmap.has(m[1])) bmap.set(m[1], ++maxB); nn = 'b' + bmap.get(m[1]) + '_' + m[2]; }
    else { nn = nm === '_' ? 'mesh' : nm; for (let k = 2; used.has(nn); k++) nn = (nm === '_' ? 'mesh' : nm) + '_' + k; }
    used.add(nn); nmap.set(nm, nn);
  }
  const off = A.pos.length / 3; for (let i = 0; i < B.pos.length; i++) A.pos.push(B.pos[i]);
  for (const [nm, pt] of B.patches) A.patches.set(nmap.get(nm), { name: nmap.get(nm), card: pt.card, faces: [], note: pt.note });
  for (const f of B.faces) { const nn = nmap.get(f.patch); A.faces.push({ v: f.v.map(k => k + off), patch: nn }); A.patches.get(nn).faces.push(A.faces.length - 1); }
  for (const s of B.seams) { const tk = (s.raw || '').split(/\s+/); if (tk.length > 3) { tk[1] = nmap.get(tk[1]) || tk[1]; tk[2] = nmap.get(tk[2]) || tk[2]; A.seams.push({ ...s, raw: tk.join(' ') }); } }
  loadText(writeSnark(A));
}

/* ═══════════════════ colour by how a body is built ═══════════════════
   Three ways a body can be here, and one colour for each, so that it is seen at a glance what can be done with it:
   a Snark body (recipe and cards: every number can be edited) — a colour per primitive; a body of CAD surfaces
   (from STEP: its patches have cards or are NURBS kept as "free"); a plain mesh (OBJ, STL: triangles only). */
const COLOR_DEF = { box: '#8e6fd8', cyl: '#4f8fe0', sph: '#d86fb0', nurbs: '#e3bf2a', mesh: '#4caf62' }, COLORS = { ...COLOR_DEF };
try { Object.assign(COLORS, JSON.parse(store.get('colors', '{}'))); } catch {}
VIEW.origin = true;
const classOfBody = b => b.kind !== 'mesh' ? b.kind : b.cls || (b.cls = (Array.isArray(b.names) ? b.names : Object.values(b.names)).some(nm => PIPE.doc2.patches.get(nm)?.card) ? 'nurbs' : 'mesh');
function drawColorBox() {
  const box = $('colorBox'), row = (k, label) => `<span>${label}</span><input type="color" data-k="${k}" value="${COLORS[k]}">`;
  box.innerHTML = `<div class="ttl"><span>${t('colTitle')}</span><button id="colClose">×</button></div><div class="grp">${t('colSnark')}</div>` + row('box', KIND_NAME('box')) + row('cyl', KIND_NAME('cyl')) + row('sph', KIND_NAME('sph')) +
    `<div class="grp">${t('colOther')}</div>` + row('nurbs', t('clsNurbs')) + row('mesh', t('clsMesh')) + `<div class="row2"><button id="colReset">${t('colReset')}</button></div>`;
  box.querySelectorAll('input[type=color]').forEach(i => i.oninput = () => { COLORS[i.dataset.k] = i.value; store.set('colors', JSON.stringify(COLORS)); renderChips(); evaluateAndDraw(); });
  $('colClose').onclick = () => box.classList.add('hide');
  $('colReset').onclick = () => { Object.assign(COLORS, COLOR_DEF); store.set('colors', JSON.stringify(COLORS)); drawColorBox(); renderChips(); evaluateAndDraw(); };
}
$('vOrigin').onchange = e => { VIEW.origin = e.target.checked; evaluateAndDraw(); };
$('vColors').onclick = () => { drawColorBox(); $('colorBox').classList.toggle('hide'); $('viewMenu').open = false; };
'''
h = h.replace(m.group(0), io)
# the body's colour
rep("const bodyMaterial = selected => new THREE.MeshStandardMaterial({ color: selected ? (VIEW.patches ? 0xffe680 : YELLOW) : (VIEW.patches ? 0xffffff : BASE),",
    "const bodyMaterial = (selected, B) => new THREE.MeshStandardMaterial({ color: selected ? (VIEW.patches ? 0xffe680 : YELLOW) : VIEW.patches ? 0xffffff : VIEW.origin && B ? new THREE.Color(COLORS[classOfBody(B.body)]) : BASE,")
rep("bodyMaterial(isSelected(B))", "bodyMaterial(isSelected(B), B)", 2)
# the list of bodies shows the same colours
rep("    c.onclick = () => select(o.id === SEL ? null : o.id);", "    c.style.borderLeftColor = COLORS[o.kind];\n    c.onclick = () => select(o.id === SEL ? null : o.id);")
rep("    c.innerHTML = `<span>${t('stored')}</span><i>${b.patches.length} ${t('patchesN')}</i>`;",
    "    const cls = b.patches.some(pt => pt.card) ? 'nurbs' : 'mesh'; c.style.borderLeftColor = COLORS[cls];\n    c.innerHTML = `<span>${cls === 'nurbs' ? t('clsNurbs') : t('clsMesh')}</span><i>${b.patches.length} ${t('patchesN')}</i>`;")
# a stored mesh is shaded smoothly inside each patch (one patch is one surface); a fold sharper than 40° stays a fold
rep("""    for (let i = 1; i + 1 < P.length; i++) {
      const nn = unit(cross(sub(P[i], P[0]), sub(P[i + 1], P[0]))), base = pc.pos.length / 3;
      for (const q of [P[0], P[i], P[i + 1]]) { pc.pos.push(...q); pc.nrm.push(...nn); }
      pc.idx.push(base, base + 1, base + 2);
    }
  }
  return [...byPatch.values()];""", """    for (let i = 1; i + 1 < P.length; i++) {
      const cr = cross(sub(P[i], P[0]), sub(P[i + 1], P[0])), nn = unit(cr), base = pc.pos.length / 3, ks = [f.v[0], f.v[i], f.v[i + 1]];
      for (const q of [P[0], P[i], P[i + 1]]) { pc.pos.push(...q); pc.nrm.push(...nn); }
      pc.idx.push(base, base + 1, base + 2);
      if (!pc.sum) { pc.sum = new Map(); pc.corner = []; }
      for (const k of ks) { const a = pc.sum.get(k); if (a) { a[0] += cr[0]; a[1] += cr[1]; a[2] += cr[2]; } else pc.sum.set(k, [cr[0], cr[1], cr[2]]); pc.corner.push(k); }
    }
  }
  /* smooth shading inside a patch: at each point the normals of the triangles of this patch around it are averaged
     (weighted by area); where that average leans more than 40 degrees from a triangle, the triangle keeps its own */
  for (const pc of byPatch.values()) {
    if (!pc.sum) continue;
    for (let c = 0; c < pc.corner.length; c++) { const a = pc.sum.get(pc.corner[c]), l = Math.hypot(a[0], a[1], a[2]); if (!(l > 0)) continue; const d = (a[0] * pc.nrm[3 * c] + a[1] * pc.nrm[3 * c + 1] + a[2] * pc.nrm[3 * c + 2]) / l; if (d > 0.766) { pc.nrm[3 * c] = a[0] / l; pc.nrm[3 * c + 1] = a[1] / l; pc.nrm[3 * c + 2] = a[2] / l; } }
    delete pc.sum; delete pc.corner;
  }
  return [...byPatch.values()];""")
p.write_text(h, encoding='utf-8'); print(name + '.html', len(h))
pathlib.Path(name + '.check.mjs').write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
