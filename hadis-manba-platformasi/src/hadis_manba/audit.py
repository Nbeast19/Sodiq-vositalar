"""Kirish papkalarini FAQAT O'QIB audit qilish (1-bosqich).

    hadis-manba audit --zips ~/Downloads/ZIPLAR --manba ~/Downloads/Kitob-loyiha/0-Manba --out ~/HadisManba-audit

Hech qanday faylga yozmaydi, ko'chirmaydi, o'chirmaydi, ZIP ochmaydi
(a'zolar xotirada cheklangan hajmda o'qiladi). Natijalar --out papkasiga:
  PACKAGE-REGISTRY.json  har ZIP: SHA-256, hajm, a'zolar, oila/bosqich, CRC, xavfsizlik, holat
  AUDIT-BASELINE.json    joriy sanoq, topshiriqdagi tarixiy sonlar bilan solishtirish, pre/post xesh
  SCHEMA-PROBE.json      TSV sarlavhalari/qator soni, SQLite jadvallari (matn emas — faqat tuzilma)
  AUDIT-SUMMARY.md       o'zbekcha qisqa xulosa
--out kirish papkalari ichida bo'lishi taqiqlanadi.
"""
from __future__ import annotations

import csv
import datetime as _dt
import hashlib
import io
import json
import os
import re
import sqlite3
import zipfile
from pathlib import Path

from .safezip import UnsafeZip, check_name

# Topshiriqdagi (2026-10-23) tarixiy baseline — bu yerda tekshirilmagan, faqat solishtirish uchun.
BRIEF_BASELINE = {
    "manba_files_pre_update": 9642,
    "manba_bytes_pre_update": 6536021709,
    "zips_files": 43,
    "zips_zip_count": 40,
    "raqamlar_sqlite_records": 239168,
    "raqamlar_sqlite_collections": 29,
    "raqamlar_sqlite_bytes": 1326272512,
    "commentary_catalog_entries": 18,
    "commentary_with_local_txt": 16,
    "A_rows": {"A1-muvatto.tsv": 1985, "A2-shamoil.tsv": 402, "A3-bulugh.tsv": 1767,
               "A4-dorimiy-ochiq.tsv": 581, "A5-riyozus-solihin-ochiq.tsv": 269,
               "A6-tabaroniy-kabir-jild.tsv": 9427},
    "A_rows_total": 14431,
    "A_imkonsiz_cells": 192,
    "A_imkonsiz_rows": 191,
    "claude_address_fixes": {"Umdat": 2645, "Navaviy": 148, "Bazl": 48, "Bojuriy": 45, "total": 2886},
    "db_tsv_mismatch_pre_update": 13684,
    "muvatto_hash_layer_records": 125,
}
# Codex xabari (run dot-20261023-02) — foydalanuvchi orqali yetkazilgan, bu yerda tekshirilmagan.
CODEX_REPORTED_DOT_20261023_02 = {
    "run": "dot-20261023-02",
    "Umdat": {"occurrences": 930, "previous": 730, "distinct_numbers": 922, "local_verified": 384, "limited": 546},
    "Mirqot": {"occurrences": 380, "previous": 280, "limited": 380},
    "Tibiy": {"occurrences": 260, "previous": 210, "local_verified": 3, "limited": 257,
              "j03_print_evidence_line_fixes": 15},
    "active_indexes": {"Umdat": 6174, "Mirqot": 4210, "Tibiy": 2353},
    "legacy_remainder": {"Umdat": 5244, "Mirqot": 3830, "Tibiy": 2093},
    "Tuhfa": 191, "Fath": 70,
    "main_sqlite_changed": False,
    "note": "statuslar hadis sahihlik hukmi emas; kumulyativ — eski doira qayta qo'shilmaydi",
}
CODEX_REPORTED_DOT_20261023_03 = {
    "run": "dot-20261023-03",
    "Umdat": 1130, "Mirqot": 480, "Tibiy": 360, "Tuhfa": 221, "Fath_Salafiyya": 100,
    "IbnMoja_Sindi_V2": {"initial": 10, "rows": "1-9, 11"},
    "extra_check_scope_rows": 470,
    "Tibiy_print_evidence_line_fixes_260_to_360": 20,
    "Umdat_legacy_separate_old_occurrences": 5,
    "main_sqlite_changed": False,
    "transfer_manifest_file_count": 12366,
    "note": "kumulyativ — oldingi paketlarga qo'shib sanalmaydi; ilmiy qamrov INCOMPLETE",
}
MISSING_PACKAGES = (
    "NAWAWI-B-TEKSHIRILGAN-2026-10-23.zip",
    "agent2-B-al-tamhid-V2.zip",
    "agent2-B-maalim-al-sunan-V2.zip",
    "agent2-B-shamail_muhammadiyah-V2.zip",
    "nasai-v2-source-limited-20261022.zip",
    "agent2-B-misbah-az-zujaja-V2.zip",
)
FAMILIES = [
    ("A", re.compile(r"^agent2-A", re.I)),
    ("R1", re.compile(r"^agent2-R1", re.I)),
    ("B", re.compile(r"^agent2-B-", re.I)),
    ("UMDAT", re.compile(r"UMDAT", re.I)),
    ("MIRQAT", re.compile(r"MIRQ?A?T|MIRQOT", re.I)),
    ("TIBI", re.compile(r"TIBI|TIYBIY|TIBIY", re.I)),
    ("TUHFA", re.compile(r"TUHFA", re.I)),
    ("FATH", re.compile(r"^Fath", re.I)),
    ("NAWAWI", re.compile(r"NAWAWI|NAVAVIY", re.I)),
]
# Ommaviy tarqatmaga hech qachon kirmaydigan shaxsiy / doiradan tashqari yo'llar (2-bo'lim).
PRIVATE_PATTERNS = re.compile(
    r"(qur.?on|quran|qiro?at|qiraat|mushaf|tafsir-tarjima|asma.?ul|asmaul|husna|/D0\d\d|dars|transkript|"
    r"qo.?lyozma|kitob-loyiha/(?!0-manba)|holat\.md|agent-buyruq|codex-|topshiriq|\.env|token|secret|parol|"
    r"api[_-]?key|login|cookies|history)", re.I)
TEXT_PROBE_EXT = (".tsv",)
MAX_PROBE_BYTES = 512 * 1024 * 1024


def _now():
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def sha256_path(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for b in iter(lambda: fh.read(4 * 1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def walk(root: Path) -> list[Path]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames.sort()
        for f in sorted(filenames):
            out.append(Path(dirpath) / f)
    return out


def snapshot(roots: dict[str, Path], hashing: bool) -> dict:
    snap = {}
    for label, root in roots.items():
        for p in walk(root):
            try:
                st = p.lstat()
            except OSError as e:
                snap[f"{label}/{p.relative_to(root).as_posix()}"] = {"error": str(e)}
                continue
            rec = {"bytes": st.st_size, "mtime_ns": st.st_mtime_ns, "symlink": p.is_symlink()}
            if hashing and p.is_file() and not p.is_symlink():
                rec["sha256"] = sha256_path(p)
            snap[f"{label}/{p.relative_to(root).as_posix()}"] = rec
    return snap


def probe_tsv_bytes(b: bytes, name: str) -> dict:
    try:
        text = b.decode("utf-8-sig")
    except UnicodeDecodeError:
        return {"name": name, "error": "UTF-8 emas"}
    rows = list(csv.reader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE))
    header = rows[0] if rows else []
    body = rows[1:]
    widths = {}
    imk_cells = imk_rows = raqamsiz = 0
    for r in body:
        widths[len(r)] = widths.get(len(r), 0) + 1
        c = sum(1 for x in r if x.strip() == "IMKONSIZ")
        imk_cells += c
        imk_rows += 1 if c else 0
        raqamsiz += sum(1 for x in r if x.strip() == "RAQAMSIZ")
    return {"name": name, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), "header": header,
            "data_rows": len(body), "row_widths": widths, "imkonsiz_cells": imk_cells, "imkonsiz_rows": imk_rows,
            "raqamsiz_cells": raqamsiz}


def family_of(name: str) -> tuple[str | None, int | None]:
    fam = next((f for f, rx in FAMILIES if rx.search(name)), None)
    nums = [int(x) for x in re.findall(r"(?<!\d)(\d{2,4})(?!\d)", name) if not x.startswith("20")]
    return fam, (max(nums) if nums else None)


def verify_internal_manifest(zf: zipfile.ZipFile) -> dict | None:
    """Paket ichidagi MANIFEST.tsv (file, bytes, sha256) bo'yicha har a'zoni tekshiradi. Kod bajarilmaydi."""
    names = zf.namelist()
    man = next((n for n in names if n.rsplit("/", 1)[-1] == "MANIFEST.tsv" and n.count("/") == 0), None)
    if not man:
        return None
    lines = zf.read(man).decode("utf-8-sig").splitlines()
    header = lines[0].split("\t") if lines else []
    try:
        fi, bi, hi = header.index("file"), header.index("bytes"), header.index("sha256")
    except ValueError:
        return {"manifest": man, "error": f"kutilmagan sarlavha: {header}"}
    ok, bad, missing, listed = 0, [], [], set()
    for line in lines[1:]:
        if not line.strip():
            continue
        r = line.split("\t")
        listed.add(r[fi])
        if r[fi] not in names:
            missing.append(r[fi])
            continue
        h = hashlib.sha256()
        n = 0
        with zf.open(r[fi]) as fh:
            for b in iter(lambda: fh.read(1024 * 1024), b""):
                h.update(b)
                n += len(b)
        if h.hexdigest() == r[hi] and str(n) == r[bi]:
            ok += 1
        else:
            bad.append(r[fi])
    unlisted = sorted(set(n for n in names if not n.endswith("/")) - listed - {man})
    return {"manifest": man, "listed": len(listed), "ok": ok, "mismatch": bad[:100], "missing": missing[:100],
            "unlisted": unlisted[:100], "all_ok": not bad and not missing and not unlisted}


def audit_zip(p: Path, rel: str, sha256: str | None) -> tuple[dict, list[dict]]:
    rec = {"path": rel, "file_name": p.name, "bytes": p.stat().st_size, "sha256": sha256}
    fam, stage = family_of(p.name)
    rec.update({"family": fam, "stage_number_in_name": stage,
                "status": "needs_semantic_comparison" if fam in ("UMDAT", "MIRQAT", "TIBI", "TUHFA", "FATH") else
                ("needs_review" if fam else "unclassified"),
                "status_note": "fayl nomidagi son yoki sana ustuvorlik dalili emas",
                "import_status": "not_imported", "parent_package": None,
                "rights_status": "unknown"})
    probes = []
    try:
        with zipfile.ZipFile(p) as zf:
            infos = zf.infolist()
            unsafe = []
            for i in infos:
                try:
                    check_name(i.filename)
                except UnsafeZip as e:
                    unsafe.append(str(e))
            bad = zf.testzip()
            rec.update({"members": len(infos), "uncompressed_bytes": sum(i.file_size for i in infos),
                        "crc_ok": bad is None, "crc_first_bad": bad, "unsafe_names": unsafe,
                        "member_list": [{"name": i.filename, "bytes": i.file_size, "crc": f"{i.CRC:08x}"}
                                        for i in infos[:5000]],
                        "member_list_truncated": len(infos) > 5000,
                        "has": {k: any(re.search(rx, i.filename, re.I) for i in infos) for k, rx in
                                {"BOGLAMA": r"BOGLAMA", "MANZILLAR": r"MANZILLAR", "QOLDI": r"QOLDI\.md",
                                 "MANIFEST": r"MANIFEST|SHA256", "provenance": r"provenance/",
                                 "j01": r"(^|/)j01\.txt$"}.items()}})
            rec["internal_manifest"] = verify_internal_manifest(zf)
            rec["contains_code_files"] = sorted(i.filename for i in infos if i.filename.endswith((".py", ".sh", ".js")))[:200]
            for i in infos:
                if i.filename.lower().endswith(TEXT_PROBE_EXT) and i.file_size <= MAX_PROBE_BYTES and not unsafe:
                    with zf.open(i) as fh:
                        b = fh.read(MAX_PROBE_BYTES + 1)
                    pr = probe_tsv_bytes(b, i.filename)
                    pr["container"] = rec["path"]
                    probes.append(pr)
    except zipfile.BadZipFile as e:
        rec.update({"crc_ok": False, "error": f"ZIP buzilgan: {e}"})
    return rec, probes


def probe_sqlite(p: Path) -> dict:
    uri = p.resolve().as_uri() + "?mode=ro&immutable=1"
    out = {"path": str(p.name), "bytes": p.stat().st_size, "tables": {}}
    try:
        con = sqlite3.connect(uri, uri=True)
        out["quick_check"] = con.execute("PRAGMA quick_check").fetchone()[0]
        for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
            cols = [r[1] for r in con.execute(f'PRAGMA table_info("{t}")')]
            info = {"columns": cols}
            try:
                info["rows"] = con.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
                for c in cols:
                    if c.lower() in ("book", "collection", "kitob", "collection_id", "book_id"):
                        info[f"distinct_{c}"] = con.execute(f'SELECT count(DISTINCT "{c}") FROM "{t}"').fetchone()[0]
            except sqlite3.DatabaseError as e:  # virtual jadval va h.k.
                info["error"] = str(e)
            out["tables"][t] = info
        con.close()
    except sqlite3.DatabaseError as e:
        out["error"] = str(e)
    return out


def run_audit(zips_dir: Path | None, manba_dir: Path | None, out_dir: Path, hashing: bool = True,
              post_hash: str = "full") -> dict:
    roots = {}
    if zips_dir:
        roots["ZIPLAR"] = Path(zips_dir).expanduser().resolve()
    if manba_dir:
        roots["0-Manba"] = Path(manba_dir).expanduser().resolve()
    if not roots:
        raise ValueError("kamida --zips yoki --manba kerak")
    out_dir = Path(out_dir).expanduser().resolve()
    for r in roots.values():
        if not r.is_dir():
            raise ValueError(f"papka topilmadi: {r}")
        if out_dir == r or r in out_dir.parents:
            raise ValueError("--out kirish papkasi ichida bo'lmasin (kirish faqat o'qiladi)")
    started = _now()
    pre = snapshot(roots, hashing)

    registry, probes, sqlite_probes, updates, private_paths = [], [], [], [], []
    for label, root in roots.items():
        for p in walk(root):
            rel = f"{label}/{p.relative_to(root).as_posix()}"
            if PRIVATE_PATTERNS.search(rel):
                private_paths.append(rel)
            low = p.name.lower()
            if p.is_symlink():
                continue
            if low.endswith(".zip"):
                rec, pr = audit_zip(p, rel, pre.get(rel, {}).get("sha256"))
                rec["private_or_out_of_scope"] = bool(PRIVATE_PATTERNS.search(rel))
                registry.append(rec)
                probes += pr
            elif low.endswith((".sqlite", ".sqlite3", ".db")):
                sp = probe_sqlite(p)
                sp["path"] = rel
                sqlite_probes.append(sp)
            elif low.endswith(".tsv") and p.stat().st_size <= MAX_PROBE_BYTES:
                pr = probe_tsv_bytes(p.read_bytes(), rel)
                probes.append(pr)
            if re.search(r"(YANGILASH-JURNALI.*\.md|APPLIED\.json|POST-VALIDATSIYA\.json)$", p.name):
                u = {"path": rel, "bytes": p.stat().st_size, "sha256": pre.get(rel, {}).get("sha256")}
                if p.name.endswith(".json") and p.stat().st_size < 5 * 1024 * 1024:
                    try:
                        u["content"] = json.loads(p.read_text("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError) as e:
                        u["parse_error"] = str(e)
                updates.append(u)

    names = {r["file_name"] for r in registry}
    missing = [{"file_name": n, "found": n in names,
                "where": [r["path"] for r in registry if r["file_name"] == n]} for n in MISSING_PACKAGES]
    families: dict[str, list] = {}
    for r in registry:
        if r["family"]:
            families.setdefault(r["family"], []).append({"file": r["path"], "stage": r["stage_number_in_name"],
                                                         "sha256": r["sha256"]})
    for v in families.values():
        v.sort(key=lambda x: (x["stage"] is None, x["stage"] or 0))

    # Baseline bilan solishtirish
    def count(label):
        return sum(1 for k, v in pre.items() if k.startswith(label + "/"))

    def size(label):
        return sum(v.get("bytes", 0) for k, v in pre.items() if k.startswith(label + "/"))

    a_probe = {pr["name"].split("/")[-1]: pr for pr in probes if re.search(r"(^|/)A\d-.*\.tsv$", pr["name"])}
    current = {
        "manba_files": count("0-Manba") if "0-Manba" in roots else None,
        "manba_bytes": size("0-Manba") if "0-Manba" in roots else None,
        "zips_files": count("ZIPLAR") if "ZIPLAR" in roots else None,
        "zips_zip_count": sum(1 for r in registry if r["path"].startswith("ZIPLAR/")),
        "zips_crc_ok": sum(1 for r in registry if r.get("crc_ok")),
        "A_rows": {k: v["data_rows"] for k, v in a_probe.items()},
        "A_rows_total": sum(v["data_rows"] for v in a_probe.values()) if a_probe else None,
        "A_imkonsiz_cells": sum(v["imkonsiz_cells"] for v in a_probe.values()) if a_probe else None,
        "A_imkonsiz_rows": sum(v["imkonsiz_rows"] for v in a_probe.values()) if a_probe else None,
        "sqlite": [{"path": s["path"], "quick_check": s.get("quick_check"),
                    "rows": {t: i.get("rows") for t, i in s["tables"].items()}} for s in sqlite_probes],
    }
    comparisons = []
    for key, exp, cur in (("0-Manba fayllar soni (yangilashdan OLDIN)", BRIEF_BASELINE["manba_files_pre_update"],
                           current["manba_files"]),
                          ("0-Manba bayt (yangilashdan OLDIN)", BRIEF_BASELINE["manba_bytes_pre_update"],
                           current["manba_bytes"]),
                          ("ZIPLAR fayllar", BRIEF_BASELINE["zips_files"], current["zips_files"]),
                          ("ZIPLAR ichidagi ZIPlar", BRIEF_BASELINE["zips_zip_count"], current["zips_zip_count"]),
                          ("A jadvallari jami qator", BRIEF_BASELINE["A_rows_total"], current["A_rows_total"]),
                          ("A IMKONSIZ kataklar", BRIEF_BASELINE["A_imkonsiz_cells"], current["A_imkonsiz_cells"]),
                          ("A IMKONSIZ qatorlar", BRIEF_BASELINE["A_imkonsiz_rows"], current["A_imkonsiz_rows"])):
        comparisons.append({"item": key, "brief": exp, "current": cur,
                            "result": "not_measured" if cur is None else ("match" if cur == exp else "differs")})
    for fname, exp in BRIEF_BASELINE["A_rows"].items():
        cur = current["A_rows"].get(fname)
        comparisons.append({"item": f"A: {fname}", "brief": exp, "current": cur,
                            "result": "not_found" if cur is None else ("match" if cur == exp else "differs")})

    # Post-snapshot: kirish o'zgarmaganini isbotlash
    post = snapshot(roots, hashing and post_hash == "full")
    changed = []
    for k in sorted(set(pre) | set(post)):
        a, b = pre.get(k), post.get(k)
        if a is None or b is None:
            changed.append({"path": k, "change": "added" if a is None else "removed"})
            continue
        keys = ("bytes", "mtime_ns") + (("sha256",) if post_hash == "full" and hashing else ())
        if any(a.get(x) != b.get(x) for x in keys):
            changed.append({"path": k, "change": "modified"})

    baseline = {
        "generated_at": _now(), "started_at": started, "tool": "hadis-manba audit",
        "roots": {k: str(v) for k, v in roots.items()},
        "hashing": hashing, "post_check": post_hash if hashing else "stat",
        "brief_baseline_unverified": BRIEF_BASELINE,
        "codex_reported_dot_20261023_02_unverified": CODEX_REPORTED_DOT_20261023_02,
        "codex_reported_dot_20261023_03_unverified": CODEX_REPORTED_DOT_20261023_03,
        "current": current, "comparisons": comparisons,
        "update_runs": updates,
        "missing_packages": missing, "families": families,
        "private_or_out_of_scope_paths": private_paths[:5000],
        "private_or_out_of_scope_count": len(private_paths),
        "input_unchanged": not changed, "input_changes_during_audit": changed[:1000],
        "snapshot": pre,
        "notes": [
            "Topshiriq va Codex sonlari bu yerda 'unverified' sifatida saqlanadi; 'current' — shu audit sanog'i.",
            "Eski INCOMPLETE hisobotlar to'liqlik dalili sifatida qabul qilinmaydi.",
            "Kumulyativ oilalar (UMDAT, MIRQAT, TIBI, TUHFA, FATH) semantik taqqoslanmaguncha yig'ib qo'shilmaydi.",
            "Xesh texnik yaxlitlikni ko'rsatadi, mualliflik yoki ilmiy to'g'rilikni emas.",
        ],
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "PACKAGE-REGISTRY.json").write_text(json.dumps(
        {"generated_at": _now(), "packages": registry}, ensure_ascii=False, indent=1), "utf-8")
    (out_dir / "AUDIT-BASELINE.json").write_text(json.dumps(baseline, ensure_ascii=False, indent=1), "utf-8")
    (out_dir / "SCHEMA-PROBE.json").write_text(json.dumps(
        {"generated_at": _now(), "tsv": probes, "sqlite": sqlite_probes}, ensure_ascii=False, indent=1), "utf-8")
    (out_dir / "AUDIT-SUMMARY.md").write_text(summary_md(baseline, registry), "utf-8")
    return baseline


def summary_md(b: dict, registry: list[dict]) -> str:
    L = ["# Audit xulosasi", "", f"Sana: {b['generated_at']}", ""]
    L.append("**Kirish fayllari o'zgarmadi.**" if b["input_unchanged"] else
             f"**DIQQAT: audit davomida {len(b['input_changes_during_audit'])} ta o'zgarish ko'rildi** "
             "(boshqa dastur yozayotgan bo'lishi mumkin).")
    L += ["", "## Topshiriqdagi sonlar bilan solishtirish", "", "| Band | Topshiriq | Joriy | Natija |", "|---|---:|---:|---|"]
    for c in b["comparisons"]:
        L.append(f"| {c['item']} | {c['brief']} | {c['current']} | {c['result']} |")
    L += ["", "Eslatma: 0-Manba sonlari yangilashdan OLDINGI holat; dot-20261023 yangilanishlaridan keyin farq kutiladi.",
          "", "## ZIP arxivlar", "", f"Jami: {len(registry)}; CRC to'g'ri: {sum(1 for r in registry if r.get('crc_ok'))}", "",
          "## Topilmagan paketlar (MISSING-PACKAGES)", ""]
    for m in b["missing_packages"]:
        L.append(f"- {m['file_name']}: {'TOPILDI — ' + ', '.join(m['where']) if m['found'] else 'topilmadi'}")
    L += ["", "## Kumulyativ oilalar (yig'ib qo'shilmaydi)", ""]
    for fam, items in b["families"].items():
        L.append(f"- {fam}: " + ", ".join(f"{Path(i['file']).name}" for i in items))
    L += ["", "## Yangilash jurnallari", ""]
    for u in b["update_runs"]:
        L.append(f"- {u['path']} ({u['bytes']} bayt)")
    L += ["", f"Shaxsiy/doiradan tashqari deb belgilangan yo'llar: {b['private_or_out_of_scope_count']} "
              "(ommaviy tarqatmaga kirmaydi).", ""]
    return "\n".join(L)
