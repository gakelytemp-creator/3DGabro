/* ═══════════════════ the slicer ═══════════════════
   snarkSlice({ z, stepX, stepY }) → the outline of every object of the scene in the plane Z = z, as closed loops.

   Exactness. The section of a Boolean result is the same Boolean operation done on the sections of its two parts:
   section(A − B) = section(A) − section(B). So a result is never sliced through its own mesh (that is only a picture):
   the slicer goes down its history to the bodies it was made from, makes each of them anew as finely as the asked
   resolution needs, slices each, and combines the flat outlines. Nothing of the 3D Boolean is in the answer.

   Resolution. stepX and stepY are the steps of the two axes of the machine (they may differ: other gearing, other
   microstepping). The bodies are made with a chord of half the smaller step; every point of the outline is then put
   on the grid of the steps, and points that fall together or on one straight line are dropped — the outline has just
   the detail the machine can follow. */
const SLICE = { group: new THREE.Group(), last: null, solids: new Map() };
scene.add(SLICE.group);
async function snarkSlice({ z, stepX, stepY }) {
  const MF = await gzManifold(); if (!MF) throw new Error('the geometry library is not loaded'); const { Manifold, Mesh } = MF;
  if (!(stepX > 0) || !(stepY > 0)) throw new Error('the steps must be greater than zero');
  const chord = Math.min(VIEW.chord, Math.max(0.002, Math.min(stepX, stepY) / 2)), blank = Object.fromEntries(Object.keys(S.foreign).map(k => [k, Array.isArray(S.foreign[k]) ? [] : S.foreign[k]]));
  const log = { leaves: 0, made: 0, chord };
  const solidOfDoc = doc => { const tri = []; for (const f of doc.faces) for (let i = 1; i + 1 < f.v.length; i++) tri.push(f.v[0], f.v[i], f.v[i + 1]);
    const mesh = new Mesh({ numProp: 3, vertProperties: new Float32Array(doc.pos), triVerts: new Uint32Array(tri) }); mesh.merge(); const m = new Manifold(mesh); if (String(m.status()) !== 'NoError') throw new Error('a body is not a valid solid (' + m.status() + ')'); return m; };
  const leaf = (o, isObj) => {              // one body as it is by itself, made at the chord of this slice (kept: the next height needs it again)
    log.leaves++; const sig = chord + '|' + (isObj ? gzPartSig(o) : gzBodySig(o) + o.patches[0].name); let m = SLICE.solids.get(sig);
    if (!m) { log.made++; if (SLICE.solids.size > 24) { for (const x of SLICE.solids.values()) x.delete(); SLICE.solids.clear(); }
      m = solidOfDoc(buildFinalDoc({ ...S, objects: isObj ? [o] : [], foreign: { ...blank, bodies: isObj ? [] : [{ ...o, bool: undefined }] } }, chord)); SLICE.solids.set(sig, m); }
    return m.slice(z); };
  const section = P => {                    // a part of a history: a primitive, a plain stored body, or again a result
    if (P.kind === 'obj') return leaf(P.o, true); const B = P.fb.bool; if (!B) return leaf(P.fb, false);
    const a = section(B.a), b = section(B.b), r = B.op === 'cut' ? a.subtract(b) : B.op === 'join' ? a.add(b) : a.intersect(b); a.delete(); b.delete(); return r; };
  const loops = [];
  const grid = poly => {                    // onto the steps of the machine; what falls together or in line is dropped
    let q = []; for (const [x, y] of poly) { const p = [Math.round(x / stepX) * stepX, Math.round(y / stepY) * stepY]; const l = q[q.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 1e-9 || Math.abs(l[1] - p[1]) > 1e-9) q.push(p); }
    while (q.length > 1 && Math.abs(q[0][0] - q[q.length - 1][0]) < 1e-9 && Math.abs(q[0][1] - q[q.length - 1][1]) < 1e-9) q.pop();
    for (let changed = true; changed && q.length > 2;) { changed = false; const out = []; for (let i = 0; i < q.length; i++) { const a = q[(i + q.length - 1) % q.length], b = q[i], c = q[(i + 1) % q.length], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), dt = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]); if (Math.abs(cr) < 1e-12 && dt >= 0) changed = true; else out.push(b); } q = out; }
    return q.length > 2 ? q.map(p => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]) : null; };
  const bodies = [...S.objects.filter(o => o.role !== 'tool').map(o => ({ kind: 'obj', o })), ...(S.foreign.bodies || []).filter(b => b.role !== 'tool').map(fb => ({ kind: 'body', fb }))];
  bodies.forEach((P, bi) => { const cs = section(P); for (const poly of cs.toPolygons()) { const q = grid(poly); if (!q) continue; let A = 0, L = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; A += a[0] * b[1] - b[0] * a[1]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } loops.push({ body: bi, pts: q, hole: A < 0, area: A / 2, length: L }); } cs.delete(); });
  return { z, stepX, stepY, chord, loops, points: loops.reduce((n, l) => n + l.pts.length, 0), length: loops.reduce((n, l) => n + l.length, 0), area: loops.reduce((n, l) => n + l.area, 0), leaves: log.leaves, made: log.made };
}
window.snarkSlice = snarkSlice;
function sliceDraw(R) {                      // the outline in the scene (at its height) and, flat, in the panel
  clearGroup(SLICE.group); SLICE.last = R; if (!R) { $('sliceInfo').textContent = ''; $('slicePic').innerHTML = ''; return; }
  for (const l of R.loops) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(l.pts.flatMap(p => [p[0], p[1], R.z]), 3)); const o = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: l.hole ? 0x1c7fe0 : 0xe01c9a, depthTest: false, transparent: true })); o.renderOrder = 30; SLICE.group.add(o); }
  $('sliceInfo').textContent = R.loops.length ? `${R.loops.length} loops · ${R.points} points · length ${fmt(Math.round(R.length * 1000) / 1000)} mm · area ${fmt(Math.round(R.area * 1000) / 1000)} mm² · bodies made at chord ${fmt(R.chord)} mm` : 'nothing is cut by this plane';
  $('slicePic').innerHTML = R.loops.length ? sliceSvg(R, 260) : '';
}
function sliceSvg(R, w) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const l of R.loops) for (const p of l.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const m = Math.max(x1 - x0, y1 - y0) * 0.04 + 0.5, W = x1 - x0 + 2 * m, H = y1 - y0 + 2 * m, d = R.loops.map(l => 'M' + l.pts.map(p => fmt(p[0] - x0 + m) + ' ' + fmt(y1 - p[1] + m)).join('L') + 'Z').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(W)} ${fmt(H)}" ${w ? `width="${w}" height="${Math.round(w * H / W)}"` : `width="${fmt(W)}mm" height="${fmt(H)}mm"`}><path d="${d}" fill="${w ? '#e01c9a22' : 'none'}" fill-rule="evenodd" stroke="#e01c9a" stroke-width="${fmt(Math.max(W, H) / 400)}"/></svg>`;
}
function sliceDxf(R) {                       // closed LWPOLYLINEs, millimetres, as they lie in the plane
  const o = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  for (const l of R.loops) { o.push('0', 'LWPOLYLINE', '8', l.hole ? 'HOLES' : 'OUTLINE', '90', String(l.pts.length), '70', '1', '38', fmt(R.z)); for (const p of l.pts) o.push('10', fmt(p[0]), '20', fmt(p[1])); }
  o.push('0', 'ENDSEC', '0', 'EOF'); return o.join('\n') + '\n';
}
$('bSlice').onclick = () => { const b = $('sliceBox'); b.classList.toggle('hide'); if (b.classList.contains('hide')) sliceDraw(null); else if (!$('sliceZ').value) { const bb = new THREE.Box3().setFromObject(bodyGroup); $('sliceZ').value = bb.isEmpty() ? 0 : Math.round((bb.min.z + bb.max.z) / 2 * 100) / 100; } };
$('sliceOff').onclick = () => { $('sliceBox').classList.add('hide'); sliceDraw(null); };
$('sliceGo').onclick = async () => { const n = id => Number(String($(id).value).replace(',', '.')); $('sliceInfo').textContent = 'working…'; $('sliceInfo').classList.remove('bad');
  try { const R = await busy(() => snarkSlice({ z: n('sliceZ'), stepX: n('sliceSX'), stepY: n('sliceSY') })); sliceDraw(R); } catch (e) { console.error(e); sliceDraw(null); $('sliceInfo').textContent = 'failed: ' + e.message; $('sliceInfo').classList.add('bad'); } };
$('sliceDxf').onclick = () => { if (SLICE.last && SLICE.last.loops.length) download(`slice_z${fmt(SLICE.last.z)}.dxf`, sliceDxf(SLICE.last), 'application/dxf'); };
$('sliceSvgB').onclick = () => { if (SLICE.last && SLICE.last.loops.length) download(`slice_z${fmt(SLICE.last.z)}.svg`, sliceSvg(SLICE.last, 0), 'image/svg+xml'); };
