"""Reliz: ommaviy (allowlist) paketlar + SHA256SUMS + katalog -> dist/release/.

    python scripts/make_release.py
Release asset har fayli 2 GiB dan kichik bo'lishi tekshiriladi (GitHub limiti; amalda qayta tekshiring).
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from hadis_manba.publish import build_public  # noqa: E402

LIMIT = 2 * 1024 ** 3


def main():
    out = ROOT / "dist" / "release"
    shutil.rmtree(out, ignore_errors=True)
    pkgs = sorted(p for p in (ROOT / "dist").glob("*.hmz") if not p.name.startswith("namuna-kitob-va"))
    rep = build_public(pkgs, out)
    files = sorted(out.rglob("*.hmz"))
    for f in files:
        if f.stat().st_size >= LIMIT:
            raise SystemExit(f"{f.name} 2 GiB dan katta — bo'lish kerak")
    sums = "".join(f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.relative_to(out).as_posix()}\n" for f in files)
    (out / "SHA256SUMS").write_text(sums)
    print(json.dumps({k: len(v) for k, v in rep.items()}), f"-> {out}")


if __name__ == "__main__":
    main()
