/* SnarkScan_10: the round scanner. In Sections, a bore is chosen (a button, or a click on its axis in the view); a
   half-plane that holds the axis turns round it with a slider. The points of the scan lying in that half-plane are
   lit in the view and laid out flat beside it: along the axis × from the axis — the profile of the hole as this one
   turn of the scanner saw it, over the profile gathered from the whole turn (grey) and the steps found (colour). */
const C10 = { b: -1, th: 0, w: 0.5, cache: null, group: null }; window.__c10 = C10;
function c10Frame(b) { const d = b.d, t = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; let e1 = [d[1] * t[2] - d[2] * t[1], d[2] * t[0] - d[0] * t[2], d[0] * t[1] - d[1] * t[0]]; const l = Math.hypot(...e1); e1 = e1.map(v => v / l); return [e1, [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]]]; }
function c10Cache(bi) {
  if (C10.cache && C10.cache.bi === bi && C10.cache.rec === SCAN.rec) return C10.cache;
  const b = SCAN.rec.bores[bi], [e1, e2] = c10Frame(b), P = SCAN.P, R = Math.max(...b.raw.steps.map(s => s.d / 2), 2) * 1.8 + 3;
  const s0 = Math.min(b.raw.t0, ...b.raw.steps.map(s => s.t0)) - 6, s1 = Math.max(b.raw.t1, ...b.raw.steps.map(s => s.t1)) + 6, T = [], RHO = [], TH = [], IDX = [];
  for (let i = 0; i < SCAN.n; i++) { const w0 = P[3 * i] - b.a[0], w1 = P[3 * i + 1] - b.a[1], w2 = P[3 * i + 2] - b.a[2], t = w0 * b.d[0] + w1 * b.d[1] + w2 * b.d[2]; if (t < s0 || t > s1) continue; const u = w0 * e1[0] + w1 * e1[1] + w2 * e1[2], v = w0 * e2[0] + w1 * e2[1] + w2 * e2[2], r = Math.hypot(u, v); if (r > R) continue; T.push(t); RHO.push(r); TH.push(Math.atan2(v, u)); IDX.push(i); }
  return (C10.cache = { bi, rec: SCAN.rec, e1, e2, R, s0, s1, T: Float32Array.from(T), RHO: Float32Array.from(RHO), TH: Float32Array.from(TH), IDX: Int32Array.from(IDX) });
}
function c10Slice() {     // the points in the turning half-plane: on its side of the axis, within C10.w mm of it
  const c = c10Cache(C10.b), th = C10.th * Math.PI / 180, out = [];
  for (let i = 0; i < c.T.length; i++) { const dth = c.TH[i] - th, s = Math.sin(dth), co = Math.cos(dth); if (co > 0 && Math.abs(c.RHO[i] * s) < C10.w) out.push(i); }
  return out;
}
function c10RoundScene() {
  if (C10.group) { SCAN.group.remove(C10.group); clearGroup(C10.group); C10.group = null; }
  const bores = SCAN.rec && SCAN.rec.bores; if (SCAN.tool !== 'sections' || !bores || !bores.length) return;
  const G = new THREE.Group(); C10.group = G; SCAN.group.add(G);
  bores.forEach((b, bi) => { const s0 = Math.min(b.raw.t0, ...b.raw.steps.map(s => s.t0)) - 5, s1 = Math.max(b.raw.t1, ...b.raw.steps.map(s => s.t1)) + 5, at = s => new THREE.Vector3(...b.a.map((v, i) => v + s * b.d[i]));
    const L = new THREE.Line(new THREE.BufferGeometry().setFromPoints([at(s0), at(s1)]), new THREE.LineDashedMaterial({ color: bi === C10.b ? 0xff9a00 : 0x1f6fd1, dashSize: 3, gapSize: 1.5, depthTest: false })); L.computeLineDistances(); L.renderOrder = 11; L.userData.c10 = bi; G.add(L); });
  if (C10.b < 0 || !bores[C10.b]) return;
  const b = bores[C10.b], c = c10Cache(C10.b), th = C10.th * Math.PI / 180, dir = [0, 1, 2].map(i => Math.cos(th) * c.e1[i] + Math.sin(th) * c.e2[i]);
  const corner = (s, r) => b.a.map((v, i) => v + s * b.d[i] + r * dir[i]), q = [corner(c.s0, 0), corner(c.s1, 0), corner(c.s1, c.R), corner(c.s0, c.R)];
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]], 3));
  G.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xff9a00, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
  const sl = c10Slice(), pp = new Float32Array(sl.length * 3); sl.forEach((k, j) => { const i = c.IDX[k]; pp[3 * j] = SCAN.P[3 * i]; pp[3 * j + 1] = SCAN.P[3 * i + 1]; pp[3 * j + 2] = SCAN.P[3 * i + 2]; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pp, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe000, size: 2.5, sizeAttenuation: false, depthTest: false })); pts.renderOrder = 12; G.add(pts);
}
function c10DrawFlat(cv) {
  if (!cv || C10.b < 0) return; const b = SCAN.rec.bores[C10.b], c = c10Cache(C10.b), x = cv.getContext('2d'), W = cv.width, H = cv.height, m = 22;
  const sx = s => m + (s - c.s0) / (c.s1 - c.s0) * (W - 2 * m), sy = r => H - m - r / c.R * (H - 2 * m);
  x.clearRect(0, 0, W, H); x.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg') || '#fff'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#1f6fd1'; x.setLineDash([6, 3]); x.beginPath(); x.moveTo(m, sy(0)); x.lineTo(W - m, sy(0)); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(120,120,130,0.18)'; for (let i = 0; i < c.T.length; i += 3) x.fillRect(sx(c.T[i]), sy(c.RHO[i]), 1, 1);       // the whole turn, faint
  x.strokeStyle = '#7a3fd0'; x.lineWidth = 2; for (const st of b.raw.steps) { x.beginPath(); x.moveTo(sx(st.t0 - 0.25), sy(st.d / 2)); x.lineTo(sx(st.t1 + 0.25), sy(st.d / 2)); x.stroke(); } x.lineWidth = 1;
  x.fillStyle = 'rgba(255,170,0,0.10)'; for (const [g0, g1] of b.raw.gaps) x.fillRect(sx(g0), m, sx(g1) - sx(g0), H - 2 * m);
  x.fillStyle = '#d97a00'; for (const k of c10Slice()) x.fillRect(sx(c.T[k]) - 1, sy(c.RHO[k]) - 1, 2, 2);       // this turn of the scanner
  x.fillStyle = '#666'; x.font = '10px sans-serif'; x.fillText('along the axis →', W - m - 80, H - 6); x.save(); x.translate(10, m + 70); x.rotate(-Math.PI / 2); x.fillText('from the axis →', 0, 0); x.restore();
  x.fillText(`${scNum(c.s0, 0)}`, m, H - 6); x.fillText(`R ${scNum(c.R, 0)}`, 2, m - 6);
}
function c10Html() {
  const bores = SCAN.rec && SCAN.rec.bores; if (!bores || !bores.length) return '';
  return `<div class="ttl">Round scanner (about the axis of a bore)</div><div class="note">Pick a bore here or click its axis (dashed) in the view. A half-plane holding the axis turns round it; the points it meets are lit (yellow) and laid out flat below: along the axis × from the axis. Grey: the whole turn; violet: the steps found; orange band: depth no side saw.</div><div class="row" style="flex-wrap:wrap;gap:4px">` +
    bores.map((b, i) => `<button class="ax c10b${i === C10.b ? ' on' : ''}" data-b="${i}" title="${b.kind} — ${b.status}">${b.steps.map(s => 'Ø' + scNum(s.d, 1)).join('/') || '?'} · ${'XYZ'[b.k]}(${b.at.map(v => scNum(v, 0)).join(',')})</button>`).join('') + '</div>' +
    (C10.b >= 0 ? `<div class="cut"><b>θ</b><input type="range" id="c10th" min="0" max="359" step="1" value="${C10.th}"><input type="number" id="c10thN" step="1" value="${C10.th}"></div><div class="cut"><b>width</b><input type="range" id="c10w" min="0.1" max="3" step="0.1" value="${C10.w}"><span id="c10wN">${scNum(C10.w, 1)} mm</span></div><canvas id="c10flat" width="300" height="220"></canvas><div class="note" id="c10info"></div>` : '');
}
function c10Redraw() { c10RoundScene(); c10DrawFlat($('c10flat')); const el = $('c10info'); if (el && C10.b >= 0) { const b = SCAN.rec.bores[C10.b]; el.innerHTML = `${b.kind}, <i>${b.status}</i>; θ ${C10.th}°: ${c10Slice().length} points in the half-plane.${b.unseen.length ? ' Unseen depth: ' + b.unseen.map(u => scNum(u[0], 1) + '…' + scNum(u[1], 1)).join(', ') + ' mm.' : ''}`; } }
function c10Wire() { if (C10.b >= 0) setTimeout(c10Redraw, 0); }
/* one listener for the whole page, in the capturing phase: the panel is rebuilt often and binds its own handler to
   every button.ax, so ours would be taken over or lost; caught here first, the event goes no further */
document.addEventListener('click', ev => { const btn = ev.target.closest && ev.target.closest('button.c10b'); if (!btn) return; ev.stopPropagation(); ev.preventDefault(); C10.b = +btn.dataset.b; scPanel(); c10RoundScene(); }, true);
document.addEventListener('input', ev => { const t = ev.target; if (!t || !t.id || !t.id.startsWith('c10')) return; ev.stopPropagation();
  if (t.id === 'c10th') { C10.th = +t.value; const n = $('c10thN'); if (n) n.value = C10.th; }
  else if (t.id === 'c10thN') { C10.th = ((Math.round(+t.value) % 360) + 360) % 360; const r = $('c10th'); if (r) r.value = C10.th; }
  else if (t.id === 'c10w') { C10.w = +t.value; const n = $('c10wN'); if (n) n.textContent = scNum(C10.w, 1) + ' mm'; }
  c10Redraw(); }, true);
canvas.addEventListener('click', ev => {      // a click on a dashed axis in Sections chooses that bore
  if (SCAN.tool !== 'sections' || !C10.group) return; const r = canvas.getBoundingClientRect(), rc = new THREE.Raycaster(); rc.params.Line.threshold = 2;
  rc.setFromCamera(new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1), camera);
  const hit = rc.intersectObjects(C10.group.children.filter(o => o.userData.c10 !== undefined), false)[0]; if (!hit) return; C10.b = hit.object.userData.c10; scPanel(); c10RoundScene();
});
