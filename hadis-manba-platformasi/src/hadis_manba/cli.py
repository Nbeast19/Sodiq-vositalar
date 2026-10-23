"""hadis-manba buyruqlari. `hadis-manba --help` bilan ro'yxatni ko'ring."""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path

from . import model
from .paths import Home


def _out(obj, fmt: str = "json"):
    if fmt == "json":
        print(json.dumps(obj, ensure_ascii=False, indent=1))
    elif fmt == "tsv":
        rows = obj.get("results", []) if isinstance(obj, dict) else obj
        buf = io.StringIO()
        w = csv.writer(buf, delimiter="\t", lineterminator="\n")
        cols = ["kind", "id", "work_id", "edition_id", "numbers", "text", "statuses", "limitations"]
        w.writerow(cols)
        for r in rows:
            w.writerow([
                r.get("kind", "unit"), r.get("unit_id") or r.get("occurrence_id"),
                (r.get("work") or {}).get("work_id"), r.get("edition_id"),
                "; ".join(f"{n.get('scheme_id')}={n.get('number_text')}" for n in r.get("numbers", [])),
                (r.get("snippet") or {}).get("text") or r.get("text_ar", ""),
                json.dumps(r.get("statuses", {}), ensure_ascii=False),
                " | ".join(r.get("limitations", [])),
            ])
        sys.stdout.write(buf.getvalue())
    else:
        if isinstance(obj, dict) and obj.get("error"):
            print(f"XATO [{obj['error']['code']}]: {obj['error']['message']}")
            return
        for r in obj.get("results", []):
            if "citation" in r:
                print(r["citation"])
                continue
            ident = r.get("unit_id") or r.get("occurrence_id") or r.get("package_id")
            text = (r.get("snippet") or {}).get("text") or r.get("text_ar") or ""
            print(f"— {ident}  {(r.get('work') or {}).get('title_ar') or ''}")
            if text:
                print(f"  {text}")
        for l in obj.get("limitations", []):
            print(f"  ! {l}")


def _core(args):
    from .core import Core
    from .store import Library
    return Core(Library(Home(args.home) if args.home else Home()))


def main(argv=None):
    ap = argparse.ArgumentParser(prog="hadis-manba", description="Hadis Manba — mahalliy hadis manbalari vositasi")
    ap.add_argument("--home", help="ma'lumot papkasi (standart: OS foydalanuvchi papkasi yoki HADIS_MANBA_HOME)")
    ap.add_argument("--version", action="version", version=model.APP_VERSION)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("audit", help="ZIPLAR/0-Manba'ni faqat o'qib audit qilish")
    p.add_argument("--zips")
    p.add_argument("--manba")
    p.add_argument("--out", required=True)
    p.add_argument("--no-hash", action="store_true", help="SHA-256 hisoblanmasin (tezroq, lekin dalil zaif)")
    p.add_argument("--post-hash", choices=("full", "stat"), default="full")

    p = sub.add_parser("build-package", help="manba papkasidan .hmz paket yasash")
    p.add_argument("src", nargs="+")
    p.add_argument("--out", default="dist")

    p = sub.add_parser("verify", help=".hmz paketni tekshirish")
    p.add_argument("files", nargs="+")

    p = sub.add_parser("install", help="paket(lar)ni o'rnatish")
    p.add_argument("files", nargs="+")
    p = sub.add_parser("uninstall", help="paketni o'chirish")
    p.add_argument("package_id")
    p = sub.add_parser("rollback", help="oldingi versiyaga qaytish")
    p.add_argument("package_id")
    sub.add_parser("list", help="o'rnatilgan paketlar")
    p = sub.add_parser("journal", help="import jurnali")
    p.add_argument("--limit", type=int, default=50)

    fmt = dict(choices=("text", "json", "tsv"), default="text")
    p = sub.add_parser("search", help="arabcha qidiruv")
    p.add_argument("query")
    p.add_argument("--mode", choices=("normalized", "exact"), default="normalized")
    p.add_argument("--scope", choices=("all", "base", "commentary"), default="all")
    p.add_argument("--book", action="append")
    p.add_argument("--author")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--cursor")
    p.add_argument("--format", **fmt)

    p = sub.add_parser("get", help="matn birligini ochish")
    p.add_argument("unit_id")
    p.add_argument("--format", **dict(fmt, default="json"))
    p = sub.add_parser("resolve", help="kitob + raqam")
    p.add_argument("book_id")
    p.add_argument("number")
    p.add_argument("--scheme")
    p.add_argument("--volume")
    p.add_argument("--variant")
    p.add_argument("--format", **dict(fmt, default="json"))
    p = sub.add_parser("commentary", help="hadis sharhlari yoki bitta uchrashuv")
    p.add_argument("unit_id", nargs="?")
    p.add_argument("--occurrence")
    p.add_argument("--work")
    p.add_argument("--max-chars", type=int)
    p.add_argument("--format", **dict(fmt, default="json"))
    p = sub.add_parser("cite", help="iqtibos kartasi")
    p.add_argument("id")
    p = sub.add_parser("coverage", help="qamrov")
    p.add_argument("work_id")
    p.add_argument("--edition")
    p = sub.add_parser("export", help="birlik yoki sharhni JSON/TSV qilib eksport (MCP'siz AI uchun)")
    p.add_argument("id")
    p.add_argument("--format", choices=("json", "tsv"), default="json")

    p = sub.add_parser("build-public", help="faqat ruxsatli paketlardan ommaviy katalog")
    p.add_argument("files", nargs="+")
    p.add_argument("--out", required=True)

    p = sub.add_parser("doctor", help="tekshiruv")
    p.add_argument("--port", type=int, default=8765)
    p = sub.add_parser("serve", help="mahalliy xizmat (127.0.0.1)")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--web", help="PWA papkasi (masalan web/)")
    sub.add_parser("mcp", help="MCP server (STDIO)")

    args = ap.parse_args(argv)
    home = Home(args.home) if args.home else Home()

    if args.cmd == "audit":
        from .audit import run_audit
        b = run_audit(args.zips, args.manba, Path(args.out), hashing=not args.no_hash, post_hash=args.post_hash)
        print(f"Audit tayyor: {args.out}")
        print("Kirish fayllari o'zgarmadi." if b["input_unchanged"] else "DIQQAT: audit davomida kirish o'zgardi!")
        for c in b["comparisons"]:
            print(f"  {c['result']:>12}  {c['item']}: topshiriq={c['brief']} joriy={c['current']}")
        return 0
    if args.cmd == "build-package":
        from .pkgformat import build_package
        for s in args.src:
            print(build_package(Path(s), Path(args.out)))
        return 0
    if args.cmd == "verify":
        from .pkgformat import PackageError, open_package
        rc = 0
        for f in args.files:
            try:
                pkg = open_package(Path(f))
                print(f"OK  {f}  {pkg.manifest['package_id']}@{pkg.manifest['package_version']}  sha256={pkg.sha256}")
            except PackageError as e:
                rc = 1
                print(f"XATO {f}")
                for x in e.errors:
                    print(f"   - {x}")
        return rc
    if args.cmd in ("install", "uninstall", "rollback", "list", "journal"):
        from .pkgformat import PackageError
        from .store import Library
        lib = Library(home)
        if args.cmd == "install":
            rc = 0
            for f in args.files:
                try:
                    for r in lib.install(Path(f)):
                        print(f"{r['action']:>10}  {r['package_id']}@{r['package_version']}")
                except PackageError as e:
                    rc = 1
                    print(f"RAD ETILDI {f}: " + "; ".join(e.errors[:5]))
            return rc
        if args.cmd == "uninstall":
            print(lib.uninstall(args.package_id))
        elif args.cmd == "rollback":
            print(lib.rollback(args.package_id))
        elif args.cmd == "list":
            for p in lib.active_packages():
                print(f"{p['package_id']}@{p['package_version']}  {p['kind']}  {p['sha256'][:12]}")
            print(f"korpus: {lib.corpus_version()}")
        else:
            for j in lib.journal(args.limit):
                print(f"{j['seq']:>5} {j['at']} {j['action']:>9} {j['package_id']}@{j['package_version']}")
        return 0
    if args.cmd == "build-public":
        from .publish import build_public
        rep = build_public([Path(f) for f in args.files], Path(args.out))
        for k, v in rep.items():
            print(f"{k}: {len(v)}")
            for x in v:
                print(f"   {x}")
        return 0
    if args.cmd == "doctor":
        from .doctor import run
        worst = 0
        for st, band, izoh in run(home, args.port):
            worst = max(worst, {"OK": 0, "OGOHLANTIRISH": 0, "XATO": 1}[st])
            print(f"[{st}] {band}: {izoh}")
        return worst
    if args.cmd == "serve":
        from .server import serve
        print(f"http://127.0.0.1:{args.port}/  (to'xtatish: Ctrl+C)")
        serve(home, args.port, Path(args.web) if args.web else None)
        return 0
    if args.cmd == "mcp":
        from .mcp_server import main as mcp_main
        mcp_main(home)
        return 0

    core = _core(args)
    if args.cmd == "search":
        env = core.call("search_hadith", query=args.query, book_ids=args.book, cursor=args.cursor, limit=args.limit,
                        filters={"mode": args.mode, "scope": args.scope, **({"author_id": args.author} if args.author else {})})
        _out(env, args.format)
    elif args.cmd == "get":
        _out(core.call("get_hadith", unit_id=args.unit_id), args.format)
    elif args.cmd == "resolve":
        _out(core.call("resolve_reference", book_id=args.book_id, number=args.number, scheme_id=args.scheme,
                       volume=args.volume, variant=args.variant), args.format)
    elif args.cmd == "commentary":
        _out(core.call("get_commentary", hadith_unit_id=args.unit_id, occurrence_id=args.occurrence,
                       commentary_work_id=args.work, max_chars=args.max_chars), args.format)
    elif args.cmd == "cite":
        _out(core.call("get_citation", unit_id_or_occurrence_id=args.id), "text")
    elif args.cmd == "coverage":
        _out(core.call("get_coverage", work_id=args.work_id, edition_id=args.edition), "json")
    elif args.cmd == "export":
        env = core.call("get_hadith", unit_id=args.id)
        if env.get("error") and env["error"]["code"] == "not_found":
            env = core.call("get_commentary", occurrence_id=args.id)
        _out(env, args.format)
    return 0


if __name__ == "__main__":
    sys.exit(main())
