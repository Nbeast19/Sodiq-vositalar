const assert = require('assert');
const fs = require('fs');
module.exports = async (sahifa, ASOS) => {
  await sahifa.goto(ASOS + 'anki/index.html');
  const D = 'Arab tili::Nahv 1::1-bob::Lugat';
  await sahifa.click('#tekshir');
  assert(await sahifa.isVisible('text=Matn bo\'sh'), 'bo\'sh kirishda tushunarli xabar');
  await sahifa.fill('#matn', D + '\tك\u0650ت\u064Eاب\u064C\tkitob\tnahv\n' + D + '\tقلم\tqalam');
  await sahifa.click('#tekshir');
  const t = await sahifa.innerText('#natija');
  assert(t.includes('1 ta karta · 1 ta xato'), t.slice(0, 200));
  assert(t.includes('2-qator: 3 ta ustun bor, 4 ta kerak'));
  const [yuk] = await Promise.all([sahifa.waitForEvent('download'), sahifa.click('#yukla')]);
  assert.strictEqual(await sahifa.inputValue('#fnom'), 'Arab-tili_Nahv-1_1-bob.txt');
  const matn = fs.readFileSync(await yuk.path(), 'utf8');
  assert(matn.startsWith('#separator:tab\n'));
  assert(matn.includes(D + '\tك\u0650ت\u064Eاب\u064C\tkitob\tnahv'));
  await sahifa.click('#bazaga');
  await sahifa.click('#tekshir');
  assert((await sahifa.innerText('#natija')).includes('1 ta takror'));
  // Deck qoidalari: bo'sh boshlanadi, to'ldirilsa ishlaydi
  await sahifa.click('#qoidalar summary');
  assert.strictEqual(await sahifa.inputValue('#kurslar'), '');
  await sahifa.fill('#kurslar', 'Sarf 1');
  await sahifa.dispatchEvent('#kurslar', 'change');
  await sahifa.click('#tekshir');
  assert((await sahifa.innerText('#natija')).includes('ro\'yxatdagi kurs nomi yo\'q'));
  // 1000 qatorli fayl qotmasdan ishlaydi
  let katta = '';
  for (let i = 0; i < 1000; i++) katta += D + '\tكلمة' + i + '\tso\'z\tteg\n';
  await sahifa.fill('#matn', katta + katta);
  const t0 = Date.now();
  await sahifa.click('#tekshir');
  await sahifa.waitForSelector('text=2000 ta karta');
  const vaqt = Date.now() - t0;
  console.log('  Anki 2000 qator (1000 takror) ekranda:', vaqt, 'ms');
  assert(vaqt < 3000);
  await sahifa.evaluate(() => localStorage.removeItem('vositalar.anki.v1'));
};
