/* The Scan room: a scan is opened, oriented and recognised; what was measured is printed.
   Run from Snark-Editor/src/v31 after npm install and sh build.sh:
       node tests/test_scan.cjs path/to/scan.obj [draw]
   Scans are tens to hundreds of megabytes and are not kept in the repository; any OBJ mesh of a real part will do.
   Without "draw" the mesh is not drawn (window.__scan.noDraw), which is what a machine without a graphics card needs:
   a few million triangles in software rendering take minutes. With "draw" a picture goes to out/scan.png.
   Headless Chromium (Playwright); three.js is served from node_modules instead of the CDN.
   The test prints numbers; it does not say PASS or FAIL by itself. */
require('fs').mkdirSync('out', { recursive: true });
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const file = process.argv[2], draw = process.argv[3] === 'draw'; if (!file) { console.log('usage: node tests/test_scan.cjs scan.obj [draw]'); process.exit(1); }
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => { errs.push('ALERT ' + d.message()); d.accept(); });
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.route('https://cdn.jsdelivr.net/npm/**', route => { const p = new URL(route.request().url()).pathname.replace('/npm/', '').replace(/^([^/@]+)@[^/]+/, '$1'); route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join('node_modules', p)) }); });
  await page.goto('file://' + path.resolve('../../Snark_31.html')); await page.waitForFunction(() => window.__snark && window.__scan, null, { timeout: 90000 });
  /* the running line at the top (#busy) is on while the page works */
  const idle = async () => { await page.waitForTimeout(500); await page.waitForFunction(() => !document.getElementById('busy').classList.contains('on'), null, { timeout: 1800000 }); await page.waitForTimeout(500); };
  await page.click('#deskScan'); if (!draw) await page.evaluate(() => { __scan.noDraw = true; });
  await page.setInputFiles('#fileScan', file); await idle();
  for (const t of ['orient', 'recognise']) { await page.evaluate(t => document.querySelector(`#scanTools button[data-tool=${t}]`).click(), t); await idle(); }
  const r = await page.evaluate(() => { const r = __scan.rec; if (!r) return null; const X = r.extr, sc = r.edges.filter(e => e.runs0);
    return { points: __scan.n, sections: r.sections, step: r.step, lines: r.lines, arcs: r.arcs, planes: r.planes.length, joined: r.bentJoined, inPlanes: r.lenIn / r.lenLines, onPlanes: r.explained, ms: r.ms,
      edges: r.edges.length, walked: sc.length, lenBefore: sc.reduce((a, e) => a + e.len0, 0), lenAfter: sc.reduce((a, e) => a + e.length, 0), twins: r.twins, corners: r.check,
      faces: { closed: r.faces.closed, ok: r.faces.ok }, cylinders: r.classes.map(g => [+(2 * g.r).toFixed(2), g.m.length, +g.scat.toFixed(3)]), singles: r.singles,
      hyp: r.hyp.map(q => [q.kind, +(100 * q.score).toFixed(1), q.note]),
      extr: X && { axis: 'XYZ'[X.k], from: X.t0, to: X.t1, elements: X.ents.length, before: X.before, links: X.links, explained: X.explained, dev: X.dev, dev95: X.dev95, ends: X.caps.map(c => c.found ? 'found' : 'assumed') } }; });
  if (!r) { console.log('no result', errs); await browser.close(); return; }
  console.log(`points ${r.points}; sections ${r.sections} every ${r.step.toFixed(2)} mm; lines ${r.lines}, arcs ${r.arcs}; ${(r.ms / 1000).toFixed(1)} s`);
  console.log(`planes ${r.planes} (${r.joined} joins of pieces); line length in planes ${(100 * r.inPlanes).toFixed(1)} %; points on planes ${(100 * r.onPlanes).toFixed(1)} %`);
  console.log(`edges ${r.edges} (${r.twins} twins folded); walked ${r.walked}: ${r.lenBefore.toFixed(0)} -> ${r.lenAfter.toFixed(0)} mm; corners ${r.corners.corners}, to the edge: half within ${r.corners.median.toFixed(3)}, 95 % within ${r.corners.p95.toFixed(3)} mm`);
  console.log(`faces closed ${r.faces.closed}, covered by the scan ${r.faces.ok}; cylinders [Ø, pieces, scatter] ${JSON.stringify(r.cylinders)}; single circles left out ${r.singles}`);
  console.log('symmetries tried side by side:'); for (const h of r.hyp) console.log(`   ${h[0].padEnd(22)} ${String(h[1]).padStart(5)} %   ${h[2]}`);
  console.log(r.extr ? `extrusion along ${r.extr.axis}: ${r.extr.from.toFixed(2)} … ${r.extr.to.toFixed(2)} mm; profile of ${r.extr.elements} elements (the section gave ${r.extr.before}; ${r.extr.links} links by guess); points on the body ${(100 * r.extr.explained).toFixed(1)} %; walls off the profile: half within ${r.extr.dev.toFixed(3)}, 95 % within ${r.extr.dev95.toFixed(3)} mm; ends: ${r.extr.ends.join(', ')}` : 'no extrusion: no direction explains 90 % of the planes');
  if (draw) { await page.waitForTimeout(3000); await page.screenshot({ path: 'out/scan.png' }); console.log('picture: out/scan.png'); }
  console.log('errors', errs.slice(0, 5)); await browser.close(); })();
