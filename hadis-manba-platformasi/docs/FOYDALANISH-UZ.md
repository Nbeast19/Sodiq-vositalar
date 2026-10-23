# Qanday o'rnataman, qidiraman va AIga ulayman? (1 sahifa)

## 1. Dasturni ochish
- **Telefon (iPhone/Android) va kompyuter brauzeri:** Hadis Manba saytini oching. Sayt manzili GitHub Pages'da nashr qilingach shu yerga yoziladi (hozircha nashr qilinmagan — `VALIDATION-REPORT.md`).
- **iPhone:** Safari → Ulashish (↑) → "Add to Home Screen" → "Add".
- **Android:** Chrome → ⋮ → "Ilovani o'rnatish" / "Add to Home screen".
- **Windows/Mac:** Chrome yoki Edge → manzil satridagi "O'rnatish" belgisi.
- **Kompyuterda internetsiz, saytsiz:** `hadis-manba serve --web web` → brauzerda `http://127.0.0.1:8765/`.

## 2. Kitob va sharh o'rnatish
1. **Kitoblar** bo'limi. Har asar ichida "Asosiy matn" va "Sharhlar" alohida.
2. Kerakli satrda **O'rnatish** — faqat shu paket yuklanadi.
3. Bir nechta sharh kerak bo'lsa: sharhlarni belgilang → **Kitob + tanlangan sharhlarni o'rnatish**. Oldin o'rnatilgani qayta yuklanmaydi.
4. Faylingiz bo'lsa (`.hmz`): **Fayldan import**.
5. Holat: Yuklash → Xesh tekshiruvi → Joy → Staging → O'rnatish → Qidiruv tayyorligi → **Oflayn tayyor**. Xato bo'lsa eski kutubxona o'zgarmaydi.

## 3. O'qish va qidirish (internetsiz)
- **Qidiruv:** arabcha ibora yozing. "Harakatsiz" — harakatlarsiz ham topadi; ekranda asl harakatli matn ko'rinadi.
- "Faqat asos matnda" / "Faqat sharhda" / shorih tanlash (faqat uning o'z nasri).
- **Raqam bilan topish:** kitob + raqam (+ jild). Bir nechta nomzod chiqsa — o'zingiz tanlaysiz.
- Hadis sahifasida o'ngda (telefonda pastda) **O'rnatilgan sharhlar**; sharhdan **← Asos hadisga qaytish**.
- Rangli belgilar holatni bildiradi va yonida matni bor: *tasdiqlangan*, *cheklangan*, *ko'rilmagan*…

## 4. Iqtibos, qayd, zaxira
- **Iqtibosni nusxalash** — manba kartasi (asar, raqam, nashr, sahifa, aynan iqtibos, holat, manba ID).
- ☆ Xatcho'p va shaxsiy qayd — faqat shu qurilmada; paket yangilansa ham saqlanadi.
- **Qaydlar → eksport** va **Paketlar → Faylga eksport** bilan zaxira oling. Brauzer ma'lumotni o'chirishi mumkin; **Paketlar → Doimiy saqlashni so'rash**.

## 5. AIga ulash (ixtiyoriy, kompyuterda)
1. Python o'rnating, keyin: `pip install "hadis-manba[mcp]"` (loyiha papkasida: `pip install ".[mcp]"`).
2. `hadis-manba doctor` — hammasi OK bo'lsin.
3. AI dasturingiz MCP'ni qo'llasa, sozlamasiga qo'shing:
   ```json
   {"mcpServers": {"hadis-manba": {"command": "hadis-manba", "args": ["mcp"]}}}
   ```
4. MCP bo'lmasa: "Iqtibosni nusxalash" kartasini AI suhbatiga joylang yoki `hadis-manba export ID --format json`.

**Eslatma:** internetsiz ishlash faqat o'rnatilgan paketlarga tegishli. Holat "cheklangan" yoki "ko'rilmagan" bo'lsa — bu qat'iy dalil emas.
