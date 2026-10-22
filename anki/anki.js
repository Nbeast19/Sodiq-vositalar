// Anki: tab bilan ajratilgan faylni tekshirish va tozalash.
// Yuqori qism — sof mantiq (Node'da sinash mumkin), pastki qism — interfeys.
(function (global) {
  'use strict';
  var N = global.N || (typeof require !== 'undefined' ? require('../umumiy/yordamchi.js') : null);
  var KALIT = 'vositalar.anki.v1';
  var A = { KALIT: KALIT };

  A.SARLAVHA = ['#separator:tab', '#html:true', '#deck column:1', '#tags column:4'];

  // Ko'rinmaydigan belgilar: nol kenglikdagi belgilar, yo'nalish belgilari, BOM, yumshoq defis
  var KORINMAS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;

  A.standart = function () {
    return { v: 2, baza: [], kurslar: [], deckBosh: '', oxirlar: [], rejim: 'harakatsiz', alif: true };
  };
  // Eski formatdagi ma'lumotni yangilash. Deck qoidalari bo'lmasa, bazadagi kartalardan aniqlanadi.
  A.normal = function (d) {
    var eski = d && !d.v;
    d = N.toldir(d, A.standart());
    if (!Array.isArray(d.baza)) d.baza = [];
    ['kurslar', 'oxirlar'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    if (eski && d.baza.length) {
      var bosh = {}, oxir = {};
      d.baza.forEach(function (b) {
        var q = String(b.d || '').split('::').map(function (s) { return s.trim(); });
        if (q.length > 1) { bosh[q[0]] = (bosh[q[0]] || 0) + 1; oxir[q[q.length - 1]] = 1; }
      });
      var eng = Object.keys(bosh).sort(function (a, b) { return bosh[b] - bosh[a]; })[0];
      if (eng && bosh[eng] === d.baza.length) d.deckBosh = eng; // hamma deck bir xil boshlansa
      var ox = Object.keys(oxir);
      if (ox.length && ox.length <= 15) d.oxirlar = ox;
    }
    d.v = 2;
    return d;
  };

  // Solishtirish uchun kalit
  A.kalit = function (matn, rejim, alif) {
    var s = String(matn || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return rejim === 'harakatsiz' ? N.harakatsiz(s, alif) : s;
  };

  // Deck yo'lini tekshirish — ogohlantirishlar ro'yxati.
  // qoida: { deckBosh, kurslar, oxirlar } — bo'sh qoidalar tekshirilmaydi
  A.deckTekshir = function (deck, qoida) {
    qoida = qoida || {};
    var q = String(deck).split('::').map(function (s) { return s.trim(); });
    var r = [];
    if (!deck) { r.push('bo\'sh'); return r; }
    if (qoida.deckBosh && q[0] !== qoida.deckBosh) r.push('"' + qoida.deckBosh + '::" bilan boshlanmaydi');
    var kurslar = qoida.kurslar || [];
    if (kurslar.length && !q.some(function (s) { return kurslar.indexOf(s) >= 0; })) r.push('ichida ro\'yxatdagi kurs nomi yo\'q');
    var oxirlar = qoida.oxirlar || [];
    var oxiri = q[q.length - 1];
    if (oxirlar.length && oxirlar.indexOf(oxiri) < 0) r.push('oxiri ruxsat etilganlardan emas: "' + oxiri + '"');
    return r;
  };

  // Faylni qatorlarga ajratish (Anki sarlavha qatorlari chetlab o'tiladi)
  A.qatorlar = function (matn) {
    matn = String(matn || '');
    var korinmas = (matn.match(KORINMAS) || []).length + (matn.match(/\r/g) || []).length;
    var toza = matn.replace(KORINMAS, '').replace(/\r\n?/g, '\n');
    var r = [];
    toza.split('\n').forEach(function (q, i) {
      if (!q.trim()) return;
      if (/^#[a-z ]+:/i.test(q)) return; // #separator:tab, #deck column:1 ...
      r.push({ n: i + 1, ustun: q.split('\t') });
    });
    return { qatorlar: r, korinmas: korinmas };
  };

  // Asosiy tekshiruv. opt: { qoida, baza: [{f, d, m}], rejim, alif }
  A.tekshir = function (matn, opt) {
    opt = opt || {};
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
        natija.xatolar.push(qt.n + '-qator: ' + qt.ustun.length + ' ta ustun bor, 4 ta kerak (ustunlar orasida tab bo\'lsin)');
        return;
      }
      var maydon = qt.ustun.map(function (s) {
        var t = s.replace(/[ \u00A0]{2,}/g, ' ').trim();
        if (t !== s) natija.tuzatildi++;
        return t;
      });
      var k = { n: qt.n, deck: maydon[0], front: maydon[1], back: maydon[2], tags: maydon[3], takror: [] };
      if (!k.front || !k.back) {
        natija.xatolar.push(k.n + '-qator: ' + (!k.front ? 'Front (savol)' : 'Back (javob)') + ' bo\'sh');
        return;
      }
      A.deckTekshir(k.deck, opt.qoida).forEach(function (s) { natija.ogoh.push(k.n + '-qator: deck ' + s); });
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

  // Fayl nomi deck yo'lining birinchi 3 qismidan: "Arab tili::1-dars::Lugat" -> "Arab-tili_1-dars_Lugat.txt"
  A.faylNomi = function (deck) {
    var q = String(deck || '').split('::').map(function (s) { return s.trim().replace(/\s+/g, '-'); }).filter(Boolean);
    if (!q.length) return 'anki-toza.txt';
    return q.slice(0, 3).join('_').replace(/[\\/:*?"<>|]/g, '') + '.txt';
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
  var h = N.h, $ = N.$;
  var holat, natija = null, olibTashla = {}, asliNom = '';

  function royxatOqi(id) { return $(id).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function yuklash() {
    var r = N.yukla(KALIT);
    holat = A.normal(r.data && r.data.baza ? r.data : null);
    if (r.xato) N.buzilganXabar($('anki-ilova'), KALIT);
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
    $('oxirlar').value = holat.oxirlar.join('\n');
    $('deck-bosh').value = holat.deckBosh;
    document.querySelector('input[name="rejim"][value="' + holat.rejim + '"]').checked = true;
    $('alif').checked = !!holat.alif;
  }

  function tekshirish(matn) {
    if (!matn.trim()) { N.xabar('Matn bo\'sh. Faylni tanlang yoki matnni joylashtiring.'); return; }
    natija = A.tekshir(matn, { qoida: holat, baza: holat.baza, rejim: holat.rejim, alif: holat.alif });
    if (!natija.kartalar.length && !natija.xatolar.length) { N.xabar('Karta topilmadi. Har qatorda 4 ta ustun tab bilan ajratilgan bo\'lsin.'); return; }
    olibTashla = {};
    natija.kartalar.forEach(function (k) { if (k.takror.length) olibTashla[k.n] = true; });
    natijaChiz();
    $('natija').scrollIntoView({ behavior: 'smooth' });
  }
  function royxat(nom, r, rang) {
    if (!r.length) return '';
    var korsat = r.slice(0, 200);
    return '<details open><summary>' + h(nom) + ' <span class="belgi ' + rang + '">' + r.length + '</span></summary><div class="ichki"><ul class="royxat">' +
      korsat.map(function (s) { return '<li dir="auto">' + h(s) + '</li>'; }).join('') +
      (r.length > korsat.length ? '<li class="xira">… yana ' + (r.length - korsat.length) + ' ta</li>' : '') + '</ul></div></details>';
  }
  function natijaChiz() {
    var n = natija;
    var rang = n.xatolar.length ? 'qizil' : (n.ogoh.length || n.takrorSoni) ? 'sariq' : 'yashil';
    var html = '<div class="karta ' + rang + '"><b style="font-size:20px">' + h(A.xulosa(n)) + '</b>' +
      (n.tuzatildi ? '<div class="kichik">Ortiqcha bo\'sh joylar avtomatik tuzatildi: ' + n.tuzatildi + ' ta maydon</div>' : '') +
      (n.korinmas ? '<div class="kichik">Ko\'rinmaydigan belgilar tozalandi: ' + n.korinmas + ' ta</div>' : '') +
      (n.xatolar.length ? '<div class="kichik">Xatoli qatorlar toza faylga kiritilmaydi — ularni tuzatib, qayta tekshiring.</div>' : '') + '</div>';
    html += royxat('Xatolar', n.xatolar, 'qizil') + royxat('Deck ogohlantirishlari', n.ogoh, 'sariq') + royxat('Eslatmalar (teglar)', n.eslatma, 'sariq');
    var takrorlar = n.kartalar.filter(function (k) { return k.takror.length; });
    if (takrorlar.length) {
      html += '<h2>Takrorlar</h2><div class="qator"><button class="keng" data-hammasi="1">Hammasini olib tashlash</button><button class="keng" data-hammasi="0">Hammasini qoldirish</button></div>';
      takrorlar.forEach(function (k) {
        html += '<div class="karta"><div><bdi class="ar" lang="ar" style="font-size:24px">' + h(k.front) + '</bdi> <span class="xira kichik">(' + k.n + '-qator)</span></div>' +
          '<ul class="kichik" dir="auto" style="margin:6px 0;padding-inline-start:20px">' + k.takror.map(function (t) { return '<li><bdi>' + h(t) + '</bdi></li>'; }).join('') + '</ul>' +
          '<div class="qator"><label class="tanlov"><input type="radio" name="t' + k.n + '" data-n="' + k.n + '" value="1"' + (olibTashla[k.n] ? ' checked' : '') + '> olib tashlash</label>' +
          '<label class="tanlov"><input type="radio" name="t' + k.n + '" data-n="' + k.n + '" value="0"' + (olibTashla[k.n] ? '' : ' checked') + '> qoldirish</label></div></div>';
      });
    }
    var birinchi = n.kartalar[0];
    html += '<h2>Toza fayl</h2><div class="karta">' +
      '<label class="tanlov"><input type="checkbox" id="sarlavha" checked> Fayl boshiga Anki sarlavha qatorlarini qo\'shish</label>' +
      '<label>Fayl nomi<br><input id="fnom" dir="auto" style="width:100%" value="' + h(birinchi ? A.faylNomi(birinchi.deck) : (asliNom || 'anki-toza.txt')) + '"></label>' +
      '<button class="asosiy keng" id="yukla" style="margin-top:12px"' + (n.kartalar.length ? '' : ' disabled') + '>⬇️ Toza faylni yuklab olish</button>' +
      '<button class="keng" id="bazaga" style="margin-top:10px"' + (n.kartalar.length ? '' : ' disabled') + '>➕ Bu faylni "Oldingi kartalarim" bazasiga qo\'shish</button></div>';
    $('natija').innerHTML = html;
  }

  $('natija').addEventListener('change', function (e) {
    var n = e.target.getAttribute('data-n');
    if (n) olibTashla[n] = e.target.value === '1';
  });
  $('natija').addEventListener('click', function (e) {
    var hammasi = e.target.getAttribute('data-hammasi');
    if (hammasi !== null) {
      natija.kartalar.forEach(function (k) { if (k.takror.length) olibTashla[k.n] = hammasi === '1'; });
      natijaChiz();
    } else if (e.target.id === 'yukla') {
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
    N.faylOqi(f).then(function (m) { $('matn').value = m; asliNom = f.name; tekshirish(m); })
      .catch(function () { N.xabar('Faylni o\'qib bo\'lmadi'); });
    e.target.value = '';
  };
  $('baza-fayl').onchange = function (e) {
    var fl = Array.prototype.slice.call(e.target.files);
    Promise.all(fl.map(function (f) { return N.faylOqi(f).then(function (m) { return A.bazagaYozuvlar(m, f.name); }); }))
      .then(function (r) {
        var yangi = [].concat.apply([], r);
        holat.baza = holat.baza.concat(yangi); saqlash(); bazaChiz();
        N.xabar(yangi.length + ' ta karta bazaga qo\'shildi');
      }).catch(function () { N.xabar('Faylni o\'qib bo\'lmadi'); });
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
  $('qoidalar').addEventListener('change', function () {
    holat.kurslar = royxatOqi('kurslar');
    holat.oxirlar = royxatOqi('oxirlar');
    holat.deckBosh = $('deck-bosh').value.trim();
    saqlash(); N.xabar('Deck qoidalari saqlandi');
  });

  yuklash();
  bazaChiz();
  N.zaxiraBolimi($('zaxira'), {
    prefiks: 'anki',
    kalit: KALIT,
    olish: function () { return holat; },
    tiklash: function (d) {
      if (!Array.isArray(d.baza)) return 'Bu fayl Anki zaxira nusxasi emas. "anki-zaxira-..." nomli faylni tanlang.';
      holat = A.normal(d); saqlash(); bazaChiz();
      return null;
    }
  });
  N.ishgaTush();
})(typeof window !== 'undefined' ? window : globalThis);
