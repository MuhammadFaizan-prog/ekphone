// End-to-end: add learners (with PIN), PIN gate, read with arrow keys + read-aloud highlight sync,
// quiz with feedback, per-child progress, Urdu RTL switch.
import { launch, serve, newPhone, recorder, FAKE_SPEECH } from './common.mjs';
const R = recorder('e2e-flow');
const { server, url } = await serve();
const b = await launch();
try {
  const { ctx, page, errors } = await newPhone(b);
  await ctx.addInitScript(FAKE_SPEECH);
  await page.goto(url + 'index.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  R.check(await page.getByRole('heading', { name: 'Who is studying?' }).isVisible(), 'picker shows with no learners');

  // add learner with bad PIN -> error, then good PIN
  await page.getByRole('button', { name: 'Add a learner' }).click();
  await page.getByLabel('Name').fill('Ayesha');
  await page.getByLabel('4-digit PIN (optional)').fill('12');
  await page.getByRole('button', { name: 'Save' }).click();
  R.check((await page.locator('#add-err').textContent()).includes('exactly 4'), 'bad PIN shows error', await page.locator('#add-err').textContent());
  R.check(await page.getByLabel('4-digit PIN (optional)').getAttribute('aria-invalid') === 'true', 'bad PIN field marked aria-invalid');
  await page.getByLabel('4-digit PIN (optional)').fill('2580');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Add a learner' }).click();
  await page.getByLabel('Name').fill('Bilal');
  await page.getByRole('button', { name: 'Save' }).click();
  const tags = await page.locator('.tag .tag-name').allTextContents();
  R.check(tags.join() === 'Ayesha,Bilal', 'two name tags on the takhti', tags);
  const stored = await page.evaluate(() => localStorage.getItem('ekphone:v1:profiles'));
  R.check(!stored.includes('2580'), 'PIN not stored in plain text');

  // PIN gate
  await page.locator('.tag', { hasText: 'Ayesha' }).click();
  await page.getByLabel('PIN for Ayesha').fill('1111');
  await page.getByRole('button', { name: 'Open' }).click();
  R.check((await page.locator('#pin-err').textContent()).includes('Wrong PIN'), 'wrong PIN refused');
  await page.getByLabel('PIN for Ayesha').fill('2580');
  await page.getByRole('button', { name: 'Open' }).click();
  R.check(await page.getByRole('heading', { name: 'Salaam, Ayesha' }).isVisible(), 'right PIN opens Ayesha\'s shelf');
  R.check((await page.locator('.today-title').textContent()) === 'Fractions: Halves and Quarters', "today's lesson = first unmastered pack");
  R.check(/KB · 0\.00\d MB/.test(await page.locator('.today .meta').textContent()), 'pack size shown in KB and MB before opening', await page.locator('.today .meta').textContent());

  // reading: arrow keys
  await page.getByRole('link', { name: 'Start reading' }).click();
  const text = page.locator('#lesson-text');
  await text.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  let on = await page.locator('.s.on').getAttribute('data-i');
  R.check(on === '3', 'ArrowDown x3 moves highlight to sentence 4', { on });
  await page.keyboard.press('ArrowUp');
  on = await page.locator('.s.on').getAttribute('data-i');
  R.check(on === '2', 'ArrowUp moves back', { on });
  await page.waitForFunction(() => document.getElementById('live').textContent.startsWith('Sentence 3 of 10'));
  const liveTxt = await page.locator('#live').textContent();
  R.check(liveTxt.startsWith('Sentence 3 of 10'), 'screen reader live region announces sentence', liveTxt);
  const bg = await page.locator('.s.on').evaluate((e) => getComputedStyle(e).backgroundColor);
  R.check(bg === 'rgb(242, 210, 122)', 'highlighter band colour #F2D27A', bg);

  // read-aloud sync with the (fake) speech engine
  await page.getByRole('button', { name: 'Read aloud' }).click();
  const seen = new Set();
  for (let k = 0; k < 25; k++) { seen.add(await page.locator('.s.on').getAttribute('data-i')); await page.waitForTimeout(60); }
  const spoken = await page.evaluate(() => window.__spoken.length);
  R.check(seen.size >= 3 && spoken >= 3, 'highlight follows each spoken sentence', { highlighted: [...seen], spoken });
  await page.getByRole('button', { name: 'Pause' }).click();
  const after = await page.locator('.s.on').getAttribute('data-i');
  await page.waitForTimeout(500);
  R.check(after === (await page.locator('.s.on').getAttribute('data-i')), 'pause stops the highlight');

  // quiz: answers 1 right, 2 wrong, rest right -> 4/5
  await page.getByRole('link', { name: 'Start practice' }).click();
  const picks = ['One quarter', '3', '2/4', '4', 'No, the pieces are not equal'];
  for (let i = 0; i < 5; i++) {
    if (i === 0) { await page.getByRole('button', { name: 'Check answer' }).click(); R.check((await page.locator('#feedback').textContent()).includes('Choose an answer'), 'check with no answer asks to choose'); }
    await page.getByLabel(picks[i], { exact: true }).check();
    await page.getByRole('button', { name: 'Check answer' }).click();
    const fb = await page.locator('#feedback').textContent();
    if (i === 1) R.check(fb.includes('Not quite') && fb.includes('4'), 'wrong answer: feedback names the right one', fb);
    else R.check(fb.includes('Correct'), 'question ' + (i + 1) + ' correct feedback');
    await page.getByRole('button', { name: i === 4 ? 'See my score' : 'Next question' }).click();
  }
  R.check(await page.getByText('You got 4 of 5 right.').isVisible(), 'result: 4 of 5');
  const prog = await page.evaluate(() => { const s = window.EkApp.store; const a = s.listProfiles()[0]; return s.getPackProgress(a.id, 'g5-fractions'); });
  R.check(prog.best === 4 && prog.attempts === 1, 'score saved for Ayesha', prog);

  // second child sees own progress only
  await page.getByRole('link', { name: 'My lessons' }).click();
  await page.getByRole('button', { name: 'Switch learner' }).click();
  R.check(await page.locator('.tag', { hasText: 'Ayesha' }).locator('.tag-tick').count() === 1, 'Ayesha shows a done-today tick');
  await page.locator('.tag', { hasText: 'Bilal' }).click();
  R.check(await page.getByRole('heading', { name: 'Salaam, Bilal' }).isVisible(), 'Bilal opens without PIN');
  R.check((await page.locator('.today-title').textContent()) === 'Fractions: Halves and Quarters' && (await page.locator('.today .meta').textContent()).includes('Not started'), 'Bilal does not inherit Ayesha\'s score');

  // Urdu
  await page.getByRole('button', { name: 'اردو' }).click();
  const dir = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
  R.check(dir.join() === 'ur,rtl', 'Urdu switches lang=ur dir=rtl', dir);
  await page.waitForFunction(() => document.fonts.check('20px "Noto Nastaliq Urdu"', 'کسر'));
  R.check(true, 'Noto Nastaliq Urdu font loaded lazily after switching');
  R.check((await page.locator('.today-title').textContent()).includes('کسر'), 'lesson title in Urdu');
  await page.locator('a.btn', { hasText: 'پڑھنا شروع کریں' }).click();
  await page.locator('#lesson-text').focus();
  await page.keyboard.press('ArrowLeft');
  R.check((await page.locator('.s.on').getAttribute('data-i')) === '1', 'RTL: ArrowLeft moves forward');
  R.check(await page.locator('#lesson-text bdi[dir=ltr]').count() >= 2, 'maths like 1/2 isolated as LTR inside Urdu');
  await page.getByRole('button', { name: 'آواز سے پڑھیں' }).click();
  await page.waitForTimeout(300);
  R.check((await page.locator('.note').textContent()).includes('اردو'), 'no Urdu voice -> honest notice shown (test engine has English only)', await page.locator('.note').textContent());
  R.check(errors.length === 0, 'no console errors', errors);
  R.save();
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
