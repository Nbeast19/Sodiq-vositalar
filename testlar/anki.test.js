// Anki mantiqi sinovlari: node testlar/anki.test.js
const assert = require('assert');
const A = require('../anki/anki.js');
const D = 'Arab tili::Nahv 1::1-bob::Lugat';
const qoida = { deckBosh: 'Arab tili', kurslar: ['Nahv 1', 'Sarf 1'], oxirlar: ['Lugat', 'Fellar'] };
const matn = '#separator:tab\r\n#deck column:1\r\n' +
  D + '\tك\u0650ت\u064Eاب\u064C\tkitob\tnahv\r\n' +
  D + '\tقلم\tqalam\r\n' +                       // 3 ustun
  D + '\t  باب  \tbob\tnahv dars\r\n' +           // bo'sh joy + teg
  'Boshqa::X::Y\tقلم\tqalam\t\r\n' +              // deck ogoh
  'Arab tili::Sarf 1::Fellar\tكتب\t\u200Byozdi\tx\r\n' +
  D + '\t\tbo\'sh\tx\r\n';
let n = A.tekshir(matn, { rejim: 'aniq', qoida });
assert(n.xatolar.some(s => s.startsWith('4-qator: 3 ta ustun bor, 4 ta kerak')), n.xatolar);
assert(n.xatolar.some(s => s.startsWith('8-qator: Front')));
assert.strictEqual(n.kartalar.length, 4);
assert.strictEqual(n.kartalar[1].front, 'باب');
assert(n.tuzatildi >= 1 && n.korinmas >= 7);
assert.strictEqual(n.ogoh.filter(s => s.startsWith('6-qator')).length, 3, 'boshi, kursi va oxiri xato');
assert(!n.ogoh.some(s => s.startsWith('7-qator')));
assert(n.eslatma.some(s => s.startsWith('5-qator')));
// Qoida bo'sh bo'lsa deck tekshirilmaydi (shaxsiy standart yo'q)
assert.strictEqual(A.tekshir(matn, { rejim: 'aniq' }).ogoh.length, 0);
assert.deepStrictEqual(A.standart().kurslar, []);
assert.strictEqual(A.standart().deckBosh, '');
// Harakatlarsiz solishtirish
const baza = [{ f: 'كتاب', d: 'Arab tili::Nahv 1::3-dars::Lugat', m: '3-dars.txt' }];
assert.strictEqual(A.tekshir(D + '\tك\u0650ت\u064Eاب\u064C\tkitob\tx', { rejim: 'aniq', baza }).takrorSoni, 0);
assert.strictEqual(A.tekshir(D + '\tك\u0650ت\u064Eاب\u064C\tkitob\tx', { rejim: 'harakatsiz', baza }).takrorSoni, 1);
assert.strictEqual(A.kalit('أ\u064Eح\u0652م\u064Eد', 'harakatsiz', true), 'احمد');
assert.strictEqual(A.kalit('مدرسة', 'harakatsiz', true), 'مدرسه');
assert.strictEqual(A.kalit('مدرسة', 'harakatsiz', false), 'مدرسة');
// Fayl ichidagi takror
n = A.tekshir(D + '\tقلم\ta\tx\n' + D + '\tقلم\tb\tx', { rejim: 'aniq' });
assert.strictEqual(n.takrorSoni, 1);
// Toza fayl: tab, 4 ustun, sarlavha, \r yo'q
const toza = A.tozaFayl(n, { 2: true }, true);
const q = toza.trim().split('\n');
assert.deepStrictEqual(q.slice(0, 4), A.SARLAVHA);
assert.strictEqual(q.length, 5);
assert.strictEqual(q[4].split('\t').length, 4);
assert(!/\r/.test(toza));
assert.strictEqual(A.faylNomi(D), 'Arab-tili_Nahv-1_1-bob.txt');
assert.strictEqual(A.faylNomi('Deck'), 'Deck.txt');
assert.strictEqual(A.faylNomi(''), 'anki-toza.txt');
// Bo'sh va noto'g'ri kirish qulamaydi
assert.strictEqual(A.tekshir('', {}).kartalar.length, 0);
assert.strictEqual(A.tekshir('shunchaki matn', {}).xatolar.length, 1);
// Eski formatdagi ma'lumot: qoidalar bazadan aniqlanadi, kurslar saqlanadi
const eski = { baza: [{ f: 'a', d: 'X 1::K::Lugat', m: 'f' }, { f: 'b', d: 'X 1::K::Zetel', m: 'f' }], kurslar: ['K'], rejim: 'aniq', alif: false };
const nor = A.normal(eski);
assert.strictEqual(nor.deckBosh, 'X 1');
assert.deepStrictEqual(nor.oxirlar.sort(), ['Lugat', 'Zetel']);
assert.deepStrictEqual(nor.kurslar, ['K']);
assert.strictEqual(nor.rejim, 'aniq');
assert.strictEqual(A.normal(nor).deckBosh, 'X 1', 'ikkinchi marta o\'zgarmaydi');
// Tezlik: 1000 qator
let katta = '';
for (let i = 0; i < 1000; i++) katta += D + '\tك\u064Eل\u0650م\u064Eة' + i + '\tso\'z ' + i + '\tteg\n';
const bazaKatta = []; for (let i = 0; i < 5000; i++) bazaKatta.push({ f: 'كلمة' + i, d: D, m: 'eski.txt' });
const t0 = Date.now();
n = A.tekshir(katta, { rejim: 'harakatsiz', alif: true, baza: bazaKatta, qoida });
A.tozaFayl(n, {}, true);
const vaqt = Date.now() - t0;
console.log('1000 qator + 5000 baza:', vaqt, 'ms');
assert.strictEqual(n.kartalar.length, 1000);
assert.strictEqual(n.takrorSoni, 1000);
assert(vaqt < 1000);
console.log('Anki: hamma sinovlar o\'tdi ✓');
