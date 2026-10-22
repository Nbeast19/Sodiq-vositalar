// Hifz: Qur'on yodlash va murojaa ilovasi.
// Yuqori qism — sof mantiq (Node'da sinash mumkin), pastki qism — interfeys.
(function (global) {
  'use strict';
  var M = global.Mushaf || (typeof require !== 'undefined' ? require('./mushaf.js') : null);
  var N = global.N || (typeof require !== 'undefined' ? require('../umumiy/yordamchi.js') : null);
  var KALIT = 'vositalar.hifz.v1';
  var HAFTA = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

  var H = { KALIT: KALIT, HAFTA: HAFTA };

  // ---------- Boshlang'ich sozlamalar ----------
  H.standart = function (bugun) {
    return {
      v: 1,
      sozlandi: false,
      yaratilgan: bugun || null,
      oxirgiZaxira: null,
      sozlama: {
        bosqichlar: [],
        kunlik: 1,          // 0.5 / 1 / 2 sahifa
        takror: 20,
        murojaa: 5,         // hajmi
        murojaaBirlik: 'sahifa', // 'sahifa' yoki 'juz'
        kunBoshi: '03:00',
        ustozKunlari: [],
        damKunlari: []
      },
      oldin: [],       // oldin yodlangan qismlar: { dan, gacha, holat: 'kuchli' | 'zaif' }
      joriy: null,     // { p, q, sanoq } — hozir yodlanayotgan sahifa (q: 0 to'liq, 1/2 yarmi)
      yodlangan: {},   // sahifa -> yodlangan kun
      yarim: {},       // sahifa -> 1 (birinchi yarmi yodlangan, 0.5 rejimida)
      oxirgiTakror: {},// sahifa -> oxirgi takrorlangan kun
      qiyin: {},       // sahifa -> belgilangan kun
      kunlar: {}       // kun -> { kv, dam, yangi, qoshimcha, rev:[], bajar:[], oldingi:{}, ustoz }
    };
  };

  // Eski yoki chala ma'lumotni standart qiymatlar bilan to'ldirish
  H.normal = function (s) {
    var st = H.standart(N.bugunSana());
    s = N.toldir(s, st);
    s.sozlama = N.toldir(s.sozlama, st.sozlama);
    ['yodlangan', 'yarim', 'oxirgiTakror', 'qiyin', 'kunlar'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    if (!Array.isArray(s.oldin)) s.oldin = [];
    ['bosqichlar', 'ustozKunlari', 'damKunlari'].forEach(function (k) { if (!Array.isArray(s.sozlama[k])) s.sozlama[k] = []; });
    return s;
  };

  // Tayyor shablonlar (yangi yodlash tartibi)
  H.SHABLONLAR = [
    ['boshidan', 'Boshidan oxirigacha', 'Fotihadan Nos surasigacha, sahifa ketidan sahifa'],
    ['oxiridan', 'Oxiridan boshiga', '30-juzdan boshlab 1-juzgacha; har juz ichida oldinga qarab'],
    ['ozim', 'O\'zim tanlayman', 'Bosqichlarni sura yoki sahifa raqami bilan o\'zim qo\'shaman']
  ];
  H.shablon = function (nom) {
    if (nom === 'boshidan') return [{ dan: 1, gacha: 604 }];
    if (nom === 'oxiridan') {
      var r = [];
      for (var j = 30; j >= 1; j--) r.push({ dan: M.JUZLAR[j - 1], gacha: j === 30 ? 604 : M.JUZLAR[j] - 1 });
      return r;
    }
    return [];
  };

  // ---------- Sana bilan ishlash ----------
  // "Kun boshlanishi"dan oldingi vaqt oldingi kunga hisoblanadi
  H.kunKaliti = function (sana, kunBoshi) {
    var qism = String(kunBoshi || '00:00').split(':');
    return N.sanaMatn(new Date(sana.getTime() - ((+qism[0] || 0) * 60 + (+qism[1] || 0)) * 60000));
  };
  function kalitSana(k) { var a = k.split('-'); return new Date(+a[0], +a[1] - 1, +a[2], 12); }
  H.kunQosh = function (k, n) {
    var d = kalitSana(k); d.setDate(d.getDate() + n);
    return N.sanaMatn(d);
  };
  H.farq = function (a, b) { return Math.round((kalitSana(b) - kalitSana(a)) / 86400000); }; // b - a, kunlarda
  H.haftaKuni = function (k) { return kalitSana(k).getDay(); };

  // ---------- Yangi yodlash ----------
  H.ketmaKetlik = function (s) {
    var r = [], bor = {};
    s.sozlama.bosqichlar.forEach(function (b) {
      for (var p = b.dan; p <= b.gacha; p++) if (!bor[p]) { bor[p] = 1; r.push(p); }
    });
    return r;
  };
  H.kvota = function (s) { return s.sozlama.kunlik === 2 ? 2 : 1; };
  H.keyingiBirlik = function (s) {
    var k = H.ketmaKetlik(s);
    for (var i = 0; i < k.length; i++) {
      var p = k[i];
      if (s.yodlangan[p]) continue;
      if (s.sozlama.kunlik === 0.5) return { p: p, q: s.yarim[p] ? 2 : 1 };
      return { p: p, q: 0 };
    }
    return null; // hammasi yodlangan
  };

  // Kun yozuvini olish (bo'lmasa yaratadi va murojaa ro'yxatini bir marta tanlaydi)
  H.kun = function (s, k) {
    var r = s.kunlar[k];
    if (!r) {
      var dam = s.sozlama.damKunlari.indexOf(H.haftaKuni(k)) >= 0;
      r = s.kunlar[k] = { kv: dam ? 0 : H.kvota(s), dam: dam, yangi: 0, qoshimcha: 0, rev: [], bajar: [], oldingi: {}, ustoz: null };
      r.rev = H.murojaaTanla(s, k);
    }
    return r;
  };

  // Hozirgi yodlanayotgan birlik (yoki null — bugungi reja bajarilgan)
  H.joriy = function (s, k) {
    var r = H.kun(s, k);
    var kerak = H.keyingiBirlik(s);
    if (s.joriy && (!kerak || s.joriy.p !== kerak.p || s.joriy.q !== kerak.q)) {
      if (!s.joriy.sanoq) s.joriy = null; // sozlama o'zgargan bo'lsa
    }
    if (s.joriy) return s.joriy;
    if (!kerak) return null;
    if (r.yangi >= r.kv + r.qoshimcha) return null;
    s.joriy = { p: kerak.p, q: kerak.q, sanoq: 0 };
    return s.joriy;
  };

  // +1 bosildi. Qaytaradi: null yoki { tugadi: birlik }
  H.qoshBir = function (s, k) {
    var j = H.joriy(s, k);
    if (!j) return null;
    j.sanoq++;
    if (j.sanoq < s.sozlama.takror) return null;
    var r = H.kun(s, k);
    if (j.q === 1) s.yarim[j.p] = 1;
    else {
      s.yodlangan[j.p] = k;
      s.oxirgiTakror[j.p] = k;
      delete s.yarim[j.p];
    }
    r.yangi++;
    s.joriy = null;
    return { tugadi: j };
  };
  H.ayirBir = function (s, k) {
    var j = H.joriy(s, k);
    if (j && j.sanoq > 0) j.sanoq--;
  };
  H.yanaOlish = function (s, k) {
    var r = H.kun(s, k);
    r.qoshimcha = Math.max(r.qoshimcha, r.yangi - r.kv + 1);
  };

  // ---------- Murojaa ----------
  H.havza = function (s) {
    var h = {};
    s.oldin.forEach(function (o) {
      for (var p = o.dan; p <= o.gacha; p++) h[p] = { zaif: o.holat === 'zaif' || (h[p] && h[p].zaif) };
    });
    Object.keys(s.yodlangan).forEach(function (p) { if (!h[p]) h[p] = { zaif: false }; });
    return h;
  };
  H.murojaaSoni = function (s) {
    var n = +s.sozlama.murojaa || 0;
    return s.sozlama.murojaaBirlik === 'juz' ? n * 20 : n;
  };
  H.murojaaTanla = function (s, k) {
    var N = H.murojaaSoni(s);
    var h = H.havza(s);
    var nomzod = [];
    Object.keys(h).forEach(function (ps) {
      var p = +ps, oxirgi = s.oxirgiTakror[p];
      var otdi = oxirgi ? H.farq(oxirgi, k) : 1000; // necha kun takrorlanmagan
      if (otdi < 1) return; // bugun takrorlangan
      var ball = otdi * ((h[p].zaif || s.qiyin[p]) ? 2 : 1); // zaif/qiyin — ikki baravar tez
      var yosh = s.yodlangan[p] ? H.farq(s.yodlangan[p], k) : 99;
      if (yosh <= 7) {
        // yangi yodlangan: dastlabki 3 kun har kuni, keyin kun ora
        if (otdi >= (yosh <= 3 ? 1 : 2)) ball = 100000 - yosh;
      }
      nomzod.push({ p: p, ball: ball });
    });
    nomzod.sort(function (a, b) { return b.ball - a.ball || a.p - b.p; });
    var tanlov = {}, bor = {}, natija = [];
    nomzod.forEach(function (x) { bor[x.p] = 1; });
    // Eng muhim sahifadan boshlab ketma-ket sahifalarni bir guruhga olamiz
    for (var i = 0; i < nomzod.length && natija.length < N; i++) {
      var p = nomzod[i].p;
      while (natija.length < N && bor[p] && !tanlov[p]) { tanlov[p] = 1; natija.push(p); p++; }
    }
    return natija.sort(function (a, b) { return a - b; });
  };
  H.murojaaBelgila = function (s, k, p, holat) {
    var r = H.kun(s, k);
    var i = r.bajar.indexOf(p);
    if (holat && i < 0) {
      r.bajar.push(p);
      r.oldingi[p] = s.oxirgiTakror[p] || null;
      s.oxirgiTakror[p] = k;
    } else if (!holat && i >= 0) {
      r.bajar.splice(i, 1);
      if (r.oldingi[p]) s.oxirgiTakror[p] = r.oldingi[p]; else delete s.oxirgiTakror[p];
      delete r.oldingi[p];
    }
  };
  // Ketma-ket sahifalarni guruhlash: [[434,435,436],[582]]
  H.guruhla = function (sahifalar) {
    var g = [];
    sahifalar.forEach(function (p) {
      var o = g[g.length - 1];
      if (o && o[o.length - 1] === p - 1) o.push(p); else g.push([p]);
    });
    return g;
  };

  // ---------- Kun holati va streak ----------
  // 'toliq' (yashil), 'qisman' (sariq), 'yoq' (kulrang)
  H.kunHolati = function (s, k) {
    var r = s.kunlar[k];
    if (!r) return 'yoq';
    var faol = r.bajar.length > 0 || r.yangi > 0;
    if (!faol) return 'yoq';
    var revOk = r.rev.length ? r.bajar.length >= r.rev.length : true;
    var yangiOk = r.kv === 0 || r.yangi >= r.kv || (!r.yangi && !H.keyingiBirlik(s));
    return revOk && yangiOk ? 'toliq' : 'qisman';
  };
  H.streak = function (s, k) {
    var n = 0, d = H.kunHolati(s, k) === 'toliq' ? k : H.kunQosh(k, -1);
    while (H.kunHolati(s, d) === 'toliq') { n++; d = H.kunQosh(d, -1); }
    return n;
  };
  H.rekord = function (s) {
    var yashil = Object.keys(s.kunlar).filter(function (k) { return H.kunHolati(s, k) === 'toliq'; }).sort();
    var eng = 0, joriy = 0, oldingi = null;
    yashil.forEach(function (k) {
      joriy = (oldingi && H.farq(oldingi, k) === 1) ? joriy + 1 : 1;
      if (joriy > eng) eng = joriy;
      oldingi = k;
    });
    return eng;
  };

  // ---------- Statistika ----------
  H.statistika = function (s, k) {
    var ket = H.ketmaKetlik(s);
    var jami = ket.filter(function (p) { return s.yodlangan[p]; }).length;
    var bosqichlar = s.sozlama.bosqichlar.map(function (b) {
      var n = 0;
      for (var p = b.dan; p <= b.gacha; p++) if (s.yodlangan[p]) n++;
      return { dan: b.dan, gacha: b.gacha, n: n, hammasi: b.gacha - b.dan + 1 };
    });
    var dushanba = H.kunQosh(k, -((H.haftaKuni(k) + 6) % 7));
    var oyBoshi = k.slice(0, 8) + '01';
    function oraliqda(d, bosh) { return d >= bosh && d <= k; }
    var yangiHafta = 0, yangiOy = 0, revHafta = 0, revOy = 0, oxirgi30 = 0;
    Object.keys(s.yodlangan).forEach(function (p) {
      var d = s.yodlangan[p];
      if (oraliqda(d, dushanba)) yangiHafta++;
      if (oraliqda(d, oyBoshi)) yangiOy++;
      if (oraliqda(d, H.kunQosh(k, -29))) oxirgi30++;
    });
    Object.keys(s.kunlar).forEach(function (d) {
      var n = s.kunlar[d].bajar.length;
      if (oraliqda(d, dushanba)) revHafta += n;
      if (oraliqda(d, oyBoshi)) revOy += n;
    });
    var qoldi = ket.length - jami, tugash = null;
    if (qoldi > 0) {
      var tezlik = oxirgi30 > 0 ? oxirgi30 / 30 : (s.sozlama.kunlik || 1);
      tugash = H.kunQosh(k, Math.ceil(qoldi / tezlik));
    }
    return { jami: jami, hammasi: ket.length, bosqichlar: bosqichlar, yangiHafta: yangiHafta, yangiOy: yangiOy,
      revHafta: revHafta, revOy: revOy, tugash: tugash, tezlik30: oxirgi30 };
  };

  H.zaxiraEslatma = function (s, k) {
    var oxirgi = s.oxirgiZaxira || s.yaratilgan;
    return !!oxirgi && H.farq(oxirgi, k) > 7;
  };
  // Bosh sahifa uchun: bugungi yangi sahifa hali yodlanmaganmi?
  H.bugunKutyapti = function (s, k) {
    if (!s || !s.sozlandi) return false;
    var r = s.kunlar[k];
    var dam = s.sozlama.damKunlari.indexOf(H.haftaKuni(k)) >= 0;
    if (dam || !H.keyingiBirlik(s)) return false;
    return !r || r.yangi < r.kv;
  };

  global.Hifz = H;
  if (typeof module !== 'undefined') module.exports = H;

  // =====================================================================
  // ---------- Interfeys ----------
  if (typeof document === 'undefined' || !document.getElementById('hifz-ilova')) return;
  var h = N.h;
  var holat, buzilgan = false, ekran = 'bugun', tahrir = null, chizilganKun = null;

  function yuklash() {
    var r = N.yukla(KALIT);
    buzilgan = r.xato;
    holat = H.normal(r.data && r.data.sozlama ? r.data : null);
    if (!holat.yaratilgan) holat.yaratilgan = N.bugunSana();
  }
  function saqlash() { if (!buzilgan) N.saqla(KALIT, holat); }
  function bugun() { return H.kunKaliti(new Date(), holat.sozlama.kunBoshi); }
  function birlikNomi(j) { return j.p + '-sahifa' + (j.q === 1 ? ' (1-yarmi)' : j.q === 2 ? ' (2-yarmi)' : ''); }
  function sahifaMatn(p) {
    return p + '-sahifa · ' + M.suraNomi(p) + ' surasi · ' + M.juz(p) + '-juz';
  }

  var ilova = document.getElementById('hifz-ilova');

  function chiz() {
    if (!holat.sozlandi && ekran !== 'zaxira') ekran = 'sozlash';
    document.querySelectorAll('nav [data-ekran]').forEach(function (b) {
      b.classList.toggle('asosiy', b.getAttribute('data-ekran') === ekran);
    });
    var f = { bugun: bugunEkran, qiyin: qiyinEkran, stat: statEkran, sozlash: sozlashEkran, zaxira: zaxiraEkran }[ekran];
    f();
    if (buzilgan) N.buzilganXabar(ilova, KALIT);
  }

  // ----- Bosh ekran -----
  function bugunEkran() {
    var k = bugun();
    chizilganKun = k;
    var r = H.kun(holat, k);
    var j = H.joriy(holat, k);
    saqlash();
    var html = '';
    if (H.zaxiraEslatma(holat, k)) {
      html += '<div class="karta sariq kichik">💾 Zaxira nusxa olishni unutmang. <a href="#" data-a="zaxiraga">Hozir olish</a></div>';
    }
    var st = H.streak(holat, k);
    html += '<div class="karta" style="text-align:center"><div class="katta-raqam">🔥 ' + st + '</div>' +
      '<div>kun ketma-ket</div><div class="xira kichik">Rekord: ' + Math.max(H.rekord(holat), st) + '</div></div>';

    // Yangi sahifa
    if (j) {
      html += '<div class="karta"><div class="xira kichik">' + (r.dam ? 'Bugun dam olish kuni (ixtiyoriy)' : 'Bugungi yangi sahifa') + '</div>' +
        '<h2 style="margin:4px 0">' + h(birlikNomi(j)) + '</h2>' +
        '<div>' + h(M.suraNomi(j.p)) + ' surasi · ' + M.juz(j.p) + '-juz · <span lang="ar" dir="rtl">' + h(M.suraNomiAr(j.p)) + '</span></div>' +
        '<div class="katta-raqam" style="font-size:44px;margin-top:8px">Takror: ' + j.sanoq + ' / ' + holat.sozlama.takror + '</div>' +
        '<div class="progress"><div style="width:' + Math.min(100, j.sanoq / holat.sozlama.takror * 100) + '%"></div></div>' +
        '<button class="asosiy keng" data-a="plus" style="min-height:120px;font-size:28px;margin-top:14px">Takrorladim +1</button>' +
        '<div class="qator" style="margin-top:10px"><button data-a="minus" style="min-width:90px">−1</button>' +
        '<button data-a="qiyin" data-p="' + j.p + '" class="keng">' + (holat.qiyin[j.p] ? '⚠️ Qiyin (olib tashlash)' : '⚠️ Qiyin deb belgilash') + '</button></div></div>';
    } else {
      var kel = H.keyingiBirlik(holat);
      if (!kel) html += '<div class="karta yashil"><h2 style="margin:0">Barakalloh! Rejadagi hamma sahifalar yodlandi ✓</h2></div>';
      else {
        html += '<div class="karta ' + (r.dam && !r.yangi ? '' : 'yashil') + '">' +
          (r.dam && !r.yangi ? '<b>Bugun dam olish kuni</b> — yangi yodlash talab qilinmaydi.' : '<b>Bugungi yangi sahifa yodlandi ✓</b>') +
          '<p class="xira">Keyingisi: ' + h(birlikNomi(kel)) + ' · ' + h(M.suraNomi(kel.p)) + ' surasi</p>' +
          '<button class="keng" data-a="yana">' + (r.dam && !r.yangi ? 'Baribir yodlash' : 'Yana bir sahifa olish') + '</button></div>';
      }
    }

    // Murojaa
    html += '<h2>Bugungi murojaa</h2>';
    if (!r.rev.length) html += '<div class="karta xira">Murojaa uchun sahifa yo\'q.</div>';
    else {
      var hammasi = r.bajar.length >= r.rev.length;
      if (hammasi) html += '<div class="karta yashil"><b>Bugungi murojaa bajarildi ✓</b></div>';
      var bloklar = r.rev.length <= 10 ? r.rev.map(function (p) { return [p]; }) : H.guruhla(r.rev);
      bloklar.forEach(function (g) {
        var tayyor = g.every(function (p) { return r.bajar.indexOf(p) >= 0; });
        var nom = g.length === 1 ? sahifaMatn(g[0]) : g[0] + '–' + g[g.length - 1] + '-sahifalar · ' + M.suraNomi(g[0]) + ' → ' + M.sahifaSuralari(g[g.length - 1]).slice(-1)[0].uz;
        html += '<div class="karta' + (tayyor ? ' yashil' : '') + '"><div><b>' + h(nom) + '</b></div>' +
          '<div class="qator" style="margin-top:10px">' +
          '<button class="keng' + (tayyor ? '' : ' asosiy') + '" data-a="rev" data-g="' + g.join(',') + '">' + (tayyor ? 'Takrorlandi ✓ (bekor qilish)' : 'Takrorladim ✓') + '</button>' +
          (g.length === 1 ? '<button data-a="qiyin" data-p="' + g[0] + '" title="Qiyin" aria-label="Qiyin deb belgilash" style="min-width:64px">' + (holat.qiyin[g[0]] ? '⚠️✓' : '⚠️') + '</button>' : '') +
          '</div></div>';
      });
    }

    // Ustozga topshirish
    if (holat.sozlama.ustozKunlari.indexOf(H.haftaKuni(k)) >= 0) {
      html += '<h2>Ustozga topshirish</h2><div class="karta">';
      if (r.ustoz) {
        html += '<b>Topshirildi ✓</b> — ' + h(r.ustoz.p) + '-sahifa' +
          '<div style="margin-top:10px"><button data-a="ustozBekor">Bekor qilish</button></div>';
      } else {
        var oxirgi = Object.keys(holat.yodlangan).filter(function (p) { return holat.yodlangan[p] === k; }).map(Number);
        var standart = oxirgi.length ? Math.max.apply(null, oxirgi) : (j ? j.p : '');
        html += '<label>Topshirilgan sahifa: <input type="number" inputmode="numeric" min="1" max="604" id="ustoz-p" value="' + standart + '" style="width:110px"></label>' +
          '<button class="asosiy keng" data-a="ustoz" style="margin-top:10px">Bugun ustozga topshirdim</button>';
      }
      html += '</div>';
    }

    // 30 kunlik kalendar
    html += '<h2>30 kun</h2><div class="kalendar">';
    for (var i = 29; i >= 0; i--) {
      var d = H.kunQosh(k, -i), hol = H.kunHolati(holat, d);
      html += '<div class="kun ' + hol + (i === 0 ? ' bugun' : '') + '" title="' + d + '"><span>' + (+d.slice(8)) + '</span></div>';
    }
    html += '</div><p class="kichik xira">🟩 to\'liq · 🟨 qisman · ⬜ bajarilmagan</p>';
    ilova.innerHTML = html;
  }

  // ----- Qiyin joylar -----
  function qiyinEkran() {
    var ps = Object.keys(holat.qiyin).map(Number).sort(function (a, b) { return a - b; });
    var html = '<h2>Qiyin joylar</h2><div class="karta"><label>Sahifani qiyin deb belgilash:</label>' +
      '<div class="qator" style="margin-top:8px"><input type="number" inputmode="numeric" min="1" max="604" id="qiyin-p" placeholder="Sahifa" style="width:120px">' +
      '<button class="asosiy keng" data-a="qiyinQosh">⚠️ Qo\'shish</button></div></div>';
    if (!ps.length) html += '<div class="karta xira">Hozircha qiyin joy belgilanmagan.</div>';
    ps.forEach(function (p) {
      html += '<div class="karta"><b>' + h(sahifaMatn(p)) + '</b><div class="xira kichik">Belgilangan: ' + h(holat.qiyin[p]) + '</div>' +
        '<button class="keng" data-a="qiyin" data-p="' + p + '" style="margin-top:8px">Endi qiyin emas</button></div>';
    });
    ilova.innerHTML = html;
  }

  // ----- Statistika -----
  function statEkran() {
    var k = bugun(), s = H.statistika(holat, k);
    function bar(n, m) { return '<div class="progress"><div style="width:' + (m ? n / m * 100 : 0) + '%"></div></div>'; }
    var html = '<h2>Statistika</h2><div class="karta"><div class="xira">Jami yodlangan (yangi tartib)</div>' +
      '<div class="katta-raqam" style="font-size:40px">' + s.jami + ' / ' + s.hammasi + ' sahifa</div>' + bar(s.jami, s.hammasi) + '</div>';
    s.bosqichlar.forEach(function (b, i) {
      html += '<div class="karta"><b>' + (i + 1) + '-bosqich:</b> ' + h(M.suraNomi(b.dan)) + ' → ' + h(M.sahifaSuralari(b.gacha).slice(-1)[0].uz) +
        ' <span class="xira kichik">(' + b.dan + '–' + b.gacha + ')</span><div>' + b.n + ' / ' + b.hammasi + '</div>' + bar(b.n, b.hammasi) + '</div>';
    });
    html += '<div class="karta"><div>Shu hafta: <b>' + s.yangiHafta + '</b> yangi sahifa, <b>' + s.revHafta + '</b> murojaa sahifasi</div>' +
      '<div>Shu oy: <b>' + s.yangiOy + '</b> yangi sahifa, <b>' + s.revOy + '</b> murojaa sahifasi</div></div>';
    html += '<div class="karta">' + (s.tugash ? 'Taxminiy tugash sanasi: <b>' + s.tugash + '</b><div class="xira kichik">' +
      (s.tezlik30 ? 'Oxirgi 30 kundagi tezlik bo\'yicha' : 'Sozlamadagi kunlik reja bo\'yicha') + '</div>' : 'Hammasi yodlangan ✓') + '</div>';
    ilova.innerHTML = html;
  }

  // ----- Sozlash -----
  function suraTanlov(tur) {
    var o = '<option value="">Sura bo\'yicha…</option>';
    M.SURALAR.forEach(function (s) { o += '<option value="' + s.n + '">' + s.n + '. ' + h(s.uz) + '</option>'; });
    return '<select data-sura="' + tur + '" aria-label="Sura">' + o + '</select>';
  }
  function oraliqQator(o, tur, i) {
    var nom = M.suraNomi(o.dan) + ' → ' + M.sahifaSuralari(Math.min(604, Math.max(1, o.gacha))).slice(-1)[0].uz;
    return '<div class="karta" data-tur="' + tur + '" data-i="' + i + '">' +
      '<div class="qator"><b>' + (tur === 'b' ? (i + 1) + '-bosqich' : 'Qism') + '</b><span class="xira">' + h(nom) + '</span></div>' +
      '<div class="qator" style="margin-top:8px"><label>dan <input type="number" inputmode="numeric" min="1" max="604" data-k="dan" value="' + o.dan + '" style="width:96px"></label>' + suraTanlov('dan') + '</div>' +
      '<div class="qator" style="margin-top:8px"><label>gacha <input type="number" inputmode="numeric" min="1" max="604" data-k="gacha" value="' + o.gacha + '" style="width:96px"></label>' + suraTanlov('gacha') + '</div>' +
      (tur === 'o' ? '<div class="qator" style="margin-top:8px"><label>Holati <select data-k="holat"><option value="kuchli"' + (o.holat === 'kuchli' ? ' selected' : '') + '>kuchli</option><option value="zaif"' + (o.holat === 'zaif' ? ' selected' : '') + '>zaif</option></select></label></div>' : '') +
      '<div class="qator" style="margin-top:8px">' + (tur === 'b' ? '<button data-a="yuqori">↑</button><button data-a="past">↓</button>' : '') +
      '<button class="xavfli" data-a="ochir">O\'chirish</button></div></div>';
  }
  function sozlashEkran() {
    if (!tahrir) tahrir = JSON.parse(JSON.stringify({ sozlama: holat.sozlama, oldin: holat.oldin }));
    var s = tahrir.sozlama;
    var html = '<h2>Sozlash</h2>' + (holat.sozlandi ? '' : '<p>Uch qadam: yodlash tartibini tanlang, oldin yodlagan qismlaringizni qo\'shing (bo\'lsa) va <b>"Tasdiqlash"</b>ni bosing. Keyin hammasini o\'zgartirish mumkin.</p>') +
      '<h3>1. Yangi yodlash tartibi</h3><p class="xira kichik">Tayyor shablonni tanlang yoki bosqichlarni o\'zingiz qo\'shing. Har bosqichda kichik sahifadan kattasiga qarab yodlanadi.</p>';
    H.SHABLONLAR.forEach(function (sh) {
      html += '<button class="keng" data-a="shablon" data-n="' + sh[0] + '" style="margin-bottom:8px;flex-direction:column;align-items:flex-start;text-align:left">' +
        '<b>' + h(sh[1]) + '</b><span class="kichik xira">' + h(sh[2]) + '</span></button>';
    });
    var bosq = '';
    s.bosqichlar.forEach(function (b, i) { bosq += oraliqQator(b, 'b', i); });
    if (s.bosqichlar.length > 3) html += '<details id="bosqichlar"' + (tahrir.ochiq ? ' open' : '') + '><summary>' + s.bosqichlar.length + ' ta bosqich — ko\'rish va o\'zgartirish</summary><div class="ichki">' + bosq + '</div></details>';
    else html += bosq;
    if (!s.bosqichlar.length) html += '<div class="karta xira">Hali bosqich yo\'q. Yuqoridagi shablonlardan birini tanlang yoki pastdagi tugma bilan bosqich qo\'shing.</div>';
    html += '<button class="keng" data-a="bosqichQosh">+ Bosqich qo\'shish</button>';
    html += '<h3>2. Oldin yodlangan qismlar (ixtiyoriy)</h3><p class="xira kichik">Bular murojaaga qo\'shiladi. "Zaif" qismlar ikki baravar tez-tez chiqadi.</p>';
    tahrir.oldin.forEach(function (o, i) { html += oraliqQator(o, 'o', i); });
    html += '<button class="keng" data-a="qismQosh">+ Qism qo\'shish</button>';

    function kunlar(nom, tanlangan) {
      return HAFTA.map(function (n, i) {
        return '<label class="tanlov"><input type="checkbox" data-hafta="' + nom + '" value="' + i + '"' + (tanlangan.indexOf(i) >= 0 ? ' checked' : '') + '> ' + n + '</label>';
      }).join('');
    }
    html += '<h3>3. Boshqa sozlamalar</h3><div class="karta">' +
      '<label>Kunlik yangi yodlash<br><select id="s-kunlik">' + [0.5, 1, 2].map(function (v) {
        return '<option value="' + v + '"' + (s.kunlik === v ? ' selected' : '') + '>' + v + ' sahifa</option>'; }).join('') + '</select></label>' +
      '<p><label>Takror soni<br><input type="number" inputmode="numeric" min="1" max="200" id="s-takror" value="' + s.takror + '"></label></p>' +
      '<p><label>Kunlik murojaa hajmi<br><span class="qator"><input type="number" inputmode="numeric" min="0" max="604" id="s-murojaa" value="' + s.murojaa + '" style="width:100px">' +
      '<select id="s-birlik"><option value="sahifa"' + (s.murojaaBirlik === 'sahifa' ? ' selected' : '') + '>sahifa</option><option value="juz"' + (s.murojaaBirlik === 'juz' ? ' selected' : '') + '>juz</option></select></span></label></p>' +
      '<p><label>Kun boshlanishi (bu vaqtgacha qilingan ish oldingi kunga hisoblanadi)<br><input type="time" id="s-kunboshi" value="' + h(s.kunBoshi) + '"></label></p></div>' +
      '<div class="karta"><b>Ustozga topshirish kunlari</b> <span class="xira kichik">(ixtiyoriy; tanlangan kunlarda "Ustozga topshirdim" tugmasi chiqadi)</span>' + kunlar('ustoz', s.ustozKunlari) + '</div>' +
      '<div class="karta"><b>Dam olish kunlari</b> <span class="xira kichik">(yangi yodlash talab qilinmaydi, faqat murojaa)</span>' + kunlar('dam', s.damKunlari) + '</div>' +
      '<button class="asosiy keng" data-a="tasdiq">Tasdiqlash</button>' +
      (holat.sozlandi ? '<button class="keng" data-a="bekor" style="margin-top:10px">Bekor qilish</button>' : '');
    ilova.innerHTML = html;
  }
  function tahrirOqi() {
    // Formadagi qiymatlarni tahrir obyektiga o'qish
    var det = document.getElementById('bosqichlar');
    if (det) tahrir.ochiq = det.open;
    ilova.querySelectorAll('[data-tur]').forEach(function (el) {
      var ro = el.getAttribute('data-tur') === 'b' ? tahrir.sozlama.bosqichlar : tahrir.oldin;
      var o = ro[+el.getAttribute('data-i')];
      el.querySelectorAll('[data-k]').forEach(function (inp) {
        var k = inp.getAttribute('data-k');
        o[k] = k === 'holat' ? inp.value : Math.round(+inp.value);
      });
    });
    var s = tahrir.sozlama;
    s.kunlik = +document.getElementById('s-kunlik').value;
    s.takror = Math.max(1, Math.round(+document.getElementById('s-takror').value) || 20);
    s.murojaa = Math.max(0, Math.round(+document.getElementById('s-murojaa').value) || 0);
    s.murojaaBirlik = document.getElementById('s-birlik').value;
    s.kunBoshi = document.getElementById('s-kunboshi').value || '03:00';
    s.ustozKunlari = []; s.damKunlari = [];
    ilova.querySelectorAll('[data-hafta]').forEach(function (c) {
      if (c.checked) (c.getAttribute('data-hafta') === 'ustoz' ? s.ustozKunlari : s.damKunlari).push(+c.value);
    });
  }
  function tahrirTekshir() {
    var hammasi = tahrir.sozlama.bosqichlar.concat(tahrir.oldin);
    for (var i = 0; i < hammasi.length; i++) {
      var o = hammasi[i];
      if (!(o.dan >= 1 && o.gacha <= 604 && o.dan <= o.gacha)) {
        var nom = i < tahrir.sozlama.bosqichlar.length ? (i + 1) + '-bosqich' : 'Oldin yodlangan ' + (i - tahrir.sozlama.bosqichlar.length + 1) + '-qism';
        return nom + ': sahifa raqamlari 1 dan 604 gacha bo\'lsin va "dan" raqami "gacha"dan katta bo\'lmasin.';
      }
    }
    if (!tahrir.sozlama.bosqichlar.length) return 'Kamida bitta bosqich kerak. Shablonlardan birini tanlang yoki "+ Bosqich qo\'shish"ni bosing.';
    return null;
  }

  function zaxiraEkran() {
    ilova.innerHTML = '<div id="zaxira-joy"></div>';
    N.zaxiraBolimi(document.getElementById('zaxira-joy'), {
      prefiks: 'hifz',
      olish: function () { holat.oxirgiZaxira = bugun(); saqlash(); return holat; },
      kalit: KALIT,
      tiklash: function (d) {
        if (!d.sozlama || !d.kunlar) return 'Bu fayl Hifz zaxira nusxasi emas. "hifz-zaxira-..." nomli faylni tanlang.';
        holat = H.normal(d); buzilgan = false; tahrir = null; saqlash(); ekran = 'bugun'; chiz();
        return null;
      }
    });
  }

  // ----- Tugmalar -----
  ilova.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]');
    if (!b) return;
    var a = b.getAttribute('data-a'), k = bugun();
    // Ilova ochiq turganda yangi kun boshlangan bo'lsa — avval ekranni yangilaymiz
    if (ekran === 'bugun' && chizilganKun && k !== chizilganKun) { N.xabar('Yangi kun boshlandi'); chiz(); return; }
    if (a === 'zaxiraga') { e.preventDefault(); ekran = 'zaxira'; chiz(); return; }
    if (a === 'plus') {
      N.tebran();
      var natija = H.qoshBir(holat, k);
      saqlash();
      if (natija) N.xabar('Barakalloh! ' + birlikNomi(natija.tugadi) + ' yodlandi ✓');
    } else if (a === 'minus') { H.ayirBir(holat, k); saqlash(); }
    else if (a === 'yana') { H.yanaOlish(holat, k); saqlash(); }
    else if (a === 'rev') {
      var g = b.getAttribute('data-g').split(',').map(Number);
      var r = H.kun(holat, k);
      var tayyor = g.every(function (p) { return r.bajar.indexOf(p) >= 0; });
      g.forEach(function (p) { H.murojaaBelgila(holat, k, p, !tayyor); });
      if (!tayyor) N.tebran();
      saqlash();
    } else if (a === 'qiyin') {
      var p = +b.getAttribute('data-p');
      if (holat.qiyin[p]) delete holat.qiyin[p]; else holat.qiyin[p] = k;
      saqlash();
    } else if (a === 'qiyinQosh') {
      var q = Math.round(+document.getElementById('qiyin-p').value);
      if (!(q >= 1 && q <= 604)) { N.xabar('Sahifa raqami 1–604 oralig\'ida bo\'lsin'); return; }
      holat.qiyin[q] = k; saqlash();
    } else if (a === 'ustoz') {
      var up = Math.round(+document.getElementById('ustoz-p').value) || null;
      H.kun(holat, k).ustoz = { p: up, vaqt: new Date().toISOString() }; saqlash();
    } else if (a === 'ustozBekor') { H.kun(holat, k).ustoz = null; saqlash(); }
    else if (a === 'shablon') {
      tahrirOqi();
      tahrir.sozlama.bosqichlar = H.shablon(b.getAttribute('data-n'));
      N.xabar(tahrir.sozlama.bosqichlar.length ? 'Shablon tanlandi: ' + tahrir.sozlama.bosqichlar.length + ' ta bosqich' : 'Endi "+ Bosqich qo\'shish" tugmasi bilan bosqich qo\'shing');
    } else if (a === 'bosqichQosh' || a === 'qismQosh') {
      tahrirOqi();
      if (a === 'bosqichQosh') tahrir.sozlama.bosqichlar.push({ dan: 1, gacha: 1 });
      else tahrir.oldin.push({ dan: 1, gacha: 1, holat: 'kuchli' });
    } else if (a === 'ochir' || a === 'yuqori' || a === 'past') {
      tahrirOqi();
      var el = b.closest('[data-tur]'), i = +el.getAttribute('data-i');
      var ro = el.getAttribute('data-tur') === 'b' ? tahrir.sozlama.bosqichlar : tahrir.oldin;
      if (a === 'ochir') ro.splice(i, 1);
      else {
        var j = a === 'yuqori' ? i - 1 : i + 1;
        if (j < 0 || j >= ro.length) return;
        var t = ro[i]; ro[i] = ro[j]; ro[j] = t;
      }
    } else if (a === 'tasdiq') {
      tahrirOqi();
      var xato = tahrirTekshir();
      if (xato) { alert(xato); return; }
      holat.sozlama = tahrir.sozlama; holat.oldin = tahrir.oldin;
      // Bugungi kun yozuvi hali bo'sh bo'lsa, murojaani yangi sozlama bilan qayta tanlaymiz
      var rk = holat.kunlar[H.kunKaliti(new Date(), holat.sozlama.kunBoshi)];
      if (rk && !rk.bajar.length && !rk.yangi) delete holat.kunlar[H.kunKaliti(new Date(), holat.sozlama.kunBoshi)];
      if (holat.joriy && !holat.joriy.sanoq) holat.joriy = null;
      holat.sozlandi = true; tahrir = null; saqlash(); ekran = 'bugun';
      N.xabar('Sozlamalar saqlandi ✓');
    } else if (a === 'bekor') { tahrir = null; ekran = 'bugun'; }
    else return;
    chiz();
  });
  // Sura tanlansa — sahifa raqamini to'ldirish
  ilova.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-sura]');
    if (!sel || !sel.value) return;
    var n = +sel.value, tur = sel.getAttribute('data-sura');
    var inp = sel.closest('.qator').querySelector('[data-k="' + tur + '"]');
    inp.value = tur === 'dan' ? M.SURALAR[n - 1].bosh : M.suraOxiri(n);
    tahrirOqi(); chiz();
  });
  document.querySelector('nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ekran]');
    if (!b) return;
    ekran = b.getAttribute('data-ekran'); tahrir = null; chiz(); window.scrollTo(0, 0);
  });
  // Ilova orqa fondan qaytganda (masalan, ertasi kuni) yangilash
  document.addEventListener('visibilitychange', function () { if (!document.hidden && ekran === 'bugun') chiz(); });

  yuklash();
  chiz();
  N.ishgaTush();
})(typeof window !== 'undefined' ? window : globalThis);
