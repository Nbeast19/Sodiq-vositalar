import json
import sqlite3
import zipfile

import pytest

from conftest import variant_src
from hadis_manba.audit import run_audit
from hadis_manba.pkgformat import build_package
from hadis_manba.publish import build_public


def test_allowlist(built, tmp_path):
    def unknown(m, u):
        m["package_id"] = "huquqi-nomalum"
        m["rights"] = [{"applies_to": "classical_body", "rights_status": "unknown", "redistribution_allowed": None}]

    def nc(m, u):
        m["package_id"] = "shartli-nc"
        m["rights"] = [{"applies_to": "classical_body", "rights_status": "conditional", "license_id": "CC-BY-NC-SA-4.0",
                        "redistribution_allowed": True, "commercial_use_allowed": False,
                        "share_alike_requirements": "CC BY-NC-SA 4.0", "conditional_scope_clear": True}]

    def nc_unclear(m, u):
        m["package_id"] = "shartli-noaniq"
        m["rights"] = [{"applies_to": "classical_body", "rights_status": "conditional", "license_id": "?",
                        "redistribution_allowed": True}]

    def private(m, u):
        m["package_id"] = "shaxsiy-yol"
        m["attribution"] = "/Users/foydalanuvchi/Downloads/ZIPLAR dan olingan"

    pk = [built["pkg"]["namuna-asos-a"]] + [
        build_package(variant_src(built, tmp_path, "namuna-asos-a", f), tmp_path / f.__name__)
        for f in (unknown, nc, nc_unclear, private)]
    rep = build_public(pk, tmp_path / "site")
    cat = json.loads((tmp_path / "site" / "catalog.json").read_text("utf-8"))
    assert [p["package_id"] for p in cat["packages"]] == ["namuna-asos-a"]
    assert [x["package_id"] for x in rep["conditional"]] == ["shartli-nc"]
    assert {x["package_id"] for x in rep["local_only"]} == {"huquqi-nomalum", "shartli-noaniq"}
    assert len(rep["rejected"]) == 1 and "shaxsiy" in str(rep["rejected"][0]["reason"])
    assert not (tmp_path / "site" / "paketlar" / pk[1].name).exists()


def _mk_zip(p, files):
    with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)


def test_audit_read_only(tmp_path):
    zips, manba = tmp_path / "ZIPLAR", tmp_path / "0-Manba"
    zips.mkdir()
    (manba / "manbalar" / "hadis-raqamlar").mkdir(parents=True)
    (manba / "yangilanishlar" / "dot-20261023-02").mkdir(parents=True)
    a_tsv = "kitob\traqam\troviy\nmuvatto\t1\tIMKONSIZ\nmuvatto\t2\tX\n"
    _mk_zip(zips / "agent2-A-raqamlar-yangilangan.zip", {"A1-muvatto.tsv": a_tsv})
    _mk_zip(zips / "UMDAT-QISMAN-730-TEKSHIRUV-20261023.zip", {"BOGLAMA.tsv": "a\tb\n1\t2\n"})
    _mk_zip(zips / "UMDAT-QISMAN-530.zip", {"BOGLAMA.tsv": "a\tb\n"})
    import hashlib
    payload = b"salom"
    _mk_zip(zips / "MIRQAT-PARTIAL-380.zip", {
        "x.txt": payload, "MANIFEST.tsv": f"file\tbytes\tsha256\nx.txt\t5\t{hashlib.sha256(payload).hexdigest()}\n"})
    with zipfile.ZipFile(zips / "yomon.zip", "w") as z:
        z.writestr("../tashqari.txt", "x")
    con = sqlite3.connect(manba / "manbalar" / "hadis-raqamlar" / "raqamlar.sqlite")
    con.execute("CREATE TABLE records(book TEXT, n INT)")
    con.executemany("INSERT INTO records VALUES (?,?)", [("bukhari", 1), ("muslim", 1), ("muslim", 2)])
    con.commit()
    con.close()
    (manba / "yangilanishlar" / "dot-20261023-02" / "APPLIED.json").write_text('{"run":"dot-20261023-02"}')
    (manba / "qiroat").mkdir()
    (manba / "qiroat" / "varsh.txt").write_text("x")

    with pytest.raises(ValueError, match="kirish papkasi ichida"):
        run_audit(zips, manba, manba / "out")
    b = run_audit(zips, manba, tmp_path / "out")
    assert b["input_unchanged"] is True
    reg = {r["file_name"]: r for r in json.loads((tmp_path / "out" / "PACKAGE-REGISTRY.json").read_text())["packages"]}
    assert reg["yomon.zip"]["unsafe_names"]
    assert reg["MIRQAT-PARTIAL-380.zip"]["internal_manifest"]["all_ok"] is True
    assert reg["UMDAT-QISMAN-730-TEKSHIRUV-20261023.zip"]["status"] == "needs_semantic_comparison"
    assert [Path_(x["file"]) for x in b["families"]["UMDAT"]] == ["UMDAT-QISMAN-530.zip", "UMDAT-QISMAN-730-TEKSHIRUV-20261023.zip"]
    assert b["current"]["A_imkonsiz_cells"] == 1 and b["current"]["A_rows"]["A1-muvatto.tsv"] == 2
    assert b["update_runs"][0]["content"] == {"run": "dot-20261023-02"}
    assert all(not m["found"] for m in b["missing_packages"])
    assert any("qiroat" in p for p in b["private_or_out_of_scope_paths"])
    probe = json.loads((tmp_path / "out" / "SCHEMA-PROBE.json").read_text())
    assert probe["sqlite"][0]["tables"]["records"] == {"columns": ["book", "n"], "rows": 3, "distinct_book": 2}


def Path_(s):
    return s.rsplit("/", 1)[-1]
