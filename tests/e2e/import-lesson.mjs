// Import a lesson from .txt / .md / .pdf / pasted text in "Write a lesson". Files are synthetic and made by this test.
import fs from 'node:fs';
import { launch, serve, newPhone, recorder, ROOT } from './common.mjs';
const R = recorder('e2e-import-lesson');
const { server, url } = await serve();
const b = await launch();
const DIR = '/tmp/ek-import/'; fs.mkdirSync(DIR, { recursive: true });
const LESSON = ['The Water Cycle', 'Water moves around the Earth in a cycle.', 'The Sun heats water in rivers and seas, and it turns into vapour.', 'The vapour rises, cools and forms clouds.', 'When the clouds are heavy, water falls as rain.', 'Rain flows into rivers and back to the sea.', 'This journey of water repeats again and again.'];
fs.writeFileSync(DIR + 'water-cycle.txt', LESSON.join('\n') + '\n');
fs.writeFileSync(DIR + 'plants.md', '# Parts of a Plant\n\nA **plant** has roots, a stem and leaves.\nThe roots hold the plant in the soil\nand take in water.\n\n## Leaves\n- Leaves use sunlight to make food for the plant.\n- The stem carries water from the roots to the leaves.\n- Flowers make seeds that grow into new plants.\n');
try {
  // synthetic PDFs: one with real text, one that is only a picture (like a scan)
  const maker = await (await b.newContext()).newPage();
  await maker.setContent('<html><body style="font:16px Georgia;margin:40px"><h1>Day and Night</h1><p>The Earth spins like a top on its axis. It takes one whole day for the Earth to spin once. When our side of the Earth faces the Sun, we have daytime. When our side turns away from the Sun, we have night. The Moon and the stars are easier to see at night. Shadows are long in the morning and in the evening.</p></body></html>');
  fs.writeFileSync(DIR + 'day-night.pdf', await maker.pdf({ format: 'A4' }));
  const png = await maker.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#eee'; g.fillRect(0, 0, 600, 300); g.fillStyle = '#333'; for (let i = 0; i < 12; i++) g.fillRect(30, 20 + i * 22, 300 + (i * 37) % 240, 10); return c.toDataURL(); });
  await maker.setContent('<html><body style="margin:0"><img src="' + png + '" style="width:100%"></body></html>');
  fs.writeFileSync(DIR + 'scanned.pdf', await maker.pdf({ format: 'A4' }));
  R.ok('made synthetic files', { txt: 'water-cycle.txt', md: 'plants.md', pdf: 'day-night.pdf (text)', scanned: 'scanned.pdf (picture only)' });

  const { ctx, page, errors } = await newPhone(b);
  page.on('dialog', (d) => d.accept());
  const pdfReqs = [];
  ctx.on('request', (r) => { if (/vendor\/pdf/.test(r.url())) pdfReqs.push(r.url().replace(url, '/')); });
  await page.goto(url + 'index.html');
  await page.evaluate(async () => { localStorage.clear(); await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForTimeout(300);
  await page.goto(url + 'index.html#/write'); await page.waitForSelector('#w-import-file');

  // .txt
  await page.setInputFiles('#w-import-file', DIR + 'water-cycle.txt');
  await page.waitForFunction(() => /Imported/.test(document.getElementById('w-import-msg').textContent));
  const t1 = await page.evaluate(() => ({ title: document.getElementById('w-title').value, text: document.getElementById('w-text').value, q: [0, 1, 2, 3, 4].map((i) => document.getElementById('w-q' + i).value), right: [0, 1, 2, 3, 4].map((i) => (document.querySelector('input[name=w-q' + i + '-right]:checked') || {}).value), opt0: [0, 1, 2].map((k) => document.getElementById('w-q0-o' + k).value), count: document.getElementById('w-count').textContent, focus: document.activeElement.id, msg: document.getElementById('w-import-msg').textContent }));
  R.check(t1.title === 'The Water Cycle', '.txt: title from the first line', t1.title);
  R.check(t1.count === '6 sentences found', '.txt: text split into sentences', t1.count);
  R.check(t1.q.every((q) => q.startsWith('Fill in the blank: ') && q.includes('_____')) && t1.right.every((v) => v != null), '.txt: 5 fill-in-the-blank questions suggested with a right answer', t1.q);
  R.check(t1.opt0.includes('Water') && t1.focus === 'w-import-msg', 'options include the blanked word; focus on the status message', { opt0: t1.opt0, msg: t1.msg });
  R.check(pdfReqs.length === 0, 'pdf.js not loaded for a text file', pdfReqs);
  // teacher edits a suggestion, then preview + save
  await page.locator('#w-q4').fill('Rain flows back to the _____.');
  await page.locator('#w-preview').click();
  await page.waitForSelector('#w-pv-h');
  R.check((await page.locator('.pv-q').nth(4).textContent()) === 'Rain flows back to the _____.', 'suggested questions are editable before saving');
  await page.locator('#w-save').click(); await page.waitForSelector('#w-done');
  R.check(await page.evaluate(() => window.EkApp.store.listMine().length === 1), 'imported lesson saved as a pack');

  // .md
  await page.getByRole('button', { name: 'Write another lesson' }).click();
  await page.setInputFiles('#w-import-file', DIR + 'plants.md');
  await page.waitForFunction(() => /Imported/.test(document.getElementById('w-import-msg').textContent));
  const t2 = await page.evaluate(() => ({ title: document.getElementById('w-title').value, text: document.getElementById('w-text').value }));
  R.check(t2.title === 'Parts of a Plant' && !/[#*]/.test(t2.text) && t2.text.includes('The roots hold the plant in the soil and take in water.'), '.md: Markdown removed, wrapped lines joined', t2);

  // .pdf with text
  await page.setInputFiles('#w-import-file', DIR + 'day-night.pdf');
  await page.waitForFunction(() => /Imported|Could not|No text/.test(document.getElementById('w-import-msg').textContent), null, { timeout: 20000 });
  const t3 = await page.evaluate(() => ({ title: document.getElementById('w-title').value, count: document.getElementById('w-count').textContent, q0: document.getElementById('w-q0').value, msg: document.getElementById('w-import-msg').textContent, lib: !!window.pdfjsLib }));
  R.check(t3.title === 'Day and Night' && /^[5-9] sentences/.test(t3.count) && t3.q0.startsWith('Fill in the blank'), '.pdf: text extracted by pdf.js, title + sentences + questions', t3);
  R.check(t3.lib && pdfReqs.some((u) => u.includes('pdf.min.js')) && pdfReqs.some((u) => u.includes('pdf.worker.min.js')), 'pdf.js loaded only when a PDF was picked', pdfReqs);

  // scanned PDF (no text layer)
  await page.setInputFiles('#w-import-file', DIR + 'scanned.pdf');
  await page.waitForFunction(() => /No text|Could not/.test(document.getElementById('w-import-msg').textContent), null, { timeout: 20000 });
  R.check((await page.locator('#w-import-msg').textContent()).startsWith('No text found in this file'), 'scanned/picture-only PDF: clear "no text found" message', await page.locator('#w-import-msg').textContent());
  R.check((await page.locator('#w-title').inputValue()) === 'Day and Night', 'a failed import leaves the draft unchanged');

  // pasted text
  await page.locator('#w-import-paste').fill('Fractions\nA fraction is a part of a whole. Ammi cuts one roti into two equal halves. Each half is written as 1/2. Four quarters make one whole roti. The parts must be equal in size.');
  await page.locator('#w-import-paste-btn').click();
  await page.waitForFunction(() => /Imported "Fractions"/.test(document.getElementById('w-import-msg').textContent));
  R.check((await page.locator('#w-count').textContent()) === '5 sentences found', 'pasted text: title + 5 sentences', await page.locator('#w-count').textContent());

  // Suggest button from typed text
  await page.locator('#w-text').fill('Plants need sunlight to grow. Leaves turn sunlight into food. Roots drink water from the soil. Seeds grow into new plants. Flowers help plants make seeds.');
  await page.locator('#w-suggest').click();
  await page.waitForFunction(() => /suggested from the lesson text/.test(document.getElementById('w-import-msg').textContent));
  R.check((await page.locator('#w-q0').inputValue()).startsWith('Fill in the blank'), 'Suggest 5 questions works on typed text');

  // offline: PDF import still works because pdf.js was cached on first use
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#w-import-file');
  await page.setInputFiles('#w-import-file', DIR + 'day-night.pdf');
  await page.waitForFunction(() => /Imported|Could not|No text/.test(document.getElementById('w-import-msg').textContent), null, { timeout: 20000 });
  R.check((await page.locator('#w-import-msg').textContent()).startsWith('Imported "Day and Night"'), 'offline: PDF import works (pdf.js cached by the service worker on first use)', await page.locator('#w-import-msg').textContent());
  R.check(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)).length === 0, 'no console errors', errors);
  R.save();
} catch (e) { console.error(e.message); R.save({ error: e.message }); process.exitCode = 1; }
finally { await b.close(); server.close(); }
