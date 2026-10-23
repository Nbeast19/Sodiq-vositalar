"""Haqiqiy 0-Manba nusxasidan paketlar yasash (natija repo TASHQARISIDA).

    python scripts/import_real.py --manba /home/user/hadis-manba-kirish/hadis-input-run04/0-Manba \
        --out /home/user/hadis-manba-kirish/output-run04 [--books bukhari,muslim] [--commentaries] [--only-commentaries]

Manba faqat o'qiladi. Har kitob/nashr va har sharh alohida .hmz; IMPORT-REPORT.json — matnsiz hisobot.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from hadis_manba.importers import raqamlar as R  # noqa: E402
from hadis_manba.pkgformat import PackageError, build_package  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manba", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--books")
    ap.add_argument("--commentaries", action="store_true")
    ap.add_argument("--only-commentaries", action="store_true")
    a = ap.parse_args()
    manba, out = Path(a.manba).resolve(), Path(a.out).resolve()
    if manba in out.parents or out == manba:
        raise SystemExit("--out manba ichida bo'lmasin")
    report = {"manba": str(manba), "started": time.strftime("%Y-%m-%dT%H:%M:%S"), "base": [], "commentary": [],
              "errors": []}
    rp = out / "IMPORT-REPORT.json"
    if rp.exists():
        old = json.loads(rp.read_text("utf-8"))
        report["base"] = old.get("base", []) if a.only_commentaries else []
        report["commentary"] = old.get("commentary", []) if not (a.commentaries or a.only_commentaries) else []
    if not a.only_commentaries:
        names, persons = R.load_aux(manba)
        idx = R.edition_index(manba)
        books = a.books.split(",") if a.books else R.all_books(manba)
        for b in books:
            t0 = time.time()
            for src in R.build_book(manba, b, out / "src", names, persons, idx):
                try:
                    p = build_package(src, out / "dist")
                    m = json.loads((out / "dist" / p.name.replace(".hmz", ".manifest.json")).read_text("utf-8"))
                    report["base"].append({"book": b, "package_id": m["package_id"], "edition_id": m["edition_id"],
                                           "file": p.name, "bytes": p.stat().st_size, "sha256": m["package_sha256"],
                                           "coverage": m["coverage"],
                                           "rights": sorted({r["rights_status"] for r in m["rights"]}),
                                           "seconds": round(time.time() - t0, 1)})
                    print(f"OK  {m['package_id']}  {m['coverage']['source_records']} yozuv", flush=True)
                except PackageError as e:
                    report["errors"].append({"book": b, "src": src.name, "errors": e.errors[:20]})
                    print(f"XATO {src.name}: {e.errors[:3]}", flush=True)
    if a.commentaries or a.only_commentaries:
        from hadis_manba.importers import sharhlar as S
        idx = R.edition_index(manba)
        for src, info in S.build_all(manba, out / "src", idx):
            try:
                p = build_package(src, out / "dist")
                m = json.loads((out / "dist" / p.name.replace(".hmz", ".manifest.json")).read_text("utf-8"))
                report["commentary"].append({**info, "package_id": m["package_id"], "file": p.name,
                                             "bytes": p.stat().st_size, "sha256": m["package_sha256"],
                                             "coverage": m["coverage"],
                                             "rights": sorted({r["rights_status"] for r in m["rights"]})})
                print(f"OK  {m['package_id']}  {m['coverage'].get('occurrences')} uchrashuv", flush=True)
            except PackageError as e:
                report["errors"].append({"commentary": src.name, "errors": e.errors[:20]})
                print(f"XATO {src.name}: {e.errors[:3]}", flush=True)
    report["finished"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    rp.write_text(json.dumps(report, ensure_ascii=False, indent=1), "utf-8")
    print(f"hisobot: {rp}")


if __name__ == "__main__":
    main()
