// Minimal xavfsiz ZIP o'quvchi (stored + deflate). Hech narsa bajarilmaydi, diskka ochilmaydi.
// Deflate uchun brauzerning DecompressionStream('deflate-raw') ishlatiladi.
(function (root) {
  'use strict';
  var LIMITS = { maxFiles: 20000, maxTotal: 2 * 1024 * 1024 * 1024, maxRatio: 200, ratioMin: 1024 * 1024 };

  function checkName(name) {
    if (!name || name.indexOf('\0') >= 0) throw new Error("bo'sh yoki noto'g'ri nom");
    if (name[0] === '/' || name[0] === '\\' || (name.length > 1 && name[1] === ':')) throw new Error('mutlaq yo\'l: ' + name);
    if (name.indexOf('\\') >= 0) throw new Error('teskari slesh: ' + name);
    if (name.split('/').indexOf('..') >= 0) throw new Error("'..' bilan tashqariga chiqish: " + name);
  }

  function readZip(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf);
    var eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP emas yoki buzilgan (EOCD topilmadi)');
    var count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    if (count > LIMITS.maxFiles) throw new Error("fayllar soni juda ko'p");
    var entries = [], p = cdOff, total = 0, seen = new Set();
    var dec = new TextDecoder('utf-8', { fatal: true });
    for (var k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('markaziy katalog buzilgan');
      var flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      var nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      var ext = dv.getUint32(p + 38, true), lho = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      checkName(name);
      if (seen.has(name)) throw new Error('takroriy nom: ' + name);
      seen.add(name);
      if (flags & 1) throw new Error("shifrlangan a'zo: " + name);
      if (((ext >>> 16) & 0xF000) === 0xA000) throw new Error('symlink taqiqlangan: ' + name);
      if (method !== 0 && method !== 8) throw new Error("qo'llanmaydigan siqish usuli: " + name);
      if (usize > LIMITS.ratioMin && csize > 0 && usize / csize > LIMITS.maxRatio) throw new Error('zip bomb shubhasi: ' + name);
      total += usize;
      if (total > LIMITS.maxTotal) throw new Error('ochilgan hajm chegaradan oshdi');
      if (name.slice(-1) === '/') continue;
      if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('lokal sarlavha buzilgan: ' + name);
      var start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      entries.push({ name: name, method: method, csize: csize, usize: usize, data: u8.subarray(start, start + csize) });
    }
    return entries;
  }

  async function inflate(entry) {
    if (entry.method === 0) return entry.data.slice();
    if (typeof DecompressionStream === 'undefined') throw new Error("brauzer DecompressionStream'ni qo'llamaydi — yangilang");
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([entry.data]).stream().pipeThrough(ds);
    var reader = stream.getReader(), chunks = [], got = 0;
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      got += r.value.length;
      if (got > entry.usize) { reader.cancel(); throw new Error("a'zo e'lon qilinganidan katta: " + entry.name); }
      chunks.push(r.value);
    }
    var out = new Uint8Array(got), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }

  async function readAll(buf) {
    var entries = readZip(buf), files = {};
    for (var i = 0; i < entries.length; i++) files[entries[i].name] = await inflate(entries[i]);
    return files;
  }

  var api = { readZip: readZip, readAll: readAll, checkName: checkName, LIMITS: LIMITS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Zip = api;
})(typeof self !== 'undefined' ? self : this);
