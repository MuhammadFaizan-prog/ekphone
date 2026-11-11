// Phone-to-phone transfer with no network between them.
// Phone A (teacher): opens a pack FILE (sample), then shows it as a sequence of QR codes.
// We capture A's real QR canvases as video frames and feed them to Phone B as a fake camera (Chromium
// --use-file-for-fake-video-capture). Phone B scans with the camera (jsQR path), checks the size, loads the pack.
// Phone C receives the same pack by pasted code text. Separate browsers = separate storage.
import fs from 'node:fs';
import { launch, serve, newPhone, recorder, ROOT } from './common.mjs';
const R = recorder('e2e-qr-transfer');
const { server, url } = await serve();
const W = 640, H = 480, FPS = 10, HOLD = 6; // each code held 0.6 s in the fake camera
const y4m = '/tmp/ekphone-qr-feed.y4m';
let A, B;
try {
  A = await launch();
  const a = await newPhone(A);
  await a.page.goto(url + 'index.html#/teacher');
  await a.page.evaluate(() => localStorage.clear());
  await a.page.reload();
  // the file input lives on the receive screen
  await a.page.getByRole('link', { name: 'Receive a lesson pack' }).click();
  await a.page.setInputFiles('#rx-file', ROOT + 'app/samples/g3-plant-parts.ekpack.json');
  const pv = await a.page.locator('.pv-size').textContent();
  R.check(/KB \(0\.00\d MB\)/.test(pv), 'Phone A: pack file opened, size shown before loading', pv);
  await a.page.getByRole('button', { name: 'Load this pack' }).click();
  R.check((await a.page.locator('#rx-done').textContent()).includes('Parts of a Plant'), 'Phone A: pack loaded from file');
  await a.page.goto(url + 'index.html#/share/g3-plant-parts');
  await a.page.waitForSelector('#qr-canvas[data-chunk]');
  await a.page.getByRole('button', { name: 'Pause codes' }).click();
  const n = +(await a.page.evaluate(() => document.body.dataset.chunks));
  R.check(n >= 2, 'Phone A: pack split into ' + n + ' QR codes', { n });
  const frames = [], texts = [];
  for (let i = 0; i < n; i++) {
    const res = await a.page.evaluate(({ W, H }) => {
      const src = document.getElementById('qr-canvas');
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = false;
      const s = 440; g.drawImage(src, (W - s) / 2, (H - s) / 2, s, s);
      const d = g.getImageData(0, 0, W, H).data; const y = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) y[p] = Math.round(0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]);
      let bin = ''; for (let p = 0; p < y.length; p += 8192) bin += String.fromCharCode.apply(null, y.subarray(p, p + 8192));
      return { y: btoa(bin), text: src.dataset.chunk, label: document.querySelector('.qr-label').textContent };
    }, { W, H });
    frames.push(Buffer.from(res.y, 'base64')); texts.push(res.text);
    await a.page.getByRole('button', { name: 'Next code' }).click();
  }
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const out = fs.openSync(y4m, 'w');
  fs.writeSync(out, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`);
  for (const f of frames) for (let k = 0; k < HOLD; k++) { fs.writeSync(out, 'FRAME\n'); fs.writeSync(out, f); fs.writeSync(out, uv); }
  fs.closeSync(out);
  R.ok('captured Phone A screen as camera video', { frames: frames.length * HOLD, file: y4m });
  await A.close(); A = null;

  // Phone B: separate browser with the fake camera
  B = await launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m] });
  const bp = await newPhone(B, { permissions: ['camera'] });
  await bp.page.goto(url + 'index.html#/receive');
  await bp.page.evaluate(() => localStorage.clear());
  await bp.page.reload();
  const hasBD = await bp.page.evaluate(() => 'BarcodeDetector' in window);
  // Measure: time from pressing Scan to the pack preview, and every request made while scanning.
  const scanReqs = [];
  bp.ctx.on('request', (r) => scanReqs.push(r.url().replace(url, '/')));
  const hits0 = serve.hits || 0, bytes0 = serve.bytes || 0;
  const t0 = Date.now();
  await bp.page.getByRole('button', { name: 'Scan QR codes with camera' }).click();
  await bp.page.waitForSelector('.pv-size', { timeout: 45000 });
  const scanSeconds = +((Date.now() - t0) / 1000).toFixed(1);
  const scanNet = { requests: scanReqs, serverHits: (serve.hits || 0) - hits0, serverBytes: (serve.bytes || 0) - bytes0 };
  R.ok('Phone B: all ' + n + ' codes scanned in ' + scanSeconds + ' s (fake camera shows each code 0.6 s, looping)', { scanSeconds, scanNet });
  const status = await bp.page.locator('#rx-status').textContent();
  R.check(true, 'Phone B: camera scan collected all codes', { status, decoder: hasBD ? 'BarcodeDetector' : 'jsQR (vendored)' });
  const pvB = await bp.page.locator('.pv-size').textContent();
  R.check(/KB/.test(pvB), 'Phone B: shows pack size before loading', pvB);
  await bp.page.getByRole('button', { name: 'Load this pack' }).click();
  await bp.page.goto(url + 'index.html#/teacher');
  const titles = await bp.page.locator('.packrow .spine-title').allTextContents();
  R.check(titles.includes('Parts of a Plant'), 'Phone B: received pack is on the shelf', titles);
  const same = await bp.page.evaluate(() => JSON.stringify(window.EkApp.store.listImportedPacks()[0]));
  const orig = JSON.stringify(JSON.parse(fs.readFileSync(ROOT + 'app/samples/g3-plant-parts.ekpack.json', 'utf8')));
  R.check(same === orig, 'Phone B: pack is byte-identical to the original');
  await bp.page.evaluate(async () => { await window.EkApp.store.addProfile('Hamza', ''); });
  await bp.page.goto(url + 'index.html#/');
  await bp.page.locator('.tag', { hasText: 'Hamza' }).click();
  R.check(await bp.page.locator('.spine-title', { hasText: 'Parts of a Plant' }).count() === 1, "Phone B: pack appears on a learner's shelf");

  // Phone C: paste code text (e.g. sent by SMS)
  const cp = await newPhone(B);
  await cp.page.goto(url + 'index.html#/receive');
  await cp.page.evaluate(() => localStorage.clear());
  await cp.page.reload();
  await cp.page.getByLabel('Or paste pack code text').fill(texts.slice().reverse().join('\n'));
  await cp.page.getByRole('button', { name: 'Read pasted code' }).click();
  R.check(/KB/.test(await cp.page.locator('.pv-size').textContent()), 'Phone C: pasted codes (any order) rebuild the pack');
  R.check([...a.errors, ...bp.errors, ...cp.errors].length === 0, 'no console errors on any phone', [...a.errors, ...bp.errors, ...cp.errors]);
  // QR code count for every built-in pack (same encoder as the share screen)
  const counts = await cp.page.evaluate(async () => { if (!window.EkQR) { await new Promise((r) => { const s = document.createElement('script'); s.src = 'js/qrchunk.js'; s.onload = r; document.head.appendChild(s); }); } const out = {}; for (const p of window.EK_BUILTIN) out[p.id] = { bytes: new TextEncoder().encode(JSON.stringify(p)).length, codes: (await window.EkQR.encode(p, { base: location.href.split('#')[0] })).length }; return out; });
  R.ok('QR code count per built-in pack', counts);
  R.save({ chunks: n, decoder: hasBD ? 'BarcodeDetector' : 'jsQR', scanSeconds, scanNetwork: scanNet, packCodes: counts });
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { if (A) await A.close(); if (B) await B.close(); server.close(); }
