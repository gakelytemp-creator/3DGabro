/* snark_step.mjs — Snark (.snark) → STEP AP214 (B-rep with exact surfaces).  Draft 0.1, 19 November 2026.

   node snark_step.mjs in.snark out.step [chord]

   How it works
   1. The Snark core evaluates the file into a closed mesh, piece by piece; every piece knows its role
      (face, edge strip, corner, cap, rim, feature …).
   2. The mesh is used ONLY for topology: which patch touches which, and in what order (faces, loops, vertices).
   3. Every patch gets its exact surface from the Snark description (cards, edge rules, profiles) — never from the
      triangles. Borders between patches become exact lines, circles or cubic Bézier curves.
   4. A point feature on a flat face is rebuilt from its profile alone: one face per profile segment
      (plane, cylinder, cone, sphere, torus, or a surface of revolution of the cubic).
   5. A sphere with point features is built without any mesh (see convertSphere).
   Whatever has no exact surface yet (blended groups, multi-segment edge profiles) is written as flat facets and
   reported; a body with features over a rounded edge is skipped and reported.
   No dependencies besides snark_core.js. */
import * as S from './snark_core.js';
const { add, sub, mul, dot, cross, len, unit } = S.vec;

const perp = a => unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
const bez = (P, t) => { const u = 1 - t; return P[0].map((_, k) => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };
const bezD = (P, t) => { const u = 1 - t; return P[0].map((_, k) => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])); };
/* parameter of the point of a Bézier nearest to q, by a distance function d(pointOnCurve) */
function nearestT(P, d) {
  let bt = 0, bd = Infinity; const n = 64;
  for (let i = 0; i <= n; i++) { const v = d(bez(P, i / n)); if (v < bd) { bd = v; bt = i / n; } }
  let lo = Math.max(0, bt - 1 / n), hi = Math.min(1, bt + 1 / n);
  for (let k = 0; k < 60; k++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (d(bez(P, a)) < d(bez(P, b))) hi = b; else lo = a; }
  const t = (lo + hi) / 2; return { t, d: d(bez(P, t)) };
}
const radial = (o, a, p) => { const d = sub(p, o); return sub(d, mul(a, dot(d, a))); };

/* ═══════════════════ STEP text ═══════════════════ */
class Step {
  constructor() { this.L = []; this.n = 0; this.c = new Map(); }
  add(s) { this.L.push(`#${++this.n}=${s};`); return '#' + this.n; }
  num(x) { if (Math.abs(x) < 5e-12) x = 0; return x.toFixed(10).replace(/0+$/, ''); }
  memo(k, f) { let v = this.c.get(k); if (!v) this.c.set(k, v = f()); return v; }
  pt(p) { const s = p.map(x => this.num(x)).join(','); return this.memo('P' + s, () => this.add(`CARTESIAN_POINT('',(${s}))`)); }
  dir(d) { const s = unit(d).map(x => this.num(x)).join(','); return this.memo('D' + s, () => this.add(`DIRECTION('',(${s}))`)); }
  vec(d) { return this.add(`VECTOR('',${this.dir(d)},1.)`); }
  a2p(o, z, x) { z = unit(z); x = sub(x, mul(z, dot(x, z))); x = len(x) < 1e-9 ? perp(z) : unit(x); return this.add(`AXIS2_PLACEMENT_3D('',${this.pt(o)},${this.dir(z)},${this.dir(x)})`); }
  a1p(o, z) { return this.add(`AXIS1_PLACEMENT('',${this.pt(o)},${this.dir(z)})`); }
  bezCurve(P) { return this.add(`B_SPLINE_CURVE_WITH_KNOTS('',3,(${P.map(p => this.pt(p)).join(',')}),.UNSPECIFIED.,.F.,.F.,(4,4),(0.,1.),.UNSPECIFIED.)`); }
  /* cubic pieces joined end to end (C1): one B-spline with triple inner knots */
  splCurve(pieces) {
    if (pieces.length === 1) return this.bezCurve(pieces[0]);
    const pts = [pieces[0][0]]; for (const P of pieces) pts.push(P[1], P[2], P[3]);
    const n = pieces.length, mult = [4], kn = ['0.']; for (let i = 1; i < n; i++) { mult.push(3); kn.push(i + '.'); } mult.push(4); kn.push(n + '.');
    return this.add(`B_SPLINE_CURVE_WITH_KNOTS('',3,(${pts.map(p => this.pt(p)).join(',')}),.UNSPECIFIED.,.F.,.F.,(${mult.join(',')}),(${kn.join(',')}),.UNSPECIFIED.)`);
  }
  oe(eid, fwd) { return this.add(`ORIENTED_EDGE('',*,*,${eid},${fwd ? '.T.' : '.F.'})`); }
  loop(list) { return this.add(`EDGE_LOOP('',(${list.join(',')}))`); }
  face(nm, loops, sf, same) { return this.add(`ADVANCED_FACE('${nm}',(${loops.map((l, i) => this.add(`${i ? 'FACE_BOUND' : 'FACE_OUTER_BOUND'}('',${l},.T.)`)).join(',')}),${sf.write(this)},${same ? '.T.' : '.F.'})`); }
  curve(cv) {
    if (cv.k === 'line') return this.add(`LINE('',${this.pt(cv.p)},${this.vec(cv.d)})`);
    if (cv.k === 'circle') return this.add(`CIRCLE('',${this.a2p(cv.c, cv.n, cv.ref || perp(cv.n))},${this.num(cv.r)})`);
    if (cv.k === 'bez') return this.bezCurve(cv.P);
    if (cv.k === 'bspl') return this.splCurve(cv.pieces);
    const n = cv.pts.length, mult = cv.pts.map((_, i) => i === 0 || i === n - 1 ? 2 : 1), kn = cv.pts.map((_, i) => i + '.');
    return this.add(`B_SPLINE_CURVE_WITH_KNOTS('',1,(${cv.pts.map(p => this.pt(p)).join(',')}),.UNSPECIFIED.,.F.,.F.,(${mult.join(',')}),(${kn.join(',')}),.UNSPECIFIED.)`);
  }
  text(name, solids) {
    const h = [`ISO-10303-21;`, `HEADER;`, `FILE_DESCRIPTION(('Snark to STEP, exact surfaces'),'2;1');`,
      `FILE_NAME('${name}','${new Date().toISOString().slice(0, 19)}',('3DGabro'),(''),'snark_step 0.1','snark_step 0.1','');`,
      `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`, `ENDSEC;`, `DATA;`];
    const ac = this.add(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
    this.add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${ac})`);
    const pc = this.add(`PRODUCT_CONTEXT('',${ac},'mechanical')`);
    const pr = this.add(`PRODUCT('${name}','${name}','',(${pc}))`);
    this.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${pr}))`);
    const pf = this.add(`PRODUCT_DEFINITION_FORMATION('','',${pr})`);
    const dc = this.add(`PRODUCT_DEFINITION_CONTEXT('part definition',${ac},'design')`);
    const pd = this.add(`PRODUCT_DEFINITION('design','',${pf},${dc})`);
    const ps = this.add(`PRODUCT_DEFINITION_SHAPE('','',${pd})`);
    const lu = this.add(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`);
    const au = this.add(`(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))`);
    const su = this.add(`(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())`);
    const un = this.add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(${this.num(Math.max(1e-6, this.unc || 0))}),${lu},'distance_accuracy_value','')`);
    const gc = this.add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${un}))GLOBAL_UNIT_ASSIGNED_CONTEXT((${lu},${au},${su}))REPRESENTATION_CONTEXT('',''))`);
    const ax = this.a2p([0, 0, 0], [0, 0, 1], [1, 0, 0]);
    const sr = this.add(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${[ax, ...solids].join(',')}),${gc})`);
    this.add(`SHAPE_DEFINITION_REPRESENTATION(${ps},${sr})`);
    return [...h, ...this.L, `ENDSEC;`, `END-ISO-10303-21;`, ''].join('\n');
  }
}

/* ═══════════════════ exact surfaces ═══════════════════
   nat(p): the surface's own normal at p, as STEP defines it. The face's same_sense flag is found by comparing
   it with the outward normal. dist(p): how far p is from the surface (a check of the mesh against it). */
const Sf = {
  plane(o, n) { n = unit(n); return { t: 'plane', o, n, write: st => st.add(`PLANE('',${st.a2p(o, n, perp(n))})`), nat: () => n, dist: p => Math.abs(dot(sub(p, o), n)) }; },
  cyl(o, a, r, seam) {
    a = unit(a);
    return { t: 'cyl', write: st => st.add(`CYLINDRICAL_SURFACE('',${st.a2p(o, a, seam || perp(a))},${st.num(r)})`), nat: p => unit(radial(o, a, p)), dist: p => Math.abs(len(radial(o, a, p)) - r) };
  },
  cone(o, a, r0, semi, seam) {            // radius r0 at o, growing along a
    a = unit(a);
    return {
      t: 'cone', write: st => st.add(`CONICAL_SURFACE('',${st.a2p(o, a, seam || perp(a))},${st.num(r0)},${st.num(semi)})`),
      nat: p => { const rr = radial(o, a, p), e = len(rr) > 1e-12 ? unit(rr) : perp(a); return unit(sub(mul(e, Math.cos(semi)), mul(a, Math.sin(semi)))); },
      dist: p => Math.abs((len(radial(o, a, p)) - (r0 + dot(sub(p, o), a) * Math.tan(semi))) * Math.cos(semi)),
    };
  },
  sph(c, r, axis, seam) { return { t: 'sph', write: st => st.add(`SPHERICAL_SURFACE('',${st.a2p(c, axis, seam || perp(axis))},${st.num(r)})`), nat: p => unit(sub(p, c)), dist: p => Math.abs(len(sub(p, c)) - r) }; },
  torus(c, a, R, r, seam) {
    a = unit(a);
    const tc = p => { const rr = radial(c, a, p); return add(c, mul(len(rr) > 1e-12 ? unit(rr) : perp(a), R)); };
    return { t: 'torus', write: st => st.add(`TOROIDAL_SURFACE('',${st.a2p(c, a, seam || perp(a))},${st.num(R)},${st.num(r)})`), nat: p => unit(sub(p, tc(p))), dist: p => Math.abs(len(sub(p, tc(p))) - r) };
  },
  /* revolution of a 2D segment g, given in (ρ, z): ρ from the axis, z along it.  STEP: u runs along the curve, v is the angle. */
  rev(o, a, g, seam) {
    a = unit(a); seam = seam || perp(a);
    const to3 = q => add(add(o, mul(seam, q[0])), mul(a, q[1]));
    const nearS = q => { let best = null; for (const P of g.pieces) { const r = nearestT(P, b => Math.hypot(b[0] - q[0], b[1] - q[1])); if (!best || r.d < best.d) best = { ...r, P }; } return best; };
    const tan2 = p => {
      const q = [len(radial(o, a, p)), dot(sub(p, o), a)];
      if (g.t === 'S') { const r = nearS(q); return bezD(r.P, r.t); }
      if (g.t === 'C') return bezD(g.P, nearestT(g.P, b => Math.hypot(b[0] - q[0], b[1] - q[1])).t);
      const d = [q[0] - g.c[0], q[1] - g.c[1]]; return g.ccw ? [-d[1], d[0]] : [d[1], -d[0]];
    };
    return {
      t: 'rev',
      write: st => {
        const cv = g.t === 'S' ? st.splCurve(g.pieces.map(P => P.map(to3))) : g.t === 'C' ? st.bezCurve(g.P.map(to3)) : st.curve({ k: 'circle', c: to3(g.c), n: mul(cross(seam, a), g.ccw ? 1 : -1), r: g.r, ref: seam });
        return st.add(`SURFACE_OF_REVOLUTION('',${cv},${st.a1p(o, a)})`);
      },
      // STEP runs a surface of revolution as (angle, curve): its own normal is e_θ × T
      nat: p => { const d = tan2(p), rr = radial(o, a, p), e = len(rr) > 1e-12 ? unit(rr) : seam; return unit(add(mul(e, d[1]), mul(a, -d[0]))); },
      dist: g.t === 'S' ? p => nearS([len(radial(o, a, p)), dot(sub(p, o), a)]).d : g.t === 'C' ? p => { const q = [len(radial(o, a, p)), dot(sub(p, o), a)]; return nearestT(g.P, b => Math.hypot(b[0] - q[0], b[1] - q[1])).d; }
        : p => { const q = [len(radial(o, a, p)), dot(sub(p, o), a)]; return Math.abs(Math.hypot(q[0] - g.c[0], q[1] - g.c[1]) - g.r); },
    };
  },
  /* a cubic pulled along a straight line */
  ext(P, dir) {
    dir = unit(dir);
    const off = (p, b) => { const d = sub(p, b); return len(sub(d, mul(dir, dot(d, dir)))); };
    return {
      t: 'ext', write: st => st.add(`SURFACE_OF_LINEAR_EXTRUSION('',${st.bezCurve(P)},${st.vec(dir)})`),
      nat: p => unit(cross(bezD(P, nearestT(P, b => off(p, b)).t), dir)), dist: p => nearestT(P, b => off(p, b)).d,
    };
  },
  /* bicubic Bézier patch, G[i][j]: i along u, j along v */
  bezs(G) {
    const row = (u, f) => [0, 1, 2, 3].map(j => f([G[0][j], G[1][j], G[2][j], G[3][j]], u));
    const at = (u, v) => bez(row(u, bez), v), du = (u, v) => bez(row(u, bezD), v), dv = (u, v) => bezD(row(u, bez), v);
    return {
      t: 'bezs',
      write: st => st.add(`B_SPLINE_SURFACE_WITH_KNOTS('',3,3,(${G.map(r => '(' + r.map(p => st.pt(p)).join(',') + ')').join(',')}),.UNSPECIFIED.,.F.,.F.,.F.,(4,4),(4,4),(0.,1.),(0.,1.),.UNSPECIFIED.)`),
      nat: p => { let b = [0.5, 0.5], bd = Infinity; for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) { const d = len(sub(at(i / 24, j / 24), p)); if (d < bd) { bd = d; b = [i / 24, j / 24]; } } return unit(cross(du(b[0], b[1]), dv(b[0], b[1]))); },
    };
  },
};

/* a net of cubic patches joined smoothly (C1): net[(3·nu+1)][(3·nv+1)] */
Sf.grid = (net, nu, nv) => ({
  t: 'grid',
  write: st => {
    const kn = n => { const m = [4], k = ['0.']; for (let i = 1; i < n; i++) { m.push(3); k.push(i + '.'); } m.push(4); k.push(n + '.'); return [m.join(','), k.join(',')]; }, [mu, ku] = kn(nu), [mv, kv] = kn(nv);
    return st.add(`B_SPLINE_SURFACE_WITH_KNOTS('',3,3,(${net.map(r => '(' + r.map(p => st.pt(p)).join(',') + ')').join(',')}),.UNSPECIFIED.,.F.,.F.,.F.,(${mu}),(${mv}),(${ku}),(${kv}),.UNSPECIFIED.)`);
  },
});
/* straight lines between two curves given as matching cubic pieces */
Sf.ruled = (A, B) => ({
  t: 'ruled',
  write: st => {
    const rows = [[A[0][0], B[0][0]]]; A.forEach((P, i) => { for (const k of [1, 2, 3]) rows.push([P[k], B[i][k]]); });
    const n = A.length, m = [4], k = ['0.']; for (let i = 1; i < n; i++) { m.push(3); k.push(i + '.'); } m.push(4); k.push(n + '.');
    return st.add(`B_SPLINE_SURFACE_WITH_KNOTS('',3,1,(${rows.map(r => '(' + r.map(p => st.pt(p)).join(',') + ')').join(',')}),.UNSPECIFIED.,.F.,.F.,.F.,(${m.join(',')}),(2,2),(${k.join(',')}),(0.,1.),.UNSPECIFIED.)`);
  },
});
/* the surface a 2D segment makes when it turns around an axis: the simplest exact kind that fits */
function revSurf(o, a, g, seam) {
  const eps = 1e-9;
  if (g.t === 'L') {
    const dr = g.b[0] - g.a[0], dz = g.b[1] - g.a[1];
    if (Math.abs(dz) < eps) return Sf.plane(add(o, mul(a, g.a[1])), a);
    if (Math.abs(dr) < eps) return Sf.cyl(o, a, g.a[0], seam);
    const up = dz / dr > 0 ? 1 : -1;      // the radius grows along up·a
    return Sf.cone(add(o, mul(a, (g.a[1] + g.b[1]) / 2)), mul(a, up), (g.a[0] + g.b[0]) / 2, Math.atan(Math.abs(dr / dz)), seam);
  }
  if (g.t === 'A') {
    if (Math.abs(g.c[0]) < eps) return Sf.sph(add(o, mul(a, g.c[1])), g.r, a, seam);
    if (g.c[0] > g.r * (1 + 1e-9)) return Sf.torus(add(o, mul(a, g.c[1])), a, g.c[0], g.r, seam);
  }
  return Sf.rev(o, a, g, seam);
}
/* a Snark path → 2D segments, every point sent through f */
function pathSegs(path, f) {
  const out = []; let p = path.start;
  for (const s of path.segs) {
    if (Math.hypot(s.p[0] - p[0], s.p[1] - p[1]) > 1e-12) {
      if (s.t === 'L') out.push({ t: 'L', a: f(p), b: f(s.p) });
      else if (s.t === 'C') out.push({ t: 'C', P: [p, s.c1, s.c2, s.p].map(f), a: f(p), b: f(s.p) });
      else {
        const g = S.arcGeom(p, s.p, s.R); if (!g) throw new Error('impossible arc');
        const am = g.a0 + g.sw / 2, A = f(p), B = f(s.p), Cn = f(g.c), M = f([g.c[0] + g.r * Math.cos(am), g.c[1] + g.r * Math.sin(am)]);
        out.push({ t: 'A', a: A, b: B, c: Cn, r: g.r, ccw: (A[0] - Cn[0]) * (M[1] - Cn[1]) - (A[1] - Cn[1]) * (M[0] - Cn[0]) > 0 });
      }
    }
    p = s.p;
  }
  return out;
}
/* a point of a segment at t in 0…1 */
const segAt = (g, t) => {
  if (g.t === 'L') return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t];
  if (g.t === 'C') return bez(g.P, t);
  const a0 = Math.atan2(g.a[1] - g.c[1], g.a[0] - g.c[0]); let sw = Math.atan2(g.b[1] - g.c[1], g.b[0] - g.c[0]) - a0;
  if (g.ccw) { while (sw <= 0) sw += 2 * Math.PI; } else { while (sw >= 0) sw -= 2 * Math.PI; }
  return [g.c[0] + g.r * Math.cos(a0 + sw * t), g.c[1] + g.r * Math.sin(a0 + sw * t)];
};
/* a curve f(t), t in 0…1, as cubic pieces within tol: each piece takes the curve's own ends and directions */
function fitPieces(f, tol) {
  const D = t => { const e = 1e-6, t0 = Math.max(0, t - e), t1 = Math.min(1, t + e), p0 = f(t0), p1 = f(t1); return [(p1[0] - p0[0]) / (t1 - t0), (p1[1] - p0[1]) / (t1 - t0)]; };
  for (let n = 1; ; n *= 2) {
    const pieces = []; let worst = 0;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, h = (t1 - t0) / 3, p0 = f(t0), p3 = f(t1), d0 = D(t0), d1 = D(t1);
      const P = [p0, [p0[0] + d0[0] * h, p0[1] + d0[1] * h], [p3[0] - d1[0] * h, p3[1] - d1[1] * h], p3]; pieces.push(P);
      for (let k = 1; k < 12; k++) { const q = bez(P, k / 12), w = f(t0 + (t1 - t0) * k / 12); worst = Math.max(worst, Math.hypot(q[0] - w[0], q[1] - w[1])); }
    }
    if (worst <= tol || n >= 256) return { pieces, worst };
  }
}
const segMid = g => {      // a point in the middle of a segment and the direction of travel there
  if (g.t === 'S') { const P = g.pieces[g.pieces.length >> 1], t = g.pieces.length > 1 ? 0 : 0.5; return { p: bez(P, t), d: bezD(P, t) }; }
  if (g.t === 'L') return { p: [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], d: [g.b[0] - g.a[0], g.b[1] - g.a[1]] };
  if (g.t === 'C') return { p: bez(g.P, 0.5), d: bezD(g.P, 0.5) };
  const a0 = Math.atan2(g.a[1] - g.c[1], g.a[0] - g.c[0]); let sw = Math.atan2(g.b[1] - g.c[1], g.b[0] - g.c[0]) - a0;
  if (g.ccw) { while (sw <= 0) sw += 2 * Math.PI; } else { while (sw >= 0) sw -= 2 * Math.PI; }
  const am = a0 + sw / 2, d = [Math.cos(am), Math.sin(am)];
  return { p: [g.c[0] + g.r * d[0], g.c[1] + g.r * d[1]], d: g.ccw ? [-d[1], d[0]] : [d[1], -d[0]] };
};

/* ═══════════════════ what each piece of a body is ═══════════════════ */
const roleKey = r => r.kind === 'face' ? `face:${r.m}${r.s > 0 ? 'p' : 'n'}` : r.kind === 'edge' ? `edge:${r.key}` : r.kind === 'corner' ? `corner:${r.s.map(v => v > 0 ? 'p' : 'n').join('')}`
  : r.kind === 'cap' ? `cap:${r.key}` : r.kind === 'rim' ? `rim:${r.key}` : r.kind === 'feature' ? `feature:${r.host}:${r.id}` : r.kind === 'stored' ? `stored:${r.patch}` : r.kind;

function describe(doc, b, role, insts) {
  const FACET = why => ({ kind: 'facet', why });
  const { c, F, size } = b, keys = new Set(b.edgeKeys || []), path = keys.size ? b.edgePath : null, t = path ? path.start[0] : 0;
  const one = path && path.segs.length === 1 ? path.segs[0] : null;
  if (role.kind === 'stored') {
    const k = doc.patches.get(role.patch)?.card; if (!k) return FACET('no card');
    if (k.type === 'plane') return { kind: 'surf', mk: () => Sf.plane(k.o, k.n), planeN: unit(k.n) };
    if (k.type === 'cyl') return { kind: 'surf', axis: { o: k.o, a: unit(k.a) }, cylR: k.d / 2, mk: s => Sf.cyl(k.o, k.a, k.d / 2, s) };
    if (k.type === 'cone') return { kind: 'surf', axis: { o: k.o, a: unit(k.a) }, mk: s => Sf.cone(k.o, k.a, k.d / 2, k.angle / 2 * Math.PI / 180, s) };
    if (k.type === 'sph') return { kind: 'surf', sph: { c: k.c }, axis: { o: k.c, a: unit(k.a || [0, 0, 1]) }, mk: (s, ax) => Sf.sph(k.c, k.d / 2, ax, s) };
    if (k.type === 'torus') return { kind: 'surf', axis: { o: k.c, a: unit(k.a) }, mk: s => Sf.torus(k.c, k.a, k.R, k.r, s) };
    return FACET('card ' + k.type);
  }
  if (role.kind === 'feature') {
    if (role.id.includes('+') || role.region) return FACET('blended features');
    const f = (insts?.byHost[role.host] || []).find(x => x.id === role.id), H = b.hosts?.[role.host]?.frame;
    if (!f || !H || (b.featureScale ?? 1) !== 1) return FACET('feature not found');
    return { kind: 'plug', inst: f, H };
  }
  if (b.kind === 'sph') return { kind: 'surf', sph: { c }, axis: { o: c, a: F[2] }, mk: (s, ax) => Sf.sph(c, size[0] / 2, ax, s) };
  if (b.kind === 'box') {
    const H = size.map(x => x / 2);
    if (role.kind === 'face') return { kind: 'surf', planeN: mul(F[role.m], role.s), mk: () => Sf.plane(add(c, mul(F[role.m], role.s * H[role.m])), mul(F[role.m], role.s)) };
    if (!one) return FACET('edge profile with several segments');
    if (role.kind === 'edge') {
      const ax = +role.key[0], [i, j] = S.otherAxes(ax), si = role.key[1] === '+' ? 1 : -1, sj = role.key[2] === '+' ? 1 : -1;
      const E0 = add(add(c, mul(F[i], si * H[i])), mul(F[j], sj * H[j]));
      const at = (q, z = 0) => add(add(add(E0, mul(F[j], -q[0] * sj)), mul(F[i], q[1] * si)), mul(F[ax], z));
      const g = pathSegs(path, q => q)[0];
      if (g.t === 'L') return { kind: 'surf', mk: () => Sf.plane(at(g.a), cross(F[ax], sub(at(g.b), at(g.a)))) };
      if (g.t === 'A') return { kind: 'surf', axis: { o: at(g.c), a: F[ax] }, cylR: g.r, mk: s => Sf.cyl(at(g.c), F[ax], g.r, s) };
      const z = H[ax] - t;
      return { kind: 'surf', mk: () => Sf.ext(g.P.map(q => at(q)), F[ax]), cands: [g.P.map(q => at(q, z)), g.P.map(q => at(q, -z))] };
    }
    if (role.kind === 'corner') {
      const s = role.s, W = q => { let p = c.slice(); for (let m = 0; m < 3; m++) p = add(p, mul(F[m], s[m] * ((H[m] - t) + t * q[m]))); return p; };
      const cell = q => [1 + q[1] / t, 1 - q[0] / t];
      if (one.t === 'A') { const g = S.arcGeom(path.start, one.p, one.R), cc = cell(g.c); if (Math.hypot(cc[0], cc[1]) > 1e-9 || Math.abs(g.r - t) > 1e-9) return FACET('arc corner that is not a sphere'); return { kind: 'surf', sph: { c: W([0, 0, 0]) }, mk: (sm, ax) => Sf.sph(W([0, 0, 0]), t, ax, sm) }; }
      if (one.t === 'L') { const p0 = W([1, 0, 0]), p1 = W([0, 1, 0]), p2 = W([0, 0, 1]); return { kind: 'surf', mk: () => Sf.plane(p0, cross(sub(p1, p0), sub(p2, p0))) }; }
      const A = [path.start, one.c1, one.c2, one.p].map(cell);
      const G = A.map(a => A.map(bb => W([a[0] * bb[0], a[1] * bb[0], bb[1]])));
      return { kind: 'surf', mk: () => Sf.bezs(G) };
    }
  }
  if (b.kind === 'cyl') {
    const r = size[0] / 2, hh = size[1] / 2;
    if (role.kind === 'cap') { const s = role.key === 'top' ? 1 : -1; return { kind: 'surf', planeN: mul(F[2], s), mk: () => Sf.plane(add(c, mul(F[2], s * hh)), mul(F[2], s)) }; }
    if (role.kind === 'side') return { kind: 'surf', axis: { o: c, a: F[2] }, cylR: r, mk: s => Sf.cyl(c, F[2], r, s) };
    if (role.kind === 'rim') {
      if (!one) return FACET('edge profile with several segments');
      const s = role.key === 'top' ? 1 : -1, g = pathSegs(path, q => [r - q[0], s * (hh + q[1])])[0];
      const d = { kind: 'surf', axis: { o: c, a: F[2] }, mk: sm => revSurf(c, F[2], g, sm) };
      if (g.t === 'C') d.meridian = e => g.P.map(q => add(add(c, mul(e, q[0])), mul(F[2], q[1])));
      return d;
    }
  }
  return FACET('unknown piece');
}

/* ═══════════════════ borders: line, circle, known cubic, or a polyline ═══════════════════ */
function fitCurve(pts, tol, cands) {
  const n = pts.length, A = pts[0], B = pts[n - 1], closed = len(sub(A, B)) < 1e-9;
  if (!closed) {
    const d = unit(sub(B, A));
    if (pts.every(p => { const v = sub(p, A); return len(sub(v, mul(d, dot(v, d)))) <= tol; })) return { k: 'line', p: A, d };
  }
  if (n >= 3) {
    const M = pts[closed ? Math.floor(n / 3) : n >> 1], Q = closed ? pts[Math.floor(2 * n / 3)] : B;
    const ab = sub(M, A), ac = sub(Q, A), nn = cross(ab, ac);
    if (len(nn) > 1e-9 * len(ab) * len(ac)) {
      const nrm = unit(nn), d = 2 * dot(nn, nn);
      const cen = add(A, mul(add(mul(cross(nn, ab), dot(ac, ac)), mul(cross(ac, nn), dot(ab, ab))), 1 / d)), r = len(sub(A, cen));
      if (pts.every(p => Math.abs(len(sub(p, cen)) - r) <= tol && Math.abs(dot(sub(p, cen), nrm)) <= tol)) {
        let turn = [0, 0, 0]; for (let i = 0; i + 1 < n; i++) turn = add(turn, cross(sub(pts[i], cen), sub(pts[i + 1], cen)));
        return { k: 'circle', c: cen, n: dot(turn, nrm) >= 0 ? nrm : mul(nrm, -1), r };
      }
    }
  }
  for (const P of cands) {
    const ts = pts.map(p => nearestT(P, b => len(sub(b, p))));
    if (ts.every(x => x.d <= Math.max(tol, 1e-6))) return { k: 'bez', P: ts[0].t <= ts[n - 1].t ? P : [...P].reverse() };
  }
  return { k: 'poly', pts };
}

/* ═══════════════════ topology from a labelled mesh ═══════════════════
   T[i] = { v: [a, b, c], p: patch key }. A border is a run of mesh edges between the same two patches; it ends
   where three or more patches meet. A closed border with no such point gets two (a circle becomes two arcs). */
function topology(V, T, forced) {
  const NV = V.length, he = new Map();
  T.forEach((t, ti) => { for (let e = 0; e < 3; e++) he.set(t.v[e] * NV + t.v[(e + 1) % 3], ti); });
  const vp = new Map(), pairs = new Map();
  for (const [k, ti] of he) {
    const a = Math.floor(k / NV), bb = k % NV, tw = he.get(bb * NV + a);
    if (tw === undefined) return null;
    const P = T[ti].p, Q = T[tw].p; if (P === Q) continue;
    for (const v of [a, bb]) { let s = vp.get(v); if (!s) vp.set(v, s = new Set()); s.add(P); s.add(Q); }
    if (P < Q) { const pk = P + '|' + Q; let m = pairs.get(pk); if (!m) pairs.set(pk, m = { P, Q, out: new Map() }); if (!m.out.has(a)) m.out.set(a, []); m.out.get(a).push(bb); }
  }
  const K = new Set(forced || []); for (const [v, s] of vp) if (s.size >= 3) K.add(v);
  for (const m of pairs.values()) {
    const seen = new Set();
    for (const a0 of m.out.keys()) {
      if (seen.has(a0)) continue;
      const cyc = []; let a = a0, hit = false;
      while (!seen.has(a)) { seen.add(a); cyc.push(a); if (K.has(a)) hit = true; const o = m.out.get(a); if (!o) { hit = true; break; } a = o[0]; }
      if (!hit && a === a0) { K.add(cyc[0]); K.add(cyc[cyc.length >> 1]); }
    }
  }
  const chains = [];
  for (const m of pairs.values()) {
    const used = new Set();
    for (const [a0, outs] of m.out) {
      if (!K.has(a0)) continue;
      for (const b0 of outs) {
        if (used.has(a0 * NV + b0)) continue;
        const vs = [a0]; let a = a0, nx = b0;
        for (;;) { used.add(a * NV + nx); vs.push(nx); if (K.has(nx)) break; a = nx; nx = m.out.get(a)?.find(x => !used.has(a * NV + x)); if (nx === undefined) break; }
        chains.push({ P: m.P, Q: m.Q, vs });
      }
    }
  }
  return { chains, vp, K };
}
const usesOf = chains => { const uses = new Map(); for (const ch of chains) for (const [k, fwd] of [[ch.P, true], [ch.Q, false]]) { if (!uses.has(k)) uses.set(k, []); uses.get(k).push({ ch, fwd, a: fwd ? ch.vs[0] : ch.vs[ch.vs.length - 1], z: fwd ? ch.vs[ch.vs.length - 1] : ch.vs[0] }); } return uses; };
/* one patch → ADVANCED_FACE: its borders followed head to tail make the loops; its triangles give the outward side */
function patchFace(st, P, us, V, T) {
  const cen = ti => mul(add(add(V[T[ti].v[0]], V[T[ti].v[1]]), V[T[ti].v[2]]), 1 / 3), triN = ti => cross(sub(V[T[ti].v[1]], V[T[ti].v[0]]), sub(V[T[ti].v[2]], V[T[ti].v[0]]));
  const from = new Map(); for (const u of us) { if (!from.has(u.a)) from.set(u.a, []); from.get(u.a).push(u); }
  const loops = [], done = new Set();
  for (const u0 of us) {
    if (done.has(u0)) continue;
    const L = []; let u = u0;
    while (u && !done.has(u)) { done.add(u); L.push(u); u = (from.get(u.z) || []).find(x => !done.has(x)) || (u.z === u0.a ? null : undefined); }
    loops.push(L);
  }
  if (!loops.length) return null;
  // the outward normal, from the biggest triangle; the seam of a round surface goes to the far side
  let bt = P.tris[0], ba = 0, mean = [0, 0, 0], area = 0;
  for (const ti of P.tris) { const a = len(triN(ti)); if (a > ba) { ba = a; bt = ti; } mean = add(mean, mul(cen(ti), a)); area += a; }
  mean = mul(mean, 1 / area);
  let seam, axis;
  if (P.desc.axis) { const r = radial(P.desc.axis.o, P.desc.axis.a, mean); seam = len(r) > 1e-9 ? mul(unit(r), -1) : undefined; axis = P.desc.axis.a; }
  else if (P.desc.sph) { const d = unit(sub(mean, P.desc.sph.c)); axis = perp(d); seam = mul(d, -1); }
  const sf = P.desc.mk(seam, axis), same = dot(sf.nat(cen(bt)), triN(bt)) > 0;
  if (sf.t === 'plane' && loops.length > 1) {        // the outer loop of a flat face is the one that turns counter-clockwise
    const n = mul(sf.n, same ? 1 : -1), ar = L => { let s = [0, 0, 0]; for (const u of L) { const vs = u.fwd ? u.ch.vs : [...u.ch.vs].reverse(); for (let i = 0; i + 1 < vs.length; i++) s = add(s, cross(V[vs[i]], V[vs[i + 1]])); } return dot(s, n); };
    loops.sort((x, y) => ar(y) - ar(x));
  }
  return st.face(P.key, loops.map(L => st.loop(L.map(u => st.oe(u.ch.eid(), u.fwd)))), sf, same);
}

/* ═══════════════════ one body → MANIFOLD_SOLID_BREP ═══════════════════ */
function convertBody(st, doc, entry, name, log, opts, analyseOnly) {
  const b = entry.body, stored = b.kind === 'mesh', tol = stored ? 2e-4 : 1e-6;
  if (entry.skin && b.kind === 'sph') return convertSphere(st, b, S.bodyInstances(b, []), name, log, opts);
  if (entry.skin) return convertSkin(st, doc, entry, name, log, opts);
  const insts = b.hosts && Object.keys(b.hosts).length ? S.bodyInstances(b, []) : null;
  // 1. one welded mesh; every triangle remembers its patch
  const V = [], vmap = new Map(), T = [], patches = new Map();
  const vid = (x, y, z) => { const k = Math.round(x / 1e-6) + ',' + Math.round(y / 1e-6) + ',' + Math.round(z / 1e-6); let i = vmap.get(k); if (i === undefined) { i = V.length; vmap.set(k, i); V.push([x, y, z]); } return i; };
  for (const pc of entry.pieces) {
    const key = roleKey(pc.role);
    if (!patches.has(key)) patches.set(key, { key, desc: describe(doc, b, pc.role, insts), tris: [] });
    const loc = []; for (let i = 0; i < pc.pos.length; i += 3) loc.push(vid(pc.pos[i], pc.pos[i + 1], pc.pos[i + 2]));
    for (let i = 0; i < pc.idx.length; i += 3) { const t = [loc[pc.idx[i]], loc[pc.idx[i + 1]], loc[pc.idx[i + 2]]]; if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) { patches.get(key).tris.push(T.length); T.push({ v: t, p: key }); } }
  }
  const cen = ti => mul(add(add(V[T[ti].v[0]], V[T[ti].v[1]]), V[T[ti].v[2]]), 1 / 3);
  const triN = ti => cross(sub(V[T[ti].v[1]], V[T[ti].v[0]]), sub(V[T[ti].v[2]], V[T[ti].v[0]]));
  // 2. the mesh must lie on the surface it is said to approximate
  for (const P of patches.values()) {
    if (P.desc.kind !== 'surf') continue;
    const sf = P.desc.mk(undefined, P.desc.axis?.a || [0, 0, 1]); if (!sf.dist) continue;
    let worst = 0; for (const ti of P.tris) for (const v of T[ti].v) worst = Math.max(worst, sf.dist(V[v]));
    if (worst > tol * 5) { log.push(`${name} ${P.key}: its points are up to ${worst.toExponential(1)} mm off its exact surface — written as facets`); P.desc = { kind: 'facet', why: 'off surface' }; }
  }
  // 3. a patch that goes all the way round its axis is cut in two halves along two meridians of the mesh,
  //    so no face closes on itself (every reader handles such faces)
  const forced = new Set();
  for (const P of [...patches.values()]) {
    const ax = P.desc.kind === 'surf' && P.desc.axis; if (!ax) continue;
    const e1 = perp(ax.a), e2 = cross(ax.a, e1), ang = p => { const r = radial(ax.o, ax.a, p); return Math.atan2(dot(r, e2), dot(r, e1)); };
    const ca = P.tris.map(ti => ang(cen(ti))).sort((x, y) => x - y);
    let gap = ca[0] + 2 * Math.PI - ca[ca.length - 1]; for (let i = 1; i < ca.length; i++) gap = Math.max(gap, ca[i] - ca[i - 1]);
    if (gap > Math.PI / 3) { if (P.desc.sph) delete P.desc.axis; continue; }
    const vs = new Set(); for (const ti of P.tris) for (const v of T[ti].v) vs.add(v);
    let th0 = null, th1 = null, best = Infinity;
    for (const v of vs) { if (len(radial(ax.o, ax.a, V[v])) < 1e-9) { forced.add(v); continue; } if (th0 === null) th0 = ang(V[v]); }
    const wrap = x => { x = x % (2 * Math.PI); return x < 0 ? x + 2 * Math.PI : x; };
    for (const v of vs) { if (len(radial(ax.o, ax.a, V[v])) < 1e-9) continue; const d = Math.abs(wrap(ang(V[v]) - th0) - Math.PI); if (d < best) { best = d; th1 = ang(V[v]); } }
    const span = wrap(th1 - th0), sp = { of: P.key, o: ax.o, a: ax.a, e1, e2, th0, span };
    const A = { key: P.key + '~a', desc: P.desc, tris: [], split: sp }, B = { key: P.key + '~b', desc: P.desc, tris: [], split: sp };
    for (const ti of P.tris) { const h = wrap(ang(cen(ti)) - th0) < span ? A : B; h.tris.push(ti); T[ti].p = h.key; }
    patches.delete(P.key); patches.set(A.key, A); patches.set(B.key, B);
  }
  // 4. what has no exact surface: every triangle becomes a flat face of its own
  let facets = 0;
  for (const P of [...patches.values()]) {
    if (P.desc.kind !== 'facet') continue;
    facets += P.tris.length; patches.delete(P.key);
    for (const ti of P.tris) { const k = P.key + '#' + ti, n = triN(ti), o = V[T[ti].v[0]]; T[ti].p = k; patches.set(k, { key: k, desc: { kind: 'surf', mk: () => Sf.plane(o, n), planeN: unit(n) }, tris: [ti] }); }
    log.push(`${name} ${P.key}: ${P.desc.why} — ${P.tris.length} flat facets (approximate)`);
  }
  if (facets > opts.maxFacets) { log.push(`${name}: ${facets} facets is more than the limit of ${opts.maxFacets} — body skipped`); return null; }
  // 5. borders between patches
  const tp = topology(V, T, forced); if (!tp) { log.push(`${name}: the mesh is open — body skipped`); return null; }
  const chains = tp.chains;
  // 6. the exact curve of every border
  let polys = 0;
  for (const ch of chains) {
    const pts = ch.vs.map(v => V[v]), dP = patches.get(ch.P).desc, dQ = patches.get(ch.Q).desc, cands = [...(dP.cands || []), ...(dQ.cands || [])];
    for (const d of [dP, dQ]) if (d.meridian && d.axis) { const r = radial(d.axis.o, d.axis.a, pts[pts.length >> 1]); if (len(r) > 1e-9) cands.push(d.meridian(unit(r))); }
    const cv = ch.curve = fitCurve(pts, tol, cands);
    if (cv.k === 'poly') polys++;
    // snap to the cards where the file's own numbers are rounded
    if (cv.k === 'circle') for (const d of [dP, dQ]) if (d.axis && Math.abs(dot(cv.n, d.axis.a)) > 1 - 1e-7 && len(radial(d.axis.o, d.axis.a, cv.c)) < 10 * tol) {
      cv.c = add(d.axis.o, mul(d.axis.a, dot(sub(cv.c, d.axis.o), d.axis.a))); cv.n = mul(d.axis.a, dot(cv.n, d.axis.a) > 0 ? 1 : -1); if (d.cylR) cv.r = d.cylR; break;
    }
    if (cv.k === 'line' && dP.planeN && dQ.planeN) { const d = cross(dP.planeN, dQ.planeN); if (len(d) > 1e-6) cv.d = mul(unit(d), dot(d, cv.d) > 0 ? 1 : -1); }
  }
  if (analyseOnly) return { V, T, patches, chains, approx: facets + polys };
  if (polys) log.push(`${name}: ${polys} border(s) are neither a line, a circle nor a known cubic — written as polylines (approximate)`);
  // 7. STEP topology
  const vert = new Map(), Vp = v => { let id = vert.get(v); if (!id) vert.set(v, id = st.add(`VERTEX_POINT('',${st.pt(V[v])})`)); return id; };
  for (const ch of chains) { let id = null; ch.eid = () => id || (id = st.add(`EDGE_CURVE('',${Vp(ch.vs[0])},${Vp(ch.vs[ch.vs.length - 1])},${st.curve(ch.curve)},.T.)`)); }
  const oe = (eid, fwd) => st.oe(eid, fwd), loop = list => st.loop(list), face = (nm, loops, sf, same) => st.face(nm, loops, sf, same);
  const uses = usesOf(chains);
  const faces = [];
  for (const P of patches.values()) {
    const us = uses.get(P.key) || [];
    if (P.desc.kind === 'plug') { faces.push(...plug(P, us)); continue; }
    const f = patchFace(st, P, us, V, T); if (f) faces.push(f); else log.push(`${name} ${P.key}: a face without a border — skipped`);
  }
  const shell = st.add(`CLOSED_SHELL('',(${faces.join(',')}))`);
  return st.add(`MANIFOLD_SOLID_BREP('${name}',${shell})`);


  /* A point feature on a flat face, straight from its profile: no triangles are used, only the two arcs
     of its border circle, which the host face shares. */
  function plug(P, us) {
    const { inst, H } = P.desc, n = H.n, C0 = add(add(H.o, mul(H.U, inst.c[0])), mul(H.V, inst.c[1]));
    if (us.length !== 2 || us.some(u => u.ch.curve.k !== 'circle')) { log.push(`${name} ${P.key}: unexpected border — skipped`); return []; }
    for (const u of us) { const cv = u.ch.curve, sg = dot(cv.n, n) > 0 ? 1 : -1; cv.c = C0; cv.n = mul(n, sg); cv.r = inst.R; u.sg = sg; }
    // each border arc, walked counter-clockwise about n: from which vertex, and is that the edge's own direction
    const arcs = us.map(u => { const v0 = u.ch.vs[0], v1 = u.ch.vs[u.ch.vs.length - 1]; return u.sg > 0 ? { from: v0, to: v1, eid: u.ch.eid(), fwd: true } : { from: v1, to: v0, eid: u.ch.eid(), fwd: false }; });
    const va = arcs[0].from, vb = arcs[0].to, angOf = v => { const d = sub(V[v], C0); return Math.atan2(dot(d, H.V), dot(d, H.U)); };
    return ringStack(st, P.key, { C0, n, U: H.U, V: H.V, th: [angOf(va), angOf(vb)] }, pathSegs(inst.path, q => q), { v: [Vp(va), Vp(vb)], arc: arcs });
  }
}

/* The faces of a point feature: one ring per segment of its generatrix. gens are 2D segments in (ρ, z) about the
   axis (C0, n), from the centre outwards; the last node is the border circle, whose two arcs the host shares.
   A flat ring is one face; every other ring is two halves, so that no face closes on itself. */
function ringStack(st, key, fr, gens, last) {
  const { C0, n, th } = fr, out = [], er = a => add(mul(fr.U, Math.cos(a)), mul(fr.V, Math.sin(a)));
  const P3 = (q, a) => add(add(C0, mul(er(a), q[0])), mul(n, q[1]));
  const nodes = [gens[0].a, ...gens.map(g => g.b)];
  const N = nodes.map((q, k) => {
    if (k === nodes.length - 1) return last;
    if (q[0] < 1e-9) { const v = st.add(`VERTEX_POINT('',${st.pt(P3(q, 0))})`); return { apex: true, v: [v, v] }; }
    const v = th.map(a => st.add(`VERTEX_POINT('',${st.pt(P3(q, a))})`)), cir = { k: 'circle', c: add(C0, mul(n, q[1])), n, r: q[0], ref: er(th[0]) };
    return { v, arc: [{ eid: st.add(`EDGE_CURVE('',${v[0]},${v[1]},${st.curve(cir)},.T.)`), fwd: true }, { eid: st.add(`EDGE_CURVE('',${v[1]},${v[0]},${st.curve(cir)},.T.)`), fwd: true }] };
  });
  gens.forEach((g, i) => {
    const A = N[i], B = N[i + 1], nm = `${key}/${i + 1}`;
    if (A.apex && B.apex) return;
    if (g.t === 'L' && Math.abs(g.a[1] - g.b[1]) < 1e-9) {      // a flat ring or disc
      const loops = [st.loop([st.oe(B.arc[0].eid, B.arc[0].fwd), st.oe(B.arc[1].eid, B.arc[1].fwd)])];
      if (!A.apex) loops.push(st.loop([st.oe(A.arc[1].eid, !A.arc[1].fwd), st.oe(A.arc[0].eid, !A.arc[0].fwd)]));
      out.push(st.face(nm, loops, Sf.plane(add(C0, mul(n, g.a[1])), n), g.b[0] > g.a[0])); return;
    }
    const mer = th.map((a, j) => {
      const e = er(a), cv = g.t === 'L' ? { k: 'line', p: P3(g.a, a), d: unit(sub(P3(g.b, a), P3(g.a, a))) } : g.t === 'C' ? { k: 'bez', P: g.P.map(q => P3(q, a)) }
        : g.t === 'S' ? { k: 'bspl', pieces: g.pieces.map(P => P.map(q => P3(q, a))) } : { k: 'circle', c: P3(g.c, a), n: mul(cross(e, n), g.ccw ? 1 : -1), r: g.r, ref: e };
      return st.add(`EDGE_CURVE('',${A.v[j]},${B.v[j]},${st.curve(cv)},.T.)`);
    });
    const md = segMid(g);
    for (const j of [0, 1]) {
      const s = j, e = 1 - j, span = ((th[e] - th[s]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), am = th[s] + span / 2;
      const L = [st.oe(B.arc[j].eid, B.arc[j].fwd), st.oe(mer[e], false)]; if (!A.apex) L.push(st.oe(A.arc[j].eid, !A.arc[j].fwd)); L.push(st.oe(mer[s], true));
      const sf = revSurf(C0, n, g, mul(er(am), -1)), out3 = add(mul(er(am), -md.d[1]), mul(n, md.d[0]));
      out.push(st.face(`${nm}${'ab'[j]}`, [st.loop(L)], sf, dot(sf.nat(P3(md.p, am)), out3) > 0));
    }
  });
  return out;
}

/* ═══════════════════ a sphere with point features ═══════════════════
   No mesh at all. A feature on a sphere is a surface of revolution about the line from the sphere's centre through
   the feature's centre: with r measured through space (SNARK.md §7.5), a point at the angle θ from that line has
   r = 2·Rs·sin(θ/2) and lies at the distance Rs + P(r) from the centre. So:
     a level piece of the profile  → a concentric sphere (exact)
     a wall (r constant)           → a cone with its tip at the sphere's centre (exact)
     anything else                 → a generatrix fitted with cubic pieces within opts.fit, turned exactly
   The border of the feature is an exact circle of the sphere. */
function convertSphere(st, b, insts, name, log, opts) {
  const C = b.c, Rs = b.size[0] / 2, fs = insts.all.map(f => ({ f, d: unit(f.dir), tm: 2 * Math.asin(Math.min(1, f.R / (2 * Rs))) }));
  if ((b.featureScale ?? 1) !== 1) { log.push(`${name}: heights are scaled (animation) — body skipped`); return null; }
  for (const x of fs) if (x.f.R > 1.3 * Rs) { log.push(`${name}: feature ${x.f.id} covers more than a third of the sphere — body skipped`); return null; }
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) if (Math.acos(Math.max(-1, Math.min(1, dot(fs[i].d, fs[j].d)))) < fs[i].tm + fs[j].tm + 1e-4) {
    log.push(`${name}: features ${fs[i].f.id} and ${fs[j].f.id} overlap — blended features have no exact form yet, body skipped`); return null;
  }
  const faces = [], holes = []; let worst = 0, fitted = 0;
  for (const x of fs) {
    const U = perp(x.d), Vv = cross(x.d, U), key = `feature:${x.f.host}:${x.f.id}`;
    const toRZ = q => { const t = 2 * Math.asin(Math.min(1, Math.max(0, q[0]) / (2 * Rs))); return [(Rs + q[1]) * Math.sin(t), (Rs + q[1]) * Math.cos(t)]; };
    const gens = pathSegs(x.f.path, q => q).map(g => {
      const a = toRZ(g.a), bb = toRZ(g.b);
      if (g.t === 'L' && Math.abs(g.a[1] - g.b[1]) < 1e-9) return { t: 'A', a, b: bb, c: [0, 0], r: Rs + g.a[1], ccw: false };
      if (g.t === 'L' && Math.abs(g.a[0] - g.b[0]) < 1e-9) return { t: 'L', a, b: bb };
      const fit = fitPieces(t => toRZ(segAt(g, t)), opts.fit); worst = Math.max(worst, fit.worst); fitted++;
      return { t: 'S', a, b: bb, pieces: fit.pieces };
    });
    const cen = add(C, mul(x.d, Rs * Math.cos(x.tm))), cir = { k: 'circle', c: cen, n: x.d, r: Rs * Math.sin(x.tm), ref: U };
    const v = [U, mul(U, -1)].map(e => st.add(`VERTEX_POINT('',${st.pt(add(cen, mul(e, cir.r)))})`));
    const arc = [{ eid: st.add(`EDGE_CURVE('',${v[0]},${v[1]},${st.curve(cir)},.T.)`), fwd: true }, { eid: st.add(`EDGE_CURVE('',${v[1]},${v[0]},${st.curve(cir)},.T.)`), fwd: true }];
    faces.push(...ringStack(st, key, { C0: C, n: x.d, U, V: Vv, th: [0, Math.PI] }, gens, { v, arc }));
    holes.push({ d: x.d, loop: () => st.loop([st.oe(arc[1].eid, false), st.oe(arc[0].eid, false)]) });
  }
  if (fitted) log.push(`${name}: ${fitted} curved ring(s) of features on the sphere are fitted with cubic pieces, within ${worst.toExponential(1)} mm of the exact shape`);
  // the sphere itself: cut in two along a great circle that passes between the features, when there is one
  const fib = k => { const z = 1 - 2 * (k + 0.5) / 4000, r = Math.sqrt(1 - z * z), a = k * 2.399963229728653; return [r * Math.cos(a), r * Math.sin(a), z]; };
  let m = null, best = 0.01;
  for (const cand of [b.F[0], b.F[1], b.F[2], ...Array.from({ length: 4000 }, (_, k) => fib(k))]) {
    const clear = Math.min(...fs.map(x => Math.asin(Math.min(1, Math.abs(dot(cand, x.d)))) - x.tm));
    if (clear > best) { best = clear; m = unit(cand); }
  }
  if (m) {
    const a = perp(m), N = st.add(`VERTEX_POINT('',${st.pt(add(C, mul(a, Rs)))})`), Sv = st.add(`VERTEX_POINT('',${st.pt(add(C, mul(a, -Rs)))})`);
    const gc = { k: 'circle', c: C, n: m, r: Rs, ref: a }, e1 = st.add(`EDGE_CURVE('',${N},${Sv},${st.curve(gc)},.T.)`), e2 = st.add(`EDGE_CURVE('',${Sv},${N},${st.curve(gc)},.T.)`);
    for (const side of [1, -1]) {
      const loops = [side > 0 ? st.loop([st.oe(e1, true), st.oe(e2, true)]) : st.loop([st.oe(e2, false), st.oe(e1, false)])];
      for (const h of holes) if (dot(h.d, m) * side > 0) loops.push(h.loop());
      faces.push(st.face(`surface~${side > 0 ? 'a' : 'b'}`, loops, Sf.sph(C, Rs, a, mul(m, -side)), true));
    }
  } else {
    // no such circle: one face with the holes only; its poles and seam are put where no feature is
    let ax = b.F[2], sm = perp(b.F[2]), bc = -Infinity;
    for (let k = 0; k < 4000 && bc < 0.02; k++) {
      const p = fib(k), ang = (q, d) => Math.acos(Math.max(-1, Math.min(1, dot(q, d))));
      if (fs.some(x => ang(p, x.d) < x.tm + 0.02 || ang(mul(p, -1), x.d) < x.tm + 0.02)) continue;
      const u = perp(p), w = cross(p, u);
      for (let j = 0; j < 72; j++) {
        const s = add(mul(u, Math.cos(j * Math.PI / 36)), mul(w, Math.sin(j * Math.PI / 36))); let cl = Infinity;
        for (let i = 0; i <= 90; i++) { const q = add(mul(p, Math.cos(i * Math.PI / 90)), mul(s, Math.sin(i * Math.PI / 90))); for (const x of fs) cl = Math.min(cl, Math.acos(Math.max(-1, Math.min(1, dot(q, x.d)))) - x.tm); }
        if (cl > bc) { bc = cl; ax = p; sm = s; }
      }
    }
    log.push(`${name}: no great circle passes between the features — the sphere is one face with ${holes.length} holes${bc < 0 ? ' (its seam crosses a feature: some readers may not like it)' : ''}`);
    faces.push(st.face('surface', holes.map(h => h.loop()), Sf.sph(C, Rs, ax, sm), true));
  }
  return st.add(`MANIFOLD_SOLID_BREP('${name}',${st.add(`CLOSED_SHELL('',(${faces.join(',')}))`)})`);
}

/* ═══════════════════ a box or a cylinder with features over its rounded edges ═══════════════════
   Here a feature is no longer a simple surface: the surface under it is made of several pieces (a face, an edge
   bar, a corner), r is measured through space and the height is laid along the normal of the surface under each
   point (SNARK.md §7.5). So:
   - the body's own faces are exact as before, with the feature's footprint (the points within R of its centre)
     cut out of them; the footprint's border is an exact curve of the body's surface;
   - the feature is one ring per profile segment, each in two halves. A ring that stays on the flat part is the
     exact surface it always was. A ring that goes over an edge is a NURBS net fitted to the true shape within
     opts.fitS; its edges are curves fitted within opts.fit.
   Topology comes from a fine grid over the bare body (the skin of the Snark core), cut along each footprint. */

/* the bare body as g(p) = 0, negative inside: flat parts, edge bars, and corners by the product rule (§7.4);
   and its outward normal at a point of the surface, each piece by its own formula (so it is exact on the borders too) */
const segD = (g, t) => {
  if (g.t === 'L') return [g.b[0] - g.a[0], g.b[1] - g.a[1]]; if (g.t === 'C') return bezD(g.P, t);
  const a0 = Math.atan2(g.a[1] - g.c[1], g.a[0] - g.c[0]); let sw = Math.atan2(g.b[1] - g.c[1], g.b[0] - g.c[0]) - a0;
  if (g.ccw) { while (sw <= 0) sw += 2 * Math.PI; } else { while (sw >= 0) sw -= 2 * Math.PI; }
  return [-g.r * sw * Math.sin(a0 + sw * t), g.r * sw * Math.cos(a0 + sw * t)];
};
function bodyImplicit(b) {
  const { c, F, size } = b, t = b.edgePath.start[0];
  const sec = pathSegs(b.edgePath, q => [1 + q[1] / t, 1 - q[0] / t])[0];        // the section in the unit corner cell: (1,0) → (0,1)
  if (sec.t === 'A') sec.r = Math.hypot(sec.a[0] - sec.c[0], sec.a[1] - sec.c[1]);      // the cell is scaled by 1/t
  const N = 512, tab = []; for (let i = 0; i <= N; i++) tab.push(segAt(sec, i / N));
  const inv = (fn, target) => {        // the parameter of the section where fn = target (fn grows along it)
    let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fn(tab[m]) <= target) lo = m; else hi = m; }
    let x0 = lo / N, x1 = hi / N, f0 = fn(tab[lo]) - target, f1 = fn(tab[hi]) - target;
    if (f0 >= 0) return x0; if (f1 <= 0) return x1;
    for (let k = 0, side = 0; k < 60 && x1 - x0 > 1e-15; k++) {        // false position, kept inside its bracket (the section ends flat: plain secant stalls there)
      let x = x1 - f1 * (x1 - x0) / (f1 - f0); if (!(x > x0 && x < x1) || k % 3 === 2) x = (x0 + x1) / 2;
      const fx = fn(segAt(sec, x)) - target; if (fx === 0) return x;
      if (fx > 0) { x1 = x; f1 = fx; if (side === 1) f0 /= 2; side = 1; } else { x0 = x; f0 = fx; if (side === -1) f1 /= 2; side = -1; }
    }
    return (x0 + x1) / 2;
  };
  const byAngle = (a, bb) => inv(q => Math.atan2(q[1], q[0]), Math.min(Math.PI / 2, Math.max(0, Math.atan2(bb, a))));
  const bar = (a, bb) => { const p = segAt(sec, byAngle(a, bb)); return t * (Math.hypot(a, bb) - Math.hypot(p[0], p[1])); };
  const tan = x => { const d = segD(sec, x), l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
  if (b.kind === 'box') {
    const H = size.map(x => x / 2), loc = p => { const d = sub(p, c), x = [0, 1, 2].map(i => dot(d, F[i])); return { sg: x.map(v => v >= 0 ? 1 : -1), e: x.map((v, i) => Math.abs(v) - (H[i] - t)) }; };
    const out = (n, sg) => unit(add(add(mul(F[0], n[0] * sg[0]), mul(F[1], n[1] * sg[1])), mul(F[2], n[2] * sg[2])));
    return {
      g: p => {
        const { e } = loc(p), pos = (e[0] > 0) + (e[1] > 0) + (e[2] > 0);
        if (pos <= 1) return Math.max(e[0], e[1], e[2]) - t;
        if (pos === 2) { const ax = e[0] <= 0 ? 0 : e[1] <= 0 ? 1 : 2, [i, j] = S.otherAxes(ax); return bar(e[i] / t, e[j] / t); }
        const q3 = e[2] / t; if (q3 >= 1) return Math.hypot(e[0], e[1]) + t * (q3 - 1);
        const p2 = segAt(sec, byAngle(e[0], e[1]));
        return Math.hypot(e[0], e[1]) - t * segAt(sec, inv(q => q[1], q3))[0] * Math.hypot(p2[0], p2[1]);
      },
      nrm: p => {
        const { e, sg } = loc(p), pos = (e[0] > 0) + (e[1] > 0) + (e[2] > 0), n = [0, 0, 0];
        if (pos <= 1) { n[e[0] >= e[1] && e[0] >= e[2] ? 0 : e[1] >= e[2] ? 1 : 2] = 1; return out(n, sg); }
        if (pos === 2) { const ax = e[0] <= 0 ? 0 : e[1] <= 0 ? 1 : 2, [i, j] = S.otherAxes(ax), d = tan(byAngle(e[i], e[j])); n[i] = d[1]; n[j] = -d[0]; return out(n, sg); }
        const w = inv(q => q[1], Math.min(1, e[2] / t)), B = segAt(sec, w), tb = tan(w);
        if (B[0] < 1e-9) { n[2] = 1; return out(n, sg); }
        const u = byAngle(e[0], e[1]), A = segAt(sec, u), ta = tan(u);
        n[0] = tb[1] * ta[1]; n[1] = -tb[1] * ta[0]; n[2] = -tb[0] * (A[0] * ta[1] - A[1] * ta[0]); return out(n, sg);
      },
    };
  }
  const r = size[0] / 2, hh = size[1] / 2, loc = p => { const d = sub(p, c), z = dot(d, F[2]), rv = sub(d, mul(F[2], z)), rl = len(rv); return { z, rh: rl > 1e-12 ? mul(rv, 1 / rl) : perp(F[2]), ea: Math.abs(z) - (hh - t), er: rl - (r - t) }; };
  return {
    g: p => { const { ea, er } = loc(p); return ea <= 0 || er <= 0 ? Math.max(ea, er) - t : bar(ea / t, er / t); },
    nrm: p => { const { z, rh, ea, er } = loc(p), up = mul(F[2], z >= 0 ? 1 : -1); if (ea <= 0 || er <= 0) return ea >= er ? up : rh; const d = tan(byAngle(ea, er)); return unit(add(mul(up, d[1]), mul(rh, -d[0]))); },
  };
}

/* a curve f(x), x in 0…1, in any number of coordinates → cubic pieces within tol; each piece takes the curve's
   own ends and directions (the curves met here run evenly in x: an angle round a centre, or the profile's own run) */
function fitArc(f, tol) {
  const dist = (p, q) => { let s = 0; for (let k = 0; k < p.length; k++) s += (p[k] - q[k]) ** 2; return Math.sqrt(s); }, e = 1e-5;
  const D = x => { const a = Math.max(0, x - e), z = Math.min(1, x + e), pa = f(a), pz = f(z); return pa.map((v, k) => (pz[k] - v) / (z - a)); };
  const pts = []; for (let i = 0; i <= 32; i++) pts.push(f(i / 32).slice(0, 3));
  for (let m = 1; ; m *= 2) {
    const pieces = []; let worst = 0, p0 = f(0), d0 = D(0);
    for (let i = 0; i < m; i++) {
      const x0 = i / m, x1 = (i + 1) / m, h = (x1 - x0) / 3, p3 = f(x1), d1 = D(x1);
      const B = [p0, p0.map((v, k) => v + d0[k] * h), p3.map((v, k) => v - d1[k] * h), p3]; pieces.push(B);
      for (let k = 1; k < 6; k++) worst = Math.max(worst, dist(bez(B, k / 6), f(x0 + (x1 - x0) * k / 6)));
      p0 = p3; d0 = d1;
    }
    if (worst <= tol || m >= 128) return { pieces, worst, pts };
  }
}

/* a surface F(u, v), u and v in 0…1 → a net of cubic patches joined smoothly, within tol where it can */
function fitGrid(F, tol, nu, nv, maxNodes) {
  const e = 2e-5;
  const d1 = (f, x) => x < e ? mul(add(add(mul(f(0), -3), mul(f(e), 4)), mul(f(2 * e), -1)), 1 / (2 * e)) : x > 1 - e ? mul(add(add(mul(f(1), 3), mul(f(1 - e), -4)), f(1 - 2 * e)), 1 / (2 * e)) : mul(sub(f(x + e), f(x - e)), 1 / (2 * e));
  const node = new Map(), at = (u, v) => { const k = u + ',' + v; let x = node.get(k); if (!x) node.set(k, x = [F(u, v), d1(w => F(w, v), u), d1(w => F(u, w), v)]); return x; };
  const build = (nu, nv) => {
    const du = 1 / nu, dv = 1 / nv, N = []; for (let i = 0; i <= nu; i++) { N.push([]); for (let j = 0; j <= nv; j++) N[i].push(at(i / nu, j / nv)); }
    const net = []; for (let i = 0; i <= 3 * nu; i++) net.push(new Array(3 * nv + 1));
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const a0 = Math.max(0, j - 1), z0 = Math.min(nv, j + 1), tw = mul(sub(N[i][z0][1], N[i][a0][1]), 1 / ((z0 - a0) * dv));
      for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) {
        const I = 3 * i + a, J = 3 * j + b2; if (I < 0 || I > 3 * nu || J < 0 || J > 3 * nv) continue;
        net[I][J] = add(add(add(N[i][j][0], mul(N[i][j][1], a * du / 3)), mul(N[i][j][2], b2 * dv / 3)), mul(tw, a * b2 * du * dv / 9));
      }
    }
    let worst = 0;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) for (const [a, b2] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.7], [0.3, 0.75], [0.7, 0.25]]) {
      const row = [0, 1, 2, 3].map(k => bez([net[3 * i][3 * j + k], net[3 * i + 1][3 * j + k], net[3 * i + 2][3 * j + k], net[3 * i + 3][3 * j + k]], a));
      worst = Math.max(worst, len(sub(bez(row, b2), F((i + a) * du, (j + b2) * dv))));
    }
    return { net, nu, nv, worst };
  };
  for (let r = build(nu, nv); ;) {        // refine the direction that helps more
    if (r.worst <= tol || 2 * (r.nu + 1) * (r.nv + 1) > maxNodes || Math.max(r.nu, r.nv) >= 64) return r;
    const a = build(2 * r.nu, r.nv), b2 = build(r.nu, 2 * r.nv); let nx = a.worst <= b2.worst ? a : b2;
    if (nx.worst > 0.5 * r.worst) { const both = build(2 * r.nu, 2 * r.nv); if (both.worst > 0.5 * r.worst && r.nu * r.nv >= 16) return r; nx = both; }      // no longer getting better: the rest is not a matter of more patches
    r = nx;
  }
}

/* cut triangles along the zero of a field given at the vertices; new points are shared between neighbours */
function slicer(V, T) {
  const cuts = new Map();
  return (tris, val, id, ok, carry = []) => {
    const out = [], cut = (x, y) => {
      const k = (x < y ? x + ',' + y : y + ',' + x) + ',' + id; let v = cuts.get(k);
      if (v === undefined) { const fx = val.get(x), w = fx / (fx - val.get(y)); v = V.length; V.push(add(V[x], mul(sub(V[y], V[x]), w))); cuts.set(k, v); val.set(v, 0); for (const m of carry) m.set(v, m.get(x) + (m.get(y) - m.get(x)) * w); }
      return v;
    };
    // a cut that would fall on a point of the grid (or next to one) goes through that point instead
    for (const ti of tris) { const tv = T[ti].v; for (let e = 0; e < 3; e++) { const x = tv[e], y = tv[(e + 1) % 3], fx = val.get(x), fy = val.get(y); if (fx * fy < 0 && (!ok || ok(x, y))) { const w = fx / (fx - fy); if (w < 1e-3) val.set(x, 0); else if (w > 1 - 1e-3) val.set(y, 0); } } }
    for (const ti of tris) {
      const t = T[ti], f = t.v.map(v => { const x = val.get(v); if (x !== 0 && Math.abs(x) < 1e-7) { val.set(v, 0); return 0; } return x; }), c = [0, 1, 2].map(e => f[e] * f[(e + 1) % 3] < 0 && (!ok || ok(t.v[e], t.v[(e + 1) % 3]))), n = c[0] + c[1] + c[2];
      const more = (a, b2, c2) => { T.push({ ...t, v: [a, b2, c2] }); out.push(T.length - 1); };
      out.push(ti);
      if (n === 1) { const e = c.indexOf(true), a = t.v[e], b2 = t.v[(e + 1) % 3], c2 = t.v[(e + 2) % 3], m = cut(a, b2); t.v = [a, m, c2]; more(m, b2, c2); }
      else if (n === 2) { const u = c.indexOf(false), a = t.v[(u + 2) % 3], b2 = t.v[u], c2 = t.v[(u + 1) % 3], ab = cut(a, b2), ac = cut(a, c2); t.v = [a, ab, ac]; more(ab, b2, c2); more(ab, c2, ac); }
    }
    return out;
  };
}
const wrapPi = x => { x = (x + Math.PI) % (2 * Math.PI); return (x < 0 ? x + 2 * Math.PI : x) - Math.PI; };
const cvAt = (cv, x) => { if (cv.k === 'line') return add(cv.p, mul(cv.d, x)); if (cv.k === 'bez') return bez(cv.P, x); const u = cv.u || (cv.u = perp(cv.n)); return add(cv.c, add(mul(u, cv.r * Math.cos(x)), mul(cross(cv.n, u), cv.r * Math.sin(x)))); };
const cvPar = (cv, p) => { if (cv.k === 'line') return dot(sub(p, cv.p), cv.d); if (cv.k === 'bez') return nearestT(cv.P, q => len(sub(q, p))).t; const u = cv.u || (cv.u = perp(cv.n)), d = sub(p, cv.c); return Math.atan2(dot(d, cross(cv.n, u)), dot(d, u)); };

function convertSkin(st, doc, entry, name, log, opts) {
  const b = entry.body, keys = new Set(b.edgeKeys || []), path = b.edgePath, t = path && keys.size ? path.start[0] : 0;
  const why = !(t > 0) || keys.size !== (b.kind === 'box' ? 12 : 2) ? 'not every edge is rounded' : path.segs.length !== 1 ? 'the edge profile has several segments'
    : path.segs[0].t === 'L' ? 'the edges are chamfered (a crease under a feature)' : (b.featureScale ?? 1) !== 1 ? 'the heights are scaled (animation)' : '';
  if (why) { log.push(`${name}: features go over an edge, and ${why} — body skipped`); return null; }
  const insts = S.bodyInstances(b, []).all, bare = { ...b, hosts: {} };
  const { g, nrm } = bodyImplicit(b), eps = 1e-6;
  const grad = p => [0, 1, 2].map(k => { const a = p.slice(), z = p.slice(); a[k] += eps; z[k] -= eps; return (g(a) - g(z)) / (2 * eps); });
  // A. the bare body, exactly: its patches, the curves between them, its corners
  const A0 = convertBody(st, doc, { body: bare, pieces: b.kind === 'box' ? S.evalBox(bare, opts.chord, []) : S.evalCyl(bare, opts.chord, []) }, name, log, opts, true);
  if (!A0 || A0.approx) { log.push(`${name}: the bare body has no exact form — body skipped`); return null; }
  const seams = new Map(), allSeams = [], corners = [];
  for (const ch of A0.chains) {
    const k = ch.P + '|' + ch.Q, cv = ch.curve, p0 = A0.V[ch.vs[0]], p1 = A0.V[ch.vs[ch.vs.length - 1]]; if (!seams.has(k)) seams.set(k, []);
    let xa = cvPar(cv, p0), xb = cvPar(cv, p1); if (cv.k === 'circle') { xb = xa + ((xb - xa) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (xb - xa < 1e-9) xb = xa + 2 * Math.PI; } else if (xa > xb) [xa, xb] = [xb, xa];
    const sm = { cv, xa, xb }; seams.get(k).push(sm); allSeams.push(sm);
    for (const c of [p0, p1]) if (!corners.some(o => len(sub(o, c)) < 1e-7)) corners.push(c);
  }
  // the features: centre on the present surface, frame, and the two maps everything else is made of
  const sk0 = S.makeSkin(b, 0.05, [], insts, { step: Math.max(...b.size) / 6 }).update(t, 1);
  const fts = insts.map((f, i) => {
    let A = [sk0.anchors[3 * i], sk0.anchors[3 * i + 1], sk0.anchors[3 * i + 2]];
    for (let k = 0; k < 4; k++) { const gr = grad(A); A = sub(A, mul(gr, g(A) / dot(gr, gr))); }
    // a centre next to a border or a corner of the body (many are, by the way they are placed) is put exactly on it
    { let bd = 1e-4, bp = null; for (const sm of allSeams) { let x = cvPar(sm.cv, A); if (sm.cv.k === 'circle') x = sm.xa + ((x - sm.xa) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (x < sm.xa - 1e-9 || x > sm.xb + 1e-9) continue; const p = cvAt(sm.cv, x), d = len(sub(p, A)); if (d < bd) { bd = d; bp = p; } }
      for (const cn of corners) if (len(sub(cn, A)) < 1e-4) bp = cn;
      if (bp) A = bp; }
    const AN = nrm(A), u0 = perp(AN), w0 = cross(AN, u0), ft = { f, A, AN, R: f.R, path: f.path, e1: u0, e2: w0 };
    ft.turn = a => { ft.e1 = add(mul(u0, Math.cos(a)), mul(w0, Math.sin(a))); ft.e2 = cross(AN, ft.e1); }; ft.turn(0.37);
    const q = (rho, phi) => {        // the point of the surface at the distance rho from the centre, in the direction phi
      if (rho < 1e-10) return A;
      const e = add(mul(ft.e1, Math.cos(phi)), mul(ft.e2, Math.sin(phi))), P = ps => add(A, add(mul(e, rho * Math.cos(ps)), mul(AN, rho * Math.sin(ps))));
      let hi = 0.3, ghi = g(P(hi)), lo = hi, glo = ghi;
      while (glo > 0 && lo > -1.7) { hi = lo; ghi = glo; lo -= 0.2; glo = g(P(lo)); }
      if (!(glo <= 0 && ghi >= 0)) throw new Error(`feature ${f.id}: the surface under it was not found`);
      for (let k = 0, side = 0; k < 120 && hi - lo > 1e-13; k++) {
        let x = hi - ghi * (hi - lo) / (ghi - glo); if (!(x > lo && x < hi) || k % 4 === 3) x = (lo + hi) / 2;
        const gx = g(P(x));
        if (gx === 0) return P(x);
        if (gx > 0) { hi = x; ghi = gx; if (side === 1) glo /= 2; side = 1; } else { lo = x; glo = gx; if (side === -1) ghi /= 2; side = -1; }
      }
      return P((lo + hi) / 2);
    };
    const lift = (p, h) => { if (!h) return p; const n = nrm(p), x = Math.min(1, Math.max(0, (dot(n, AN) + 0.5) / 0.5)); return add(p, mul(n, h * x * x * (3 - 2 * x))); };
    return Object.assign(ft, { q, lift, az: p => { const d = sub(p, A); return Math.atan2(dot(d, ft.e2), dot(d, ft.e1)); } });
  });
  const step = Math.min(1, Math.max(0.15, Math.min(...insts.map(f => f.R)) / 8));
  for (let i = 0; i < fts.length; i++) for (let j = i + 1; j < fts.length; j++) if (len(sub(fts[i].A, fts[j].A)) < fts[i].R + fts[j].R + 2 * step) {
    log.push(`${name}: features ${fts[i].f.id} and ${fts[j].f.id} overlap or nearly touch — blended features have no exact form yet, body skipped`); return null;
  }
  const parOn = (sm, p) => { let x = cvPar(sm.cv, p); if (sm.cv.k === 'circle') { x = sm.xa + ((x - sm.xa) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (x > sm.xb) x = x - sm.xb < sm.xa + 2 * Math.PI - x ? sm.xb : sm.xa; } return Math.min(sm.xb, Math.max(sm.xa, x)); };
  const isFp = k => k.startsWith('fp|'), strip = k => k.replace(/\^\d+$/, ''), baseOf = k => isFp(k) ? k.split('|')[3] : strip(k);
  const cell = k => { const p = strip(k).split('|'); return { fi: +p[1], s: +p[2], b: p[3], i: +p[4] }; };
  const seamNear = (P, Q, x) => { let best = null, bd = Infinity; for (const sm of seams.get(P < Q ? P + '|' + Q : Q + '|' + P) || []) { const d = len(sub(cvAt(sm.cv, parOn(sm, x)), x)); if (d < bd) { bd = d; best = sm; } } if (!best) throw new Error(`no border between ${P} and ${Q}`); return best; };
  // B. a fine grid over the bare body, with the same patch names
  const V = [], T = [], vmap = new Map(), X = new Map();
  for (const pc of S.makeSkin(bare, opts.chord, [], [], { step }).update(t, 1).pieces()) {
    const key = roleKey(pc.role), loc = [];
    for (let i = 0; i < pc.pos.length; i += 3) { const k = Math.round(pc.pos[i] / 1e-5) + ',' + Math.round(pc.pos[i + 1] / 1e-5) + ',' + Math.round(pc.pos[i + 2] / 1e-5); let v = vmap.get(k); if (v === undefined) { v = V.length; vmap.set(k, v); V.push([pc.pos[i], pc.pos[i + 1], pc.pos[i + 2]]); } loc.push(v); }
    for (let i = 0; i < pc.idx.length; i += 3) { const tv = [loc[pc.idx[i]], loc[pc.idx[i + 1]], loc[pc.idx[i + 2]]]; if (tv[0] !== tv[1] && tv[1] !== tv[2] && tv[0] !== tv[2]) T.push({ v: tv, p: key }); }
  }
  const slice = slicer(V, T), field = fn => { const m = new Map(); return { get: v => { let x = m.get(v); if (x === undefined) m.set(v, x = fn(V[v])); return x; }, set: (v, x) => m.set(v, x) }; };
  const cen = ti => mul(add(add(V[T[ti].v[0]], V[T[ti].v[1]]), V[T[ti].v[2]]), 1 / 3), ekey = (x, y) => x < y ? x + ',' + y : y + ',' + x;
  // the halves of the patches that go all the way round, cut where the exact body has them
  const splits = new Map(); for (const P of A0.patches.values()) if (P.split) splits.set(P.split.of, P.split);
  const planes = new Map();
  for (const [of, sp] of splits) for (const th of [sp.th0, sp.th0 + sp.span]) {
    const dir = add(mul(sp.e1, Math.cos(th)), mul(sp.e2, Math.sin(th))), nn = cross(sp.a, dir), side = field(p => dot(radial(sp.o, sp.a, p), dir));
    const own = new Set(); T.forEach(x => { if (x.p === of) for (let e = 0; e < 3; e++) own.add(ekey(x.v[e], x.v[(e + 1) % 3])); });
    const list = []; T.forEach((x, ti) => { if ([0, 1, 2].some(e => own.has(ekey(x.v[e], x.v[(e + 1) % 3])))) list.push(ti); });   // with the neighbours, so that the cut points are shared
    const id = 'h' + dir.map(x => x.toFixed(9)).join(); if (!planes.has(id)) planes.set(id, field(p => dot(sub(p, sp.o), nn)));      // one field per plane: a point cut by it stays exactly on it
    slice(list, planes.get(id), id, (x, y) => side.get(x) > 0 && side.get(y) > 0 && own.has(ekey(x, y)));
  }
  for (const [of, sp] of splits) T.forEach((x, ti) => { if (x.p !== of) return; const r = radial(sp.o, sp.a, cen(ti)), w = Math.atan2(dot(r, sp.e2), dot(r, sp.e1)) - sp.th0; x.p = of + ((w % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) < sp.span ? '~a' : '~b'); });
  /* Each feature's footprint is cut into cells: rings (between the corners of its profile, and between the
     radii where the body's own borders begin, end, touch or cross the feature's meridian), two halves (the
     meridian plane), and the pieces of the body under it. Inside one cell everything is smooth. */
  const forced = [];
  for (let fi = 0; fi < fts.length; fi++) {
    const ft = fts[fi], rt = field(p => len(sub(p, ft.A))), mf = field(p => dot(sub(p, ft.A), ft.e2));
    const segs = ft.segs = pathSegs(ft.path, x => x).filter(sg => !(sg.t === 'L' && Math.abs(sg.a[0] - sg.b[0]) < 1e-9));
    const crit = [{ p: ft.A, rho: 0, m: true }]; ft.ext = new Map(); let onBorder = false;
    const near = [], N = 64;
    for (const sm of allSeams) {
      const xs = [], fs = [], at = x => cvAt(sm.cv, x), fd = x => len(sub(at(x), ft.A));
      for (let i = 0; i <= N; i++) { const x = sm.xa + (sm.xb - sm.xa) * i / N; xs.push(x); fs.push(fd(x)); }
      if (Math.min(...fs) > ft.R + (sm.xb - sm.xa) / N * 4 + 1) continue;
      const ext = []; near.push(sm);
      for (let i = 1; i < N; i++) if ((fs[i] - fs[i - 1]) * (fs[i + 1] - fs[i]) < 0) {        // nearest or farthest point of this border
        const sg = fs[i] < fs[i - 1] ? 1 : -1; let lo = xs[i - 1], hi = xs[i + 1];
        for (let k = 0; k < 90; k++) { const a = lo + (hi - lo) / 3, z = hi - (hi - lo) / 3; if (sg * fd(a) < sg * fd(z)) hi = z; else lo = a; }
        const x = (lo + hi) / 2, rho = fd(x); ext.push(x); if (rho <= 1e-4) onBorder = true; if (rho > 1e-4 && rho < ft.R - 1e-4) crit.push({ p: at(x), rho });
      }
      ft.ext.set(sm, ext);
    }
    for (const c of corners) { const rho = len(sub(c, ft.A)); if (rho > 1e-4 && rho < ft.R - 1e-4) crit.push({ p: c, rho }); }
    // the meridian plane is turned as far as can be from these points, so that it crosses the borders cleanly
    { const az = crit.filter(c => c.rho > 0).map(c => ft.az(c.p)); let best = 0.37, bd = -1;
      for (let k = 0; k < 180; k++) { const a = Math.PI * (k + 0.5) / 180, d = az.length ? Math.min(...az.map(x => { const w = Math.abs(wrapPi(x - a)) % Math.PI; return Math.min(w, Math.PI - w); })) : 1; if (d > bd) { bd = d; best = a; } }
      ft.turn(0.37 + best); }
    for (const sm of near) {
      const xs = [], ms = [], at = x => cvAt(sm.cv, x), fm = x => dot(sub(at(x), ft.A), ft.e2);
      for (let i = 0; i <= N; i++) { const x = sm.xa + (sm.xb - sm.xa) * i / N; xs.push(x); ms.push(fm(x)); }
      for (let i = 0; i < N; i++) if (ms[i] * ms[i + 1] < 0) {        // where it crosses the meridian plane
        let lo = xs[i], hi = xs[i + 1]; const up = ms[i + 1] > 0; for (let k = 0; k < 70; k++) { const m = (lo + hi) / 2; if ((fm(m) > 0) === up) hi = m; else lo = m; }
        const p = at((lo + hi) / 2), rho = len(sub(p, ft.A)); if (rho > 1e-4 && rho < ft.R - 1e-4) crit.push({ p, rho, m: true });
      }
    }
    const rho = ft.rho = [0]; for (const x of [...segs.map(sg => sg.b[0]), ...crit.map(c => c.rho)].sort((x, y) => x - y)) if (x - rho[rho.length - 1] > 2e-4) rho.push(x);       // radii closer than this are one ring border
    const M = ft.M = rho.length - 1; rho[M] = ft.R;
    const tOf = (sg, r) => { if (r <= sg.a[0] + 1e-12) return 0; if (r >= sg.b[0] - 1e-12) return 1; let lo = 0, hi = 1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (segAt(sg, m)[0] < r) lo = m; else hi = m; } return (lo + hi) / 2; };
    ft.ring = []; for (let i = 0; i < M; i++) { const mid = (rho[i] + rho[i + 1]) / 2, sg = segs.find(x => x.a[0] <= mid && mid <= x.b[0]); ft.ring.push({ g: sg, t0: tOf(sg, rho[i]), t1: tOf(sg, rho[i + 1]) }); }
    ft.hS = i => segAt(ft.ring[i].g, ft.ring[i].t0)[1]; ft.hE = i => segAt(ft.ring[i].g, ft.ring[i].t1)[1];
    ft.hAt = (i, r) => { const R = ft.ring[i]; return segAt(R.g, Math.min(R.t1, Math.max(R.t0, tOf(R.g, r))))[1]; }; ft.tOf = tOf;
    // the special points become points of the grid
    let list = []; T.forEach((x, ti) => { if (x.v.some(v => rt.get(v) < ft.R + 2 * step)) list.push(ti); });
    const insert = (p, onEdge) => {        // p becomes a point of the grid: an existing one, a new one on the nearest edge, or a new one inside a triangle
      let best = -1, bd = Infinity, be = null, ed = Infinity; const lab = new Map();
      if (onEdge) for (const ti of list) for (let e = 0; e < 3; e++) { const k = ekey(T[ti].v[e], T[ti].v[(e + 1) % 3]); if (!lab.has(k)) lab.set(k, new Set()); lab.get(k).add(T[ti].p); }      // a point of a border goes on an edge of that border
      for (const ti of list) {
        const tv = T[ti].v, [a, b2, c2] = tv.map(v => V[v]), n = cross(sub(b2, a), sub(c2, a)), nn = dot(n, n); if (nn < 1e-24) continue;
        const w = [dot(cross(sub(b2, p), sub(c2, p)), n) / nn, dot(cross(sub(c2, p), sub(a, p)), n) / nn, dot(cross(sub(a, p), sub(b2, p)), n) / nn];
        const neg = Math.max(0, -Math.min(w[0], w[1], w[2])), off = Math.abs(dot(sub(p, a), n)) / Math.sqrt(nn), out = off > 4 * step ? Infinity : neg > 1e-9 ? 1e3 * (1 + neg) : off;      // the triangle p stands over, and the nearest such
        if (out < bd) { bd = out; best = ti; }
        for (let e = 0; e < 3; e++) { if (onEdge && lab.get(ekey(tv[e], tv[(e + 1) % 3])).size < 2) continue; const x = V[tv[e]], y = V[tv[(e + 1) % 3]], d = sub(y, x), u = Math.min(1, Math.max(0, dot(sub(p, x), d) / dot(d, d))), dd = len(sub(p, add(x, mul(d, u)))); if (dd < ed) { ed = dd; be = [tv[e], tv[(e + 1) % 3]]; } }
      }
      const tv = T[best].v, near = [...tv, ...(be || [])].filter(k => len(sub(V[k], p)) < 0.05 * step).sort((x, y) => len(sub(V[x], p)) - len(sub(V[y], p))); if (near.length) return near[0];
      const v = V.length; V.push(p);
      if (be && ed < (onEdge ? 0.25 * step : 1e-6)) {        // both triangles of that edge are split
        const [x, y] = be;
        for (const ti of [...list]) { const u = T[ti].v, k = [0, 1, 2].find(e => (u[e] === x && u[(e + 1) % 3] === y) || (u[e] === y && u[(e + 1) % 3] === x)); if (k === undefined) continue;
          const a = u[k], b2 = u[(k + 1) % 3], c2 = u[(k + 2) % 3]; T[ti].v = [a, v, c2]; T.push({ ...T[ti], v: [v, b2, c2] }); list.push(T.length - 1); }
      } else { const [a, b2, c2] = tv; T[best].v = [a, b2, v]; T.push({ ...T[best], v: [b2, c2, v] }, { ...T[best], v: [c2, a, v] }); list.push(T.length - 2, T.length - 1); }
      return v;
    };
    for (const c of crit) { const v = insert(c.p, c.rho > 0 || onBorder); X.set(v, c.p); rt.set(v, rho.reduce((a, x) => Math.abs(x - c.rho) < Math.abs(a - c.rho) ? x : a, 0)); if (c.m) mf.set(v, 0); if (!c.rho) { forced.push(v); ft.vA = v; } }
    for (let k = 1; k <= M; k++) list = slice(list, { get: v => { const d = rt.get(v) - rho[k]; return Math.abs(d) < 1e-9 ? 0 : d; }, set: v => rt.set(v, rho[k]) }, 'r' + fi + '_' + k, null, [mf]);
    list = slice(list, mf, 'm' + fi, (x, y) => rt.get(x) <= ft.R + 1e-9 && rt.get(y) <= ft.R + 1e-9, [rt]);
    const mean = (ti, fl) => T[ti].v.reduce((a, v) => a + fl.get(v), 0) / 3;
    const inside = list.filter(ti => mean(ti, rt) < ft.R - 1e-9), byEdge = new Map();
    for (const ti of inside) for (let e = 0; e < 3; e++) { const k = ekey(T[ti].v[e], T[ti].v[(e + 1) % 3]); if (!byEdge.has(k)) byEdge.set(k, []); byEdge.get(k).push(ti); }
    let seed = inside[0], sd = Infinity; for (const ti of inside) { const d = len(sub(cen(ti), ft.A)); if (d < sd) { sd = d; seed = ti; } }
    const comp = new Set([seed]), todo = [seed];
    while (todo.length) { const ti = todo.pop(); for (let e = 0; e < 3; e++) for (const tj of byEdge.get(ekey(T[ti].v[e], T[ti].v[(e + 1) % 3]))) if (!comp.has(tj)) { comp.add(tj); todo.push(tj); } }
    for (const ti of inside) {
      if (comp.has(ti)) { const r = mean(ti, rt); let i = 0; while (i < M - 1 && r > rho[i + 1]) i++; T[ti].p = `fp|${fi}|${mean(ti, mf) >= 0 ? 0 : 1}|${T[ti].p}|${i}`; continue; }
      if (dot(nrm(cen(ti)), ft.AN) > -0.5 + 1e-3) { log.push(`${name}: feature ${ft.f.id} reaches another side of the body — body skipped`); return null; }
    }
  }
  // a patch or a cell in two parts is two faces
  const byKey = new Map();
  { const byP = new Map(); T.forEach((x, ti) => { if (!byP.has(x.p)) byP.set(x.p, []); byP.get(x.p).push(ti); });
    for (const [key, tis] of byP) {
      const byEdge = new Map(), seen = new Set(); let nc = 0;
      for (const ti of tis) for (let e = 0; e < 3; e++) { const k = ekey(T[ti].v[e], T[ti].v[(e + 1) % 3]); if (!byEdge.has(k)) byEdge.set(k, []); byEdge.get(k).push(ti); }
      for (const t0 of tis) { if (seen.has(t0)) continue; nc++; const todo = [t0], nk = nc > 1 ? key + '^' + nc : key, mine = []; seen.add(t0); byKey.set(nk, mine);
        while (todo.length) { const ti = todo.pop(); T[ti].p = nk; mine.push(ti); for (let e = 0; e < 3; e++) for (const tj of byEdge.get(ekey(T[ti].v[e], T[ti].v[(e + 1) % 3]))) if (!seen.has(tj)) { seen.add(tj); todo.push(tj); } } }
    } }
  const tp = topology(V, T, forced); if (!tp) { log.push(`${name}: the grid did not close — body skipped`); return null; }
  // exact places of the corners
  const onSeam = (sm, ft, x0, fn) => {        // the point of a border where fn = 0, on the stretch (between its nearest and farthest points) that x0 lies on
    const br = [sm.xa, ...(ft.ext.get(sm) || []).slice().sort((a, b2) => a - b2), sm.xb], iv = [];
    for (let j = 0; j + 1 < br.length; j++) iv.push([br[j], br[j + 1], x0 < br[j] ? br[j] - x0 : x0 > br[j + 1] ? x0 - br[j + 1] : 0]);
    for (const [a, z] of iv.sort((p, q2) => p[2] - q2[2])) {
      let lo = a, hi = z; const fa = fn(lo), fz = fn(hi); if (Math.abs(fa) < 1e-11) return lo; if (Math.abs(fz) < 1e-11) return hi; if (fa * fz > 0) continue;
      for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if ((fn(m) > 0) === (fz > 0)) hi = m; else lo = m; } return (lo + hi) / 2;
    }
    let bx = x0, bf = Infinity; for (const x of br) { const f = Math.abs(fn(x)); if (f < bf) { bf = f; bx = x; } }
    if (bf < 1e-3) return bx;
    throw new Error(`feature ${ft.f.id}: a crossing with an edge of the body was not found`);
  };
  const exactV = v => {
    let p = X.get(v); if (p) return p;
    const ls = [...(tp.vp.get(v) || [])], fps = ls.filter(isFp).map(cell), bases = [...new Set(ls.map(baseOf))];
    if (!fps.length) {
      if (bases.length >= 3) { let bd = Infinity; for (const c of corners) { const d = len(sub(c, V[v])); if (d < bd) { bd = d; p = c; } } }
      else { const sm = seamNear(bases[0], bases[1], V[v]); p = cvAt(sm.cv, parOn(sm, V[v])); }
    } else {
      const ft = fts[fps[0].fi], is = [...new Set(fps.map(c => c.i))], two = new Set(fps.map(c => c.s)).size > 1;
      const rk = fps.length < ls.length ? ft.R : is.length > 1 ? ft.rho[Math.max(...is)] : undefined, phi = dot(sub(V[v], ft.A), ft.e1) > 0 ? 0 : Math.PI;
      if (bases.length >= 2 && (rk !== undefined || two)) { const sm = seamNear(bases[0], bases[1], V[v]); p = cvAt(sm.cv, onSeam(sm, ft, parOn(sm, V[v]), rk !== undefined ? x => len(sub(cvAt(sm.cv, x), ft.A)) - rk : x => dot(sub(cvAt(sm.cv, x), ft.A), ft.e2))); }
      else if (rk !== undefined) p = ft.q(rk, two ? phi : ft.az(V[v]));
      else throw new Error(`feature ${ft.f.id}: a corner of its cells could not be placed`);
    }
    X.set(v, p); return p;
  };
  const vert = new Map(), Vx = v => { let id = vert.get(v); if (!id) vert.set(v, id = st.add(`VERTEX_POINT('',${st.pt(exactV(v))})`)); return id; };
  const stat = { curve: 0, surf: 0, nets: 0 }, hk = h => Math.round(h * 1e9) + 0;
  const graded = (f, probes) => {        // where f runs infinitely fast at an end, run it with x = w² there
    const sp = (a, z) => Math.max(...probes.map(pr => len(sub(pr(f, z), pr(f, a))))) / Math.abs(z - a), g0 = sp(0, 1e-6) > 3 * sp(1e-2, 2e-2) + 1e-9, g1 = sp(1 - 1e-6, 1) > 3 * sp(1 - 2e-2, 1 - 1e-2) + 1e-9;
    return !g0 && !g1 ? null : g0 && g1 ? w => (1 - Math.cos(Math.PI * w)) / 2 : g0 ? w => w * w : w => 1 - (1 - w) * (1 - w);
  };
  const fitted = f0 => { const gr = graded(f0, [(f, x) => f(x)]), f = gr ? x => f0(gr(x)) : f0, r = fitArc(f, opts.fit), c = fitCurve(r.pts, 1e-8, []); if (c.k !== 'poly') return c; stat.curve = Math.max(stat.curve, r.worst); return { k: 'bspl', pieces: r.pieces }; };
  const edge = (v0, v1, cv) => st.add(`EDGE_CURVE('',${v0},${v1},${st.curve(cv)},.T.)`);
  const ends = ch => { const a = ch.vs[0], z = ch.vs[ch.vs.length - 1], p0 = exactV(a), p1 = exactV(z); return { a, z, p0, p1, pm: ch.vs.length > 2 ? V[ch.vs[ch.vs.length >> 1]] : mul(add(p0, p1), 0.5) }; };
  const sweep = (ft, e) => { const a0 = ft.az(e.p0), am = ft.az(e.pm); return [a0, wrapPi(am - a0) + wrapPi(ft.az(e.p1) - am)]; };
  // what a border is: between two patches of the bare body, the footprint's rim, or inside a footprint — a ring, a border of the body, the meridian
  for (const ch of tp.chains) {
    const fP = isFp(ch.P), fQ = isFp(ch.Q), a = fP ? cell(ch.P) : null, c = fQ ? cell(ch.Q) : null; let id = null;
    ch.kind = !fP && !fQ ? 'base' : !fP || !fQ ? 'rim' : a.i !== c.i ? 'ring' : a.b !== c.b ? 'seam' : 'mer';
    ch.ft = fP ? fts[a.fi] : fQ ? fts[c.fi] : null; ch.k = ch.kind === 'rim' ? ch.ft.M : ch.kind === 'ring' ? Math.max(a.i, c.i) : -1; ch.i = a ? a.i : -1;
    ch.eid = () => {
      if (id) return id; const e = ends(ch); let cv;
      if (ch.kind === 'base') {
        const sm = seamNear(baseOf(ch.P), baseOf(ch.Q), e.pm).cv;
        cv = sm.k === 'line' ? { k: 'line', p: e.p0, d: unit(sub(e.p1, e.p0)) } : sm.k === 'circle' ? { ...sm, n: mul(sm.n, dot(cross(sub(e.p0, sm.c), sub(e.pm, sm.c)), sm.n) >= 0 ? 1 : -1) } : sm.k === 'bez' ? { k: 'bez', P: cvPar(sm, e.p0) <= cvPar(sm, e.p1) ? sm.P : [...sm.P].reverse() } : null;
        if (!cv) throw new Error('a border of the bare body has no exact curve');
      } else { const [a0, dl] = sweep(ch.ft, e); cv = fitted(x => ch.ft.q(ch.ft.R, a0 + dl * x)); }
      return id = edge(Vx(e.a), Vx(e.z), cv);
    };
  }
  const uses = usesOf(tp.chains), faces = [];
  // the body's own faces, with the footprints cut out
  for (const [key, tris] of byKey) if (!isFp(key)) { const f = patchFace(st, { key, desc: A0.patches.get(baseOf(key)).desc, tris }, uses.get(key) || [], V, T); if (f) faces.push(f); }
  // the features, cell by cell
  const memo = new Map(), once = (id, f) => { let x = memo.get(id); if (x === undefined) memo.set(id, x = f()); return x; };
  const VL = (ft, v, h) => Math.abs(h) < 1e-12 ? Vx(v) : once(`V${v}|${hk(h)}`, () => st.add(`VERTEX_POINT('',${st.pt(ft.lift(exactV(v), h))})`));
  const hIn = (ft, k) => ft.hE(k - 1), hOut = (ft, k) => k < ft.M ? ft.hS(k) : 0;
  const lev = (ft, i, v) => { const r = len(sub(exactV(v), ft.A)); return Math.abs(r - ft.rho[i]) < Math.abs(r - ft.rho[i + 1]) ? ft.hS(i) : ft.hE(i); };
  const ci = new Map(tp.chains.map((ch, n) => [ch, n]));
  const ringEdge = (ch, h) => ch.k === ch.ft.M && Math.abs(h) < 1e-12 ? ch.eid() : once(`R${ci.get(ch)}|${hk(h)}`, () => { const ft = ch.ft, e = ends(ch), [a0, dl] = sweep(ft, e); return edge(VL(ft, e.a, h), VL(ft, e.z, h), fitted(x => ft.lift(ft.q(ft.rho[ch.k], a0 + dl * x), h))); });
  const innerEdge = ch => once(`I${ci.get(ch)}`, () => {
    const ft = ch.ft, e = ends(ch), i = ch.i, R = ft.ring[i];
    if (ch.kind === 'seam') { const sm = seamNear(cell(ch.P).b, cell(ch.Q).b, e.pm), x0 = parOn(sm, e.p0), x1 = parOn(sm, e.p1); return edge(VL(ft, e.a, lev(ft, i, e.a)), VL(ft, e.z, lev(ft, i, e.z)), fitted(x => { const p = cvAt(sm.cv, x0 + (x1 - x0) * x); return ft.lift(p, ft.hAt(i, len(sub(p, ft.A)))); })); }
    const far = len(sub(e.p0, ft.A)) > len(sub(e.p1, ft.A)) ? e.p0 : e.p1, phi = dot(sub(far, ft.A), ft.e1) > 0 ? 0 : Math.PI, ta = ft.tOf(R.g, len(sub(e.p0, ft.A))), tz = ft.tOf(R.g, len(sub(e.p1, ft.A)));
    return edge(VL(ft, e.a, lev(ft, i, e.a)), VL(ft, e.z, lev(ft, i, e.z)), fitted(x => { const p2 = segAt(R.g, ta + (tz - ta) * x); return ft.lift(ft.q(p2[0], phi), p2[1]); }));
  });
  const onPlane = (ft, pts) => pts.every(p => Math.abs(dot(sub(p, ft.A), ft.AN)) < 1e-8);
  for (const [key, tris] of byKey) {
    if (!isFp(key)) continue;
    const c = cell(key), ft = fts[c.fi], i = c.i, R = ft.ring[i], us = uses.get(key) || [], from = new Map(us.map(u => [u.a, u])), loop = [];
    for (let u = us[0]; u && !loop.includes(u); u = from.get(u.z)) loop.push(u);
    if (loop.length !== us.length || !us.length) throw new Error(`feature ${ft.f.id}: a cell is not one simple piece`);
    const L = loop.map(u => ({ eid: u.ch.kind === 'ring' || u.ch.kind === 'rim' ? ringEdge(u.ch, i === u.ch.k - 1 ? hIn(ft, u.ch.k) : hOut(ft, u.ch.k)) : innerEdge(u.ch), fwd: u.fwd }));
    let cm = [0, 0, 0]; for (const ti of tris) cm = add(cm, cen(ti)); const am = ft.az(mul(cm, 1 / tris.length)), er = add(mul(ft.e1, Math.cos(am)), mul(ft.e2, Math.sin(am)));
    const pts = loop.flatMap(u => [exactV(u.a), V[u.ch.vs[u.ch.vs.length >> 1]]]);
    if (onPlane(ft, pts.filter((_, n) => n % 2 === 0)) && pts.every(p => dot(nrm(p), ft.AN) > 1 - 1e-9)) {        // on the flat part round the centre: the exact surface of this profile segment
      const sf = revSurf(ft.A, ft.AN, R.g, mul(er, -1)), md = segMid(R.g);
      faces.push(st.face(key, [st.loop(L.map(e => st.oe(e.eid, e.fwd)))], sf, dot(sf.nat(add(add(ft.A, mul(er, md.p[0])), mul(ft.AN, md.p[1]))), add(mul(er, -md.d[1]), mul(ft.AN, md.d[0]))) > 0));
      continue;
    }
    // elsewhere: a net fitted between the cell's two sides
    const side = u => {
      if (u.ch.kind === 'mer') { const e = ends(u.ch), far = len(sub(e.p0, ft.A)) > len(sub(e.p1, ft.A)) ? e.p0 : e.p1, phi = am + wrapPi((dot(sub(far, ft.A), ft.e1) > 0 ? 0 : Math.PI) - am); return () => phi; }
      const e = ends(u.ch), sm = seamNear(cell(u.ch.P).b, cell(u.ch.Q).b, e.pm), x0 = parOn(sm, e.p0), x1 = parOn(sm, e.p1), r0 = len(sub(e.p0, ft.A)), r1 = len(sub(e.p1, ft.A)), up = r1 > r0;
      // the border's own run of radii stands for the ring's (they differ by less than the 0.0002 that ring borders are merged within)
      const lo0 = Math.min(r0, r1), hi0 = Math.max(r0, r1), ra = ft.rho[i], rz = ft.rho[i + 1];
      return rr => { const r = lo0 + (rr - ra) * (hi0 - lo0) / (rz - ra); if (r <= lo0) return am + wrapPi(ft.az(up ? e.p0 : e.p1) - am); if (r >= hi0) return am + wrapPi(ft.az(up ? e.p1 : e.p0) - am);
        let lo = x0, hi = x1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if ((len(sub(cvAt(sm.cv, m), ft.A)) < r) === up) lo = m; else hi = m; } return am + wrapPi(ft.az(cvAt(sm.cv, (lo + hi) / 2)) - am); };
    };
    const rOf = v => len(sub(exactV(v), ft.A)), sides = loop.filter(u => u.ch.kind === 'seam' || u.ch.kind === 'mer');
    const sLo = sides.find(u => rOf(u.z) > rOf(u.a) + 1e-9), sHi = sides.find(u => rOf(u.z) < rOf(u.a) - 1e-9);
    if (!sLo || !sHi || sides.length !== 2) throw new Error(`feature ${ft.f.id}: a cell has ${sides.length} sides`);
    const fLo = side(sLo), fHi = side(sHi);
    let F = (u, v) => { const p2 = segAt(R.g, R.t0 + (R.t1 - R.t0) * u), a = fLo(p2[0]), z = fHi(p2[0]); return ft.lift(ft.q(p2[0], a + (z - a) * v), p2[1]); };
    const gr = graded(u => u, [(f, x) => F(f(x), 0), (f, x) => F(f(x), 1)]); if (gr) { const F0 = F; F = (u, v) => F0(gr(u), v); }
    const r = fitGrid(F, opts.fitS, 1, 1, opts.maxNodes); stat.surf = Math.max(stat.surf, r.worst); stat.nets++;
    faces.push(st.face(key, [st.loop(L.map(e => st.oe(e.eid, e.fwd)))], Sf.grid(r.net, r.nu, r.nv), true));
  }
  // walls: where the profile steps at one radius, a strip of straight lines along the normals
  for (const ch of tp.chains) {
    if (ch.kind !== 'ring' && ch.kind !== 'rim') continue;
    const ft = ch.ft, k = ch.k, hi = hIn(ft, k), ho = hOut(ft, k); if (Math.abs(hi - ho) < 1e-9) continue;
    const e = ends(ch), [a0, dl] = sweep(ft, e), vertical = v => once(`W${v}|${k}`, () => { const p0 = ft.lift(exactV(v), hi), p1 = ft.lift(exactV(v), ho); return edge(VL(ft, v, hi), VL(ft, v, ho), { k: 'line', p: p0, d: unit(sub(p1, p0)) }); });
    let L = [{ eid: ringEdge(ch, hi), fwd: true }, { eid: vertical(e.z), fwd: true }, { eid: ringEdge(ch, ho), fwd: false }, { eid: vertical(e.a), fwd: false }];
    if ((hi > ho) !== (dl < 0)) L = [...L].reverse().map(x => ({ eid: x.eid, fwd: !x.fwd }));
    const oes = L.map(x => st.oe(x.eid, x.fwd)), am = a0 + dl / 2;
    if (onPlane(ft, [e.p0, e.p1, ft.q(ft.rho[k], am)])) faces.push(st.face(`wall:${ft.f.id}:${k}`, [st.loop(oes)], Sf.cyl(ft.A, ft.AN, ft.rho[k], mul(add(mul(ft.e1, Math.cos(am)), mul(ft.e2, Math.sin(am))), -1)), hi > ho));
    else { const r = fitArc(x => { const p = ft.q(ft.rho[k], a0 + dl * x); return [...ft.lift(p, hi), ...ft.lift(p, ho)]; }, opts.fit);
      faces.push(st.face(`wall:${ft.f.id}:${k}`, [st.loop(oes)], Sf.ruled(r.pieces.map(B => B.map(p => p.slice(0, 3))), r.pieces.map(B => B.map(p => p.slice(3)))), dl < 0)); }
  }
  if (stat.nets) log.push(`${name}: ${stat.nets} piece(s) of features over the edges are NURBS nets fitted within ${stat.surf.toExponential(1)} mm of the exact shape` + (stat.surf > opts.fitS ? ` (asked for ${opts.fitS})` : ''));
  st.unc = Math.max(st.unc || 0, stat.surf, stat.curve);
  return st.add(`MANIFOLD_SOLID_BREP('${name}',${st.add(`CLOSED_SHELL('',(${faces.join(',')}))`)})`);
}

/* ═══════════════════ a whole file ═══════════════════ */
export function snarkToStep(text, name = 'snark', opts = {}) {
  opts = { chord: 0.01, maxFacets: 40000, fit: 1e-5, fitS: 1e-4, maxNodes: 1500, ...opts };
  const doc = S.parseSnark(text), ev = S.evaluate(doc, opts.chord), st = new Step(), log = [], solids = [];
  ev.bodies.forEach((e, i) => {
    const nm = 'body' + (i + 1) + '_' + e.body.kind;
    try { const id = convertBody(st, doc, e, nm, log, opts); if (id) solids.push(id); } catch (err) { log.push(`${nm}: failed — ${err.message}`); }
  });
  return { step: st.text(name, solids), log, solids: solids.length, bodies: ev.bodies.length };
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('snark_step.mjs')) {
  const fs = await import('node:fs'), [, , inp, outp, chord] = process.argv;
  if (!inp) { console.log('node snark_step.mjs in.snark [out.step] [chord]'); process.exit(1); }
  const out = outp || inp.replace(/\.[^.]*$/, '') + '.step';
  const r = snarkToStep(fs.readFileSync(inp, 'utf8'), out.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, ''), chord ? { chord: +chord } : {});
  fs.writeFileSync(out, r.step);
  console.log(`${out}: ${r.solids} of ${r.bodies} bodies, ${(r.step.length / 1024).toFixed(0)} KB`);
  for (const m of r.log) console.log('  note: ' + m);
}
