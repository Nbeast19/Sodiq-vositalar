# Sinov hisoboti

Sana: 2026-10-23. Buyruq: `sh scripts/verify.sh` (umumiy vaqt ~29 s). Faqat bajarilgan sinovlar "PASS" deb yozilgan.

## 1. Dastur ishlashi
| Sinov | Natija | Dalil |
|---|---|---|
| pytest (Python yadro, paket, import, qidiruv, sharh, huquq, audit, mahalliy xizmat, MCP) | **PASS — 63/63** | `tests/*.py` |
| Node: JS normalizatsiya va parcha Python bilan aynan bir xil, ZIP xavfsizligi, paket tekshiruvi | **PASS — 6/6** | `tests/web/core.node.test.js`, `tests/arabic_vectors.json` |
| Playwright: 12 ssenariy × (1280 px, 390 px) + konsol xatosi yo'qligi | **PASS — 26/26** | `tests/web/e2e.pw.js` → `build/e2e-natija.json` |
| Toza venv'da `pip install .` → `install`, `doctor`, `resolve` | **PASS** (MCP'siz: doctor ogohlantirish beradi, xato emas) | qo'lda bajarildi |
| Deterministik build (ikki marta → bir xil SHA-256) | **PASS** | `test_build_is_deterministic` + `sha256sum -c` |

### 22.1 Manba va import
| Talab | Holat |
|---|---|
| Kirish fayllari pre/post xesh bo'yicha o'zgarmagan | **PASS** (sun'iy kirish bilan `test_audit_read_only`; haqiqiy MIRQAT ZIP'larda `input_unchanged: true`) |
| SHA va sxema tekshiruvi | **PASS** (buzilgan bayt, ro'yxatda yo'q fayl, kod fayli, `..`, mutlaq yo'l, symlink, zip-bomb, JSON xato) |
| Ikki marta import — yozuv ko'paymaydi | **PASS** |
| Kumulyativ paketlar ikki marta sanalmaydi | **PASS (texnik)**: versiya almashtirishda sanoq 12 da qoladi; MIRQAT 380/480 — 480 ning boshi 380 bilan baytma-bayt bir xil ekani tekshirildi. Haqiqiy oilalar importi — **bajarilmagan** |
| A'ning 14 431 qatori auditi | **bajarilmagan** — A ZIP bu sessiyaga kelmagan (audit kodi tayyor va sun'iy A TSV bilan sinalgan) |
| Import → eksport semantik tengligi | **qisman**: `export` JSON core javobining o'zi; alohida round-trip testi yo'q |
| Xato paket ishlaydigan bazaga zarar qilmaydi | **PASS** (IntegrityError → ROLLBACK; buzilgan fayl → rad + jurnal) |
| `rollback` | **PASS** (Python va PWA) |

### 22.2 Matn va ilmiy identifikatsiya (sun'iy namuna bilan)
PASS: hash qatlamlari (asl bo'sh ↔ joriy matn), `row:N` bosma raqam emas, guruhli raqam `7;8`, jild bo'yicha bir xil raqam ajraladi, umumiy sharh = 1 uchrashuv/3 link, takroriy uchrashuv, mursal/mavquf/muallif bayoni/bob sarlavhasi, zaxira roviy alohida, RAQAMSIZ/IMKONSIZ original saqlanadi, iqtibos faqat asl matn bo'laklaridan, preview_window, nashrlar aralashmaydi, manzil qulfi (fayl o'zgarsa `stale_hash`), muallif qidiruvida naql/hoshiya chiqariladi.
**Bajarilmagan (haqiqiy ma'lumot kerak):** Muslim mahalliy 1233 ↔ bosma 591 fixture, Muvatto uzluksiz ↔ kitob:hadis, Shamoil Julaymiy/Sunnah xaritasi, Tabaroniy jild+raqam+nashr, 125 Muvatto haqiqiy qatlami, Tibiy j01 mualliflik xaritasi, Fath Dar al-Ma'rifa ↔ Salafiyya.

### 22.3 Qidiruv, API, MCP
PASS: aniq/harakatsiz/raqam bir xil birlikka olib boradi; bir nechta nomzod avtomatik tanlanmaydi; `not_found` / `not_installed` / `invalid_parameter` / `timeout` farqlanadi; API (HTTP) va core bir xil natija; **haqiqiy MCP mijozi** (rasmiy SDK `Client`, STDIO, alohida jarayon) — tools ro'yxati, qidiruv, dalil; SQL-ga o'xshash so'rov oddiy matn; limit 50 bilan cheklangan; manba ichidagi ko'rsatma ta'sir qilmaydi; Host/Origin/yo'l tekshiruvi.
Sinalmagan: Claude Desktop/Code, Cursor va boshqa GUI mijozlar.

### 22.4–22.5 Tarqatma, UI, o'rnatish
PASS: allowlist (unknown/restricted/noaniq conditional chiqariladi, shaxsiy yo'l rad etiladi); Git'da xom manba, Qur'on korpusi, shaxsiy yo'l yo'q (kirishlar repo tashqarisida); har paketda LICENSE/ATTRIBUTION; oflayn ishlash (headless Chromium); 390 px'da gorizontal siljish yo'q; arabcha `dir=rtl`; konsolda xato yo'q; GitHub project path (`/<repo>/hadis-manba-platformasi/web/`) ostida nisbiy URL'lar ishlaydi.
**Bajarilmagan:** real iPhone/Android/Windows/Mac (`PLATFORM-TEST-MATRIX.md`); GitHub Pages'ga nashr va jonli URL tekshiruvi; release asset yuklab olish checksum'i (release yaratilmagan).

## 2. Ilmiy qamrov
**INCOMPLETE.** Repodagi barcha paketlar sun'iy sinov namunasi. Haqiqiy korpus: MIRQAT 380/480 va transfer boshqaruv paketi fayl darajasida tekshirildi; transport 10/89. `COVERAGE.md`.

## 3. Ommaviy tarqatish huquqi
Ommaviy katalogda faqat CC0 sinov namunasi. Haqiqiy manbalar uchun huquq yozuvlari `RIGHTS.md`da; hech biri hali public build'ga kiritilmagan.
