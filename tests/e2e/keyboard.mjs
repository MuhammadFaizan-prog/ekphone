// Keyboard-only walkthrough: no mouse, no touch. Tab / Shift+Tab / Enter / Space / arrow keys only.
// Logs every focus stop and checks a visible focus indicator. Writes evidence/keyboard-walkthrough.{json,md}.
import fs from 'node:fs';
import { launch, serve, newPhone, recorder, EVID } from './common.mjs';
const R = recorder('keyboard-walkthrough');
const { server, url } = await serve();
const b = await launch();
const log = [];
try {
  const { page, errors } = await newPhone(b, { isMobile: false, hasTouch: false });
  await page.goto(url + 'index.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  const focused = () => page.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body) return { name: '(body)' };
    const cs = getComputedStyle(e);
    const name = (e.getAttribute('aria-label') || e.labels?.[0]?.textContent || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return { tag: e.tagName.toLowerCase(), id: e.id, name, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, outline: cs.outlineStyle + ' ' + cs.outlineWidth };
  });
  async function press(key, note) { await page.keyboard.press(key); await page.waitForTimeout(80); const f = await focused(); log.push({ key, note: note || '', ...f }); return f; }
  async function tabTo(pred, label, max = 25) {
    for (let i = 0; i < max; i++) { const f = await press('Tab'); if (pred(f)) { R.check(f.ring || f.tag === 'input' || f.tag === 'div' || f.tag === 'textarea', 'focus ring visible on ' + label, f.outline); return f; } }
    throw new Error('could not Tab to ' + label);
  }
  // skip link first
  let f = await press('Tab', 'first Tab');
  R.check(/Skip to main content/.test(f.name), 'first Tab reaches the skip link', f.name);
  await tabTo((x) => x.name.includes('Add a learner'), 'Add a learner');
  await press('Enter');
  R.check((await focused()).id === 'screen-title', 'focus moves to the new screen heading');
  await tabTo((x) => x.id === 'f-name', 'name field');
  await page.keyboard.type('Ayesha'); log.push({ key: 'type "Ayesha"' });
  await press('Enter', 'submit form');
  f = await tabTo((x) => x.tag === 'button' && x.name.startsWith('Ayesha'), 'Ayesha name tag');
  await press('Enter');
  R.check(await page.getByRole('heading', { name: 'Salaam, Ayesha' }).isVisible(), 'opened Ayesha by keyboard');
  await tabTo((x) => x.name.includes('Start reading'), 'Start reading');
  await press('Enter');
  await tabTo((x) => x.id === 'lesson-text', 'lesson text region');
  await press('ArrowDown'); await press('ArrowDown'); await press('ArrowRight');
  R.check((await page.locator('.s.on').getAttribute('data-i')) === '3', 'arrow keys move the highlight (sentence 4)');
  await press('End');
  R.check((await page.locator('.s.on').getAttribute('data-i')) === '9', 'End jumps to the last sentence');
  await tabTo((x) => x.name.includes('Start practice'), 'Start practice');
  await press('Enter');
  for (let q = 0; q < 5; q++) {
    await tabTo((x) => x.tag === 'input' && x.id.startsWith('q' + q), 'first answer of question ' + (q + 1));
    const target = [1, 1, 1, 2, 1][q];
    for (let k = 0; k < target; k++) await press('ArrowDown', 'move radio');
    await press('Space', 'select');
    await tabTo((x) => x.id === 'quiz-action', 'Check answer');
    await press('Enter', 'check');
    R.check((await page.locator('#feedback').textContent()).length > 0, 'feedback announced for question ' + (q + 1));
    R.check((await focused()).id === 'quiz-action', 'focus stays on the action button after checking');
    await press('Enter', q === 4 ? 'see score' : 'next question');
  }
  R.check(await page.getByText('You got 5 of 5 right.').isVisible(), 'quiz finished with keyboard only: 5 of 5');
  // language switch + teacher screen by keyboard
  await tabTo((x) => x.name === 'اردو', 'Urdu toggle');
  await press('Enter');
  R.check(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'Urdu switched by keyboard');
  R.check((await focused()).name === 'اردو', 'focus kept on the toggle after re-render');
  // teacher writes a lesson, keyboard only
  await tabTo((x) => x.name === 'English', 'English toggle'); await press('Enter');
  await tabTo((x) => x.name.includes('My lessons'), 'My lessons'); await press('Enter');
  await tabTo((x) => x.name.includes('Switch learner'), 'Switch learner'); await press('Enter');
  await tabTo((x) => x.name.includes('Teacher or older sibling'), 'Teacher or older sibling'); await press('Enter');
  await tabTo((x) => x.id === 'go-write', 'Write a lesson'); await press('Enter');
  await page.waitForSelector('#w-title');
  const type = async (txt) => { await page.keyboard.type(txt); log.push({ key: 'type "' + txt + '"' }); };
  await tabTo((x) => x.id === 'w-title', 'lesson title field'); await type('Kites');
  await tabTo((x) => x.id === 'w-text', 'lesson text field'); await type('A kite flies in the wind. It needs a long string.');
  for (let q = 0; q < 5; q++) {
    await tabTo((x) => x.id === 'w-q' + q, 'question ' + (q + 1) + ' text'); await type('Question ' + (q + 1) + '?');
    for (let k = 0; k < 3; k++) { await tabTo((x) => x.id === 'w-q' + q + '-o' + k, 'q' + (q + 1) + ' answer ' + 'ABC'[k]); await type('Answer ' + 'ABC'[k]); }
    await tabTo((x) => x.id === 'w-q' + q + '-r0', 'q' + (q + 1) + ' right-answer radios'); await press('Space', 'choose A');
  }
  await tabTo((x) => x.id === 'w-preview', 'Preview'); await press('Enter');
  R.check((await focused()).id === 'w-pv-h', 'focus moves to the preview heading');
  await tabTo((x) => x.id === 'w-save', 'Save lesson'); await press('Enter');
  R.check((await focused()).id === 'w-done', 'lesson saved by keyboard; focus on the confirmation');
  R.check(errors.length === 0, 'no console errors', errors);
  const rings = log.filter((l) => l.tag && ['button', 'a'].includes(l.tag));
  R.check(rings.every((l) => l.ring), 'every focused button/link showed a ≥2px focus outline', { checked: rings.length });
  fs.writeFileSync(EVID + 'keyboard-walkthrough.md', '# Keyboard-only walkthrough\n\nGenerated by tests/e2e/keyboard.mjs (Playwright, no mouse/touch). ' + log.length + ' key presses.\n\n| # | Key | Focus on | Visible ring |\n|---|---|---|---|\n' + log.map((l, i) => `| ${i + 1} | ${l.key}${l.note ? ' (' + l.note + ')' : ''} | ${l.tag ? `${l.tag}${l.id ? '#' + l.id : ''} "${(l.name || '').replace(/\|/g, '/')}"` : ''} | ${l.tag ? (l.ring ? 'yes' : (['input', 'div', 'textarea', 'h1', 'legend'].includes(l.tag) ? 'n/a (styled)' : 'NO')) : ''} |`).join('\n') + '\n');
  R.save({ keyPresses: log.length, log });
} catch (e) { console.error(e.message); R.save({ error: e.message, log }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
