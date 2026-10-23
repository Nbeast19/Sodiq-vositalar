# Hadis Manba

[العربية](README.ar.md) · [O‘zbekcha](README.uz.md)

**Hadith books and their commentaries — read and search offline, copy citations with their source.**

- **Simple:** Library → choose a book → install *the book only* or *the book with the commentaries you select* → read or search → open the commentary on this hadith → copy a citation with its source. No account, no Python, no API key, no AI.
- **Offline on Windows, Mac, iPhone and Android:** an installable web app (PWA). Each book and each commentary is a separate download stored on your device.
- **Linked both ways:** when a book and its commentary are both installed, a hadith opens its commentary passages and a commentary returns to its hadith — only for the matching edition and version.
- **Honest about limits:** every result shows its status (verified · limited · conflict · not found · not reviewed), its coverage and its licence. A search match is not a verified identification of a hadith.
- **Interface in English and العربية** (and O‘zbek). Arabic source text is always shown right-to-left and is never machine-translated.

## Quick start

→ [docs/QUICKSTART.en.md](docs/QUICKSTART.en.md) (one page) · [docs/en/INSTALL.md](docs/en/INSTALL.md) (Windows, Mac, iPhone, Android, Linux)

**Open the app:** <https://nbeast19.github.io/vositalar/hadis-manba-platformasi/web/> · Catalogue: [English](https://nbeast19.github.io/vositalar/hadis-manba-platformasi/web/en/) · [العربية](https://nbeast19.github.io/vositalar/hadis-manba-platformasi/web/ar/)

**Packages:** 17 main books (Sunnah.com, shared with permission) and 15 commentaries (OpenITI, CC BY-NC-SA 4.0 — non-commercial, share-alike, attribution) — each a separate download in the GitHub Release [hadis-manba-paketlar-v1](https://github.com/Nbeast19/vositalar/releases/tag/hadis-manba-paketlar-v1), with `SHA256SUMS` and `RIGHTS-PAKETLAR.md` (licence, author, edition and attribution per package). Packages with unknown rights are not published; they stay local only ([docs/RIGHTS.md](docs/RIGHTS.md)).

## For advanced users (optional)

A desktop command-line tool (Python 3.10+) provides the same data model with SQLite full-text search, safe package import, rollback, an audit of source folders, a local service on `127.0.0.1` and an **MCP server** for AI clients:

```sh
pip install ".[mcp]"
hadis-manba doctor
hadis-manba install book.hmz
hadis-manba search "انما الاعمال بالنيات"
hadis-manba mcp            # MCP over STDIO — see docs/AI-ULASH.md
```

## Project layout

```
web/                 PWA (index.html, js/, sw.js) + prerendered /en/ and /ar/ catalogue pages, sitemap.xml
src/hadis_manba/     core, package format, importers, audit, publish (allowlist), site generator, MCP, CLI
tests/               pytest, Node and Playwright (English + Arabic, 1280px + 390px, offline)
docs/                guides (en, ar, uz), schema, package format, rights, coverage, validation report
```

## Three separate statuses

1. **Software:** see [docs/VALIDATION-REPORT.md](docs/VALIDATION-REPORT.md) — automated tests in headless Chromium; real devices not yet tested.
2. **Scholarly coverage:** INCOMPLETE ([docs/COVERAGE.md](docs/COVERAGE.md)).
3. **Public distribution rights:** allowlist only ([docs/RIGHTS.md](docs/RIGHTS.md)).

## Licence

Code: MIT ([LICENSE](LICENSE)). Each data package carries its own licence and attribution; the code licence grants no rights to source texts.
