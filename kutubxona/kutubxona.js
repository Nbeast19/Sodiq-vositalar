// Kutubxona: YouTube darslar ro'yxatini tozalab, Notion uchun CSV yasash.
// Yuqori qism — sof mantiq (Node'da sinash mumkin), pastki qism — interfeys.
(function (global) {
  'use strict';
  var KALIT = 'nader.kutubxona.v1';
  var K = { KALIT: KALIT };

  K.TURLAR = ['Kitob sharhi', 'Ma\'ruza', 'Fatvo', 'Savol-javob', 'Boshqa'];
  K.MAVZULAR = ['Aqida', 'Hadis', 'Fiqh', 'Tafsir', 'Nahv', 'Odob'];
  K.SOZLAR = ['سؤال', 'جواب', 'فتوى', 'مقطع', 'مقتطفات', 'لقطة', 'shorts', '#shorts'];
  K.USTUNLAR = ['Nomi (arabcha)', 'Nomi (o\'zbekcha)', 'Ustoz', 'Kitob', 'Turi', 'Mavzu', 'Tartib', 'Havola', 'Davomiyligi', 'Eshitildi'];

  // YouTube havolasidan video ID
  K.videoId = function (url) {
    var s = String(url || '').trim();
    var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{3,})/i.exec(s);
    return m ? m[1] : null;
  };
  K.toza = function (id) { return 'https://www.youtube.com/watch?v=' + id; };
  K.shortsmi = function (url) { return /youtube\.com\/shorts\//i.test(url); };

  // Davomiylik -> soniya (12:34, 1:02:33, PT1H2M33S, 45 daqiqa)
  K.soniya = function (s) {
    s = String(s || '').trim();
    if (!s) return null;
    var m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(s);
    if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
    if (m) return m[3] !== undefined ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
    var jami = 0, topildi = false, re = /(\d+(?:[.,]\d+)?)\s*(soat|daqiqa|minut|min|soniya|sekund|sek|s\b|h\b|m\b)/gi;
    while ((m = re.exec(s))) {
      topildi = true;
      var n = parseFloat(m[1].replace(',', '.')), b = m[2].toLowerCase();
      jami += b === 'soat' || b === 'h' ? n * 3600 : /^(daqiqa|minut|min|m)$/.test(b) ? n * 60 : n;
    }
    return topildi ? Math.round(jami) : null;
  };
  K.davomiylik = function (sek) {
    if (sek == null) return '';
    var s = sek % 60, m = Math.floor(sek / 60) % 60, h = Math.floor(sek / 3600);
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  // Arabcha tartib so'zlari (1–30)
  var BIRLAR = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  var BIRLAR2 = ['', 'الحادي', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
  var TARTIB = [];
  (function () {
    var i;
    for (i = 1; i <= 10; i++) TARTIB.push([BIRLAR[i], i]);
    for (i = 1; i <= 9; i++) TARTIB.push([BIRLAR2[i] + ' عشر', 10 + i]);
    TARTIB.push(['العشرون', 20], ['العشرين', 20]);
    for (i = 1; i <= 9; i++) { TARTIB.push([BIRLAR2[i] + ' والعشرون', 20 + i], [BIRLAR2[i] + ' والعشرين', 20 + i]); }
    TARTIB.push(['الثلاثون', 30], ['الثلاثين', 30]);
    for (i = 1; i <= 9; i++) { TARTIB.push([BIRLAR2[i] + ' والثلاثون', 30 + i], [BIRLAR2[i] + ' والثلاثين', 30 + i]); }
    TARTIB.push(['الأربعون', 40], ['الأربعين', 40]);
    // Uzunlari birinchi tekshirilsin ("الحادي عشر" "الحادي"dan oldin)
    TARTIB.sort(function (a, b) { return b[0].length - a[0].length; });
  })();
  function harakatsiz(s) { return s.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي'); }

  // Sarlavhadan dars raqami
  K.darsRaqami = function (sarlavha) {
    var s = String(sarlavha || '').replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 0x06F0; });
    var m = /(?:الدرس|درس|الحلقة|حلقة|المجلس|مجلس|المحاضرة|محاضرة|الشريط|شريط|ح|د|رقم|dars|#)\s*[:.\-]?\s*\(?(\d{1,4})/i.exec(s);
    if (m) return +m[1];
    var hs = harakatsiz(s);
    for (var i = 0; i < TARTIB.length; i++) {
      var soz = harakatsiz(TARTIB[i][0]).replace(/^ال/, '(?:ال)?');
      if (new RegExp('(^|[\\s(\\-–:،])' + soz + '(?=$|[\\s)\\-–:،.])').test(hs)) return TARTIB[i][1];
    }
    m = /(?:^|[^\d])(\d{1,4})(?!\d)/.exec(s);
    return m ? +m[1] : null;
  };

  // Matnni qatorlarga ajratish
  K.oqi = function (matn) {
    var r = [];
    String(matn || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (q) {
      if (!q.trim()) return;
      var u = q.split('\t').map(function (s) { return s.trim(); });
      var sarlavha = '', url = '', dav = '';
      if (u.length === 1) {
        // Faqat havola yoki "sarlavha havola" ko'rinishi
        var m = /(https?:\/\/\S+|(?:www\.|m\.)?youtu(?:\.be|be\.com)\/\S+)/i.exec(u[0]);
        if (m) { url = m[1]; sarlavha = u[0].replace(m[1], '').trim(); } else sarlavha = u[0];
      } else {
        var ui = -1;
        u.forEach(function (s, i) { if (ui < 0 && K.videoId(s)) ui = i; });
        if (ui < 0) ui = 1;
        url = u[ui] || '';
        sarlavha = u.filter(function (s, i) { return i < ui; }).join(' ');
        dav = u[ui + 1] || '';
      }
      r.push({ sarlavha: sarlavha, url: url, dav: dav });
    });
    return r;
  };

  // Filtrlash va tartiblash.
  // opt: { takror, qisqa, chegara (daqiqa), shorts, savol, savolQoldir, sozlar, qaytarilgan: {id: true} }
  K.ishla = function (matn, opt) {
    var qatorlar = K.oqi(matn), kirdi = [], chiqdi = [], korilgan = {};
    var qaytar = opt.qaytarilgan || {};
    qatorlar.forEach(function (q, i) {
      var id = K.videoId(q.url);
      var x = {
        kalit: id || ('q' + i), id: id, sarlavha: q.sarlavha, havola: id ? K.toza(id) : q.url,
        sek: K.soniya(q.dav), raqam: K.darsRaqami(q.sarlavha), belgilar: [], asl: i
      };
      if (!id) x.belgilar.push('YouTube havolasi emas');
      if (x.sek == null) x.belgilar.push('davomiylik yo\'q');
      var sabab = null;
      if (opt.takror && id && korilgan[id]) sabab = 'takroriy havola';
      else if (opt.shorts && K.shortsmi(q.url)) sabab = 'shorts';
      else if (opt.qisqa && x.sek != null && x.sek < (opt.chegara || 10) * 60) sabab = 'qisqa video';
      else if (opt.savol) {
        var past = q.sarlavha.toLowerCase();
        var soz = (opt.sozlar || K.SOZLAR).filter(function (w) { return w && past.indexOf(w.toLowerCase()) >= 0; })[0];
        if (soz) { x.belgilar.push('savol-javob/klip: «' + soz + '»'); if (!opt.savolQoldir) sabab = 'savol-javob/klip («' + soz + '»)'; }
      }
      if (id) korilgan[id] = true;
      var qkalit = x.kalit + ':' + i;
      x.qkalit = qkalit;
      if (sabab && !qaytar[qkalit]) { x.sabab = sabab; chiqdi.push(x); } else kirdi.push(x);
    });
    kirdi.sort(function (a, b) {
      if (a.raqam == null && b.raqam == null) return a.asl - b.asl;
      if (a.raqam == null) return 1;
      if (b.raqam == null) return -1;
      return a.raqam - b.raqam || a.asl - b.asl;
    });
    kirdi.forEach(function (x) { if (x.raqam == null) x.belgilar.push('raqam topilmadi'); });
    return { kirdi: kirdi, chiqdi: chiqdi };
  };

  // CSV: hamma qiymat qo'shtirnoq ichida, ichidagi qo'shtirnoq ikkilanadi
  K.csv = function (qatorlar, bir) {
    function q(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
    var r = [K.USTUNLAR.map(q).join(',')];
    qatorlar.forEach(function (x, i) {
      r.push([x.sarlavha, '', bir.ustoz, bir.kitob, bir.turi, bir.mavzu, i + 1, x.havola, K.davomiylik(x.sek), 'No'].map(q).join(','));
    });
    return r.join('\r\n') + '\r\n';
  };
  K.faylNomi = function (ustoz, kitob) {
    function t(s) { return String(s || '').trim().replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, ''); }
    return (t(ustoz) || 'ustoz') + '_' + (t(kitob) || 'kitob') + '_darslar.csv';
  };

  global.Kutubxona = K;
  if (typeof module !== 'undefined') module.exports = K;

  // =====================================================================
  // ---------- Interfeys ----------
  if (typeof document === 'undefined' || !document.getElementById('kutubxona-ilova')) return;
  var N = global.N, h = N.h;
  var holat, natija = null, tartib = null, qaytarilgan = {};
  function $(id) { return document.getElementById(id); }

  function yuklash() {
    var r = N.yukla(KALIT);
    holat = r.data && r.data.sozlar ? r.data : {
      v: 1, ustoz: '', kitob: '', turi: K.TURLAR[0], mavzu: K.MAVZULAR[0], mavzular: K.MAVZULAR.slice(), sozlar: K.SOZLAR.slice(),
      takror: true, qisqa: true, chegara: 10, shorts: true, savol: true, savolQoldir: false
    };
    if (r.xato) N.buzilganXabar($('kutubxona-ilova'));
  }
  function saqlash() { N.saqla(KALIT, holat); }

  function formaChiz() {
    $('turi').innerHTML = K.TURLAR.map(function (t) { return '<option' + (t === holat.turi ? ' selected' : '') + '>' + h(t) + '</option>'; }).join('');
    $('mavzu').innerHTML = holat.mavzular.map(function (t) { return '<option' + (t === holat.mavzu ? ' selected' : '') + '>' + h(t) + '</option>'; }).join('');
    $('ustoz').value = holat.ustoz; $('kitob').value = holat.kitob;
    ['takror', 'qisqa', 'shorts', 'savol', 'savolQoldir'].forEach(function (k) { $('f-' + k).checked = !!holat[k]; });
    $('chegara').value = holat.chegara;
    $('sozlar').value = holat.sozlar.join('\n');
    $('mavzular').value = holat.mavzular.join('\n');
  }
  function formaOqi() {
    holat.ustoz = $('ustoz').value.trim(); holat.kitob = $('kitob').value.trim();
    holat.turi = $('turi').value; holat.mavzu = $('mavzu').value;
    ['takror', 'qisqa', 'shorts', 'savol', 'savolQoldir'].forEach(function (k) { holat[k] = $('f-' + k).checked; });
    holat.chegara = Math.max(0, +$('chegara').value || 0);
    holat.sozlar = $('sozlar').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var m = $('mavzular').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (m.join('|') !== holat.mavzular.join('|')) { holat.mavzular = m; formaChiz(); }
    saqlash();
  }

  function ishla(yangi) {
    formaOqi();
    if (yangi) qaytarilgan = {};
    var opt = JSON.parse(JSON.stringify(holat)); opt.qaytarilgan = qaytarilgan;
    natija = K.ishla($('matn').value, opt);
    tartib = natija.kirdi.slice();
    chiz();
  }

  function chiz() {
    if (!natija) return;
    var html = '<div class="karta ' + (tartib.length ? 'yashil' : 'sariq') + '"><b style="font-size:20px">' + tartib.length + ' ta dars kiritildi · ' + natija.chiqdi.length + ' ta chiqarildi</b></div>';
    html += '<h2>Darslar tartibi</h2>';
    tartib.forEach(function (x, i) {
      html += '<div class="karta"><div class="qator" style="justify-content:space-between"><b>' + (i + 1) + '.</b>' +
        '<span class="qator"><button data-a="yuqori" data-i="' + i + '" aria-label="Yuqoriga" style="min-width:56px">↑</button><button data-a="past" data-i="' + i + '" aria-label="Pastga" style="min-width:56px">↓</button></span></div>' +
        '<div class="ar" dir="auto" style="margin:6px 0">' + (h(x.sarlavha) || '<span class="xira">(sarlavha yo\'q)</span>') + '</div>' +
        '<div class="kichik xira" style="word-break:break-all">' + h(x.havola) + (x.sek != null ? ' · ' + K.davomiylik(x.sek) : '') + '</div>' +
        (x.belgilar.length ? '<div style="margin-top:6px">' + x.belgilar.map(function (b) { return '<span class="belgi sariq">' + h(b) + '</span> '; }).join('') + '</div>' : '') + '</div>';
    });
    if (natija.chiqdi.length) {
      html += '<details><summary>Chiqarilganlar <span class="belgi">' + natija.chiqdi.length + '</span></summary><div class="ichki">';
      natija.chiqdi.forEach(function (x) {
        html += '<div class="karta"><div class="ar" dir="auto">' + (h(x.sarlavha) || '<span class="xira">(sarlavha yo\'q)</span>') + '</div>' +
          '<div class="kichik xira" style="word-break:break-all">' + h(x.havola) + (x.sek != null ? ' · ' + K.davomiylik(x.sek) : '') + '</div>' +
          '<div><span class="belgi qizil">Sababi: ' + h(x.sabab) + '</span></div>' +
          '<button class="keng" data-a="qaytar" data-k="' + h(x.qkalit) + '" style="margin-top:8px">↩️ Qaytarish</button></div>';
      });
      html += '</div></details>';
    }
    html += '<h2>Oldindan ko\'rish (birinchi 10 ta)</h2>';
    tartib.slice(0, 10).forEach(function (x, i) {
      html += '<div class="karta kichik"><div><b>Tartib:</b> ' + (i + 1) + '</div>' +
        '<div><b>Nomi (arabcha):</b> <bdi class="ar">' + h(x.sarlavha) + '</bdi></div>' +
        '<div><b>Ustoz:</b> <bdi>' + h(holat.ustoz) + '</bdi> · <b>Kitob:</b> <bdi>' + h(holat.kitob) + '</bdi></div>' +
        '<div><b>Turi:</b> ' + h(holat.turi) + ' · <b>Mavzu:</b> ' + h(holat.mavzu) + '</div>' +
        '<div style="word-break:break-all"><b>Havola:</b> ' + h(x.havola) + '</div>' +
        '<div><b>Davomiyligi:</b> ' + K.davomiylik(x.sek) + ' · <b>Eshitildi:</b> No</div></div>';
    });
    html += '<button class="asosiy keng" data-a="csv" style="margin-top:8px"' + (tartib.length ? '' : ' disabled') + '>⬇️ CSV yuklab olish</button>' +
      '<p class="kichik xira">Fayl: ' + h(K.faylNomi(holat.ustoz, holat.kitob)) + '</p>';
    $('natija').innerHTML = html;
  }

  $('natija').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]');
    if (!b) return;
    var a = b.getAttribute('data-a'), i = +b.getAttribute('data-i');
    if (a === 'yuqori' || a === 'past') {
      var j = a === 'yuqori' ? i - 1 : i + 1;
      if (j < 0 || j >= tartib.length) return;
      var t = tartib[i]; tartib[i] = tartib[j]; tartib[j] = t;
      chiz();
    } else if (a === 'qaytar') {
      qaytarilgan[b.getAttribute('data-k')] = true;
      var qolgan = tartib.slice();
      ishla(false);
      // Qo'lda o'zgartirilgan tartibni saqlab, qaytarilganni oxiriga qo'shamiz
      var yangi = tartib.filter(function (x) { return !qolgan.some(function (y) { return y.qkalit === x.qkalit; }); });
      tartib = qolgan.concat(yangi);
      chiz();
    } else if (a === 'csv') {
      formaOqi();
      N.yuklabOl(K.faylNomi(holat.ustoz, holat.kitob), K.csv(tartib, holat), 'text/csv', true);
    }
  });
  $('ishla').onclick = function () { ishla(true); $('natija').scrollIntoView({ behavior: 'smooth' }); };
  $('kutubxona-ilova').addEventListener('change', function (e) {
    if (e.target.closest('#natija')) return;
    formaOqi();
    if (natija && e.target.id !== 'matn') ishla(false);
  });

  yuklash();
  formaChiz();
  N.ishgaTush();
})(typeof window !== 'undefined' ? window : globalThis);
