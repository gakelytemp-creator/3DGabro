/* The slicer: areas against exact numbers, points on the grid of the steps, the panel, DXF and SVG, the demo.
   Run from Snark-Editor/src/v18 after npm install and sh build.sh:  node tests/test_slice.cjs
   Headless Chromium (Playwright); three.js is served from node_modules instead of the CDN. Files go to out/. */
require('fs').mkdirSync('out', { recursive: true });
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => { const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.route('https://cdn.jsdelivr.net/npm/**', route => { const p = new URL(route.request().url()).pathname.replace('/npm/', '').replace(/^([^/@]+)@[^/]+/, '$1'); route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, '..', 'node_modules', p)) }); });
  const ready = () => page.waitForFunction(() => window.__snark && window.__snark.PIPE && window.__MF, null, { timeout: 90000 });
  await page.goto('file://' + path.resolve(__dirname, '../../../Snark_18.html')); await ready();
  const sl = async (tag, a, expect) => { const t0 = Date.now(); const r = await page.evaluate(async a => { const R = await snarkSlice(a); const off = R.loops.reduce((n, l) => n + l.pts.filter(p => Math.abs(p[0] / a.stepX - Math.round(p[0] / a.stepX)) > 1e-6 || Math.abs(p[1] / a.stepY - Math.round(p[1] / a.stepY)) > 1e-6).length, 0); return { loops: R.loops.map(l => [l.hole ? 'hole' : 'out', l.pts.length, +l.area.toFixed(4)]), area: +R.area.toFixed(4), len: +R.length.toFixed(3), chord: R.chord, made: R.made, leaves: R.leaves, offGrid: off }; }, a); console.log(tag.padEnd(34), 'ms', String(Date.now() - t0).padStart(5), JSON.stringify(r).slice(0, 330), expect !== undefined ? ' expect ' + expect.toFixed(4) + ' err ' + (r.area - expect).toExponential(2) : ''); };
  const board = async op => { const c = await page.evaluate(() => __gz.screen('role', -1)); await page.mouse.dblclick(c.x, c.y); await page.waitForTimeout(1200); await page.evaluate(op => document.querySelector(`#boolBox button.op[data-op=${op}]`).click(), op); await page.waitForTimeout(300); await page.waitForFunction(() => !document.getElementById('busy').classList.contains('on'), null, { timeout: 120000 }); await page.waitForTimeout(1000); };
  // 1. sharp box with a d10 hole
  await page.evaluate(() => { const S = __snark.S; document.getElementById('mNew').click(); document.getElementById('tBox').click(); document.getElementById('tCyl').click(); const [a, b] = S.objects; a.size = [40, 30, 20]; a.p = [30, 30, 10]; a.edge.keys = []; b.edge.keys = []; b.size = [10, 40]; b.p = [30, 30, 10]; b.role = 'tool'; __gz.refresh(b.id); }); await page.waitForTimeout(800);
  await sl('box alone z=10 step .01', { z: 10, stepX: 0.01, stepY: 0.01 }, 1200);
  await board('cut');
  await sl('box − cyl d10, step .01', { z: 10, stepX: 0.01, stepY: 0.01 }, 1200 - Math.PI * 25);
  await sl('same, step .001', { z: 10, stepX: 0.001, stepY: 0.001 }, 1200 - Math.PI * 25);
  await sl('same, step X .5 Y .1', { z: 10, stepX: 0.5, stepY: 0.1 });
  await sl('same, z=25 (above)', { z: 25, stepX: 0.01, stepY: 0.01 }, 0);
  // through the panel
  await page.click('#bSlice'); await page.fill('#sliceZ', '10'); await page.click('#sliceGo'); await page.waitForTimeout(1500); console.log('panel:', await page.evaluate(() => document.getElementById('sliceInfo').textContent)); await page.screenshot({ path: 'out/shot18_a.png' });
  { const d = page.waitForEvent('download'); await page.click('#sliceDxf'); await (await d).saveAs('out/t18.dxf'); const d2 = page.waitForEvent('download'); await page.click('#sliceSvgB'); await (await d2).saveAs('out/t18.svg'); console.log('dxf', fs.statSync('out/t18.dxf').size, 'svg', fs.statSync('out/t18.svg').size); }
  // 2. the demo: cylinder with features cut by the sphere with features; then a sphere alone
  await page.reload(); await ready();
  await page.evaluate(() => { const S = __snark.S, sph = S.objects.find(o => o.kind === 'sph'), cyl = S.objects.find(o => o.kind === 'cyl'); sph.role = 'tool'; sph.p = [cyl.p[0] + cyl.size[0] * 0.45, cyl.p[1], cyl.p[2] + cyl.size[1] * 0.3]; __gz.refresh(sph.id); }); await page.waitForTimeout(1500); await board('cut');
  await sl('demo cut, z=30 step .01', { z: 30, stepX: 0.01, stepY: 0.01 }); await sl('demo cut, z=32 (solids kept)', { z: 32, stepX: 0.01, stepY: 0.01 });
  await page.click('#bSlice'); await page.fill('#sliceZ', '30'); await page.click('#sliceGo'); await page.waitForTimeout(400); await page.waitForFunction(() => !document.getElementById('busy').classList.contains('on'), null, { timeout: 120000 }); await page.waitForTimeout(1500); await page.screenshot({ path: 'out/shot18_b.png' });
  console.log('errors', errs.slice(0, 5)); await browser.close(); })();
