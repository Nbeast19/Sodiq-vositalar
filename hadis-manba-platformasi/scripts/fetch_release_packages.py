"""Nashr paytida (GitHub Actions) katalogdagi paketlarni GitHub Release'dan olib, SHA-256 ni tekshirib,
sayt papkasiga qo'yadi. Paketlar git tarixiga kirmaydi; brauzer esa ularni saytning o'zidan (CORS'siz) oladi.

    GH_TOKEN=... python scripts/fetch_release_packages.py --web _site/hadis-manba-platformasi/web
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", type=Path, required=True)
    a = ap.parse_args()
    entries, release = [], None
    for fn in ("catalog.json", "catalog-shartli.json"):
        f = a.web / fn
        if f.exists():
            cat = json.loads(f.read_text("utf-8"))
            release = release or cat.get("release")
            entries += cat.get("packages", [])
    if not release:
        print("katalogda release yo'q — paket olinmaydi")
        return
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["gh", "release", "download", release["tag"], "--repo", release["repo"],
                        "--pattern", "*.hmz", "--dir", td], check=True)
        for p in entries:
            src = Path(td) / Path(p["file"]).name
            got = hashlib.sha256(src.read_bytes()).hexdigest()
            if got != p["package_sha256"]:
                raise SystemExit(f"SHA-256 mos emas: {src.name}")
            dst = a.web / p["file"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)
    print(f"{len(entries)} paket Release'dan olindi va tekshirildi ({release['tag']})")


if __name__ == "__main__":
    main()
