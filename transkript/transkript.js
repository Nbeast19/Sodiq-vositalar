// Transkript: dars transkripsiyasini tozalash va arabcha qismlarni ajratish.
// Yuqori qism — sof mantiq (Node'da sinash mumkin), pastki qism — interfeys.
(function (global) {
  'use strict';
  var KALIT = 'nader.transkript.v1';
  var T = { KALIT: KALIT };

  var AR = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
  // Arabcha bo'lak: arabcha so'zlar va ularning orasidagi bo'sh joy, tinish belgilari, raqamlar
  var BOLAK = new RegExp('[' + AR + ']+(?:[\\s\\d.,:;!?()«»"\'\\-–—…\\[\\]﴿﴾]+[' + AR + ']+)*', 'g');
  var ARAB_HARF = new RegExp('[' + AR + ']');
  var SPIKER = /^\s*(?:speaker\s*\d+|speaker_\d+|spiker\s*\d+)\s*:\s*/i;

  T.standart = function () {
    return { vaqt: true, birlashtir: true, pauza: 3, gaplar: 5, takror: true, tozala: true, apostrof: true, belgi: '\'', spiker: 'olib', arab: 'qator' };
  };

  // "00:01:02,500" yoki "01:02.5" yoki "00:12:34" -> soniya
  function vaqt(s) {
    var q = s.replace(',', '.').split(':').map(Number);
    return q.length === 3 ? q[0] * 3600 + q[1] * 60 + q[2] : q[0] * 60 + q[1];
  }
  T.vaqtMatn = function (sek) {
    sek = Math.floor(sek);
    var h = Math.floor(sek / 3600), m = Math.floor(sek / 60) % 60, s = sek % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  // Matnni bo'laklarga ajratish: [{ bosh, oxir, matn }]
  var V = '(\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?';
  var STRELKA = new RegExp('^\\s*\\[?(' + V + ')\\s*-->\\s*(' + V + ')\\]?(.*)$');
  var BIR_VAQT = new RegExp('^\\s*\\[?((?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?)\\]?\\s+(.*)$');
  T.tahlil = function (matn) {
    var qatorlar = String(matn || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    var bolaklar = [], joriy = null, srt = qatorlar.some(function (q) { return /^\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/.test(q); });
    for (var i = 0; i < qatorlar.length; i++) {
      var q = qatorlar[i], m;
      if (/^WEBVTT/.test(q) || /^NOTE\b/.test(q)) { joriy = null; continue; }
      if ((m = STRELKA.exec(q))) {
        joriy = { bosh: vaqt(m[1]), oxir: vaqt(m[3]), matn: m[5].replace(/^\]\s*/, '').trim() };
        // VTT sozlamalari (align:start ...) matn emas
        if (srt && /^(align|position|line|size|vertical):/.test(joriy.matn)) joriy.matn = '';
        bolaklar.push(joriy);
        continue;
      }
      if (srt) {
        if (!q.trim()) { joriy = null; continue; }
        // SRT raqam qatori (keyingi qator vaqt bo'lsa)
        if (/^\s*\d+\s*$/.test(q) && i + 1 < qatorlar.length && STRELKA.test(qatorlar[i + 1])) continue;
        if (joriy) joriy.matn += (joriy.matn ? '\n' : '') + q.trim();
        continue;
      }
      if ((m = BIR_VAQT.exec(q))) { bolaklar.push({ bosh: vaqt(m[1]), oxir: null, matn: m[2].trim() }); continue; }
      bolaklar.push({ bosh: null, oxir: null, matn: q.trim(), bosh_qator: !q.trim() });
    }
    var vaqtli = bolaklar.some(function (b) { return b.bosh != null; });
    return { bolaklar: bolaklar, vaqtli: vaqtli };
  };

  // Ortiqcha bo'sh joy va ikki marta tinish belgilari
  T.tozala = function (s) {
    return s.replace(/[ \t\u00A0]+/g, ' ')
      .replace(/ +([,.;:!?،؛؟])/g, '$1')
      .replace(/([,;:!?،؛؟])\1+/g, '$1')
      .replace(/(^|[^.])\.\.(?!\.)/g, '$1.')
      .trim();
  };
  T.apostrof = function (s, belgi) {
    return s.replace(/([oOgG])[ʻʼ‘’`´′']/g, '$1' + belgi);
  };
  function gaplar(matn) {
    return matn.match(/[^.!?…؟]*[.!?…؟]+["»”')\]]*\s*|[^.!?…؟]+$/g) || [];
  }

  // Asosiy ishlov: paragraflar ro'yxatini qaytaradi
  T.ishla = function (matn, opt) {
    opt = opt || T.standart();
    var t = T.tahlil(matn), b = t.bolaklar;
    b.forEach(function (x) {
      if (opt.spiker === 'olib') x.matn = x.matn.split('\n').map(function (q) { return q.replace(SPIKER, ''); }).join('\n');
    });
    var paragraflar = [];
    var pauzali = t.vaqtli && b.every(function (x) { return x.bosh != null && x.oxir != null; });
    if (t.vaqtli) {
      var guruh = [];
      b.forEach(function (x, i) {
        if (!x.matn.trim()) return;
        var oldingi = i > 0 ? b[i - 1] : null;
        var yangi = guruh.length && pauzali && oldingi && x.bosh - oldingi.oxir > (+opt.pauza || 3);
        if (yangi) { paragraflar.push(guruh); guruh = []; }
        guruh.push(x);
      });
      if (guruh.length) paragraflar.push(guruh);
      paragraflar = paragraflar.map(function (g) {
        return g.map(function (x) {
          var m = opt.birlashtir ? x.matn.replace(/\s*\n\s*/g, ' ') : x.matn;
          return opt.vaqt ? m : '[' + T.vaqtMatn(x.bosh) + '] ' + m;
        }).join(opt.birlashtir && opt.vaqt ? ' ' : '\n');
      });
    } else {
      // Vaqt belgisiz matn: bo'sh qatorlar paragraf chegarasi
      var bloklar = [], joriy = [];
      b.forEach(function (x) {
        if (!x.matn) { if (joriy.length) bloklar.push(joriy); joriy = []; } else joriy.push(x.matn);
      });
      if (joriy.length) bloklar.push(joriy);
      bloklar.forEach(function (bl) { paragraflar.push(bl.join(opt.birlashtir ? ' ' : '\n')); });
    }
    // Vaqt bo'yicha bo'linmagan bo'lsa — har N gapda yangi paragraf
    if (!pauzali && opt.birlashtir && opt.vaqt) {
      var n = Math.max(1, +opt.gaplar || 5), yangiP = [];
      paragraflar.forEach(function (p) {
        var g = gaplar(p);
        for (var i = 0; i < g.length; i += n) yangiP.push(g.slice(i, i + n).join(' '));
      });
      paragraflar = yangiP;
    }
    paragraflar = paragraflar.map(function (p) {
      if (opt.tozala) p = p.split('\n').map(T.tozala).join('\n');
      if (opt.apostrof) p = T.apostrof(p, opt.belgi || '\'');
      return p.trim();
    }).filter(Boolean);
    return { paragraflar: paragraflar, stat: T.statistika(paragraflar), takror: opt.takror ? T.takrorlar(paragraflar).length : 0 };
  };

  // Ketma-ket takrorlangan so'zlar (faqat ko'rsatish uchun)
  function sozKalit(s) { return s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}ʻ']+$/gu, ''); }
  T.takrorlar = function (paragraflar) {
    var r = [];
    paragraflar.forEach(function (p) {
      var sozlar = p.split(/\s+/), oldingi = '';
      sozlar.forEach(function (s) {
        var k = sozKalit(s);
        if (k && k === oldingi) r.push(k);
        oldingi = k;
      });
    });
    return r;
  };

  T.statistika = function (paragraflar) {
    var jami = 0, arab = 0, bolak = 0;
    paragraflar.forEach(function (p) {
      p.split(/\s+/).forEach(function (s) {
        if (!/[\p{L}\p{N}]/u.test(s)) return;
        jami++;
        if (ARAB_HARF.test(s)) arab++;
      });
      bolak += (p.match(BOLAK) || []).length;
    });
    return { jami: jami, arab: arab, bolak: bolak, foiz: jami ? arab / jami * 100 : 0 };
  };
  T.son = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  T.statMatn = function (s) {
    return 'Jami so\'z: ' + T.son(s.jami) + ' · Arabcha: ' + T.son(s.arab) + ' (' + s.foiz.toFixed(1).replace('.', ',') + '%) · Arabcha bo\'laklar: ' + T.son(s.bolak);
  };

  // Paragrafni tanlangan usulda chiqarish (matn uchun)
  T.arabcha = function (p, usul, md) {
    if (usul === 'belgi') return p.replace(BOLAK, '«$&»');
    if (usul === 'teg') return p.replace(BOLAK, '[AR]$&[/AR]');
    var q = p.replace(BOLAK, '\n$&\n').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (md) q = q.map(function (s) { return ARAB_HARF.test(s) && s.replace(BOLAK, '').replace(/[\s.,:;!?«»"'()\-–—…]/g, '') === '' ? '> ' + s : s; });
    return q.join(md ? '\n\n' : '\n');
  };
  T.chiqar = function (paragraflar, usul, md) {
    return paragraflar.map(function (p) { return T.arabcha(p, usul, md); }).join('\n\n') + '\n';
  };

  // Ekranda ko'rsatish uchun HTML (arabcha rangli, takrorlar belgilangan)
  T.html = function (paragraflar, usul) {
    function e(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function takrorBelgila(s) {
      var oldingi = '';
      return s.split(/(\s+)/).map(function (soz) {
        if (/^\s+$/.test(soz) || !soz) return soz;
        var k = sozKalit(soz), r = (k && k === oldingi) ? '<mark>' + e(soz) + '</mark>' : e(soz);
        oldingi = k;
        return r;
      }).join('');
    }
    return paragraflar.map(function (p) {
      var chiqish = '', oxirgi = 0, m;
      BOLAK.lastIndex = 0;
      while ((m = BOLAK.exec(p))) {
        chiqish += takrorBelgila(p.slice(oxirgi, m.index));
        var a = e(m[0]);
        chiqish += usul === 'qator' ? '<span class="arab blok" lang="ar" dir="rtl">' + a + '</span>'
          : '<span class="arab" lang="ar" dir="rtl">' + (usul === 'belgi' ? '«' + a + '»' : usul === 'teg' ? '[AR]' + a + '[/AR]' : a) + '</span>';
        oxirgi = m.index + m[0].length;
      }
      chiqish += takrorBelgila(p.slice(oxirgi));
      return '<p dir="ltr">' + chiqish.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  };

  global.Transkript = T;
  if (typeof module !== 'undefined') module.exports = T;

  // =====================================================================
  // ---------- Interfeys ----------
  if (typeof document === 'undefined' || !document.getElementById('transkript-ilova')) return;
  var N = global.N, h = N.h;
  var opt, natija = null, asliNom = '';
  function $(id) { return document.getElementById(id); }

  function yuklash() {
    var r = N.yukla(KALIT);
    opt = Object.assign(T.standart(), r.data || {});
  }
  function formaChiz() {
    ['vaqt', 'birlashtir', 'takror', 'tozala', 'apostrof'].forEach(function (k) { $('o-' + k).checked = !!opt[k]; });
    $('o-pauza').value = opt.pauza; $('o-gaplar').value = opt.gaplar;
    $('o-belgi').value = opt.belgi; $('o-spiker').value = opt.spiker; $('o-arab').value = opt.arab;
  }
  function formaOqi() {
    ['vaqt', 'birlashtir', 'takror', 'tozala', 'apostrof'].forEach(function (k) { opt[k] = $('o-' + k).checked; });
    opt.pauza = +$('o-pauza').value || 3; opt.gaplar = +$('o-gaplar').value || 5;
    opt.belgi = $('o-belgi').value; opt.spiker = $('o-spiker').value; opt.arab = $('o-arab').value;
    N.saqla(KALIT, opt);
  }
  function ishla() {
    var matn = $('matn').value;
    if (!matn.trim()) { N.xabar('Matn bo\'sh'); return; }
    formaOqi();
    natija = T.ishla(matn, opt);
    $('stat').textContent = T.statMatn(natija.stat) + (opt.takror ? ' · Takror so\'zlar: ' + natija.takror : '');
    $('korinish').innerHTML = T.html(natija.paragraflar, opt.arab);
    $('natija').classList.remove('yashirin');
  }
  function nom(kengaytma) {
    return (asliNom ? asliNom.replace(/\.[^.]+$/, '') : 'transkript') + '_toza.' + kengaytma;
  }

  $('ishla').onclick = function () { ishla(); $('natija').scrollIntoView({ behavior: 'smooth' }); };
  $('sozlamalar').addEventListener('change', function () { if (natija) ishla(); else formaOqi(); });
  $('fayl').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    N.faylOqi(f).then(function (m) { $('matn').value = m; asliNom = f.name; ishla(); });
    e.target.value = '';
  };
  document.querySelectorAll('[data-namuna]').forEach(function (b) {
    b.onclick = function () {
      var f = b.getAttribute('data-namuna');
      fetch('namuna/' + f).then(function (r) { return r.text(); }).then(function (m) {
        $('matn').value = m; asliNom = f; ishla();
      }).catch(function () { N.xabar('Namunani yuklab bo\'lmadi'); });
    };
  });
  $('txt').onclick = function () { N.yuklabOl(nom('txt'), T.chiqar(natija.paragraflar, opt.arab, false)); };
  $('md').onclick = function () { N.yuklabOl(nom('md'), T.chiqar(natija.paragraflar, opt.arab, true), 'text/markdown'); };
  $('nusxa').onclick = function () { N.nusxala(T.chiqar(natija.paragraflar, opt.arab, false)); };

  yuklash();
  formaChiz();
  N.ishgaTush();
})(typeof window !== 'undefined' ? window : globalThis);
