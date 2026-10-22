// Umumiy yordamchi funksiyalar: saqlash, zaxira nusxa, fayl yuklab olish,
// eski kalitlarni ko'chirish va yangi versiya haqida xabar.
// Hamma ma'lumot faqat shu qurilmada (localStorage) saqlanadi.
(function (global) {
  'use strict';
  var N = {};
  var PREFIKS = 'vositalar.';
  var ESKI_PREFIKS = 'nader.';
  N.PREFIKS = PREFIKS;

  function ls() { return global.localStorage; }

  // Eski kalitlardagi ma'lumotni yangi kalitlarga ko'chirish (bir marta, avtomatik)
  N.kochir = function () {
    try {
      var eski = [];
      for (var i = 0; i < ls().length; i++) {
        var k = ls().key(i);
        if (k && k.indexOf(ESKI_PREFIKS) === 0) eski.push(k);
      }
      eski.forEach(function (k) {
        var yangi = PREFIKS + k.slice(ESKI_PREFIKS.length);
        if (ls().getItem(yangi) === null) ls().setItem(yangi, ls().getItem(k));
        ls().removeItem(k); // faqat yangisi yozilgandan keyin o'chiriladi
      });
    } catch (e) { /* xotira yopiq bo'lsa — eskisi joyida qoladi */ }
  };

  // Sana: YYYY-MM-DD (telefonning mahalliy vaqti bo'yicha)
  N.sanaMatn = function (d) {
    var m = d.getMonth() + 1, k = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (k < 10 ? '0' : '') + k;
  };
  N.bugunSana = function () { return N.sanaMatn(new Date()); };

  // localStorage'dan o'qish. Buzilgan bo'lsa xato:true qaytaradi, ilova qulamaydi,
  // buzilgan matn esa "<kalit>.buzilgan" ostida saqlab qo'yiladi.
  N.yukla = function (kalit) {
    var s = null;
    try {
      s = ls().getItem(kalit);
      if (s === null) return { data: null, xato: false };
      return { data: JSON.parse(s), xato: false };
    } catch (e) {
      try { if (s !== null && ls().getItem(kalit + '.buzilgan') === null) ls().setItem(kalit + '.buzilgan', s); } catch (e2) { /* mayli */ }
      return { data: null, xato: true };
    }
  };
  N.saqla = function (kalit, data) {
    try {
      ls().setItem(kalit, JSON.stringify(data));
      return true;
    } catch (e) {
      N.xabar('Saqlab bo\'lmadi. Telefon xotirasi to\'lgan bo\'lishi mumkin — zaxira nusxa oling.');
      return false;
    }
  };

  // Standart qiymatlar bilan to'ldirish (eski formatdagi ma'lumot uchun)
  N.toldir = function (data, standart) {
    var r = {};
    Object.keys(standart).forEach(function (k) { r[k] = standart[k]; });
    if (data && typeof data === 'object') Object.keys(data).forEach(function (k) { if (data[k] !== undefined) r[k] = data[k]; });
    return r;
  };

  // Arabcha harakatlar va tatvilni olib tashlash; alif=true bo'lsa أ إ آ ٱ → ا, ى → ي, ة → ه
  N.harakatsiz = function (s, alif) {
    s = String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '');
    if (alif) s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
    return s;
  };

  // HTML ichiga xavfsiz matn qo'yish
  N.h = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  N.$ = function (id) { return document.getElementById(id); };

  // Qisqa tebranish (bo'lmasa jim o'tadi)
  N.tebran = function () {
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* qurilmada yo'q */ }
  };

  // Faylni yuklab olish
  N.yuklabOl = function (nom, matn, turi, bom) {
    var blob = new Blob([(bom ? '\uFEFF' : '') + matn], { type: (turi || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  // Faylni matn sifatida o'qish
  N.faylOqi = function (fayl) {
    return new Promise(function (ok, xato) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { xato(r.error); };
      r.readAsText(fayl, 'utf-8');
    });
  };

  // Matnni nusxalash
  N.nusxala = function (matn) {
    function eski() {
      var t = document.createElement('textarea');
      t.value = matn; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* bo'lmasa ham mayli */ }
      t.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(matn).catch(eski);
    else eski();
    N.xabar('Nusxalandi ✓');
  };

  // Qisqa xabar (pastda chiqadi)
  var xabarTaymer;
  N.xabar = function (matn) {
    if (typeof document === 'undefined') return;
    var el = N.$('xabar');
    if (!el) { el = document.createElement('div'); el.id = 'xabar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = matn;
    el.classList.add('korin');
    clearTimeout(xabarTaymer);
    xabarTaymer = setTimeout(function () { el.classList.remove('korin'); }, 3000);
  };

  // "Zaxira nusxa" bo'limini chizish (eksport/import)
  // opt: { prefiks, olish: () => data, tiklash: (data) => xato matni yoki null, saqlandi: () => void }
  N.zaxiraBolimi = function (joy, opt) {
    joy.innerHTML =
      '<div class="karta"><h2 style="margin-top:0">Zaxira nusxa</h2>' +
      '<p class="xira kichik">Ma\'lumot faqat shu qurilmada. Yo\'qolmasligi uchun vaqti-vaqti bilan faylga saqlab qo\'ying (iCloud Drive yoki Telegram\'ga).</p>' +
      '<button class="asosiy keng" data-r="eks">⬇️ Eksport (.json)</button>' +
      '<label class="tugma keng" style="margin-top:10px">⬆️ Import (fayldan tiklash)' +
      '<input type="file" accept=".json,application/json" class="yashirin" data-r="imp"></label></div>';
    joy.querySelector('[data-r="eks"]').onclick = function () {
      N.yuklabOl(opt.prefiks + '-zaxira-' + N.bugunSana() + '.json', JSON.stringify(opt.olish(), null, 1), 'application/json');
      if (opt.saqlandi) opt.saqlandi();
      N.xabar('Zaxira fayl yuklab olindi ✓');
    };
    var inp = joy.querySelector('[data-r="imp"]');
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) return;
      N.faylOqi(f).then(function (matn) {
        var data;
        try { data = JSON.parse(matn); } catch (e) {
          alert('Bu fayl zaxira nusxa emas yoki buzilgan. ".json" bilan tugaydigan zaxira faylni tanlang.');
          return;
        }
        if (data && data.tur === 'vositalar-zaxira') data = data.kalitlar && data.kalitlar[opt.kalit] ? JSON.parse(data.kalitlar[opt.kalit]) : null;
        if (!data || typeof data !== 'object') { alert('Bu faylda shu vosita uchun ma\'lumot yo\'q.'); return; }
        if (!confirm('Hozirgi ma\'lumot almashtiriladi, rozimisiz?')) return;
        var xato = opt.tiklash(data);
        if (xato) alert(xato); else N.xabar('Ma\'lumot tiklandi ✓');
      }).catch(function () { alert('Faylni o\'qib bo\'lmadi. Boshqa faylni tanlab ko\'ring.'); })
        .then(function () { inp.value = ''; });
    };
  };

  // Hamma vositalar ma'lumotini bitta faylga (bosh sahifa uchun)
  N.hammasiOl = function () {
    var r = { tur: 'vositalar-zaxira', v: 1, sana: N.bugunSana(), kalitlar: {} };
    try {
      for (var i = 0; i < ls().length; i++) {
        var k = ls().key(i);
        if (k.indexOf(PREFIKS) === 0 && !/\.(buzilgan|persist)$/.test(k)) r.kalitlar[k] = ls().getItem(k);
      }
    } catch (e) { /* o'qib bo'lmadi */ }
    return r;
  };
  N.hammasiQoy = function (d) {
    if (!d || d.tur !== 'vositalar-zaxira' || !d.kalitlar) return 'Bu fayl umumiy zaxira emas. Har bir vositaning o\'z zaxirasini o\'sha vosita sahifasida tiklang.';
    try {
      Object.keys(d.kalitlar).forEach(function (k) {
        var yangi = k.indexOf(ESKI_PREFIKS) === 0 ? PREFIKS + k.slice(ESKI_PREFIKS.length) : k;
        if (yangi.indexOf(PREFIKS) === 0) ls().setItem(yangi, d.kalitlar[k]);
      });
    } catch (e) { return 'Saqlab bo\'lmadi. Telefon xotirasi to\'lgan bo\'lishi mumkin.'; }
    return null;
  };

  // Buzilgan ma'lumot haqida ogohlantirish
  N.buzilganXabar = function (joy, kalit) {
    var d = document.createElement('div');
    d.className = 'karta qizil';
    d.innerHTML = '<b>Ma\'lumotni o\'qib bo\'lmadi, zaxira nusxadan tiklang.</b>' +
      '<p class="kichik">"Zaxira nusxa" bo\'limidagi "Import" tugmasi bilan oxirgi zaxira faylni tanlang. Zaxira bo\'lmasa — boshidan boshlashingiz mumkin.</p>' +
      '<button class="keng xavfli" data-r="noldan">Boshidan boshlash</button>';
    d.querySelector('[data-r="noldan"]').onclick = function () {
      if (!confirm('Buzilgan ma\'lumot o\'chiriladi va vosita boshidan boshlanadi. Rozimisiz?')) return;
      try { ls().removeItem(kalit); } catch (e) { /* mayli */ }
      location.reload();
    };
    joy.prepend(d);
  };

  // Yangi versiya chiqqanda "Yangilash" tugmasini ko'rsatish
  function yangilanishniKuzat(reg) {
    var bosildi = false;
    function korsat() {
      if (!navigator.serviceWorker.controller || N.$('yangilash')) return;
      var d = document.createElement('div');
      d.id = 'yangilash';
      d.className = 'karta yashil qator';
      d.innerHTML = '<span class="keng">Yangi versiya bor</span><button class="asosiy">Yangilash</button>';
      d.querySelector('button').onclick = function () {
        bosildi = true;
        if (reg.waiting) reg.waiting.postMessage('yangila'); else location.reload();
      };
      (document.querySelector('main') || document.body).prepend(d);
    }
    if (reg.waiting) korsat();
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (w) w.addEventListener('statechange', function () { if (w.state === 'installed') korsat(); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (bosildi) location.reload(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
  }

  // Ma'lumot o'chib ketmasligini so'rash va service worker'ni ulash
  N.ishgaTush = function () {
    try {
      if (navigator.storage && navigator.storage.persist && !ls().getItem(PREFIKS + 'persist')) {
        navigator.storage.persist().then(function () { ls().setItem(PREFIKS + 'persist', '1'); }).catch(function () {});
      }
    } catch (e) { /* muhim emas */ }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      var ildiz = new URL('../', N.skriptManzil).href; // umumiy/ papkasidan bir pog'ona yuqori
      navigator.serviceWorker.register(ildiz + 'sw.js', { scope: ildiz }).then(yangilanishniKuzat).catch(function () {});
    }
  };
  N.skriptManzil = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';

  if (typeof global.localStorage !== 'undefined') N.kochir();
  global.N = N;
  if (typeof module !== 'undefined') module.exports = N;
})(typeof window !== 'undefined' ? window : globalThis);
