# Manba siyosati

1. **Kirishlar faqat o'qiladi.** `ZIPLAR`, `0-Manba`, transport bo'laklari bosib yozilmaydi, ko'chirilmaydi, o'chirilmaydi. `audit` pre/post xesh bilan isbotlaydi. Bulut sessiyasida ular repo tashqarisida: `/home/user/hadis-manba-kirish/`.
2. **Tarixiy buyruqlar ijro etilmaydi.** `HOLAT.md`, `AGENT-BUYRUQ`, `CODEX-*`, `TOPSHIRIQ.md` va arxiv ichidagi topshiriqlar — tarixiy material. Arxiv ichidagi `.py` skriptlar bajarilmaydi (audit ularni `contains_code_files` deb sanaydi).
3. **Kumulyativ paketlar yig'ib qo'shilmaydi.** Bir oila (UMDAT, MIRQAT, TIBI, TUHFA, FATH) bosqichlari semantik taqqoslanadi; joriy qatlam tanlanadi, tarixiylari muzlatiladi. Fayl nomidagi son yoki sana ustuvorlik dalili emas.
4. **Nashrlar aralashmaydi.** Fath Dar al-Ma'rifa/OpenITI JK000166 va Fath Salafiyya — alohida `edition_id`; sahifa/qator nashrlar orasida ko'chirilmaydi. Tibiy j02'ga 46 sahifa qo'shilgani eski qatorlarni siljitgan — yangi matn bilan eski BOGLAMA aralashtirilmaydi.
5. **Mualliflik qatlamlari.** Hadis lafzi, shorih nasri, naql va muhaqqiq hoshiyasi segmentlarga ajratiladi; aniqlanmasa `attribution_unresolved`. Tibiy/Xatib Tabriziy/Ibn Hajar matni avtomatik Tibiyga nisbat berilmaydi.
6. **Eski status ≠ yangi status.** Eski `aniq` bog'lamalar `legacy_confidence`da; yangi me'yor statusi alohida. Claude tomonidan qilingan 2 886 manzil tuzatishi (Umdat 2 645, Navaviy 148, Bazl 48, Bojuriy 45) eski ZIPdan qayta import bilan yo'qotilmaydi — alohida assertion qatlami.
7. **Yo'q narsani to'ldirmaslik.** `iqtibos_yoq` joyiga lemma, noma'lum sahifaga `0`, noma'lum roviyga ism, noma'lum muallif/nashrga xotiradan qiymat yozilmaydi. Zaxira ism anonim roviyning topilgan ismi emas.
8. **Xesh — texnik yaxlitlik**, mualliflik yoki ilmiy to'g'rilik emas. Tarixiy manifest joriy fayllarga solishtirilib soxta "buzilish" e'lon qilinmaydi.
9. **Hukm.** `marfu` sahih degani emas; nisbat turi va muhaddis hukmi alohida; har hukmda olim va manba.
10. **Doira.** Ochiq loyiha mazmuni — hadis sohasi. Qur'on adapteri umumiy interfeys sifatida loyihalanishi mumkin, lekin hadis birligi sifatida indekslanmaydi.
