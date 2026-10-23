"""Importer qoidalari — haqiqiy 0-Manba formatini takrorlaydigan kichik SUN'IY tuzilma bilan."""
import hashlib
import json
import sqlite3

from hadis_manba.importers import raqamlar as R
from hadis_manba.importers import sharhlar as S
from hadis_manba.pkgformat import build_package, open_package

TXT = "\n".join([
    "⟦j01 s0001⟧",
    "حدثنا فلان عن فلان قال رسول الله نص تجريبي اول",   # 2: asos matn
    "شرح الحديث الاول (بيان المعنى) كلام الشارح التجريبي الطويل",  # 3: sharh 1, belgi 18 (1-based) -> "(بيان"
    "⟦j01 s0002⟧",
    "تتمة شرح الاول هنا",
    "شرح الحديث الثاني يبدأ هنا وكلام اخر",           # 6: sharh 2 boshi
]) + "\n"


def make_manba(tmp_path):
    m = tmp_path / "0-Manba"
    hr = m / "manbalar" / "hadis-raqamlar"
    hr.mkdir(parents=True)
    con = sqlite3.connect(hr / "raqamlar.sqlite")
    con.execute("CREATE TABLE records(rid INTEGER PRIMARY KEY,book TEXT,record_id TEXT,arabic_sha TEXT,payload TEXT,"
                "normalized TEXT,matn TEXT)")
    con.execute("CREATE TABLE source_text(book TEXT,record_id TEXT,arabic TEXT,english_narrator TEXT,english_text TEXT)")
    recs = [
        ("kitobx", "1", "نص تجريبي اول", {"bosma_raqam": "1", "raqam_holat": "tasdiqlangan_1", "roviy_turi": "marfu",
                                         "roviy_id": "P1", "roviy_holat": "tasdiqlangan_1"}),
        ("kitobx", "2", "نص تجريبي ثان", {"bosma_raqam": "2", "harf": "b", "raqam_holat": "ziddiyat",
                                         "roviy_turi": "mavquf_maqtu_yoki_marfu_chegarasi_ochiq", "roviy_holat": "ziddiyat",
                                         "boshqa_kitoblarda": [{"book": "kitobx", "record_id": "1", "similarity": 70}]}),
        ("kitobx", "3", "نحوه", {"bosma_raqam": "", "raqam_holat": "topilmadi", "roviy_turi": "muallif_sozi",
                                 "roviy_holat": "topilmadi", "original_arabic_sha": hashlib.sha256(b"").hexdigest(),
                                 "text_hash_note": "asl bo'sh"}),
        ("kitobx", "row:7", "نص في الجزء", {"bosma_raqam": "5", "jild": "2", "raqam_holat": "jild_bilan",
                                             "roviy_turi": "marfu", "roviy_holat": "tasdiqlangan_1", "juz_sahifa": "2:15"}),
    ]
    for i, (b, rid, ar, extra) in enumerate(recs, 1):
        p = {"book": b, "record_id": rid, "idInBook": rid, "raqam_tizimi": "Sinov tizimi", "chapter_id": "",
             "source_file": "0-Manba/manbalar/hadis-qoshimcha/kitobx.tsv.gz", "harf": "", "dalil": [], **extra}
        con.execute("INSERT INTO records VALUES (?,?,?,?,?,?,?)",
                    (i, b, rid, hashlib.sha256(ar.encode()).hexdigest(), json.dumps(p, ensure_ascii=False), "", ""))
        con.execute("INSERT INTO source_text VALUES (?,?,?,?,?)", (b, rid, ar, "", "english text"))
    con.commit()
    con.close()
    (hr / "persons.json").write_text(json.dumps([{"id": "P1", "uzbekcha": "Sinov roviysi", "aliaslar": []}]))
    (hr / "kitob-nomlari.json").write_text(json.dumps({"kitobx": {"full": "Sinov kitobi"}}))
    d = m / "manbalar" / "sharhlar" / "kitobx" / "sharh-x"
    (d / "matn").mkdir(parents=True)
    (d / "matn" / "j01.txt").write_text(TXT, "utf-8")
    (d / "META.json").write_text(json.dumps({"title_ar": "شرح تجريبي", "author_ar": "شارح تجريبي",
                                             "edition": {"publisher": "nashr", "volumes": 2},
                                             "source": {"url": "https://raw.githubusercontent.com/OpenITI/x"},
                                             "numbering_used": "Sinov tizimi"}, ensure_ascii=False))
    bog = "kitob\traqam\traqam2\tsharh_ichidagi_no\tjild\tsahifa\tfayl\tqator\thadis_boshi_ar\tusul\tishonch\tizoh\n"
    bog += "kitobx\t1\t\t1\t1\t1\tmatn/j01.txt\t3\tنص تجريبي\tmatn\taniq\t\n"
    bog += "kitobx\t2\t\t2\t1\t2\tmatn/j01.txt\t6\t\tmatn\ttaxminiy\t\n"
    bog += "kitobx\t99\t\t3\t1\t2\tmatn/j01.txt\t6\t\tmatn\ttaxminiy\t\n"
    (d / "BOGLAMA.tsv").write_text(bog, "utf-8")
    cols = ["boglama_qator", "kitob", "raqam", "raqam2", "matn_fayl", "matn_qator", "matn_belgi", "matn_jild",
            "matn_sahifa", "matn_manba", "sharh_fayl", "sharh_qator", "sharh_belgi", "sharh_jild", "sharh_sahifa",
            "sharh_manba", "iqtibos_turi", "sharh_turi", "holat", "izoh"]
    rows = [
        ["1", "kitobx", "1", "", "matn/j01.txt", "2", "1", "1", "1", "D#L2", "matn/j01.txt", "3", "18", "1", "1", "D#L3",
         "parcha", "mustaqil", "tasdiqlangan", ""],
        ["2", "kitobx", "2", "", "", "", "", "", "", "", "matn/j01.txt", "6", "1", "1", "2", "", "tekshirilmagan",
         "tekshirilmagan", "cheklangan", ""],
        ["3", "kitobx", "99", "", "", "", "", "", "", "", "matn/j01.txt", "6", "24", "1", "2", "", "iqtibos_yoq",
         "havola", "cheklangan", ""],
    ]
    (d / "MANZILLAR.tsv").write_text("\t".join(cols) + "\n" + "".join("\t".join(r) + "\n" for r in rows), "utf-8")
    return m


def test_base_and_commentary_import(tmp_path):
    m = make_manba(tmp_path)
    before = {p: p.read_bytes() for p in m.rglob("*") if p.is_file()}
    names, persons = R.load_aux(m)
    idx = R.edition_index(m)
    src = R.build_book(m, "kitobx", tmp_path / "out", names, persons, idx)
    pkg = open_package(build_package(src[0], tmp_path / "dist"))
    u = {x["unit_id"]: x for x in pkg.jsonl("data/units.jsonl")}
    e = idx["kitobx"]
    assert u[f"{e}:1"]["numbers"][0]["number_status"] == "verified"
    assert u[f"{e}:1"]["numbers"][0]["original_value"] == "tasdiqlangan_1"
    assert u[f"{e}:2"]["numbers"][0]["variant"] == "b" and u[f"{e}:2"]["numbers"][0]["number_status"] == "conflict"
    assert u[f"{e}:2"]["unit_type"] == "text_block" and u[f"{e}:2"]["attribution_kind"] == "unknown"
    u3 = u[f"{e}:3"]
    assert u3["numbers"][0]["number_text"] is None and u3["numbers"][0]["original_value"] == "topilmadi"
    assert u3["text_kind"] == "fragment" and u3["unit_type"] == "author_statement"
    assert u3["raw_sha256"] == hashlib.sha256(b"").hexdigest() != u3["current_text_sha256"]
    r7 = u[f"{e}:row:7"]
    assert {"namespace": "row", "value": "7"} in r7["identifiers"]
    assert r7["numbers"][0]["volume"] == "2" and r7["numbers"][0]["page"] == "15"
    assert r7["numbers"][0]["number_status"] == "limited" and r7["numbers"][0]["original_value"] == "jild_bilan"
    assert "english" not in json.dumps(pkg.jsonl("data/units.jsonl"))  # tarjima kiritilmaydi
    assert {r["rights_status"] for r in pkg.manifest["rights"]} == {"unknown"}

    out, info = S.build_commentary(m, m / "manbalar/sharhlar/kitobx/sharh-x", tmp_path / "out", idx, {})
    cp = open_package(build_package(out, tmp_path / "dist"))
    occ = cp.jsonl("data/occurrences.jsonl")
    # 1-based belgi: oyna "(بيان" bilan boshlanadi; keyingi uchrashuv (6-qator) oldidan kesiladi; sahifa belgisi matnga kirmaydi
    assert occ[0]["text_ar"].startswith("(بيان المعنى)")
    assert "شرح الحديث الثاني" not in occ[0]["text_ar"] and "⟦" not in occ[0]["text_ar"]
    assert occ[0]["location"]["cut"] == "next_occurrence" and occ[0]["location"]["pages_crossed"] == ["1:2"]
    assert occ[0]["scope"] == "preview_window" and occ[0]["statuses"]["commentary_end_status"] == "unreviewed"
    assert occ[0]["segments"][0]["role"] == "commentator"
    assert occ[1]["link_kind"] == "tekshirilmagan" and occ[1]["segments"][0]["role"] == "attribution_unresolved"
    assert occ[1]["text_ar"].rstrip() == "شرح الحديث الثاني يبدأ"  # keyingi uchrashuv (belgi 24) oldidan
    assert occ[2]["lemma_kind"] == "iqtibos_yoq" and occ[2]["lemma_text"] is None
    links = cp.jsonl("data/links.jsonl")
    assert [l["target_unit_id"] for l in links] == [f"{e}:1", f"{e}:2"]  # 99 -> bog'lama YARATILMADI
    assert links[1]["commentary_link_status"] == "unreviewed" and links[1]["legacy_confidence"] == "taxminiy"
    assert info["unmatched_to_base"] == 1
    assert {r["rights_status"] for r in cp.manifest["rights"]} == {"conditional", "approved"}
    after = {p: p.read_bytes() for p in m.rglob("*") if p.is_file()}
    assert before == after  # manba faqat o'qildi
