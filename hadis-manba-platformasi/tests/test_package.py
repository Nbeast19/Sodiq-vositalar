import io
import json
import stat
import zipfile

import pytest

from conftest import variant_src
from hadis_manba.pkgformat import PackageError, build_package, open_package, sha256_file
from hadis_manba.safezip import Limits


def _rezip(src, dst, mutate):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w") as zout:
        files = {i.filename: zin.read(i) for i in zin.infolist()}
        for name, data in mutate(files).items():
            zout.writestr(name, data)
    return dst


def test_build_is_deterministic(built, tmp_path):
    a = build_package(built["src"]["namuna-asos-a"], tmp_path / "x")
    assert sha256_file(a) == sha256_file(built["pkg"]["namuna-asos-a"])


def test_open_valid(built):
    for p in built["pkg"].values():
        pkg = open_package(p)
        assert pkg.manifest["is_test_fixture"] is True


def test_tampered_member_rejected(built, tmp_path):
    def m(files):
        files["data/units.jsonl"] = files["data/units.jsonl"].replace("أَوَّلُ".encode(), "ثَانٍ".encode(), 1)
        return files
    bad = _rezip(built["pkg"]["namuna-asos-a"], tmp_path / "bad.hmz", m)
    with pytest.raises(PackageError) as e:
        open_package(bad)
    assert any("xesh" in x for x in e.value.errors)


def test_unlisted_file_and_code_rejected(built, tmp_path):
    def m(files):
        files["data/run.py"] = b"import os; os.system('echo hacked')"
        return files
    with pytest.raises(PackageError) as e:
        open_package(_rezip(built["pkg"]["namuna-asos-a"], tmp_path / "x.hmz", m))
    assert any("ruxsat etilmagan" in x for x in e.value.errors)


@pytest.mark.parametrize("name", ["../evil.txt", "/etc/passwd", "a/../../b", "C:/x", "a\\b"])
def test_path_traversal_rejected(built, tmp_path, name):
    def m(files):
        files[name] = b"x"
        return files
    with pytest.raises(PackageError) as e:
        open_package(_rezip(built["pkg"]["namuna-asos-a"], tmp_path / "t.hmz", m))
    assert "xavfsizlik" in str(e.value)


def test_symlink_rejected(built, tmp_path):
    dst = tmp_path / "s.hmz"
    with zipfile.ZipFile(built["pkg"]["namuna-asos-a"]) as zin, zipfile.ZipFile(dst, "w") as zout:
        for i in zin.infolist():
            zout.writestr(i, zin.read(i))
        zi = zipfile.ZipInfo("data/link")
        zi.external_attr = (stat.S_IFLNK | 0o777) << 16
        zout.writestr(zi, "/etc/passwd")
    with pytest.raises(PackageError, match="symlink"):
        open_package(dst)


def test_zip_bomb_rejected(tmp_path):
    dst = tmp_path / "bomb.hmz"
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("package.json", b"0" * (50 * 1024 * 1024))
    with pytest.raises(PackageError, match="zip bomb"):
        open_package(dst)
    with pytest.raises(PackageError, match="chegaradan oshdi"):
        open_package(dst, Limits(max_total_uncompressed=1024, max_ratio=10**9))


def test_rights_unknown_cannot_claim_redistribution(built, tmp_path):
    def mut(m, units):
        m["rights"] = [{"applies_to": "classical_body", "rights_status": "unknown", "redistribution_allowed": True}]
    with pytest.raises(PackageError, match="unknown/restricted"):
        build_package(variant_src(built, tmp_path, "namuna-asos-a", mut), tmp_path / "o")


@pytest.mark.parametrize("mutation,needle", [
    (lambda u: u[0]["numbers"][0].update(page="0"), "sahifa 0"),
    (lambda u: u[6]["numbers"][0].update(number_int=7), "guruh"),
    (lambda u: u[0].update(unit_type="nabawi"), "unit_type"),
    (lambda u: u[0]["statuses"].update(number_status="IMKONSIZ"), "ruxsat etilmagan qiymat"),
    (lambda u: u[0]["gradings"][0].pop("source_ref"), "olim va manba"),
    (lambda u: u[1]["narrators"][0].update(terminal_person_id="p-rawi-b"), "birlashtirilmaydi"),
])
def test_unit_rules(built, tmp_path, mutation, needle):
    def mut(m, units):
        mutation(units)
    with pytest.raises(PackageError) as e:
        build_package(variant_src(built, tmp_path, "namuna-asos-a", mut), tmp_path / "o")
    assert any(needle in x for x in e.value.errors), e.value.errors


def test_commentary_full_section_requires_end_verified(built, tmp_path):
    import shutil
    dst = tmp_path / "c"
    shutil.copytree(built["src"]["namuna-sharh-1"], dst)
    p = dst / "data" / "occurrences.jsonl"
    rows = [json.loads(l) for l in p.read_text("utf-8").splitlines()]
    rows[2]["scope"] = "full_section"  # tugashi tasdiqlanmagan umumiy sharh
    rows[3]["lemma_text"] = "سُنِّيٌّ مُصْطَنَعٌ"  # iqtibos_yoq joyiga sun'iy lemma
    p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), "utf-8")
    with pytest.raises(PackageError) as e:
        build_package(dst, tmp_path / "o")
    errs = " ".join(e.value.errors)
    assert "full_section" in errs and "iqtibos_yoq" in errs


def test_link_to_undeclared_edition_rejected(built, tmp_path):
    import shutil
    dst = tmp_path / "c2"
    shutil.copytree(built["src"]["namuna-sharh-1"], dst)
    p = dst / "data" / "links.jsonl"
    rows = [json.loads(l) for l in p.read_text("utf-8").splitlines()]
    rows[0]["target_edition_id"] = "ed-namuna-b"
    p.write_text("".join(json.dumps(r) + "\n" for r in rows), "utf-8")
    with pytest.raises(PackageError, match="e'lon qilinmagan nashr"):
        build_package(dst, tmp_path / "o")


def test_bad_json_goes_to_error_not_guess(built, tmp_path):
    def m(files):
        files["data/units.jsonl"] = files["data/units.jsonl"] + b"{buzilgan\n"
        return files
    with pytest.raises(PackageError):
        open_package(_rezip(built["pkg"]["namuna-asos-a"], tmp_path / "j.hmz", m))
