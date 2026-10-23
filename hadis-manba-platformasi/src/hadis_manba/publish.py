"""Ommaviy tarqatma: allowlist, maxfiylik tekshiruvi va katalog (6-, 20-bo'limlar).

Uch qatlam:
  public       — barcha huquq yozuvlari approved + redistribution_allowed=true
  conditional  — shartli (masalan NC/SA) va shart doirasi aniq; alohida kanal va yorliq bilan
  local_only   — unknown / restricted / doirasi noaniq: ommaviy build'ga kirmaydi
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from .pkgformat import open_package, sha256_file

PRIVATE_TEXT = re.compile(
    r"(/Users/[^/\s]+|/home/[^/\s]+/|[A-Za-z]:\\Users\\|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|"
    r"ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=])", re.I)


def classify(manifest: dict) -> tuple[str, list[str]]:
    reasons = []
    rights = manifest.get("rights", [])
    if not rights:
        return "local_only", ["huquq yozuvi yo'q"]
    statuses = {r["rights_status"] for r in rights}
    if statuses & {"unknown", "restricted"}:
        return "local_only", [f"{r['applies_to']}: {r['rights_status']}" for r in rights
                              if r["rights_status"] in ("unknown", "restricted")]
    if any(r.get("redistribution_allowed") is not True for r in rights):
        return "local_only", ["redistribution_allowed tasdiqlanmagan"]
    if "conditional" in statuses:
        unclear = [r for r in rights if r["rights_status"] == "conditional"
                   and not (r.get("license_id") and r.get("conditional_scope_clear") is True)]
        if unclear:
            return "local_only", ["conditional huquq doirasi noaniq"]
        return "conditional", [f"{r['applies_to']}: {r.get('license_id')}" for r in rights
                               if r["rights_status"] == "conditional"]
    if not any(r["applies_to"] == "classical_body" for r in rights) and manifest["kind"] != "selection":
        reasons.append("classical_body uchun huquq yozuvi yo'q")
        return "local_only", reasons
    return "public", reasons


def privacy_scan(pkg) -> list[str]:
    hits = []
    for name, b in pkg.files.items():
        if name.startswith("packages/"):
            continue
        try:
            t = b.decode("utf-8")
        except UnicodeDecodeError:
            continue
        m = PRIVATE_TEXT.search(t)
        if m:
            hits.append(f"{name}: shaxsiy yo'l yoki sir belgisi ({m.group(0)[:20]}…)")
    return hits


def catalog_entry(pkg, path: Path, channel: str) -> dict:
    m = pkg.manifest
    ents = pkg.entities
    persons = {p["person_id"]: p for p in ents.get("persons", [])}
    authors = [{"person_id": a, "name_ar": persons.get(a, {}).get("name_ar"), "name_en": persons.get(a, {}).get("name_en"),
                "name_uz": persons.get(a, {}).get("name_uz")} for a in m.get("author_ids", [])]
    work = next((w for w in ents.get("works", []) if w.get("work_id") == m.get("work_id")), {})
    return {
        "package_id": m["package_id"], "kind": m["kind"], "package_version": m["package_version"],
        "schema_version": m["schema_version"], "title": m["title"], "work_id": m.get("work_id"),
        "edition_id": m.get("edition_id"), "author_ids": m.get("author_ids", []),
        "file": f"paketlar/{path.name}", "package_sha256": sha256_file(path), "compressed_bytes": path.stat().st_size,
        "installed_bytes": m.get("installed_bytes"), "temporary_space_bytes": m.get("temporary_space_bytes"),
        "provides_units": m.get("provides_units"), "coverage": m.get("coverage"),
        "requires_for_linked_reading": m.get("requires_for_linked_reading", []),
        "rights": [{k: r.get(k) for k in ("applies_to", "rights_status", "license_id", "license_url",
                                          "required_attribution", "commercial_use_allowed",
                                          "share_alike_requirements")} for r in m["rights"]],
        "attribution": m.get("attribution"), "channel": channel,
        "authors": authors, "names": m.get("names", []), "names_origin": m.get("names_origin"),
        "work_type": work.get("work_type"), "commentary_on": work.get("commentary_on"),
        "is_test_fixture": bool(m.get("is_test_fixture")),
    }


def build_public(package_files: list[Path], out_dir: Path) -> dict:
    out_dir = Path(out_dir)
    (out_dir / "paketlar").mkdir(parents=True, exist_ok=True)
    report = {"public": [], "conditional": [], "local_only": [], "rejected": []}
    catalog, conditional = [], []
    for f in package_files:
        f = Path(f)
        try:
            pkg = open_package(f)
        except Exception as e:  # noqa: BLE001 — har xatoni hisobotga yozamiz
            report["rejected"].append({"file": f.name, "reason": str(e)})
            continue
        priv = privacy_scan(pkg)
        if priv:
            report["rejected"].append({"file": f.name, "reason": priv})
            continue
        channel, reasons = classify(pkg.manifest)
        report[channel].append({"package_id": pkg.manifest["package_id"], "reasons": reasons})
        if channel == "local_only":
            continue
        dest_dir = out_dir / ("paketlar" if channel == "public" else "paketlar-shartli")
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f.name
        shutil.copyfile(f, dest)
        entry = catalog_entry(pkg, dest, channel)
        if channel == "conditional":
            entry["file"] = f"paketlar-shartli/{dest.name}"
            conditional.append(entry)
        else:
            catalog.append(entry)
    cat = {"schema_version": "1.0.0", "packages": sorted(catalog, key=lambda e: e["package_id"]),
           "note": "Faqat tarqatishga tasdiqlangan paketlar. Ommaviy demo to'liq mahalliy katalog bilan bir xil emas."}
    (out_dir / "catalog.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1), "utf-8")
    if conditional:
        (out_dir / "catalog-shartli.json").write_text(json.dumps(
            {"schema_version": "1.0.0", "packages": conditional,
             "note": "Shartli litsenziya (masalan NC/SA). Shartlarini o'qing."}, ensure_ascii=False, indent=1), "utf-8")
    (out_dir / "PUBLIC-BUILD-REPORT.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), "utf-8")
    return report
