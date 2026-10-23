"""Sanad indeksi (scripts/build_isnad_index.py) — 27-bo'lim audit regressiyasi.

Fixture haqiqiy Shamela/page_isnads tuzilmasini qisqartirib takrorlaydi (faqat ID va ismlar):
  17661: book 1458, sahifa 10,  key 1 -> 1-hadis  (Umar ... Humaydi, Buxoriy)
  17713: book 1458, sahifa 104, key 1 -> 54-hadis (Umar ... Molik, Abdulloh ibn Maslama, Buxoriy)
Ikkalasida hadeeth_key = 1, ya'ni book_id + hadeeth_key bosma raqamga bog'lash uchun yaroqsiz.
"""
import importlib.util
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("build_isnad_index", ROOT / "scripts" / "build_isnad_index.py")
bii = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bii)

N = {4677: "أبو حفص عمر بن الخطاب", 4494: "علقمة بن وقاص الليثي", 5443: "محمد بن إبراهيم التيمي",
     6932: "يحيى بن سعيد الأنصاري", 2478: "سفيان بن عيينة", 3654: "عبد الله بن الزبير الحميدي",
     5361: "مالك بن أنس", 3919: "عبد الله بن مسلمة بن قعنب", 5495: "محمد بن إسماعيل البخاري",
     100: "أبو سعيد بن المعلى", 101: "حفص بن عاصم", 102: "شعبة", 103: "آدم"}


def a(i, t):
    return f'<a href="inr://man-{i}">{t}</a>'


PAGE10 = ("١ - حَدَّثَنَا " + a(3654, "الْحُمَيْدِيُّ") + "، قَالَ: حَدَّثَنَا " + a(2478, "سُفْيَانُ") + "، قَالَ: حَدَّثَنَا "
          + a(6932, "يَحْيَى بْنُ سَعِيدٍ") + "، قَالَ: أَخْبَرَنِي " + a(5443, "مُحَمَّدُ بْنُ إِبْرَاهِيمَ") + "، أَنَّهُ سَمِعَ "
          + a(4494, "عَلْقَمَةَ") + "، يَقُولُ: سَمِعْتُ " + a(4677, "عُمَرَ") + ": <hadeeth-1>«إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ»")
PAGE104 = ("٥٤ - حَدَّثَنَا " + a(3919, "عَبْدُ اللهِ بْنُ مَسْلَمَةَ") + "، قَالَ: أَخْبَرَنَا " + a(5361, "مَالِكٌ") + "، عَنْ "
           + a(6932, "يَحْيَى بْنِ سَعِيدٍ") + "، عَنْ " + a(5443, "مُحَمَّدِ بْنِ إِبْرَاهِيمَ") + "، عَنْ "
           + a(4494, "عَلْقَمَةَ") + "، عَنْ " + a(4677, "عُمَرَ") + ": <hadeeth-1>«الْأَعْمَالُ بِالنِّيَّةِ»")
# ikkinchi raqamlangan paragraf + al-Mu'alla (ism, mu'allaq EMAS) + (ح) tahvil
PAGE200 = ("٤٤٧٤ - حَدَّثَنَا " + a(102, "شُعْبَةُ") + "، عَنْ " + a(101, "حَفْصِ بْنِ عَاصِمٍ") + "، عَنْ "
           + a(100, "أَبِي سَعِيدِ بْنِ الْمُعَلَّى") + ": <hadeeth-1>«كُنْتُ أُصَلِّي»\r"
           "٤٤٧٥ - حَدَّثَنَا " + a(103, "آدَمُ") + "، عَنْ " + a(102, "شُعْبَةَ") + " (ح). وَحَدَّثَنَا "
           + a(101, "حَفْصٌ") + "، عَنْ " + a(100, "أَبِي سَعِيدٍ") + ": <hadeeth-2>«نَصٌّ»")
UNIT_TEXT = {
    1: "حَدَّثَنَا الْحُمَيْدِيُّ عَبْدُ اللَّهِ بْنُ الزُّبَيْرِ، قَالَ حَدَّثَنَا سُفْيَانُ، قَالَ حَدَّثَنَا يَحْيَى بْنُ سَعِيدٍ الأَنْصَارِيُّ، قَالَ أَخْبَرَنِي مُحَمَّدُ بْنُ إِبْرَاهِيمَ التَّيْمِيُّ، أَنَّهُ سَمِعَ عَلْقَمَةَ بْنَ وَقَّاصٍ اللَّيْثِيَّ، يَقُولُ سَمِعْتُ عُمَرَ بْنَ الْخَطَّابِ",
    54: "حَدَّثَنَا عَبْدُ اللَّهِ بْنُ مَسْلَمَةَ، قَالَ أَخْبَرَنَا مَالِكٌ، عَنْ يَحْيَى بْنِ سَعِيدٍ، عَنْ مُحَمَّدِ بْنِ إِبْرَاهِيمَ، عَنْ عَلْقَمَةَ بْنِ وَقَّاصٍ، عَنْ عُمَرَ",
    4474: "حَدَّثَنَا شُعْبَةُ، عَنْ حَفْصِ بْنِ عَاصِمٍ، عَنْ أَبِي سَعِيدِ بْنِ الْمُعَلَّى، قَالَ كُنْتُ أُصَلِّي",
    4475: "حَدَّثَنَا آدَمُ، عَنْ شُعْبَةَ، وَحَدَّثَنَا حَفْصٌ، عَنْ أَبِي سَعِيدٍ",
}
PAGE_OF = {1: 10, 54: 104, 4474: 200, 4475: 200}


def fixture(tmp_path):
    raw = tmp_path / "raw"
    (raw / "shamela-bukhari").mkdir(parents=True)
    (raw / "task2").mkdir()
    pages = [{"book_id": 1458, "shamela_page_id": 10, "body": PAGE10}, {"book_id": 1458, "shamela_page_id": 104, "body": PAGE104},
             {"book_id": 1458, "shamela_page_id": 200, "body": PAGE200}]
    (raw / "shamela-bukhari" / "pages.jsonl").write_text("".join(json.dumps(p, ensure_ascii=False) + "\n" for p in pages), "utf-8")
    isn = [{"id": 17661, "book_id": 1458, "shamela_page_id": 10, "hadeeth_key": 1, "narrator_ids": [4677, 4494, 5443, 6932, 2478, 3654, 5495]},
           {"id": 17713, "book_id": 1458, "shamela_page_id": 104, "hadeeth_key": 1, "narrator_ids": [4677, 4494, 5443, 6932, 5361, 3919, 5495]},
           {"id": 1, "book_id": 1458, "shamela_page_id": 200, "hadeeth_key": 1, "narrator_ids": [100, 101, 102, 5495]},
           {"id": 2, "book_id": 1458, "shamela_page_id": 200, "hadeeth_key": 2, "narrator_ids": [100, 101, 102, 103, 5495]},
           # boshqa kitobdagi bir xil (sahifa, key) — bog'lanmasligi kerak
           {"id": 9, "book_id": 602, "shamela_page_id": 104, "hadeeth_key": 1, "narrator_ids": [4677, 2478, 5495]}]
    (raw / "task2" / "page_isnads.json").write_text(json.dumps(isn), "utf-8")
    (raw / "task2" / "narrators.json").write_text(json.dumps([{"id": k, "short_name": "‌" + v} for k, v in N.items()], ensure_ascii=False), "utf-8")
    units, ev = [], []
    for seq, (num, text) in enumerate(UNIT_TEXT.items(), 1):
        uid = f"ed-bukhari-hj120:{num}"
        units.append({"unit_id": uid, "seq": seq, "text_ar": text, "attribution_kind": "marfu",
                      "numbers": [{"number_text": str(num), "evidence_id": uid + "#ev"}]})
        ev.append({"evidence_id": uid + "#ev", "candidates": [
            {"source": "fawaz-sunnah-family", "number": str(num)},
            {"source": "shamela-edition", "number": str(num), "url": f"https://shamela.ws/book/1681/{PAGE_OF[num]}"}]})
    pkg = tmp_path / "hm-bukhari-hj120-test.hmz"
    with zipfile.ZipFile(pkg, "w") as z:
        z.writestr("data/units.jsonl", "".join(json.dumps(u, ensure_ascii=False) + "\n" for u in units))
        z.writestr("data/evidence.jsonl", "".join(json.dumps(e, ensure_ascii=False) + "\n" for e in ev))
    return bii.build(raw, pkg)


def test_key_is_not_printed_number_and_compiler_is_not_an_intermediary(tmp_path):
    u = fixture(tmp_path)["units"]
    h1, h54 = u["ed-bukhari-hj120:1"], u["ed-bukhari-hj120:54"]
    # ikkalasida hadeeth_key = 1, lekin har biri o'z sahifasi + bosma raqami orqali bog'langan
    assert (h1["evidence"]["hadeeth_key"], h54["evidence"]["hadeeth_key"]) == (1, 1)
    assert h1["routes"][0]["page_isnads_id"] == 17661 and h54["routes"][0]["page_isnads_id"] == 17713
    assert h54["evidence"]["printed_number"] == 54
    # 7 ta ID (Buxoriy bilan) -> 6 ta vosita; Nabiy ﷺ ham, muallif ham sanalmaydi
    for h in (h1, h54):
        assert h["status"] == "established_single_route" and h["intermediaries"] == 6
        assert [n["position_from_compiler"] for n in h["routes"][0]["nodes"]] == [1, 2, 3, 4, 5, 6]
        assert all(n["person"] != "man-5495" for n in h["routes"][0]["nodes"])
    assert [n["person"] for n in h1["routes"][0]["nodes"]][:2] == ["man-3654", "man-2478"]      # Humaydi, Sufyon
    assert [n["person"] for n in h54["routes"][0]["nodes"]][:2] == ["man-3919", "man-5361"]     # Ibn Maslama, Molik
    assert h54["routes"][0]["nodes"][-1]["person"] == "man-4677"                                # Umar — Nabiy ﷺ tomondagi uch


def test_spans_point_into_our_text(tmp_path):
    u = fixture(tmp_path)["units"]["ed-bukhari-hj120:54"]
    s, e = u["routes"][0]["nodes"][1]["span"]
    assert UNIT_TEXT[54][s:e] == "مَالِكٌ"


def test_mualla_name_is_a_narrator_not_a_muallaq_label(tmp_path):
    u = fixture(tmp_path)["units"]["ed-bukhari-hj120:4474"]
    assert u["status"] == "established_single_route" and u["intermediaries"] == 3
    assert u["routes"][0]["nodes"][-1]["person"] == "man-100"
    assert "muallaq" not in json.dumps(u)


def test_tahwil_branch_is_not_counted(tmp_path):
    u = fixture(tmp_path)["units"]["ed-bukhari-hj120:4475"]
    assert u["status"] == "branched" and u["intermediaries"] is None
    assert "tahwil_branch_in_page" in u["reasons"]
