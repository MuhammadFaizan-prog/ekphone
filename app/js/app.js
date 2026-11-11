/* Ek Phone — app screens. Vanilla JS, no build step, no network calls. */
(function () {
  'use strict';
  var Store = window.EkStore, QR = window.EkQR, I18N = window.EkI18n, A = window.EkArt;
  var store = Store.createStore(window.localStorage);
  var BUILTIN = window.EK_BUILTIN || [];
  var ARTS = ['roti', 'cloud', 'blocks', 'leaf', 'book'];
  var app = document.getElementById('app');
  var live = document.getElementById('live');
  var settings = store.getSettings();
  var cleanup = [];       // functions to run when leaving a screen
  var firstRender = true;
  var quizState = null;   // { packId, i, answers:[], checked }
  var lastResult = null;

  /* ---------- helpers ---------- */
  function lang() { return settings.lang; }
  function t(key, vars) { return I18N.t(lang(), key, vars); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // only ever used with our own constant SVG strings
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  function svgEl(markup) { var d = document.createElement('span'); d.className = 'svgwrap'; d.innerHTML = markup; return d; }
  function icon(name) { return svgEl(A.ICON[name]); }
  /** Pack text in Urdu often contains English words or maths; isolate them so RTL order stays right. */
  function rich(text) {
    var frag = document.createDocumentFragment();
    if (lang() !== 'ur') { frag.appendChild(document.createTextNode(text)); return frag; }
    var re = /[A-Za-z0-9](?:[A-Za-z0-9 \/=+'".,-]*[A-Za-z0-9.])?/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var b = document.createElement('bdi'); b.setAttribute('dir', 'ltr'); b.className = 'ltr';
      if (/[A-Za-z]/.test(m[0])) b.setAttribute('lang', 'en');
      b.textContent = m[0]; frag.appendChild(b); last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function L(obj) { if (!obj) return ''; if (typeof obj === 'string') return obj; return (lang() === 'ur' && obj.ur) ? obj.ur : obj.en; }
  function sentencesOf(p) { return (lang() === 'ur' && p.sentences.ur && p.sentences.ur.length === p.sentences.en.length) ? p.sentences.ur : p.sentences.en; }
  function optionsOf(q) { return (lang() === 'ur' && q.options.ur) ? q.options.ur : q.options.en; }
  function announce(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
  function underlined(tag, text, cls) {
    return h(tag, { class: 'title ' + (cls || ''), tabindex: '-1', id: 'screen-title' }, h('span', { class: 'title-ink' }, rich(text), svgEl(A.UNDERLINE)));
  }
  function size(p) { var f = Store.formatSize(Store.packBytes(p)); return f; }
  function allPacks() {
    var imported = store.listImportedPacks();
    var ids = {};
    var list = BUILTIN.map(function (p) { return p; });
    list.forEach(function (p) { ids[p.id] = true; });
    imported.forEach(function (p) {
      if (ids[p.id]) { var i = list.findIndex(function (b) { return b.id === p.id; }); if ((p.version || 1) > (list[i].version || 1)) list[i] = Object.assign({ _imported: true }, p); }
      else list.push(Object.assign({ _imported: true }, p));
    });
    return list;
  }
  function findPack(id) { return allPacks().filter(function (p) { return p.id === id; })[0] || null; }
  function artFor(p) { return svgEl(A.ART[ARTS.indexOf(p.art) >= 0 ? p.art : 'book']); }
  function currentProfile() { var id = sessionStorage.getItem('ekphone:who'); return id ? store.getProfile(id) : null; }
  function setProfile(id) { if (id) sessionStorage.setItem('ekphone:who', id); else sessionStorage.removeItem('ekphone:who'); }
  function go(path, replace) {
    if (replace) history.replaceState(null, '', '#' + path); else history.pushState(null, '', '#' + path);
    render();
  }
  function btn(label, opts) {
    opts = opts || {};
    return h(opts.href ? 'a' : 'button', Object.assign({ class: 'btn ' + (opts.kind || 'btn-primary'), type: opts.href ? null : (opts.type || 'button'), href: opts.href || null, onclick: opts.onclick || null, id: opts.id || null, 'aria-describedby': opts.describedby || null, disabled: opts.disabled || null }), opts.icon ? icon(opts.icon) : null, h('span', null, label));
  }
  function backBtn(path) {
    return h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('back'), onclick: function () { if (path) go(path); else history.back(); } }, icon('back'));
  }
  function today() { return new Date().toDateString(); }

  /* ---------- language ---------- */
  function applyLang() {
    var l = lang();
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ur' ? 'rtl' : 'ltr';
    if (l === 'ur' && !document.getElementById('urdu-font')) {
      var link = document.createElement('link'); link.id = 'urdu-font'; link.rel = 'stylesheet'; link.href = 'css/urdu.css';
      document.head.appendChild(link);
    }
  }
  function langToggle() {
    function b(code, label, l) {
      return h('button', { type: 'button', class: 'lt-btn', lang: l, 'aria-pressed': String(lang() === code), onclick: function () {
        if (lang() === code) return;
        settings = store.setSettings({ lang: code }); applyLang(); render(true);
        var again = document.querySelector('.lt-btn[aria-pressed="true"]'); if (again) again.focus();
      } }, label);
    }
    return h('div', { class: 'lang-toggle', role: 'group', 'aria-label': t('langToggle') + ' / زبان' }, b('en', 'English', 'en'), h('span', { class: 'lt-sep', 'aria-hidden': 'true' }, '|'), b('ur', 'اردو', 'ur'));
  }
  function topbar(left, right) { return h('header', { class: 'topbar' }, left, h('span', { class: 'spacer' }), right); }
  function brand() { return h('span', { class: 'brand' }, t('appName')); }
  function offlineChip() { return h('p', { class: 'chip' }, t('offlineChip')); }

  /* ---------- screens ---------- */
  var screens = {};

  screens.picker = function () {
    setProfile(null);
    var profiles = store.listProfiles();
    var list = h('ul', { class: 'tags', role: 'list' });
    profiles.forEach(function (p) {
      var done = Object.keys(store.getProgress(p.id)).some(function (k) { return store.getProgress(p.id)[k].doneDay === today(); });
      list.appendChild(h('li', null, h('button', { type: 'button', class: 'tag', 'data-id': p.id, onclick: function () { if (p.pin) go('/pin/' + p.id); else { setProfile(p.id); go('/home'); } } },
        h('span', { class: 'tag-panel' },
          h('span', { class: 'tag-name' }, p.name),
          h('span', { class: 'ribbon ribbon--' + p.color, 'aria-hidden': 'true' }),
          p.pin ? h('span', { class: 'tag-lock' }, icon('lock'), h('span', { class: 'sr' }, ', PIN')) : null,
          done ? h('span', { class: 'tag-tick' }, icon('tick'), h('span', { class: 'sr' }, lang() === 'ur' ? '، آج کا کام مکمل' : ', done today')) : null),
        h('span', { class: 'badge badge--' + p.color, 'aria-hidden': 'true' }, p.name.charAt(0).toUpperCase()))));
    });
    return h('div', { class: 'screen screen-picker' },
      topbar(brand(), langToggle()),
      h('main', { id: 'main', class: 'page' },
        underlined('h1', t('whoStudying')),
        h('p', { class: 'lede' }, profiles.length ? t('tapYourName') : t('noLearners')),
        list,
        profiles.length < Store.MAX_PROFILES ? btn(t('addLearner'), { kind: 'btn-outline', icon: 'plus', onclick: function () { go('/add'); } }) : null,
        h('div', { class: 'foot-row' }, btn(t('teacherMode'), { kind: 'btn-link', onclick: function () { go('/teacher'); } }), offlineChip())));
  };

  screens.add = function () {
    var err = h('p', { class: 'error', id: 'add-err', role: 'alert' });
    var name = h('input', { id: 'f-name', name: 'name', type: 'text', maxlength: '20', autocomplete: 'off', required: true, 'aria-describedby': 'f-name-hint', class: 'field' });
    var pin = h('input', { id: 'f-pin', name: 'pin', type: 'password', inputmode: 'numeric', pattern: '[0-9]{4}', maxlength: '4', autocomplete: 'off', 'aria-describedby': 'f-pin-hint', class: 'field field-pin' });
    var form = h('form', { class: 'form', novalidate: true, onsubmit: async function (e) {
      e.preventDefault(); err.textContent = ''; name.removeAttribute('aria-invalid'); pin.removeAttribute('aria-invalid');
      try {
        var p = await store.addProfile(name.value, pin.value.trim());
        announce(p.name); go('/', true);
      } catch (ex) {
        var map = { 'name-required': 'errNameRequired', duplicate: 'errDuplicate', 'too-many': 'errTooMany', 'bad-pin': 'errBadPin' };
        var key = map[ex.message] || 'errNameRequired';
        err.textContent = t(key);
        var bad = key === 'errBadPin' ? pin : name; bad.setAttribute('aria-invalid', 'true'); bad.setAttribute('aria-errormessage', 'add-err'); bad.focus();
      }
    } },
      h('label', { for: 'f-name', class: 'label' }, t('nameLabel')), name, h('p', { class: 'hint', id: 'f-name-hint' }, t('nameHint')),
      h('label', { for: 'f-pin', class: 'label' }, t('pinLabel')), pin, h('p', { class: 'hint', id: 'f-pin-hint' }, t('pinHint')),
      err,
      h('div', { class: 'row' }, btn(t('save'), { type: 'submit' }), btn(t('cancel'), { kind: 'btn-outline', onclick: function () { go('/'); } })));
    return h('div', { class: 'screen' }, topbar(backBtn('/'), langToggle()), h('main', { id: 'main', class: 'page' }, underlined('h1', t('newLearner')), form));
  };

  screens.pin = function (id) {
    var p = store.getProfile(id);
    if (!p) { go('/', true); return null; }
    var err = h('p', { class: 'error', id: 'pin-err', role: 'alert' });
    var pin = h('input', { id: 'f-pin2', type: 'password', inputmode: 'numeric', pattern: '[0-9]{4}', maxlength: '4', autocomplete: 'off', class: 'field field-pin', 'aria-errormessage': 'pin-err' });
    var form = h('form', { class: 'form', novalidate: true, onsubmit: async function (e) {
      e.preventDefault();
      var r = await store.checkPin(id, pin.value.trim());
      if (r.ok) { setProfile(id); go('/home', true); return; }
      pin.value = ''; pin.setAttribute('aria-invalid', 'true');
      err.textContent = r.waitMs > 0 ? t('waitPin', { s: Math.ceil(r.waitMs / 1000) }) : t('wrongPin'); pin.focus();
    } },
      h('label', { for: 'f-pin2', class: 'label' }, t('pinFor', { name: p.name })), pin, err,
      h('div', { class: 'row' }, btn(t('open'), { type: 'submit' }), btn(t('back'), { kind: 'btn-outline', onclick: function () { go('/'); } })));
    return h('div', { class: 'screen' }, topbar(backBtn('/'), langToggle()),
      h('main', { id: 'main', class: 'page' }, underlined('h1', t('enterPin')),
        h('div', { class: 'tag tag--static', 'aria-hidden': 'true' }, h('span', { class: 'tag-panel' }, h('span', { class: 'tag-name' }, p.name), h('span', { class: 'ribbon ribbon--' + p.color })), h('span', { class: 'badge badge--' + p.color }, p.name.charAt(0).toUpperCase())),
        form));
  };

  function scoreDots(best, total, label) {
    var ul = h('ul', { class: 'dots', role: 'list', 'aria-label': label });
    for (var i = 0; i < total; i++) ul.appendChild(h('li', { class: 'dot' + (best != null && i < best ? ' dot--on' : '') }));
    return ul;
  }
  function packMeta(p, prog) {
    var f = size(p);
    return h('p', { class: 'meta' }, t('sizeLine', { kb: f.kb, mb: f.mb }) + ' · ' + t('questions', { n: p.quiz.length }) + ' · ' + (prog.best != null ? t('bestScore', { s: prog.best, t: p.quiz.length }) : (prog.read ? t('readDone') : t('notStarted'))));
  }

  screens.home = function () {
    var who = currentProfile();
    if (!who) { go('/', true); return null; }
    var packs = allPacks();
    var tp = store.todaysPack(who.id, packs);
    var prog = store.getPackProgress(who.id, tp.id);
    var shelf = h('ul', { class: 'shelf', role: 'list' });
    packs.forEach(function (p) {
      var pr = store.getPackProgress(who.id, p.id);
      shelf.appendChild(h('li', null, h('a', { class: 'spine', href: '#/read/' + p.id },
        h('span', { class: 'spine-subj' }, L(p.subject) || 'Lesson'),
        h('span', { class: 'spine-title' }, rich(L(p.title))),
        packMeta(p, pr))));
    });
    return h('div', { class: 'screen screen-home' },
      topbar(h('button', { type: 'button', class: 'btn btn-link btn-small', onclick: function () { setProfile(null); go('/'); } }, t('switchLearner')), langToggle()),
      h('main', { id: 'main', class: 'page' },
        underlined('h1', t('hello', { name: who.name })),
        h('section', { class: 'today card', 'aria-labelledby': 'today-h' },
          h('h2', { id: 'today-h', class: 'kicker' }, t('todaysLesson')),
          h('p', { class: 'today-subj' }, L(tp.subject)),
          h('h3', { class: 'today-title' }, rich(L(tp.title))),
          artFor(tp),
          packMeta(tp, prog),
          scoreDots(prog.best, tp.quiz.length, t('quizProgress') + ': ' + (prog.best != null ? t('bestScore', { s: prog.best, t: tp.quiz.length }) : t('notStarted'))),
          btn(prog.sentence > 0 && !prog.read ? t('continueReading') : t('startReading'), { href: '#/read/' + tp.id, icon: 'play' })),
        h('h2', { class: 'section-h' }, t('allLessons')),
        shelf,
        h('div', { class: 'foot-row' }, offlineChip())));
  };

  /* ---------- reading + speech ---------- */
  function pickVoice(code) {
    if (!('speechSynthesis' in window)) return { ok: false, reason: 'none' };
    var voices = speechSynthesis.getVoices() || [];
    var v = voices.filter(function (x) { return (x.lang || '').toLowerCase().indexOf(code) === 0; });
    if (v.length) return { ok: true, voice: v.filter(function (x) { return /PK|IN/i.test(x.lang); })[0] || v[0] };
    if (code === 'en' && voices.length === 0) return { ok: true, voice: null }; // some phones list voices late; let the default English voice try
    return { ok: false, reason: 'lang' };
  }

  screens.read = function (packId) {
    var who = currentProfile();
    if (!who) { go('/', true); return null; }
    var p = findPack(packId);
    if (!p) { go('/home', true); return null; }
    var sents = sentencesOf(p);
    var prog = store.getPackProgress(who.id, p.id);
    var cur = Math.min(prog.sentence || 0, sents.length - 1);
    var speaking = false, utterGen = 0;

    var spans = sents.map(function (s, i) { return h('span', { class: 's', 'data-i': String(i), onclick: function () { move(i, true); } }, rich(s), ' '); });
    var text = h('div', { class: 'lesson-text', id: 'lesson-text', tabindex: '0', role: 'region', 'aria-label': L(p.title), 'aria-describedby': 'lesson-help', onkeydown: onKey }, spans);
    var help = h('p', { class: 'sr', id: 'lesson-help' }, t('lessonHelp'));
    var counter = h('p', { class: 'counter', 'aria-hidden': 'true' });
    var note = h('p', { class: 'note', hidden: true });
    var playBtn = h('button', { type: 'button', class: 'btn btn-primary btn-read', id: 'read-aloud', 'aria-pressed': 'false', onclick: toggleSpeak }, icon('play'), h('span', null, t('readAloud')));
    var prevBtn = h('button', { type: 'button', class: 'round-btn', id: 'prev-s', 'aria-label': t('prevSentence'), onclick: function () { stopSpeak(); move(cur - 1, true); } }, icon('prev'));
    var nextBtn = h('button', { type: 'button', class: 'round-btn', id: 'next-s', 'aria-label': t('nextSentence'), onclick: function () { stopSpeak(); move(cur + 1, true); } }, icon('next'));

    var menuOpen = false;
    var menuPanel = h('div', { class: 'menu', id: 'lesson-menu', hidden: true },
      h('a', { class: 'menu-item', href: '#/share/' + p.id }, icon('qr'), h('span', null, t('shareThis'))),
      h('button', { type: 'button', class: 'menu-item', onclick: function () { textSize(0.1); } }, h('span', { class: 'aa', 'aria-hidden': 'true' }, 'A+'), h('span', null, t('bigger'))),
      h('button', { type: 'button', class: 'menu-item', onclick: function () { textSize(-0.1); } }, h('span', { class: 'aa', 'aria-hidden': 'true' }, 'A−'), h('span', null, t('smaller'))));
    var menuBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('menu'), 'aria-expanded': 'false', 'aria-controls': 'lesson-menu', onclick: function () { setMenu(!menuOpen); } }, icon('dots'));
    function setMenu(open) { menuOpen = open; menuPanel.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); if (open) menuPanel.querySelector('.menu-item').focus(); }
    menuPanel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); menuBtn.focus(); } });
    function textSize(d) { settings = store.setSettings({ textSize: Math.max(0.9, Math.min(1.6, Math.round((settings.textSize + d) * 10) / 10)) }); document.documentElement.style.setProperty('--ts', settings.textSize); }

    function move(i, userMoved) {
      if (i < 0 || i >= sents.length) return;
      cur = i;
      spans.forEach(function (s, k) { s.classList.toggle('on', k === i); if (k === i) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current'); });
      counter.textContent = t('sentenceOf', { i: i + 1, n: sents.length });
      prevBtn.disabled = i === 0; nextBtn.disabled = i === sents.length - 1;
      store.saveReading(who.id, p.id, i, i === sents.length - 1);
      if (userMoved) announce(t('sentenceOf', { i: i + 1, n: sents.length }) + '. ' + sents[i].replace(/[\u2066-\u2069]/g, ''));
      var r = spans[i].getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 120) spans[i].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    function onKey(e) {
      var rtl = lang() === 'ur';
      var nextKeys = ['ArrowDown', rtl ? 'ArrowLeft' : 'ArrowRight'], prevKeys = ['ArrowUp', rtl ? 'ArrowRight' : 'ArrowLeft'];
      if (nextKeys.indexOf(e.key) >= 0) { e.preventDefault(); stopSpeak(); move(cur + 1, true); }
      else if (prevKeys.indexOf(e.key) >= 0) { e.preventDefault(); stopSpeak(); move(cur - 1, true); }
      else if (e.key === 'Home') { e.preventDefault(); stopSpeak(); move(0, true); }
      else if (e.key === 'End') { e.preventDefault(); stopSpeak(); move(sents.length - 1, true); }
      else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggleSpeak(); }
    }
    function setPlaying(on) {
      speaking = on; playBtn.setAttribute('aria-pressed', String(on));
      playBtn.replaceChildren(icon(on ? 'pause' : 'play'), h('span', null, on ? t('pause') : t('readAloud')));
      document.body.classList.toggle('is-speaking', on);
    }
    function speakFrom(i) {
      var v = pickVoice(lang());
      if (!v.ok) { showNote(v.reason); setPlaying(false); return; }
      var gen = ++utterGen;
      move(i, false);
      var u = new SpeechSynthesisUtterance(sents[i].replace(/[\u2066-\u2069]/g, ''));
      u.lang = lang() === 'ur' ? 'ur-PK' : 'en-IN';
      if (v.voice) { u.voice = v.voice; u.lang = v.voice.lang; }
      u.rate = settings.rate || 0.9;
      u.onstart = function () { if (gen === utterGen) move(i, false); };
      u.onend = function () {
        if (gen !== utterGen || !speaking) return;
        if (i + 1 < sents.length) speakFrom(i + 1); else { setPlaying(false); store.saveReading(who.id, p.id, i, true); }
      };
      u.onerror = function () { if (gen === utterGen) setPlaying(false); };
      speechSynthesis.speak(u);
    }
    function toggleSpeak() {
      if (speaking) { stopSpeak(); return; }
      setPlaying(true); speakFrom(cur);
    }
    function stopSpeak() {
      utterGen++;
      if (speaking && 'speechSynthesis' in window) speechSynthesis.cancel();
      if (speaking) setPlaying(false);
    }
    function showNote(reason) {
      note.hidden = false;
      note.textContent = reason === 'none' ? t('noSpeech') : t('noVoice', { lang: lang() === 'ur' ? t('langUrdu') : t('langEnglish') });
      announce(note.textContent);
    }
    cleanup.push(function () { stopSpeak(); document.body.classList.remove('is-speaking'); });

    var screen = h('div', { class: 'screen screen-read' },
      topbar(backBtn('/home'), h('div', { class: 'menu-wrap' }, menuBtn, menuPanel)),
      h('main', { id: 'main', class: 'page page-book' },
        h('p', { class: 'kicker' }, L(p.subject)),
        h('h1', { class: 'lesson-title', tabindex: '-1', id: 'screen-title' }, rich(L(p.title))),
        artFor(p),
        help, text, counter, note,
        h('div', { class: 'after-text' }, btn(t('startQuiz'), { href: '#/quiz/' + p.id, kind: 'btn-outline', id: 'start-quiz' }))),
      h('div', { class: 'toolbar' }, offlineChip(), playBtn, h('span', { class: 'spacer' }), prevBtn, nextBtn));
    setTimeout(function () { move(cur, false); }, 0);
    // Hide the speak button entirely only if the browser has no speech engine.
    if (!('speechSynthesis' in window)) { playBtn.disabled = true; setTimeout(function () { showNote('none'); }, 0); }
    else if (lang() === 'ur') {
      var check = function () { var v = pickVoice('ur'); if (!v.ok) showNote('lang'); else note.hidden = true; };
      setTimeout(check, 400);
      speechSynthesis.addEventListener('voiceschanged', check);
      cleanup.push(function () { speechSynthesis.removeEventListener('voiceschanged', check); });
    }
    return screen;
  };

  /* ---------- quiz ---------- */
  function quizDots(qs, answers, current) {
    var ul = h('ul', { class: 'qdots', role: 'list', 'aria-label': t('quizProgress') });
    qs.forEach(function (q, i) {
      var st = answers[i] == null ? 'todo' : (answers[i] === q.answer ? 'right' : 'wrong');
      ul.appendChild(h('li', { class: 'qdot qdot--' + st + (i === current ? ' qdot--cur' : '') },
        st === 'right' ? icon('tick') : st === 'wrong' ? icon('cross') : null,
        h('span', { class: 'sr' }, t('qDone', { i: i + 1, state: t(st === 'right' ? 'stateRight' : st === 'wrong' ? 'stateWrong' : 'stateTodo') }))));
    });
    return ul;
  }
  screens.quiz = function (packId) {
    var who = currentProfile();
    if (!who) { go('/', true); return null; }
    var p = findPack(packId);
    if (!p) { go('/home', true); return null; }
    if (!quizState || quizState.packId !== packId || quizState.who !== who.id) quizState = { packId: packId, who: who.id, i: 0, answers: [], checked: false };
    var qs = p.quiz, st = quizState, q = qs[st.i];
    var opts = optionsOf(q);
    var name = 'q' + st.i;
    var feedback = h('div', { class: 'feedback', role: 'status', id: 'feedback' });
    var fs = h('fieldset', { class: 'options' }, h('legend', { class: 'q-text', id: 'screen-title', tabindex: '-1' }, rich(L(q.q))));
    opts.forEach(function (o, k) {
      var id = name + '-' + k;
      var input = h('input', { type: 'radio', name: name, id: id, value: String(k), class: 'opt-input' });
      if (st.checked) { input.disabled = true; if (st.answers[st.i] === k) input.checked = true; }
      fs.appendChild(h('div', { class: 'opt' + (st.checked && k === q.answer ? ' opt--right' : '') + (st.checked && st.answers[st.i] === k && k !== q.answer ? ' opt--wrong' : '') },
        input, h('label', { for: id, class: 'opt-label' }, h('span', { class: 'opt-mark', 'aria-hidden': 'true' }), h('span', { class: 'opt-text' }, rich(o)),
          st.checked && k === q.answer ? h('span', { class: 'opt-flag' }, icon('tick')) : null,
          st.checked && st.answers[st.i] === k && k !== q.answer ? h('span', { class: 'opt-flag' }, icon('cross')) : null)));
    });
    if (st.checked) {
      var right = st.answers[st.i] === q.answer;
      feedback.classList.add(right ? 'feedback--right' : 'feedback--wrong');
      feedback.appendChild(h('p', { class: 'fb-head' }, icon(right ? 'tick' : 'cross'), h('span', null, right ? t('correct') : t('notQuite', { a: opts[q.answer] }))));
      if (q.explain) feedback.appendChild(h('p', { class: 'fb-explain' }, rich(L(q.explain))));
    }
    var last = st.i === qs.length - 1;
    var action = btn(st.checked ? (last ? t('seeResult') : t('next')) : t('check'), { id: 'quiz-action', onclick: function () {
      if (!st.checked) {
        var sel = fs.querySelector('input:checked');
        if (!sel) { feedback.className = 'feedback feedback--wrong'; feedback.textContent = t('chooseFirst'); fs.querySelector('input').focus(); return; }
        st.answers[st.i] = +sel.value; st.checked = true; render(true);
        var b = document.getElementById('quiz-action'); if (b) b.focus();
        return;
      }
      if (last) {
        var score = st.answers.filter(function (a, i) { return a === qs[i].answer; }).length;
        store.saveQuiz(who.id, p.id, score, qs.length);
        lastResult = { packId: p.id, score: score, total: qs.length };
        quizState = null; go('/result/' + p.id, true); return;
      }
      st.i++; st.checked = false; render(true);
      var lg = document.getElementById('screen-title'); if (lg) lg.focus();
    } });
    return h('div', { class: 'screen screen-quiz' },
      topbar(backBtn('/read/' + p.id), h('p', { class: 'q-count' }, t('question', { i: st.i + 1, n: qs.length }))),
      h('main', { id: 'main', class: 'page' },
        h('p', { class: 'kicker' }, rich(L(p.title))),
        quizDots(qs, st.answers, st.i),
        h('form', { class: 'quiz-form', onsubmit: function (e) { e.preventDefault(); action.click(); } }, fs, feedback)),
      h('div', { class: 'toolbar toolbar--single' }, action));
  };

  screens.result = function (packId) {
    var who = currentProfile();
    if (!who) { go('/', true); return null; }
    var p = findPack(packId);
    if (!p) { go('/home', true); return null; }
    var pr = store.getPackProgress(who.id, p.id);
    var r = lastResult && lastResult.packId === packId ? lastResult : { score: pr.last || 0, total: p.quiz.length };
    return h('div', { class: 'screen screen-result' },
      topbar(brand(), langToggle()),
      h('main', { id: 'main', class: 'page center' },
        underlined('h1', t('resultTitle', { name: who.name })),
        h('p', { class: 'score', 'aria-hidden': 'true' }, h('span', { class: 'score-num' }, r.score + '/' + r.total), svgEl('<svg class="score-ring" viewBox="0 0 160 110" aria-hidden="true" focusable="false"><path d="M30 60 C 26 22, 120 10, 138 46 C 152 80, 80 102, 40 88 C 20 80, 18 56, 46 34" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>')),
        h('p', { class: 'lede' }, t('resultScore', { s: r.score, t: r.total })),
        scoreDots(r.score, r.total, t('resultScore', { s: r.score, t: r.total })),
        h('p', { class: 'hint' }, t('resultSaved', { name: who.name })),
        h('div', { class: 'stack' },
          btn(t('home'), { href: '#/home' }),
          btn(t('tryAgain'), { href: '#/quiz/' + p.id, kind: 'btn-outline' }),
          btn(t('readAgain'), { href: '#/read/' + p.id, kind: 'btn-outline' }))));
  };

  /* ---------- teacher: packs, sharing, receiving ---------- */
  screens.teacher = function () {
    var list = h('ul', { class: 'packlist', role: 'list' });
    allPacks().forEach(function (p) {
      var f = size(p);
      list.appendChild(h('li', { class: 'card packrow' },
        h('p', { class: 'spine-subj' }, (p._imported ? t('received') : t('builtIn')) + ' · ' + (L(p.subject) || '')),
        h('h3', { class: 'spine-title' }, rich(L(p.title))),
        h('p', { class: 'meta' }, t('sizeLine', { kb: f.kb, mb: f.mb }) + ' · ' + t('sentences', { n: p.sentences.en.length })),
        h('div', { class: 'row' },
          btn(t('shareQR'), { href: '#/share/' + p.id, kind: 'btn-primary btn-small', icon: 'qr' }),
          btn(t('shareFile'), { kind: 'btn-outline btn-small', icon: 'file', onclick: function () { shareFile(p); } }))));
    });
    var learners = h('ul', { class: 'learners', role: 'list' });
    store.listProfiles().forEach(function (pr) {
      learners.appendChild(h('li', { class: 'learner' }, h('span', { class: 'badge badge--' + pr.color + ' badge--sm', 'aria-hidden': 'true' }, pr.name.charAt(0).toUpperCase()), h('span', { class: 'learner-name' }, pr.name),
        h('button', { type: 'button', class: 'btn btn-link btn-small', 'aria-label': t('remove') + ' ' + pr.name, onclick: function () { if (confirm(t('confirmRemove', { name: pr.name }))) { store.removeProfile(pr.id); render(true); } } }, t('remove'))));
    });
    var fontStatus = h('p', { class: 'hint', role: 'status' });
    var fontBtn = btn(t('urduFontSave', { kb: 98 }), { kind: 'btn-outline btn-small', onclick: function () {
      fetch('fonts/nastaliq-urdu-subset.woff2').then(function (r) { if (!r.ok) throw 0; fontStatus.textContent = t('urduFontSaved'); }).catch(function () { fontStatus.textContent = t('cameraOff').split('.')[0]; });
    } });
    var fileMsg = h('p', { class: 'hint', role: 'status', id: 'file-msg' });
    function shareFile(p) {
      var json = JSON.stringify(p, null, 0);
      var fname = p.id + '.ekpack.json';
      var file = null;
      try { file = new File([json], fname, { type: 'application/json' }); } catch (e) { /* old browsers */ }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: L(p.title) }).then(function () { fileMsg.textContent = t('fileSent'); }).catch(function () {});
        return;
      }
      var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      var a = h('a', { href: url, download: fname }); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      fileMsg.textContent = t('fileDownloaded', { file: fname });
    }
    return h('div', { class: 'screen screen-teacher' },
      topbar(backBtn('/'), langToggle()),
      h('main', { id: 'main', class: 'page' },
        underlined('h1', t('teacherTitle')),
        h('p', { class: 'lede' }, t('teacherIntro')),
        btn(t('receivePack'), { href: '#/receive', icon: 'camera', id: 'go-receive' }),
        fileMsg,
        list,
        h('h2', { class: 'section-h' }, t('learners')),
        learners,
        h('h2', { class: 'section-h' }, t('urduFont')),
        fontBtn, fontStatus));
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function drawQR(canvas, text) {
    var qr = window.qrcode(0, 'M'); qr.addData(text, 'Byte'); qr.make();
    var n = qr.getModuleCount(), quiet = 4, total = n + quiet * 2;
    var css = Math.min(260, Math.max(200, window.innerWidth - 120));
    var scale = Math.max(2, Math.floor((css * (window.devicePixelRatio || 1)) / total));
    canvas.width = canvas.height = total * scale;
    canvas.style.width = canvas.style.height = css + 'px';
    var c = canvas.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#1B1A17';
    for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (qr.isDark(r, col)) c.fillRect((col + quiet) * scale, (r + quiet) * scale, scale, scale);
  }
  function chunkDots(n, label) {
    var ul = h('ul', { class: 'cdots', role: 'list', 'aria-label': label });
    for (var i = 0; i < n; i++) ul.appendChild(h('li', { class: 'cdot' }, h('span', { class: 'sr' }, String(i + 1))));
    return ul;
  }

  screens.share = function (packId) {
    var p = findPack(packId);
    if (!p) { go('/teacher', true); return null; }
    var f = size(p);
    var canvas = h('canvas', { class: 'qr-canvas', role: 'img', id: 'qr-canvas', 'aria-label': L(p.title) });
    var label = h('p', { class: 'qr-label', 'aria-live': 'off' });
    var dotsWrap = h('div', { class: 'dots-wrap' });
    var playing = true, idx = 0, chunks = [], timer = null, seen = {};
    var pauseBtn = btn(t('pauseCodes'), { id: 'qr-pause', onclick: function () { playing = !playing; pauseBtn.querySelector('span:last-child').textContent = playing ? t('pauseCodes') : t('playCodes'); pauseBtn.setAttribute('aria-pressed', String(!playing)); schedule(); } });
    pauseBtn.setAttribute('aria-pressed', 'false');
    var prev = h('button', { type: 'button', class: 'round-btn', id: 'qr-prev', 'aria-label': t('prevCode'), onclick: function () { show(idx - 1); } }, icon('prev'));
    var next = h('button', { type: 'button', class: 'round-btn', id: 'qr-next', 'aria-label': t('nextCode'), onclick: function () { show(idx + 1); } }, icon('next'));
    function show(i) {
      if (!chunks.length) return;
      idx = (i + chunks.length) % chunks.length; seen[idx] = true;
      drawQR(canvas, chunks[idx]);
      canvas.setAttribute('aria-label', t('qrAlt', { i: idx + 1, n: chunks.length, title: L(p.title) }));
      canvas.setAttribute('data-chunk', chunks[idx]);
      label.textContent = t('qrOf', { i: idx + 1, n: chunks.length });
      Array.prototype.forEach.call(dotsWrap.querySelectorAll('.cdot'), function (d, k) { d.classList.toggle('cdot--seen', !!seen[k]); d.classList.toggle('cdot--cur', k === idx); });
      schedule();
    }
    function schedule() { clearTimeout(timer); if (playing && chunks.length > 1) timer = setTimeout(function () { show(idx + 1); }, 2000); }
    cleanup.push(function () { clearTimeout(timer); });
    Promise.all([loadScript('vendor/qrcode-generator.min.js'), QR.encode(p)]).then(function (r) {
      chunks = r[1];
      dotsWrap.appendChild(chunkDots(chunks.length, t('qrDots')));
      if (chunks.length < 2) { pauseBtn.hidden = true; prev.hidden = true; next.hidden = true; }
      document.body.setAttribute('data-chunks', String(chunks.length));
      show(0);
    });
    return h('div', { class: 'screen screen-share' },
      topbar(backBtn('/teacher'), langToggle()),
      h('main', { id: 'main', class: 'page center' },
        underlined('h1', t('shareTitle')),
        h('p', { class: 'share-pack' }, rich(L(p.title))),
        h('div', { class: 'qr-card' }, canvas),
        h('p', { class: 'pack-size' }, t('packSize', { kb: f.kb })),
        label,
        dotsWrap,
        h('div', { class: 'row row-center' }, prev, next),
        h('p', { class: 'hint' }, t('qrHelp')),
        h('p', { class: 'hint hint-strong' }, t('zeroData'))),
      h('div', { class: 'toolbar toolbar--single' }, pauseBtn));
  };

  screens.receive = function () {
    var asm = QR.createAssembler();
    var status = h('p', { class: 'status', role: 'status', id: 'rx-status' });
    var dotsWrap = h('div', { class: 'dots-wrap' });
    var preview = h('div', { class: 'preview', id: 'rx-preview' });
    var video = h('video', { class: 'rx-video', playsinline: true, muted: true, 'aria-hidden': 'true' });
    video.muted = true;
    var camBox = h('div', { class: 'cam-frame', hidden: true }, video);
    var stream = null, scanTimer = null, detector = null, busy = false;
    var scanBtn = btn(t('scanQR'), { icon: 'camera', id: 'rx-scan', onclick: function () { if (stream) stopCam(); else startCam(); } });
    var fileInput = h('input', { type: 'file', id: 'rx-file', accept: '.json,application/json,.ekpack', class: 'sr-file', onchange: function () {
      var file = fileInput.files && fileInput.files[0]; if (!file) return;
      file.text().then(function (txt) { handleJSON(txt); });
    } });
    var fileLabel = h('label', { for: 'rx-file', class: 'btn btn-outline' }, icon('file'), h('span', null, t('openFile')));
    var paste = h('textarea', { id: 'rx-paste', class: 'field field-area', rows: '3', spellcheck: 'false', autocomplete: 'off' });
    var pasteBtn = btn(t('pasteBtn'), { kind: 'btn-outline btn-small', id: 'rx-paste-btn', onclick: function () {
      var v = paste.value.trim(); if (!v) return;
      if (v.charAt(0) === '{') { handleJSON(v); return; }
      var parts = QR.splitPasted(v);
      if (!parts.length) { status.textContent = t('notPack'); return; }
      parts.forEach(feed);
    } });

    function renderDots() {
      dotsWrap.replaceChildren();
      var n = asm.total(); if (!n) return;
      var ul = chunkDots(n, t('gotCodes', { r: asm.received(), n: n }));
      Array.prototype.forEach.call(ul.children, function (d, k) { if (asm.have(k + 1)) d.classList.add('cdot--seen'); });
      dotsWrap.appendChild(ul);
    }
    function feed(text) {
      var r = asm.add(text);
      if (!r.accepted) { if (r.reason === 'other-pack') status.textContent = t('otherPack'); return; }
      if (!r.duplicate) { status.textContent = t('gotCodes', { r: r.received, n: r.total }); renderDots(); }
      if (asm.complete()) { stopCam(); asm.finish().then(handleJSON).catch(function () { status.textContent = t('badPack'); asm.reset(); renderDots(); }); }
    }
    function handleJSON(txt) {
      var pack;
      try { pack = JSON.parse(txt); } catch (e) { status.textContent = t('notPack'); return; }
      var v = Store.validatePack(pack);
      if (!v.ok) { status.textContent = t('badPack'); return; }
      var f = Store.formatSize(v.bytes);
      preview.replaceChildren(h('section', { class: 'card preview-card', 'aria-labelledby': 'pv-h' },
        h('h2', { id: 'pv-h', class: 'kicker', tabindex: '-1' }, t('previewTitle')),
        h('p', { class: 'pv-size' }, t('previewSize', { kb: f.kb, mb: f.mb })),
        h('p', { class: 'meta' }, rich(t('previewInfo', { title: L(pack.title), n: pack.sentences.en.length, q: pack.quiz.length }))),
        h('div', { class: 'row' },
          btn(t('loadPack'), { id: 'rx-load', onclick: function () {
            store.importPack(pack);
            preview.replaceChildren(h('p', { class: 'success', tabindex: '-1', id: 'rx-done' }, icon('tick'), h('span', null, t('packLoaded', { title: L(pack.title) }))), btn(t('teacherTitle'), { href: '#/teacher', kind: 'btn-outline' }));
            document.getElementById('rx-done').focus();
          } }),
          btn(t('startAgain'), { kind: 'btn-outline', onclick: function () { asm.reset(); renderDots(); preview.replaceChildren(); status.textContent = ''; } }))));
      preview.querySelector('#pv-h').focus();
    }
    function startCam() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status.textContent = t('cameraOff'); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
        stream = s; video.srcObject = s; camBox.hidden = false; video.play().catch(function () {});
        scanBtn.querySelector('span:last-child').textContent = t('stopScan');
        status.textContent = t('scanning');
        var setup = ('BarcodeDetector' in window) ? window.BarcodeDetector.getSupportedFormats().then(function (f) { if (f.indexOf('qr_code') >= 0) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); }).catch(function () {}) : Promise.resolve();
        setup.then(function () { return detector ? null : loadScript('vendor/jsQR.min.js'); }).then(tick);
      }).catch(function () { status.textContent = t('cameraOff'); });
    }
    var work = document.createElement('canvas');
    function tick() {
      if (!stream) return;
      scanTimer = setTimeout(tick, 180);
      if (busy || video.readyState < 2) return;
      busy = true;
      var done = function () { busy = false; };
      if (detector) { detector.detect(video).then(function (codes) { codes.forEach(function (c) { feed(c.rawValue); }); }).catch(function () {}).then(done); return; }
      var w = video.videoWidth, hh = video.videoHeight; if (!w) { done(); return; }
      var sc = Math.min(1, 640 / Math.max(w, hh)); work.width = Math.round(w * sc); work.height = Math.round(hh * sc);
      var c = work.getContext('2d', { willReadFrequently: true }); c.drawImage(video, 0, 0, work.width, work.height);
      var img = c.getImageData(0, 0, work.width, work.height);
      var res = window.jsQR && window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (res && res.data) feed(res.data);
      done();
    }
    function stopCam() {
      clearTimeout(scanTimer);
      if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); });
      stream = null; camBox.hidden = true;
      var sp = scanBtn.querySelector('span:last-child'); if (sp) sp.textContent = t('scanQR');
    }
    cleanup.push(stopCam);
    return h('div', { class: 'screen screen-receive' },
      topbar(backBtn('/teacher'), langToggle()),
      h('main', { id: 'main', class: 'page' },
        underlined('h1', t('receiveTitle')),
        h('div', { class: 'stack' }, scanBtn, camBox, dotsWrap, status, fileInput, fileLabel),
        h('label', { for: 'rx-paste', class: 'label' }, t('pasteLabel')), paste, pasteBtn,
        preview));
  };

  /* ---------- router ---------- */
  function render(keepFocus) {
    cleanup.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); cleanup = [];
    var hash = (location.hash || '#/').slice(1);
    var parts = hash.split('/').filter(Boolean);
    var name = parts[0] || 'picker';
    var fn = screens[name] || screens.picker;
    if (name !== 'quiz') quizState = null;
    var node = fn(parts[1] ? decodeURIComponent(parts[1]) : undefined);
    if (!node) return;
    app.replaceChildren(node);
    var title = document.getElementById('screen-title');
    document.title = (title ? title.textContent.trim() + ' · ' : '') + t('appName');
    if (!firstRender && !keepFocus && title) title.focus({ preventScroll: false });
    if (!keepFocus) window.scrollTo(0, 0);
    firstRender = false;
  }

  window.addEventListener('popstate', function () { render(); });
  window.addEventListener('offline', function () { announce(t('offlineNow')); });
  document.documentElement.style.setProperty('--ts', settings.textSize || 1);
  applyLang();
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline install is best effort */ });
  }
  window.EkApp = { render: render, store: store };
})();
