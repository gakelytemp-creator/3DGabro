/* ═══════════════════ the manipulator (from EDITOR_36), roles and crossings ═══════════════════
   One handle on the selected body, as Rhino's gumball:
     · arrows +X +Y +Z            move along one axis of the room;
     · dashed stems with a square  change the size along that axis (a Snark body gets new dimensions; a stored body,
                                   whose cards would stop being true under uneven stretching, is scaled evenly);
     · three arcs                  turn about one axis of the room, round the centre of the body;
     · the ball in the middle      one click: Object ↔ Tool; two clicks: the board of the three Boolean operations.
   An Object does not enter another Object: the drag stops at the last free place. A Tool enters, and where it
   crosses an Object the crossing is drawn red. While a body is dragged only its picture moves (a matrix on its
   meshes); the numbers of the body are changed once, when the button is let go: one drag is one step of Undo.
   Works on Snark bodies and on stored ones (STEP, mesh): a stored body's points, cards and seams are all moved.

   In this part, in order:
     1. selection of stored bodies, who owns a drawn body, its role and its look;
     2. the handle: building it, keeping it on the body, picking its parts;
     3. may a body stand here (gzBlocked): Objects do not enter each other;
     4. a drag (gzDown, gzMove, gzUp) and the lasting move of a stored body (gzApplyStored);
     5. the history of a Boolean result: moving its parts with it, its text, Take apart;
     6. Object / Tool and the board of the Boolean operations;
     7. the Boolean operation itself (gzBoolean, with Manifold);
     8. crossings: triangle against triangle through a grid of cells, and the red lines (gzCrossings).

   Names: S is the state of the bench (S.objects: Snark primitives; S.foreign.bodies: stored bodies), PIPE the last run
   of the pipeline (PIPE.rec.bodies[i] is drawn by the meshes with userData.body === i), SEL the id of the selected
   primitive, SELF the index of the selected stored body. A "target" t = { o, obj, bi }: the owner, whether it is a
   primitive, and the index of its drawn body. */
let SELF = -1;                                   // the selected stored body (index in S.foreign.bodies), or -1
/* the state of the handle: its three.js group, the parts that can be picked, the drag in progress, the timer that tells
   one click on the ball from two, and what the red lines were last drawn for (sig), when (lastX) and how long it took (xCost) */
const GZ = { group: null, targets: [], drag: null, clickTimer: 0, lastClick: 0, sig: '', lastX: 0 };
/* the three axes of the room and their colours (X red, Y green, Z blue, as in Rhino) */
const GZ_AXIS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)], GZ_COLOR = [0xff5151, 0x38c26c, 0x4c97ff];
/* quaternions as [x, y, z, w]: the product a·b (first b, then a), and a turn by ang about axis k of the room */
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qAxis = (k, ang) => { const q = [0, 0, 0, Math.cos(ang / 2)]; q[k] = Math.sin(ang / 2); return q; };
/* a recognised body → the stored body it was read from (found once, by a patch name, and remembered on the body) */
const foreignIndexOf = body => { if (!body || body.kind !== 'mesh') return -1; if (body.fbi === undefined) { const nm = new Set(Array.isArray(body.names) ? body.names : Object.values(body.names)); body.fbi = (S.foreign.bodies || []).findIndex(fb => fb.patches.some(pt => nm.has(pt.name))); } return body.fbi; };
/* a recognised body → what the bench holds for it (a primitive or a stored body), and its role */
const ownerOf = body => body.obj >= 0 ? S.objects[body.obj] : (S.foreign.bodies || [])[foreignIndexOf(body)] || null;
const roleOfBody = body => { const o = ownerOf(body); return o && o.role === 'tool' ? 'tool' : 'object'; };
/* how a body is drawn: a tool is orange and see-through, whatever its colour by kind */
const bodyMaterial = (selected, B) => { const m = bodyMaterial0(selected, B); if (B && roleOfBody(B.body) === 'tool' && !VIEW.patches) { m.color.set(selected ? 0xffb347 : 0xf29a3a); m.transparent = true; m.opacity = 0.32; m.depthWrite = false; } return m; };
/* select a stored body (and nothing else) */
function selectForeign(i) { select(null); SELF = i; renderChips(); updateInspector(); evaluateAndDraw(); }
/* what the manipulator holds: a Snark body, a stored body, or nothing */
function gzTarget() {
  const o = selObj(); if (o) return { o, obj: true, bi: PIPE.rec.bodies.findIndex(b => b.obj >= 0 && S.objects[b.obj] === o) };
  const fb = (S.foreign.bodies || [])[SELF]; if (!fb) { SELF = -1; return null; }
  return { o: fb, obj: false, bi: PIPE.rec.bodies.findIndex(b => foreignIndexOf(b) === SELF) };
}
/* the meshes that draw body bi; where the handle sits (the middle of the body) */
const gzMeshes = bi => bodyGroup.children.filter(m => m.isMesh && m.userData.body === bi);
function gzCentre(t) {
  if (t.obj) return new THREE.Vector3(...t.o.p);
  if (!t.o.ctr) { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], P = t.o.pos; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], P[i + k]); b[k + 3] = Math.max(b[k + 3], P[i + k]); } Object.defineProperty(t.o, 'ctr', { value: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2, b[3] - b[0], b[4] - b[1], b[5] - b[2]], enumerable: false, configurable: true }); }
  return new THREE.Vector3(t.o.ctr[0], t.o.ctr[1], t.o.ctr[2]);
}
/* build the handle once: for each axis an arrow (move), a dashed stem with a square (size) and an arc (turn), each with
   a wider unseen twin that is easier to hit; the ball in the middle; and the line object of the red crossings */
function gzBuild() {
  const g = GZ.group = new THREE.Group(); g.visible = false; scene.add(g);
  const mat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false });
  const hit = (geo, kind, axis, pos, quat) => { const h = new THREE.Mesh(geo, mat(0xffffff, 0)); h.userData.gz = { kind, axis }; if (pos) h.position.copy(pos); if (quat) h.quaternion.copy(quat); h.renderOrder = 105; h.frustumCulled = false; g.add(h); GZ.targets.push(h); };
  const line = (pts, color, dashed) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.044, gapSize: 0.037, transparent: true, depthTest: false, depthWrite: false }) : new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false })); if (dashed) l.computeLineDistances(); l.renderOrder = 104; g.add(l); };
  GZ.ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 12), mat(0xf5fbff)); GZ.ball.renderOrder = 105; g.add(GZ.ball);
  hit(new THREE.SphereGeometry(0.14, 16, 10), 'role', -1);
  for (let k = 0; k < 3; k++) {
    const v = GZ_AXIS[k], c = GZ_COLOR[k], q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    line([v.clone().multiplyScalar(0.13), v.clone().multiplyScalar(0.9)], c);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 14), mat(c)); tip.position.copy(v.clone().multiplyScalar(0.95)); tip.quaternion.copy(q); tip.renderOrder = 105; g.add(tip);
    hit(new THREE.CylinderGeometry(0.092, 0.092, 0.89, 10), 'move', k, v.clone().multiplyScalar(0.56), q); hit(new THREE.ConeGeometry(0.115, 0.22, 12), 'move', k, v.clone().multiplyScalar(0.95), q);
    line([v.clone().multiplyScalar(-0.13), v.clone().multiplyScalar(-1)], c, true);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.145, 0.145), mat(c)); sq.position.copy(v.clone().multiplyScalar(-0.51)); sq.renderOrder = 106; g.add(sq);
    hit(new THREE.BoxGeometry(0.23, 0.23, 0.23), 'size', k, v.clone().multiplyScalar(-0.51));
    const others = [0, 1, 2].filter(a => a !== k), pts = []; for (let i = 0; i <= 32; i++) { const t = i / 32 * Math.PI / 2, p = new THREE.Vector3(); p.setComponent(others[0], -0.8 * Math.cos(t)); p.setComponent(others[1], -0.8 * Math.sin(t)); pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts), arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.018, 7, false), mat(c)); arc.renderOrder = 106; g.add(arc);
    hit(new THREE.TubeGeometry(curve, 48, 0.072, 8, false), 'rotate', k);
  }
  GZ.xLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, depthTest: false, depthWrite: false })); GZ.xLines.renderOrder = 60; GZ.xLines.frustumCulled = false; scene.add(GZ.xLines);
}
function gzUpdate() {                       // every frame: the handle sits on the body and keeps its size on the screen
  const t = VIEW.mode === 'snark' && !ANIM.on ? gzTarget() : null; GZ.group.visible = !!t;
  if (t) {
    const c = GZ.drag ? GZ.drag.centreNow : gzCentre(t); GZ.group.position.copy(c);
    GZ.group.scale.setScalar(Math.max(0.001, 2 * camera.position.distanceTo(c) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 72 / Math.max(1, canvas.clientHeight)));
    GZ.ball.material.color.setHex(t.o.role === 'tool' ? 0xff8d30 : 0xf5fbff); GZ.group.updateMatrixWorld(true);
  }
  gzCrossings(false);
}
/* the pointer in the coordinates of the screen (−1…1), and which part of the handle is under it */
const gzNdc = e => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
function gzPick(e) {
  if (!GZ.group.visible) return null; const rc = new THREE.Raycaster(); rc.setFromCamera(gzNdc(e), camera);
  const hits = rc.intersectObjects(GZ.targets, false); if (!hits.length) return null; const order = { role: 0, size: 1, rotate: 2, move: 3 };
  hits.sort((a, b) => order[a.object.userData.gz.kind] - order[b.object.userData.gz.kind] || a.distance - b.distance); return { ...hits[0].object.userData.gz, point: hits[0].point.clone() };
}
/* ── may the body stand here? An Object may not enter another Object. Tested with the exact solids of the Snark
      bodies (a point of one inside the other); a stored body, whose inside is not known cheaply, by its box. ── */
const gzInside = (o, p) => { const F = Rot.frameFromQuat(o.q || Rot.quatFromEuler(o.rot || [0, 0, 0])), d = [p.x - o.p[0], p.y - o.p[1], p.z - o.p[2]], l = F.map(f => f[0] * d[0] + f[1] * d[1] + f[2] * d[2]), e = 1e-4;
  return o.kind === 'box' ? Math.abs(l[0]) < o.size[0] / 2 - e && Math.abs(l[1]) < o.size[1] / 2 - e && Math.abs(l[2]) < o.size[2] / 2 - e : o.kind === 'cyl' ? Math.hypot(l[0], l[1]) < o.size[0] / 2 - e && Math.abs(l[2]) < o.size[1] / 2 - e : Math.hypot(...l) < o.size[0] / 2 - e; };
function gzSamples(bi, max = 1500) {        // some points of a drawn body, in its own (undragged) place
  const out = []; for (const m of gzMeshes(bi)) { const a = m.geometry.getAttribute('position'), step = Math.max(1, Math.ceil(a.count / max)); for (let i = 0; i < a.count; i += step) out.push(new THREE.Vector3().fromBufferAttribute(a, i)); } return out;
}
/* the box of a drawn body, moved by M when it is being dragged */
const gzBox = (bi, M) => { const b = new THREE.Box3(); for (const m of gzMeshes(bi)) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.clone(); if (M) c.applyMatrix4(M); b.union(c); } return b; };
function gzBlocked(t, M, cand) {            // cand: the Snark body as it would be (p, q, size)
  if (t.o.role === 'tool') return false; const mine = gzBox(t.bi, M); if (mine.isEmpty()) return false; let pts = null;
  for (let bi = 0; bi < PIPE.rec.bodies.length; bi++) {
    if (bi === t.bi) continue; const body = PIPE.rec.bodies[bi], other = ownerOf(body); if (!other || other.role === 'tool') continue;
    const ob = gzBox(bi, null); if (ob.isEmpty() || !mine.intersectsBox(ob.clone().expandByScalar(-1e-4))) continue;
    const x = gzCross(t.bi, M || null, bi, null); if (x !== false) return true;               // their surfaces cross (or it cannot be told: too many triangles)
    // no crossing: one may still lie wholly inside the other — a point of each against the exact solid of the other
    if (body.obj >= 0) { pts = pts || gzSamples(t.bi, 60).map(p => M ? p.applyMatrix4(M) : p); if (pts.some(p => gzInside(other, p))) return true; }
    if (t.obj && gzSamples(bi, 60).some(p => gzInside(cand, p))) return true;
  }
  return false;
}
/* ── a drag ── */
function gzDown(e) {
  if (e.button !== 0 || PLACE) return; const hit = gzPick(e); if (!hit) return;
  e.preventDefault(); e.stopImmediatePropagation(); const t = gzTarget(); if (!t) return;
  if (hit.kind === 'role') {                 // one click: Object ↔ Tool; a second within 300 ms: the Boolean board
    const now = performance.now();
    if (now - GZ.lastClick < 300) { clearTimeout(GZ.clickTimer); GZ.lastClick = 0; gzBoolBoard(t); }
    else { GZ.lastClick = now; GZ.clickTimer = setTimeout(() => { gzSetRole(t.o, t.o.role === 'tool' ? 'object' : 'tool'); }, 310); }
    return;
  }
  const c = gzCentre(t), r = canvas.getBoundingClientRect(), s = GZ.group.scale.x, toPx = (a, b) => { const p = a.clone().project(camera), q = b.clone().project(camera); return new THREE.Vector2((q.x - p.x) * r.width / 2, -(q.y - p.y) * r.height / 2); };
  const d = { id: e.pointerId, kind: hit.kind, k: hit.axis, t, c, centreNow: c.clone(), s, x0: e.clientX, y0: e.clientY, axisPx: toPx(c, c.clone().addScaledVector(GZ_AXIS[hit.axis], s)), M: new THREE.Matrix4(), safe: null, moved: false,
    size0: t.obj ? t.o.size.slice() : null, q0: t.obj ? (t.o.q || Rot.quatFromEuler(t.o.rot || [0, 0, 0])).slice() : null, p0: t.obj ? t.o.p.slice() : null };
  if (d.axisPx.lengthSq() < 4) d.axisPx.set(0, -60);
  if (hit.kind === 'rotate') { const tan = GZ_AXIS[hit.axis].clone().cross(hit.point.clone().sub(c)).normalize(); d.tanPx = toPx(hit.point, hit.point.clone().addScaledVector(tan, s * 0.2)); if (d.tanPx.lengthSq() < 9) d.tanPx.set(-d.axisPx.y, d.axisPx.x); }
  GZ.drag = d; controls.enabled = false; lineGroup.visible = false; canvas.setPointerCapture(e.pointerId);
}
/* the pointer moved: the amount along the screen direction of the axis becomes millimetres, a factor or an angle
   (Shift: turns in steps of 15°); the body is tried in the new place, and only its picture is moved there if it is free */
function gzMove(e) {
  const d = GZ.drag; if (!d || d.id !== e.pointerId) return; e.preventDefault(); e.stopImmediatePropagation();
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0, along = (dx * d.axisPx.x + dy * d.axisPx.y) / Math.max(1e-8, d.axisPx.lengthSq()) * d.s, ax = GZ_AXIS[d.k], o = d.t.o;
  let M = new THREE.Matrix4(), cand = null, val = 0;
  if (d.kind === 'move') { val = Math.round(along * 100) / 100; M.makeTranslation(ax.x * val, ax.y * val, ax.z * val); if (d.t.obj) cand = { ...o, p: d.p0.map((v, k) => v + (k === d.k ? val : 0)) }; }
  else if (d.kind === 'rotate') { val = (dx * d.tanPx.x + dy * d.tanPx.y) / Math.max(1e-8, d.tanPx.lengthSq()) * 0.2; if (e.shiftKey) val = Math.round(val / (Math.PI / 12)) * (Math.PI / 12);
    M.makeTranslation(d.c.x, d.c.y, d.c.z).multiply(new THREE.Matrix4().makeRotationAxis(ax, val)).multiply(new THREE.Matrix4().makeTranslation(-d.c.x, -d.c.y, -d.c.z)); if (d.t.obj) cand = { ...o, q: qmul(qAxis(d.k, val), d.q0) }; }
  else if (d.t.obj) {                        // size of a Snark body: the dimension that lies along this axis of the room
    const F = Rot.frameFromQuat(d.q0), li = o.kind === 'box' ? [0, 1, 2].sort((a, b) => Math.abs(F[b][d.k]) - Math.abs(F[a][d.k]))[0] : o.kind === 'cyl' ? (Math.abs(F[2][d.k]) > 0.707 ? 1 : 0) : 0;
    const size = d.size0.slice(); size[li] = Math.max(0.5, Math.round((d.size0[li] - 2 * along) * 100) / 100); cand = { ...o, size };
    if (gzBlocked(d.t, null, cand)) return; o.size = size; d.moved = d.moved || size[li] !== d.size0[li];
    if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; rebuild(); lineGroup.visible = false; }); return;
  } else { const ext = Math.max(1e-6, d.t.o.ctr[3 + d.k]); val = Math.max(0.05, 1 - 2 * along / ext); val = Math.round(val * 1000) / 1000;      // a stored body: evenly, about its centre
    M.makeTranslation(d.c.x, d.c.y, d.c.z).multiply(new THREE.Matrix4().makeScale(val, val, val)).multiply(new THREE.Matrix4().makeTranslation(-d.c.x, -d.c.y, -d.c.z)); }
  if (gzBlocked(d.t, M, cand)) return;      // the body stays at the last free place
  d.M = M; d.val = val; d.cand = cand; d.moved = d.moved || (d.kind === 'size' ? val !== 1 : val !== 0);
  d.centreNow = d.kind === 'move' ? d.c.clone().addScaledVector(ax, val) : d.c.clone();
  for (const m of gzMeshes(d.t.bi)) { m.matrixAutoUpdate = false; m.matrix.copy(M); m.matrixWorldNeedsUpdate = true; }
}
/* the button is let go: now the numbers of the body change, once — a primitive gets its new centre, size or turn,
   a stored body is moved point by point — and the pipeline runs */
function gzUp(e) {
  const d = GZ.drag; if (!d || d.id !== e.pointerId) return; e.preventDefault(); e.stopImmediatePropagation();
  GZ.drag = null; controls.enabled = true; lineGroup.visible = true; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (d.raf) cancelAnimationFrame(d.raf);
  if (!d.moved) { for (const m of gzMeshes(d.t.bi)) { m.matrix.identity(); m.matrixWorldNeedsUpdate = true; } return; }
  const o = d.t.o;
  if (d.t.obj) { if (d.kind === 'move') o.p = d.cand.p.map(v => Math.round(v * 1000) / 1000); else if (d.kind === 'rotate') { o.q = d.cand.q; o.rot = Rot.eulerFromFrame(Rot.frameFromQuat(o.q)); } }
  else gzApplyStored(o, d.M, d.kind === 'size' ? d.val : 1);
  commit(); rebuild(); gzCrossings(true);
}
/* a stored body is moved for good: its points, the cards of its patches and the seams between them */
function gzApplyStored(fb, M, scale) {
  const v = new THREE.Vector3(), pt = a => { v.set(a[0], a[1], a[2]).applyMatrix4(M); return [v.x, v.y, v.z].map(x => Math.round(x * 1e6) / 1e6); }, R = new THREE.Matrix3().setFromMatrix4(M), dir = a => { v.set(a[0], a[1], a[2]).applyMatrix3(R).normalize(); return [v.x, v.y, v.z].map(x => Math.round(x * 1e9) / 1e9); };
  for (let i = 0; i < fb.pos.length; i += 3) { const q = pt([fb.pos[i], fb.pos[i + 1], fb.pos[i + 2]]); fb.pos[i] = q[0]; fb.pos[i + 1] = q[1]; fb.pos[i + 2] = q[2]; }
  const names = new Set(fb.patches.map(p => p.name));
  for (const p of fb.patches) { const c = p.card; if (!c || !CARD_KEYS[c.type]) continue;
    for (const key of ['o', 'c']) if (Array.isArray(c[key])) c[key] = pt(c[key]); for (const key of ['n', 'u', 'a']) if (Array.isArray(c[key])) c[key] = dir(c[key]);
    if (scale !== 1) for (const key of ['d', 'R', 'r']) if (typeof c[key] === 'number') c[key] = Math.round(c[key] * scale * 1e6) / 1e6; }
  const f3 = a => a.map(x => fmt(x)).join(',');
  for (const s of S.foreign.seams || []) { const tk = (s.raw || '').split(/\s+/); if (!names.has(tk[1]) && !names.has(tk[2])) continue;
    s.raw = s.raw.replace(/\b(p0|p1|c)=(-?[\d.eE+-]+),(-?[\d.eE+-]+),(-?[\d.eE+-]+)/g, (m, k, x, y, z) => `${k}=${f3(pt([+x, +y, +z]))}`).replace(/\ba=(-?[\d.eE+-]+),(-?[\d.eE+-]+),(-?[\d.eE+-]+)/g, (m, x, y, z) => `a=${f3(dir([+x, +y, +z]))}`).replace(/\bd=(-?[\d.eE+-]+)/g, (m, x) => `d=${fmt(+x * scale)}`); }
  delete fb.ctr;
  if (fb.bool) for (const k of ['a', 'b']) gzMovePart(fb.bool[k], M, scale);      // its operands go with it
}
/* an operand kept inside a Boolean result is moved with the result: a primitive by its centre and turn, a stored body point by point */
function gzMovePart(P, M, scale) {
  if (P.kind === 'body') { const keep = S.foreign.seams; S.foreign.seams = []; try { gzApplyStored(P.fb, M, scale); } finally { S.foreign.seams = keep; } return; }
  const o = P.o, v = new THREE.Vector3(o.p[0], o.p[1], o.p[2]).applyMatrix4(M), R = new THREE.Matrix4().extractRotation(M), qm = new THREE.Quaternion().setFromRotationMatrix(R);
  o.p = [v.x, v.y, v.z].map(x => Math.round(x * 1e6) / 1e6); o.q = qmul([qm.x, qm.y, qm.z, qm.w], o.q || Rot.quatFromEuler(o.rot || [0, 0, 0])).map(x => Math.round(x * 1e9) / 1e9); o.rot = Rot.eulerFromFrame(Rot.frameFromQuat(o.q));
}
/* the history in words ("cyl ⌀36×40 − sph ⌀40"), for the board and for the list */
const gzPartText = P => P.kind === 'obj' ? describe(P.o) : P.fb.bool ? '(' + gzBoolText(P.fb.bool) + ')' : 'stored body';
const gzBoolText = B => gzPartText(B.a) + (B.op === 'cut' ? ' − ' : B.op === 'join' ? ' + ' : ' ∩ ') + gzPartText(B.b);
/* short signatures: of a stored body, and (below) of a primitive — the same signature means the same body in the same place */
const gzBodySig = b => JSON.stringify([b.pos.length, b.pos.slice(0, 9), b.patches.length]);
/* a tool that has just been applied to a body still sits in the place it was cut from: that is not a new crossing */
const gzApplied = (tool, obj) => { const B = obj && obj.bool; if (!B || B.op === 'join' || !tool) return false; return B.b.kind === 'obj' ? tool.kind !== undefined && !tool.pos && gzPartSig(B.b.o) === gzPartSig(tool) : !!tool.pos && gzBodySig(B.b.fb) === gzBodySig(tool); };
const gzPartSig = o => JSON.stringify([o.kind, o.size, o.p, o.q || Rot.quatFromEuler(o.rot || [0, 0, 0]), o.edge, o.features]);
/* Take apart: the result leaves, its two operands come back as they were kept — the first as an object, the second as a tool */
function gzTakeApart(fb) {
  const B = fb.bool; if (!B) return; const i = S.foreign.bodies.indexOf(fb); if (i < 0) return; S.foreign.bodies.splice(i, 1);
  const gone = new Set(fb.patches.map(p => p.name)); S.foreign.seams = (S.foreign.seams || []).filter(sm => { const tk = (sm.raw || '').split(/\s+/); return !gone.has(tk[1]) && !gone.has(tk[2]); }); S.foreign.edges = (S.foreign.edges || []).filter(e => !gone.has(e.a) && !gone.has(e.b));
  const usedNames = new Set(); for (const b of S.foreign.bodies) for (const pt of b.patches) usedNames.add(pt.name); for (const o of S.objects) for (const n of Object.values(nameSet(o, o.kind))) usedNames.add(n);
  let first = null;
  for (const k of ['a', 'b']) { const P = JSON.parse(JSON.stringify(B[k]));
    if (P.kind === 'obj') { const o = P.o; if (k === 'b' && S.objects.some(x => x.role === 'tool' && gzPartSig(x) === gzPartSig(o))) continue;      // that very tool is still on the bench
      o.id = S.nextId++; delete o.names; for (const f of o.features || []) { delete f.fid; delete f.pid; if (f.pattern) delete f.pattern.gid; } if (k === 'b') o.role = 'tool'; S.objects.push(o); if (!first) first = () => select(o.id); }
    else { const b = P.fb; for (const pt of b.patches) { let n = pt.name, c = 2; while (usedNames.has(n)) n = pt.name + '_' + c++; pt.name = n; usedNames.add(n); } if (b.bool && b.patches.length) b.bool.resultName = b.patches[0].name; if (k === 'b') b.role = 'tool'; S.foreign.bodies.push(b); const at = S.foreign.bodies.length - 1; if (!first) first = () => selectForeign(at); } }
  SEL = null; SELF = -1; commit(); rebuild(); if (first) first(); gzCrossings(true);
}
/* ── Object / Tool, and the board of the Boolean operations ── */
/* make a body a tool or an object again (one step of Undo) */
function gzSetRole(o, role) { if (role === 'tool') o.role = 'tool'; else { delete o.role; delete o.op; } commit(); renderChips(); evaluateAndDraw(); gzCrossings(true); }
const GZ_OPS = [['cut', '−', 'Cut', 'take the tool away from the objects it enters'], ['join', '+', 'Join', 'make the tool and the objects one body'], ['common', '∩', 'Common', 'keep only what is inside both']];
/* the board: opened by two clicks on the ball. The body becomes the tool; a click on an operation runs it under the
   running line. On a body that is itself a result the board also offers Take apart and says how it was made. */
function gzBoolBoard(t) {
  const had = !t.obj && t.o.bool ? t.o : null; if (t.o.role !== 'tool') gzSetRole(t.o, 'tool'); const box = $('boolBox');
  box.innerHTML = `<div class="ttl"><span>Boolean operation of this tool</span><button id="boolClose">×</button></div>` + GZ_OPS.map(([id, sym, name, what]) => `<button class="op" data-op="${id}"><b>${sym}</b> ${name}<i>${what}</i></button>`).join('') + `<div class="note" id="boolNote">Applies to every object the tool crosses. The result is a stored body: its surfaces keep their cards.</div>`;
  box.classList.remove('hide'); $('boolClose').onclick = () => box.classList.add('hide');
  if (had) { const b = document.createElement('button'); b.className = 'op apart'; b.innerHTML = '<b>⇄</b> Take apart<i>get its two parts back, to change them</i>'; b.title = gzBoolText(had.bool); box.insertBefore(b, $('boolNote')); const n = document.createElement('div'); n.className = 'note'; n.textContent = 'made as: ' + gzBoolText(had.bool); box.insertBefore(n, $('boolNote')); b.onclick = () => { box.classList.add('hide'); delete had.role; gzTakeApart(had); }; }
  box.querySelectorAll('button.op[data-op]').forEach(b => b.onclick = async () => { $('boolNote').textContent = 'working…'; $('boolNote').classList.remove('bad'); box.querySelectorAll('button.op').forEach(x => x.disabled = true);
    try { const msg = await busy(() => gzBoolean(b.dataset.op)); if (msg) { $('boolNote').textContent = msg; $('boolNote').classList.add('bad'); box.querySelectorAll('button.op').forEach(x => x.disabled = false); } else box.classList.add('hide'); }
    catch (err) { console.error(err); $('boolNote').textContent = 'failed: ' + err.message; $('boolNote').classList.add('bad'); box.querySelectorAll('button.op').forEach(x => x.disabled = false); } });
}
/* ── the Boolean operation itself ──
   Done on the final meshes of the two bodies (rounded edges and features included) with Manifold, patch by patch:
   every triangle of the result knows which patch of which body it was cut from, so the result keeps the patches and
   their cards — a plane stays a plane, a cylinder a cylinder, and the faces left by the tool carry the tool's cards
   (turned inside out by Cut). The result is a stored body: the recipe of Snark has no Boolean step yet. */
let GZ_MF = null;                            // Manifold (WebAssembly), started at the first Boolean operation
async function gzManifold() {
  if (GZ_MF) return GZ_MF; if (!window.__MF || !window.__MFWASM) return null;
  const w = await window.__MF({ wasmBinary: Uint8Array.from(atob(window.__MFWASM), c => c.charCodeAt(0)) }); w.setup(); return GZ_MF = w;
}
async function gzBoolean(op) {
  const t = gzTarget(); if (!t || t.o.role !== 'tool') return 'select a tool first';
  const crossed = []; PIPE.rec.bodies.forEach((b, bi) => { if (bi !== t.bi && roleOfBody(b) !== 'tool' && ownerOf(b) && !gzApplied(t.o, ownerOf(b)) && gzCross(t.bi, undefined, bi, []) ) crossed.push(ownerOf(b)); });
  if (!crossed.length) return 'the tool does not cross any object';
  const MF = await gzManifold(); if (!MF) return 'the Boolean library is not loaded'; const { Manifold, Mesh } = MF;
  const blank = Object.fromEntries(Object.keys(S.foreign).map(k => [k, Array.isArray(S.foreign[k]) ? [] : S.foreign[k]]));
  const chordB = Math.max(VIEW.chord * 4, 0.2);      // the result is only a picture (the exact shape is its two operands, kept with it), so a coarser mesh will do
  const finalOf = o => buildFinalDoc({ ...S, objects: S.objects.includes(o) ? [o] : [], foreign: { ...blank, bodies: S.objects.includes(o) ? [] : [o] } }, chordB);
  const opnd = o => { const c = JSON.parse(JSON.stringify(o)); delete c.role; delete c.op; delete c.issues; delete c.ctr; return S.objects.includes(o) ? { kind: 'obj', o: c } : { kind: 'body', fb: c }; }, partB = opnd(t.o);
  const openEdges = F => { const m = new Map(); for (const f of F) for (let e = 0; e < f.length; e++) { const a = f[e], b = f[(e + 1) % f.length], k = a < b ? a + ',' + b : b + ',' + a; m.set(k, (m.get(k) || 0) + 1); } let n = 0; for (const c of m.values()) if (c !== 2) n++; return n; };
  /* Manifold takes its points in single precision: the bodies are moved to the origin for it (C0 is the centre of the
     tool), and the points of the result are then matched, within WELD, to the exact points of the bodies it was made from.
     Every patch goes in as one "run" of triangles with its own number; the result says from which run each triangle came. */
  const C0 = gzBox(t.bi, undefined).getCenter(new THREE.Vector3()).toArray().map(Math.round), WELD = 1e-4, seeds = [], label = new Map();
  const solidOf = (doc, src) => { const who = src === 'T' ? 'the tool' : 'an object'; seeds.push(doc.pos);
    if (openEdges(doc.faces.map(f => f.v))) throw new Error(who + ' is not a closed body');
    const runs = [], tri = []; for (const [name, pt] of doc.patches) { const s = tri.length; for (const fi of pt.faces) { const v = doc.faces[fi].v; for (let i = 1; i + 1 < v.length; i++) tri.push(v[0], v[i], v[i + 1]); } if (tri.length > s) runs.push([s, { src: op === 'join' ? 'O' : src, name, card: pt.card }]); }
    const vp = new Float32Array(doc.pos.length); for (let i = 0; i < vp.length; i++) vp[i] = doc.pos[i] - C0[i % 3];
    const id0 = Manifold.reserveIDs(runs.length), ri = new Uint32Array(runs.length + 1), ro = new Uint32Array(runs.length); runs.forEach(([s, u], k) => { ri[k] = s; ro[k] = id0 + k; label.set(id0 + k, u); }); ri[runs.length] = tri.length;
    let m; try { const mesh = new Mesh({ numProp: 3, vertProperties: vp, triVerts: new Uint32Array(tri), runIndex: ri, runOriginalID: ro }); mesh.merge(); m = new Manifold(mesh); } catch (e) { throw new Error(who + ' is not a valid solid'); }
    if (String(m.status()) !== 'NoError' || m.isEmpty()) throw new Error(who + ' is not a valid solid (' + m.status() + ')'); return m;
  };
  const run = (a, b) => op === 'cut' ? a.subtract(b) : op === 'join' ? a.add(b) : a.intersect(b);
  const flip = c => { if (!c || op !== 'cut') return c; const d = JSON.parse(JSON.stringify(c)); if (d.type === 'plane') d.n = d.n.map(x => -x); else if (d.side) d.side = d.side === 'in' ? 'out' : 'in'; return d; };
  const toolSolid = solidOf(finalOf(t.o), 'T'), used = new Set(PIPE.doc2.patches.keys()), made = [], gone = new Set(); let serial = 1, acc = null;
  const bodyOf = man => {                    // the result of Manifold → a stored body
    const mesh = man.getMesh(), p = mesh.vertProperties, np = mesh.numProp, tv = mesh.triVerts, pos = [], by = new Map();
    const cell = new Map(), ck = (a, b, c) => (a * 73856093 ^ b * 19349663 ^ c * 83492791) | 0, cf = v => Math.floor(v / (2 * WELD));
    const point = (x, y, z) => { const a = cf(x), b = cf(y), c = cf(z); let best = -1, bd = WELD * WELD;
      for (let i = a - 1; i <= a + 1; i++) for (let j = b - 1; j <= b + 1; j++) for (let k = c - 1; k <= c + 1; k++) { const L = cell.get(ck(i, j, k)); if (L) for (const v of L) { const d = (pos[3 * v] - x) ** 2 + (pos[3 * v + 1] - y) ** 2 + (pos[3 * v + 2] - z) ** 2; if (d < bd) { bd = d; best = v; } } }
      if (best >= 0) return best; const v = pos.length / 3; pos.push(x, y, z); const key = ck(a, b, c), L = cell.get(key); if (L) L.push(v); else cell.set(key, [v]); return v; };
    for (const sp of seeds) for (let i = 0; i + 2 < sp.length; i += 3) point(sp[i], sp[i + 1], sp[i + 2]);       // the exact points first: the result snaps to them
    const r6 = v => Math.round(v * 1e6) / 1e6, seen = new Int32Array(p.length / np).fill(-1), vid = i => seen[i] >= 0 ? seen[i] : (seen[i] = point(r6(p[np * i] + C0[0]), r6(p[np * i + 1] + C0[1]), r6(p[np * i + 2] + C0[2])));
    for (let r = 0; r < mesh.runOriginalID.length; r++) { const u = label.get(mesh.runOriginalID[r]); if (!u) continue; const key = u.src + '|' + u.name; let L = by.get(key); if (!L) by.set(key, L = { u, faces: [] });
      for (let i = mesh.runIndex[r]; i + 2 < mesh.runIndex[r + 1]; i += 3) { const f = [vid(tv[i]), vid(tv[i + 1]), vid(tv[i + 2])]; if (f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]) L.faces.push(f); } }
    /* Matching the points can leave a long side beside two short ones (a T-joint: no gap in space, but the mesh is not
       closed edge to edge). Every such long side is cut at the points that lie on it; its triangle becomes a fan. */
    for (let pass = 0; pass < 6; pass++) {
      const use = new Map(), all = [...by.values()]; for (const L of all) for (const f of L.faces) for (let e = 0; e < 3; e++) { const x = f[e], y = f[(e + 1) % 3], k = x < y ? x + ',' + y : y + ',' + x; use.set(k, (use.get(k) || 0) + 1); }
      const loose = new Set(); for (const [k, n] of use) if (n === 1) { const [x, y] = k.split(','); loose.add(+x); loose.add(+y); } if (!loose.size) break;
      const P = v => [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]], pts = [...loose].map(v => [v, P(v)]); let fixed = 0;
      for (const L of all) { const out = []; for (const f of L.faces) { let done = false;
        for (let e = 0; e < 3 && !done; e++) { const x = f[e], y = f[(e + 1) % 3], z = f[(e + 2) % 3]; if (use.get(x < y ? x + ',' + y : y + ',' + x) !== 1) continue;
          const A = P(x), B = P(y), d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]; if (l2 < 1e-12) continue; const on = [];
          for (const [v, q] of pts) { if (v === x || v === y || v === z) continue; const w = [q[0] - A[0], q[1] - A[1], q[2] - A[2]], tt = (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / l2; if (!(tt * tt * l2 > 9e-8 && (1 - tt) * (1 - tt) * l2 > 9e-8) || tt <= 0 || tt >= 1) continue; if (Math.hypot(w[0] - tt * d[0], w[1] - tt * d[1], w[2] - tt * d[2]) < 2e-4) on.push([tt, v]); }
          if (!on.length) continue; on.sort((p1, p2) => p1[0] - p2[0]); let prev = x; for (const [, v] of on) { out.push([prev, v, z]); prev = v; } out.push([prev, y, z]); done = true; fixed++; }
        if (!done) out.push(f); } L.faces = out; }
      if (!fixed) break;
    }
    const patches = []; for (const { u, faces } of by.values()) { if (!faces.length) continue; let name = u.name; if (u.src === 'T' || used.has(name) && !gone.has(name)) { do name = (op === 'cut' ? 'cut' : op === 'join' ? 'join' : 'com') + serial++ + '_' + u.name.replace(/^b\d+_/, ''); while (used.has(name)); } used.add(name); patches.push({ name, card: u.src === 'T' ? flip(u.card) : u.card, note: '', faces }); }
    const nu = new Int32Array(pos.length / 3).fill(-1), out = []; for (const pt of patches) for (const f of pt.faces) for (let i = 0; i < 3; i++) { let v = nu[f[i]]; if (v < 0) { v = nu[f[i]] = out.length / 3; out.push(pos[3 * f[i]], pos[3 * f[i] + 1], pos[3 * f[i] + 2]); } f[i] = v; }
    return { pos: out, patches, issues: [] };
  };
  const take = o => { for (const b of PIPE.rec.bodies) if (ownerOf(b) === o) for (const nm of Array.isArray(b.names) ? b.names : Object.values(b.names || {})) gone.add(nm); };
  if (op === 'join') { acc = toolSolid; let last = partB, fb = null; for (const o of crossed) { take(o); acc = run(solidOf(finalOf(o), 'O'), acc); fb = bodyOf(acc); fb.bool = { op, chord: chordB, a: opnd(o), b: last }; last = { kind: 'body', fb }; } take(t.o); made.push(fb); }
  else for (const o of crossed) { take(o); const fb = bodyOf(run(solidOf(finalOf(o), 'O'), toolSolid)); fb.bool = { op, chord: chordB, a: opnd(o), b: partB }; made.push(fb); }
  if (made.some(b => !b.patches.length)) return op === 'common' ? 'nothing is inside both' : 'nothing is left';
  // the objects that were worked on leave the scene (the tool too, when joined); the results come in as stored bodies
  const leave = new Set(crossed); if (op === 'join') leave.add(t.o);
  S.objects = S.objects.filter(o => !leave.has(o)); S.foreign.bodies = (S.foreign.bodies || []).filter(o => !leave.has(o));
  S.foreign.seams = (S.foreign.seams || []).filter(sm => { const tk = (sm.raw || '').split(/\s+/); return !gone.has(tk[1]) && !gone.has(tk[2]); });
  S.foreign.edges = (S.foreign.edges || []).filter(e => !gone.has(e.a) && !gone.has(e.b));
  S.foreign.bodies.push(...made); const open = made.reduce((n, b) => n + openEdges(b.patches.flatMap(pt => pt.faces)), 0);
  if (op === 'join') { SEL = null; SELF = S.foreign.bodies.length - 1; }
  commit(); rebuild(); gzCrossings(true);
  return open ? `done, but the result has ${open} open edges` : '';
}
function gzChip(c, o, pick) {              // a row of the list: orange when a tool, with a small square that switches the role
  if (o.role === 'tool') c.classList.add('tool');
  const b = document.createElement('button'); b.className = 'role'; b.title = o.role === 'tool' ? 'Tool → Object' : 'Object → Tool'; b.onclick = e => { e.stopPropagation(); gzSetRole(o, o.role === 'tool' ? 'object' : 'tool'); }; c.appendChild(b);
  if (pick) c.onclick = pick;
  if (o.bool) { const m = document.createElement('span'); m.className = 'boolMark'; m.textContent = o.bool.op === 'cut' ? '−' : o.bool.op === 'join' ? '+' : '∩'; c.title = gzBoolText(o.bool); c.insertBefore(m, b); }
}
/* the triangles of drawn body bi that touch the box, in world coordinates (MO: the matrix of a drag being tried),
   each with its own box; sorted along X */
const gzTris = (bi, box, MO) => { const out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const m of gzMeshes(bi)) { const p = m.geometry.getAttribute('position'), ix = m.geometry.getIndex(), n = ix ? ix.count : p.count, M = MO !== undefined ? MO : m.matrixAutoUpdate ? null : m.matrix;
      for (let i = 0; i + 2 < n; i += 3) { a.fromBufferAttribute(p, ix ? ix.getX(i) : i); b.fromBufferAttribute(p, ix ? ix.getX(i + 1) : i + 1); c.fromBufferAttribute(p, ix ? ix.getX(i + 2) : i + 2); if (M) { a.applyMatrix4(M); b.applyMatrix4(M); c.applyMatrix4(M); }
        const lo = [Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z)], hi = [Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z)];
        if (hi[0] < box.min.x || lo[0] > box.max.x || hi[1] < box.min.y || lo[1] > box.max.y || hi[2] < box.min.z || lo[2] > box.max.z) continue; out.push({ a: a.clone(), b: b.clone(), c: c.clone(), lo, hi }); } }
    return out.sort((x, y) => x.lo[0] - y.lo[0]); };
/* where triangle t is cut by the plane through P with normal N: the two end points of the cut, or null when t does
   not pass through the plane */
const gzSlice = (t, P, N) => { const v = [t.a, t.b, t.c], s = v.map(p => N.dot(p) - N.dot(P)), pts = []; if (!(Math.max(...s) > 1e-4 && Math.min(...s) < -1e-4)) return null;      // it must pass through the other's plane: lying on it, or touching it, is not a crossing
  for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; if (Math.abs(s[i]) <= 1e-7) pts.push(v[i].clone()); if ((s[i] > 1e-7 && s[j] < -1e-7) || (s[i] < -1e-7 && s[j] > 1e-7)) pts.push(v[i].clone().lerp(v[j], s[i] / (s[i] - s[j]))); } return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null; };
/* the crossing of two drawn bodies: its segments are added to seg; with seg === null the answer is only yes or no
   (null: too many triangles to tell) */
/* the normal of a triangle and its plane, worked out once; and whether triangle u has points on both sides of the
   plane of t (the same rule as in gzSlice, on plain numbers) */
const gzNormal = t => { if (t.n === undefined) { const n = t.b.clone().sub(t.a).cross(t.c.clone().sub(t.a)); if (n.lengthSq() < 1e-16) t.n = null; else { t.n = n.normalize(); t.d = n.dot(t.a); } } return t.n; };
const gzSides = (t, u) => { const n = t.n, s0 = n.x * u.a.x + n.y * u.a.y + n.z * u.a.z - t.d, s1 = n.x * u.b.x + n.y * u.b.y + n.z * u.b.z - t.d, s2 = n.x * u.c.x + n.y * u.c.y + n.z * u.c.z - t.d; return Math.max(s0, s1, s2) > 1e-4 && Math.min(s0, s1, s2) < -1e-4; };
function gzCross(ti, Mt, oi, seg) {
  const mt = gzMeshes(ti)[0], mo = gzMeshes(oi)[0]; if (!mt || !mo) return false;
  const tb = gzBox(ti, Mt !== undefined ? Mt : mt.matrixAutoUpdate ? null : mt.matrix), ob = gzBox(oi, mo.matrixAutoUpdate ? null : mo.matrix), common = tb.clone().intersect(ob); if (common.isEmpty()) return false; common.expandByScalar(1e-6);
  const A = gzTris(ti, common, Mt), B = gzTris(oi, common); if (!A.length || !B.length) return false;
  /* B is put into a grid of cells about the size of its triangles; a triangle of A is then tried only against those
     of B whose cells its box touches — dense bodies (features, imported meshes) stay fast, with no limit on their size */
  let sum = 0; for (const u of B) sum += Math.max(u.hi[0] - u.lo[0], u.hi[1] - u.lo[1], u.hi[2] - u.lo[2]); const h = Math.max(sum / B.length * 1.5, 1e-6), o = [common.min.x, common.min.y, common.min.z];
  const dim = [common.max.x - o[0], common.max.y - o[1], common.max.z - o[2]].map(d => Math.min(64, Math.max(1, Math.ceil(d / h)))), cs = [common.max.x - o[0], common.max.y - o[1], common.max.z - o[2]].map((d, i) => Math.max(d / dim[i], 1e-9));
  const ci = (v, i) => Math.min(dim[i] - 1, Math.max(0, Math.floor((v - o[i]) / cs[i]))), cells = new Map();
  B.forEach((u, k) => { u.k = k; for (let x = ci(u.lo[0], 0); x <= ci(u.hi[0], 0); x++) for (let y = ci(u.lo[1], 1); y <= ci(u.hi[1], 1); y++) for (let z = ci(u.lo[2], 2); z <= ci(u.hi[2], 2); z++) { const key = (x * 64 + y) * 64 + z; let L = cells.get(key); if (!L) cells.set(key, L = []); L.push(u); } });
  const stamp = new Int32Array(B.length).fill(-1); let ai = -1;
  for (const t of A) { ai++; for (let x = ci(t.lo[0], 0); x <= ci(t.hi[0], 0); x++) for (let y = ci(t.lo[1], 1); y <= ci(t.hi[1], 1); y++) for (let z = ci(t.lo[2], 2); z <= ci(t.hi[2], 2); z++) { const L = cells.get((x * 64 + y) * 64 + z); if (!L) continue; for (const u of L) { if (stamp[u.k] === ai) continue; stamp[u.k] = ai;
    if (u.lo[0] > t.hi[0] || u.hi[0] < t.lo[0] || u.hi[1] < t.lo[1] || u.lo[1] > t.hi[1] || u.hi[2] < t.lo[2] || u.lo[2] > t.hi[2]) continue;
    const nA = gzNormal(t), nB = gzNormal(u); if (!nA || !nB || !gzSides(t, u) || !gzSides(u, t)) continue;      // most pairs end here, with nothing allocated
    const dir = nA.clone().cross(nB); if (dir.lengthSq() < 1e-12) continue; dir.normalize(); const sA = gzSlice(t, u.a, nB), sB = gzSlice(u, t.a, nA); if (!sA || !sB) continue;
    const ref = sA[0], ia = [0, sA[1].clone().sub(ref).dot(dir)].sort((x, y) => x - y), ib = sB.map(p => p.clone().sub(ref).dot(dir)).sort((x, y) => x - y), lo = Math.max(ia[0], ib[0]), hi = Math.min(ia[1], ib[1]); if (hi - lo < (seg ? 1e-6 : 1e-3)) continue;
    if (!seg) return true; const p = ref.clone().addScaledVector(dir, lo), q = ref.clone().addScaledVector(dir, hi); seg.push(p.x, p.y, p.z, q.x, q.y, q.z); } } }
  return seg ? seg.length > 0 : false;
}
/* ── where a tool crosses an object: the red lines (triangle against triangle, only inside the common box) ── */
function gzCrossings(force) {
  const now = performance.now(), tools = [], objs = [];
  PIPE.rec.bodies.forEach((b, bi) => { (roleOfBody(b) === 'tool' ? tools : objs).push(bi); });
  const sig = tools.length ? bodyGroup.children.map(m => m.uuid + (m.matrixAutoUpdate ? '' : m.matrix.elements.map(x => x.toFixed(3)).join(','))).join('|') + tools.join(',') : '';
  if (!force && (sig === GZ.sig || now - GZ.lastX < Math.max(120, 4 * (GZ.xCost || 0)))) return; GZ.sig = sig; const seg = [];      // heavy bodies: the lines are redrawn less often, so that the drag stays light
  const crossedNow = new Set(); for (const ti of tools) for (const oi of objs) { if (gzApplied(ownerOf(PIPE.rec.bodies[ti]), ownerOf(PIPE.rec.bodies[oi]))) continue; const n0 = seg.length; gzCross(ti, undefined, oi, seg); if (seg.length > n0) crossedNow.add(oi); }
  for (const m of bodyGroup.children) { if (!m.isMesh || !m.material || !PIPE.rec.bodies[m.userData.body] || roleOfBody(PIPE.rec.bodies[m.userData.body]) === 'tool') continue;      // an object that a tool has entered: a little see-through, so that the crossing shows
    const x = crossedNow.has(m.userData.body); if (!!m.userData.seeThrough !== x) { m.userData.seeThrough = x; m.material.transparent = x; m.material.opacity = x ? 0.62 : 1; m.material.depthWrite = !x; m.material.needsUpdate = true; } }
  GZ.xLines.geometry.dispose(); GZ.xLines.geometry = new THREE.BufferGeometry(); GZ.xLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); GZ.xLines.visible = seg.length > 0 && VIEW.mode === 'snark'; GZ.lastX = performance.now(); GZ.xCost = GZ.lastX - now;
}
gzBuild();
canvas.addEventListener('pointerdown', gzDown, true); canvas.addEventListener('pointermove', gzMove, true); canvas.addEventListener('pointerup', gzUp, true); canvas.addEventListener('pointercancel', gzUp, true);
/* for tests: where a handle is on the screen, and the state in a few numbers */
window.__gz = {
  screen(kind, k) { gzUpdate(); const h = GZ.targets.find(t => t.userData.gz.kind === kind && t.userData.gz.axis === k), p = new THREE.Vector3(); h.getWorldPosition(p); if (kind === 'rotate') { const a = [0, 1, 2].filter(x => x !== k); p.copy(GZ.group.position); p.setComponent(a[0], p.getComponent(a[0]) - 0.566 * GZ.group.scale.x); p.setComponent(a[1], p.getComponent(a[1]) - 0.566 * GZ.group.scale.x); } p.project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; },
  axisPx(k) { gzUpdate(); const c = GZ.group.position.clone(), p = c.clone().project(camera), q = c.clone().addScaledVector(GZ_AXIS[k], GZ.group.scale.x).project(camera), r = canvas.getBoundingClientRect(); return { x: (q.x - p.x) * r.width / 2, y: -(q.y - p.y) * r.height / 2 }; },
  refresh(id) { commit(); rebuild(); select(id); },
  vols() { const d = PIPE.doc2; return PIPE.rec.bodies.map(b => { let v = 0; const em = new Map(), kinds = {}; for (const fi of b.faces) { const f = d.faces[fi].v, P = f.map(k => [d.pos[3 * k], d.pos[3 * k + 1], d.pos[3 * k + 2]]); for (let i = 1; i + 1 < P.length; i++) { const [A, B, C] = [P[0], P[i], P[i + 1]]; v += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6; } f.forEach((x, i) => { const y = f[(i + 1) % f.length], k = x < y ? x + ',' + y : y + ',' + x; em.set(k, (em.get(k) || 0) + 1); }); const c = d.patches.get(d.faces[fi].patch).card; }
      for (const nm of Array.isArray(b.names) ? b.names : Object.values(b.names || {})) { const c = d.patches.get(nm)?.card, k = c ? c.type + (c.side === 'in' ? '(in)' : '') : 'none'; kinds[k] = (kinds[k] || 0) + 1; }
      let open = 0; for (const n of em.values()) if (n !== 2) open++; return { kind: b.kind, role: roleOfBody(b), vol: Math.round(v * 100) / 100, open, patches: kinds }; }); },
  dbg() { const t = gzTarget(), r3 = a => a.map(x => Math.round(x * 100) / 100); return { sel: t ? (t.obj ? 'obj' + t.o.id : 'stored' + SELF) : null, p: t ? r3(t.obj ? t.o.p : t.o.ctr ? t.o.ctr.slice(0, 3) : gzCentre(t).toArray()) : null, size: t && t.obj ? r3(t.o.size) : null, rot: t && t.obj ? r3(Rot.eulerFromFrame(Rot.frameFromQuat(t.o.q || Rot.quatFromEuler(t.o.rot)))) : null, role: t ? t.o.role || 'object' : null, op: t ? t.o.op || null : null, red: GZ.xLines.geometry.getAttribute('position') ? GZ.xLines.geometry.getAttribute('position').count / 2 : 0, bodies: PIPE.rec.bodies.length, errors: PIPE.issues.filter(i => i.level === 'error' || i.level === 'boojum').length, undo: HIST.at }; },
};
