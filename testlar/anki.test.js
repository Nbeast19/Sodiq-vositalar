// Anki mantiqi sinovlari: node testlar/anki.test.js
const assert = require('assert');
const A = require('../anki/anki.js');
const D = 'najron 6::النحو ٤::الباب الأول::Lugat';
const matn = '#separator:tab\r\n#deck column:1\r\n' +
  D + '\tكِتَابٌ\tkitob\tnahv\r\n' +
  D + '\tقلم\tqalam\r\n' +                       // 3 ustun
  D + '\t  باب  \tbob\tnahv dars\r\n' +           // bo'sh joy + teg
  'najron 5::X::Y\tقلم\tqalam\t\r\n' +              // deck ogoh
  D + '::Fellar\tكتب\t​yozdi\tx\r\n' +
  D + '\t\tbo\'sh\tx\r\n';
let n = A.tekshir(matn, { rejim: 'aniq' });
assert(n.xatolar.includes('4-qator: 3 ta ustun bor, 4 ta kerak'), n.xatolar);
assert(n.xatolar.some(s => s.startsWith('8-qator: Front bo\'sh')));
assert.strictEqual(n.kartalar.length, 4);
assert.strictEqual(n.kartalar[1].front, 'باب');
assert(n.tuzatildi >= 1 && n.korinmas >= 7);
assert(n.ogoh.some(s => s.startsWith('6-qator')));
assert(!n.ogoh.some(s => s.startsWith('7-qator')), 'Lugat::Fellar ruxsat');
assert(n.eslatma.some(s => s.startsWith('5-qator')));
// Harakatlarsiz solishtirish
const baza = [{ f: 'كتاب', d: 'najron 6::النحو ٤::3-dars::Lugat', m: '3-dars.txt' }];
assert.strictEqual(A.tekshir(D + '\tكِتَابٌ\tkitob\tx', { rejim: 'aniq', baza }).takrorSoni, 0);
assert.strictEqual(A.tekshir(D + '\tكِتَابٌ\tkitob\tx', { rejim: 'harakatsiz', baza }).takrorSoni, 1);
assert.strictEqual(A.kalit('أَحْمَد', 'harakatsiz', true), 'احمد');
assert.strictEqual(A.kalit('مدرسة', 'harakatsiz', true), 'مدرسه');
// Fayl ichidagi takror
n = A.tekshir(D + '\tقلم\ta\tx\n' + D + '\tقلم\tb\tx', { rejim: 'aniq' });
assert.strictEqual(n.takrorSoni, 1);
// Toza fayl: tab, 4 ustun, sarlavha
const toza = A.tozaFayl(n, { 2: true }, true);
const q = toza.trim().split('\n');
assert.deepStrictEqual(q.slice(0, 4), A.SARLAVHA);
assert.strictEqual(q.length, 5);
assert.strictEqual(q[4].split('\t').length, 4);
assert(!/\r/.test(toza));
assert.strictEqual(A.faylNomi(D), 'najron6_النحو٤_الباب-الأول.txt');
console.log('Anki: hamma sinovlar o\'tdi ✓');
