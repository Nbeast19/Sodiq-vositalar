// Anki: tab bilan ajratilgan faylni tekshirish va tozalash.
// Yuqori qism — sof mantiq (Node'da sinash mumkin), pastki qism — interfeys.
(function (global) {
  'use strict';
  var KALIT = 'nader.anki.v1';
  var A = { KALIT: KALIT };

  A.KURSLAR = ['التفسير ٤', 'التوحيد ٤', 'الحديث ٥', 'الحسبة', 'النحو ٤', 'فقه الأسرة ١', 'منهج الحوار في الإسلام', 'التحفة الندية شرح العقيدة الواسطية'];
  A.OXIRI = ['Lugat', 'Zetel'];
  A.TURKUMLAR = ['Mufrad-Jam', 'Antonimlar', 'Sinonimlar', 'Fellar', 'Arabcha ta\'riflar'];
  A.SARLAVHA = ['#separator:tab', '#html:true', '#deck column:1', '#tags column:4'];

  // Ko'rinmaydigan belgilar: nol kenglikdagi belgilar, yo'nalish belgilari, BOM, yumshoq defis
  var KORINMAS = /[​-‏‪-‮⁠-⁤﻿­]/g;

  // Solishtirish uchun kalit
  A.kalit = function (matn, rejim, alif) {
    var s = String(matn || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (rejim === 'harakatsiz') {
      s = s.replace(/[ً-ْٰـ]/g, '');
      if (alif) s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
    }
    return s;
  };

  // Deck yo'lini tekshirish — ogohlantirishlar ro'yxati
  A.deckTekshir = function (deck, kurslar) {
    var q = deck.split('::').map(function (s) { return s.trim(); });
    var r = [];
    if (q[0] !== 'najron 6') r.push('"najron 6::" bilan boshlanmaydi');
    if (q.length < 2 || kurslar.indexOf(q[1]) < 0) r.push('kurs nomi ro\'yxatda yo\'q: "' + (q[1] || '') + '"');
    var oxiri = q[q.length - 1];
    var ok = A.OXIRI.indexOf(oxiri) >= 0 || (q[q.length - 2] === 'Lugat' && A.TURKUMLAR.indexOf(oxiri) >= 0);
    if (!ok) r.push('oxiri Lugat / Zetel (yoki ruxsat etilgan kategoriya) emas: "' + oxiri + '"');
    return r;
  };

  // Faylni qatorlarga ajratish (Anki sarlavha qatorlari chetlab o'tiladi)
  A.qatorlar = function (matn) {
    var korinmas = (String(matn).match(KORINMAS) || []).length + (String(matn).match(/\r/g) || []).length;
    var toza = String(matn).replace(KORINMAS, '').replace(/\r\n?/g, '\n');
    var r = [];
    toza.split('\n').forEach(function (q, i) {
      if (!q.trim()) return;
      if (/^#[a-z ]+:/i.test(q)) return; // #separator:tab, #deck column:1 ...
      r.push({ n: i + 1, ustun: q.split('\t') });
    });
    return { qatorlar: r, korinmas: korinmas };
  };

  // Asosiy tekshiruv. opt: { kurslar, baza: [{f, d, m}], rejim, alif }
  A.tekshir = function (matn, opt) {
    opt = opt || {};
    var kurslar = opt.kurslar || A.KURSLAR;
    var q = A.qatorlar(matn);
    var natija = { kartalar: [], xatolar: [], ogoh: [], eslatma: [], tuzatildi: 0, korinmas: q.korinmas };
    var bazaXarita = {};
    (opt.baza || []).forEach(function (b) {
      var k = A.kalit(b.f, opt.rejim, opt.alif);
      (bazaXarita[k] = bazaXarita[k] || []).push(b);
    });
    var faylXarita = {};
    q.qatorlar.forEach(function (qt) {
      if (qt.ustun.length !== 4) {
        natija.xatolar.push(qt.n + '-qator: ' + qt.ustun.length + ' ta ustun bor, 4 ta kerak');
        return;
      }
      var maydon = qt.ustun.map(function (s) {
        var t = s.replace(/[  ]{2,}/g, ' ').trim();
        if (t !== s) natija.tuzatildi++;
        return t;
      });
      var k = { n: qt.n, deck: maydon[0], front: maydon[1], back: maydon[2], tags: maydon[3], takror: [] };
      if (!k.front || !k.back) {
        natija.xatolar.push(k.n + '-qator: ' + (!k.front ? 'Front' : 'Back') + ' bo\'sh');
        return;
      }
      A.deckTekshir(k.deck, kurslar).forEach(function (s) { natija.ogoh.push(k.n + '-qator: deck ' + s); });
      if (/\s/.test(k.tags)) {
        natija.eslatma.push(k.n + '-qator: teglar ichida bo\'sh joy bor ("' + k.tags + '") — Anki\'da bular ' + k.tags.split(' ').length + ' ta alohida teg bo\'ladi');
      }
      var kal = A.kalit(k.front, opt.rejim, opt.alif);
      if (faylXarita[kal]) k.takror.push('shu faylning ' + faylXarita[kal] + '-qatorida bor');
      else faylXarita[kal] = k.n;
      (bazaXarita[kal] || []).forEach(function (b) { k.takror.push('«' + b.m + '»da bor (' + b.d + ')'); });
      natija.kartalar.push(k);
    });
    natija.takrorSoni = natija.kartalar.filter(function (k) { return k.takror.length; }).length;
    return natija;
  };

  A.xulosa = function (n) {
    return n.kartalar.length + ' ta karta · ' + n.xatolar.length + ' ta xato · ' + n.takrorSoni + ' ta takror · ' + (n.tuzatildi + n.korinmas) + ' ta tuzatildi';
  };

  // Toza fayl matni. olibTashla: { qatorRaqami: true }
  A.tozaFayl = function (n, olibTashla, sarlavha) {
    var r = sarlavha ? A.SARLAVHA.slice() : [];
    n.kartalar.forEach(function (k) {
      if (olibTashla && olibTashla[k.n]) return;
      r.push([k.deck, k.front, k.back, k.tags].join('\t'));
    });
    return r.join('\n') + '\n';
  };

  // Fayl nomi deck yo'lidan: najron6_النحو٤_الباب-الأول.txt
  A.faylNomi = function (deck) {
    var q = String(deck || '').split('::').map(function (s) { return s.trim(); });
    if (q.length < 2) return 'anki-toza.txt';
    var qism = [q[0].replace(/\s+/g, ''), q[1].replace(/\s+/g, '')];
    if (q[2]) qism.push(q[2].replace(/\s+/g, '-'));
    return qism.join('_').replace(/[\\/:*?"<>|]/g, '') + '.txt';
  };

  // Bazaga qo'shish uchun fayldan yozuvlar
  A.bazagaYozuvlar = function (matn, manba) {
    var r = [];
    A.qatorlar(matn).qatorlar.forEach(function (q) {
      if (q.ustun.length >= 3 && q.ustun[1].trim()) r.push({ f: q.ustun[1].trim(), d: q.ustun[0].trim(), m: manba });
    });
    return r;
  };

  global.Anki = A;
  if (typeof module !== 'undefined') module.exports = A;

  // =====================================================================
  // ---------- Interfeys ----------
  if (typeof document === 'undefined' || !document.getElementById('anki-ilova')) return;
  var N = global.N, h = N.h;
  var holat, natija = null, olibTashla = {}, asliNom = '';
  function $(id) { return document.getElementById(id); }

  function yuklash() {
    var r = N.yukla(KALIT);
    holat = r.data && r.data.baza ? r.data : { v: 1, baza: [], kurslar: A.KURSLAR.slice(), rejim: 'harakatsiz', alif: true };
    if (r.xato) N.buzilganXabar($('anki-ilova'));
  }
  function saqlash() { N.saqla(KALIT, holat); }

  function bazaChiz() {
    var manbalar = {};
    holat.baza.forEach(function (b) { manbalar[b.m] = (manbalar[b.m] || 0) + 1; });
    $('baza-soni').textContent = holat.baza.length + ' ta karta, ' + Object.keys(manbalar).length + ' ta fayl';
    $('baza-royxat').innerHTML = Object.keys(manbalar).map(function (m) {
      return '<li dir="auto">' + h(m) + ' <span class="xira kichik">(' + manbalar[m] + ')</span></li>';
    }).join('') || '<li class="xira">Baza bo\'sh</li>';
    $('kurslar').value = holat.kurslar.join('\n');
    document.querySelector('input[name="rejim"][value="' + holat.rejim + '"]').checked = true;
    $('alif').checked = !!holat.alif;
  }

  function tekshirish(matn) {
    natija = A.tekshir(matn, { kurslar: holat.kurslar, baza: holat.baza, rejim: holat.rejim, alif: holat.alif });
    olibTashla = {};
    natija.kartalar.forEach(function (k) { if (k.takror.length) olibTashla[k.n] = true; });
    natijaChiz();
    $('natija').scrollIntoView({ behavior: 'smooth' });
  }
  function royxat(nom, r, rang) {
    if (!r.length) return '';
    return '<details open><summary>' + h(nom) + ' <span class="belgi ' + rang + '">' + r.length + '</span></summary><div class="ichki"><ul class="royxat">' +
      r.map(function (s) { return '<li dir="auto">' + h(s) + '</li>'; }).join('') + '</ul></div></details>';
  }
  function natijaChiz() {
    var n = natija;
    var rang = n.xatolar.length ? 'qizil' : (n.ogoh.length || n.takrorSoni) ? 'sariq' : 'yashil';
    var html = '<div class="karta ' + rang + '"><b style="font-size:20px">' + h(A.xulosa(n)) + '</b>' +
      (n.tuzatildi ? '<div class="kichik">Ortiqcha bo\'sh joylar avtomatik tuzatildi: ' + n.tuzatildi + ' ta maydon</div>' : '') +
      (n.korinmas ? '<div class="kichik">Ko\'rinmaydigan belgilar tozalandi: ' + n.korinmas + ' ta</div>' : '') +
      (n.xatolar.length ? '<div class="kichik">Xatoli qatorlar toza faylga kiritilmaydi — tuzatib, qayta tekshiring.</div>' : '') + '</div>';
    html += royxat('Xatolar', n.xatolar, 'qizil') + royxat('Deck ogohlantirishlari', n.ogoh, 'sariq') + royxat('Eslatmalar (teglar)', n.eslatma, 'sariq');
    var takrorlar = n.kartalar.filter(function (k) { return k.takror.length; });
    if (takrorlar.length) {
      html += '<h2>Takrorlar</h2>';
      takrorlar.forEach(function (k) {
        html += '<div class="karta"><div><span class="ar" lang="ar" dir="rtl" style="font-size:24px">' + h(k.front) + '</span> <span class="xira kichik">(' + k.n + '-qator)</span></div>' +
          '<ul class="kichik" dir="auto" style="margin:6px 0;padding-inline-start:20px">' + k.takror.map(function (t) { return '<li><bdi>' + h(t) + '</bdi></li>'; }).join('') + '</ul>' +
          '<div class="qator"><label class="tanlov"><input type="radio" name="t' + k.n + '" data-n="' + k.n + '" value="1"' + (olibTashla[k.n] ? ' checked' : '') + '> olib tashlash</label>' +
          '<label class="tanlov"><input type="radio" name="t' + k.n + '" data-n="' + k.n + '" value="0"' + (olibTashla[k.n] ? '' : ' checked') + '> qoldirish</label></div></div>';
      });
    }
    var birinchi = n.kartalar[0];
    html += '<h2>Toza fayl</h2><div class="karta">' +
      '<label class="tanlov"><input type="checkbox" id="sarlavha" checked> Fayl boshiga Anki sarlavha qatorlarini qo\'shish</label>' +
      '<label>Fayl nomi<br><input id="fnom" dir="auto" style="width:100%" value="' + h(birinchi ? A.faylNomi(birinchi.deck) : (asliNom || 'anki-toza.txt')) + '"></label>' +
      '<button class="asosiy keng" id="yukla" style="margin-top:12px">⬇️ Toza faylni yuklab olish</button>' +
      '<button class="keng" id="bazaga" style="margin-top:10px">➕ Bu faylni "Oldingi kartalarim" bazasiga qo\'shish</button></div>';
    $('natija').innerHTML = html;
  }

  $('natija').addEventListener('change', function (e) {
    var n = e.target.getAttribute('data-n');
    if (n) olibTashla[n] = e.target.value === '1';
  });
  $('natija').addEventListener('click', function (e) {
    if (e.target.id === 'yukla') {
      var nom = $('fnom').value.trim() || 'anki-toza.txt';
      if (!/\.txt$/i.test(nom)) nom += '.txt';
      N.yuklabOl(nom, A.tozaFayl(natija, olibTashla, $('sarlavha').checked));
    } else if (e.target.id === 'bazaga') {
      var yozuv = natija.kartalar.filter(function (k) { return !olibTashla[k.n]; })
        .map(function (k) { return { f: k.front, d: k.deck, m: $('fnom').value.trim() || 'fayl' }; });
      holat.baza = holat.baza.concat(yozuv); saqlash(); bazaChiz();
      N.xabar(yozuv.length + ' ta karta bazaga qo\'shildi');
    }
  });
  $('tekshir').onclick = function () { asliNom = ''; tekshirish($('matn').value); };
  $('fayl').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    N.faylOqi(f).then(function (m) { $('matn').value = m; asliNom = f.name; tekshirish(m); });
    e.target.value = '';
  };
  $('baza-fayl').onchange = function (e) {
    var fl = Array.prototype.slice.call(e.target.files);
    Promise.all(fl.map(function (f) { return N.faylOqi(f).then(function (m) { return A.bazagaYozuvlar(m, f.name); }); }))
      .then(function (r) {
        var yangi = [].concat.apply([], r);
        holat.baza = holat.baza.concat(yangi); saqlash(); bazaChiz();
        N.xabar(yangi.length + ' ta karta bazaga qo\'shildi');
      });
    e.target.value = '';
  };
  $('baza-tozala').onclick = function () {
    if (!confirm('"Oldingi kartalarim" bazasi butunlay o\'chiriladi. Rozimisiz?')) return;
    holat.baza = []; saqlash(); bazaChiz();
  };
  document.querySelectorAll('input[name="rejim"]').forEach(function (r) {
    r.onchange = function () { holat.rejim = r.value; saqlash(); };
  });
  $('alif').onchange = function () { holat.alif = $('alif').checked; saqlash(); };
  $('kurslar').onchange = function () {
    holat.kurslar = $('kurslar').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    saqlash(); N.xabar('Kurslar ro\'yxati saqlandi');
  };

  yuklash();
  bazaChiz();
  N.zaxiraBolimi($('zaxira'), {
    prefiks: 'anki',
    olish: function () { return holat; },
    tiklash: function (d) {
      if (!d || !Array.isArray(d.baza)) { alert('Bu fayl Anki zaxira nusxasi emas.'); return; }
      holat = d; saqlash(); bazaChiz();
    }
  });
  N.ishgaTush();
})(typeof window !== 'undefined' ? window : globalThis);
