// Arabcha qidiruv normalizatsiyasi — src/hadis_manba/arabic.py bilan AYNAN bir xil (ar-search-v1).
// Ikkalasi tests/arabic_vectors.json bo'yicha sinaladi. Asl matn o'zgartirilmaydi.
(function (root) {
  'use strict';
  var VERSION = 'ar-search-v1';
  var REMOVE = new Set();
  function range(a, b) { for (var i = a; i < b; i++) REMOVE.add(i); }
  range(0x0610, 0x061B); range(0x064B, 0x0660); REMOVE.add(0x0670);
  range(0x06D6, 0x06DD); range(0x06DF, 0x06E5); range(0x06E7, 0x06E9); range(0x06EA, 0x06EE);
  REMOVE.add(0x0640);
  [0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x061C, 0xFEFF].forEach(function (c) { REMOVE.add(c); });
  var MAP = {
    0x0622: 'ا', 0x0623: 'ا', 0x0625: 'ا', 0x0671: 'ا', 0x0672: 'ا', 0x0673: 'ا',
    0x0649: 'ي', 0x0629: 'ه', 0x0624: 'و', 0x0626: 'ي', 0x06CC: 'ي', 0x06A9: 'ك'
  };
  var WS = new Set([0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
    0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000]);

  // Kod nuqtalari bo'yicha (Python str indekslari bilan mos).
  function normalizeWithMap(text) {
    var chars = Array.from(text);
    var out = [], pos = [], prevSpace = true;
    for (var i = 0; i < chars.length; i++) {
      var cp = chars[i].codePointAt(0);
      if (REMOVE.has(cp)) continue;
      if (WS.has(cp)) {
        if (!prevSpace) { out.push(' '); pos.push(i); prevSpace = true; }
        continue;
      }
      var ch = chars[i];
      if (cp >= 0x41 && cp <= 0x5A) ch = String.fromCodePoint(cp + 32);
      out.push(MAP[cp] || ch);
      pos.push(i);
      prevSpace = false;
    }
    if (out.length && out[out.length - 1] === ' ') { out.pop(); pos.pop(); }
    return { norm: out.join(''), map: pos };
  }
  function normalize(text) { return normalizeWithMap(text).norm; }

  // Natija parchasi asl matndan (harakatlar bilan) olinadi. Indekslar kod nuqtalarida.
  function snippet(original, normStart, normLen, map, windowSize) {
    var w = windowSize == null ? 80 : windowSize;
    var chars = Array.from(original);
    if (!map.length || normLen <= 0) {
      return { text: chars.slice(0, w * 2).join(''), match_start: null, match_end: null, truncated: chars.length > w * 2 };
    }
    var oStart = map[normStart];
    var oEnd = map[Math.min(normStart + normLen, map.length) - 1] + 1;
    while (oEnd < chars.length && REMOVE.has(chars[oEnd].codePointAt(0))) oEnd++;
    var a = Math.max(0, oStart - w), b = Math.min(chars.length, oEnd + w);
    while (a > 0 && !WS.has(chars[a - 1].codePointAt(0))) a--;
    while (b < chars.length && !WS.has(chars[b].codePointAt(0))) b++;
    return { text: chars.slice(a, b).join(''), match_start: oStart - a, match_end: oEnd - a,
      truncated: a > 0 || b < chars.length, original_offset: a };
  }

  // Normalizatsiyalangan matnda (kod nuqtalari bo'yicha) barcha uchrashuvlar.
  function allPositions(hayChars, needleChars, cap) {
    var out = [], n = needleChars.length;
    outer: for (var i = 0; i + n <= hayChars.length && out.length < (cap || 50); i++) {
      for (var j = 0; j < n; j++) if (hayChars[i + j] !== needleChars[j]) continue outer;
      out.push(i);
    }
    return out;
  }

  var api = { VERSION: VERSION, normalize: normalize, normalizeWithMap: normalizeWithMap, snippet: snippet,
    allPositions: allPositions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Arabic = api;
})(typeof self !== 'undefined' ? self : this);
