// Hifz mantiqi sinovlari: node testlar/hifz.test.js
const assert = require('assert');
require('../umumiy/yordamchi.js');
global.Mushaf = require('../hifz/mushaf.js');
const M = global.Mushaf;
const H = require('../hifz/hifz.js');

// Mushaf nazorat jadvali
const nazorat = { 1: 'Fotiha', 2: 'Baqara', 77: 'Niso', 293: 'Kahf', 396: 'Ankabut', 434: 'Fotir', 502: 'Ahqof', 507: 'Muhammad', 582: 'Naba', 604: 'Nos' };
for (const p in nazorat) assert(M.suraNomi(+p).split(', ').includes(nazorat[p]), p + ' -> ' + M.suraNomi(+p));
assert.strictEqual(M.SURALAR.length, 114);
for (let i = 1; i < 114; i++) assert(M.SURALAR[i].bosh >= M.SURALAR[i - 1].bosh);
assert.strictEqual(M.juz(434), 22);
assert.strictEqual(M.suraOxiri(18), 304);

// Standart holat: shaxsiy raqamlar yo'q
const st = H.standart('2026-10-22');
assert.deepStrictEqual(st.sozlama.bosqichlar, []);
assert.deepStrictEqual(st.oldin, []);
assert.deepStrictEqual(st.sozlama.ustozKunlari, []);
assert.strictEqual(st.sozlandi, false);

// Shablonlar
assert.deepStrictEqual(H.shablon('boshidan'), [{ dan: 1, gacha: 604 }]);
const ox = H.shablon('oxiridan');
assert.strictEqual(ox.length, 30);
assert.deepStrictEqual(ox[0], { dan: 582, gacha: 604 });
assert.deepStrictEqual(ox[29], { dan: 1, gacha: 21 });
assert.deepStrictEqual(H.shablon('ozim'), []);
let tekshirSah = {};
ox.forEach(b => { for (let p = b.dan; p <= b.gacha; p++) { assert(!tekshirSah[p]); tekshirSah[p] = 1; } });
assert.strictEqual(Object.keys(tekshirSah).length, 604, 'oxiridan: har sahifa bir marta');

// Kun boshlanishi 03:00 — 02:30 oldingi kunga; oy va yil almashishi
assert.strictEqual(H.kunKaliti(new Date(2026, 9, 23, 2, 30), '03:00'), '2026-10-22');
assert.strictEqual(H.kunKaliti(new Date(2026, 9, 23, 3, 1), '03:00'), '2026-10-23');
assert.strictEqual(H.kunKaliti(new Date(2027, 0, 1, 2, 59), '03:00'), '2026-12-31');
assert.strictEqual(H.kunKaliti(new Date(2026, 2, 1, 1, 0), '03:00'), '2026-02-28');
assert.strictEqual(H.kunQosh('2026-12-31', 1), '2027-01-01');
assert.strictEqual(H.kunQosh('2028-03-01', -1), '2028-02-29');
assert.strictEqual(H.farq('2026-12-30', '2027-01-02'), 3);

// Ishlash: 1-bosqich 434–506, oldin yodlangan qismlar bilan
function yangiHolat() {
  const s = H.standart('2026-10-22');
  s.sozlandi = true;
  s.sozlama.bosqichlar = [{ dan: 434, gacha: 506 }, { dan: 293, gacha: 395 }];
  s.oldin = [{ dan: 582, gacha: 604, holat: 'kuchli' }, { dan: 2, gacha: 76, holat: 'zaif' }];
  return s;
}
let s = yangiHolat();
const k1 = '2026-10-22', k2 = '2026-10-23';
let j = H.joriy(s, k1);
assert.strictEqual(j.p, 434);
H.ayirBir(s, k1); assert.strictEqual(H.joriy(s, k1).sanoq, 0, '−1 0 dan pastga tushmaydi');
for (let i = 0; i < 19; i++) H.qoshBir(s, k1);
H.ayirBir(s, k1); assert.strictEqual(H.joriy(s, k1).sanoq, 18);
H.qoshBir(s, k1); const nat = H.qoshBir(s, k1);
assert(nat && nat.tugadi.p === 434);
assert(s.yodlangan[434]);
assert.strictEqual(H.joriy(s, k1), null, 'bugun yangi sahifa qolmadi');
const s2 = JSON.parse(JSON.stringify(s)); H.yanaOlish(s2, k1); assert.strictEqual(H.joriy(s2, k1).p, 435);

// Murojaa
const r1 = H.kun(s, k1);
assert.strictEqual(r1.rev.length, 5);
assert.deepStrictEqual(r1.rev, [2, 3, 4, 5, 6], 'zaif va eng uzoq kutganlar, ketma-ket');
r1.rev.forEach(p => H.murojaaBelgila(s, k1, p, true));
assert.strictEqual(H.kunHolati(s, k1), 'toliq');
assert.deepStrictEqual(H.kun(s, k1).rev, r1.rev, 'kun davomida o\'zgarmaydi');
assert.strictEqual(H.joriy(s, k2).p, 435);
const r2 = H.kun(s, k2);
assert(r2.rev.includes(434), 'yangi yodlangan sahifa ertasi murojaaga tushadi');
assert(!r2.rev.some(p => r1.rev.includes(p)));
H.murojaaBelgila(s, k2, r2.rev[0], true); H.murojaaBelgila(s, k2, r2.rev[0], false);
assert.strictEqual(H.kun(s, k2).bajar.length, 0);
assert.strictEqual(s.oxirgiTakror[r2.rev[0]], undefined, 'bekor qilinsa oldingi holat qaytadi');
assert.strictEqual(H.kunHolati(s, k2), 'yoq');
assert.strictEqual(H.streak(s, k2), 1, 'bugun hali tugamagan — kecha hisoblanadi');
H.murojaaBelgila(s, k2, r2.rev[0], true);
assert.strictEqual(H.kunHolati(s, k2), 'qisman');

// Streak va rekord: oy/yil chegarasidan o'tadi
let z = yangiHolat();
['2026-12-30', '2026-12-31', '2027-01-01'].forEach(k => { z.kunlar[k] = { kv: 1, yangi: 1, rev: [2], bajar: [2] }; });
assert.strictEqual(H.streak(z, '2027-01-01'), 3);
assert.strictEqual(H.streak(z, '2027-01-02'), 3);
assert.strictEqual(H.streak(z, '2027-01-03'), 0);
z.kunlar['2026-12-20'] = { kv: 1, yangi: 1, rev: [], bajar: [] };
assert.strictEqual(H.rekord(z), 3);

// Guruhlash va zaif/qiyin vazni
assert.deepStrictEqual(H.guruhla([1, 2, 3, 7, 8]), [[1, 2, 3], [7, 8]]);
z = H.standart(k1); z.oldin = [{ dan: 10, gacha: 12, holat: 'kuchli' }, { dan: 20, gacha: 22, holat: 'zaif' }];
z.sozlama.murojaa = 3; z.oxirgiTakror = { 10: '2026-10-12', 11: '2026-10-12', 12: '2026-10-12', 20: '2026-10-16', 21: '2026-10-16', 22: '2026-10-16' };
assert.deepStrictEqual(H.murojaaTanla(z, k1), [20, 21, 22]);
z.sozlama.murojaaBirlik = 'juz'; z.sozlama.murojaa = 1; assert.strictEqual(H.murojaaSoni(z), 20);
// Bo'sh havza
assert.deepStrictEqual(H.murojaaTanla(H.standart(k1), k1), []);

// Yarim sahifa rejimi
let y = yangiHolat(); y.sozlama.kunlik = 0.5; y.sozlama.takror = 2;
assert.deepStrictEqual([H.joriy(y, k1).p, H.joriy(y, k1).q], [434, 1]);
H.qoshBir(y, k1); H.qoshBir(y, k1);
assert.deepStrictEqual([H.joriy(y, k2).p, H.joriy(y, k2).q], [434, 2]);

// Dam olish kuni
let d = yangiHolat(); d.sozlama.damKunlari = [H.haftaKuni(k1)];
assert.strictEqual(H.joriy(d, k1), null);
assert.strictEqual(H.bugunKutyapti(d, k1), false);
assert.strictEqual(H.bugunKutyapti(yangiHolat(), k1), true);
assert.strictEqual(H.bugunKutyapti(H.standart(k1), k1), false, 'sozlanmagan bo\'lsa eslatma yo\'q');

// Statistika
const stat = H.statistika(s, k2);
assert.strictEqual(stat.jami, 1); assert.strictEqual(stat.hammasi, 73 + 103);
assert(stat.tugash);

// Eski formatdagi (chala) ma'lumot to'ldiriladi
const eski = { sozlandi: true, sozlama: { bosqichlar: [{ dan: 1, gacha: 10 }], kunlik: 1, takror: 20, murojaa: 5, kunBoshi: '03:00' }, oldin: [], yodlangan: { 1: '2026-10-01' } };
const nor = H.normal(eski);
assert.deepStrictEqual(nor.sozlama.ustozKunlari, []);
assert.deepStrictEqual(nor.kunlar, {});
assert.strictEqual(nor.yodlangan[1], '2026-10-01');
assert.strictEqual(H.joriy(nor, k1).p, 2);
// Zaxira eslatmasi
assert.strictEqual(H.zaxiraEslatma({ yaratilgan: '2026-10-01', oxirgiZaxira: null }, k1), true);
assert.strictEqual(H.zaxiraEslatma({ yaratilgan: '2026-10-01', oxirgiZaxira: '2026-10-20' }, k1), false);
console.log('Hifz: hamma sinovlar o\'tdi ✓');
