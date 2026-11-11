/* Ek Phone — hand-drawn ink illustrations (decorative, aria-hidden). Our own constant markup, never pack text. */
(function (root) {
  'use strict';
  var INK = 'currentColor';
  var s = 'fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  var thin = 'fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  function svg(vb, body) { return '<svg class="art" viewBox="' + vb + '" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>'; }
  function spots(list) { return list.map(function (p) { return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + p[2] + '" ry="' + (p[2] * 0.7) + '" ' + thin + '/>'; }).join(''); }
  var ART = {
    roti: svg('0 0 200 124',
      '<g fill="var(--roti)" ' + s.replace('fill="none" ', '') + '>' +
      '<path d="M95 57 L95 13 A78 44 0 0 0 17 57 Z"/>' +
      '<path d="M105 57 L183 57 A78 44 0 0 0 105 13 Z"/>' +
      '<path d="M95 65 L17 65 A78 44 0 0 0 95 109 Z"/>' +
      '<path d="M105 65 L105 109 A78 44 0 0 0 183 65 Z"/></g>' +
      spots([[60, 38, 4], [75, 28, 3], [45, 50, 2.5], [130, 30, 3.5], [150, 44, 3], [120, 46, 2.2], [55, 82, 3.5], [78, 94, 2.6], [40, 72, 2], [135, 86, 3.4], [155, 76, 2.4], [118, 98, 2.8]])),
    cloud: svg('0 0 200 124',
      '<circle cx="34" cy="28" r="13" ' + s + '/>' +
      '<path d="M34 6v-2M34 52v2M12 28h-2M58 28h2M18 12l-2-2M50 44l2 2M50 12l2-2M18 44l-2 2" ' + s + '/>' +
      '<path d="M92 50 C 80 50, 76 36, 88 32 C 88 18, 106 14, 112 24 C 118 14, 140 16, 140 32 C 154 32, 156 50, 142 50 Z" fill="var(--paper-2)" ' + s.replace('fill="none" ', '') + '/>' +
      '<path d="M100 60 l-4 10 M116 60 l-4 10 M132 60 l-4 10 M108 76 l-4 10 M124 76 l-4 10" ' + s + '/>' +
      '<path d="M10 110 C 30 102, 40 118, 60 110 S 90 102, 110 110 S 150 118, 170 110 S 190 104, 196 108" ' + s + '/>' +
      '<path d="M40 100 C 40 84, 46 74, 58 66" ' + thin + ' stroke-dasharray="4 5"/><path d="M54 64 l5 1 -1 5" ' + thin + '/>' +
      '<path d="M170 60 C 176 76, 176 90, 168 102" ' + thin + ' stroke-dasharray="4 5"/><path d="M164 99 l4 4 4 -4" ' + thin + '/>'),
    blocks: svg('0 0 200 124',
      '<g ' + s + '><rect x="8" y="40" width="54" height="34" rx="5" transform="rotate(-2 35 57)"/><rect x="72" y="40" width="54" height="34" rx="5" transform="rotate(1.5 99 57)"/><rect x="136" y="40" width="58" height="34" rx="5" transform="rotate(-1 165 57)"/></g>' +
      '<g fill="' + INK + '" font-family="Literata, serif" font-size="15" text-anchor="middle"><text x="35" y="62">Sara</text><text x="99" y="62">reads</text><text x="165" y="62">a book</text>' +
      '<text x="35" y="98" font-size="13">S</text><text x="99" y="98" font-size="13">V</text><text x="165" y="98" font-size="13">O</text></g>' +
      '<path d="M26 84 C 30 88, 40 88, 44 84 M90 84 C 94 88, 104 88, 108 84 M156 84 C 160 88, 170 88, 174 84" ' + thin + '/>' +
      '<path d="M18 26 C 60 18, 140 18, 186 26" ' + thin + ' stroke-dasharray="3 5"/><path d="M180 22 l6 4 -6 4" ' + thin + '/>'),
    leaf: svg('0 0 200 124',
      '<path d="M100 92 C 100 70, 98 50, 100 26" ' + s + '/>' +
      '<path d="M100 60 C 82 46, 66 50, 58 58 C 72 66, 88 66, 100 60 Z M100 48 C 116 34, 134 36, 142 44 C 128 54, 112 54, 100 48 Z" fill="var(--leaf)" ' + s.replace('fill="none" ', '') + '/>' +
      '<circle cx="100" cy="20" r="7" fill="var(--hl)" ' + s.replace('fill="none" ', '') + '/>' +
      '<path d="M100 13 c-3 -6 3 -6 0 0 M107 20 c6 -3 6 3 0 0 M93 20 c-6 -3 -6 3 0 0 M100 27 c3 6 -3 6 0 0" ' + thin + '/>' +
      '<path d="M40 94 C 70 90, 130 90, 160 94" ' + s + '/>' +
      '<path d="M100 94 C 96 104, 86 108, 78 116 M100 94 C 104 106, 114 110, 124 116 M100 94 L100 118" ' + thin + '/>'),
    book: svg('0 0 200 124',
      '<path d="M100 28 C 80 18, 50 18, 28 24 L28 100 C 50 94, 80 94, 100 104 C 120 94, 150 94, 172 100 L172 24 C 150 18, 120 18, 100 28 Z" fill="var(--paper-2)" ' + s.replace('fill="none" ', '') + '/>' +
      '<path d="M100 28 L100 104" ' + s + '/><path d="M42 42 h40 M42 54 h36 M42 66 h40 M118 42 h40 M118 54 h34 M118 66 h40" ' + thin + '/>')
  };
  var UNDERLINE = '<svg class="ul" viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 9 C 40 4, 78 12, 120 7 S 196 4, 237 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M60 11 C 100 8, 150 12, 200 9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".5"/></svg>';
  var ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic flip"><path d="M20 12H5M11 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic flip"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic flip"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/></svg>',
    dots: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M4 13l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    qr: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ic"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  root.EkArt = { ART: ART, UNDERLINE: UNDERLINE, ICON: ICON };
})(typeof self !== 'undefined' ? self : globalThis);
