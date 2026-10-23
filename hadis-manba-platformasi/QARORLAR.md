# Qarorlar jurnali

Oddiy texnik tanlovlar shu yerda yoziladi. Muallif, nashr, roviy yoki huquq bo'yicha "taxmin" bilan to'ldirish yo'q.

| # | Qaror | Sabab |
|---|---|---|
| 1 | Loyiha `desktop-tutorial` repozitoriysidagi `hadis-manba-platformasi/` papkasida | Sessiyada push qilish mumkin bo'lgan yagona repo shu. Alohida repo nomi/visibility foydalanuvchi bilan kelishilmagan; papka o'zi mustaqil (o'z README, pyproject, testlari) — keyin alohida repoga ko'chirish oson. |
| 2 | Original manbalar (ZIPLAR, 0-Manba, transport bo'laklari) repo tashqarisida: `/home/user/hadis-manba-kirish/` | Shaxsiy va huquqi aniqlanmagan korpus Git tarixiga tushmasligi uchun. |
| 3 | Python 3.10+ (sinalgan 3.13), tashqi bog'liqliksiz yadro; MCP ixtiyoriy `mcp==2.3.0` | Oddiy o'rnatish; MCP faqat AI ulash kerak bo'lganda. |
| 4 | Rasmiy MCP SDK 2.x (`MCPServer`), STDIO transport | Topshiriq: rasmiy SDK, pin qilingan versiya, mahalliy STDIO. |
| 5 | Kompyuterda SQLite FTS5 **trigram** tokenizer | Arabcha old qo'shimchalar (و، ف، ب، ال) bilan so'z ichidagi qism ham topilsin; token bo'yicha qidiruv ularni o'tkazib yuboradi. 3 belgidan qisqa so'rov — `instr` bilan. |
| 6 | Qidiruv normalizatsiyasi `ar-search-v1`: harakat/Qur'on belgilari/tatvil/ko'rinmas belgilar o'chiriladi; أإآٱ→ا, ى→ي, ة→ه, ؤ→و, ئ→ي, fors ی ک; faqat ASCII kichraytiriladi | Python va JS aynan bir xil bo'lishi uchun (umumiy test vektorlari). NFC/NFKC qilinmaydi. Faqat qidiruv qatlamiga tegishli, asl matn o'zgarmaydi. |
| 7 | Paket formati `.hmz` = oddiy deterministik ZIP (JSON/JSONL) | Python `zipfile` va brauzerdagi `DecompressionStream('deflate-raw')` bilan kutubxonasiz o'qiladi; bir xil kirishdan bir xil bayt. |
| 8 | PWA: vanilla JS, IndexedDB, Web Worker | Framework yo'q; telefonda Python/serversiz. SQLite-WASM o'rniga IndexedDB tanlandi: GitHub Pages COOP/COEP header bera olmaydi (OPFS SyncAccessHandle uchun kerak), IndexedDB esa barcha 4 platforma brauzerlarida bor. Bir xil sxema/ID/qidiruv shartnomasi umumiy test vektorlari bilan tekshiriladi. |
| 9 | PWA qidiruvi: Worker'da paket bo'yicha IndexedDB kursori bilan ketma-ket o'qish (oldindan normalizatsiyalangan matn) | Butun korpus RAMga yuklanmaydi. Juda katta korpuslarda (yuz MB) tezlik real qurilmada o'lchanmagan — `PLATFORM-TEST-MATRIX.md`. Kerak bo'lsa keyingi bosqich: paket ichida oldindan qurilgan trigram indeks. |
| 10 | IndexedDB kalitlari `[pkgv, id]` | Yangi versiya eskisiga tegmay staging'da yoziladi, bitta tranzaksiyada faollashadi; uzilgan staging keyingi ochilishda tozalanadi. Oldingi versiya blob'i rollback uchun saqlanadi. |
| 11 | Shaxsiy qaydlar alohida `hadis-manba-shaxsiy` bazasida | Paket yangilash/o'chirish ularga tegmaydi; JSON eksport/import. |
| 12 | Service worker faqat dastur qobig'ini keshlaydi; paketlar keshlanmaydi | Ko'p GB korpusni yashirin keshlamaslik; paket — foydalanuvchi tanlovi. |
| 13 | Sharh bog'lamasi faolligi: commentary manifestidagi `requires_for_linked_reading` (asar + nashr + mos versiya naqshi) va asos birligi mavjudligi | Faqat raqam bir xilligi bilan boshqa nashrga ulanmaydi. |
| 14 | Tugash chegarasi tasdiqlanmagan sharh — `preview_window`, 1500 belgi | Keyingi hadis sharhi avvalgisiga qo'shilib ketmasin. |
| 15 | `row:N` — `unit_identifiers` (namespace `row`), raqamlar jadvalida emas | Bosma raqam bo'lib chiqmasligi uchun. |
| 16 | Public build allowlist: `public` (hammasi approved + redistribution true), `conditional` (shart doirasi aniq — alohida kanal), qolgani `local_only` | Topshiriq 6-bo'lim. |
| 17 | Sinov ma'lumoti — sun'iy, `is_test_fixture: true`, har birlikda "SINOV NAMUNASI" cheklovi | Haqiqiy hadis matnini xotiradan yozmaslik; huquqi aniq (CC0). |
| 18 | Kumulyativ paket oilalari (UMDAT/MIRQAT/TIBI/TUHFA/FATH) auditda `needs_semantic_comparison`; nomdagi son ustuvorlik emas | MIRQAT 380→480 da birinchi 380 qator baytma-bayt bir xil ekani tekshirildi — joriy qatlam 480, 380 tarixiy. |
| 19 | Mahalliy xizmat faqat 127.0.0.1, Host/Origin tekshiruvi, CORS sarlavhasi yo'q | DNS rebinding va begona sayt so'rovlaridan himoya. |
| 20 | Import jurnali SQLite'da UPDATE/DELETE trigger bilan taqiqlangan + `import-journal.jsonl` | Append-only talab. |
| 21 | UI tillari: en, ar (ommaviy) + uz; tanlov `localStorage`; ar → `dir=rtl`; arabcha manba doim RTL; `t()` ga qo‘yilgan qiymatlar FSI/PDI bilan izolyatsiya | 26-bo‘lim; aralash matnda raqam/ID/URL tartibi buzilmasin. Hadis/sharh tarjima qilinmaydi. |
| 22 | Bosh sahifa = Kutubxona; kitob sahifasi `#/w/<work>` da “faqat kitob” va “kitob + tanlangan sharhlar”; AI/MCP — Yordam ichidagi alohida bo‘lim | Dasturlashni bilmaydigan foydalanuvchi uchun eng qisqa yo‘l. |
| 23 | SEO: statik `/en/`, `/ar/` sahifalar Python generator bilan (JS’siz), x-default = en; PWA qobig‘i `noindex` | Google localized-versions va JS SEO tavsiyalari; katalogni ko‘rish uchun IndexedDB/paket kerak emas. |
| 24 | Manbada sarlavhasi yo‘q 12 kitob uchun inglizcha/arabcha nomlar — tahririy (`names_origin: editorial`); hadith-json kitoblarida — manbadan (`source`); sharhlarda inglizcha nom papka nomidan (`slug`) | Kitob/muallif qidiruvi uchun; manba ma’lumoti sifatida ko‘rsatilmaydi. |
| 25 | Haqiqiy paketlar public repoga hali joylanmagan | Repo public, git tarixi qaytmaydi — foydalanuvchining aniq roziligi kutiladi. |
