"""Mahalliy kutubxona: paketlarni o'rnatish, almashtirish, o'chirish, rollback.

Tartib: staging'ga nusxa -> to'liq tekshiruv -> bitta SQLite tranzaksiyasida
eski versiya qatorlarini o'chirib yangisini yozish. Xato bo'lsa tranzaksiya
qaytariladi va eski ishlaydigan ma'lumot o'z joyida qoladi.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import shutil
import uuid
from pathlib import Path

from . import db as _db
from .arabic import normalize
from .paths import Home
from .pkgformat import Package, PackageError, open_package, sha256_bytes


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def _j(v) -> str | None:
    return None if v is None else json.dumps(v, ensure_ascii=False, sort_keys=True)


def _b(v):
    return None if v is None else (1 if v else 0)


class Library:
    def __init__(self, home: Home | None = None):
        self.home = (home or Home()).ensure()
        self.con = _db.connect(self.home.db)

    def close(self):
        self.con.close()

    # ------------------------------------------------------------ holat
    def active_packages(self) -> list[dict]:
        rows = self.con.execute(
            "SELECT package_id, package_version, kind, sha256, manifest_json, installed_at FROM package_versions "
            "WHERE state='active' ORDER BY package_id").fetchall()
        return [dict(r, manifest=json.loads(r["manifest_json"])) for r in rows]

    def corpus_version(self) -> str:
        items = [f"{p['package_id']}@{p['package_version']}:{p['sha256']}" for p in self.active_packages()]
        return "corpus-" + hashlib.sha256("\n".join(items).encode()).hexdigest()[:16] if items else "corpus-empty"

    def journal(self, limit: int = 100) -> list[dict]:
        rows = self.con.execute("SELECT * FROM import_journal ORDER BY seq DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def _log(self, action: str, pkg_id=None, ver=None, sha=None, detail=None):
        rec = {"at": _now(), "action": action, "package_id": pkg_id, "package_version": ver, "sha256": sha,
               "detail": detail}
        self.con.execute("INSERT INTO import_journal(at, action, package_id, package_version, sha256, detail) "
                         "VALUES (?,?,?,?,?,?)", (rec["at"], action, pkg_id, ver, sha, _j(detail)))
        return rec

    def _append_file_journal(self, rec: dict):
        with open(self.home.journal, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # ------------------------------------------------------------ o'rnatish
    def install(self, path: Path | str, _action: str = "install") -> list[dict]:
        """Paketni o'rnatadi. Selection yig'masi bo'lsa ichki paketlarni ham. Natijalar ro'yxati."""
        path = Path(path)
        stage = self.home.staging / f"{uuid.uuid4().hex}.hmz"
        shutil.copyfile(path, stage)
        try:
            pkg = open_package(stage)
        except PackageError as e:
            stage.unlink(missing_ok=True)
            rec = self._log("rejected", detail={"file": path.name, "errors": e.errors[:20]})
            self._append_file_journal(rec)
            raise
        if pkg.manifest["kind"] == "selection":
            results = self._install_selection(pkg)
            stage.unlink(missing_ok=True)
            return results
        return [self._install_one(pkg, stage, _action)]

    def _install_selection(self, pkg: Package) -> list[dict]:
        inner = {n: b for n, b in pkg.files.items() if n.startswith("packages/")}
        by_sha = {sha256_bytes(b): b for b in inner.values()}
        results = []
        for c in pkg.manifest["contains"]:
            active = self._active(c["package_id"])
            if active and active["sha256"] == c["package_sha256"]:
                results.append({"package_id": c["package_id"], "package_version": c["package_version"],
                                "action": "unchanged"})
                continue
            blob = by_sha.get(c["package_sha256"])
            if blob is None:
                results.append({"package_id": c["package_id"], "package_version": c["package_version"],
                                "action": "missing_in_bundle"})
                continue
            tmp = self.home.staging / f"{uuid.uuid4().hex}.hmz"
            tmp.write_bytes(blob)
            try:
                results += self.install(tmp)
            finally:
                tmp.unlink(missing_ok=True)
        return results

    def _active(self, package_id: str):
        r = self.con.execute("SELECT * FROM package_versions WHERE package_id=? AND state='active'",
                             (package_id,)).fetchone()
        return dict(r) if r else None

    def _install_one(self, pkg: Package, stage: Path, action: str) -> dict:
        m = pkg.manifest
        pid, ver, sha = m["package_id"], m["package_version"], pkg.sha256
        active = self._active(pid)
        if active and active["sha256"] == sha:
            stage.unlink(missing_ok=True)
            return {"package_id": pid, "package_version": ver, "action": "unchanged"}
        dest_dir = self.home.packages / pid
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{ver}-{sha[:12]}.hmz"
        os.replace(stage, dest)
        stored = str(dest.relative_to(self.home.root))
        con = self.con
        con.execute("BEGIN IMMEDIATE")
        try:
            self._delete_rows(pid)
            con.execute("UPDATE package_versions SET state='superseded' WHERE package_id=? AND state='active'", (pid,))
            con.execute("DELETE FROM package_versions WHERE package_id=? AND package_version=? AND sha256=?",
                        (pid, ver, sha))
            self._insert(pkg)
            con.execute("INSERT INTO package_versions VALUES (?,?,?,?,?,?,?,?)",
                        (pid, ver, m["kind"], sha, stored, _j(m), "active", _now()))
            kind = action if not active else ("rollback" if action == "rollback" else "upgrade")
            rec = self._log(kind, pid, ver, sha, {"previous": active and active["package_version"]})
            con.execute("COMMIT")
        except Exception:
            con.execute("ROLLBACK")
            raise
        self._append_file_journal(rec)
        return {"package_id": pid, "package_version": ver, "action": kind,
                "previous_version": active and active["package_version"]}

    def _delete_rows(self, pid: str):
        for t in _db.PACKAGE_TABLES:
            self.con.execute(f"DELETE FROM {t} WHERE package_id=?", (pid,))

    def _insert(self, pkg: Package):
        m, con, pid = pkg.manifest, self.con, pkg.manifest["package_id"]
        for r in m["rights"]:
            ev = r.get("license_evidence_file")
            ev_sha = sha256_bytes(pkg.files["LICENSE"]) if ev == "LICENSE" else r.get("license_evidence_sha256")
            con.execute("INSERT INTO rights VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                pid, r["applies_to"], r["rights_status"], r.get("license_id"), r.get("license_url"), ev, ev_sha,
                r.get("license_checked_at"), _b(r.get("redistribution_allowed")), _b(r.get("commercial_use_allowed")),
                r.get("required_attribution"), r.get("share_alike_requirements"), r.get("permission_evidence")))
        e = pkg.entities
        for w in e.get("works", []):
            con.execute("INSERT INTO works VALUES (?,?,?,?,?,?,?)", (
                w["work_id"], pid, w.get("title_ar"), w.get("title_uz"), w.get("work_type"),
                _j(w.get("author_ids", [])), _j(w)))
        for p in e.get("persons", []):
            con.execute("INSERT INTO persons VALUES (?,?,?,?,?)", (p["person_id"], pid, p.get("name_ar"),
                                                                    p.get("name_uz"), _j(p)))
        for c in e.get("work_contributors", []):
            con.execute("INSERT INTO work_contributors VALUES (?,?,?,?,?)", (
                c["work_id"], c["person_id"], c["role"], c.get("evidence_id"), pid))
        for ed in e.get("editions", []):
            con.execute("INSERT INTO editions VALUES (?,?,?,?,?)", (ed["edition_id"], pid, ed["work_id"],
                                                                     ed.get("label"), _j(ed)))
        for s in e.get("sources", []):
            con.execute("INSERT INTO sources VALUES (?,?,?,?,?,?,?,?)", (
                s["source_id"], pid, s.get("edition_id"), s.get("url"), s.get("revision"), s.get("retrieved_at"),
                s.get("sha256"), _j(s)))
        for f in e.get("source_files", []):
            con.execute("INSERT INTO source_files VALUES (?,?,?,?,?,?,?,?,?)", (
                f["file_id"], pid, f.get("source_id"), f.get("path"), f.get("layer"), f.get("sha256"),
                f.get("bytes"), f.get("license_id"), _j(f)))
        for s in e.get("numbering_schemes", []):
            con.execute("INSERT INTO numbering_schemes VALUES (?,?,?,?,?,?)", (
                s["scheme_id"], pid, s.get("work_id"), s.get("edition_id"), s.get("label"), _j(s)))

        for u in pkg.jsonl("data/units.jsonl"):
            norm = normalize(u["text_ar"])
            extra = {k: u[k] for k in ("text_history",) if k in u}
            con.execute("INSERT INTO text_units VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                u["unit_id"], pid, u["work_id"], u["edition_id"], u["seq"], u["unit_type"],
                u.get("attribution_kind", "unknown"), u["text_kind"], u.get("book_label"), u.get("chapter_ar"),
                u["text_ar"], norm, u.get("raw_sha256"), u["current_text_sha256"], u["normalized_text_sha256"],
                _j(u["statuses"]), _j(u.get("limitations", [])), _j(u.get("location")), _j(extra)))
            con.execute("INSERT INTO search_fts VALUES (?,?,?,?)", (u["unit_id"], "unit", pid, norm))
            for i in u.get("identifiers", []):
                con.execute("INSERT INTO unit_identifiers VALUES (?,?,?,?,?)", (
                    u["unit_id"], i["namespace"], str(i["value"]), i.get("source_table_sha256"), pid))
            for n in u.get("numbers", []):
                con.execute("INSERT INTO number_assertions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                    n["assertion_id"], u["unit_id"], n["scheme_id"], n.get("volume"),
                    None if n.get("number_text") is None else str(n["number_text"]), n.get("number_int"),
                    n.get("variant"), n["number_status"], n.get("original_value"), n.get("reason"),
                    n.get("page_volume"), n.get("page"), n.get("printed_page_status"), n.get("evidence_id"), pid))
            for n in u.get("narrators", []):
                con.execute("INSERT INTO narrator_assertions VALUES (?,?,?,?,?,?,?,?,?,?)", (
                    n["assertion_id"], u["unit_id"], n.get("terminal_person_id"), n.get("fallback_person_id"),
                    n["narrator_identity_status"], n.get("interpretation"), n.get("original_value"),
                    n.get("reason"), n.get("evidence_id"), pid))
            for g in u.get("gradings", []):
                con.execute("INSERT INTO grading_assertions VALUES (?,?,?,?,?,?,?,?)", (
                    g["assertion_id"], u["unit_id"], g["grade"], g["scholar_person_id"], g["source_ref"],
                    g.get("scope"), g.get("evidence_id"), pid))
            for t in u.get("topics", []):
                con.execute("INSERT INTO topic_assertions VALUES (?,?,?,?,?,?)", (
                    t["assertion_id"], u["unit_id"], t["topic"], t.get("lang"), t["origin"], pid))

        for o in pkg.jsonl("data/occurrences.jsonl"):
            norm = normalize(o["text_ar"])
            con.execute("INSERT INTO commentary_occurrences VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                o["occurrence_id"], pid, o["work_id"], o["edition_id"], o["seq"], o["link_kind"],
                o["lemma_kind"], o.get("lemma_text"), o["text_ar"], norm, o["current_text_sha256"], o["scope"],
                o.get("volume"), o.get("page"), _j(o["segments"]), _j(o["statuses"]),
                _j(o.get("limitations", [])), _j(o.get("location")), None))
            con.execute("INSERT INTO search_fts VALUES (?,?,?,?)", (o["occurrence_id"], "occurrence", pid, norm))
        for l in pkg.jsonl("data/links.jsonl"):
            con.execute("INSERT INTO commentary_links VALUES (?,?,?,?,?,?,?,?,?)", (
                l["link_id"], l["occurrence_id"], l["target_work_id"], l["target_edition_id"],
                l["target_unit_id"], l["commentary_link_status"], l.get("legacy_confidence"),
                l.get("evidence_id"), pid))
        for ev in pkg.jsonl("data/evidence.jsonl"):
            con.execute("INSERT INTO evidence VALUES (?,?,?,?,?,?,?,?)", (
                ev["evidence_id"], pid, ev.get("kind"), ev.get("quote"), _j(ev.get("location")),
                ev.get("file_sha256"), ev.get("coverage"), _j(ev)))
        for p in pkg.jsonl("data/parallels.jsonl"):
            con.execute("INSERT INTO parallel_relations VALUES (?,?,?,?,?,?)", (
                p["relation_id"], p["from_unit_id"], p["to_unit_id"], p["relation_type"], p.get("evidence_id"), pid))
        for c in pkg.jsonl("data/corrections.jsonl"):
            con.execute("INSERT INTO text_corrections VALUES (?,?,?,?,?,?,?,?,?,?,?)", (
                c["correction_id"], pid, c["target_id"], _j(c.get("original_location")), c.get("before_text"),
                c.get("after_text"), c.get("reason"), c.get("evidence_edition"), c.get("evidence_page"),
                c.get("confirmation_kind"), _j(c.get("affected_links"))))
        for r in pkg.jsonl("data/reviews.jsonl"):
            con.execute("INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?)", (
                r["review_id"], pid, r["target_id"], r["review_kind"], r["status"], r.get("reviewer"),
                r.get("at"), r.get("note")))
        cov = json.loads(pkg.files["COVERAGE.json"])
        con.execute("INSERT INTO coverage VALUES (?,?,?,?)", (pid, m.get("work_id"), m.get("edition_id"), _j(cov)))

    # ------------------------------------------------------------ o'chirish va qaytarish
    def uninstall(self, package_id: str) -> dict:
        active = self._active(package_id)
        if not active:
            return {"package_id": package_id, "action": "not_installed"}
        self.con.execute("BEGIN IMMEDIATE")
        try:
            self._delete_rows(package_id)
            self.con.execute("UPDATE package_versions SET state='removed' WHERE package_id=? AND state='active'",
                             (package_id,))
            rec = self._log("remove", package_id, active["package_version"], active["sha256"])
            self.con.execute("COMMIT")
        except Exception:
            self.con.execute("ROLLBACK")
            raise
        self._append_file_journal(rec)
        return {"package_id": package_id, "action": "removed", "package_version": active["package_version"]}

    def rollback(self, package_id: str) -> dict:
        """Oxirgi o'rnatishdan oldingi versiyaga qaytaradi (jurnal bo'yicha)."""
        active = self._active(package_id)
        rows = self.con.execute(
            "SELECT * FROM package_versions WHERE package_id=? AND state!='active' ORDER BY rowid DESC",
            (package_id,)).fetchall()
        for r in rows:
            if active and r["sha256"] == active["sha256"]:
                continue
            f = self.home.root / r["stored_file"]
            if f.exists():
                res = self.install(f, _action="rollback")
                return res[0]
        return {"package_id": package_id, "action": "no_previous_version"}
