// Responsive layout: no horizontal scroll at 320–1920 px, landscape phone, 200% / 400% zoom and the app's biggest text size,
// in English and Urdu, on every screen. axe-core at 768 and 1280 px; screenshots at 768 and 1280 px.
// node tests/e2e/responsive.mjs en|ur [from to]   -> merges into evidence/responsive.json (rows replaced by screen name)
import fs from 'node:fs';
import { AxeBuilder } from '../../tools/axe.mjs';
import { launch, serve, newPhone, recorder, fontsReady, ROOT, EVID } from './common.mjs';
const lang = process.argv[2] || 'en';
const from = +(process.argv[3] || 0), to = +(process.argv[4] || 99);
const R = recorder('responsive-' + lang + (process.argv[3] ? '-' + from + '-' + to : ''));
const SHOTS = ROOT + 'screenshots/'; fs.mkdirSync(SHOTS, { recursive: true });
const VIEWS = [
  { name: '320 phone', w: 320, h: 640 }, { name: '360 phone', w: 360, h: 740 }, { name: '414 phone', w: 414, h: 896 },
  { name: '740x360 landscape phone', w: 740, h: 360 }, { name: '768 tablet', w: 768, h: 1024 }, { name: '1024 laptop', w: 1024, h: 768 },
  { name: '1280 desktop', w: 1280, h: 800 }, { name: '1920 desktop', w: 1920, h: 1080 },
  { name: '200% zoom of a 1280 window (= 640 CSS px)', w: 640, h: 400 },
  { name: '400% zoom of a 1280 window (= 320 CSS px, WCAG reflow)', w: 320, h: 200 },
  { name: '320 phone + app text size 160%', w: 320, h: 640, ts: 1.6 }
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const { server, url } = await serve();
const b = await launch();
const rows = [];
let error = null;
try {
  const { page, errors } = await newPhone(b, { isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  page.on('dialog', (d) => d.accept());
  await page.goto(url + 'index.html');
  await page.evaluate(async (lang) => { localStorage.clear(); sessionStorage.clear(); await window.EkApp.store.loadDemo(); window.EkApp.store.setSettings({ lang }); }, lang);
  const ids = await page.evaluate(() => Object.fromEntries(window.EkApp.store.listProfiles().map((p) => [p.name, p.id])));
  const who = (n) => page.evaluate((id) => sessionStorage.setItem('ekphone:who', id), ids[n]);
  const SCREENS = [
    ['01-picker', '/', null], ['02-add-learner', '/add', null], ['03-pin', '/pin/' + ids.Zara, null],
    ['04-home', '/home', 'Ayesha'], ['05-lesson', '/read/g5-fractions', 'Ayesha'],
    ['07-quiz', '/quiz/g5-fractions', 'Ayesha', async () => { await page.locator('.opt-label').nth(1).click(); await page.locator('#quiz-action').click(); }],
    ['10-result', '/result/g5-fractions', 'Ayesha'], ['11-teacher', '/teacher', null],
    ['15-write', '/write', null, async () => { await page.waitForSelector('#w-title'); await page.locator('#w-preview').click(); await page.waitForSelector('#w-summary:not([hidden])'); }],
    ['12-share-qr', '/share/g5-fractions', null, async () => { await page.waitForSelector('#qr-canvas[data-chunk]'); await page.locator('#qr-pause').click(); }],
    ['13-receive', '/receive', null]
  ];
  for (const [name, route, learner, action] of SCREENS.slice(from, to)) {
    await page.setViewportSize({ width: 360, height: 740 });
    if (learner) await who(learner);
    await page.evaluate(() => { window.EkApp.store.setSettings({ textSize: 1 }); document.documentElement.style.setProperty('--ts', 1); });
    await page.goto(url + 'index.html#' + route); await page.reload();
    await page.waitForTimeout(350);
    if (action) await action();
    await fontsReady(page);
    const row = { screen: name, route, results: [], axe: {} };
    for (const v of VIEWS) {
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.evaluate((ts) => document.documentElement.style.setProperty('--ts', ts), v.ts || 1);
      await page.waitForTimeout(60);
      const m = await page.evaluate(() => { const d = document.documentElement; return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth }; });
      const pass = m.scrollWidth <= m.clientWidth;
      row.results.push({ view: v.name, width: v.w, height: v.h, ...m, pass });
      if (!pass) console.log('   overflow', name, v.name, JSON.stringify(m));
      if ((v.w === 1280 || v.w === 768) && !v.ts) {
        const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        row.axe[v.w] = { violations: axe.violations.length, ids: axe.violations.map((x) => x.id + ': ' + x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')) };
        if (axe.violations.length) console.log('   axe', name, v.w, JSON.stringify(row.axe[v.w].ids));
        if (lang === 'en' || ['01-picker', '05-lesson', '11-teacher'].includes(name)) await page.screenshot({ path: SHOTS + 'wide-' + v.w + '-' + lang + '-' + name + '.png' });
      }
    }
    const fails = row.results.filter((r) => !r.pass).length;
    const axeV = Object.values(row.axe).reduce((s, a) => s + a.violations, 0);
    R.check(fails === 0 && axeV === 0, name + ': no horizontal scroll in ' + VIEWS.length + ' views; axe 768+1280: ' + axeV + ' violations', { fails, axeV });
    rows.push(row);
  }
  R.check(errors.length === 0, 'no console errors', errors);
} catch (e) { console.error(e.message); error = e.message; process.exitCode = 1; }
finally {
  const file = EVID + 'responsive.json';
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  all.test = 'responsive'; all.generated = new Date().toISOString(); all.browser = 'Chromium headless shell 141 (Playwright 1.56.1)';
  all.views = VIEWS.map((v) => v.name);
  all.method = 'Each screen is opened, then the viewport is resized through every view and document.documentElement.scrollWidth is compared with clientWidth (pass = scrollWidth <= clientWidth). Browser zoom is emulated by the CSS-pixel width it produces. axe-core ' + JSON.parse(fs.readFileSync(ROOT + 'tools/node_modules/axe-core/package.json')).version + ' runs at 768 and 1280 px.';
  const prev = (all[lang] && all[lang].screens) || [];
  const merged = prev.filter((r) => !rows.some((x) => x.screen === r.screen)).concat(rows).sort((a, b) => a.screen.localeCompare(b.screen));
  all[lang] = { screens: merged, checks: merged.length * VIEWS.length, failures: merged.reduce((s, r) => s + r.results.filter((x) => !x.pass).length, 0), axeScans: merged.reduce((s, r) => s + Object.keys(r.axe).length, 0), axeViolations: merged.reduce((s, r) => s + Object.values(r.axe).reduce((t, a) => t + a.violations, 0), 0), error: error || undefined };
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
  R.save({ rows: rows.length, error: error || undefined });
  await b.close(); server.close();
}
