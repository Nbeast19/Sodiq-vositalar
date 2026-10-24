"""Mahalliy qatlam quruvchisi (scripts/build_overlay.py) — Kitob/Bob tuzilmasi, sanad oraliqlari, roviylar.

Fixture Shamela/page_isnads tuzilmasini qisqartirib takrorlaydi (ID va qisqa matnlar); butun Buxoriy emas.
"""
import hashlib
import importlib.util
import json
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("build_overlay", ROOT / "scripts" / "build_overlay.py")
bo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bo)


def a(i, t):
    return f'<a href="inr://man-{i}">{t}</a>'


T = "<span data-type='title' id=toc-{n}>{t}</span>"
PAGES = {
    9: "﷽\rقَالَ الشَّيْخُ: كَيْفَ كَانَ بَدْءُ الْوَحْيِ.",
    10: "١ - حَدَّثَنَا " + a(10, "الْحُمَيْدِيُّ") + " عَنْ " + a(11, "عُمَرَ") + ": <hadeeth-1>«الْأَعْمَالُ بِالنِّيَّاتِ»",
    17: "﷽\r" + T.format(n=5, t="كِتَابُ الْإِيمَانِ") + "\rبَابُ الْإِيمَانِ وَقَوْلِ النَّبِيِّ ﷺ\rوَهُوَ قَوْلٌ وَفِعْلٌ",   # toc-6 belgisiz
    18: T.format(n=7, t="بَابٌ: دُعَاؤُكُمْ إِيمَانُكُمْ"),
    19: "٨ - حَدَّثَنَا " + a(4210, "عُبَيْدُ اللهِ بْنُ مُوسَى") + " قَالَ: أَخْبَرَنَا " + a(1681, "حَنْظَلَةُ") + " عَنْ " + a(4454, "عِكْرِمَةَ بْنِ خَالِدٍ")
        + " عَنِ " + a(3807, "ابْنِ عُمَرَ") + " قَالَ: <hadeeth-8>«بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ»",
    20: T.format(n=8, t="بَابُ الْمَسَاجِدِ الَّتِي عَلَى\r\r⦗١٠٤⦘\rطُرُقِ الْمَدِينَةِ"),   # ko'p satrli sarlavha
    21: "٦٠١ - حَدَّثَنَا " + a(1588, "أَبُو الْيَمَانِ") + " عَنِ " + a(5917, "الزُّهْرِيِّ") + " حَدَّثَنِي " + a(2249, "سَالِمُ بْنُ عَبْدِ اللهِ بْنِ عُمَرَ،")
        + " " + a(223, "وَأَبُو بَكْرِ بْنُ أَبِي حَثْمَةَ") + ": أَنَّ " + a(3807, "عَبْدَ اللهِ بْنَ عُمَرَ") + " قَالَ: <hadeeth-99>«صَلَّى النَّبِيُّ ﷺ»",
    22: "٦ - حَدَّثَنَا " + a(3784, "عَبْدَانُ") + " أَخْبَرَنَا " + a(3875, "عَبْدُ اللهِ") + " (ح). وَحَدَّثَنَا " + a(941, "بِشْرُ بْنُ مُحَمَّدٍ")
        + " أَخْبَرَنَا " + a(3875, "عَبْدُ اللهِ") + " عَنْ " + a(3732, "ابْنِ عَبَّاسٍ") + ": <hadeeth-6>«كَانَ أَجْوَدَ»",
}
UNITS = [   # (raqam, sahifa, chapter_ar, matn)
    (1, 10, "كتاب بدء الوحى", "حَدَّثَنَا الْحُمَيْدِيُّ عَنْ عُمَرَ: الْأَعْمَالُ بِالنِّيَّاتِ"),
    (8, 19, "كتاب الإيمان", "حَدَّثَنَا عُبَيْدُ اللَّهِ بْنُ مُوسَى قَالَ أَخْبَرَنَا حَنْظَلَةُ عَنْ عِكْرِمَةَ بْنِ خَالِدٍ عَنِ ابْنِ عُمَرَ قَالَ بُنِيَ الإِسْلاَمُ"),
    (601, 21, "كتاب الإيمان", "حَدَّثَنَا أَبُو الْيَمَانِ عَنِ الزُّهْرِيِّ حَدَّثَنِي سَالِمُ بْنُ عَبْدِ اللَّهِ بْنِ عُمَرَ، وَأَبُو بَكْرِ بْنُ أَبِي حَثْمَةَ أَنَّ عَبْدَ اللَّهِ بْنَ عُمَرَ قَالَ صَلَّى"),
    (6, 22, "كتاب الإيمان", "حَدَّثَنَا عَبْدَانُ أَخْبَرَنَا عَبْدُ اللَّهِ وَحَدَّثَنَا بِشْرُ بْنُ مُحَمَّدٍ أَخْبَرَنَا عَبْدُ اللَّهِ عَنِ ابْنِ عَبَّاسٍ كَانَ أَجْوَدَ"),
    (9999, 999, "كتاب الإيمان", "نَصٌّ بِلَا دَلِيلٍ"),          # Shamela paragrafi yo'q — bobi aniqlanmagan
]


def fixture(tmp_path):
    raw = tmp_path / "raw"
    (raw / "shamela-bukhari").mkdir(parents=True)
    (raw / "task2").mkdir()
    rows = [{"book_id": 1458, "shamela_page_id": k, "part": "1", "page_num": k, "body": v} for k, v in PAGES.items()]
    (raw / "shamela-bukhari" / "pages.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in reversed(rows)), "utf-8")
    isn = [{"id": 1, "book_id": 1458, "shamela_page_id": 10, "hadeeth_key": 1, "narrator_ids": [11, 10, 5495]},
           {"id": 2, "book_id": 1458, "shamela_page_id": 19, "hadeeth_key": 8, "narrator_ids": [3807, 4454, 1681, 4210, 5495]},
           {"id": 3, "book_id": 1458, "shamela_page_id": 21, "hadeeth_key": 99, "narrator_ids": [3807, 2249, 5917, 1588, 5495]},
           {"id": 4, "book_id": 1458, "shamela_page_id": 22, "hadeeth_key": 6, "narrator_ids": [3732, 3875, 941, 5495]}]
    (raw / "task2" / "page_isnads.json").write_text(json.dumps(isn), "utf-8")
    people = {10: "الحميدي", 11: "عمر", 4210: "عبيد الله بن موسى", 1681: "حنظلة", 4454: "عكرمة بن خالد بن سعيد", 10547: "عكرمة بن خالد بن سلمة",
              3807: "عبد الله بن عمر", 1588: "أبو اليمان", 5917: "الزهري", 2249: "سالم بن عبد الله", 223: "أبو بكر بن أبي حثمة",
              3784: "عبدان", 3875: "عبد الله بن المبارك", 941: "بشر بن محمد", 3732: "ابن عباس"}
    (raw / "task2" / "narrators.json").write_text(json.dumps([{"id": k, "short_name": v, "long_name": v, "biography_text": json.dumps({"summary": [["الرتبة", "ثقة"]]}),
                                                               "criticism_text": None} for k, v in people.items()], ensure_ascii=False), "utf-8")
    units, ev = [], []
    for seq, (num, page, ch, text) in enumerate(UNITS, 1):
        uid = f"ed-bukhari-hj120:{seq}"
        units.append({"unit_id": uid, "seq": seq, "chapter_ar": ch, "text_ar": text, "attribution_kind": "marfu",
                      "current_text_sha256": hashlib.sha256(text.encode()).hexdigest(), "numbers": [{"number_text": str(num), "evidence_id": uid + "#ev"}]})
        ev.append({"evidence_id": uid + "#ev", "candidates": [{"source": "shamela-edition", "number": str(num), "url": f"https://shamela.ws/book/1681/{page}"}]})
    pkg = tmp_path / "hm-bukhari-hj120-test.hmz"
    with zipfile.ZipFile(pkg, "w") as z:
        z.writestr("package.json", json.dumps({"package_id": "hm-bukhari-hj120", "package_version": "1.0.1", "edition_id": "ed-bukhari-hj120", "work_id": "w-bukhari"}))
        z.writestr("data/units.jsonl", "".join(json.dumps(u, ensure_ascii=False) + "\n" for u in units))
        z.writestr("data/evidence.jsonl", "".join(json.dumps(e, ensure_ascii=False) + "\n" for e in ev))
    return raw, pkg, bo.build(raw, pkg)


def by_num(ov, num):
    uid = f"ed-bukhari-hj120:{[u[0] for u in UNITS].index(num) + 1}"
    return uid, next(r for r in ov["isnad"] if r["unit_id"] == uid)


def test_headings_from_source_only_and_untagged_needs_toc_gap(tmp_path):
    _, _, ov = fixture(tmp_path)
    titles = {b["title_ar"]: b for b in ov["babs"]}
    b0 = titles["بَابُ الْإِيمَانِ وَقَوْلِ النَّبِيِّ ﷺ"]
    assert b0["evidence"] == "toc_gap" and b0["toc"] is None           # toc-5 va toc-7 orasidagi bitta yetishmagan raqam
    assert b0["intro"][0]["text_ar"] == "وَهُوَ قَوْلٌ وَفِعْلٌ"           # bob matni hadisga qo'shilib ketmaydi
    multi = next(b for b in ov["babs"] if b["toc"] == 8)
    assert multi["title_ar"].startswith("بَابُ الْمَسَاجِدِ الَّتِي عَلَى") and multi["title_ar"].endswith("طُرُقِ الْمَدِينَةِ")
    assert [b["order"] for b in ov["babs"]] == list(range(1, len(ov["babs"]) + 1))   # faqat manba tartibi; bosma raqam yo'q
    assert all("number" not in b for b in ov["babs"])


def test_units_attach_to_chapters_only_by_page_and_number(tmp_path):
    _, _, ov = fixture(tmp_path)
    uid8, _ = by_num(ov, 8)
    b = next(b for b in ov["babs"] if b["id"] == ov["unit_bab"][uid8])
    assert b["title_ar"] == "بَابٌ: دُعَاؤُكُمْ إِيمَانُكُمْ"
    assert "ed-bukhari-hj120:1" in ov["kitab_opening"]                 # Vahiy boshi: bob sarlavhasi yo'q, yangi bob yaratilmaydi
    assert "ed-bukhari-hj120:5" not in ov["unit_bab"] and "ed-bukhari-hj120:5" not in ov["kitab_opening"]   # dalilsiz — aniqlanmagan
    assert ov["stats"].get("unit_no_shamela_evidence", 0) + ov["stats"].get("unit_paragraph_not_found", 0) == 1


def test_t01_nasab_is_not_a_separate_narrator(tmp_path):
    _, _, ov = fixture(tmp_path)
    uid, r = by_num(ov, 601)
    text = UNITS[2][3]
    spans = {m["person"]: text[m["span"][0]:m["span"][1]] for m in r["mentions"]}
    assert spans[2249] == "سَالِمُ بْنُ عَبْدِ اللَّهِ بْنِ عُمَرَ"
    ibn_umar = next(m for m in r["mentions"] if m["person"] == 3807)
    assert text[ibn_umar["span"][0]:ibn_umar["span"][1]] == "عَبْدَ اللَّهِ بْنَ عُمَرَ"
    assert ibn_umar["span"][0] > text.index("أَنَّ")                    # nasab ichidagi "عبد الله بن عمر" emas
    route = r["routes"][0]
    assert [n["pos"] for n in route["nodes"]] == [1, 2, 3, 4] and route["nodes"][-1]["mid"] == ibn_umar["mid"]
    assert "page_links_outside_route" in r["reasons"] and r["intermediaries"] is None   # parallel shayx: qat'iy son yo'q


def test_bukhari8_ordinals_and_repeated_person_follow_route_order(tmp_path):
    _, _, ov = fixture(tmp_path)
    _, r8 = by_num(ov, 8)
    assert r8["status"] == "established_single_route" and r8["intermediaries"] == 4
    assert [n["person"] for n in r8["routes"][0]["nodes"]] == [4210, 1681, 4454, 3807]
    _, r6 = by_num(ov, 6)
    assert r6["status"] == "branched" and r6["intermediaries"] is None
    mid_of = {n["person"]: n["mid"] for n in r6["routes"][0]["nodes"]}
    m = {x["mid"]: i for i, x in enumerate(r6["mentions"])}
    assert m[mid_of[3875]] > m[mid_of[941]]                            # Bishrdan keyingi "عبد الله", birinchi tarmoqdagisi emas


def test_persons_by_exact_id_and_output_outside_repo(tmp_path):
    raw, _, ov = fixture(tmp_path)
    ids = {p["person"] for p in ov["persons"]}
    assert 4454 in ids and 10547 not in ids                           # ism o'xshashligi bilan boshqa Ikrima qo'shilmaydi
    with pytest.raises(SystemExit):
        bo.write_overlay(ov, ROOT / "build" / "x", raw)
    p = bo.write_overlay(ov, tmp_path / "out", raw)
    z = zipfile.ZipFile(p)
    m = json.loads(z.read("package.json"))
    assert m["kind"] == "overlay" and m["channel"] == "local_only" and m["rights"][0]["redistribution"] is False
    sums = dict(reversed(line.split("  ")) for line in z.read("SHA256SUMS").decode().splitlines())
    assert all(hashlib.sha256(z.read(n)).hexdigest() == h for n, h in sums.items())
