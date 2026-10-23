# Audit

## 1. Nima tekshirildi, nima tekshirilmadi
| Kirish | Holat | Dalil |
|---|---|---|
| Mac: `~/Downloads/ZIPLAR/`, `~/Downloads/Kitob-loyiha/0-Manba/` | **bu bulut sessiyasidan ko'rinmaydi** — qayta sanalmagan | Mac'da `hadis-manba audit` bilan bajariladi |
| `MIRQAT-VERIFIED-PARTIAL-FIRST380-20261023.zip` | qabul qilindi | 14 834 712 bayt, SHA-256 `4538c4bf…aaa769c9` (foydalanuvchi bergan bilan mos), CRC OK, ichki MANIFEST 239/239 |
| `MIRQAT-VERIFIED-PARTIAL-FIRST480-20261023.zip` | qabul qilindi | 17 677 648 bayt, SHA-256 `3e58d079…0c715de` (mos), CRC OK, ichki MANIFEST 294/294; 380 dagi 380 qator 480 boshida baytma-bayt bir xil |
| `HADIS-TRANSFER-CONTROL-R3-30MB.zip` | qabul qilindi | konteyner SHA-256 `05d03496…3dd613`; `TRANSFER-MANIFEST.json` SHA-256 `704e0d2d…6771b28` (foydalanuvchi bergan bilan mos) |
| 89 transport bo'lak (14 asl ZIP, 12 366 fayl, 6 897 901 261 bayt) | **qisman: 10/89** (001–010, har biri konteyner + payload SHA-256 bilan mos) | `receive_transport.py` + `verify_cloud_transfer.py` hali ishga tushirilmagan — barcha bo'lak kerak |

Kelgan fayllar repo tashqarisida: `/home/user/hadis-manba-kirish/` (zips/, control/, transport/). Ular Git'ga qo'shilmaydi.

## 2. Topshiriqdagi tarixiy baseline (yangilashdan OLDIN; bu yerda qayta tekshirilmagan)
`src/hadis_manba/audit.py → BRIEF_BASELINE` da mashina o'qiydigan shaklda saqlangan va har auditda joriy sanoq bilan solishtiriladi:
0-Manba 9 642 fayl / 6 536 021 709 bayt; ZIPLAR 43 fayl, 40 ZIP (CRC OK); `raqamlar.sqlite` 239 168 yozuv, 29 to'plam, 1 326 272 512 bayt; 18 sharh katalog yozuvi (16 tasida TXT); A yig'masi 14 431 qator (A1 1 985, A2 402, A3 1 767, A4 581, A5 269, A6 9 427), 191 qatorda 192 IMKONSIZ katak (164 tatbiq etilmaydi, 18 ism berilmagan, 9 qatorda 10 aniq cheklangan); DB–TSV farqi 13 684 (yangilashdan oldin; joriy integratsiyada bartaraf etilgan deb xabar qilingan); 125 Muvatto hash qatlami.
Codex xabarlari (`dot-20261023-02`, `dot-20261023-03`) ham alohida, `unverified` belgisi bilan saqlanadi.

## 3. `hadis-manba audit` nima qiladi
- Pre-snapshot: har fayl hajmi, mtime, SHA-256.
- Har ZIP: SHA-256, hajm, a'zolar ro'yxati, CRC (`testzip`), xavfli nomlar, ichki `MANIFEST.tsv` bo'yicha har a'zo xeshi, ichidagi kod fayllari (bajarilmaydi), oila/bosqich (`needs_semantic_comparison`), huquq `unknown`.
- TSV: sarlavha, qator soni, ustun kengliklari, `IMKONSIZ`/`RAQAMSIZ` sanog'i (matn emas).
- SQLite: `mode=ro&immutable=1`, `quick_check`, jadvallar, qatorlar, to'plam ustuni bo'yicha distinct.
- `YANGILASH-JURNALI*.md`, `APPLIED.json`, `POST-VALIDATSIYA.json` — xesh va JSON mazmuni.
- 6 yo'qolgan paketni qidirish; Qur'on/qiroat/dars/qo'lyozma/sir yo'llarini `private_or_out_of_scope` deb belgilash.
- Post-snapshot (standart: to'liq qayta xesh) — kirish o'zgarmaganini isbotlash. `--out` kirish ichida bo'lsa ishlamaydi.

## 4. Keyingi qadam (to'liq transfer kelgach)
1. `python3 receive_transport.py --transport …/TRANSPORT-MANIFEST.json --manifest …/TRANSFER-MANIFEST.json --parts /home/user/hadis-manba-kirish/transport --reassembled /home/user/hadis-manba-kirish/reassembled --dest /home/user/hadis-manba-kirish/hadis-input-run03`
2. `hadis-manba audit --manba /home/user/hadis-manba-kirish/hadis-input-run03/0-Manba --zips /home/user/hadis-manba-kirish/hadis-input-run03/ZIPLAR --out /home/user/hadis-manba-kirish/audit-run03`
3. `SCHEMA-PROBE.json` asosida A/B/BOGLAMA/MANZILLAR/SQLite import adapterlari (repo tashqarisida mahalliy paketlar; ommaviy build'ga faqat huquqi tasdiqlangani).
