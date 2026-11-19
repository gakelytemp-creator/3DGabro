// round trip: our STEP → Snark; report closedness, volume, how far the points are from their cards, what the editor recognises
import * as S from '../src/snark_core.js'; import { stepToSnark } from './step_snark.mjs'; import fs from 'node:fs';
const { sub, dot, len, unit, cross, mul, add } = S.vec;
const dev = (c, p) => { if (!c) return 0; if (c.type === 'plane') return Math.abs(dot(sub(p, c.o), unit(c.n))); const ax = c.a ? unit(c.a) : null;
  if (c.type === 'cyl') { const d = sub(p, c.o); return Math.abs(len(sub(d, mul(ax, dot(d, ax)))) - c.d / 2); }
  if (c.type === 'sph') return Math.abs(len(sub(p, c.c)) - c.d / 2);
  if (c.type === 'cone') { const d = sub(p, c.o), h = dot(d, ax), sa = c.angle / 2 * Math.PI / 180; return Math.abs((len(sub(d, mul(ax, h))) - (c.d / 2 + h * Math.tan(sa))) * Math.cos(sa)); }
  if (c.type === 'torus') { const d = sub(p, c.c), h = dot(d, ax), rv = sub(d, mul(ax, h)); return Math.abs(Math.hypot(len(rv) - c.R, h) - c.r); } return 0; };
for (const f of process.argv.slice(2)) {
  const t0 = Date.now(); let r; try { r = stepToSnark(fs.readFileSync(f, 'utf8'), { title: f }); } catch (e) { console.log(f, 'FAILED:', e.message); continue; }
  fs.writeFileSync(f.replace(/\.step$/, '.rt.snark'), r.snark);
  const doc = S.parseSnark(r.snark), tri = []; for (const fc of doc.faces) tri.push(...fc.v);
  const st = S.meshStats({ pos: doc.pos, idx: tri }); let worst = 0;
  for (const p of doc.patches.values()) if (p.card && p.card.type !== 'free') for (const fi of p.faces) for (const v of doc.faces[fi].v) worst = Math.max(worst, dev(p.card, [doc.pos[3 * v], doc.pos[3 * v + 1], doc.pos[3 * v + 2]]));
  const rec = S.recognise(doc), errs = doc.issues.filter(i => i.level === 'error').length;
  console.log(f.padEnd(26), `${r.faces}f→${r.patches}p`, JSON.stringify(r.kinds).replace(/"/g, ''), 'open', st.open, 'vol', st.volume.toFixed(2), 'off-card', worst.toExponential(1), 'seams', doc.seams.length, 'editor:', rec.bodies.map(b => b.kind).join(','), errs ? errs + ' ERRORS' : '', ((Date.now() - t0) / 1000).toFixed(1) + 's', (r.snark.length / 1024).toFixed(0) + 'KB');
  for (const m of r.log.slice(0, 4)) console.log('     note:', m);
}
