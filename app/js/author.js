/* Ek Phone — "Write a lesson" (teacher). Lazy-loaded only when this screen opens.
   Builds a normal ekphone-pack/1 lesson pack on the phone, so it can be read, quizzed and shared like any other. */
(function (root) {
  'use strict';
  var NQ = 5, NOPT = 3, LETTERS = ['A', 'B', 'C'];

  /** Split lesson text into sentences at . ? ! ۔ ؟ (followed by a space or the end) and at line breaks. */
  function splitSentences(text) {
    var out = [];
    String(text || '').split(/\n+/).forEach(function (line) {
      line.replace(/\s+/g, ' ').trim().replace(/([.!?\u06D4\u061F]+["'\u201D\u2019)\]]*)\s+/g, '$1\n').split('\n').forEach(function (s) {
        s = s.trim(); if (s) out.push(s);
      });
    });
    return out;
  }

  /* ---------- import: .txt / .md / .pdf / pasted text ---------- */
  var STOP = ('about above after again also among because been before being below between both came come could does down during each even every from have having here into itself just like made make many more most much must near never only other over same should since some such than that their them then there these they thing this those through under until very want were what when where which while with would your yours they\'re it\'s also whole part parts often always').split(' ');
  var END = /[.!?\u06D4\u061F]["'\u201D\u2019)\]]*$/;

  /** Strip Markdown to plain lines: headings, list markers, emphasis, links, code. */
  function stripMarkdown(text) {
    return String(text).split(/\r?\n/).map(function (l, i) {
      var h = /^\s*#{1,6}\s+/.test(l);
      l = l.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`{1,3}([^`]*)`{1,3}/g, '$1').replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2').replace(/^\s*>\s?/, '');
      return (h && i > 0) ? '' : l; // keep only the first heading (it becomes the title)
    }).join('\n');
  }

  /** Text -> { title, body }. Title = first non-empty line. kind 'pdf' joins wrapped lines; txt/md join a line onto the previous one when it clearly continues it. */
  function lessonFromText(text, kind) {
    if (kind === 'md') text = stripMarkdown(text);
    var lines = String(text || '').replace(/\u00AD/g, '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    if (!lines.length) return { title: '', body: '' };
    var title = lines.shift().replace(/[.:;,\s]+$/, '');
    if (title.length > 80) { var cut = title.slice(0, 80); var sp = cut.lastIndexOf(' '); title = (sp > 30 ? cut.slice(0, sp) : cut).trim(); }
    var body;
    if (kind === 'pdf') body = lines.join(' ').replace(/(\w)- (\w)/g, '$1$2');
    else {
      var out = [];
      lines.forEach(function (l) {
        if (out.length && !END.test(out[out.length - 1]) && /^[a-z0-9(]/.test(l)) out[out.length - 1] += ' ' + l; else out.push(l);
      });
      body = out.join('\n');
    }
    return { title: title, body: body };
  }

  function words(s) { return String(s).match(/[\p{L}\p{M}][\p{L}\p{M}'\u2019-]*[\p{L}\p{M}]/gu) || []; }
  function isKey(w) { var l = w.toLowerCase(); return l.length >= 4 && STOP.indexOf(l) < 0 && !/^[A-Z]{2,}$/.test(w); }
  function latin(s) { return /[A-Za-z]/.test(s) && !/[\u0600-\u06FF]/.test(s); }

  /** Deterministic fill-in-the-blank questions from key sentences (no AI, no network).
      Keyword = the longest content word, preferring words the lesson repeats. Distractors = other key words of the lesson. */
  function suggestQuestions(sentences, n) {
    n = n || NQ;
    var freq = {};
    sentences.forEach(function (s) { words(s).filter(isKey).forEach(function (w) { var l = w.toLowerCase(); freq[l] = (freq[l] || 0) + 1; }); });
    var cands = [];
    sentences.forEach(function (s, i) {
      var ws = words(s);
      if (ws.length < 5 || s.length > 220) return;
      var seen = {}, keys = [];
      ws.forEach(function (w, pos) { var l = w.toLowerCase(); if (isKey(w) && !seen[l]) { seen[l] = true; keys.push({ w: w, sc: Math.min(w.length, 12) + (freq[l] > 1 ? 4 : 0), pos: pos }); } });
      keys.sort(function (a, b) { return b.sc - a.sc || a.pos - b.pos; });
      if (keys.length) cands.push({ i: i, s: s, keys: keys, score: keys[0].sc + (ws.length >= 6 && ws.length <= 25 ? 2 : 0) });
    });
    var picked = [], used = {};
    cands.slice().sort(function (a, b) { return b.score - a.score || a.i - b.i; }).forEach(function (c) {
      if (picked.length >= n) return;
      var k = c.keys.filter(function (x) { return !used[x.w.toLowerCase()]; })[0];
      if (k) { picked.push({ i: c.i, s: c.s, kw: k.w }); used[k.w.toLowerCase()] = true; }
    });
    picked.sort(function (a, b) { return a.i - b.i; });
    var pool = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a] || b.length - a.length || (a < b ? -1 : 1); });
    var quiz = picked.map(function (c, k) {
      var kwl = c.kw.toLowerCase(), inS = c.s.toLowerCase();
      var others = picked.map(function (x) { return x.kw.toLowerCase(); }).concat(pool).filter(function (w, j, arr) { return arr.indexOf(w) === j && w !== kwl && inS.indexOf(w) < 0; });
      var d = others.slice(0, NOPT - 1).map(function (w) { return /^[A-Z]/.test(c.kw) ? w.charAt(0).toUpperCase() + w.slice(1) : w; });
      while (d.length < NOPT - 1) d.push(d.length ? 'none of these' : 'all of these');
      var pos = k % NOPT, opts = d.slice(); opts.splice(pos, 0, c.kw);
      var blank = c.s.replace(c.kw, '_____');
      return { q: (latin(c.s) ? 'Fill in the blank: ' : 'خالی جگہ پُر کریں: ') + blank, options: opts, answer: pos };
    });
    while (quiz.length < n) quiz.push({ q: '', options: ['', '', ''], answer: null });
    return quiz;
  }

  /** PDF -> text with pdf.js (loaded only when a PDF is picked). Returns '' when the PDF has no text layer (scanned pages). */
  async function pdfText(bytes, loadScript) {
    if (!root.pdfjsLib) await loadScript('vendor/pdf.min.js');
    var lib = root.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var doc = await lib.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    var out = [];
    for (var pg = 1; pg <= Math.min(doc.numPages, 30); pg++) {
      var page = await doc.getPage(pg);
      var tc = await page.getTextContent();
      var line = '';
      tc.items.forEach(function (it) { line += it.str; if (it.hasEOL) { out.push(line); line = ''; } else if (it.str && !/\s$/.test(it.str)) line += ' '; });
      if (line.trim()) out.push(line);
    }
    try { doc.destroy(); } catch (e) { /* ignore */ }
    return out.join('\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  function emptyDraft() {
    var qs = [];
    for (var i = 0; i < NQ; i++) qs.push({ q: '', options: ['', '', ''], answer: null });
    return { titleEn: '', titleUr: '', subject: '', text: '', quiz: qs };
  }

  /** Returns a map of field id -> i18n error key. Empty map = valid. */
  function validateDraft(d) {
    var e = {};
    if (!d.titleEn.trim()) e['w-title'] = 'wErrTitle';
    var s = splitSentences(d.text);
    if (s.length < 2) e['w-text'] = 'wErrText';
    else if (s.length > 60 || s.some(function (x) { return x.length > 400; })) e['w-text'] = 'wErrTooMany';
    d.quiz.forEach(function (q, i) {
      if (!q.q.trim()) e['w-q' + i] = 'wErrQ';
      q.options.forEach(function (o, k) { if (!o.trim()) e['w-q' + i + '-o' + k] = 'wErrOpt'; });
      if (q.answer == null) e['w-q' + i + '-right'] = 'wErrRight';
    });
    return e;
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, ''); }
  function rand4() {
    var c = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(4), o = '';
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(b); else for (var i = 0; i < 4; i++) b[i] = Math.floor(Math.random() * 256);
    for (var k = 0; k < 4; k++) o += c[b[k] % c.length];
    return o;
  }

  /** Draft -> ekphone-pack/1 object. */
  function buildPack(d, suffix) {
    var title = { en: d.titleEn.trim().slice(0, 80) };
    if (d.titleUr.trim()) title.ur = d.titleUr.trim().slice(0, 80);
    var subj = d.subject.trim().slice(0, 30);
    return {
      format: 'ekphone-pack/1',
      id: 'my-' + (slug(d.titleEn) || 'lesson') + '-' + (suffix || rand4()),
      version: 1,
      art: 'book',
      subject: subj ? { en: subj } : { en: 'My lesson', ur: 'میرا سبق' },
      title: title,
      license: 'Written on this phone with Ek Phone.',
      sentences: { en: splitSentences(d.text) },
      quiz: d.quiz.map(function (q) {
        return { q: { en: q.q.trim().slice(0, 200) }, options: { en: q.options.map(function (o) { return o.trim().slice(0, 80); }) }, answer: q.answer };
      })
    };
  }

  var draft = null, mode = 'edit', errors = {}, saved = null, importMsg = null;

  function screen(u) {
    var h = u.h, t = u.t, btn = u.btn;
    if (!draft) draft = emptyDraft();

    function field(id, labelKey, value, opts) {
      opts = opts || {};
      var err = errors[id];
      var hintId = opts.hint ? id + '-hint' : null;
      var errId = id + '-err';
      var input = h(opts.area ? 'textarea' : 'input', {
        id: id, class: 'field' + (opts.area ? ' field-text' : ''), type: opts.area ? null : 'text', rows: opts.area ? '7' : null,
        maxlength: opts.max ? String(opts.max) : null, autocomplete: 'off', lang: opts.lang || null, dir: opts.dir || 'auto',
        'aria-describedby': [hintId, err ? errId : null].filter(Boolean).join(' ') || null,
        'aria-invalid': err ? 'true' : null, 'aria-required': opts.required ? 'true' : null,
        oninput: function () { opts.set(input.value); if (opts.onchange) opts.onchange(); }
      });
      input.value = value;
      return [
        h('label', { for: id, class: 'label' }, opts.label || t(labelKey)), input,
        opts.hint ? h('p', { class: 'hint', id: hintId }, opts.hint) : null,
        opts.after || null,
        h('p', { class: 'error', id: errId }, err ? t(err) : '')
      ];
    }

    function editView() {
      var nErr = Object.keys(errors).length;
      var summary = h('div', { class: 'error-summary', id: 'w-summary', role: 'alert', tabindex: '-1', hidden: !nErr }, nErr ? t('wErrSummary', { n: nErr }) : '');
      var count = h('p', { class: 'hint', id: 'w-count', 'aria-live': 'polite' }, t('wSentCount', { n: splitSentences(draft.text).length }));
      var qBlocks = draft.quiz.map(function (q, i) {
        var rightErr = errors['w-q' + i + '-right'];
        var optFields = q.options.map(function (o, k) {
          return field('w-q' + i + '-o' + k, null, o, { label: t('wOpt', { l: LETTERS[k] }), max: 80, set: function (v) { q.options[k] = v; } });
        });
        var radios = h('fieldset', { class: 'w-right', role: 'radiogroup', 'aria-invalid': rightErr ? 'true' : null, 'aria-describedby': rightErr ? 'w-q' + i + '-right-err' : null },
          h('legend', { class: 'label' }, t('wRight')),
          LETTERS.map(function (l, k) {
            var r = h('input', { type: 'radio', name: 'w-q' + i + '-right', id: 'w-q' + i + '-r' + k, value: String(k), class: 'w-radio', onchange: function () { q.answer = k; } });
            if (q.answer === k) r.checked = true;
            return h('label', { for: 'w-q' + i + '-r' + k, class: 'w-radio-label' }, r, h('span', null, l));
          }),
          h('p', { class: 'error', id: 'w-q' + i + '-right-err' }, rightErr ? t(rightErr) : ''));
        return h('fieldset', { class: 'card w-q', id: 'w-q' + i + '-box' },
          h('legend', { class: 'w-q-legend' }, t('wQ', { i: i + 1 })),
          field('w-q' + i, null, q.q, { label: t('wQText', { i: i + 1 }), max: 200, required: true, set: function (v) { q.q = v; } }),
          optFields,
          radios);
      });
      var form = h('form', { class: 'form w-form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        errors = validateDraft(draft);
        if (Object.keys(errors).length) {
          u.render(true);
          var first = document.querySelector('[aria-invalid="true"]');
          if (first) (first.tagName === 'FIELDSET' ? first.querySelector('input') : first).focus();
          return;
        }
        mode = 'preview'; u.render(true); var pv = document.getElementById('w-pv-h'); if (pv) pv.focus();
      } },
        h('div', { class: 'w-cols' },
          h('div', { class: 'w-col' },
            field('w-title', 'wTitleEn', draft.titleEn, { max: 80, required: true, set: function (v) { draft.titleEn = v; } }),
            field('w-title-ur', 'wTitleUr', draft.titleUr, { max: 80, lang: 'ur', dir: 'rtl', set: function (v) { draft.titleUr = v; } }),
            field('w-subject', 'wSubject', draft.subject, { max: 30, set: function (v) { draft.subject = v; } }),
            field('w-text', 'wText', draft.text, { area: true, required: true, hint: t('wTextHint'), after: count, set: function (v) { draft.text = v; }, onchange: function () { count.textContent = t('wSentCount', { n: splitSentences(draft.text).length }); } })),
          h('div', { class: 'w-col' }, qBlocks)),
        h('div', { class: 'row' }, btn(t('wPreview'), { type: 'submit', id: 'w-preview' }), btn(t('cancel'), { kind: 'btn-outline', onclick: function () { u.go('/teacher'); } })));
      return [h('p', { class: 'lede' }, t('writeIntro')), importBox(), summary, form];
    }

    function hasContent() { return !!(draft.titleEn.trim() || draft.text.trim() || draft.quiz.some(function (q) { return q.q.trim(); })); }
    function applyImport(text, kind) {
      var l = lessonFromText(text, kind);
      var sents = splitSentences(l.body);
      if (!l.title && !sents.length) { importMsg = { ok: false, text: t('wNoText') }; u.render(true); focusMsg(); return; }
      if (hasContent() && !root.confirm(t('wReplace'))) return;
      draft.titleEn = l.title; draft.text = l.body;
      draft.quiz = suggestQuestions(sents);
      var nq = draft.quiz.filter(function (q) { return q.q; }).length;
      errors = {}; mode = 'edit';
      importMsg = { ok: true, text: t('wImported', { title: l.title, n: sents.length, q: nq }) };
      u.render(true); focusMsg();
    }
    function focusMsg() { var m = document.getElementById('w-import-msg'); if (m) m.focus(); }
    function importBox() {
      var msg = h('p', { class: 'file-msg ' + (importMsg ? (importMsg.ok ? 'file-msg--ok' : 'file-msg--bad') : ''), id: 'w-import-msg', role: 'status', tabindex: '-1' }, importMsg ? importMsg.text : '');
      var file = h('input', { type: 'file', id: 'w-import-file', class: 'sr-file', accept: '.txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf', onchange: function () {
        var f = file.files && file.files[0]; if (!f) return;
        var name = f.name.toLowerCase();
        var kind = /\.pdf$/.test(name) || f.type === 'application/pdf' ? 'pdf' : /\.(md|markdown)$/.test(name) ? 'md' : 'txt';
        if (kind === 'pdf') {
          msg.className = 'file-msg'; msg.textContent = t('wPdfLoading');
          f.arrayBuffer().then(function (buf) { return pdfText(new Uint8Array(buf), u.loadScript); }).then(function (txt) {
            if (!txt || txt.replace(/\s/g, '').length < 3) { importMsg = { ok: false, text: t('wNoText') }; u.render(true); focusMsg(); return; }
            applyImport(txt, 'pdf');
          }).catch(function () { importMsg = { ok: false, text: t('wPdfFail') }; u.render(true); focusMsg(); });
        } else {
          f.text().then(function (txt) { applyImport(txt, kind); });
        }
        file.value = '';
      } });
      var paste = h('textarea', { id: 'w-import-paste', class: 'field field-text field-paste', rows: '4', dir: 'auto', 'aria-describedby': 'w-import-paste-hint' });
      return h('section', { class: 'card w-import', 'aria-labelledby': 'w-imp-h' },
        h('h2', { id: 'w-imp-h', class: 'kicker' }, t('wImport')),
        h('p', { class: 'hint' }, t('wImportHint')),
        h('div', { class: 'row' }, file, h('label', { for: 'w-import-file', class: 'btn btn-outline btn-small', id: 'w-import-file-label' }, u.icon('file'), h('span', null, t('wImportFile')))),
        h('label', { for: 'w-import-paste', class: 'label' }, t('wPasteLabel')), paste,
        h('p', { class: 'hint', id: 'w-import-paste-hint' }, t('wPasteHint')),
        h('div', { class: 'row' },
          btn(t('wUsePaste'), { kind: 'btn-outline btn-small', id: 'w-import-paste-btn', onclick: function () { if (paste.value.trim()) applyImport(paste.value, 'txt'); } }),
          btn(t('wSuggest'), { kind: 'btn-link btn-small', id: 'w-suggest', onclick: function () {
            var sents = splitSentences(draft.text);
            if (sents.length < 2) { importMsg = { ok: false, text: t('wErrText') }; u.render(true); focusMsg(); return; }
            draft.quiz = suggestQuestions(sents); errors = {};
            importMsg = { ok: true, text: t('wSuggested', { q: draft.quiz.filter(function (q) { return q.q; }).length }) };
            u.render(true); focusMsg();
          } })),
        msg);
    }

    function previewView() {
      var pack = buildPack(draft, 'xxxx');
      var f = u.Store.formatSize(u.Store.packBytes(pack));
      var sl = h('ol', { class: 'pv-sents' }); pack.sentences.en.forEach(function (s) { sl.appendChild(h('li', { dir: 'auto' }, s)); });
      var ql = h('ol', { class: 'pv-quiz' });
      pack.quiz.forEach(function (q) {
        var ol = h('ul', { class: 'pv-opts' });
        q.options.en.forEach(function (o, k) { ol.appendChild(h('li', { class: k === q.answer ? 'pv-right' : null, dir: 'auto' }, h('bdi', null, o), k === q.answer ? h('span', null, ' (' + t('wRightMark') + ')') : null)); });
        ql.appendChild(h('li', null, h('p', { class: 'pv-q', dir: 'auto' }, q.q.en), ol));
      });
      return h('section', { class: 'card w-preview', 'aria-labelledby': 'w-pv-h' },
        h('h2', { id: 'w-pv-h', class: 'kicker', tabindex: '-1' }, t('wPreview')),
        h('h3', { class: 'today-title', dir: 'auto' }, pack.title.en), pack.title.ur ? h('p', { lang: 'ur', dir: 'rtl', class: 'pv-ur' }, pack.title.ur) : null,
        h('p', { class: 'meta' }, t('sizeLine', { kb: f.kb, mb: f.mb }) + ' · ' + t('sentences', { n: pack.sentences.en.length }) + ' · ' + t('questions', { n: pack.quiz.length })),
        h('div', { class: 'w-cols' }, h('div', { class: 'w-col' }, sl), h('div', { class: 'w-col' }, ql)),
        h('div', { class: 'row' },
          btn(t('wSave'), { id: 'w-save', onclick: function () {
            var p = buildPack(draft);
            var v = u.Store.validatePack(p);
            if (!v.ok) { mode = 'edit'; errors = { 'w-text': 'wErrTooMany' }; u.render(true); return; }
            u.store.saveMine(p); saved = p; mode = 'saved'; u.render(true);
            u.announce(t('wSaved', { title: p.title.en }));
            var d = document.getElementById('w-done'); if (d) d.focus();
          } }),
          btn(t('wEdit'), { kind: 'btn-outline', id: 'w-edit', onclick: function () { mode = 'edit'; u.render(true); var f0 = document.getElementById('w-title'); if (f0) f0.focus(); } })));
    }

    function savedView() {
      return h('section', { class: 'card' },
        h('p', { class: 'success', id: 'w-done', tabindex: '-1' }, u.icon('tick'), h('span', null, t('wSaved', { title: saved.title.en }))),
        h('div', { class: 'row' },
          btn(t('shareQR'), { href: '#/share/' + saved.id, icon: 'qr', id: 'w-share' }),
          btn(t('wWriteAnother'), { kind: 'btn-outline', onclick: function () { draft = emptyDraft(); errors = {}; mode = 'edit'; saved = null; importMsg = null; u.render(true); } }),
          btn(t('teacherTitle'), { href: '#/teacher', kind: 'btn-outline' })));
    }

    if (mode === 'saved' && !saved) mode = 'edit';
    var body = mode === 'preview' ? previewView() : mode === 'saved' ? savedView() : editView();
    return h('div', { class: 'screen screen-write' },
      u.topbar(u.backBtn('/teacher'), u.langToggle()),
      h('main', { id: 'main', class: 'page page-wide' }, u.underlined('h1', t('writeLesson')), body));
  }

  function reset() { draft = null; mode = 'edit'; errors = {}; saved = null; importMsg = null; }
  var EkAuthor = { splitSentences: splitSentences, validateDraft: validateDraft, buildPack: buildPack, emptyDraft: emptyDraft, screen: screen, reset: reset,
    lessonFromText: lessonFromText, stripMarkdown: stripMarkdown, suggestQuestions: suggestQuestions, pdfText: pdfText };
  if (typeof module !== 'undefined' && module.exports) module.exports = EkAuthor; else root.EkAuthor = EkAuthor;
})(typeof self !== 'undefined' ? self : globalThis);
