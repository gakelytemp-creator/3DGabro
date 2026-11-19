/* step_snark.mjs — STEP (AP203 / AP214 / AP242 B-rep) → Snark (.snark, mesh=final).  Draft 0.1, 19 November 2026.

   node step_snark.mjs in.step out.snark [chord]

   What a STEP file gives, and what becomes of it:
     a face on a plane, cylinder, cone, sphere or torus   → a patch with its exact card
     neighbouring faces on one and the same surface        → one patch (other programs cut a cylinder in two; Snark does not)
     an edge that is a line or a circle, between two patches → a #@seam
     a face on any other surface (NURBS, revolution, extrusion) → a patch with the card "free": its mesh only
     the mesh                                              → made here, face by face, within the chord asked for
   STEP has no features, edge rules or recipe: recognising those is a later step.

   How a face is meshed: its edges are sampled once (both neighbours get the same points, so the mesh is closed),
   its loops are laid out in the surface's own (u, v), cut open where the surface closes on itself, triangulated
   there, and refined until no triangle strays from the surface by more than the chord.
   No dependencies besides snark_core.js. */
import * as S from '../src/snark_core.js';
const { add, sub, mul, dot, cross, len, unit } = S.vec;
const perp = a => unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), TAU = 2 * Math.PI;
const mod = (x, p) => ((x % p) + p) % p, near = (x, ref, p) => x + p * Math.round((ref - x) / p);

/* ═══════════════════ the text ═══════════════════ */
function parseStep(text) {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, ''); const d0 = s.search(/\bDATA\s*;/); if (d0 < 0) throw new Error('not a STEP file (no DATA section)');
  s = s.slice(s.indexOf(';', d0) + 1);
  let i = 0; const n = s.length, ents = new Map(), ws = () => { while (i < n && s.charCodeAt(i) <= 32) i++; };
  const value = () => {
    ws(); const c = s[i];
    if (c === '(') { i++; const a = []; ws(); if (s[i] === ')') { i++; return a; } for (;;) { a.push(value()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; return a; } throw new Error('STEP: a list does not close near "' + s.slice(i, i + 30) + '"'); } }
    if (c === '#') { const j = ++i; while (i < n && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) i++; return { ref: +s.slice(j, i) }; }
    if (c === "'") { i++; let out = ''; for (;;) { const k = s.indexOf("'", i); if (k < 0) throw new Error('STEP: a text does not close'); if (s[k + 1] === "'") { out += s.slice(i, k + 1); i = k + 2; continue; } out += s.slice(i, k); i = k + 1; return out; } }
    if (c === '$') { i++; return null; } if (c === '*') { i++; return '*'; }
    const w = s.slice(i, i + 80); let m = /^\.[A-Z_0-9]+\./.exec(w); if (m) { i += m[0].length; return m[0]; }
    m = /^[+-]?(\d+\.?\d*|\.\d+)([Ee][+-]?\d+)?/.exec(w); if (m) { i += m[0].length; return +m[0]; }
    m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(w); if (m) { i += m[0].length; ws(); return { type: m[0].toUpperCase(), args: s[i] === '(' ? value() : [] }; }
    throw new Error('STEP: cannot read near "' + w.slice(0, 30) + '"');
  };
  for (;;) {
    ws(); if (i >= n || s.startsWith('ENDSEC', i)) break;
    if (s[i] !== '#') { const k = s.indexOf(';', i); if (k < 0) break; i = k + 1; continue; }
    const id = value().ref; ws(); i++; ws();
    if (s[i] === '(') { i++; const parts = {}; for (;;) { ws(); if (s[i] === ')') { i++; break; } const v = value(); parts[v.type] = v.args; } ents.set(id, { type: 'COMPLEX', parts }); }
    else ents.set(id, value());
    ws(); if (s[i] === ';') i++;
  }
  return ents;
}

/* ═══════════════════ B-splines ═══════════════════ */
const knotVec = (mults, knots) => { const U = []; knots.forEach((k, i) => { for (let m = 0; m < mults[i]; m++) U.push(k); }); return U; };
function basis(U, p, n, t) {          // the p + 1 basis functions that are not zero at t, and the index of the first
  let k = p; while (k < n - 1 && t >= U[k + 1]) k++;
  const N = [1], L = [], R = [];
  for (let j = 1; j <= p; j++) { L[j] = t - U[k + 1 - j]; R[j] = U[k + j] - t; let saved = 0; for (let r = 0; r < j; r++) { const d = R[r + 1] + L[j - r], tmp = d ? N[r] / d : 0; N[r] = saved + R[r + 1] * tmp; saved = L[j - r] * tmp; } N[j] = saved; }
  return { k: k - p, N };
}
const bsCurve = (p, C, U, W) => t => { const { k, N } = basis(U, p, C.length, t); let x = [0, 0, 0], w = 0; for (let j = 0; j <= p; j++) { const ww = N[j] * (W ? W[k + j] : 1); x = add(x, mul(C[k + j], ww)); w += ww; } return mul(x, 1 / w); };
const bsSurf = (p, q, C, U, Vk, W) => (u, v) => {
  const a = basis(U, p, C.length, u), b = basis(Vk, q, C[0].length, v); let x = [0, 0, 0], w = 0;
  for (let i = 0; i <= p; i++) for (let j = 0; j <= q; j++) { const ww = a.N[i] * b.N[j] * (W ? W[a.k + i][b.k + j] : 1); x = add(x, mul(C[a.k + i][b.k + j], ww)); w += ww; }
  return mul(x, 1 / w);
};
/* the parameter of a curve nearest to p, in t0…t1 */
function nearestOn(at, t0, t1, p, n = 96) {
  let bt = t0, bd = Infinity; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, d = len(sub(at(t), p)); if (d < bd) { bd = d; bt = t; } }
  let lo = Math.max(t0, bt - (t1 - t0) / n), hi = Math.min(t1, bt + (t1 - t0) / n);
  for (let k = 0; k < 50; k++) { const a = lo + (hi - lo) / 3, z = hi - (hi - lo) / 3; if (len(sub(at(a), p)) < len(sub(at(z), p))) hi = z; else lo = a; }
  return (lo + hi) / 2;
}

/* ═══════════════════ a whole file ═══════════════════ */
export function stepToSnark(text, opts = {}) {
  opts = { title: 'from STEP', ...opts };
  const E = parseStep(text), log = [], get = r => r && E.get(r.ref); let chord = opts.chord;
  // units
  let scale = 1, deg = false;
  // the units the geometry is written in: those its context names (a file also holds helper units, e.g. the millimetre an inch is defined by)
  const unitRefs = []; for (const e of E.values()) if (e.type === 'COMPLEX' && e.parts.GLOBAL_UNIT_ASSIGNED_CONTEXT) for (const r of e.parts.GLOBAL_UNIT_ASSIGNED_CONTEXT[0] || []) unitRefs.push(get(r));
  for (const e of unitRefs.length ? unitRefs : E.values()) if (e && e.type === 'COMPLEX') {
    const P = e.parts;
    if (P.LENGTH_UNIT) { if (P.SI_UNIT) scale = P.SI_UNIT[0] === '.MILLI.' ? 1 : P.SI_UNIT[0] === '.CENTI.' ? 10 : P.SI_UNIT[0] === '.MICRO.' ? 1e-3 : P.SI_UNIT[0] === null ? 1000 : scale; else if (P.CONVERSION_BASED_UNIT) { const m = get(P.CONVERSION_BASED_UNIT[1]), v = m && m.args && typeof m.args[0] === 'number' ? m.args[0] : m && m.args && m.args[0] && typeof m.args[0].val === 'number' ? m.args[0].val : null; scale = /INCH/i.test(P.CONVERSION_BASED_UNIT[0]) ? 25.4 : /FOOT|FEET/i.test(P.CONVERSION_BASED_UNIT[0]) ? 304.8 : v || scale; } }
    if (P.PLANE_ANGLE_UNIT && P.CONVERSION_BASED_UNIT && /DEG/i.test(P.CONVERSION_BASED_UNIT[0])) deg = true;
  }
  if (!(chord > 0)) {       // no chord asked for: one that suits the size of the part (0.05 mm on a part some 120 mm across)
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const e of E.values()) if (e.type === 'CARTESIAN_POINT' && Array.isArray(e.args[1]) && e.args[1].length === 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], e.args[1][k] * scale); b[k + 3] = Math.max(b[k + 3], e.args[1][k] * scale); }
    const diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]); chord = diag > 0 && isFinite(diag) ? +(diag * 4e-4).toPrecision(1) : 0.05;
  }
  if (scale !== 1) log.push(`lengths are multiplied by ${scale} (the file is not in millimetres)`);
  const pt = r => mul(get(r).args[1], scale), dirOf = r => unit(get(r).args[1]);
  const place = r => { const a = get(r).args, o = pt(a[1]), z = a[2] ? dirOf(a[2]) : [0, 0, 1]; let x = a[3] ? dirOf(a[3]) : perp(z); x = sub(x, mul(z, dot(x, z))); x = len(x) < 1e-9 ? perp(z) : unit(x); return { o, z, x, y: cross(z, x) }; };
  const part = (e, name) => e.type === 'COMPLEX' ? e.parts[name] : e.type === name ? e.args : null;

  /* curves: at(t), and the run t0…t1 */
  const curveMemo = new Map();
  const curveOf = r => {
    if (curveMemo.has(r.ref)) return curveMemo.get(r.ref);
    const e = get(r), a = e.args; let c = null;
    if (e.type === 'LINE') { const p = pt(a[1]), d = dirOf(get(a[2]).args[1]); c = { k: 'line', p, d, at: t => add(p, mul(d, t)) }; }
    else if (e.type === 'CIRCLE' || e.type === 'ELLIPSE') { const f = place(a[1]), ra = a[2] * scale, rb = (e.type === 'CIRCLE' ? a[2] : a[3]) * scale; c = { k: e.type === 'CIRCLE' ? 'circle' : 'ellipse', f, r: ra, per: TAU, at: t => add(f.o, add(mul(f.x, ra * Math.cos(t)), mul(f.y, rb * Math.sin(t)))), par: p => { const d = sub(p, f.o); return Math.atan2(dot(d, f.y) / rb, dot(d, f.x) / ra); } }; }
    else if (e.type === 'SURFACE_CURVE' || e.type === 'SEAM_CURVE' || e.type === 'INTERSECTION_CURVE' || e.type === 'TRIMMED_CURVE') c = curveOf(a[1]);
    else if (e.type === 'POLYLINE') { const P = a[1].map(pt); c = { k: 'poly', t0: 0, t1: P.length - 1, at: t => { const i = Math.min(P.length - 2, Math.max(0, Math.floor(t))); return add(P[i], mul(sub(P[i + 1], P[i]), t - i)); } }; }
    else {
      const bc = part(e, 'B_SPLINE_CURVE'), bk = part(e, 'B_SPLINE_CURVE_WITH_KNOTS'), bw = part(e, 'RATIONAL_B_SPLINE_CURVE');
      if (bk) {
        const full = e.type !== 'COMPLEX', p = full ? a[1] : bc[0], C = (full ? a[2] : bc[1]).map(pt), U = knotVec(full ? a[6] : bk[0], full ? a[7] : bk[1]);
        c = { k: 'bspline', t0: U[p], t1: U[C.length], at: bsCurve(p, C, U, bw ? bw[0] : null), closed: len(sub(C[0], C[C.length - 1])) < 1e-9 };
      }
    }
    if (!c) log.push(`a curve of the kind ${e.type === 'COMPLEX' ? Object.keys(e.parts).join('+') : e.type} is read as a straight line`);
    curveMemo.set(r.ref, c); return c;
  };

  /* the mesh being built */
  const POS = [], vOfPoint = new Map(), X = i => [POS[3 * i], POS[3 * i + 1], POS[3 * i + 2]];
  const newV = p => { POS.push(p[0], p[1], p[2]); return POS.length / 3 - 1; };
  const vertex = r => { let v = vOfPoint.get(r.ref); if (v === undefined) vOfPoint.set(r.ref, v = newV(pt(get(r).args[1]))); return v; };
  const arcSteps = (r, sweep, full) => { const st = 2 * Math.acos(Math.max(-1, 1 - Math.min(chord, r) / r)); let n = Math.max(1, Math.ceil(Math.abs(sweep) / st)); if (full) { let p2 = 32; while (p2 < n) p2 *= 2; n = p2; } return n; };
  /* an edge as a row of points from its first vertex to its last, made once */
  const edgeMemo = new Map();
  const edgeRow = r => {
    if (edgeMemo.has(r.ref)) return edgeMemo.get(r.ref);
    const a = get(r).args, v1 = vertex(a[1]), v2 = vertex(a[2]), c = curveOf(a[3]), same = a[4] !== '.F.', p1 = X(v1), p2 = X(v2), ids = [v1];
    const info = { ids, curve: c, v1, v2, fs: [0], pt: f => add(p1, mul(sub(p2, p1), f)) };
    if (c && (c.k === 'circle' || c.k === 'ellipse')) {
      const t1 = c.par(p1); let sw = mod(c.par(p2) - t1, TAU); const full = v1 === v2 || len(sub(p1, p2)) < 1e-9; if (full) sw = TAU; else if (!same) sw -= TAU;
      if (!same && full) sw = -TAU;
      const n = arcSteps(c.r, sw, full); for (let i = 1; i < n; i++) { ids.push(newV(c.at(t1 + sw * i / n))); info.fs.push(i / n); } info.sweep = sw; info.t1 = t1; info.pt = f => c.at(t1 + sw * f);
    } else if (c && (c.k === 'bspline' || c.k === 'poly')) {
      let ta = nearestOn(c.at, c.t0, c.t1, p1), tb = nearestOn(c.at, c.t0, c.t1, p2);
      if (v1 === v2 || len(sub(p1, p2)) < 1e-9) { ta = same ? c.t0 : c.t1; tb = same ? c.t1 : c.t0; }
      else if (c.closed && (tb > ta) !== same) { if (same) tb += c.t1 - c.t0; else ta += c.t1 - c.t0; }
      const at = t => c.at(c.t0 + mod(t - c.t0, c.t1 - c.t0 + 1e-300) + (t > c.t1 + 1e-12 && Math.abs(mod(t - c.t0, c.t1 - c.t0)) < 1e-12 ? c.t1 - c.t0 : 0));
      const rec = (t0, q0, t1, q1, d) => { const tm = (t0 + t1) / 2, qm = at(tm), ch = sub(q1, q0), l = len(ch) || 1e-300, dev = len(cross(sub(qm, q0), ch)) / l; if (d < 14 && (dev > chord || d < 3)) { rec(t0, q0, tm, qm, d + 1); ids.push(newV(qm)); info.fs.push((tm - ta) / (tb - ta)); rec(tm, qm, t1, q1, d + 1); } };
      rec(ta, p1, tb, p2, 0); info.pt = f => at(ta + (tb - ta) * f);
    }
    ids.push(v2); info.fs.push(1); edgeMemo.set(r.ref, info); return info;
  };

  /* surfaces: uv(p, hint) and at(u, v) in a parameter space of our own choosing, the periods, STEP's own normal, the card */
  const surfMemo = new Map();
  const canon = d => { const k = Math.abs(d[0]) > 1e-9 ? 0 : Math.abs(d[1]) > 1e-9 ? 1 : 2; return d[k] < 0 ? mul(d, -1) : d; }, r6 = v => v.map(x => (Math.round(x * 1e6) / 1e6 || 0).toFixed(6)).join(',');
  const surfOf = r => {
    if (surfMemo.has(r.ref)) return surfMemo.get(r.ref);
    const e = get(r), a = e.args; let s = null;
    const ang = (f, d) => Math.atan2(dot(d, f.y), dot(d, f.x)), rad = (f, u) => add(mul(f.x, Math.cos(u)), mul(f.y, Math.sin(u)));
    const axisKey = f => { const z = canon(f.z), o = sub(f.o, mul(z, dot(f.o, z))); return r6(z) + '|' + r6(o); };
    if (e.type === 'PLANE') { const f = place(a[1]); s = { t: 'plane', f, flat: true, uv: p => { const d = sub(p, f.o); return [dot(d, f.x), dot(d, f.y)]; }, at: (u, v) => add(f.o, add(mul(f.x, u), mul(f.y, v))), nat: () => f.z, key: sense => 'plane|' + r6(mul(f.z, sense)) + '|' + (Math.round(dot(f.o, f.z) * sense * 1e6) / 1e6), card: sense => ({ type: 'plane', o: f.o, n: mul(f.z, sense), u: f.x }) }; }
    else if (e.type === 'CYLINDRICAL_SURFACE') { const f = place(a[1]), R = a[2] * scale; s = { t: 'cyl', f, perU: TAU, uv: p => { const d = sub(p, f.o); return [ang(f, d), dot(d, f.z)]; }, at: (u, v) => add(f.o, add(mul(rad(f, u), R), mul(f.z, v))), nat: (p, uv) => rad(f, uv[0]), key: sense => 'cyl|' + axisKey(f) + '|' + R.toFixed(6) + '|' + sense, card: sense => ({ type: 'cyl', o: f.o, a: f.z, d: 2 * R, side: sense > 0 ? 'out' : 'in' }) }; }
    else if (e.type === 'CONICAL_SURFACE') {
      const f = place(a[1]), R = a[2] * scale, sa = a[3] * (deg ? Math.PI / 180 : 1), tn = Math.tan(sa);
      s = { t: 'cone', f, perU: TAU, poleV: [-R / tn, null], pole: p => len(sub(sub(p, f.o), mul(f.z, dot(sub(p, f.o), f.z)))) < 1e-7 ? { v: -R / tn, south: true } : null, uv: p => { const d = sub(p, f.o); return [ang(f, d), dot(d, f.z)]; }, at: (u, v) => add(f.o, add(mul(rad(f, u), R + v * tn), mul(f.z, v))), nat: (p, uv) => unit(sub(mul(rad(f, uv[0]), Math.cos(sa)), mul(f.z, Math.sin(sa)))), key: sense => 'cone|' + r6(f.z) + '|' + r6(f.o) + '|' + R.toFixed(6) + '|' + sa.toFixed(9) + '|' + sense, card: sense => ({ type: 'cone', o: f.o, a: f.z, d: 2 * R, angle: 2 * sa * 180 / Math.PI, side: sense > 0 ? 'out' : 'in' }) };
    } else if (e.type === 'SPHERICAL_SURFACE') { const f = place(a[1]), R = a[2] * scale; s = { t: 'sph', f, R, perU: TAU, poleV: [-Math.PI / 2, Math.PI / 2], pole: p => { const d = sub(p, f.o), h = dot(d, f.z); return len(sub(d, mul(f.z, h))) < 1e-7 ? { v: h > 0 ? Math.PI / 2 : -Math.PI / 2, south: h < 0 } : null; }, uv: p => { const d = sub(p, f.o); return [ang(f, d), Math.asin(Math.max(-1, Math.min(1, dot(d, f.z) / R)))]; }, at: (u, v) => add(f.o, add(mul(rad(f, u), R * Math.cos(v)), mul(f.z, R * Math.sin(v)))), nat: p => unit(sub(p, f.o)), key: sense => 'sph|' + r6(f.o) + '|' + R.toFixed(6) + '|' + sense, card: sense => ({ type: 'sph', c: f.o, d: 2 * R, side: sense > 0 ? 'out' : 'in' }) }; }
    else if (e.type === 'TOROIDAL_SURFACE') { const f = place(a[1]), R = a[2] * scale, rr = a[3] * scale; s = { t: 'torus', f, perU: TAU, perV: TAU, uv: p => { const d = sub(p, f.o), u = ang(f, d), z = dot(d, f.z); return [u, Math.atan2(z, dot(d, rad(f, u)) - R)]; }, at: (u, v) => add(f.o, add(mul(rad(f, u), R + rr * Math.cos(v)), mul(f.z, rr * Math.sin(v)))), nat: (p, uv) => unit(sub(p, add(f.o, mul(rad(f, uv[0]), R)))), key: sense => 'torus|' + axisKey(f) + '|' + (Math.round(dot(f.o, canon(f.z)) * 1e6) / 1e6) + '|' + R.toFixed(6) + '|' + rr.toFixed(6) + '|' + sense, card: sense => ({ type: 'torus', c: f.o, a: f.z, R, r: rr, side: sense > 0 ? 'out' : 'in' }) }; }
    else if (e.type === 'SURFACE_OF_REVOLUTION') {
      const c = curveOf(a[1]), ax = get(a[2]).args, o = pt(ax[1]), z = dirOf(ax[2]);
      if (c) {
        const t0 = c.t0 ?? 0, t1 = c.t1 ?? (c.per || 1), x0 = perp(z), y0 = cross(z, x0), rz = p => { const d = sub(p, o), h = dot(d, z); return [len(sub(d, mul(z, h))), h]; };
        const tOf = p => { const q = rz(p); return nearestOn(t => { const g = rz(c.at(t)); return [g[0], g[1], 0]; }, t0, t1, [q[0], q[1], 0]); }, an = p => { const d = sub(p, o); return Math.atan2(dot(d, y0), dot(d, x0)); };
        const turn = (p, w) => { const d = sub(p, o), h = dot(d, z), rv = sub(d, mul(z, h)), q = cross(z, rv); return add(o, add(mul(z, h), add(mul(rv, Math.cos(w)), mul(q, Math.sin(w))))); };
        const onAx = p => rz(p)[0] < 1e-7;
        s = { t: 'rev', perU: TAU, uv: p => { const t = tOf(p); return [onAx(p) ? 0 : an(p) - an(c.at(t)), t]; }, at: (u, v) => turn(c.at(v), u), num: true, poleV: [onAx(c.at(t0)) ? t0 : null, onAx(c.at(t1)) ? t1 : null],
          pole: p => { if (!onAx(p)) return null; const t = tOf(p), south = Math.abs(t - t0) < Math.abs(t - t1); return { v: south ? t0 : t1, south }; } };
      }
    } else if (e.type === 'SURFACE_OF_LINEAR_EXTRUSION') {
      const c = curveOf(a[1]), d = dirOf(get(a[2]).args[1]);
      if (c) { const t0 = c.t0 ?? 0, t1 = c.t1 ?? (c.per || 1), flatP = p => sub(p, mul(d, dot(p, d))); s = { t: 'ext', perU: c.per || 0, uv: p => { const q = flatP(p), t = nearestOn(x => flatP(c.at(x)), t0, t1, q); return [t, dot(sub(p, c.at(t)), d)]; }, at: (u, v) => add(c.at(u), mul(d, v)), num: true }; }
    } else {
      const bs = part(e, 'B_SPLINE_SURFACE'), bk = part(e, 'B_SPLINE_SURFACE_WITH_KNOTS'), bw = part(e, 'RATIONAL_B_SPLINE_SURFACE');
      if (bk) {
        const full = e.type !== 'COMPLEX', p = full ? a[1] : bs[0], q = full ? a[2] : bs[1], C = (full ? a[3] : bs[2]).map(row => row.map(pt));
        const U = knotVec(full ? a[8] : bk[0], full ? a[10] : bk[2]), Vk = knotVec(full ? a[9] : bk[1], full ? a[11] : bk[3]), at = bsSurf(p, q, C, U, Vk, bw ? bw[0] : null);
        const a0 = U[p], a1 = U[C.length], b0 = Vk[q], b1 = Vk[C[0].length], size = len(sub(C[0][0], C[C.length - 1][C[0].length - 1])) + len(sub(C[0][C[0].length - 1], C[C.length - 1][0])) || 1, eps = 1e-7 * Math.max(1, size);
        // does the net close on itself, does a side shrink to a point (a pole)? Then it is run so that u goes round and the poles are at the ends of v
        const fr = k => (k + 0.5) / 7, same = (f, g) => [0, 1, 2, 3, 4, 5, 6].every(k => len(sub(f(fr(k)), g(fr(k)))) < eps), la = t => a0 + (a1 - a0) * t, lb = t => b0 + (b1 - b0) * t;
        const closedA = same(t => at(a0, lb(t)), t => at(a1, lb(t))), closedB = same(t => at(la(t), b0), t => at(la(t), b1));
        const pA0 = same(t => at(a0, lb(t)), () => at(a0, b0)), pA1 = same(t => at(a1, lb(t)), () => at(a1, b0)), pB0 = same(t => at(la(t), b0), () => at(a0, b0)), pB1 = same(t => at(la(t), b1), () => at(a0, b1));
        const swap = (pA0 || pA1 || (closedB && !closedA)) && !(pB0 || pB1), raw = swap ? (u, v) => at(v, u) : at;
        const u0 = swap ? b0 : a0, u1 = swap ? b1 : a1, v0 = swap ? a0 : b0, v1 = swap ? a1 : b1, perU = (swap ? closedB : closedA) ? u1 - u0 : 0, perV = (swap ? closedA : closedB) ? v1 - v0 : 0;
        const pole0 = swap ? pA0 : pB0, pole1 = swap ? pA1 : pB1, P0 = pole0 ? raw(u0, v0) : null, P1 = pole1 ? raw(u0, v1) : null;
        const cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x)), wu = perU ? x => { const m = mod(x - u0, perU); return m < 1e-12 && x > u0 + perU / 2 ? u1 : u0 + m; } : x => cl(x, u0, u1), wv = perV ? x => { const m = mod(x - v0, perV); return m < 1e-12 && x > v0 + perV / 2 ? v1 : v0 + m; } : x => cl(x, v0, v1);
        const S2 = (u, v) => raw(wu(u), wv(v)), G = Math.min(48, 4 * Math.max(C.length, C[0].length)), grid = [];
        for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) { const u = u0 + (u1 - u0) * i / G, v = v0 + (v1 - v0) * j / G; grid.push([u, v, raw(u, v)]); }
        s = { t: 'nurbs', at: S2, num: true, perU, perV, natSwap: swap, uv: (pp, hint) => {
          let u, v; if (hint && len(sub(S2(hint[0], hint[1]), pp)) < 0.5 * size / G) { u = wu(hint[0]); v = wv(hint[1]); } else { let bd = Infinity; for (const g of grid) { const d = len(sub(g[2], pp)); if (d < bd) { bd = d; u = g[0]; v = g[1]; } } }
          // Levenberg–Marquardt on the distance: a step is taken only if it brings the point nearer (a net may be singular along a side, where plain Newton flies off)
          let lam = 1e-4, cur = len(sub(raw(u, v), pp)); const stepU = perU ? x => u0 + mod(x - u0, perU) : x => cl(x, u0, u1), stepV = perV ? x => v0 + mod(x - v0, perV) : x => cl(x, v0, v1);
          for (let k = 0; k < 60 && cur > 1e-11; k++) {
            const hu = (u1 - u0) * 1e-6, hv = (v1 - v0) * 1e-6, s0 = raw(u, v), su = mul(sub(raw(cl(u + hu, u0, u1), v), raw(cl(u - hu, u0, u1), v)), 1 / (cl(u + hu, u0, u1) - cl(u - hu, u0, u1))), sv = mul(sub(raw(u, cl(v + hv, v0, v1)), raw(u, cl(v - hv, v0, v1))), 1 / (cl(v + hv, v0, v1) - cl(v - hv, v0, v1)));
            const d = sub(pp, s0), A = dot(su, su), B = dot(su, sv), D = dot(sv, sv), e1 = dot(su, d), e2 = dot(sv, d); let ok = false;
            for (let t = 0; t < 12 && !ok; t++) {
              const A2 = A * (1 + lam) + 1e-300, D2 = D * (1 + lam) + 1e-300, det = A2 * D2 - B * B; if (!(Math.abs(det) > 0)) { lam *= 10; continue; }
              const un = stepU(u + (D2 * e1 - B * e2) / det), vn = stepV(v + (A2 * e2 - B * e1) / det), dn = len(sub(raw(un, vn), pp));
              if (dn < cur) { ok = Math.abs(un - u) > (u1 - u0) * 1e-13 || Math.abs(vn - v) > (v1 - v0) * 1e-13; u = un; v = vn; cur = dn; lam = Math.max(lam / 4, 1e-9); if (!ok) t = 99; } else lam *= 10;
            }
            if (!ok) break;
          }
          return [u, v];
        } };
        if (pole0 || pole1) { s.poleV = [pole0 ? v0 : null, pole1 ? v1 : null]; s.pole = pt2 => P0 && len(sub(pt2, P0)) < eps ? { v: v0, south: true } : P1 && len(sub(pt2, P1)) < eps ? { v: v1, south: false } : null; }
      }
    }
    if (s && !s.nat) { const h = 1e-6; s.nat = (p, uv) => unit(cross(sub(s.at(uv[0] + h, uv[1]), s.at(uv[0] - h, uv[1])), sub(s.at(uv[0], uv[1] + h), s.at(uv[0], uv[1] - h)))); s.natFlip = !!s.natSwap; s.natNum = true; }     // our (angle, curve) run is STEP's (curve, angle) turned over
    surfMemo.set(r.ref, s); return s;
  };

  /* one face → triangles (indices into POS), turned outwards */
  const seg2 = (a, b, c, d) => { const o = (p, q, r2) => (q[0] - p[0]) * (r2[1] - p[1]) - (q[1] - p[1]) * (r2[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  const faceTris = (fr) => {
    const fa = get(fr).args, sf = surfOf(fa[2]), sense = fa[3] !== '.F.' ? 1 : -1; if (!sf) throw new Error('a surface of the kind ' + (get(fa[2]).type === 'COMPLEX' ? Object.keys(get(fa[2]).parts).join('+') : get(fa[2]).type) + ' is not read yet');
    const pU = sf.perU || 0, pV = sf.perV || 0, P = [], G = [];          // local points: (u, v) and the mesh point each stands for
    const lp = (uv, g) => { P.push(uv); G.push(g); return P.length - 1; };
    // the loops, as rows of mesh points in the order the face gives them
    const loops = []; let poleLoop = false;
    for (const br of fa[1]) {
      const b = get(br).args, lo = get(b[1]), fwd = b[2] !== '.F.'; if (lo.type === 'VERTEX_LOOP') { poleLoop = true; continue; }
      let ids = []; for (const oe of lo.args[1]) { const o = get(oe).args, row = edgeRow(o[3]).ids, r2 = o[4] !== '.F.' ? row : [...row].reverse(); ids.push(...r2.slice(0, -1)); }
      if (!fwd) ids.reverse(); if (ids.length >= 2) loops.push(ids);
    }
    // each loop laid out in (u, v), unwrapped so that it does not jump
    const hand = sf.natNum ? (sf.natFlip ? -1 : 1) : (() => { let g = null; for (const lo of loops) for (const x of lo) if (g === null && !(sf.pole && sf.pole(X(x)))) g = x; if (g === null) return 1; const uv = sf.uv(X(g)), h = 1e-5, n = cross(sub(sf.at(uv[0] + h, uv[1]), sf.at(uv[0] - h, uv[1])), sub(sf.at(uv[0], uv[1] + h), sf.at(uv[0], uv[1] - h))); const nt = sf.nat(X(g), uv); return dot(n, sf.natFlip ? mul(nt, -1) : nt) >= 0 ? 1 : -1; })();
    const turn = hand * sense;        // > 0: the face lies on the left of its loops as seen in (u, v), and a triangle that turns counter-clockwise there faces out
    const turnOf = d => { if (!pU) return d; const m = mod(d, pU); return m < 1e-7 || pU - m < 1e-7 ? pU : m; };     // up a seam to the pole and back down the same seam: once round
    const lay = (ids0, turn) => {
      // start at a point that is not a pole (a pole has no angle of its own)
      let ids = ids0, k0 = sf.pole ? ids.findIndex(g => !sf.pole(X(g))) : 0; if (k0 > 0) ids = [...ids.slice(k0), ...ids.slice(0, k0)];
      const uv = [], gs = []; let prev = null, pole = null;
      for (const g of ids) {
        const pl = sf.pole && sf.pole(X(g)); if (pl) { pole = { ...pl, g }; continue; }
        const q = sf.uv(X(g), prev);
        if (prev && pole) {
          // across a pole: the face is on the left of its loop, so along a south pole u grows, along a north pole it falls (and the other way round on a reversed face)
          const grow = pole.south === (turn > 0), un = !pU ? q[0] : grow ? prev[0] + turnOf(q[0] - prev[0]) : prev[0] - turnOf(prev[0] - q[0]), n = Math.max(1, Math.ceil(Math.abs(un - prev[0]) / (TAU / 16)));
          for (let k = 0; k <= n; k++) { uv.push([prev[0] + (un - prev[0]) * k / n, pole.v]); gs.push(pole.g); }
          q[0] = un; if (pV) q[1] = near(q[1], prev[1], pV); pole = null;
        } else if (prev) { if (pU) q[0] = near(q[0], prev[0], pU); if (pV) q[1] = near(q[1], prev[1], pV); }
        uv.push(q); gs.push(g); prev = q;
      }
      let q0 = sf.uv(X(ids[0]), prev);
      if (pole) { const grow = pole.south === (turn > 0), un = !pU ? q0[0] : grow ? prev[0] + turnOf(q0[0] - prev[0]) : prev[0] - turnOf(prev[0] - q0[0]), n = Math.max(1, Math.ceil(Math.abs(un - prev[0]) / (TAU / 16))); for (let k = 0; k <= n; k++) { uv.push([prev[0] + (un - prev[0]) * k / n, pole.v]); gs.push(pole.g); } q0[0] = un; }
      else { if (pU) q0[0] = near(q0[0], prev[0], pU); if (pV) q0[1] = near(q0[1], prev[1], pV); }
      let ar = 0; for (let i = 0; i < uv.length; i++) { const a = uv[i], b = uv[(i + 1) % uv.length]; ar += a[0] * b[1] - b[0] * a[1]; }
      return { ids: gs, uv, wind: pU ? Math.round((q0[0] - uv[0][0]) / pU) : 0, windV: pV ? Math.round((q0[1] - uv[0][1]) / pV) : 0, area: ar / 2, poles: gs.length > ids.length - 0 || gs.some((g, i) => i && g === gs[i - 1]) };
    };
    // a loop through a pole closes on itself; if it does not with the facing the file states, the face is flagged the wrong way and the other way round is taken
    const L = loops.map(ids0 => { const l = lay(ids0, turn); if (!l.wind || !l.poles) return l; const l2 = lay(ids0, -turn); return l2.wind ? l : l2; });
    if (L.some(l => l.windV)) throw new Error('a face goes all the way round a torus the short way — not read yet');
    const W = L.filter(l => l.wind), H = L.filter(l => !l.wind);
    const shift = (l, du) => ({ ...l, uv: l.uv.map(q => [q[0] + du, q[1]]) }), idx = l => l.uv.map((q, i) => lp(q, l.ids[i]));
    // a row of points along a straight line in (u, v): the same mesh points serve both sides of a cut
    const cutRow = (a, b) => { const n = Math.max(1, Math.min(256, Math.ceil(len(sub(sf.at(a[0], a[1]), sf.at(b[0], b[1]))) / Math.max(4 * chord, 1e-9) / 4))), row = []; for (let i = 1; i < n; i++) { const q = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]; row.push({ q, g: newV(sf.at(q[0], q[1])) }); } return row; };
    let outer = null, holes = [], uMin, uMax;
    const poleOf = l => { if (!sf.poleV) return null; const k = l.wind * turn > 0 ? 1 : 0; return sf.poleV[k] ?? sf.poleV[1 - k] ?? null; };       // a cone or a turned curve has one tip at most: the cap is on that side
    if (W.length === 2) {
      // two loops that go all the way round (the ends of a tube): the face is the band between them, cut open along a bridge
      const A = W[0], nA = A.uv.length, B0 = W[1]; let best = null;
      for (let t = 0; t < Math.min(nA, 24); t++) {
        const i0 = Math.floor(t * nA / Math.min(nA, 24)), a = A.uv[i0]; let j0 = 0, bd = Infinity;
        B0.uv.forEach((q, j) => { const d = Math.abs(near(q[0], a[0], pU) - a[0]); if (d < bd) { bd = d; j0 = j; } });
        const b = [near(B0.uv[j0][0], a[0], pU), B0.uv[j0][1]], lo = Math.min(a[0], b[0]) - 1e-9, hi = Math.max(a[0], b[0]) + 1e-9;
        const hit = H.some(h => h.uv.some(q => { const u = near(q[0], (lo + hi) / 2, pU); return u >= lo - 0.02 && u <= hi + 0.02; }));
        if (!hit && (!best || bd < best.bd)) best = { i0, j0, a, b, bd };
      }
      if (!best) throw new Error('a tube-like face is so full of holes that no cut was found');
      const { i0, j0, a, b } = best, sg = A.wind > 0 ? 1 : -1, ring = (l, k0, dir) => { const n = l.uv.length, out = []; for (let k = 0; k <= n; k++) { const i = mod(k0 + dir * k, n); out.push({ q: l.uv[i].slice(), g: l.ids[i] }); } return out; };
      const ra = ring(A, i0, 1); for (let k = 1; k < ra.length; k++) ra[k].q[0] = near(ra[k].q[0], ra[k - 1].q[0], pU); ra[ra.length - 1].q[0] = a[0] + sg * pU;
      const dirB = Math.sign(B0.wind) === sg ? -1 : 1, rb = ring(B0, j0, dirB); rb[0].q[0] = b[0] + sg * pU; for (let k = 1; k < rb.length; k++) rb[k].q[0] = near(rb[k].q[0], rb[k - 1].q[0], pU); rb[rb.length - 1].q[0] = b[0];
      const br = cutRow(a, b), poly = [...ra, ...br.map(x => ({ q: [x.q[0] + sg * pU, x.q[1]], g: x.g })), ...rb, ...[...br].reverse()];
      outer = poly.slice(0, -0 || undefined).map(x => lp(x.q, x.g)); outer.splice(ra.length + br.length + rb.length - 0, 0); uMin = Math.min(a[0], a[0] + sg * pU); uMax = uMin + pU;
      // the first point of the first ring closes the polygon by itself: drop the doubled start
      holes = H;
    } else if (W.length === 1 && poleOf(W[0]) !== null) {
      // one loop that goes round, and a pole or an apex on its other side: a cap
      const A = W[0], sg = A.wind > 0 ? 1 : -1, vp = poleOf(A), a = A.uv[0], gp = newV(sf.at(a[0], vp)), poly = A.uv.map((q, i) => ({ q, g: A.ids[i] }));
      poly.push({ q: [a[0] + sg * pU, a[1]], g: A.ids[0] });
      const down = cutRow(a, [a[0], vp]); for (const x of down) poly.push({ q: [x.q[0] + sg * pU, x.q[1]], g: x.g });
      for (let k = 0; k <= 12; k++) poly.push({ q: [a[0] + sg * pU * (1 - k / 12), vp], g: gp });
      for (const x of [...down].reverse()) poly.push({ q: x.q, g: x.g });
      outer = poly.map(x => lp(x.q, x.g)); uMin = Math.min(a[0], a[0] + sg * pU); uMax = uMin + pU; holes = H;
    } else if (W.length === 0) {
      const outs = H.filter(l => l.area * turn > 0);
      const whole = sf.t === 'sph' ? outs.length !== 1 : !H.length && pU && sf.poleV && sf.poleV[0] !== null && sf.poleV[1] !== null;      // a ball without an outer border: all of it (its loops, if any, are holes)
      if (!whole) {
        const o = outs.length ? outs.reduce((x, y) => Math.abs(y.area) > Math.abs(x.area) ? y : x) : H.reduce((x, y) => Math.abs(y.area) > Math.abs(x.area) ? y : x, H[0]);
        if (!o) throw new Error('a face without a border on a surface that does not close');
        outer = idx(o); holes = H.filter(l => l !== o); uMin = Math.min(...o.uv.map(q => q[0])); uMax = Math.max(...o.uv.map(q => q[0]));
      } else {
        // a sphere with holes only (or none): the whole of it, cut open along a meridian that no hole touches
        const span = H.map(h => { const us = h.uv.map(q => q[0]); return [Math.min(...us) - 0.01, Math.max(...us) + 0.01]; }); let c = null; for (let k = 0; k < 720 && c === null; k++) { const u = TAU * k / 720; if (!span.some(([lo, hi]) => mod(u - lo, pU) <= hi - lo)) c = u; }
        if (c === null) throw new Error('holes all round a sphere: no meridian is free for the cut');
        const s0 = [c, sf.poleV[0]], n0 = [c, sf.poleV[1]], gs = newV(sf.at(c, sf.poleV[0])), gn = newV(sf.at(c, sf.poleV[1])), up = cutRow(s0, n0), poly = [];
        for (let k = 0; k <= 12; k++) poly.push({ q: [c + pU * k / 12, sf.poleV[0]], g: gs });
        for (const x of up) poly.push({ q: [x.q[0] + pU, x.q[1]], g: x.g });
        for (let k = 0; k <= 12; k++) poly.push({ q: [c + pU * (1 - k / 12), sf.poleV[1]], g: gn });
        for (const x of [...up].reverse()) poly.push({ q: x.q, g: x.g });
        outer = poly.map(x => lp(x.q, x.g)); uMin = c; uMax = c + pU; holes = H;
      }
    } else throw new Error(`a face with ${W.length} loops going round its surface — not read yet`);
    if (W.length === 2) { const n = outer.length; if (G[outer[0]] === G[outer[n - 1]] && len(sub(P[outer[0]], P[outer[n - 1]])) < 1e-12) outer.pop(); }
    // holes are moved by whole turns into the stretch of u that the outer loop covers
    const holeIdx = holes.map(h => { let l = h; if (pU) { const c = h.uv.reduce((sum, q) => sum + q[0], 0) / h.uv.length, k = Math.round(((uMin + uMax) / 2 - c) / pU); if (k) l = shift(h, k * pU); }
      // a hole that touches the outer loop (or another hole) at a point is drawn in a hair, in (u, v) only, so that the triangulation finds its way
      const cu = l.uv.reduce((a, q) => a + q[0], 0) / l.uv.length, cv = l.uv.reduce((a, q) => a + q[1], 0) / l.uv.length; l = { ...l, uv: l.uv.map(q => [cu + (q[0] - cu) * (1 - 1e-7), cv + (q[1] - cv) * (1 - 1e-7)]) };
      return idx(l); });
    let tris = S.triangulateHoles(P, outer, holeIdx);      // triangles with two corners on one pole stay for now: refining them fills the cap
    // a triangle whose three corners stand in a line in (u, v) (three points of one straight border) has no area: the edge under it is flipped
    for (let pass = 0; pass < 6; pass++) {
      const em = new Map(), key = (a, b) => a < b ? a + ',' + b : b + ',' + a; tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const k = key(t[e], t[(e + 1) % 3]); if (!em.has(k)) em.set(k, []); em.get(k).push(ti); } });
      const ar2 = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]), d2 = (a, b) => (P[a][0] - P[b][0]) ** 2 + (P[a][1] - P[b][1]) ** 2; let fixed = 0; const gone = new Set();
      tris.forEach((t, ti) => {
        if (gone.has(ti)) return; let e = 0; for (let k = 1; k < 3; k++) if (d2(t[k], t[(k + 1) % 3]) > d2(t[e], t[(e + 1) % 3])) e = k;
        const a = t[e], b = t[(e + 1) % 3], c = t[(e + 2) % 3]; if (Math.abs(ar2(a, b, c)) > 1e-7 * d2(a, b)) return;
        const o = (em.get(key(a, b)) || []).find(x => x !== ti); if (o === undefined || gone.has(o)) return; const x = tris[o].find(v => v !== a && v !== b); if (x === undefined) return;
        const s1 = ar2(a, c, x), s2 = ar2(c, b, x), s0 = ar2(...tris[o]); if (s1 * s0 >= 0 || s2 * s0 >= 0) return;            // (a, c, x) and (c, b, x) run the other way round than (b, a, x)
        const w = s0 > 0; tris[ti] = w ? [x, c, a] : [a, c, x]; tris[o] = w ? [x, b, c] : [c, b, x]; gone.add(ti); gone.add(o); fixed++;
      });
      if (!fixed) break;
    }
    // on a curved surface: split the inner edges whose middle strays from the surface by more than the chord
    if (!sf.flat) for (let pass = 0; pass < 12; pass++) {
      const em = new Map(), key = (a, b) => a < b ? a + ',' + b : b + ',' + a; tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const k = key(t[e], t[(e + 1) % 3]); if (!em.has(k)) em.set(k, []); em.get(k).push(ti); } });
      const split = new Map(); let nSplit = 0;
      for (const [k, ts] of em) { if (ts.length !== 2) continue; const [a, b] = k.split(',').map(Number), q = [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2], pm = sf.at(q[0], q[1]); if (len(sub(pm, mul(add(X(G[a]), X(G[b])), 0.5))) > chord) { split.set(k, { q, pm }); nSplit++; } }
      if (!nSplit || tris.length > 400000) break;
      const out = [], mid = new Map(), m = (a, b) => { const k = key(a, b), sp = split.get(k); if (!sp) return -1; let v = mid.get(k); if (v === undefined) mid.set(k, v = lp(sp.q, newV(sp.pm))); return v; };
      for (const t of tris) {
        const ms = [m(t[0], t[1]), m(t[1], t[2]), m(t[2], t[0])], c = ms.filter(x => x >= 0).length;
        if (!c) out.push(t);
        else if (c === 3) out.push([t[0], ms[0], ms[2]], [ms[0], t[1], ms[1]], [ms[2], ms[1], t[2]], [ms[0], ms[1], ms[2]]);
        else if (c === 1) { const e = ms.findIndex(x => x >= 0), a = t[e], b = t[(e + 1) % 3], c2 = t[(e + 2) % 3]; out.push([a, ms[e], c2], [ms[e], b, c2]); }
        else { const e = ms.findIndex(x => x < 0), a = t[e], b = t[(e + 1) % 3], c2 = t[(e + 2) % 3], mb = ms[(e + 1) % 3], mc = ms[(e + 2) % 3]; out.push([a, b, mb], [a, mb, mc], [mc, mb, c2]); }
      }
      tris = out;
    }
    // turned outwards: all triangles turn one way in (u, v); which way faces out was found above (near a pole a
    // triangle can be too thin to tell by itself)
    const res = [];
    for (const t of tris) { const g = t.map(i => G[i]); if (g[0] === g[1] || g[1] === g[2] || g[0] === g[2]) continue; res.push(turn > 0 ? g : [g[0], g[2], g[1]]); }
    return { tris: res, sf, sense };
  };

  /* where a loop of a face touches another loop of the same face at a point (a feature whose foot just reaches the rim),
     the touched edge gets that very mesh point: two rows of chords that only nearly touch would cross each other */
  const touchPass = faces => {
    const gold = (fn, lo, hi) => { const g = 0.6180339887498949; let a = lo, b = hi, x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = fn(x1), f2 = fn(x2); for (let k = 0; k < 60; k++) { if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = fn(x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = fn(x2); } } return (a + b) / 2; };
    const put = (e, f, g) => { let i = 0; while (i < e.fs.length && e.fs[i] < f) i++; e.fs.splice(i, 0, f); e.ids.splice(i, 0, g); return i; };
    const at = (e, f) => { for (let i = 0; i < e.fs.length; i++) if (len(sub(X(e.ids[i]), e.pt(f))) < 0.02 * chord) return i; return -1; };
    const done = new Set();
    for (const fr of faces) {
      const f = get(fr); if (!f || !f.args || !Array.isArray(f.args[1]) || f.args[1].length < 2) continue;
      const Ls = []; for (const br of f.args[1]) { const lo = get(get(br).args[1]); if (lo.type !== 'EDGE_LOOP') continue; Ls.push(lo.args[1].map(oe => ({ ref: get(oe).args[3].ref, e: edgeRow(get(oe).args[3]) }))); }
      for (let ia = 0; ia < Ls.length; ia++) for (let ib = ia + 1; ib < Ls.length; ib++) for (const { ref: ra, e: A } of Ls[ia]) for (const { ref: rb, e: B } of Ls[ib]) {
        if (A === B || done.has(ra + ',' + rb) || A.ids.some(g => B.ids.includes(g) && g !== A.v1 && g !== A.v2)) continue; done.add(ra + ',' + rb);
        for (const e of [A, B]) if (!e.box) { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const i of e.ids) { const p = X(i); for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p[k]); b[k + 3] = Math.max(b[k + 3], p[k]); } } e.box = b; }
        const m = 2 * chord + 1e-6; if ([0, 1, 2].some(k => A.box[k] > B.box[k + 3] + m || B.box[k] > A.box[k + 3] + m)) continue;
        // the nearest pair of sample points, then the true nearest pair of points of the two curves
        let bi = -1, bj = -1, bd = Infinity; for (let i = 0; i < A.ids.length; i++) { const p = X(A.ids[i]); for (let j = 0; j < B.ids.length; j++) { const d = len(sub(p, X(B.ids[j]))); if (d < bd) { bd = d; bi = i; bj = j; } } }
        const stepA = Math.max(...[bi - 1, bi].filter(i => i >= 0 && i + 1 < A.ids.length).map(i => len(sub(X(A.ids[i]), X(A.ids[i + 1]))))), stepB = Math.max(...[bj - 1, bj].filter(i => i >= 0 && i + 1 < B.ids.length).map(i => len(sub(X(B.ids[i]), X(B.ids[i + 1])))));
        if (bd > stepA + stepB + m) continue;
        const la = A.fs[Math.max(0, bi - 1)], ha = A.fs[Math.min(A.fs.length - 1, bi + 1)], lb = B.fs[Math.max(0, bj - 1)], hb = B.fs[Math.min(B.fs.length - 1, bj + 1)];
        const onB = p => gold(h => len(sub(B.pt(h), p)), lb, hb), fa = gold(x => { const p = A.pt(x); return len(sub(B.pt(onB(p)), p)); }, la, ha), pa = A.pt(fa), fb = onB(pa), pb = B.pt(fb);
        if (len(sub(pa, pb)) > 1e-6) continue;
        // they touch: one mesh point for both, and beside it the two rows step alike, so that neither chord cuts into the other
        const ka = at(A, fa), kb = at(B, fb), g = ka >= 0 ? A.ids[ka] : kb >= 0 ? B.ids[kb] : newV(pa);
        const iA = ka >= 0 ? ka : put(A, fa, g), iB = kb >= 0 ? kb : put(B, fb, g); let fA = A.fs[iA], fB = B.fs[iB];
        for (const side of [-1, 1]) {
          // which way along B runs beside this way along A
          const iA2 = A.fs.findIndex(x => x === fA) + side; if (iA2 < 0 || iA2 >= A.fs.length) continue;
          const dA = sub(X(A.ids[iA2]), pa), jB = B.fs.findIndex(x => x === fB), sB = [-1, 1].filter(s2 => jB + s2 >= 0 && jB + s2 < B.fs.length).sort((x, y) => dot(sub(X(B.ids[jB + y]), pa), dA) - dot(sub(X(B.ids[jB + x]), pa), dA))[0]; if (sB === undefined) continue;
          const lA = len(dA), lB = len(sub(X(B.ids[jB + sB]), pa)), tgt = Math.min(lA, lB); if (Math.max(lA, lB) < 1.2 * tgt || tgt < 0.02 * chord) continue;
          const E = lA > lB ? A : B, f0 = lA > lB ? fA : fB, f1 = lA > lB ? A.fs[iA2] : B.fs[jB + sB]; let lo = 0, hi = 1;
          for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (len(sub(E.pt(f0 + (f1 - f0) * mid), pa)) < tgt) lo = mid; else hi = mid; }
          const fn = f0 + (f1 - f0) * (lo + hi) / 2; put(E, fn, newV(E.pt(fn)));
        }
      }
    }
  };
  /* bodies: every solid or shell of the file */
  const shells = [];
  // a solid with voids: the shells of its voids belong to the same body and face the other way
  const voidOf = new Map(), voids = new Set();
  for (const [id, e] of E) if (e.type === 'BREP_WITH_VOIDS') for (const vr of e.args[2] || []) { const o = get(vr); let sid = vr.ref, flip = true; if (o && o.type === 'ORIENTED_CLOSED_SHELL') { sid = o.args[2].ref; flip = o.args[3] === '.F.'; } voidOf.set(sid, e.args[1].ref); if (flip) voids.add(sid); }
  for (const [id, e] of E) if ((e.type === 'CLOSED_SHELL' || e.type === 'OPEN_SHELL') && !voidOf.has(id)) shells.push({ id, faces: e.args[1].map(r => ({ ref: r.ref })) });
  for (const [sid, outer] of voidOf) { const sh = shells.find(x => x.id === outer), e = E.get(sid); if (sh && e) sh.faces.push(...e.args[1].map(r => ({ ref: r.ref, flip: voids.has(sid) }))); }
  if (!shells.length) { const fs = []; for (const [id, e] of E) if (e.type === 'ADVANCED_FACE' || e.type === 'FACE_SURFACE') fs.push({ ref: id }); if (fs.length) shells.push({ id: 0, faces: fs }); }
  if (!shells.length) throw new Error('no faces in this STEP file');
  for (const sh of shells) touchPass(sh.faces);
  const doc = S.newDoc(); Object.assign(doc.header, { mesh: 'final', source: 'design', chord, uses: ['L1'] }); Object.assign(doc.meta, { title: opts.title, made_by: 'step_snark 0.1' });
  const count = {}, edgeUse = new Map(); let skipped = 0, nFaces = 0;
  shells.forEach((sh, bi) => {
    const byKey = new Map(), pre = 'b' + (bi + 1) + '_', names = { plane: 'p', cyl: 'c', cone: 'k', sph: 's', torus: 't', free: 'f' }, num = {};
    const done = [];
    for (const fr of sh.faces) { let r; try { r = faceTris(fr); } catch (err) { skipped++; log.push(`body ${bi + 1}, face #${fr.ref}: ${err.message} — left out`); continue; } r.fr = fr; done.push(r); }
    // near a pole two neighbouring faces can each put a flat triangle on the same three points of their common border: the pair encloses nothing and goes
    { const seen = new Map(); done.forEach((r, i) => r.tris.forEach((t, k) => { const key = [...t].sort((x, y) => x - y).join(','), o = seen.get(key); if (o && o[0] !== i && done[o[0]].tris[o[1]]) { done[o[0]].tris[o[1]] = null; r.tris[k] = null; } else seen.set(key, [i, k]); })); for (const r of done) r.tris = r.tris.filter(Boolean); }
    /* the faces of a shell must agree with their neighbours (along a shared edge the two run opposite ways), and a closed
       shell faces away from what it encloses. A file may hold a face flagged the wrong way: such faces are turned over. */
    {
      const dir = new Map(), adj = done.map(() => []);
      done.forEach((r, i) => { for (const t of r.tris) for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3], k = a < b ? a + ',' + b : b + ',' + a; if (!dir.has(k)) dir.set(k, []); dir.get(k).push([i, a < b]); } });
      let openEdges = false; for (const us of dir.values()) { if (us.length !== 2) { openEdges = openEdges || us.length === 1; continue; } const [x, y] = us; if (x[0] !== y[0]) { adj[x[0]].push([y[0], x[1] !== y[1]]); adj[y[0]].push([x[0], x[1] !== y[1]]); } }
      const col = new Int8Array(done.length), comp = new Int32Array(done.length).fill(-1); let nc = 0, turned = 0;
      for (let s0 = 0; s0 < done.length; s0++) {
        if (comp[s0] >= 0) continue; const ids = [s0], vote = new Map(); comp[s0] = nc; col[s0] = 1;
        for (let q = 0; q < ids.length; q++) for (const [j, agree] of adj[ids[q]]) if (comp[j] < 0) { comp[j] = nc; col[j] = agree ? col[ids[q]] : -col[ids[q]]; ids.push(j); }
        // which of the two ways round: a closed part by its volume, an open one by the larger share of its triangles
        let vol = 0, nPlus = 0, nMinus = 0, closed = true;
        for (const i of ids) { for (const t of done[i].tris) { const A = X(t[0]), B = X(t[1]), C = X(t[2]); vol += col[i] * dot(A, cross(B, C)) / 6; } if (col[i] > 0) nPlus += done[i].tris.length; else nMinus += done[i].tris.length; }
        for (const i of ids) for (const t of done[i].tris) for (let e = 0; e < 3 && closed; e++) { const a = t[e], b = t[(e + 1) % 3]; if (dir.get(a < b ? a + ',' + b : b + ',' + a).length !== 2) closed = false; }
        const keep = closed ? (vol >= 0 ? 1 : -1) : (nPlus >= nMinus ? 1 : -1);
        for (const i of ids) if (col[i] !== keep) { const r = done[i]; r.sense = -r.sense; r.tris = r.tris.map(t => [t[0], t[2], t[1]]); turned++; }
        nc++;
      }
      if (turned) log.push(`body ${bi + 1}: ${turned} face(s) were flagged the wrong way round in the file and are turned to agree with their neighbours`);
    }
    for (const r of done) {
      const fr = r.fr;
      if (fr.flip) { r.sense = -r.sense; r.tris = r.tris.map(t => [t[0], t[2], t[1]]); }
      nFaces++; const kind = r.sf.key ? r.sf.t : 'free', key = r.sf.key ? r.sf.key(r.sense) : 'free#' + fr.ref;
      let p = byKey.get(key);
      if (!p) { num[kind] = (num[kind] || 0) + 1; p = { name: pre + names[kind] + num[kind], card: r.sf.card ? r.sf.card(r.sense) : { type: 'free' }, faces: [], note: '' }; byKey.set(key, p); doc.patches.set(p.name, p); count[kind] = (count[kind] || 0) + 1; }
      for (const t of r.tris) { doc.faces.push({ v: t, patch: p.name }); p.faces.push(doc.faces.length - 1); }
      for (const br of get(fr).args[1]) { const lo = get(get(br).args[1]); if (lo.type !== 'EDGE_LOOP') continue; for (const oe of lo.args[1]) { const er = get(oe).args[3].ref; if (!edgeUse.has(er)) edgeUse.set(er, new Set()); edgeUse.get(er).add(p.name); } }
    }
  });
  // points that nothing uses are dropped; the rest keep their order
  const used = new Int32Array(POS.length / 3).fill(-1); let nv = 0;
  for (const f of doc.faces) f.v = f.v.map(i => { if (used[i] < 0) { used[i] = nv++; doc.pos.push(POS[3 * i], POS[3 * i + 1], POS[3 * i + 2]); } return used[i]; });
  // seams: the lines and circles between two different patches
  for (const [er, ps] of edgeUse) {
    if (ps.size !== 2) continue; const [A, B] = [...ps], info = edgeMemo.get(er), c = info && info.curve; if (!c) continue;
    if (c.k === 'line') doc.seams.push({ raw: `#@seam ${A} ${B} line p0=${S.fmtV(X(info.v1))} p1=${S.fmtV(X(info.v2))}`, note: '' });
    else if (c.k === 'circle') doc.seams.push({ raw: `#@seam ${A} ${B} circle c=${S.fmtV(c.f.o)} a=${S.fmtV(c.f.z)} d=${S.fmt(2 * c.r)}`, note: '' });
  }
  const kinds = Object.entries(count).map(([k, n]) => `${n} ${k}`).join(', ');
  doc.preamble = [`Read from STEP: ${nFaces} faces → ${doc.patches.size} patches (${kinds}), ${doc.seams.length} seams, chord ${chord} mm.`];
  if (count.free) log.push(`${count.free} patch(es) lie on surfaces Snark has no card for yet (NURBS, revolution, extrusion): they are kept as their mesh ("free")`);
  return { snark: S.writeSnark(doc), log, bodies: shells.length, faces: nFaces, patches: doc.patches.size, skipped, kinds: count };
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('step_snark.mjs')) {
  const fs = await import('node:fs'), [, , inp, outp, chord] = process.argv;
  if (!inp) { console.log('node step_snark.mjs in.step [out.snark] [chord]'); process.exit(1); }
  const out = outp || inp.replace(/\.[^.]*$/, '') + '.snark', r = stepToSnark(fs.readFileSync(inp, 'utf8'), { title: inp.replace(/^.*[\\/]/, ''), ...(chord ? { chord: +chord } : {}) });
  fs.writeFileSync(out, r.snark);
  console.log(`${out}: ${r.bodies} bodies, ${r.faces} faces → ${r.patches} patches, ${(r.snark.length / 1024).toFixed(0)} KB` + (r.skipped ? `, ${r.skipped} faces left out` : ''));
  for (const m of r.log) console.log('  note: ' + m);
}
