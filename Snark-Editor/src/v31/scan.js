/* ═══════════════════ the Scan room ═══════════════════
   A second room of the editor, for noisy files: scans of real parts. The Bench (primitives, tools, Boolean operations,
   the slicer) is left as it is; Scan has its own tools, panel and scene, and nothing of a scan becomes Snark text
   until it is recognised. Everything is computed here, in the browser, in JavaScript.

   The tools, in the order of the work (scan_principles.md):
     1 Open scan   a mesh of millions of points (OBJ) read straight from its bytes;
     2 Orient      the part's own frame, found on cells of the scan: the strongest flat direction made exact by planes;
                   then a second flat direction at right angles, or the axis of a round surface, or the long side;
     3 Signature   along each axis, how many points stand at each level — a plane across the axis is a sharp peak;
     4 Sections    three cutting planes with a switch and a slider each; the outline cut by a plane is recognised by an
                   algorithm into lines, arcs and circles;
     5 Recognise   the whole chain from sections to a body; its steps, in the order they run (each has its own comment
                   where it stands in scanRecognise):
                     a  sections along X, Y and Z, every outline recognised into lines and arcs;
                     b  planes: lines inherited from section to section, with a retreat of 3 % from their ends;
                        equal planes joined; stray lines adopted; pieces of one face joined ("one face from its pieces");
                     c  the points of the scan on the planes, the colours of the picture;
                     d  edges = plane ∩ plane, checked against the corners of the sections;
                     e  the edge scanner: every edge walked along its line, its pieces grown into one, its rounding
                        measured in one common cross profile;
                     f  twins: edges that are one edge seen twice are folded into one;
                     g  faces closed by their edges and checked on the scan (thickened face, real points in every square);
                     h  cylinders: circles inherited through the sections, then measured round their axis;
                     i  symmetries tried side by side: an extrusion along X, Y, Z; a mirror square to X, Y, Z;
                     j  if the extrusion holds: the profile with the fewest elements (Occam), each fitted with the
                        points of its whole wall; the body "profile × length"; ends found or closed by assumption.
     6 Groups, 7 To bench — not built yet.

   The picture has layers in three groups (SCAN.view): the original scan; the reconstruction, drawn beside the scan;
   and what was measured on the way. Every layer is one thing and has one tick.

   Principles (docs/scan_principles.md): symmetry is the working tool — a right symmetry gathers many points onto one
   number and averages the noise away; every number carries how many points took part and how far they scatter; several
   hypotheses are tested side by side and none shuts out another; the simplest body that explains the scan wins.

   Hooks for tests: window.__scan (the state SCAN; __scan.rec is the result of Recognise; __scan.noDraw = true skips
   the drawing of the mesh on a machine without a graphics card), window.__scanFn (the functions).

   Data: SCAN.P (Float32Array, x y z per point, in the part's frame once oriented), SCAN.F (Uint32Array, three points
   per triangle), SCAN.N (normals of the points, for the picture). */
const SCAN = { group: new THREE.Group(), mesh: null, P: null, F: null, N: null, A: null, n: 0, nf: 0, name: '', frame: null, sig: null, axis: 0, level: 0, cut: [{ on: false, level: 0 }, { on: false, level: 0 }, { on: false, level: 0 }], sec: [null, null, null], cutSel: 0, cutGroup: null, view: { mesh: true, paint: true, extr: true, extrLines: true, faces: true, planes: false, round: false, holes: true, single: false, eWalk: true, eSec: true, eGuess: true, eOld: false, lx: false, ly: false, lz: false, off: {}, side: 1 }, tool: 'open', log: [] };
scene.add(SCAN.group); SCAN.group.visible = false;
let DESK = 'bench';
const scTick = () => new Promise(r => setTimeout(r, 15));
const scSay = s => { $('scanMsg').textContent = s; };
const scNum = (x, d = 3) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d });

/* ── the two rooms ── */
function setDesk(d) {
  if (d === DESK) return; DESK = d; const scan = d === 'scan'; document.body.classList.toggle('scan', scan);
  $('deskBench').classList.toggle('on', !scan); $('deskScan').classList.toggle('on', scan);
  if (scan) { select(null); SELF = -1; for (const id of ['boolBox', 'sliceBox', 'cutBox', 'colorBox', 'animBox']) $(id).classList.add('hide'); sliceDraw(null); }
  bodyGroup.visible = !scan; lineGroup.visible = !scan; roomGroup.visible = !scan; SLICE.group.visible = !scan; SCAN.group.visible = scan;
  if (scan) { scPanel(); if (SCAN.mesh) fitView(new THREE.Box3().setFromObject(SCAN.mesh), 1.0); } else { evaluateAndDraw(); fitView(); }
  resize();
}
$('deskBench').onclick = () => setDesk('bench'); $('deskScan').onclick = () => setDesk('scan');

/* ── 1. open: an OBJ file read from its bytes, a piece of the file at a time (a scan can be half a gigabyte: neither
      its text nor the whole file is ever held at once). Points are kept in single precision round the first point. ── */
function scanReader() {
  const st = { P: new Float32Array(3 << 20), F: new Uint32Array(3 << 21), np: 0, nf: 0, base: null, poly: [] };
  st.feed = (u, L) => {                           // u[0 … L) holds whole lines
    let i = 0, P = st.P, F = st.F; const poly = st.poly;
    const num = () => { while (i < L && (u[i] === 32 || u[i] === 9)) i++; let s = 1, v = 0, c = u[i];
      if (c === 45) { s = -1; c = u[++i]; } else if (c === 43) c = u[++i];
      while (c >= 48 && c <= 57) { v = v * 10 + (c - 48); c = u[++i]; }
      if (c === 46) { let f = 0.1; c = u[++i]; while (c >= 48 && c <= 57) { v += (c - 48) * f; f *= 0.1; c = u[++i]; } }
      if (c === 101 || c === 69) { c = u[++i]; let es = 1, e = 0; if (c === 45) { es = -1; c = u[++i]; } else if (c === 43) c = u[++i]; while (c >= 48 && c <= 57) { e = e * 10 + (c - 48); c = u[++i]; } v *= 10 ** (es * e); }
      return s * v; };
    while (i < L) { const c = u[i], c1 = u[i + 1];
      if (c === 118 && c1 === 32) { i += 2; if (3 * st.np + 3 > P.length) { const q = new Float32Array(P.length * 2); q.set(P); P = st.P = q; } const x = num(), y = num(), z = num(); if (!st.base) st.base = [x, y, z]; P[3 * st.np] = x - st.base[0]; P[3 * st.np + 1] = y - st.base[1]; P[3 * st.np + 2] = z - st.base[2]; st.np++; }
      else if (c === 102 && c1 === 32) { i += 2; poly.length = 0;
        while (i < L && u[i] !== 10 && u[i] !== 13) { while (u[i] === 32 || u[i] === 9) i++; if (u[i] === 10 || u[i] === 13 || i >= L) break; let k = num(); if (k < 0) k = st.np + k + 1; poly.push(k - 1); while (i < L && u[i] !== 32 && u[i] !== 10 && u[i] !== 13) i++; }
        for (let k = 1; k + 1 < poly.length; k++) { if (3 * st.nf + 3 > F.length) { const q = new Uint32Array(F.length * 2); q.set(F); F = st.F = q; } F[3 * st.nf] = poly[0]; F[3 * st.nf + 1] = poly[k]; F[3 * st.nf + 2] = poly[k + 1]; st.nf++; } }
      while (i < L && u[i] !== 10) i++; i++; } };
  return st;
}
async function scanReadObj(file) {
  const st = scanReader(), CH = 32 << 20; let carry = new Uint8Array(0);
  for (let off = 0; off < file.size; off += CH) {
    const part = new Uint8Array(await file.slice(off, Math.min(file.size, off + CH)).arrayBuffer()), last = off + CH >= file.size; let u = part;
    if (carry.length) { u = new Uint8Array(carry.length + part.length + 1); u.set(carry); u.set(part, carry.length); } else if (last) { u = new Uint8Array(part.length + 1); u.set(part); }
    let L = carry.length + part.length; if (last) u[L++] = 10; else { while (L > 0 && u[L - 1] !== 10) L--; }
    st.feed(u, L); carry = last ? new Uint8Array(0) : u.slice(L, carry.length + part.length);
    scSay(`reading ${file.name} … ${Math.round(100 * Math.min(1, (off + CH) / file.size))} %`); await scTick(); }
  return { P: st.P.slice(0, 3 * st.np), F: st.F.slice(0, 3 * st.nf), np: st.np, nf: st.nf, base: st.base };
}
/* normals of the points (every triangle adds its area-normal to its three points), the area of each point, and the
   calming of the normals over the neighbours: a single triangle of a scan looks several degrees off */
function scanNormals(P, F, n, nf, smooth) {
  const N = new Float32Array(3 * n);
  for (let f = 0; f < nf; f++) { const a = 3 * F[3 * f], b = 3 * F[3 * f + 1], c = 3 * F[3 * f + 2], ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    N[a] += x; N[a + 1] += y; N[a + 2] += z; N[b] += x; N[b + 1] += y; N[b + 2] += z; N[c] += x; N[c + 1] += y; N[c + 2] += z; }
  const unit = M => { for (let i = 0; i < 3 * n; i += 3) { const l = Math.hypot(M[i], M[i + 1], M[i + 2]) || 1; M[i] /= l; M[i + 1] /= l; M[i + 2] /= l; } };
  unit(N); if (!smooth) return N; const S = new Float32Array(3 * n);
  for (let it = 0; it < smooth; it++) { S.fill(0);
    for (let f = 0; f < nf; f++) { const a = 3 * F[3 * f], b = 3 * F[3 * f + 1], c = 3 * F[3 * f + 2]; for (let k = 0; k < 3; k++) { const na = N[a + k], nb = N[b + k], nc = N[c + k]; S[a + k] += nb + nc; S[b + k] += na + nc; S[c + k] += na + nb; } }
    unit(S); for (let i = 0; i < 3 * n; i++) N[i] = 0.5 * N[i] + 0.5 * S[i]; unit(N); }
  return N;
}
async function scanOpen(file) {
  const t0 = performance.now(); scSay('reading ' + file.name + ' …'); await scTick();
  if (!/\.obj$/i.test(file.name)) throw new Error('this version reads OBJ; STL and PLY come next');
  const r = await scanReadObj(file); if (!r.np || !r.nf) throw new Error('no points or no triangles in the file (a scan must be a mesh)');
  scSay('normals …'); await scTick(); const P = r.P;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < 3 * r.np; i++) { const k = i % 3, v = P[i]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const c = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2); for (let i = 0; i < 3 * r.np; i++) P[i] -= c[i % 3];             // kept round its middle: single precision is then fine to 0.00001 mm
  const N = scanNormals(P, r.F, r.np, r.nf, 1);                // for the picture only; the measuring works on cells (scanCells)
  Object.assign(SCAN, { P, F: r.F, N, n: r.np, nf: r.nf, name: file.name, centre: c.map((v, k) => v + r.base[k]), size: [0, 1, 2].map(k => hi[k] - lo[k]), frame: null, sig: null, rec: null, sec: [null, null, null], cut: [{ on: false, level: 0 }, { on: false, level: 0 }, { on: false, level: 0 }], tool: 'open', openMs: performance.now() - t0 });
  scanDraw(); scPanel(); scSay(''); fitView(new THREE.Box3().setFromObject(SCAN.mesh), 1.0);
}
function scanDraw() {
  clearGroup(SCAN.group); SCAN.cutGroup = null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(SCAN.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(SCAN.N, 3)); g.setIndex(new THREE.BufferAttribute(SCAN.F, 1));
  const rec = SCAN.rec && SCAN.tool === 'recognise' ? SCAN.rec : null, vw = SCAN.view; const paint = !!(rec && vw.paint); if (paint) g.setAttribute('color', new THREE.BufferAttribute(rec.col, 3, true)); else g.deleteAttribute('color');
  SCAN.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: paint ? 0xffffff : 0x9fb0c2, vertexColors: paint, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide }));
  SCAN.group.add(SCAN.mesh); SCAN.mesh.visible = !SCAN.noDraw && (!rec || vw.mesh);      // noDraw: for tests on machines without a graphics card
  if (rec) { const R = new THREE.Group(), rc = rec.recon; R.position.setComponent(vw.side, rc.shift[vw.side]); SCAN.group.add(R); SCAN.reconGroup = R; if (SCAN.fitRec !== rec) { SCAN.fitRec = rec; requestAnimationFrame(() => fitView(new THREE.Box3().setFromObject(SCAN.group), 1.0)); }       // the reconstruction: a body of its own, always beside the scan, always moved along one and the same axis of the part
    const part = (from, to) => { if (to <= from) return; const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rc.pos.subarray(from * 9, to * 9), 3)); rg.setAttribute('normal', new THREE.BufferAttribute(rc.nor.subarray(from * 9, to * 9), 3)); rg.setAttribute('color', new THREE.BufferAttribute(rc.col.subarray(from * 9, to * 9), 3)); R.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }))); };
    if (vw.planes) part(0, rc.cut[0]); if (vw.round) part(rc.cut[0], rc.cut[1]); if (vw.single) part(rc.cut[1], rc.cut[2]);
    if (vw.holes && rec.cyls.length) { const cp = [], cn = [], N = 72; for (const c of rec.cyls) { if (vw.off[c.cls]) continue; const at = (q, z) => { const t = -Math.PI + 2 * Math.PI * q / N, x = [0, 0, 0], nn = [0, 0, 0]; nn[c.i0] = Math.cos(t); nn[c.j0] = Math.sin(t); x[c.k] = z; x[c.i0] = c.c[0] + c.slope[0] * (z - c.zm) + c.r * nn[c.i0]; x[c.j0] = c.c[1] + c.slope[1] * (z - c.zm) + c.r * nn[c.j0]; return [x, nn]; };
        for (let q = 0; q < N; q++) { if (!c.sect[q]) continue; const [a, na] = at(q, c.z0), [b, nb] = at(q + 1, c.z0), [d, nd] = at(q + 1, c.z1), [e, ne] = at(q, c.z1); cp.push(...a, ...b, ...d, ...a, ...d, ...e); cn.push(...na, ...nb, ...nd, ...na, ...nd, ...ne); } }       // the cylinder itself, as measured — only the part of the turn where the scan has points
      if (cp.length) { const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3)); R.add(new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xe0584a, roughness: 0.7, metalness: 0, side: THREE.DoubleSide }))); } }       // each kind of recognised thing is drawn on its own, so each can be switched off
    for (let k = 0; k < 3; k++) { if (!vw['l' + 'xyz'[k]] || rc.lineCut[k + 1] <= rc.lineCut[k]) continue; const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(rc.lines.subarray(rc.lineCut[k] * 6, rc.lineCut[k + 1] * 6), 3)); lg.setAttribute('color', new THREE.BufferAttribute(rc.lineCol.subarray(rc.lineCut[k] * 6, rc.lineCut[k + 1] * 6), 3)); R.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true }))); }
    if (vw.extrLines && rec.extr && rec.extr.outline.length) { const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(rec.extr.outline, 3)); R.add(new THREE.LineSegments(og, new THREE.LineBasicMaterial({ color: 0x1a1a1a }))); }
    if (vw.extr && rec.extr) { const X = rec.extr, xg = new THREE.BufferGeometry(); xg.setAttribute('position', new THREE.BufferAttribute(X.pos, 3)); xg.setAttribute('normal', new THREE.BufferAttribute(X.nor, 3)); xg.setAttribute('color', new THREE.BufferAttribute(X.col, 3)); R.add(new THREE.Mesh(xg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })));
      X.capPos.forEach((cp, ci) => { if (!cp.length) return; const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.computeVertexNormals(); const f = X.caps[ci].found; R.add(new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: f ? 0xb8c4d2 : 0xf08a00, transparent: !f, opacity: f ? 1 : 0.4, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, depthWrite: f }))); });       // an end found in the scan is solid; an end closed by assumption is orange and see-through
      if (false) { const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(X.outline, 3)); R.add(new THREE.LineSegments(og, new THREE.LineBasicMaterial({ color: 0x1a1a1a }))); } }
    if (vw.faces && rec.faces.pos.length) { const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(rec.faces.pos, 3)); fg.setAttribute('normal', new THREE.BufferAttribute(rec.faces.nor, 3)); fg.setAttribute('color', new THREE.BufferAttribute(rec.faces.col, 3)); R.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))); }
    { const ep = [], ec = [], put = (runs, k) => { for (const [x, y] of runs) { ep.push(...x, ...y); ec.push(...k, ...k); } };       // every kind of edge is a layer of its own: nothing is drawn that its own tick does not ask for
      for (const e of rec.edges) { if (e.runs0) { if (vw.eWalk) put(e.runs, [0.86, 0.1, 0.1]); if (vw.eOld) put(e.runs0, [0.45, 0.45, 0.5]); } else if (vw.eSec) put(e.runs, [0.07, 0.07, 0.07]); }
      if (ep.length) { const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3)); R.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ vertexColors: true }))); } }
    if (vw.eGuess && rec.faces.guess.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(rec.faces.guess, 3)); R.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xf08a00 }))); } }
  if (SCAN.frame) { g.computeBoundingBox(); const b = g.boundingBox, L = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) * 0.6;       // the axes of the part, from its origin
    [[1, 0, 0, 0xff5151], [0, 1, 0, 0x38c26c], [0, 0, 1, 0x4c97ff]].forEach(([x, y, z, col]) => { const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x * L, y * L, z * L)]); const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: col, depthTest: false })); ln.renderOrder = 20; SCAN.group.add(ln); }); }
  scCutScene();
}

/* ── 2. orient ── */
function scEigen(m) {                             // a symmetric 3×3 matrix [xx, xy, xz, yy, yz, zz] → its values (ascending) and vectors, by Jacobi turns
  const a = [[m[0], m[1], m[2]], [m[1], m[3], m[4]], [m[2], m[4], m[5]]], v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) { let off = 0; for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] * a[p][q]; if (off < 1e-22) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) { if (Math.abs(a[p][q]) < 1e-300) continue; const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; } for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; } } }
  const o = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]); return { val: o.map(i => a[i][i]), vec: o.map(i => [v[0][i], v[1][i], v[2][i]]) };
}
/* The scan gathered into cells (about 1/300 of its size): each cell keeps the middle of its triangles, the direction
   of the sum of their area-normals, and their area. Noise is averaged inside a cell, and the work that follows no
   longer grows with the density of the scan: half a million cells at most, whatever the file. */
function scanCells() {
  const { P, F, nf } = SCAN, g = SCAN.mesh.geometry; g.computeBoundingBox(); const lo = g.boundingBox.min.toArray(), ext = g.boundingBox.max.toArray().map((v, k) => v - lo[k]), size = Math.hypot(...ext) / 300;
  const dim = ext.map(e => Math.floor(e / size) + 1), id = new Int32Array(dim[0] * dim[1] * dim[2]).fill(-1); let m = 0, cap = 1 << 16, S = new Float64Array(7 * cap), keys = new Int32Array(cap);
  for (let f = 0; f < nf; f++) { const a = 3 * F[3 * f], b = 3 * F[3 * f + 1], c = 3 * F[3 * f + 2], ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], x = (uy * vz - uz * vy) / 2, y = (uz * vx - ux * vz) / 2, z = (ux * vy - uy * vx) / 2, ar = Math.sqrt(x * x + y * y + z * z);
    const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3, key = (Math.min(dim[0] - 1, (cx - lo[0]) / size | 0) * dim[1] + Math.min(dim[1] - 1, (cy - lo[1]) / size | 0)) * dim[2] + Math.min(dim[2] - 1, (cz - lo[2]) / size | 0);
    let k = id[key]; if (k < 0) { if (m === cap) { cap *= 2; const q = new Float64Array(7 * cap); q.set(S); S = q; const q2 = new Int32Array(cap); q2.set(keys); keys = q2; } k = id[key] = m++; keys[k] = key; } const o = 7 * k; S[o] += cx * ar; S[o + 1] += cy * ar; S[o + 2] += cz * ar; S[o + 3] += x; S[o + 4] += y; S[o + 5] += z; S[o + 6] += ar; }
  const C = new Float64Array(3 * m), N = new Float64Array(3 * m), A = new Float64Array(m); let total = 0;
  for (let k = 0; k < m; k++) { const o = 7 * k, ar = S[o + 6] || 1e-30, l = Math.hypot(S[o + 3], S[o + 4], S[o + 5]) || 1; C[3 * k] = S[o] / ar; C[3 * k + 1] = S[o + 1] / ar; C[3 * k + 2] = S[o + 2] / ar; N[3 * k] = S[o + 3] / l; N[3 * k + 1] = S[o + 4] / l; N[3 * k + 2] = S[o + 5] / l; A[k] = S[o + 6]; total += A[k]; }
  return { C, N, A, m, total, size, lo, ext, dim, id, keys };
}
/* The frame of the part.
     first axis   the strongest flat direction: a peak of the map of directions, made exact by planes laid through the
                  cells of its faces (positions over a long base tell a direction far better than normals do);
     second axis  square to the first, by the best evidence there is: (a) another flat direction at right angles,
                  (b) the direction the rest of the surface does not look along — the axis of a round cavity or boss,
                  (c) the long side of the part;
     third axis   their cross product.
   The origin: the largest plane across each axis where there is one; the axis of the round surface; else the middle. */
async function scanOrient() {
  const t0 = performance.now(), cosd = d => Math.cos(d * Math.PI / 180), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  scSay('gathering the scan into cells …'); await scTick(); const { C, N, A, m, total, size } = scanCells(), nd = (k, d) => N[3 * k] * d[0] + N[3 * k + 1] * d[1] + N[3 * k + 2] * d[2], cd = (k, d) => C[3 * k] * d[0] + C[3 * k + 1] * d[1] + C[3 * k + 2] * d[2];
  scSay('where the faces look …'); await scTick();
  const refine = d0 => { let d = d0, got = null;             // planes through the cells of the faces that look along d
    for (let it = 0; it < 2; it++) { const idx = [], tt = []; let lo = Infinity, hi = -Infinity; const c5 = cosd(5); for (let k = 0; k < m; k++) if (nd(k, d) > c5) { const t = cd(k, d); idx.push(k); tt.push(t); if (t < lo) lo = t; if (t > hi) hi = t; }
      if (idx.length < 200) break; const BIN = 0.1, h = new Float64Array(Math.ceil((hi - lo) / BIN) + 1); for (let j = 0; j < idx.length; j++) h[(tt[j] - lo) / BIN | 0] += A[idx[j]];
      const order = Array.from(h.keys()).sort((a, b) => h[b] - h[a]).slice(0, 60), lv = []; for (const b of order) { if (h[b] < 0.15 * h[order[0]]) break; const l = lo + (b + 0.5) * BIN; if (lv.every(x => Math.abs(x - l) > 1.0)) lv.push(l); if (lv.length >= 4) break; }
      let sv = [0, 0, 0], sw = 0, cnt = 0, top = null;
      for (const l of lv) { let k = 0, mx = 0, my = 0, mz = 0, w = 0; for (let j = 0; j < idx.length; j++) if (Math.abs(tt[j] - l) < 0.3) { const i = 3 * idx[j]; mx += C[i]; my += C[i + 1]; mz += C[i + 2]; w += A[idx[j]]; k++; } if (k < 100) continue; mx /= k; my /= k; mz /= k;
        const c = [0, 0, 0, 0, 0, 0]; for (let j = 0; j < idx.length; j++) if (Math.abs(tt[j] - l) < 0.3) { const i = 3 * idx[j], x = C[i] - mx, y = C[i + 1] - my, z = C[i + 2] - mz; c[0] += x * x; c[1] += x * y; c[2] += x * z; c[3] += y * y; c[4] += y * z; c[5] += z * z; }
        const e = scEigen(c), nn = e.vec[0], sg = Math.sign(dot(nn, d)) || 1; if (Math.sqrt(Math.max(e.val[0], 0) / k) > 0.06) continue; sv = sv.map((v, q) => v + sg * nn[q] * w); sw += w; cnt++; if (!top || w > top.w) top = { w, level: sg * (nn[0] * mx + nn[1] * my + nn[2] * mz) }; }
      if (!cnt) break; d = unit(sv); got = { d, a: sw, n: cnt, level: top.level }; }
    return got; };
  const left = new Uint8Array(m).fill(1), axes = [], c3 = cosd(3), c6 = cosd(6);
  for (let p = 0; p < 16; p++) {                  // peaks of the map of directions, strongest first
    const bins = new Map(); for (let k = 0; k < m; k++) if (left[k]) { const key = ((Math.round(N[3 * k] * 20) + 32) * 64 + Math.round(N[3 * k + 1] * 20) + 32) * 64 + Math.round(N[3 * k + 2] * 20) + 32; bins.set(key, (bins.get(key) || 0) + A[k]); }
    if (!bins.size) break; const [bk] = [...bins].sort((a, b) => b[1] - a[1])[0]; let d = unit([((bk / 4096) | 0) - 32, (((bk / 64) | 0) % 64) - 32, (bk % 64) - 32]), area = 0;
    for (let it = 0; it < 4; it++) { const s = [0, 0, 0]; for (let k = 0; k < m; k++) if (nd(k, d) > c3) { s[0] += N[3 * k] * A[k]; s[1] += N[3 * k + 1] * A[k]; s[2] += N[3 * k + 2] * A[k]; } if (!Math.hypot(...s)) break; d = unit(s); }
    for (let k = 0; k < m; k++) { const x = nd(k, d); if (left[k] && x > c3) area += A[k]; if (x > c6) left[k] = 0; }
    if (area < 0.004 * total) continue; const g = refine(d); if (!g) continue;
    const same = axes.find(a => Math.abs(dot(a.d, g.d)) > cosd(0.5)); if (same) { const sg = Math.sign(dot(same.d, g.d)); same.d = unit(same.d.map((v, q) => v * same.a + sg * g.d[q] * g.a)); if (g.a > same.top) { same.top = g.a; same.level = sg * g.level; } same.a += g.a; same.n += g.n; } else axes.push({ ...g, top: g.a }); }
  if (!axes.length) { scSay(''); throw new Error('no flat face was found on this scan. A part with no plane at all — a ball, a free form — needs another kind of frame: not built yet.'); }
  axes.sort((a, b) => b.a - a.a); const d1 = axes[0].d, how = [`the largest flat direction: ${scNum(100 * axes[0].a / total, 1)} % of the surface, ${axes[0].n} ${axes[0].n > 1 ? 'faces' : 'face'}`], lev = [axes[0].level, null, null], org = ['its largest plane', '', ''];
  /* the direction the rest of the surface does not look along (in the plane square to the first axis) */
  let e1 = unit(cross(d1, Math.abs(d1[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(d1, e1), mxx = 0, mxy = 0, myy = 0, wr = 0; const c20 = cosd(20);
  for (let k = 0; k < m; k++) if (Math.abs(nd(k, d1)) < c20) { const x = nd(k, e1), y = nd(k, e2), w = A[k]; mxx += w * x * x; mxy += w * x * y; myy += w * y * y; wr += w; }
  const tr = mxx + myy, df = Math.sqrt(((mxx - myy) / 2) ** 2 + mxy * mxy), l0 = tr / 2 - df, l1 = tr / 2 + df, th = Math.atan2(l0 - mxx, mxy || 1e-30), ra = unit(e1.map((v, q) => Math.cos(th) * v + Math.sin(th) * e2[q])), ratio = l0 / (l1 || 1);
  const perp = axes.slice(1).filter(a => Math.abs(dot(a.d, d1)) < Math.sin(Math.PI / 180) && a.a > 0.01 * total); let d2, kind;
  if (perp.length) { const q = perp[0]; d2 = unit(q.d.map((v, i) => v - dot(q.d, d1) * d1[i])); kind = 'flat'; lev[1] = q.level; org[1] = 'its largest plane';
    how.push(`a flat direction square to the first: ${scNum(100 * q.a / total, 1)} % of the surface, ${q.n} ${q.n > 1 ? 'faces' : 'face'}, ${scNum(Math.abs(90 - Math.acos(Math.max(-1, Math.min(1, dot(q.d, d1)))) * 180 / Math.PI), 3)}° from square` + (ratio < 0.7 && wr > 0.05 * total && Math.abs(dot(ra, d2)) > cosd(2) ? `; the round surface gives the same axis within ${scNum(Math.acos(Math.min(1, Math.abs(dot(ra, d2)))) * 180 / Math.PI, 2)}°` : '')); }
  else if (ratio < 0.5 && wr > 0.05 * total) { d2 = ra; kind = 'round'; how.push(`the direction the round surface does not look along (its axis); evidence ${scNum(1 - ratio, 2)} of 1`); }
  else { let sx = 0, sy = 0, sw = 0; for (let k = 0; k < m; k++) { sx += cd(k, e1) * A[k]; sy += cd(k, e2) * A[k]; sw += A[k]; } sx /= sw; sy /= sw; let a = 0, b = 0, c = 0; for (let k = 0; k < m; k++) { const x = cd(k, e1) - sx, y = cd(k, e2) - sy; a += A[k] * x * x; b += A[k] * x * y; c += A[k] * y * y; } const t2 = 0.5 * Math.atan2(2 * b, a - c); d2 = unit(e1.map((v, q) => Math.cos(t2) * v + Math.sin(t2) * e2[q])); kind = 'long'; how.push('the long side of the part (no second flat direction and no round surface to go by)'); }
  const d3 = cross(d1, d2), R = [d1, d2, d3]; how.push('square to both');
  const third = axes.slice(1).find(a => Math.abs(dot(a.d, d3)) > cosd(1.0)); if (third) { lev[2] = Math.sign(dot(third.d, d3)) * third.level; org[2] = 'its largest plane'; }
  const mid = d => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < m; k++) { const t = cd(k, d); if (t < lo) lo = t; if (t > hi) hi = t; } return (lo + hi) / 2; };
  if (lev[2] === null && ratio < 0.7 && wr > 0.05 * total && Math.abs(dot(ra, d2)) > cosd(2)) {          // across the axis of the round surface: where the normals of that surface meet
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0; for (let k = 0; k < m; k++) if (Math.abs(nd(k, d1)) < c20 && Math.abs(nd(k, d2)) < 0.3) { let nx = nd(k, d3), ny = nd(k, d1); const l = Math.hypot(nx, ny); if (l < 1e-6) continue; nx /= l; ny /= l; const px = cd(k, d3), py = cd(k, d1), w = A[k], q = px * ny - py * nx; a11 += w * ny * ny; a12 -= w * ny * nx; a22 += w * nx * nx; b1 += w * ny * q; b2 -= w * nx * q; }
    const det = a11 * a22 - a12 * a12; if (Math.abs(det) > 1e-9) { lev[2] = (b1 * a22 - b2 * a12) / det; org[2] = 'the axis of the round surface'; } }
  const plane = d => { const idx = [], tt = []; let lo = Infinity, hi = -Infinity; for (let k = 0; k < m; k++) if (Math.abs(nd(k, d)) > c3) { const t = cd(k, d); idx.push(k); tt.push(t); if (t < lo) lo = t; if (t > hi) hi = t; }      // the level of the largest plane across the final axis d
    const BIN = 0.1, h = new Float64Array(Math.ceil((hi - lo) / BIN) + 1); for (let j = 0; j < idx.length; j++) h[(tt[j] - lo) / BIN | 0] += A[idx[j]]; let b = 0; for (let j = 1; j < h.length; j++) if (h[j] > h[b]) b = j; const l0 = lo + (b + 0.5) * BIN; let sv = 0, sw = 0; for (let j = 0; j < idx.length; j++) if (Math.abs(tt[j] - l0) < 0.3) { sv += tt[j] * A[idx[j]]; sw += A[idx[j]]; } return sv / sw; };
  for (let k = 0; k < 3; k++) if (org[k] === 'its largest plane') lev[k] = plane(R[k]);
  for (let k = 1; k < 3; k++) if (lev[k] === null) { lev[k] = mid(R[k]); org[k] = 'the middle of the part (no plane across this axis)'; }
  scSay('turning the part …'); await scTick(); const P = SCAN.P, Nn = SCAN.N, n = SCAN.n;
  for (let i = 0; i < 3 * n; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2], a = Nn[i], b = Nn[i + 1], c = Nn[i + 2]; for (let k = 0; k < 3; k++) { P[i + k] = R[k][0] * x + R[k][1] * y + R[k][2] * z - lev[k]; Nn[i + k] = R[k][0] * a + R[k][1] * b + R[k][2] * c; } }
  SCAN.frame = { R, lev, how, org, kind, cells: m, cell: size, directions: axes.length, ms: performance.now() - t0 }; SCAN.sig = null; SCAN.rec = null; SCAN.sec = [null, null, null]; SCAN.cut.forEach(c => c.on = false); SCAN.tool = 'orient';
  scanDraw(); scPanel(); scSay(''); fitView(new THREE.Box3().setFromObject(SCAN.mesh), 1.0);
}
/* a quarter turn of the oriented part about one of its axes: the names of the axes are the person's to choose */
function scanTurn(k) {
  const P = SCAN.P, N = SCAN.N, [i, j] = [0, 1, 2].filter(q => q !== k); for (const M of [P, N]) for (let q = 0; q < M.length; q += 3) { const a = M[q + i], b = M[q + j]; M[q + i] = -b; M[q + j] = a; }
  SCAN.sig = null; SCAN.rec = null; SCAN.sec = [null, null, null]; SCAN.cut.forEach(c => c.on = false); if (SCAN.tool === 'recognise' || SCAN.tool === 'sections') SCAN.tool = 'orient'; scanDraw(); scPanel(); fitView(new THREE.Box3().setFromObject(SCAN.mesh), 1.0);
}

/* ── 5. recognise: planes from the row of sections ──
   The part is cut in a row of sections along each of its three axes (about a millimetre apart), and every outline
   is recognised into lines and arcs (scanContour). Then:
     a) Inheritance. A line of one section is joined to the line that continues it in the next — same direction,
        overlapping, shifted by no more than a plane could shift it — but only if the two, with everything that was
        joined before, still lie in one plane. A face is the family of its lines through the sections.
     b) The plane of a family is laid through the scan points of its lines (each line already without its two ends).
        Families found along different axes, or on parted pieces of one face, that are one plane are made one.
     c) Edges. Where two lines meet in a section (in a corner, or through a rounding between them), the planes of
        their families are neighbours on the part; their edge is the line in which the two planes intersect.
     d) The check. Every such corner of every section is a measured point of that edge. How far the corners lie from
        the intersection of the planes says whether the planes really give the edge the scan shows.
   The Sections tool then draws the reconstructed planes over any cut (green), to be compared with the scan by eye. */
async function scanRecognise() {
  const t0 = performance.now(), g = SCAN.mesh.geometry; g.computeBoundingBox(); const lo = g.boundingBox.min.toArray(), hi = g.boundingBox.max.toArray(), step = Math.max(0.5, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 250), TOL = 0.05, cosd = d => Math.cos(d * Math.PI / 180);
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const planeOf = M => { const n = M[0], mx = M[1] / n, my = M[2] / n, mz = M[3] / n, e = scEigen([M[4] / n - mx * mx, M[5] / n - mx * my, M[6] / n - mx * mz, M[7] / n - my * my, M[8] / n - my * mz, M[9] / n - mz * mz]), v = e.vec[0]; return { n: v, d: v[0] * mx + v[1] * my + v[2] * mz, rms: Math.sqrt(Math.max(e.val[0], 0)), cnt: n, spread: Math.sqrt(Math.max(e.val[1], 0)) }; };
  const lines = [], joints = [], arcsAll = []; let nSec = 0, lenAll = 0, lenLines = 0, nArcs = 0;
  for (let k = 0; k < 3; k++) { scSay(`sections along ${'XYZ'[k]} …`); await scTick(); const [i0, j0] = [0, 1, 2].filter(q => q !== k), count = Math.max(1, Math.floor((hi[k] - lo[k]) / step)), base = lo[k] + (hi[k] - lo[k] - (count - 1) * step) / 2, secs = scanSections(k, base, step, count); nSec += count;
    for (let li = 0; li < count; li++) { const L = base + li * step; for (const ch of secs[li]) { if (ch.len < 3) continue; const R = scanContour(ch), q = R.scan; lenAll += R.length; const mine = [];
        for (const e of R.ents) { if (e.t !== 'line') { if (e.t === 'arc') nArcs++; arcsAll.push({ k, L, c: e.c, r: e.r, p0: e.p0, p1: e.p1, ccw: e.ccw, t: e.t }); mine.push(e.t === 'arc' ? { arc: e } : null); continue; } const m = e.b - e.a, tr = Math.max(3, Math.round(0.03 * m)), M = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          for (let i = e.a + tr; i < e.b - tr; i++) { const p = [0, 0, 0]; p[k] = L; p[i0] = q[i][0]; p[j0] = q[i][1]; M[0]++; M[1] += p[0]; M[2] += p[1]; M[3] += p[2]; M[4] += p[0] * p[0]; M[5] += p[0] * p[1]; M[6] += p[0] * p[2]; M[7] += p[1] * p[1]; M[8] += p[1] * p[2]; M[9] += p[2] * p[2]; }
          if (M[0] < 6) { mine.push(null); continue; } const ln = { k, li, L, c: e.c, u: e.u, p0: e.p0, p1: e.p1, len: e.len, M, id: lines.length, t0: (e.p0[0] - e.c[0]) * e.u[0] + (e.p0[1] - e.c[1]) * e.u[1], t1: (e.p1[0] - e.c[0]) * e.u[0] + (e.p1[1] - e.c[1]) * e.u[1] }; lines.push(ln); lenLines += e.len; mine.push({ line: ln }); }
        /* corners of this outline: two lines that meet, straight or through one rounding */
        const nm = mine.length; for (let i = 0; i < nm; i++) { const A = mine[i]; if (!A || !A.line) continue; for (const skip of [1, 2]) { const jx = i + skip; if (jx >= nm && !ch.closed) break; const B = mine[jx % nm]; if (!B) break; if (B.arc && skip === 1) continue; if (!B.line) break; if (B.line === A.line) break;
            const a = A.line, b = B.line, det = -a.u[0] * b.u[1] + a.u[1] * b.u[0]; if (Math.abs(det) < 0.1) break; const dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1], t = (-dx * b.u[1] + dy * b.u[0]) / det, x = [a.c[0] + t * a.u[0], a.c[1] + t * a.u[1]], arc = skip === 2 ? mine[(i + 1) % nm].arc : null;
            if (Math.hypot(x[0] - a.p1[0], x[1] - a.p1[1]) > (arc ? 3 * arc.r + 2 : 2.5)) break; const p = [0, 0, 0]; p[k] = L; p[i0] = x[0]; p[j0] = x[1]; joints.push({ a: a.id, b: b.id, p, r: arc ? arc.r : 0 }); break; } } } }
    /* a) inheritance through this row of sections */
    await scTick(); }
  scSay('inheritance of the lines through the sections …'); await scTick();
  const par = lines.map((l, i) => i), fam = lines.map(l => l.M), nsec = lines.map(() => 1), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const byLevel = new Map(); for (const l of lines) { const key = l.k * 100000 + l.li; let L = byLevel.get(key); if (!L) byLevel.set(key, L = []); L.push(l); }
  for (const l of lines) { for (const gap of [1, 2]) { const next = byLevel.get(l.k * 100000 + l.li + gap); if (!next) continue; const cands = [];
      for (const o of next) { if (Math.abs(l.u[0] * o.u[0] + l.u[1] * o.u[1]) < cosd(2)) continue; const sh = Math.abs(-(o.c[0] - l.c[0]) * l.u[1] + (o.c[1] - l.c[1]) * l.u[0]); if (sh > 3 * step * gap + 0.1) continue;
        const a0 = (o.p0[0] - l.c[0]) * l.u[0] + (o.p0[1] - l.c[1]) * l.u[1], a1 = (o.p1[0] - l.c[0]) * l.u[0] + (o.p1[1] - l.c[1]) * l.u[1], ov = Math.min(Math.max(a0, a1), Math.max(l.t0, l.t1)) - Math.max(Math.min(a0, a1), Math.min(l.t0, l.t1)); if (ov < Math.min(1.5, 0.3 * Math.min(l.len, o.len))) continue; cands.push([sh, o]); }
      cands.sort((x, y) => x[0] - y[0]); let done = false;
      for (const [, o] of cands) { const x = find(l.id), y = find(o.id); if (x === y) { done = true; break; } const J = add(fam[x], fam[y]), pl = planeOf(J); if (pl.rms < TOL && Math.abs(pl.n[l.k]) < 0.985) { par[x] = y; fam[y] = J; nsec[y] += nsec[x]; done = true; break; } }
      if (done) break; } }
  /* b) the planes of the families; what is one plane is made one */
  scSay('planes of the families …'); await scTick();
  let cand = []; const famOf = new Map(); for (const l of lines) { const r = find(l.id); let f = famOf.get(r); if (!f) famOf.set(r, f = { lines: [], len: 0 }); f.lines.push(l); f.len += l.len; }
  for (const [r, f] of famOf) { const levels = new Set(f.lines.map(l => l.li)).size; if (levels < 3 && !(levels === 2 && f.len > 12)) continue; const pl = planeOf(fam[r]); if (pl.rms > TOL || pl.spread < 0.4) continue; cand.push({ ...pl, M: fam[r], lines: f.lines, len: f.len, sections: levels }); }
  cand.sort((a, b) => b.cnt - a.cnt); const cp = cand.map((c, i) => i), cfind = x => { while (cp[x] !== x) { cp[x] = cp[cp[x]]; x = cp[x]; } return x; };
  for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) { const x = cfind(a), y = cfind(b); if (x === y) continue; const p = cand[x], q = cand[y], dn = p.n[0] * q.n[0] + p.n[1] * q.n[1] + p.n[2] * q.n[2]; if (Math.abs(dn) < cosd(0.7) || Math.abs(p.d - Math.sign(dn) * q.d) > 0.12) continue; const J = add(p.M, q.M), pl = planeOf(J); if (pl.rms < TOL) { cp[y] = x; Object.assign(p, pl, { M: J, lines: p.lines.concat(q.lines), len: p.len + q.len, sections: p.sections + q.sections }); } }
  /* a face that is not quite flat (a cast wall) comes out as several nearly equal planes: those are joined too, under a
     wider tolerance, and the plane is marked rough */
  for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) { const x = cfind(a), y = cfind(b); if (x === y) continue; const p = cand[x], q = cand[y], dn = p.n[0] * q.n[0] + p.n[1] * q.n[1] + p.n[2] * q.n[2]; if (Math.abs(dn) < cosd(1.0) || Math.abs(p.d - Math.sign(dn) * q.d) > 0.4) continue; const J = add(p.M, q.M), pl = planeOf(J); if (pl.rms < 0.12) { cp[y] = x; Object.assign(p, pl, { M: J, lines: p.lines.concat(q.lines), len: p.len + q.len, sections: p.sections + q.sections, rough: true }); } }
  let planes = cand.filter((c, i) => cfind(i) === i); const planeOfLine = new Int32Array(lines.length).fill(-1); planes.forEach((p, i) => { for (const l of p.lines) planeOfLine[l.id] = i; });
  /* adoption: a line that joined no family, or a family too small to be a plane, but lies in one of the planes found
     (both its ends and its middle within 0.1 mm, inside the reach of that plane) belongs to that plane */
  { const reach = planes.map(p => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const l of p.lines) { const [i0, j0] = [0, 1, 2].filter(q => q !== l.k); for (const e of [l.p0, l.p1]) { const pt = [0, 0, 0]; pt[l.k] = l.L; pt[i0] = e[0]; pt[j0] = e[1]; for (let q = 0; q < 3; q++) { if (pt[q] < b[q]) b[q] = pt[q]; if (pt[q] > b[3 + q]) b[3 + q] = pt[q]; } } } return b.map((v, q) => v + (q < 3 ? -3 * step : 3 * step)); }); let adopted = 0;
    for (const l of lines) { if (planeOfLine[l.id] >= 0) continue; const [i0, j0] = [0, 1, 2].filter(q => q !== l.k), at = e => { const x = [0, 0, 0]; x[l.k] = l.L; x[i0] = e[0]; x[j0] = e[1]; return x; }, pts = [at(l.p0), at(l.p1), at([(l.p0[0] + l.p1[0]) / 2, (l.p0[1] + l.p1[1]) / 2])]; let best = -1, bd = 0.1;
      for (let i = 0; i < planes.length; i++) { const p = planes[i], b = reach[i]; let worst = 0, inside = true; for (const x of pts) { const d = Math.abs(p.n[0] * x[0] + p.n[1] * x[1] + p.n[2] * x[2] - p.d); if (d > worst) worst = d; if (x[0] < b[0] || x[1] < b[1] || x[2] < b[2] || x[0] > b[3] || x[1] > b[4] || x[2] > b[5]) inside = false; } if (inside && worst < bd) { bd = worst; best = i; } }
      if (best >= 0) { planeOfLine[l.id] = best; planes[best].lines.push(l); planes[best].len += l.len; adopted++; } } SCAN.adopted = adopted; }
  /* ── one face from its pieces ──
     Planes that lie side by side, look the same way within a few degrees, and meet in the sections corner to corner
     (so there is no step between them) are asking to be one face: a wall that is a little warped, or one the scanner
     saw in pieces. They are made one plane through all their lines, and the record of the face keeps what it was made
     of: how many pieces, and how much they leaned from each other. A real step is not touched — two planes with a
     step between them never meet corner to corner. */
  let bentJoined = 0; { const cntJ = new Map(), byKey = planes.map(q => { const m = new Map(); for (const l of q.lines) { const key = l.k + ':' + Math.round(l.L * 1000); if (!m.has(key)) m.set(key, []); m.get(key).push(l); } return m; });
    /* "meet corner to corner": in one and the same section a line of one plane ends where a line of the other begins, and that end lies in the other plane too */
    for (let a = 0; a < planes.length; a++) for (let b = a + 1; b < planes.length; b++) { const pa = planes[a], pb = planes[b]; if (Math.abs(pa.n[0] * pb.n[0] + pa.n[1] * pb.n[1] + pa.n[2] * pb.n[2]) < 0.9976) continue; let touch = 0, smooth = 0; const [sm, bg, big] = byKey[a].size <= byKey[b].size ? [byKey[a], byKey[b], pb] : [byKey[b], byKey[a], pa];
      for (const [key, ls] of sm) { const os = bg.get(key); if (!os) continue; for (const l of ls) for (const o of os) for (const e of [l.p0, l.p1]) for (const f of [o.p0, o.p1]) { if (Math.hypot(e[0] - f[0], e[1] - f[1]) > 2) continue; touch++; const [i0, j0] = [0, 1, 2].filter(q => q !== l.k), x = [0, 0, 0]; x[l.k] = l.L; x[i0] = e[0]; x[j0] = e[1]; if (Math.abs(big.n[0] * x[0] + big.n[1] * x[1] + big.n[2] * x[2] - big.d) < 0.12) smooth++; } }
      if (smooth >= 3 && smooth >= 0.8 * touch) cntJ.set(a * 100000 + b, smooth); }
    const up = planes.map((q, i) => i), fnd = x => { while (up[x] !== x) { up[x] = up[up[x]]; x = up[x]; } return x; };
    for (const [key, c] of [...cntJ.entries()].sort((a, b) => b[1] - a[1])) { if (c < 3) break; const a = fnd(Math.floor(key / 100000)), b = fnd(key % 100000); if (a === b) continue; const pa = planes[a], pb = planes[b], ang = Math.acos(Math.min(1, Math.abs(pa.n[0] * pb.n[0] + pa.n[1] * pb.n[1] + pa.n[2] * pb.n[2]))) * 180 / Math.PI; if (ang > 4) continue; const J = add(pa.M, pb.M), pl = planeOf(J); if (pl.rms > 0.3) continue;
      const [kp, ot, ki, oi] = pa.len >= pb.len ? [pa, pb, a, b] : [pb, pa, b, a]; Object.assign(kp, pl, { M: J, lines: kp.lines.concat(ot.lines), len: kp.len + ot.len, sections: kp.sections + ot.sections, rough: true, pieces: (kp.pieces || 1) + (ot.pieces || 1), bend: Math.max(kp.bend || 0, ot.bend || 0, ang) }); up[oi] = ki; bentJoined++; }
    planes = planes.filter((q, i) => fnd(i) === i); planeOfLine.fill(-1); planes.forEach((q, i) => { for (const l of q.lines) planeOfLine[l.id] = i; }); }
  /* the side a plane looks to, the points of the scan that lie on it, and the colours of the picture */
  scSay('points of the scan on the planes …'); await scTick();
  const P = SCAN.P, Nv = SCAN.N, n = SCAN.n, col = new Uint8Array(3 * n), np = planes.length, on = new Uint32Array(np), side = new Float64Array(np), pal = k => { const h = (k * 0.61803398875) % 1, f = x => { const t = (h + x) % 1; return Math.round(255 * (0.42 + 0.5 * Math.max(0, Math.min(1, Math.abs(t * 6 - 3) - 1)))); }; return [f(0), f(1 / 3), f(2 / 3)]; }, colours = planes.map((p, k) => pal(k));
  const box = planes.map(p => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const l of p.lines) { const [i0, j0] = [0, 1, 2].filter(q => q !== l.k); for (const e of [l.p0, l.p1]) { const pt = [0, 0, 0]; pt[l.k] = l.L; pt[i0] = e[0]; pt[j0] = e[1]; for (let q = 0; q < 3; q++) { if (pt[q] < b[q]) b[q] = pt[q]; if (pt[q] > b[3 + q]) b[3 + q] = pt[q]; } } } return b.map((v, q) => v + (q < 3 ? -2 * step : 2 * step)); });
  const pn = new Float64Array(4 * np); planes.forEach((p, i) => { pn[4 * i] = p.n[0]; pn[4 * i + 1] = p.n[1]; pn[4 * i + 2] = p.n[2]; pn[4 * i + 3] = p.d; });
  for (let v = 0; v < n; v++) { const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2]; let best = -1, bd = 0.08; for (let i = 0; i < np; i++) { const d = Math.abs(pn[4 * i] * x + pn[4 * i + 1] * y + pn[4 * i + 2] * z - pn[4 * i + 3]); if (d >= bd) continue; const b = box[i]; if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) continue; const dn = pn[4 * i] * Nv[3 * v] + pn[4 * i + 1] * Nv[3 * v + 1] + pn[4 * i + 2] * Nv[3 * v + 2]; if (Math.abs(dn) < 0.97) continue; bd = d; best = i; }
    if (best < 0) { col[3 * v] = col[3 * v + 1] = col[3 * v + 2] = 150; continue; } on[best]++; side[best] += pn[4 * best] * Nv[3 * v] + pn[4 * best + 1] * Nv[3 * v + 1] + pn[4 * best + 2] * Nv[3 * v + 2]; const c = colours[best]; col[3 * v] = c[0]; col[3 * v + 1] = c[1]; col[3 * v + 2] = c[2]; }
  planes.forEach((p, i) => { if (side[i] < 0) { p.n = p.n.map(v => -v); p.d = -p.d; } p.on = on[i]; p.colour = colours[i]; p.box = box[i]; p.axis = [0, 1, 2].reduce((b, q) => Math.abs(p.n[q]) > Math.abs(p.n[b]) ? q : b, 0); p.off = Math.acos(Math.min(1, Math.abs(p.n[p.axis]))) * 180 / Math.PI; p.level = p.d / p.n[p.axis]; });
  /* c) edges, and d) the check against the corners of the sections */
  scSay('edges, and the check against the corners …'); await scTick(); const pairs = new Map();
  for (const j of joints) { const a = planeOfLine[j.a], b = planeOfLine[j.b]; if (a < 0 || b < 0 || a === b) continue; const key = Math.min(a, b) * 100000 + Math.max(a, b); let e = pairs.get(key); if (!e) pairs.set(key, e = { a: Math.min(a, b), b: Math.max(a, b), pts: [], rr: [] }); e.pts.push(j.p); e.rr.push(j.r); }
  const edges = []; let devAll = [];
  for (const e of pairs.values()) { if (e.pts.length < 2) continue; const p = planes[e.a], r = planes[e.b], u = [p.n[1] * r.n[2] - p.n[2] * r.n[1], p.n[2] * r.n[0] - p.n[0] * r.n[2], p.n[0] * r.n[1] - p.n[1] * r.n[0]], ul = Math.hypot(...u); if (ul < Math.sin(5 * Math.PI / 180)) continue; u.forEach((v, i) => u[i] = v / ul);
    const c12 = p.n[0] * r.n[0] + p.n[1] * r.n[1] + p.n[2] * r.n[2], det = 1 - c12 * c12, ka = (p.d - r.d * c12) / det, kb = (r.d - p.d * c12) / det, p0 = [0, 1, 2].map(i => ka * p.n[i] + kb * r.n[i]), ts = [], dv = [];
    for (const q of e.pts) { const w = [q[0] - p0[0], q[1] - p0[1], q[2] - p0[2]], t = w[0] * u[0] + w[1] * u[1] + w[2] * u[2]; ts.push(t); dv.push(Math.hypot(w[0] - t * u[0], w[1] - t * u[1], w[2] - t * u[2])); }
    const order = dv.map((d, i) => i).sort((x, y) => dv[x] - dv[y]), good = order.filter(i => dv[i] < 1.0); if (good.length < 2) continue; const tg = good.map(i => ts[i]).sort((x, y) => x - y), dg = good.map(i => dv[i]), rr = e.rr.filter(v => v > 0).sort((x, y) => x - y);
    const runs = []; let rs = tg[0]; for (let i = 1; i <= tg.length; i++) if (i === tg.length || tg[i] - tg[i - 1] > 4 * step) { if (tg[i - 1] - rs >= step) runs.push([rs - step / 2, tg[i - 1] + step / 2]); rs = tg[i]; } if (!runs.length) continue; const ta = runs[0][0], tb = runs[runs.length - 1][1];      // an edge exists only where corners were seen: where they stop for more than four sections, it stops
    devAll.push(...dg); edges.push({ a: e.a, b: e.b, o: p0, tr: runs, p0: p0.map((v, i) => v + ta * u[i]), p1: p0.map((v, i) => v + tb * u[i]), u, runs: runs.map(([x, y]) => [p0.map((v, i) => v + x * u[i]), p0.map((v, i) => v + y * u[i])]), length: runs.reduce((s, [x, y]) => s + y - x, 0), angle: 180 - Math.acos(Math.max(-1, Math.min(1, c12))) * 180 / Math.PI, corners: good.length, stray: e.pts.length - good.length, dev: Math.sqrt(dg.reduce((s, v) => s + v * v, 0) / dg.length), worst: Math.max(...dg), round: rr.length >= e.rr.length / 2 && rr.length ? rr[rr.length >> 1] : 0 }); }
  const kasa = (xs, ys) => { let n = xs.length, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; } sx /= n; sy /= n; let a = 0, b = 0, c = 0, d = 0, e = 0; for (let i = 0; i < n; i++) { const u = xs[i] - sx, v = ys[i] - sy, w = u * u + v * v; a += u * u; b += u * v; c += v * v; d += u * w; e += v * w; } const det = a * c - b * b; if (Math.abs(det) < 1e-12) return null; const uc = (d * c - e * b) / (2 * det), vc = (e * a - d * b) / (2 * det); return [sx + uc, sy + vc, Math.sqrt(uc * uc + vc * vc + (a + c) / n)]; };
  /* ── the edge scanner ──
     The corners of the sections found each edge only in pieces. Now every edge is known as a line, and that is enough to
     scan along it on purpose. An edge has a pattern of its own, the same all the way along: one face going off to one
     side, the other face to the other. The line of the edge is taken as an axis and walked from end to end of the part.
     Close to the edge the scan is noisy (and there may be a rounding), so the points right at the edge are left out:
     only the points of a band a little way off, on either face, are counted. Where both faces are there, the edge is
     there — the pieces grow together into one whole edge, and it ends where a face ends or the scan was not made.
     All the points along the edge are then laid into one cross profile (the pattern is the same everywhere along it),
     and the rounding is measured there with all of them at once. */
  scSay('scanning along the edges …'); await scTick();
  const PE = SCAN.P, nE = SCAN.n, G = 8, bb0 = lo, gn = [0, 1, 2].map(i => Math.max(1, Math.ceil((hi[i] - lo[i]) / G) + 1)), cellOf = new Int32Array(nE), cnt = new Int32Array(gn[0] * gn[1] * gn[2] + 1);
    for (let i = 0; i < nE; i++) { const c = Math.floor((PE[3 * i] - bb0[0]) / G) + gn[0] * (Math.floor((PE[3 * i + 1] - bb0[1]) / G) + gn[1] * Math.floor((PE[3 * i + 2] - bb0[2]) / G)); cellOf[i] = c; cnt[c + 1]++; } for (let c = 0; c < cnt.length - 1; c++) cnt[c + 1] += cnt[c]; const fill = cnt.slice(), ordP = new Int32Array(nE); for (let i = 0; i < nE; i++) ordP[fill[cellOf[i]]++] = i;
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    let buf = new Float32Array(600000); const why = { apart: 0, few: 0, side: 0, none: 0, pts: 0, tg: 0, tm: 0, tall: performance.now() };
    for (const e of edges) { if (e.angle > 165) { why.apart++; continue; }       // two planes ten degrees apart are mostly two pieces of one bent face: no edge to follow
      const A = planes[e.a], B = planes[e.b], u = e.u, o = e.o, gA = cross(u, A.n), gB = cross(u, B.n), tolA = Math.max(0.15, 3 * A.rms), tolB = Math.max(0.15, 3 * B.rms), half = e.angle * Math.PI / 360, near = Math.min(12, Math.max(1.5, e.round > 0 ? 1.25 * e.round / Math.max(0.2, Math.tan(half)) : 0)), far = near + 5;
      /* the stretch of the line that lies within the part */
      let t0 = -Infinity, t1 = Infinity; for (let i = 0; i < 3; i++) { if (Math.abs(u[i]) < 1e-9) continue; const a = (lo[i] - 1 - o[i]) / u[i], b = (hi[i] + 1 - o[i]) / u[i]; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); } if (!(t1 > t0)) continue;
      const nb = Math.max(1, Math.ceil((t1 - t0) / step)), seen = new Set(), pts = [];
      for (let t = t0; t <= t1 + G / 2; t += G / 2) { const c = [0, 1, 2].map(i => Math.floor((o[i] + t * u[i] - bb0[i]) / G)); for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c[0] + dx, y = c[1] + dy, z = c[2] + dz; if (x < 0 || y < 0 || z < 0 || x >= gn[0] || y >= gn[1] || z >= gn[2]) continue; const id = x + gn[0] * (y + gn[1] * z); if (seen.has(id)) continue; seen.add(id); for (let q = cnt[id]; q < cnt[id + 1]; q++) pts.push(ordP[q]); } }
      why.pts += pts.length; const tq = performance.now();
      /* every point near the line: where along the edge (t), how far out along face A and along face B, how far off each face */
      let m = 0; if (buf.length < 6 * pts.length) buf = new Float32Array(6 * pts.length); const lim = far + 1;
      for (let j = 0; j < pts.length; j++) { const i = 3 * pts[j], wx = PE[i] - o[0], wy = PE[i + 1] - o[1], wz = PE[i + 2] - o[2], t = wx * u[0] + wy * u[1] + wz * u[2]; if (t < t0 || t > t1) continue; const qx = wx - t * u[0], qy = wy - t * u[1], qz = wz - t * u[2]; if (qx * qx + qy * qy + qz * qz > lim * lim) continue;
        buf[m] = t; buf[m + 1] = qx * gA[0] + qy * gA[1] + qz * gA[2]; buf[m + 2] = qx * gB[0] + qy * gB[1] + qz * gB[2]; buf[m + 3] = qx * A.n[0] + qy * A.n[1] + qz * A.n[2]; buf[m + 4] = qx * B.n[0] + qy * B.n[1] + qz * B.n[2]; m += 6; }
      why.tm += performance.now() - tq;
      if (m < 120) { why.few++; continue; }
      /* a point belongs to face A if it lies in A, in the band, and well off B (and the same for B): the faces must really part */
      const onA = j => Math.abs(buf[j + 3]) < tolA && Math.abs(buf[j + 4]) > 1.5 * tolB && Math.abs(buf[j + 1]) > near && Math.abs(buf[j + 1]) < far, onB = j => Math.abs(buf[j + 4]) < tolB && Math.abs(buf[j + 3]) > 1.5 * tolA && Math.abs(buf[j + 2]) > near && Math.abs(buf[j + 2]) < far;
      /* which way each face goes off from the edge: seen where the edge is already known */
      const inRun = t => { for (const r of e.tr) if (t >= r[0] && t <= r[1]) return true; return false; }; let sa = 0, sb = 0; for (let j = 0; j < m; j += 6) { if (!inRun(buf[j])) continue; if (onA(j)) sa += Math.sign(buf[j + 1]); if (onB(j)) sb += Math.sign(buf[j + 2]); } if (!sa || !sb) { why.side++; continue; } sa = Math.sign(sa); sb = Math.sign(sb);
      const cA = new Uint16Array(nb), cB = new Uint16Array(nb); for (let j = 0; j < m; j += 6) { const b = Math.min(nb - 1, Math.floor((buf[j] - t0) / step)); if (onA(j) && buf[j + 1] * sa > 0) cA[b]++; if (onB(j) && buf[j + 2] * sb > 0) cB[b]++; }
      const has = new Uint8Array(nb); for (let b = 0; b < nb; b++) has[b] = cA[b] >= 2 && cB[b] >= 2 ? 1 : 0; for (let b = 0; b < nb; b++) if (!has[b]) { let l = b; while (l < nb && !has[l]) l++; if (b > 0 && l < nb && l - b <= 3) for (let q = b; q < l; q++) has[q] = 2; b = l; }       // a gap of up to three steps is a gap of the scan, not of the edge
      let tr = []; for (let b = 0; b < nb; b++) if (has[b]) { let l = b; while (l < nb && has[l]) l++; if (l - b >= 3) tr.push([t0 + b * step, t0 + l * step]); b = l; }
      tr = tr.filter(([x, y]) => e.tr.some(([a, b]) => b > x - 2 * step && a < y + 2 * step));       // only what grows out of a piece already seen: the same two planes may meet again elsewhere, but that is not proved here
      if (!tr.length) { why.none++; continue; } const before = e.length, lenNew = tr.reduce((q, [x, y]) => q + y - x, 0), inNew = t => { for (const r of tr) if (t >= r[0] && t <= r[1]) return true; return false; };
      /* the common cross profile: all the points along the edge laid into one picture. What lies off both faces, inside
         the corner, is the rounding. A rounding touches both faces, so its centre is on the bisector and one number is
         left — the radius; every point gives it, the median is taken. */
      const e1 = gA.map(v => v * sa), f1 = gB.map(v => v * sb), c2 = Math.max(-1, Math.min(1, dot(e1, f1))), hf = Math.acos(c2) / 2, kk = 1 / Math.max(0.05, Math.sin(hf)), bl = Math.hypot(e1[0] + f1[0], e1[1] + f1[1], e1[2] + f1[2]) || 1, bA = (1 + c2) / bl, Rs = [];
      /* in the cross picture: x along face A outward, and along face B outward; a point q = x*e1 + … ; its part along the bisector = (q·e1 + q·f1)/|e1+f1| */
      if (hf > 0.2 && hf < 1.45) for (let j = 0; j < m; j += 6) { if (!inNew(buf[j]) || Math.abs(buf[j + 3]) < 0.6 * tolA || Math.abs(buf[j + 4]) < 0.6 * tolB) continue; const qa = buf[j + 1] * sa, qb = buf[j + 2] * sb, d2 = buf[j + 1] * buf[j + 1] + buf[j + 3] * buf[j + 3], pb = (qa + qb) / bl; if (pb <= 0 || d2 > (near + 2) * (near + 2) || Math.abs(qa - qb) > 0.45 * (qa + qb)) continue;       /* the middle of the rounding only: near where it touches a face a point says little about the radius */ const disc = kk * kk * pb * pb - (kk * kk - 1) * d2; if (disc < 0) continue; const R = (kk * pb + Math.sqrt(disc)) / (kk * kk - 1); if (R > 0.2 && R < 40) Rs.push(R); }
      let R2 = 0, R2n = 0, R2s = 0; if (Rs.length >= 40) { Rs.sort((a, b) => a - b); const md = Rs[Rs.length >> 1], dv = Rs.map(v => Math.abs(v - md)).sort((a, b) => a - b), sc = 1.4826 * dv[dv.length >> 1]; if (sc < 0.1 + 0.08 * md) { R2 = md; R2n = Rs.length; R2s = sc; } }
      e.len0 = before; e.runs0 = e.runs; e.pieces0 = e.runs.length; e.tr = tr; e.runs = tr.map(([x, y]) => [o.map((v, i) => v + x * u[i]), o.map((v, i) => v + y * u[i])]); e.length = lenNew; e.p0 = e.runs[0][0]; e.p1 = e.runs[e.runs.length - 1][1]; e.band = [near, far]; e.round2 = R2; e.round2n = R2n; e.round2s = R2s; e.used = m / 6; } why.tall = performance.now() - why.tall; SCAN.edgeWhy = why;

  edges.sort((a, b) => b.length - a.length); devAll.sort((a, b) => a - b); const order = planes.map((p, i) => i).sort((a, b) => planes[b].on - planes[a].on), rank = new Int32Array(np); order.forEach((p, i) => rank[p] = i);
  for (const e of edges) { e.a = rank[e.a]; e.b = rank[e.b]; } planes = order.map(i => planes[i]);

  /* ── twins ──
     A face of a casting is often found as two or three planes a few degrees apart, and each of them gives an edge of
     its own with the same neighbour: a bundle of short lines along one real edge. Two edges are twins if they run the
     same way, lie close by, and their planes are the same pair but for a few degrees. The stronger one stays and takes
     the length of the other. */
  scSay('one edge from its twins …'); await scTick(); let twins = 0;
  { const ang = (a, b) => Math.acos(Math.min(1, Math.abs(dot(a, b)))) * 180 / Math.PI, near2 = Math.max(1.5, 3 * step), alive = edges.map(() => true), strength = e => e.length * Math.min(planes[e.a].on, planes[e.b].on);
    const idx = edges.map((e, i) => i).sort((x, y) => strength(edges[y]) - strength(edges[x]));
    for (let ii = 0; ii < idx.length; ii++) { const E = edges[idx[ii]]; if (!alive[idx[ii]]) continue; for (let jj = ii + 1; jj < idx.length; jj++) { if (!alive[idx[jj]]) continue; const F = edges[idx[jj]]; if (ang(E.u, F.u) > 4) continue;
        const nA = planes[E.a].n, nB = planes[E.b].n, fa = planes[F.a].n, fb = planes[F.b].n; if (!((ang(nA, fa) < 8 && ang(nB, fb) < 8) || (ang(nA, fb) < 8 && ang(nB, fa) < 8))) continue;
        const sg = dot(E.u, F.u) < 0 ? -1 : 1, pr = pt => { const w = [pt[0] - E.o[0], pt[1] - E.o[1], pt[2] - E.o[2]], t = dot(w, E.u); return [t, Math.hypot(w[0] - t * E.u[0], w[1] - t * E.u[1], w[2] - t * E.u[2])]; }; let ok = true; const add = [];
        for (const [x, y] of F.runs) { const a = pr(x), b = pr(y); if (a[1] > near2 || b[1] > near2) { ok = false; break; } add.push([Math.min(a[0], b[0]), Math.max(a[0], b[0])]); } if (!ok) continue;
        if (!add.some(([x, y]) => E.tr.some(([a, b]) => b > x - 4 * step && a < y + 4 * step))) continue;
        const all = [...E.tr, ...add].sort((a, b) => a[0] - b[0]), mg = []; for (const r of all) { if (mg.length && r[0] <= mg[mg.length - 1][1] + 3 * step) mg[mg.length - 1][1] = Math.max(mg[mg.length - 1][1], r[1]); else mg.push([r[0], r[1]]); }
        E.tr = mg; E.runs = mg.map(([x, y]) => [E.o.map((v, q) => v + x * E.u[q]), E.o.map((v, q) => v + y * E.u[q])]); E.length = mg.reduce((q, [x, y]) => q + y - x, 0); E.p0 = E.runs[0][0]; E.p1 = E.runs[E.runs.length - 1][1]; E.twins = (E.twins || 0) + 1 + (F.twins || 0); alive[idx[jj]] = false; twins++; } }
    const kept = edges.filter((e, i) => alive[i]); edges.length = 0; edges.push(...kept); edges.sort((a, b) => b.length - a.length); }
  /* ── faces ──
     Every plane now has its edges. In the plane they are drawn as walls; an end that stops a little short of the next
     edge (a rounding, noise, a patch the scanner missed) is carried on to where the two lines meet — that piece is a
     guess and is kept apart from what was measured. If the walls close, what they enclose is the face.
     Then the face is checked against the scan it came from: it is given a thickness, and every small square of it must
     have real points of the scan inside. A face that is covered all over is rebuilt right; a face that is not shows
     where the scan has nothing — or where the face was closed wrongly. */
  scSay('closing the faces and checking them on the scan …'); await scTick(); const fp = [], fn = [], fc = [], guess = []; let facesOk = 0, facesClosed = 0;
  { const Nv2 = SCAN.N, reach = 8, h = step; for (let pi = 0; pi < planes.length; pi++) { const pl = planes[pi], nn = pl.n, ax = [0, 1, 2].reduce((b, q) => Math.abs(nn[q]) < Math.abs(nn[b]) ? q : b, 0), a0 = [0, 0, 0]; a0[ax] = 1; const dn = dot(a0, nn), ex0 = a0.map((v, q) => v - dn * nn[q]), el = Math.hypot(...ex0), ex = ex0.map(v => v / el), ey = cross(nn, ex), O = nn.map(v => v * pl.d);
      const to2 = pt => { const w = [pt[0] - O[0], pt[1] - O[1], pt[2] - O[2]]; return [dot(w, ex), dot(w, ey)]; }, to3 = (x, y) => [O[0] + x * ex[0] + y * ey[0], O[1] + x * ex[1] + y * ey[1], O[2] + x * ex[2] + y * ey[2]];
      const segs = []; for (const e of edges) if (e.a === pi || e.b === pi) for (const [x, y] of e.runs) segs.push({ a: to2(x), b: to2(y), e }); pl.face = null; if (segs.length < 3) continue;
      /* carry the ends on to the corners */
      const moves = []; for (const sgm of segs) for (const end of [0, 1]) { const E = end ? sgm.b : sgm.a, Z = end ? sgm.a : sgm.b, L0 = Math.hypot(E[0] - Z[0], E[1] - Z[1]) || 1, w = [(E[0] - Z[0]) / L0, (E[1] - Z[1]) / L0]; let bs = null; for (const o of segs) { if (o.e === sgm.e) continue; const vx = o.b[0] - o.a[0], vy = o.b[1] - o.a[1], L = Math.hypot(vx, vy) || 1, v = [vx / L, vy / L], cr = w[0] * v[1] - w[1] * v[0]; if (Math.abs(cr) < 0.17) continue; const dx = o.a[0] - E[0], dy = o.a[1] - E[1], sv = (dx * v[1] - dy * v[0]) / cr, q = (dx * w[1] - dy * w[0]) / cr; if (sv < -1.5 || sv > reach || q < -reach || q > L + reach) continue; if (bs === null || Math.abs(sv) < Math.abs(bs)) bs = sv; } if (bs !== null) moves.push([sgm, end, [E[0] + bs * w[0], E[1] + bs * w[1]], bs]); }
      for (const [sgm, end, pt, bs] of moves) { const old = end ? sgm.b : sgm.a; if (bs > 0.3) guess.push(...to3(old[0], old[1]), ...to3(pt[0], pt[1])); if (end) sgm.b = pt; else sgm.a = pt; }
      /* walls on a grid of small squares, and the flood from outside */
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const sgm of segs) for (const q of [sgm.a, sgm.b]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } x0 -= 3 * h; y0 -= 3 * h; const W = Math.ceil((x1 - x0) / h) + 4, H = Math.ceil((y1 - y0) / h) + 4; if (W * H > 4e6) continue;
      const cell = new Uint8Array(W * H); for (const sgm of segs) { const L = Math.hypot(sgm.b[0] - sgm.a[0], sgm.b[1] - sgm.a[1]), m = Math.max(1, Math.ceil(L / (h / 3))); for (let q = 0; q <= m; q++) { const x = sgm.a[0] + (sgm.b[0] - sgm.a[0]) * q / m, y = sgm.a[1] + (sgm.b[1] - sgm.a[1]) * q / m; cell[Math.floor((x - x0) / h) + W * Math.floor((y - y0) / h)] = 1; } }
      const st = [0]; cell[0] = 2; while (st.length) { const c = st.pop(), cx = c % W, cy = (c - cx) / W; if (cx > 0 && !cell[c - 1]) { cell[c - 1] = 2; st.push(c - 1); } if (cx < W - 1 && !cell[c + 1]) { cell[c + 1] = 2; st.push(c + 1); } if (cy > 0 && !cell[c - W]) { cell[c - W] = 2; st.push(c - W); } if (cy < H - 1 && !cell[c + W]) { cell[c + W] = 2; st.push(c + W); } }
      let inside = 0; for (let c = 0; c < W * H; c++) if (!cell[c]) inside++; if (inside < 9) { pl.face = { closed: false }; continue; } facesClosed++;
      /* the thickened face against the scan: which squares have real points */
      const tol = Math.max(0.15, 3 * pl.rms), has = new Uint8Array(W * H); let ptsIn = 0, ptsOut = 0; const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const [gx, gy] of [[0, 0], [W, 0], [0, H], [W, H]]) { const q3 = to3(x0 + gx * h, y0 + gy * h); for (let q = 0; q < 3; q++) { b[q] = Math.min(b[q], q3[q]); b[3 + q] = Math.max(b[3 + q], q3[q]); } } const c0 = [0, 1, 2].map(q => Math.max(0, Math.floor((b[q] - 2 - bb0[q]) / G))), c1 = [0, 1, 2].map(q => Math.min(gn[q] - 1, Math.floor((b[3 + q] + 2 - bb0[q]) / G)));
      for (let cz = c0[2]; cz <= c1[2]; cz++) for (let cy = c0[1]; cy <= c1[1]; cy++) for (let cx = c0[0]; cx <= c1[0]; cx++) { const dc = nn[0] * (bb0[0] + (cx + 0.5) * G) + nn[1] * (bb0[1] + (cy + 0.5) * G) + nn[2] * (bb0[2] + (cz + 0.5) * G) - pl.d; if (Math.abs(dc) > 0.87 * G + tol) continue; const id = cx + gn[0] * (cy + gn[1] * cz);
        for (let q = cnt[id]; q < cnt[id + 1]; q++) { const v = 3 * ordP[q], x = PE[v], y = PE[v + 1], z = PE[v + 2]; if (Math.abs(nn[0] * x + nn[1] * y + nn[2] * z - pl.d) > tol || Math.abs(nn[0] * Nv2[v] + nn[1] * Nv2[v + 1] + nn[2] * Nv2[v + 2]) < 0.9) continue; const wx = x - O[0], wy = y - O[1], wz = z - O[2], gx = Math.floor((wx * ex[0] + wy * ex[1] + wz * ex[2] - x0) / h), gy = Math.floor((wx * ey[0] + wy * ey[1] + wz * ey[2] - y0) / h); if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue; const c = gx + W * gy; if (cell[c] === 2) ptsOut++; else { ptsIn++; has[c] = 1; } } }
      let covered = 0; for (let c = 0; c < W * H; c++) if (!cell[c]) { if (has[c] || has[c - 1] || has[c + 1] || has[c - W] || has[c + W]) { covered++; cell[c] = 3; } }       // 3 = a square of the face with the scan in it (or right beside it), 0 = a square with nothing
      const cover = covered / inside, ok = cover >= 0.9; if (ok) facesOk++; pl.face = { closed: true, area: inside * h * h, cover, ptsIn, ptsOut, ok };
      const cc = pl.colour.map(v => v / 255), bare = [1, 0.93, 0.35]; for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) { const t = cell[gx + W * gy]; if (t !== 0 && t !== 3) continue; let g2 = gx; while (g2 + 1 < W && cell[g2 + 1 + W * gy] === t) g2++; const xa = x0 + gx * h, xb = x0 + (g2 + 1) * h, ya = y0 + gy * h, yb = ya + h, q = [to3(xa, ya), to3(xb, ya), to3(xb, yb), to3(xa, yb)], k = t === 3 ? cc : bare; fp.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); for (let r = 0; r < 6; r++) { fn.push(...nn); fc.push(...k); } gx = g2; } } }
  const lenIn = planes.reduce((s, p) => s + p.len, 0);
  /* the reconstruction as a thing of its own, to stand beside the scan: every recognised line of a section becomes a
     strip one section wide, lying exactly in the plane of its family and ending at its corners; every arc becomes a
     strip of its circle. What was not recognised is simply not there — the gaps show what is still missing. */
  scSay('building the reconstruction …'); await scTick(); const rp = [], rn = [], rc = [], tri = (a, b, c, nn, cc) => { rp.push(...a, ...b, ...c); rn.push(...nn, ...nn, ...nn); rc.push(...cc, ...cc, ...cc); };
  for (const p of planes) { const cnt = [0, 0, 0]; for (const l of p.lines) cnt[l.k] += l.len; const ka = cnt.indexOf(Math.max(...cnt)), nk = p.n[ka], sc = (step / 2) / Math.max(1 - nk * nk, 1e-6), w = [0, 1, 2].map(i => sc * ((i === ka ? 1 : 0) - nk * p.n[i])), cc = p.colour.map(v => v / 255), [i0, j0] = [0, 1, 2].filter(q => q !== ka);
    for (const l of p.lines) { if (l.k !== ka) continue; const on = e => { const x = [0, 0, 0]; x[ka] = l.L; x[i0] = e[0]; x[j0] = e[1]; const dd = p.n[0] * x[0] + p.n[1] * x[1] + p.n[2] * x[2] - p.d; return x.map((v, i) => v - dd * p.n[i]); }, a = on(l.p0), b = on(l.p1), q = [a.map((v, i) => v - w[i]), b.map((v, i) => v - w[i]), b.map((v, i) => v + w[i]), a.map((v, i) => v + w[i])]; tri(q[0], q[1], q[2], p.n, cc); tri(q[0], q[2], q[3], p.n, cc); } }
  /* ── cylinders ──
     A circle in one section proves nothing: a marker dot, a pit of the casting, a letter gives one too. A hole gives the
     same circle — same centre, same radius — in section after section. So the circles are inherited through the row of
     sections exactly as the lines are, and only a family of three or more in a row is a cylinder.
     Then the "round scanner": about the axis found, every point of the scan near the cylinder is taken, the centre is
     found again in several slices along the axis (the axis may lean), and all the points are measured from that axis:
     radius = their median, scatter, how much of the turn is there, how long it is, whether it tapers. Every point around
     the whole turn takes part — that is the symmetry of the thing put to work. */
  scSay('gathering the cylinders …'); await scTick();
  const sweepOf = a => { if (a.t === 'circle') return 2 * Math.PI; let d = Math.atan2(a.p1[1] - a.c[1], a.p1[0] - a.c[0]) - Math.atan2(a.p0[1] - a.c[1], a.p0[0] - a.c[0]); if (!a.ccw) d = -d; while (d < 0) d += 2 * Math.PI; return d; };
  const cyls = [], round = arcsAll.filter(a => sweepOf(a) > Math.PI).sort((a, b) => a.k - b.k || a.L - b.L), open = [];
  for (const a of round) { let best = null, bd = Infinity; const tol = Math.max(0.15, 0.05 * a.r);
    for (const ch of open) { const z = ch.m[ch.m.length - 1]; if (ch.k !== a.k || a.L - z.L > 2.5 * step || a.L - z.L < step * 0.5) continue; const d = Math.hypot(a.c[0] - z.c[0], a.c[1] - z.c[1]) + Math.abs(a.r - z.r); if (Math.hypot(a.c[0] - z.c[0], a.c[1] - z.c[1]) < tol && Math.abs(a.r - z.r) < tol && d < bd) { bd = d; best = ch; } }
    if (best) best.m.push(a); else open.push({ k: a.k, m: [a] }); }
  const usedArc = new Set(), PP = SCAN.P, nP = SCAN.n, med = v => { const q = Float64Array.from(v).sort(); return q.length ? q[q.length >> 1] : 0; };
  for (const ch of open) { if (ch.m.length < 3) continue; const k = ch.k, [i0, j0] = [0, 1, 2].filter(q => q !== k), r0 = med(ch.m.map(a => a.r)), c0 = [med(ch.m.map(a => a.c[0])), med(ch.m.map(a => a.c[1]))], L0 = ch.m[0].L - step, L1 = ch.m[ch.m.length - 1].L + step;
    const zs = [], us = [], vs = []; for (let i = 0; i < nP; i++) { const z = PP[3 * i + k]; if (z < L0 || z > L1) continue; const u = PP[3 * i + i0] - c0[0], v = PP[3 * i + j0] - c0[1], q = u * u + v * v; if (q < 0.49 * r0 * r0 || q > 1.69 * r0 * r0) continue; zs.push(z); us.push(u + c0[0]); vs.push(v + c0[1]); }
    if (zs.length < 60) continue;
    /* the centre again, in slices along the axis; a line through the centres is the axis */
    const nS = Math.max(1, Math.min(8, Math.floor((L1 - L0) / Math.max(2 * step, 1.5)))), cen = []; for (let sI = 0; sI < nS; sI++) { const a = L0 + (L1 - L0) * sI / nS, b = L0 + (L1 - L0) * (sI + 1) / nS; let xs = [], ys = []; for (let i = 0; i < zs.length; i++) if (zs[i] >= a && zs[i] < b) { xs.push(us[i]); ys.push(vs[i]); } if (xs.length < 30) continue; let f = kasa(xs, ys); if (!f) continue; for (let it = 0; it < 2; it++) { const res = xs.map((x, i) => Math.abs(Math.hypot(x - f[0], ys[i] - f[1]) - f[2])), lim = Math.max(0.08, 3 * med(res)), X = [], Y = []; for (let i = 0; i < xs.length; i++) if (res[i] < lim) { X.push(xs[i]); Y.push(ys[i]); } if (X.length < 30) break; const g = kasa(X, Y); if (!g) break; f = g; xs = X; ys = Y; } if (Math.hypot(f[0] - c0[0], f[1] - c0[1]) < 0.3 * r0) cen.push([(a + b) / 2, f[0], f[1]]); }
    let zm = (L0 + L1) / 2, cu = c0[0], cv = c0[1], su = 0, sv = 0; if (cen.length) { zm = cen.reduce((t, c) => t + c[0], 0) / cen.length; cu = cen.reduce((t, c) => t + c[1], 0) / cen.length; cv = cen.reduce((t, c) => t + c[2], 0) / cen.length; } if (cen.length >= 3) { let zz = 0, zu = 0, zv = 0; for (const c of cen) { zz += (c[0] - zm) ** 2; zu += (c[0] - zm) * (c[1] - cu); zv += (c[0] - zm) * (c[2] - cv); } if (zz > 1e-9) { su = zu / zz; sv = zv / zz; } }
    /* all the points, measured from the axis */
    const rho = new Float64Array(zs.length), th = new Float64Array(zs.length); for (let i = 0; i < zs.length; i++) { const u = us[i] - cu - su * (zs[i] - zm), v = vs[i] - cv - sv * (zs[i] - zm); rho[i] = Math.hypot(u, v); th[i] = Math.atan2(v, u); }
    let r = med(rho); for (let it = 0; it < 2; it++) { const near = []; for (let i = 0; i < rho.length; i++) if (Math.abs(rho[i] - r) < Math.max(0.3, 0.06 * r)) near.push(rho[i]); if (near.length) r = med(near); }
    const dev = [], on = [], sect = new Uint8Array(72); for (let i = 0; i < rho.length; i++) if (Math.abs(rho[i] - r) < Math.max(0.25, 0.04 * r)) { on.push(i); dev.push(Math.abs(rho[i] - r)); }
    if (on.length < 60) continue; const scat = 1.4826 * med(dev), zOn = Float64Array.from(on, i => zs[i]).sort(), z0 = zOn[Math.floor(zOn.length * 0.01)], z1 = zOn[Math.floor(zOn.length * 0.99)];
    let sz = 0, szz = 0, szr = 0, mz = 0, mr = 0; for (const i of on) { mz += zs[i]; mr += rho[i]; } mz /= on.length; mr /= on.length; for (const i of on) { szz += (zs[i] - mz) ** 2; szr += (zs[i] - mz) * (rho[i] - mr); sect[Math.min(71, Math.floor((th[i] + Math.PI) / (2 * Math.PI) * 72))] = 1; }
    const cover = sect.reduce((a, b) => a + b, 0) / 72, taper = szz > 1e-9 && z1 - z0 > 3 * step ? Math.atan(szr / szz) * 180 / Math.PI : 0, lean = Math.atan(Math.hypot(su, sv)) * 180 / Math.PI;
    if (scat > Math.max(0.12, 0.03 * r) || cover < 0.3) continue;       // not a cylinder after all
    for (const a of ch.m) usedArc.add(a); cyls.push({ k, i0, j0, r, c: [cu, cv], zm, slope: [su, sv], z0, z1, scat, cover, sect, taper, lean, sections: ch.m.length, on: on.length, near: zs.length }); }
  /* one cylinder seen twice (a break in the row of sections) is one cylinder; and equal diameters form a class */
  cyls.sort((a, b) => b.r - a.r); for (let i = 0; i < cyls.length; i++) for (let j = cyls.length - 1; j > i; j--) { const a = cyls[i], b = cyls[j]; if (a.k !== b.k || Math.abs(a.r - b.r) > 0.1 + 0.02 * a.r) continue; const z = (b.z0 + b.z1) / 2, ua = a.c[0] + a.slope[0] * (z - a.zm), va = a.c[1] + a.slope[1] * (z - a.zm); if (Math.hypot(ua - b.c[0], va - b.c[1]) > 0.1 + 0.03 * a.r) continue; if (b.z0 > a.z1 + 3 * step || a.z0 > b.z1 + 3 * step) continue; a.z0 = Math.min(a.z0, b.z0); a.z1 = Math.max(a.z1, b.z1); a.sections += b.sections; a.on += b.on; for (let q = 0; q < 72; q++) a.sect[q] |= b.sect[q]; a.cover = a.sect.reduce((x, y) => x + y, 0) / 72; cyls.splice(j, 1); }
  const classes = []; for (const c of cyls) { let g = classes.find(g => Math.abs(g.r - c.r) < 0.08 + 0.015 * g.r); if (!g) { g = { r: c.r, m: [] }; classes.push(g); } g.m.push(c); c.cls = classes.indexOf(g); } for (const g of classes) { let w = 0, t = 0; for (const c of g.m) { w += c.on; t += c.on * c.r; } g.r = t / w; g.scat = Math.sqrt(g.m.reduce((a, c) => a + c.on * c.scat * c.scat, 0) / w); g.on = w; }
  const singles = arcsAll.filter(a => a.t === 'circle' && !usedArc.has(a)).length;
  const cutAt = [rp.length / 9]; for (const kind of ['arc', 'circle']) { for (const a of arcsAll) { if ((a.t === 'circle') !== (kind === 'circle') || usedArc.has(a)) continue; const [i0, j0] = [0, 1, 2].filter(q => q !== a.k), pts = scArcPts(a, Math.max(6, Math.min(32, Math.round(3 * Math.abs(a.t === 'circle' ? 6.3 : 1.5) * Math.sqrt(a.r))))), cc = a.t === 'circle' ? [0.9, 0.35, 0.3] : [0.42, 0.6, 0.92], at = (pt, dz) => { const x = [0, 0, 0]; x[a.k] = a.L + dz; x[i0] = pt[0]; x[j0] = pt[1]; return x; };
    for (let i = 1; i < pts.length; i++) { const m = [(pts[i][0] + pts[i - 1][0]) / 2 - a.c[0], (pts[i][1] + pts[i - 1][1]) / 2 - a.c[1]], ml = Math.hypot(...m) || 1, nn = [0, 0, 0]; nn[i0] = m[0] / ml; nn[j0] = m[1] / ml; const q = [at(pts[i - 1], -step / 2), at(pts[i], -step / 2), at(pts[i], step / 2), at(pts[i - 1], step / 2)]; tri(q[0], q[1], q[2], nn, cc); tri(q[0], q[2], q[3], nn, cc); } } cutAt.push(rp.length / 9); }
  /* the outlines themselves, as they were recognised in every section: lines dark (grey if they found no plane), arcs blue, circles red */
  const lp = [], lc = [], seg = (k, L, a, b, cc) => { const [i0, j0] = [0, 1, 2].filter(q => q !== k), x = [0, 0, 0], y = [0, 0, 0]; x[k] = y[k] = L; x[i0] = a[0]; x[j0] = a[1]; y[i0] = b[0]; y[j0] = b[1]; lp.push(...x, ...y); lc.push(...cc, ...cc); };
  const inPlane = new Set(); for (const p of planes) for (const l of p.lines) inPlane.add(l);
  const lineCut = [0]; for (let k = 0; k < 3; k++) { for (const l of lines) if (l.k === k) seg(l.k, l.L, l.p0, l.p1, inPlane.has(l) ? [0.1, 0.1, 0.12] : [0.62, 0.62, 0.66]);
  for (const a of arcsAll) { if (a.k !== k) continue; const pts = scArcPts(a, Math.max(6, Math.min(32, Math.round(3 * Math.abs(a.t === 'circle' ? 6.3 : 1.5) * Math.sqrt(a.r))))), cc = a.t === 'circle' ? [0.85, 0.2, 0.15] : [0.2, 0.42, 0.9]; for (let i = 1; i < pts.length; i++) seg(a.k, a.L, pts[i - 1], pts[i], cc); } lineCut.push(lp.length / 6); }
  const size = [0, 1, 2].map(i => hi[i] - lo[i]), recon = { pos: new Float32Array(rp), nor: new Float32Array(rn), col: new Float32Array(rc), cut: cutAt, lines: new Float32Array(lp), lineCol: new Float32Array(lc), lineCut, shift: size.map(v => v * 1.25 + 15) };
  /* ── how the part was made: the hypothesis of an extrusion ──
     A man looking at the edges would say: many edges run one way, and across them there is one outline — this is a
     profile pushed along that way. That is a symmetry (the same section everywhere along one direction), so it can be
     tested, and if it holds, every point of every wall along the whole length measures the one profile.
       sign   : nearly all of the surface either looks square to the direction (walls) or straight along it (ends);
       profile: the section in the middle gives the order of lines and arcs; then each line and each arc is fitted
                anew with the points of its wall over the whole length of the part;
       check  : every point of the scan against the body "profile × length" — how many lie on it, and how far off;
       ends   : an end with a flat face of the scan on it is found; an end with nothing was not scanned (the part
                lay on it) — a body has no open side, so it is closed there by assumption, and said so. */
  scSay('is it an extrusion? …'); await scTick(); let extr = null; const hyp = [];
  { const NN = SCAN.N, stride = Math.max(1, Math.floor(nE / 400000)), onAll = planes.reduce((a, p) => a + p.on, 0) || 1, sc0 = [0, 1, 2].map(k => { let sd = 0, cp = 0; for (const p of planes) { const c = Math.abs(p.n[k]); if (c < 0.052) sd += p.on; else if (c > 0.9986) cp += p.on; } return { k, side: sd / onAll, cap: cp / onAll }; }).sort((a, b) => b.side + b.cap - a.side - a.cap); for (const q of sc0) hyp.push({ kind: 'pushed along ' + 'XYZ'[q.k], score: q.side + q.cap, note: `walls ${scNum(100 * q.side, 1)} %, ends ${scNum(100 * q.cap, 1)} %` }); const sc = sc0[0];
    if (sc.side + sc.cap >= 0.9 && sc.side >= 0.4) { const k = sc.k, [i0, j0] = [0, 1, 2].filter(q => q !== k), ts = []; for (let v = 0; v < nE; v += stride) if (Math.abs(NN[3 * v + k]) < 0.3) ts.push(PE[3 * v + k]); ts.sort((a, b) => a - b); let t0 = ts[Math.floor(ts.length * 0.005)], t1 = ts[Math.floor(ts.length * 0.995)];
      const chs = scanSections(k, (t0 + t1) / 2, 1, 1)[0].filter(c => c.len > 3).sort((a, b) => (b.closed - a.closed) || b.len - a.len), ch = chs[0];
      if (ch) { const RC = scanContour(ch); let ents = RC.ents.filter(e => e.t === 'line' || e.t === 'arc').map(e => e.t === 'line' ? { t: 'line', p0: [...e.p0], p1: [...e.p1] } : { t: 'arc', c: [...e.c], r: e.r, p0: [...e.p0], p1: [...e.p1], ccw: e.ccw });
        const span = e => { if (e.t !== 'arc') return; e.a0 = Math.atan2(e.p0[1] - e.c[1], e.p0[0] - e.c[0]); let d = Math.atan2(e.p1[1] - e.c[1], e.p1[0] - e.c[0]) - e.a0; if (!e.ccw) d = -d; while (d < 0) d += 2 * Math.PI; e.sw = d; };
        /* distance from a point of the profile plane to a line or an arc of the profile; also how far along it (0…1) */
        const dist = (e, x, y) => { if (e.t === 'line') { const vx = e.p1[0] - e.p0[0], vy = e.p1[1] - e.p0[1], L2 = vx * vx + vy * vy || 1, q = ((x - e.p0[0]) * vx + (y - e.p0[1]) * vy) / L2, qc = q < 0 ? 0 : q > 1 ? 1 : q; return [Math.hypot(x - e.p0[0] - qc * vx, y - e.p0[1] - qc * vy), q]; } let a = Math.atan2(y - e.c[1], x - e.c[0]) - e.a0; if (!e.ccw) a = -a; while (a < 0) a += 2 * Math.PI; if (a <= e.sw) return [Math.abs(Math.hypot(x - e.c[0], y - e.c[1]) - e.r), a / e.sw]; return [Math.min(Math.hypot(x - e.p0[0], y - e.p0[1]), Math.hypot(x - e.p1[0], y - e.p1[1])), a - e.sw < 2 * Math.PI - a ? 1.01 : -0.01]; };
        /* one section is noisy: a wall comes out of it in two or three pieces with a false little arc between. Pieces
           that lie on one straight line are one line; an arc that turns less than 20° is not an arc. */
        ents.forEach(span); const tidy = () => { ents = ents.filter(e => e.t === 'line' ? Math.hypot(e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]) > 0.3 : e.sw > 20 * Math.PI / 180 && e.sw < 350 * Math.PI / 180);
          for (let i = 0; ents.length > 1 && i < ents.length;) { const A = ents[i], B = ents[(i + 1) % ents.length]; if (A === B || A.t !== 'line' || B.t !== 'line' || (!RC.closed && i === ents.length - 1)) { i++; continue; } const ax = A.p1[0] - A.p0[0], ay = A.p1[1] - A.p0[1], al = Math.hypot(ax, ay) || 1, bx = B.p1[0] - B.p0[0], by = B.p1[1] - B.p0[1], bl = Math.hypot(bx, by) || 1, sn = Math.abs(ax * by - ay * bx) / (al * bl), off = q => Math.abs((q[0] - A.p0[0]) * ay - (q[1] - A.p0[1]) * ax) / al; if (sn > 0.035 || off(B.p0) > 0.12 || off(B.p1) > 0.12) { i++; continue; }
            const all = [A.p0, A.p1, B.p0, B.p1].map(q => [((q[0] - A.p0[0]) * ax + (q[1] - A.p0[1]) * ay) / al, q]).sort((x, y) => x[0] - y[0]), fwd = ((B.p0[0] + B.p1[0]) / 2 - (A.p0[0] + A.p1[0]) / 2) * ax + ((B.p0[1] + B.p1[1]) / 2 - (A.p0[1] + A.p1[1]) / 2) * ay >= 0; A.p0 = [...(fwd ? all[0][1] : all[3][1])]; A.p1 = [...(fwd ? all[3][1] : all[0][1])]; ents.splice((i + 1) % ents.length, 1); if (i >= ents.length) i = ents.length - 1; } };
        tidy(); tidy(); const closed0 = RC.closed, nearest = (x, y) => { let bi = -1, bd = Infinity, bq = 0; for (let i = 0; i < ents.length; i++) { const [d, q] = dist(ents[i], x, y); if (d < bd) { bd = d; bi = i; bq = q; } } return [bi, bd, bq]; };
        /* each line and arc anew, with the points of its whole wall */
        const S = ents.map(() => new Float64Array(9)), O2 = [lo[i0], lo[j0]], LM = ents.map(() => new Float64Array(6)); for (let v = 0; v < nE; v++) { if (Math.abs(NN[3 * v + k]) > 0.5) continue; const t = PE[3 * v + k]; if (t < t0 + 0.5 || t > t1 - 0.5) continue; const x = PE[3 * v + i0], y = PE[3 * v + j0], [bi, bd, bq] = nearest(x, y); if (bi < 0 || bd > 0.3 || bq < 0.04 || bq > 0.96) continue; const e = ents[bi], u = x - (e.t === 'arc' ? e.c[0] : e.p0[0]), w = y - (e.t === 'arc' ? e.c[1] : e.p0[1]), z = u * u + w * w, a = S[bi]; a[0]++; a[1] += u; a[2] += w; a[3] += u * u; a[4] += u * w; a[5] += w * w; a[6] += u * z; a[7] += w * z; a[8] += z; if (e.t === 'line') { const g = LM[bi], gx = x - O2[0], gy = y - O2[1]; g[0]++; g[1] += gx; g[2] += gy; g[3] += gx * gx; g[4] += gx * gy; g[5] += gy * gy; } }
        ents.forEach((e, i) => { if (e.t === 'line') e.M = LM[i]; });
        ents.forEach((e, i) => { const a = S[i], m = a[0]; e.n = m; if (m < 30) return; if (e.t === 'line') { const mx = a[1] / m, my = a[2] / m, sxx = a[3] / m - mx * mx, sxy = a[4] / m - mx * my, syy = a[5] / m - my * my, th = 0.5 * Math.atan2(2 * sxy, sxx - syy), d = [Math.cos(th), Math.sin(th)], c = [e.p0[0] + mx, e.p0[1] + my], pr = q => { const s2 = (q[0] - c[0]) * d[0] + (q[1] - c[1]) * d[1]; return [c[0] + s2 * d[0], c[1] + s2 * d[1]]; }; e.p0 = pr(e.p0); e.p1 = pr(e.p1); }
          else { /* circle by least squares: u² + w² + A u + B w + C = 0 */ const M = [[a[3], a[4], a[1]], [a[4], a[5], a[2]], [a[1], a[2], m]], r = [-a[6], -a[7], -a[8]], det3 = q => q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) - q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) + q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]), D = det3(M); if (Math.abs(D) < 1e-9) return; const sol = [0, 1, 2].map(c => det3(M.map((row, ri) => row.map((v, ci) => ci === c ? r[ri] : v))) / D), cx = -sol[0] / 2, cy = -sol[1] / 2, rr = Math.sqrt(Math.max(0, cx * cx + cy * cy - sol[2])); if (!(rr > 0.2) || Math.abs(rr - e.r) > 0.5 * e.r + 0.5) return; e.c = [e.c[0] + cx, e.c[1] + cy]; e.r = rr; for (const key of ['p0', 'p1']) { const q = e[key], l = Math.hypot(q[0] - e.c[0], q[1] - e.c[1]) || 1; e[key] = [e.c[0] + (q[0] - e.c[0]) * rr / l, e.c[1] + (q[1] - e.c[1]) * rr / l]; } } });

        /* ── the fewest elements that explain the walls (Occam) ──
           One section gives the order of the elements but breaks a wall into pieces and puts little false arcs between.
           Two lines are one line if one straight line through the points of both walls fits as well as the noise of the
           scan allows (0.07 mm) — whether they are neighbours or have something small between them, which then goes.
           A rounding under 1 mm is how a scanner sees a sharp corner: it becomes a corner, and its radius is only noted. */
        const lenL = e => Math.hypot(e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]), smallE = e => e.t === 'line' ? lenL(e) < 1.5 : (e.r < 1.0 || e.r * e.sw < 1.5), fitL = M => { const m = M[0], mx = M[1] / m, my = M[2] / m, sxx = M[3] / m - mx * mx, sxy = M[4] / m - mx * my, syy = M[5] / m - my * my, th = 0.5 * Math.atan2(2 * sxy, sxx - syy); return { c: [O2[0] + mx, O2[1] + my], d: [Math.cos(th), Math.sin(th)], rms: Math.sqrt(Math.max(0, (sxx + syy) / 2 - Math.hypot((sxx - syy) / 2, sxy))) }; };
        const before = ents.length; let joinedL = 0; for (let again = true; again && ents.length > 3;) { again = false; for (let i = 0; i < ents.length && !again; i++) { const A = ents[i]; if (A.t !== 'line' || !A.M || A.M[0] < 30) continue; for (const skip of [1, 2]) { if (!closed0 && i + skip >= ents.length) continue; const B = ents[(i + skip) % ents.length], mid = ents[(i + 1) % ents.length]; if (B === A || B.t !== 'line' || !B.M || B.M[0] < 30 || (skip === 2 && (mid === B || !smallE(mid)))) continue; const M = A.M.map((v, q) => v + B.M[q]), f = fitL(M); if (f.rms > 0.07) continue;
              const mA = [(A.p0[0] + A.p1[0]) / 2, (A.p0[1] + A.p1[1]) / 2], mB = [(B.p0[0] + B.p1[0]) / 2, (B.p0[1] + B.p1[1]) / 2], far = (e, m) => Math.hypot(e.p0[0] - m[0], e.p0[1] - m[1]) > Math.hypot(e.p1[0] - m[0], e.p1[1] - m[1]) ? e.p0 : e.p1, pr = q => { const t = (q[0] - f.c[0]) * f.d[0] + (q[1] - f.c[1]) * f.d[1]; return [f.c[0] + t * f.d[0], f.c[1] + t * f.d[1]]; }, a0 = pr(far(A, mB)), b1 = pr(far(B, mA)); A.p0 = a0; A.p1 = b1; A.M = M; A.pieces = (A.pieces || 1) + (B.pieces || 1); const rm = skip === 2 ? [mid, B] : [B]; ents = ents.filter(e => !rm.includes(e)); joinedL++; again = true; break; } } }
        const soft = ents.filter(e => e.t === 'arc' && e.r < 1.0).map(e => e.r); ents = ents.filter(e => !(e.t === 'arc' && e.r < 1.0)); ents = ents.filter(e => e.t !== 'line' || lenL(e) > 0.3);
        /* the corners: two lines meet where they cross; a line and an arc meet where the arc touches the line */
        const nEn = ents.length, closed = RC.closed; for (let i = 0; i < (closed ? nEn : nEn - 1); i++) { const A = ents[i], B = ents[(i + 1) % nEn]; if (A === B) continue; let ka = 'p1', kb = 'p0', bd = Infinity; for (const x of ['p0', 'p1']) for (const y of ['p0', 'p1']) { const d = Math.hypot(A[x][0] - B[y][0], A[x][1] - B[y][1]); if (d < bd) { bd = d; ka = x; kb = y; } } if (bd > 6) continue;
          if (A.t === 'line' && B.t === 'line') { const ax = A.p1[0] - A.p0[0], ay = A.p1[1] - A.p0[1], bx = B.p1[0] - B.p0[0], by = B.p1[1] - B.p0[1], cr = ax * by - ay * bx; if (Math.abs(cr) < 1e-6 * Math.hypot(ax, ay) * Math.hypot(bx, by) + 1e-12) continue; const q = ((B.p0[0] - A.p0[0]) * by - (B.p0[1] - A.p0[1]) * bx) / cr, X = [A.p0[0] + q * ax, A.p0[1] + q * ay]; if (Math.hypot(X[0] - A[ka][0], X[1] - A[ka][1]) < 6) { A[ka] = X; B[kb] = [...X]; } }
          else if (A.t !== B.t) { const Ln = A.t === 'line' ? A : B, Ar = A.t === 'arc' ? A : B, kl = A.t === 'line' ? ka : kb, kr = A.t === 'arc' ? ka : kb, vx = Ln.p1[0] - Ln.p0[0], vy = Ln.p1[1] - Ln.p0[1], L2 = vx * vx + vy * vy || 1, q = ((Ar.c[0] - Ln.p0[0]) * vx + (Ar.c[1] - Ln.p0[1]) * vy) / L2, F = [Ln.p0[0] + q * vx, Ln.p0[1] + q * vy], dl = Math.hypot(F[0] - Ar.c[0], F[1] - Ar.c[1]); if (Math.abs(dl - Ar.r) < 0.15 * Ar.r + 0.1 && Math.hypot(F[0] - Ln[kl][0], F[1] - Ln[kl][1]) < 3) { Ln[kl] = F; const keepL = Ln[kl], keepA = Ar[kr], sw0 = Ar.sw; Ln[kl] = F; Ar[kr] = [Ar.c[0] + (F[0] - Ar.c[0]) * Ar.r / dl, Ar.c[1] + (F[1] - Ar.c[1]) * Ar.r / dl]; span(Ar); if (Math.abs(Ar.sw - sw0) > 0.6) { Ln[kl] = keepL; Ar[kr] = keepA; span(Ar); } else Ar.tangent = (Ar.tangent || 0) + 1; } } }
        /* what still does not meet is linked by a short straight piece — a guess, marked as one */
        let links = 0; for (let i = 0; i < (closed ? ents.length : ents.length - 1); i++) { const A = ents[i], B = ents[(i + 1) % ents.length]; if (A === B) continue; let ka = 'p1', kb = 'p0', bd = Infinity; for (const x of ['p0', 'p1']) for (const y of ['p0', 'p1']) { const d = Math.hypot(A[x][0] - B[y][0], A[x][1] - B[y][1]); if (d < bd) { bd = d; ka = x; kb = y; } } if (bd > 0.05 && bd < 8) { ents.splice(i + 1, 0, { t: 'line', p0: [...A[ka]], p1: [...B[kb]], guess: true }); links++; i++; } }
        ents.forEach(span);
        /* the ends: is there a flat face of the scan on them? */
        const caps = [t0, t1].map(te => { const pl = planes.filter(p => Math.abs(p.n[k]) > 0.9986 && Math.abs(p.d / p.n[k] - te) < 0.6 && p.on > 0.002 * nE).sort((a, b) => b.on - a.on)[0]; return pl ? { found: true, level: pl.d / pl.n[k], rms: pl.rms, on: pl.on } : { found: false, level: te }; }); t0 = caps[0].level; t1 = caps[1].level;
        /* every point of the scan against the body */
        let inSide = 0, inCap = 0; const dv = [], es = ents.map(() => [0, 0]); for (let v = 0; v < nE; v++) { const t = PE[3 * v + k], x = PE[3 * v + i0], y = PE[3 * v + j0], [bi, bd] = nearest(x, y); if (bd < 0.15 && t > t0 - 0.3 && t < t1 + 0.3 && Math.abs(NN[3 * v + k]) < 0.5) { inSide++; es[bi][0]++; es[bi][1] += bd * bd; if (v % 16 === 0) dv.push(bd); } else if ((caps[0].found && Math.abs(t - t0) < 0.15) || (caps[1].found && Math.abs(t - t1) < 0.15)) inCap++; } dv.sort((a, b) => a - b); ents.forEach((e, i) => { e.on = es[i][0]; e.rms = es[i][0] ? Math.sqrt(es[i][1] / es[i][0]) : 0; });
        /* the body, to be looked at */
        const xp = [], xn = [], xc = [], poly = [], P3 = (pt, t) => { const q = [0, 0, 0]; q[k] = t; q[i0] = pt[0]; q[j0] = pt[1]; return q; }; for (const e of ents) { const pts = e.t === 'line' ? [e.p0, e.p1] : scArcPts(e, Math.max(8, Math.min(48, Math.round(8 * e.sw * Math.sqrt(e.r))))), cc = e.guess ? [0.94, 0.54, 0] : e.t === 'line' ? [0.72, 0.78, 0.86] : [0.42, 0.6, 0.92]; for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy) || 1, nn = [0, 0, 0]; nn[i0] = dy / l; nn[j0] = -dx / l; const q = [P3(pts[i - 1], t0), P3(pts[i], t0), P3(pts[i], t1), P3(pts[i - 1], t1)]; xp.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); for (let r = 0; r < 6; r++) { xn.push(...nn); xc.push(...cc); } } poly.push(...(poly.length && Math.hypot(poly[poly.length - 1][0] - pts[0][0], poly[poly.length - 1][1] - pts[0][1]) > Math.hypot(poly[poly.length - 1][0] - pts[pts.length - 1][0], poly[poly.length - 1][1] - pts[pts.length - 1][1]) ? [...pts].reverse() : pts)); }
        const capPos = [[], []], outline = []; if (closed && poly.length > 2) { const tri = THREE.ShapeUtils.triangulateShape(poly.map(q => new THREE.Vector2(q[0], q[1])), []); [t0, t1].forEach((te, ci) => { for (const f of tri) for (const vi of f) capPos[ci].push(...P3(poly[vi], te)); for (let i = 0; i < poly.length; i++) outline.push(...P3(poly[i], te), ...P3(poly[(i + 1) % poly.length], te)); }); }
        const corners = []; for (const e of ents) if (e.t === 'line') for (const q of [e.p0, e.p1]) corners.push(...P3(q, t0), ...P3(q, t1));
        let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - a[1] * b[0]; }
        extr = { k, t0, t1, score: sc, closed, before, joinedL, soft, links, ents, caps, explained: (inSide + inCap) / nE, inSide, inCap, dev: dv.length ? dv[dv.length >> 1] : 0, dev95: dv.length ? dv[Math.floor(dv.length * 0.95)] : 0, section: RC.explained, area: Math.abs(area) / 2, pos: new Float32Array(xp), nor: new Float32Array(xn), col: new Float32Array(xc), capPos: capPos.map(a => new Float32Array(a)), outline: new Float32Array([...outline, ...corners]) }; } } }
  /* ── a mirror ──
     Another symmetry, tried beside the first and not instead of it: is one half of the part the mirror of the other?
     The scan is put into small boxes; a sample of its points is reflected in a plane square to X, to Y, to Z, and it is
     counted how many of them land where the scan has surface. The place of the mirror is searched near the middle. */
  scSay('is it mirrored? …'); await scTick();
  { const vs = Math.max(0.6, step), dm = [0, 1, 2].map(i => Math.ceil((hi[i] - lo[i]) / vs) + 3); if (dm[0] * dm[1] * dm[2] < 1.5e8) { const vox = new Uint8Array(dm[0] * dm[1] * dm[2]), sx = dm[0], sxy = dm[0] * dm[1]; for (let v = 0; v < nE; v++) vox[1 + Math.floor((PE[3 * v] - lo[0]) / vs) + sx * (1 + Math.floor((PE[3 * v + 1] - lo[1]) / vs)) + sxy * (1 + Math.floor((PE[3 * v + 2] - lo[2]) / vs))] = 1;
      const st = Math.max(1, Math.floor(nE / 30000)), q = [0, 0, 0], test = (k, c) => { let m = 0, t = 0; for (let v = 0; v < nE; v += st) { q[0] = PE[3 * v]; q[1] = PE[3 * v + 1]; q[2] = PE[3 * v + 2]; q[k] = 2 * c - q[k]; t++; const x = 1 + Math.floor((q[0] - lo[0]) / vs), y = 1 + Math.floor((q[1] - lo[1]) / vs), z = 1 + Math.floor((q[2] - lo[2]) / vs); if (x < 1 || y < 1 || z < 1 || x >= dm[0] - 1 || y >= dm[1] - 1 || z >= dm[2] - 1) continue; const id = x + sx * y + sxy * z; if (vox[id] || vox[id - 1] || vox[id + 1] || vox[id - sx] || vox[id + sx] || vox[id - sxy] || vox[id + sxy]) m++; } return m / t; };
      for (let k = 0; k < 3; k++) { const c0 = (lo[k] + hi[k]) / 2; let bc = c0, bm = 0; for (let c = c0 - 4; c <= c0 + 4.01; c += 0.5) { const m = test(k, c); if (m > bm) { bm = m; bc = c; } } for (let c = bc - 0.4; c <= bc + 0.41; c += 0.1) { const m = test(k, c); if (m > bm) { bm = m; bc = c; } } hyp.push({ kind: 'mirror square to ' + 'XYZ'[k], score: bm, note: `at ${'XYZ'[k]} = ${scNum(bc, 2)}` }); } } }
  if (extr) { SCAN.view.faces = false; SCAN.view.extr = true; }
  SCAN.rec = { extr, hyp, bentJoined, planes, edges, col, step, recon, cyls, classes, singles, twins, faces: { pos: new Float32Array(fp), nor: new Float32Array(fn), col: new Float32Array(fc), guess: new Float32Array(guess), closed: facesClosed, ok: facesOk }, sections: nSec, lines: lines.length, arcs: nArcs, lenAll, lenLines, lenIn, explained: planes.reduce((s, p) => s + p.on, 0) / n, check: { corners: devAll.length, median: devAll.length ? devAll[devAll.length >> 1] : 0, p95: devAll.length ? devAll[Math.floor(devAll.length * 0.95)] : 0 }, ms: performance.now() - t0 }; SCAN.tool = 'recognise'; SCAN.view.off = {};
  scanDraw(); scPanel(); scSay(''); fitView(new THREE.Box3().setFromObject(SCAN.group), 1.0);
}

/* ── 3. signature: points at each level along each axis; the peaks are the planes across that axis ── */
function scanSignature() {
  const { P, n } = SCAN, BIN = 0.02, sig = [];
  for (let k = 0; k < 3; k++) { let lo = Infinity, hi = -Infinity; for (let i = k; i < 3 * n; i += 3) { if (P[i] < lo) lo = P[i]; if (P[i] > hi) hi = P[i]; } const nb = Math.ceil((hi - lo) / BIN) + 1, h = new Uint32Array(nb); for (let i = k; i < 3 * n; i += 3) h[(P[i] - lo) / BIN | 0]++;
    const sorted = Array.from(h).sort((a, b) => a - b), base = sorted[nb >> 1] + 1, peaks = [];
    for (let i = 0; i < nb; i++) { if (h[i] < 25 * base) continue; let top = true; for (let j = Math.max(0, i - 25); j <= Math.min(nb - 1, i + 25); j++) if (h[j] > h[i] || (h[j] === h[i] && j < i)) { top = false; break; } if (!top) continue;
      let s = 0, w = 0, s2 = 0; for (let j = Math.max(0, i - 6); j <= Math.min(nb - 1, i + 6); j++) { const x = lo + (j + 0.5) * BIN; s += x * h[j]; w += h[j]; } const m = s / w; for (let j = Math.max(0, i - 6); j <= Math.min(nb - 1, i + 6); j++) { const x = lo + (j + 0.5) * BIN; s2 += (x - m) ** 2 * h[j]; } peaks.push({ level: m, width: Math.sqrt(s2 / w), points: w, top: h[i] }); }
    sig.push({ lo, hi, h, base, peaks, bin: BIN }); }
  SCAN.sig = sig; SCAN.tool = 'signature'; return sig;
}
function scDrawSignature(cv, s, k) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, css = getComputedStyle(document.body), ink = css.getPropertyValue('--text') || '#222', mut = css.getPropertyValue('--muted') || '#888'; g.clearRect(0, 0, W, H);
  const cols = new Float64Array(W); for (let i = 0; i < s.h.length; i++) { const x = Math.min(W - 1, i / s.h.length * W | 0); if (s.h[i] > cols[x]) cols[x] = s.h[i]; }
  let mx = 1; for (const v of cols) if (v > mx) mx = v; const lm = Math.log10(mx * 1.6), y = v => H - 14 - (v > 1 ? Math.log10(v) / lm : 0) * (H - 30);
  g.fillStyle = ['#ff5151', '#38c26c', '#4c97ff'][k]; g.globalAlpha = 0.75; for (let x = 0; x < W; x++) g.fillRect(x, y(cols[x]), 1, H - 14 - y(cols[x])); g.globalAlpha = 1;
  g.font = '10px sans-serif'; g.fillStyle = mut; g.textAlign = 'left'; g.fillText(scNum(s.lo, 1), 2, H - 3); g.textAlign = 'right'; g.fillText(scNum(s.hi, 1) + ' mm', W - 2, H - 3); g.textAlign = 'left'; g.fillText('XYZ'[k], 3, 10);
  g.fillStyle = ink; g.textAlign = 'center'; for (const p of s.peaks) { const x = (p.level - s.lo) / (s.hi - s.lo) * W; g.fillText(scNum(p.level, 2), Math.max(16, Math.min(W - 16, x)), Math.max(9, y(p.top) - 3)); }
  if (SCAN.cut[k].on && SCAN.tool === 'sections') { const x = (SCAN.cut[k].level - s.lo) / (s.hi - s.lo) * W; g.strokeStyle = ink; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, 12); g.lineTo(x, H - 14); g.stroke(); g.setLineDash([]); }
}

/* ── 4. sections ──
   Three cutting planes, one across each axis of the part, each with its own switch and slider. A plane that is on
   cuts the mesh exactly (every triangle it passes through gives one short piece; the pieces are chained into
   outlines), and the outline is then recognised by an algorithm:

     · the outline is walked in equal steps, and at every step its direction θ is taken (from a chord of 1 mm);
     · along a straight piece θ does not change; along an arc it changes evenly, by 1/R per millimetre; at a corner
       it jumps. So θ against the distance walked is a broken line, and the outline is cut where that line breaks;
     · every piece is then fitted for what it is — a line or a circle — through its own points, leaving out its two
       ends (3 % of its length, half a millimetre at least: the scanner rounds corners, and noise is strongest there);
     · neighbours that turn out to be one line or one circle are joined; where two pieces meet, the end is the
       intersection of the two fitted shapes, not a scanned point.

   A whole closed outline that one circle fits is a hole or a boss. What no line and no circle fits within the
   tolerance stays unexplained, and the share of the outline that was explained is reported. */
function scanSections(k, base, step, count) {     // the mesh cut at base, base + step, …: one walk over the triangles for all the levels
  const { P, F, nf, n } = SCAN, [i0, j0] = [0, 1, 2].filter(q => q !== k), LV = Array.from({ length: count }, () => ({ pts: [], at: new Map(), sa: [], sb: [] }));
  for (let f = 0; f < nf; f++) { const a = F[3 * f], b = F[3 * f + 1], c = F[3 * f + 2], za = P[3 * a + k], zb = P[3 * b + k], zc = P[3 * c + k], mn = Math.min(za, zb, zc), mx = Math.max(za, zb, zc); let l1 = Math.ceil((mn - base) / step), l2 = Math.floor((mx - base) / step); if (l1 < 0) l1 = 0; if (l2 >= count) l2 = count - 1;
    for (let li = l1; li <= l2; li++) { const L = base + li * step, S = LV[li], da = za >= L, db = zb >= L, dc = zc >= L; if (da === db && db === dc) continue;
      const cut = (a, b) => { const key = a < b ? a * n + b : b * n + a; let i = S.at.get(key); if (i === undefined) { let ea = P[3 * a + k] - L, eb = P[3 * b + k] - L; if (ea === 0) ea = 1e-9; if (eb === 0) eb = 1e-9; const t = ea / (ea - eb); i = S.pts.length / 2; S.pts.push(P[3 * a + i0] + (P[3 * b + i0] - P[3 * a + i0]) * t, P[3 * a + j0] + (P[3 * b + j0] - P[3 * a + j0]) * t); S.at.set(key, i); } return i; };
      const e = []; if (da !== db) e.push(cut(a, b)); if (db !== dc) e.push(cut(b, c)); if (dc !== da) e.push(cut(c, a)); if (e.length === 2 && e[0] !== e[1]) { S.sa.push(e[0]); S.sb.push(e[1]); } } }
  return LV.map(({ pts, sa, sb }) => { const m = pts.length / 2, n1 = new Int32Array(m).fill(-1), n2 = new Int32Array(m).fill(-1), link = (x, y) => { if (n1[x] < 0) n1[x] = y; else if (n2[x] < 0 && n1[x] !== y) n2[x] = y; };
    for (let i = 0; i < sa.length; i++) { link(sa[i], sb[i]); link(sb[i], sa[i]); }
    const seen = new Uint8Array(m), chains = [], walk = (s0, closed) => { const out = [s0]; seen[s0] = 1; let prev = -1, cur = s0; for (;;) { const nx = n1[cur] !== prev && n1[cur] >= 0 && !seen[n1[cur]] ? n1[cur] : n2[cur] >= 0 && n2[cur] !== prev && !seen[n2[cur]] ? n2[cur] : -1; if (nx < 0) break; seen[nx] = 1; out.push(nx); prev = cur; cur = nx; }
      let len = 0; const q = out.map(i => [pts[2 * i], pts[2 * i + 1]]); for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); if (len > 2) chains.push({ pts: q, closed: closed && (n1[cur] === s0 || n2[cur] === s0) && q.length > 3, len }); };
    for (let i = 0; i < m; i++) if (!seen[i] && n1[i] >= 0 && n2[i] < 0) walk(i, false);       // open outlines first, from their ends (the scan has holes)
    for (let i = 0; i < m; i++) if (!seen[i] && n1[i] >= 0) walk(i, true);
    return chains.sort((a, b) => b.len - a.len); });
}
const scanSection = (k, L) => scanSections(k, L, 1, 1)[0];
const scLine = (q, a, b) => { let su = 0, sv = 0; const n = b - a; for (let i = a; i < b; i++) { su += q[i][0]; sv += q[i][1]; } su /= n; sv /= n; let xx = 0, xy = 0, yy = 0; for (let i = a; i < b; i++) { const u = q[i][0] - su, v = q[i][1] - sv; xx += u * u; xy += u * v; yy += v * v; }
  const th = 0.5 * Math.atan2(2 * xy, xx - yy), d = [Math.cos(th), Math.sin(th)], sg = Math.sign((q[b - 1][0] - q[a][0]) * d[0] + (q[b - 1][1] - q[a][1]) * d[1]) || 1; d[0] *= sg; d[1] *= sg; let s2 = 0, mx = 0; for (let i = a; i < b; i++) { const e = Math.abs(-(q[i][0] - su) * d[1] + (q[i][1] - sv) * d[0]); s2 += e * e; if (e > mx) mx = e; } return { c: [su, sv], u: d, rms: Math.sqrt(s2 / n), max: mx }; };
const scCircle = (q, a, b) => { let su = 0, sv = 0; const n = b - a; for (let i = a; i < b; i++) { su += q[i][0]; sv += q[i][1]; } su /= n; sv /= n; let xx = 0, xy = 0, yy = 0, xz = 0, yz = 0, zz = 0; for (let i = a; i < b; i++) { const u = q[i][0] - su, v = q[i][1] - sv, z = u * u + v * v; xx += u * u; xy += u * v; yy += v * v; xz += u * z; yz += v * z; zz += z; }
  const det = xx * yy - xy * xy; if (Math.abs(det) < 1e-12) return null; const cx = (xz * yy - yz * xy) / (2 * det), cy = (yz * xx - xz * xy) / (2 * det), r = Math.sqrt(cx * cx + cy * cy + zz / n); let s2 = 0, mx = 0; for (let i = a; i < b; i++) { const e = Math.abs(Math.hypot(q[i][0] - su - cx, q[i][1] - sv - cy) - r); s2 += e * e; if (e > mx) mx = e; } return { c: [su + cx, sv + cy], r, rms: Math.sqrt(s2 / n), max: mx }; };
function scanContour(ch) {
  const DS = 0.1, W = 5, FINE = 0.05, ROUGH = 0.14, src = ch.closed ? [...ch.pts, ch.pts[0]] : ch.pts, cum = [0]; for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const total = cum[cum.length - 1], n0 = Math.max(8, Math.round(total / DS)); let q = [], j = 0; for (let i = 0; i < n0; i++) { const s = total * i / (ch.closed ? n0 : n0 - 1); while (j < cum.length - 2 && cum[j + 1] < s) j++; const t = (s - cum[j]) / Math.max(cum[j + 1] - cum[j], 1e-12); q.push([src[j][0] + (src[j + 1][0] - src[j][0]) * t, src[j][1] + (src[j + 1][1] - src[j][1]) * t]); }
  const ds = total / (ch.closed ? n0 : n0 - 1), out = { ents: [], scan: q, closed: ch.closed, length: total, explained: 0 };
  if (ch.closed) { const c = scCircle(q, 0, q.length); if (c && c.rms < FINE && c.r < 80) { out.ents.push({ t: 'circle', c: c.c, r: c.r, rms: c.rms, len: total }); out.explained = total; return out; } }
  let n = q.length; const dir = (i, cl) => { const a = cl ? q[(i - W + n) % n] : q[Math.max(0, i - W)], b = cl ? q[(i + W) % n] : q[Math.min(n - 1, i + W)]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  if (ch.closed) { let best = 0, bv = -1; for (let i = 0; i < n; i++) { let d = Math.abs(dir((i + W) % n, true) - dir((i - W + n) % n, true)); if (d > Math.PI) d = 2 * Math.PI - d; if (d > bv) { bv = d; best = i; } } q = [...q.slice(best), ...q.slice(0, best), q[best]]; n = q.length; out.scan = q; }       // a closed outline is opened at its sharpest corner
  const th = new Float64Array(n); for (let i = 0; i < n; i++) { let t = dir(i, false); if (i) { while (t - th[i - 1] > Math.PI) t -= 2 * Math.PI; while (t - th[i - 1] < -Math.PI) t += 2 * Math.PI; } th[i] = t; }
  /* θ against the distance is cut into straight pieces */
  const pieces = [], split = (a, b) => { const m = b - a; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let i = a; i < b; i++) { sx += i; sy += th[i]; sxx += i * i; sxy += i * th[i]; } const den = m * sxx - sx * sx, k = den ? (m * sxy - sx * sy) / den : 0, c0 = (sy - k * sx) / m; let mx = 0, at = -1; for (let i = a; i < b; i++) { const e = Math.abs(th[i] - c0 - k * i); if (e > mx) { mx = e; at = i; } }
    if (mx > 0.05 && m >= 12) { const cutAt = Math.min(b - 5, Math.max(a + 5, at)); split(a, cutAt); split(cutAt, b); } else pieces.push({ a, b, k: k / ds }); };
  split(0, n);
  const fit = (a, b) => { const m = b - a, trim = m >= 4 * W ? Math.max(W, Math.round(0.03 * m)) : Math.max(1, m >> 3), x = a + trim, y = b - trim; if (y - x < 5) return null; const L = scLine(q, x, y), C = scCircle(q, x, y);
    if (L.max < FINE || (C && C.r > 250 && L.rms < FINE)) return { t: 'line', ...L, a, b, tol: 'fine' }; if (C && C.rms < FINE && C.r < 250) return { t: 'arc', ...C, a, b, tol: 'fine' };
    if (L.rms < ROUGH && (!C || C.r > 60 || L.rms < C.rms * 1.3)) return { t: 'line', ...L, a, b, tol: 'rough' }; if (C && C.rms < ROUGH && C.r < 250) return { t: 'arc', ...C, a, b, tol: 'rough' }; return null; };
  let prim = []; for (const p of pieces) { const len = (p.b - p.a) * ds, turn = Math.abs(th[p.b - 1] - th[p.a]); if (len <= 2.6 * W * ds && turn > 0.25) continue; const f = fit(p.a, p.b); if (f) prim.push(f); }      // a short piece with a big turn is a corner seen through the chord: no shape of its own
  /* every shape is stretched along the outline as far as the points stay on it (the first cut seldom falls exactly
     where a line ends), and what is left between two shapes is tried as an arc or a line of its own: a rounding
     between two straight sides is found this way, between the two tangent points */
  const dev = (p, i) => p.t === 'line' ? Math.abs(-(q[i][0] - p.c[0]) * p.u[1] + (q[i][1] - p.c[1]) * p.u[0]) : Math.abs(Math.hypot(q[i][0] - p.c[0], q[i][1] - p.c[1]) - p.r);
  const grow = () => { prim.sort((x, y) => x.a - y.a); for (const i of prim.map((p, k) => k).sort((x, y) => (prim[y].b - prim[y].a) - (prim[x].b - prim[x].a))) { const p = prim[i], tol = p.tol === 'fine' ? FINE : ROUGH, lo = i ? prim[i - 1].b : 0, hi = i + 1 < prim.length ? prim[i + 1].a : n; let a = p.a, b = p.b, miss = 0;
      while (b < hi) { if (dev(p, b) < tol) miss = 0; else if (++miss > 2) break; b++; } b -= miss; miss = 0; while (a > lo) { if (dev(p, a - 1) < tol) miss = 0; else if (++miss > 2) break; a--; } a += miss;
      if (b - a > (p.b - p.a) * 1.15) { const f = fit(a, b); if (f && f.t === p.t) { Object.assign(p, f); continue; } } p.a = a; p.b = b; } };
  const gapFit = (a, b, deep) => { const m = b - a; if (m < 6) return []; const x = a + 1, y = b - 1, L = scLine(q, x, y), C = scCircle(q, x, y), len = m * ds, turn = C ? len / C.r : 0;
    for (const [tol, name] of [[FINE, 'fine'], [ROUGH, 'rough']]) { if (C && C.rms < tol * 0.8 && C.max < 2.5 * tol && C.r < 250 && turn > 0.2 && (L.rms > 1.5 * C.rms || L.max > tol)) return [{ t: 'arc', ...C, a, b, tol: name }]; if (L.max < tol * 1.6 && L.rms < tol * 0.8 && len >= 1.5) return [{ t: 'line', ...L, a, b, tol: name }]; }
    if (deep && m >= 16) { let mx = -1, at = (a + b) >> 1; const ch = scLine(q, a, b); for (let i = a + 4; i < b - 4; i++) { const e = Math.abs(-(q[i][0] - q[a][0]) * (q[b - 1][1] - q[a][1]) + (q[i][1] - q[a][1]) * (q[b - 1][0] - q[a][0])); if (e > mx) { mx = e; at = i; } } return [...gapFit(a, at, deep - 1), ...gapFit(at, b, deep - 1)]; } return []; };
  for (let round = 0; round < 2; round++) { grow(); const add = []; let last = 0; for (const p of [...prim, { a: n, b: n }]) { if (p.a - last >= 6) add.push(...gapFit(last, p.a, 2)); last = p.b; } if (!add.length) break; prim.push(...add); }
  grow(); prim.sort((x, y) => x.a - y.a); prim = prim.filter(p => (p.b - p.a) * ds >= (p.t === 'line' ? 1.5 : 0.8));
  for (let again = true; again;) { again = false;                                 // neighbours that are one line or one circle
    for (let i = 0; i + 1 < prim.length; i++) { const A = prim[i], B = prim[i + 1]; if (A.t !== B.t || (B.a - A.b) * ds > 3) continue; let same;
      if (A.t === 'line') same = A.u[0] * B.u[0] + A.u[1] * B.u[1] > Math.cos(1.2 * Math.PI / 180) && Math.abs(-(B.c[0] - A.c[0]) * A.u[1] + (B.c[1] - A.c[1]) * A.u[0]) < 0.08; else same = Math.abs(A.r - B.r) < 0.08 * Math.max(A.r, B.r) + 0.05 && Math.hypot(A.c[0] - B.c[0], A.c[1] - B.c[1]) < 0.08 * A.r + 0.1;
      if (!same) continue; const J = fit(A.a, B.b); if (J && J.t === A.t) { prim.splice(i, 2, J); again = true; break; } } }
  prim = prim.filter(p => p.t === 'line' || (p.b - p.a) * ds / p.r > 0.2);          // an arc must turn by at least 11° to be told from a line
  for (const p of prim) if (p.t === 'arc') { const m = (p.a + p.b) >> 1, v0 = [q[p.a][0] - p.c[0], q[p.a][1] - p.c[1]], v1 = [q[m][0] - p.c[0], q[m][1] - p.c[1]]; p.ccw = v0[0] * v1[1] - v0[1] * v1[0] > 0; }
  /* ends: where neighbours meet */
  const meet = (A, B, near) => { if (A.t === 'line' && B.t === 'line') { const det = -A.u[0] * B.u[1] + A.u[1] * B.u[0]; if (Math.abs(det) < 0.05) return null; const dx = B.c[0] - A.c[0], dy = B.c[1] - A.c[1], t = (-dx * B.u[1] + dy * B.u[0]) / det; return [A.c[0] + t * A.u[0], A.c[1] + t * A.u[1]]; }
    if (A.t === 'arc' && B.t === 'arc') { const dx = B.c[0] - A.c[0], dy = B.c[1] - A.c[1], d = Math.hypot(dx, dy); if (d < 1e-6) return null; const x = (d * d + A.r * A.r - B.r * B.r) / (2 * d), h2 = A.r * A.r - x * x, bx = A.c[0] + dx / d * x, by = A.c[1] + dy / d * x; if (h2 <= 0) return [bx, by]; const h = Math.sqrt(h2), c1 = [bx - dy / d * h, by + dx / d * h], c2 = [bx + dy / d * h, by - dx / d * h]; return Math.hypot(c1[0] - near[0], c1[1] - near[1]) < Math.hypot(c2[0] - near[0], c2[1] - near[1]) ? c1 : c2; }
    const L = A.t === 'line' ? A : B, C = A.t === 'line' ? B : A, dist = -(C.c[0] - L.c[0]) * L.u[1] + (C.c[1] - L.c[1]) * L.u[0], foot = [C.c[0] + dist * L.u[1], C.c[1] - dist * L.u[0]], h2 = C.r * C.r - dist * dist; if (h2 <= 1e-9) return foot; const h = Math.sqrt(h2), c1 = [foot[0] + h * L.u[0], foot[1] + h * L.u[1]], c2 = [foot[0] - h * L.u[0], foot[1] - h * L.u[1]]; return Math.hypot(c1[0] - near[0], c1[1] - near[1]) < Math.hypot(c2[0] - near[0], c2[1] - near[1]) ? c1 : c2; };
  const onto = (p, pt) => { if (p.t === 'line') { const t = (pt[0] - p.c[0]) * p.u[0] + (pt[1] - p.c[1]) * p.u[1]; return [p.c[0] + t * p.u[0], p.c[1] + t * p.u[1]]; } const d = Math.hypot(pt[0] - p.c[0], pt[1] - p.c[1]) || 1; return [p.c[0] + (pt[0] - p.c[0]) / d * p.r, p.c[1] + (pt[1] - p.c[1]) / d * p.r]; };
  const m = prim.length; for (let i = 0; i < m; i++) { const A = prim[i], last = i === m - 1; if (last && !ch.closed) { A.p1 = onto(A, q[A.b - 1]); break; } const B = prim[(i + 1) % m], e = q[A.b - 1], s0 = q[B.a], gap = last ? (n - A.b + B.a) * ds : (B.a - A.b) * ds, mid = [(e[0] + s0[0]) / 2, (e[1] + s0[1]) / 2]; let x = m > 1 && gap < 3 ? meet(A, B, mid) : null;
    if (x && Math.hypot(x[0] - mid[0], x[1] - mid[1]) > Math.max(2, 1.5 * gap)) x = null; if (x) { A.p1 = x; B.p0 = x; } else { A.p1 = onto(A, e); B.p0 = onto(B, s0); } }
  for (const p of prim) { if (!p.p0) p.p0 = onto(p, q[p.a]); if (!p.p1) p.p1 = onto(p, q[p.b - 1]); p.len = (p.b - p.a) * ds; if (p.t === 'arc' && p.len / p.r > 3.5) p.t = 'circle'; /* an arc seen more than 200° round is a hole or a boss, though the scan did not reach all of its wall */ out.explained += p.len; out.ents.push(p); }
  return out;
}
function scanCut(k) {                             // cut, chain, recognise: everything for plane k
  const c = SCAN.cut[k]; if (!c.on) { SCAN.sec[k] = null; return; } const t0 = performance.now(), chains = scanSection(k, c.level), parts = chains.map(scanContour), ents = parts.flatMap(p => p.ents);
  const length = parts.reduce((s, p) => s + p.length, 0), explained = parts.reduce((s, p) => s + p.explained, 0);
  SCAN.sec[k] = { parts, ents, length, explained, lines: ents.filter(e => e.t === 'line').length, arcs: ents.filter(e => e.t === 'arc').length, circles: ents.filter(e => e.t === 'circle').length, ms: performance.now() - t0 };
}
const scArcPts = (e, m = 24) => { if (e.t === 'circle') return Array.from({ length: 49 }, (_, i) => [e.c[0] + e.r * Math.cos(i * Math.PI / 24), e.c[1] + e.r * Math.sin(i * Math.PI / 24)]); let a0 = Math.atan2(e.p0[1] - e.c[1], e.p0[0] - e.c[0]), a1 = Math.atan2(e.p1[1] - e.c[1], e.p1[0] - e.c[0]); if (e.ccw) { if (a1 < a0) a1 += 2 * Math.PI; } else if (a1 > a0) a1 -= 2 * Math.PI; return Array.from({ length: m + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / m; return [e.c[0] + e.r * Math.cos(a), e.c[1] + e.r * Math.sin(a)]; }); };
function scCutScene() {                           // the planes that are on, and their recognised outlines, in the scene
  if (SCAN.cutGroup) { SCAN.group.remove(SCAN.cutGroup); clearGroup(SCAN.cutGroup); } SCAN.cutGroup = new THREE.Group(); SCAN.group.add(SCAN.cutGroup); if (SCAN.tool !== 'sections' || !SCAN.mesh) return;
  const g = SCAN.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); const lo = g.boundingBox.min.toArray(), hi = g.boundingBox.max.toArray(), mg = 4;
  for (let k = 0; k < 3; k++) { const c = SCAN.cut[k]; if (!c.on) continue; const [i, j] = [0, 1, 2].filter(q => q !== k), to3 = (u, v) => { const p = [0, 0, 0]; p[k] = c.level; p[i] = u; p[j] = v; return p; };
    const cs = [[lo[i] - mg, lo[j] - mg], [hi[i] + mg, lo[j] - mg], [hi[i] + mg, hi[j] + mg], [lo[i] - mg, hi[j] + mg]].map(([u, v]) => to3(u, v)), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([...cs[0], ...cs[1], ...cs[2], ...cs[0], ...cs[2], ...cs[3]], 3));
    SCAN.cutGroup.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: [0xff5151, 0x38c26c, 0x4c97ff][k], transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
    const S = SCAN.sec[k]; if (!S) continue; const pos = [], col = [], seg = (a, b, r, gg, bb) => { pos.push(...to3(a[0], a[1]), ...to3(b[0], b[1])); col.push(r, gg, bb, r, gg, bb); };
    for (const e of S.ents) { if (e.t === 'line') seg(e.p0, e.p1, 0.85, 0.07, 0.25); else { const a = scArcPts(e); for (let q = 1; q < a.length; q++) seg(a[q - 1], a[q], 0.05, 0.35, 0.85); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true })); ln.renderOrder = 26; SCAN.cutGroup.add(ln); }
}
function scDrawCut(cv, k) {                       // one plane flat in the panel: the scan grey, lines red, arcs and circles blue
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, S = SCAN.sec[k], css = getComputedStyle(document.body), mut = css.getPropertyValue('--muted') || '#888'; g.clearRect(0, 0, W, H);
  if (!S || !S.parts.length) { g.fillStyle = mut; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(S ? 'nothing is cut at this level' : 'switch a plane on', W / 2, H / 2); return; }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of S.parts) for (const q of p.scan) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  const sc = Math.min((W - 16) / Math.max(x1 - x0, 1e-6), (H - 28) / Math.max(y1 - y0, 1e-6)), ox = (W - (x1 - x0) * sc) / 2, oy = (H - 12 - (y1 - y0) * sc) / 2, X = u => ox + (u - x0) * sc, Y = v => H - 12 - oy - (v - y0) * sc, poly = (a, close) => { g.beginPath(); a.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); if (close) g.closePath(); g.stroke(); };
  g.lineJoin = 'round'; g.strokeStyle = '#b9bec6'; g.lineWidth = 3; for (const p of S.parts) poly(p.scan, false);
  g.lineWidth = 1.2; for (const e of S.ents) { if (e.t === 'line') { g.strokeStyle = '#d1123f'; poly([e.p0, e.p1]); } else { g.strokeStyle = '#0b63ce'; poly(scArcPts(e), e.t === 'circle'); } }
  g.fillStyle = '#111'; for (const e of S.ents) if (e.t !== 'circle') g.fillRect(X(e.p0[0]) - 1.5, Y(e.p0[1]) - 1.5, 3, 3);
  if (SCAN.rec && $('scOver') && $('scOver').checked) { const [i0, j0] = [0, 1, 2].filter(q => q !== k), L = SCAN.cut[k].level; g.strokeStyle = '#12a150'; g.lineWidth = 1; g.setLineDash([5, 3]);      // the reconstruction over the cut: where each plane passes through it, and where each edge pierces it
    for (const p of SCAN.rec.planes) { const a = p.n[i0], b = p.n[j0], nl = Math.hypot(a, b); if (nl < 0.05 || L < p.box[k] || L > p.box[3 + k]) continue; const c = p.d - p.n[k] * L, ux = -b / nl, uy = a / nl, px = a * c / (nl * nl), py = b * c / (nl * nl); let t0 = -1e9, t1 = 1e9;
      for (const [o, d, lo2, hi2] of [[px, ux, p.box[i0], p.box[3 + i0]], [py, uy, p.box[j0], p.box[3 + j0]]]) { if (Math.abs(d) < 1e-9) { if (o < lo2 || o > hi2) t0 = 1e9; continue; } const ta = (lo2 - o) / d, tb = (hi2 - o) / d; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb)); } if (t1 - t0 < 0.5) continue; poly([[px + t0 * ux, py + t0 * uy], [px + t1 * ux, py + t1 * uy]]); }
    g.setLineDash([]); g.fillStyle = '#12a150'; for (const e of SCAN.rec.edges) for (const [x, y] of e.runs) { const d = y[k] - x[k]; if (Math.abs(d) < 1e-6) continue; const t = (L - x[k]) / d; if (t < 0 || t > 1) continue; g.beginPath(); g.arc(X(x[i0] + t * (y[i0] - x[i0])), Y(x[j0] + t * (y[j0] - x[j0])), 3.2, 0, 2 * Math.PI); g.fill(); } }
  const [i, j] = [0, 1, 2].filter(q => q !== k); g.fillStyle = mut; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText('XYZ'[i] + ' ' + scNum(x0, 1) + ' … ' + scNum(x1, 1), 3, H - 2); g.textAlign = 'right'; g.fillText('XYZ'[j] + ' ' + scNum(y0, 1) + ' … ' + scNum(y1, 1), W - 3, H - 2);
}
function scCutDxf(k) {                            // the recognised outline as LINE / ARC / CIRCLE, the scan beside it on its own layer
  const S = SCAN.sec[k], f = x => (Math.round(x * 1e4) / 1e4).toString(), o = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  for (const p of S.parts) { o.push('0', 'LWPOLYLINE', '8', 'SCAN', '62', '8', '90', String(p.scan.length), '70', '0'); for (const q of p.scan) o.push('10', f(q[0]), '20', f(q[1])); }
  for (const e of S.ents) { if (e.t === 'line') o.push('0', 'LINE', '8', 'CONTOUR', '10', f(e.p0[0]), '20', f(e.p0[1]), '11', f(e.p1[0]), '21', f(e.p1[1])); else if (e.t === 'circle') o.push('0', 'CIRCLE', '8', 'CONTOUR', '10', f(e.c[0]), '20', f(e.c[1]), '40', f(e.r));
    else { const d = (p) => (Math.atan2(p[1] - e.c[1], p[0] - e.c[0]) * 180 / Math.PI + 360) % 360, a0 = d(e.ccw ? e.p0 : e.p1), a1 = d(e.ccw ? e.p1 : e.p0); o.push('0', 'ARC', '8', 'CONTOUR', '10', f(e.c[0]), '20', f(e.c[1]), '40', f(e.r), '50', f(a0), '51', f(a1)); } }
  o.push('0', 'ENDSEC', '0', 'EOF'); return o.join('\n') + '\n';
}

/* ── the panel of the room: what is known about the scan so far, and the view of the chosen tool ── */
function scPanel() {
  const box = $('scanSide'), has = !!SCAN.P, or = !!SCAN.frame; let h = '';
  document.querySelectorAll('#scanTools button[data-tool]').forEach(b => { const t = b.dataset.tool; b.classList.toggle('on', t === SCAN.tool); b.disabled = (t !== 'open' && !has) || ((t === 'signature' || t === 'sections' || t === 'recognise') && !or) || ['groups', 'bench'].includes(t); });
  if (!has) h = '<div class="ttl">No scan yet</div><div class="note">Open a scan: a mesh of a real part as the scanner gives it (OBJ). It is not turned into Snark text; the tools on the left work on it in order.</div>';
  else { h = `<div class="ttl">${SCAN.name.replace(/[<&]/g, '')}</div><div class="kv"><span>points</span><b>${SCAN.n.toLocaleString('en-US')}</b><span>triangles</span><b>${SCAN.nf.toLocaleString('en-US')}</b><span>size</span><b>${SCAN.size.map(v => scNum(v, 1)).join(' × ')} mm</b><span>read in</span><b>${scNum(SCAN.openMs / 1000, 1)} s</b></div>`;
    if (!or) h += '<div class="note">The part lies as the scanner left it. <b>Orient</b> finds its own axes.</div>';
    else { const f = SCAN.frame; h += `<div class="ttl">Frame of the part</div><div class="how">${f.how.map((t, k) => `<div><b>${'XYZ'[k]}</b> ${t}</div>`).join('')}</div><div class="ttl2">Origin</div><div class="how">${f.org.map((t, k) => `<div><b>${'XYZ'[k]}</b> ${t}</div>`).join('')}</div><div class="kv"><span>cells</span><b>${f.cells.toLocaleString('en-US')} of ${scNum(f.cell, 2)} mm</b><span>flat directions found</span><b>${f.directions}</b><span>found in</span><b>${scNum(f.ms / 1000, 1)} s</b></div><div class="row">Quarter turn about ${[0, 1, 2].map(k => `<button class="turn" data-k="${k}">${'XYZ'[k]}</button>`).join('')}</div>`; }
    if (or && (SCAN.tool === 'signature' || SCAN.tool === 'sections')) { if (!SCAN.sig) scanSignature();
      h += '<div class="ttl">Signature</div><div class="note">Points at each level (0.02 mm), log scale. A peak is a plane across the axis; click to cut there.</div>' + [0, 1, 2].map(k => `<canvas class="sig" data-k="${k}" width="300" height="84"></canvas>`).join('');
      h += '<div class="ttl">Planes across the axes</div><table class="lv"><tr><th></th><th>level</th><th>width</th><th>points</th></tr>' + SCAN.sig.map((s, k) => s.peaks.map(p => `<tr data-k="${k}" data-l="${p.level}"><td>${'XYZ'[k]}</td><td>${scNum(p.level, 3)}</td><td>${scNum(p.width, 3)}</td><td>${p.points.toLocaleString('en-US')}</td></tr>`).join('')).join('') + '</table>'; }
    if (or && SCAN.tool === 'recognise' && SCAN.rec) { const r = SCAN.rec, nm = p => (p.off < 0.3 ? (p.n[p.axis] > 0 ? '+' : '−') + 'XYZ'[p.axis] : 'XYZ'[p.axis] + ' ' + scNum(p.off, 1) + '°');
      { const V = SCAN.view, cb = (v, t) => `<label><input type="checkbox" data-v="${v}"${V[v] ? ' checked' : ''}> ${t}</label>`;
        const nW = r.edges.filter(e => e.runs0).length, row = (v, t, sw, n) => `<label class="lay"><input type="checkbox" data-v="${v}"${V[v] ? ' checked' : ''}><i style="background:${sw}"></i><span>${t}</span><b>${n === undefined ? '' : n}</b></label>`;
        const grp = (name, id, rows) => `<div class="lgrp"><div class="ttl">${name} <span style="float:right;font-weight:400"><button class="ax lall" data-g="${id}" data-on="1">all</button> <button class="ax lall" data-g="${id}" data-on="0">none</button></span></div><div class="view lays" data-g="${id}">${rows}</div></div>`;
        h += grp('Original scan', 'o', row('mesh', 'the scan itself', '#9fb0c2') + row('paint', 'painted by the planes found', 'linear-gradient(90deg,#e79,#7c9,#79e)'))
          + `<div class="lsep"></div>`
          + grp('Reconstruction', 'r', (r.extr ? row('extr', 'extruded body: walls and ends', '#b8c4d2') + row('extrLines', 'extruded body: outline', '#1a1a1a') : '')
            + row('faces', 'faces closed by their edges', '#8fd0a0', r.faces.closed) + row('holes', 'cylinders', '#e0584a', r.cyls.length)
            + row('eWalk', 'edges walked along their line', '#db1a1a', nW) + row('eSec', 'edges seen in the sections only', '#121212', r.edges.length - nW) + row('eGuess', 'ends carried on to a corner (a guess)', '#f08a00', r.faces.guess.length / 6))
          + `<div class="row" style="margin-top:6px">stands beside the scan, moved along ${[0, 1, 2].map(k => `<button class="ax side${V.side === k ? ' on' : ''}" data-side="${k}">${'XYZ'[k]}</button>`).join('')}</div>`
          + `<div class="lsep"></div>`
          + grp('What was measured on the way', 'm', row('planes', 'planes as strips of the sections', '#c9a', r.planes.length) + row('round', 'roundings as strips of the sections', '#6b99eb') + row('single', 'single circles, not inherited', '#e59a8f', r.singles) + row('eOld', 'walked edges as they were before', '#73737f', nW)
            + row('lx', 'outlines of the sections along X', '#333') + row('ly', 'outlines of the sections along Y', '#333') + row('lz', 'outlines of the sections along Z', '#333'))
          + `<div class="note">Every line is one layer and nothing else. The measured layers are drawn beside the scan too, with the reconstruction.</div>`; }
      h += `<div class="ttl">Planes from the row of sections</div><div class="kv"><span>sections, ${scNum(r.step, 2)} mm apart</span><b>${r.sections}</b><span>lines · arcs in them</span><b>${r.lines.toLocaleString('en-US')} · ${r.arcs.toLocaleString('en-US')}</b><span>planes (families of lines)</span><b>${r.planes.length}</b><span>line length that is in a plane</span><b>${scNum(100 * r.lenIn / r.lenLines, 1)} %</b><span>points of the scan on planes</span><b>${scNum(100 * r.explained, 1)} %</b><span>found in</span><b>${scNum(r.ms / 1000, 1)} s</b></div>`;
      { const sc = r.edges.filter(e => e.runs0), l0 = sc.reduce((a, e) => a + e.len0, 0), l1 = sc.reduce((a, e) => a + e.length, 0), p0 = sc.reduce((a, e) => a + e.pieces0, 0), p1 = sc.reduce((a, e) => a + e.runs.length, 0);
        h += `<div class="ttl">Symmetries tried side by side</div><div class="note">Each is a hypothesis about how the designer thought. All are tested on the same scan; none shuts out another. The number is the share of the scan that agrees.</div><table class="lv"><tr><th>hypothesis</th><th>agrees</th><th></th><th></th></tr>` + r.hyp.map(q => `<tr><td>${q.kind}</td><td>${scNum(100 * q.score, 1)} %</td><td>${q.note}</td><td>${q.score >= 0.9 ? 'holds' : q.score >= 0.7 ? 'partly' : 'no'}</td></tr>`).join('') + '</table>';
        if (r.extr) { const X = r.extr, A = 'XYZ'[X.k], endTxt = (c, i) => c.found ? `found in the scan: a flat face, scatter ${scNum(c.rms, 3)} mm` : 'not in the scan — closed by assumption', deg = e => Math.atan2(e.p1[1] - e.p0[1], e.p1[0] - e.p0[0]) * 180 / Math.PI;
          h += `<div class="ttl">How it was made: a profile pushed along ${A}</div><div class="note">Sign: of the points lying on planes, ${scNum(100 * X.score.side, 1)} % are on planes that look square to ${A} (walls), ${scNum(100 * X.score.cap, 1)} % on planes that look straight along it (ends).</div><div class="kv"><span>profile</span><b>${X.ents.filter(e => e.t === 'line').length} lines, ${X.ents.filter(e => e.t === 'arc').length} arcs, ${X.closed ? 'closed' : 'open'}</b><span>area of the profile</span><b>${scNum(X.area, 1)} mm²</b><span>pushed along ${A}</span><b>${scNum(X.t0, 2)} … ${scNum(X.t1, 2)} = ${scNum(X.t1 - X.t0, 2)} mm</b><span>points of the scan on this body</span><b>${scNum(100 * X.explained, 1)} %</b><span>walls off the profile: half within</span><b>${scNum(X.dev, 3)} mm</b><span>95 % within</span><b>${scNum(X.dev95, 3)} mm</b></div><div class="note">End at ${A} = ${scNum(X.t0, 2)}: ${endTxt(X.caps[0])}.<br>End at ${A} = ${scNum(X.t1, 2)}: ${endTxt(X.caps[1])}.<br>Each line and arc of the profile is fitted with the points of its whole wall, along the whole length.<br>The fewest elements that explain the walls: the middle section gave ${X.before} pieces; ${X.joinedL} joins of pieces lying on one line; ${X.soft.length} roundings under 1 mm taken as sharp corners${X.soft.length ? ' (R ' + scNum(Math.min(...X.soft), 2) + ' … ' + scNum(Math.max(...X.soft), 2) + ')' : ''}; ${X.links} short links put in by guess (orange).</div><table class="lv"><tr><th></th><th>long / R</th><th>turned</th><th>scatter</th><th>points</th></tr>` + X.ents.map(e => e.t === 'line' ? `<tr><td>${e.guess ? 'link' : 'line'}</td><td>${scNum(Math.hypot(e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]), 2)}</td><td>${scNum(deg(e), 2)}°</td><td>${scNum(e.rms, 3)}</td><td>${e.on.toLocaleString('en-US')}</td></tr>` : `<tr><td>arc</td><td>R ${scNum(e.r, 2)}</td><td>${scNum(e.sw * 180 / Math.PI, 1)}°</td><td>${scNum(e.rms, 3)}</td><td>${e.on.toLocaleString('en-US')}</td></tr>`).join('') + '</table>'; }
        { const fl = r.planes.filter(p => p.face && p.face.closed);
          h += `<div class="ttl">Faces closed by their edges, checked on the scan</div><div class="kv"><span>pieces of planes joined into one face</span><b>${r.bentJoined}</b><span>twin edges folded into one</span><b>${r.twins}</b><span>planes with edges</span><b>${r.planes.filter(p => p.face).length}</b><span>faces that closed</span><b>${r.faces.closed}</b><span>covered by the scan 90 % or more</span><b>${r.faces.ok}</b></div><div class="note">The face is given a thickness and laid on the scan. “covered” is the part of its area that has real points; “outside” is the part of the points of that plane lying beyond the face.</div><table class="lv"><tr><th></th><th>area</th><th>covered</th><th>outside</th><th></th></tr>` + fl.sort((a, b) => b.face.area - a.face.area).slice(0, 30).map(p => `<tr><td><i style="display:inline-block;width:9px;height:9px;background:rgb(${p.colour.join(',')})"></i></td><td>${scNum(p.face.area, 0)}</td><td>${scNum(100 * p.face.cover, 1)} %</td><td>${scNum(100 * p.face.ptsOut / Math.max(1, p.face.ptsIn + p.face.ptsOut), 1)} %</td><td>${p.face.ok ? '✓' : ''}</td></tr>`).join('') + '</table>'; }
        h += `<div class="ttl">Edges scanned along</div><div class="kv"><span>edges scanned</span><b>${sc.length} of ${r.edges.length}</b><span>pieces before · after</span><b>${p0} · ${p1}</b><span>length before · after</span><b>${scNum(l0, 0)} · ${scNum(l1, 0)} mm</b><span>edges that became one piece</span><b>${sc.filter(e => e.pieces0 > 1 && e.runs.length === 1).length}</b></div><div class="note">Each edge is walked as a line. The points right at the edge are left out (noise, rounding); a band a little way off on either face is counted. Where both faces are there, the edge is there. The layer “walked edges as they were before” shows what the sections alone gave.</div><table class="lv"><tr><th>long</th><th>was</th><th>pieces</th><th>angle</th><th>R</th><th>± </th><th>points</th></tr>` + sc.slice(0, 24).map(e => `<tr><td>${scNum(e.length, 1)}</td><td>${scNum(e.len0, 1)}</td><td>${e.pieces0}→${e.runs.length}</td><td>${scNum(e.angle, 1)}°</td><td>${e.round2 ? scNum(e.round2, 2) : '–'}</td><td>${e.round2 ? scNum(e.round2s, 3) : ''}</td><td>${e.used.toLocaleString('en-US')}</td></tr>`).join('') + '</table>'; }
      h += `<div class="ttl">Edges, checked against the sections</div><div class="kv"><span>edges (plane ∩ plane)</span><b>${r.edges.length}</b><span>corners of sections on them</span><b>${r.check.corners.toLocaleString('en-US')}</b><span>corner to edge: half within</span><b>${scNum(r.check.median, 3)} mm</b><span>95 % within</span><b>${scNum(r.check.p95, 3)} mm</b></div><div class="note">A corner is where two lines of a section meet. If the planes are right, the corners lie on the line in which the planes intersect. In <b>Sections</b> the planes are drawn green over any cut. ~ marks a face that is flat only roughly (a cast wall).</div>`;
      h += `<div class="ttl">Cylinders (circles inherited through the sections)</div><div class="note">A circle counts only if the same circle stands in three or more sections in a row. Then all the points around the axis are measured together. Untick a diameter to leave it out.</div><table class="lv"><tr><th></th><th>Ø</th><th>pcs</th><th>scatter</th><th>points</th></tr>` + r.classes.map((g, i) => `<tr><td><input type="checkbox" class="cyc" data-c="${i}"${SCAN.view.off[i] ? '' : ' checked'}></td><td>${scNum(2 * g.r, 2)}</td><td>${g.m.length}</td><td>${scNum(g.scat, 3)}</td><td>${g.on.toLocaleString('en-US')}</td></tr>`).join('') + `</table>`;
      if (r.cyls.length) h += '<table class="lv"><tr><th>axis</th><th>Ø</th><th>long</th><th>turn</th><th>scatter</th><th>lean</th><th>taper</th></tr>' + r.cyls.slice(0, 30).map(c => `<tr><td>${'XYZ'[c.k]}</td><td>${scNum(2 * c.r, 2)}</td><td>${scNum(c.z1 - c.z0, 1)}</td><td>${Math.round(100 * c.cover)} %</td><td>${scNum(c.scat, 3)}</td><td>${scNum(c.lean, 2)}°</td><td>${scNum(c.taper, 2)}°</td></tr>`).join('') + '</table>';
      h += '<div class="ttl">Planes</div><table class="lv"><tr><th></th><th>looks</th><th>level</th><th>scatter</th><th>sections</th><th>points</th><th>made of</th></tr>' + r.planes.slice(0, 40).map(p => `<tr><td><i style="display:inline-block;width:9px;height:9px;background:rgb(${p.colour.join(',')})"></i></td><td>${nm(p)}</td><td>${p.off < 0.3 ? scNum(p.level, 3) : scNum(p.d, 3)}</td><td>${scNum(p.rms, 3)}${p.rough ? '~' : ''}</td><td>${p.sections}</td><td>${p.on.toLocaleString('en-US')}</td><td>${p.pieces ? p.pieces + ' pcs, ' + scNum(p.bend, 1) + '°' : ''}</td></tr>`).join('') + '</table>' + (r.planes.length > 40 ? `<div class="note">… and ${r.planes.length - 40} smaller ones.</div>` : '');
      h += '<div class="ttl">Edges</div><table class="lv"><tr><th>planes</th><th>long</th><th>angle</th><th>R</th><th>corners</th><th>off</th></tr>' + r.edges.slice(0, 40).map(e => `<tr><td><i style="display:inline-block;width:9px;height:9px;background:rgb(${r.planes[e.a].colour.join(',')})"></i><i style="display:inline-block;width:9px;height:9px;background:rgb(${r.planes[e.b].colour.join(',')})"></i></td><td>${scNum(e.length, 1)}</td><td>${scNum(e.angle, 2)}°</td><td>${e.round ? scNum(e.round, 1) : '—'}</td><td>${e.corners}</td><td>${scNum(e.dev, 3)}</td></tr>`).join('') + '</table>' + (r.edges.length > 40 ? `<div class="note">… and ${r.edges.length - 40} shorter ones.</div>` : ''); }
    if (or && SCAN.tool === 'sections') { const bb = SCAN.sig, S = SCAN.sec[SCAN.cutSel];
      h += '<div class="ttl">Sections</div>' + [0, 1, 2].map(k => `<div class="cut"><label><input type="checkbox" class="cutOn" data-k="${k}"${SCAN.cut[k].on ? ' checked' : ''}><b style="color:${['#ff5151', '#38c26c', '#4c97ff'][k]}">${'XYZ'[k]}</b></label><input type="range" class="cutS" data-k="${k}" min="${bb[k].lo}" max="${bb[k].hi}" step="0.05" value="${SCAN.cut[k].level}"><input type="number" class="cutN" data-k="${k}" step="0.1" value="${scNum(SCAN.cut[k].level, 2)}"></div>`).join('');
      h += `<div class="row">Flat view of ${[0, 1, 2].map(k => `<button class="ax${SCAN.cutSel === k ? ' on' : ''}" data-ax="${k}">${'XYZ'[k]}</button>`).join('')}<span style="flex:1"></span>${SCAN.rec ? '<label title="The planes found by Recognise, where they pass through this cut (green dashes), and the edges, where they pierce it (green dots)"><input type="checkbox" id="scOver" checked> planes</label>' : ''}<button id="scDxf">DXF</button></div><canvas id="scSec" width="300" height="300"></canvas><div id="scSecInfo"></div>`; }
  }
  { const i = h.indexOf('<div class="ttl">Sections</div>'), j = h.indexOf('<div class="ttl">Frame of the part</div>'); if (i > j && j >= 0) h = h.slice(0, j) + h.slice(i) + h.slice(j, i); }      // while cutting, the sliders and the flat view come first
  box.innerHTML = h;
  box.querySelectorAll('canvas.sig').forEach(cv => { const k = +cv.dataset.k; scDrawSignature(cv, SCAN.sig[k], k); cv.onclick = e => { const r = cv.getBoundingClientRect(), s = SCAN.sig[k]; let lv = s.lo + (e.clientX - r.left) / r.width * (s.hi - s.lo); const near = s.peaks.find(p => Math.abs(p.level - lv) < (s.hi - s.lo) * 0.012); if (near) lv = near.level; SCAN.cut[k] = { on: true, level: lv }; SCAN.sec[k] = null; SCAN.cutSel = k; SCAN.tool = 'sections'; scPanel(); }; });
  box.querySelectorAll('table.lv tr[data-k]').forEach(tr => tr.onclick = () => { const k = +tr.dataset.k; SCAN.cut[k] = { on: true, level: +tr.dataset.l }; SCAN.sec[k] = null; SCAN.cutSel = k; SCAN.tool = 'sections'; scPanel(); });
  box.querySelectorAll('button.turn').forEach(b => b.onclick = scRun(async () => { scSay('turning …'); await scTick(); scanTurn(+b.dataset.k); scSay(''); }));
  const info = () => { const k = SCAN.cutSel, S = SCAN.sec[k], el = $('scSecInfo'); if (!el) return; scDrawCut($('scSec'), k); if (!S) { el.innerHTML = ''; return; }
    const ang = e => { let a = Math.atan2(e.u[1], e.u[0]) * 180 / Math.PI; if (a < 0) a += 180; if (a >= 179.995) a = 0; return a; }, big = S.ents.slice().sort((a, b) => b.len - a.len);
    el.innerHTML = `<div class="kv"><span>${'XYZ'[k]} = ${scNum(SCAN.cut[k].level, 2)} mm</span><b>${S.parts.length} outlines, ${scNum(S.length, 1)} mm</b><span>recognised</span><b>${S.lines} lines · ${S.arcs} arcs · ${S.circles} circles</b><span>share of the outline explained</span><b>${S.length ? scNum(100 * S.explained / S.length, 1) : 0} %</b><span>cut and recognised in</span><b>${scNum(S.ms, 0)} ms</b></div>` +
      '<table class="lv"><tr><th></th><th>size</th><th>long</th><th>scatter</th><th></th></tr>' + big.slice(0, 40).map(e => `<tr><td>${e.t}</td><td>${e.t === 'line' ? scNum(ang(e), 2) + '°' : e.t === 'circle' ? '⌀' + scNum(2 * e.r, 3) : 'R' + scNum(e.r, 3)}</td><td>${scNum(e.len, 1)}</td><td>${scNum(e.rms, 3)}</td><td>${e.tol === 'rough' ? 'rough' : ''}</td></tr>`).join('') + '</table>' + (big.length > 40 ? `<div class="note">… and ${big.length - 40} shorter pieces.</div>` : ''); };
  const recut = k => { scanCut(k); scCutScene(); if (SCAN.cut[k].on) SCAN.cutSel = k; box.querySelectorAll('button.ax:not(.side):not(.lall)').forEach(b => b.classList.toggle('on', +b.dataset.ax === SCAN.cutSel)); info(); box.querySelectorAll('canvas.sig').forEach(cv => scDrawSignature(cv, SCAN.sig[+cv.dataset.k], +cv.dataset.k)); };
  box.querySelectorAll('input.cutOn').forEach(c => c.onchange = () => { const k = +c.dataset.k; SCAN.cut[k].on = c.checked; recut(k); });
  box.querySelectorAll('input.cutS').forEach(c => c.oninput = () => { const k = +c.dataset.k; SCAN.cut[k].level = +c.value; box.querySelector(`input.cutN[data-k="${k}"]`).value = scNum(SCAN.cut[k].level, 2); if (!SCAN.cut[k].on) { SCAN.cut[k].on = true; box.querySelector(`input.cutOn[data-k="${k}"]`).checked = true; } recut(k); });
  box.querySelectorAll('input.cutN').forEach(c => c.onchange = () => { const k = +c.dataset.k; SCAN.cut[k].level = Number(String(c.value).replace(',', '.')) || 0; box.querySelector(`input.cutS[data-k="${k}"]`).value = SCAN.cut[k].level; SCAN.cut[k].on = true; box.querySelector(`input.cutOn[data-k="${k}"]`).checked = true; recut(k); });
  box.querySelectorAll('button.ax:not(.side):not(.lall)').forEach(b => b.onclick = () => { SCAN.cutSel = +b.dataset.ax; box.querySelectorAll('button.ax:not(.side):not(.lall)').forEach(x => x.classList.toggle('on', x === b)); info(); });
  if ($('scOver')) $('scOver').onchange = info;
  box.querySelectorAll('.view input').forEach(c => c.onchange = () => { SCAN.view[c.dataset.v] = c.checked; scanDraw(); });
  box.querySelectorAll('input.cyc').forEach(c => c.onchange = () => { SCAN.view.off[+c.dataset.c] = !c.checked; scanDraw(); });
  box.querySelectorAll('button.lall').forEach(b => b.onclick = () => { const on = b.dataset.on === '1'; box.querySelectorAll(`.lays[data-g=${b.dataset.g}] input`).forEach(c => { SCAN.view[c.dataset.v] = on; c.checked = on; }); scanDraw(); });
  box.querySelectorAll('button.side').forEach(b => b.onclick = () => { SCAN.view.side = +b.dataset.side; SCAN.fitRec = null; scanDraw(); scPanel(); });
  if ($('scDxf')) $('scDxf').onclick = () => { const k = SCAN.cutSel; if (SCAN.sec[k] && SCAN.sec[k].parts.length) download(`section_${'XYZ'[k]}${scNum(SCAN.cut[k].level, 2)}.dxf`, scCutDxf(k), 'application/dxf'); };
  if ($('scSec')) { for (let k = 0; k < 3; k++) if (SCAN.cut[k].on && !SCAN.sec[k]) scanCut(k); info(); } scCutScene();
  $('status').textContent = DESK === 'scan' ? (has ? `${SCAN.name} · ${SCAN.n.toLocaleString('en-US')} points · ${or ? 'oriented' : 'not oriented'}` : 'Scan room') : $('status').textContent;
}
const scRun = fn => async () => { try { await busy(fn); } catch (e) { console.error(e); scSay(''); alert(e.message); } };
document.querySelectorAll('#scanTools button[data-tool]').forEach(b => b.onclick = () => { const t = b.dataset.tool;
  if (t === 'open') { $('fileScan').value = ''; $('fileScan').click(); }
  else if (t === 'orient') scRun(scanOrient)();
  else if (t === 'recognise') scRun(scanRecognise)();
  else if (t === 'signature' || t === 'sections') scRun(async () => { scSay('counting levels …'); await scTick(); if (!SCAN.sig) scanSignature(); if (t === 'sections' && !SCAN.cut.some(c => c.on)) { SCAN.cut.forEach((c, k) => { const s = SCAN.sig[k]; c.level = Math.round((s.lo + s.hi) / 2 * 20) / 20; }); } const was = SCAN.tool; SCAN.tool = t; if (was === 'recognise') scanDraw(); scPanel(); scSay(''); })(); });
$('fileScan').onchange = e => { const f = e.target.files[0]; if (f) scRun(() => scanOpen(f))(); };
window.__scan = SCAN; window.__scanFn = { scanSection, scanContour, scLine, scCircle };
