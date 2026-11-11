/* Ek Phone — on-device storage (profiles, PINs, per-child progress, imported packs).
   Everything lives in localStorage on this one phone. No server, no account. */
(function (root) {
  'use strict';
  var NS = 'ekphone:v1:';
  var MAX_PROFILES = 8;
  var MAX_PACK_BYTES = 200 * 1024;
  /** Synthetic demo learners (made up, no real children). Zara has PIN 1234, shown on screen. */
  var DEMO = [{ name: 'Ayesha', pin: '' }, { name: 'Bilal', pin: '' }, { name: 'Zara', pin: '1234' }, { name: 'Hamza', pin: '' }];
  var COLORS = ['rust', 'blue', 'sage', 'ochre', 'plum', 'teal', 'clay', 'olive'];

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length;
    return unescape(encodeURIComponent(str)).length;
  }

  // FNV-1a 32-bit, hex. Used for pack checksums and as a PIN hash fallback.
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function randomId(len) {
    var a = '';
    var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    var buf;
    if (root.crypto && root.crypto.getRandomValues) { buf = new Uint8Array(len); root.crypto.getRandomValues(buf); }
    for (var i = 0; i < len; i++) a += chars[(buf ? buf[i] : Math.floor(Math.random() * 256)) % chars.length];
    return a;
  }

  async function hashPin(pin, salt) {
    var input = salt + ':' + pin;
    var subtle = root.crypto && root.crypto.subtle;
    if (subtle && typeof TextEncoder !== 'undefined') {
      var d = await subtle.digest('SHA-256', new TextEncoder().encode(input));
      return 'sha256:' + Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    return 'fnv:' + fnv1a(input) + fnv1a(input.split('').reverse().join(''));
  }

  function validPin(pin) { return /^[0-9]{4}$/.test(String(pin)); }

  function cleanName(name) {
    return String(name == null ? '' : name).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  }

  /** Validate a lesson pack object. Returns { ok, errors[] }. Pack text is only ever rendered with textContent. */
  function validatePack(p) {
    var e = [];
    function isLang(o) { return o && typeof o === 'object' && typeof o.en === 'string' && o.en.length > 0; }
    if (!p || typeof p !== 'object') return { ok: false, errors: ['not an object'] };
    if (p.format !== 'ekphone-pack/1') e.push('format must be ekphone-pack/1');
    if (typeof p.id !== 'string' || !/^[a-z0-9-]{3,40}$/.test(p.id)) e.push('id must be 3-40 chars a-z 0-9 -');
    if (!isLang(p.title)) e.push('title.en required');
    if (!p.sentences || !Array.isArray(p.sentences.en) || p.sentences.en.length < 1 || p.sentences.en.length > 60) e.push('sentences.en must have 1-60 sentences');
    else if (p.sentences.en.some(function (s) { return typeof s !== 'string' || s.length > 400; })) e.push('each sentence must be text under 400 chars');
    if (p.sentences && p.sentences.ur != null && (!Array.isArray(p.sentences.ur) || p.sentences.ur.length !== p.sentences.en.length)) e.push('sentences.ur must match sentences.en length');
    if (!Array.isArray(p.quiz) || p.quiz.length < 1 || p.quiz.length > 10) e.push('quiz must have 1-10 questions');
    else p.quiz.forEach(function (q, i) {
      if (!isLang(q.q)) e.push('quiz[' + i + '].q.en required');
      var opts = q.options && q.options.en;
      if (!Array.isArray(opts) || opts.length < 2 || opts.length > 5) e.push('quiz[' + i + '] needs 2-5 options');
      else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < opts.length)) e.push('quiz[' + i + '].answer out of range');
      if (q.options && q.options.ur != null && (!Array.isArray(q.options.ur) || q.options.ur.length !== (opts || []).length)) e.push('quiz[' + i + '].options.ur length mismatch');
    });
    var bytes = 0;
    try { bytes = utf8Bytes(JSON.stringify(p)); } catch (err) { e.push('not serialisable'); }
    if (bytes > MAX_PACK_BYTES) e.push('pack larger than 200 KB');
    return { ok: e.length === 0, errors: e, bytes: bytes };
  }

  function packBytes(p) { return utf8Bytes(JSON.stringify(p)); }

  function formatSize(bytes) {
    var kb = bytes / 1024;
    var mb = bytes / (1024 * 1024);
    return { kb: kb < 10 ? kb.toFixed(1) : String(Math.round(kb)), mb: mb < 0.01 ? mb.toFixed(3) : mb.toFixed(2) };
  }

  function createStore(ls) {
    function read(key, fallback) {
      try { var v = ls.getItem(NS + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    }
    function write(key, val) { ls.setItem(NS + key, JSON.stringify(val)); }
    function del(key) { ls.removeItem(NS + key); }

    var api = {
      getSettings: function () { return Object.assign({ lang: 'en', rate: 0.9, textSize: 1 }, read('settings', {})); },
      setSettings: function (patch) { var s = Object.assign(api.getSettings(), patch); write('settings', s); return s; },

      listProfiles: function () { return read('profiles', []); },
      getProfile: function (id) { return api.listProfiles().filter(function (p) { return p.id === id; })[0] || null; },
      addProfile: async function (name, pin) {
        var n = cleanName(name);
        if (!n) throw new Error('name-required');
        var list = api.listProfiles();
        if (list.length >= MAX_PROFILES) throw new Error('too-many');
        if (list.some(function (p) { return p.name.toLowerCase() === n.toLowerCase(); })) throw new Error('duplicate');
        var prof = { id: randomId(8), name: n, color: COLORS[list.length % COLORS.length], created: Date.now(), pin: null, salt: null };
        if (pin != null && pin !== '') {
          if (!validPin(pin)) throw new Error('bad-pin');
          prof.salt = randomId(12);
          prof.pin = await hashPin(String(pin), prof.salt);
        }
        list.push(prof); write('profiles', list);
        return prof;
      },
      removeProfile: function (id) {
        write('profiles', api.listProfiles().filter(function (p) { return p.id !== id; }));
        del('progress:' + id); del('lock:' + id);
      },
      hasPin: function (id) { var p = api.getProfile(id); return !!(p && p.pin); },
      /** Returns { ok, waitMs }. After 5 wrong tries the profile waits 30 s. */
      checkPin: async function (id, pin, now) {
        now = now || Date.now();
        var p = api.getProfile(id);
        if (!p) return { ok: false, waitMs: 0 };
        if (!p.pin) return { ok: true, waitMs: 0 };
        var lock = read('lock:' + id, { fails: 0, until: 0 });
        if (lock.until > now) return { ok: false, waitMs: lock.until - now };
        var ok = validPin(pin) && (await hashPin(String(pin), p.salt)) === p.pin;
        if (ok) { del('lock:' + id); return { ok: true, waitMs: 0 }; }
        lock.fails += 1;
        if (lock.fails >= 5) { lock.until = now + 30000; lock.fails = 0; }
        write('lock:' + id, lock);
        return { ok: false, waitMs: lock.until > now ? lock.until - now : 0 };
      },

      getProgress: function (id) { return read('progress:' + id, {}); },
      getPackProgress: function (id, packId) { return api.getProgress(id)[packId] || { read: false, sentence: 0, best: null, last: null, attempts: 0 }; },
      saveReading: function (id, packId, sentence, finished) {
        var all = api.getProgress(id);
        var cur = all[packId] || { read: false, sentence: 0, best: null, last: null, attempts: 0 };
        cur.sentence = sentence; if (finished) cur.read = true; cur.updated = Date.now();
        all[packId] = cur; write('progress:' + id, all); return cur;
      },
      saveQuiz: function (id, packId, score, total) {
        var all = api.getProgress(id);
        var cur = all[packId] || { read: false, sentence: 0, best: null, last: null, attempts: 0 };
        cur.last = score; cur.total = total; cur.attempts = (cur.attempts || 0) + 1;
        cur.best = cur.best == null ? score : Math.max(cur.best, score);
        cur.updated = Date.now(); cur.doneDay = new Date().toDateString();
        all[packId] = cur; write('progress:' + id, all); return cur;
      },

      /** Replace all learners with the 4 demo learners and their starting progress. Packs stay. */
      loadDemo: async function () {
        api.listProfiles().forEach(function (p) { api.removeProfile(p.id); });
        for (var i = 0; i < DEMO.length; i++) await api.addProfile(DEMO[i].name, DEMO[i].pin);
        var list = api.listProfiles().map(function (p) { p.demo = true; return p; });
        write('profiles', list);
        var id = function (n) { return list.filter(function (p) { return p.name === n; })[0].id; };
        api.saveReading(id('Ayesha'), 'g5-fractions', 9, true); api.saveQuiz(id('Ayesha'), 'g5-fractions', 4, 5);
        api.saveReading(id('Bilal'), 'g5-water-cycle', 3, false);
        api.saveReading(id('Zara'), 'g5-fractions', 9, true); api.saveQuiz(id('Zara'), 'g5-fractions', 5, 5);
        api.saveReading(id('Zara'), 'g4-english-sentence', 2, false);
        return list;
      },
      isDemo: function () { var l = api.listProfiles(); return l.length > 0 && l.every(function (p) { return p.demo; }); },
      listMine: function () { return read('mine', []); },
      saveMine: function (pack) { api.importPack(pack); var m = api.listMine().filter(function (x) { return x !== pack.id; }); m.push(pack.id); write('mine', m); return pack; },
      listImportedPacks: function () { return read('packs', []); },
      importPack: function (pack) {
        var v = validatePack(pack);
        if (!v.ok) throw new Error('invalid-pack: ' + v.errors.join('; '));
        var list = api.listImportedPacks().filter(function (p) { return p.id !== pack.id; });
        list.push(pack); write('packs', list); return pack;
      },
      removeImportedPack: function (packId) { write('packs', api.listImportedPacks().filter(function (p) { return p.id !== packId; })); },

      /** The next pack this child should do: first one without a quiz score of 4+, else rotate by day. */
      todaysPack: function (id, packs, today) {
        if (!packs.length) return null;
        var prog = api.getProgress(id);
        for (var i = 0; i < packs.length; i++) { var pr = prog[packs[i].id]; if (!pr || pr.best == null || pr.best < Math.min(4, packs[i].quiz.length)) return packs[i]; }
        var d = today || new Date();
        var dayNum = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
        return packs[dayNum % packs.length];
      }
    };
    return api;
  }

  var EkStore = { createStore: createStore, validatePack: validatePack, packBytes: packBytes, formatSize: formatSize, utf8Bytes: utf8Bytes, fnv1a: fnv1a, validPin: validPin, cleanName: cleanName, MAX_PROFILES: MAX_PROFILES, DEMO: DEMO };
  if (typeof module !== 'undefined' && module.exports) module.exports = EkStore; else root.EkStore = EkStore;
})(typeof self !== 'undefined' ? self : globalThis);
