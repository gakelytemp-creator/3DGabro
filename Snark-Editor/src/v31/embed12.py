"""python3 embed12.py Snark_05 Snark_12 — embed11 plus the manipulator of EDITOR_36 (gizmo.js): move / size / turn handles
   on the selected body, Object ↔ Tool, the board of Boolean operations, red crossings, and stored bodies that can be
   selected, moved and deleted."""
import re, sys, subprocess, pathlib
base, name = sys.argv[1], sys.argv[2]
subprocess.run([sys.executable, 'embed11.py', base, name], check=True)
p = pathlib.Path(name + '.html'); h = p.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global h
    assert h.count(a) == n, (h.count(a), a[:90]); h = h.replace(a, b)
rep("/* ── keyboard ── */", pathlib.Path('gizmo.js').read_text(encoding='utf-8') + "\n/* ── keyboard ── */")
rep("const bodyMaterial = (selected, B) => new THREE.MeshStandardMaterial(", "const bodyMaterial0 = (selected, B) => new THREE.MeshStandardMaterial(")
m = re.search(r"const isSelected = B => (.*);\n", h); assert m
h = h.replace(m.group(0), "const isSelected = B => (" + m.group(1) + ") || (SELF >= 0 && foreignIndexOf(B.body) === SELF);\n")
rep("function renderFrame() {\n  controls.update();", "function renderFrame() {\n  controls.update(); gzUpdate();")
rep("function select(id, fsel = null) { if (fsel !== null) FSEL = fsel; else if (id !== SEL) FSEL = 0; SEL = id;", "function select(id, fsel = null) { if (fsel !== null) FSEL = fsel; else if (id !== SEL) FSEL = 0; SEL = id; SELF = -1;")
rep("    select(oi >= 0 ? S.objects[oi].id : null, oi >= 0 && rg && rg.role.kind === 'feature' ? featureIndexOf(oi, rg.role) : null);",
    "    if (oi < 0 && b && b.kind === 'mesh' && foreignIndexOf(b) >= 0) selectForeign(foreignIndexOf(b));\n    else select(oi >= 0 ? S.objects[oi].id : null, oi >= 0 && rg && rg.role.kind === 'feature' ? featureIndexOf(oi, rg.role) : null);")
rep("  $('tDup').disabled = $('tDel').disabled = !o;", "  $('tDup').disabled = !o; $('tDel').disabled = !o && SELF < 0;")
rep("$('tDel').onclick = () => { if (!selObj()) return;", "$('tDel').onclick = () => { if (!selObj() && SELF >= 0 && S.foreign.bodies[SELF]) { const gone = new Set(S.foreign.bodies[SELF].patches.map(pt => pt.name)); S.foreign.bodies.splice(SELF, 1); S.foreign.seams = (S.foreign.seams || []).filter(s => { const tk = (s.raw || '').split(/\\s+/); return !gone.has(tk[1]) && !gone.has(tk[2]); }); SELF = -1; commit(); rebuild(); return; }\n  if (!selObj()) return;")
rep("    c.style.borderLeftColor = COLORS[o.kind];\n", "    c.style.borderLeftColor = COLORS[o.kind]; gzChip(c, o);\n")
rep("  if (fb.length <= 6) for (const b of fb) chipF(clsOf(b), clsOf(b) === 'nurbs' ? t('clsNurbs') : t('clsMesh'), b.patches.length);",
    "  if (fb.length <= 6) fb.forEach((b, i) => { const c = chipF(clsOf(b), clsOf(b) === 'nurbs' ? t('clsNurbs') : t('clsMesh'), b.patches.length); c.classList.remove('foreign'); if (i === SELF) c.classList.add('sel'); gzChip(c, b, () => i === SELF ? select(null) : selectForeign(i)); });")
rep("c.title = t('notEditable'); box.appendChild(c); };", "c.title = t('notEditable'); box.appendChild(c); return c; };")
rep('  <div id="colorBox" class="hide"></div>', '  <div id="colorBox" class="hide"></div>\n  <div id="boolBox" class="hide"></div>')
rep('.chip{border-left-width:5px}', '''.chip{border-left-width:5px}
.chip.tool{background:#ee9b3e;color:#24211c;border-color:#b86e1c}
.chip button.role{margin-left:auto;width:15px;height:12px;padding:0;border:1.5px solid var(--muted);border-radius:2px;background:transparent;cursor:pointer;flex:none}
.chip.tool button.role{background:#df2929;border-color:#a71c1c}
#boolBox{position:absolute;left:50%;top:44px;transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;gap:5px;padding:9px 11px;background:var(--panel);border:1px solid var(--line);border-radius:7px;box-shadow:0 3px 12px #0003;font-size:12px;min-width:300px}
#boolBox .ttl{display:flex;justify-content:space-between;gap:16px;font-weight:600}
#boolBox button{border:1px solid var(--line);border-radius:5px;background:var(--bg);cursor:pointer;padding:2px 7px}
#boolBox button.op{display:flex;align-items:baseline;gap:8px;text-align:left;padding:6px 9px}
#boolBox button.op b{font:700 15px var(--mono);width:16px}
#boolBox button.op i{margin-left:auto;color:var(--muted);font-style:normal;font-size:11px}
#boolBox button.op.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
#boolBox .note{color:var(--muted);font-size:11px}''')
rep('  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"\n', '  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/",\n  "three-mesh-bvh":"https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.18/build/index.module.js",\n  "three-bvh-csg":"https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.18/build/index.module.js"\n')
p.write_text(h, encoding='utf-8'); print(name + '.html', len(h))
pathlib.Path(name + '.check.mjs').write_text(re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1), encoding='utf-8')
