// Service worker: hamma fayllarni keshlaydi, internetsiz ishlaydi.
// Fayl o'zgarsa, VERSIYA raqamini oshiring — eski kesh o'chiriladi.
var VERSIYA = 'nader-v1';
var FAYLLAR = [
  './', './index.html', './manifest.webmanifest',
  './umumiy/style.css', './umumiy/yordamchi.js',
  './ikonkalar/ikonka-192.png', './ikonkalar/ikonka-512.png', './ikonkalar/apple-touch-icon.png',
  './hifz/', './hifz/index.html', './hifz/mushaf.js', './hifz/hifz.js',
  './anki/', './anki/index.html', './anki/anki.js',
  './kutubxona/', './kutubxona/index.html', './kutubxona/kutubxona.js',
  './zettel/', './zettel/index.html', './zettel/zettel.js',
  './zettel/namuna/ZK-AQ-001%20Tavhid%20tarifi.md', './zettel/namuna/ZK-AQ-002%20Tavhid%20turlari.md',
  './zettel/namuna/ZK-AQ-004%20Iymon%20ruknlari.md', './zettel/namuna/ZK-AQ-005%20Asmo%20va%20sifat.md',
  './zettel/namuna/ZK-AQ-006.md', './zettel/namuna/ZK-AQ-006%20nusxa.md', './zettel/namuna/ZK-AQ-7%20Ahli%20sunna.md',
  './zettel/namuna/ZK-AQ-008%20Bosh%20karta.md', './zettel/namuna/ZK-AQ-009%20Yetim%20karta.md'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIYA).then(function (c) {
    // Har birini alohida qo'shamiz: bittasi topilmasa ham qolganlari keshlanadi
    return Promise.all(FAYLLAR.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomlar) {
    return Promise.all(nomlar.filter(function (n) { return n !== VERSIYA; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Avval keshdan beramiz (tez va internetsiz), orqa fonda yangilab qo'yamiz
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSIYA).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (eski) {
      var yangi = fetch(e.request).then(function (javob) {
        if (javob && javob.ok) c.put(e.request, javob.clone());
        return javob;
      }).catch(function () { return eski; });
      return eski || yangi;
    });
  }));
});
