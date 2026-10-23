# Qamrov

**Ilmiy qamrov: INCOMPLETE.** Texnik import, xesh mosligi yoki fayllarning yetkazilishi ilmiy tasdiq emas. Foiz faqat maxraj (asar/nashr bo'yicha haqiqiy birliklar soni) tasdiqlangan bo'lsa hisoblanadi.

## 1. Bu repoda o'rnatiladigan paketlar (ommaviy demo)
| Paket | Turi | Birlik / uchrashuv | Holat |
|---|---|---|---|
| namuna-asos-a, namuna-asos-b | base_book | 12 + 12 | SINOV NAMUNASI (sun'iy). Maxraj 12 — namunaning o'zi |
| namuna-sharh-1 | commentary | 5 uchrashuv, 7 link, 6 turli birlik | sun'iy; 1 umumiy (3 hadis), 1 takroriy uchrashuv, 1 preview |
| namuna-sharh-2 | commentary | 2 uchrashuv, 2 link | sun'iy |

Haqiqiy hadis kitobi yoki sharh paketi **hali yo'q**: haqiqiy korpus bu sessiyaga to'liq yetib kelmagan (transport 10/89), import adapterlari esa haqiqiy fayl tuzilmasi ko'rilgandan keyin yoziladi.

## 2. Haqiqiy korpus — xabar qilingan sonlar (bu yerda TEKSHIRILMAGAN)
Manba: topshiriq (audit baseline) va Codex xabarlari. Joriy holat — `dot-20261023-03`. Kumulyativ: oldingi bosqichlarga qo'shib sanalmaydi.

| Sharh | Joriy qatlam (xabar) | Holat (xabar) | Bu sessiyada tekshirilgan |
|---|---:|---|---|
| Umdatul Qoriy | 1 130 uchrashuv (dot-03); dot-02 da 930 (922 turli raqam), 384 lokal tasdiqlangan / 546 cheklangan | 5 eski alohida uchrashuv legacy | yo'q |
| Mirqot | 480 | barchasi cheklangan/taxminiy | **ha, fayl darajasida**: MIRQAT480 ZIP SHA-256 mos, ichki MANIFEST 294/294, BOGLAMA/MANZILLAR 480 qator; 380 paketning 380 qatori 480 ning boshida baytma-bayt bir xil. Ilmiy tekshiruv emas |
| Tibiy (Tiybiy) | 360 (dot-03); 260→360 da 20 bosma dalilli satr tuzatishi | dot-02: 3 lokal tasdiqlangan / 257 cheklangan | yo'q |
| Tuhfa | 221 | dastlabki 191: 5 tasdiqlangan / 186 cheklangan | yo'q |
| Fath (Salafiyya) | 100 | barchasi cheklangan; Dar al-Ma'rifa nashridan alohida | yo'q |
| Ibn Moja — Sindiy V2 | dastlabki 10 (1–9, 11) | — | yo'q |
| Faol indekslar (dot-02) | Umdat 6 174 / Mirqot 4 210 / Tibiy 2 353 | legacy qoldiq 5 244 / 3 830 / 2 093 | yo'q |

Asosiy `raqamlar.sqlite`: 239 168 yozuv, 29 to'plam identifikatori (xabar; dot-02/03 da o'zgarmagan). **239 168 — noyob hadislar soni emas** (nashrlar, variantlar, takrorlar, asarlar, matn bloklari). Transfer verifier ochilgach `quick_check` va 239 168 ni tekshiradi.

## 3. Har kitob kartasida ko'rsatiladigan sonlar
Dastur `coverage.computed` da: kiritilgan yozuvlar, `unit_type` va `text_kind` bo'yicha taqsimot, turli bosma raqamlar, holatlar bo'yicha sanoq; sharhda — uchrashuvlar, linklar, turli bog'langan birliklar, `scope` va link statuslari, qayta tekshirilmagan legacy linklar. Raqam belgisi yo'qligi, manba bo'lagi yo'qligi va haqiqiy matn uzilishi alohida (`number_status`, `text_kind`, `limitations`).
