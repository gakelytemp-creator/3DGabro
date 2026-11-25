// node --test Snark-Editor/src/axis/axis_profile.test.mjs
// Synthetic scans: surfaces sampled as points, some depth deliberately unseen (as a scanner misses it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { boresOf, groupCoaxial, fromScanCylinder } from './axis_profile.js';

let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const T = 12, S = 20;               // plate 12 mm thick, ±20 mm

function cloud(parts, { tilt = 0, shift = [0, 0, 0] } = {}) {
  const P = [], c = Math.cos(tilt), s = Math.sin(tilt);
  const put = (x, y, z) => { const y2 = c * y - s * z, z2 = s * y + c * z; P.push(x + shift[0], y2 + shift[1], z2 + shift[2]); };
  for (const p of parts) {
    if (p.wall) { const [r, z0, z1] = p.wall; const n = Math.round(6 * 2 * Math.PI * r * (z1 - z0)); for (let i = 0; i < n; i++) { const th = 2 * Math.PI * rnd(); put(r * Math.cos(th), r * Math.sin(th), z0 + (z1 - z0) * rnd()); } }
    if (p.ring) { const [z, r0, r1] = p.ring; const n = Math.round(6 * Math.PI * (r1 * r1 - r0 * r0)); for (let i = 0; i < n; i++) { const th = 2 * Math.PI * rnd(), r = Math.sqrt(r0 * r0 + (r1 * r1 - r0 * r0) * rnd()); put(r * Math.cos(th), r * Math.sin(th), z); } }
  }
  return Float32Array.from(P);
}
const cyl = (r, z0, z1, c = [0, 0]) => ({ k: 2, i0: 0, j0: 1, c, zm: (z0 + z1) / 2, slope: [0, 0], r, z0, z1 });

test('counterbore over a through hole, middle unseen: one stepped hole, hypothesized', () => {
  const r = 3, R = 5.5, d = 4;
  const P = cloud([{ ring: [T, R, S] }, { wall: [R, T - d, T] }, { ring: [T - d, r, R] }, { wall: [r, T - d - 1.5, T - d] }, { wall: [r, 0, 2.5] }, { ring: [0, r, S] }]);
  const out = boresOf(P, P.length / 3, [cyl(R, T - d, T), cyl(r, T - d - 1.5, T - d), cyl(r, 0, 2.5)]);
  assert.equal(out.length, 1, 'three cylinders on one axis are one family');
  const b = out[0].bore;
  assert.equal(b.kind, 'one stepped through hole');
  assert.equal(b.status, 'hypothesized');
  assert.ok(b.gaps.length >= 1);
  assert.equal(b.claims.find(c => c.text.startsWith('no floor')).status, 'untested');
  const ds = b.steps.map(s => s.d);
  assert.ok(ds.some(x => Math.abs(x - 2 * R) < 0.4) && ds.some(x => Math.abs(x - 2 * r) < 0.4), JSON.stringify(ds));
});

test('the same hole seen all the way through: inferred', () => {
  const r = 3, R = 5.5, d = 4;
  const P = cloud([{ ring: [T, R, S] }, { wall: [R, T - d, T] }, { ring: [T - d, r, R] }, { wall: [r, 0, T - d] }, { ring: [0, r, S] }]);
  const b = boresOf(P, P.length / 3, [cyl(R, T - d, T), cyl(r, 0, T - d)])[0].bore;
  assert.equal(b.kind, 'one stepped through hole');
  assert.equal(b.status, 'inferred');
  assert.equal(b.claims.find(c => c.text.startsWith('no floor')).status, 'supported');
});

test('two blind holes from both sides with a web between: not one hole', () => {
  const r = 3, w0 = 5.5, w1 = 6.5;
  const P = cloud([{ ring: [T, r, S] }, { wall: [r, w1, T] }, { ring: [w1, 0, r] }, { ring: [w0, 0, r] }, { wall: [r, 0, w0] }, { ring: [0, r, S] }]);
  const b = boresOf(P, P.length / 3, [cyl(r, w1, T), cyl(r, 0, w0)])[0].bore;
  assert.equal(b.kind, 'two blind holes on one axis (a floor or web between)');
  assert.equal(b.claims.find(c => c.text.startsWith('no floor')).status, 'contradicted');
});

test('a blind hole: one mouth and a floor', () => {
  const r = 2.5;
  const P = cloud([{ ring: [T, r, S] }, { wall: [r, 4, T] }, { ring: [4, 0, r] }, { ring: [0, 0, S] }]);
  const b = boresOf(P, P.length / 3, [cyl(r, 4, T)])[0].bore;
  assert.equal(b.kind, 'blind hole');
});

test('parallel holes 10 mm apart stay two families; a slight lean is still one', () => {
  const A = fromScanCylinder(cyl(3, 0, 12)), B = fromScanCylinder(cyl(3, 0, 12, [10, 0]));
  assert.equal(groupCoaxial([A, B]).length, 2);
  const lean = { ...cyl(3, 0, 6), slope: [0.01, 0] }, up = { ...cyl(3, 6, 12, [0.09, 0]), slope: [0.01, 0] };
  assert.equal(groupCoaxial([fromScanCylinder(lean), fromScanCylinder(up)]).length, 1);
});
