// Bugs found on a real phone (Nov 11): Send as file offline, QR codes scanned by a normal camera app, camera errors.
import { launch, serve, newPhone, recorder } from './common.mjs';
const R = recorder('e2e-share-camera');
const { server, url } = await serve();
const b = await launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  // ---------- 1. Send as file, offline ----------
  const A = await newPhone(b, { acceptDownloads: true });
  await A.page.goto(url + 'index.html');
  await A.page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await A.page.reload(); await A.page.waitForTimeout(300);
  await A.ctx.setOffline(true);
  await A.page.goto(url + 'index.html#/teacher'); await A.page.reload();
  R.check(await A.page.evaluate(() => !navigator.onLine && !!navigator.serviceWorker.controller), 'phone A offline, app served by the service worker');
  // (a) no Web Share (desktop/headless): saves the file
  let [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.locator('#file-g5-fractions').click()]);
  R.check(dl.suggestedFilename() === 'g5-fractions.ekpack.json', 'offline, no share sheet: file saved', dl.suggestedFilename());
  const saved = JSON.parse(await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8'));
  R.check(saved.id === 'g5-fractions' && saved.quiz.length === 5, 'saved file is the full lesson pack');
  R.check((await A.page.locator('#file-msg-g5-fractions').textContent()).includes('Saved g5-fractions.ekpack.json'), 'success text shown', await A.page.locator('#file-msg-g5-fractions').textContent());
  // (b) share sheet allowed and works
  await A.page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = (d) => { window.__shared = { n: d.files.length, name: d.files[0].name, type: d.files[0].type }; return Promise.resolve(); }; });
  await A.page.locator('#file-g5-water-cycle').click();
  await A.page.waitForFunction(() => document.getElementById('file-msg-g5-water-cycle').textContent.length > 0);
  const sh = await A.page.evaluate(() => window.__shared);
  R.check(sh && sh.name === 'g5-water-cycle.ekpack.txt' && /File ready/.test(await A.page.locator('#file-msg-g5-water-cycle').textContent()), 'offline share sheet gets the pack as a text file', sh);
  // (c) share throws (e.g. NotAllowedError) -> falls back to saving the file
  await A.page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('no', 'NotAllowedError')); });
  [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.locator('#file-g4-english-sentence').click()]);
  R.check(dl.suggestedFilename() === 'g4-english-sentence.ekpack.json', 'share failed -> file saved instead', dl.suggestedFilename());
  // (d) user cancels the share sheet -> clear text, nothing saved
  await A.page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('x', 'AbortError')); });
  await A.page.locator('#file-g5-fractions').click();
  await A.page.waitForFunction(() => /cancelled/.test(document.getElementById('file-msg-g5-fractions').textContent));
  R.check(true, 'cancelled share shows a clear message');

  // ---------- 2. QR codes are links; opening them (as a camera app would) works offline ----------
  await A.page.goto(url + 'index.html#/share/g5-fractions');
  await A.page.waitForSelector('#qr-canvas[data-chunk]');
  await A.page.locator('#qr-pause').click();
  const n = +(await A.page.evaluate(() => document.body.dataset.chunks));
  const links = [];
  for (let i = 0; i < n; i++) { links.push(await A.page.locator('#qr-canvas').getAttribute('data-chunk')); await A.page.locator('#qr-next').click(); }
  const base = url + 'index.html';
  R.check(links.every((l) => l.startsWith(base + '#/r/g5-fractions/') && l.length <= 300), 'every QR code is a link into the app, ≤300 characters', { n, longest: Math.max(...links.map((l) => l.length)), first: links[0].slice(0, 70) + '…' });
  R.check((await A.page.locator('#qr-caption').textContent()).includes('or with any camera'), 'caption under the QR: scan in Ek Phone or with any camera');
  const B = await newPhone(b);
  await B.page.goto(url + 'index.html');
  await B.page.evaluate(async () => { localStorage.clear(); await navigator.serviceWorker.ready; });
  await B.page.reload(); await B.page.waitForTimeout(300);
  await B.ctx.setOffline(true);
  const order = links.map((_, i) => i).reverse();
  for (const [k, i] of order.entries()) {
    await B.page.goto(links[i]);
    if (k === 0) {
      await B.page.waitForFunction(() => /Got 1 of/.test(document.getElementById('rx-status') && document.getElementById('rx-status').textContent));
      R.check((await B.page.locator('#rx-status').textContent()) === 'Got 1 of ' + n + ' for G5 fractions', 'offline: first link opened -> "Got 1 of ' + n + ' for G5 fractions"', await B.page.locator('#rx-status').textContent());
      R.check(B.page.url().endsWith('#/receive'), 'link replaced by the receive screen (reload does not re-add)');
    }
  }
  await B.page.waitForSelector('.pv-size');
  R.check(/KB/.test(await B.page.locator('.pv-size').textContent()), 'all links opened (any order, offline) -> size preview', await B.page.locator('.pv-size').textContent());
  await B.page.locator('#rx-load').click();
  R.check((await B.page.locator('#rx-done').textContent()).includes('Fractions'), 'imported after the last link');
  R.check(await B.page.evaluate(() => localStorage.getItem('ekphone:v1:rx')) === null, 'stored pieces cleared after import');
  // the in-app paste box takes the same links, and the old EK1 text codes still work
  await B.page.goto(url + 'index.html#/receive');
  await B.page.locator('#rx-paste').fill(links.join('\n'));
  await B.page.locator('#rx-paste-btn').click();
  await B.page.waitForSelector('.pv-size');
  R.check(true, 'pasted links are accepted by the receive screen');
  const old = await B.page.evaluate(async () => { const p = window.EK_BUILTIN[1]; const c = await window.EkQR.encode(p); const a = window.EkQR.createAssembler(); c.forEach((x) => a.add(x)); return JSON.parse(await a.finish()).id; });
  R.check(old === 'g5-water-cycle', 'old EK1 text codes still accepted');

  // ---------- 3. camera errors ----------
  const C = await newPhone(b, { permissions: ['camera'] });
  await C.page.addInitScript(() => {
    const md = navigator.mediaDevices; const orig = md.getUserMedia.bind(md);
    window.__calls = []; window.__fail = []; window.__streams = [];
    md.getUserMedia = (c) => { window.__calls.push(JSON.stringify(c)); const f = window.__fail.shift(); if (f) return Promise.reject(new DOMException('test', f)); return orig(c).then((s) => { window.__streams.push(s); return s; }); };
  });
  await C.page.goto(url + 'index.html#/receive');
  await C.page.waitForSelector('#rx-scan');
  const cases = [['NotAllowedError', 'permission is off'], ['NotFoundError', 'No camera was found'], ['NotReadableError', 'another app']];
  for (const [name, text] of cases) {
    await C.page.evaluate((nm) => { window.__fail = [nm, nm]; }, name);
    await C.page.locator('#rx-scan').click();
    await C.page.waitForFunction(() => document.getElementById('rx-cam-err').textContent.length > 0);
    const msg = await C.page.locator('#rx-cam-err').textContent();
    R.check(msg.includes(text) && await C.page.locator('#rx-retry').isVisible(), name + ' -> specific message + Try again', msg);
    await C.page.evaluate(() => { window.__fail = []; });
  }
  // OverconstrainedError on the back camera -> retries with { video: true } and starts
  await C.page.evaluate(() => { window.__fail = ['OverconstrainedError']; window.__calls = []; });
  await C.page.locator('#rx-retry').click();
  await C.page.waitForFunction(() => window.__streams.length > 0);
  const calls = await C.page.evaluate(() => window.__calls);
  R.check(calls.length === 2 && calls[0].includes('environment') && calls[1] === '{"video":true,"audio":false}', 'OverconstrainedError -> retried with {video:true}, camera started', calls);
  R.check(await C.page.locator('#rx-retry').isHidden() && (await C.page.locator('#rx-cam-err').textContent()) === '', 'error and Try again cleared once the camera runs');
  await C.page.goto(url + 'index.html#/teacher');
  await C.page.waitForTimeout(200);
  const ended = await C.page.evaluate(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')));
  R.check(ended, 'leaving the screen stops every camera track');
  const errs = [...A.errors, ...B.errors, ...C.errors].filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e));
  R.check(errs.length === 0, 'no console errors', errs);
  R.save({ qrLinks: n, longestLink: Math.max(...links.map((l) => l.length)) });
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
