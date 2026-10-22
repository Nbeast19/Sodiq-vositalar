// Zettel: Zettelkasten kartalarini mexanik tekshirish.
// Yuqori qism — sof mantiq (Node'da sinash mumkin), pastki qism — interfeys.
(function (global) {
  'use strict';
  var Z = {};

  // ZK raqamini "yumshoq" topish (xato yozilganlarini ham): zk-aq-14, ZK–AQ–014
  var YUMSHOQ = /\bzk\s*[-–—_]\s*([a-z]{2,4})\s*[-–—_]\s*(\d+)/i;
  var QATIY = /^ZK-[A-Z]{2,4}-\d{3,}$/;

  // Yumshoq topilgan raqamni to'g'ri shaklga keltirish
  Z.tozala = function (m) {
    var raqam = m[2].length < 3 ? ('000' + m[2]).slice(-3) : m[2];
    return 'ZK-' + m[1].toUpperCase() + '-' + raqam;
  };
  // Matndan raqam: { id: to'g'ri shakli, xom: yozilgani, togri: format to'g'rimi }
  Z.raqamTop = function (matn) {
    var m = YUMSHOQ.exec(matn || '');
    if (!m) return null;
    return { id: Z.tozala(m), xom: m[0], togri: QATIY.test(m[0]) };
  };

  // YAML frontmatter'ni ajratish
  function frontmatter(matn) {
    var m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(matn);
    if (!m) return { yaml: '', tana: matn };
    return { yaml: m[1], tana: matn.slice(m[0].length) };
  }

  // Bitta kartani tahlil qilish
  Z.kartaOqi = function (nom, matn) {
    matn = String(matn || '').replace(/\r\n?/g, '\n');
    var fm = frontmatter(matn);
    var idQator = /^id\s*:\s*["']?([^"'\n]+)/mi.exec(fm.yaml);
    var sarlavhaQ = /^#{1,6}\s+(.*)$/m.exec(fm.tana);
    var manbalar = [nom.replace(/\.md$/i, ''), idQator ? idQator[1] : '', sarlavhaQ ? sarlavhaQ[1] : ''];
    var raqam = null;
    for (var i = 0; i < manbalar.length && !raqam; i++) raqam = Z.raqamTop(manbalar[i]);

    // Sarlavha: birinchi sarlavha (raqamsiz qismi) yoki frontmatter'dagi title
    var sarlavha = '';
    if (sarlavhaQ) sarlavha = sarlavhaQ[1].replace(YUMSHOQ, '').replace(/^[\s\-–—:.]+/, '').trim();
    if (!sarlavha) {
      var t = /^title\s*:\s*["']?([^"'\n]+)/mi.exec(fm.yaml);
      if (t) sarlavha = t[1].trim();
    }
    if (!sarlavha && sarlavhaQ && sarlavhaQ[1].trim()) sarlavha = sarlavhaQ[1].trim();
    // Matn: sarlavhadan tashqari qismi
    var tana = sarlavhaQ ? fm.tana.replace(sarlavhaQ[0], '') : fm.tana;

    var havolalar = [];
    var re = /\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, m;
    while ((m = re.exec(fm.tana))) {
      var r = Z.raqamTop(m[1]);
      if (r) havolalar.push({ id: r.id, xom: m[0], togri: QATIY.test(r.xom) && m[1].trim().indexOf(r.xom) === 0 });
    }
    return {
      fayl: nom,
      id: raqam ? raqam.id : null,
      xom: raqam ? raqam.xom : null,
      togri: raqam ? raqam.togri : false,
      sarlavha: sarlavha,
      bosh: !sarlavha || !tana.replace(/\[\[[^\]]*\]\]/g, '').trim(),
      havolalar: havolalar
    };
  };

  // Joylashtirilgan matnni kartalarga bo'lish
  Z.matnniBol = function (matn) {
    matn = String(matn || '').replace(/\r\n?/g, '\n');
    var qatorlar = matn.split('\n');
    var sarlavhaRe = /^#{1,6}\s*zk\s*[-–—_]/i;
    var bor = qatorlar.some(function (q) { return sarlavhaRe.test(q); });
    var bolaklar = [], joriy = [];
    qatorlar.forEach(function (q) {
      var chegara = bor ? sarlavhaRe.test(q) : /^---\s*$/.test(q);
      if (chegara) {
        if (joriy.join('').trim()) bolaklar.push(joriy.join('\n'));
        joriy = bor ? [q] : [];
      } else joriy.push(q);
    });
    if (joriy.join('').trim()) bolaklar.push(joriy.join('\n'));
    return bolaklar.map(function (b, i) { return { nom: 'Matn, ' + (i + 1) + '-karta', matn: b }; });
  };

  // Hamma tekshiruvlar
  Z.tekshir = function (fayllar) {
    var kartalar = fayllar.map(function (f) { return Z.kartaOqi(f.nom, f.matn); });
    var x = { yoq: [], takror: [], buzilgan: [], yetim: [], bosh: [], format: [], ozi: [] };
    var byId = {};
    kartalar.forEach(function (k) {
      if (!k.id) { x.format.push('Raqam topilmadi: ' + k.fayl); return; }
      if (!k.togri) x.format.push('Format xato: ' + k.xom + ' (' + k.fayl + '), to\'g\'risi: ' + k.id);
      (byId[k.id] = byId[k.id] || []).push(k);
      if (k.bosh) x.bosh.push(k.id + ' — ' + (k.sarlavha ? 'matni bo\'sh' : 'sarlavhasi bo\'sh') + ' (' + k.fayl + ')');
    });
    // Takroriy raqamlar
    Object.keys(byId).sort().forEach(function (id) {
      var r = byId[id];
      if (r.length > 1) x.takror.push(id + ' ' + r.length + ' marta ishlatilgan: ' + r.map(function (k) { return k.fayl; }).join(', '));
    });
    // Tushib qolgan raqamlar (har bir kitob alohida)
    var guruh = {};
    Object.keys(byId).forEach(function (id) {
      var q = id.split('-');
      (guruh[q[1]] = guruh[q[1]] || []).push(q[2]);
    });
    Object.keys(guruh).sort().forEach(function (kitob) {
      var raqamlar = guruh[kitob].map(Number), bor = {};
      raqamlar.forEach(function (n) { bor[n] = 1; });
      var kenglik = Math.max.apply(null, guruh[kitob].map(function (s) { return s.length; }));
      var min = Math.min.apply(null, raqamlar), max = Math.max.apply(null, raqamlar);
      for (var n = min; n <= max; n++) {
        if (!bor[n]) x.yoq.push('ZK-' + kitob + '-' + ('000000' + n).slice(-Math.max(3, kenglik)) + ' yo\'q');
      }
    });
    // Havolalar
    var kiruvchi = {}, chiquvchi = {};
    kartalar.forEach(function (k) {
      if (!k.id) return;
      var korilgan = {};
      k.havolalar.forEach(function (hv) {
        if (!hv.togri) x.format.push('Format xato: ' + k.id + ' ichida ' + hv.xom + ', to\'g\'risi: [[' + hv.id + ']]');
        if (hv.id === k.id) { x.ozi.push(k.id + ' o\'ziga ishora qiladi: ' + hv.xom); return; }
        if (!byId[hv.id]) { x.buzilgan.push(k.id + ' ichida ' + hv.xom + ' bor, lekin bunday karta yo\'q'); return; }
        if (korilgan[hv.id]) return;
        korilgan[hv.id] = 1;
        chiquvchi[k.id] = (chiquvchi[k.id] || 0) + 1;
        kiruvchi[hv.id] = (kiruvchi[hv.id] || 0) + 1;
      });
    });
    Object.keys(byId).sort().forEach(function (id) {
      if (!kiruvchi[id] && !chiquvchi[id]) x.yetim.push(id + ' — hech kim ishora qilmaydi, o\'zi ham hech kimga ishora qilmaydi');
    });
    var boglanish = Object.keys(byId).map(function (id) {
      return { id: id, chiq: chiquvchi[id] || 0, kir: kiruvchi[id] || 0 };
    }).sort(function (a, b) { return (b.chiq + b.kir) - (a.chiq + a.kir) || (a.id < b.id ? -1 : 1); }).slice(0, 10);

    var xato = x.yoq.length + x.takror.length + x.buzilgan.length + x.bosh.length + x.format.length;
    var ogoh = x.yetim.length + x.ozi.length;
    return { soni: kartalar.length, x: x, xato: xato, ogoh: ogoh, boglanish: boglanish };
  };

  Z.TURLAR = [
    ['yoq', 'Tushib qolgan raqamlar', 'xato'],
    ['takror', 'Takroriy raqamlar', 'xato'],
    ['buzilgan', 'Buzilgan havolalar', 'xato'],
    ['format', 'Formati noto\'g\'ri raqamlar', 'xato'],
    ['bosh', 'Bo\'sh kartalar', 'xato'],
    ['yetim', 'Yetim kartalar', 'ogoh'],
    ['ozi', 'O\'z-o\'ziga havola', 'ogoh']
  ];
  Z.xulosa = function (n) {
    return n.soni + ' ta karta tekshirildi · ' + n.xato + ' ta xato · ' + n.ogoh + ' ta ogohlantirish';
  };
  Z.hisobot = function (n) {
    var t = ['Zettel tekshiruvi', Z.xulosa(n), ''];
    Z.TURLAR.forEach(function (tr) {
      var r = n.x[tr[0]];
      t.push('== ' + tr[1] + ' (' + r.length + ') — ' + (tr[2] === 'xato' ? 'xato' : 'ogohlantirish'));
      r.forEach(function (s) { t.push('- ' + s); });
      if (!r.length) t.push('- yo\'q ✓');
      t.push('');
    });
    t.push('== Bog\'lanishlar (eng ko\'p bog\'langan 10 ta)');
    n.boglanish.forEach(function (b) { t.push('- ' + b.id + ': ' + b.chiq + ' ta kartaga ishora qiladi, ' + b.kir + ' ta karta unga ishora qiladi'); });
    return t.join('\n');
  };

  global.Zettel = Z;
  if (typeof module !== 'undefined') module.exports = Z;

  // =====================================================================
  // ---------- Interfeys ----------
  if (typeof document === 'undefined' || !document.getElementById('zettel-ilova')) return;
  var N = global.N, h = N.h, natija = null;
  var NAMUNA = ['ZK-AQ-001 Tavhid tarifi.md', 'ZK-AQ-002 Tavhid turlari.md', 'ZK-AQ-004 Iymon ruknlari.md',
    'ZK-AQ-005 Asmo va sifat.md', 'ZK-AQ-006.md', 'ZK-AQ-006 nusxa.md', 'ZK-AQ-7 Ahli sunna.md',
    'ZK-AQ-008 Bosh karta.md', 'ZK-AQ-009 Yetim karta.md'];

  function korsat(fayllar) {
    if (!fayllar.length) { N.xabar('Karta topilmadi'); return; }
    natija = Z.tekshir(fayllar);
    var n = natija, rang = n.xato ? 'qizil' : n.ogoh ? 'sariq' : 'yashil';
    var html = '<div class="karta ' + rang + '"><b style="font-size:20px">' + h(Z.xulosa(n)) + '</b>' +
      (n.xato || n.ogoh ? '' : '<div>Hammasi joyida ✓</div>') + '</div>';
    Z.TURLAR.forEach(function (tr) {
      var r = n.x[tr[0]];
      var belgi = r.length ? (tr[2] === 'xato' ? '<span class="belgi qizil">' + r.length + ' xato</span>' : '<span class="belgi sariq">' + r.length + ' ogohlantirish</span>') : '<span class="belgi">✓</span>';
      html += '<details' + (r.length ? ' open' : '') + '><summary>' + h(tr[1]) + ' ' + belgi + '</summary><div class="ichki"><ul class="royxat">' +
        (r.length ? r.map(function (s) { return '<li dir="auto">' + h(s) + '</li>'; }).join('') : '<li class="xira">Yo\'q ✓</li>') + '</ul></div></details>';
    });
    html += '<details><summary>Bog\'lanishlar (eng ko\'p 10 ta)</summary><div class="ichki"><ul class="royxat">' +
      n.boglanish.map(function (b) { return '<li><b>' + h(b.id) + '</b><br><span class="kichik">→ ' + b.chiq + ' ta kartaga ishora qiladi · ← ' + b.kir + ' ta karta unga ishora qiladi</span></li>'; }).join('') +
      '</ul></div></details>' +
      '<div class="qator"><button class="asosiy keng" id="nusxa">📋 Natijani nusxalash</button></div>' +
      '<div class="qator" style="margin-top:10px"><button class="keng" id="txt">⬇️ Natijani .txt qilib yuklab olish</button></div>';
    var joy = document.getElementById('natija');
    joy.innerHTML = html;
    document.getElementById('nusxa').onclick = function () { N.nusxala(Z.hisobot(natija)); };
    document.getElementById('txt').onclick = function () { N.yuklabOl('zettel-tekshiruv-' + N.bugunSana() + '.txt', Z.hisobot(natija)); };
    joy.scrollIntoView({ behavior: 'smooth' });
  }

  function fayllarniOqi(royxat) {
    var md = Array.prototype.filter.call(royxat, function (f) { return /\.md$/i.test(f.name); });
    Promise.all(md.map(function (f) {
      return N.faylOqi(f).then(function (matn) { return { nom: f.name, matn: matn }; });
    })).then(korsat);
  }
  document.getElementById('fayllar').onchange = function (e) { fayllarniOqi(e.target.files); e.target.value = ''; };
  document.getElementById('papka').onchange = function (e) { fayllarniOqi(e.target.files); e.target.value = ''; };
  document.getElementById('tekshir').onclick = function () { korsat(Z.matnniBol(document.getElementById('matn').value)); };
  document.getElementById('namuna').onclick = function () {
    Promise.all(NAMUNA.map(function (nom) {
      return fetch('namuna/' + encodeURIComponent(nom)).then(function (r) { return r.text(); })
        .then(function (matn) { return { nom: nom, matn: matn }; });
    })).then(korsat).catch(function () { N.xabar('Namunani yuklab bo\'lmadi'); });
  };
  N.ishgaTush();
})(typeof window !== 'undefined' ? window : globalThis);
