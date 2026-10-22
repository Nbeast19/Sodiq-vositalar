const assert = require('assert');
const fs = require('fs');
module.exports = async (sahifa, ASOS) => {
  await sahifa.goto(ASOS + 'transkript/index.html');
  await sahifa.click('[data-namuna="namuna.srt"]');
  await sahifa.waitForSelector('#korinish p');
  assert((await sahifa.innerText('#stat')).startsWith('Jami so\'z:'));
  assert(await sahifa.locator('#korinish .arab').count() >= 2);
  assert(await sahifa.locator('#korinish mark').count() >= 1);
  const [yuk] = await Promise.all([sahifa.waitForEvent('download'), sahifa.click('#txt')]);
  assert.strictEqual(yuk.suggestedFilename(), 'namuna_toza.txt');
  const matn = fs.readFileSync(await yuk.path(), 'utf8');
  assert(!matn.includes('-->') && matn.includes('قال رسول الله'));
  await sahifa.click('[data-namuna="namuna.txt"]');
  await sahifa.waitForTimeout(200);
  assert((await sahifa.innerText('#korinish')).includes('Umar'));
  // 15 000 so'zli matn qotmasdan ishlaydi
  const uzun = await sahifa.evaluate(() => {
    let s = '';
    for (let i = 0; i < 1500; i++) s += 'Bu yerda o\u2018zbekcha gap bor va va قال الله تعالى بسم الله. ';
    return s;
  });
  await sahifa.fill('#matn', uzun);
  const t0 = Date.now();
  await sahifa.click('#ishla');
  await sahifa.waitForFunction(() => /Jami so'z: 1\d \d{3}/.test(document.getElementById('stat').textContent));
  const vaqt = Date.now() - t0;
  console.log('  Transkript 15 000 so\'z ekranda:', vaqt, 'ms');
  assert(vaqt < 2000);
  await sahifa.evaluate(() => localStorage.removeItem('vositalar.transkript.v1'));
};
