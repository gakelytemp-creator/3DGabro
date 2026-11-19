const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/**', route => { const p = new URL(route.request().url()).pathname.replace('/npm/', '').replace(/^([^/@]+)@[^/]+/, '$1'); route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join('node_modules', p)), headers: { 'access-control-allow-origin': '*' } }); });
  await page.goto('file://' + path.resolve('Snark_08.html')); await page.waitForFunction(() => window.__snark && window.__snark.PIPE, null, { timeout: 90000 });
  let msg = ''; page.on('dialog', d => { msg = d.message(); d.accept(); });
  const state = () => page.evaluate(() => { const P = __snark.PIPE; return { bodies: P.rec.bodies.map(b => b.kind).join(','), patches: P.doc2.patches.size, faces: P.doc2.faces.length, errors: P.issues.filter(i => i.level === 'error' || i.level === 'boojum').length, chips: [...document.querySelectorAll('#objectStrip .chip')].map(c => c.textContent.slice(0, 22) + '/' + c.style.borderLeftColor).join(' ; ') }; });
  console.log('file menu:', await page.evaluate(() => [...document.querySelectorAll('#fileMenu .items > *')].map(e => e.tagName === 'HR' ? '—' : e.textContent).join(' | ')));
  console.log('view menu:', await page.evaluate(() => [...document.querySelectorAll('#viewMenu .items > *')].map(e => e.tagName === 'HR' ? '—' : e.textContent.trim()).join(' | ')));
  console.log('start', JSON.stringify(await state()));
  // STL of the start scene, to import later
  { const dlp = page.waitForEvent('download'); await page.evaluate(() => document.getElementById('mStl').click()); await (await dlp).saveAs('t08.stl'); console.log('stl', fs.statSync('t08.stl').size); }
  const imp = async (f, sel = '#fileImp') => { msg = ''; const t0 = Date.now(); await page.setInputFiles(sel, f); await page.waitForTimeout(f.endsWith('.step') ? 6000 : 2500); console.log(path.basename(f).padEnd(26), ((Date.now() - t0) / 1000).toFixed(1) + ' s', '|', msg.replace(/\n+/g, ' | ').slice(0, 120), '|', JSON.stringify(await state()).slice(0, 700)); };
  await imp('occ_bracket_fillet.step'); await page.evaluate(() => { document.getElementById('vColors').click(); }); await page.waitForTimeout(800); await page.screenshot({ path: 'shot08_a.png' });
  await page.evaluate(() => document.getElementById('mNew').click()); await page.waitForTimeout(500);
  await imp('occ_bracket_fillet.step'); await imp('t08.stl'); await imp('plate_hole.obj'); await imp('occ2_vase.step');
  await page.evaluate(() => document.getElementById('vFit').click()); await page.waitForTimeout(800); await page.screenshot({ path: 'shot08_b.png' });
  // save and open again: the scene survives
  { const dlp = page.waitForEvent('download'); await page.evaluate(() => document.getElementById('mSave').click()); await (await dlp).saveAs('t08.snark'); await page.evaluate(() => document.getElementById('mNew').click()); await imp('t08.snark', '#file'); }
  // colour change
  await page.evaluate(() => { const i = document.querySelector('#colorBox input[data-k=mesh]'); i.value = '#ff0000'; i.dispatchEvent(new Event('input')); }); console.log('after colour', (await state()).chips.slice(0, 200));
  await page.evaluate(() => document.getElementById('colReset').click());
  console.log('page errors:', errs.length ? errs : 'none'); await browser.close();
})();
