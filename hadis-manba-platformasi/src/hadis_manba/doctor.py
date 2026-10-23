"""`hadis-manba doctor` — tushunarli tilda holat tekshiruvi."""
from __future__ import annotations

import socket
import sqlite3
import sys

from . import model
from .pkgformat import sha256_file

MCP_PIN = "2.3.0"


def run(home, port: int = 8765) -> list[tuple[str, str, str]]:
    """(holat, band, izoh) ro'yxati. holat: OK | OGOHLANTIRISH | XATO"""
    out = []
    ok = lambda b, m: out.append(("OK", b, m))
    warn = lambda b, m: out.append(("OGOHLANTIRISH", b, m))
    err = lambda b, m: out.append(("XATO", b, m))

    v = sys.version_info
    (ok if v >= (3, 10) else err)("Python", f"{v.major}.{v.minor}.{v.micro} (kerak: 3.10+; sinalgan: 3.13)")
    ok("SQLite", sqlite3.sqlite_version)
    try:
        c = sqlite3.connect(":memory:")
        c.execute("CREATE VIRTUAL TABLE t USING fts5(x, tokenize='trigram')")
        ok("FTS5 trigram", "qidiruv indeksi ishlaydi")
    except sqlite3.OperationalError as e:
        err("FTS5 trigram", f"yo'q ({e}). Python/SQLite'ni yangilang (SQLite 3.34+)")
    try:
        import mcp  # noqa: F401
        from importlib.metadata import version
        mv = version("mcp")
        (ok if mv == MCP_PIN else warn)("MCP SDK", f"{mv} (pin: {MCP_PIN})")
    except Exception:  # noqa: BLE001
        warn("MCP SDK", f"o'rnatilmagan — AI ulash ixtiyoriy: pip install 'hadis-manba[mcp]' (mcp=={MCP_PIN})")

    try:
        home.ensure()
        t = home.root / ".yozish-sinovi"
        t.write_text("ok")
        t.unlink()
        ok("Ma'lumot papkasi", str(home.root))
    except OSError as e:
        err("Ma'lumot papkasi", f"yozib bo'lmadi: {e}")
        return out

    from .store import Library
    lib = Library(home)
    r = lib.con.execute("PRAGMA quick_check").fetchone()[0]
    (ok if r == "ok" else err)("Baza", f"quick_check={r}")
    pk = lib.active_packages()
    if not pk:
        warn("Paketlar", "hali hech qaysi kitob yoki sharh o'rnatilmagan (bu xato emas)")
    for p in pk:
        f = home.root / lib.con.execute(
            "SELECT stored_file FROM package_versions WHERE package_id=? AND state='active'",
            (p["package_id"],)).fetchone()[0]
        if not f.exists():
            warn(f"Paket {p['package_id']}", "saqlangan nusxa yo'q — rollback ishlamaydi")
        elif sha256_file(f) != p["sha256"]:
            err(f"Paket {p['package_id']}", "saqlangan fayl xeshi mos emas")
        else:
            m = p["manifest"]
            if m.get("schema_version", "").split(".")[0] != model.SCHEMA_VERSION.split(".")[0]:
                err(f"Paket {p['package_id']}", "sxema versiyasi mos emas")
            else:
                ok(f"Paket {p['package_id']}", f"{p['package_version']} ({p['kind']})")
    lib.close()
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", port))
        ok("Port", f"127.0.0.1:{port} bo'sh")
    except OSError:
        warn("Port", f"127.0.0.1:{port} band — `hadis-manba serve --port BOSHQA` ishlating")
    finally:
        s.close()
    return out
