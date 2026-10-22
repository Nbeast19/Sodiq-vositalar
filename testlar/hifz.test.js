// Hifz mantiqi sinovlari: node testlar/hifz.test.js
const assert = require('assert');
const M = require('../hifz/mushaf.js');
global.Mushaf = M;
const H = require('../hifz/hifz.js');

// Nazorat jadvali
const nazorat = { 1: 'Fotiha', 2: 'Baqara', 77: 'Niso', 293: 'Kahf', 396: 'Ankabut', 434: 'Fotir', 502: 'Ahqof', 507: 'Muhammad', 582: 'Naba', 604: 'Nos' };
for (const p in nazorat) assert(M.suraNomi(+p).split(', ').includes(nazorat[p]), p + ' -> ' + M.suraNomi(+p));
assert.strictEqual(M.SURALAR.length, 114);
for (let i = 1; i < 114; i++) assert(M.SURALAR[i].bosh >= M.SURALAR[i - 1].bosh);
assert.strictEqual(M.juz(434), 22);

// Kun boshlanishi 03:00 — 02:30 oldingi kunga
assert.strictEqual(H.kunKaliti(new Date(2026, 9, 23, 2, 30), '03:00'), '2026-10-22');
assert.strictEqual(H.kunKaliti(new Date(2026, 9, 23, 3, 1), '03:00'), '2026-10-23');

// Sozlash standart qiymatlari
let s = H.standart('2026-10-22'); s.sozlandi = true;
assert.deepStrictEqual(s.sozlama.bosqichlar[0], { dan: 434, gacha: 506 });
assert.strictEqual(s.oldin.length, 4);
const k1 = '2026-10-22', k2 = '2026-10-23';

// Bugungi sahifa 434
let j = H.joriy(s, k1);
assert.strictEqual(j.p, 434);
// −1 0 dan pastga tushmaydi
H.ayirBir(s, k1); assert.strictEqual(H.joriy(s, k1).sanoq, 0);
for (let i = 0; i < 19; i++) H.qoshBir(s, k1);
assert.strictEqual(H.joriy(s, k1).sanoq, 19);
H.ayirBir(s, k1); assert.strictEqual(H.joriy(s, k1).sanoq, 18);
H.qoshBir(s, k1); const nat = H.qoshBir(s, k1);
assert(nat && nat.tugadi.p === 434);
assert(s.yodlangan[434]);
assert.strictEqual(H.joriy(s, k1), null, 'bugun yangi sahifa qolmadi');
// Yana bir sahifa olish
const s2 = JSON.parse(JSON.stringify(s)); H.yanaOlish(s2, k1); assert.strictEqual(H.joriy(s2, k1).p, 435);

// Murojaa: 5 ta sahifa, ketma-ket
const r1 = H.kun(s, k1);
assert.strictEqual(r1.rev.length, 5);
console.log('1-kun murojaa:', r1.rev.join(','));
r1.rev.forEach(p => H.murojaaBelgila(s, k1, p, true));
assert.strictEqual(H.kunHolati(s, k1), 'toliq');
// Ro'yxat kun davomida o'zgarmaydi (saqlangan)
assert.deepStrictEqual(H.kun(s, k1).rev, r1.rev);
// Ertaga 435
assert.strictEqual(H.joriy(s, k2).p, 435);
const r2 = H.kun(s, k2);
console.log('2-kun murojaa:', r2.rev.join(','));
assert(r2.rev.includes(434), 'yangi yodlangan sahifa ertasi murojaaga tushadi');
assert(!r2.rev.some(p => r1.rev.includes(p)), 'kecha takrorlanganlar qaytmaydi');
// Belgini bekor qilish
H.murojaaBelgila(s, k2, r2.rev[0], true); H.murojaaBelgila(s, k2, r2.rev[0], false);
assert.strictEqual(H.kun(s, k2).bajar.length, 0);
assert.strictEqual(H.kunHolati(s, k2), 'yoq');
assert.strictEqual(H.streak(s, k2), 1);
H.murojaaBelgila(s, k2, r2.rev[0], true);
assert.strictEqual(H.kunHolati(s, k2), 'qisman');

// Guruhlash
assert.deepStrictEqual(H.guruhla([1, 2, 3, 7, 8]), [[1, 2, 3], [7, 8]]);
// Zaif sahifalar ikki baravar tez chiqadi: hammasi bir xil eski bo'lsa, zaif birinchi
let z = H.standart(k1); z.oldin = [{ dan: 10, gacha: 12, holat: 'kuchli' }, { dan: 20, gacha: 22, holat: 'zaif' }];
z.sozlama.murojaa = 3; z.oxirgiTakror = { 10: '2026-10-12', 11: '2026-10-12', 12: '2026-10-12', 20: '2026-10-16', 21: '2026-10-16', 22: '2026-10-16' };
assert.deepStrictEqual(H.murojaaTanla(z, k1), [20, 21, 22]); // 6 kun*2=12 > 10 kun
// Juz birligi
z.sozlama.murojaaBirlik = 'juz'; z.sozlama.murojaa = 1; assert.strictEqual(H.murojaaSoni(z), 20);

// Yarim sahifa rejimi
let y = H.standart(k1); y.sozlandi = true; y.sozlama.kunlik = 0.5; y.sozlama.takror = 2;
assert.deepStrictEqual([H.joriy(y, k1).p, H.joriy(y, k1).q], [434, 1]);
H.qoshBir(y, k1); H.qoshBir(y, k1);
assert.deepStrictEqual([H.joriy(y, k2).p, H.joriy(y, k2).q], [434, 2]);

// Dam olish kuni
let d = H.standart(k1); d.sozlandi = true; d.sozlama.damKunlari = [H.haftaKuni(k1)];
assert.strictEqual(H.joriy(d, k1), null);
assert.strictEqual(H.bugunKutyapti(d, k1), false);

// Statistika
const st = H.statistika(s, k2);
assert.strictEqual(st.jami, 1); assert.strictEqual(st.hammasi, 73 + 103 + 216);
assert(st.tugash);
// Zaxira eslatmasi
assert.strictEqual(H.zaxiraEslatma({ yaratilgan: '2026-10-01', oxirgiZaxira: null }, k1), true);
assert.strictEqual(H.zaxiraEslatma({ yaratilgan: '2026-10-01', oxirgiZaxira: '2026-10-20' }, k1), false);
console.log('Hifz: hamma sinovlar o\'tdi ✓');
