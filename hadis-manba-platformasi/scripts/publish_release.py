"""Haqiqiy paketlarni GitHub Releases orqali nashr qilish (foydalanuvchi ruxsati: QARORLAR.md #26).

Ikki bosqich:

  1) stage   — allowlist (public + conditional) paketlarini Release uchun alohida papkaga yig'adi:
               paketlar/*.hmz, SHA256SUMS, RIGHTS-PAKETLAR.md, RELEASE-NOTES.md
     python scripts/publish_release.py stage <paket.hmz ...> --out <papka> --tag <tag> --repo <owner/repo>

  2) catalog — Release yaratilgach web/catalog.json, web/catalog-shartli.json va /en/, /ar/ statik
               sahifalarini yozadi. Paketlar gitga kirmaydi: .github/workflows/hadis-manba-pages.yml
               nashrda ularni Release'dan olib web/paketlar/ ga qo'yadi (scripts/fetch_release_packages.py)
     python scripts/publish_release.py catalog --stage <papka> --assets <assets.json> --web web --base-url <URL>

assets.json: [{"name": "...hmz", "id": 123}, ...] (GitHub release assets ro'yxati).
Huquqi noma'lum (unknown/restricted) paketlar hech qachon tanlanmaydi — classify() qaroriga tayanadi.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from hadis_manba.publish import build_public  # noqa: E402
from hadis_manba.site import build_site  # noqa: E402


def _name(p: dict, lang: str) -> str:
    return (p.get("title") or {}).get(lang) or p["package_id"]


def _authors(p: dict) -> str:
    return "; ".join(a.get("name_ar") or a.get("name_en") or a["person_id"] for a in p.get("authors") or []) or "—"


def _licence(p: dict) -> str:
    body = next((r for r in p["rights"] if r["applies_to"] == "classical_body"), p["rights"][0])
    if body.get("license_id"):
        return body["license_id"]
    return "permission (" + (body.get("required_attribution") or "?") + ")"


def _attribution(p: dict) -> str:
    seen = []
    for r in p["rights"]:
        a = r.get("required_attribution")
        if a and a not in seen:
            seen.append(a)
    return "; ".join(seen) or "—"


def stage(pkgs: list[Path], out: Path, tag: str, repo: str) -> dict:
    if out.exists():
        shutil.rmtree(out)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        rep = build_public(pkgs, tmp)
        cats = {"public": json.loads((tmp / "catalog.json").read_text("utf-8"))}
        shartli = tmp / "catalog-shartli.json"
        cats["conditional"] = json.loads(shartli.read_text("utf-8")) if shartli.exists() else {"packages": []}
        (out / "paketlar").mkdir(parents=True)
        for ch, cat in cats.items():
            for p in cat["packages"]:
                shutil.copy(tmp / p["file"], out / "paketlar" / Path(p["file"]).name)
        (out / "catalog.json").write_text(json.dumps(cats["public"], ensure_ascii=False, indent=1) + "\n", "utf-8")
        (out / "catalog-shartli.json").write_text(json.dumps(cats["conditional"], ensure_ascii=False, indent=1) + "\n", "utf-8")
    allp = [p for c in cats.values() for p in c["packages"]]
    sums = "".join(f"{p['package_sha256']}  {Path(p['file']).name}\n" for p in sorted(allp, key=lambda x: x["file"]))
    (out / "paketlar" / "SHA256SUMS").write_text(sums, "utf-8")

    url = f"https://github.com/{repo}/releases/download/{tag}/"
    lines = ["# Hadis Manba — package rights and attribution", "",
             "Each package (`.hmz`) also contains its own `LICENSE` and `ATTRIBUTION` files.",
             "Packages whose rights are unknown are **not** published here; they stay local only.", ""]
    for title, ch in (("Main books (open to share — Sunnah.com permission)", "public"),
                      ("Commentaries (conditional — CC BY-NC-SA 4.0, non-commercial, share-alike)", "conditional")):
        lines += [f"## {title}", "", "| Package | Arabic title | English title | Author | Edition | Licence | Attribution | SHA-256 |",
                  "|---|---|---|---|---|---|---|---|"]
        for p in sorted(cats[ch]["packages"], key=lambda x: x["package_id"]):
            f = Path(p["file"]).name
            lines.append(f"| [{f}]({url}{f}) | {_name(p, 'ar')} | {_name(p, 'en')} | {_authors(p)} | `{p['edition_id']}` | "
                         f"{_licence(p)} | {_attribution(p)} | `{p['package_sha256'][:16]}…` |")
        lines.append("")
    (out / "paketlar" / "RIGHTS-PAKETLAR.md").write_text("\n".join(lines), "utf-8")

    n_pub, n_con = len(cats["public"]["packages"]), len(cats["conditional"]["packages"])
    notes = f"""Hadis Manba offline packages — {n_pub} main books + {n_con} commentaries, each a separate download.

* Install them from the app (Library → book → *Install book only* or *Install book + selected commentaries*), or download a `.hmz` file here and use **My books → Import file**.
* A commentary links to its hadiths only when its matching main-book edition is also installed.
* Main books: Sunnah.com (hadith-json 1.2.0), shared with permission. Commentaries: OpenITI corpus, **CC BY-NC-SA 4.0** (non-commercial, share-alike, attribution required).
* Rights, authors, editions and attribution for every package: `RIGHTS-PAKETLAR.md`. Checksums: `SHA256SUMS`.
* Scholarly coverage is **incomplete** (most status fields are “not reviewed”). No new translation of hadith or commentary text is included.

حزم Hadis Manba للعمل بلا إنترنت — {n_pub} كتابًا أصليًا و{n_con} شرحًا، كلٌّ منها تنزيل مستقل. الشروح من مدونة OpenITI بترخيص CC BY-NC-SA 4.0 (غير تجاري، مع النسبة والمشاركة بالمثل). التغطية العلمية غير مكتملة.
"""
    (out / "RELEASE-NOTES.md").write_text(notes, "utf-8")
    return {"public": n_pub, "conditional": n_con, "local_only": len(rep.get("local_only", []))}


def catalog(stage_dir: Path, assets: Path, web: Path, base_url: str, repo: str, tag: str) -> dict:
    ids = {a["name"]: a["id"] for a in json.loads(assets.read_text("utf-8"))}
    out = {}
    for fn in ("catalog.json", "catalog-shartli.json"):
        cat = json.loads((stage_dir / fn).read_text("utf-8"))
        for p in cat["packages"]:
            f = Path(p["file"]).name
            if f not in ids:
                raise SystemExit(f"Release'da asset yo'q: {f}")
            # Brauzer Release fayllarini CORS sababli ololmaydi (sinalgan): Pages workflow paketni Release'dan
            # olib, xeshini tekshirib, saytning o'zi bilan bir manzilga (paketlar/) qo'yadi. Gitga kirmaydi.
            p["file"] = f"paketlar/{f}"
            p["release_asset_id"] = ids[f]
            p["download_url"] = f"https://github.com/{repo}/releases/download/{tag}/{f}"
        cat["release"] = {"repo": repo, "tag": tag, "url": f"https://github.com/{repo}/releases/tag/{tag}"}
        (web / fn).write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n", "utf-8")
        out[fn] = len(cat["packages"])
    for d in ("paketlar", "paketlar-shartli"):
        shutil.rmtree(web / d, ignore_errors=True)
    out["site"] = build_site([web / "catalog.json", web / "catalog-shartli.json"], web, base_url)
    return out


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("stage")
    s.add_argument("packages", type=Path, nargs="+")
    s.add_argument("--out", type=Path, required=True)
    s.add_argument("--tag", required=True)
    s.add_argument("--repo", required=True)
    c = sub.add_parser("catalog")
    c.add_argument("--stage", type=Path, required=True)
    c.add_argument("--assets", type=Path, required=True)
    c.add_argument("--web", type=Path, default=ROOT / "web")
    c.add_argument("--base-url", required=True)
    c.add_argument("--repo", required=True)
    c.add_argument("--tag", required=True)
    a = ap.parse_args()
    if a.cmd == "stage":
        print(json.dumps(stage(sorted(a.packages), a.out, a.tag, a.repo)))
    else:
        print(json.dumps(catalog(a.stage, a.assets, a.web, a.base_url, a.repo, a.tag), ensure_ascii=False))


if __name__ == "__main__":
    main()
