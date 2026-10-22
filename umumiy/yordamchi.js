// Umumiy yordamchi funksiyalar: saqlash, zaxira nusxa, fayl yuklab olish.
// Hamma ma'lumot faqat shu qurilmada (localStorage) saqlanadi.
(function (global) {
  'use strict';
  var N = {};

  // Sana: YYYY-MM-DD (telefonning mahalliy vaqti bo'yicha)
  N.sanaMatn = function (d) {
    var m = d.getMonth() + 1, k = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (k < 10 ? '0' : '') + k;
  };
  N.bugunSana = function () { return N.sanaMatn(new Date()); };

  // localStorage'dan o'qish. Buzilgan bo'lsa xato:true qaytaradi, ilova qulamaydi.
  N.yukla = function (kalit) {
    try {
      var s = global.localStorage.getItem(kalit);
      if (s === null) return { data: null, xato: false };
      return { data: JSON.parse(s), xato: false };
    } catch (e) {
      return { data: null, xato: true };
    }
  };
  N.saqla = function (kalit, data) {
    try {
      global.localStorage.setItem(kalit, JSON.stringify(data));
      return true;
    } catch (e) {
      N.xabar('Saqlab bo\'lmadi: xotira to\'lgan bo\'lishi mumkin');
      return false;
    }
  };

  // Faylni yuklab olish
  N.yuklabOl = function (nom, matn, turi, bom) {
    var blob = new Blob([(bom ? '﻿' : '') + matn], { type: (turi || 'text/plain') + ';charset=utf-8' });
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
      t.value = matn; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* bo'lmasa ham mayli */ }
      t.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(matn).catch(eski);
    } else eski();
    N.xabar('Nusxalandi ✓');
  };

  // Qisqa xabar (pastda chiqadi)
  var xabarTaymer;
  N.xabar = function (matn) {
    if (typeof document === 'undefined') return;
    var el = document.getElementById('xabar');
    if (!el) { el = document.createElement('div'); el.id = 'xabar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = matn;
    el.classList.add('korin');
    clearTimeout(xabarTaymer);
    xabarTaymer = setTimeout(function () { el.classList.remove('korin'); }, 2500);
  };

  // HTML ichiga xavfsiz matn qo'yish
  N.h = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // "Zaxira nusxa" bo'limini chizish (eksport/import)
  // opt: { kalit, prefiks, olish: () => data, tiklash: (data) => void, saqlandi: () => void }
  N.zaxiraBolimi = function (joy, opt) {
    joy.innerHTML =
      '<div class="karta"><h2 style="margin-top:0">Zaxira nusxa</h2>' +
      '<p class="xira kichik">Ma\'lumot faqat shu qurilmada. Telefon almashsa yoki brauzer tozalansa yo\'qolmasligi uchun vaqti-vaqti bilan faylga saqlab qo\'ying.</p>' +
      '<div class="qator"><button class="asosiy keng" data-r="eks">⬇️ Eksport (.json)</button></div>' +
      '<div class="qator" style="margin-top:10px"><label class="tugma keng">⬆️ Import (fayldan tiklash)' +
      '<input type="file" accept=".json,application/json" class="yashirin" data-r="imp"></label></div></div>';
    joy.querySelector('[data-r="eks"]').onclick = function () {
      var data = opt.olish();
      N.yuklabOl(opt.prefiks + '-zaxira-' + N.bugunSana() + '.json', JSON.stringify(data, null, 1), 'application/json');
      if (opt.saqlandi) opt.saqlandi();
      N.xabar('Zaxira fayl yuklab olindi');
    };
    var inp = joy.querySelector('[data-r="imp"]');
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) return;
      N.faylOqi(f).then(function (matn) {
        var data;
        try { data = JSON.parse(matn); } catch (e) { alert('Fayl buzilgan yoki noto\'g\'ri formatda.'); return; }
        if (!confirm('Hozirgi ma\'lumot almashtiriladi, rozimisiz?')) return;
        opt.tiklash(data);
        N.xabar('Ma\'lumot tiklandi ✓');
      }).finally(function () { inp.value = ''; });
    };
  };

  // Buzilgan ma'lumot haqida ogohlantirish
  N.buzilganXabar = function (joy) {
    var d = document.createElement('div');
    d.className = 'karta qizil';
    d.innerHTML = '<b>Ma\'lumotni o\'qib bo\'lmadi, zaxira nusxadan tiklang.</b><p class="kichik xira">Pastdagi "Zaxira nusxa" bo\'limidan "Import" tugmasini bosing.</p>';
    joy.prepend(d);
  };

  // Ma'lumot o'chib ketmasligini so'rash va service worker'ni ulash
  N.ishgaTush = function () {
    try {
      if (navigator.storage && navigator.storage.persist && !global.localStorage.getItem('nader.persist')) {
        navigator.storage.persist().then(function () { global.localStorage.setItem('nader.persist', '1'); });
      }
    } catch (e) { /* muhim emas */ }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      var ildiz = new URL('../', N.skriptManzil).href; // umumiy/ papkasidan bir pog'ona yuqori
      navigator.serviceWorker.register(ildiz + 'sw.js', { scope: ildiz }).catch(function () {});
    }
  };
  N.skriptManzil = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';

  global.N = N;
  if (typeof module !== 'undefined') module.exports = N;
})(typeof window !== 'undefined' ? window : globalThis);
