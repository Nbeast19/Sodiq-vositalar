const assert = require('assert');
module.exports = async (sahifa, ASOS) => {
  await sahifa.goto(ASOS + 'zettel/index.html');
  await sahifa.click('#namuna');
  await sahifa.waitForSelector('#nusxa');
  const t = await sahifa.innerText('#natija');
  assert(t.includes('9 ta karta tekshirildi'), t.slice(0, 200));
  assert(t.includes('ZK-AQ-003 yo\'q'));
  await sahifa.fill('#matn', '# ZK-AQ-001 A\nx [[ZK-AQ-002]]\n# ZK-AQ-002 B\ny [[ZK-AQ-001]]');
  await sahifa.click('#tekshir');
  assert((await sahifa.innerText('#natija')).includes('2 ta karta tekshirildi · 0 ta xato · 0 ta ogohlantirish'));
};
