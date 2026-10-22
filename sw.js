// Service worker: hamma fayllarni keshlaydi, internetsiz ishlaydi.
// Fayllar o'zgarsa, VERSIYA raqamini oshiring: ilovada "Yangi versiya bor — Yangilash" tugmasi chiqadi.
var VERSIYA = 'vositalar-v2';
var FAYLLAR = [
  './', './index.html', './manifest.webmanifest',
  './umumiy/style.css', './umumiy/yordamchi.js',
  './ikonkalar/ikonka-192.png', './ikonkalar/ikonka-512.png', './ikonkalar/apple-touch-icon.png',
  './hifz/', './hifz/index.html', './hifz/mushaf.js', './hifz/hifz.js',
  './zettel/', './zettel/index.html', './zettel/zettel.js',
  './zettel/namuna/ZK-AQ-001%20Tavhid%20tarifi.md', './zettel/namuna/ZK-AQ-002%20Tavhid%20turlari.md',
  './zettel/namuna/ZK-AQ-004%20Iymon%20ruknlari.md', './zettel/namuna/ZK-AQ-005%20Asmo%20va%20sifat.md',
  './zettel/namuna/ZK-AQ-006.md', './zettel/namuna/ZK-AQ-006%20nusxa.md', './zettel/namuna/ZK-AQ-7%20Ahli%20sunna.md',
  './zettel/namuna/ZK-AQ-008%20Bosh%20karta.md', './zettel/namuna/ZK-AQ-009%20Yetim%20karta.md',
  './anki/', './anki/index.html', './anki/anki.js',
  './kutubxona/', './kutubxona/index.html', './kutubxona/kutubxona.js',
  './transkript/', './transkript/index.html', './transkript/transkript.js',
  './transkript/namuna/namuna.srt', './transkript/namuna/namuna.txt'
];

// O'rnatish: hamma fayl serverdan yangidan olinadi (brauzer keshini chetlab)
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIYA).then(function (c) {
    return Promise.all(FAYLLAR.map(function (f) {
      return c.add(new Request(f, { cache: 'reload' })).catch(function () {});
    }));
  }));
});

// Foydalanuvchi "Yangilash"ni bosganda yangi versiyaga o'tish
self.addEventListener('message', function (e) {
  if (e.data === 'yangila') self.skipWaiting();
});

// Faollashganda eski keshlarni o'chirish
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomlar) {
    return Promise.all(nomlar.filter(function (n) { return n !== VERSIYA; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Avval keshdan beramiz (tez va internetsiz), orqa fonda yangilab qo'yamiz
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSIYA).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (eski) {
      var yangi = fetch(url.href, { cache: 'no-cache' }).then(function (javob) {
        if (javob && javob.ok) c.put(e.request, javob.clone());
        return javob;
      }).catch(function () { return eski || Response.error(); });
      return eski || yangi;
    });
  }));
});
