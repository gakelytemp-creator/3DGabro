// open or misoriented mesh edges, by patch pair
import fs from 'node:fs'; import * as S from '../src/snark_core.js'; import { stepToSnark } from './step_snark.mjs';
for (const f of process.argv.slice(2)) {
  let r; try { r = stepToSnark(fs.readFileSync(f, 'utf8'), { chord: 0.05 }); } catch (e) { console.log(f, 'FAILED', e.message); continue; }
  const d = S.parseSnark(r.snark), em = new Map(); d.faces.forEach(fc => { for (let e = 0; e < 3; e++) { const a = fc.v[e], b = fc.v[(e + 1) % 3], k = Math.min(a, b) + ',' + Math.max(a, b); if (!em.has(k)) em.set(k, []); em.get(k).push(fc.patch + (a < b ? '+' : '-')); } });
  const bad = {}; let n = 0; for (const [k, v] of em) if (v.length !== 2 || v[0].slice(-1) === v[1].slice(-1)) { n++; const key = v.map(x => x.slice(0, -1)).sort().join(' / '); bad[key] = (bad[key] || 0) + 1; }
  console.log(f.padEnd(40), 'bad edges', n, n ? JSON.stringify(bad).slice(0, 300) : '');
}
