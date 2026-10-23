"""Manzil qulfi: qator/belgi koordinatasi joriy fayl xeshi bilan bog'langan (10-bo'lim)."""
from __future__ import annotations

import hashlib


def check_location(location: dict, file_bytes: bytes, expected_text: str | None = None) -> dict:
    """Manzil hali yaroqlimi? Fayl xeshi o'zgargan bo'lsa — 'stale_hash'."""
    actual = hashlib.sha256(file_bytes).hexdigest()
    if location.get("file_sha256") and location["file_sha256"] != actual:
        return {"status": "stale_hash", "expected": location["file_sha256"], "actual": actual,
                "message": "fayl o'zgargan — eski qator/belgi manzili yaroqsiz, qayta bog'lash kerak"}
    lines = file_bytes.decode("utf-8").split("\n")
    a, b = location.get("line_start"), location.get("line_end", location.get("line_start"))
    if a is None or a < 0 or b >= len(lines):
        return {"status": "out_of_range"}
    if expected_text is not None:
        chunk = "\n".join(lines[a:b + 1])
        if expected_text not in chunk:
            return {"status": "text_mismatch"}
    return {"status": "valid", "sha256": actual}
