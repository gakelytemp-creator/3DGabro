/* ═══════════════════════════════════════════════════════════════════════════
   Snark core — reference code for the Snark draft 0.1 subset used by Snark_00.

     objects ──build──▶ SnarkDoc ──write──▶ .snark text
     .snark text ──parse──▶ SnarkDoc ──recognise──▶ bodies ──evaluate──▶ surfaces

   SnarkDoc is the file held in memory. Everything the text says is in it;
   the text is only its written form. No DOM and no three.js in this file.
   ═══════════════════════════════════════════════════════════════════════════ */

export const VERSION = '0.1';

/* ───────────── numbers and vectors ───────────── */
export const fmt = x => {
  if (!Number.isFinite(x)) return 'NaN';
  const s = (Math.round(x * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
export const fmtV = v => v.map(fmt).join(',');
const fmt9 = x => { const s = (Math.round(x * 1e9) / 1e9).toFixed(9).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };   // rotations need more digits
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const l = len(a); return l > 1e-15 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
export const vec = { add, sub, mul, dot, cross, len, unit };

/* Rotations. Euler angles are in degrees, order XYZ (as three.js).
   A frame is [ex, ey, ez]: the object's own axes written in world coordinates. */
export const Rot = {
  quatFromEuler([x, y, z]) {
    const r = Math.PI / 360, c1 = Math.cos(x * r), c2 = Math.cos(y * r), c3 = Math.cos(z * r),
      s1 = Math.sin(x * r), s2 = Math.sin(y * r), s3 = Math.sin(z * r);
    return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
  },
  frameFromQuat(q) {
    const [x, y, z, w] = q, n = Math.hypot(x, y, z, w) || 1, X = x / n, Y = y / n, Z = z / n, W = w / n;
    const x2 = X + X, y2 = Y + Y, z2 = Z + Z, xx = X * x2, xy = X * y2, xz = X * z2, yy = Y * y2, yz = Y * z2, zz = Z * z2,
      wx = W * x2, wy = W * y2, wz = W * z2;
    return [[1 - (yy + zz), xy + wz, xz - wy], [xy - wz, 1 - (xx + zz), yz + wx], [xz + wy, yz - wx, 1 - (xx + yy)]];
  },
  quatFromFrame(F) {
    const m11 = F[0][0], m12 = F[1][0], m13 = F[2][0], m21 = F[0][1], m22 = F[1][1], m23 = F[2][1], m31 = F[0][2], m32 = F[1][2], m33 = F[2][2];
    const tr = m11 + m22 + m33; let x, y, z, w, s;
    if (tr > 0) { s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m32 - m23) * s; y = (m13 - m31) * s; z = (m21 - m12) * s; }
    else if (m11 > m22 && m11 > m33) { s = 2 * Math.sqrt(1 + m11 - m22 - m33); w = (m32 - m23) / s; x = 0.25 * s; y = (m12 + m21) / s; z = (m13 + m31) / s; }
    else if (m22 > m33) { s = 2 * Math.sqrt(1 + m22 - m11 - m33); w = (m13 - m31) / s; x = (m12 + m21) / s; y = 0.25 * s; z = (m23 + m32) / s; }
    else { s = 2 * Math.sqrt(1 + m33 - m11 - m22); w = (m21 - m12) / s; x = (m13 + m31) / s; y = (m23 + m32) / s; z = 0.25 * s; }
    if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
    return [x, y, z, w];
  },
  eulerFromFrame(F) {
    const m11 = F[0][0], m12 = F[1][0], m13 = F[2][0], m22 = F[1][1], m23 = F[2][1], m32 = F[1][2], m33 = F[2][2];
    const y = Math.asin(Math.max(-1, Math.min(1, m13))); let x, z;
    if (Math.abs(m13) < 0.9999999) { x = Math.atan2(-m23, m33); z = Math.atan2(-m12, m11); }
    else { x = Math.atan2(m32, m22); z = 0; }
    const d = 180 / Math.PI, c = v => { const r = Math.round(v * d * 1e9) / 1e9; return Object.is(r, -0) ? 0 : r; };
    return [c(x), c(y), c(z)];
  },
  frameFromEuler(e) { return Rot.frameFromQuat(Rot.quatFromEuler(e)); },
  isIdentity(q) { return Math.abs(q[0]) < 1e-12 && Math.abs(q[1]) < 1e-12 && Math.abs(q[2]) < 1e-12; },
};
const local = (c, F, l) => [c[0] + F[0][0] * l[0] + F[1][0] * l[1] + F[2][0] * l[2],
  c[1] + F[0][1] * l[0] + F[1][1] * l[1] + F[2][1] * l[2], c[2] + F[0][2] * l[0] + F[1][2] * l[1] + F[2][2] * l[2]];

/* ═══════════════════ 1. SnarkDoc: the file in memory ═══════════════════ */
export function newDoc() {
  return {
    version: VERSION,
    header: { units: 'mm', up: 'z', tol: 0.001, chord: null, detail: 1, mesh: 'final', source: 'design',
      uses: [], edge: { kind: 'sharp' }, edge_angle: 30, blend: 'mix:1', extra: {} },
    meta: {},            // free text: title, author, tool, date
    preamble: [],        // comments at the top of the file
    pos: [],             // vertex coordinates: x,y,z, x,y,z, … (vertex i at 3·i)
    faces: [],           // { v:[i,j,k] or [i,j,k,l] (0-based), patch:'name' }
    patches: new Map(),  // name → { name, card, faces:[face indices], note }
    edges: [],           // { a, b, rule, note }                   #@edge
    profiles: new Map(), // id → { id, start:[x,h], segs:[…], note } #@profile
    recipe: [],          // { id, op, prim, dims, p, q, of, group, name, note }
    seams: [], curves: [], features: [], patterns: [], creases: [], levels: [], unknown: [], // kept as written (raw)
    ignored: {},         // plain-OBJ lines that Snark does not use (vn, vt, o, s…)
    issues: [],          // { level:'error'|'warn'|'info'|'boojum', line, msg }
  };
}

/* ═══════════════════ 2. text → SnarkDoc (reader) ═══════════════════ */
function tokenize(s) {
  const out = []; let cur = '', q = false, has = false;
  for (const ch of s) {
    if (ch === '"') { q = !q; cur += ch; has = true; continue; }
    if (!q && /\s/.test(ch)) { if (has) { out.push(cur); cur = ''; has = false; } continue; }
    cur += ch; has = true;
  }
  if (has) out.push(cur);
  return out;
}
const unquote = v => v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"' ? v.slice(1, -1) : v;
function splitKV(tokens) {
  const pos = [], kv = {};
  for (const t of tokens) {
    const i = t.indexOf('=');
    if (i > 0 && t[0] !== '"') kv[t.slice(0, i)] = unquote(t.slice(i + 1)); else pos.push(unquote(t));
  }
  return { pos, kv };
}
const num = (s, issues, line, what) => {
  const x = Number(s);
  if (!Number.isFinite(x)) { issues.push({ level: 'error', line, msg: `${what}: "${s}" is not a number` }); return NaN; }
  return x;
};
const numVec = (s, n, issues, line, what) => {
  const p = String(s ?? '').split(',').map(Number);
  if (p.length !== n || p.some(x => !Number.isFinite(x))) { issues.push({ level: 'error', line, msg: `${what}: expected ${n} numbers, got "${s}"` }); return null; }
  return p;
};

export function parseRule(s) {
  if (!s || s === 'sharp') return { kind: 'sharp' };
  const [k, v = ''] = s.split(':');
  if (k === 'round') { const R = Number(v); return R > 0 ? { kind: 'round', R } : { kind: 'bad', raw: s }; }
  if (k === 'chamfer') { const [a, b] = v.split(',').map(Number); return a > 0 ? { kind: 'chamfer', a, b: b > 0 ? b : a } : { kind: 'bad', raw: s }; }
  if (k === 'profile' && v) return { kind: 'profile', id: v };
  return { kind: 'bad', raw: s };
}
export function ruleText(r) {
  if (!r || r.kind === 'sharp') return 'sharp';
  if (r.kind === 'round') return 'round:' + fmt(r.R);
  if (r.kind === 'chamfer') return 'chamfer:' + fmt(r.a) + (Math.abs(r.b - r.a) > 1e-12 ? ',' + fmt(r.b) : '');
  if (r.kind === 'profile') return 'profile:' + r.id;
  return r.raw || 'sharp';
}

const CARD_KEYS = {
  plane: [['o', 3], ['n', 3], ['u', 3]], cyl: [['o', 3], ['a', 3], ['d', 1], ['side', 's']],
  cone: [['o', 3], ['a', 3], ['d', 1], ['angle', 1], ['side', 's']], sph: [['c', 3], ['d', 1], ['side', 's']],
  torus: [['c', 3], ['a', 3], ['R', 1], ['r', 1], ['side', 's']], cage: [], free: [],
};
function parseCard(type, kv, issues, line) {
  const keys = CARD_KEYS[type];
  if (!keys) { issues.push({ level: 'warn', line, msg: `unknown card type "${type}"` }); return { type, raw: kv }; }
  const card = { type };
  for (const [k, n] of keys) {
    if (n === 's') { card[k] = kv[k] === 'in' ? 'in' : 'out'; continue; }
    if (kv[k] === undefined) { issues.push({ level: 'error', line, msg: `${type} card needs ${k}=` }); continue; }
    card[k] = n === 1 ? num(kv[k], issues, line, k) : numVec(kv[k], n, issues, line, k);
  }
  return card;
}
export function cardText(card) {
  if (!card) return '';
  if (card.raw) return card.type + Object.entries(card.raw).map(([k, v]) => ` ${k}=${v}`).join('');
  return card.type + (CARD_KEYS[card.type] || []).map(([k, n]) =>
    card[k] === undefined ? '' : ` ${k}=${n === 's' ? card[k] : n === 1 ? fmt(card[k]) : fmtV(card[k])}`).join('');
}

function parsePath(pos, start, issues, line, what) {
  const st = numVec(start, 2, issues, line, what + ' start');
  const path = { start: st || [0, 0], segs: [] };
  for (let i = 0; i < pos.length;) {
    const c = pos[i];
    if (c === 'L') { const p = numVec(pos[i + 1], 2, issues, line, what + ' L'); if (p) path.segs.push({ t: 'L', p }); i += 2; }
    else if (c === 'A') {
      const p = numVec(pos[i + 1], 2, issues, line, what + ' A'), R = num(pos[i + 2], issues, line, what + ' A radius');
      if (p && Number.isFinite(R) && R !== 0) path.segs.push({ t: 'A', p, R }); i += 3;
    } else if (c === 'C') {
      const c1 = numVec(pos[i + 1], 2, issues, line, what + ' C'), c2 = numVec(pos[i + 2], 2, issues, line, what + ' C'),
        p = numVec(pos[i + 3], 2, issues, line, what + ' C');
      if (c1 && c2 && p) path.segs.push({ t: 'C', c1, c2, p }); i += 4;
    } else { issues.push({ level: 'error', line, msg: `${what}: unknown segment "${c}"` }); i++; }
  }
  return path;
}
export function pathText(path) {
  return 'start=' + fmtV(path.start) + path.segs.map(s =>
    s.t === 'L' ? ' L ' + fmtV(s.p) : s.t === 'A' ? ' A ' + fmtV(s.p) + ' ' + fmt(s.R) : ' C ' + fmtV(s.c1) + ' ' + fmtV(s.c2) + ' ' + fmtV(s.p)).join('');
}

const HEADER_NUM = ['tol', 'chord', 'detail', 'edge_angle'];
export function parseSnark(text) {
  const doc = newDoc(), I = doc.issues;
  const raw = text.replace(/^﻿/, '').split(/\r?\n/), lines = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t.startsWith('#@+')) {
      const last = lines[lines.length - 1];
      if (last && last.text.startsWith('#@')) last.text += ' ' + t.slice(3).trim();
      else I.push({ level: 'error', line: i + 1, msg: '#@+ without a directive before it' });
      continue;
    }
    lines.push({ n: i + 1, text: t });
  }
  const first = lines.find(l => l.text.trim() !== '');
  if (!first || !first.text.trim().startsWith('#@snark'))
    I.push({ level: 'warn', line: first ? first.n : 1, msg: 'the first line is not #@snark: read as a plain OBJ mesh' });
  let cur = null, note = [], top = true, nv = 0, started = false;
  const ensurePatch = name => {
    let p = doc.patches.get(name);
    if (!p) { p = { name, card: null, faces: [], note: '' }; doc.patches.set(name, p); }
    return p;
  };
  const takeNote = () => { const s = note.join('\n'); note = []; return s; };
  for (const { n, text } of lines) {
    const t = text.trim();
    if (!t) { note = []; if (started) top = false; continue; }   // the preamble is the comment block under the first line; a blank line ends it
    started = true;
    if (t.startsWith('#@')) {
      const toks = tokenize(t.slice(2)), verb = toks[0], { pos, kv } = splitKV(toks.slice(1));
      const keep = arr => arr.push({ raw: '#@' + toks.join(' '), note: takeNote() });
      switch (verb) {
        case 'snark': {
          doc.version = pos[0] || VERSION;
          if (doc.version !== VERSION) I.push({ level: 'warn', line: n, msg: `version ${doc.version}; this reader knows ${VERSION}` });
          const h = doc.header;
          for (const [k, v] of Object.entries(kv)) {
            if (HEADER_NUM.includes(k)) h[k] = num(v, I, n, k);
            else if (k === 'uses') h.uses = v.split(',').filter(Boolean);
            else if (k === 'edge') { h.edge = parseRule(v); if (h.edge.kind === 'bad') I.push({ level: 'error', line: n, msg: `edge=${v}: unknown rule` }); }
            else if (['units', 'up', 'mesh', 'source', 'blend'].includes(k)) h[k] = v;
            else h.extra[k] = v;
          }
          if (h.units !== 'mm') I.push({ level: 'error', line: n, msg: `units=${h.units}: only mm in ${VERSION}` });
          if (h.up !== 'z') I.push({ level: 'error', line: n, msg: `up=${h.up}: only z in ${VERSION}` });
          if (!['final', 'base'].includes(h.mesh)) I.push({ level: 'error', line: n, msg: `mesh=${h.mesh}: final or base` });
          break;
        }
        case 'meta': Object.assign(doc.meta, kv); break;
        case 'patch': {
          const p = ensurePatch(pos[0]); p.card = parseCard(pos[1], kv, I, n);
          const nt = takeNote(); if (nt) p.note = p.note ? p.note + '\n' + nt : nt;
          break;
        }
        case 'edge': {
          const rule = parseRule(pos[2]);
          if (pos.length < 3 || rule.kind === 'bad') I.push({ level: 'error', line: n, msg: `#@edge needs two patches and a rule: "${t}"` });
          else doc.edges.push({ a: pos[0], b: pos[1], rule, note: takeNote() });
          break;
        }
        case 'profile': {
          if (!pos[0]) { I.push({ level: 'error', line: n, msg: '#@profile needs an id' }); break; }
          const pr = parsePath(pos.slice(1), kv.start, I, n, 'profile ' + pos[0]);
          doc.profiles.set(pos[0], { id: pos[0], ...pr, note: takeNote() });
          break;
        }
        case 'recipe': {
          const [id, op, prim] = pos, r = { id, op, prim, dims: {}, note: takeNote() };
          if (!['solid', 'cut', 'int'].includes(op)) I.push({ level: 'error', line: n, msg: `recipe ${id}: unknown step "${op}"` });
          if (!['box', 'cyl', 'sph'].includes(prim)) I.push({ level: 'error', line: n, msg: `recipe ${id}: unknown primitive "${prim}"` });
          for (const k of ['x', 'y', 'z', 'd', 'h']) if (kv[k] !== undefined) r.dims[k] = num(kv[k], I, n, k);
          r.p = kv.p !== undefined ? numVec(kv.p, 3, I, n, 'p') || [0, 0, 0] : [0, 0, 0];
          r.q = kv.q !== undefined ? numVec(kv.q, 4, I, n, 'q') || [0, 0, 0, 1] : [0, 0, 0, 1];
          if (kv.of !== undefined) r.of = kv.of;
          if (kv.group !== undefined) r.group = kv.group;
          if (kv.name !== undefined) r.name = kv.name;
          doc.recipe.push(r);
          break;
        }
        case 'seam': keep(doc.seams); break;
        case 'curve': keep(doc.curves); break;
        case 'feature': keep(doc.features); break;
        case 'pattern': keep(doc.patterns); break;
        case 'crease': keep(doc.creases); break;
        case 'level': keep(doc.levels); break;
        default: keep(doc.unknown); I.push({ level: 'info', line: n, msg: `#@${verb}: not known to this reader, kept as written` });
      }
      if (verb !== 'snark' && verb !== 'meta') top = false;
      continue;
    }
    if (t.startsWith('#')) { const c = t.replace(/^#\s?/, ''); if (top) doc.preamble.push(c); else note.push(c); continue; }
    top = false;
    const tok = t.split(/\s+/), kw = tok[0];
    if (kw === 'v') {
      const x = Number(tok[1]), y = Number(tok[2]), z = Number(tok[3]);
      if (![x, y, z].every(Number.isFinite)) I.push({ level: 'error', line: n, msg: 'bad vertex' });
      doc.pos.push(x, y, z); nv++;
    } else if (kw === 'f') {
      const v = tok.slice(1).map(s => { let k = parseInt(s.split('/')[0], 10); if (k < 0) k = nv + k + 1; return k - 1; });
      if (v.length < 3 || v.some(k => !(k >= 0 && k < nv))) { I.push({ level: 'error', line: n, msg: 'face refers to a vertex that does not exist' }); continue; }
      if (v.length > 4) I.push({ level: 'warn', line: n, msg: `face with ${v.length} corners: Snark ${VERSION} allows 3 or 4` });
      if (!cur) cur = ensurePatch('_');
      doc.faces.push({ v, patch: cur.name }); cur.faces.push(doc.faces.length - 1);
    } else if (kw === 'g') {
      cur = ensurePatch(tok[1] || '_');
      const nt = takeNote(); if (nt) cur.note = cur.note ? cur.note + '\n' + nt : nt;
      if (tok.length > 2) I.push({ level: 'warn', line: n, msg: `group with several names: using "${tok[1]}"` });
    } else doc.ignored[kw] = (doc.ignored[kw] || 0) + 1;
  }
  // references
  for (const p of doc.patches.values()) if (p.card && !p.faces.length) I.push({ level: 'warn', msg: `patch ${p.name} has a card but no faces` });
  for (const e of doc.edges) {
    for (const nm of [e.a, e.b]) if (!doc.patches.has(nm)) I.push({ level: 'error', msg: `#@edge ${e.a} ${e.b}: no patch "${nm}"` });
    if (e.rule.kind === 'profile' && !doc.profiles.has(e.rule.id)) I.push({ level: 'error', msg: `#@edge ${e.a} ${e.b}: no profile "${e.rule.id}"` });
  }
  if (doc.header.edge.kind === 'profile' && !doc.profiles.has(doc.header.edge.id)) I.push({ level: 'error', msg: `edge=profile:${doc.header.edge.id}: no such profile` });
  const ids = new Set(doc.recipe.map(r => r.id));
  for (const r of doc.recipe) if (r.of !== undefined && !ids.has(r.of)) I.push({ level: 'error', msg: `recipe ${r.id}: target ${r.of} does not exist` });
  return doc;
}

/* ═══════════════════ 3. SnarkDoc → text (writer) ═══════════════════ */
export function writeSnark(doc) {
  const out = [], h = doc.header;
  const notes = s => { if (s) for (const l of s.split('\n')) out.push(l ? '# ' + l : '#'); };
  let first = '#@snark ' + (doc.version || VERSION) + ' units=' + h.units + ' up=' + h.up + ' tol=' + fmt(h.tol);
  if (h.chord != null) first += ' chord=' + fmt(h.chord);
  first += ' detail=' + fmt(h.detail) + ' mesh=' + h.mesh + ' source=' + h.source;
  if (h.uses && h.uses.length) first += ' uses=' + h.uses.join(',');
  if (h.edge && h.edge.kind !== 'sharp') first += ' edge=' + ruleText(h.edge);
  if (h.edge_angle !== 30) first += ' edge_angle=' + fmt(h.edge_angle);
  if (h.blend && h.blend !== 'mix:1') first += ' blend=' + h.blend;
  for (const [k, v] of Object.entries(h.extra || {})) first += ' ' + k + '=' + v;
  out.push(first);
  const meta = Object.entries(doc.meta);
  if (meta.length) out.push('#@meta ' + meta.map(([k, v]) => k + '="' + String(v).replace(/"/g, "'") + '"').join(' '));
  for (const c of doc.preamble) out.push(c ? '# ' + c : '#');
  out.push('');
  // first what the shape is (recipe, edge rules, everything that is not mesh) — a person reads this part
  for (const r of doc.recipe) {
    notes(r.note);
    let s = '#@recipe ' + r.id + ' ' + r.op + ' ' + r.prim;
    for (const k of ['x', 'y', 'z', 'd', 'h']) if (r.dims[k] !== undefined) s += ' ' + k + '=' + fmt(r.dims[k]);
    s += ' p=' + fmtV(r.p);
    if (!Rot.isIdentity(r.q)) s += ' q=' + r.q.map(fmt9).join(',');
    if (r.of !== undefined) s += ' of=' + r.of;
    if (r.group !== undefined) s += ' group=' + r.group;
    if (r.name !== undefined) s += ' name="' + String(r.name).replace(/"/g, "'") + '"';
    out.push(s);
  }
  for (const pr of doc.profiles.values()) { notes(pr.note); out.push('#@profile ' + pr.id + ' ' + pathText(pr)); }
  for (const e of doc.edges) { notes(e.note); out.push('#@edge ' + e.a + ' ' + e.b + ' ' + ruleText(e.rule)); }
  for (const arr of [doc.seams, doc.curves, doc.features, doc.patterns, doc.creases, doc.levels, doc.unknown])
    for (const r of arr) { notes(r.note); out.push(r.raw); }
  if (out[out.length - 1] !== '') out.push('');
  // then the mesh, one block per body: its points, then its patches. OBJ numbers points in the order they appear.
  const nv = doc.pos.length / 3, parent = new Int32Array(nv).map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const f of doc.faces) for (let i = 1; i < f.v.length; i++) { const a = find(f.v[0]), b = find(f.v[i]); if (a !== b) parent[a] = b; }
  const members = new Map();
  for (let i = 0; i < nv; i++) { const r = find(i); if (!members.has(r)) members.set(r, []); members.get(r).push(i); }
  const newIdx = new Int32Array(nv).fill(-1); let next = 0;
  const emit = i => { newIdx[i] = ++next; out.push('v ' + fmt(doc.pos[3 * i]) + ' ' + fmt(doc.pos[3 * i + 1]) + ' ' + fmt(doc.pos[3 * i + 2])); };
  for (const p of doc.patches.values()) {
    notes(p.note);
    for (const fi of p.faces) for (const k of doc.faces[fi].v) if (newIdx[k] < 0) for (const i of members.get(find(k))) if (newIdx[i] < 0) emit(i);
    out.push('g ' + p.name);
    if (p.card) out.push('#@patch ' + p.name + ' ' + cardText(p.card));
    for (const fi of p.faces) out.push('f ' + doc.faces[fi].v.map(k => newIdx[k]).join(' '));
  }
  for (let i = 0; i < nv; i++) if (newIdx[i] < 0) emit(i);   // points no face uses: kept
  while (out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

/* ═══════════════════ 4. profiles: drawing numbers → points ═══════════════════ */
function arcGeom(p0, p1, R) {
  const cx = p1[0] - p0[0], cy = p1[1] - p0[1], L = Math.hypot(cx, cy);
  if (L < 1e-12 || Math.abs(R) < L / 2 - 1e-9 * Math.max(1, Math.abs(R))) return null;
  const h = Math.sqrt(Math.max(0, R * R - L * L / 4)), nx = -cy / L, ny = cx / L, sg = R > 0 ? 1 : -1;
  const c = [(p0[0] + p1[0]) / 2 + sg * h * nx, (p0[1] + p1[1]) / 2 + sg * h * ny];
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]); let a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
  let sw = a1 - a0;
  if (R > 0) { while (sw <= 0) sw += 2 * Math.PI; } else { while (sw >= 0) sw -= 2 * Math.PI; }
  if (Math.abs(sw) > Math.PI + 1e-9) return null;
  return { c, a0, sw, r: Math.abs(R) };
}
export { arcGeom };
const segsFor = (r, sweep, chord) => Math.max(1, Math.ceil(Math.abs(sweep) / (2 * Math.acos(Math.max(-1, 1 - chord / r)))));

/* A path as runs of points with unit tangents. A new run starts wherever the
   tangent breaks (a sharp corner inside the profile). */
export function samplePath(path, chord) {
  const runs = []; let cur = null, p = path.start.slice();
  for (const s of path.segs) {
    let pts = [], tan = [];
    if (s.t === 'L') {
      const dx = s.p[0] - p[0], dy = s.p[1] - p[1], l = Math.hypot(dx, dy);
      if (l < 1e-12) continue;
      pts = [p.slice(), s.p.slice()]; tan = [[dx / l, dy / l], [dx / l, dy / l]];
    } else if (s.t === 'A') {
      const g = arcGeom(p, s.p, s.R);
      if (!g) throw new Error(`arc to ${fmtV(s.p)} with radius ${fmt(s.R)} is impossible`);
      const n = segsFor(g.r, g.sw, chord);
      for (let i = 0; i <= n; i++) {
        const a = g.a0 + g.sw * i / n;
        pts.push([g.c[0] + g.r * Math.cos(a), g.c[1] + g.r * Math.sin(a)]);
        tan.push(s.R > 0 ? [-Math.sin(a), Math.cos(a)] : [Math.sin(a), -Math.cos(a)]);
      }
      pts[0] = p.slice(); pts[n] = s.p.slice();
    } else {
      const P = [p, s.c1, s.c2, s.p];
      const B = t => { const u = 1 - t; return [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };
      const D = t => { const u = 1 - t; return [0, 1].map(k => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])); };
      const off = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return l < 1e-15 ? Math.hypot(q[0] - a[0], q[1] - a[1]) : Math.abs((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / l; };
      const ts = [0];
      const rec = (t0, t1, d) => {
        const a = B(t0), b = B(t1);
        const bad = [0.25, 0.5, 0.75].some(f => off(B(t0 + (t1 - t0) * f), a, b) > chord);
        if (bad && d < 18) { const m = (t0 + t1) / 2; rec(t0, m, d + 1); rec(m, t1, d + 1); } else ts.push(t1);
      };
      rec(0, 1, 0);
      for (const t of ts) {
        pts.push(B(t)); let d = D(t), l = Math.hypot(d[0], d[1]);
        if (l < 1e-12) { const e = 1e-6, b1 = B(Math.min(1, t + e)), b0 = B(Math.max(0, t - e)); d = [b1[0] - b0[0], b1[1] - b0[1]]; l = Math.hypot(d[0], d[1]); }
        tan.push([d[0] / l, d[1] / l]);
      }
      pts[0] = p.slice(); pts[pts.length - 1] = s.p.slice();
    }
    const last = cur && cur.tan[cur.tan.length - 1];
    if (last && last[0] * tan[0][0] + last[1] * tan[0][1] > 1 - 1e-9) { cur.pts.push(...pts.slice(1)); cur.tan.push(...tan.slice(1)); }
    else { cur = { pts, tan }; runs.push(cur); }
    p = s.p.slice();
  }
  return runs;
}

/* Edge profiles. In a Snark edge frame the profile goes from (t,0) on the first
   face to (0,-t) on the second. Here it is turned into the unit corner square:
   a = 1 on the first face, b = 1 on the second, the inner point at (0,0). */
export function edgePath(rule, profiles) {
  if (rule.kind === 'round') return { start: [rule.R, 0], segs: [{ t: 'A', p: [0, -rule.R], R: rule.R }] };
  if (rule.kind === 'chamfer') return { start: [rule.a, 0], segs: [{ t: 'L', p: [0, -rule.b] }] };
  if (rule.kind === 'profile') return profiles.get(rule.id) || null;
  return null;
}
export function quadRuns(path, chord) {
  const t = path.start[0], runs = samplePath(path, chord);
  return runs.map(r => ({
    tag: 'curve',
    a: r.pts.map(p => 1 + p[1] / t), b: r.pts.map(p => 1 - p[0] / t),
    ta: r.tan.map(d => d[1]), tb: r.tan.map(d => -d[0]),
  }));
}
export const SQUARE = [
  { tag: 'sq1', a: [1, 1], b: [0, 1], ta: [0, 0], tb: [1, 1] },
  { tag: 'sq2', a: [1, 0], b: [1, 1], ta: [-1, -1], tb: [0, 0] },
];
export function checkEdgePath(path) {
  const msgs = [];
  if (!path || !path.segs.length) return ['empty profile'];
  const t = path.start[0], end = path.segs[path.segs.length - 1].p;
  if (!(t > 0) || Math.abs(path.start[1]) > 1e-9) msgs.push('an edge profile must start on the first face: start=t,0 with t > 0');
  if (Math.abs(end[0]) > 1e-9) msgs.push('an edge profile must end on the second face: x = 0');
  if (Math.abs(-end[1] - t) > 1e-6 * Math.max(1, t)) msgs.push(`setbacks differ (${fmt(t)} and ${fmt(-end[1])}): Snark_00 needs them equal`);
  try {
    const q = quadRuns(path, t / 400), pts = [];
    q.forEach(r => r.a.forEach((a, i) => pts.push([a, r.b[i]])));
    const ang = pts.map(([a, b]) => Math.atan2(b, a)), rad = pts.map(([a, b]) => Math.hypot(a, b));
    const at = th => { for (let i = 1; i < ang.length; i++) if ((ang[i - 1] - th) * (ang[i] - th) <= 0) { const f = (th - ang[i - 1]) / ((ang[i] - ang[i - 1]) || 1); return rad[i - 1] + f * (rad[i] - rad[i - 1]); } return NaN; };
    let asym = 0;
    for (let k = 1; k < 20; k++) { const th = Math.PI / 2 * k / 40; asym = Math.max(asym, Math.abs(at(th) - at(Math.PI / 2 - th))); }
    if (asym > 1e-3) msgs.push('the profile is not symmetric about the 45° line: box corners may not close');
  } catch (e) { msgs.push(e.message); }
  return msgs;
}
/* The "spline" family of Snark_00: one cubic, tangent to both faces.
   k = 0 → straight (chamfer-like), k ≈ 0.5523 → nearly a circle, k = 1 → nearly sharp. */
export const KAPPA = 0.5522847498;
export const splinePath = (t, k) => ({ start: [t, 0], segs: [{ t: 'C', c1: [(1 - k) * t, 0], c2: [0, -(1 - k) * t], p: [0, -t] }] });
export function splineK(path) {
  if (!path || path.segs.length !== 1 || path.segs[0].t !== 'C') return null;
  const t = path.start[0], s = path.segs[0], k = 1 - s.c1[0] / t, e = 1e-6 * Math.max(1, t);
  if (Math.abs(path.start[1]) > e || Math.abs(s.c1[1]) > e || Math.abs(s.c2[0]) > e || Math.abs(s.c2[1] + (1 - k) * t) > e ||
    Math.abs(s.p[0]) > e || Math.abs(s.p[1] + t) > e || k < -1e-9 || k > 1 + 1e-9) return null;
  return Math.min(1, Math.max(0, k));
}

/* ═══════════════════ 5. objects → SnarkDoc (builder) ═══════════════════ */
/* Bench objects:
   { id, kind:'box'|'cyl'|'sph', name, size:[x,y,z] | [d,h] | [d], p:[x,y,z], rot:[deg,deg,deg],
     edge:{ rule:'sharp'|'round'|'chamfer'|'spline'|'custom', t, k, path, keys:[…] }, names:{…} } */
export const BOX_FACES = { xn: 'left', xp: 'right', yn: 'front', yp: 'back', zn: 'bottom', zp: 'top' };
export const faceId = (m, s) => 'xyz'[m] + (s > 0 ? 'p' : 'n');
export const edgeKey = (ax, si, sj) => String(ax) + (si > 0 ? '+' : '-') + (sj > 0 ? '+' : '-');
export const otherAxes = ax => ax === 0 ? [1, 2] : ax === 1 ? [0, 2] : [0, 1];
export const ALL_KEYS = []; for (const ax of [0, 1, 2]) for (const si of [-1, 1]) for (const sj of [-1, 1]) ALL_KEYS.push(edgeKey(ax, si, sj));
export const EDGE_SETS = {
  box: { all: ALL_KEYS, vertical: ALL_KEYS.filter(k => k[0] === '2'), top: ALL_KEYS.filter(k => k[0] !== '2' && k[2] === '+'),
    bottom: ALL_KEYS.filter(k => k[0] !== '2' && k[2] === '-'), none: [] },
  cyl: { all: ['top', 'bottom'], top: ['top'], bottom: ['bottom'], none: [] },
  sph: { none: [] },
};
EDGE_SETS.box.topvert = [...EDGE_SETS.box.top, ...EDGE_SETS.box.vertical];
export function edgeSetName(kind, keys) {
  const S = EDGE_SETS[kind] || {}, k = [...(keys || [])].sort().join();
  for (const [n, v] of Object.entries(S)) if ([...v].sort().join() === k) return n;
  return 'custom';
}
export function objectRule(o) {
  const e = o.edge || {};
  if (!e.keys || !e.keys.length || e.rule === 'sharp' || !(e.t > 0)) return null;
  if (e.rule === 'round') return { rule: { kind: 'round', R: e.t } };
  if (e.rule === 'chamfer') return { rule: { kind: 'chamfer', a: e.t, b: e.t } };
  if (e.rule === 'spline') return { rule: { kind: 'profile', id: null }, path: splinePath(e.t, e.k) };
  if (e.rule === 'custom' && e.path) return { rule: { kind: 'profile', id: null }, path: e.path };
  return null;
}
const nameSet = (o, kind) => {
  const pre = 'b' + o.id + '_', N = o.names || {};
  if (kind === 'box') { const r = {}; for (const [k, v] of Object.entries(BOX_FACES)) r[k] = N[k] || pre + v; return r; }
  if (kind === 'cyl') return { top: N.top || pre + 'top', bottom: N.bottom || pre + 'bottom', side: N.side || pre + 'side' };
  return { surface: N.surface || pre + 'surface' };
};
export function describe(o) {
  const s = o.size.map(fmt);
  return o.kind === 'box' ? `box ${s[0]} x ${s[1]} x ${s[2]}` : o.kind === 'cyl' ? `cylinder d${s[0]} x ${s[1]}` : `sphere d${s[0]}`;
}

export function buildDoc(state) {
  const doc = newDoc(), H = doc.header, F = state.foreign || {};
  Object.assign(H, { tol: state.header?.tol ?? 0.001, detail: state.header?.detail ?? 1, mesh: 'base', source: state.header?.source ?? 'design',
    blend: state.header?.blend ?? 'mix:1', extra: { ...(state.header?.extra || {}) } });
  Object.assign(doc.meta, state.meta || {});
  doc.preamble = [...(state.preamble || [])];
  const P = doc.pos;
  const addV = p => { P.push(p[0], p[1], p[2]); return P.length / 3 - 1; };
  const addPatch = (name, card, note) => { const p = { name, card, faces: [], note: note || '' }; doc.patches.set(name, p); return p; };
  const addFace = (patch, v) => { doc.faces.push({ v, patch: patch.name }); patch.faces.push(doc.faces.length - 1); };
  const usedProfileIds = new Set((F.profiles || []).map(p => p.id));
  const uniq = base => { let id = base, k = 2; while (usedProfileIds.has(id) || doc.patches.has(id)) id = base + '_' + k++; usedProfileIds.add(id); return id; };
  (state.objects || []).forEach((o, oi) => {
    const oq = (o.q || Rot.quatFromEuler(o.rot || [0, 0, 0])).map(v => Math.round(v * 1e9) / 1e9), Fm = Rot.frameFromQuat(oq), c = o.p, names = nameSet(o, o.kind), note = o.note || `body ${o.name ? '"' + o.name + '" ' : ''}${describe(o)}`;   // oq: exactly the quaternion the file will say
    if (o.kind === 'box') {
      const h = o.size.map(x => x / 2), S = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
      const ix = S.map(s => addV(local(c, Fm, [s[0] * h[0], s[1] * h[1], s[2] * h[2]])));
      const faceDefs = [['zn', [0, 3, 2, 1], 2, -1, 0, 1], ['zp', [4, 5, 6, 7], 2, 1, 0, 1], ['yn', [0, 1, 5, 4], 1, -1, 0, 1],
        ['xp', [1, 2, 6, 5], 0, 1, 1, 1], ['yp', [2, 3, 7, 6], 1, 1, 0, -1], ['xn', [3, 0, 4, 7], 0, -1, 1, -1]];
      faceDefs.forEach(([id, q, m, s, um, us], fi) => {
        const n = mul(Fm[m], s), u = mul(Fm[um], us), v = cross(n, u);
        const ext = ax => o.size[ax] / 2;
        const vm = [0, 1, 2].find(ax => ax !== m && ax !== um);
        const center = add(c, mul(Fm[m], s * h[m]));
        const oo = sub(sub(center, mul(u, ext(um))), mul(v, ext(vm)));   // datum corner: (u,v) read like a drawing of the face
        const patch = addPatch(names[id], { type: 'plane', o: oo, n, u }, fi === 0 ? note : '');
        addFace(patch, q.map(k => ix[k]));
      });
    } else if (o.kind === 'cyl') {
      const r = o.size[0] / 2, hh = o.size[1] / 2, N = 32;
      const ct = addV(local(c, Fm, [0, 0, hh])), cb = addV(local(c, Fm, [0, 0, -hh])), T = [], B = [];
      for (let k = 0; k < N; k++) { const a = 2 * Math.PI * (k + 0.5) / N; T.push(addV(local(c, Fm, [r * Math.cos(a), r * Math.sin(a), hh]))); }
      for (let k = 0; k < N; k++) { const a = 2 * Math.PI * (k + 0.5) / N; B.push(addV(local(c, Fm, [r * Math.cos(a), r * Math.sin(a), -hh]))); }
      const top = addPatch(names.top, { type: 'plane', o: local(c, Fm, [0, 0, hh]), n: Fm[2].slice(), u: Fm[0].slice() }, note);
      for (let k = 0; k < N; k++) addFace(top, [ct, T[k], T[(k + 1) % N]]);
      const bot = addPatch(names.bottom, { type: 'plane', o: local(c, Fm, [0, 0, -hh]), n: mul(Fm[2], -1), u: Fm[0].slice() });
      for (let k = 0; k < N; k++) addFace(bot, [cb, B[(k + 1) % N], B[k]]);
      const side = addPatch(names.side, { type: 'cyl', o: local(c, Fm, [0, 0, -hh]), a: Fm[2].slice(), d: 2 * r, side: 'out' });
      for (let k = 0; k < N; k++) addFace(side, [B[k], B[(k + 1) % N], T[(k + 1) % N], T[k]]);
    } else {
      const r = o.size[0] / 2, nLat = 8, nLon = 16, rings = [];
      const np = addV(local(c, Fm, [0, 0, r])), sp = addV(local(c, Fm, [0, 0, -r]));
      for (let i = 1; i < nLat; i++) {
        const th = Math.PI * i / nLat, ring = [];
        for (let j = 0; j < nLon; j++) { const ph = 2 * Math.PI * j / nLon; ring.push(addV(local(c, Fm, [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)]))); }
        rings.push(ring);
      }
      const surf = addPatch(names.surface, { type: 'sph', c: c.slice(), d: 2 * r, side: 'out' }, note);
      for (let j = 0; j < nLon; j++) addFace(surf, [np, rings[0][j], rings[0][(j + 1) % nLon]]);
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < nLon; j++)
        addFace(surf, [rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % nLon], rings[i][(j + 1) % nLon]]);
      const L = rings[rings.length - 1];
      for (let j = 0; j < nLon; j++) addFace(surf, [sp, L[(j + 1) % nLon], L[j]]);
    }
    // edge rules
    const R = objectRule(o);
    if (R && o.kind !== 'sph') {
      let rule = R.rule;
      if (R.path) { const id = uniq('b' + o.id + '_edge'); doc.profiles.set(id, { id, ...R.path, note: '' }); rule = { kind: 'profile', id }; }
      if (o.kind === 'box') {
        for (const key of o.edge.keys) {
          const ax = +key[0], [i, j] = otherAxes(ax), si = key[1] === '+' ? 1 : -1, sj = key[2] === '+' ? 1 : -1;
          doc.edges.push({ a: names[faceId(i, si)], b: names[faceId(j, sj)], rule, note: '' });
        }
      } else {
        for (const key of o.edge.keys) doc.edges.push({ a: names[key], b: names.side, rule, note: '' });
      }
    }
    // recipe: how it was made
    const q = oq;
    const dims = o.kind === 'box' ? { x: o.size[0], y: o.size[1], z: o.size[2] } : o.kind === 'cyl' ? { d: o.size[0], h: o.size[1] } : { d: o.size[0] };
    doc.recipe.push({ id: String(oi + 1), op: 'solid', prim: o.kind, dims, p: c.slice(), q, name: o.name || undefined, note: '' });
  });
  // what came from a file and is not a bench object: kept as it was
  for (const b of F.bodies || []) {
    const base = P.length / 3;
    for (let i = 0; i < b.pos.length; i += 3) P.push(b.pos[i], b.pos[i + 1], b.pos[i + 2]);
    for (const pt of b.patches) { const p = addPatch(pt.name, pt.card, pt.note); for (const f of pt.faces) addFace(p, f.map(k => k + base)); }
  }
  for (const pr of F.profiles || []) if (!doc.profiles.has(pr.id)) doc.profiles.set(pr.id, pr);
  for (const e of F.edges || []) doc.edges.push(e);
  for (const k of ['seams', 'curves', 'features', 'patterns', 'creases', 'levels', 'unknown']) doc[k] = [...(F[k] || [])];
  const n = doc.recipe.length, map = new Map();
  (F.recipe || []).forEach((r, i) => map.set(r.id, String(n + i + 1)));
  for (const r of F.recipe || []) doc.recipe.push({ ...r, id: map.get(r.id), of: r.of !== undefined ? map.get(r.of) ?? r.of : undefined });
  const uses = [];
  if ([...doc.patches.values()].some(p => p.card)) uses.push('L1');
  if (doc.edges.length || doc.features.length || doc.patterns.length) uses.push('L2');
  if (doc.creases.length || doc.levels.length) uses.push('L3');
  if (doc.recipe.length) uses.push('L4');
  H.uses = uses;
  return doc;
}

/* ═══════════════════ 6. SnarkDoc → bodies (recognition) ═══════════════════ */
function components(doc) {
  const nv = doc.pos.length / 3, parent = new Int32Array(nv).map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const f of doc.faces) for (let i = 1; i < f.v.length; i++) { const a = find(f.v[0]), b = find(f.v[i]); if (a !== b) parent[a] = b; }
  const groups = new Map();
  doc.faces.forEach((f, fi) => { const r = find(f.v[0]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(fi); });
  return [...groups.values()];
}
const vtx = (doc, i) => [doc.pos[3 * i], doc.pos[3 * i + 1], doc.pos[3 * i + 2]];
function patchAdjacency(doc, faces) {
  const own = new Map(), pairs = new Map();
  for (const fi of faces) {
    const f = doc.faces[fi];
    for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i], b = f.v[(i + 1) % f.v.length], k = a < b ? a + ',' + b : b + ',' + a;
      const prev = own.get(k);
      if (prev === undefined) own.set(k, f.patch);
      else if (prev !== f.patch) { const pk = prev < f.patch ? prev + '|' + f.patch : f.patch + '|' + prev; pairs.set(pk, [prev, f.patch].sort()); }
    }
  }
  return [...pairs.values()];
}
const ruleKey = r => ruleText(r);
export function ruleFor(doc, a, b) {
  for (const e of doc.edges) if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e.rule;
  return doc.header.edge || { kind: 'sharp' };
}

/* Which patches form which body, and what each body is.
   1. every connected piece of mesh: what its cards say (and whether its points lie on them);
   2. the recipe: each solid step is the same body told a third time. A step that agrees is used as is.
      A step that disagrees is a Boojum: it is reported, and for source=design the recipe is followed
      (trust order of §13: recipe, cards, mesh); for source=scan the cards (= the measured mesh) are followed;
   3. edge rules of each body. */
export function recognise(doc) {
  const tol = doc.header.tol || 0.001, design = doc.header.source !== 'scan', issues = [], bodies = [];
  const sizeText = v => v.map(fmt).join(' x ');
  for (const faces of components(doc)) {
    const names = [...new Set(faces.map(fi => doc.faces[fi].patch))];
    const patches = names.map(n => doc.patches.get(n));
    const vOf = p => [...new Set(p.faces.filter(fi => faces.includes(fi)).flatMap(fi => doc.faces[fi].v))].map(i => vtx(doc, i));
    const body = { kind: 'mesh', faces, names, issues: [] };
    const cards = patches.map(p => p.card && !p.card.raw ? p.card : null);
    const boojum = msg => body.issues.push({ level: 'boojum', msg });
    const offCards = dev => {     // mesh against cards
      if (dev <= tol) return false;
      boojum(`the mesh and the cards of ${names.join(', ')} disagree by ${fmt(dev)} mm` + (design ? ': the cards are followed (source=design)' : ': the mesh is shown as it is (source=scan)'));
      return !design;
    };
    try {
      if (patches.length === 6 && cards.every(c => c && c.type === 'plane')) {
        const n = cards.map(c => unit(c.n)), pair = new Array(6).fill(-1);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (i !== j && dot(n[i], n[j]) < -1 + 1e-9) pair[i] = j;
        const firsts = [0, 1, 2, 3, 4, 5].filter(i => pair[i] > i);
        if (pair.every(p => p >= 0) && firsts.length === 3 &&
          firsts.every((i, a) => firsts.every((j, b) => a === b || Math.abs(dot(n[i], n[j])) < 1e-5))) {   // numbers are written with 6 decimals
          const dirs = firsts.map(i => n[i]), sz = [], mid = [];
          firsts.forEach((i, a) => { const d = dirs[a], s1 = dot(d, cards[i].o), s0 = dot(d, cards[pair[i]].o); sz.push(s1 - s0); mid.push((s1 + s0) / 2); });
          if (sz.every(s => s > tol)) {
            let c = [0, 0, 0]; dirs.forEach((d, a) => { c = add(c, mul(d, mid[a])); });
            let dev = 0;
            patches.forEach((p, i) => { for (const q of vOf(p)) dev = Math.max(dev, Math.abs(dot(sub(q, cards[i].o), n[i]))); });
            if (!offCards(dev)) {
              // the frame closest to the world axes (the recipe may give another one below)
              const pick = [], used = new Set(), F = [];
              for (const w of [[1, 0, 0], [0, 1, 0]]) {
                let best = -1, bd = -1;
                dirs.forEach((d, a) => { if (!used.has(a) && Math.abs(dot(d, w)) > bd) { bd = Math.abs(dot(d, w)); best = a; } });
                used.add(best); pick.push(best); F.push(mul(dirs[best], dot(dirs[best], w) >= 0 ? 1 : -1));
              }
              F.push(cross(F[0], F[1]));
              pick.push([0, 1, 2].find(a => !used.has(a)));
              Object.assign(body, { kind: 'box', c, F, size: pick.map(a => sz[a]), card: { dirs, sz, n, patches } });
            }
          }
        }
      } else if (patches.length === 3 && cards.filter(c => c && c.type === 'plane').length === 2 && cards.some(c => c && c.type === 'cyl')) {
        const ci = cards.findIndex(c => c.type === 'cyl'), cy = cards[ci], a = unit(cy.a);
        const caps = [0, 1, 2].filter(i => i !== ci);
        if (caps.every(i => Math.abs(Math.abs(dot(unit(cards[i].n), a)) - 1) < 1e-9) && cy.side !== 'in') {
          const ti = caps.find(i => dot(cards[i].n, a) > 0), bi = caps.find(i => dot(cards[i].n, a) < 0);
          if (ti !== undefined && bi !== undefined) {
            const s1 = dot(a, cards[ti].o), s0 = dot(a, cards[bi].o), hgt = s1 - s0;
            const c = add(cy.o, mul(a, (s1 + s0) / 2 - dot(a, cy.o)));
            let dev = 0;
            for (const q of vOf(patches[ci])) { const rel = sub(q, cy.o); dev = Math.max(dev, Math.abs(len(sub(rel, mul(a, dot(rel, a)))) - cy.d / 2)); }
            for (const i of caps) for (const q of vOf(patches[i])) dev = Math.max(dev, Math.abs(dot(sub(q, cards[i].o), unit(cards[i].n))));
            if (hgt > tol && !offCards(dev)) {
              let ex = sub([1, 0, 0], mul(a, a[0]));
              if (len(ex) < 1e-6) ex = sub([0, 1, 0], mul(a, a[1]));
              ex = unit(ex);
              Object.assign(body, { kind: 'cyl', c, F: [ex, cross(a, ex), a], size: [cy.d, hgt], names: { top: patches[ti].name, bottom: patches[bi].name, side: patches[ci].name }, card: { a } });
            }
          }
        }
      } else if (patches.length === 1 && cards[0] && cards[0].type === 'sph' && cards[0].side !== 'in') {
        const sp = cards[0]; let dev = 0;
        for (const q of vOf(patches[0])) dev = Math.max(dev, Math.abs(len(sub(q, sp.c)) - sp.d / 2));
        if (!offCards(dev)) Object.assign(body, { kind: 'sph', c: sp.c.slice(), F: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], size: [sp.d], names: { surface: patches[0].name }, card: {} });
      }
    } catch (e) { body.issues.push({ level: 'error', msg: 'recognition failed: ' + e.message }); body.kind = 'mesh'; }
    bodies.push(body);
  }

  // 2. the recipe
  const usedRecipe = new Set(), solids = doc.recipe.filter(r => r.op === 'solid');
  const compare = (b, r) => {      // how a recipe step and a body's cards differ
    const RF = Rot.frameFromQuat(r.q), diffs = [], dc = len(sub(r.p, b.c));
    let aligned = true, rsize, csize;
    if (b.kind === 'box') {
      const map = RF.map(ax => b.card.dirs.findIndex(d => Math.abs(Math.abs(dot(ax, d)) - 1) < 1e-6));
      aligned = map.every(i => i >= 0) && new Set(map).size === 3;
      rsize = [r.dims.x, r.dims.y, r.dims.z]; csize = aligned ? map.map(i => b.card.sz[i]) : b.size;
    } else if (b.kind === 'cyl') {
      aligned = dot(RF[2], b.card.a) > 1 - 1e-9; rsize = [r.dims.d, r.dims.h]; csize = b.size;
    } else { rsize = [r.dims.d]; csize = b.size; }
    if (!aligned) diffs.push('the recipe turns the body differently');
    else if (rsize.some((v, k) => !(Math.abs(v - csize[k]) <= tol))) diffs.push(`size ${sizeText(rsize)} in the recipe, ${sizeText(csize)} by the cards`);
    if (dc > tol * 10) diffs.push(`centre ${fmtV(r.p)} in the recipe, ${fmtV(b.c)} by the cards (${fmt(dc)} mm apart)`);
    return { RF, rsize, aligned, diffs, dc };
  };
  const follow = (b, r, cmp) => { b.c = r.p.slice(); b.F = cmp.RF; b.size = cmp.rsize.slice(); };
  for (const b of bodies) {       // steps that agree
    if (b.kind === 'mesh') continue;
    for (const r of solids) {
      if (usedRecipe.has(r) || r.prim !== b.kind) continue;
      const cmp = compare(b, r);
      if (!cmp.diffs.length) { usedRecipe.add(r); b.recipe = r; follow(b, r, cmp); break; }
    }
  }
  for (const b of bodies) {       // steps that disagree: paired with the nearest body of their kind
    if (b.kind === 'mesh' || b.recipe) continue;
    let best = null, bd = Infinity;
    for (const r of solids) { if (usedRecipe.has(r) || r.prim !== b.kind) continue; const d = len(sub(r.p, b.c)); if (d < bd) { bd = d; best = r; } }
    if (!best) continue;
    const cmp = compare(b, best), byRecipe = design && cmp.aligned;
    usedRecipe.add(best); b.recipe = best;
    b.issues.push({ level: 'boojum', msg: `recipe step ${best.id} and the cards disagree: ${cmp.diffs.join('; ')} — ` +
      (byRecipe ? 'the recipe is followed (source=design)' : !cmp.aligned ? 'the cards are followed (Snark_00 cannot follow a turned recipe yet)' : 'the cards are followed (source=scan)') });
    if (byRecipe) follow(b, best, cmp); else b.recipeDisagrees = true;
  }

  // 3. names in the body's frame, and edge rules
  for (const body of bodies) {
    if (body.kind === 'box') {
      const nm = {}, { n, patches } = body.card;
      patches.forEach((p, i) => { for (let m = 0; m < 3; m++) { const d = dot(n[i], body.F[m]); if (Math.abs(d) > 0.5) nm[faceId(m, d)] = p.name; } });
      body.names = nm;
    }
    if (body.kind === 'box' || body.kind === 'cyl') {
      const list = [];
      if (body.kind === 'box') {
        for (const key of ALL_KEYS) {
          const ax = +key[0], [i, j] = otherAxes(ax), si = key[1] === '+' ? 1 : -1, sj = key[2] === '+' ? 1 : -1;
          list.push([key, ruleFor(doc, body.names[faceId(i, si)], body.names[faceId(j, sj)])]);
        }
      } else for (const key of ['top', 'bottom']) list.push([key, ruleFor(doc, body.names[key], body.names.side)]);
      const on = list.filter(([, r]) => r.kind !== 'sharp' && r.kind !== 'bad');
      const kinds = [...new Set(on.map(([, r]) => ruleKey(r)))];
      if (kinds.length > 1) body.issues.push({ level: 'warn', msg: `edges with different rules (${kinds.join(', ')}): Snark_00 uses ${kinds[0]} for all of them` });
      body.edgeRule = on.length ? on.find(([, r]) => ruleKey(r) === kinds[0])[1] : { kind: 'sharp' };
      body.edgeKeys = on.filter(([, r]) => ruleKey(r) === kinds[0]).map(([k]) => k);
      if (on.length) {
        body.edgePath = edgePath(body.edgeRule, doc.profiles);
        if (!body.edgePath) { body.issues.push({ level: 'error', msg: 'edge profile missing' }); body.edgeKeys = []; }
        else {
          const msgs = checkEdgePath(body.edgePath);
          for (const m of msgs) body.issues.push({ level: 'warn', msg: m });
          const t = body.edgePath.start[0], lim = body.kind === 'box' ? Math.min(...body.size) / 2 : Math.min(body.size[0] / 2, body.size[1] / 2);
          if (t > lim + 1e-9) { body.issues.push({ level: 'warn', msg: `edge setback ${fmt(t)} is larger than the body allows (${fmt(lim)}): edges left sharp` }); body.edgeKeys = []; }
        }
      }
    }
  }
  for (const r of solids) if (!usedRecipe.has(r) && !doc.recipe.some(x => x.of === r.id))
    issues.push({ level: 'boojum', msg: `recipe step ${r.id} (${r.prim} ${r.prim === 'box' ? sizeText([r.dims.x, r.dims.y, r.dims.z]) : r.prim === 'cyl' ? 'd' + fmt(r.dims.d) + ' x ' + fmt(r.dims.h) : 'd' + fmt(r.dims.d)}): no body recognised in the mesh matches it` });
  return { bodies, issues };
}

/* SnarkDoc → bench state: recognised bodies become editable objects, the rest is kept. */
export function docToState(doc) {
  const { bodies, issues } = recognise(doc), objects = [], foreign = { bodies: [], profiles: [], edges: [], recipe: [] };
  let id = 1; const consumedPatches = new Set(), consumedProfiles = new Set();
  for (const b of bodies) {
    if (b.kind === 'mesh') {
      const vmap = new Map(), pos = [], patches = new Map();
      for (const fi of b.faces) {
        const f = doc.faces[fi];
        if (!patches.has(f.patch)) { const p = doc.patches.get(f.patch); patches.set(f.patch, { name: p.name, card: p.card, note: p.note, faces: [] }); }
        patches.get(f.patch).faces.push(f.v.map(k => { if (!vmap.has(k)) { vmap.set(k, pos.length / 3); pos.push(...vtx(doc, k)); } return vmap.get(k); }));
      }
      foreign.bodies.push({ pos, patches: [...patches.values()], issues: b.issues });
      // a header default edge rule applies to this body's seams: write it out explicitly
      if (doc.header.edge.kind !== 'sharp') for (const [a, c] of patchAdjacency(doc, b.faces))
        if (!doc.edges.some(e => (e.a === a && e.b === c) || (e.a === c && e.b === a))) foreign.edges.push({ a, b: c, rule: doc.header.edge, note: '' });
      continue;
    }
    for (const n of b.names ? Object.values(b.names) : []) consumedPatches.add(n);
    const rule = b.edgeRule || { kind: 'sharp' }, path = b.edgePath, keys = b.edgeKeys || [];
    let edge = { rule: 'sharp', t: 2, k: 0.55, keys: [] };
    if (keys.length && path) {
      const t = path.start[0];
      if (rule.kind === 'round') edge = { rule: 'round', t, k: 0.55, keys };
      else if (rule.kind === 'chamfer') edge = { rule: 'chamfer', t, k: 0.55, keys };
      else { const k = splineK(path); edge = k !== null ? { rule: 'spline', t, k, keys } : { rule: 'custom', t, k: 0.55, keys, path }; if (rule.kind === 'profile') consumedProfiles.add(rule.id); }
    }
    const firstNote = doc.patches.get(Object.values(b.names)[0])?.note || '';
    const isAuto = /^body /.test(firstNote);
    const q = b.recipe && !b.recipeDisagrees ? b.recipe.q.slice() : Rot.quatFromFrame(b.F);
    objects.push({ id: id++, kind: b.kind, name: b.recipe?.name || '', size: b.size.slice(), p: b.c.slice(), q, rot: Rot.eulerFromFrame(Rot.frameFromQuat(q)),
      edge, names: { ...b.names }, note: isAuto ? '' : firstNote, issues: b.issues });
  }
  for (const e of doc.edges) if (!consumedPatches.has(e.a) && !consumedPatches.has(e.b)) foreign.edges.push(e);
  for (const pr of doc.profiles.values()) if (!consumedProfiles.has(pr.id)) foreign.profiles.push(pr);
  const objRecipes = new Set(); for (const b of bodies) if (b.recipe) objRecipes.add(b.recipe);
  for (const r of doc.recipe) if (!objRecipes.has(r)) foreign.recipe.push(r);
  for (const k of ['seams', 'curves', 'features', 'patterns', 'creases', 'levels', 'unknown']) foreign[k] = [...doc[k]];
  const H = doc.header;
  return {
    header: { tol: H.tol, detail: H.detail, source: H.source, blend: H.blend, extra: { ...H.extra } },
    meta: { ...doc.meta }, preamble: [...doc.preamble], objects, foreign, issues: [...doc.issues, ...issues, ...bodies.flatMap(b => b.issues)],
  };
}

/* ═══════════════════ 7. bodies → surfaces (evaluation) ═══════════════════ */
/* A piece is one smooth part of a surface: positions, exact normals, triangles,
   and what it is (role) so a writer can give it a card. */
function newPiece(role, type) { return { role, type, pos: [], nrm: [], idx: [] }; }
function gridPiece(piece, rows, cols, P, N) {
  const base = piece.pos.length / 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = P(r, c), n = unit(N(r, c)); piece.pos.push(p[0], p[1], p[2]); piece.nrm.push(n[0], n[1], n[2]);
  }
  const at = (r, c) => base + r * cols + c;
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
    tri(piece, at(r, c), at(r, c + 1), at(r + 1, c + 1)); tri(piece, at(r, c), at(r + 1, c + 1), at(r + 1, c));
  }
}
function tri(piece, a, b, c) {
  const p = i => [piece.pos[3 * i], piece.pos[3 * i + 1], piece.pos[3 * i + 2]];
  const A = p(a), nn = cross(sub(p(b), A), sub(p(c), A)), area = len(nn);
  if (area < 1e-14) return;
  const nv = add(add([piece.nrm[3 * a], piece.nrm[3 * a + 1], piece.nrm[3 * a + 2]], [piece.nrm[3 * b], piece.nrm[3 * b + 1], piece.nrm[3 * b + 2]]), [piece.nrm[3 * c], piece.nrm[3 * c + 1], piece.nrm[3 * c + 2]]);
  if (dot(nn, nv) >= 0) piece.idx.push(a, b, c); else piece.idx.push(a, c, b);
}
/* chord = the largest distance between a triangle and the exact surface. Where a surface bends in two
   directions (corners, rims, spheres) the two bends add up, so each direction gets half of it. */
const angularSegments = (r, chord) => Math.max(8, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - chord / Math.max(r, 1e-9)))));

export function evalBox(b, chord) {
  const pieces = [], { c, F, size } = b, H = size.map(x => x / 2);
  const keys = new Set(b.edgeKeys || []);
  const t = keys.size && b.edgePath ? b.edgePath.start[0] : 0;
  const L = t > 0 ? quadRuns(b.edgePath, chord / 2) : null;   // shared by bars and corners, so seams match
  const W = (q, s) => { let p = c.slice(); for (let m = 0; m < 3; m++) p = add(p, mul(F[m], s[m] * ((H[m] - t) + t * q[m]))); return p; };
  const WN = (n, s) => { let v = [0, 0, 0]; for (let m = 0; m < 3; m++) v = add(v, mul(F[m], s[m] * n[m])); return v; };
  const eps = 1e-12;
  // face centres
  for (let m = 0; m < 3; m++) for (const s of [-1, 1]) {
    const [i, j] = otherAxes(m);
    if (H[i] - t < eps || H[j] - t < eps) continue;
    const pc = newPiece({ kind: 'face', m, s }, 'plane');
    const corner = (si, sj) => { const q = [0, 0, 0], ss = [1, 1, 1]; q[m] = 1; ss[m] = s; ss[i] = si; ss[j] = sj; return W(q, ss); };
    gridPiece(pc, 2, 2, (r, k) => corner(k ? 1 : -1, r ? 1 : -1), () => mul(F[m], s));
    pieces.push(pc);
  }
  if (t <= 0) return pieces;
  // edge bars: the profile (or the sharp square) pulled along the edge
  for (let ax = 0; ax < 3; ax++) {
    const [i, j] = otherAxes(ax);
    if (H[ax] - t < eps) continue;
    for (const si of [-1, 1]) for (const sj of [-1, 1]) {
      const key = edgeKey(ax, si, sj), runs = keys.has(key) ? L : SQUARE;
      for (const R of runs) {
        const role = R.tag === 'curve' ? { kind: 'edge', key } : { kind: 'face', m: R.tag === 'sq1' ? i : j, s: R.tag === 'sq1' ? si : sj };
        const pc = newPiece(role, R.tag === 'curve' ? 'edge' : 'plane');
        gridPiece(pc, 2, R.a.length, (r, k) => {
          const q = [0, 0, 0], s = [1, 1, 1]; q[i] = R.a[k]; q[j] = R.b[k]; s[i] = si; s[j] = sj; s[ax] = r ? 1 : -1; q[ax] = 0;
          return W(q, s);
        }, (r, k) => { const n = [0, 0, 0], s = [1, 1, 1]; n[i] = R.tb[k]; n[j] = -R.ta[k]; s[i] = si; s[j] = sj; return WN(n, s); });
        pieces.push(pc);
      }
    }
  }
  // corners: the product of the profiles meeting there
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const s = [sx, sy, sz], f = [keys.has(edgeKey(0, sy, sz)), keys.has(edgeKey(1, sx, sz)), keys.has(edgeKey(2, sx, sy))];
    const a3 = f[0] === f[1] ? 2 : f[0] === f[2] ? 1 : 0, [a1, a2] = otherAxes(a3);
    const RA = f[a3] ? L : SQUARE, RB = f[a1] ? L : SQUARE;
    for (const A of RA) for (const B of RB) {
      let role, type;
      if (A.tag === 'curve' && B.tag === 'curve') { role = { kind: 'corner', s }; type = 'corner'; }
      else if (A.tag === 'curve') { role = B.tag === 'sq1' ? { kind: 'edge', key: edgeKey(a3, s[a1], s[a2]) } : { kind: 'face', m: a3, s: s[a3] }; type = B.tag === 'sq1' ? 'edge' : 'plane'; }
      else if (B.tag === 'curve') { role = A.tag === 'sq1' ? { kind: 'edge', key: edgeKey(a2, s[a1], s[a3]) } : { kind: 'edge', key: edgeKey(a1, s[a2], s[a3]) }; type = 'edge'; }
      else { role = B.tag === 'sq2' ? { kind: 'face', m: a3, s: s[a3] } : A.tag === 'sq1' ? { kind: 'face', m: a1, s: s[a1] } : { kind: 'face', m: a2, s: s[a2] }; type = 'plane'; }
      const pc = newPiece(role, type);
      gridPiece(pc, B.a.length, A.a.length, (w, u) => {
        const q = [0, 0, 0]; q[a1] = A.a[u] * B.a[w]; q[a2] = A.b[u] * B.a[w]; q[a3] = B.b[w]; return W(q, s);
      }, (w, u) => {
        const n = [0, 0, 0];
        n[a1] = B.tb[w] * A.tb[u]; n[a2] = -B.tb[w] * A.ta[u]; n[a3] = -B.ta[w] * (A.a[u] * A.tb[u] - A.b[u] * A.ta[u]);
        if (Math.hypot(...n) < 1e-12) { n[a3] = 1; }
        return WN(n, s);
      });
      pieces.push(pc);
    }
  }
  return pieces;
}

export function evalCyl(b, chord) {
  const pieces = [], { c, F, size } = b, r = size[0] / 2, hh = size[1] / 2;
  const keys = new Set(b.edgeKeys || []), t = keys.size && b.edgePath ? b.edgePath.start[0] : 0;
  const L = t > 0 ? quadRuns(b.edgePath, chord / 2) : null, n = angularSegments(r, t > 0 ? chord / 2 : chord);
  const rad = k => { const a = 2 * Math.PI * k / n; return add(mul(F[0], Math.cos(a)), mul(F[1], Math.sin(a))); };
  for (const s of [1, -1]) {
    const key = s > 0 ? 'top' : 'bottom';
    if (r - t > 1e-12) {
      const pc = newPiece({ kind: 'cap', key }, 'plane'), z = mul(F[2], s * hh), base = pc.pos.length / 3, cn = add(c, z);
      pc.pos.push(...cn); pc.nrm.push(...mul(F[2], s));
      for (let k = 0; k <= n; k++) { const p = add(cn, mul(rad(k), r - t)); pc.pos.push(...p); pc.nrm.push(...mul(F[2], s)); }
      for (let k = 0; k < n; k++) tri(pc, base, base + 1 + k, base + 2 + k);
      pieces.push(pc);
    }
    if (t > 0) for (const R of keys.has(key) ? L : SQUARE) {
      const role = R.tag === 'curve' ? { kind: 'rim', key } : R.tag === 'sq1' ? { kind: 'cap', key } : { kind: 'side' };
      const pc = newPiece(role, R.tag === 'curve' ? 'edge' : R.tag === 'sq1' ? 'plane' : 'side');
      gridPiece(pc, R.a.length, n + 1, (i, k) => add(add(c, mul(F[2], s * ((hh - t) + t * R.a[i]))), mul(rad(k), (r - t) + t * R.b[i])),
        (i, k) => add(mul(F[2], s * R.tb[i]), mul(rad(k), -R.ta[i])));
      pieces.push(pc);
    }
  }
  if (hh - t > 1e-12) {
    const pc = newPiece({ kind: 'side' }, 'side');
    gridPiece(pc, 2, n + 1, (i, k) => add(add(c, mul(F[2], i ? hh - t : -(hh - t))), mul(rad(k), r)), (i, k) => rad(k));
    pieces.push(pc);
  }
  return pieces;
}

export function evalSph(b, chord) {
  const r = b.size[0] / 2, nLon = angularSegments(r, chord / 2), nLat = Math.max(4, Math.ceil(nLon / 2));
  const pc = newPiece({ kind: 'surface' }, 'sphere'), [ex, ey, ez] = b.F;
  gridPiece(pc, nLat + 1, nLon + 1, (i, j) => {
    const th = Math.PI * i / nLat, ph = 2 * Math.PI * j / nLon;
    return add(b.c, add(add(mul(ex, r * Math.sin(th) * Math.cos(ph)), mul(ey, r * Math.sin(th) * Math.sin(ph))), mul(ez, r * Math.cos(th))));
  }, (i, j) => {
    const th = Math.PI * i / nLat, ph = 2 * Math.PI * j / nLon;
    return add(add(mul(ex, Math.sin(th) * Math.cos(ph)), mul(ey, Math.sin(th) * Math.sin(ph))), mul(ez, Math.cos(th)));
  });
  return [pc];
}

export function evalStored(doc, b) {
  const byPatch = new Map();
  for (const fi of b.faces) {
    const f = doc.faces[fi];
    if (!byPatch.has(f.patch)) byPatch.set(f.patch, newPiece({ kind: 'stored', patch: f.patch }, 'stored'));
    const pc = byPatch.get(f.patch), P = f.v.map(k => vtx(doc, k));
    for (let i = 1; i + 1 < P.length; i++) {
      const nn = unit(cross(sub(P[i], P[0]), sub(P[i + 1], P[0]))), base = pc.pos.length / 3;
      for (const q of [P[0], P[i], P[i + 1]]) { pc.pos.push(...q); pc.nrm.push(...nn); }
      pc.idx.push(base, base + 1, base + 2);
    }
  }
  return [...byPatch.values()];
}

export function evaluate(doc, chord, rec = recognise(doc)) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const out = [];
  for (const b of rec.bodies) {
    let pieces, issues = [...b.issues];
    try {
      pieces = b.kind === 'box' ? evalBox(b, chord) : b.kind === 'cyl' ? evalCyl(b, chord) : b.kind === 'sph' ? evalSph(b, chord) : evalStored(doc, b);
    } catch (e) { issues.push({ level: 'error', msg: 'evaluation failed: ' + e.message }); pieces = evalStored(doc, b); }
    out.push({ body: b, pieces, issues, tris: pieces.reduce((s, p) => s + p.idx.length / 3, 0) });
  }
  return { bodies: out, ms: (typeof performance !== 'undefined' ? performance : Date).now() - t0, issues: rec.issues };
}

/* Join pieces into one indexed mesh (shared vertices where positions coincide). */
export function weld(pieces, q = 1e-6) {
  const map = new Map(), pos = [], idx = [];
  for (const pc of pieces) {
    const loc = [];
    for (let i = 0; i < pc.pos.length; i += 3) {
      const k = Math.round(pc.pos[i] / q) + ',' + Math.round(pc.pos[i + 1] / q) + ',' + Math.round(pc.pos[i + 2] / q);
      let v = map.get(k); if (v === undefined) { v = pos.length / 3; map.set(k, v); pos.push(pc.pos[i], pc.pos[i + 1], pc.pos[i + 2]); }
      loc.push(v);
    }
    for (let i = 0; i < pc.idx.length; i += 3) {
      const a = loc[pc.idx[i]], b = loc[pc.idx[i + 1]], c = loc[pc.idx[i + 2]];
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    }
  }
  return { pos, idx };
}
export function meshStats(m) {
  const de = new Map(); let vol = 0;
  for (let i = 0; i < m.idx.length; i += 3) {
    const t = [m.idx[i], m.idx[i + 1], m.idx[i + 2]];
    for (let e = 0; e < 3; e++) { const k = t[e] + ',' + t[(e + 1) % 3]; de.set(k, (de.get(k) || 0) + 1); }
    const P = t.map(j => [m.pos[3 * j], m.pos[3 * j + 1], m.pos[3 * j + 2]]);
    vol += dot(P[0], cross(P[1], P[2])) / 6;
  }
  let open = 0, dup = 0;
  for (const [k, n] of de) { const [a, b] = k.split(','); const r = de.get(b + ',' + a) || 0; if (r !== n) open++; if (n > 1) dup++; }
  return { verts: m.pos.length / 3, tris: m.idx.length / 3, open, dup, volume: vol };
}

/* ═══════════════════ 8. a final-mesh file for other programs ═══════════════════ */
export function buildFinalDoc(state, chord) {
  const base = buildDoc(state), ev = evaluate(base, chord), doc = newDoc(), H = doc.header;
  Object.assign(H, { tol: base.header.tol, detail: base.header.detail, chord, mesh: 'final', source: 'design', blend: base.header.blend, extra: { ...base.header.extra } });
  Object.assign(doc.meta, base.meta, { note: 'edge rules applied: final mesh for other programs' });
  doc.preamble = [...base.preamble];
  const notes = [];
  ev.bodies.forEach(({ body, pieces }, bi) => {
    const pre = 'b' + (bi + 1) + '_';
    const groups = new Map();
    const nameOf = role => {
      const N = body.names || {};
      if (role.kind === 'face') return N[faceId(role.m, role.s)];
      if (role.kind === 'edge') return pre + 'edge_' + 'xyz'[+role.key[0]] + '_' + role.key.slice(1).replace(/\+/g, 'p').replace(/-/g, 'n');
      if (role.kind === 'corner') return pre + 'corner_' + role.s.map(v => v > 0 ? 'p' : 'n').join('');
      if (role.kind === 'cap') return N[role.key];
      if (role.kind === 'rim') return pre + 'rim_' + role.key;
      if (role.kind === 'side') return N.side;
      if (role.kind === 'surface') return N.surface;
      return role.patch;
    };
    for (const pc of pieces) { const nm = nameOf(pc.role); if (!groups.has(nm)) groups.set(nm, { role: pc.role, pieces: [] }); groups.get(nm).pieces.push(pc); }
    const m = weld(pieces), vbase = doc.pos.length / 3;
    doc.pos.push(...m.pos);
    // card for each group
    const t = body.edgePath ? body.edgePath.start[0] : 0, rk = body.edgeRule ? body.edgeRule.kind : 'sharp';
    const map = new Map();
    for (let i = 0; i < m.pos.length; i += 3) map.set(Math.round(m.pos[i] / 1e-6) + ',' + Math.round(m.pos[i + 1] / 1e-6) + ',' + Math.round(m.pos[i + 2] / 1e-6), i / 3);
    for (const [nm, g] of groups) {
      let card = null;
      const role = g.role;
      if (body.kind === 'mesh') card = base.patches.get(role.patch)?.card || null;
      else if (role.kind === 'face') card = base.patches.get(nm)?.card || null;
      else if (role.kind === 'cap' || role.kind === 'side' || role.kind === 'surface') card = base.patches.get(nm)?.card || null;
      else if (body.kind === 'box' && role.kind === 'edge') {
        const ax = +role.key[0], [i, j] = otherAxes(ax), si = role.key[1] === '+' ? 1 : -1, sj = role.key[2] === '+' ? 1 : -1, Hh = body.size.map(x => x / 2);
        const inner = add(add(body.c, mul(body.F[i], si * (Hh[i] - t))), mul(body.F[j], sj * (Hh[j] - t)));
        if (rk === 'round') card = { type: 'cyl', o: inner, a: body.F[ax], d: 2 * t, side: 'out' };
        else if (rk === 'chamfer') card = { type: 'plane', o: add(inner, mul(body.F[i], si * t)), n: unit(add(mul(body.F[i], si), mul(body.F[j], sj))), u: body.F[ax] };
        else card = { type: 'free' };
      } else if (body.kind === 'box' && role.kind === 'corner') {
        const Hh = body.size.map(x => x / 2);
        let inner = body.c.slice(); for (let k = 0; k < 3; k++) inner = add(inner, mul(body.F[k], role.s[k] * (Hh[k] - t)));
        if (rk === 'round') card = { type: 'sph', c: inner, d: 2 * t, side: 'out' };
        else if (rk === 'chamfer') { let nn = [0, 0, 0]; for (let k = 0; k < 3; k++) nn = add(nn, mul(body.F[k], role.s[k])); card = { type: 'plane', o: add(inner, mul(body.F[0], role.s[0] * t)), n: unit(nn), u: unit(sub(mul(body.F[1], role.s[1]), mul(body.F[0], role.s[0]))) }; }
        else card = { type: 'free' };
      } else if (body.kind === 'cyl' && role.kind === 'rim') {
        const s = role.key === 'top' ? 1 : -1, r = body.size[0] / 2, hh = body.size[1] / 2;
        if (rk === 'round') card = { type: 'torus', c: add(body.c, mul(body.F[2], s * (hh - t))), a: body.F[2], R: r - t, r: t, side: 'out' };
        else if (rk === 'chamfer') card = { type: 'cone', o: add(body.c, mul(body.F[2], s * hh)), a: mul(body.F[2], -s), d: 2 * (r - t), angle: 90, side: 'out' };
        else card = { type: 'free' };
      }
      const p = { name: nm, card, faces: [], note: '' };
      if (doc.patches.has(nm)) { let k = 2; while (doc.patches.has(nm + '_' + k)) k++; p.name = nm + '_' + k; }
      doc.patches.set(p.name, p);
      for (const pc of g.pieces) {
        const loc = []; for (let i = 0; i < pc.pos.length; i += 3) loc.push(vbase + map.get(Math.round(pc.pos[i] / 1e-6) + ',' + Math.round(pc.pos[i + 1] / 1e-6) + ',' + Math.round(pc.pos[i + 2] / 1e-6)));
        for (let i = 0; i < pc.idx.length; i += 3) {
          const v = [loc[pc.idx[i]], loc[pc.idx[i + 1]], loc[pc.idx[i + 2]]];
          if (v[0] !== v[1] && v[1] !== v[2] && v[0] !== v[2]) { doc.faces.push({ v, patch: p.name }); p.faces.push(doc.faces.length - 1); }
        }
      }
    }
  });
  doc.recipe = base.recipe;
  for (const k of ['seams', 'curves', 'creases', 'levels', 'unknown']) doc[k] = [...base[k]];
  if (base.features.length || base.patterns.length) notes.push(`${base.features.length} features and ${base.patterns.length} patterns are not evaluated by Snark_00 and were left out`);
  H.uses = ['L1'].concat(doc.recipe.length ? ['L4'] : []);
  doc.issues.push(...notes.map(msg => ({ level: 'warn', msg })));
  return doc;
}

/* binary STL of the evaluated surfaces */
export function stlBytes(meshes) {
  let n = 0; for (const m of meshes) n += m.idx.length / 3;
  const buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf), head = 'Snark_00 binary STL, mm, Z up';
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, n, true); let o = 84;
  for (const m of meshes) for (let i = 0; i < m.idx.length; i += 3) {
    const P = [0, 1, 2].map(e => { const j = m.idx[i + e]; return [m.pos[3 * j], m.pos[3 * j + 1], m.pos[3 * j + 2]]; });
    const nn = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    for (const v of [nn, ...P]) { dv.setFloat32(o, v[0], true); dv.setFloat32(o + 4, v[1], true); dv.setFloat32(o + 8, v[2], true); o += 12; }
    o += 2;
  }
  return new Uint8Array(buf);
}
