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
  cone: [['o', 3], ['a', 3], ['d', 1], ['angle', 1], ['side', 's']], sph: [['c', 3], ['d', 1], ['a', '3?'], ['u', '3?'], ['side', 's']],
  torus: [['c', 3], ['a', 3], ['R', 1], ['r', 1], ['side', 's']], cage: [], free: [],
};
function parseCard(type, kv, issues, line) {
  const keys = CARD_KEYS[type];
  if (!keys) { issues.push({ level: 'warn', line, msg: `unknown card type "${type}"` }); return { type, raw: kv }; }
  const card = { type };
  for (const [k, n] of keys) {
    if (n === 's') { card[k] = kv[k] === 'in' ? 'in' : 'out'; continue; }
    if (n === '3?') { if (kv[k] !== undefined) card[k] = numVec(kv[k], 3, issues, line, k); continue; }   // optional
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
  const usedProfileIds = new Set((F.profiles || []).map(p => p.id)), usedFeatureIds = new Set();
  for (const r of [...(F.features || []), ...(F.patterns || [])]) { const id = tokenize(r.raw.slice(2))[1]; if (id) usedFeatureIds.add(id); }
  const uniqF = base => { let id = base, k = 2; while (usedFeatureIds.has(id)) id = base + '_' + k++; usedFeatureIds.add(id); return id; };
  const benchFeatures = [], benchPatterns = [];
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
      const surf = addPatch(names.surface, (o.features || []).length ? { type: 'sph', c: c.slice(), d: 2 * r, a: Fm[2].slice(), u: Fm[0].slice(), side: 'out' } : { type: 'sph', c: c.slice(), d: 2 * r, side: 'out' }, note);
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
    // features: a profile, and a point feature — or a template and a pattern of it
    (o.features || []).forEach((f, k) => {
      const host = names[f.face];
      if (!host || (o.kind === 'sph' && f.pattern && f.pattern.lattice.type !== 'polar')) return;
      const fid = uniqF(f.fid || 'b' + o.id + '_f' + (k + 1)), pid = f.pid && !usedProfileIds.has(f.pid) ? (usedProfileIds.add(f.pid), f.pid) : uniq(fid + 'p');
      doc.profiles.set(pid, { id: pid, ...shapePath(f.shape), note: '' });
      const bl = f.blend ? ' blend=' + blendText(f.blend) : '';
      if (!f.pattern) { benchFeatures.push({ raw: `#@feature ${fid} point host=${host} at=${fmtV(f.at)} profile=${pid}${bl}`, note: '' }); return; }
      benchFeatures.push({ raw: `#@feature ${fid} point template profile=${pid}${bl}`, note: '' });
      const L = f.pattern.lattice, gid = uniqF(f.pattern.gid || fid + 'g');
      const lat = L.type === 'rect' ? `lattice=rect a=${fmtV(L.a)} b=${fmtV(L.b)} origin=${fmtV(f.at)}` : `lattice=polar c=${fmtV(f.at)} n=${L.n} rad=${fmt(L.rad)}${L.phase ? ' phase=' + fmt(L.phase) : ''}`;
      const reg = f.pattern.region && f.pattern.region.type === 'rect' ? 'region=rect:' + fmtV(f.pattern.region.box) : 'region=all';
      benchPatterns.push({ raw: `#@pattern ${gid} host=${host} feature=${fid} ${lat} ${reg}${f.pattern.blend ? ' blend=' + blendText(f.pattern.blend) : ''}`, note: '' });
    });
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
  for (const k of ['seams', 'curves', 'creases', 'levels', 'unknown']) doc[k] = [...(F[k] || [])];
  doc.features = [...benchFeatures, ...(F.features || [])]; doc.patterns = [...benchPatterns, ...(F.patterns || [])];
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
        let SF = null;
        if (sp.a && sp.u) { const a = unit(sp.a), u = unit(sub(sp.u, mul(a, dot(sp.u, a)))); if (len(u) > 0.5) SF = [u, cross(a, u), a]; }
        if (!offCards(dev)) Object.assign(body, { kind: 'sph', c: sp.c.slice(), F: SF ? SF.map(v => v.slice()) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]], size: [sp.d], names: { surface: patches[0].name }, card: { F: SF } });
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
    } else { rsize = [r.dims.d]; csize = b.size; if (b.card.F) aligned = RF.every((ax, k) => dot(ax, b.card.F[k]) > 1 - 1e-6); }
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
  // 4. features (L2): which point features and patterns sit on each body's plane faces
  const FX = readFeatures(doc), headerBlend = parseBlend(doc.header.blend) || { kind: 'mix', v: 1 };
  issues.push(...FX.issues);
  const hosted = new Set();
  for (const body of bodies) {
    if (body.kind !== 'box' && body.kind !== 'cyl' && body.kind !== 'sph') continue;
    body.hosts = {}; body.headerBlend = headerBlend.kind === 'bad' ? { kind: 'mix', v: 1 } : headerBlend;
    for (const [key, name] of Object.entries(body.names)) {
      if (key === 'side') continue;
      const pts = FX.points.filter(f => f.host === name), pats = FX.patterns.filter(q => q.host === name);
      if (!pts.length && !pats.length) continue;
      const card = doc.patches.get(name)?.card, sph = body.kind === 'sph';
      if (!card || card.type !== (sph ? 'sph' : 'plane')) { body.issues.push({ level: 'warn', msg: `features on ${name}: the face has no ${sph ? 'sph' : 'plane'} card — not drawn` }); continue; }
      const host = { name, key, m: body.kind === 'box' ? 'xyz'.indexOf(key[0]) : 2, frame: sph ? null : planeFrame(card), F: sph ? body.card.F || [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : null, points: [], patterns: [] };
      for (const f of pts) {
        const fp = featureProfile(doc.profiles.get(f.profile));
        for (const msg of fp.msgs || []) body.issues.push({ level: fp.path ? 'warn' : 'error', msg: `feature ${f.id} (profile ${f.profile}): ${msg}` });
        if (fp.path) host.points.push({ ...f, path: fp.path, R: fp.R });
      }
      for (const q of pats) {
        const tm = FX.templates.get(q.feature), fp = featureProfile(doc.profiles.get(tm.profile));
        for (const msg of fp.msgs || []) body.issues.push({ level: fp.path ? 'warn' : 'error', msg: `pattern ${q.id} (profile ${tm.profile}): ${msg}` });
        if (fp.path) host.patterns.push({ ...q, path: fp.path, R: fp.R, tblend: tm.blend });
      }
      body.hosts[name] = host; hosted.add(name);
    }
  }
  for (const f of [...FX.points, ...FX.patterns]) if (!hosted.has(f.host) && doc.patches.has(f.host))
    issues.push({ level: 'info', msg: `${f.lattice ? 'pattern' : 'feature'} ${f.id}: ${f.host} is not a face of a recognised box, cylinder or sphere — kept as written, not drawn` });
  for (const r of solids) if (!usedRecipe.has(r) && !doc.recipe.some(x => x.of === r.id))
    issues.push({ level: 'boojum', msg: `recipe step ${r.id} (${r.prim} ${r.prim === 'box' ? sizeText([r.dims.x, r.dims.y, r.dims.z]) : r.prim === 'cyl' ? 'd' + fmt(r.dims.d) + ' x ' + fmt(r.dims.h) : 'd' + fmt(r.dims.d)}): no body recognised in the mesh matches it` });
  return { bodies, issues };
}

/* SnarkDoc → bench state: recognised bodies become editable objects, the rest is kept. */
export function docToState(doc) {
  const { bodies, issues } = recognise(doc), objects = [], foreign = { bodies: [], profiles: [], edges: [], recipe: [] };
  let id = 1; const consumedPatches = new Set(), consumedProfiles = new Set();
  const FX = readFeatures(doc), takenF = new Set(), takenP = new Set(), profileUsers = new Map();
  for (const f of [...FX.points, ...FX.templates.values()]) profileUsers.set(f.profile, (profileUsers.get(f.profile) || 0) + 1);
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
    // its features: point features and patterns of them on its plane faces (or on its sphere)
    const features = [];
    for (const [hostName, host] of Object.entries(b.hosts || {})) {
      // on a sphere: lon,lat in the card's frame; the object keeps them in its own frame (normally the same one)
      const OF = Rot.frameFromQuat(q), same = !host.F || host.F.every((v, k) => dot(v, OF[k]) > 1 - 1e-12);
      const toObj = at => { if (same) return at.slice(); const d = inFrame(host.F, lonLatDir(at[0], at[1])); return dirLonLat([dot(d, OF[0]), dot(d, OF[1]), dot(d, OF[2])]).map(x => Math.round(x * 1e9) / 1e9); };
      const turn = at => { if (same) return 0; const n = inFrame(host.F, lonLatDir(at[0], at[1])), a = northAt(n, host.F), c2 = northAt(n, OF); return Math.atan2(dot(cross(a, c2), n), dot(a, c2)) / DEG; };
      for (const f of FX.points.filter(x => x.host === hostName)) {
        if (!doc.profiles.has(f.profile)) continue;
        features.push({ face: host.key, at: toObj(f.at), shape: shapeOf(doc.profiles.get(f.profile)), blend: f.blend, pattern: null, fid: f.id, pid: f.profile, _o: f.order });
        takenF.add(f.raw);
      }
      for (const pt of FX.patterns.filter(x => x.host === hostName)) {
        const tm = FX.templates.get(pt.feature);
        const lat = pt.lattice.type === 'rect' ? { type: 'rect', a: pt.lattice.a.slice(), b: pt.lattice.b.slice() } : { type: 'polar', n: pt.lattice.n, rad: pt.lattice.rad, phase: host.F ? Math.round((pt.lattice.phase - turn(pt.lattice.c)) * 1e9) / 1e9 : pt.lattice.phase };
        const at = pt.lattice.type === 'rect' ? pt.lattice.origin.slice() : host.F ? toObj(pt.lattice.c) : pt.lattice.c.slice();
        features.push({ face: host.key, at, shape: shapeOf(doc.profiles.get(tm.profile)), blend: tm.blend,
          pattern: { lattice: lat, region: pt.region.type === 'rect' ? { type: 'rect', box: pt.region.box.slice() } : { type: 'all' }, blend: pt.blend, gid: pt.id }, fid: tm.id, pid: tm.profile, _o: tm.order + pt.order * 1e-9 });
        takenP.add(pt.raw);
      }
    }
    features.sort((x, y) => x._o - y._o).forEach(f => delete f._o);   // in the order the file gives them
    objects.push({ id: id++, kind: b.kind, name: b.recipe?.name || '', size: b.size.slice(), p: b.c.slice(), q, rot: Rot.eulerFromFrame(Rot.frameFromQuat(q)),
      edge, names: { ...b.names }, note: isAuto ? '' : firstNote, issues: b.issues, features });
  }
  for (const e of doc.edges) if (!consumedPatches.has(e.a) && !consumedPatches.has(e.b)) foreign.edges.push(e);
  // a template is taken when every pattern that uses it was taken; a profile when every feature that uses it was
  for (const tm of FX.templates.values()) { const users = doc.patterns.filter(r => FX.patterns.some(q => q.raw === r && q.feature === tm.id)); if (users.length && users.every(r => takenP.has(r)) && !FX.unsupported.some(u => u.kind === 'pattern' && u.raw.raw.includes('feature=' + tm.id))) takenF.add(tm.raw); }
  for (const f of [...FX.points, ...FX.templates.values()]) if (takenF.has(f.raw)) profileUsers.set(f.profile, profileUsers.get(f.profile) - 1);
  for (const [pid, n] of profileUsers) if (n === 0) consumedProfiles.add(pid);
  for (const e of doc.edges) if (e.rule.kind === 'profile' && !consumedPatches.has(e.a) && !consumedPatches.has(e.b)) consumedProfiles.delete(e.rule.id);
  for (const pr of doc.profiles.values()) if (!consumedProfiles.has(pr.id)) foreign.profiles.push(pr);
  const objRecipes = new Set(); for (const b of bodies) if (b.recipe) objRecipes.add(b.recipe);
  for (const r of doc.recipe) if (!objRecipes.has(r)) foreign.recipe.push(r);
  for (const k of ['seams', 'curves', 'creases', 'levels', 'unknown']) foreign[k] = [...doc[k]];
  foreign.features = doc.features.filter(r => !takenF.has(r)); foreign.patterns = doc.patterns.filter(r => !takenP.has(r));
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


/* ═══════════════════ 7a. features on plane faces (L2: §7.2, §8, §9) ═══════════════════
   Point features, and patterns of them, on the flat part of a plane face: box faces and cylinder caps.
   - A feature alone is a ring grid around its centre: exact, walls included.
   - Features whose disks overlap are combined by the rules of §8 on one finer polar grid.
   - The flat part around them is triangulated with their outer rings as holes, so the face still meets
     its edges in the same four points and the surface stays closed. */

export function parseBlend(s) {
  if (s === undefined || s === null || s === '') return null;
  const m = /^(sum|mix|max|min)(?::(-?\d*\.?\d+(?:e-?\d+)?))?$/.exec(String(s).trim());
  if (!m) return { kind: 'bad', raw: String(s) };
  return { kind: m[1], v: m[2] !== undefined ? Number(m[2]) : m[1] === 'mix' ? 1 : 0 };
}
export const blendText = b => !b ? '' : b.kind === 'sum' ? 'sum' : b.kind === 'bad' ? b.raw : b.kind + ':' + fmt(b.v);

/* The #@feature and #@pattern lines are kept in the doc as written; this reads their meaning. */
export function readFeatures(doc) {
  const res = { points: [], templates: new Map(), patterns: [], unsupported: [], issues: [] }, I = res.issues;
  const kvOf = r => splitKV(tokenize(r.raw.slice(2)).slice(1));
  doc.features.forEach((r, order) => {
    const { pos, kv } = kvOf(r), id = pos[0], kind = pos[1];
    if (kind !== 'point') { res.unsupported.push({ id, kind, raw: r }); I.push({ level: 'info', msg: `feature ${id}: ${kind} features are kept as written, but not drawn yet` }); return; }
    const f = { id, template: pos.includes('template'), profile: kv.profile, blend: parseBlend(kv.blend), raw: r, order };
    if (f.blend && f.blend.kind === 'bad') { I.push({ level: 'error', msg: `feature ${id}: unknown blend "${f.blend.raw}"` }); f.blend = null; }
    if (!doc.profiles.has(f.profile)) { I.push({ level: 'error', msg: `feature ${id}: no profile "${f.profile}"` }); res.unsupported.push({ id, kind, raw: r }); return; }
    if (f.template) { res.templates.set(id, f); return; }
    f.host = kv.host; f.at = numVec(kv.at, 2, I, undefined, `feature ${id}: at`);
    if (!f.at) { res.unsupported.push({ id, kind, raw: r }); return; }
    if (!doc.patches.has(f.host)) I.push({ level: 'error', msg: `feature ${id}: no patch "${f.host}"` });
    res.points.push(f);
  });
  doc.patterns.forEach((r, order) => {
    const { pos, kv } = kvOf(r), p = { id: pos[0], host: kv.host, feature: kv.feature, blend: parseBlend(kv.blend), raw: r, order: 100000 + order * 10000 };
    const bad = msg => { I.push({ level: 'warn', msg: `pattern ${p.id}: ${msg} — kept as written, not drawn` }); res.unsupported.push({ id: p.id, kind: 'pattern', raw: r }); };
    if (kv.lattice === 'rect') {
      p.lattice = { type: 'rect', a: numVec(kv.a, 2, I, undefined, `pattern ${p.id}: a`), b: numVec(kv.b, 2, I, undefined, `pattern ${p.id}: b`), origin: kv.origin !== undefined ? numVec(kv.origin, 2, I, undefined, `pattern ${p.id}: origin`) : [0, 0] };
      if (!p.lattice.a || !p.lattice.b || !p.lattice.origin) return bad('the lattice needs a=, b= and origin=');
      if (Math.abs(p.lattice.a[0] * p.lattice.b[1] - p.lattice.a[1] * p.lattice.b[0]) < 1e-9) return bad('a and b are parallel');
    } else if (kv.lattice === 'polar') {
      p.lattice = { type: 'polar', c: numVec(kv.c, 2, I, undefined, `pattern ${p.id}: c`), n: Math.round(Number(kv.n)), rad: Number(kv.rad), phase: kv.phase !== undefined ? Number(kv.phase) : 0 };
      if (!p.lattice.c || !(p.lattice.n >= 1) || !(p.lattice.rad >= 0) || !Number.isFinite(p.lattice.phase)) return bad('the lattice needs c=, n= and rad=');
    } else return bad(`lattice "${kv.lattice}" is not known`);
    if (kv.region === undefined || kv.region === 'all') p.region = { type: 'all' };
    else if (/^rect:/.test(kv.region)) { const b = numVec(kv.region.slice(5), 4, I, undefined, `pattern ${p.id}: region`); if (!b) return bad('bad region'); p.region = { type: 'rect', box: b }; }
    else return bad(`region "${kv.region}" is not supported by this reader`);
    if (kv.fade !== undefined) return bad('fade= is not supported by this reader');
    if (kv.grow !== undefined) return bad('grow= is not supported by this reader');
    if (p.blend && p.blend.kind === 'bad') { I.push({ level: 'error', msg: `pattern ${p.id}: unknown blend "${p.blend.raw}"` }); p.blend = null; }
    if (!res.templates.has(p.feature)) return bad(`no template feature "${p.feature}"`);
    if (!doc.patches.has(p.host)) I.push({ level: 'error', msg: `pattern ${p.id}: no patch "${p.host}"` });
    res.patterns.push(p);
  });
  return res;
}

/* A profile made ready for a point feature: it starts at the centre and ends on the host. */
export function featureProfile(path) {
  const msgs = [];
  if (!path || !path.segs || !path.segs.length) return { msgs: ['empty profile'] };
  const p = { start: path.start.slice(), segs: path.segs.map(s => ({ ...s })) };
  if (p.start[0] < -1e-9) return { msgs: ['a point-feature profile starts at the centre or outside it (r ≥ 0)'] };
  if (p.start[0] > 1e-9) { p.segs.unshift({ t: 'L', p: p.start.slice() }); p.start = [0, p.start[1]]; }
  let runs;
  try { runs = samplePath(p, Math.max(1e-4, Math.abs(p.segs[p.segs.length - 1].p[0]) / 400)); } catch (e) { return { msgs: [e.message] }; }
  let last = -Infinity;
  for (const run of runs) for (const q of run.pts) { if (q[0] < last - 1e-7) return { msgs: ['the distance from the centre goes back along the profile (an undercut): not allowed in 0.1'] }; last = Math.max(last, q[0]); }
  const end = p.segs[p.segs.length - 1].p, R = end[0];
  if (!(R > 1e-9)) return { msgs: ['the profile must reach out from the centre (last r > 0)'] };
  if (Math.abs(end[1]) > 1e-9 * Math.max(1, R)) { msgs.push(`the profile ends at height ${fmt(end[1])}, not on the host: a wall down to it is added`); p.segs.push({ t: 'L', p: [R, 0] }); }
  else {
    const lr = runs[runs.length - 1], tg = lr.tan[lr.tan.length - 1];
    if (Math.abs(tg[1]) > 1e-6) msgs.push('the profile does not end level with the host: there will be a crease at its foot');
  }
  return { path: p, R, msgs };
}

/* height of a profile at distance r, from a fine table (used where features are combined) */
function profileTable(path, R) {
  const runs = samplePath(path, Math.max(R / 3000, 1e-5)), rs = [], hs = [];
  for (const run of runs) for (const q of run.pts) { rs.push(q[0]); hs.push(q[1]); }
  return { rs, hs, R };
}
function tableAt(T, r) {
  if (r >= T.R) return 0;
  const rs = T.rs; if (r <= rs[0]) return T.hs[0];
  let lo = 0, hi = rs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rs[m] <= r) lo = m; else hi = m; }
  const d = rs[hi] - rs[lo];
  return d > 1e-15 ? T.hs[lo] + (T.hs[hi] - T.hs[lo]) * (r - rs[lo]) / d : T.hs[hi];
}
export const phi = (s, t) => { t = Math.min(1, Math.max(0, t)); return (1 - s) * t + s * (6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3); };

/* the combined height of several features at (u, v): §8.2, and §8.3 for more than two.
   max and min: k′ of §8.2 is multiplied by s/(s + k/4), s = |h₁| + |h₂|. Without that factor the rounding
   stays k/4 high at the two points where the borders of two features cross (both weights go to zero
   together, so their ratio does not fade), and the surface jumps there by k/4. With it, the rounding fades
   with the heights; where both features are taller than k it is the k′ of §8.2. (Proposed for §8.2.)
   A negative height scale (the animation turning bosses into dimples) mirrors max and min. */
export function blendHeight(members, u, v, scale) {
  const hs = [], ws = [];
  for (const m of members) {
    const r = Math.hypot(u - m.c[0], v - m.c[1]);
    if (r >= m.R) { hs.push(0); ws.push(0); continue; }
    if (!m.table) m.table = profileTable(m.path, m.R);
    hs.push(tableAt(m.table, r) * scale); ws.push(1 - r / m.R);
  }
  return combineHeights(members.map(m => m.blend), hs, ws, members.length, scale);
}
/* blends[k], hs[k] (heights, already scaled) and ws[k] (inwardness t = 1 − r/R) of the members, in file order */
export function combineHeights(blends, hs, ws, n, scale) {
  if (!n) return 0;
  let allSum = true, allMix = true;
  for (let k = 0; k < n; k++) { if (blends[k].kind !== 'sum') allSum = false; if (!(blends[k].kind === 'mix' && blends[k].v === blends[0].v)) allMix = false; }
  if (allSum) { let h = 0; for (let k = 0; k < n; k++) h += hs[k]; return h; }
  if (allMix) {
    const s = blends[0].v; let sw = 0, swh = 0;
    for (let k = 0; k < n; k++) { const w = phi(s, ws[k]); sw += w; swh += w * hs[k]; }
    return sw > 0 ? swh / sw : 0;
  }
  let h = hs[0], w = phi(blends[0].kind === 'mix' ? blends[0].v : 1, ws[0]);
  for (let i = 1; i < n; i++) {
    const b = blends[i], hi = hs[i], wi = phi(b.kind === 'mix' ? b.v : 1, ws[i]);
    if (b.kind === 'sum') h += hi;
    else if (b.kind === 'mix') h = w + wi > 0 ? (w * h + wi * hi) / (w + wi) : 0;
    else {
      const sg = (b.kind === 'max') === (scale >= 0) ? 1 : -1, a = sg * h, c = sg * hi, sh = Math.abs(h) + Math.abs(hi);
      const kp = b.v * 4 * w * wi / ((w + wi) ** 2 || 1) * (sh + b.v / 4 > 0 ? sh / (sh + b.v / 4) : 0);
      h = sg * (Math.max(a, c) + (kp > 0 ? Math.max(0, kp - Math.abs(a - c)) ** 2 / (4 * kp) : 0));
    }
    w = Math.max(w, wi);
  }
  return h;
}

/* (u, v) of a plane card and back: (u, v, n) right-handed, v = n × u (§5.2) */
export function planeFrame(card) { const n = unit(card.n), U = unit(card.u), V = cross(n, U); return { o: card.o, U, V, n }; }
const hostPoint = (H, u, v, h) => add(add(add(H.o, mul(H.U, u)), mul(H.V, v)), mul(H.n, h));
const toUV = (H, p) => { const d = sub(p, H.o); return [dot(d, H.U), dot(d, H.V)]; };

/* where the copies of a pattern fall, before the region is applied */
function latticePoints(L, box) {
  if (L.type === 'polar') { const out = []; for (let k = 0; k < L.n; k++) { const a = (L.phase + 360 * k / L.n) * Math.PI / 180; out.push([L.c[0] + L.rad * Math.cos(a), L.c[1] + L.rad * Math.sin(a)]); } return out; }
  const [a, b, o] = [L.a, L.b, L.origin], det = a[0] * b[1] - a[1] * b[0], out = [];
  const ij = p => { const x = p[0] - o[0], y = p[1] - o[1]; return [(x * b[1] - y * b[0]) / det, (a[0] * y - a[1] * x) / det]; };
  const cs = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(ij);
  const i0 = Math.floor(Math.min(...cs.map(c => c[0]))) - 1, i1 = Math.ceil(Math.max(...cs.map(c => c[0]))) + 1;
  const j0 = Math.floor(Math.min(...cs.map(c => c[1]))) - 1, j1 = Math.ceil(Math.max(...cs.map(c => c[1]))) + 1;
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 200000) return null;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push([o[0] + i * a[0] + j * b[0], o[1] + i * a[1] + j * b[1]]);
  return out;
}
/* distance from p to the border of a convex polygon (positive inside) */
function insideDist(Q, p) {
  let s = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; s += a[0] * b[1] - b[0] * a[1]; }
  const sg = s >= 0 ? 1 : -1; let d = Infinity;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
    if (l < 1e-15) continue;
    d = Math.min(d, sg * (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) / l);
  }
  return d;
}

/* Every feature copy on one host that fits on its flat part Q (a convex polygon in (u, v)). */
export function placeFeatures(host, Q, issues, headerBlend, mode = 'flat') {
  const inst = [], eps = 1e-9, skin = mode === 'skin';
  const fits = (c, R) => skin ? insideDist(Q, c) >= -1e-9 : insideDist(Q, c) >= R + 1e-6;   // flat: a ring must not touch the border of the flat part
  for (const f of host.points) {
    if (fits(f.at, f.R)) inst.push({ id: f.id, src: f.id, c: f.at, R: f.R, path: f.path, blend: f.blend || headerBlend, order: f.order });
    else issues.push({ level: 'warn', msg: skin ? `feature ${f.id} on ${host.name}: its centre is outside the face — not drawn` : `feature ${f.id} on ${host.name}: it reaches beyond the flat part of the face — not drawn (a feature cannot run over an edge yet)` });
  }
  for (const p of host.patterns) {
    let us = Q.map(q => q[0]), vs = Q.map(q => q[1]), box = [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
    if (p.region.type === 'rect') { const r = p.region.box; box = [Math.max(box[0], Math.min(r[0], r[2])), Math.max(box[1], Math.min(r[1], r[3])), Math.min(box[2], Math.max(r[0], r[2])), Math.min(box[3], Math.max(r[1], r[3]))]; }
    const pts = latticePoints(p.lattice, box);
    if (!pts) { issues.push({ level: 'warn', msg: `pattern ${p.id}: too many copies — not drawn` }); continue; }
    const R = p.R; let k = 0;
    for (const c of pts) {
      const sq = [[c[0] - R, c[1] - R], [c[0] + R, c[1] - R], [c[0] + R, c[1] + R], [c[0] - R, c[1] + R]];
      if (p.region.type === 'rect') { const r = p.region.box; if (sq.some(q => q[0] < Math.min(r[0], r[2]) - eps || q[0] > Math.max(r[0], r[2]) + eps || q[1] < Math.min(r[1], r[3]) - eps || q[1] > Math.max(r[1], r[3]) + eps)) continue; }
      if (!sq.every(q => insideDist(Q, q) >= 1e-6)) continue;   // the whole collision square lies inside (§9)
      inst.push({ id: p.id + '.' + (++k), src: p.id, c, R, path: p.path, blend: p.blend || p.tblend || headerBlend, order: p.order + k });
      if (k > 5000) { issues.push({ level: 'warn', msg: `pattern ${p.id}: more than 5000 copies — the rest are not drawn` }); break; }
    }
    if (!k) issues.push({ level: 'info', msg: skin ? `pattern ${p.id}: no copy fits on ${host.name}` : `pattern ${p.id}: no copy fits on the flat part of ${host.name}` });
  }
  return inst.sort((a, b) => a.order - b.order);
}

/* Copies whose disks overlap are combined; each group gets one circle that holds it (a hole in the flat part). */
export function groupFeatures(inst) {
  let groups = inst.map(f => ({ members: [f], c: f.c, R: f.R }));
  const circle = ms => {
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const m of ms) { u0 = Math.min(u0, m.c[0] - m.R); v0 = Math.min(v0, m.c[1] - m.R); u1 = Math.max(u1, m.c[0] + m.R); v1 = Math.max(v1, m.c[1] + m.R); }
    const c = [(u0 + u1) / 2, (v0 + v1) / 2];
    return { c, R: Math.max(...ms.map(m => Math.hypot(m.c[0] - c[0], m.c[1] - c[1]) + m.R)) };
  };
  for (let guard = 0; guard < 1000; guard++) {
    let merged = false;
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const A = groups[i], B = groups[j];
      if (Math.hypot(A.c[0] - B.c[0], A.c[1] - B.c[1]) < A.R + B.R + 1e-6) {   // touching rings are joined too: holes must not touch
        const ms = [...A.members, ...B.members].sort((a, b) => a.order - b.order), cc = circle(ms);
        groups.splice(j, 1); groups[i] = { members: ms, c: cc.c, R: cc.R }; merged = true; break outer;
      }
    }
    if (!merged) break;
  }
  return groups;
}

/* Ear clipping of a polygon with holes, in (u, v). Holes are joined to the outline by bridges (Eberly). */
export function triangulateHoles(P, outer, holes) {
  const area = ids => { let a = 0; for (let i = 0; i < ids.length; i++) { const p = P[ids[i]], q = P[ids[(i + 1) % ids.length]]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  let poly = area(outer) < 0 ? outer.slice().reverse() : outer.slice();
  const hs = holes.map(h => area(h) > 0 ? h.slice().reverse() : h.slice()).filter(h => h.length >= 3);
  const maxU = h => Math.max(...h.map(i => P[i][0]));
  hs.sort((a, b) => maxU(b) - maxU(a));
  const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inTri = (p, a, b, c) => { const d1 = cross2(a, b, p), d2 = cross2(b, c, p), d3 = cross2(c, a, p), e = -1e-12; return d1 >= e && d2 >= e && d3 >= e; };
  const same2 = (a, b) => Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
  for (const h of hs) {
    let mi = 0; for (let i = 1; i < h.length; i++) if (P[h[i]][0] > P[h[mi]][0]) mi = i;
    const M = P[h[mi]];
    let best = Infinity, bi = -1;
    for (let i = 0; i < poly.length; i++) {
      const a = P[poly[i]], b = P[poly[(i + 1) % poly.length]];
      if ((a[1] > M[1]) === (b[1] > M[1])) continue;
      const x = a[0] + (M[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
      if (x >= M[0] - 1e-12 && x < best) { best = x; bi = i; }
    }
    if (bi < 0) throw new Error('a hole is not inside the outline');
    const I = [best, M[1]], j0 = bi, j1 = (bi + 1) % poly.length;
    let pi = P[poly[j0]][0] > P[poly[j1]][0] ? j0 : j1, onVertex = false;
    for (const j of [j0, j1]) if (Math.hypot(P[poly[j]][0] - I[0], P[poly[j]][1] - I[1]) < 1e-12) { pi = j; onVertex = true; }
    const Pc = P[poly[pi]];
    let bestAng = Infinity, cand = pi;
    for (let i = 0; i < poly.length && !onVertex; i++) {   // the ray ends on a vertex: that vertex is seen directly
      if (i === pi) continue;
      const q = P[poly[i]], pr = P[poly[(i - 1 + poly.length) % poly.length]], nx = P[poly[(i + 1) % poly.length]];
      if (cross2(pr, q, nx) > 0) continue;   // only reflex vertices can block the view
      if (!inTri(q, M, I, Pc) && !inTri(q, M, Pc, I)) continue;
      const ang = Math.abs(Math.atan2(q[1] - M[1], q[0] - M[0])), dist = Math.hypot(q[0] - M[0], q[1] - M[1]);
      if (ang < bestAng - 1e-12 || (Math.abs(ang - bestAng) <= 1e-12 && dist < Math.hypot(P[poly[cand]][0] - M[0], P[poly[cand]][1] - M[1]))) { bestAng = ang; cand = i; }
    }
    // a vertex may appear twice (an earlier bridge ends there): take the copy whose corner the bridge enters
    const pos = P[poly[cand]], dir = [M[0] - pos[0], M[1] - pos[1]];
    const inside = i => {
      const a = P[poly[i]], pr = P[poly[(i - 1 + poly.length) % poly.length]], nx = P[poly[(i + 1) % poly.length]];
      const toN = [nx[0] - a[0], nx[1] - a[1]], toP = [pr[0] - a[0], pr[1] - a[1]], cr = (x, y) => x[0] * y[1] - x[1] * y[0];
      return cross2(pr, a, nx) > 0 ? cr(toN, dir) > 0 && cr(dir, toP) > 0 : cr(toN, dir) > 0 || cr(dir, toP) > 0;
    };
    if (!inside(cand)) for (let i = 0; i < poly.length; i++) if (i !== cand && same2(P[poly[i]], pos) && inside(i)) { cand = i; break; }
    const merged = poly.slice(0, cand + 1);
    for (let k = 0; k <= h.length; k++) merged.push(h[(mi + k) % h.length]);
    merged.push(poly[cand]);
    for (let i = cand + 1; i < poly.length; i++) merged.push(poly[i]);
    poly = merged;
  }
  // ear clipping, with a grid of cells so an ear only checks the points near it
  const n = poly.length, prev = new Int32Array(n), next = new Int32Array(n), alive = new Uint8Array(n).fill(1), tris = [];
  for (let i = 0; i < n; i++) { prev[i] = (i - 1 + n) % n; next[i] = (i + 1) % n; }
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const id of poly) { u0 = Math.min(u0, P[id][0]); v0 = Math.min(v0, P[id][1]); u1 = Math.max(u1, P[id][0]); v1 = Math.max(v1, P[id][1]); }
  const G = Math.max(1, Math.ceil(Math.sqrt(n / 4))), cw = (u1 - u0) / G || 1, ch = (v1 - v0) / G || 1, cells = Array.from({ length: G * G }, () => []);
  const cellOf = (p, k) => Math.min(G - 1, Math.max(0, Math.floor((p[k] - (k ? v0 : u0)) / (k ? ch : cw))));
  for (let i = 0; i < n; i++) { const p = P[poly[i]]; cells[cellOf(p, 1) * G + cellOf(p, 0)].push(i); }
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
  const isEar = (ia, ib, ic, strict) => {
    const A = P[poly[ia]], B = P[poly[ib]], C = P[poly[ic]];
    if (cross2(A, B, C) <= 1e-14) return false;
    const gu0 = cellOf([Math.min(A[0], B[0], C[0]), 0], 0), gu1 = cellOf([Math.max(A[0], B[0], C[0]), 0], 0);
    const gv0 = cellOf([0, Math.min(A[1], B[1], C[1])], 1), gv1 = cellOf([0, Math.max(A[1], B[1], C[1])], 1);
    for (let gv = gv0; gv <= gv1; gv++) for (let gu = gu0; gu <= gu1; gu++) for (const j of cells[gv * G + gu]) {
      if (!alive[j] || j === ia || j === ib || j === ic) continue;
      const q = P[poly[j]];
      if (same(q, A) || same(q, B) || same(q, C)) continue;
      if (strict ? inTri(q, A, B, C) : (cross2(A, B, q) > 1e-12 && cross2(B, C, q) > 1e-12 && cross2(C, A, q) > 1e-12)) return false;
    }
    return true;
  };
  let count = n, i = 0, stall = 0, strict = true;
  while (count > 3) {
    if (isEar(prev[i], i, next[i], strict)) {
      tris.push([poly[prev[i]], poly[i], poly[next[i]]]);
      alive[i] = 0; next[prev[i]] = next[i]; prev[next[i]] = prev[i]; count--;
      i = prev[i]; stall = 0; continue;
    }
    i = next[i];
    if (++stall > count) { if (strict) { strict = false; stall = 0; continue; } throw new Error('the face around its features could not be triangulated'); }
  }
  const a = prev[i], c = next[i];
  if (cross2(P[poly[a]], P[poly[i]], P[poly[c]]) > 1e-14) tris.push([poly[a], poly[i], poly[c]]);
  const nP = P.length, fixed = new Set();
  for (const L of [outer, ...holes]) for (let k = 0; k < L.length; k++) { const x = L[k], y = L[(k + 1) % L.length]; fixed.add(x < y ? x * nP + y : y * nP + x); }
  return delaunayFlips(P, tris, fixed);
}
/* Lawson flips: the same region, triangulated so that no triangle is needlessly thin (Delaunay inside the fixed
   edges: the outline and the holes). Ear clipping fans out from far corners, and a sliver almost in line with
   one of its own edges can turn over when the graphics card snaps it to the pixel grid: it then shows as dark
   specks on a flat face (seen in the Snark_02 tests). */
function delaunayFlips(P, tris, fixed) {
  const nP = P.length, key = (a, b) => a < b ? a * nP + b : b * nP + a, T = tris.map(t => t.slice()), E = new Map();
  const link = (ti, on) => { const t = T[ti]; for (let e = 0; e < 3; e++) { const k = key(t[e], t[(e + 1) % 3]); let r = E.get(k); if (!r) E.set(k, r = []); if (on) r.push(ti); else { const j = r.indexOf(ti); if (j >= 0) r.splice(j, 1); } } };
  for (let i = 0; i < T.length; i++) link(i, true);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const ang = (o, a, b) => Math.atan2(Math.abs(cr(o, a, b)), (a[0] - o[0]) * (b[0] - o[0]) + (a[1] - o[1]) * (b[1] - o[1]));
  const stack = [...E.keys()].filter(k => !fixed.has(k));
  for (let guard = 50 * T.length + 1000; stack.length && guard > 0; guard--) {
    const k = stack.pop(), r = E.get(k);
    if (fixed.has(k) || !r || r.length !== 2) continue;
    const [t1, t2] = r, A = T[t1];
    let e1 = 0; while (key(A[e1], A[(e1 + 1) % 3]) !== k) e1++;
    const a = A[e1], b = A[(e1 + 1) % 3], c = A[(e1 + 2) % 3], d = T[t2].find(x => x !== a && x !== b);
    const pa = P[a], pb = P[b], pc = P[c], pd = P[d];
    if (cr(pc, pa, pd) <= 1e-14 || cr(pd, pb, pc) <= 1e-14) continue;          // the four points do not make a convex corner
    if (ang(pc, pa, pb) + ang(pd, pb, pa) <= Math.PI + 1e-9) continue;          // already Delaunay
    link(t1, false); link(t2, false); T[t1] = [c, a, d]; T[t2] = [d, b, c]; link(t1, true); link(t2, true);
    stack.push(key(a, d), key(d, b), key(b, c), key(c, a));
  }
  return T;
}

/* A plane face with features: the flat part with holes, plus one piece per feature or group of features.
   outer: the flat part's corners as exact world points (shared with the neighbouring pieces). */
function featuredFace(H, outer, host, chord, role, scale, issues, headerBlend, override) {   // → { pieces, inst }
  const Q = outer.map(p => toUV(H, p));
  const inst = override || placeFeatures(host, Q, issues, headerBlend);
  const groups = groupFeatures(inst), pieces = [], rings = [], told = new Set();
  for (const g of groups) {
    if (insideDist(Q, g.c) < g.R + 1e-6) {
      issues.push({ level: 'warn', msg: `features ${g.members.map(m => m.id).join(', ')} on ${host.name} overlap where the face ends: Snark_02 cannot combine them there — not drawn` });
      continue;
    }
    const fid = g.members.length === 1 ? g.members[0].id : g.members.map(m => m.id).join('+');
    const frole = { kind: 'feature', host: host.name, id: fid };
    const N = Math.max(16, angularSegments(g.R, chord / 2)), ang = k => 2 * Math.PI * (k % N) / N;
    const ring = { uv: [], pos: [] };
    for (let k = 0; k < N; k++) { const u = g.c[0] + g.R * Math.cos(ang(k)), v = g.c[1] + g.R * Math.sin(ang(k)); ring.uv.push([u, v]); ring.pos.push(hostPoint(H, u, v, 0)); }
    if (g.members.length === 1) {
      const m = g.members[0], runs = samplePath(m.path, chord / 2);
      runs.forEach((run, ri) => {
        const pc = newPiece({ ...frole, run: ri }, 'feature'), last = ri === runs.length - 1, nr = run.pts.length;
        gridPiece(pc, nr, N + 1, (i, k) => {
          if (last && i === nr - 1) return ring.pos[k % N];
          const r = run.pts[i][0];
          return hostPoint(H, g.c[0] + r * Math.cos(ang(k)), g.c[1] + r * Math.sin(ang(k)), run.pts[i][1] * scale);
        }, (i, k) => {
          const dr = run.tan[i][0], dh = run.tan[i][1] * scale, rho = add(mul(H.U, Math.cos(ang(k))), mul(H.V, Math.sin(ang(k))));
          const nn = add(mul(rho, -dh), mul(H.n, dr));
          return len(nn) > 1e-12 ? nn : H.n;   // a wall flattened to nothing (height scale 0)
        });
        pieces.push(pc);
      });
    } else {
      if (scale === 1) {
        for (const m of g.members.slice(1)) {
          if (m.blend.kind !== 'max' && m.blend.kind !== 'min') continue;
          const hs = samplePath(m.path, m.R / 200).flatMap(run => run.pts.map(q => q[1])), wrong = m.blend.kind === 'max' ? Math.min(...hs) < -1e-9 : Math.max(...hs) > 1e-9;
          if (wrong && !told.has(m.src)) { told.add(m.src); issues.push({ level: 'warn', msg: `feature ${m.src} on ${host.name}: blend ${m.blend.kind} is for ${m.blend.kind === 'max' ? 'raised features (h ≥ 0)' : 'pockets (h ≤ 0)'}, but this one goes ${m.blend.kind === 'max' ? 'down' : 'up'} (§8.2)` }); }
        }
      }
      const minR = Math.min(...g.members.map(m => m.R));
      const s = Math.min(1, Math.max(g.R / 150, minR / 16 * Math.sqrt(Math.max(chord, 1e-4) / 0.05)));
      const M = Math.max(2, Math.ceil(g.R / s)), Nk = Math.max(N, Math.min(2000, Math.ceil(2 * Math.PI * g.R / s)));
      const hgt = (u, v) => blendHeight(g.members, u, v, scale), d = s * 1e-3, pc = newPiece(frole, 'feature');
      const angk = k => 2 * Math.PI * (k % Nk) / Nk;
      // the outer ring of this grid must be the hole's ring: same count
      const ringK = { uv: [], pos: [] };
      for (let k = 0; k < Nk; k++) { const u = g.c[0] + g.R * Math.cos(angk(k)), v = g.c[1] + g.R * Math.sin(angk(k)); ringK.uv.push([u, v]); ringK.pos.push(hostPoint(H, u, v, 0)); }
      gridPiece(pc, M + 1, Nk + 1, (j, k) => {
        if (j === M) return ringK.pos[k % Nk];
        const r = g.R * j / M, u = g.c[0] + r * Math.cos(angk(k)), v = g.c[1] + r * Math.sin(angk(k));
        return hostPoint(H, u, v, hgt(u, v));
      }, (j, k) => {
        if (j === M) return H.n;
        const r = g.R * j / M, u = g.c[0] + r * Math.cos(angk(k)), v = g.c[1] + r * Math.sin(angk(k));
        const hu = (hgt(u + d, v) - hgt(u - d, v)) / (2 * d), hv = (hgt(u, v + d) - hgt(u, v - d)) / (2 * d);
        return sub(sub(H.n, mul(H.U, hu)), mul(H.V, hv));
      });
      pieces.push(pc);
      rings.push(ringK);
      continue;
    }
    rings.push(ring);
  }
  // the flat part with the rings as holes
  const P = [...Q], Wp = [...outer], holes = [];
  for (const r of rings) { const h = []; for (let k = 0; k < r.uv.length; k++) { h.push(P.length); P.push(r.uv[k]); Wp.push(r.pos[k]); } holes.push(h); }
  const flat = newPiece(role, 'plane');
  for (const p of Wp) { flat.pos.push(p[0], p[1], p[2]); flat.nrm.push(H.n[0], H.n[1], H.n[2]); }
  for (const t of triangulateHoles(P, Q.map((_, i) => i), holes)) tri(flat, t[0], t[1], t[2]);
  return { pieces: [flat, ...pieces], inst };
}
/* the largest setback that keeps the features on a box face or cap inside its flat part (for the animation) */
export function featureSetbackLimit(b) {
  let lim = Infinity;
  for (const host of Object.values(b.hosts || {})) for (const f of host.frozen || []) {
    const H = host.frame;
    if (b.kind === 'box') {
      const m = host.m, [i, j] = otherAxes(m), Hh = b.size.map(x => x / 2);
      for (const ax of [i, j]) {
        const pw = hostPoint(H, f.c[0], f.c[1], 0), x = dot(sub(pw, b.c), b.F[ax]);
        lim = Math.min(lim, Hh[ax] - Math.abs(x) - f.R);
      }
    } else if (b.kind === 'cyl') {
      const pw = hostPoint(H, f.c[0], f.c[1], 0), rel = sub(pw, b.c), radial = sub(rel, mul(b.F[2], dot(rel, b.F[2])));
      lim = Math.min(lim, b.size[0] / 2 - len(radial) - f.R);
    }
  }
  return lim;
}

/* Feature shapes of the editor: a few named profiles. The file always gets the profile itself, so any
   Snark reader can draw it; the names only help the editor to offer the right controls.
   dome:   a smooth bump (h > 0) or dimple (h < 0); k = fullness, small = pointed, large = flat top, steep side
   boss:   flat top, rounding k (mm) at the top and at the foot, wall between — a pocket when h < 0
   crater: the centre sunk, a rim at k·R, falling to the face at R */
export const FEATURE_SHAPES = ['dome', 'boss', 'crater'];
/* the shape exactly as it will be written (the third number kept inside what the shape allows) */
export function normShape(sh) {
  const o = { ...sh, R: Math.max(1e-3, Math.abs(sh.R)) };
  if (o.kind === 'dome') o.k = Math.min(0.95, Math.max(0.05, o.k));
  else if (o.kind === 'crater') o.k = Math.min(0.9, Math.max(0.1, o.k));
  else if (o.kind === 'boss') o.k = Math.max(0.05, Math.min(o.k, Math.abs(o.h) / 2, o.R / 2));
  return o;
}
export function shapePath(shIn) {
  const sh = shIn.kind === 'custom' ? shIn : normShape(shIn), R = sh.R, h = sh.h;
  if (sh.kind === 'dome') { const k = Math.min(0.95, Math.max(0.05, sh.k)); return { start: [0, h], segs: [{ t: 'C', c1: [k * R, h], c2: [(1 - k) * R, 0], p: [R, 0] }] }; }
  if (sh.kind === 'boss') {
    const H = Math.abs(h), sg = h >= 0 ? 1 : -1, rho = Math.max(0.05, Math.min(sh.k, H / 2, R / 2)), rw = R - rho;
    return { start: [0, h], segs: [{ t: 'L', p: [rw - rho, h] }, { t: 'A', p: [rw, sg * (H - rho)], R: -sg * rho }, { t: 'L', p: [rw, sg * rho] }, { t: 'A', p: [R, 0], R: sg * rho }] };
  }
  if (sh.kind === 'crater') {
    const k = Math.min(0.9, Math.max(0.1, sh.k)), rk = k * R, hc = -0.4 * h, m = rk + (R - rk) / 2;
    return { start: [0, hc], segs: [{ t: 'C', c1: [rk / 2, hc], c2: [rk / 2, h], p: [rk, h] }, { t: 'C', c1: [m, h], c2: [m, 0], p: [R, 0] }] };
  }
  // a profile from a file: R and h scale it
  const P = sh.path, R0 = P.segs[P.segs.length - 1].p[0], h0 = shapeHeight(P) || 1, fr = R / R0, fh = h / h0;
  const sc = q => [q[0] * fr, q[1] * fh];
  return { start: sc(P.start), segs: P.segs.map(s => s.t === 'C' ? { t: 'C', c1: sc(s.c1), c2: sc(s.c2), p: sc(s.p) } : s.t === 'A' ? { t: 'A', p: sc(s.p), R: s.R * fr } : { t: 'L', p: sc(s.p) }) };
}
function shapeHeight(P) {   // the height farthest from the face, with its sign
  let best = 0; const look = q => { if (Math.abs(q[1]) > Math.abs(best)) best = q[1]; };
  look(P.start); for (const s of P.segs) { look(s.p); if (s.c1) { look(s.c1); look(s.c2); } }
  return best;
}
/* which named shape a profile is, if any */
export function shapeOf(path) {
  const txt = pathText(path), end = path.segs.length ? path.segs[path.segs.length - 1].p : [0, 0], R = end[0];
  const tryShape = sh => { try { return pathText(shapePath(sh)) === txt ? sh : null; } catch { return null; } };
  if (path.segs.length === 1 && path.segs[0].t === 'C' && R > 0) { const r = tryShape({ kind: 'dome', R, h: path.start[1], k: path.segs[0].c1[0] / R }); if (r) return r; }
  if (path.segs.length === 4 && path.segs.map(s => s.t).join('') === 'LALA' && R > 0) { const r = tryShape({ kind: 'boss', R, h: path.start[1], k: Math.abs(path.segs[3].R) }); if (r) return r; }
  if (path.segs.length === 2 && path.segs[0].t === 'C' && path.segs[1].t === 'C' && R > 0) { const r = tryShape({ kind: 'crater', R, h: path.segs[0].p[1], k: path.segs[0].p[0] / R }); if (r) return r; }
  return { kind: 'custom', path: { start: path.start.slice(), segs: path.segs.map(s => ({ ...s })) }, R, h: shapeHeight(path) };
}
/* a feature as a short canonical string: two objects are the same when these agree */
export function featureKey(f) {
  const r = x => Math.round(x * 1e6) / 1e6, sh = f.shape;
  const shp = sh.kind === 'custom' ? 'custom:' + pathText(shapePath(sh)) : [sh.kind, r(sh.R), r(sh.h), r(sh.k)].join(',');
  const pat = !f.pattern ? '' : f.pattern.lattice.type === 'rect' ? `rect:${f.pattern.lattice.a.map(r)}:${f.pattern.lattice.b.map(r)}` : `polar:${f.pattern.lattice.n}:${r(f.pattern.lattice.rad)}:${r(f.pattern.lattice.phase || 0)}`;
  const reg = !f.pattern ? '' : f.pattern.region.type === 'all' ? 'all' : 'rect:' + f.pattern.region.box.map(r);
  return [f.face, f.at.map(r), shp, blendText(f.blend), pat, reg, f.pattern ? blendText(f.pattern.blend) : ''].join('|');
}


/* ═══════════════════ 7b. skins: features over curved places ═══════════════════
   A body whose features do not all lie inside its flat parts — a sphere with features, a box or a cylinder
   whose features reach the rounding of an edge, and every body with features in the animation, where the
   rounding grows under them — is drawn as one grid laid over its whole surface (a "skin"): six charts for a
   box or a sphere, the side and the two caps for a cylinder. Charts share their border points, so the surface
   is closed. Every grid point is put on the exact surface (flat part, edge bar, corner product of §7.4,
   sphere, rim) and moved along the surface normal by the combined height of the features near it (§8).
   r is measured straight through space, |p − c|. On a plane that is the r of §7.2; over a rounded edge or on
   a sphere it stands in for the "along the surface" rule of §7.5, which is still open (§18, question 1).
   Close to a feature that bends far round (the surface turned more than 90° away from its centre's normal)
   its height fades out, so a feature cannot print through a thin body to the other side. */
const SEC_N = 1024, OA = [[1, 2], [0, 2], [0, 1]];
function sectionTable(runs) {      // a section (unit corner cell) resampled by arc length: σ = 0 … 1
  const S = [], A = [], B = [], TA = [], TB = [];
  let acc = 0;
  for (const R of runs) for (let k = 0; k < R.a.length; k++) {
    if (A.length) acc += Math.hypot(R.a[k] - A[A.length - 1], R.b[k] - B[B.length - 1]);
    S.push(acc); A.push(R.a[k]); B.push(R.b[k]); TA.push(R.ta[k]); TB.push(R.tb[k]);
  }
  const T = { a: new Float64Array(SEC_N + 1), b: new Float64Array(SEC_N + 1), ta: new Float64Array(SEC_N + 1), tb: new Float64Array(SEC_N + 1), len: acc };
  let lo = 0;
  for (let k = 0; k <= SEC_N; k++) {
    const s = acc * k / SEC_N;
    while (lo < S.length - 2 && S[lo + 1] < s - 1e-12) lo++;
    const d = S[lo + 1] - S[lo], f = d > 1e-15 ? Math.min(1, Math.max(0, (s - S[lo]) / d)) : 1;
    let ta = TA[lo] + f * (TA[lo + 1] - TA[lo]), tb = TB[lo] + f * (TB[lo + 1] - TB[lo]);
    // exactly on a corner of the section (two samples at one place): the mean of the two tangents
    if (lo + 2 < S.length && Math.abs(S[lo + 2] - S[lo + 1]) < 1e-12 && Math.abs(s - S[lo + 1]) < 1e-12) { ta = TA[lo + 1] + TA[lo + 2]; tb = TB[lo + 1] + TB[lo + 2]; }
    const l = Math.hypot(ta, tb) || 1;
    T.a[k] = A[lo] + f * (A[lo + 1] - A[lo]); T.b[k] = B[lo] + f * (B[lo + 1] - B[lo]); T.ta[k] = ta / l; T.tb[k] = tb / l;
  }
  return T;
}
function secAt(T, s, o) {
  const x = (s <= 0 ? 0 : s >= 1 ? 1 : s) * SEC_N; let k = x | 0; if (k >= SEC_N) k = SEC_N - 1;
  const f = x - k, ta = T.ta[k] + f * (T.ta[k + 1] - T.ta[k]), tb = T.tb[k] + f * (T.tb[k + 1] - T.tb[k]), l = Math.hypot(ta, tb) || 1;
  o[0] = T.a[k] + f * (T.a[k + 1] - T.a[k]); o[1] = T.b[k] + f * (T.b[k + 1] - T.b[k]); o[2] = ta / l; o[3] = tb / l;
}
const ekey = (ax, sg) => edgeKey(ax, sg[OA[ax][0]], sg[OA[ax][1]]);
const cornerIndex = sg => (sg[0] > 0 ? 1 : 0) + (sg[1] > 0 ? 2 : 0) + (sg[2] > 0 ? 4 : 0);
function boxGeom(b) {
  const keys = new Set(b.edgeKeys || []), t0 = keys.size && b.edgePath ? b.edgePath.start[0] : 0;
  const curve = t0 > 0 ? sectionTable(quadRuns(b.edgePath, t0 * 2e-4)) : null, square = sectionTable(SQUARE), corners = [];
  for (let k = 0; k < 8; k++) {
    const s = [k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1];
    const f = [keys.has(edgeKey(0, s[1], s[2])), keys.has(edgeKey(1, s[0], s[2])), keys.has(edgeKey(2, s[0], s[1]))];
    const a3 = f[0] === f[1] ? 2 : f[0] === f[2] ? 1 : 0, [a1, a2] = otherAxes(a3), cA = !!(f[a3] && curve), cB = !!(f[a1] && curve);
    corners.push({ a1, a2, a3, A: cA ? curve : square, B: cB ? curve : square, cA, cB });
  }
  return { c: b.c, F: b.F, H: b.size.map(x => x / 2), keys, curve, square, corners };
}
/* A box chart: face (m, s), with x along OA[m][0] and y along OA[m][1], both measured from the centre.
   Inside the flat part a point of the sharp face is itself; in the band near an edge it goes to the edge bar
   (half of the section belongs to each face, they meet on the bisector); in a corner square it goes to that
   face's third of the corner product. Returns 0 flat, 1 edge bar, 2 corner. */
function cornerUW(C, m, i, X, Y) {
  if (m === C.a3) return [X >= Y ? 0.5 * Y / X : 1 - 0.5 * X / Y, 1 - (X > Y ? X : Y) / 2];   // around the pole of the product
  if (m === C.a1) { const qa2 = i === C.a2 ? X : Y, qa3 = i === C.a3 ? X : Y; return [qa2 / 2, qa3 / 2]; }
  const qa1 = i === C.a1 ? X : Y, qa3 = i === C.a3 ? X : Y; return [1 - qa1 / 2, qa3 / 2];
}
function boxMap(G, t, m, s, x, y, P, N, W) {
  const { c, F, H } = G, i = OA[m][0], j = OA[m][1];
  const X = t > 0 ? (Math.abs(x) - (H[i] - t)) / t : -1, Y = t > 0 ? (Math.abs(y) - (H[j] - t)) / t : -1;
  const sg = W.sg, q = W.q, n = W.n, o = W.o, o2 = W.o2;
  sg[m] = s; sg[i] = x >= 0 ? 1 : -1; sg[j] = y >= 0 ? 1 : -1;
  if (X <= 0 && Y <= 0) {
    for (let k = 0; k < 3; k++) { P[k] = c[k] + F[m][k] * s * H[m] + F[i][k] * x + F[j][k] * y; N[k] = F[m][k] * s; }
    return 0;
  }
  let code;
  if (X <= 0 || Y <= 0) {
    const along = X > 0 ? j : i, U = X > 0 ? X : Y, V = X > 0 ? Y : X, f1 = OA[along][0], f2 = OA[along][1];
    secAt(G.curve && G.keys.has(ekey(along, sg)) ? G.curve : G.square, f1 === m ? U / 2 : 1 - U / 2, o);
    q[f1] = o[0]; q[f2] = o[1]; q[along] = V; n[f1] = o[3]; n[f2] = -o[2]; n[along] = 0;
    code = 1;
  } else {
    const C = G.corners[cornerIndex(sg)], uw = cornerUW(C, m, i, X, Y);
    secAt(C.A, uw[0], o); secAt(C.B, uw[1], o2);
    q[C.a1] = o[0] * o2[0]; q[C.a2] = o[1] * o2[0]; q[C.a3] = o2[1];
    n[C.a1] = o2[3] * o[3]; n[C.a2] = -o2[3] * o[2]; n[C.a3] = -o2[2] * (o[0] * o[3] - o[1] * o[2]);
    if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < 1e-24) { n[C.a1] = 0; n[C.a2] = 0; n[C.a3] = 1; }
    code = 2;
  }
  for (let k = 0; k < 3; k++) { P[k] = c[k]; N[k] = 0; }
  for (let ax = 0; ax < 3; ax++) {
    const d = sg[ax] * ((H[ax] - t) + t * q[ax]), e = sg[ax] * n[ax], Fa = F[ax];
    P[0] += Fa[0] * d; P[1] += Fa[1] * d; P[2] += Fa[2] * d; N[0] += Fa[0] * e; N[1] += Fa[1] * e; N[2] += Fa[2] * e;
  }
  const l = Math.hypot(N[0], N[1], N[2]) || 1; N[0] /= l; N[1] /= l; N[2] /= l;
  return code;
}
function boxRoleKey(G, t, m, s, x, y) {     // which patch a point of a box chart belongs to (as evalBox names them)
  const i = OA[m][0], j = OA[m][1], H = G.H;
  const X = t > 0 ? (Math.abs(x) - (H[i] - t)) / t : -1, Y = t > 0 ? (Math.abs(y) - (H[j] - t)) / t : -1, sg = [0, 0, 0];
  sg[m] = s; sg[i] = x >= 0 ? 1 : -1; sg[j] = y >= 0 ? 1 : -1;
  const face = a => 'f' + a + sg[a];
  if (X <= 0 && Y <= 0) return face(m);
  if (X <= 0 || Y <= 0) {
    const along = X > 0 ? j : i, U = X > 0 ? X : Y, f1 = OA[along][0], f2 = OA[along][1], key = ekey(along, sg);
    if (G.curve && G.keys.has(key)) return 'e' + key;
    return face((f1 === m ? U / 2 : 1 - U / 2) < 0.5 ? f1 : f2);
  }
  const C = G.corners[cornerIndex(sg)], [u, w] = cornerUW(C, m, i, X, Y);
  if (C.cA && C.cB) return 'c' + sg.join(',');
  if (C.cA) return w < 0.5 ? 'e' + ekey(C.a3, sg) : face(C.a3);
  if (C.cB) return 'e' + (u < 0.5 ? ekey(C.a2, sg) : ekey(C.a1, sg));
  return w >= 0.5 ? face(C.a3) : face(u < 0.5 ? C.a1 : C.a2);
}
function cylGeom(b) {
  const keys = new Set(b.edgeKeys || []), t0 = keys.size && b.edgePath ? b.edgePath.start[0] : 0;
  return { c: b.c, F: b.F, r: b.size[0] / 2, hh: b.size[1] / 2, keys, curve: t0 > 0 ? sectionTable(quadRuns(b.edgePath, t0 * 2e-4)) : null, square: sectionTable(SQUARE) };
}
/* A cylinder chart: 0 the side (u = φ, v = z), 1 the top cap and 2 the bottom cap (u = φ, v = ρ). The rim's
   section starts on the cap (σ = 0) and ends on the side (σ = 1); each chart owns its half. */
function cylMap(G, t, ch, u, v, P, N, W) {
  const { c, F, r, hh } = G, cp = Math.cos(u), sp = Math.sin(u), o = W.o;
  const rx = F[0][0] * cp + F[1][0] * sp, ry = F[0][1] * cp + F[1][1] * sp, rz = F[0][2] * cp + F[1][2] * sp, A = F[2];
  let sz, sig;
  if (ch === 0) {
    const Z = t > 0 ? (Math.abs(v) - (hh - t)) / t : -1;
    if (Z <= 0) { P[0] = c[0] + A[0] * v + rx * r; P[1] = c[1] + A[1] * v + ry * r; P[2] = c[2] + A[2] * v + rz * r; N[0] = rx; N[1] = ry; N[2] = rz; return 0; }
    sz = v >= 0 ? 1 : -1; sig = 1 - Z / 2;
  } else {
    sz = ch === 1 ? 1 : -1;
    const X = t > 0 ? (v - (r - t)) / t : -1;
    if (X <= 0) { P[0] = c[0] + A[0] * sz * hh + rx * v; P[1] = c[1] + A[1] * sz * hh + ry * v; P[2] = c[2] + A[2] * sz * hh + rz * v; N[0] = A[0] * sz; N[1] = A[1] * sz; N[2] = A[2] * sz; return 0; }
    sig = X / 2;
  }
  secAt(G.curve && G.keys.has(sz > 0 ? 'top' : 'bottom') ? G.curve : G.square, sig, o);
  const ax = sz * ((hh - t) + t * o[0]), rd = (r - t) + t * o[1];
  P[0] = c[0] + A[0] * ax + rx * rd; P[1] = c[1] + A[1] * ax + ry * rd; P[2] = c[2] + A[2] * ax + rz * rd;
  N[0] = A[0] * sz * o[3] - rx * o[2]; N[1] = A[1] * sz * o[3] - ry * o[2]; N[2] = A[2] * sz * o[3] - rz * o[2];
  const l = Math.hypot(N[0], N[1], N[2]) || 1; N[0] /= l; N[1] /= l; N[2] /= l;
  return 1;
}
function cylRoleKey(G, t, ch, u, v) {
  const { r, hh } = G;
  let sz, sig;
  if (ch === 0) { const Z = t > 0 ? (Math.abs(v) - (hh - t)) / t : -1; if (Z <= 0) return 'side'; sz = v >= 0 ? 1 : -1; sig = 1 - Z / 2; }
  else { sz = ch === 1 ? 1 : -1; const X = t > 0 ? (v - (r - t)) / t : -1; if (X <= 0) return 'k' + (sz > 0 ? 'top' : 'bottom'); sig = X / 2; }
  const key = sz > 0 ? 'top' : 'bottom';
  if (G.curve && G.keys.has(key)) return 'r' + key;
  return sig < 0.5 ? 'k' + key : 'side';
}
function sphMap(G, m, s, a, b2, P, N) {      // a cube of six charts blown up to the sphere (equal angles)
  const { c, F, r } = G, i = OA[m][0], j = OA[m][1], ta = Math.tan(a), tb = Math.tan(b2);
  let x = F[m][0] * s + F[i][0] * ta + F[j][0] * tb, y = F[m][1] * s + F[i][1] * ta + F[j][1] * tb, z = F[m][2] * s + F[i][2] * ta + F[j][2] * tb;
  const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
  N[0] = x; N[1] = y; N[2] = z; P[0] = c[0] + r * x; P[1] = c[1] + r * y; P[2] = c[2] + r * z;
  return 0;
}
const roleOfKey = k => k[0] === 'f' ? { role: { kind: 'face', m: +k[1], s: +k.slice(2) }, type: 'plane' }
  : k[0] === 'e' ? { role: { kind: 'edge', key: k.slice(1) }, type: 'edge' }
  : k[0] === 'c' ? { role: { kind: 'corner', s: k.slice(1).split(',').map(Number) }, type: 'corner' }
  : k[0] === 'k' ? { role: { kind: 'cap', key: k.slice(1) }, type: 'plane' }
  : k[0] === 'r' ? { role: { kind: 'rim', key: k.slice(1) }, type: 'edge' }
  : k === 'side' ? { role: { kind: 'side' }, type: 'side' } : { role: { kind: 'surface' }, type: 'sphere' };
/* the line tag the page uses for a piece (tagOf in the page): a feature inside a skin carries its region's */
const tagOfKey = k => k[0] === 'f' ? 'f' + k[1] + k.slice(2) : k[0] === 'e' ? 'e' + k.slice(1) : k[0] === 'c' ? 'c' + k.slice(1).split(',').join('')
  : k[0] === 'k' ? 'k' + k.slice(1) : k[0] === 'r' ? 'r' + k.slice(1) : k;
function axisNodes(lo, hi, breaks, step) {   // node coordinates over [lo, hi], with the given breaks among them
  const pts = [lo];
  for (const x of [...breaks].sort((a, b) => a - b)) if (x > pts[pts.length - 1] + 1e-9 && x < hi - 1e-9) pts.push(x);
  pts.push(hi);
  const out = [];
  for (let k = 0; k + 1 < pts.length; k++) { const n = Math.max(1, Math.ceil((pts[k + 1] - pts[k]) / step - 1e-9)); for (let e = 0; e < n; e++) out.push(pts[k] + (pts[k + 1] - pts[k]) * e / n); }
  out.push(hi); return out;
}
/* a profile as a table of heights over r = 0 … R, and its walls: the ranges of r where it is steeper than 4:1
   (a vertical wall is one r). A grid cannot hold a wall that falls between two of its points: sampled as it is,
   the wall shows as teeth along its circle. So the points within half a step of a wall are moved onto two
   circles just inside and just outside it (see the skin), and the wall becomes a clean band. */
function uniformProfile(path, R, n = 2048) {
  const T = profileTable(path, R), h = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) h[k] = tableAt(T, R * k / n);
  const walls = [];
  for (const run of samplePath(path, R / 4000)) for (let i = 1; i < run.pts.length; i++) {
    const [r0, h0] = run.pts[i - 1], [r1, h1] = run.pts[i];
    if (Math.abs(h1 - h0) <= 4 * Math.abs(r1 - r0) || Math.abs(h1 - h0) < 1e-9) continue;
    const a = Math.min(r0, r1), b = Math.max(r0, r1), L = walls[walls.length - 1];
    if (L && a <= L[1] + 1e-9) L[1] = Math.max(L[1], b); else walls.push([a, b]);
  }
  const W = walls.filter(w => w[0] > 1e-6 && w[1] < R - 1e-6);
  return { R, n, h, walls: W, wallOut: W.length ? Math.max(...W.map(w => w[1])) : 0 };
}
/* Make the skin of a body. insts: its feature copies, each with its chart anchor (see bodyInstances).
   opts.anim: the same grid for every setback (the animation); opts.step: grid step; opts.budget: most points. */
export function makeSkin(b, chord, issues, insts, opts = {}) {
  const kind = b.kind, anim = !!opts.anim, tOf = bb => kind === 'sph' ? 0 : (bb.edgeKeys && bb.edgeKeys.length && bb.edgePath ? bb.edgePath.start[0] : 0);
  const t0 = tOf(b), G = kind === 'box' ? boxGeom(b) : kind === 'cyl' ? cylGeom(b) : { c: b.c, F: b.F, r: b.size[0] / 2 };
  const area = kind === 'box' ? 2 * (b.size[0] * b.size[1] + b.size[1] * b.size[2] + b.size[0] * b.size[2]) : kind === 'cyl' ? Math.PI * b.size[0] * (b.size[1] + b.size[0] / 2) : Math.PI * b.size[0] ** 2;
  const minR = insts.length ? Math.min(...insts.map(f => f.R)) : 5;
  const want = Math.min(1, minR / (anim ? 10 : 16) * Math.sqrt(Math.max(chord, 1e-4) / 0.05));
  const floor = Math.sqrt(area / (opts.budget || (anim ? 60000 : 120000))), step = opts.step || Math.max(want, floor);
  if (!anim && !opts.step && floor > want * 1.01) issues.push({ level: 'info', msg: `features over curved places on this body are drawn on a ${fmt(+step.toFixed(3))} mm grid` });
  // the charts and their grid nodes; a chart's u runs along its first axis, v along its second
  const charts = [];
  if (kind === 'box') {
    const nodes = G.H.map(h => axisNodes(-h, h, !anim && t0 > 0 && t0 < h ? [-(h - t0), h - t0] : [], step));
    for (let m = 0; m < 3; m++) for (const s of [-1, 1]) charts.push({ m, s, us: nodes[OA[m][0]], vs: nodes[OA[m][1]] });
  } else if (kind === 'sph') {
    const n = Math.max(4, Math.ceil(Math.PI / 2 * G.r / step)), A = [];
    for (let k = 0; k <= n; k++) A.push(-Math.PI / 4 + Math.PI / 2 * k / n);
    for (let m = 0; m < 3; m++) for (const s of [-1, 1]) charts.push({ m, s, us: A, vs: A });
  } else {
    const { r, hh } = G, nphi = Math.max(16, Math.ceil(2 * Math.PI * r / step), angularSegments(r, chord / 2)), PH = [];
    for (let k = 0; k <= nphi; k++) PH.push(2 * Math.PI * k / nphi);
    const zs = axisNodes(-hh, hh, !anim && t0 > 0 && t0 < hh ? [-(hh - t0), hh - t0] : [], step), rs = axisNodes(0, r, !anim && t0 > 0 && t0 < r ? [r - t0] : [], step);
    charts.push({ ch: 0, us: PH, vs: zs }, { ch: 1, us: PH, vs: rs }, { ch: 2, us: PH, vs: rs });
  }
  let nv = 0;
  charts.forEach((C, ci) => { C.ci = ci; C.nu = C.us.length; C.nw = C.vs.length; C.base = nv; nv += C.nu * C.nw; });
  const CH = new Uint8Array(nv), CU = new Float64Array(nv), CV = new Float64Array(nv);
  for (const C of charts) for (let iv = 0; iv < C.nw; iv++) for (let iu = 0; iu < C.nu; iu++) { const k = C.base + iv * C.nu + iu; CH[k] = C.ci; CU[k] = C.us[iu]; CV[k] = C.vs[iv]; }
  const W = { sg: [0, 0, 0], q: [0, 0, 0], n: [0, 0, 0], o: new Float64Array(4), o2: new Float64Array(4) };
  let t = t0;
  const map = (ci, u, v, P, N) => { const C = charts[ci]; return kind === 'box' ? boxMap(G, t, C.m, C.s, u, v, P, N, W) : kind === 'cyl' ? cylMap(G, t, C.ch, u, v, P, N, W) : sphMap(G, C.m, C.s, u, v, P, N); };
  const BP = new Float64Array(3 * nv), BN = new Float64Array(3 * nv), p3 = [0, 0, 0], n3 = [0, 0, 0];
  const base = () => {
    for (const C of charts) {
      const e = C.base + C.nu * C.nw;
      if (kind === 'box') {
        const { m, s } = C, i = OA[m][0], j = OA[m][1], H = G.H, Fi = G.F[i], Fj = G.F[j], Fm = G.F[m], li = H[i] - t, lj = H[j] - t;
        const ox = G.c[0] + Fm[0] * s * H[m], oy = G.c[1] + Fm[1] * s * H[m], oz = G.c[2] + Fm[2] * s * H[m];
        for (let k = C.base; k < e; k++) {
          const x = CU[k], y = CV[k], k3 = 3 * k;
          if (t <= 0 || (Math.abs(x) <= li && Math.abs(y) <= lj)) {
            BP[k3] = ox + Fi[0] * x + Fj[0] * y; BP[k3 + 1] = oy + Fi[1] * x + Fj[1] * y; BP[k3 + 2] = oz + Fi[2] * x + Fj[2] * y;
            BN[k3] = Fm[0] * s; BN[k3 + 1] = Fm[1] * s; BN[k3 + 2] = Fm[2] * s; continue;
          }
          boxMap(G, t, m, s, x, y, p3, n3, W);
          BP[k3] = p3[0]; BP[k3 + 1] = p3[1]; BP[k3 + 2] = p3[2]; BN[k3] = n3[0]; BN[k3 + 1] = n3[1]; BN[k3 + 2] = n3[2];
        }
        continue;
      }
      for (let k = C.base; k < e; k++) {
        if (kind === 'cyl') cylMap(G, t, C.ch, CU[k], CV[k], p3, n3, W); else sphMap(G, C.m, C.s, CU[k], CV[k], p3, n3);
        BP[3 * k] = p3[0]; BP[3 * k + 1] = p3[1]; BP[3 * k + 2] = p3[2]; BN[3 * k] = n3[0]; BN[3 * k + 1] = n3[1]; BN[3 * k + 2] = n3[2];
      }
    }
  };
  base();
  // points that coincide (chart borders, the centre of a cap) form one group: they move together
  const grp = new Int32Array(nv), seen = new Map(); let ng = 0;
  for (const C of charts) for (let iv = 0; iv < C.nw; iv++) for (let iu = 0; iu < C.nu; iu++) {
    const k = C.base + iv * C.nu + iu;
    if (iu > 0 && iu < C.nu - 1 && iv > 0 && iv < C.nw - 1) { grp[k] = ng++; continue; }
    const key = Math.round(BP[3 * k] * 1e6) + ',' + Math.round(BP[3 * k + 1] * 1e6) + ',' + Math.round(BP[3 * k + 2] * 1e6);
    let g = seen.get(key); if (g === undefined) { g = ng++; seen.set(key, g); } grp[k] = g;
  }
  const rep = new Int32Array(ng).fill(-1), multi = new Map();
  for (let k = 0; k < nv; k++) { const g = grp[k]; if (rep[g] < 0) rep[g] = k; else { if (!multi.has(g)) multi.set(g, [rep[g]]); multi.get(g).push(k); } }
  const smooth = new Set();      // groups on a smooth border: their normals are shared; on a crease each side keeps its own
  for (const [g, ks] of multi) { const a = ks[0]; if (ks.every(k => BN[3 * k] * BN[3 * a] + BN[3 * k + 1] * BN[3 * a + 1] + BN[3 * k + 2] * BN[3 * a + 2] > 0.94)) smooth.add(g); }
  // triangles, turned outwards; none with two corners in one group
  let cells = 0; for (const C of charts) cells += (C.nu - 1) * (C.nw - 1);
  const tl = new Uint32Array(6 * cells); let nt3 = 0;
  for (const C of charts) {
    const iu = C.nu >> 1, iv = C.nw >> 1, k0 = C.base + iv * C.nu + iu, k1 = k0 + 1, k2 = k0 + C.nu;
    const ex = [0, 1, 2].map(e => BP[3 * k1 + e] - BP[3 * k0 + e]), ey = [0, 1, 2].map(e => BP[3 * k2 + e] - BP[3 * k0 + e]);
    const cr = cross(ex, ey), flip = cr[0] * BN[3 * k0] + cr[1] * BN[3 * k0 + 1] + cr[2] * BN[3 * k0 + 2] < 0;
    for (let v = 0; v + 1 < C.nw; v++) for (let u = 0; u + 1 < C.nu; u++) {
      const a = C.base + v * C.nu + u, bq = a + 1, d = a + C.nu, cq = d + 1;
      for (const T of flip ? [[a, cq, bq], [a, d, cq]] : [[a, bq, cq], [a, cq, d]]) {
        if (grp[T[0]] === grp[T[1]] || grp[T[1]] === grp[T[2]] || grp[T[0]] === grp[T[2]]) continue;
        tl[nt3++] = T[0]; tl[nt3++] = T[1]; tl[nt3++] = T[2];
      }
    }
  }
  const idx = tl.slice(0, nt3), ntri = nt3 / 3;
  const vts = new Int32Array(nv + 1), vtl = new Int32Array(nt3);       // the triangles around each point
  for (let q = 0; q < nt3; q++) vts[idx[q] + 1]++;
  for (let k = 0; k < nv; k++) vts[k + 1] += vts[k];
  { const fill = vts.slice(0, nv); for (let q = 0; q < nt3; q++) vtl[fill[idx[q]]++] = (q / 3) | 0; }
  const turnedOut = k => {       // do the triangles around point k still face out (on the surface before the features)?
    for (let e = vts[k]; e < vts[k + 1]; e++) {
      const q = 3 * vtl[e], a = 3 * idx[q], b2 = 3 * idx[q + 1], c2 = 3 * idx[q + 2];
      const ux = BP[b2] - BP[a], uy = BP[b2 + 1] - BP[a + 1], uz = BP[b2 + 2] - BP[a + 2], vx = BP[c2] - BP[a], vy = BP[c2 + 1] - BP[a + 1], vz = BP[c2 + 2] - BP[a + 2];
      if ((uy * vz - uz * vy) * BN[3 * k] + (uz * vx - ux * vz) * BN[3 * k + 1] + (ux * vy - uy * vx) * BN[3 * k + 2] <= 0) return false;
    }
    return true;
  };
  // the features: anchors, height tables, a grid of cells to find the ones near a point
  const PT = new Map(), Rmax = insts.length ? Math.max(...insts.map(f => f.R)) : 1;
  for (const f of insts) { if (!PT.has(f.path)) PT.set(f.path, new Map()); const byR = PT.get(f.path); if (!byR.has(f.R)) byR.set(f.R, uniformProfile(f.path, f.R)); f.ptab = byR.get(f.R); }
  const hasWalls = insts.some(f => f.ptab.walls.length), pa = [0, 0, 0], pb = [0, 0, 0], na = [0, 0, 0];
  const dist = (q, a) => { const x = q[0] - AP[3 * a], y = q[1] - AP[3 * a + 1], z = q[2] - AP[3 * a + 2]; return Math.sqrt(x * x + y * y + z * z); };
  const AP = new Float64Array(3 * insts.length), AN = new Float64Array(3 * insts.length);
  const GP = new Float64Array(3 * ng), GN = new Float64Array(3 * ng), GH = new Float64Array(ng), GD = new Int32Array(ng);
  const POS = new Float32Array(3 * nv), NRM = new Float32Array(3 * nv);
  const MAXC = 64, cand = new Int32Array(MAXC), hs = new Float64Array(MAXC), ts = new Float64Array(MAXC), bl = new Array(MAXC);
  const dh = new Float64Array(MAXC), ux = new Float64Array(MAXC), uy = new Float64Array(MAXC), uz = new Float64Array(MAXC), fd = new Float64Array(MAXC), hs2 = new Float64Array(MAXC), ts2 = new Float64Array(MAXC);
  const GG = new Float64Array(3 * ng);
  const phiD = (sh, x) => { x = Math.min(1, Math.max(0, x)); return (1 - sh) + sh * 30 * x * x * (x - 1) * (x - 1); };
  const skin = { kind, nv, ntri, idx, pos: POS, nrm: NRM, step, insts, t: t0, charts, heights: GH, points: GP, anchors: AP };
  const BP0 = new Float64Array(3 * nv), BN0 = new Float64Array(3 * nv); let baseT = null;
  skin.update = (tNew = t0, scale = 1) => {
    t = tNew; skin.t = t;
    if (baseT === t) { BP.set(BP0); BN.set(BN0); }      // the bare surface of this setback is kept: the walls only moved points of it
    else { base(); BP0.set(BP); BN0.set(BN); baseT = t; }
    for (let g = 0; g < ng; g++) { const k = rep[g]; for (let e = 0; e < 3; e++) { GP[3 * g + e] = BP[3 * k + e]; GN[3 * g + e] = BN[3 * k + e]; } }
    for (const [g, ks] of multi) {      // a point on a border moves along the mean normal of its copies
      let x = 0, y = 0, z = 0; for (const k of ks) { x += BN[3 * k]; y += BN[3 * k + 1]; z += BN[3 * k + 2]; }
      const l = Math.hypot(x, y, z) || 1; GN[3 * g] = x / l; GN[3 * g + 1] = y / l; GN[3 * g + 2] = z / l;
    }
    // anchors on the present surface
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    insts.forEach((f, a) => {
      if (f.dir) { for (let e = 0; e < 3; e++) { AN[3 * a + e] = f.dir[e]; AP[3 * a + e] = G.c[e] + G.r * f.dir[e]; } }
      else { map(f.ci, f.cu, f.cv, p3, n3); for (let e = 0; e < 3; e++) { AP[3 * a + e] = p3[e]; AN[3 * a + e] = n3[e]; } }
      for (let e = 0; e < 3; e++) { lo[e] = Math.min(lo[e], AP[3 * a + e]); hi[e] = Math.max(hi[e], AP[3 * a + e]); }
    });
    const cs = Rmax, nI = insts.length, nx = nI ? Math.max(1, Math.ceil((hi[0] - lo[0]) / cs) + 1) : 1, ny = nI ? Math.max(1, Math.ceil((hi[1] - lo[1]) / cs) + 1) : 1, nz = nI ? Math.max(1, Math.ceil((hi[2] - lo[2]) / cs) + 1) : 1;
    const head = new Int32Array(nx * ny * nz).fill(-1), next = new Int32Array(Math.max(1, nI));
    for (let a = nI - 1; a >= 0; a--) { const ci = (Math.floor((AP[3 * a] - lo[0]) / cs) * ny + Math.floor((AP[3 * a + 1] - lo[1]) / cs)) * nz + Math.floor((AP[3 * a + 2] - lo[2]) / cs); next[a] = head[ci]; head[ci] = a; }
    // walls: a point within a step of one moves onto the circle just inside or just outside it (points on chart
    // borders stay where they are, so neighbouring charts still meet)
    if (hasWalls) for (let g = 0; g < ng; g++) {
      if (multi.has(g)) continue;
      const k = rep[g], px = BP[3 * k], py = BP[3 * k + 1], pz = BP[3 * k + 2];
      if (px < lo[0] - cs || px > hi[0] + cs || py < lo[1] - cs || py > hi[1] + cs || pz < lo[2] - cs || pz > hi[2] + cs) continue;
      const gx = Math.floor((px - lo[0]) / cs), gy = Math.floor((py - lo[1]) / cs), gz = Math.floor((pz - lo[2]) / cs), hw = 0.95 * step;   // every grid edge that crosses the wall gets both ends moved
      let best = Infinity, tg = 0, wa = -1;
      for (let ix = gx - 1; ix <= gx + 1; ix++) { if (ix < 0 || ix >= nx) continue; for (let iy = gy - 1; iy <= gy + 1; iy++) { if (iy < 0 || iy >= ny) continue; for (let iz = gz - 1; iz <= gz + 1; iz++) {
        if (iz < 0 || iz >= nz) continue;
        for (let a = head[(ix * ny + iy) * nz + iz]; a >= 0; a = next[a]) {
          const W2 = insts[a].ptab.walls; if (!W2.length) continue;
          const ex = px - AP[3 * a], ey = py - AP[3 * a + 1], ez = pz - AP[3 * a + 2], r2 = ex * ex + ey * ey + ez * ez, far = insts[a].ptab.wallOut + hw;
          if (r2 > far * far) continue;      // beyond its outermost wall: nothing to snap to
          const r = Math.sqrt(r2), eps = 2.5 * insts[a].R / 2048 + 1e-4;
          for (const [ra, rb] of W2) {
            let t2 = null;
            if (r > ra - hw && r < ra) t2 = ra - eps; else if (r > rb && r < rb + hw) t2 = rb + eps; else if (r >= ra && r <= rb) t2 = r - ra < rb - r ? ra - eps : rb + eps;
            if (t2 !== null && Math.abs(t2 - r) < best) { best = Math.abs(t2 - r); tg = t2; wa = a; }
          }
        }
      } } }
      if (wa < 0) continue;
      const C = charts[CH[k]], du = (C.us[C.nu - 1] - C.us[0]) * 1e-5, dv = (C.vs[C.nw - 1] - C.vs[0]) * 1e-5;
      let u = CU[k], v = CV[k], okSnap = false;
      for (let it = 0; it < 4; it++) {
        map(CH[k], u, v, p3, n3); const r = dist(p3, wa);
        if (Math.abs(r - tg) < 1e-7) { okSnap = true; break; }
        map(CH[k], u + du, v, pa, na); map(CH[k], u, v + dv, pb, na);
        const dru = (dist(pa, wa) - r) / du, drv = (dist(pb, wa) - r) / dv, den = dru * dru + drv * drv;
        if (den < 1e-18) break;
        u += (tg - r) * dru / den; v += (tg - r) * drv / den;
        if (u < C.us[0] || u > C.us[C.nu - 1] || v < C.vs[0] || v > C.vs[C.nw - 1]) break;
      }
      if (!okSnap) { map(CH[k], u, v, p3, n3); okSnap = u >= C.us[0] && u <= C.us[C.nu - 1] && v >= C.vs[0] && v <= C.vs[C.nw - 1] && Math.abs(dist(p3, wa) - tg) < 1e-4; }
      if (!okSnap) continue;
      const old = [BP[3 * k], BP[3 * k + 1], BP[3 * k + 2], BN[3 * k], BN[3 * k + 1], BN[3 * k + 2]];
      for (let e = 0; e < 3; e++) { BP[3 * k + e] = p3[e]; BN[3 * k + e] = n3[e]; }
      if (!turnedOut(k)) { for (let e = 0; e < 3; e++) { BP[3 * k + e] = old[e]; BN[3 * k + e] = old[3 + e]; } continue; }   // it would fold a triangle over: it stays
      for (let e = 0; e < 3; e++) { GP[3 * g + e] = p3[e]; GN[3 * g + e] = n3[e]; }
    }
    GH.fill(0); GD.fill(-1); GG.fill(0);
    for (let g = 0; g < ng && nI; g++) {
      const px = GP[3 * g], py = GP[3 * g + 1], pz = GP[3 * g + 2];
      if (px < lo[0] - cs || px > hi[0] + cs || py < lo[1] - cs || py > hi[1] + cs || pz < lo[2] - cs || pz > hi[2] + cs) continue;
      const gx = Math.floor((px - lo[0]) / cs), gy = Math.floor((py - lo[1]) / cs), gz = Math.floor((pz - lo[2]) / cs);
      let n = 0;
      for (let ix = gx - 1; ix <= gx + 1; ix++) { if (ix < 0 || ix >= nx) continue; for (let iy = gy - 1; iy <= gy + 1; iy++) { if (iy < 0 || iy >= ny) continue; for (let iz = gz - 1; iz <= gz + 1; iz++) {
        if (iz < 0 || iz >= nz) continue;
        for (let a = head[(ix * ny + iy) * nz + iz]; a >= 0; a = next[a]) { const dx = px - AP[3 * a], dy = py - AP[3 * a + 1], dz = pz - AP[3 * a + 2], R = insts[a].R; if (dx * dx + dy * dy + dz * dz < R * R && n < MAXC) cand[n++] = a; }
      } } }
      if (!n) continue;
      if (n > 1) cand.subarray(0, n).sort();     // in file order (insts are sorted that way)
      let best = 0, bestA = -1;
      const nxg = GN[3 * g], nyg = GN[3 * g + 1], nzg = GN[3 * g + 2];
      for (let k = 0; k < n; k++) {
        const a = cand[k], f = insts[a], dx = px - AP[3 * a], dy = py - AP[3 * a + 1], dz = pz - AP[3 * a + 2], r = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const dn = nxg * AN[3 * a] + nyg * AN[3 * a + 1] + nzg * AN[3 * a + 2], x = Math.min(1, Math.max(0, (dn + 0.5) / 0.5)), fade = x * x * (3 - 2 * x);
        const P = f.ptab, xr = r / P.R * P.n, kk = Math.min(P.n - 1, xr | 0), h = (P.h[kk] + (xr - kk) * (P.h[kk + 1] - P.h[kk])) * scale * fade;
        hs[k] = h; ts[k] = 1 - r / f.R; bl[k] = f.blend; fd[k] = fade;
        dh[k] = (P.h[kk + 1] - P.h[kk]) * P.n / P.R * scale * fade;      // dh/dr
        if (r > 1e-12) { ux[k] = dx / r; uy[k] = dy / r; uz[k] = dz / r; } else { ux[k] = 0; uy[k] = 0; uz[k] = 0; }
        if (Math.abs(h) > best) { best = Math.abs(h); bestA = a; }
      }
      const H0 = combineHeights(bl, hs, ts, n, scale);
      GH[g] = H0; GD[g] = bestA;
      // the slope of the combined height: exact for sum and for mix with one sharpness, otherwise by differences
      let allSum = true, allMix = true;
      for (let k = 0; k < n; k++) { if (bl[k].kind !== 'sum') allSum = false; if (!(bl[k].kind === 'mix' && bl[k].v === bl[0].v)) allMix = false; }
      let Gx = 0, Gy = 0, Gz = 0;
      if (allSum) for (let k = 0; k < n; k++) { Gx += dh[k] * ux[k]; Gy += dh[k] * uy[k]; Gz += dh[k] * uz[k]; }
      else if (allMix) {
        const sh = bl[0].v; let Wt = 0;
        for (let k = 0; k < n; k++) {
          const w = phi(sh, ts[k]), dw = -phiD(sh, ts[k]) / insts[cand[k]].R, c1 = dw * hs[k] + w * dh[k] - H0 * dw;
          Wt += w; Gx += c1 * ux[k]; Gy += c1 * uy[k]; Gz += c1 * uz[k];
        }
        if (Wt > 0) { Gx /= Wt; Gy /= Wt; Gz /= Wt; } else { Gx = 0; Gy = 0; Gz = 0; }
      } else {
        const ax = Math.abs(nxg) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross([nxg, nyg, nzg], ax)), e2 = cross([nxg, nyg, nzg], e1), eps = step / 4;
        const hAt = (qx, qy, qz) => {
          for (let k = 0; k < n; k++) {
            const a = cand[k], f = insts[a], ex = qx - AP[3 * a], ey = qy - AP[3 * a + 1], ez = qz - AP[3 * a + 2], r = Math.sqrt(ex * ex + ey * ey + ez * ez), P = f.ptab;
            if (r >= f.R) { hs2[k] = 0; ts2[k] = 0; continue; }
            const xr = r / P.R * P.n, kk = Math.min(P.n - 1, xr | 0);
            hs2[k] = (P.h[kk] + (xr - kk) * (P.h[kk + 1] - P.h[kk])) * scale * fd[k]; ts2[k] = 1 - r / f.R;
          }
          return combineHeights(bl, hs2, ts2, n, scale);
        };
        const d1 = (hAt(px + eps * e1[0], py + eps * e1[1], pz + eps * e1[2]) - hAt(px - eps * e1[0], py - eps * e1[1], pz - eps * e1[2])) / (2 * eps);
        const d2 = (hAt(px + eps * e2[0], py + eps * e2[1], pz + eps * e2[2]) - hAt(px - eps * e2[0], py - eps * e2[1], pz - eps * e2[2])) / (2 * eps);
        Gx = d1 * e1[0] + d2 * e2[0]; Gy = d1 * e1[1] + d2 * e2[1]; Gz = d1 * e1[2] + d2 * e2[2];
      }
      const gn = Gx * nxg + Gy * nyg + Gz * nzg;     // along the surface only
      GG[3 * g] = Gx - gn * nxg; GG[3 * g + 1] = Gy - gn * nyg; GG[3 * g + 2] = Gz - gn * nzg;
    }
    for (let k = 0; k < nv; k++) { const g = grp[k], h = GH[g]; for (let e = 0; e < 3; e++) POS[3 * k + e] = GP[3 * g + e] + h * GN[3 * g + e]; }
    // normals: the exact normal of the surface under the point, tilted by the slope of the features
    // (n − ∇h, the normal of p + h·n where the host's curvature is small against 1/h); a point on a crease keeps
    // its own side's normal, so sharp edges stay sharp
    for (let k = 0; k < nv; k++) {
      const g = grp[k], x = BN[3 * k] - GG[3 * g], y = BN[3 * k + 1] - GG[3 * g + 1], z = BN[3 * k + 2] - GG[3 * g + 2], l = Math.sqrt(x * x + y * y + z * z) || 1;
      NRM[3 * k] = x / l; NRM[3 * k + 1] = y / l; NRM[3 * k + 2] = z / l;
    }
    return skin;
  };
  const regionKey = (ci, u, v) => { const C = charts[ci]; return kind === 'box' ? boxRoleKey(G, t, C.m, C.s, u, v) : kind === 'cyl' ? cylRoleKey(G, t, C.ch, u, v) : 'surface'; };
  /* pieces for the page and the final export: the patches as evalBox / evalCyl / evalSph name them; where a
     feature moved a point, the triangle belongs to that feature (its card is free) */
  skin.pieces = () => {
    const keys = [], keyId = new Map(), tp = new Int32Array(ntri), count = [];
    const id = k => { let v = keyId.get(k); if (v === undefined) { v = keys.length; keyId.set(k, v); keys.push(k); count.push(0); } return v; };
    let lastCell = -1, lastRk = '';
    for (let q = 0; q < ntri; q++) {
      const a = idx[3 * q], b2 = idx[3 * q + 1], c2 = idx[3 * q + 2];
      const cell = Math.min(a, b2, c2);       // both triangles of a grid cell start at its first corner
      if (cell !== lastCell) { lastCell = cell; lastRk = regionKey(CH[a], (CU[a] + CU[b2] + CU[c2]) / 3, (CV[a] + CV[b2] + CV[c2]) / 3); }
      let fa = -1, best = 1e-9;
      const ga = grp[a], gb = grp[b2], gc = grp[c2];
      if (Math.abs(GH[ga]) > best) { best = Math.abs(GH[ga]); fa = GD[ga]; }
      if (Math.abs(GH[gb]) > best) { best = Math.abs(GH[gb]); fa = GD[gb]; }
      if (Math.abs(GH[gc]) > best) { best = Math.abs(GH[gc]); fa = GD[gc]; }
      const k = id(fa >= 0 ? 'F' + fa + '|' + lastRk : lastRk); tp[q] = k; count[k]++;
    }
    const stamp = new Int32Array(nv).fill(-1), loc = new Int32Array(nv), out = [], start = new Int32Array(keys.length + 1), order = new Int32Array(ntri);
    for (let k = 0; k < keys.length; k++) start[k + 1] = start[k] + count[k];
    { const fillAt = start.slice(0, keys.length); for (let q = 0; q < ntri; q++) order[fillAt[tp[q]]++] = q; }
    keys.forEach((key, pi) => {
      let pc;
      const bar = key.indexOf('|'), rk = bar >= 0 ? key.slice(bar + 1) : key;
      if (bar >= 0) { const f = insts[+key.slice(1, bar)]; pc = newPiece({ kind: 'feature', host: f.host, id: f.id, region: tagOfKey(rk) }, 'feature'); }
      else { const r = roleOfKey(rk); pc = newPiece(r.role, r.type); }
      const I = new Uint32Array(3 * count[pi]), P = [], Nn = [];
      let ti = 0, nvl = 0;
      for (let oq = start[pi]; oq < start[pi + 1]; oq++) {
        const q = order[oq];
        for (let e = 0; e < 3; e++) {
          const k = idx[3 * q + e];
          if (stamp[k] !== pi) { stamp[k] = pi; loc[k] = nvl++; P.push(POS[3 * k], POS[3 * k + 1], POS[3 * k + 2]); Nn.push(NRM[3 * k], NRM[3 * k + 1], NRM[3 * k + 2]); }
          I[ti++] = loc[k];
        }
      }
      pc.pos = Float32Array.from(P); pc.nrm = Float32Array.from(Nn); pc.idx = I; out.push(pc);
    });
    return out;
  };
  /* lines of the page: where a rounding starts (a grid line between two patches of one chart), and the
     sharp edges (chart borders that are creases) */
  skin.lines = () => {
    const seam = [], sharp = [], seg = (L, a, b2) => L.push(POS[3 * a], POS[3 * a + 1], POS[3 * a + 2], POS[3 * b2], POS[3 * b2 + 1], POS[3 * b2 + 2]);
    for (const C of charts) {
      const cell = (u, v) => regionKey(C.ci, (C.us[u] + C.us[u + 1]) / 2, (C.vs[v] + C.vs[v + 1]) / 2), RK = [];
      for (let v = 0; v + 1 < C.nw; v++) { const row = []; for (let u = 0; u + 1 < C.nu; u++) row.push(cell(u, v)); RK.push(row); }
      for (let v = 0; v + 1 < C.nw; v++) for (let u = 0; u + 1 < C.nu; u++) {
        if (u + 2 < C.nu && RK[v][u] !== RK[v][u + 1]) seg(seam, C.base + v * C.nu + u + 1, C.base + (v + 1) * C.nu + u + 1);
        if (v + 2 < C.nw && RK[v][u] !== RK[v + 1][u]) seg(seam, C.base + (v + 1) * C.nu + u, C.base + (v + 1) * C.nu + u + 1);
      }
      const crease = k => multi.has(grp[k]) && !smooth.has(grp[k]);
      const border = (k1, k2) => { if (crease(k1) && crease(k2)) seg(sharp, k1, k2); };
      for (let u = 0; u + 1 < C.nu; u++) { border(C.base + u, C.base + u + 1); border(C.base + (C.nw - 1) * C.nu + u, C.base + (C.nw - 1) * C.nu + u + 1); }
      for (let v = 0; v + 1 < C.nw; v++) { border(C.base + v * C.nu, C.base + (v + 1) * C.nu); border(C.base + v * C.nu + C.nu - 1, C.base + (v + 1) * C.nu + C.nu - 1); }
    }
    return { sharp, seam, open: [] };
  };
  return skin;
}

/* ── where the features of a body sit ──
   Every copy is placed by the rule of §9 on the whole host face (a box face, or the disk of a cap), not only
   on its flat part: when the edges are rounded, a feature near an edge goes over the rounding. Point features
   need their centre on the face. Each copy gets its anchor: the chart and the point of the sharp face (a box
   or a cylinder), or the direction from the centre (a sphere). */
const DEG = Math.PI / 180;
export const lonLatDir = (lon, lat) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
export const dirLonLat = d => { const l = Math.hypot(d[0], d[1], d[2]) || 1, z = Math.max(-1, Math.min(1, d[2] / l)); return Math.abs(z) > 1 - 1e-15 ? [0, z > 0 ? 90 : -90] : [Math.atan2(d[1], d[0]) / DEG, Math.asin(z) / DEG]; };
/* the direction "north" on a sphere at n, in a frame F (its z up; at its poles: towards its x) */
export function northAt(n, F) {
  let e = sub(F[2], mul(n, dot(F[2], n)));
  if (len(e) < 1e-9) e = sub(F[0], mul(n, dot(F[0], n)));
  return unit(e);
}
const WORLD = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function sharpRegion(b, host, t = 0) {     // the host face (t = 0) or its flat part (t = setback), in host (u, v)
  const H = host.frame, out = [];
  if (b.kind === 'box') {
    const m = 'xyz'.indexOf(host.key[0]), s = host.key[1] === 'p' ? 1 : -1, [i, j] = OA[m], h = b.size.map(x => x / 2);
    for (const [si, sj] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(toUV(H, add(add(add(b.c, mul(b.F[m], s * h[m])), mul(b.F[i], si * (h[i] - t))), mul(b.F[j], sj * (h[j] - t)))));
    return out;
  }
  const s = host.key === 'top' ? 1 : -1, cn = add(b.c, mul(b.F[2], s * b.size[1] / 2)), r = b.size[0] / 2 - t;
  for (let k = 0; k < 256; k++) { const a = 2 * Math.PI * k / 256; out.push(toUV(H, add(cn, add(mul(b.F[0], r * Math.cos(a)), mul(b.F[1], r * Math.sin(a)))))); }
  return out;
}
const inFrame = (F, v) => [F[0][0] * v[0] + F[1][0] * v[1] + F[2][0] * v[2], F[0][1] * v[0] + F[1][1] * v[1] + F[2][1] * v[2], F[0][2] * v[0] + F[1][2] * v[1] + F[2][2] * v[2]];
/* a sphere host: at=lon,lat in degrees, in the frame of its card (a= the pole, u= longitude 0; the file's axes
   when the card has none); a polar pattern: n copies at the distance rad (through space) around c, the first at
   phase degrees from north, turning counter-clockwise seen from outside */
function sphereInstances(b, host, issues, headerBlend) {
  const out = [], r = b.size[0] / 2, F = host.F || WORLD;
  for (const f of host.points) out.push({ id: f.id, src: f.id, dir: inFrame(F, lonLatDir(f.at[0], f.at[1])), R: f.R, path: f.path, blend: f.blend || headerBlend, order: f.order, host: host.name });
  for (const p of host.patterns) {
    if (p.lattice.type !== 'polar') { issues.push({ level: 'warn', msg: `pattern ${p.id}: on a sphere only lattice=polar is drawn — kept as written` }); continue; }
    const L = p.lattice, nc = inFrame(F, lonLatDir(L.c[0], L.c[1])), e1 = northAt(nc, F), e2 = cross(nc, e1), th = 2 * Math.asin(Math.min(1, L.rad / (2 * r)));
    for (let k = 0; k < L.n; k++) {
      const a = (L.phase + 360 * k / L.n) * DEG, tg = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
      out.push({ id: p.id + '.' + (k + 1), src: p.id, dir: unit(add(mul(nc, Math.cos(th)), mul(tg, Math.sin(th)))), R: p.R, path: p.path, blend: p.blend || p.tblend || headerBlend, order: p.order + k + 1, host: host.name });
    }
  }
  return out;
}
/* All feature copies of a body. byHost: per host name (for the exact drawing of flat faces); all: in file
   order, with anchors; flat: whether every copy, and every group of overlapping copies, stays inside the flat
   part of its face — then the exact drawing of §7.2 is used, otherwise the skin. */
/* ── wandering features (the animation of Snark_04) ──
   A copy's anchor as a direction from the body's centre, and back: on a box or a cylinder the anchor is where
   the ray along that direction meets the sharp body (a point of a face, a cap or the side), on a sphere the
   direction itself. Moving the direction moves the copy over the whole body, across edges and onto other faces. */
function localOf(b, d) { return [dot(d, b.F[0]), dot(d, b.F[1]), dot(d, b.F[2])]; }
export function anchorDir(b, f) {
  if (b.kind === 'sph') return unit(f.dir);
  let q;
  if (b.kind === 'box') { const m = f.ci >> 1, s = f.ci & 1 ? 1 : -1, H = b.size.map(x => x / 2); q = [0, 0, 0]; q[m] = s * H[m]; q[OA[m][0]] = f.cu; q[OA[m][1]] = f.cv; }
  else { const r = b.size[0] / 2, hh = b.size[1] / 2, c = Math.cos(f.cu), sn = Math.sin(f.cu); q = f.ci === 0 ? [r * c, r * sn, f.cv] : [f.cv * c, f.cv * sn, f.ci === 1 ? hh : -hh]; }
  return unit(add(add(mul(b.F[0], q[0]), mul(b.F[1], q[1])), mul(b.F[2], q[2])));
}
export function setAnchorDir(b, f, d) {
  if (b.kind === 'sph') { f.dir = unit(d); return f; }
  const q = localOf(b, d);
  if (b.kind === 'box') {
    const H = b.size.map(x => x / 2); let m = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(q[i]) * H[m] > Math.abs(q[m]) * H[i]) m = i;
    const l = H[m] / (Math.abs(q[m]) || 1e-300), [i, j] = OA[m], cl = (x, h) => Math.max(-h, Math.min(h, x));
    f.ci = 2 * m + (q[m] >= 0 ? 1 : 0); f.cu = cl(q[i] * l, H[i]); f.cv = cl(q[j] * l, H[j]);
    return f;
  }
  const r = b.size[0] / 2, hh = b.size[1] / 2, qxy = Math.hypot(q[0], q[1]);
  f.cu = Math.atan2(q[1], q[0]);
  if (Math.abs(q[2]) * r >= qxy * hh) { f.ci = q[2] >= 0 ? 1 : 2; f.cv = Math.min(r, qxy * hh / (Math.abs(q[2]) || 1e-300)); }
  else { f.ci = 0; f.cv = Math.max(-hh, Math.min(hh, q[2] * r / (qxy || 1e-300))); }
  return f;
}
/* how far the sharp body reaches from its centre along d */
export function bodyReach(b, d) {
  if (b.kind === 'sph') return b.size[0] / 2;
  const q = localOf(b, d);
  if (b.kind === 'box') { let best = Infinity; for (let i = 0; i < 3; i++) if (Math.abs(q[i]) > 1e-12) best = Math.min(best, b.size[i] / 2 / Math.abs(q[i])); return best; }
  const qxy = Math.hypot(q[0], q[1]); return Math.min(qxy > 1e-12 ? b.size[0] / 2 / qxy : Infinity, Math.abs(q[2]) > 1e-12 ? b.size[1] / 2 / Math.abs(q[2]) : Infinity);
}
const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/* Every copy walks over its body: it moves along its heading at its own speed (smaller copies faster), and the
   heading turns at a rate that changes smoothly and never repeats (two sines of unrelated frequencies), so the
   paths look chaotic, cross each other and go over edges and onto other faces. The same seed gives the same
   walk. reset() puts every copy back where the file has it. */
export function makeWander(b, insts, opts = {}) {
  const rnd = mulberry32(opts.seed || 1), base = opts.speed ?? 5, K = opts.turn ?? 0.9;
  const home = insts.map(f => ({ ci: f.ci, cu: f.cu, cv: f.cv, dir: f.dir && f.dir.slice() }));
  const start = () => insts.map(f => {
    const d = anchorDir(b, f), a = rnd() * 2 * Math.PI, e1 = unit(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(d, e1);
    return { f, d, v: add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), speed: base * (0.7 + 0.6 * rnd()) * Math.sqrt(5 / Math.max(1, f.R)),
      a1: 0.4 + 0.7 * rnd(), a2: 1.3 + rnd(), p1: 2 * Math.PI * rnd(), p2: 2 * Math.PI * rnd() };
  });
  const wd = { time: 0, items: start() };
  wd.step = dt => {
    if (!(dt > 0)) return wd;
    wd.time += dt; const T = wd.time;
    for (const w of wd.items) {
      const th = w.speed * dt / bodyReach(b, w.d), c = Math.cos(th), sn = Math.sin(th);
      const d = unit(add(mul(w.d, c), mul(w.v, sn)));
      let v = sub(mul(w.v, c), mul(w.d, sn)); v = unit(sub(v, mul(d, dot(v, d))));
      const k = K * (Math.sin(w.a1 * T + w.p1) + 0.7 * Math.sin(w.a2 * T + w.p2)) * dt, nn = cross(d, v);
      w.d = d; w.v = unit(add(mul(v, Math.cos(k)), mul(nn, Math.sin(k)))); setAnchorDir(b, w.f, d);
    }
    return wd;
  };
  wd.reset = () => { insts.forEach((f, i) => { f.ci = home[i].ci; f.cu = home[i].cu; f.cv = home[i].cv; if (home[i].dir) f.dir = home[i].dir.slice(); }); wd.time = 0; wd.items = start(); return wd; };
  return wd;
}

export function bodyInstances(b, issues) {
  const hosts = Object.values(b.hosts || {}); if (!hosts.length) return null;
  const t = b.kind === 'sph' ? 0 : (b.edgeKeys && b.edgeKeys.length && b.edgePath ? b.edgePath.start[0] : 0);
  const byHost = {}, all = []; let flat = b.kind !== 'sph';
  for (const host of hosts) {
    let inst;
    if (b.useFrozen && host.frozen) inst = host.frozen;
    else {
      inst = b.kind === 'sph' ? sphereInstances(b, host, issues, b.headerBlend) : placeFeatures(host, sharpRegion(b, host), issues, b.headerBlend, 'skin');
      for (const f of inst) f.host = host.name;
      host.frozen = inst;
    }
    byHost[host.name] = inst;
    if (b.kind !== 'sph') {
      const Hf = host.frame;
      for (const f of inst) {
        const P = hostPoint(Hf, f.c[0], f.c[1], 0), d = sub(P, b.c);
        if (b.kind === 'box') { const m = 'xyz'.indexOf(host.key[0]), s = host.key[1] === 'p' ? 1 : -1; f.ci = 2 * m + (s > 0 ? 1 : 0); f.cu = dot(d, b.F[OA[m][0]]); f.cv = dot(d, b.F[OA[m][1]]); }
        else { const x = dot(d, b.F[0]), y = dot(d, b.F[1]); f.ci = host.key === 'top' ? 1 : 2; f.cu = Math.atan2(y, x); f.cv = Math.hypot(x, y); }
      }
      if (flat) {
        const Q = sharpRegion(b, host, t);
        if (b.kind === 'box' && b.size.some((x, k) => k !== 'xyz'.indexOf(host.key[0]) && x / 2 - t < 1e-9)) flat = false;
        else if (b.kind === 'cyl' && b.size[0] / 2 - t < 1e-9) flat = false;
        else if (inst.some(f => insideDist(Q, f.c) < f.R + 1e-6) || groupFeatures(inst).some(g => insideDist(Q, g.c) < g.R + 1e-6)) flat = false;
      }
    }
    all.push(...inst);
  }
  all.sort((x, y) => x.order - y.order);
  return { byHost, all, flat };
}
const SKINS = new Map();
export function skinPieces(b, chord, issues, insts) {
  const t = b.edgeKeys && b.edgeKeys.length && b.edgePath && b.kind !== 'sph' ? b.edgePath.start[0] : 0, scale = b.featureScale ?? 1;
  const key = JSON.stringify([b.kind, b.c, b.F, b.size, [...(b.edgeKeys || [])].sort(), b.edgePath ? pathText(b.edgePath) : '', t, chord, scale,
    insts.map(f => [f.id, f.R, f.ci, f.cu, f.cv, f.dir, pathText(f.path), blendText(f.blend), f.host])]);
  const hit = SKINS.get(key);
  if (hit) { SKINS.delete(key); SKINS.set(key, hit); issues.push(...hit.notes); return hit.pieces; }
  const notes = [], sk = makeSkin(b, chord, notes, insts).update(t, scale), pieces = sk.pieces();
  Object.defineProperty(pieces, 'skin', { value: sk, enumerable: false });
  SKINS.set(key, { pieces, notes }); while (SKINS.size > 6) SKINS.delete(SKINS.keys().next().value);
  issues.push(...notes);
  return pieces;
}

export function evalBox(b, chord, issues = []) {
  const pieces = [], { c, F, size } = b, H = size.map(x => x / 2);
  const keys = new Set(b.edgeKeys || []);
  const t = keys.size && b.edgePath ? b.edgePath.start[0] : 0;
  const fx = bodyInstances(b, issues);       // features: on the flat parts only → exact rings; anywhere else → the skin
  if (fx && (b.forceSkin || !fx.flat)) return skinPieces(b, chord, issues, fx.all);
  const L = t > 0 ? quadRuns(b.edgePath, chord / 2) : null;   // shared by bars and corners, so seams match
  const W = (q, s) => { let p = c.slice(); for (let m = 0; m < 3; m++) p = add(p, mul(F[m], s[m] * ((H[m] - t) + t * q[m]))); return p; };
  const WN = (n, s) => { let v = [0, 0, 0]; for (let m = 0; m < 3; m++) v = add(v, mul(F[m], s[m] * n[m])); return v; };
  const eps = 1e-12;
  // face centres
  for (let m = 0; m < 3; m++) for (const s of [-1, 1]) {
    const [i, j] = otherAxes(m), host = b.hosts && b.names && b.hosts[b.names[faceId(m, s)]];
    if (H[i] - t < eps || H[j] - t < eps) { if (host) issues.push({ level: 'warn', msg: `face ${host.name} has no flat part left: its features are not drawn` }); continue; }
    const corner = (si, sj) => { const q = [0, 0, 0], ss = [1, 1, 1]; q[m] = 1; ss[m] = s; ss[i] = si; ss[j] = sj; return W(q, ss); };
    if (host) {
      try {
        const r = featuredFace(host.frame, [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], host, chord, { kind: 'face', m, s },
          b.featureScale ?? 1, issues, b.headerBlend, fx.byHost[host.name]);
        pieces.push(...r.pieces); continue;
      } catch (e) { issues.push({ level: 'error', msg: `features on ${host.name}: ${e.message} — the face is drawn without them` }); }
    }
    const pc = newPiece({ kind: 'face', m, s }, 'plane');
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
      else if (A.tag === 'curve') { role = B.tag === 'sq1' ? { kind: 'edge', key: ekey(a3, s) } : { kind: 'face', m: a3, s: s[a3] }; type = B.tag === 'sq1' ? 'edge' : 'plane'; }
      else if (B.tag === 'curve') { role = A.tag === 'sq1' ? { kind: 'edge', key: ekey(a2, s) } : { kind: 'edge', key: ekey(a1, s) }; type = 'edge'; }
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

export function evalCyl(b, chord, issues = []) {
  const pieces = [], { c, F, size } = b, r = size[0] / 2, hh = size[1] / 2;
  const keys = new Set(b.edgeKeys || []), t = keys.size && b.edgePath ? b.edgePath.start[0] : 0;
  const fx = bodyInstances(b, issues);
  if (fx && (b.forceSkin || !fx.flat)) return skinPieces(b, chord, issues, fx.all);
  const L = t > 0 ? quadRuns(b.edgePath, chord / 2) : null, n = angularSegments(r, t > 0 ? chord / 2 : chord);
  const rad = k => { const a = 2 * Math.PI * k / n; return add(mul(F[0], Math.cos(a)), mul(F[1], Math.sin(a))); };
  for (const s of [1, -1]) {
    const key = s > 0 ? 'top' : 'bottom';
    const host = b.hosts && b.names && b.hosts[b.names[key]];
    let done = false;
    if (r - t > 1e-12 && host) {
      const cn = add(c, mul(F[2], s * hh)), outer = [];
      for (let k = 0; k < n; k++) outer.push(add(cn, mul(rad(k), r - t)));
      try {
        const res = featuredFace(host.frame, outer, host, chord, { kind: 'cap', key }, b.featureScale ?? 1, issues, b.headerBlend, fx.byHost[host.name]);
        pieces.push(...res.pieces); done = true;
      } catch (e) { issues.push({ level: 'error', msg: `features on ${host.name}: ${e.message} — the cap is drawn without them` }); }
    } else if (host) issues.push({ level: 'warn', msg: `cap ${host.name} has no flat part left: its features are not drawn` });
    if (r - t > 1e-12 && !done) {
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

export function evalSph(b, chord, issues = []) {
  const fx = bodyInstances(b, issues);
  if (fx && fx.all.length) return skinPieces(b, chord, issues, fx.all);
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
      pieces = b.kind === 'box' ? evalBox(b, chord, issues) : b.kind === 'cyl' ? evalCyl(b, chord, issues) : b.kind === 'sph' ? evalSph(b, chord, issues) : evalStored(doc, b);
    } catch (e) { issues.push({ level: 'error', msg: 'evaluation failed: ' + e.message }); pieces = evalStored(doc, b); }
    out.push({ body: b, pieces, issues, tris: pieces.reduce((s, p) => s + p.idx.length / 3, 0), skin: pieces.skin || null });
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
      if (role.kind === 'feature') { const ids = role.id.split('+'); return (role.host + '_' + (ids.length > 2 ? ids[0] + '_and_' + (ids.length - 1) + '_more' : role.id)).replace(/[^\w.+-]/g, '_'); }   // a blended group: its first member
      return role.patch;
    };
    for (const pc of pieces) { const nm = nameOf(pc.role); if (!groups.has(nm)) groups.set(nm, { role: pc.role, pieces: [] }); groups.get(nm).pieces.push(pc); }
    const m = weld(pieces), vbase = doc.pos.length / 3;
    for (let i = 0; i < m.pos.length; i++) doc.pos.push(m.pos[i]);      // not push(...): a skin has more points than a call may take
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
      else if (role.kind === 'feature') card = { type: 'free' };
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
  const FX = readFeatures(base);
  if (FX.unsupported.length) notes.push(`${FX.unsupported.length} feature line(s) that this reader does not draw were left out: ${FX.unsupported.map(u => u.id).join(', ')}`);
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
