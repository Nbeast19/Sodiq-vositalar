# Paket formati (`.hmz`, sxema 1.0.0)

`.hmz` — oddiy ZIP. Ichida kod bo'lmaydi; bo'lsa ham bajarilmaydi va ruxsat etilmagan fayl sifatida rad etiladi.

```
package.json      manifest
LICENSE           ma'lumot litsenziyasi / sharti
ATTRIBUTION       nisbat berish matni
COVERAGE.json     qamrov (+ "computed" — yaratishda hisoblangan)
SHA256SUMS        "<sha256>  <yo'l>" — SHA256SUMS'dan boshqa barcha fayllar
data/entities.json        works, persons, work_contributors, editions, sources, source_files, numbering_schemes
data/units.jsonl          (base_book) matn birliklari
data/occurrences.jsonl    (commentary) sharh uchrashuvlari
data/links.jsonl          (commentary) link_maps: occurrence -> asos birlik
data/evidence.jsonl, parallels.jsonl, corrections.jsonl, reviews.jsonl   (ixtiyoriy)
packages/*.hmz    (faqat kind=selection yig'masida) ichki paketlar
```

## `kind`
- `base_book` — bitta asar, bitta nashr. `work_id`, `edition_id` majburiy.
- `commentary` — bitta sharh asari, bitta nashr. `requires_for_linked_reading` majburiy:
  ```json
  [{"target_work_id": "w-namuna", "target_edition_id": "ed-namuna-a", "compatible_package_versions": ["1.*"]}]
  ```
  Bog'lama faqat shu nashr va mos versiyadagi asos paket o'rnatilganda faollashadi. Asos yo'q bo'lsa ham sharh mustaqil o'qiladi va qidiriladi.
- `selection` — "kitob + tanlangan sharhlar": `contains` (package_id, package_version, package_sha256, kind). O'rnatilganda allaqachon o'rnatilgan bir xil paket qayta yozilmaydi.

## Manifest maydonlari
`package_id, kind, package_version (X.Y.Z), schema_version, work_id, edition_id, source_revision, title{uz,ar}, author_ids, compressed_bytes (ZIP ichida null — tashqi *.manifest.json va catalog.json'da), installed_bytes, temporary_space_bytes (taxminiy, o'lchanmagan), file_hashes, search_index_version, normalization_version (ar-search-v1), provides_units, coverage, source_metadata, attribution, rights[], compatible_app_versions, requires_for_linked_reading`.

`rights[]` har yozuvi: `applies_to (code|classical_body|translation|editorial_notes|scan|metadata|derived_index), rights_status (approved|conditional|unknown|restricted), license_id, license_url, license_evidence_file, license_checked_at, redistribution_allowed (true|false|null), commercial_use_allowed, required_attribution, share_alike_requirements, permission_evidence` (+ shartli uchun `conditional_scope_clear`). `unknown/restricted` da `redistribution_allowed=true` bo'lishi mumkin emas.

## Birlik (`units.jsonl`)
`unit_id` (`<edition_id>:…`), `seq`, `unit_type` (hadith, athar_sahabi, athar_tabii, author_statement, chapter_heading, editor_note, introduction, text_block, test_fixture), `attribution_kind` (marfu, mawquf, maqtu, mursal, balagh, not_applicable, unknown — **hukm emas**), `text_kind` (full, fragment, empty, heading), `text_ar` (asl, o'zgartirilmagan), `raw_sha256` (asl yozuv), `current_text_sha256` (joriy matn — tekshiriladi), `normalized_text_sha256`, `text_history[]`, `statuses{}` (12 kalit, qiymatlar: verified, limited, conflict, not_found, unreviewed, not_applicable), `limitations[]`, `location{file_id, file_sha256, line_start, line_end}`, `identifiers[{namespace, value, source_table_sha256}]` (`row` — bosma raqam emas), `numbers[{assertion_id, scheme_id, volume, number_text ("710;711" guruh saqlanadi), number_int (faqat yagona butun son), variant, number_status, original_value (masalan RAQAMSIZ), reason, page_volume, page (noma'lum = null, hech qachon 0), printed_page_status, evidence_id}]`, `narrators[{terminal_person_id | null, fallback_person_id (zaxira — topilgan ism emas), narrator_identity_status, interpretation, original_value (masalan IMKONSIZ), reason}]`, `gradings[{grade, scholar_person_id, source_ref, scope}]` (olim va manba majburiy), `topics[{topic, lang, origin: source_heading|editorial_tag|ai_suggestion}]`.

## Sharh uchrashuvi (`occurrences.jsonl`)
`occurrence_id, seq, link_kind (mustaqil|umumiy|qisqa_izoh|havola), lemma_kind (iqtibos|parcha|iqtibos_yoq), lemma_text (iqtibos_yoq da bo'lmaydi), text_ar, current_text_sha256, scope (full_section — faqat commentary_end_status=verified bo'lsa | preview_window | fragment), volume, page, segments[{role: hadith_text|commentator|quoted_scholar|editor_note|attribution_unresolved, start, end (kod nuqtalari), person_id, attribution_status}], statuses, limitations, location`.

Bitta umumiy sharh 3 hadisga tegishli bo'lsa — **1 uchrashuv, 3 link**.

## Tekshiruv (Python va PWA bir xil)
ZIP xavfsizligi (`..`, mutlaq yo'l, teskari slesh, symlink, shifrlash, fayl soni, ochilgan hajm, siqilish nisbati), SHA256SUMS ↔ fayllar to'liq mosligi, `file_hashes`, manifest va birlik qoidalari, `current_text_sha256`. JSON xatosi taxmin bilan tuzatilmaydi — paket rad etiladi va jurnalga yoziladi.

Paket yasash: `hadis-manba build-package <manba_papka> --out dist` (deterministik: bir xil kirish → bir xil bayt).
