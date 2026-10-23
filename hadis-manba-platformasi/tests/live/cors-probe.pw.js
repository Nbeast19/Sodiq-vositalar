// Haqiqiy brauzerda (Chromium) github.io sahifasidan GitHub Release paketini fetch qilish mumkinmi?
// Ishga tushirish (GitHub Actions'da): ASSET_ID=... REPO=owner/repo ORIGIN_URL=https://<user>.github.io/<repo>/ node cors-probe.pw.js
'use strict';
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(process.env.ORIGIN_URL);
  const urls = [
    { name: 'api', url: `https://api.github.com/repos/${process.env.REPO}/releases/assets/${process.env.ASSET_ID}`, headers: { Accept: 'application/octet-stream' } },
    { name: 'browser_download_url', url: `https://github.com/${process.env.REPO}/releases/download/${process.env.TAG}/SHA256SUMS`, headers: {} },
  ];
  for (const u of urls) {
    const r = await p.evaluate(async (u) => {
      try { const x = await fetch(u.url, { headers: u.headers, cache: 'no-store' }); const buf = await x.arrayBuffer(); return { status: x.status, bytes: buf.byteLength }; }
      catch (e) { return { error: String(e) }; }
    }, u);
    console.log('PROBE', u.name, JSON.stringify(r));
  }
  await b.close();
})();
