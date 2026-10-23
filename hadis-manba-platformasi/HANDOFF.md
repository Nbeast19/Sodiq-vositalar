# HANDOFF — Hadis Manba (2026-10-23)

Bu fayl keyingi sessiya/agent uchun: nima qilingan, nima qolgan, qayerda nima turibdi. Foydalanuvchi bilan muloqot **o‘zbek tilida**.

## 1. Asosiy talablar (o‘zgarmaydi)

- Har **asosiy kitob alohida**, har **sharh alohida** paket; “faqat kitob”, “faqat sharh”, “kitob + tanlangan sharhlar”. Birga o‘rnatilsa hadis ↔ sharh **ikki tomonlama** bog‘lanadi (faqat mos nashr va versiyada; raqam bir xilligi yetarli emas).
- **Windows, Mac, iPhone, Android**: AIsiz, internetsiz o‘qish/qidirish/sharhga o‘tish (PWA, IndexedDB, Web Worker). Telefon uchun Python/server talab qilinmaydi.
- **26-bo‘lim (yangi):** ommaviy sayt, PWA, katalog, yordam va o‘rnatish qo‘llanmalari **English va العربية** tillarida. Til tanlovi saqlanadi; ar=RTL, en=LTR; arabcha manba doim RTL; aralash matnda bidi isolation. Oddiy yo‘l: kutubxona → kitob → (faqat kitob | tanlangan sharhlar bilan) o‘rnatish → qidirish/o‘qish → shu hadis sharhi → manbali iqtibos. Terminal/Python/API kaliti/AI/hisob talab qilinmaydi; MCP — alohida ixtiyoriy bo‘lim. Katta tugmalar, yuklash hajmi/holati, “o‘rnatilgan / oflayn tayyor” belgilari. Hadis/sharhning yangi tarjimasi **o‘ylab topilmaydi** (faqat UI tarjimasi).
- **SEO:** `/en/` va `/ar/` barqaror URLlar, oldindan yaratilgan HTML (bosh sahifa, kitob/sharh kartalari, muallif, yordam), self-canonical, o‘zaro hreflang + x-default, sitemap, robots tekshiruvi. Butun GB manba sayt qobig‘iga kirmaydi; shaxsiy qaydlar/mahalliy fayllar public chiqmaydi. Rasmiy tayanch: Google “localized versions” va “JavaScript SEO basics”. Indeks/o‘rin kafolatlanmaydi; Search Console tasdig‘i kerak bo‘lsa — yakuniy qadam sifatida yoziladi.
- Real qurilmada sinalmagan narsaga **PASS yozilmaydi**. Ilmiy qamrov **INCOMPLETE** — fayl yetkazilishi bilan aralashtirilmaydi.
- Manba fayllari **read-only**. Xom korpus va shaxsiy 0-Manba **public repoga yuklanmaydi**. Qur’on/qiroat va shaxsiy qo‘lyozmalar doiradan tashqari.

## 2. Repo va branch

- Repo: `Nbeast19/vositalar` (avvalgi nomi `desktop-tutorial`, **public**, Pages: https://nbeast19.github.io/vositalar/ — `main` dan). Ishchi branch: **`claude/new-session-f9jsvi`** (merge qilinmagan, PR ochilmagan).
- Loyiha papkasi: `hadis-manba-platformasi/`. CI: `.github/workflows/hadis-manba.yml` (path filtri bilan).

## 3. Bajarilgan

| Qism | Holat | Joyi |
|---|---|---|
| Python yadro: SQLite+FTS5 trigram, `ar-search-v1`, `.hmz` paket formati, xavfsiz ZIP, atomik install/upgrade/rollback, append-only jurnal, core API (13 tool), iqtibos kartasi | ✓ | `src/hadis_manba/` |
| Faqat-o‘qish audit (registry, baseline, schema probe, ichki MANIFEST, pre/post xesh) | ✓ | `audit.py` |
| MCP server (rasmiy SDK `mcp==2.3.0`, STDIO), mahalliy HTTP (127.0.0.1, Host/Origin), CLI, doctor | ✓ | `mcp_server.py`, `server.py`, `cli.py` |
| Allowlist public build (public / conditional / local_only + maxfiylik skani) | ✓ | `publish.py` |
| PWA: IndexedDB paket ombori (staging → faollashtirish), Worker qidiruv, alohida qaydlar bazasi, service worker | ✓ | `web/` |
| **Haqiqiy importerlar**: `raqamlar.sqlite`+hadith-json → 33 asos paket (29 kitob); sharhlar → 17 sharh paketi | ✓ | `src/hadis_manba/importers/`, `scripts/import_real.py`, `docs/IMPORT-RUN04.md` |
| Qidiruv tezligi (filtr → sahifa): «طلب العلم» 7,9 s → 67 ms | ✓ | `core.search_hadith` |
| i18n (en/ar/uz) PWA interfeysi, yangi oddiy yo‘l (#/ kutubxona → #/w/<work> → install), `data-act` test belgilari | ✓ (E2E 64/64) | `web/js/i18n.js`, `web/js/app.js`, `web/index.html`, `web/style.css` |
| Katalogda nomlar/mualliflar (`names`, `authors`, `names_origin`), importerlarda inglizcha/tahririy nomlar | ✓ (real paketlar 1.0.1 qayta yasaldi) | `publish.py`, importerlar |
| SEO statik sayt `/en/`, `/ar/` (canonical, hreflang, x-default, sitemap) | ✓ | `site.py`, `hadis-manba build-site`, `docs/SEO.md`, `tests/test_site.py` |
| Ikki tilli hujjatlar: `README.md` (en), `README.ar.md`, `README.uz.md`, `docs/QUICKSTART.{en,ar}.md`, `docs/{en,ar}/INSTALL.md` | ✓ | |

## 4. Test natijalari (oxirgi ishga tushirish)

- `sh scripts/verify.sh`: pytest **65 passed**, 10 skipped; Node **7/7**; Playwright **64/64** (en/ar × 1280/390, oflayn).
- Haqiqiy korpus: `HADIS_MANBA_REAL_HOME=/home/user/hadis-manba-kirish/library-run04 pytest tests/test_real_corpus.py` → **10/10**.
- Real iPhone/Android/Windows/Mac: **sinalmagan**.

## 5. Haqiqiy manba (repo TASHQARISIDA, faqat o‘qish)

| Narsa | Joy | Holat |
|---|---|---|
| R3 nusxa (dot-20261023-03) | `/home/user/hadis-manba-kirish/hadis-input-run03/` | VERIFIED: 12 366 fayl, 6 897 901 261 bayt, manifest `704e0d2d…b28` |
| R4 nusxa (dot-20261023-04) — **joriy** | `/home/user/hadis-manba-kirish/hadis-input-run04/` | VERIFIED: 13 832 fayl, 7 137 580 275 bayt, target `13496ac3…c3d0c9`; o‘zgarmaganlar R3 bilan **hardlink** (ikkalasini ham o‘zgartirmang) |
| Receiptlar | `reassembled/`, `r4/control/`, scratchpad `RECEIPTS-R3-R4.zip` (SHA `156fc662…38aa7e`) | foydalanuvchiga yuborilgan |
| Paketlar (real) | `/home/user/hadis-manba-kirish/output-run04/dist/` (50 `.hmz`), `IMPORT-REPORT.json` | asos 1.0.1, sharh 1.0.0 |
| Mahalliy kutubxona | `/home/user/hadis-manba-kirish/library-run04/` (2,3 GB) | 50 paket o‘rnatilgan |
| Transport bo‘laklari, MIRQAT ZIPlar | `transport/`, `zips/`, `r4/parts/` | hammasi SHA bilan tasdiqlangan |

Bulut konteyneri vaqtinchalik: bu papkalar sessiya tugasa yo‘qoladi (qayta yetkazish kerak bo‘ladi).

## 6. Muhim cheklovlar va qarorlar

- Huquq: hadith-json (sunnah.com) 17 kitob — `approved` (foydalanuvchi tasdiqlagan Sunnah.com ruxsati); hadis-qoshimcha (Shamela asosidagi) 12 kitob — `unknown` → local_only; OpenITI sharhlari — `conditional` CC BY-NC-SA 4.0; goldenshamela/islamarchive sharhlari — `unknown`.
- **Haqiqiy paketlarni public repoga/Pages’ga joylash hali QILINMAGAN** — foydalanuvchidan aniq tasdiq kutiladi (repo public; git tarixi qaytmaydi). Hozir `web/catalog.json` faqat sinov namunasi.
- Sharh matnlari `preview_window` (3000 belgi, keyingi uchrashuvda kesiladi); `sharh_belgi` 1-based; eski qatlam `legacy_unreviewed`; asosga topilmagan bog‘lama yaratilmaydi (Mirqot 1 084, Tibiy 655 — asos Mishkot 4 428 yozuv).
- Tibiy: mualliflik `attribution_unresolved`. Inglizcha tarjima paketlarga kiritilmagan.
- O‘tkazib yuborilgan sharhlar: `muslim/fath-al-mulhim`, `tirmidhi/maarif-al-sunan` (META: bog‘lama/matn yo‘q).

## 7. Qolgan vazifalar (tartib bilan)

1. Foydalanuvchiga savol: ruxsatli real paketlarni (hadith-json kitoblari; OpenITI sharhlari shartli kanal) public Pages/Release’ga joylashga ruxsatmi? Mahalliy real sayt: `/home/user/hadis-manba-kirish/site-run04/`.
2. Ruxsatdan keyin: `main` ga merge, jonli URL/hreflang/canonical/sitemap tekshiruvi; Search Console — foydalanuvchi qadami (`docs/SEO.md`).
3. Real qurilmalarda en/ar matritsasi (`PLATFORM-TEST-MATRIX.md`) — foydalanuvchi natija yuborsa yoziladi.
4. Katta paketlarni jild bo‘yicha bo‘lish (telefon xotirasi), yuklashni davom ettirish (resume).

## 8. Buyruqlar

```sh
cd hadis-manba-platformasi
python3 scripts/build_demo.py              # sinov paketlari + web/catalog.json
python3 -m pytest -q                       # (venv: mcp==2.3.0, pytest, jsonschema)
node tests/web/core.node.test.js
NODE_PATH=$(npm root -g) node tests/web/e2e.pw.js
hadis-manba build-site --catalog web/catalog.json --out web --base-url <URL>
HADIS_MANBA_REAL_HOME=/home/user/hadis-manba-kirish/library-run04 python3 -m pytest -q tests/test_real_corpus.py
```
