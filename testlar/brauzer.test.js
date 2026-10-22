// Brauzer sinovi: sahifalar ochiladi, konsolda xato yo'q, asosiy amallar ishlaydi.
// Ishga tushirish: npx http-server -p 8123 -s &  so'ng  node testlar/brauzer.test.js
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const ASOS = 'http://localhost:8123/';

(async () => {
  const brauzer = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await brauzer.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const xatolar = [];
  const sahifa = await ctx.newPage();
  sahifa.on('console', m => { if (m.type() === 'error') xatolar.push(m.text()); });
  sahifa.on('pageerror', e => xatolar.push(String(e)));
  sahifa.on('dialog', d => d.accept());

  for (const yol of ['index.html', 'hifz/index.html', 'zettel/index.html', 'anki/index.html', 'kutubxona/index.html', 'transkript/index.html']) {
    if (!fs.existsSync(yol)) continue;
    await sahifa.goto(ASOS + yol);
    await sahifa.waitForTimeout(300);
  }

  // --- Hifz ---
  await sahifa.goto(ASOS + 'hifz/index.html');
  await sahifa.evaluate(() => localStorage.clear());
  await sahifa.reload();
  assert(await sahifa.isVisible('[data-a="tasdiq"]'), 'sozlash ekrani chiqadi');
  assert.strictEqual(await sahifa.inputValue('[data-tur="b"][data-i="0"] [data-k="dan"]'), '434');
  assert.strictEqual(await sahifa.inputValue('[data-tur="o"][data-i="1"] [data-k="gacha"]'), '76');
  await sahifa.click('[data-a="tasdiq"]');
  assert(await sahifa.isVisible('text=434-sahifa'));
  assert(await sahifa.isVisible('text=Fotir surasi'));
  for (let i = 0; i < 3; i++) await sahifa.click('[data-a="plus"]');
  await sahifa.click('[data-a="minus"]');
  assert(await sahifa.isVisible('text=Takror: 2 / 20'));
  const birinchi = sahifa.locator('[data-a="rev"]').first();
  await birinchi.click();
  await sahifa.reload();
  assert(await sahifa.isVisible('text=Takrorlandi ✓'), 'belgi saqlanadi');
  assert.strictEqual(await sahifa.locator('[data-a="rev"]').count(), 5);
  for (let i = 0; i < 18; i++) await sahifa.click('[data-a="plus"]');
  assert(await sahifa.isVisible('text=Bugungi yangi sahifa yodlandi'));
  assert(await sahifa.isVisible('text=Keyingisi: 435-sahifa'));
  // Eksport -> o'chirish -> import
  await sahifa.click('nav [data-ekran="zaxira"]');
  const [yuk] = await Promise.all([sahifa.waitForEvent('download'), sahifa.click('[data-r="eks"]')]);
  assert(/^hifz-zaxira-\d{4}-\d\d-\d\d\.json$/.test(yuk.suggestedFilename()));
  const yol = await yuk.path();
  await sahifa.evaluate(() => localStorage.clear());
  await sahifa.reload();
  assert(await sahifa.isVisible('[data-a="tasdiq"]'));
  await sahifa.click('nav [data-ekran="zaxira"]');
  await sahifa.setInputFiles('[data-r="imp"]', yol);
  await sahifa.waitForTimeout(300);
  assert(await sahifa.isVisible('text=Bugungi yangi sahifa yodlandi'), 'import qilingach hammasi qaytadi');
  // Buzilgan ma'lumot
  await sahifa.evaluate(() => localStorage.setItem('nader.hifz.v1', '{buzuq'));
  await sahifa.reload();
  assert(await sahifa.isVisible('text=Ma\'lumotni o\'qib bo\'lmadi'));
  await sahifa.evaluate(() => localStorage.clear());
  for (const e of ['qiyin', 'stat', 'sozlash']) { await sahifa.click(`nav [data-ekran="${e}"]`); }

  // Har bir vositaning o'z sinovi (keyingi vositalar qo'shilganda)
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.brauzer.js'))) {
    await require('./' + f)(sahifa, ASOS);
  }

  // Internetsiz ishlash (service worker)
  await sahifa.goto(ASOS + 'index.html');
  await sahifa.evaluate(() => navigator.serviceWorker.ready);
  await sahifa.reload();
  await sahifa.waitForTimeout(500);
  await ctx.setOffline(true);
  await sahifa.goto(ASOS + 'hifz/index.html');
  assert(await sahifa.isVisible('[data-a="tasdiq"]'), 'internetsiz ochiladi');
  await sahifa.goto(ASOS);
  assert(await sahifa.isVisible('text=Nader vositalari'));
  await ctx.setOffline(false);

  assert.deepStrictEqual(xatolar, [], 'konsolda xato yo\'q');
  console.log('Brauzer: hamma sinovlar o\'tdi ✓');
  await brauzer.close();
})().catch(e => { console.error(e); process.exit(1); });
