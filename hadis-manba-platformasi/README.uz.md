# Hadis Manba (o‘zbekcha)

[English](README.md) · [العربية](README.ar.md)

Hadis to'plamlari va ularning sharhlarini **manbasi kuzatiladigan** tarzda o'qish, qidirish va iqtibos qilish vositasi.

- **AIsiz, internetsiz:** telefon (iPhone/Android) va kompyuterda (Windows/Mac/Linux) o'rnatiladigan PWA. Kitob va sharh paketlari qurilmaning o'zida saqlanadi.
- **Har kitob alohida, har sharh alohida paket.** "Faqat kitob", "faqat sharh" yoki "kitob + tanlangan sharhlar". Birga o'rnatilsa hadis ↔ sharh ikki tomonga bog'lanadi (faqat mos nashr va versiyada).
- **Kompyuter yadrosi (Python):** SQLite + FTS5, xavfsiz paket importi, rollback, audit, mahalliy xizmat va **MCP server** (AI ulash ixtiyoriy).
- **Cheklovlar yashirilmaydi:** har natijada holat (`verified` / `limited` / `unreviewed` …), qamrov va huquq ko'rinadi.

> Hozirgi ommaviy demo faqat **sun'iy SINOV NAMUNASI** paketlarini o'z ichiga oladi. Haqiqiy korpus huquqi tasdiqlangach alohida paket bo'lib chiqadi (`docs/RIGHTS.md`).

## Tez boshlash

| Kim | Qayerdan |
|---|---|
| Oddiy foydalanuvchi | [docs/FOYDALANISH-UZ.md](docs/FOYDALANISH-UZ.md) — 1 sahifalik yo'riqnoma |
| iPhone / Android | [docs/INSTALL-IPHONE.md](docs/INSTALL-IPHONE.md), [docs/INSTALL-ANDROID.md](docs/INSTALL-ANDROID.md) |
| Windows / Mac / Linux | [docs/INSTALL-WINDOWS.md](docs/INSTALL-WINDOWS.md), [docs/INSTALL-MAC.md](docs/INSTALL-MAC.md), [docs/INSTALL-LINUX.md](docs/INSTALL-LINUX.md) |
| AI ulash (MCP) | [docs/AI-ULASH.md](docs/AI-ULASH.md) |

Kompyuterda (Python 3.10+, sinalgan: 3.13):

```sh
pip install ".[mcp]"          # yoki: pip install .   (MCP'siz)
hadis-manba doctor            # holatni tekshirish
hadis-manba install paket.hmz # paket o'rnatish
hadis-manba search "طلب العلم"
hadis-manba serve --web web   # http://127.0.0.1:8765/
hadis-manba mcp               # MCP server (STDIO)
```

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `audit --zips DIR --manba DIR --out DIR` | Kirish papkalarini **faqat o'qib** audit: `PACKAGE-REGISTRY.json`, `AUDIT-BASELINE.json`, `SCHEMA-PROBE.json`, pre/post xesh |
| `build-package SRC --out dist` | Manba papkasidan deterministik `.hmz` |
| `verify FILE…` | Paketni xavfsizlik, SHA-256 va sxema bo'yicha tekshirish |
| `install` / `uninstall` / `rollback` / `list` / `journal` | Atomik o'rnatish, append-only jurnal, oldingi versiyaga qaytish |
| `search` / `get` / `resolve` / `commentary` / `cite` / `coverage` / `export` | O'qish va iqtibos (JSON/TSV eksport MCP'siz AI uchun) |
| `build-public FILE… --out DIR` | Faqat huquqi tasdiqlangan paketlardan ommaviy katalog (allowlist) |
| `doctor`, `serve`, `mcp` | Tekshiruv, mahalliy xizmat (faqat 127.0.0.1), MCP |

## Tuzilma

```
src/hadis_manba/   Python yadro: arabic, db, pkgformat, safezip, store, core, search, citations,
                   audit, publish, validators, doctor, server, mcp_server, cli
web/               PWA: index.html, js/{arabic,zip,pkg,lib,notes,search-worker,app}.js, sw.js
examples/          SINOV NAMUNASI generatori (sun'iy ma'lumot)
tests/             pytest + Node + Playwright (12 ssenariy x 2 o'lcham)
docs/              hujjatlar, audit, qamrov, huquq, sinov hisoboti
manifests/         ommaviy paketlar ro'yxati va JSON sxemalar
scripts/           build_demo, make_icons, make_release, verify.sh
```

## Sinov

```sh
sh scripts/verify.sh     # pytest + Node + Playwright
```

Natijalar va bajarilmagan qismlar: [docs/VALIDATION-REPORT.md](docs/VALIDATION-REPORT.md).

## Uch holat alohida

1. **Dastur ishlashi** — sinovlar bilan tasdiqlangan qismlar `VALIDATION-REPORT.md`da.
2. **Ilmiy qamrov** — `COVERAGE.md`: INCOMPLETE; texnik import ilmiy tasdiq emas.
3. **Ommaviy tarqatish huquqi** — `RIGHTS.md`: faqat allowlist; noma'lum/cheklangan manba public build'ga kirmaydi.

## Litsenziya

Kod: MIT ([LICENSE](LICENSE)). **Ma'lumot litsenziyasi har paketda alohida** (`LICENSE`, `ATTRIBUTION`, manifestdagi `rights`). Kod litsenziyasi manba matnlarga huquq bermaydi.
