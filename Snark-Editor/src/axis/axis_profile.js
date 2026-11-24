/* axis_profile.js — the axis families of a scan and the profile of each, as one bore.
 *
 * SnarkScan_09 measures every cylinder in a narrow band round its own axis (0.7 r … 1.3 r). Two cylinders on one
 * axis (a counterbore over a hole, a hole seen from both sides) therefore stay two objects, and what lies between
 * them is not looked at. This module, pure and without three.js, does the next step:
 *
 *   1. family  : cylinders whose axes are parallel and pass close to each other are one axis family;
 *   2. profile : about that axis every point of the scan within Rmax is taken and kept only as (t, ρ):
 *                t along the axis, ρ from it. The turn θ is dropped — the 3D bore settles into a 2D profile
 *                (the "portal" of the symmetry). Every θ adds what it saw of the depth, so views that each reach
 *                only part of a deep hole fill each other in;
 *   3. reading : per slice of t — the wall radius, how much of the turn bears it (coverage), and whether a flat
 *                face crosses the axis there (a mouth when ρ runs outward from the wall, a floor when it runs in
 *                to the axis). A slice with too little of the turn is U, never "no wall";
 *   4. verdict : two mouths on opposite faces with the wall carried between them is one through hole; a floor or
 *                web inside contradicts it; a gap that nothing saw leaves it hypothesized, and says so.
 *
 * Status words follow the journal of SnarkScan_09: cards 'observed' / 'inferred' / 'hypothesized'; claims
 * 'supported' / 'contradicted' / 'untested'. Unknown stays unknown.
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, s = 1) => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const median = v => { if (!v.length) return NaN; const q = Float64Array.from(v).sort(); return q[q.length >> 1]; };

/* a cylinder of SnarkScan_09 ({k, i0, j0, c, zm, slope, r, z0, z1}) as a line in space */
export function fromScanCylinder(c) {
  const a = [0, 0, 0], d = [0, 0, 0];
  a[c.k] = c.zm; a[c.i0] = c.c[0]; a[c.j0] = c.c[1];
  d[c.k] = 1; d[c.i0] = c.slope ? c.slope[0] : 0; d[c.j0] = c.slope ? c.slope[1] : 0;
  const u = norm(d), t0 = dot(sub(fromK(c, c.z0), a), u), t1 = dot(sub(fromK(c, c.z1), a), u);
  const lean = Math.acos(Math.min(1, Math.abs(u[c.k]))) * 180 / Math.PI;
  return { a, d: u, r: c.r, t0: Math.min(t0, t1), t1: Math.max(t0, t1), lean, src: c };
}
function fromK(c, z) { const p = [0, 0, 0]; p[c.k] = z; p[c.i0] = c.c[0] + (c.slope ? c.slope[0] : 0) * (z - c.zm); p[c.j0] = c.c[1] + (c.slope ? c.slope[1] : 0) * (z - c.zm); return p; }

/* distance between two axes, measured square to their common direction, each at its own middle (no extrapolation:
   on a real scan a short cylinder's lean is the least certain number, and carried 40 mm it moves the axis by mm) */
function midGap(A, B, d) {
  const mA = add(A.a, A.d, (A.t0 + A.t1) / 2), mB = add(B.a, B.d, (B.t0 + B.t1) / 2), w = sub(mB, mA), along = dot(w, d);
  return Math.hypot(...sub(w, d.map(x => x * along)));
}

/* 1. axis families: parallel within angTol and the axes within distTol of each other. A lean larger than maxLean on
   a cylinder is taken as unmeasured (its direction is not used to refuse a family) and said so in the result. */
export function groupCoaxial(cyls, { angTolDeg = 3, maxLeanDeg = 5, distTol = r => Math.max(0.8, 0.06 * r) } = {}) {
  const n = cyls.length, parent = cyls.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const cosTol = Math.cos(angTolDeg * Math.PI / 180), sure = c => !(c.lean > maxLeanDeg);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = cyls[i], B = cyls[j];
    if (sure(A) && sure(B) && Math.abs(dot(A.d, B.d)) < cosTol) continue;
    const d = sure(A) ? A.d : B.d;
    if (midGap(A, B, d) > distTol(Math.max(A.r, B.r))) continue;
    parent[find(i)] = find(j);
  }
  const groups = new Map();
  cyls.forEach((c, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); });
  return [...groups.values()].map(members => {
    const firm = members.filter(sure).length ? members.filter(sure) : members, ref = firm[0].d;
    const d = norm(firm.reduce((s, c) => add(s, dot(c.d, ref) < 0 ? c.d.map(x => -x) : c.d), [0, 0, 0]));
    const base = members[0].a, a = members.reduce((s, c) => { const w = sub(c.a, base), q = sub(w, d.map(x => x * dot(w, d))); return add(s, q, 1 / members.length); }, base.slice());
    const ts = members.flatMap(c => [c.t0, c.t1].map(t => dot(sub(add(c.a, c.d, t), a), d)));
    return { a, d, members, t0: Math.min(...ts), t1: Math.max(...ts), rMax: Math.max(...members.map(c => c.r)), rMin: Math.min(...members.map(c => c.r)), leanNotUsed: members.filter(c => !sure(c)).map(c => +c.lean.toFixed(1)) };
  });
}

/* 2. the profile (t, ρ) about one axis */
export function axisProfile(P, n, axis, { Rmax = 1.8 * axis.rMax + 2, margin = Math.max(2, 0.5 * axis.rMax), dt = 0.5, sectors = 36 } = {}) {
  const e1 = norm(Math.abs(axis.d[0]) < 0.9 ? cross(axis.d, [1, 0, 0]) : cross(axis.d, [0, 1, 0])), e2 = cross(axis.d, e1);
  const t0 = axis.t0 - margin, t1 = axis.t1 + margin, nb = Math.max(1, Math.ceil((t1 - t0) / dt));
  const bins = Array.from({ length: nb }, () => []);
  for (let i = 0; i < n; i++) {
    const w = [P[3 * i] - axis.a[0], P[3 * i + 1] - axis.a[1], P[3 * i + 2] - axis.a[2]], t = dot(w, axis.d);
    if (t < t0 || t >= t1) continue;
    const u = dot(w, e1), v = dot(w, e2), rho = Math.hypot(u, v);
    if (rho > Rmax) continue;
    bins[Math.floor((t - t0) / dt)].push([rho, Math.atan2(v, u)]);
  }
  const sectorOf = th => Math.min(sectors - 1, Math.floor((th + Math.PI) / (2 * Math.PI) * sectors));
  return bins.map((pts, b) => {
    const t = t0 + (b + 0.5) * dt;
    if (!pts.length) return { t, n: 0, cover: 0, wall: NaN, face: null };
    /* the wall: the nearest surface to the axis in each sector, then the median over sectors */
    const near = new Array(sectors).fill(Infinity);
    for (const [rho, th] of pts) { const s = sectorOf(th); if (rho < near[s]) near[s] = rho; }
    const seen = near.filter(isFinite), wall = median(seen), cover = seen.length / sectors;
    /* a flat face square to the axis, judged only right beside the wall (other walls of the part further out are
       not faces of this bore): a ring just outside the wall round much of the turn is a mouth or a shelf; points
       close to the axis round much of the turn are a floor or a web */
    const rs = pts.map(p => p[0]), lo = Math.min(...rs), hi = Math.max(...rs), band = Math.max(1.5, 0.3 * wall);
    const ringOut = new Set(pts.filter(p => p[0] > wall + 0.4 && p[0] < wall + band).map(p => sectorOf(p[1]))).size / sectors;
    const ringIn = new Set(pts.filter(p => p[0] < 0.5 * (axis.rMin || axis.rMax)).map(p => sectorOf(p[1]))).size / sectors;   // near the axis itself: a shelf from a wider to a narrower bore is not a floor
    let face = null;
    if (ringIn > 0.4) face = 'floor'; else if (ringOut > 0.4) face = 'mouth';
    return { t, n: pts.length, cover, wall, face, rLo: lo, rHi: hi };
  });
}

/* 3–4. steps along the bore, and the verdict */
export function readBore(prof, axis, { minCover = 0.35, rTol = r => Math.max(0.25, 0.06 * r) } = {}) {
  const steps = [];
  for (const s of prof) {
    if (s.face || !(s.cover >= minCover) || !isFinite(s.wall) || s.wall > 1.5 * axis.rMax) continue;
    const last = steps[steps.length - 1];
    if (last && Math.abs(last.r - s.wall) < rTol(last.r) && s.t - last.t1 < 1.5 * (prof[1] ? prof[1].t - prof[0].t : 1)) { last.t1 = s.t; last.rs.push(s.wall); last.r = median(last.rs); }
    else steps.push({ t0: s.t, t1: s.t, r: s.wall, rs: [s.wall] });
  }
  steps.forEach(st => delete st.rs);
  const mouths = prof.filter(s => s.face === 'mouth'), floors = prof.filter(s => s.face === 'floor');
  const tA = steps.length ? steps[0].t0 : NaN, tB = steps.length ? steps[steps.length - 1].t1 : NaN;
  const mouthLo = mouths.find(s => s.t <= tA + 1), mouthHi = [...mouths].reverse().find(s => s.t >= tB - 1);
  const inside = floors.filter(s => s.t > tA && s.t < tB);
  /* gaps: slices between the ends of the bore that no part of the turn showed */
  const gaps = [];
  for (const s of prof) if (s.t > tA && s.t < tB && !s.face && (!(s.cover >= minCover) || !(s.wall <= 1.5 * axis.rMax))) {   // no wall of this bore seen there (other walls of the part further out do not count)
    const g = gaps[gaps.length - 1]; if (g && s.t - g.t1 < 1.01 * (prof[1].t - prof[0].t)) g.t1 = s.t; else gaps.push({ t0: s.t, t1: s.t });
  }
  const claims = [];
  const claim = (text, status, extra = {}) => claims.push(Object.assign({ text, status }, extra));
  claim('a mouth on a face at the low end', mouthLo ? 'supported' : 'untested', mouthLo ? { at: +mouthLo.t.toFixed(2) } : {});
  claim('a mouth on a face at the high end', mouthHi ? 'supported' : 'untested', mouthHi ? { at: +mouthHi.t.toFixed(2) } : {});
  claim('no floor or web between the mouths', inside.length ? 'contradicted' : gaps.length ? 'untested' : 'supported',
    inside.length ? { floorsAt: inside.map(s => +s.t.toFixed(2)) } : gaps.length ? { unseen: gaps.map(g => [+g.t0.toFixed(2), +g.t1.toFixed(2)]) } : {});
  const stepped = steps.length > 1 && steps.some((s, i) => i && Math.abs(s.r - steps[i - 1].r) >= rTol(Math.min(s.r, steps[i - 1].r)));
  let kind, status;
  if (inside.length) { kind = 'two blind holes on one axis (a floor or web between)'; status = 'inferred'; }
  else if (mouthLo && mouthHi) { kind = stepped ? 'one stepped through hole' : 'one through hole'; status = gaps.length ? 'hypothesized' : 'inferred'; }
  else if ((mouthLo || mouthHi) && floors.length) { kind = 'blind hole'; status = 'inferred'; }
  else { kind = 'unknown'; status = 'hypothesized'; }
  return { kind, status, steps: steps.map(s => ({ t0: +s.t0.toFixed(2), t1: +s.t1.toFixed(2), d: +(2 * s.r).toFixed(3) })), gaps, claims,
    note: gaps.length && kind.includes('through') ? 'the middle was not seen from any side: the walls on both ends line up, nothing contradicts one hole — but nothing proves it either' : '' };
}

export function boresOf(P, n, scanCyls, opts = {}) {
  return groupCoaxial(scanCyls.map(fromScanCylinder), opts).map(axis => { const prof = axisProfile(P, n, axis, opts); return { axis, profile: prof, bore: readBore(prof, axis, opts) }; });
}
