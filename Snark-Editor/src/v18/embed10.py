"""python3 embed10.py Snark_05 Snark_10 — embed08 (converters, File and View menus, colours) plus the LightWave reader (lwo_snark.mjs)."""
import re, sys, subprocess, pathlib
base, name = sys.argv[1], sys.argv[2]
subprocess.run([sys.executable, 'embed08.py', base, name], check=True)
p = pathlib.Path(name + '.html'); h = p.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global h
    assert h.count(a) == n, (h.count(a), a[:80]); h = h.replace(a, b)
src = pathlib.Path('lwo_snark.mjs').read_text(encoding='utf-8').replace('export function lwoToSnark', 'function lwoToSnark')
assert 'import ' not in re.sub(r'/\*[\s\S]*?\*/|//.*', '', src) and 'export ' not in src
rep('accept=".step,.stp,.p21,.obj,.stl"', 'accept=".step,.stp,.p21,.obj,.stl,.lwo"')
rep("importAny:'STEP / OBJ / STL…'", "importAny:'STEP / OBJ / STL / LWO…'", 2)
rep("if (/\\.(step|stp|p21|stl|obj)$/i.test(f.name)) await importFile(f);", "if (/\\.(step|stp|p21|stl|obj|lwo)$/i.test(f.name)) await importFile(f);")
rep("  if (ext === 'stl') text = stlToSnark(await f.arrayBuffer(), f.name);\n",
    "  if (ext === 'stl') text = stlToSnark(await f.arrayBuffer(), f.name);\n"
    "  else if (ext === 'lwo') {      // LightWave: its unit is by custom the metre, but many draw millimetres in it — asked once per file\n"
    "    const ans = prompt(t('lwoUnit'), '1000'); if (ans === null) return; const sc = Number(ans.replace(',', '.')); if (!(sc > 0)) throw new Error(t('lwoUnitBad'));\n"
    "    const r = lwoToSnark(await f.arrayBuffer(), f.name, sc); text = r.snark;\n"
    "    note = `LightWave ${r.kind} → Snark: ${r.points} / ${r.triangles} + ${r.quads}` + (r.more ? ` + ${r.more}` : '') + ` → ${r.surfaces.length}\\n\\n` + r.surfaces.join(', ');\n"
    "  }\n")
rep("async function importFile(f) {", "/* ═══════════════════ LightWave import (lwo_snark 0.1, embedded) ═══════════════════ */\n" + src + "\nasync function importFile(f) {")
rep("impNote:'შემოტანილია: '", "impNote:'შემოტანილია: ', lwoUnit:'LightWave-ის ერთი ერთეული რამდენი მილიმეტრია? (მეტრი = 1000, მილიმეტრი = 1)', lwoUnitBad:'ერთეული დადებითი რიცხვი უნდა იყოს'")
rep("impNote:'imported: '", "impNote:'imported: ', lwoUnit:'How many millimetres is one LightWave unit? (metre = 1000, millimetre = 1)', lwoUnitBad:'the unit must be a positive number'")
# a patch must lie in one body: the editor keeps each connected piece as a body of its own, and a patch name shared by
# two pieces (three horns on one LightWave surface, several shells in one STL) would be written once only
rep("  addToScene(text); if (note) alert(note);", "  addToScene(onePatchOneBody(text)); if (note) alert(note);")
rep("/* the bodies of another file join the scene:", """function onePatchOneBody(text) {
  const d = parseSnark(text), where = new Map(); let changed = false;        // patch name → the pieces (lists of faces) it is found in
  components(d).forEach((faces, ci) => { for (const fi of faces) { const nm = d.faces[fi].patch; let m = where.get(nm); if (!m) where.set(nm, m = new Map()); let L = m.get(ci); if (!L) m.set(ci, L = []); L.push(fi); } });
  for (const [nm, m] of where) { if (m.size < 2) continue; changed = true; const pt = d.patches.get(nm), parts = [...m.values()].sort((x, y) => y.length - x.length); pt.faces = parts[0];
    parts.slice(1).forEach((L, k) => { let nn = nm + '_' + (k + 2); while (d.patches.has(nn)) nn += '_'; d.patches.set(nn, { name: nn, card: pt.card, faces: L, note: '' }); for (const fi of L) d.faces[fi].patch = nn; }); }
  return changed ? writeSnark(d) : text;
}
/* the bodies of another file join the scene:""")
rep("await importFile(f); else loadText(await f.text()); }", "await importFile(f); else loadText(onePatchOneBody(await f.text())); }")
# many stored bodies: one line for each kind, not a line for each body
rep("""  for (const b of S.foreign.bodies || []) {
    const c = document.createElement('div'); c.className = 'chip foreign';
    const cls = b.patches.some(pt => pt.card) ? 'nurbs' : 'mesh'; c.style.borderLeftColor = COLORS[cls];
    c.innerHTML = `<span>${cls === 'nurbs' ? t('clsNurbs') : t('clsMesh')}</span><i>${b.patches.length} ${t('patchesN')}</i>`; c.title = t('notEditable'); box.appendChild(c);
  }""", """  const fb = S.foreign.bodies || [], clsOf = b => b.patches.some(pt => pt.card) ? 'nurbs' : 'mesh';
  const chipF = (cls, label, np) => { const c = document.createElement('div'); c.className = 'chip foreign'; c.style.borderLeftColor = COLORS[cls]; c.innerHTML = `<span>${label}</span><i>${np} ${t('patchesN')}</i>`; c.title = t('notEditable'); box.appendChild(c); };
  if (fb.length <= 6) for (const b of fb) chipF(clsOf(b), clsOf(b) === 'nurbs' ? t('clsNurbs') : t('clsMesh'), b.patches.length);
  else for (const cls of ['nurbs', 'mesh']) { const L = fb.filter(b => clsOf(b) === cls); if (L.length) chipF(cls, (cls === 'nurbs' ? t('clsNurbs') : t('clsMesh')) + ' ×' + L.length, L.reduce((n, b) => n + b.patches.length, 0)); }""")
p.write_text(h, encoding='utf-8'); print(name + '.html', len(h))
pathlib.Path(name + '.check.mjs').write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
