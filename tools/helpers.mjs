// Shared test helpers: start server, open a 360x740 phone page, seed synthetic learners.
import { launch } from './pw.mjs';
import { serve } from './serve.mjs';
export { launch, serve };

export const PHONE = { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };

/** Synthetic sibling names only (no real student data). */
export const DEMO = [
  { name: 'Ayesha', pin: '' }, { name: 'Bilal', pin: '' }, { name: 'Zara', pin: '1234' }, { name: 'Hamza', pin: '' }
];

export async function newPhone(browser, extra = {}) {
  const ctx = await browser.newContext({ ...PHONE, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { ctx, page, errors };
}

export async function seed(page, base, { lang = 'en', learners = DEMO, progress = true } = {}) {
  await page.goto(base + 'index.html');
  await page.waitForFunction(() => window.EkApp);
  await page.evaluate(async ({ learners, lang, progress }) => {
    localStorage.clear();
    const s = window.EkApp.store;
    for (const l of learners) await s.addProfile(l.name, l.pin);
    s.setSettings({ lang });
    if (progress) {
      const ids = s.listProfiles().map((p) => p.id);
      s.saveQuiz(ids[0], 'g5-fractions', 4, 5);
      s.saveQuiz(ids[1], 'g5-fractions', 5, 5);
      s.saveReading(ids[1], 'g5-water-cycle', 3, false);
    }
  }, { learners, lang, progress });
  await page.goto(base + 'index.html#/');
  await page.reload();
  await page.waitForFunction(() => window.EkApp);
}

export async function asLearner(page, name) {
  await page.evaluate((name) => { const p = window.EkApp.store.listProfiles().find((x) => x.name === name); sessionStorage.setItem('ekphone:who', p.id); }, name);
}

export async function fontsReady(page) { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); }
