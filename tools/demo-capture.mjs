// Captures the stills for the demo video (docs/demo.mp4) and a few README screenshots.
// Run from repo root: node tools/demo-capture.mjs <outDir>   (needs the Chromium headless shell, see tools/pw.mjs)
// Every frame is a real screenshot of the app served from app/ by tools/serve.mjs. Learners are synthetic.
import fs from 'node:fs';
import { launch, serve, PHONE } from './helpers.mjs'; // same phone config as the README screenshots (tests/e2e/screens.mjs via newPhone): 360x740 CSS @2x = 720x1480
const OUT = process.argv[2] || '/tmp/ekfin/frames';
const ROOT = new URL('../', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const shots = [];
let n = 0;
async function shot(page, name, meta = {}) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
  const file = String(++n).padStart(3, '0') + '-' + name + '.png';
  await page.screenshot({ path: OUT + '/' + file });
  shots.push({ file, name, ...meta });
  console.log('shot', file);
}
const lessonTxt = OUT + '/day-and-night.txt';
fs.writeFileSync(lessonTxt, 'Day and Night\nThe Earth spins like a top. It takes one day to spin once around its axis. When our side of the Earth faces the Sun, it is day. When our side turns away from the Sun, it is night. The Moon and stars are easier to see at night. The Sun does not move around the Earth each day.\n');

const { server, url } = await serve();
const b = await launch();
const errors = [];
try {
  const A = await b.newContext(PHONE);
  const p = await A.newPage(); p.setDefaultTimeout(10000);
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url + 'index.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload();
  await p.waitForFunction(() => window.EkApp);
  await shot(p, 'empty');
  await p.locator('#try-demo').click(); await p.waitForSelector('.tag');
  await shot(p, 'demo-learners');
  await p.locator('.tag', { hasText: 'Zara' }).click();
  await shot(p, 'pin');
  await p.getByLabel('PIN for Zara').fill('1234');
  await shot(p, 'pin-filled');
  await p.getByRole('button', { name: 'Open' }).click();
  await p.waitForSelector('.today-title');
  await shot(p, 'home-zara');
  await p.getByRole('link', { name: 'Start reading' }).click();
  await p.waitForSelector('#lesson-text');
  await p.locator('#lesson-text').focus();
  await shot(p, 'read-0');
  for (let i = 1; i <= 3; i++) {
    await p.keyboard.press('ArrowDown');
    await p.evaluate(() => { const s = document.querySelector('.s.on'); if (s) s.scrollIntoView({ block: 'center' }); });
    await shot(p, 'read-' + i, { on: await p.locator('.s.on').getAttribute('data-i') });
  }
  // quiz
  await p.getByRole('link', { name: 'Start practice' }).scrollIntoViewIfNeeded();
  await p.getByRole('link', { name: 'Start practice' }).click();
  await p.waitForSelector('.opt-label');
  const qid = (await p.evaluate(() => location.hash)).split('/').pop();
  const answers = JSON.parse(fs.readFileSync(ROOT + 'app/packs/' + qid + '.ekpack.json', 'utf8')).quiz.map((x) => x.answer);
  for (let i = 0; i < 5; i++) {
    const pick = i === 1 ? (answers[i] + 1) % 3 : answers[i]; // one deliberate wrong answer to show the feedback
    await p.locator('.opt-label').nth(pick).click();
    if (i === 0) await shot(p, 'quiz-pick');
    await p.getByRole('button', { name: 'Check answer' }).click();
    await p.evaluate(() => document.querySelector('#feedback')?.scrollIntoView({ block: 'center' }));
    if (i < 2) await shot(p, 'quiz-feedback-' + i);
    await p.getByRole('button', { name: i === 4 ? 'See my score' : 'Next question' }).click();
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, 'quiz-result');
  // per-child progress
  await p.getByRole('link', { name: 'My lessons' }).click();
  await p.waitForSelector('.today-title');
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, 'home-zara-after');
  await p.getByRole('button', { name: 'Switch learner' }).click();
  await p.waitForSelector('.tag');
  await shot(p, 'picker-ticks');
  await p.locator('.tag', { hasText: 'Hamza' }).click();
  await p.waitForSelector('.today-title');
  await shot(p, 'home-hamza');
  // Urdu
  await p.getByRole('button', { name: 'اردو' }).click();
  await p.waitForFunction(() => document.documentElement.dir === 'rtl');
  await p.waitForFunction(() => document.fonts.check('20px "Noto Nastaliq Urdu"', 'کسر'));
  await shot(p, 'urdu-home');
  await p.locator('a.btn', { hasText: 'پڑھنا شروع کریں' }).click();
  await p.waitForSelector('#lesson-text');
  await p.locator('#lesson-text').focus(); await p.keyboard.press('ArrowLeft');
  await shot(p, 'urdu-read');
  await p.goto(url + 'index.html#/home'); await p.waitForTimeout(300);
  await p.locator('.lang-toggle button').first().click();
  await p.waitForFunction(() => document.documentElement.dir === 'ltr');
  // teacher: import a .txt, edit a suggested question, save
  await p.goto(url + 'index.html#/teacher'); await p.waitForTimeout(400);
  await shot(p, 'teacher');
  await p.goto(url + 'index.html#/write'); await p.waitForSelector('#w-import-file');
  await shot(p, 'write-top');
  await p.setInputFiles('#w-import-file', lessonTxt);
  await p.waitForSelector('#w-import-msg');
  await p.waitForFunction(() => /Imported/.test(document.querySelector('#w-import-msg')?.textContent || ''));
  await p.evaluate(() => document.querySelector('#w-import-msg').scrollIntoView({ block: 'center' }));
  await shot(p, 'import-msg', { msg: await p.locator('#w-import-msg').textContent() });
  await p.locator('#w-title').scrollIntoViewIfNeeded(); await p.evaluate(() => document.querySelector('#w-title').scrollIntoView({ block: 'start' }));
  await shot(p, 'import-filled');
  await p.evaluate(() => document.querySelector('#w-q0').scrollIntoView({ block: 'start' }));
  await shot(p, 'import-q0', { q0: await p.locator('#w-q0').inputValue() });
  await p.evaluate(() => document.querySelector('#w-q4').scrollIntoView({ block: 'start' }));
  await shot(p, 'import-q4-before', { q4: await p.locator('#w-q4').inputValue() });
  await p.locator('#w-q4').fill('Fill in the blank: The Sun does not move around the _____.');
  await p.evaluate(() => document.querySelector('#w-q4').scrollIntoView({ block: 'start' }));
  await shot(p, 'import-q4-edited', { q4: await p.locator('#w-q4').inputValue() });
  await p.locator('#w-preview').click(); await p.waitForSelector('#w-pv-h'); await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, 'write-preview');
  await p.locator('#w-save').click(); await p.waitForSelector('#w-done');
  await p.evaluate(() => document.querySelector('#w-done').scrollIntoView({ block: 'center' }));
  await shot(p, 'write-saved');
  // share by QR (the lesson just written)
  const packId = await p.evaluate(() => { const l = window.EkApp.store.listLocalPacks ? window.EkApp.store.listLocalPacks() : null; return l && l.length ? (l[l.length - 1].id || l[l.length - 1].pack?.id) : null; }).catch(() => null);
  await p.goto(url + 'index.html#/teacher'); await p.waitForTimeout(400);
  const shareLinks = await p.locator('a[href^="#/share/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const target = shareLinks.find((h) => /day-and-night/.test(h)) || (packId ? '#/share/' + packId : shareLinks[shareLinks.length - 1]);
  await p.locator(`a[href="${target}"]`).scrollIntoViewIfNeeded();
  await shot(p, 'teacher-written');
  await p.goto(url + 'index.html' + target); await p.waitForSelector('#qr-canvas[data-chunk]');
  await p.locator('#qr-pause').click();
  const total = await p.evaluate(() => { const m = (document.querySelector('#qr-canvas').getAttribute('data-chunk') || '').match(/\/(\d+)\/(\d+)\//); return m ? +m[2] : 0; });
  const links = [];
  for (let i = 0; i < total; i++) {
    links.push(await p.locator('#qr-canvas').getAttribute('data-chunk'));
    if (i === 0) { await p.evaluate(() => window.scrollTo(0, 0)); await shot(p, 'qr-1'); await p.evaluate(() => document.querySelector('#qr-caption').scrollIntoView({ block: 'center' })); await shot(p, 'qr-caption', { caption: await p.locator('#qr-caption').textContent() }); }
    await p.locator('#qr-next').click();
  }
  await p.evaluate(() => window.scrollTo(0, 0)); await shot(p, 'qr-next');
  // a second, separate browser context opens the links, as a phone camera app would
  const B = await b.newContext(PHONE);
  const q = await B.newPage(); q.setDefaultTimeout(10000);
  await q.goto(url + 'index.html'); await q.waitForFunction(() => window.EkApp);
  for (let i = 0; i < links.length; i++) {
    await q.goto(links[i]); await q.waitForTimeout(300);
    if (i === 0) await shot(q, 'rx-first', { status: await q.locator('#rx-status').textContent() });
  }
  await q.waitForSelector('.pv-size');
  await shot(q, 'rx-preview', { size: await q.locator('.pv-size').textContent(), codes: links.length });
  await q.locator('#rx-load').click(); await q.waitForSelector('#rx-done');
  await shot(q, 'rx-done', { done: await q.locator('#rx-done').textContent() });
  // offline: phone A, network off, reload
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.goto(url + 'index.html#/'); await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  await A.setOffline(true);
  await p.reload(); await p.waitForSelector('.tag');
  const offline = await p.evaluate(() => ({ onLine: navigator.onLine, sw: !!navigator.serviceWorker.controller }));
  await shot(p, 'offline-picker', offline);
  await p.locator('.tag', { hasText: 'Ayesha' }).click(); await p.waitForSelector('.today-title');
  await p.getByRole('link', { name: 'Start reading' }).click(); await p.waitForSelector('#lesson-text');
  await shot(p, 'offline-read');
  await A.setOffline(false);
  // README extras: QR caption on a 360x740 phone, desktop 1280 demo + import
  const C = await b.newContext({ ...PHONE, viewport: { width: 360, height: 740 } });
  const c = await C.newPage();
  await c.goto(url + 'index.html'); await c.waitForFunction(() => window.EkApp);
  await c.goto(url + 'index.html#/share/g5-fractions'); await c.waitForSelector('#qr-canvas[data-chunk]'); await c.locator('#qr-pause').click();
  await c.evaluate(() => document.querySelector('#qr-caption').scrollIntoView({ block: 'end' }));
  await c.evaluate(() => document.fonts.ready); await c.waitForTimeout(300);
  await c.screenshot({ path: ROOT + 'screenshots/en-21-qr-link.png' });
  const D = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const d = await D.newPage();
  await d.goto(url + 'index.html'); await d.waitForFunction(() => window.EkApp); await d.evaluate(() => localStorage.clear()); await d.reload();
  await d.locator('#try-demo').click(); await d.waitForSelector('.tag'); await d.evaluate(() => document.fonts.ready); await d.waitForTimeout(300);
  await d.screenshot({ path: ROOT + 'screenshots/wide-1280-en-16-demo.png' });
  await d.goto(url + 'index.html#/write'); await d.waitForSelector('#w-import-file');
  await d.setInputFiles('#w-import-file', lessonTxt);
  await d.waitForFunction(() => /Imported/.test(document.querySelector('#w-import-msg')?.textContent || ''));
  await d.evaluate(() => document.querySelector('#w-import-msg').scrollIntoView({ block: 'start' })); await d.waitForTimeout(300);
  await d.screenshot({ path: ROOT + 'screenshots/wide-1280-en-17-import.png' });
  fs.writeFileSync(OUT + '/shots.json', JSON.stringify({ shots, links: links.length, errors }, null, 2));
  console.log('DONE', shots.length, 'shots, errors:', errors.length);
} catch (e) { console.error('ERR', e.message); fs.writeFileSync(OUT + '/shots.json', JSON.stringify({ shots, error: e.message, errors }, null, 2)); process.exitCode = 1; }
finally { await b.close(); server.close(); }
