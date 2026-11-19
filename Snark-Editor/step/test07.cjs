const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ acceptDownloads: true }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/**', route => { const p = new URL(route.request().url()).pathname.replace('/npm/', '').replace(/^([^/@]+)@[^/]+/, '$1'); route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join('node_modules', p)), headers: { 'access-control-allow-origin': '*' } }); });
  await page.goto('file://' + path.resolve('Snark_07.html')); await page.waitForFunction(() => window.__snark && window.__snark.PIPE, null, { timeout: 90000 });
  console.log('title', await page.title(), '| brand', await page.evaluate(() => document.querySelector('.brand').textContent), '| open:', await page.evaluate(() => document.getElementById('mOpen').textContent), '| accept', await page.evaluate(() => document.getElementById('file').accept));
  let msg = ''; page.on('dialog', d => { msg = d.message(); d.accept(); });
  // export of the demo scene (the writer, with the corrected sense of surfaces of revolution)
  { const t0 = Date.now(), dlp = page.waitForEvent('download', { timeout: 300000 }).catch(() => null); await page.evaluate(() => document.getElementById('mStep').click()); const dl = await dlp; if (dl) await dl.saveAs('Snark_07_demo_scene.step'); console.log('export demo', dl ? (fs.statSync('Snark_07_demo_scene.step').size / 1024).toFixed(0) + ' KB' : 'no file', ((Date.now() - t0) / 1000).toFixed(0) + ' s', msg.slice(0, 200)); }
  // import through the file input, as a user would
  for (const f of process.argv.slice(2)) {
    msg = ''; const t0 = Date.now(); await page.setInputFiles('#file', f);
    await page.waitForFunction(() => true); for (let k = 0; k < 600 && !msg; k++) await page.waitForTimeout(200);
    const st = await page.evaluate(() => { const P = __snark.PIPE, d = P.doc || {}; return { text: (P.text || '').length, firstLine: (P.text || '').split('\n')[0], issues: (d.issues || []).filter(i => i.level === 'error').length, patches: d.patches ? d.patches.size : null, faces: d.faces ? d.faces.length : null, keys: Object.keys(P).join(',') }; });
    console.log(path.basename(f).padEnd(28), ((Date.now() - t0) / 1000).toFixed(1) + ' s', '|', msg.replace(/\n+/g, ' | ').slice(0, 330), '|', JSON.stringify(st).slice(0, 300));
    await page.screenshot({ path: 'shot_' + path.basename(f).replace(/\..*$/, '') + '.png' });
  }
  console.log('page errors:', errs.length ? errs : 'none'); await browser.close();
})();
