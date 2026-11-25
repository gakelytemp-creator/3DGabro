/* SnarkScan_10: each bore drawn as one thing — its steps as one coloured bore with the shelves between them, the
   depth no side saw as a faint shell, and its axis as a centre line (long dash and dot, as on a drawing). */
function c10DrawBores(R, bores, vw) {
  const hues = [0.75, 0.58, 0.08, 0.33, 0.92, 0.5, 0.15, 0.66], N = 64;
  bores.forEach((b, bi) => {
    const a = b.a, d = b.d, t = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = [d[1] * t[2] - d[2] * t[1], d[2] * t[0] - d[0] * t[2], d[0] * t[1] - d[1] * t[0]]; const l1 = Math.hypot(...e1); e1 = e1.map(v => v / l1);
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
    const rad = th => [0, 1, 2].map(i => Math.cos(th) * e1[i] + Math.sin(th) * e2[i]);
    const P = (s, r, th) => { const u = rad(th); return [0, 1, 2].map(i => a[i] + s * d[i] + r * u[i]); };
    const col = new THREE.Color().setHSL(hues[bi % hues.length], 0.65, 0.5);
    const mesh = (p, n, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); if (n) g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); else g.computeVertexNormals(); R.add(new THREE.Mesh(g, mat)); };
    const tube = (s0, s1, r, mat) => { const p = [], n = []; for (let q = 0; q < N; q++) { const u = 2 * Math.PI * q / N, v = 2 * Math.PI * (q + 1) / N, nu = rad(u), nv = rad(v); p.push(...P(s0, r, u), ...P(s0, r, v), ...P(s1, r, v), ...P(s0, r, u), ...P(s1, r, v), ...P(s1, r, u)); n.push(...nu, ...nv, ...nv, ...nu, ...nv, ...nu); } mesh(p, n, mat); };
    const ring = (s, r0, r1, mat) => { const p = []; for (let q = 0; q < N; q++) { const u = 2 * Math.PI * q / N, v = 2 * Math.PI * (q + 1) / N; p.push(...P(s, r0, u), ...P(s, r1, u), ...P(s, r1, v), ...P(s, r0, u), ...P(s, r1, v), ...P(s, r0, v)); } mesh(p, null, mat); };
    const st = b.raw.steps.map(x => ({ t0: x.t0 - 0.25, t1: x.t1 + 0.25, r: x.d / 2 }));
    if (vw.bores) {
      const solid = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
      const faint = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
      st.forEach((x, i) => { tube(x.t0, x.t1, x.r, solid); const y = st[i + 1]; if (y && y.t0 - x.t1 < 1.2 && Math.abs(y.r - x.r) > 0.2) ring((x.t1 + y.t0) / 2, Math.min(x.r, y.r), Math.max(x.r, y.r), solid); });
      for (let i = 0; i + 1 < st.length; i++) if (st[i + 1].t0 - st[i].t1 >= 1.2) tube(st[i].t1, st[i + 1].t0, Math.min(st[i].r, st[i + 1].r), faint);   // depth between two measured steps: unseen, drawn faint
    }
    if (vw.axes) {
      const s0 = (st.length ? st[0].t0 : b.raw.t0) - 4, s1 = (st.length ? st[st.length - 1].t1 : b.raw.t1) + 4;
      for (const [dash, gap] of [[3, 1.5]]) { const L = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...P(s0, 0, 0)), new THREE.Vector3(...P(s1, 0, 0))]), new THREE.LineDashedMaterial({ color: 0x1f6fd1, dashSize: dash, gapSize: gap, depthTest: false })); L.computeLineDistances(); L.renderOrder = 10; R.add(L); }
    }
  });
}
