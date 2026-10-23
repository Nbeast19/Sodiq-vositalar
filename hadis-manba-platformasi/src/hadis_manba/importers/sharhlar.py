"""`manbalar/sharhlar/<kitob>/<sharh>/` -> sharh paketlari (har sharh nashri alohida).

Kirish:
  META.json       asar, muallif, nashr, manba URL, raqamlash
  MANZILLAR.tsv   (bo'lsa) ikki manzilli joriy jadval: asos matn va sharh manzili, iqtibos/sharh turi, holat
  BOGLAMA.tsv     kitob+raqam -> sharh fayl/qator (+ eski `ishonch`)
  Manzil: qator 1 dan, `*_belgi` 1 dan sanaladi (Python indeksi = belgi - 1).
  matn/*.txt, _yangilanishlar/*/matn/*.txt   sharh matni; `⟦jNN sNNNN⟧` — sahifa belgisi

Qoidalar (topshiriq 10):
- uchrashuv matni: sharh manzilidan boshlanadigan KO'RISH OYNASI (`preview_window`), keyingi uchrashuv
  boshlanishida kesiladi — keyingi hadis sharhi qo'shilmaydi; tugash chegarasi tasdiqlanmagan;
- `tekshirilmagan` (eski) qatorlar `legacy_confidence` bilan, link statusi `unreviewed`;
- mualliflik: V2 tekshirilgan qatorlarda oyna — shorih nasri (ichidagi naql ajratilmagan, cheklov bilan);
  eski qatorlarda va Tibiy sharhida `attribution_unresolved`;
- asos birlikka bog'lash: kitob + raqam -> asos kitobdagi bosma raqam (Shamoil: Sunnah raqami);
  topilmasa link yaratilmaydi (taxmin yo'q), hisobotda sanaladi;
- huquq: OpenITI -> conditional (CC BY-NC-SA 4.0); boshqa manbalar -> unknown.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

from .raqamlar import _slug, open_db

csv.field_size_limit(10**9)
PAGE_RE = re.compile(r"^⟦j(\d+) s(\d+)⟧\s*$")
WINDOW = 3000
WORK_ALIAS = {"fath-al-bari-salafiyya": "fath-al-bari"}  # bir asar, alohida nashr
UNRESOLVED_AUTHORSHIP = {"sharh-al-tibi"}  # Tibiy/Tabriziy/Ibn Hajar qatlamlari provenance'da; bu yerda ajratilmagan
HOLAT = {"tasdiqlangan": "verified", "cheklangan": "limited", "tekshirilmagan": "unreviewed"}
KEY_FIELD = {"shamail_muhammadiyah": "sunnah_no"}


def base_index(manba: Path, book: str) -> dict[str, list[str]]:
    con = open_db(manba)
    field = KEY_FIELD.get(book, "bosma_raqam")
    idx: dict[str, list[str]] = defaultdict(list)
    for rid, p in con.execute("SELECT record_id, payload FROM records WHERE book=?", (book,)):
        j = json.loads(p)
        v = str(j.get(field) or "").strip()
        for part in re.split(r"[;,]", v):
            part = part.strip()
            if part:
                idx[part].append(rid)
    con.close()
    return idx


class TextFile:
    def __init__(self, path: Path):
        self.path = path
        self.bytes = path.read_bytes()
        self.sha256 = hashlib.sha256(self.bytes).hexdigest()
        self.lines = self.bytes.decode("utf-8").split("\n")

    def window(self, line: int, char: int, stop: tuple[int, int] | None, limit: int = WINDOW):
        """(matn, oxirgi qator, kesilish sababi, kesib o'tilgan sahifalar)."""
        out, pages, n = [], [], 0
        i = line - 1
        reason = "limit"
        first = True
        while 0 <= i < len(self.lines):
            ln = self.lines[i]
            m = PAGE_RE.match(ln)
            if m:
                pages.append(f"{int(m.group(1))}:{int(m.group(2))}")
                i += 1
                continue
            start = char if first else 0
            end = len(ln)
            if stop and i + 1 == stop[0]:
                end = min(end, stop[1]) if not first else max(start, min(end, stop[1]))
            seg = ln[start:end]
            first = False
            take = seg[: max(0, limit - n)]
            out.append(take)
            n += len(take) + 1
            if stop and i + 1 == stop[0]:
                reason = "next_occurrence"
                break
            if n >= limit:
                break
            i += 1
        else:
            reason = "end_of_file"
        return "\n".join(out).strip("\n"), reason, pages


def _rights(meta: dict) -> list[dict]:
    url = str((meta.get("source") or {}).get("url") or "")
    if "OpenITI" in url:
        return [{"applies_to": a, "rights_status": "conditional", "license_id": "CC-BY-NC-SA-4.0",
                 "license_url": "https://github.com/OpenITI/documentation/blob/master/index.md",
                 "license_evidence_file": None, "license_checked_at": "2026-10-23", "redistribution_allowed": True,
                 "commercial_use_allowed": False, "required_attribution": "OpenITI corpus (" + url + ")",
                 "share_alike_requirements": "CC BY-NC-SA 4.0", "permission_evidence": None,
                 "conditional_scope_clear": True}
                for a in ("classical_body", "derived_index")] + [
            {"applies_to": "metadata", "rights_status": "approved", "license_id": "CC0-1.0", "license_url": None,
             "license_evidence_file": None, "license_checked_at": "2026-10-23", "redistribution_allowed": True,
             "commercial_use_allowed": True, "required_attribution": None, "share_alike_requirements": None,
             "permission_evidence": "loyiha yaratgan bog'lama metadata"}]
    return [{"applies_to": "classical_body", "rights_status": "unknown", "license_id": None, "license_url": url or None,
             "license_evidence_file": None, "license_checked_at": "2026-10-23", "redistribution_allowed": None,
             "commercial_use_allowed": None, "required_attribution": None, "share_alike_requirements": None,
             "permission_evidence": None}]


def _rows(d: Path) -> list[dict]:
    """MANZILLAR bo'lsa — u (BOGLAMA bilan qator bo'yicha birlashtirilgan), aks holda BOGLAMA."""
    bog = list(csv.DictReader(open(d / "BOGLAMA.tsv", encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE)) \
        if (d / "BOGLAMA.tsv").exists() else []
    if (d / "MANZILLAR.tsv").exists():
        man = list(csv.DictReader(open(d / "MANZILLAR.tsv", encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE))
        if man:
            out = []
            for r in man:
                k = int(r["boglama_qator"]) - 1
                b = bog[k] if 0 <= k < len(bog) else {}
                out.append({
                    "row": k + 1, "kitob": r["kitob"], "raqam": r["raqam"], "raqam2": r.get("raqam2") or "",
                    "file": r["sharh_fayl"], "line": int(r["sharh_qator"] or 0),
                    # `sharh_belgi` 1 dan sanaladi (tekshirildi: 1-based ofset 100% so'z boshiga tushadi)
                    "char": max(0, int(r["sharh_belgi"] or 1) - 1),
                    "jild": r["sharh_jild"], "sahifa": r["sharh_sahifa"], "manba": r["sharh_manba"],
                    "matn": {k2: r[k2] for k2 in ("matn_fayl", "matn_qator", "matn_belgi", "matn_jild",
                                                  "matn_sahifa", "matn_manba")},
                    "iqtibos_turi": r["iqtibos_turi"], "sharh_turi": r["sharh_turi"], "holat": r["holat"],
                    "lemma": b.get("hadis_boshi_ar") or "", "ishonch": b.get("ishonch"), "usul": b.get("usul"),
                    "izoh": r.get("izoh") or b.get("izoh") or "", "source_table": "MANZILLAR"})
            return out
    out = []
    for k, b in enumerate(bog):
        out.append({"row": k + 1, "kitob": b["kitob"], "raqam": b["raqam"], "raqam2": b.get("raqam2") or "",
                    "file": b["fayl"], "line": int(b["qator"] or 0), "char": 0, "jild": b.get("jild"),
                    "sahifa": b.get("sahifa"), "manba": None, "matn": None,
                    "iqtibos_turi": "tekshirilmagan", "sharh_turi": "tekshirilmagan", "holat": "tekshirilmagan",
                    "lemma": b.get("hadis_boshi_ar") or "", "ishonch": b.get("ishonch"), "usul": b.get("usul"),
                    "izoh": b.get("izoh") or "", "source_table": "BOGLAMA"})
    return out


def build_commentary(manba: Path, d: Path, out_root: Path, edition_index: dict[str, str],
                     idx_cache: dict) -> tuple[Path | None, dict]:
    meta = json.loads((d / "META.json").read_text("utf-8"))
    book, sharh = d.parent.name, d.name
    rows = _rows(d)
    info = {"book": book, "sharh": sharh, "rows": len(rows), "status_meta": meta.get("status")}
    if not rows:
        info["skipped"] = "bog'lama yo'q (META: " + str(meta.get("numbering_used") or meta.get("status"))[:120] + ")"
        return None, info
    work_slug = WORK_ALIAS.get(sharh, sharh)
    work_id = f"w-{_slug(book)}-{_slug(work_slug)}"
    ed_id = f"ed-{_slug(book)}-{_slug(sharh)}"
    pid = f"hm-sharh-{_slug(book)}-{_slug(sharh)}"
    authors = meta.get("author_ar")
    authors = authors if isinstance(authors, list) else ([authors] if authors else [])
    person_ids = [f"p-{_slug(book)}-{_slug(work_slug)}-a{i + 1}" for i in range(len(authors))]
    author_pid = person_ids[0] if person_ids else None
    base_ed = edition_index.get(book)
    if book not in idx_cache:
        idx_cache[book] = base_index(manba, book)
    bidx = idx_cache[book]
    files: dict[str, TextFile] = {}
    starts: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for r in rows:
        starts[r["file"]].append((r["line"], r["char"]))
    for f in starts:
        starts[f] = sorted(set(starts[f]))
    occs, links = [], []
    unmatched, multi = 0, 0
    for n, r in enumerate(rows, 1):
        fp = d / r["file"]
        if r["file"] not in files:
            files[r["file"]] = TextFile(fp)
        tf = files[r["file"]]
        nxt = next((s for s in starts[r["file"]] if s > (r["line"], r["char"])), None)
        text, cut, pages = tf.window(r["line"], r["char"], nxt)
        legacy = "tekshirilmagan" in (r["holat"], r["sharh_turi"], r["iqtibos_turi"])
        unresolved = legacy or sharh in UNRESOLVED_AUTHORSHIP
        oid = f"{ed_id}:o{n:05d}"
        lim = ["ko'rish oynasi: sharh tugash chegarasi tasdiqlanmagan"]
        if cut == "next_occurrence":
            lim.append("oyna keyingi bog'langan uchrashuv boshlanishida kesildi")
        if legacy:
            lim.append("eski qayta tekshirilmagan bog'lama (legacy_unreviewed); `ishonch` yangi tasdiq emas")
        elif sharh not in UNRESOLVED_AUTHORSHIP:
            lim.append("oyna shorih nasri sifatida belgilandi; ichidagi naql va muhaqqiq izohi ajratilmagan")
        if sharh in UNRESOLVED_AUTHORSHIP:
            lim.append("Tibiy/Tabriziy/Ibn Hajar qatlamlari bu yerda ajratilmagan — mualliflik aniqlanmagan")
        link_kind = r["sharh_turi"] if r["sharh_turi"] in ("mustaqil", "umumiy", "qisqa_izoh", "havola") else "tekshirilmagan"
        lemma_kind = r["iqtibos_turi"] if r["iqtibos_turi"] in ("parcha", "iqtibos_yoq", "matn_boshi", "qisqa_iqtibos") \
            else "tekshirilmagan"
        lemma = None if lemma_kind == "iqtibos_yoq" else (r["lemma"] or None)
        st = "unreviewed" if legacy else HOLAT.get(r["holat"], "unreviewed")
        if not text:
            text = ""
        seg_role = "attribution_unresolved" if unresolved else "commentator"
        segments = [{"role": seg_role, "start": 0, "end": len(text), "person_id": None if unresolved else author_pid,
                     "attribution_status": "unresolved" if unresolved else "limited"}] if text else []
        occs.append({
            "occurrence_id": oid, "seq": n, "link_kind": link_kind, "lemma_kind": lemma_kind, "lemma_text": lemma,
            "text_ar": text, "scope": "preview_window", "volume": r["jild"] or None, "page": r["sahifa"] or None,
            "segments": segments,
            "statuses": {"commentary_link_status": st, "commentary_start_status": "limited" if legacy else st,
                         "commentary_end_status": "unreviewed", "text_preservation_status": "unreviewed",
                         "printed_page_status": "unreviewed" if r["sahifa"] else "not_found",
                         "semantic_review_status": "unreviewed", "transport_integrity": "verified"},
            "limitations": lim,
            "location": {"file": r["file"], "file_sha256": tf.sha256, "line": r["line"], "char": r["char"],
                         "cut": cut, "pages_crossed": pages[:20], "source_ref": r["manba"],
                         "base_text_location": r["matn"], "table": r["source_table"], "table_row": r["row"],
                         "usul": r["usul"], "izoh": (r["izoh"] or "")[:600]},
        })
        targets = bidx.get(r["raqam"].strip(), []) if r["kitob"] == book else []
        if not targets:
            unmatched += 1
            occs[-1]["limitations"].append(f"asos birlik topilmadi: {r['kitob']} {r['raqam']} — bog'lama yaratilmadi")
            continue
        if len(targets) > 1:
            multi += 1
        for k, t in enumerate(targets):
            links.append({"link_id": f"{oid}#l{k}", "occurrence_id": oid, "target_work_id": f"w-{_slug(book)}",
                          "target_edition_id": base_ed, "target_unit_id": f"{base_ed}:{t}",
                          "commentary_link_status": st if len(targets) == 1 else ("limited" if st == "verified" else st),
                          "legacy_confidence": r["ishonch"] if legacy else None, "evidence_id": None,
                          "printed_number": r["raqam"], "candidates": len(targets)})
    out = out_root / pid
    if out.exists():
        shutil.rmtree(out)
    (out / "data").mkdir(parents=True)
    ed_meta = meta.get("edition") or {}
    manifest = {
        "package_id": pid, "kind": "commentary", "package_version": "1.0.0", "schema_version": "1.0.0",
        "work_id": work_id, "edition_id": ed_id, "source_revision": "dot-20261023-04",
        "title": {"ar": meta.get("title_ar"), "uz": f"{meta.get('title_ar')} ({ed_id})",
                  "en": sharh.replace("-", " ").title() + (" (Salafiyya ed.)" if sharh.endswith("salafiyya") else "")},
        "names": [sharh, sharh.replace("-", " "), work_slug.replace("-", " ")], "names_origin": "slug",
        "author_ids": person_ids,
        "source_metadata": [{"source_id": f"src-{ed_id}", **{k: (meta.get("source") or {}).get(k)
                                                            for k in ("url", "dataset_id", "downloaded", "sha256")}}],
        "attribution": "Sharh matni: " + str((meta.get("source") or {}).get("url")) +
                       "; bog'lamalar: foydalanuvchi loyihasi 0-Manba (dot-20261023-04)",
        "rights": _rights(meta), "compatible_app_versions": ">=0.1.0", "normalization_version": "ar-search-v1",
        "requires_for_linked_reading": [{"target_work_id": f"w-{_slug(book)}", "target_edition_id": base_ed,
                                         "compatible_package_versions": ["1.*"],
                                         "numbering": meta.get("numbering_used")}],
    }
    entities = {
        "works": [{"work_id": work_id, "title_ar": meta.get("title_ar"), "title_uz": None, "work_type": "commentary",
                   "author_ids": person_ids, "commentary_on": f"w-{_slug(book)}",
                   "author_death_hijri": meta.get("author_death_hijri"), "madhhab": meta.get("madhhab")}],
        "persons": [{"person_id": p, "name_ar": a, "name_uz": None} for p, a in zip(person_ids, authors)],
        "work_contributors": [{"work_id": work_id, "person_id": p, "role": "commentator"} for p in person_ids],
        "editions": [{"edition_id": ed_id, "work_id": work_id,
                      "label": "; ".join(str(x) for x in (ed_meta.get("publisher"), ed_meta.get("place"),
                                                         ed_meta.get("year")) if x) or None,
                      "muhaqqiq": ed_meta.get("muhaqqiq"), "volumes": (len(ed_meta["volumes"]) if isinstance(ed_meta.get("volumes"), list)
                                  else ed_meta.get("volumes")),
                      "notes": meta.get("notes")}],
        "sources": [{"source_id": f"src-{ed_id}", "edition_id": ed_id, "url": (meta.get("source") or {}).get("url"),
                     "revision": (meta.get("source") or {}).get("dataset_id"),
                     "retrieved_at": (meta.get("source") or {}).get("downloaded"),
                     "sha256": (meta.get("source") or {}).get("sha256")}],
        "source_files": [{"file_id": f"f-{ed_id}-{i}", "source_id": f"src-{ed_id}", "path": f, "layer": "derived",
                          "sha256": tf.sha256, "bytes": len(tf.bytes)} for i, (f, tf) in enumerate(sorted(files.items()))],
    }
    (out / "package.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
    lic = "\n".join(f"{r['applies_to']}: {r['rights_status']} {r.get('license_id') or ''}" for r in manifest["rights"])
    (out / "LICENSE").write_text(lic + "\n", "utf-8")
    (out / "ATTRIBUTION").write_text(manifest["attribution"] + "\n", "utf-8")
    (out / "COVERAGE.json").write_text(json.dumps({"rows": len(rows), "unmatched_to_base": unmatched,
                                                   "multi_candidate": multi, "denominator": None,
                                                   "status_meta": meta.get("status")}, ensure_ascii=False), "utf-8")
    (out / "data" / "entities.json").write_text(json.dumps(entities, ensure_ascii=False), "utf-8")
    with open(out / "data" / "occurrences.jsonl", "w", encoding="utf-8") as fh:
        for o in occs:
            fh.write(json.dumps(o, ensure_ascii=False) + "\n")
    with open(out / "data" / "links.jsonl", "w", encoding="utf-8") as fh:
        for l in links:
            fh.write(json.dumps(l, ensure_ascii=False) + "\n")
    info.update({"occurrences": len(occs), "links": len(links), "unmatched_to_base": unmatched,
                 "multi_candidate": multi})
    return out, info


def build_all(manba: Path, out_root: Path, edition_index: dict[str, str]):
    root = manba / "manbalar" / "sharhlar"
    cache: dict = {}
    for d in sorted(p for p in root.glob("*/*/") if not p.parent.name.startswith("_") and (p / "META.json").exists()):
        src, info = build_commentary(manba, d, out_root, edition_index, cache)
        if src is None:
            print(f"--  {d.parent.name}/{d.name}: {info.get('skipped')}", flush=True)
            continue
        yield src, info
