// Node: JS normalizatsiyasi Python bilan bir xilmi; ZIP o'quvchi va paket tekshiruvi ishlaydimi.
// Ishga tushirish: node tests/web/core.node.test.js  (avval python scripts/build_demo.py)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
globalThis.Arabic = require(path.join(ROOT, 'web/js/arabic.js'));
globalThis.Zip = require(path.join(ROOT, 'web/js/zip.js'));
const Pkg = require(path.join(ROOT, 'web/js/pkg.js'));

let n = 0;
function ok(name) { n++; console.log('  ✓ ' + name); }

(async () => {
  const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/arabic_vectors.json'), 'utf8'));
  assert.strictEqual(Arabic.VERSION, V.normalization_version);
  for (const v of V.vectors) {
    const r = Arabic.normalizeWithMap(v.input);
    assert.strictEqual(r.norm, v.normalized, v.input);
    assert.deepStrictEqual(r.map, v.map, v.input);
  }
  ok('normalizatsiya vektorlari Python bilan aynan mos (' + V.vectors.length + ')');
  for (const s of V.snippets) {
    const m = Arabic.normalizeWithMap(s.text).map;
    assert.deepStrictEqual(Arabic.snippet(s.text, s.norm_start, s.norm_len, m, s.window), s.expected);
  }
  ok('parcha (snippet) Python bilan aynan mos');

  const buf = fs.readFileSync(path.join(ROOT, 'web/paketlar/namuna-asos-a-1.0.0.hmz'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const pkg = await Pkg.open(ab);
  assert.strictEqual(pkg.manifest.package_id, 'namuna-asos-a');
  assert.strictEqual(pkg.units.length, 12);
  ok('deflate .hmz ochildi va SHA256 tekshirildi');

  const bad = Buffer.from(buf);
  // markaziy katalogdagi birinchi nomni '../' ga buzamiz
  const cd = bad.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bad.write('../', cd + 46, 'latin1');
  await assert.rejects(() => Pkg.open(bad.buffer.slice(bad.byteOffset, bad.byteOffset + bad.byteLength)), /tashqariga|lokal|buzilgan|nom/);
  ok("'..' yo'lli ZIP rad etildi");

  const tampered = Buffer.from(buf);
  tampered[Math.floor(tampered.length / 3)] ^= 0xff;  // siqilgan ma'lumot ichida
  await assert.rejects(() => Pkg.open(tampered.buffer.slice(tampered.byteOffset, tampered.byteOffset + tampered.byteLength)));
  ok("buzilgan bayt rad etildi");

  const sel = fs.readFileSync(path.join(ROOT, 'dist/namuna-kitob-va-sharhlar-1.0.0.hmz'));
  const sp = await Pkg.open(sel.buffer.slice(sel.byteOffset, sel.byteOffset + sel.byteLength));
  assert.strictEqual(sp.manifest.kind, 'selection');
  assert.strictEqual(sp.manifest.contains.length, 3);
  ok("yig'ma (selection) ochildi: ichki paketlar ro'yxati saqlangan");
  console.log(n + ' ta tekshiruv o\'tdi');
})().catch(e => { console.error(e); process.exit(1); });
