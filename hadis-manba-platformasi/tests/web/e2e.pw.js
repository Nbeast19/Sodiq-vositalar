// PWA uchun 12 majburiy ssenariy (22.5-bo'lim) — Chromium headless'da, kompyuter va 390px telefon kengligida.
// Bu real iPhone/Android/Windows/Mac qurilma sinovi EMAS (docs/PLATFORM-TEST-MATRIX.md).
// Ishga tushirish: sh scripts/verify.sh  (yoki: python3 scripts/build_demo.py && node tests/web/e2e.pw.js)
'use strict';
const { chromium } = require('playwright');
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..', '..');
const SERVE_ROOT = path.resolve(PROJECT, '..');           // GitHub project path ostidagidek: /<repo>/hadis-manba-platformasi/web/
const BASE_PATH = '/' + path.basename(PROJECT) + '/web/';
const V110 = path.join(PROJECT, 'build/test-paketlar/namuna-asos-a-1.1.0.hmz');
const SELECTION = path.join(PROJECT, 'dist/namuna-kitob-va-sharhlar-1.0.0.hmz');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.hmz': 'application/zip' };

const fetchLog = [];
function startServer() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      fetchLog.push(p);
      let f = path.normalize(path.join(SERVE_ROOT, p));
      if (!f.startsWith(SERVE_ROOT)) { resp.writeHead(403); return resp.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { resp.writeHead(404); return resp.end('not found'); }
      resp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const results = [];
let currentCtxs = [];
async function step(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log('  ✓ ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push({ name, ok: false, error: String(e && e.stack || e) }); console.log('  ✗ ' + name + '\n    ' + (e && e.message)); }
  finally { for (const c of currentCtxs) { try { await c.setOffline(false); } catch (e) { /* yopilgan */ } } }
}

async function newApp(browser, url, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'allow', acceptDownloads: true });
  currentCtxs.push(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(url);
  await page.waitForSelector('html[data-tayyor="1"]');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  return { ctx, page, errors };
}
async function go(page, hash) {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(150);
  await page.waitForFunction(() => !document.querySelector('#asosiy').textContent.includes('Yuklanmoqda'));
}
async function installFromCatalog(page, pid) {
  await go(page, '#/kitoblar');
  const row = page.locator('.paket', { hasText: pid }).first();
  await row.getByRole('button', { name: /O'rnatish|Yangilash/ }).click();
  await poll(page, id => Lib.getPackage(id).then(p => !!(p && p.offline_ready)), pid);
}
// waitForFunction Promise natijasini ishonchli kutmaydi — shuning uchun evaluate bilan so'raymiz.
async function poll(page, fn, arg, timeout) {
  const end = Date.now() + (timeout || 20000);
  while (Date.now() < end) {
    if (await page.evaluate(fn, arg)) return;
    await page.waitForTimeout(100);
  }
  throw new Error('kutish vaqti tugadi');
}
async function importFile(page, file) {
  await go(page, '#/kitoblar');
  await page.setInputFiles('#import-fayl', file);
  await page.waitForSelector('.xabar', { state: 'attached' });
  await page.waitForFunction(() => { const x = document.querySelector('.xabar'); return !x || /tayyor|Xato/.test(x.textContent); }, null, { timeout: 20000 });
}
async function searchCount(page, q, scope) {
  await go(page, '#/');
  await page.fill('#q', q);
  if (scope) await page.selectOption('#doira', scope);
  await page.click('form[role=search] button[type=submit]');
  await page.waitForSelector('#natijalar[data-tayyor="1"]');
  const n = await page.locator('#natijalar a.natija').count();
  if (process.env.E2E_DEBUG && !n) console.log('    [debug] ' + (await page.locator('#asosiy').innerText()).slice(0, 400).replace(/\n+/g, ' | '));
  return n;
}
async function offline(ctx, page, on) {
  await ctx.setOffline(on);
  await page.reload();
  await page.waitForSelector('html[data-tayyor="1"]');
}
async function noHorizontalScroll(page) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(w[0] <= w[1] + 1, 'gorizontal siljish: ' + w.join(' > '));
}
function count(p) { return fetchLog.filter(x => x.endsWith(p)).length; }

(async () => {
  const srv = await startServer();
  const URL0 = 'http://127.0.0.1:' + srv.address().port + BASE_PATH;
  const browser = await chromium.launch();
  const sizes = [['kompyuter', { width: 1280, height: 860 }], ['telefon-390', { width: 390, height: 844 }]];
  for (const [label, viewport] of sizes) {
    console.log('== ' + label + ' ==');
    let A = await newApp(browser, URL0, viewport);

    await step(label + ' 1: faqat bitta kitob -> internet uzildi -> mundarija/qidiruv/raqam', async () => {
      await installFromCatalog(A.page, 'namuna-asos-a');
      await offline(A.ctx, A.page, true);
      assert.ok(await searchCount(A.page, 'طلب العلم') >= 2);
      await go(A.page, '#/kitob/namuna-asos-a');
      assert.ok(await A.page.locator('.mundarija li').count() >= 12);
      await go(A.page, '#/');
      await A.page.locator('form', { hasText: 'Raqam bilan topish' }).locator('input').first().fill('5');
      await A.page.locator('form', { hasText: 'Raqam bilan topish' }).getByRole('button', { name: 'Topish' }).click();
      await A.page.waitForSelector('text=avtomatik tanlanmadi');
      await go(A.page, '#/h/ed-namuna-a:u0001');
      const dir = await A.page.locator('p.ar.matn').getAttribute('dir');
      assert.strictEqual(dir, 'rtl');
      await noHorizontalScroll(A.page);
      await A.ctx.setOffline(false);
    });
    await A.ctx.close();

    let B = await newApp(browser, URL0, viewport);
    await step(label + " 2: faqat sharh -> oflayn o'qish/qidirish; asos yo'qligi ko'rinadi", async () => {
      await installFromCatalog(B.page, 'namuna-sharh-1');
      await offline(B.ctx, B.page, true);
      assert.strictEqual(await searchCount(B.page, 'المبادره اليه', 'commentary'), 1);
      await go(B.page, '#/s/ed-sharh1:o0001');
      await B.page.waitForSelector("text=asosiy kitob o'rnatilmagan");
      await B.page.waitForSelector("a:has-text(\"Asosiy kitobni o'rnatish\")");
      await B.ctx.setOffline(false);
    });
    await step(label + " 3: asos keyin qo'shiladi -> sharh qayta yuklanmay bog'lanish faollashadi", async () => {
      const before = count('namuna-sharh-1-1.0.0.hmz');
      await installFromCatalog(B.page, 'namuna-asos-a');
      await go(B.page, '#/h/ed-namuna-a:u0001');
      await B.page.waitForSelector('#sharh-panel a.natija');
      assert.strictEqual(count('namuna-sharh-1-1.0.0.hmz'), before);
    });
    await step(label + ' 5: kitobga yangi sharh -> kitob qayta yuklanmaydi', async () => {
      const before = count('namuna-asos-a-1.0.0.hmz');
      await installFromCatalog(B.page, 'namuna-sharh-2');
      assert.strictEqual(count('namuna-asos-a-1.0.0.hmz'), before);
      await go(B.page, '#/h/ed-namuna-a:u0001');
      assert.strictEqual(await B.page.locator('#sharh-panel a.natija').count(), 3);
    });
    await step(label + " 6: faqat sharhni o'chirish -> kitob, boshqa sharh va qaydlar saqlanadi", async () => {
      await go(B.page, '#/h/ed-namuna-a:u0001');
      await B.page.getByRole('button', { name: /Xatcho'p/ }).click();
      await B.page.waitForSelector("button:has-text(\"Xatcho'pdan olish\")");
      await B.page.fill('.qayd textarea', 'mening sinov qaydim');
      await B.page.getByRole('button', { name: 'Qaydni saqlash' }).click();
      await poll(B.page, () => Notes.get('note:ed-namuna-a:u0001').then(n => !!n));
      await go(B.page, '#/paketlar');
      await B.page.locator('.karta.paket', { hasText: 'namuna-sharh-2' }).getByRole('button', { name: "O'chirish" }).click();
      await B.page.waitForFunction(() => !document.body.textContent.includes('namuna-sharh-2 ·'));
      await go(B.page, '#/h/ed-namuna-a:u0001');
      assert.strictEqual(await B.page.locator('#sharh-panel a.natija').count(), 2);
      assert.strictEqual(await B.page.inputValue('.qayd textarea'), 'mening sinov qaydim');
    });
    await step(label + ' 10: yangilash -> ID/link/qayd saqlanadi; rollback ishlaydi', async () => {
      await importFile(B.page, V110);
      await go(B.page, '#/h/ed-namuna-a:u0003');
      await B.page.waitForSelector('text=تَصْحِيحٌ تَجْرِيبِيٌّ');
      await go(B.page, '#/h/ed-namuna-a:u0001');
      assert.strictEqual(await B.page.inputValue('.qayd textarea'), 'mening sinov qaydim');
      assert.strictEqual(await B.page.locator('#sharh-panel a.natija').count(), 2);
      await go(B.page, '#/paketlar');
      await B.page.locator('.karta.paket', { hasText: 'namuna-asos-a' }).getByRole('button', { name: /Oldingi versiyaga/ }).click();
      await B.page.waitForFunction(() => document.body.textContent.includes('namuna-asos-a · base_book · v1.0.0'), null, { timeout: 15000 });
      await go(B.page, '#/h/ed-namuna-a:u0003');
      assert.strictEqual(await B.page.locator('text=تَصْحِيحٌ تَجْرِيبِيٌّ').count(), 0);
    });
    await step(label + " 7: asos kitobni o'chirish -> sharh mustaqil; o'tish o'rnatish taklifiga aylanadi", async () => {
      await go(B.page, '#/paketlar');
      await B.page.locator('.karta.paket', { hasText: 'namuna-asos-a' }).getByRole('button', { name: "O'chirish" }).click();
      await B.page.waitForFunction(() => !document.body.textContent.includes('namuna-asos-a ·'));
      await go(B.page, '#/s/ed-sharh1:o0001');
      await B.page.waitForSelector("a:has-text(\"Asosiy kitobni o'rnatish\")");
      await go(B.page, '#/h/ed-namuna-a:u0001');
      await B.page.waitForSelector("a:has-text(\"Asosiy kitobni o'rnatish\")");
    });
    await step(label + " 8: mos bo'lmagan nashr -> raqam-only bog'lama yo'q", async () => {
      await installFromCatalog(B.page, 'namuna-asos-b');
      await go(B.page, '#/h/ed-namuna-b:u0001');
      await B.page.waitForSelector("text=faol bog'lama yo'q");
      assert.strictEqual(await B.page.locator('#sharh-panel a.natija').count(), 0);
    });
    await step(label + " 9: buzilgan import va uzilgan staging -> kutubxona buzilmaydi", async () => {
      const bad = path.join(PROJECT, 'build', 'buzilgan.hmz');
      const buf = fs.readFileSync(path.join(PROJECT, 'web/paketlar/namuna-sharh-2-1.0.0.hmz'));
      buf[Math.floor(buf.length / 3)] ^= 0xff;
      fs.writeFileSync(bad, buf);
      await importFile(B.page, bad);
      await B.page.waitForSelector('.xabar.yomon');
      // uzilgan staging'ni taqlid qilamiz: yarim yozilgan versiya qoldig'i
      await B.page.evaluate(() => new Promise(r => {
        const q = indexedDB.open('hadis-manba');
        q.onsuccess = () => {
          const tx = q.result.transaction(['versions', 'units'], 'readwrite');
          tx.objectStore('versions').put({ pkgv: 'yarim@9.9.9#x', package_id: 'yarim', version: '9.9.9', state: 'staging' });
          tx.objectStore('units').put({ pkgv: 'yarim@9.9.9#x', unit_id: 'yarim:u1', text_ar: 'x', n: 'x' });
          tx.oncomplete = r;
        };
      }));
      await B.page.reload();
      await B.page.waitForSelector('html[data-tayyor="1"]');
      const left = await B.page.evaluate(() => new Promise(r => {
        const q = indexedDB.open('hadis-manba');
        q.onsuccess = () => { const g = q.result.transaction('versions').objectStore('versions').get('yarim@9.9.9#x'); g.onsuccess = () => r(!!g.result); };
      }));
      assert.strictEqual(left, false);
      assert.ok(await searchCount(B.page, 'المبادره اليه', 'commentary') === 1);
    });
    await step(label + ' 11: qayta ochish (oflayn) -> AIsiz barcha paketlarda qidiruv', async () => {
      const p2 = await B.ctx.newPage();
      await B.ctx.setOffline(true);
      await p2.goto(URL0);
      await p2.waitForSelector('html[data-tayyor="1"]');
      const n = await searchCount(p2, 'تجريبي');
      assert.ok(n >= 10, 'natija: ' + n);
      await B.ctx.setOffline(false);
      await p2.close();
    });
    let exported = null;
    await step(label + ' 12: paketni faylga eksport/import va qayd zaxirasini tiklash', async () => {
      await go(B.page, '#/paketlar');
      const [dl] = await Promise.all([B.page.waitForEvent('download'),
        B.page.locator('.karta.paket', { hasText: 'namuna-sharh-1' }).getByRole('button', { name: 'Faylga eksport' }).click()]);
      exported = path.join(PROJECT, 'build', 'eksport-sharh1.hmz');
      await dl.saveAs(exported);
      await go(B.page, '#/qaydlar');
      const [dl2] = await Promise.all([B.page.waitForEvent('download'), B.page.getByRole('button', { name: /Qaydlarni eksport/ }).click()]);
      const notesFile = path.join(PROJECT, 'build', 'qaydlar.json');
      await dl2.saveAs(notesFile);
      const C = await newApp(browser, URL0, viewport);
      await importFile(C.page, exported);
      await go(C.page, '#/qaydlar');
      await C.page.setInputFiles('#asosiy input[type=file]', notesFile);
      await C.page.waitForSelector('text=mening sinov qaydim');
      assert.strictEqual(await searchCount(C.page, 'المبادره اليه', 'commentary'), 1);
      await C.ctx.close();
    });
    await step(label + ' 4: kitob + ikki tanlangan sharh birga -> ikki tomonlama o\'tish', async () => {
      const D = await newApp(browser, URL0, viewport);
      await go(D.page, '#/kitoblar');
      const card = D.page.locator('section.karta', { hasText: 'Sharhlar' }).first();
      for (const cb of await card.locator('input[type=checkbox]').all()) await cb.check();
      await card.getByRole('button', { name: /Kitob \+ tanlangan/ }).click();
      await poll(D.page, () => Lib.packages().then(ps => ps.filter(p => p.offline_ready).length === 3));
      await go(D.page, '#/h/ed-namuna-a:u0001');
      assert.strictEqual(await D.page.locator('#sharh-panel a.natija').count(), 3);
      await D.page.locator('#sharh-panel a.natija').nth(2).click();
      await D.page.waitForSelector('.segmentlar');
      await D.page.getByRole('link', { name: /Asos hadisga qaytish/ }).click();
      await D.page.waitForSelector('p.ar.matn');
      assert.ok(decodeURIComponent(D.page.url()).endsWith('#/h/ed-namuna-a:u0001'));
      // yig'ma fayli: o'rnatilganlar qayta yozilmaydi
      await importFile(D.page, SELECTION);
      await noHorizontalScroll(D.page);
      assert.deepStrictEqual(D.errors, []);
      await D.ctx.close();
    });
    await step(label + ': konsolda xato yo\'q', async () => {
      const errs = B.errors.filter(e => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));
      assert.deepStrictEqual(errs, []);
    });
    await B.ctx.close();
  }
  await browser.close();
  srv.close();
  const failed = results.filter(r => !r.ok);
  fs.mkdirSync(path.join(PROJECT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(PROJECT, 'build', 'e2e-natija.json'), JSON.stringify({ at: new Date().toISOString(), browser: 'chromium-headless (playwright ' + require('playwright/package.json').version + ')', results }, null, 1));
  console.log(results.length - failed.length + '/' + results.length + " ta ssenariy o'tdi");
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
