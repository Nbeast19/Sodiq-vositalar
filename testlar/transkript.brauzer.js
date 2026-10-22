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
  await sahifa.evaluate(() => localStorage.removeItem('nader.transkript.v1'));
};
