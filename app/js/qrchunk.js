/* Ek Phone — split a lesson pack into a sequence of QR-sized chunks and join them back.
   Every chunk is a link the app opens, so a phone's normal camera app can scan it too:
     <app url>#/r/<packId>/<index>/<total>/<flag>.<sum8>.<base64url data>
   flag z = deflate-raw compressed UTF-8 JSON, r = raw UTF-8 JSON. sum8 = FNV-1a of the full data string.
   The older text form EK1|<flag>|<sum8>|<index>/<total>|<data> is still accepted. */
(function (root) {
  'use strict';
  var PREFIX = 'EK1';
  var MAX_QR_CHARS = 300;  // whole link per QR code: keeps codes small enough for old cameras
  var DEFAULT_CHUNK = 360; // data chars per code for the old text form (no link)

  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function toB64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str) {
    var b = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var bin = atob(b), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function streamBytes(bytes, stream) {
    var res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  function canCompress() { return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'; }

  /** pack object or JSON string -> array of chunk strings.
      opts.base (e.g. "https://ekphone-app.vercel.app/") -> link chunks; without it -> old EK1 text chunks. */
  async function encode(pack, opts) {
    opts = opts || {};
    var json = typeof pack === 'string' ? pack : JSON.stringify(pack);
    var id = (typeof pack === 'object' && pack && pack.id) || (function () { try { return JSON.parse(json).id; } catch (e) { return 'pack'; } })() || 'pack';
    var bytes = new TextEncoder().encode(json);
    var flag = 'r';
    if (opts.compress !== false && canCompress()) {
      var z = await streamBytes(bytes, new CompressionStream('deflate-raw'));
      if (z.length < bytes.length) { bytes = z; flag = 'z'; }
    }
    var data = toB64url(bytes);
    var sum = fnv1a(data);
    var chunks = [], i, total, size;
    if (opts.base) {
      var base = String(opts.base).replace(/#.*$/, '');
      var head = base + '#/r/' + id + '/000/000/' + flag + '.' + sum + '.'; // room for 3-digit index/total
      size = opts.chunkSize || Math.max(80, MAX_QR_CHARS - head.length);
      total = Math.max(1, Math.ceil(data.length / size));
      for (i = 0; i < total; i++) chunks.push(base + '#/r/' + id + '/' + (i + 1) + '/' + total + '/' + flag + '.' + sum + '.' + data.slice(i * size, (i + 1) * size));
      return chunks;
    }
    size = opts.chunkSize || DEFAULT_CHUNK;
    total = Math.max(1, Math.ceil(data.length / size));
    for (i = 0; i < total; i++) chunks.push([PREFIX, flag, sum, (i + 1) + '/' + total, data.slice(i * size, (i + 1) * size)].join('|'));
    return chunks;
  }

  /** parse one chunk (link or old text form), or null if it is not an Ek Phone chunk */
  function parse(text) {
    if (typeof text !== 'string') return null;
    text = text.trim();
    var c = null, m;
    if ((m = /#\/r\/([a-z0-9-]{3,40})\/(\d{1,4})\/(\d{1,4})\/([zr])\.([0-9a-f]{8})\.([A-Za-z0-9_-]*)$/.exec(text))) {
      c = { id: m[1], index: +m[2], total: +m[3], flag: m[4], sum: m[5], data: m[6] };
    } else {
      var parts = text.split('|');
      if (parts.length !== 5 || parts[0] !== PREFIX) return null;
      m = /^(\d{1,4})\/(\d{1,4})$/.exec(parts[3]);
      if (!m || (parts[1] !== 'z' && parts[1] !== 'r') || !/^[0-9a-f]{8}$/.test(parts[2]) || !/^[A-Za-z0-9_-]*$/.test(parts[4])) return null;
      c = { id: null, flag: parts[1], sum: parts[2], index: +m[1], total: +m[2], data: parts[4] };
    }
    if (c.index < 1 || c.index > c.total) return null;
    return c;
  }

  /** Collects chunks in any order, ignores repeats. State can be saved (toState) and restored (createAssembler(state)). */
  function createAssembler(saved) {
    var state = saved && saved.sum ? JSON.parse(JSON.stringify(saved)) : { id: null, sum: null, flag: null, total: 0, parts: {} };
    return {
      add: function (text) {
        var c = parse(text);
        if (!c) return { accepted: false, reason: 'not-ekphone' };
        if (state.sum && c.sum !== state.sum) return { accepted: false, reason: 'other-pack', chunk: c };
        if (!state.sum) { state.sum = c.sum; state.flag = c.flag; state.total = c.total; state.id = c.id; }
        if (c.id && !state.id) state.id = c.id;
        var dup = !!state.parts[c.index];
        state.parts[c.index] = c.data;
        return { accepted: true, duplicate: dup, index: c.index, received: this.received(), total: state.total, id: state.id };
      },
      received: function () { return Object.keys(state.parts).length; },
      total: function () { return state.total; },
      id: function () { return state.id; },
      have: function (i) { return !!state.parts[i]; },
      complete: function () { return state.total > 0 && this.received() === state.total; },
      reset: function () { state = { id: null, sum: null, flag: null, total: 0, parts: {} }; },
      toState: function () { return JSON.parse(JSON.stringify(state)); },
      /** -> JSON string. Throws on checksum mismatch. */
      finish: async function () {
        if (!this.complete()) throw new Error('incomplete');
        var data = '';
        for (var i = 1; i <= state.total; i++) data += state.parts[i];
        if (fnv1a(data) !== state.sum) throw new Error('checksum');
        var bytes = fromB64url(data);
        if (state.flag === 'z') {
          if (!canCompress()) throw new Error('no-decompress');
          bytes = await streamBytes(bytes, new DecompressionStream('deflate-raw'));
        }
        return new TextDecoder().decode(bytes);
      }
    };
  }

  /** Accept pasted text with one or many chunks (links or EK1 text, newline/space separated). */
  function splitPasted(text) { return String(text || '').split(/\s+/).filter(function (t) { return t.indexOf(PREFIX + '|') === 0 || /#\/r\//.test(t); }); }

  /** "my-day-and-night-ab12" -> "Day and night"; "g5-fractions" -> "G5 fractions" (shown before the real title is known) */
  function labelFromId(id) {
    var s = String(id || '').replace(/^my-/, '').replace(/-[a-z0-9]{4}$/, function (x) { return /\d/.test(x) ? '' : x; }).replace(/-/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Lesson';
  }

  var EkQR = { encode: encode, parse: parse, createAssembler: createAssembler, splitPasted: splitPasted, labelFromId: labelFromId, fnv1a: fnv1a, DEFAULT_CHUNK: DEFAULT_CHUNK, MAX_QR_CHARS: MAX_QR_CHARS };
  if (typeof module !== 'undefined' && module.exports) module.exports = EkQR; else root.EkQR = EkQR;
})(typeof self !== 'undefined' ? self : globalThis);
