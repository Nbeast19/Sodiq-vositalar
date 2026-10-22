// Madina mushafi (604 sahifa, 15 qatorli): suralar va juzlarning boshlanish sahifalari.
(function (global) {
  'use strict';
  // [o'zbekcha nomi, arabcha nomi, boshlanish sahifasi]
  var SURALAR = [
    ['Fotiha', 'الفاتحة', 1], ['Baqara', 'البقرة', 2], ['Oli Imron', 'آل عمران', 50], ['Niso', 'النساء', 77],
    ['Moida', 'المائدة', 106], ['An\'om', 'الأنعام', 128], ['A\'rof', 'الأعراف', 151], ['Anfol', 'الأنفال', 177],
    ['Tavba', 'التوبة', 187], ['Yunus', 'يونس', 208], ['Hud', 'هود', 221], ['Yusuf', 'يوسف', 235],
    ['Ra\'d', 'الرعد', 249], ['Ibrohim', 'إبراهيم', 255], ['Hijr', 'الحجر', 262], ['Nahl', 'النحل', 267],
    ['Isro', 'الإسراء', 282], ['Kahf', 'الكهف', 293], ['Maryam', 'مريم', 305], ['Toha', 'طه', 312],
    ['Anbiyo', 'الأنبياء', 322], ['Haj', 'الحج', 332], ['Mu\'minun', 'المؤمنون', 342], ['Nur', 'النور', 350],
    ['Furqon', 'الفرقان', 359], ['Shuaro', 'الشعراء', 367], ['Naml', 'النمل', 377], ['Qasas', 'القصص', 385],
    ['Ankabut', 'العنكبوت', 396], ['Rum', 'الروم', 404], ['Luqmon', 'لقمان', 411], ['Sajda', 'السجدة', 415],
    ['Ahzob', 'الأحزاب', 418], ['Saba', 'سبأ', 428], ['Fotir', 'فاطر', 434], ['Yosin', 'يس', 440],
    ['Soffot', 'الصافات', 446], ['Sod', 'ص', 453], ['Zumar', 'الزمر', 458], ['G\'ofir', 'غافر', 467],
    ['Fussilat', 'فصلت', 477], ['Shuro', 'الشورى', 483], ['Zuxruf', 'الزخرف', 489], ['Duxon', 'الدخان', 496],
    ['Josiya', 'الجاثية', 499], ['Ahqof', 'الأحقاف', 502], ['Muhammad', 'محمد', 507], ['Fath', 'الفتح', 511],
    ['Hujurot', 'الحجرات', 515], ['Qof', 'ق', 518], ['Zoriyot', 'الذاريات', 520], ['Tur', 'الطور', 523],
    ['Najm', 'النجم', 526], ['Qamar', 'القمر', 528], ['Rahmon', 'الرحمن', 531], ['Voqia', 'الواقعة', 534],
    ['Hadid', 'الحديد', 537], ['Mujodala', 'المجادلة', 542], ['Hashr', 'الحشر', 545], ['Mumtahana', 'الممتحنة', 549],
    ['Sof', 'الصف', 551], ['Juma', 'الجمعة', 553], ['Munofiqun', 'المنافقون', 554], ['Tag\'obun', 'التغابن', 556],
    ['Taloq', 'الطلاق', 558], ['Tahrim', 'التحريم', 560], ['Mulk', 'الملك', 562], ['Qalam', 'القلم', 564],
    ['Hoqqa', 'الحاقة', 566], ['Maorij', 'المعارج', 568], ['Nuh', 'نوح', 570], ['Jin', 'الجن', 572],
    ['Muzzammil', 'المزمل', 574], ['Muddassir', 'المدثر', 575], ['Qiyomat', 'القيامة', 577], ['Inson', 'الإنسان', 578],
    ['Mursalot', 'المرسلات', 580], ['Naba', 'النبأ', 582], ['Noziot', 'النازعات', 583], ['Abasa', 'عبس', 585],
    ['Takvir', 'التكوير', 586], ['Infitor', 'الانفطار', 587], ['Mutaffifin', 'المطففين', 587], ['Inshiqoq', 'الانشقاق', 589],
    ['Buruj', 'البروج', 590], ['Toriq', 'الطارق', 591], ['A\'lo', 'الأعلى', 591], ['G\'oshiya', 'الغاشية', 592],
    ['Fajr', 'الفجر', 593], ['Balad', 'البلد', 594], ['Shams', 'الشمس', 595], ['Layl', 'الليل', 595],
    ['Zuho', 'الضحى', 596], ['Sharh', 'الشرح', 596], ['Tin', 'التين', 597], ['Alaq', 'العلق', 597],
    ['Qadr', 'القدر', 598], ['Bayyina', 'البينة', 598], ['Zalzala', 'الزلزلة', 599], ['Odiyot', 'العاديات', 599],
    ['Qoria', 'القارعة', 600], ['Takosur', 'التكاثر', 600], ['Asr', 'العصر', 601], ['Humaza', 'الهمزة', 601],
    ['Fil', 'الفيل', 601], ['Quraysh', 'قريش', 602], ['Moun', 'الماعون', 602], ['Kavsar', 'الكوثر', 602],
    ['Kofirun', 'الكافرون', 603], ['Nasr', 'النصر', 603], ['Masad', 'المسد', 603], ['Ixlos', 'الإخلاص', 604],
    ['Falaq', 'الفلق', 604], ['Nos', 'الناس', 604]
  ].map(function (s, i) { return { n: i + 1, uz: s[0], ar: s[1], bosh: s[2] }; });

  // 30 juzning boshlanish sahifalari
  var JUZLAR = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
    302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];

  var M = { SURALAR: SURALAR, JUZLAR: JUZLAR, SAHIFALAR: 604 };

  // Sahifadagi suralar: shu sahifada boshlanadiganlar, bo'lmasa davom etayotgan sura
  M.sahifaSuralari = function (p) {
    var bosh = SURALAR.filter(function (s) { return s.bosh === p; });
    if (bosh.length) return bosh;
    var oxirgi = SURALAR[0];
    for (var i = 0; i < SURALAR.length; i++) if (SURALAR[i].bosh <= p) oxirgi = SURALAR[i];
    return [oxirgi];
  };
  M.suraNomi = function (p) {
    return M.sahifaSuralari(p).map(function (s) { return s.uz; }).join(', ');
  };
  M.suraNomiAr = function (p) {
    return M.sahifaSuralari(p).map(function (s) { return s.ar; }).join('، ');
  };
  M.juz = function (p) {
    var j = 1;
    for (var i = 0; i < JUZLAR.length; i++) if (JUZLAR[i] <= p) j = i + 1;
    return j;
  };
  // Suraning oxirgi sahifasi (keyingi sura boshlanishidan bir oldingi, kamida o'z boshi)
  M.suraOxiri = function (n) {
    if (n >= 114) return 604;
    return Math.max(SURALAR[n - 1].bosh, SURALAR[n].bosh - 1);
  };

  global.Mushaf = M;
  if (typeof module !== 'undefined') module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
