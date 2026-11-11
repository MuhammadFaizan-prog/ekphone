// Demo mode (one tap, no typing) + teacher lesson writing (validation, preview, save, share) + print / Save as page.
import fs from 'node:fs';
import { launch, serve, newPhone, recorder, ROOT } from './common.mjs';
const R = recorder('e2e-demo-author');
const { server, url } = await serve();
const b = await launch();
try {
  const { page, errors } = await newPhone(b);
  page.on('dialog', (d) => d.accept());
  await page.goto(url + 'index.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  const tryBtn = page.getByRole('button', { name: 'Try the demo' });
  R.check(await tryBtn.isVisible(), 'empty phone: "Try the demo" on the first screen');
  // keyboard only: Tab to the demo button and press Enter
  let reached = false;
  for (let i = 0; i < 8 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'try-demo'); }
  R.check(reached, 'demo button reachable with Tab');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.tag');
  const names = await page.locator('.tag .tag-name').allTextContents();
  R.check(names.join() === 'Ayesha,Bilal,Zara,Hamza', 'one keypress loads 4 synthetic learners', names);
  const note = await page.locator('#demo-note').textContent();
  R.check(note.includes('1234') && note.includes('made up'), 'demo PIN 1234 shown on screen', note);
  R.check(await page.locator('.tag', { hasText: 'Zara' }).locator('.tag-lock').count() === 1 && await page.locator('.tag', { hasText: 'Ayesha' }).locator('.tag-lock').count() === 0, 'only Zara has a PIN');
  R.check(await page.evaluate(() => document.activeElement.classList.contains('tag')), 'focus moves to the first name tag');
  await page.locator('.tag', { hasText: 'Ayesha' }).click();
  R.check(await page.getByRole('heading', { name: 'Salaam, Ayesha' }).isVisible(), 'Ayesha opens with one tap (no PIN)');
  const shelf = await page.locator('.spine .meta').allTextContents();
  R.check(shelf.some((m) => m.includes('Best: 4 of 5')), 'demo progress present for Ayesha', shelf);
  await page.getByRole('button', { name: 'Switch learner' }).click();
  await page.locator('.tag', { hasText: 'Zara' }).click();
  await page.getByLabel('PIN for Zara').fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  R.check(await page.getByRole('heading', { name: 'Salaam, Zara' }).isVisible(), 'Zara opens with the shown PIN 1234');
  // Urdu strings for the demo
  await page.getByRole('button', { name: 'Switch learner' }).click();
  await page.getByRole('button', { name: 'اردو' }).click();
  R.check((await page.locator('#demo-note').textContent()).includes('1234') && (await page.locator('#demo-note').textContent()).includes('فرضی'), 'demo note in Urdu');
  await page.getByRole('button', { name: 'English' }).click();

  // Reset demo in the teacher area
  await page.evaluate(() => { const s = window.EkApp.store; const id = s.listProfiles()[3].id; s.saveQuiz(id, 'g5-fractions', 1, 5); });
  await page.getByRole('button', { name: 'Teacher or older sibling' }).click();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.waitForFunction(() => document.getElementById('demo-msg').textContent.length > 0);
  const hamza = await page.evaluate(() => { const s = window.EkApp.store; const p = s.listProfiles().find((x) => x.name === 'Hamza'); return s.getPackProgress(p.id, 'g5-fractions').best; });
  R.check(hamza === null, 'Reset demo restores starting progress', { hamzaBest: hamza });

  // Write a lesson: validation first
  await page.getByRole('link', { name: 'Write a lesson' }).click();
  await page.waitForSelector('#w-title');
  R.check(await page.evaluate(() => !!window.EkAuthor), 'lesson writer loaded lazily (js/author.js)');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.waitForSelector('#w-summary:not([hidden])');
  const summary = await page.locator('#w-summary').textContent();
  const invalid = await page.locator('[aria-invalid="true"]').count();
  R.check(/Please fix \d+ things/.test(summary) && invalid === 27, 'empty form: error summary + aria-invalid fields', { summary, invalid });
  R.check(await page.locator('#w-title').getAttribute('aria-describedby') === 'w-title-err' && (await page.locator('#w-title-err').textContent()) === 'Write a title.', 'title error text linked by aria-describedby');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'w-title').catch(() => {});
  R.check(await page.evaluate(() => document.activeElement.id) === 'w-title', 'focus moves to the first invalid field');
  // fill
  await page.getByLabel('Lesson title', { exact: true }).fill('Day and Night');
  await page.getByLabel('Title in Urdu (optional)').fill('دن اور رات');
  await page.getByLabel('Subject (optional)').fill('Science');
  await page.getByLabel('Lesson text').fill('The Earth spins like a top. It takes one day to spin once.\nWhen our side faces the Sun, it is day! When it faces away, it is night. Is the Sun moving? No, the Earth is.');
  R.check((await page.locator('#w-count').textContent()) === '6 sentences found', 'lesson text split into sentences live', await page.locator('#w-count').textContent());
  const Q = [['What spins?', ['The Earth', 'The Sun', 'The Moon'], 0], ['How long is one spin?', ['One hour', 'One day', 'One year'], 1], ['When is it day?', ['Our side faces the Sun', 'Our side faces away', 'Never'], 0], ['When is it night?', ['We face the Sun', 'We face away from the Sun', 'At noon'], 1], ['What is moving?', ['The Sun', 'The stars', 'The Earth'], 2]];
  for (let i = 0; i < 5; i++) {
    await page.locator('#w-q' + i).fill(Q[i][0]);
    for (let k = 0; k < 3; k++) await page.locator('#w-q' + i + '-o' + k).fill(Q[i][1][k]);
    await page.locator('#w-q' + i + '-r' + Q[i][2]).check();
  }
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.waitForSelector('#w-pv-h');
  R.check(await page.locator('.pv-sents li').count() === 6 && await page.locator('.pv-right').count() === 5, 'preview: 6 sentences, right answers marked');
  R.check(/KB/.test(await page.locator('.w-preview .meta').textContent()), 'preview shows pack size', await page.locator('.w-preview .meta').textContent());
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await page.waitForSelector('#w-done');
  const mine = await page.evaluate(() => { const s = window.EkApp.store; const id = s.listMine()[0]; return { id, pack: s.listImportedPacks().find((p) => p.id === id) }; });
  R.check(/^my-day-and-night-[a-z0-9]{4}$/.test(mine.id), 'saved as local pack with an id', mine.id);
  const valid = await page.evaluate((p) => window.EkStore.validatePack(p).ok, mine.pack);
  R.check(valid && mine.pack.quiz.length === 5 && mine.pack.title.ur === 'دن اور رات', 'saved pack passes the same validator as shared packs');
  // share it by QR like any pack
  await page.getByRole('link', { name: 'Show QR codes' }).click();
  await page.waitForSelector('#qr-canvas[data-chunk]');
  const chunks = +(await page.evaluate(() => document.body.dataset.chunks));
  R.check(chunks >= 1, 'written lesson shares by QR', { chunks });
  await page.goto(url + 'index.html#/teacher');
  R.check(await page.locator('.packrow', { hasText: 'Day and Night' }).locator('.spine-subj', { hasText: 'Written here' }).count() === 1, 'teacher list labels it "Written here"');
  // a learner can read + take its quiz
  await page.evaluate(() => { const s = window.EkApp.store; sessionStorage.setItem('ekphone:who', s.listProfiles()[1].id); });
  await page.goto(url + 'index.html#/read/' + mine.id);
  R.check((await page.locator('.s').count()) === 6, 'learner reads the written lesson');

  // Print this lesson: print stylesheet hides the app chrome and shows the quiz
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({ toolbar: getComputedStyle(document.querySelector('.toolbar')).display, quiz: getComputedStyle(document.querySelector('.print-only')).display, qs: document.querySelectorAll('.print-only .pq-list > li').length }));
  R.check(pr.toolbar === 'none' && pr.quiz === 'block' && pr.qs === 5, 'print: toolbar hidden, 5 quiz questions printed', pr);
  const pdf = await page.pdf({ format: 'A4' });
  fs.mkdirSync(ROOT + 'docs', { recursive: true });
  fs.writeFileSync(ROOT + 'docs/print-sample.pdf', pdf);
  await page.emulateMedia({ media: 'screen' });
  R.ok('print preview saved', { file: 'docs/print-sample.pdf', bytes: pdf.length });

  // Save as page: plain HTML, works with JS off
  await page.locator('[aria-controls=lesson-menu]').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save as page/ }).click()]);
  const file = '/tmp/ek-saved-page.html'; await dl.saveAs(file);
  const html = fs.readFileSync(file, 'utf8');
  R.check(!/<script/i.test(html) && html.includes('Day and Night'), 'Save as page: one HTML file, no scripts', { bytes: Buffer.byteLength(html) });
  const ctx2 = await b.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 740 } });
  const p2 = await ctx2.newPage();
  await p2.goto('file://' + file);
  R.check(await p2.locator('ol.s li').count() === 6 && await p2.locator('details').count() === 1, 'saved page opens with JavaScript OFF: text + quiz + answers');
  await p2.goto(url + 'index.html');
  R.check((await p2.locator('noscript, .nojs').count()) >= 1 && await p2.getByRole('heading', { name: 'Who is studying?' }).isVisible(), 'app with JS off: heading + noscript lesson links');
  await p2.goto(url + 'lessons/g5-fractions.html');
  R.check(await p2.locator('ol.s li').count() === 10 && await p2.locator('section[lang=ur]').count() === 1, 'static lesson page (EN + UR) works with JS off');
  await ctx2.close();
  R.check(errors.length === 0, 'no console errors', errors);
  R.save();
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
