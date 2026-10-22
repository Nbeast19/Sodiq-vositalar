const assert = require('assert');
module.exports = async (sahifa, ASOS) => {
  await sahifa.goto(ASOS + 'anki/index.html');
  const D = 'najron 6::النحو ٤::الباب الأول::Lugat';
  await sahifa.fill('#matn', D + '\tكِتَابٌ\tkitob\tnahv\n' + D + '\tقلم\tqalam');
  await sahifa.click('#tekshir');
  const t = await sahifa.innerText('#natija');
  assert(t.includes('1 ta karta · 1 ta xato'), t.slice(0, 200));
  assert(t.includes('2-qator: 3 ta ustun bor, 4 ta kerak'));
  const [yuk] = await Promise.all([sahifa.waitForEvent('download'), sahifa.click('#yukla')]);
  // Headless Chromium arabcha fayl nomini 'download' deb ko'rsatadi; nomning o'zi Node sinovida tekshirilgan
  assert(['najron6_النحو٤_الباب-الأول.txt', 'download'].includes(yuk.suggestedFilename()));
  assert.strictEqual(await sahifa.inputValue('#fnom'), 'najron6_النحو٤_الباب-الأول.txt');
  const matn = require('fs').readFileSync(await yuk.path(), 'utf8');
  assert(matn.includes(D + '\tكِتَابٌ\tkitob\tnahv'));
  await sahifa.click('#bazaga');
  await sahifa.click('#tekshir');
  assert((await sahifa.innerText('#natija')).includes('1 ta takror'));
  await sahifa.evaluate(() => localStorage.removeItem('nader.anki.v1'));
};
