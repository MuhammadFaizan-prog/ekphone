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
