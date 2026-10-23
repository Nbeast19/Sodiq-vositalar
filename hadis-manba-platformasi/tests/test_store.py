import sqlite3

import pytest

from conftest import variant_src
from hadis_manba.core import Core
from hadis_manba.pkgformat import PackageError, build_package


def counts(lib):
    return {t: lib.con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ("text_units", "number_assertions", "commentary_links", "search_fts", "package_versions")}


def test_idempotent_reinstall(lib, built):
    lib.install(built["pkg"]["namuna-asos-a"])
    before = counts(lib)
    r = lib.install(built["pkg"]["namuna-asos-a"])
    assert r[0]["action"] == "unchanged"
    assert counts(lib) == before
    assert before["text_units"] == 12


def test_upgrade_and_rollback(lib, built, tmp_path):
    lib.install(built["pkg"]["namuna-asos-a"])
    old_text = lib.con.execute("SELECT text_ar FROM text_units WHERE unit_id='ed-namuna-a:u0003'").fetchone()[0]

    def mut(m, units):
        m["package_version"] = "1.1.0"
        units[2]["text_ar"] = units[2]["text_ar"] + " (تَصْحِيحٌ تَجْرِيبِيٌّ)"
    v2 = build_package(variant_src(built, tmp_path, "namuna-asos-a", mut), tmp_path / "v2")
    assert lib.install(v2)[0]["action"] == "upgrade"
    new_text = lib.con.execute("SELECT text_ar FROM text_units WHERE unit_id='ed-namuna-a:u0003'").fetchone()[0]
    assert new_text != old_text
    assert counts(lib)["text_units"] == 12  # ikki versiya qo'shilib ketmaydi
    r = lib.rollback("namuna-asos-a")
    assert r["action"] == "rollback" and r["package_version"] == "1.0.0"
    assert lib.con.execute("SELECT text_ar FROM text_units WHERE unit_id='ed-namuna-a:u0003'").fetchone()[0] == old_text
    # qidiruv indeksi matn bilan birga qaytgan
    q = Core(lib).search_hadith("تصحيح تجريبي")
    assert q["total"] == 0


def test_failed_install_keeps_working_library(lib, built, tmp_path):
    lib.install(built["pkg"]["namuna-asos-a"])
    before = counts(lib)

    def mut(m, units):  # boshqa paket ID, lekin unit_id'lar A nashri bilan to'qnashadi
        m["package_id"] = "boshqa-paket"
    dup = build_package(variant_src(built, tmp_path, "namuna-asos-a", mut), tmp_path / "d")
    with pytest.raises(sqlite3.IntegrityError):
        lib.install(dup)
    assert counts(lib) == before
    assert Core(lib).get_hadith("ed-namuna-a:u0001")["error"] is None


def test_rejected_package_logged_and_db_untouched(lib, built, tmp_path):
    lib.install(built["pkg"]["namuna-asos-a"])
    before = counts(lib)
    bad = tmp_path / "bad.hmz"
    bad.write_bytes(b"PK\x03\x04 bu zip emas")
    with pytest.raises(PackageError):
        lib.install(bad)
    assert counts(lib) == before
    assert lib.journal(1)[0]["action"] == "rejected"


def test_journal_is_append_only(lib, built):
    lib.install(built["pkg"]["namuna-asos-a"])
    with pytest.raises(sqlite3.IntegrityError):
        lib.con.execute("UPDATE import_journal SET action='x'")
    with pytest.raises(sqlite3.IntegrityError):
        lib.con.execute("DELETE FROM import_journal")
    assert lib.home.journal.read_text("utf-8").count("\n") >= 1


def test_selection_bundle_skips_installed(lib, built, tmp_path):
    import json
    from hadis_manba.pkgformat import build_selection, sha256_file
    names = ["namuna-asos-a", "namuna-sharh-1", "namuna-sharh-2"]
    mans = []
    for n in names:
        p = built["pkg"][n]
        side = json.loads(p.with_name(p.name.replace(".hmz", ".manifest.json")).read_text("utf-8"))
        assert side["package_sha256"] == sha256_file(p)
        mans.append(side)
    sel = build_selection(mans, "sel-test", {"uz": "t"}, "1.0.0", tmp_path, [built["pkg"][n] for n in names])
    lib.install(built["pkg"]["namuna-asos-a"])
    res = {r["package_id"]: r["action"] for r in lib.install(sel)}
    assert res == {"namuna-asos-a": "unchanged", "namuna-sharh-1": "install", "namuna-sharh-2": "install"}
    assert counts(lib)["text_units"] == 12  # asosiy kitob ikkinchi marta saqlanmadi
