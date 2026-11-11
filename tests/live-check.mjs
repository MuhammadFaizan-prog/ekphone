// Live check: runs against the deployed site (default https://ekphone-app.vercel.app), not a local copy.
// Core flow, offline reload with 0 app requests to the network, and axe-core on the main screens.
// node tests/live-check.mjs [url]   -> evidence/live-check.json
import fs from 'node:fs';
import { AxeBuilder } from '../tools/axe.mjs';
import { launch, newPhone, recorder, ROOT } from './e2e/common.mjs';
const LIVE = (process.argv[2] || 'https://ekphone-app.vercel.app/').replace(/\/?$/, '/');
const R = recorder('live-check');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
// Sandboxes behind an HTTP proxy: hand it to Chromium (credentials split out, as Playwright expects).
const px = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || '';
let proxy;
if (px) { const u = new URL(px); proxy = { server: u.protocol + '//' + u.host, username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined }; }
const b = await launch(proxy ? { proxy } : {});
const axeOut = [];
let deploy = {};
try {
  // 1. is the live site running this commit's build? (service-worker VERSION is a hash of every cached file)
  const liveSw = await (await fetch(LIVE + 'sw.js', { cache: 'no-store' })).text();
  const localSw = fs.readFileSync(ROOT + 'app/sw.js', 'utf8');
  const v = (s) => (s.match(/VERSION = '([^']+)'/) || [])[1];
  deploy = { live: v(liveSw), local: v(localSw) };
  R.check(deploy.live && deploy.live === deploy.local, 'live site serves the same build as this commit', deploy);

  const { ctx, page, errors } = await newPhone(b);
  page.on('dialog', (d) => d.accept());
  const axe = async (name) => { const r = await new AxeBuilder({ page }).withTags(TAGS).analyze(); axeOut.push({ screen: name, violations: r.violations.length, ids: r.violations.map((x) => x.id) }); return r.violations.length; };
  await page.goto(LIVE);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  R.check(await page.getByRole('heading', { name: 'Who is studying?' }).isVisible(), 'live: first screen loads');
  await axe('picker (empty)');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.waitForSelector('.tag');
  R.check((await page.locator('.tag').count()) === 4 && (await page.locator('#demo-note').textContent()).includes('1234'), 'live: one tap loads 4 demo learners, PIN shown');
  await axe('picker (demo)');
  await page.locator('.tag', { hasText: 'Zara' }).click();
  await page.getByLabel('PIN for Zara').fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  R.check(await page.getByRole('heading', { name: 'Salaam, Zara' }).isVisible(), 'live: PIN 1234 opens Zara');
  await axe('home');
  await page.getByRole('link', { name: /Fractions/ }).first().click();
  await page.locator('#lesson-text').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  R.check((await page.locator('.s.on').getAttribute('data-i')) === '3', 'live: arrow keys move the highlighter');
  await axe('lesson');
  await page.getByRole('link', { name: 'Start practice' }).click();
  const picks = ['One quarter', '4', '2/4', '4', 'No, the pieces are not equal'];
  for (let i = 0; i < 5; i++) {
    await page.getByLabel(picks[i], { exact: true }).check();
    await page.getByRole('button', { name: 'Check answer' }).click();
    if (i === 0) await axe('quiz feedback');
    await page.getByRole('button', { name: i === 4 ? 'See my score' : 'Next question' }).click();
  }
  R.check(await page.getByText('You got 5 of 5 right.').isVisible(), 'live: quiz finished, 5 of 5');
  const best = await page.evaluate(() => { const s = window.EkApp.store; const z = s.listProfiles().find((p) => p.name === 'Zara'); return s.getPackProgress(z.id, 'g5-fractions').best; });
  R.check(best === 5, 'live: score saved for Zara only', { best });
  await page.goto(LIVE + '#/teacher'); await page.waitForTimeout(300); await axe('teacher');
  await page.goto(LIVE + '#/write'); await page.waitForSelector('#w-title'); await axe('write a lesson');
  await page.goto(LIVE + '#/share/g5-fractions'); await page.waitForSelector('#qr-canvas[data-chunk]'); await axe('share by QR');
  await page.goto(LIVE + '#/'); await page.getByRole('button', { name: 'اردو' }).click(); await page.waitForTimeout(500); await axe('picker (Urdu)');
  await page.getByRole('button', { name: 'English' }).click();

  // 2. offline: service worker ready, then airplane mode, reload, use the app
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForTimeout(800);
  const net = { fromCache: 0, toNetwork: [] };
  let offline = false;
  const track = async (r) => {
    if (!offline || !/^https?:/.test(r.url())) return;
    if (r.serviceWorker()) { net.toNetwork.push('sw-fetch ' + r.url()); return; }
    const resp = await r.response().catch(() => null);
    if (resp && resp.fromServiceWorker()) net.fromCache++; else net.toNetwork.push(r.url());
  };
  ctx.on('requestfinished', track); ctx.on('requestfailed', track);
  await ctx.setOffline(true); offline = true;
  await page.reload();
  R.check(await page.getByRole('heading', { name: 'Who is studying?' }).isVisible() && await page.evaluate(() => !!navigator.serviceWorker.controller), 'live offline: app reloads from the service worker');
  await page.locator('.tag', { hasText: 'Ayesha' }).click();
  await page.getByRole('link', { name: 'Start reading' }).click();
  R.check((await page.locator('.s').count()) > 0, 'live offline: lesson opens');
  await page.goto(LIVE + '#/write'); await page.waitForSelector('#w-title');
  R.check(true, 'live offline: Write a lesson opens');
  await page.waitForTimeout(400);
  R.check(net.toNetwork.length === 0, 'live offline: 0 app requests to the network (' + net.fromCache + ' from the service worker cache)', net);
  const total = axeOut.reduce((s, a) => s + a.violations, 0);
  R.check(total === 0, 'live: axe-core 0 violations on ' + axeOut.length + ' screens', axeOut.filter((a) => a.violations));
  R.check(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)).length === 0, 'live: no console errors', errors);
} catch (e) { console.error(e.message); R.saveOut = e.message; process.exitCode = 1; }
finally {
  const out = R.save({ url: LIVE, deploy, axe: axeOut, error: R.saveOut, note: 'Run from a cloud sandbox against the public deploy. Chromium offline emulation; Playwright cannot see requests the browser makes for its own service-worker update check.' });
  await b.close();
}
