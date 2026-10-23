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

## Base URL
Standart: `https://nbeast19.github.io/vositalar/hadis-manba-platformasi/web/` (repo `Nbeast19/vositalar`, Pages `main` dan). Boshqa hosting/yo‘l bo‘lsa: `hadis-manba build-site --base-url <URL> …`. **Ish branchi merge qilinmaguncha bu URLlar jonli emas.**

## robots.txt
Crawlerlar faqat host ildizidagi `https://nbeast19.github.io/robots.txt` ni o‘qiydi. Project yo‘lidagi `web/robots.txt` ma’lumot uchun (unda `Sitemap:` qatori bor). Ildizda robots bo‘lmasa — hammasiga ruxsat. Bu loyihada `noindex` faqat ilova qobig‘ida.

## Nashrdan keyin (foydalanuvchi qadamlari)
1. Ish branchini `main` ga merge qiling (yoki Pages manbasini shu branchga sozlang).
2. Jonli tekshiruv (avtomatik): har `/en/` va `/ar/` sahifa 200 qaytaradi, canonical/hreflang/sitemap jonli URL bilan mos — bu tekshiruv merge’dan keyin bajariladi.
3. **Google Search Console:** `https://nbeast19.github.io/vositalar/` URL-prefix mulkini qo‘shing, tasdiqlang (HTML fayl yoki meta-teg — bu qadam sizning Google hisobingizni talab qiladi), so‘ng `…/hadis-manba-platformasi/web/sitemap.xml` ni yuboring.
4. Google indeksi yoki birinchi o‘rin **kafolatlanmaydi**.
