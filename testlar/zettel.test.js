// Zettel mantiqi sinovlari: node testlar/zettel.test.js
const assert = require('assert');
const fs = require('fs');
const Z = require('../zettel/zettel.js');

let n = Z.tekshir([
  { nom: 'ZK-AQ-001.md', matn: '# ZK-AQ-001 Bir\nmatn [[ZK-AQ-005|nom]]' },
  { nom: 'ZK-AQ-002.md', matn: '# ZK-AQ-002 Ikki\nmatn [[ZK-AQ-005#bo\'lim]]' },
  { nom: 'ZK-AQ-004.md', matn: '# ZK-AQ-004 To\'rt\nmatn' },
  { nom: 'ZK-AQ-005.md', matn: '# ZK-AQ-005 Besh\nمتن عربي [[ZK-AQ-001 Bir]]' }
]);
assert.deepStrictEqual(n.x.yoq, ['ZK-AQ-003 yo\'q']);
assert.strictEqual(n.x.buzilgan.length, 0, '[[..|nom]] va [[..#bo\'lim]] taniladi');
assert.strictEqual(n.boglanish[0].id, 'ZK-AQ-005');
assert.strictEqual(n.boglanish[0].kir, 2);
assert.deepStrictEqual(n.x.yetim, ['ZK-AQ-004 — hech kim ishora qilmaydi, o\'zi ham hech kimga ishora qilmaydi']);

// Takror: ikkala fayl nomi
n = Z.tekshir([{ nom: 'a.md', matn: '# ZK-AQ-022 A\nx' }, { nom: 'b.md', matn: '# ZK-AQ-022 B\ny' }]);
assert(n.x.takror[0].includes('a.md') && n.x.takror[0].includes('b.md'));

// Format xatolari
for (const xom of ['ZK-AQ-14', 'zk-aq-014', 'ZK–AQ–014']) {
  const r = Z.raqamTop(xom);
  assert.strictEqual(r.id, xom === 'ZK-AQ-14' ? 'ZK-AQ-014' : 'ZK-AQ-014');
  assert.strictEqual(r.togri, false, xom);
}
assert.strictEqual(Z.raqamTop('ZK-AQ-014').togri, true);
// Raqam manbasi tartibi: fayl nomi -> id: -> sarlavha
assert.strictEqual(Z.kartaOqi('xat.md', '---\nid: ZK-HD-010\n---\n# ZK-HD-011 S\nm').id, 'ZK-HD-010');
// Kitoblar alohida
n = Z.tekshir([{ nom: 'ZK-AQ-001.md', matn: '# S\nm' }, { nom: 'ZK-HD-003.md', matn: '# S\nm' }]);
assert.strictEqual(n.x.yoq.length, 0);
// Joylashtirilgan matnni bo'lish
assert.strictEqual(Z.matnniBol('# ZK-AQ-001 A\nx\n# ZK-AQ-002 B\ny').length, 2);
assert.strictEqual(Z.matnniBol('ZK-AQ-001 A\nx\n---\nZK-AQ-002 B\ny').length, 2);
// Arabcha matn buzilmaydi
const k = Z.kartaOqi('ZK-AQ-009.md', '# ZK-AQ-009 قال شيخ الإسلام\nنص');
assert.strictEqual(k.sarlavha, 'قال شيخ الإسلام');
// Namuna
const f = fs.readdirSync(__dirname + '/../zettel/namuna').map(nom => ({ nom, matn: fs.readFileSync(__dirname + '/../zettel/namuna/' + nom, 'utf8') }));
n = Z.tekshir(f);
assert(f.length >= 8 && n.xato > 0 && n.ogoh > 0);
console.log('Zettel: hamma sinovlar o\'tdi ✓');
