"""Buxoriy (hj120) uchun MAHALLIY qatlam paketi: Kitob → Bob tuzilmasi, bob kirishlari, sanad yo'llari va roviylar.

Faqat foydalanuvchi qurilmasida o'rnatiladi (QARORLAR.md #37, #38). Manba — AuthenticIlm Shamela 4 nusxasi
("Terms of use: Research and personal use"), shuning uchun natija repo, Release yoki saytga qo'shilmaydi.

Kirish (read-only):
  raw/shamela-bukhari/pages.jsonl   Shamela 1681 (ط السلطانية) sahifalari
  raw/task2/page_isnads.json        (book_id, shamela_page_id, hadeeth_key) -> roviylar yo'li
  raw/task2/narrators.json          roviy ID -> ism, tarjimai hol, olimlar so'zlari
  hm-bukhari-hj120-*.hmz            asosiy paket (birliklar, dalil: Shamela sahifa + bosma raqam)
  [ixtiyoriy] --uz-draft            dizayn namunasidagi O'zbek tahririy qoralama (tekshirilmagan)

Qoidalar:
- Sarlavha faqat manbadagi satr: `<span data-type=title id=toc-N>` yoki toc raqami tushib qolgan oraliqda
  `باب/كتاب` bilan boshlangan satr (oraliqdagi yetishmagan toc soni topilgan satrlar soniga teng bo'lsa — dalilli).
  Teng bo'lmasa satr "tekshirilmagan sarlavha" deb belgilanadi. Hech qanday sarlavha, raqam yoki mansublik yaratilmaydi.
- Bob raqami berilmaydi: faqat manbadagi tartib (`order`).
- Hadis bobga faqat dalil orqali biriktiriladi: paketdagi Shamela sahifasi + shu sahifadagi bosma raqamli paragraf.
  Topilmasa — "bobi aniqlanmagan".
- Roviy oralig'i: paragrafdagi BARCHA sanad havolalari tartibida ketma-ket qidiriladi (oldingi ism tugagan joydan),
  shuning uchun to'liq nasab ichidagi ism keyingi roviy deb belgilanmaydi (T01, 601-hadis).

    python scripts/build_overlay.py --raw <.../hadis-raqamlar/raw> --package <hm-bukhari-hj120-1.0.1.hmz> --out <papka> [--uz-draft <json>]
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))
from hadis_manba.arabic import NORMALIZATION_VERSION, normalize, normalize_with_map  # noqa: E402
from build_isnad_index import BOOK_ID, COMPILER, paragraphs  # noqa: E402

OVERLAY_ID = "hm-overlay-bukhari-structure-isnad"
OVERLAY_VERSION = "0.1.0"
SCHEMA = "1.0"
AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
TITLE_RE = re.compile(r"<span data-type=['\"]title['\"] id=['\"]?toc-(\d+)['\"]?>(.*?)</span>", re.S)
TAG_RE = re.compile(r"<[^>]+>")
MARKS = re.compile("[ً-ٰٟـ]")
HEAD_WORD = re.compile(r"^(?:باب|كتاب|أبواب|ابواب)(?:\s|:|$)")
PARA_RE = re.compile(r"^\s*([٠-٩]+)\s*-\s")
KITAB_WORD = re.compile(r"^(?:كتاب|أبواب|ابواب)(?:\s|$)")
# toc raqamisiz sarlavha span'i — Shamela'da nashrning old qismi bo'limlari ("(هذا نص التقرير)", "مقدمة"); bob emas
FRONT_TITLE_RE = re.compile(r"<span data-type=['\"]title['\"]\s*>(.*?)</span>", re.S)
BISM = {"﷽", "بسم الله الرحمن الرحيم"}


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def plain(s: str) -> str:
    return TAG_RE.sub("", s).replace(" ", " ").strip()


def load_pages(raw: Path) -> list[dict]:
    rows = [json.loads(x) for x in (raw / "shamela-bukhari" / "pages.jsonl").read_text("utf-8").splitlines() if x.strip()]
    rows.sort(key=lambda p: p["shamela_page_id"])
    return rows


def scan(pages: list[dict]) -> list[dict]:
    """Sahifalarni satrlarga bo'lib, hujjat tartibidagi hodisalar: heading / para / text."""
    ev = []
    for pi, p in enumerate(pages):
        body = p.get("body") or ""
        # sarlavha span'i bir necha satrga bo'lingan bo'lishi mumkin (ichida bosma sahifa belgisi ⦗…⦘) — bitta satr qilinadi
        flat = TITLE_RE.sub(lambda m: re.sub(r"\s*\r+\s*", " ", m.group(0)), body)
        for li, line in enumerate(flat.split("\r")):
            pos = {"pi": pi, "li": li, "page": p["shamela_page_id"], "part": p.get("part"), "page_num": p.get("page_num"),
                   "body_sha256": sha(body.encode("utf-8"))}   # xesh — o'zgartirilmagan asl body
            m = TITLE_RE.search(line)
            text = plain(line)
            if m:
                tagged = plain(m.group(2))
                ev.append({"t": "head", "toc": int(m.group(1)), "tagged": tagged, "text": text, "evidence": "toc_tag", **pos})
                continue
            if not text:
                continue
            pm = PARA_RE.match(text)
            if pm:
                ev.append({"t": "para", "number": int(pm.group(1).translate(AR_DIGITS)), "text": text, **pos})
                continue
            bare = MARKS.sub("", text)
            if HEAD_WORD.match(bare):
                ev.append({"t": "head", "toc": None, "tagged": None, "text": text, "evidence": "line_pattern", **pos})
                continue
            ev.append({"t": "text", "text": text, "front_title": bool(FRONT_TITLE_RE.search(line)), **pos})
    return ev


def is_bism(text: str) -> bool:
    return MARKS.sub("", text).strip() in BISM


def opening_blocks(preface: list[dict]) -> list[dict]:
    """Birinchi raqamli hadisdan oldingi manba matnini manbadagi belgilar bo'yicha bo'laklash.

    Yangi bo'lak: toc'siz sarlavha span'i, Shamela `part` o'zgarishi yoki sahifa boshidagi alohida ﷽ satri.
    `part == "المقدمة"` yoki toc'siz sarlavha bilan boshlangan bo'lak — nashrning old qismi (muallif matni emas).
    """
    blocks = []
    for blk in preface:
        front_title = blk.pop("front_title", False)
        if (not blocks or front_title or blk["part"] != blocks[-1]["source"]["part"]
                or (blk["line"] == 0 and is_bism(blk["text_ar"]))):
            front = blk["part"] == "المقدمة" or front_title
            blocks.append({"title_ar": blk["text_ar"] if front_title else None,
                           "evidence": "edition_front_matter" if front else "source_opening_before_first_hadith",
                           "front_matter": front, "source": {"page": blk["page"], "part": blk["part"], "line": blk["line"]}, "intro": []})
            if front_title:
                continue    # sarlavha satri title_ar'da (manba joyi source'da)
        blocks[-1]["intro"].append(blk)
    return blocks


def verify_untagged(ev: list[dict]) -> Counter:
    """Toc raqami tushib qolgan oraliqdagi belgisiz sarlavhalarni dalil bilan tasdiqlash."""
    st = Counter()
    heads = [e for e in ev if e["t"] == "head"]
    prev, between = None, []
    for e in heads:
        if e["toc"] is None:
            between.append(e)
            continue
        if prev is not None:
            missing = e["toc"] - prev["toc"] - 1
            if missing >= 0 and missing == len(between):
                for b in between:
                    b["evidence"] = "toc_gap"
                st["gaps_matched"] += 1
                st["untagged_verified"] += len(between)
            else:
                for b in between:
                    b["evidence"] = "line_pattern_unverified"
                st["gaps_unmatched"] += 1
                st["toc_ids_without_text"] += max(missing - len(between), 0)
                st["untagged_unverified"] += len(between)
        else:
            for b in between:
                b["evidence"] = "line_pattern_unverified"
            st["untagged_unverified"] += len(between)
        prev, between = e, []
    for b in between:
        b["evidence"] = "line_pattern_unverified"
        st["untagged_unverified"] += len(between)
    return st


def load_package(path: Path):
    z = zipfile.ZipFile(path)
    data = path.read_bytes()
    units = [json.loads(x) for x in z.read("data/units.jsonl").decode("utf-8").splitlines() if x.strip()]
    ev = {e["evidence_id"]: e for e in (json.loads(x) for x in z.read("data/evidence.jsonl").decode("utf-8").splitlines() if x.strip())}
    manifest = json.loads(z.read("package.json"))
    units.sort(key=lambda u: u["seq"])
    return units, ev, manifest, sha(data)


def shamela_ref(u: dict, ev: dict):
    n0 = next((n for n in u.get("numbers") or [] if n.get("number_text")), None)
    e = ev.get((n0 or {}).get("evidence_id")) or {}
    cand = next((c for c in e.get("candidates", []) if c.get("source") == "shamela-edition" and c.get("url")), None)
    if not n0 or not cand:
        return None
    nums = [int(x) for x in str(n0["number_text"]).split(";") if x.strip().isdigit()]
    return {"page": int(cand["url"].rstrip("/").rsplit("/", 1)[1]), "numbers": nums, "url": cand["url"]}


def align_mentions(text: str, anchors: list[tuple[int, str]]):
    """Sanad havolalarini bizning matnda ketma-ket topish. Har havola oldingisi tugagan joydan izlanadi."""
    norm, nmap = normalize_with_map(text)
    out, cur = [], 0
    for pid, name in anchors:
        k = normalize(name).strip(" ،,:")
        span = None
        if len(k) >= 2:
            i = norm.find(k, cur)
            while i >= 0:
                before = norm[i - 1] if i > 0 else " "
                after = norm[i + len(k)] if i + len(k) < len(norm) else " "
                ok_b = before == " " or (before == "و" and (i < 2 or norm[i - 2] == " "))
                ok_a = not ("ء" <= after <= "ي")
                if ok_b and ok_a:
                    s = nmap[i]
                    e = nmap[i + len(k) - 1] + 1
                    while e < len(text) and MARKS.match(text[e]):
                        e += 1
                    if before == "و" and ok_b and norm[i - 1] == "و":
                        pass
                    span = [s, e]
                    cur = i + len(k)
                    break
                i = norm.find(k, i + 1)
        out.append({"person": pid, "as_written": name.strip(" ،,:"), "span": span})
    return out


SAMPLE_KITAB_NAMES = {"iman": {"uz": "Imon kitobi", "en": "Book of Belief"}, "ilm": {"uz": "Ilm kitobi", "en": "Book of Knowledge"}}


def build(raw: Path, package: Path, uz_draft: Path | None = None) -> dict:
    pages = load_pages(raw)
    ev = scan(pages)
    head_stats = verify_untagged(ev)
    units, evidence, base_manifest, base_sha = load_package(package)
    by_uid = {u["unit_id"]: u for u in units}

    # Kitob: paketdagi chapter_ar guruhlari (manba: sunnah.com/hadith-json), paket tartibida.
    kitabs, kidx = [], {}
    for u in units:
        ch = u.get("chapter_ar") or ""
        if not kitabs or kitabs[-1]["title_ar"] != ch:
            kitabs.append({"id": f"k{len(kitabs) + 1}", "order": len(kitabs) + 1, "title_ar": ch, "unit_ids": [],
                           "source": "package chapter_ar (hadith-json 1.2.0 / sunnah.com)"})
        kitabs[-1]["unit_ids"].append(u["unit_id"])
        kidx[u["unit_id"]] = kitabs[-1]["id"]

    # Paragraf (sahifa, raqam) -> hodisa indeksi
    para_at = {}
    for i, e in enumerate(ev):
        if e["t"] == "para":
            para_at.setdefault((e["page"], e["number"]), i)
    unit_pos, st = {}, Counter()
    for u in units:
        ref = shamela_ref(u, evidence)
        if not ref:
            st["unit_no_shamela_evidence"] += 1
            continue
        i = next((para_at[(ref["page"], n)] for n in ref["numbers"] if (ref["page"], n) in para_at), None)
        if i is None:
            st["unit_paragraph_not_found"] += 1
            continue
        unit_pos[u["unit_id"]] = i

    # Sarlavhalar -> boblar (Kitob sarlavhalari alohida), kirish matni — keyingi sarlavha yoki paragrafgacha.
    babs, shamela_kitabs = [], []
    cur_bab, cur_kit, intro_open = None, None, None
    preface = []    # birinchi raqamli hadisdan oldingi manba matni (nashr old qismi + Vahiy boshi); hadis davomi satrlari emas
    preface_open = True
    carry = []      # Kitob sarlavhasidan bevosita oldingi ﷽ — o'sha Kitobga tegishli (manbadagi qo'shnilik)
    for i, e in enumerate(ev):
        if e["t"] == "head":
            src = {k: e[k] for k in ("page", "part", "page_num", "body_sha256")} | {"line": e["li"]}
            if KITAB_WORD.match(MARKS.sub("", e["text"])):
                cur_kit = {"id": f"sk{len(shamela_kitabs) + 1}", "title_ar": e["text"], "toc": e["toc"], "evidence": e["evidence"],
                           "source": src, "ev_index": i, "intro": carry}
                carry = []
                shamela_kitabs.append(cur_kit)
                intro_open = cur_kit
                cur_bab = None
                continue
            cur_bab = {"id": f"b{len(babs) + 1}", "order": len(babs) + 1, "title_ar": e["text"], "title_tagged": e["tagged"],
                       "toc": e["toc"], "evidence": e["evidence"], "source": src, "ev_index": i, "intro": [],
                       "shamela_kitab": cur_kit["id"] if cur_kit else None, "unit_ids": []}
            babs.append(cur_bab)
            intro_open = cur_bab
        elif e["t"] == "para":
            intro_open = None
            preface_open = False
        elif e["t"] == "text":
            blk = {"text_ar": e["text"], "page": e["page"], "part": e["part"], "page_num": e["page_num"], "line": e["li"]}
            nxt = ev[i + 1] if i + 1 < len(ev) else None
            if is_bism(e["text"]) and nxt and nxt["t"] == "head" and KITAB_WORD.match(MARKS.sub("", nxt["text"])):
                carry.append({**blk, "placement": "bismillah_before_kitab_heading"})
            elif intro_open is not None:
                intro_open["intro"].append(blk)
            elif cur_bab is None and cur_kit is None and preface_open:
                preface.append({**blk, "front_title": e.get("front_title", False)})

    # Hadis -> bob (hujjat pozitsiyasi bo'yicha oxirgi sarlavha)
    bab_starts = [b["ev_index"] for b in babs]
    import bisect
    unit_bab, kitab_opening = {}, []
    for uid, i in unit_pos.items():
        j = bisect.bisect_right(bab_starts, i) - 1
        if j < 0:
            st["unit_kitab_opening_no_bab"] += 1     # birinchi sarlavhadan oldin (Vahiy boshi)
            kitab_opening.append(uid)
            continue
        # bob va hadis o'rtasida Kitob sarlavhasi bo'lsa — hadis yangi Kitob boshida, bob sarlavhasisiz
        b = babs[j]
        if any(k["ev_index"] > b["ev_index"] and k["ev_index"] < i for k in shamela_kitabs):
            st["unit_kitab_opening_no_bab"] += 1
            kitab_opening.append(uid)
            continue
        unit_bab[uid] = b["id"]
        b["unit_ids"].append(uid)

    # Bob -> paketdagi Kitob: o'z hadislari bo'yicha; hadissiz bob — Shamela Kitob bo'limi orqali.
    sk_votes = defaultdict(Counter)
    for b in babs:
        for uid in b["unit_ids"]:
            if b["shamela_kitab"]:
                sk_votes[b["shamela_kitab"]][kidx[uid]] += 1
    for b in babs:
        votes = Counter(kidx[u] for u in b["unit_ids"])
        if votes:
            k, n = votes.most_common(1)[0]
            b["kitab_id"] = k
            b["kitab_basis"] = "own_hadiths" if n == sum(votes.values()) else "own_hadiths_mixed"
            if n != sum(votes.values()):
                st["bab_hadiths_in_two_kitabs"] += 1
        else:
            b["kitab_id"] = None
            b["kitab_basis"] = None
    # hadissiz boblar: oldingi va keyingi hadisli bob bir Kitobda bo'lsa — shu Kitob; aks holda Shamela Kitob bo'limi.
    for j, b in enumerate(babs):
        if b["kitab_id"]:
            continue
        prev = next((x for x in reversed(babs[:j]) if x["kitab_id"] and x["shamela_kitab"] == b["shamela_kitab"]), None)
        nxt = next((x for x in babs[j + 1:] if x["kitab_id"] and x["shamela_kitab"] == b["shamela_kitab"]), None)
        if prev and nxt and prev["kitab_id"] == nxt["kitab_id"]:
            b["kitab_id"], b["kitab_basis"] = prev["kitab_id"], "between_same_kitab"
        elif nxt and (not prev or prev["kitab_id"] != nxt["kitab_id"]) and b["shamela_kitab"] and sk_votes[b["shamela_kitab"]]:
            k = sk_votes[b["shamela_kitab"]].most_common(1)[0][0]
            if k == nxt["kitab_id"]:
                b["kitab_id"], b["kitab_basis"] = k, "shamela_kitab_section"
        if not b["kitab_id"]:
            st["bab_kitab_unresolved"] += 1
            b["kitab_basis"] = "unresolved"

    # Kitob kirishi: Shamela Kitob sarlavhasi va undan keyingi matn -> paketdagi Kitob (bo'lim hadislari ko'pchiligi).
    kit_by_id = {k["id"]: k for k in kitabs}
    for sk in shamela_kitabs:
        if sk_votes[sk["id"]]:
            k = sk_votes[sk["id"]].most_common(1)[0][0]
            kit_by_id[k].setdefault("shamela_headings", []).append(
                {"title_ar": sk["title_ar"], "evidence": sk["evidence"], "source": sk["source"], "intro": sk["intro"]})
    if preface and kitabs:
        kitabs[0].setdefault("shamela_headings", [])[:0] = opening_blocks(preface)
    for k in kitabs:
        k["bab_ids"] = [b["id"] for b in babs if b["kitab_id"] == k["id"]]
        k["unit_count"] = len(k["unit_ids"])
        k["units_with_bab"] = sum(1 for u in k["unit_ids"] if u in unit_bab)
        k["units_opening"] = sum(1 for u in k["unit_ids"] if u in set(kitab_opening))

    # ------------------------------------------------------------------ sanad
    routes = defaultdict(list)
    for r in json.loads((raw / "task2" / "page_isnads.json").read_text("utf-8")):
        if r["book_id"] == BOOK_ID:
            routes[(r["shamela_page_id"], r["hadeeth_key"])].append(r)
    page_body = {p["shamela_page_id"]: p.get("body") or "" for p in pages}
    isnad, persons_used = [], set()
    ist = Counter()
    for u in units:
        ref = shamela_ref(u, evidence)
        if not ref:
            continue
        paras = [p for p in paragraphs(page_body.get(ref["page"], "")) if p["number"] in ref["numbers"]]
        if not paras:
            continue
        para = paras[0]
        anchors = [(pid, nm) for pid, nm in para["mentions"] if pid != COMPILER]
        mentions = align_mentions(u["text_ar"], anchors)
        rs = routes.get((ref["page"], para["key"])) if para["key"] is not None else None
        rec = {"unit_id": u["unit_id"], "seq": u["seq"], "text_sha256": u["current_text_sha256"],
               "evidence": {"shamela_page_id": ref["page"], "printed_number": para["number"], "hadeeth_key": para["key"]},
               "mentions": [], "routes": [], "branched": para["branched"]}
        for k, m in enumerate(mentions):
            rec["mentions"].append({"mid": f"{u['unit_id']}#m{k + 1}", **m})
            persons_used.add(m["person"])
        if rs:
            for ri, r in enumerate(rs):
                chain = list(reversed(r["narrator_ids"]))
                if chain and chain[0] == COMPILER:
                    chain = chain[1:]
                nodes, last = [], -1
                for pos, pid in enumerate(chain, 1):
                    # route tuguni -> ayni mention: oldingi tugun mentionidan KEYINGI birinchi shu shaxs (tartib saqlanadi;
                    # orqaga qaytib boshqa tarmoqdagi bir xil ismga bog'lanmaydi)
                    mi = next((j for j, m in enumerate(rec["mentions"]) if j > last and m["person"] == pid), None)
                    if mi is not None:
                        last = mi
                    nodes.append({"pos": pos, "person": pid, "mid": rec["mentions"][mi]["mid"] if mi is not None else None})
                    persons_used.add(pid)
                rec["routes"].append({"route_id": f"{u['unit_id']}#r{ri + 1}", "label": chr(65 + ri), "page_isnads_id": r["id"],
                                      "of": len(chain), "nodes": nodes})
        reasons = []
        if not rs:
            reasons.append("no_page_isnads_row")
        if para["branched"]:
            reasons.append("tahwil_branch_in_page")
        if rs:
            in_route = {n["mid"] for r in rec["routes"] for n in r["nodes"] if n["mid"]}
            if any(m["mid"] not in in_route for m in rec["mentions"]):
                reasons.append("page_links_outside_route")
            if any(n["mid"] is None for r in rec["routes"] for n in r["nodes"]):
                reasons.append("route_node_without_page_link")
        if any(m["span"] is None for m in rec["mentions"]):
            reasons.append("mention_span_not_found")
        rec["reasons"] = reasons
        rec["status"] = "established_single_route" if rs and len(rs) == 1 and not reasons else (
            "branched" if para["branched"] else ("no_route" if not rs else "partial"))
        rec["intermediaries"] = rec["routes"][0]["of"] if rec["status"] == "established_single_route" else None
        ist["status:" + rec["status"]] += 1
        for x in reasons:
            ist["reason:" + x] += 1
        ist["mentions"] += len(rec["mentions"])
        ist["mentions_with_span"] += sum(1 for m in rec["mentions"] if m["span"])
        isnad.append(rec)

    # ------------------------------------------------------------------ roviylar
    persons = []
    for n in json.loads((raw / "task2" / "narrators.json").read_text("utf-8")):
        if n["id"] not in persons_used:
            continue
        def j(s):
            try:
                return json.loads(s) if s else None
            except ValueError:
                return None
        bio = j(n.get("biography_text")) or {}
        crit = j(n.get("criticism_text")) or {}
        persons.append({"person": n["id"], "short_name": (n.get("short_name") or "").strip("‌ "),
                        "long_name": (n.get("long_name") or "").strip("‌ "),
                        "summary": bio.get("summary") or [], "opinions": crit.get("garh") or [],
                        "status": "source_excerpt_unreviewed"})

    # ------------------------------------------------------------------ O'zbek qoralama (ixtiyoriy)
    translations = []
    if uz_draft:
        d = json.loads(Path(uz_draft).read_text("utf-8"))
        tv = d.get("translations_v4") or {}
        fx = {b["id"]: b for k in d.get("kitabs", []) for b in k.get("babs", [])}
        for fid, t in (tv.get("babs") or {}).items():
            b0 = fx.get(fid)
            if not b0:
                continue
            tgt = next((b for b in babs if b["source"]["page"] == b0["source"]["shamela_page_id"]
                        and normalize(b["title_ar"]).startswith(normalize(b0["title_ar"])[:40])), None)
            if not tgt:
                continue
            translations.append({"target": tgt["id"], "target_kind": "bab", "title": t.get("title"), "intro": t.get("intro") or []})
        # Kitob nomlari: foydalanuvchining dizayn namunasidagi UI nomlari (DIZAYN-PROTOTIP.html, kalitlar iman/ilm).
        # Tarjima emas — namunada berilgan ko'rsatma nomlar; faqat qoralama bilan birga va provenance bilan.
        for k0 in d.get("kitabs", []):
            names = SAMPLE_KITAB_NAMES.get(k0.get("name_key"))
            tgt = next((k for k in kitabs if normalize(k["title_ar"]) == normalize(k0.get("title_ar") or "")), None)
            if names and tgt:
                tgt["names"] = {**names, "origin": "Hadith Library design sample V6 UI names (HADITH-LIBRARY-AUDIT-20261024)",
                                "status": "user-provided-sample-name"}
        for num, t in (tv.get("hadiths") or {}).items():
            u = next((u for u in units if any(str(n.get("number_text")) == num for n in u.get("numbers") or [])), None)
            if u:
                translations.append({"target": u["unit_id"], "target_kind": "unit", "sanad": t.get("sanad"), "matn": t.get("matn") or []})
        for t in translations:
            t.update({"language": "uz", "status": tv.get("status", "editorial-draft-awaiting-scholarly-review"),
                      "origin": "Hadith Library design sample V4 (HADITH-LIBRARY-AUDIT-20261024), prepared from Shamela 1681 Arabic",
                      "translator": None, "published_source": None})

    for b in babs:
        b.pop("ev_index", None)
    stats = {"pages": len(pages), "headings": {**head_stats}, "kitabs": len(kitabs), "babs": len(babs),
             "shamela_kitab_headings": len(shamela_kitabs),
             "bab_evidence": dict(Counter(b["evidence"] for b in babs)),
             "babs_with_hadith": sum(1 for b in babs if b["unit_ids"]),
             "babs_without_hadith": sum(1 for b in babs if not b["unit_ids"]),
             "bab_kitab_basis": dict(Counter(b["kitab_basis"] for b in babs)),
             "units": len(units), "units_with_bab": len(unit_bab), **dict(st),
             "isnad": dict(ist), "persons": len(persons), "translations_uz_draft": len(translations)}
    return {"base": {"package_id": base_manifest["package_id"], "package_version": base_manifest["package_version"],
                     "package_sha256": base_sha, "edition_id": base_manifest["edition_id"], "work_id": base_manifest["work_id"]},
            "kitabs": kitabs, "babs": babs, "unit_bab": unit_bab, "kitab_opening": kitab_opening, "isnad": isnad, "persons": persons,
            "translations": translations, "stats": stats}


def write_overlay(ov: dict, out_dir: Path, raw: Path) -> Path:
    out_dir = Path(out_dir)
    if out_dir.resolve().is_relative_to(ROOT.parent.resolve()):
        raise SystemExit("--out repo ichida bo'lmasin: qatlam faqat mahalliy (QARORLAR.md #37/#38)")
    out_dir.mkdir(parents=True, exist_ok=True)
    src_sha = sha((raw / "shamela-bukhari" / "pages.jsonl").read_bytes())
    data = pack_overlay(ov, {"shamela_book": 1681, "book_id": BOOK_ID, "pages_sha256": src_sha})
    path = out_dir / f"{OVERLAY_ID}-{OVERLAY_VERSION}.hmz"
    path.write_bytes(data)
    (out_dir / "overlay-stats.json").write_text(json.dumps(ov["stats"], ensure_ascii=False, indent=1) + "\n", "utf-8")
    return path


def pack_overlay(ov: dict, source_metadata: dict, *, package_id: str = OVERLAY_ID, version: str = OVERLAY_VERSION,
                 license_text: str | None = None, attribution: str | None = None, rights: list | None = None, title: dict | None = None) -> bytes:
    """Qatlam paketini (deterministik ZIP) baytlarda qaytaradi. PWA pkg.js `kind=overlay` qoidalari bilan mos."""
    jl = lambda rows: ("".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows)).encode("utf-8")  # noqa: E731
    files = {
        "data/overlay/structure.json": json.dumps({"kitabs": ov["kitabs"], "babs": ov["babs"], "unit_bab": ov["unit_bab"], "kitab_opening": ov["kitab_opening"]},
                                                  ensure_ascii=False, sort_keys=True).encode("utf-8"),
        "data/overlay/isnad.jsonl": jl(ov["isnad"]),
        "data/overlay/persons.jsonl": jl(ov["persons"]),
        "data/overlay/translations.jsonl": jl(ov["translations"]),
        "LICENSE": (license_text or ("Mahalliy foydalanish uchun. Manba: AuthenticIlm \"Shamela 4 — Full Islamic Library Corpus\" "
                    "(al-Maktaba al-Shamela), Terms of use: Research and personal use. Ommaviy qayta tarqatish tasdiqlanmagan.\n")).encode("utf-8"),
        "ATTRIBUTION": (attribution or ("Kitob/Bob sarlavhalari, bob kirishlari, sanad yo'llari va roviy ma'lumotlari: Shamela kitobi 1681 "
                        "(صحيح البخاري - ط السلطانية) va AuthenticIlm task2 (page_isnads, narrators). Roviy tarjimai holi va olimlar "
                        "so'zlari manba ko'chirmasi, mustaqil tekshirilmagan. O'zbekcha matn — tahririy qoralama, ilmiy tekshiruv kutilmoqda.\n")).encode("utf-8"),
        "COVERAGE.json": json.dumps(ov["stats"], ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8"),
    }
    manifest = {
        "package_id": package_id, "kind": "overlay", "package_version": version, "schema_version": SCHEMA,
        "normalization_version": NORMALIZATION_VERSION, "channel": "local_only",
        "title": title or {"uz": "Buxoriy: boblar, sanad va roviylar (mahalliy qatlam)", "en": "Bukhari: chapters, isnads and narrators (local layer)",
                           "ar": "البخاري: الأبواب والأسانيد والرواة (طبقة محلية)"},
        "work_id": ov["base"]["work_id"], "edition_id": ov["base"]["edition_id"],
        "target": ov["base"],
        "source_metadata": source_metadata,
        "rights": rights or [{"holder": "AuthenticIlm / al-Maktaba al-Shamela", "terms": "Research and personal use",
                              "redistribution": False, "status": "local_only"}],
        "file_hashes": {n: sha(b) for n, b in files.items()},
    }
    files["package.json"] = json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8")
    files["SHA256SUMS"] = "".join(f"{sha(b)}  {n}\n" for n, b in sorted(files.items())).encode("utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n in sorted(files):
            zi = zipfile.ZipInfo(n, date_time=(2026, 10, 24, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, files[n])
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, required=True)
    ap.add_argument("--package", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--uz-draft", type=Path)
    a = ap.parse_args()
    if a.out.resolve().is_relative_to(ROOT.parent.resolve()):
        sys.exit("--out repo ichida bo'lmasin: qatlam faqat mahalliy (QARORLAR.md #37/#38)")
    ov = build(a.raw, a.package, a.uz_draft)
    p = write_overlay(ov, a.out, a.raw)
    print(p)
    print(json.dumps(ov["stats"], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
