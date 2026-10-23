# Qidiruv tizimlarida topilish (SEO) — 26-bo‘lim

Rasmiy tayanchlar: [Google — localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions), [Google — JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Nima qilingan
- `hadis-manba build-site` (yoki `scripts/build_demo.py`) ommaviy katalogdan **oldindan yaratilgan HTML** sahifalar quradi: `web/en/…` va `web/ar/…`
  - bosh sahifa, kitoblar katalogi, har kitob kartasi, har sharh kartasi, mualliflar, yordam, o‘rnatish (Windows/Mac/iPhone/Android/Linux);
  - har sahifa o‘z tilida `<title>`, `meta description`, bitta `<h1>`; `<html lang dir>` (ar → rtl);
  - **self-canonical**, o‘zaro `hreflang="en"`/`"ar"` va `x-default` (= English versiya);
  - oddiy `<a href>` havolalar, **JavaScript talab qilinmaydi**; manba matni (hadis/sharh) sahifaga qo‘yilmaydi — faqat ko‘rinadigan, dalilli metadata (nom, muallif, nashr, hajm, yozuv soni, holat sanog‘i, litsenziya);
  - `web/sitemap.xml` (har URL uchun `xhtml:link` alternatelari).
- PWA (`web/index.html`) `noindex` — u ilova qobig‘i, indekslanadigan mazmun `/en/` va `/ar/` sahifalarida.
- Ommaviy katalogga faqat allowlist paketlari kiradi; shaxsiy qaydlar (IndexedDB) va mahalliy fayllar sahifalarga chiqmaydi.
- Testlar: `tests/test_site.py` — canonical = o‘z URL, hreflang o‘zaro, x-default, sitemap ↔ sahifalar, nisbiy havolalar mavjud faylga olib boradi, `<script>` yo‘q, shaxsiy yo‘l yo‘q, manba matni yo‘q.

## Base URL va nashr
Sayt: <https://nbeast19.github.io/vositalar/hadis-manba-platformasi/web/> (repo `Nbeast19/vositalar`). Pages **GitHub Actions** orqali nashr qilinadi (`.github/workflows/hadis-manba-pages.yml`): repo fayllari + Release’dan olingan paketlar. Boshqa hosting/yo‘l bo‘lsa: `hadis-manba build-site --base-url <URL> …`.

## robots.txt
Crawlerlar faqat host ildizidagi `https://nbeast19.github.io/robots.txt` ni o‘qiydi. Project yo‘lidagi `web/robots.txt` ma’lumot uchun (unda `Sitemap:` qatori bor). Ildizda robots bo‘lmasa — hammasiga ruxsat. Bu loyihada `noindex` faqat ilova qobig‘ida.

## Jonli tekshiruv
`.github/workflows/hadis-manba-jonli.yml` har Pages nashridan keyin ishlaydi (`tests/live/live.pw.js`): sitemap’dagi har sahifa 200, self-canonical, o‘zaro hreflang + x-default, `<script>` yo‘q, PWA `noindex`, host ildizidagi robots.txt, 32 paket saytdan SHA-256 bilan, Release havolalari; en (1280 px) va ar (390 px) da kitob + sharh o‘rnatish → hadis → sharh → qaytish → oflayn qidiruv.

## Google Search Console (foydalanuvchi qadamlari — Google hisobingiz kerak)
1. <https://search.google.com/search-console> → **Add property** → **URL prefix** → `https://nbeast19.github.io/vositalar/` kiriting.
2. Tasdiqlash: **HTML file** usulini tanlang, `googleXXXXXXXX.html` faylini yuklab oling va menga yuboring (yoki o‘zingiz repo ildiziga — `vositalar/` — qo‘shib `main` ga push qiling). Pages nashridan keyin Search Console’da **Verify** ni bosing. (Muqobil: *HTML tag* — `<meta name="google-site-verification" …>` qatorini yuboring, uni ildizdagi `index.html` ga qo‘shaman.)
3. **Sitemaps** bo‘limida `https://nbeast19.github.io/vositalar/hadis-manba-platformasi/web/sitemap.xml` ni yuboring.
4. **URL inspection** bilan `…/web/en/` va `…/web/ar/` ni tekshirib, **Request indexing** ni bosing.
5. Bir necha kun/hafta ichida **Pages** hisobotida “Indexed” sahifalarni ko‘ring. Google indeksi yoki o‘rin **kafolatlanmaydi**.
