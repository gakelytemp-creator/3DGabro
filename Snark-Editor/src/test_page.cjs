// Tests of the editor page itself in a headless browser: every control, write ⇄ read, Boojum, examples, exports.
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
// three.js is loaded from the CDN; if three@0.180.0 is installed locally (npm i three@0.180.0), or
// SNARK_NODE_MODULES points to a node_modules folder that has it, the CDN requests are served from there.
//   node Snark-Editor/src/test_page.cjs [Snark_01.html]
// Set SHOTS=<folder> to also save screenshots.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const PAGE = path.resolve(__dirname, '..', process.argv[2] || 'Snark_01.html');
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
    const before = await page.evaluate(() => ({ text: __snark.PIPE.text, cam: __snark.camera.position.toArray(), side: document.getElementById('side').classList.contains('open') }));
    await page.click('#bAnim'); await page.waitForTimeout(1200);
    const a = await page.evaluate(() => ({ on: __snark.ANIM.on, v: __snark.ANIM.value, box: !document.getElementById('animBox').classList.contains('hide'), side: document.getElementById('side').classList.contains('open') }));
    ok(a.on && a.v >= 1 && a.v <= 20 && a.box && !a.side, `animation runs: setback ${a.v.toFixed(2)} mm, readout shown, side panel closed`);
    const vals = []; for (let i = 0; i < 4; i++) { await page.waitForTimeout(400); vals.push(await page.evaluate(() => __snark.ANIM.value)); }
    ok(vals.every((v, i) => v >= 1 && v <= 20 && (i === 0 || v > vals[i - 1])), 'the setback grows in the first half period: ' + vals.map(v => v.toFixed(1)).join(' '));
    const ball = await page.evaluate(() => { const L = __snark.animBodies(20, 0.7), b = L[0].body; let d = 0;
      for (const pc of L[0].pieces) for (let i = 0; i < pc.pos.length; i += 3) d = Math.max(d, Math.abs(Math.hypot(pc.pos[i] - b.c[0], pc.pos[i + 1] - b.c[1], pc.pos[i + 2] - b.c[2]) - 20));
      const ms = []; for (const tv of [1, 20]) { const t0 = performance.now(); __snark.animDraw(__snark.animBodies(tv, 0.3)); ms.push(performance.now() - t0); } return { d, ms }; });
    ok(ball.d < 0.1, `at setback 20 the 40 mm cube is a ball of radius 20 (largest deviation ${ball.d.toFixed(4)} mm, the spline k=0.55 against a circle)`);
    console.log(`      one frame: ${ball.ms.map(x => x.toFixed(1)).join(' and ')} ms at setback 1 and 20`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ on: __snark.ANIM.on, text: __snark.PIPE.text, cam: __snark.camera.position.toArray(), side: document.getElementById('side').classList.contains('open') }));
    ok(!after.on && after.text === before.text && after.side === before.side && after.cam.every((v, k) => Math.abs(v - before.cam[k]) < 1e-6), 'Escape stops it; the file, camera and side panel are as before');
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
