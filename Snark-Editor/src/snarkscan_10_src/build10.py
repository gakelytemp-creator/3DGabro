#!/usr/bin/env python3
"""SnarkScan_10 = SnarkScan_09 + axis_profile.js (cylinders on one axis read as one bore).
Each change is an exact replacement that must be found the stated number of times. SnarkScan_09.html is only read.
usage: python3 build10.py <SnarkScan_09.html> <axis_profile.js> <SnarkScan_10.html>"""
import sys
src, modf, out = sys.argv[1:4]
s = open(src, encoding='utf-8').read()
mod = open(modf, encoding='utf-8').read().replace('export function', 'function')
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:70], n, count); s = s.replace(old, new)

# 0. the name
rep('SnarkScan_09', 'SnarkScan_10', s.count('SnarkScan_09'))

# 1. the module and its glue, at the head of the page's main script (the first module script)
glue = '''
/* ══════════ SnarkScan_10: cylinders on one axis read as one bore (source: Snark-Editor/src/axis/axis_profile.js) ══════════ */
const AX10 = (() => {
''' + mod + '''
return { boresOf, groupCoaxial, axisProfile, readBore, fromScanCylinder };
})();
function c10Bores(cyls, J) {
  if (!cyls || !cyls.length || !SCAN.P) return [];
  let out = [];
  try { out = AX10.boresOf(SCAN.P, SCAN.n, cyls); } catch (err) { console.error('bores', err); return []; }
  return out.map(o => {
    const A = o.axis, B = o.bore, k = A.members[0].src.k, [i0, j0] = [0, 1, 2].filter(q => q !== k), at = t => A.a[k] + t * A.d[k], r2 = v => Math.round(v * 100) / 100;
    const bore = { k, at: [r2(A.a[i0]), r2(A.a[j0])], kind: B.kind, status: B.status, cylinders: A.members.map(c => r2(2 * c.r)), leanNotUsed: A.leanNotUsed,
      steps: B.steps.map(st => ({ d: st.d, from: r2(at(st.t0)), to: r2(at(st.t1)) })), unseen: B.gaps.map(g => [r2(at(g.t0)), r2(at(g.t1))]), note: B.note };
    if (J) J.card('bore', B.status, `${B.kind}: ${bore.steps.map(x => '\\u00d8' + x.d.toFixed(1)).join(' \\u2192 ') || 'no wall measured'} along ${'XYZ'[k]} at (${bore.at.join(', ')})`,
      { scope: { claimed: 'the whole bore between its mouths', tested: bore.unseen.length ? 'not the unseen depth ' + bore.unseen.map(u => u.join('\\u2026')).join(', ') + ' mm' : 'every depth, round the turn' },
        claims: B.claims.map(c => Object.assign({ text: c.text, state: c.status }, c.at !== undefined ? { at: r2(at(c.at)) } : {}, c.unseen ? { unseen: c.unseen.map(u => u.map(v => r2(at(v)))) } : {}, c.floorsAt ? { floorsAt: c.floorsAt.map(v => r2(at(v))) } : {})),
        extra: { cylinders: bore.cylinders, steps: bore.steps, note: B.note } });
    return bore;
  });
}
'''
tag = '<script type="module">'
i = s.index(tag); assert s.count(tag) == 2
s = s[:i + len(tag)] + glue + s[i + len(tag):]

# 2. after recognition: the bores, into the journal and the record
rep('SCAN.rec = { journal: J, extr,', 'const bores = c10Bores(cyls, J); SCAN.rec = { journal: J, bores, extr,')

# 3. the panel: a table of the bores before the planes
rep('''      h += '<div class="ttl">Planes</div>''', '''      if (r.bores && r.bores.length) h += `<div class="ttl">Bores (cylinders on one axis, read as one hole)</div><div class="note">All points round each axis are laid on one profile (along · from the axis). Mouths on opposite faces with the wall carried between are one hole; a floor or web inside contradicts it; depth no side saw is listed and the verdict stays a hypothesis.</div><table class="lv"><tr><th>at</th><th>what</th><th>steps, mm</th><th>unseen</th></tr>` + r.bores.map(b => `<tr><td>${'XYZ'[b.k]} (${b.at.join(', ')})</td><td>${b.kind}<br><i>${b.status}</i></td><td>${b.steps.map(x => '\\u00d8' + scNum(x.d, 1) + ' ' + scNum(x.from, 1) + '\\u2026' + scNum(x.to, 1)).join('<br>')}</td><td>${b.unseen.map(u => scNum(u[0], 1) + '\\u2026' + scNum(u[1], 1)).join('<br>') || '\\u2014'}</td></tr>`).join('') + '</table>';
      h += '<div class="ttl">Planes</div>''')

open(out, 'w', encoding='utf-8').write(s)
print('ok', len(s))
