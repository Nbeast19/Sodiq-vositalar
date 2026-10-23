"""Buxoriy (hj120) uchun to'liq sanad indeksi — FAQAT MAHALLIY (27-bo'lim).

Manba (foydalanuvchi 0-Manba'sida, read-only):
  raw/shamela-bukhari/pages.jsonl  — Shamela 1681 (ط السلطانية) sahifalari; roviylar <a href="inr://man-ID">, matn boshi <hadeeth-K>
  raw/task2/page_isnads.json        — (book_id, shamela_page_id, hadeeth_key) -> narrator_ids (Nabiy ﷺ tomondan kompilyatorga)
  raw/task2/narrators.json          — roviy ID -> ism
Huquq: AuthenticIlm README "Terms of use: Research and personal use" -> ommaviy qayta tarqatish tasdiqlanmagan;
natija repo tashqarisida saqlanadi va public build'ga kirmaydi (QARORLAR.md #37).

Bog'lash (raqam tengligi bilan EMAS):
  hj120 yozuvi -> paketdagi dalil: shamela-edition nomzodi (url .../book/1681/<sahifa>, number N)
  -> shu sahifadagi "N - " paragrafi -> uning <hadeeth-K> kaliti -> page_isnads(1458, sahifa, K) yo'llari
  -> paragrafdagi roviy havolalari tartibi bilan solishtiriladi -> sunnah.com matnimizda ism oraliqlari izlanadi.
`hadeeth_key` bosma raqam emas: masalan 17661 (sahifa 10, key 1 = 1-hadis) va 17713 (sahifa 104, key 1 = 54-hadis).

    python scripts/build_isnad_index.py --raw <.../hadis-raqamlar/raw> --package <hm-bukhari-hj120-*.hmz> --out <papka>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from hadis_manba.arabic import normalize  # noqa: E402

BOOK_ID = 1458          # page_isnads / Shamela4 ichki ID
COMPILER = 5495         # البخاري
AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
NUM_RE = re.compile(r"(?:^|\r)\s*([٠-٩]+)\s*-\s")
A_RE = re.compile(r'<a href="inr://man-(\d+)">(.*?)</a>', re.S)
H_RE = re.compile(r"<hadeeth-(\d+)>")
MARK_RE = re.compile("[\u064b-\u065f\u0670\u0640]")
BRANCH_RE = re.compile(r"(?:^|[\s(،,])ح(?:[\s)،,.:]|$)")   # تحويل الإسناد: alohida "ح" belgisi


def paragraphs(body: str) -> list[dict]:
    """Sahifadagi raqamlangan paragraflar: bosma raqam, roviy havolalari (matn boshigacha), hadeeth kaliti."""
    out = []
    marks = list(NUM_RE.finditer(body or ""))
    for i, m in enumerate(marks):
        seg = body[m.start(): marks[i + 1].start() if i + 1 < len(marks) else len(body)]
        h = H_RE.search(seg)
        isnad = seg[: h.start()] if h else seg
        plain = re.sub(r"<[^>]+>", " ", isnad)
        out.append({"number": int(m.group(1).translate(AR_DIGITS)), "key": int(h.group(1)) if h else None,
                    "branched": bool(BRANCH_RE.search(plain)),
                    "mentions": [(int(a), re.sub(r"<[^>]+>", "", t).strip(" ،,:")) for a, t in A_RE.findall(isnad)]})
    return out


def find_span(text: str, norm_text: str, nmap: list[int], name: str, start_at: int = 0):
    k = normalize(name).strip()
    if len(k) < 3:
        return None
    i = norm_text.find(k, start_at)
    if i < 0:
        return None
    end = nmap[i + len(k) - 1] + 1
    while end < len(text) and MARK_RE.match(text[end]):   # oxirgi harfning harakatlari ham oraliqqa kiradi
        end += 1
    return nmap[i], end, i + len(k)


def build(raw: Path, package: Path) -> dict:
    from hadis_manba.arabic import normalize_with_map
    pages = {}
    for line in (raw / "shamela-bukhari" / "pages.jsonl").read_text("utf-8").splitlines():
        p = json.loads(line)
        pages[p["shamela_page_id"]] = p
    routes = defaultdict(list)
    for r in json.loads((raw / "task2" / "page_isnads.json").read_text("utf-8")):
        if r["book_id"] == BOOK_ID:
            routes[(r["shamela_page_id"], r["hadeeth_key"])].append(r)
    names = {n["id"]: n["short_name"].strip("‌ ") for n in json.loads((raw / "task2" / "narrators.json").read_text("utf-8"))}
    z = zipfile.ZipFile(package)
    units = [json.loads(x) for x in z.read("data/units.jsonl").decode("utf-8").splitlines()]
    ev = {e["evidence_id"]: e for e in (json.loads(x) for x in z.read("data/evidence.jsonl").decode("utf-8").splitlines())}
    out, stats = {}, Counter()
    for u in units:
        stats["units"] += 1
        n0 = next((n for n in u["numbers"] if n.get("number_text")), None)
        e = ev.get((n0 or {}).get("evidence_id")) or {}
        cand = next((c for c in e.get("candidates", []) if c.get("source") == "shamela-edition" and c.get("url")), None)
        if not n0 or not cand:
            stats["no_shamela_evidence"] += 1
            continue
        page_id = int(cand["url"].rstrip("/").rsplit("/", 1)[1])
        want = [int(x) for x in str(n0["number_text"]).split(";") if x.strip().isdigit()]
        paras = [p for p in paragraphs((pages.get(page_id) or {}).get("body", "")) if p["number"] in want]
        if not paras:
            stats["paragraph_not_found"] += 1
            continue
        para = paras[0]
        rs = routes.get((page_id, para["key"])) if para["key"] is not None else None
        if not rs:
            stats["no_page_isnads_row"] += 1
            continue
        norm, nmap = normalize_with_map(u["text_ar"])
        mention_ids = [m[0] for m in para["mentions"]]
        mention_name = {m[0]: m[1] for m in para["mentions"]}
        rec_routes = []
        for r in rs:
            ids = list(reversed(r["narrator_ids"]))            # kompilyatordan Nabiy ﷺ tomonga
            assert ids[0] == COMPILER, r
            chain = ids[1:]
            # paragrafdagi havolalar tartibiga mos kelishi (subsequence) — manba ichki izchilligi
            it = iter(mention_ids)
            in_order = all(any(x == y for y in it) for x in chain)
            nodes, pos = [], 0
            for i, pid in enumerate(chain, 1):
                span = None
                for cand_name in (mention_name.get(pid), names.get(pid)):
                    if cand_name:
                        span = find_span(u["text_ar"], norm, nmap, cand_name, pos)
                        if span:
                            pos = span[2]
                            break
                nodes.append({"person": f"man-{pid}", "name_ar": names.get(pid) or mention_name.get(pid),
                              "as_written": mention_name.get(pid), "position_from_compiler": i,
                              "span": [span[0], span[1]] if span else None})
            rec_routes.append({"page_isnads_id": r["id"], "nodes": nodes, "named_narrators": len(chain),
                               "matches_page_order": in_order, "spans_found": sum(1 for x in nodes if x["span"])})
        endpoint = "prophet" if u.get("attribution_kind") == "marfu" else "not_established"
        r0 = rec_routes[0]
        reasons = []
        if len(rec_routes) > 1:
            reasons.append("several_routes_listed")
        if para["branched"]:
            reasons.append("tahwil_branch_in_page")      # ح: page_isnads faqat bitta yo'lni beradi
        if endpoint != "prophet":
            reasons.append("endpoint_not_prophet_or_unknown")
        extra = sorted({m for m in mention_ids if m != COMPILER} - {int(n["person"][4:]) for n in r0["nodes"]})
        if extra:
            reasons.append("page_links_outside_route")   # ikkinchi yo'l yoki matn ichidagi shaxs bo'lishi mumkin
        if not r0["matches_page_order"]:
            reasons.append("route_order_differs_from_page_links")
        if r0["spans_found"] != r0["named_narrators"]:
            reasons.append("names_not_all_found_in_our_text")
        status = "established_single_route" if not reasons else ("branched" if "tahwil_branch_in_page" in reasons else "partial")
        out[u["unit_id"]] = {
            "evidence": {"shamela_page_id": page_id, "printed_number": para["number"], "hadeeth_key": para["key"],
                         "shamela_url": cand["url"]},
            "routes": rec_routes, "endpoint": endpoint,
            "intermediaries": r0["named_narrators"] if not reasons else None,
            "status": status, "reasons": reasons, "page_links_outside_route": [f"man-{x}" for x in extra],
        }
        for x in reasons:
            stats["reason:" + x] += 1
        stats["mapped"] += 1
        stats["status:" + out[u["unit_id"]]["status"]] += 1
    return {"source": {"book_id": BOOK_ID, "shamela_id": 1681, "compiler_id": COMPILER,
                       "rights": "AuthenticIlm/Shamela4 — 'Research and personal use'; local only"},
            "convention": "intermediaries = named narrators on one route, excluding the compiler and the Prophet ﷺ",
            "stats": dict(stats), "units": out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, required=True)
    ap.add_argument("--package", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    if a.out.resolve().is_relative_to(ROOT.parent.resolve()):
        sys.exit("--out repo ichida bo'lmasin: indeks faqat mahalliy (QARORLAR.md #37)")
    res = build(a.raw, a.package)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "isnad-bukhari-local.json").write_text(json.dumps(res, ensure_ascii=False) + "\n", "utf-8")
    print(json.dumps(res["stats"], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
