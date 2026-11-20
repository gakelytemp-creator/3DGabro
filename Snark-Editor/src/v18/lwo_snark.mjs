/* lwo_snark.mjs — a LightWave object (.lwo: the old LWOB and the newer LWO2) → a Snark text, as a plain mesh.

   What is read: the points (PNTS), the polygons (POLS) and the names of their surfaces (SRFS, or TAGS + PTAG in LWO2).
   Every surface becomes a patch, so the mesh comes in already divided the way its author divided it.
   A patch has no card: LightWave keeps triangles and four-cornered faces only, not what surface they lie on.

   LightWave: left-handed, Y up, and by custom 1 unit = 1 metre.  Snark: right-handed, Z up, millimetres.
   (x, y, z) → (x, z, y) · scale; that swap turns the space inside out, so each polygon is written the other way round
   (LightWave's front side is the one seen clockwise).

   LWO2 is written from its description and is NOT tested on a real file yet (only LWOB is). */
export function lwoToSnark(buf, fileName = 'object.lwo', scale = 1000) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), id = o => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (buf.byteLength < 12 || id(0) !== 'FORM') throw new Error('not a LightWave object (no FORM)');
  const kind = id(8); if (kind !== 'LWOB' && kind !== 'LWO2' && kind !== 'LWLO') throw new Error('LightWave form ' + kind + ' is not read');
  const str = o => { let e = o; while (e < u8.length && u8[e]) e++; return [new TextDecoder('latin1').decode(u8.subarray(o, e)), e + 1 + ((e + 1 - o) & 1)]; };      // a name ends with a zero and is padded to an even length
  const P = [], faces = [], names = []; let base = 0, polyBase = 0, tags = [];
  for (let o = 12; o + 8 <= buf.byteLength;) {
    const tag = id(o), n = dv.getUint32(o + 4), d = o + 8, end = Math.min(d + n, buf.byteLength);
    if (tag === 'PNTS') { base = P.length; for (let k = d; k + 12 <= end; k += 12) P.push([dv.getFloat32(k) * scale, dv.getFloat32(k + 8) * scale, dv.getFloat32(k + 4) * scale]); }
    else if (tag === 'SRFS' || tag === 'TAGS') { tags = []; for (let k = d; k < end;) { const [s, nx] = str(k); tags.push(s); k = nx; } if (tag === 'SRFS') names.push(...tags); }
    else if (tag === 'POLS' && kind !== 'LWO2') {
      for (let k = d; k + 2 <= end;) {
        const nv = dv.getUint16(k); k += 2; const vs = []; for (let i = 0; i < nv; i++, k += 2) vs.push(base + dv.getUint16(k));
        let s = dv.getInt16(k); k += 2; if (s < 0) { s = -s; const nd = dv.getUint16(k); k += 2; for (let j = 0; j < nd; j++) { const m = dv.getUint16(k); k += 2 + 2 * m + 2; } }      // detail polygons lie on their parent: left out
        faces.push({ vs, surf: tags[s - 1] || 'surface' + s });
      }
    } else if (tag === 'POLS') {
      const type = id(d); polyBase = faces.length;
      for (let k = d + 4; k + 2 <= end;) {
        const nv = dv.getUint16(k) & 0x3ff; k += 2; const vs = [];
        for (let i = 0; i < nv; i++) { if (u8[k] === 0xff) { vs.push(base + (dv.getUint32(k) & 0xffffff)); k += 4; } else { vs.push(base + dv.getUint16(k)); k += 2; } }
        faces.push({ vs, surf: 'surface', skip: type !== 'FACE' && type !== 'PTCH' && type !== 'SUBD' });
      }
    } else if (tag === 'PTAG' && id(d) === 'SURF') {
      for (let k = d + 4; k + 4 <= end;) { let pi; if (u8[k] === 0xff) { pi = dv.getUint32(k) & 0xffffff; k += 4; } else { pi = dv.getUint16(k); k += 2; } const t = dv.getUint16(k); k += 2; const f = faces[polyBase + pi]; if (f) f.surf = tags[t] || 'surface' + t; }
    }
    o = d + n + (n & 1);
  }
  const clean = s => (s.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'surface').slice(0, 32), by = new Map(); let nTri = 0, nQuad = 0, nMore = 0, nSkip = 0;
  for (const f of faces) {
    const vs = f.vs.filter((v, i) => v !== f.vs[(i + 1) % f.vs.length] && P[v]); if (f.skip || vs.length < 3) { nSkip++; continue; }
    const key = clean(f.surf); let L = by.get(key); if (!L) by.set(key, L = []);
    vs.reverse();
    if (vs.length <= 4) { L.push(vs); vs.length === 3 ? nTri++ : nQuad++; } else { nMore++; for (let i = 1; i + 1 < vs.length; i++) L.push([vs[0], vs[i], vs[i + 1]]); }      // more than four corners: a fan
  }
  if (!by.size) throw new Error('no polygons in the LightWave object');
  const used = new Map(), out = [], f6 = x => { const s = (Math.round(x * 1e6) / 1e6).toString(); return s === '-0' ? '0' : s; };
  const head = `# ${fileName}: LightWave ${kind}, ${nTri} triangles, ${nQuad} four-cornered` + (nMore ? `, ${nMore} with more corners (cut into triangles)` : '') + (nSkip ? `, ${nSkip} left out (lines, points)` : '') + `; 1 unit = ${scale} mm, Y up → Z up`;
  const body = []; for (const [name, L] of by) { body.push('g ' + name); for (const vs of L) body.push('f ' + vs.map(v => { let k = used.get(v); if (k === undefined) { used.set(v, k = used.size + 1); out.push('v ' + P[v].map(f6).join(' ')); } return k; }).join(' ')); }
  return { snark: head + '\n' + out.join('\n') + '\n' + body.join('\n') + '\n', kind, points: used.size, triangles: nTri, quads: nQuad, more: nMore, skipped: nSkip, surfaces: [...by.keys()] };
}
