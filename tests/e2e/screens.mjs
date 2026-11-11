// axe-core scan + 360x740 screenshot of every screen. node tests/e2e/screens.mjs en|ur
import fs from 'node:fs';
import { AxeBuilder } from '../../tools/axe.mjs';
import { launch, serve, newPhone, seed, asLearner, fontsReady, recorder, ROOT, EVID } from './common.mjs';
const lang = process.argv[2] || 'en';
const from = +(process.argv[3] || 0), to = +(process.argv[4] || 99);
const R = recorder('axe-' + lang + (process.argv[3] ? '-' + from + '-' + to : ''));
const SHOTS = ROOT + 'screenshots/'; fs.mkdirSync(SHOTS, { recursive: true });
const { server, url } = await serve();
const b = await launch();
const results = [];
const T = (en, ur) => (lang === 'ur' ? ur : en);
try {
  const { page, errors } = await newPhone(b);
  await seed(page, url, { lang });
  const screens = [
    ['01-picker', '/', null],
    ['02-add-learner', '/add', async () => { await page.locator('#f-name').fill('Sana'); await page.locator('#f-pin').fill('12'); await page.locator('form button[type=submit]').click(); }],
    ['03-pin', null, async () => { await page.goto(url + 'index.html#/'); await page.locator('.tag', { hasText: 'Zara' }).click(); }],
    ['04-home', '/home', null, 'Ayesha'],
    ['05-lesson', '/read/g5-fractions', async () => { await page.locator('#lesson-text').focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.locator('#lesson-text').blur(); await page.evaluate(() => window.scrollTo(0, 0)); }, 'Ayesha'],
    ['06-lesson-menu', '/read/g5-water-cycle', async () => { await page.locator('[aria-controls=lesson-menu]').click(); }, 'Ayesha'],
    ['07-quiz', '/quiz/g5-fractions', async () => { await page.locator('.opt-label').nth(1).click(); }, 'Ayesha'],
    ['08-quiz-feedback', null, async () => { await page.locator('#quiz-action').click(); }],
    ['09-quiz-wrong', null, async () => { await page.locator('#quiz-action').click(); await page.locator('.opt-label').nth(0).click(); await page.locator('#quiz-action').click(); }],
    ['10-result', null, async () => {
      await page.locator('#quiz-action').click();
      for (let i = 2; i < 5; i++) { await page.locator('.opt-label').nth(1).click(); await page.locator('#quiz-action').click(); await page.locator('#quiz-action').click(); }
    }],
    ['11-teacher', '/teacher', null],
    ['12-share-qr', '/share/g5-fractions', async () => { await page.waitForSelector('#qr-canvas[data-chunk]'); await page.locator('#qr-pause').click(); await page.locator('#qr-next').click(); await page.locator('#qr-next').click(); await page.locator('#qr-next').blur(); }],
    ['13-receive', '/receive', null],
    ['14-receive-preview', null, async () => { await page.setInputFiles('#rx-file', ROOT + 'app/samples/g3-plant-parts.ekpack.json'); await page.waitForSelector('.pv-size'); }]
  ];
  for (const [idx, [name, route, action, who]] of screens.entries()) {
    if (idx < from || idx >= to) { if (idx < from && action && !route) { /* stateful step skipped */ } continue; }
    if (who) await asLearner(page, who);
    if (route) { await page.goto(url + 'index.html#' + route); await page.waitForTimeout(250); }
    if (action) await action();
    await page.waitForTimeout(300);
    await fontsReady(page);
    const shot = SHOTS + lang + '-' + name + '.png';
    await page.screenshot({ path: shot });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const v = axe.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 5) }));
    results.push({ screen: name, url: page.url().replace(url, '/'), violations: v.length, passes: axe.passes.length, incomplete: axe.incomplete.map((x) => x.id), details: v, screenshot: 'screenshots/' + lang + '-' + name + '.png' });
    R.check(true, name + ': axe ran', { violations: v.length, passes: axe.passes.length });
    if (v.length) console.log('    ', JSON.stringify(v));
  }
  const total = results.reduce((s, r) => s + r.violations, 0);
  R.check(total === 0, 'zero axe violations on all ' + results.length + ' screens (' + lang + ')', { total });
  R.check(errors.length === 0, 'no console errors', errors);
  R.save({ axeVersion: JSON.parse(fs.readFileSync(ROOT + 'tools/node_modules/axe-core/package.json')).version, tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'], viewport: '360x740 @2x', results });
} catch (e) { console.error(e.message); R.save({ error: e.message, results }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
