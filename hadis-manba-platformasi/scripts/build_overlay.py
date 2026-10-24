"""Hadis kitoblari (hj120) uchun MAHALLIY qatlam paketlari: Kitob → Bob tuzilmasi, bob kirishlari, sanad yo'llari va roviylar.

Kitoblar ro'yxati — BOOKS. Boblar Shamela nusxasi bor har kitob uchun; sanad/roviylar faqat roviy havolali
Shamela sahifalari va page_isnads mavjud kitoblar uchun (hozir: Buxoriy, Termiziy — Bashshor nashri orqali).

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
    python scripts/build_overlay.py --raw <…/raw> --packages <paketlar papkasi> --out <papka> --all
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

# Kitob -> Shamela manbasi. `para_alt`: paragraf boshida qo'shimcha raqam ko'rinishlari bor ("١٧١ - (١٠٦)", "٢١٠ -[١٣]",
# "٣/٨٨٠-"). `kitab_numbers`: paket raqamlaridan "Kitob:raqam" (Abdulboqiy) ko'rinishidagi ikkinchi qism ham olinadi.
# `isnad`: sanad manbasi — `evidence` (paketdagi Shamela sahifasi bilan bir nashr) yoki `number_text` (boshqa nashr:
# bosma raqam + matn o'xshashligi bilan tekshiriladi). None — mahalliy manbada roviy havolalari/page_isnads yo'q.
BOOKS = {
    "bukhari": {"package": "hm-bukhari-hj120", "shamela": "shamela-bukhari", "shamela_id": 1681, "overlay_id": OVERLAY_ID,
                "isnad": {"book_id": 1458, "compiler": 5495, "pages": "shamela-bukhari", "join": "evidence"},
                "title": {"uz": "Buxoriy", "en": "Bukhari", "ar": "البخاري"}},
    "muslim": {"package": "hm-muslim-hj120", "shamela": "shamela-muslim", "shamela_id": 1727, "para_alt": True,
               "isnad": None, "isnad_note": "page_isnads (book 683) bor, lekin shu nashr sahifalari mahalliy manbada yo'q",
               "title": {"uz": "Muslim", "en": "Muslim", "ar": "مسلم"}},
    "abudawud": {"package": "hm-abudawud-hj120", "shamela": "shamela-abudawud", "shamela_id": 1726,
                 "isnad": None, "isnad_note": "page_isnads (book 630) bor, lekin shu nashr sahifalari mahalliy manbada yo'q",
                 "title": {"uz": "Abu Dovud", "en": "Abu Dawud", "ar": "أبو داود"}},
    "tirmidhi": {"package": "hm-tirmidhi-hj120", "shamela": "shamela-tirmidhi", "shamela_id": 1435,
                 "isnad": {"book_id": 2859, "compiler": 10859, "pages": "shamela-tirmidhi-bashar", "join": "number_text"},
                 "title": {"uz": "Termiziy", "en": "Tirmidhi", "ar": "الترمذي"}},
    "ibnmajah": {"package": "hm-ibnmajah-hj120", "shamela": "shamela-ibnmajah", "shamela_id": 1198,
                 "isnad": None, "isnad_note": "mahalliy page_isnads'da Ibn Moja yo'q",
                 "title": {"uz": "Ibn Moja", "en": "Ibn Majah", "ar": "ابن ماجه"}},
    "nasai": {"package": "hm-nasai-hj120", "shamela": "shamela-nasai", "shamela_id": 829, "isnad": None,
              "title": {"uz": "Nasoiy", "en": "Nasa'i", "ar": "النسائي"}},
    "malik": {"package": "hm-malik-hj120", "shamela": "shamela-malik", "shamela_id": 1699, "kitab_numbers": True, "isnad": None,
              "title": {"uz": "Muvatto", "en": "Muwatta", "ar": "الموطأ"}},
    "darimi": {"package": "hm-darimi-hj120", "shamela": "shamela-darimi", "shamela_id": 21795, "isnad": None,
               "title": {"uz": "Doromiy", "en": "Darimi", "ar": "الدارمي"}},
    "ahmed": {"package": "hm-ahmed-hj120", "shamela": "shamela-musnad-ahmad", "shamela_id": 25794, "isnad": None,
              "title": {"uz": "Musnad Ahmad", "en": "Musnad Ahmad", "ar": "مسند أحمد"}},
    "mishkat": {"package": "hm-mishkat-almasabih-hj120", "shamela": "shamela-mishkat_almasabih", "shamela_id": 8360, "para_alt": True,
                "isnad": None, "title": {"uz": "Mishkotul-masobih", "en": "Mishkat al-Masabih", "ar": "مشكاة المصابيح"}},
    "riyad": {"package": "hm-riyad-assalihin-hj120", "shamela": "shamela-riyad_assalihin", "shamela_id": 12014, "para_alt": True,
              "isnad": None, "title": {"uz": "Riyozus-solihin", "en": "Riyad as-Salihin", "ar": "رياض الصالحين"}},
    "bulugh": {"package": "hm-bulugh-almaram-hj120", "shamela": "shamela-bulugh_almaram", "shamela_id": 9111, "isnad": None,
               "title": {"uz": "Bulug‘ul-marom", "en": "Bulugh al-Maram", "ar": "بلوغ المرام"}},
    "adab": {"package": "hm-aladab-almufrad-hj120", "shamela": "shamela-aladab_almufrad", "shamela_id": 12991, "isnad": None,
             "title": {"uz": "al-Adab al-mufrad", "en": "Al-Adab Al-Mufrad", "ar": "الأدب المفرد"}},
}
for _k, _b in BOOKS.items():
    _b.setdefault("overlay_id", f"hm-overlay-{_k}-structure" + ("-isnad" if _b.get("isnad") else ""))
SCHEMA = "1.0"
AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
TITLE_RE = re.compile(r"<span data-type=['\"]title['\"] id=['\"]?toc-(\d+)['\"]?>(.*?)</span>", re.S)
TAG_RE = re.compile(r"<[^>]+>")
MARKS = re.compile("[ً-ٰٟـ]")
HEAD_WORD = re.compile(r"^(?:باب|كتاب|أبواب|ابواب)(?:\s|:|$)")
PARA_RE = re.compile(r"^\s*([٠-٩]+)\s*-\s")
# para_alt kitoblar: "٣/٨٨٠-", "١٧١ - (١٠٦)", "٢١٠ -[١٣]" — barcha raqamlar olinadi (asosiysi — "-" oldidagi)
PARA_X = re.compile(r"^\s*(?:([٠-٩]+)\s*/\s*)?([٠-٩]+)\s*-(?=[\s\[(])\s*(?:\[([٠-٩]+)\]\s*)?(?:\(([٠-٩]+)\))?")
# sarlavha boshidagi manba raqamlash ("(٤٦) بَاب", "١٤٢- باب") — faqat Kitob/Bob so'zini aniqlash uchun olib tashlanadi
HEAD_NUM = re.compile(r"^\s*[(\[]?[٠-٩]+[)\]]?\s*[-–.]?\s*")
KITAB_WORD = re.compile(r"^(?:كتاب|أبواب|ابواب)(?:\s|$)")
# toc raqamisiz sarlavha span'i — Shamela'da nashrning old qismi bo'limlari ("(هذا نص التقرير)", "مقدمة"); bob emas
FRONT_TITLE_RE = re.compile(r"<span data-type=['\"]title['\"]\s*>(.*?)</span>", re.S)
BISM = {"﷽", "بسم الله الرحمن الرحيم"}


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def plain(s: str) -> str:
    return TAG_RE.sub("", s).replace(" ", " ").strip()


def load_pages(raw: Path, folder: str = "shamela-bukhari") -> list[dict]:
    rows = [json.loads(x) for x in (raw / folder / "pages.jsonl").read_text("utf-8").splitlines() if x.strip()]
    rows.sort(key=lambda p: p["shamela_page_id"])
    return rows


def bare_head(text: str) -> str:
    return HEAD_NUM.sub("", MARKS.sub("", text), count=1)


def scan(pages: list[dict], alt: bool = False) -> list[dict]:
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
            pm = (PARA_X if alt else PARA_RE).match(text)
            if pm and not (alt and HEAD_WORD.match(bare_head(text))):
                nums = [int(g.translate(AR_DIGITS)) for g in ((pm.group(2), pm.group(1), pm.group(3), pm.group(4)) if alt else (pm.group(1),)) if g]
                ev.append({"t": "para", "number": nums[0], "numbers": nums, "text": text, **pos})
                continue
            bare = bare_head(text)
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


def shamela_ref(u: dict, ev: dict, kitab_numbers: bool = False):
    n0 = next((n for n in u.get("numbers") or [] if n.get("number_text")), None)
    e = ev.get((n0 or {}).get("evidence_id")) or {}
    cand = next((c for c in e.get("candidates", []) if c.get("source") == "shamela-edition" and c.get("url")), None)
    if not n0 or not cand:
        return None
    nums = [int(x) for x in str(n0["number_text"]).split(";") if x.strip().isdigit()]
    if kitab_numbers:   # Abdulboqiy "Kitob:raqam" — Shamela paragrafi Kitob ichidagi raqam bilan boshlanadi
        for n in u.get("numbers") or []:
            for x in str(n.get("number_text") or "").split(";"):
                if ":" in x and x.split(":")[-1].strip().isdigit():
                    nums.append(int(x.split(":")[-1]))
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


def text_overlap(a: str, b: str) -> float:
    """Ikki matnning (normallashtirilgan) so'z ustma-ustligi: |A∩B| / min(|A|,|B|), A — birinchi 40 so'z."""
    ta = set(normalize(a).split()[:40])
    tb = set(normalize(b).split())
    return len(ta & tb) / max(1, min(len(ta), len(tb)))


def para_plain(body: str) -> dict:
    """Sahifadagi "N - " paragraflarining toza matni (raqam -> matn)."""
    from build_isnad_index import NUM_RE
    out, marks = {}, list(NUM_RE.finditer(body or ""))
    for i, m in enumerate(marks):
        seg = body[m.start(): marks[i + 1].start() if i + 1 < len(marks) else len(body)]
        out.setdefault(int(m.group(1).translate(AR_DIGITS)), plain(seg))
    return out


def build(raw: Path, package: Path, uz_draft: Path | None = None, book: str = "bukhari") -> dict:
    cfg = BOOKS[book]
    pages = load_pages(raw, cfg["shamela"])
    ev = scan(pages, alt=bool(cfg.get("para_alt")))
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
            for n in e.get("numbers") or [e["number"]]:
                para_at.setdefault((e["page"], n), i)
    unit_pos, st = {}, Counter()
    for u in units:
        ref = shamela_ref(u, evidence, bool(cfg.get("kitab_numbers")))
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
            if KITAB_WORD.match(bare_head(e["text"])):
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
            if is_bism(e["text"]) and nxt and nxt["t"] == "head" and KITAB_WORD.match(bare_head(nxt["text"])):
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
    icfg = cfg.get("isnad")
    routes = defaultdict(list)
    isnad, persons_used = [], set()
    ist = Counter()
    if icfg:
        for r in json.loads((raw / "task2" / "page_isnads.json").read_text("utf-8")):
            if r["book_id"] == icfg["book_id"]:
                routes[(r["shamela_page_id"], r["hadeeth_key"])].append(r)
    compiler = icfg["compiler"] if icfg else None
    page_body = {p["shamela_page_id"]: p.get("body") or "" for p in pages}
    by_number = {}
    if icfg and icfg["join"] == "number_text":
        # boshqa nashr (masalan Termiziy — Bashshor): bosma raqam -> (sahifa, paragraf, matn); matn o'xshashligi bilan tekshiriladi
        for p in load_pages(raw, icfg["pages"]):
            body = p.get("body") or ""
            texts = para_plain(body)
            for para in paragraphs(body):
                by_number.setdefault(para["number"], (p["shamela_page_id"], para, texts.get(para["number"], "")))
    for u in (units if icfg else []):
        if icfg["join"] == "evidence":
            ref = shamela_ref(u, evidence)
            if not ref:
                continue
            paras = [p for p in paragraphs(page_body.get(ref["page"], "")) if p["number"] in ref["numbers"]]
            if not paras:
                continue
            para, isnad_page = paras[0], ref["page"]
        else:
            n0 = next((n for n in u.get("numbers") or [] if n.get("number_text")), None)
            nums = [int(x) for x in str((n0 or {}).get("number_text") or "").split(";") if x.strip().isdigit()]
            hit = next((by_number[n] for n in nums if n in by_number), None)
            if not hit:
                ist["join:number_not_in_other_edition"] += 1
                continue
            ov_ = text_overlap(u["text_ar"], hit[2])
            how = "number_and_text" if ov_ >= 0.6 else None
            if not how and ov_ >= 0.4:
                # matn farqli yozilgan (masalan ح tarmog'i qo'shilgan): o'sha nashrdagi roviy ismlarining ≥70% bizning matnda topilsa
                al = align_mentions(u["text_ar"], [(pid, nm) for pid, nm in hit[1]["mentions"] if pid != icfg["compiler"]])
                if al and sum(1 for x in al if x["span"]) / len(al) >= 0.7:
                    how = "number_and_names"
            if not how:
                ist["join:text_mismatch"] += 1
                continue
            ist["join:" + how] += 1
            isnad_page, para = hit[0], hit[1]
            ref = {"page": isnad_page}
        anchors = [(pid, nm) for pid, nm in para["mentions"] if pid != compiler]
        mentions = align_mentions(u["text_ar"], anchors)
        rs = routes.get((isnad_page, para["key"])) if para["key"] is not None else None
        rec = {"unit_id": u["unit_id"], "seq": u["seq"], "text_sha256": u["current_text_sha256"],
               "evidence": {"shamela_page_id": isnad_page, "printed_number": para["number"], "hadeeth_key": para["key"],
                            "shamela_book": icfg["pages"], "join": icfg["join"] if icfg["join"] == "evidence" else how},
               "mentions": [], "routes": [], "branched": para["branched"]}
        for k, m in enumerate(mentions):
            rec["mentions"].append({"mid": f"{u['unit_id']}#m{k + 1}", **m})
            persons_used.add(m["person"])
        if rs:
            for ri, r in enumerate(rs):
                chain = list(reversed(r["narrator_ids"]))
                if chain and chain[0] == compiler:
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
    stats = {"book": book, "pages": len(pages), "headings": {**head_stats}, "kitabs": len(kitabs), "babs": len(babs),
             "shamela_kitab_headings": len(shamela_kitabs),
             "bab_evidence": dict(Counter(b["evidence"] for b in babs)),
             "babs_with_hadith": sum(1 for b in babs if b["unit_ids"]),
             "babs_without_hadith": sum(1 for b in babs if not b["unit_ids"]),
             "bab_kitab_basis": dict(Counter(b["kitab_basis"] for b in babs)),
             "units": len(units), "units_with_bab": len(unit_bab), **dict(st),
             "isnad": dict(ist), "isnad_source": icfg and {k: icfg[k] for k in ("book_id", "pages", "join")},
             "isnad_note": cfg.get("isnad_note"), "persons": len(persons), "translations_uz_draft": len(translations)}
    return {"base": {"package_id": base_manifest["package_id"], "package_version": base_manifest["package_version"],
                     "package_sha256": base_sha, "edition_id": base_manifest["edition_id"], "work_id": base_manifest["work_id"]},
            "kitabs": kitabs, "babs": babs, "unit_bab": unit_bab, "kitab_opening": kitab_opening, "isnad": isnad, "persons": persons,
            "translations": translations, "stats": stats}


def write_overlay(ov: dict, out_dir: Path, raw: Path, book: str = "bukhari") -> Path:
    cfg = BOOKS[book]
    out_dir = Path(out_dir)
    if out_dir.resolve().is_relative_to(ROOT.parent.resolve()):
        raise SystemExit("--out repo ichida bo'lmasin: qatlam faqat mahalliy (QARORLAR.md #37/#38)")
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = {"shamela_book": cfg["shamela_id"], "pages_sha256": sha((raw / cfg["shamela"] / "pages.jsonl").read_bytes())}
    if book == "bukhari":
        meta["book_id"] = BOOK_ID
    if cfg.get("isnad"):
        meta["isnad"] = {"book_id": cfg["isnad"]["book_id"], "pages": cfg["isnad"]["pages"], "join": cfg["isnad"]["join"],
                         "pages_sha256": sha((raw / cfg["isnad"]["pages"] / "pages.jsonl").read_bytes())}
    t = cfg["title"]
    has_isnad = bool(cfg.get("isnad"))
    title = None if book == "bukhari" else {
        "uz": f"{t['uz']}: boblar" + (", sanad va roviylar" if has_isnad else "") + " (mahalliy qatlam)",
        "en": f"{t['en']}: chapters" + (", isnads and narrators" if has_isnad else "") + " (local layer)",
        "ar": f"{t['ar']}: الأبواب" + (" والأسانيد والرواة" if has_isnad else "") + " (طبقة محلية)"}
    attribution = None if book == "bukhari" else (
        f"Kitob/Bob sarlavhalari va bob kirishlari: Shamela kitobi {cfg['shamela_id']} (AuthenticIlm Shamela 4 nusxasi)."
        + (f" Sanad yo'llari va roviylar: Shamela {cfg['isnad']['pages']} va AuthenticIlm task2 (page_isnads, narrators)." if has_isnad else "")
        + " Hech qanday sarlavha, raqam yoki mansublik yaratilmagan.\n")
    data = pack_overlay(ov, meta, package_id=cfg["overlay_id"], title=title, attribution=attribution)
    path = out_dir / f"{cfg['overlay_id']}-{OVERLAY_VERSION}.hmz"
    path.write_bytes(data)
    (out_dir / ("overlay-stats.json" if book == "bukhari" else f"overlay-stats-{book}.json")).write_text(
        json.dumps(ov["stats"], ensure_ascii=False, indent=1) + "\n", "utf-8")
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
    ap.add_argument("--package", type=Path, help="bitta asos paket (.hmz) — --book bilan")
    ap.add_argument("--packages", type=Path, help="paketlar papkasi — --all bilan")
    ap.add_argument("--book", default="bukhari", choices=sorted(BOOKS))
    ap.add_argument("--all", action="store_true", help="BOOKS dagi barcha kitoblar (paketi topilganlari)")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--uz-draft", type=Path)
    a = ap.parse_args()
    if a.out.resolve().is_relative_to(ROOT.parent.resolve()):
        sys.exit("--out repo ichida bo'lmasin: qatlam faqat mahalliy (QARORLAR.md #37/#38)")
    jobs = []
    if a.all:
        for key, cfg in BOOKS.items():
            found = sorted((a.packages or Path(".")).glob(cfg["package"] + "-*.hmz"))
            if found:
                jobs.append((key, found[-1]))
    else:
        if not a.package:
            sys.exit("--package yoki --all kerak")
        jobs.append((a.book, a.package))
    for key, pkg in jobs:
        ov = build(a.raw, pkg, a.uz_draft if key == "bukhari" else None, book=key)
        p = write_overlay(ov, a.out, a.raw, key)
        st = ov["stats"]
        print(p.name, "babs", st["babs"], "units_with_bab", st["units_with_bab"], "/", st["units"],
              "isnad", {k: v for k, v in st["isnad"].items() if k.startswith(("status", "join"))})


if __name__ == "__main__":
    main()
