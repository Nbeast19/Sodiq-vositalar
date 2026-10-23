"""Haqiqiy korpus regressiya testlari (topshiriq 22.2). Faqat mahalliy kutubxona bo'lsa ishlaydi:

    HADIS_MANBA_REAL_HOME=/home/user/hadis-manba-kirish/library-run04 pytest tests/test_real_corpus.py

Manba matni repoga kirmaydi; testlar faqat ID, raqam va status munosabatlarini tekshiradi.
"""
import hashlib
import os
from pathlib import Path

import pytest

from hadis_manba.core import Core
from hadis_manba.paths import Home
from hadis_manba.store import Library

REAL = os.environ.get("HADIS_MANBA_REAL_HOME")
pytestmark = pytest.mark.skipif(not REAL or not Path(REAL).exists(), reason="haqiqiy kutubxona yo'q")


@pytest.fixture(scope="module")
def core():
    lib = Library(Home(REAL))
    yield Core(lib)
    lib.close()


def ids(env):
    return [r.get("unit_id") or r.get("occurrence_id") for r in env["results"]]


def printed(h):
    return [n for n in h["numbers"] if not n["scheme_id"].endswith(("-sunnah", "-abdulboqiy"))]


def test_muslim_local_1233_is_printed_591(core):
    h = core.call("get_hadith", unit_id="ed-muslim-hj120:1233")["results"][0]
    assert {"namespace": "record_id", "value": "1233", "source_table_sha256": None} in h["identifiers"]
    p = printed(h)[0]
    assert p["number_text"] == "591" and p["scheme_label"] == "Muhammad Fuad Abd al-Baqi"
    r = core.call("resolve_reference", book_id="w-muslim", number="591", scheme_id=p["scheme_id"])
    assert "ed-muslim-hj120:1233" in ids(r)
    r2 = core.call("resolve_reference", book_id="w-muslim", number="1233", scheme_id=p["scheme_id"])
    assert "ed-muslim-hj120:1233" not in ids(r2)  # mahalliy ID bosma raqam bo'lib chiqmaydi


def test_muwatta_continuous_vs_kitab_hadith(core):
    h = core.call("get_hadith", unit_id="ed-malik-hj120:100")["results"][0]
    by = {n["scheme_label"]: n["number_text"] for n in h["numbers"]}
    assert by["Abdulboqiy kitob:hadis"] == "2:68"
    assert any(v == "100" for k, v in by.items() if k.startswith("Muvatto uzluksiz"))


def test_muwatta_125_hash_layers(core):
    h = core.call("get_hadith", unit_id="ed-malik-hj120:35")["results"][0]
    assert h["hashes"]["raw_sha256"] == hashlib.sha256(b"").hexdigest()
    assert h["hashes"]["current_text_sha256"] == hashlib.sha256(h["text_ar"].encode()).hexdigest()
    p = printed(h)[0]
    assert p["original_value"] == "topilmadi" and p["number_text"] is None


def test_shamail_julaymi_and_sunnah_are_separate(core):
    h = core.call("get_hadith", unit_id="ed-shamail-muhammadiyah-hj120:10")["results"][0]
    labels = {n["scheme_label"][:8]: n["number_text"] for n in h["numbers"]}
    assert labels.get("Julaymiy") == "11" and labels.get("Sunnah.c") == "11"


def test_tabarani_same_number_other_volumes(core):
    r = core.call("resolve_reference", book_id="w-tabaroniy-kabir", number="565")
    vols = {c["volume"] for c in r["results"]}
    assert r["ambiguous"] and len(vols) >= 5


def test_row_n_is_identifier_not_number(core):
    h = core.call("get_hadith", unit_id="ed-tabaroniy-kabir-n1:row:19873")["results"][0]
    row = next(i for i in h["identifiers"] if i["namespace"] == "row")
    assert row["value"] == "19873" and "bosma hadis raqami emas" in row["note"]
    assert printed(h)[0]["number_text"] == "565" and printed(h)[0]["volume"] == "23"


def test_fath_editions_are_separate(core):
    cs = core.call("list_commentaries", book_id="w-bukhari")["results"]
    fath = {c["edition_id"]: c["work"]["work_id"] for c in cs if "fath" in c["edition_id"]}
    assert set(fath) == {"ed-bukhari-fath-al-bari", "ed-bukhari-fath-al-bari-salafiyya"}
    assert len(set(fath.values())) == 1  # bitta asar, ikki nashr


def test_bukhari_1_links_to_commentaries_and_back(core):
    h = core.call("get_hadith", unit_id="ed-bukhari-hj120:1")["results"][0]
    works = {c["commentary"]["work_id"] for c in h["commentaries"]}
    assert "w-bukhari-umdat-al-qari" in works
    occ = next(c for c in h["commentaries"] if c["commentary"]["work_id"] == "w-bukhari-umdat-al-qari")
    c = core.call("get_commentary", occurrence_id=occ["occurrence_id"])["results"][0]
    assert c["scope"] == "preview_window" and c["end_verified"] is False
    assert any(l["target_unit_id"] == "ed-bukhari-hj120:1" and l["activation"]["state"] == "active" for l in c["links"])


def test_search_finds_niyyah_hadith(core):
    env = core.call("search_hadith", query="انما الاعمال بالنيات", book_ids=["w-bukhari"], filters={"scope": "base"})
    assert "ed-bukhari-hj120:1" in ids(env)
    assert any("identifikatsiyasi emas" in l for l in env["limitations"])


def test_legacy_links_marked(core):
    env = core.call("get_coverage", work_id="w-abudawud-badhl-al-majhud")["results"][0]
    assert env["computed"]["link_status_counts"] == {"unreviewed": env["computed"]["links"]}
    assert env["computed"]["legacy_unreviewed_links"] == env["computed"]["links"]
