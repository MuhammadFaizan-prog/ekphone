// Unit tests: storage (profiles, PIN, progress, pack validation) and QR chunking (incl. real QR encode -> decode).
// Run: node --test tests/   (Node 20+)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const toolsRequire = createRequire(path.join(__dirname, '../tools/package.json'));
const Store = require('../app/js/storage.js');
const QR = require('../app/js/qrchunk.js');
const I18N = require('../app/js/i18n.js');
const qrcode = toolsRequire('qrcode-generator');
const jsQR = toolsRequire('jsqr');

function memLS() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }
const packs = ['g5-fractions', 'g5-water-cycle', 'g4-english-sentence'].map((id) => JSON.parse(fs.readFileSync(path.join(__dirname, '../app/packs/' + id + '.ekpack.json'), 'utf8')));
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/samples/g3-plant-parts.ekpack.json'), 'utf8'));

test('profiles: add, duplicate, limit, clean name', async () => {
  const s = Store.createStore(memLS());
  const a = await s.addProfile('  Ayesha  ', '');
  assert.equal(a.name, 'Ayesha');
  await assert.rejects(s.addProfile('ayesha'), /duplicate/);
  await assert.rejects(s.addProfile('   '), /name-required/);
  await assert.rejects(s.addProfile('Bilal', '12a4'), /bad-pin/);
  assert.equal((await s.addProfile('<b>Zara</b>')).name, 'bZara/b');
  for (let i = 0; i < 6; i++) await s.addProfile('Kid ' + i);
  assert.equal(s.listProfiles().length, 8);
  await assert.rejects(s.addProfile('Ninth'), /too-many/);
});

test('PIN: hashed (never stored plain), checked, lockout after 5 wrong tries', async () => {
  const ls = memLS();
  const s = Store.createStore(ls);
  const p = await s.addProfile('Zara', '1234');
  const raw = [...ls._m.values()].join('');
  assert.ok(!raw.includes('"1234"'), 'PIN must not be stored in plain text');
  assert.match(s.getProfile(p.id).pin, /^sha256:[0-9a-f]{64}$/);
  assert.equal((await s.checkPin(p.id, '1234')).ok, true);
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) assert.equal((await s.checkPin(p.id, '0000', t0)).ok, false);
  const fifth = await s.checkPin(p.id, '0000', t0);
  assert.equal(fifth.ok, false); assert.equal(fifth.waitMs, 30000);
  assert.equal((await s.checkPin(p.id, '1234', t0 + 1000)).ok, false, 'locked even with right PIN');
  assert.equal((await s.checkPin(p.id, '1234', t0 + 31000)).ok, true, 'unlocks after 30 s');
});

test('progress is kept per child and removed with the child', async () => {
  const s = Store.createStore(memLS());
  const a = await s.addProfile('Ayesha'); const b = await s.addProfile('Bilal');
  s.saveQuiz(a.id, 'g5-fractions', 3, 5); s.saveQuiz(a.id, 'g5-fractions', 5, 5); s.saveQuiz(a.id, 'g5-fractions', 2, 5);
  assert.deepEqual([s.getPackProgress(a.id, 'g5-fractions').best, s.getPackProgress(a.id, 'g5-fractions').last, s.getPackProgress(a.id, 'g5-fractions').attempts], [5, 2, 3]);
  assert.equal(s.getPackProgress(b.id, 'g5-fractions').best, null, 'Bilal does not see Ayesha\'s score');
  s.saveReading(b.id, 'g5-water-cycle', 9, true);
  assert.equal(s.getPackProgress(b.id, 'g5-water-cycle').read, true);
  s.removeProfile(a.id);
  assert.deepEqual(s.getProgress(a.id), {});
});

test("today's pack: first not mastered, then rotates by day", async () => {
  const s = Store.createStore(memLS());
  const a = await s.addProfile('Ayesha');
  assert.equal(s.todaysPack(a.id, packs).id, 'g5-fractions');
  s.saveQuiz(a.id, 'g5-fractions', 4, 5);
  assert.equal(s.todaysPack(a.id, packs).id, 'g5-water-cycle');
  s.saveQuiz(a.id, 'g5-water-cycle', 5, 5); s.saveQuiz(a.id, 'g4-english-sentence', 4, 5);
  const d1 = s.todaysPack(a.id, packs, new Date(2026, 10, 12)).id, d2 = s.todaysPack(a.id, packs, new Date(2026, 10, 13)).id;
  assert.notEqual(d1, d2);
});

test('all shipped packs are valid, bilingual and 5 questions', () => {
  for (const p of [...packs, sample]) {
    const v = Store.validatePack(p);
    assert.equal(v.ok, true, p.id + ': ' + v.errors.join(', '));
    assert.equal(p.quiz.length, 5);
    assert.equal(p.sentences.ur.length, p.sentences.en.length);
    p.quiz.forEach((q) => { assert.ok(q.q.ur && q.explain.ur); assert.equal(q.options.ur.length, q.options.en.length); });
    assert.ok(v.bytes < 8 * 1024, 'pack stays tiny: ' + v.bytes);
  }
});

test('pack validation rejects bad packs', () => {
  const bad = JSON.parse(JSON.stringify(packs[0]));
  bad.quiz[0].answer = 9; bad.id = 'BAD ID';
  const v = Store.validatePack(bad);
  assert.equal(v.ok, false); assert.equal(v.errors.length, 2);
  assert.equal(Store.validatePack(null).ok, false);
  const big = JSON.parse(JSON.stringify(packs[0])); big.notes = 'x'.repeat(210 * 1024);
  assert.match(Store.validatePack(big).errors.join(), /200 KB/);
  const s = Store.createStore(memLS());
  assert.throws(() => s.importPack(bad), /invalid-pack/);
  s.importPack(sample); s.importPack(sample);
  assert.equal(s.listImportedPacks().length, 1, 're-import replaces, no duplicates');
});

test('formatSize shows KB and MB', () => {
  assert.deepEqual(Store.formatSize(4200), { kb: '4.1', mb: '0.004' });
  assert.deepEqual(Store.formatSize(3 * 1024 * 1024), { kb: '3072', mb: '3.00' });
});

test('QR chunks: encode -> shuffle + duplicates -> assemble -> identical pack (compressed)', async () => {
  for (const p of [...packs, sample]) {
    const chunks = await QR.encode(p);
    assert.ok(chunks.length >= 2 && chunks.length <= 12, p.id + ' chunks ' + chunks.length);
    chunks.forEach((c) => assert.ok(c.length <= QR.DEFAULT_CHUNK + 30));
    assert.equal(QR.parse(chunks[0]).flag, 'z');
    const asm = QR.createAssembler();
    const order = [...chunks].reverse().concat(chunks.slice(0, 2));
    for (const c of order) assert.equal(asm.add(c).accepted, true);
    assert.equal(asm.complete(), true);
    assert.deepEqual(JSON.parse(await asm.finish()), p);
  }
});

test('QR chunks: raw mode, other-pack rejection, corrupt data detected', async () => {
  const raw = await QR.encode(packs[1], { compress: false, chunkSize: 200 });
  assert.equal(QR.parse(raw[0]).flag, 'r');
  const asm = QR.createAssembler();
  raw.forEach((c) => asm.add(c));
  assert.deepEqual(JSON.parse(await asm.finish()), packs[1]);
  const other = await QR.encode(packs[0]);
  const a2 = QR.createAssembler(); a2.add(raw[0]);
  assert.equal(a2.add(other[0]).reason, 'other-pack');
  assert.equal(QR.parse('hello'), null); assert.equal(QR.parse('EK1|z|zzzzzzzz|1/2|abc'), null); assert.equal(QR.parse('EK1|z|0000abcd|3/2|abc'), null);
  const chunks = await QR.encode(packs[2]);
  const parts = chunks[1].split('|'); parts[4] = parts[4].replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
  const a3 = QR.createAssembler(); a3.add(chunks[0]); a3.add(parts.join('|')); chunks.slice(2).forEach((c) => a3.add(c));
  await assert.rejects(a3.finish(), /checksum/);
  assert.deepEqual(QR.splitPasted('junk\n' + chunks.join('\n') + ' more'), chunks);
});

test('QR chunks survive a real QR encode (qrcode-generator) and decode (jsQR)', async () => {
  const chunks = await QR.encode(sample);
  const asm = QR.createAssembler();
  for (const c of chunks) {
    const qr = qrcode(0, 'M'); qr.addData(c, 'Byte'); qr.make();
    const n = qr.getModuleCount(), scale = 4, quiet = 4, w = (n + quiet * 2) * scale;
    const px = new Uint8ClampedArray(w * w * 4).fill(255);
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col))
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) { const i = (((r + quiet) * scale + y) * w + (col + quiet) * scale + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    const res = jsQR(px, w, w);
    assert.ok(res, 'jsQR decoded chunk');
    assert.equal(res.data, c);
    asm.add(res.data);
  }
  assert.deepEqual(JSON.parse(await asm.finish()), sample);
});

test('i18n: every English key has an Urdu string; placeholders match', () => {
  const en = I18N.strings.en, ur = I18N.strings.ur;
  for (const k of Object.keys(en)) {
    assert.ok(ur[k], 'missing ur.' + k);
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(ph(ur[k]), ph(en[k]), 'placeholders differ for ' + k);
  }
  assert.equal(I18N.t('ur', 'gotCodes', { r: 2, n: 5 }), '5 میں سے 2 کوڈ مل گئے');
});

const Author = require('../app/js/author.js');
const Exporter = require('../app/js/export.js');

test('lesson writer: sentence split, validation, pack build', () => {
  assert.deepEqual(Author.splitSentences('One. Two!  Three?\nFour has 1.5 cups\n\nکسر ایک حصہ ہے۔ دوسرا جملہ؟'),
    ['One.', 'Two!', 'Three?', 'Four has 1.5 cups', 'کسر ایک حصہ ہے۔', 'دوسرا جملہ؟']);
  const d = Author.emptyDraft();
  const e = Author.validateDraft(d);
  assert.equal(Object.keys(e).length, 2 + 5 * (1 + 3 + 1), 'empty draft: title, text, and 5 x (question, 3 answers, right answer)');
  d.titleEn = 'Day and Night'; d.titleUr = 'دن اور رات'; d.text = 'The Earth spins. It takes one day.';
  d.quiz.forEach((q, i) => { q.q = 'Q' + i + '?'; q.options = ['a', 'b', 'c']; q.answer = i % 3; });
  assert.deepEqual(Author.validateDraft(d), {});
  const p = Author.buildPack(d, 'ab12');
  assert.equal(p.id, 'my-day-and-night-ab12');
  assert.equal(p.title.ur, 'دن اور رات');
  assert.equal(p.sentences.en.length, 2);
  assert.equal(p.quiz[4].answer, 1);
  assert.equal(Store.validatePack(p).ok, true, 'a written lesson passes the same validator as a shared pack');
  d.text = Array.from({ length: 61 }, (_, i) => 'S' + i + '.').join(' ');
  assert.equal(Author.validateDraft(d)['w-text'], 'wErrTooMany');
});

test('demo mode: 4 synthetic learners, only Zara has PIN 1234, starting progress, reset keeps packs', async () => {
  const s = Store.createStore(memLS());
  await s.addProfile('Real kid');
  s.importPack(sample);
  await s.loadDemo();
  assert.deepEqual(s.listProfiles().map((p) => p.name), ['Ayesha', 'Bilal', 'Zara', 'Hamza']);
  assert.equal(s.isDemo(), true);
  const by = (n) => s.listProfiles().find((p) => p.name === n);
  assert.equal(s.hasPin(by('Zara').id), true);
  assert.equal((await s.checkPin(by('Zara').id, '1234')).ok, true);
  assert.equal(['Ayesha', 'Bilal', 'Hamza'].some((n) => s.hasPin(by(n).id)), false);
  assert.equal(s.getPackProgress(by('Ayesha').id, 'g5-fractions').best, 4);
  s.saveQuiz(by('Hamza').id, 'g5-fractions', 2, 5);
  await s.loadDemo();
  assert.equal(s.getPackProgress(by('Hamza').id, 'g5-fractions').best, null, 'reset restores starting progress');
  assert.equal(s.listImportedPacks().length, 1, 'received packs stay after reset');
});

test('save as page: plain HTML, no script, escaped text, both languages', () => {
  const html = Exporter.packToHtml(Object.assign({}, packs[0], { title: { en: 'A <b> & "c"', ur: packs[0].title.ur } }));
  assert.ok(!/<script/i.test(html));
  assert.ok(html.includes('A &lt;b&gt; &amp; &quot;c&quot;'));
  assert.ok(html.includes('lang="ur" dir="rtl"'));
  assert.equal((html.match(/<details>/g) || []).length, 2);
});

test('lesson import: title from first line, Markdown stripped, deterministic fill-in-the-blank questions', () => {
  const l = Author.lessonFromText('The Water Cycle\nWater moves around the Earth in a cycle.\nThe Sun heats water in rivers and seas.\nThe vapour rises, cools and forms clouds.\nWhen the clouds are heavy, water falls as rain.\nRain flows into rivers and back to the sea.', 'txt');
  assert.equal(l.title, 'The Water Cycle');
  const s = Author.splitSentences(l.body);
  const q1 = Author.suggestQuestions(s), q2 = Author.suggestQuestions(s);
  assert.deepEqual(q1, q2, 'same text -> same questions');
  assert.equal(q1.filter((q) => q.q).length, 5);
  q1.forEach((q) => { assert.match(q.q, /_____/); assert.equal(q.options.length, 3); assert.ok(q.answer >= 0 && q.answer < 3); assert.equal(new Set(q.options.map((o) => o.toLowerCase())).size, 3); });
  const md = Author.lessonFromText('# Plants\n\nA **plant** has [roots](x).\n## More\n- Leaves make food.', 'md');
  assert.deepEqual(md, { title: 'Plants', body: 'A plant has roots.\nLeaves make food.' });
  assert.equal(Author.lessonFromText('Title\nThe Earth spins like a\ntop on its axis.', 'pdf').body, 'The Earth spins like a top on its axis.');
  assert.deepEqual(Author.lessonFromText('  \n ', 'txt'), { title: '', body: '' });
});

test('QR link chunks: any order, size limit, old text form still accepted', async () => {
  const p = packs[0];
  const links = await QR.encode(p, { base: 'https://ekphone-app.vercel.app/' });
  assert.ok(links.every((l) => l.startsWith('https://ekphone-app.vercel.app/#/r/g5-fractions/') && l.length <= QR.MAX_QR_CHARS));
  const a = QR.createAssembler();
  links.slice().reverse().forEach((l) => a.add(l));
  assert.equal(await a.finish(), JSON.stringify(p));
  const saved = a.toState(); const b = QR.createAssembler(saved); assert.equal(b.complete(), true, 'state survives save/restore');
  const old = await QR.encode(p); const c = QR.createAssembler(); old.forEach((x) => c.add(x));
  assert.equal(await c.finish(), JSON.stringify(p));
  assert.equal(QR.splitPasted(links.join('\n') + '\n' + old.join(' ')).length, links.length + old.length);
  assert.equal(QR.labelFromId('my-day-and-night-ab12'), 'Day and night');
});
