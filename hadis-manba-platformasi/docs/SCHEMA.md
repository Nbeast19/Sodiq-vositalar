# Ma'lumot modeli (SQLite, sxema 1.0.0)

Manba: `src/hadis_manba/db.py` (kompyuter), `web/js/lib.js` (PWA — bir xil ID va maydonlar, IndexedDB'da). Lug'atlar: `src/hadis_manba/model.py`.

## Uch matn qatlami
| Qatlam | Qayerda | Qoidalar |
|---|---|---|
| `raw` | `raw_sha256`, `source_files(layer='raw')` | original baytlar xeshi; o'zgarmaydi |
| `derived` | `text_ar`, `current_text_sha256`, `text_corrections`, `text_history` | dalilli tuzatish ledger bilan; jim NFC/NFKC, harf almashtirish yo'q |
| `search` | `text_norm`, `normalized_text_sha256`, `search_fts` (FTS5 trigram) | `ar-search-v1`; iqtibos uchun ishlatilmaydi; ekranda asl matn |

`raw_sha256 ≠ current_text_sha256` qonuniy holat bo'lishi mumkin (masalan asl yozuvda matn bo'sh edi, keyin dalil bilan qo'shildi) — bu `text_history` va cheklov bilan ochiq ko'rsatiladi. Qidiruv, API va MCP doimo joriy matnga murojaat qiladi.

## Jadvallar
| Jadval | Maqsad |
|---|---|
| `package_versions` | o'rnatilgan paket versiyalari (`active`/`superseded`/`removed`), saqlangan fayl, manifest |
| `import_journal` | append-only (UPDATE/DELETE trigger bilan taqiqlangan) + `import-journal.jsonl` |
| `rights` | har paket × `applies_to` huquq yozuvi |
| `works`, `persons`, `work_contributors`, `editions`, `sources`, `source_files`, `numbering_schemes` | bibliografiya va provenance |
| `text_units` | birlik: `unit_type`, `attribution_kind` (nisbat turi, hukm emas), `text_kind`, matn qatlamlari, `statuses` (JSON), `limitations`, `location` |
| `unit_identifiers` | original IDlar namespace bilan (`book`, `record_id`, `row`, `bizning_id`…); `row` hech qachon bosma raqam emas |
| `number_assertions` | birlik → raqam/sahifa: `scheme_id`, `volume`, `number_text` (guruh saqlanadi), `number_int`, `variant`, `number_status`, `original_value`, `reason`, `page` (noma'lum = NULL) |
| `narrator_assertions` | terminal shaxs, `fallback_person_id` (alohida, birlashtirilmaydi), status, `original_value` (IMKONSIZ…), sabab |
| `grading_assertions` | olim aytgan hukm: `scholar_person_id`, `source_ref` majburiy |
| `topic_assertions` | `origin`: source_heading / editorial_tag / ai_suggestion |
| `parallel_relations` | same_report / parallel_variant / exact_text / number_correspondence / uncertain |
| `commentary_occurrences` | sharh uchrashuvi: `link_kind`, `lemma_kind`, `scope`, `segments` (mualliflik qatlamlari), statuslar |
| `commentary_links` | uchrashuv ↔ asos birlik (ko'pdan ko'pga), `legacy_confidence` alohida |
| `evidence`, `reviews` (technical/scholarly alohida), `text_corrections`, `coverage` | dalil, tekshiruv, tuzatish ledgeri, qamrov |
| `search_fts` | FTS5 trigram (`text_norm`) |

## Holat maydonlari (bir-birini bosmaydi)
`transport_integrity, source_identity_status, edition_identity_status, number_status, narrator_identity_status, text_preservation_status, commentary_link_status, commentary_start_status, commentary_end_status, printed_page_status, semantic_review_status, rights_status`

Qiymatlar: `verified`, `limited`, `conflict`, `not_found` (aynan ko'rilgan manbada topilmagan — "dunyoda yo'q" emas), `unreviewed` (hali ish), `not_applicable`.
Original `IMKONSIZ`/`RAQAMSIZ` o'chirilmaydi: `original_value` + `reason`, ma'no bo'yicha yangi statusga xaritalanadi.

## Doimiy IDlar
- `unit_id = <edition_id>:<lokal>` — `book + printed_number` emas (jildlarda raqam qayta boshlanadi, nashrlar farq qiladi, bitta raqam bir nechta matnni qamraydi).
- Ikki nashr bitta asarga bog'lanadi (`work_id`), lekin birliklari bitta to'plamga eritilmaydi; munosabat `parallel_relations` orqali.

## Atomik yangilash
Paket o'rnatish: staging'ga nusxa → to'liq tekshiruv → **bitta tranzaksiya**: eski versiya qatorlari o'chiriladi, yangilari (matn + koordinata + qidiruv indeksi birga) yoziladi, versiya `active` bo'ladi, jurnal yoziladi. Xato → ROLLBACK, eski ma'lumot joyida. `rollback` buyrug'i saqlangan oldingi faylni qayta o'rnatadi.
