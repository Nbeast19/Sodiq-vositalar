import json
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "examples")]

import namuna_manba  # noqa: E402
from hadis_manba.core import Core  # noqa: E402
from hadis_manba.paths import Home  # noqa: E402
from hadis_manba.pkgformat import build_package  # noqa: E402
from hadis_manba.store import Library  # noqa: E402


@pytest.fixture(scope="session")
def built(tmp_path_factory):
    """Sinov namunasi manba papkalari va .hmz paketlari (sessiya uchun bir marta)."""
    root = tmp_path_factory.mktemp("namuna")
    srcs = namuna_manba.make_all(root / "src")
    pk = {p.name: build_package(p, root / "dist") for p in srcs}
    return {"src": {p.name: p for p in srcs}, "pkg": pk, "root": root}


@pytest.fixture
def lib(tmp_path):
    l = Library(Home(tmp_path / "home"))
    yield l
    l.close()


@pytest.fixture
def full(lib, built):
    for name in ("namuna-asos-a", "namuna-asos-b", "namuna-sharh-1", "namuna-sharh-2"):
        lib.install(built["pkg"][name])
    return Core(lib)


def variant_src(built, tmp_path, name, mutate):
    """Manba papkasidan nusxa olib o'zgartiradi (yangi versiya yoki buzilgan paket uchun)."""
    dst = tmp_path / f"{name}-{mutate.__name__}"
    shutil.copytree(built["src"][name], dst)
    m = json.loads((dst / "package.json").read_text("utf-8"))
    units_p = dst / "data" / "units.jsonl"
    units = [json.loads(l) for l in units_p.read_text("utf-8").splitlines()] if units_p.exists() else []
    mutate(m, units)
    (dst / "package.json").write_text(json.dumps(m, ensure_ascii=False), "utf-8")
    if units:
        units_p.write_text("".join(json.dumps(u, ensure_ascii=False) + "\n" for u in units), "utf-8")
    return dst
