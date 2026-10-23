# AIga ulash (MCP va MCP'siz)

Dastur AIsiz to'liq ishlaydi. AI ulash — ixtiyoriy qo'shimcha, faqat **kompyuterda** (Python). Telefon PWA'si AIga ulanmaydi.

## MCP server

- SDK: rasmiy Python SDK `mcp==2.3.0` (pin qilingan), `MCPServer`, transport: **STDIO** (mahalliy).
- Ishga tushirish: `hadis-manba mcp` (yoki `python -m hadis_manba mcp`). Ma'lumot joyi `--home` yoki `HADIS_MANBA_HOME`.
- Masofaviy (HTTP) MCP — keyingi alohida bosqich. GitHub Pages Python serverini ishlatmaydi.

### Mijoz sozlamasi (MCP'ni qo'llovchi mijozlar uchun umumiy shakl)

```json
{
  "mcpServers": {
    "hadis-manba": { "command": "hadis-manba", "args": ["mcp"] }
  }
}
```
Venv ishlatsangiz `command` ga to'liq yo'l yozing (masalan `~/.hadis-manba-venv/bin/hadis-manba`).

### Sinalgan mijozlar

| Mijoz | Natija | Dalil |
|---|---|---|
| Rasmiy Python SDK `mcp.Client` (STDIO, alohida jarayon) | **o'tdi**: tools ro'yxati (13), `search_hadith`, `get_evidence`, `get_hadith` | `tests/test_server_mcp.py::test_mcp_stdio_real_client` |
| Claude Desktop, Claude Code, Cursor, VS Code va boshqalar | **sinalmagan** | Bu muhitda GUI mijozlar yo'q. Ular MCP STDIO'ni qo'llaydi deb e'lon qiladi, lekin bu loyiha bilan amalda tekshirilmagan |

"Xohlagan AI" va'da qilinmaydi: MCP'ni qo'llamaydigan mijozda pastdagi MCP'siz yo'l ishlatiladi.

## Tools (faqat o'qish)

| Tool | Vazifa |
|---|---|
| `list_books(filters, cursor, limit)` | o'rnatilgan va katalogdagi paketlar |
| `get_book(book_id, edition_id)` | nashrlar, raqamlash tizimlari, mualliflar, qamrov, huquq |
| `list_commentaries(book_id, author_id, edition_id)` | sharhlar va bog'lanish holati |
| `search_hadith(query, book_ids, numbering_scheme, filters, cursor, limit)` | `filters.mode`: normalized/exact; `scope`: all/base/commentary; `author_id`; `verified_only` |
| `get_hadith(unit_id, edition_id)` | asl matn, raqamlar, roviy (zaxira alohida), hukmlar (olim+manba), mavzular (kelib chiqishi bilan), sharhlar |
| `resolve_reference(book_id, number, scheme_id, volume, variant)` | barcha nomzodlar; bir nechta bo'lsa `ambiguous: true` |
| `get_commentary(hadith_unit_id, commentary_work_id, edition_id, occurrence_id, max_chars)` | segmentlar (hadis lafzi / shorih / naql / hoshiya / aniqlanmagan), `scope`, `start_verified`, `end_verified` |
| `search_author_topic(author_id, query, work_ids, cursor, limit)` | muallifning **o'z nasri**dagi mos joylar |
| `get_parallel_reports(unit_id, relation_type)` | same_report / parallel_variant / exact_text / number_correspondence / uncertain |
| `get_evidence(evidence_id)` | dalil yozuvi |
| `get_citation(unit_id_or_occurrence_id, style)` | haqiqiy maydonlardan iqtibos kartasi |
| `get_coverage(work_id, edition_id)` | qamrov; maxraj tasdiqlanmasa foiz yo'q |
| `get_source_status(source_id)` | manba, fayllar, huquq |

Har javob: `schema_version`, `corpus_version`, `results`, `evidence_ids`, `limitations`, `next_cursor`, `error`, `data_notice`.
Xatolar alohida: `not_found`, `not_installed`, `invalid_parameter`, `timeout`, `output_too_large`.
Xavfsizlik: ixtiyoriy fayl yo'li, shell, SQL yo'q; parametrli SQL; `limit` ≤ 50; `max_chars` ≤ 20000; 10 s vaqt; javob hajmi cheklangan. Manba matni ma'lumot sifatida qaytadi (sinov: matn ichidagi "IGNORE ALL PREVIOUS INSTRUCTIONS…" hech narsa qilmaydi).

## AI uchun qoidalar (server `instructions` ichida ham bor)

1. Javobdan oldin mos manbani tool orqali oling.
2. Arabcha iqtibos va o'zbekcha tushuntirishni ajrating.
3. Faqat tool qaytargan muallif, raqam, nashr va manzilni ishlating.
4. `limited`/`unreviewed` nomzodni qat'iy dalil qilmang.
5. Shorih matni qaytmasa, shorih nomidan javob yozmang.
6. Hadis lafzi, shorih nasri, naql va hoshiyani aralashtirmang.
7. Ixtilofli roviy, matn yoki mualliflikni ochiq ayting.
8. Yangi sahih/zaif hukmi yoki fatvo chiqarmang; faqat `gradings`dagi olim hukmini manbasi bilan keltiring.

## Plagin uchun barqaror shartnoma

- Tool nomlari va konvert maydonlari `schema_version` 1.x davomida o'zgarmaydi; yangi maydon qo'shilishi mumkin, olib tashlanmaydi.
- Doimiy ID: `unit_id` = `<edition_id>:<lokal id>`, `occurrence_id` = `<sharh edition_id>:<lokal id>`. Bosma raqam ID emas.
- Misol:
  ```json
  → {"tool": "resolve_reference", "args": {"book_id": "w-namuna", "number": "5"}}
  ← {"results": [4 nomzod], "ambiguous": true,
     "limitations": ["bir nechta nomzod topildi ... Birinchisi avtomatik tanlanmadi."]}
  ```

## MCP'siz AI uchun

- PWA'da **Iqtibosni nusxalash** — manba kartasi.
- Kompyuterda: `hadis-manba export <ID> --format json|tsv`, `hadis-manba search "..." --format tsv`.
- Mahalliy HTTP: `hadis-manba serve` → `POST http://127.0.0.1:8765/api/<tool>` (JSON body) — faqat shu kompyuterdan.
