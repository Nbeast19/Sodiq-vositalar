// Kutubxona mantiqi sinovlari: node testlar/kutubxona.test.js
const assert = require('assert');
const K = require('../kutubxona/kutubxona.js');
for (const u of ['https://youtu.be/abc', 'https://www.youtube.com/watch?v=abc&t=30', 'youtube.com/shorts/abc', 'https://m.youtube.com/watch?v=abc&list=PL1&si=xyz', 'https://www.youtube.com/watch?feature=share&v=abc'])
  assert.strictEqual(K.videoId(u), 'abc', u);
assert.strictEqual(K.soniya('12:34'), 754);
assert.strictEqual(K.soniya('1:02:33'), 3753);
assert.strictEqual(K.soniya('PT1H2M33S'), 3753);
assert.strictEqual(K.soniya('45 daqiqa'), 2700);
assert.strictEqual(K.davomiylik(3753), '1:02:33');
assert.strictEqual(K.davomiylik(754), '0:12:34');
for (const s of ['الدرس الثالث', 'الدرس ٣', 'الدرس 3', 'ح 3', 'الحلقة 3', '#3', 'شرح الأصول الثلاثة - الدرس الثالث']) assert.strictEqual(K.darsRaqami(s), 3, s);
assert.strictEqual(K.darsRaqami('الدرس الحادي عشر'), 11);
assert.strictEqual(K.darsRaqami('الدرس الثاني عشر'), 12);
assert.strictEqual(K.darsRaqami('الدرس العشرون'), 20);
assert.strictEqual(K.darsRaqami('المجلس الخامس والعشرون'), 25);
assert.strictEqual(K.darsRaqami('الدرس الأول'), 1);
assert.strictEqual(K.darsRaqami('الدرس الثلاثون'), 30);
assert.strictEqual(K.darsRaqami('مقدمة الكتاب'), null);
assert.strictEqual(K.darsRaqami('١٢'), 12);

const matn = [
  'الدرس الثالث\thttps://youtu.be/ccc\t45:00',
  'الدرس الأول\thttps://www.youtube.com/watch?v=aaa&t=30\t1:00:00',
  'الدرس الأول (نسخة)\thttps://youtu.be/aaa\t1:00:00',
  'مقطع قصير\thttps://youtu.be/ddd\t5:00',
  'سؤال عن الصلاة\thttps://youtu.be/eee\t20:00',
  'كليب\thttps://youtube.com/shorts/fff',
  'مقدمة\thttps://youtu.be/ggg',
  'الدرس ٢، "مهم"\thttps://youtu.be/bbb\tPT50M'
].join('\n');
const opt = { takror: true, qisqa: true, chegara: 10, shorts: true, savol: true, savolQoldir: false, sozlar: K.SOZLAR };
let n = K.ishla(matn, opt);
assert.deepStrictEqual(n.kirdi.map(x => x.id), ['aaa', 'bbb', 'ccc', 'ggg']);
assert(n.kirdi[3].belgilar.includes('raqam topilmadi'));
assert(n.kirdi[3].belgilar.includes('davomiylik yo\'q'));
const sabab = Object.fromEntries(n.chiqdi.map(x => [x.id, x.sabab]));
assert.strictEqual(sabab.aaa, 'takroriy havola');
assert.strictEqual(sabab.ddd, 'qisqa video');
assert.strictEqual(sabab.fff, 'shorts');
assert(sabab.eee.startsWith('savol-javob'));
// Qaytarish
const q = n.chiqdi.find(x => x.id === 'ddd').qkalit;
n = K.ishla(matn, Object.assign({}, opt, { qaytarilgan: { [q]: true } }));
assert(n.kirdi.some(x => x.id === 'ddd'));
// Savol-javoblarni qoldirish
assert(K.ishla(matn, Object.assign({}, opt, { savolQoldir: true })).kirdi.some(x => x.id === 'eee'));
// CSV
const csv = K.csv(K.ishla(matn, opt).kirdi, { ustoz: 'الشيخ فلان', kitob: 'كتاب, "التوحيد"', turi: 'Kitob sharhi', mavzu: 'Aqida' });
const q2 = csv.split('\r\n');
assert.strictEqual(q2[0], '"Nomi (arabcha)","Nomi (o\'zbekcha)","Ustoz","Kitob","Turi","Mavzu","Tartib","Havola","Davomiyligi","Eshitildi"');
assert.strictEqual(q2[1], '"الدرس الأول","","الشيخ فلان","كتاب, ""التوحيد""","Kitob sharhi","Aqida","1","https://www.youtube.com/watch?v=aaa","1:00:00","No"');
assert(q2[2].startsWith('"الدرس ٢، ""مهم"""'));
assert.strictEqual(K.faylNomi('الشيخ فلان', 'كتاب التوحيد'), 'الشيخ-فلان_كتاب-التوحيد_darslar.csv');
console.log('Kutubxona: hamma sinovlar o\'tdi ✓');
// Standart sozlamalar va eski ma'lumotni to'ldirish
assert.strictEqual(K.normal(null).ustoz, '');
assert.deepStrictEqual(K.normal({ ustoz: 'X' }).mavzular, K.MAVZULAR);
assert.strictEqual(K.normal({ ustoz: 'X' }).ustoz, 'X');
// Bo'sh va g'alati kirish qulamaydi
assert.deepStrictEqual(K.ishla('', opt), { kirdi: [], chiqdi: [] });
assert.strictEqual(K.ishla('salom\n\n   \nhttps://example.com/x', opt).kirdi.length, 2);
console.log('Kutubxona (qo\'shimcha): o\'tdi ✓');
