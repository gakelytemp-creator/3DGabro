/* Boolean operations on simple bodies: volumes of Cut / Join / Common against exact numbers, closed results, Undo, Save and STEP export.
   Run from Snark-Editor/src/v31 after npm install and sh build.sh:  node tests/test_boolean.cjs
   Headless Chromium (Playwright); three.js is served from node_modules instead of the CDN. Files go to out/. */
require('fs').mkdirSync('out', { recursive: true });
let window0;
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await page.route('https://cdn.jsdelivr.net/npm/**', route => { if (/bvh/.test(route.request().url())) return route.abort(); window0 = (window0 || 0) + 1; const p = new URL(route.request().url()).pathname.replace('/npm/', '').replace(/^([^/@]+)@[^/]+/, '$1'); route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, '..', 'node_modules', p)), headers: { 'access-control-allow-origin': '*' } }); });
  await page.goto('file://' + path.resolve(__dirname, '../../../Snark_31.html')); await page.waitForFunction(() => window.__snark && window.__snark.PIPE, null, { timeout: 90000 });
  const vols = async tag => console.log(tag.padEnd(22), JSON.stringify(await page.evaluate(() => __gz.vols())).slice(0, 420));
  // scene by numbers: a sharp box and a tool placed into it (state set directly, then the board is used as a user would)
  const scene = async (tool, sharp = true) => { await page.evaluate(([tool, sharp]) => { const S = __snark.S; document.getElementById('mNew').click(); document.getElementById('tBox').click(); document.getElementById(tool === 'cyl' ? 'tCyl' : 'tBox').click();
    const [a, b] = S.objects; a.size = [40, 30, 20]; a.p = [30, 30, 10]; if (sharp) { a.edge.keys = []; b.edge.keys = []; }
    if (tool === 'cyl') { b.size = [10, 40]; b.p = [30, 30, 10]; } else { b.size = [20, 20, 20]; b.p = [50, 45, 20]; }
    b.role = 'tool'; __gz.refresh(b.id); }, [tool, sharp]); await page.waitForTimeout(900); };
  const board = async op => { const c = await page.evaluate(() => __gz.screen('role', -1)); await page.mouse.click(c.x, c.y); await page.waitForTimeout(70); await page.mouse.click(c.x, c.y); await page.waitForTimeout(500);
    await page.evaluate(op => document.querySelector(`#boolBox button[data-op=${op}]`).click(), op); await page.waitForTimeout(2500); const note = await page.evaluate(() => document.getElementById('boolBox').classList.contains('hide') ? '' : document.getElementById('boolNote').textContent); if (note) console.log('   board says:', note); };
  await scene('box'); await vols('box + box tool'); await page.screenshot({ path: 'out/shot15_a.png' });
  await board('cut'); await vols('cut (24000-1000)'); await page.screenshot({ path: 'out/shot15_b.png' });
  await page.keyboard.press('Control+z'); await page.waitForTimeout(700); await vols('undo');
  await scene('box'); await board('join'); await vols('join (24000+7000)');
  await scene('box'); await board('common'); await vols('common (1000)');
  await scene('cyl'); await board('cut'); await vols('hole d10 (24000-1570.8)'); await page.screenshot({ path: 'out/shot15_c.png' });
  await scene('cyl', false); await board('cut'); await vols('rounded box, hole'); await page.screenshot({ path: 'out/shot15_d.png' });
  { const dlp = page.waitForEvent('download'); await page.evaluate(() => document.getElementById('mSave').click()); await (await dlp).saveAs('out/t15.snark'); const dl2 = page.waitForEvent('download', { timeout: 60000 }); await page.evaluate(() => document.getElementById('mStep').click()); const d = await dl2.catch(() => null); if (d) await d.saveAs('out/t15.step'); console.log('saved snark', fs.statSync('out/t15.snark').size, 'step', d ? fs.statSync('out/t15.step').size : 'none'); }
  console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none'); await browser.close();
})();
