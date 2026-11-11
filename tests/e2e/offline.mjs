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

  await ctx.setOffline(true);
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
  const failed = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e));
  R.check(failed.length === 0, 'no console errors offline', failed);
  R.save();
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
