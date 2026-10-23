# Platforma sinov matritsasi

Sana: 2026-10-23. Muhit: bulut konteyneri (Linux), Python 3.13.16, SQLite 3.45.1, Node 22.22, Playwright 1.56.1 + Chromium headless shell 1194.

**Muhim:** headless Chromium va viewport emulyatsiyasi real iPhone/Android/Windows/Mac qurilma sinovi **emas**. Home Screen o'rnatish, iOS saqlash siyosati, fon rejimida yuklash va haqiqiy parvoz rejimi faqat real qurilmada tekshiriladi.

| OS / qurilma | Brauzer | Eng kam versiya (hujjatlar bo'yicha) | Sinov turi | Natija | Dalil |
|---|---|---|---|---|---|
| Linux (konteyner) | Chromium headless 1194 | — | 12 ssenariy, 1280×860, `context.setOffline(true)` bilan haqiqiy tarmoqsiz | **o'tdi (13/13 band)** | `build/e2e-natija.json`, `tests/web/e2e.pw.js` |
| Linux (konteyner), 390 px telefon kengligi | Chromium headless 1194 | — | xuddi shu 12 ssenariy, 390×844, gorizontal siljish tekshiruvi | **o'tdi (13/13 band)** | xuddi shu |
| Linux | Python 3.13 CLI/xizmat/MCP | Python 3.10 | pytest 63 ta | **o'tdi** | `tests/` |
| Windows 10/11 | Edge/Chrome | Chrome/Edge 103+ (`DecompressionStream deflate-raw`) | — | **sinalmagan** | real qurilma kerak |
| macOS | Safari 17+ / Chrome | Safari 16.4+ | — | **sinalmagan** | real qurilma kerak |
| iPhone/iPad | Safari, Home Screen PWA | iOS 16.4+ | — | **sinalmagan** | real qurilma kerak |
| Android | Chrome | Chrome 103+ | — | **sinalmagan** | real qurilma kerak |

## Har platformada qo'lda bajariladigan 12 ssenariy
1. Faqat bitta kitob → internetni uzish → qayta ochish → mundarija/qidiruv/raqam.
2. Faqat bitta sharh → o'z matnini oflayn o'qish/qidirish; asos yo'qligi ko'rinadi.
3. Asos kitobni keyin qo'shish → sharh qayta yuklanmay bog'lanish faollashadi.
4. Kitob + ikki sharh birga → hadisdan har ikki sharhga va orqaga.
5. O'rnatilgan kitobga yangi sharh → kitob qayta yuklanmaydi.
6. Faqat sharhni o'chirish → kitob, boshqa sharhlar, qaydlar saqlanadi.
7. Asos kitobni o'chirish → sharh ishlaydi, o'tish o'rnatish taklifiga aylanadi.
8. Mos bo'lmagan nashr → raqam-only bog'lama yo'q.
9. Yuklash/importni to'xtatish, joy tugashi → oldingi kutubxona buzilmaydi; qayta urinish.
10. Yangilash → ID, link, xatcho'p, qayd saqlanadi; rollback.
11. Qayta ochganda AIsiz barcha paketlarda qidiruv.
12. Paketni faylga eksport/import, qayd zaxirasini tiklash.

Natijani shu jadvalga yozing: OS, brauzer versiyasi, qurilma modeli, ssenariy, natija, skrinshot/dalil.

## O'lchangan vaqtlar (faqat shu konteyner, sun'iy namuna paketlari, kichik hajm)
- Bitta ssenariy: 0,46–1,42 s (o'rnatish + oflayn qayta ochish + qidiruv bilan).
- Worker qidiruvi (4 paket, ~31 birlik): 5 ms atrofida.
- Haqiqiy katta korpus (yuz MB) uchun import/qidiruv/xotira **o'lchanmagan** — taxminiy raqam berilmaydi.

## Ma'lum cheklovlar
- Juda katta paket bitta `ArrayBuffer` sifatida yuklanadi va tekshiriladi: telefonda ~yuzlab MB paketlar xotira bosimi berishi mumkin. Katta kitoblar jild bo'yicha bo'lingan paketlarga ajratilishi kerak (keyingi bosqich).
- Yuklash uzilsa davom ettirish (resume) yo'q — qayta urinish butun paketni qayta oladi.
- `navigator.storage.estimate` ba'zi brauzerlarda taxminiy; joy yetishmasa o'rnatish boshlanmaydi.
