// Brauzer sinovi (iPhone o'lchamida): sahifalar ochiladi, konsolda xato yo'q, asosiy amallar ishlaydi.
// Ishga tushirish: npx http-server -p 8123 -s -c-1 &  so'ng  node testlar/brauzer.test.js
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ASOS = 'http://localhost:8123/';
const ILDIZ = path.join(__dirname, '..');
const SAHIFALAR = ['index.html', 'hifz/index.html', 'zettel/index.html', 'anki/index.html', 'kutubxona/index.html', 'transkript/index.html'];

(async () => {
  const brauzer = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await brauzer.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const xatolar = [];
  const sahifa = await ctx.newPage();
  sahifa.on('console', m => { if (m.type() === 'error') xatolar.push(m.text()); });
  sahifa.on('pageerror', e => xatolar.push(String(e)));
  sahifa.on('dialog', d => d.accept());

  // --- Har bir sahifa: ochiladi, gorizontal siljish yo'q, izoh va orqaga tugmasi bor (yorug' va qorong'i) ---
  for (const sxema of ['light', 'dark']) {
    await sahifa.emulateMedia({ colorScheme: sxema });
    for (const yol of SAHIFALAR) {
      await sahifa.goto(ASOS + yol);
      await sahifa.waitForTimeout(150);
      const kenglik = await sahifa.evaluate(() => document.documentElement.scrollWidth);
      assert(kenglik <= 390, yol + ': sahifa ekrandan keng (' + kenglik + ')');
      assert(await sahifa.isVisible('.izoh'), yol + ': izoh yo\'q');
      if (yol !== 'index.html') assert(await sahifa.isVisible('text=← Bosh sahifa'));
      const sarlavha = await sahifa.title();
      assert(/Vositalar/.test(sarlavha), sarlavha);
    }
  }
  await sahifa.emulateMedia({ colorScheme: 'light' });

  // --- Eski kalitlardan ko'chirish: sozlangan foydalanuvchi sozlash ekranini ko'rmaydi ---
  await sahifa.goto(ASOS + 'index.html');
  await sahifa.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('nader.hifz.v1', JSON.stringify({
      v: 1, sozlandi: true, yaratilgan: '2026-01-01', oxirgiZaxira: '2026-01-01',
      sozlama: { bosqichlar: [{ dan: 434, gacha: 506 }], kunlik: 1, takror: 20, murojaa: 5, murojaaBirlik: 'sahifa', kunBoshi: '03:00', ustozKunlari: [0, 1, 2, 3, 4, 5, 6], damKunlari: [] },
      oldin: [{ dan: 582, gacha: 604, holat: 'kuchli' }], joriy: { p: 435, q: 0, sanoq: 7 }, yodlangan: { 434: '2026-01-02' }, yarim: {}, oxirgiTakror: {}, qiyin: { 590: '2026-01-03' }, kunlar: {}
    }));
    localStorage.setItem('nader.anki.v1', JSON.stringify({ v: 1, baza: [{ f: 'كتاب', d: 'X::K::Lugat', m: 'eski.txt' }], kurslar: ['K'], rejim: 'aniq', alif: false }));
    localStorage.setItem('nader.persist', '1');
  });
  await sahifa.reload();
  const kalitlar = await sahifa.evaluate(() => Object.keys(localStorage).sort());
  assert(!kalitlar.some(k => k.startsWith('nader.')), 'eski kalitlar o\'chdi: ' + kalitlar);
  assert(kalitlar.includes('vositalar.hifz.v1') && kalitlar.includes('vositalar.anki.v1'));
  assert(await sahifa.isVisible('#hifz-eslatma'), 'bugungi sahifa eslatmasi');
  await sahifa.goto(ASOS + 'hifz/index.html');
  assert(!(await sahifa.isVisible('[data-a="tasdiq"]')), 'sozlash ekrani chiqmasligi kerak');
  assert(await sahifa.isVisible('text=435-sahifa'));
  assert(await sahifa.isVisible('text=Takror: 7 / 20'), 'progress saqlangan');
  assert(await sahifa.isVisible('text=Zaxira nusxa olishni unutmang'));
  assert(await sahifa.isVisible('text=Ustozga topshirish'));
  await sahifa.click('nav [data-ekran="qiyin"]');
  assert(await sahifa.isVisible('text=590-sahifa'));
  await sahifa.goto(ASOS + 'anki/index.html');
  assert((await sahifa.innerText('#baza-soni')).startsWith('1 ta karta'));

  // --- Hifz: yangi foydalanuvchi, shablon bilan sozlash ---
  await sahifa.evaluate(() => localStorage.clear());
  await sahifa.goto(ASOS + 'hifz/index.html');
  assert(await sahifa.isVisible('[data-a="tasdiq"]'), 'sozlash ekrani chiqadi');
  assert(await sahifa.isVisible('text=Hali bosqich yo\'q'), 'shaxsiy standart raqamlar yo\'q');
  await sahifa.click('[data-a="tasdiq"]');
  assert(await sahifa.isVisible('[data-a="tasdiq"]'), 'bosqichsiz tasdiqlanmaydi');
  await sahifa.click('[data-a="shablon"][data-n="oxiridan"]');
  assert(await sahifa.isVisible('text=30 ta bosqich'));
  await sahifa.click('[data-a="shablon"][data-n="ozim"]');
  await sahifa.click('[data-a="bosqichQosh"]');
  await sahifa.selectOption('[data-tur="b"][data-i="0"] [data-sura="dan"]', '35');
  await sahifa.selectOption('[data-tur="b"][data-i="0"] [data-sura="gacha"]', '46');
  assert.strictEqual(await sahifa.inputValue('[data-tur="b"][data-i="0"] [data-k="dan"]'), '434');
  assert.strictEqual(await sahifa.inputValue('[data-tur="b"][data-i="0"] [data-k="gacha"]'), '506');
  await sahifa.click('[data-a="qismQosh"]');
  await sahifa.fill('[data-tur="o"][data-i="0"] [data-k="dan"]', '582');
  await sahifa.fill('[data-tur="o"][data-i="0"] [data-k="gacha"]', '604');
  await sahifa.selectOption('[data-tur="o"][data-i="0"] [data-k="holat"]', 'zaif');
  await sahifa.click('[data-a="tasdiq"]');
  assert(await sahifa.isVisible('text=434-sahifa'));
  assert(await sahifa.isVisible('text=Fotir surasi'));
  assert(!(await sahifa.isVisible('text=Ustozga topshirish')), 'ustoz kunlari standartda yo\'q');
  for (let i = 0; i < 3; i++) await sahifa.click('[data-a="plus"]');
  await sahifa.click('[data-a="minus"]');
  assert(await sahifa.isVisible('text=Takror: 2 / 20'));
  await sahifa.locator('[data-a="rev"]').first().click();
  await sahifa.reload();
  assert(await sahifa.isVisible('text=Takrorlandi ✓'), 'belgi saqlanadi');
  assert.strictEqual(await sahifa.locator('[data-a="rev"]').count(), 5);
  for (let i = 0; i < 18; i++) await sahifa.click('[data-a="plus"]');
  assert(await sahifa.isVisible('text=Bugungi yangi sahifa yodlandi'));
  assert(await sahifa.isVisible('text=Keyingisi: 435-sahifa'));
  for (const e of ['qiyin', 'stat', 'sozlash']) await sahifa.click(`nav [data-ekran="${e}"]`);
  assert(await sahifa.isVisible('[data-a="bekor"]'));
  // Eksport -> o'chirish -> import
  await sahifa.click('nav [data-ekran="zaxira"]');
  const [yuk] = await Promise.all([sahifa.waitForEvent('download'), sahifa.click('[data-r="eks"]')]);
  assert(/^hifz-zaxira-\d{4}-\d\d-\d\d\.json$/.test(yuk.suggestedFilename()));
  const zaxiraYol = await yuk.path();
  await sahifa.evaluate(() => localStorage.clear());
  await sahifa.reload();
  await sahifa.click('nav [data-ekran="zaxira"]');
  await sahifa.setInputFiles('[data-r="imp"]', zaxiraYol);
  await sahifa.waitForTimeout(300);
  assert(await sahifa.isVisible('text=Bugungi yangi sahifa yodlandi'), 'import qilingach hammasi qaytadi');
  // Eski formatdagi zaxira (ba'zi maydonlarsiz) ham tiklanadi
  const eskiZaxira = path.join(__dirname, '..', '.eski-zaxira.json');
  fs.writeFileSync(eskiZaxira, JSON.stringify({ sozlandi: true, sozlama: { bosqichlar: [{ dan: 1, gacha: 5 }], kunlik: 1, takror: 20, murojaa: 5, kunBoshi: '03:00' }, oldin: [], yodlangan: {}, kunlar: {} }));
  await sahifa.click('nav [data-ekran="zaxira"]');
  await sahifa.setInputFiles('[data-r="imp"]', eskiZaxira);
  await sahifa.waitForTimeout(300);
  fs.unlinkSync(eskiZaxira);
  assert(await sahifa.isVisible('text=1-sahifa'), 'eski zaxira tiklandi');
  // Noto'g'ri fayl — tushunarli xabar, ilova buzilmaydi
  const notogri = path.join(__dirname, '..', '.notogri.json');
  fs.writeFileSync(notogri, '{"salom": 1}');
  const xabarlar = [];
  const tingla = d => xabarlar.push(d.message());
  sahifa.on('dialog', tingla);
  await sahifa.click('nav [data-ekran="zaxira"]');
  await sahifa.setInputFiles('[data-r="imp"]', notogri);
  await sahifa.waitForTimeout(300);
  sahifa.off('dialog', tingla);
  fs.unlinkSync(notogri);
  assert(xabarlar.some(m => m.includes('Hifz zaxira nusxasi emas')), xabarlar.join(' | '));
  // Buzilgan ma'lumot: xabar va "Boshidan boshlash"
  await sahifa.evaluate(() => localStorage.setItem('vositalar.hifz.v1', '{buzuq'));
  await sahifa.reload();
  assert(await sahifa.isVisible('text=Ma\'lumotni o\'qib bo\'lmadi'));
  assert.strictEqual(await sahifa.evaluate(() => localStorage.getItem('vositalar.hifz.v1.buzilgan')), '{buzuq');
  await sahifa.click('[data-r="noldan"]');
  await sahifa.waitForLoadState();
  assert(await sahifa.isVisible('[data-a="tasdiq"]'));

  // --- Bosh sahifa: hamma vositalar uchun bitta zaxira ---
  await sahifa.evaluate(() => { localStorage.clear(); localStorage.setItem('vositalar.kutubxona.v1', JSON.stringify({ ustoz: 'Sinov', sozlar: ['x'] })); });
  await sahifa.goto(ASOS + 'index.html');
  await sahifa.click('summary:has-text("bitta zaxira")');
  const [umumiy] = await Promise.all([sahifa.waitForEvent('download'), sahifa.click('#hammasi-eks')]);
  const umumiyYol = await umumiy.path();
  await sahifa.evaluate(() => localStorage.clear());
  await sahifa.setInputFiles('#hammasi-imp', umumiyYol);
  await sahifa.waitForTimeout(1200);
  assert.strictEqual(await sahifa.evaluate(() => JSON.parse(localStorage.getItem('vositalar.kutubxona.v1')).ustoz), 'Sinov');
  await sahifa.evaluate(() => localStorage.clear());

  // --- Har bir vositaning o'z sinovi ---
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.brauzer.js'))) {
    await require('./' + f)(sahifa, ASOS);
  }

  // --- Yangi versiya: "Yangilash" tugmasi chiqadi va ishlaydi ---
  const swYol = path.join(ILDIZ, 'sw.js');
  const swAsl = fs.readFileSync(swYol, 'utf8');
  try {
    await sahifa.goto(ASOS + 'index.html');
    await sahifa.evaluate(() => navigator.serviceWorker.ready);
    await sahifa.reload();
    assert(await sahifa.evaluate(() => !!navigator.serviceWorker.controller));
    fs.writeFileSync(swYol, swAsl + '\n// sinov ' + Date.now() + '\n');
    await sahifa.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await sahifa.waitForSelector('#yangilash', { timeout: 10000 });
    assert(await sahifa.isVisible('text=Yangi versiya bor'));
    await Promise.all([sahifa.waitForEvent('load'), sahifa.click('#yangilash button')]);
    await sahifa.waitForTimeout(300);
    assert(!(await sahifa.isVisible('#yangilash')), 'yangilangandan keyin tugma yo\'qoladi');
  } finally {
    fs.writeFileSync(swYol, swAsl);
  }

  // --- Internetsiz ishlash: hamma sahifa keshdan ochiladi ---
  await sahifa.reload();
  await sahifa.waitForTimeout(800);
  await ctx.setOffline(true);
  for (const yol of SAHIFALAR) {
    await sahifa.goto(ASOS + yol);
    assert(await sahifa.isVisible('h1'), yol + ' internetsiz ochiladi');
  }
  await sahifa.goto(ASOS + 'zettel/index.html');
  await sahifa.click('#namuna');
  await sahifa.waitForSelector('#nusxa');
  await sahifa.goto(ASOS + 'transkript/index.html');
  await sahifa.click('[data-namuna="namuna.srt"]');
  await sahifa.waitForSelector('#korinish p');
  await ctx.setOffline(false);

  assert.deepStrictEqual(xatolar, [], 'konsolda xato yo\'q');
  console.log('Brauzer: hamma sinovlar o\'tdi ✓');
  await brauzer.close();
})().catch(e => { console.error(e); process.exit(1); });
