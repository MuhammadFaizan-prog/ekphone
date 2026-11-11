/* Ek Phone — turn a lesson pack into one plain HTML page (no JavaScript, inline CSS).
   Used by "Save as page" in the app and by tools/build.mjs for app/lessons/*.html. Works with JS off and prints cleanly. */
(function (root) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CSS = 'body{margin:0;background:#F6F1E7;color:#1B1A17;font:18px/1.6 "Atkinson Hyperlegible",system-ui,sans-serif}' +
    'main{max-width:65ch;margin:0 auto;padding:20px 18px 40px}h1,h2{font-family:Literata,Georgia,serif;line-height:1.2}h1{font-size:1.7em;margin:.4em 0}' +
    'h2{font-size:1.25em;margin:1.6em 0 .4em;border-bottom:2px solid #1B1A17;padding-bottom:4px}.kicker{color:#8E2E17;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.75em;margin:0}' +
    'ol.s li{margin:.35em 0}.q{margin:1em 0 .2em;font-weight:700}ul.o{list-style:none;padding:0;margin:0}ul.o li{margin:.25em 0;padding:.3em .6em;border:1.5px solid #1B1A17;border-radius:8px;background:#FBF7EF}' +
    'ul.o li::before{content:"\\25CB  "}details{margin-top:1.4em;border:2px dashed #B23A1E;border-radius:10px;padding:.6em .9em}summary{font-weight:700;cursor:pointer}' +
    '[lang=ur]{font-family:"Noto Nastaliq Urdu","Noto Naskh Arabic",serif;line-height:2.1}.ltr{direction:ltr;unicode-bidi:isolate}footer{margin-top:2em;font-size:.8em;color:#4A4740}' +
    'a{color:#8E2E17}:focus-visible{outline:3px solid #1B1A17;outline-offset:3px}' +
    '@media print{body{background:#fff;font-size:12pt}main{max-width:none;padding:0}details{border-color:#000}details>*{display:block}a{color:#000}h2{break-after:avoid}ul.o li{background:none}.no-print{display:none}}';

  function section(p, lang) {
    var ur = lang === 'ur';
    var title = ur ? p.title.ur : p.title.en;
    var sents = ur ? p.sentences.ur : p.sentences.en;
    var h = '<section lang="' + lang + '" dir="' + (ur ? 'rtl' : 'ltr') + '">';
    if (p.subject) h += '<p class="kicker">' + esc(ur ? (p.subject.ur || p.subject.en) : p.subject.en) + '</p>';
    h += (ur ? '<h2>' : '<h1>') + esc(title) + (ur ? '</h2>' : '</h1>');
    h += '<ol class="s">' + sents.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    h += '<h2>' + (ur ? 'مشق کے سوال' : 'Practice questions') + '</h2><ol>';
    p.quiz.forEach(function (q) {
      var opts = (ur && q.options.ur) ? q.options.ur : q.options.en;
      h += '<li><p class="q">' + esc(ur && q.q.ur ? q.q.ur : q.q.en) + '</p><ul class="o">' + opts.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul></li>';
    });
    h += '</ol><details><summary>' + (ur ? 'جوابات دیکھیں' : 'Show answers') + '</summary><ol>';
    p.quiz.forEach(function (q) { var opts = (ur && q.options.ur) ? q.options.ur : q.options.en; h += '<li>' + esc(opts[q.answer]) + '</li>'; });
    return h + '</ol></details></section>';
  }

  /** opts.home: link back to the app (only for pages served next to it). */
  function packToHtml(p, opts) {
    opts = opts || {};
    var hasUr = !!(p.title.ur && p.sentences.ur && p.sentences.ur.length === p.sentences.en.length);
    return '<!doctype html>\n<html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">' +
      '<title>' + esc(p.title.en) + ' · Ek Phone lesson</title><style>' + CSS + '</style></head><body><main>' +
      section(p, 'en') + (hasUr ? '<hr>' + section(p, 'ur') : '') +
      '<footer><p>Ek Phone lesson page. Plain HTML: no JavaScript, no internet needed. ' + esc(p.license || '') + '</p>' +
      (opts.home ? '<p class="no-print"><a href="' + esc(opts.home) + '">Open Ek Phone</a></p>' : '') + '</footer></main></body></html>\n';
  }
  var EkExport = { packToHtml: packToHtml, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = EkExport; else root.EkExport = EkExport;
})(typeof self !== 'undefined' ? self : globalThis);
