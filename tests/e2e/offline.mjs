// Offline test: first visit online (service worker installs), then airplane mode, reload, finish a lesson + quiz.
import { launch, serve, newPhone, recorder } from './common.mjs';
const R = recorder('e2e-offline');
const { server, url } = await serve();
const b = await launch();
try {
  const { ctx, page, errors } = await newPhone(b);
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url + 'index.html');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { name: keys[0], count: (await c.keys()).length }; });
  R.check(cached.count >= 20, 'service worker precached the app', cached);
  // use Urdu once while online so the lazy Urdu font gets cached too
  await page.getByRole('button', { name: 'اردو' }).click();
  await page.waitForFunction(() => document.fonts.check('20px "Noto Nastaliq Urdu"', 'کسر'));
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'English' }).click();
  await page.evaluate(async () => { await window.EkApp.store.addProfile('Zara', ''); });

  // From here on, every request is logged: served by the service worker cache, or an attempt to use the network.
  const net = { fromCache: 0, networkAttempts: [], serverHitsBefore: serve.hits || 0 };
  let offline = false;
  const track = async (r) => {
    if (!offline || !/^https?:/.test(r.url())) return;
    if (r.serviceWorker()) { net.networkAttempts.push('sw-fetch ' + r.url()); return; }
    const resp = await r.response().catch(() => null);
    if (resp && resp.fromServiceWorker()) net.fromCache++; else net.networkAttempts.push(r.url());
  };
  ctx.on('requestfinished', track); ctx.on('requestfailed', track);
  await ctx.setOffline(true); offline = true;
  await page.waitForTimeout(500); net.serverHitsBefore = serve.hits || 0; // let any request already in flight finish first
  R.check(await page.evaluate(() => !navigator.onLine), 'browser is offline (navigator.onLine=false)');
  await page.reload();
  R.check(await page.getByRole('heading', { name: 'Who is studying?' }).isVisible(), 'app reloads with no network');
  R.check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is served by the service worker');
  await page.locator('.tag', { hasText: 'Zara' }).click();
  await page.getByRole('link', { name: 'Start reading' }).click();
  await page.locator('#lesson-text').focus();
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowDown');
  R.check((await page.locator('.s.on').getAttribute('data-i')) === '9', 'read to the last sentence offline');
  await page.getByRole('link', { name: 'Start practice' }).click();
  const picks = ['One quarter', '4', '2/4', '4', 'No, the pieces are not equal'];
  for (let i = 0; i < 5; i++) {
    await page.getByLabel(picks[i], { exact: true }).check();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: i === 4 ? 'See my score' : 'Next question' }).click();
  }
  R.check(await page.getByText('You got 5 of 5 right.').isVisible(), 'quiz completed offline: 5 of 5');
  const prog = await page.evaluate(() => { const s = window.EkApp.store; const z = s.listProfiles().find((p) => p.name === 'Zara'); return s.getPackProgress(z.id, 'g5-fractions'); });
  R.check(prog.best === 5 && prog.read === true, 'progress saved offline', prog);
  await page.getByRole('link', { name: 'My lessons' }).click();
  await page.getByRole('button', { name: 'اردو' }).click();
  await page.waitForTimeout(300);
  const urduFont = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('20px "Noto Nastaliq Urdu"', 'کسر'); });
  R.check(urduFont, 'Urdu Nastaliq font works offline (cached on first use)');
  await page.getByRole('button', { name: 'English' }).click();
  await page.goto(url + 'index.html#/teacher');
  const fontLabel = await page.locator('button', { hasText: 'Save Urdu font' }).textContent();
  const realKb = await page.evaluate(async () => { const r = await fetch('fonts/nastaliq-urdu-subset.woff2'); return ((await r.arrayBuffer()).byteLength / 1024).toFixed(1); });
  R.check(fontLabel.includes('(' + realKb + ' KB)'), 'Save Urdu font button shows the real font file size', { fontLabel, realKb });
  await page.goto(url + 'index.html#/share/g5-water-cycle');
  await page.waitForSelector('#qr-canvas[data-chunk]');
  R.check(true, 'QR share screen works offline (encoder precached)');
  await page.goto(url + 'index.html#/write');
  await page.waitForSelector('#w-title');
  R.check(true, 'Write a lesson screen works offline (lazy code precached)');
  await page.goto(url + 'index.html#/');
  await page.evaluate(() => localStorage.removeItem('ekphone:v1:profiles'));
  await page.reload();
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.waitForSelector('.tag');
  R.check(await page.locator('.tag').count() === 4, 'Try the demo works offline');
  await page.waitForTimeout(300);
  net.serverHits = (serve.hits || 0) - net.serverHitsBefore; net.serverUrls = (serve.log || []).slice(net.serverHitsBefore);
  // Chromium's offline emulation does not cover the browser's own service-worker update check (GET /sw.js).
  // It is listed separately; on a real phone in airplane mode that check simply fails and nothing changes.
  net.swUpdateChecks = net.serverUrls.filter((u) => u === '/sw.js').length;
  const appHits = net.serverUrls.filter((u) => u !== '/sw.js');
  R.check(net.networkAttempts.length === 0 && appHits.length === 0, 'offline run: 0 app requests reached the network (' + net.fromCache + ' answered by the service worker cache; browser sw.js update checks: ' + net.swUpdateChecks + ')', { fromCache: net.fromCache, networkAttempts: net.networkAttempts, serverHits: net.serverHits, serverUrls: net.serverUrls });
  const failed = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e));
  R.check(failed.length === 0, 'no console errors offline', failed);
  R.save({ offlineRequests: { fromServiceWorkerCache: net.fromCache, appRequestsToNetwork: net.networkAttempts.length + net.serverUrls.filter((u) => u !== '/sw.js').length, browserSwUpdateChecks: net.swUpdateChecks, serverUrls: net.serverUrls } });
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
