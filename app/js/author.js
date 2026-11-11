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
      if (q.options.some(function (o) { return !o.trim(); })) e['w-q' + i + '-opts'] = 'wErrOpt';
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

  var draft = null, mode = 'edit', errors = {}, saved = null;

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
        maxlength: opts.max ? String(opts.max) : null, autocomplete: 'off', lang: opts.lang || null, dir: opts.dir || null,
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
        var optsErr = errors['w-q' + i + '-opts'], rightErr = errors['w-q' + i + '-right'];
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
          optsErr ? h('p', { class: 'error', id: 'w-q' + i + '-opts-err' }, t(optsErr)) : null,
          radios);
      });
      var form = h('form', { class: 'form w-form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        errors = validateDraft(draft);
        if (Object.keys(errors).length) {
          u.render(true);
          var first = document.querySelector('[aria-invalid="true"]');
          var s = document.getElementById('w-summary'); if (s) s.focus();
          if (first) { var target = first.tagName === 'FIELDSET' ? first.querySelector('input') : first; setTimeout(function () { target.focus(); }, 60); }
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
      return [h('p', { class: 'lede' }, t('writeIntro')), summary, form];
    }

    function previewView() {
      var pack = buildPack(draft, 'xxxx');
      var f = u.Store.formatSize(u.Store.packBytes(pack));
      var sl = h('ol', { class: 'pv-sents' }); pack.sentences.en.forEach(function (s) { sl.appendChild(h('li', null, s)); });
      var ql = h('ol', { class: 'pv-quiz' });
      pack.quiz.forEach(function (q) {
        var ol = h('ul', { class: 'pv-opts' });
        q.options.en.forEach(function (o, k) { ol.appendChild(h('li', { class: k === q.answer ? 'pv-right' : null }, o, k === q.answer ? h('span', null, ' (' + t('wRightMark') + ')') : null)); });
        ql.appendChild(h('li', null, h('p', { class: 'pv-q' }, q.q.en), ol));
      });
      return h('section', { class: 'card w-preview', 'aria-labelledby': 'w-pv-h' },
        h('h2', { id: 'w-pv-h', class: 'kicker', tabindex: '-1' }, t('wPreview')),
        h('h3', { class: 'today-title' }, pack.title.en), pack.title.ur ? h('p', { lang: 'ur', dir: 'rtl', class: 'pv-ur' }, pack.title.ur) : null,
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
          btn(t('wWriteAnother'), { kind: 'btn-outline', onclick: function () { draft = emptyDraft(); errors = {}; mode = 'edit'; saved = null; u.render(true); } }),
          btn(t('teacherTitle'), { href: '#/teacher', kind: 'btn-outline' })));
    }

    if (mode === 'saved' && !saved) mode = 'edit';
    var body = mode === 'preview' ? previewView() : mode === 'saved' ? savedView() : editView();
    return h('div', { class: 'screen screen-write' },
      u.topbar(u.backBtn('/teacher'), u.langToggle()),
      h('main', { id: 'main', class: 'page page-wide' }, u.underlined('h1', t('writeLesson')), body));
  }

  function reset() { draft = null; mode = 'edit'; errors = {}; saved = null; }
  var EkAuthor = { splitSentences: splitSentences, validateDraft: validateDraft, buildPack: buildPack, emptyDraft: emptyDraft, screen: screen, reset: reset };
  if (typeof module !== 'undefined' && module.exports) module.exports = EkAuthor; else root.EkAuthor = EkAuthor;
})(typeof self !== 'undefined' ? self : globalThis);
