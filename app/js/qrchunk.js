/* Ek Phone — split a lesson pack into a sequence of QR-sized text chunks and join them back.
   Chunk text: EK1|<flag>|<sum8>|<index>/<total>|<base64url data>
   flag z = deflate-raw compressed UTF-8 JSON, r = raw UTF-8 JSON. sum8 = FNV-1a of the full data string. */
(function (root) {
  'use strict';
  var PREFIX = 'EK1';
  var DEFAULT_CHUNK = 360; // base64 chars per QR: small enough for old phone cameras

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

  /** pack object or JSON string -> array of chunk strings */
  async function encode(pack, opts) {
    opts = opts || {};
    var size = opts.chunkSize || DEFAULT_CHUNK;
    var json = typeof pack === 'string' ? pack : JSON.stringify(pack);
    var bytes = new TextEncoder().encode(json);
    var flag = 'r';
    if (opts.compress !== false && canCompress()) {
      var z = await streamBytes(bytes, new CompressionStream('deflate-raw'));
      if (z.length < bytes.length) { bytes = z; flag = 'z'; }
    }
    var data = toB64url(bytes);
    var sum = fnv1a(data);
    var total = Math.max(1, Math.ceil(data.length / size));
    var chunks = [];
    for (var i = 0; i < total; i++) chunks.push([PREFIX, flag, sum, (i + 1) + '/' + total, data.slice(i * size, (i + 1) * size)].join('|'));
    return chunks;
  }

  /** parse one chunk string, or null if it is not an Ek Phone chunk */
  function parse(text) {
    if (typeof text !== 'string') return null;
    var parts = text.trim().split('|');
    if (parts.length !== 5 || parts[0] !== PREFIX) return null;
    var m = /^(\d{1,4})\/(\d{1,4})$/.exec(parts[3]);
    if (!m || (parts[1] !== 'z' && parts[1] !== 'r') || !/^[0-9a-f]{8}$/.test(parts[2]) || !/^[A-Za-z0-9_-]*$/.test(parts[4])) return null;
    var index = +m[1], total = +m[2];
    if (index < 1 || index > total) return null;
    return { flag: parts[1], sum: parts[2], index: index, total: total, data: parts[4] };
  }

  /** Collects chunks in any order, ignores repeats. */
  function createAssembler() {
    var state = { sum: null, flag: null, total: 0, parts: {} };
    return {
      add: function (text) {
        var c = parse(text);
        if (!c) return { accepted: false, reason: 'not-ekphone' };
        if (state.sum && c.sum !== state.sum) return { accepted: false, reason: 'other-pack' };
        if (!state.sum) { state.sum = c.sum; state.flag = c.flag; state.total = c.total; }
        var dup = !!state.parts[c.index];
        state.parts[c.index] = c.data;
        return { accepted: true, duplicate: dup, index: c.index, received: this.received(), total: state.total };
      },
      received: function () { return Object.keys(state.parts).length; },
      total: function () { return state.total; },
      have: function (i) { return !!state.parts[i]; },
      complete: function () { return state.total > 0 && this.received() === state.total; },
      reset: function () { state = { sum: null, flag: null, total: 0, parts: {} }; },
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

  /** Accept pasted text with one or many chunks (newline/space separated). */
  function splitPasted(text) { return String(text || '').split(/\s+/).filter(function (t) { return t.indexOf(PREFIX + '|') === 0; }); }

  var EkQR = { encode: encode, parse: parse, createAssembler: createAssembler, splitPasted: splitPasted, fnv1a: fnv1a, DEFAULT_CHUNK: DEFAULT_CHUNK };
  if (typeof module !== 'undefined' && module.exports) module.exports = EkQR; else root.EkQR = EkQR;
})(typeof self !== 'undefined' ? self : globalThis);
