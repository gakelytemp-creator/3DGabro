// Tests of the editor page itself in a headless browser: every control, write ⇄ read, Boojum, examples, exports.
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
// three.js is loaded from the CDN; if three@0.180.0 is installed locally (npm i three@0.180.0), or
// SNARK_NODE_MODULES points to a node_modules folder that has it, the CDN requests are served from there.
//   node Snark-Editor/src/test_page.cjs [Snark_05.html]
// Set SHOTS=<folder> to also save screenshots.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const PAGE = path.resolve(__dirname, '..', process.argv[2] || 'Snark_05.html');
const EXAMPLES = path.resolve(__dirname, '../../standards/snark/examples');
const SHOTS = process.env.SHOTS || '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snark-page-'));
function localModules() {
  if (process.env.SNARK_NODE_MODULES) return process.env.SNARK_NODE_MODULES;
  try { return path.resolve(path.dirname(require.resolve('three/package.json', { paths: [__dirname, process.cwd()] })), '..'); } catch { return null; }
}
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true, colorScheme: 'light' });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const NM = localModules();
  if (NM) await page.route('https://cdn.jsdelivr.net/npm/**', route => {
    let p = new URL(route.request().url()).pathname.replace('/npm/', '').replace(/^((?:@[^/]+\/)?[^/@]+)@[^/]+/, '$1');
    const f = path.join(NM, p);
    if (!fs.existsSync(f)) { errs.push('MISSING ' + p); return route.abort(); }
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('file://' + PAGE);
  await page.waitForFunction(() => window.__snark && window.__snark.PIPE, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const DEMO = await page.evaluate(() => __snark.PIPE.text);
  // the scenes of Snark_01 (no features) and Snark_02 (a boss on the cylinder), for checks that need a light scene
  const lightScene = boss => page.evaluate(boss => { const S = __snark, keys = []; for (const ax of '012') for (const a of '-+') for (const b of '-+') keys.push(ax + a + b);
      const objects = [{ id: 1, kind: 'box', name: '', size: [40, 40, 40], p: [30, 30, 20], rot: [0, 0, 0], edge: { rule: 'spline', t: 6, k: 0.55, keys }, features: [] },
        { id: 2, kind: 'cyl', name: '', size: [36, 40], p: [87, 30, 20], rot: [0, 0, 0], edge: { rule: 'spline', t: 6, k: 0.8, keys: ['top', 'bottom'] }, features: boss ? [{ face: 'top', at: [0, 0], shape: { kind: 'boss', R: 8, h: 4, k: 1 }, blend: null, pattern: null }] : [] },
        { id: 3, kind: 'sph', name: '', size: [40], p: [145, 30, 20], rot: [0, 0, 0], edge: { rule: 'sharp', t: 2, k: 0.55, keys: [] }, features: [] }];
      objects.forEach(o => o.q = [0, 0, 0, 1]);
      S.loadText(S.writeSnark(S.buildDoc({ meta: { title: boss ? 'the scene of Snark_02' : 'the scene of Snark_01' }, objects }))); S.camera.position.set(260, 230, 170); S.controls.target.set(80, 30, 15); S.controls.update(); }, boss);
  const st = () => page.evaluate(() => { const P = __snark.PIPE; return { n: P.ev.bodies.length, tris: P.ev.bodies.map(b => b.tris), rt: P.textStable && P.objectsSame,
    issues: P.issues.map(i => i.level + ': ' + i.msg), open: P.ev.bodies.map(b => b.lineStats ? b.lineStats.open : -1), sel: __snark.SEL,
    objs: __snark.S.objects.map(o => ({ id: o.id, kind: o.kind, size: o.size, p: o.p, edge: { rule: o.edge.rule, t: o.edge.t, k: o.edge.k, n: o.edge.keys.length } })),
    text: P.text, status: document.getElementById('status').textContent }; });
  const setNum = async (id, v) => { await page.fill('#' + id, String(v)); await page.press('#' + id, 'Enter'); await page.waitForTimeout(80); };
  const readIssues = () => page.evaluate(() => (__snark.READ ? __snark.READ.issues : []).map(i => i.level + ': ' + i.msg));

  // A. start: a cube, a cylinder and a sphere
  let s = await st();
  ok(s.n === 3 && s.rt && s.issues.length === 0 && s.open.every(x => x === 0), `start: 3 bodies, write ⇄ read ok, no remarks, no holes (${s.tris.join(' + ')} triangles)`);
  await shot('start');
  // B. selection from the list
  await page.click('#objectStrip .chip >> nth=0'); s = await st();
  ok(s.sel === 1 && await page.isVisible('#bEdge'), 'a click on the list selects the cube; the inspector shows');
  ok(await page.$eval('#eRule', e => e.value) === 'spline' && await page.$eval('#eT', e => e.value) === '6' && await page.$eval('#eK', e => e.value) === '0.55', 'inspector: spline, setback 6, fullness 0.55');
  // C. edge rules
  await page.selectOption('#eRule', 'round'); s = await st();
  ok(/#@edge b1_front b1_bottom round:6/.test(s.text) && !/#@profile b1_edge/.test(s.text) && s.rt && s.open[0] === 0, 'round: the file says round:6, no profile line; closed');
  await page.selectOption('#eRule', 'chamfer'); s = await st();
  ok(/#@edge b1_front b1_bottom chamfer:6/.test(s.text) && s.rt && s.open[0] === 0, `chamfer: the file says chamfer:6 (${s.tris[0]} triangles); closed`);
  await page.selectOption('#eRule', 'spline'); await setNum('eK', '0.9'); await setNum('eT', '8'); s = await st();
  ok(/#@profile b1_edge start=8,0 C 0\.8,0 0,-0\.8 0,-8/.test(s.text) && s.rt && s.open[0] === 0, 'spline 8 / 0.9 → #@profile b1_edge start=8,0 C 0.8,0 0,-0.8 0,-8');
  await setNum('eT', '25'); s = await st();
  ok(s.objs[0].edge.t === 20, 'setback 25 on a 40 mm cube is limited to 20 (half the smallest size)');
  await setNum('eT', '4'); await setNum('eK', '0,55'); s = await st();
  ok(s.objs[0].edge.k === 0.55, 'a decimal comma is accepted (0,55)');
  await page.selectOption('#eSet', 'vertical'); s = await st();
  ok((s.text.match(/#@edge b1_/g) || []).length === 4 && s.rt && s.open[0] === 0, 'vertical edges only: 4 edge lines; closed');
  await page.selectOption('#eSet', 'topvert'); s = await st();
  ok((s.text.match(/#@edge b1_/g) || []).length === 8 && s.rt && s.open[0] === 0, 'top + vertical: 8 edge lines; closed');
  await page.selectOption('#eSet', 'all');
  // D. size, position, rotation
  await setNum('s0', '70'); await setNum('p0', '45'); await setNum('r2', '30'); s = await st();
  ok(s.objs[0].size[0] === 70 && s.objs[0].p[0] === 45 && /#@recipe 1 solid box x=70 y=40 z=40 p=45,30,20 q=0,0,0\.258819045,0\.965925826/.test(s.text) && s.rt && s.issues.length === 0,
    'size 70, x 45, turned 30° about Z: the recipe has q; round trip ok');
  await setNum('r0', '10'); await setNum('r1', '-20'); s = await st();
  ok(s.rt && s.issues.length === 0 && s.open[0] === 0, 'turned about three axes: round trip ok, closed');
  ok((await page.evaluate(() => ['r0', 'r1', 'r2'].map(i => document.getElementById(i).value))).join() === '10,-20,30', 'the rotation boxes show 10, -20, 30 after the round trip');
  // E. undo / redo
  for (let i = 0; i < 3; i++) await page.click('#undo'); s = await st();
  ok(s.objs[0].size[0] === 70 && !/q=/.test(s.text.split('\n').find(l => l.startsWith('#@recipe 1'))), 'undo ×3 takes back the three rotations');
  await page.click('#redo'); s = await st(); ok(/#@recipe 1 .* q=/.test(s.text), 'redo brings one back');
  // F. picking in the scene
  const scr = await page.evaluate(() => { const c = __snark.camera, r = __snark.canvas.getBoundingClientRect(), v = new (__snark.THREE.Vector3)(87, 30, 20).project(c); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
  await page.mouse.click(scr.x, scr.y); s = await st();
  ok(s.sel === 2, 'a click on the cylinder in the scene selects it');
  await page.selectOption('#eSet', 'top'); s = await st();
  ok((s.text.match(/#@edge b2_/g) || []).length === 1 && s.rt && s.open[1] === 0, 'cylinder: top rim only → one edge line; closed');
  await page.selectOption('#eRule', 'chamfer'); await setNum('eT', '3'); s = await st();
  ok(/#@edge b2_top b2_side chamfer:3/.test(s.text) && s.rt, 'cylinder: top rim chamfer 3');
  // G. tools
  await page.click('#tBox'); await page.click('#tCyl'); await page.click('#tSph'); s = await st();
  ok(s.n === 6 && s.rt && s.issues.length === 0 && s.open.every(x => x === 0), 'three new bodies: 6 bodies, round trip ok, all closed');
  await page.click('#tDup'); s = await st(); ok(s.n === 7 && s.sel === 7 && s.rt, 'copy of the selected sphere');
  await page.keyboard.press('Delete'); s = await st(); ok(s.n === 6 && s.sel === null, 'Delete removes the selected body');
  await page.keyboard.press('Control+z'); s = await st(); ok(s.n === 7, 'Ctrl+Z brings it back');
  // H. editing the text: a recipe that disagrees with the cards is a Boojum
  await page.click('#fileMenu > summary'); await page.click('#mDemo'); s = await st(); ok(s.n === 3 && s.objs[0].size[0] === 40, 'demo scene again');
  let txt = await page.inputValue('#text');
  await page.fill('#text', txt.replace('#@recipe 1 solid box x=40', '#@recipe 1 solid box x=45'));
  ok(!(await page.isDisabled('#textApply')), 'editing the text enables Apply');
  await page.click('#textApply'); s = await st();
  const rd = await readIssues(), issuesText = await page.$eval('#issues', e => e.textContent);
  ok(rd.length === 1 && rd[0].startsWith('boojum') && /ბუჯუმი/.test(s.status) && /რეცეპტის ნაბიჯი 1 და ბარათები ერთმანეთს ეწინააღმდეგება/.test(issuesText),
    `recipe x=45 against 40 mm cards: one Boojum when reading, shown in Georgian (${rd[0]})`);
  ok(s.objs[0].size[0] === 45 && s.rt && s.issues.length === 0, 'source=design: the recipe is followed (45); the file written back agrees with itself');
  await shot('boojum');
  await page.click('#fileMenu > summary'); await page.click('#mDemo');
  txt = await page.inputValue('#text');
  await page.fill('#text', txt.replace('#@edge b2_bottom b2_side profile:b2_edge', '#@edge b2_bottom b2_side round:3')); await page.click('#textApply');
  ok((await readIssues()).some(i => /different rules/.test(i)) && /ერთ სხეულზე ერთ წესს/.test(await page.$eval('#issues', e => e.textContent)), 'two rules on one cylinder: warned when reading (one rule per body)');
  // I. the examples of the standard
  for (const f of ['plate_bump', 'plate_hole']) {
    await page.evaluate(t => __snark.loadText(t), fs.readFileSync(path.join(EXAMPLES, f + '.snark'), 'utf8')); s = await st();
    console.log(`      ${f}: bodies ${s.n}; editable ${s.objs.map(o => o.kind + ' ' + o.size.join('x') + ' ' + o.edge.rule + ':' + o.edge.t + ' on ' + o.edge.n).join('; ') || '-'}; ${s.tris.join(' + ')} triangles`);
    ok(s.rt && s.open.every(x => x === 0), `${f}: opens, round trip ok, closed`);
    await shot(f);
  }
  // J. precision and the plain-OBJ view
  await page.click('#fileMenu > summary'); await page.click('#mDemo');
  await page.selectOption('#chord', '0.001'); s = await st();
  ok(s.tris.reduce((a, b) => a + b, 0) > 200000 && s.open.every(x => x === 0), `precision 0.001 mm: ${s.tris.reduce((a, b) => a + b, 0)} triangles, closed`);
  console.log(`      full rebuild at 0.001 mm: ${(await page.evaluate(() => { const t0 = performance.now(); __snark.rebuild(); return performance.now() - t0; })).toFixed(0)} ms`);
  await page.selectOption('#chord', '0.5'); s = await st(); ok(s.open.every(x => x === 0), `precision 0.5 mm: ${s.tris.reduce((a, b) => a + b, 0)} triangles, closed`);
  await page.selectOption('#chord', '0.05');
  await page.click('#viewMenu > summary'); await page.check('input[name=mode][value=obj]'); await page.keyboard.press('Escape');
  ok(!(await page.$eval('#viewMenu', e => e.open)) && /L0/.test((await st()).status), 'plain-OBJ view (L0) on; Escape closes the menu');
  await shot('L0');
  await page.click('#viewMenu > summary'); await page.check('input[name=mode][value=snark]'); await page.keyboard.press('Escape');
  // K. files
  const dl = async id => { await page.click('#fileMenu > summary'); const [d] = await Promise.all([page.waitForEvent('download'), page.click(id)]); const p = path.join(TMP, d.suggestedFilename()); await d.saveAs(p); return p; };
  const p1 = await dl('#mSave'); s = await st(); ok(fs.readFileSync(p1, 'utf8') === s.text, 'Save writes exactly the text shown');
  const fin = fs.readFileSync(await dl('#mObj'), 'utf8'), stl = fs.readFileSync(await dl('#mStl'));
  const r = await page.evaluate(t => { const S = __snark, d = S.parseSnark(t), rec = S.recognise(d), ev = S.evaluate(d, 0.05, rec), m = ev.bodies.map(b => S.meshStats(S.weld(b.pieces))), cards = {};
    for (const p of d.patches.values()) { const k = p.card ? p.card.type : 'none'; cards[k] = (cards[k] || 0) + 1; }
    return { issues: d.issues, open: m.map(x => x.open), vol: m.map(x => +x.volume.toFixed(2)), cards }; }, fin);
  const nStl = stl.readUInt32LE(80);
  ok(r.issues.length === 0 && r.open.every(x => x === 0) && stl.length === 84 + 50 * nStl, `final .obj reads back closed (volumes ${r.vol.join(', ')}; cards ${JSON.stringify(r.cards)}); STL ${nStl} triangles`);
  // L. the animation for showing (from Snark_01): bodies turn, edge setback 1 → 20 → 1 mm
  if (await page.$('#bAnim')) {
    if (await page.evaluate(() => !!__snark.makeSkin)) await lightScene(false);
    const before = await page.evaluate(() => ({ text: __snark.PIPE.text, cam: __snark.camera.position.toArray(), side: document.getElementById('side').classList.contains('open') }));
    await page.click('#bAnim'); await page.waitForTimeout(1200);
    const a = await page.evaluate(() => ({ on: __snark.ANIM.on, v: __snark.ANIM.value, box: !document.getElementById('animBox').classList.contains('hide'), side: document.getElementById('side').classList.contains('open') }));
    ok(a.on && a.v >= 1 && a.v <= 20 && a.box && !a.side, `animation runs: setback ${a.v.toFixed(2)} mm, readout shown, side panel closed`);
    const vals = []; for (let i = 0; i < 4; i++) { await page.waitForTimeout(400); vals.push(await page.evaluate(() => __snark.ANIM.value)); }
    ok(vals.every((v, i) => v >= 1 && v <= 20 && (i === 0 || v > vals[i - 1])), 'the setback grows in the first half period: ' + vals.map(v => v.toFixed(1)).join(' '));
    const ball = await page.evaluate(() => { const S = __snark, keys = []; for (const ax of '012') for (const a of '-+') for (const b of '-+') keys.push(ax + a + b);
      // a plain 40 mm cube at the end of the animation: setback 20
      const d = S.parseSnark(S.writeSnark(S.buildDoc({ meta: {}, objects: [{ id: 1, kind: 'box', name: '', size: [40, 40, 40], p: [0, 0, 0], rot: [0, 0, 0], q: [0, 0, 0, 1], edge: { rule: 'spline', t: 20, k: 0.55, keys }, features: [] }] })));
      const e = S.evaluate(d, 0.05), b = e.bodies[0].body; let dv = 0;
      for (const pc of e.bodies[0].pieces) for (let i = 0; i < pc.pos.length; i += 3) dv = Math.max(dv, Math.abs(Math.hypot(pc.pos[i] - b.c[0], pc.pos[i + 1] - b.c[1], pc.pos[i + 2] - b.c[2]) - 20));
      const ms = []; for (const tv of [1, 20]) { const t0 = performance.now(); S.animDraw(S.animBodies(tv, 0.3, true)); ms.push(performance.now() - t0); } return { d: dv, ms }; });
    ok(ball.d < 0.1, `at setback 20 a 40 mm cube is a ball of radius 20 (largest deviation ${ball.d.toFixed(4)} mm, the spline k=0.55 against a circle)`);
    console.log(`      one frame with every body moved: ${ball.ms.map(x => x.toFixed(1)).join(' and ')} ms at setback 1 and 20`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ on: __snark.ANIM.on, text: __snark.PIPE.text, cam: __snark.camera.position.toArray(), side: document.getElementById('side').classList.contains('open') }));
    ok(!after.on && after.text === before.text && after.side === before.side && after.cam.every((v, k) => Math.abs(v - before.cam[k]) < 1e-6), 'Escape stops it; the file, camera and side panel are as before');
  }
  // L2. features (from Snark_02): placing with a click, shapes, repeats, blend rules, picking, undo, the animation, example 1
  if (await page.$('#featRow')) {
    await page.keyboard.press('Escape');
    await lightScene(true);
    await page.waitForTimeout(200);
    const fs_ = () => page.evaluate(() => { const S = __snark, P = S.PIPE; return { rt: P.textStable && P.objectsSame, text: P.text, issues: P.issues.concat(P.evIssues || []).map(i => i.msg),
      open: P.ev.bodies.map(b => b.lineStats ? b.lineStats.open : -1), feats: S.S.objects.map(o => (o.features || []).length), cubeF: (S.S.objects[0].features || []).map(f => JSON.parse(JSON.stringify(f))),
      fsel: S.FSEL, place: !!S.PLACE, copies: P.rec.bodies.map(b => Object.values(b.hosts || {}).reduce((n, h) => n + (h.frozen || []).length, 0)), rowHidden: document.getElementById('featRow').classList.contains('hide') }; });
    const scr = p => page.evaluate(p => { const c = __snark.camera, r = __snark.canvas.getBoundingClientRect(), v = new (__snark.THREE.Vector3)(...p).project(c); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, p);
    const closed = f => f.rt && f.open.every(x => x === 0);
    await page.click('#objectStrip .chip >> nth=0');
    let f = await fs_(); ok(!f.rowHidden && f.feats[0] === 0, 'features: the cube is selected, the feature row shows, no features yet');
    await page.click('#fAdd'); f = await fs_(); ok(f.place && await page.isVisible('#fHint'), '＋ waits for a click on a flat face (hint shown)');
    let pt = await scr([24, 36, 40]); await page.mouse.click(pt.x, pt.y); f = await fs_(); const f0 = f.cubeF[0];
    ok(f.feats[0] === 1 && f0.face === 'zp' && Math.abs(f0.at[0] - 14) < 1.5 && Math.abs(f0.at[1] - 26) < 1.5 && closed(f) && /#@feature b1_f1 point host=b1_top at=/.test(f.text), `a click on the top face puts a dome there (at ${f0 && f0.at}); write ⇄ read same; closed`);
    await shot('feature_dome');
    await setNum('fU', 20); await setNum('fV', 20); await setNum('fR', 10); await setNum('fH', 5); await setNum('fK', '0,6'); f = await fs_();
    ok(/#@profile b1_f1p start=0,5 C 6,5 4,0 10,0/.test(f.text) && closed(f), 'dome R10 h5 fullness 0.6 at the centre of the face → #@profile b1_f1p start=0,5 C 6,5 4,0 10,0');
    await page.selectOption('#fShape', 'boss'); await setNum('fK', 30); f = await fs_(); ok(/#@profile b1_f1p start=0,5 L /.test(f.text) && f.cubeF[0].shape.k === 2.5 && closed(f), 'boss: rounding 30 is limited to what the shape allows (2.5 = h/2); file and object agree; closed');
    await page.selectOption('#fShape', 'crater'); await setNum('fH', 3); f = await fs_(); ok(closed(f), 'crater: closed');
    await page.selectOption('#fShape', 'dome'); await setNum('fH', -4); f = await fs_(); ok(closed(f) && /start=0,-4/.test(f.text), 'a dome with h −4 is a dimple');
    await setNum('fH', 2); await setNum('fR', 3);
    await page.selectOption('#fRep', 'grid'); f = await fs_();
    ok(closed(f) && f.copies[0] > 1 && /#@pattern b1_f1g host=b1_top feature=b1_f1 lattice=rect a=7.5,0 b=0,7.5 origin=20,20 region=all/.test(f.text), `grid: pitch 2.5R = 7.5, ${f.copies[0]} copies; closed`);
    await page.selectOption('#fRep', 'hex'); f = await fs_(); ok(closed(f), `honeycomb: ${f.copies[0]} copies; closed`);
    await page.selectOption('#fRep', 'polar'); await setNum('fP1', 8); await setNum('fP2', 10); f = await fs_();
    ok(closed(f) && f.copies[0] === 8 && /lattice=polar c=20,20 n=8 rad=10/.test(f.text), '8 copies on a circle of radius 10');
    await setNum('fP2', 4);
    for (const b of ['sum', 'mix1', 'mix0', 'max', 'min']) { await page.selectOption('#fBlend', b); f = await fs_(); ok(closed(f) && (b === 'min') === f.issues.some(m => /blend min is for pockets/.test(m)), `overlapping copies, blend ${b}: closed${b === 'min' ? '; reported: min is for pockets' : ''}`); }
    await page.selectOption('#fBlend', 'mix1'); await shot('feature_blend');
    await page.selectOption('#fRep', 'none'); await setNum('fR', 30); f = await fs_();
    const big = await page.evaluate(() => !!__snark.PIPE.ev.bodies[0].skin);
    ok(f.open[0] === 0 && f.rt && (big || /ბრტყელ ნაწილს სცდება/.test(await page.$eval('#issues', e => e.textContent))),
      big ? 'R 30, larger than the face: it goes over the edges (drawn by the skin), closed' : 'R 30 does not fit on the face: warned in Georgian, not drawn, still closed');
    await setNum('fR', 8); await page.selectOption('#fFace', 'xp'); f = await fs_();
    ok(f.cubeF[0].face === 'xp' && f.cubeF[0].at[0] === 20 && f.cubeF[0].at[1] === 20 && closed(f), 'face +X: the feature moves to its centre');
    await page.click('#fAdd'); pt = await scr([25, 50, 25]); await page.mouse.click(pt.x, pt.y); f = await fs_();
    ok(f.feats[0] === 2 && f.fsel === 1 && f.cubeF[1].face === 'yp', 'a second feature on face +Y, selected');
    pt = await scr([50, 30, 20]); await page.mouse.click(pt.x, pt.y); f = await fs_(); ok(f.fsel === 0, 'a click on the first feature in the scene selects it');
    await page.click('#fAdd'); pt = await scr([50, 50, 39]); await page.mouse.click(pt.x, pt.y); f = await fs_();
    ok(f.place && f.feats[0] === 2, 'a click on a rounded edge is not a flat face: still waiting');
    await page.keyboard.press('Escape'); f = await fs_(); ok(!f.place, 'Escape cancels placing');
    await page.click('#undo'); f = await fs_(); ok(f.feats[0] === 1, 'undo removes the second feature');
    await page.click('#redo'); await page.click('#tDup'); f = await fs_(); ok(f.feats.length === 4 && f.feats[3] === 2 && closed(f), 'a copy of the cube has its own two features; all closed');
    await page.click('#tDel');
    if (await page.$('#bAnim')) {
      await page.click('#bAnim'); await page.waitForTimeout(800);
      const an = await page.evaluate(() => { const S = __snark, out = []; for (const tv of [1, 10.5, 20]) out.push(S.animBodies(tv, 0.4, true).map(B => S.meshStats(S.weld(B.skin ? [{ pos: B.skin.skin.pos, idx: B.skin.skin.idx }] : B.pieces)).open).join(',')); return { out }; });
      ok(an.out.every(x => x.split(',').every(v => v === '0')), `animation with features (setback 1 → 10.5 → 20 mm): every frame closed`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    }
    await page.evaluate(t => __snark.loadText(t), fs.readFileSync(path.join(EXAMPLES, 'plate_bump.snark'), 'utf8'));
    await page.click('#objectStrip .chip >> nth=0'); f = await fs_();
    const opts = await page.$$eval('#fSel option', o => o.map(x => x.textContent));
    ok(f.rt && f.open[0] === 0 && f.copies[0] === 13 && opts.length === 2, `example 1: the boss and the 12 dimples are drawn (${opts.join(' / ')}); write ⇄ read same`);
    await shot('feature_plate');
    await page.evaluate(t => __snark.loadText(t), DEMO); await page.waitForTimeout(100);
  }
  // L3. skins (from Snark_03): the demo, a feature on the sphere, features that keep their size while the edges soften
  if (await page.evaluate(() => !!__snark.makeSkin)) {
    await page.keyboard.press('Escape');
    await page.evaluate(t => { const S = __snark; S.loadText(t); S.camera.position.set(260, 230, 170); S.controls.target.set(80, 30, 15); S.controls.update(); }, DEMO);
    await page.waitForTimeout(200);
    let d3 = await page.evaluate(() => { const S = __snark, P = S.PIPE; return { skins: P.ev.bodies.map(B => !!B.skin), open: P.ev.bodies.map(B => B.lineStats ? B.lineStats.open : -1), rt: P.textStable && P.objectsSame, feats: S.S.objects.map(o => (o.features || []).length), copies: P.ev.bodies.map(B => B.skin ? B.skin.insts.length : 0) }; });
    ok(d3.skins.every(x => x) && d3.open.every(x => x === 0) && d3.rt, `the demo: cube, cylinder and sphere drawn by their skins (features ${d3.feats.join(', ')}; copies ${d3.copies.join(', ')}), closed, write ⇄ read same`);
    const kept = await page.evaluate(() => { const S = __snark, out = [];
      for (const tv of [1, 20]) { const L = S.animBodies(tv, 0, true), sk = L[0].skin.skin, a = sk.insts.findIndex(f => f.src === sk.insts[0].src);
        const A = [sk.anchors[3 * a], sk.anchors[3 * a + 1], sk.anchors[3 * a + 2]]; let hmax = 0;
        for (let g = 0; g < sk.heights.length; g++) if (Math.hypot(sk.points[3 * g] - A[0], sk.points[3 * g + 1] - A[1], sk.points[3 * g + 2] - A[2]) < 1) hmax = Math.max(hmax, sk.heights[g]);
        out.push(hmax); }
      return out; });
    ok(kept.every(h => Math.abs(h - 4) < 0.02), `the boss on the cube keeps its size while the edges soften: height ${kept.map(h => h.toFixed(3)).join(' at setback 1, ')} at 20 mm`);
    // a feature on the sphere, placed by a click
    await page.click('#objectStrip .chip >> nth=2');
    const n0 = await page.evaluate(() => __snark.S.objects[2].features.length);
    await page.click('#fAdd');
    const aim = await page.evaluate(() => { const S = __snark, c = [145, 30, 20], cam = S.camera.position.toArray(), v = [cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]], l = Math.hypot(...v);
      // a point of the sphere between the bosses, turned a little away from the camera's line
      const u = v.map(x => x / l), side = [-u[1], u[0], 0].map(x => x / Math.hypot(u[0], u[1])), dd = u.map((x, k) => 0.9 * x + 0.436 * side[k]).map((x, k, a) => x / Math.hypot(...a));
      const p = dd.map((x, k) => c[k] + 20 * x), r = S.canvas.getBoundingClientRect(), q = new S.THREE.Vector3(...p).project(S.camera);
      return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height, ll: S.dirLonLat(dd) }; });
    await page.mouse.click(aim.x, aim.y);
    d3 = await page.evaluate(() => { const S = __snark, o = S.S.objects[2], f = o.features[o.features.length - 1]; return { n: o.features.length, f, fsel: S.FSEL, lab: [document.getElementById('lfU').textContent, document.getElementById('lfV').textContent],
      reps: [...document.querySelectorAll('#fRep option')].map(x => x.value), rt: S.PIPE.textStable && S.PIPE.objectsSame, open: S.PIPE.ev.bodies[2].lineStats.open, text: S.PIPE.text }; });
    const near = Math.abs(((d3.f.at[0] - aim.ll[0] + 540) % 360) - 180) < 3 && Math.abs(d3.f.at[1] - aim.ll[1]) < 3;
    ok(d3.n === n0 + 1 && d3.f.face === 'surface' && near && d3.lab.join() === 'λ°,φ°' && d3.reps.join() === 'none,polar' && d3.rt && d3.open === 0 && /#@patch b3_surface sph c=145,30,20 d=40 a=0,0,1 u=1,0,0/.test(d3.text),
      `a click on the sphere puts a dome there: λ ${d3.f.at[0]}°, φ ${d3.f.at[1]}° (aimed at ${aim.ll.map(x => x.toFixed(1)).join('°, ')}°); fields λ°, φ°; repeat: none or circle; the card carries the frame; write ⇄ read same; closed`);
    await page.selectOption('#fRep', 'polar'); await setNum('fP1', 5); await setNum('fP2', 8);
    d3 = await page.evaluate(() => { const S = __snark, P = S.PIPE; return { rt: P.textStable && P.objectsSame, open: P.ev.bodies[2].lineStats.open, copies: P.ev.bodies[2].skin.insts.length }; });
    ok(d3.rt && d3.open === 0, `the new dome as a ring of 5 on the sphere (radius 8): ${d3.copies} copies on the sphere, closed, write ⇄ read same`);
    // picking: the boss at the north pole is the sphere's first feature
    const pole = await page.evaluate(() => { const S = __snark, r = S.canvas.getBoundingClientRect(), q = new S.THREE.Vector3(145, 30, 20 + 24).project(S.camera); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }; });
    await page.mouse.click(pole.x, pole.y);
    ok(await page.evaluate(() => __snark.FSEL === 0 && __snark.SEL === __snark.S.objects[2].id), 'a click on the boss at the pole selects the sphere\'s first feature');
    await page.evaluate(t => __snark.loadText(t), DEMO); await page.waitForTimeout(100);
  }
  // L4. chaos (from Snark_04): in the animation the features wander over their bodies and cross each other
  if (await page.$('#animChaos')) {
    await page.keyboard.press('Escape');
    await page.evaluate(t => __snark.loadText(t), DEMO); await page.waitForTimeout(200);
    const text0 = await page.evaluate(() => __snark.PIPE.text);
    await page.click('#bAnim'); await page.waitForTimeout(1500);
    let c = await page.evaluate(() => ({ on: document.getElementById('animChaos').classList.contains('on'), chaos: __snark.ANIM.chaos, label: document.getElementById('animChaos').textContent }));
    ok(c.on && c.chaos && c.label === 'ქაოსი', `the animation starts with chaos on (switch "${c.label}")`);
    c = await page.evaluate(() => { const S = __snark, A0 = S.ANIM; A0.on = false;      // the frames are driven here: 0.1 s of animation each
      S.animDraw(S.animBodies(1, 0, true, 0)); const a0 = A0.skins.map(A => A ? Array.from(A.skin.anchors) : []);
      const t0 = performance.now();
      for (let k = 1; k <= 100; k++) { const sec = k / 10; S.animDraw(S.animBodies(1 + 19 * (1 - Math.cos(2 * Math.PI * sec / 10)) / 2, 0, false, sec)); }
      const per = (performance.now() - t0) / 100, L = S.animBodies(1, 0, true, 10); S.animDraw(L);
      const moved = A0.skins.map((A, i) => { if (!A) return 0; let m = 0; const P = A.skin.anchors; for (let k = 0; k < P.length; k += 3) m = Math.max(m, Math.hypot(P[k] - a0[i][k], P[k + 1] - a0[i][k + 1], P[k + 2] - a0[i][k + 2])); return m; });
      const open = L.map(B => B.skin ? S.meshStats(S.weld([{ pos: B.skin.skin.pos, idx: B.skin.skin.idx }])).open : 0);
      const over = A0.skins.map(A => { if (!A) return 0; const I = A.skin.insts, P = A.skin.anchors; let n = 0;
        for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length; j++) if (Math.hypot(P[3 * i] - P[3 * j], P[3 * i + 1] - P[3 * j + 1], P[3 * i + 2] - P[3 * j + 2]) < I[i].R + I[j].R) n++; return n; });
      return { moved, open, over, per, text: S.PIPE.text }; });
    ok(c.moved.every(m => m > 5) && c.open.every(x => x === 0) && c.over.reduce((a, b) => a + b, 0) > 0 && c.text === text0,
      `after 10 s of animation the features have wandered (up to ${c.moved.map(m => m.toFixed(0)).join(', ')} mm) and cross (${c.over.join(', ')} overlapping pairs); every skin closed; the file unchanged`);
    console.log(`      one frame with one skin moved: ${c.per.toFixed(1)} ms`);
    await page.click('#animChaos');
    c = await page.evaluate(() => { const S = __snark, A0 = S.ANIM; S.animDraw(S.animBodies(1, 0, true, 10.1)); let worst = 0;
      A0.skins.forEach((A, i) => { if (!A) return; const own = S.bodyInstances({ ...S.PIPE.rec.bodies[i], useFrozen: true }, []).all;
        A.skin.insts.forEach((f, a) => { const g = own[a]; worst = Math.max(worst, f.dir ? Math.hypot(...f.dir.map((x, k) => x - g.dir[k])) : (f.ci === g.ci ? Math.max(Math.abs(f.cu - g.cu), Math.abs(f.cv - g.cv)) : 99)); }); });
      return { off: !A0.chaos && !document.getElementById('animChaos').classList.contains('on'), worst }; });
    ok(c.off && c.worst < 1e-12, 'switched off, every feature goes back to its place');
    await page.evaluate(() => { __snark.ANIM.on = true; }); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ok(await page.evaluate(t => !__snark.ANIM.on && __snark.PIPE.text === t && document.getElementById('animBox').classList.contains('hide'), text0), 'Esc stops; the file is as before');
  }
  // L5. section (from Snark_05): a plane cuts the bodies; the cut faces are drawn hatched
  if (await page.$('#bCut')) {
    await page.keyboard.press('Escape');
    await page.evaluate(t => { const S = __snark; S.loadText(t); S.camera.position.set(260, 230, 170); S.controls.target.set(80, 30, 15); S.controls.update(); }, DEMO);
    await page.waitForTimeout(300);
    const text0 = await page.evaluate(() => __snark.PIPE.text);
    const scr = p => page.evaluate(p => { const S = __snark, r = S.canvas.getBoundingClientRect(), v = new S.THREE.Vector3(...p).project(S.camera); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, p);
    const px = async p => { const q = await scr(p); return page.evaluate(q => __snark.pixelAt(q.x, q.y), q); };
    const capLike = c => c[0] > 150 && c[0] > c[1] + 50 && c[0] > c[2] + 50;      // the section colour is a red-brown, the bodies grey
    const centres = [[30, 30, 20], [87, 30, 20], [145, 30, 20]];
    const grey = []; for (const c of centres) grey.push(await px(c));
    ok(await page.evaluate(() => document.getElementById('bAnim').nextElementSibling.id === 'bCut') && grey.every(c => !capLike(c)), 'the section button sits next to the animation button; the bodies are grey before');
    await page.click('#bCut'); await page.waitForTimeout(300);
    let c = await page.evaluate(() => { const C = __snark.CUT; return { on: C.on, axis: C.axis, pos: C.pos, box: !document.getElementById('cutBox').classList.contains('hide'), val: document.getElementById('cutVal').textContent }; });
    const cut = []; for (const q of centres) cut.push(await px(q));
    ok(c.on && c.box && c.axis === 1 && c.pos === 30 && cut.every(capLike), `on: the plane y = 30 through the three centres (readout "${c.val}"); there the cut faces show (${cut.map(x => x.slice(0, 3).join('/')).join(', ')})`);
    // a click on the cut face of the cube selects the cube: the cut-away half cannot be clicked
    await page.evaluate(() => __snark.select(null)); const q0 = await scr([30, 30, 20]); await page.mouse.click(q0.x, q0.y);
    ok(await page.evaluate(() => __snark.SEL === __snark.S.objects[0].id), 'a click on the cube\'s cut face selects the cube');
    await page.fill('#cutPos', '55'); await page.dispatchEvent('#cutPos', 'input');
    c = await page.evaluate(() => ({ pos: __snark.CUT.pos, k: __snark.CUT.plane.constant, hi: __snark.CUT.hi }));
    const moved = []; for (const q of centres) moved.push(await px(q));
    ok(c.pos === 55 && Math.abs(c.k - 55) < 1e-9 && c.hi >= 55 && moved.every(x => !capLike(x)), `the slider to 55, beyond the bodies (they reach y = 50): the plane moves there and nothing is cut`);
    await page.click('#cutFlip'); await page.fill('#cutPos', '30'); await page.dispatchEvent('#cutPos', 'input');
    const flipped = await px([30, 30, 20]);
    ok(await page.evaluate(() => __snark.CUT.flip) && !capLike(flipped), '⇄ keeps the other half: the cut face now looks away, the cube\'s own side is seen');
    await page.click('#cutFlip'); await page.click('#cutZ');
    c = await page.evaluate(() => { const C = __snark.CUT; return { axis: C.axis, pos: C.pos, n: C.plane.normal.toArray(), lo: C.lo, hi: C.hi }; });
    ok(c.axis === 2 && c.n[2] === -1 && c.lo < 0 && c.hi > 40 && Math.abs(c.pos - (c.lo + c.hi) / 2) < 0.06, `Z: a horizontal plane, like a slicer's layer, from ${c.lo} to ${c.hi} mm, now at ${c.pos}`);
    await page.click('#cutY'); await page.click('#bAnim'); await page.waitForTimeout(2500);
    const during = await px([30, 30, 20]);
    ok(capLike(during) && await page.evaluate(() => __snark.ANIM.on && __snark.CUT.on), 'during the animation the cut stays and the turning, softening bodies show their cut faces');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.click('#bCut'); await page.waitForTimeout(200);
    c = await page.evaluate(() => ({ on: __snark.CUT.on, hidden: document.getElementById('cutBox').classList.contains('hide') }));
    const back = []; for (const q of centres) back.push(await px(q));
    ok(!c.on && c.hidden && back.every(x => !capLike(x)) && await page.evaluate(t => __snark.PIPE.text === t, text0), 'off: the bodies are whole again; the file never changed');
  }
  // M. memory view, language, theme
  await page.click('#bMemory'); await page.waitForTimeout(100);
  const mem = await page.evaluate(() => document.getElementById('memory').textContent);
  ok(/SnarkDoc/.test(mem) && /რეცეპტი/.test(mem) && /კი/.test(mem) && !/არა /.test(mem), 'memory view: the SnarkDoc, the recognised bodies and all checks yes');
  await shot('memory');
  await page.selectOption('#lang', 'en'); await page.click('#bTheme'); await page.waitForTimeout(150);
  ok(await page.$eval('#bTheme', e => e.textContent) === '☀' && /bodies/.test((await st()).status), 'dark theme and English');
  await shot('dark_en');
  await page.selectOption('#lang', 'ka'); await page.click('#bTheme');
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  if (errs.length) fails++;
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
  await browser.close();
})();
