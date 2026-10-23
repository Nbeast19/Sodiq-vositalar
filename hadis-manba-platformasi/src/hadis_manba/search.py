"""Qidiruv: aniq ibora (asl qatlam) va harakatsiz ibora (qidiruv qatlami).

Natijada har doim asl arabcha parcha ko'rsatiladi. Moslik — matn ichida
uchrashish; bu tasdiqlangan hadis identifikatsiyasi emas.
"""
from __future__ import annotations

import json

from .arabic import normalize, normalize_with_map, snippet

MAX_QUERY = 500
MAX_MATCHES = 5000


def _fts_phrase(nq: str) -> str:
    return '"' + nq.replace('"', '""') + '"'


def find(con, query: str, mode: str = "normalized", scope: str = "all", package_ids: list[str] | None = None):
    """(kind, id, [pozitsiyalar], uzunlik) ro'yxati, 'capped' belgisi va ishlatilgan so'rov."""
    if mode not in ("normalized", "exact"):
        raise ValueError("mode: normalized | exact")
    if scope not in ("all", "base", "commentary"):
        raise ValueError("scope: all | base | commentary")
    kinds = {"all": ("unit", "occurrence"), "base": ("unit",), "commentary": ("occurrence",)}[scope]
    hits = []
    if mode == "normalized":
        nq = normalize(query)
        if not nq:
            return [], False, nq
        if len(nq) >= 3:
            rows = con.execute(
                "SELECT target_id, target_kind, package_id, text_norm FROM search_fts WHERE search_fts MATCH ? "
                "LIMIT ?", (_fts_phrase(nq), MAX_MATCHES + 1)).fetchall()
        else:
            rows = con.execute(
                "SELECT target_id, target_kind, package_id, text_norm FROM search_fts WHERE instr(text_norm, ?) > 0 "
                "LIMIT ?", (nq, MAX_MATCHES + 1)).fetchall()
        for r in rows:
            if r["target_kind"] not in kinds or (package_ids is not None and r["package_id"] not in package_ids):
                continue
            positions = _all_positions(r["text_norm"], nq)
            if positions:
                hits.append((r["target_kind"], r["target_id"], positions, len(nq)))
        return hits[:MAX_MATCHES], len(rows) > MAX_MATCHES, nq
    # exact: asl matnda aynan uchrashish
    for kind, table, idcol in (("unit", "text_units", "unit_id"), ("occurrence", "commentary_occurrences", "occurrence_id")):
        if kind not in kinds:
            continue
        rows = con.execute(f"SELECT {idcol} AS id, package_id, text_ar FROM {table} "
                           f"WHERE instr(text_ar, ?) > 0 ORDER BY package_id, seq LIMIT ?",
                           (query, MAX_MATCHES + 1)).fetchall()
        for r in rows:
            if package_ids is not None and r["package_id"] not in package_ids:
                continue
            hits.append((kind, r["id"], _all_positions(r["text_ar"], query), len(query)))
    return hits[:MAX_MATCHES], len(hits) > MAX_MATCHES, query


def _all_positions(hay: str, needle: str, cap: int = 50) -> list[int]:
    out, i = [], hay.find(needle)
    while i >= 0 and len(out) < cap:
        out.append(i)
        i = hay.find(needle, i + 1)
    return out


def make_snippet(text_ar: str, start: int, length: int, mode: str) -> dict:
    if mode == "exact":
        pos_map = list(range(len(text_ar)))
        return snippet(text_ar, start, length, pos_map)
    _, pos_map = normalize_with_map(text_ar)
    return snippet(text_ar, start, length, pos_map)


def segment_role_at(segments_json: str, orig_pos: int) -> dict | None:
    for s in json.loads(segments_json):
        if s["start"] <= orig_pos < s["end"]:
            return s
    return None
