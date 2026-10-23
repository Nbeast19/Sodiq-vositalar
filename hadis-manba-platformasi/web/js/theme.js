// Mavzu (yorug'/qorong'i/avto) — sahifa chizilishidan oldin qo'llanadi, miltillash bo'lmasin.
(function () {
  try {
    var t = localStorage.getItem('hadith-library.theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* xususiy rejim */ }
})();
