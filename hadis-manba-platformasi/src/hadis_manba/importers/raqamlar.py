"""`manbalar/hadis-raqamlar/raqamlar.sqlite` + hadith-json 1.2.0 -> asosiy kitob paketlari.

Har kitob (va kitob ichida alohida nashr bo'lsa — har nashr) alohida `base_book` paketi.
Qoidalar (topshiriq 7–9, 11):
- matn: `source_text.arabic` aynan (o'zgartirilmaydi); `raw_sha256` — asl yozuv xeshi
  (125 Muvatto: `original_arabic_sha` — bo'sh matn xeshi, joriy matn alohida);
- hadith-json `idInBook`, `record_id`, `global_id`, `row:N` — faqat identifikator (bosma raqam emas);
- bosma raqam: `raqam_tizimi` nomli tizimda `bosma_raqam` (+ `harf` variant, + `jild`);
  `raqam_holat` original qiymat sifatida saqlanadi va ma'no bo'yicha statusga xaritalanadi;
- roviy: `roviy_id` bo'lsa shaxs; `roviy_holat` original; sabab saqlanadi;
- rivoyat turi (`roviy_turi`) nisbat turi, hukm emas; chegarasi ochiq bo'lsa `unknown` / `text_block`;
- `juz_sahifa` — raqamli sahifa yorlig'i (skan bilan tasdiqlanmagan);
- inglizcha tarjima paketga kiritilmaydi (doira: arabcha manba).
"""
from __future__ import annotations

import gzip
import hashlib
import json
import re
import shutil
import sqlite3
from collections import defaultdict
from pathlib import Path

RAQAM_HOLAT = {
    "tasdiqlangan_1": "verified", "tasdiqlangan_2": "verified", "tasdiqlangan": "verified",
    "jild_bilan": "limited", "bitta_manba": "limited", "ziddiyat": "conflict", "topilmadi": "not_found",
}
ROVIY_HOLAT = {"tasdiqlangan": "verified", "tasdiqlangan_1": "verified", "tasdiqlangan_2": "verified",
               "ziddiyat": "conflict", "topilmadi": "not_found"}
ROVIY_TURI = {
    "marfu": ("hadith", "marfu"), "mursal": ("hadith", "mursal"), "balag": ("hadith", "balagh"),
    "mavquf": ("athar_sahabi", "mawquf"), "maqtu": ("athar_tabii", "maqtu"),
    "muallif_sozi": ("author_statement", "not_applicable"),
    "mavquf_maqtu_yoki_marfu_chegarasi_ochiq": ("text_block", "unknown"),
    "aniqlanmagan": ("text_block", "unknown"),
}
PACKAGE_VERSION = "1.0.1"  # 1.0.1: Sunnah raqami xaritasi alohida sxema sifatida qo'shildi
# Tahririy (editorial) nomlar: manbada arabcha/inglizcha sarlavha yo'q kitoblar uchun qidiruv va ko'rsatish nomi.
# Manba ma'lumoti emas — katalogda names_origin="editorial" deb belgilanadi.
EDITORIAL_NAMES = {
    "abdurrazzoq": ("مصنف عبد الرزاق", "Musannaf ʿAbd al-Razzaq"),
    "bayhaqiy-kubro": ("السنن الكبرى للبيهقي", "al-Sunan al-Kubra (al-Bayhaqi)"),
    "doraqutniy": ("سنن الدارقطني", "Sunan al-Daraqutni"),
    "ibn-abi-shayba": ("مصنف ابن أبي شيبة", "Musannaf Ibn Abi Shayba"),
    "ibn-hibbon": ("صحيح ابن حبان", "Sahih Ibn Hibban"),
    "ibn-xuzayma": ("صحيح ابن خزيمة", "Sahih Ibn Khuzayma"),
    "musnad-ahmad": ("مسند أحمد", "Musnad Ahmad"),
    "mustadrak": ("المستدرك على الصحيحين", "al-Mustadrak ʿala al-Sahihayn (al-Hakim)"),
    "shuab-iymon": ("شعب الإيمان", "Shuʿab al-Iman (al-Bayhaqi)"),
    "tabaroniy-avsat": ("المعجم الأوسط", "al-Muʿjam al-Awsat (al-Tabarani)"),
    "tabaroniy-kabir": ("المعجم الكبير", "al-Muʿjam al-Kabir (al-Tabarani)"),
    "tabaroniy-sagir": ("المعجم الصغير", "al-Muʿjam al-Saghir (al-Tabarani)"),
}
SUNNAH_PERMISSION = "foydalanuvchi tasdiqlagan Sunnah.com ruxsati (2026-10-23); qo'shimcha hujjat talab qilinmaydi"


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def open_db(manba: Path) -> sqlite3.Connection:
    db = manba / "manbalar" / "hadis-raqamlar" / "raqamlar.sqlite"
    con = sqlite3.connect(db.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)
    return con


def hadith_json_meta(manba: Path, source_file: str) -> dict:
    """hadith-json fayli: metadata va bob nomlari (faqat o'qish)."""
    p = manba.parent / source_file
    if not p.exists():
        return {}
    d = json.loads(p.read_text("utf-8"))
    return {"metadata": d.get("metadata", {}),
            "chapters": {str(c["id"]): c.get("arabic") for c in d.get("chapters", [])}}


def editions_of(con, book: str) -> list[dict]:
    """Kitob ichidagi nashrlar. hadith-json kitoblarida raqamli nashr bitta, bosma tizimlar — sxema;
    hadis-qoshimcha kitoblarida har `raqam_tizimi` alohida nashr (Shamela kitobi)."""
    systems: dict[str, int] = defaultdict(int)
    src = None
    for (p,) in con.execute("SELECT payload FROM records WHERE book=?", (book,)):
        j = json.loads(p)
        systems[j.get("raqam_tizimi") or ""] += 1
        src = j.get("source_file") or src
    hj = bool(src and "hadith-json" in src)
    if hj or len(systems) == 1:
        return [{"edition_id": f"ed-{_slug(book)}" + ("-hj120" if hj else ""), "systems": set(systems),
                 "hadith_json": hj, "source_file": src}]
    out = []
    for i, (s, _n) in enumerate(sorted(systems.items(), key=lambda kv: -kv[1]), 1):
        out.append({"edition_id": f"ed-{_slug(book)}-n{i}", "systems": {s}, "hadith_json": False,
                    "source_file": src})
    return out


def _page(juz_sahifa: str):
    if not juz_sahifa:
        return None, None
    first = juz_sahifa.split(";")[0]
    if ":" in first:
        v, pg = first.split(":", 1)
        return v or None, pg or None
    return None, first or None


def build_book(manba: Path, book: str, out_root: Path, book_names: dict, persons: dict,
               edition_index: dict[str, str]) -> list[Path]:
    """Bitta kitob uchun (nashrlar soniga qarab bir yoki bir nechta) paket manba papkasi."""
    con = open_db(manba)
    eds = editions_of(con, book)
    results = []
    for ed in eds:
        meta = hadith_json_meta(manba, ed["source_file"]) if ed["hadith_json"] else {}
        md = meta.get("metadata", {})
        chapters = meta.get("chapters", {})
        work_id = f"w-{_slug(book)}"
        pid = ed["edition_id"].replace("ed-", "hm-", 1)
        title_ar = (md.get("arabic") or {}).get("title") or None
        title_en = (md.get("english") or {}).get("title") or None
        names_origin = "source" if (title_ar or title_en) else None
        if not title_ar and book in EDITORIAL_NAMES:
            title_ar, title_en = EDITORIAL_NAMES[book]
            names_origin = "editorial"
        author_ar = (md.get("arabic") or {}).get("author") or None
        names = book_names.get(book, {})
        title_uz = names.get("full") or book
        schemes: dict[str, dict] = {}
        units, ev, parallels, persons_used = [], [], [], set()
        rows = con.execute(
            "SELECT r.rid, r.record_id, r.arabic_sha, r.payload, s.arabic FROM records r "
            "JOIN source_text s ON s.book=r.book AND s.record_id=r.record_id WHERE r.book=? ORDER BY r.rid",
            (book,)).fetchall()
        rows = [r for r in rows if (json.loads(r[3]).get("raqam_tizimi") or "") in ed["systems"]]

        def order_key(r):
            j = json.loads(r[3])
            m = re.match(r"^(?:row:)?(\d+)$", str(j.get("idInBook") or r[1]))
            return (int(m.group(1)) if m else 10**9, r[0])
        rows.sort(key=order_key)
        for seq, (rid, record_id, arabic_sha, payload, arabic) in enumerate(rows, 1):
            j = json.loads(payload)
            uid = f"{ed['edition_id']}:{record_id}"
            unit_type, attr = ROVIY_TURI.get(j.get("roviy_turi") or "", ("text_block", "unknown"))
            text = arabic or ""
            stripped = re.sub(r"[ً-ٰٟ\s]", "", text)
            text_kind = "empty" if not stripped else ("fragment" if len(stripped) < 15 else "full")
            lim = []
            if text_kind == "fragment":
                lim.append("matn juda qisqa (masalan «نحوه») — oldingi rivoyatga ishora bo'lishi mumkin")
            sysname = j.get("raqam_tizimi") or "noma'lum tizim"
            sid = f"sch-{_slug(book)}-{hashlib.sha1(sysname.encode()).hexdigest()[:8]}"
            schemes.setdefault(sid, {"scheme_id": sid, "work_id": work_id, "edition_id": ed["edition_id"],
                                     "label": sysname})
            rh = j.get("raqam_holat") or ""
            br = (j.get("bosma_raqam") or "").strip()
            vol, page = _page(j.get("juz_sahifa") or "")
            num = {
                "assertion_id": f"{uid}#n", "scheme_id": sid, "volume": j.get("jild") or None,
                "number_text": br or None, "number_int": int(br) if br.isdigit() else None,
                "variant": j.get("harf") or None, "number_status": RAQAM_HOLAT.get(rh, "unreviewed"),
                "original_value": rh or None,
                "reason": j.get("raqam_sabab") or (None if br else "bosma raqam berilmagan"),
                "page_volume": vol, "page": page,
                "printed_page_status": "unreviewed" if page else "not_found",
                "evidence_id": f"{uid}#ev",
            }
            numbers = [num]
            if j.get("abdulboqiy"):
                asid = f"sch-{_slug(book)}-abdulboqiy"
                schemes.setdefault(asid, {"scheme_id": asid, "work_id": work_id, "edition_id": ed["edition_id"],
                                          "label": "Abdulboqiy kitob:hadis"})
                numbers.append({"assertion_id": f"{uid}#nab", "scheme_id": asid, "volume": None,
                                "number_text": j["abdulboqiy"], "number_int": None, "variant": None,
                                "number_status": "unreviewed", "original_value": None, "reason": None,
                                "page_volume": None, "page": None, "printed_page_status": "not_found",
                                "evidence_id": None})
            if j.get("sunnah_no"):
                ssid = f"sch-{_slug(book)}-sunnah"
                schemes.setdefault(ssid, {"scheme_id": ssid, "work_id": work_id, "edition_id": ed["edition_id"],
                                          "label": "Sunnah.com raqami (xarita)"})
                sn = str(j["sunnah_no"]).strip()
                numbers.append({"assertion_id": f"{uid}#nsn", "scheme_id": ssid, "volume": None, "number_text": sn,
                                "number_int": int(sn) if sn.isdigit() else None, "variant": None,
                                "number_status": "limited", "original_value": None,
                                "reason": "Sunnah raqami — bosma raqamdan alohida xarita (payload: sunnah_no)",
                                "page_volume": None, "page": None, "printed_page_status": "not_applicable",
                                "evidence_id": None})
            idents = [{"namespace": "record_id", "value": record_id}]
            m = re.match(r"^row:(\d+)$", record_id)
            if m:
                idents.append({"namespace": "row", "value": m.group(1)})
            for ns in ("idInBook", "global_id", "legacy_raqam"):
                if j.get(ns) not in (None, "") and j.get(ns) != record_id:
                    idents.append({"namespace": ns, "value": str(j[ns])})
            if j.get("sunnah_reference"):
                idents.append({"namespace": "sunnah_reference", "value": j["sunnah_reference"]})
            rvh = j.get("roviy_holat") or ""
            pid_person = j.get("roviy_id") or None
            if pid_person:
                persons_used.add(pid_person)
            narr = [{"assertion_id": f"{uid}#r", "terminal_person_id": pid_person, "fallback_person_id": None,
                     "narrator_identity_status": ROVIY_HOLAT.get(rvh, "unreviewed") if (pid_person or j.get("roviy"))
                     else ("not_applicable" if unit_type == "author_statement" else ROVIY_HOLAT.get(rvh, "unreviewed")),
                     "interpretation": j.get("roviy") or None, "original_value": rvh or None,
                     "reason": j.get("roviy_sabab") or None, "evidence_id": f"{uid}#ev"}]
            statuses = {"transport_integrity": "verified", "source_identity_status": "verified",
                        "edition_identity_status": "limited" if ed["hadith_json"] else "unreviewed",
                        "number_status": num["number_status"], "narrator_identity_status": narr[0]["narrator_identity_status"],
                        "text_preservation_status": "unreviewed", "printed_page_status": num["printed_page_status"],
                        "semantic_review_status": "unreviewed",
                        "rights_status": "verified" if ed["hadith_json"] else "unreviewed"}
            raw = j.get("original_arabic_sha") or arabic_sha
            u = {"unit_id": uid, "seq": seq, "unit_type": unit_type, "attribution_kind": attr,
                 "text_kind": text_kind, "book_label": None,
                 "chapter_ar": chapters.get(str(j.get("chapter_id") or "")) or None,
                 "text_ar": text, "raw_sha256": raw, "statuses": statuses, "limitations": lim,
                 "numbers": numbers, "narrators": narr, "identifiers": idents,
                 "location": {"file_id": f"f-{_slug(book)}-sqlite", "record": record_id,
                              "source_file": j.get("source_file")}}
            if j.get("original_arabic_sha"):
                u["text_history"] = [
                    {"layer": "original", "sha256": j["original_arabic_sha"], "note": j.get("text_hash_note")},
                    {"layer": "current", "sha256": _sha(text), "note": "joriy source_text"}]
                u["limitations"].append("asl yozuv xeshi joriy matn xeshidan farq qiladi (asl matn bo'sh edi)")
            if j.get("matn_tuzatilgan"):
                u["limitations"].append("manbada matn tuzatilgan deb belgilangan (payload: matn_tuzatilgan)")
            units.append(u)
            dal = j.get("dalil") or []
            ev.append({"evidence_id": f"{uid}#ev", "kind": "number_narrator_sources",
                       "quote": None, "location": {"record": record_id},
                       "coverage": "metadata", "items": dal[:8], "items_total": len(dal),
                       "candidates": (j.get("candidates") or [])[:5]})
            for k, o in enumerate(j.get("boshqa_kitoblarda") or []):
                tgt = edition_index.get(o.get("book"))
                if tgt and o.get("record_id"):
                    parallels.append({"relation_id": f"{uid}#p{k}", "from_unit_id": uid,
                                      "to_unit_id": f"{tgt}:{o['record_id']}", "relation_type": "uncertain",
                                      "evidence_id": None, "similarity": o.get("similarity"),
                                      "original_holat": o.get("holat")})
        if not units:
            continue
        persons_list = []
        if author_ar:
            persons_list.append({"person_id": f"p-author-{_slug(book)}", "name_ar": author_ar,
                                 "name_uz": (md.get("english") or {}).get("author")})
        for p in sorted(persons_used):
            pp = persons.get(p, {})
            persons_list.append({"person_id": p, "name_ar": None, "name_uz": pp.get("uzbekcha"),
                                 "aliases_ar": pp.get("aliaslar", [])[:10], "status": pp.get("holat")})
        rights = _rights(ed["hadith_json"])
        out = out_root / pid
        if out.exists():
            shutil.rmtree(out)
        (out / "data").mkdir(parents=True)
        ed_label = (f"Raqamli matn: hadith-json 1.2.0 (sunnah.com); bosma raqamlar: {', '.join(sorted(ed['systems']))}"
                    if ed["hadith_json"] else next(iter(ed["systems"])))
        manifest = {
            "package_id": pid, "kind": "base_book", "package_version": PACKAGE_VERSION, "schema_version": "1.0.0",
            "work_id": work_id, "edition_id": ed["edition_id"], "source_revision": "dot-20261023-04",
            "title": {"uz": title_uz + ("" if len(eds) == 1 else f" — {ed['edition_id']}"), "ar": title_ar,
                      "en": (title_en or title_uz) + ("" if len(eds) == 1 else f" — {ed['edition_id']}")},
            "names": sorted({x for x in [title_en, title_uz, *(names.get("mentions") or []), book] if x}),
            "names_origin": names_origin,
            "author_ids": [f"p-author-{_slug(book)}"] if author_ar else [],
            "source_metadata": [{"source_id": f"src-{ed['edition_id']}", "source_file": ed["source_file"],
                                 "db": "manbalar/hadis-raqamlar/raqamlar.sqlite", "book": book}],
            "attribution": ("Matn: sunnah.com (hadith-json 1.2.0 orqali); raqam/roviy tekshiruvi: foydalanuvchi "
                            "loyihasi 0-Manba (dot-20261023-04)") if ed["hadith_json"] else
                           "Matn: mahalliy hadis-qoshimcha (Shamela asosidagi) nusxa; huquq aniqlanmagan",
            "rights": rights, "compatible_app_versions": ">=0.1.0", "normalization_version": "ar-search-v1",
        }
        entities = {
            "works": [{"work_id": work_id, "title_ar": title_ar, "title_uz": title_uz, "work_type": "hadith_collection",
                       "author_ids": manifest["author_ids"], "source_key": book}],
            "persons": persons_list,
            "work_contributors": [{"work_id": work_id, "person_id": a, "role": "author"} for a in manifest["author_ids"]],
            "editions": [{"edition_id": ed["edition_id"], "work_id": work_id, "label": ed_label,
                          "digital_source": ed["source_file"], "printed_systems": sorted(ed["systems"])}],
            "sources": [{"source_id": f"src-{ed['edition_id']}", "edition_id": ed["edition_id"],
                         "url": "https://sunnah.com" if ed["hadith_json"] else None, "revision": "dot-20261023-04"}],
            "numbering_schemes": list(schemes.values()),
        }
        (out / "package.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
        (out / "LICENSE").write_text(_license_text(ed["hadith_json"]), "utf-8")
        (out / "ATTRIBUTION").write_text(manifest["attribution"] + "\n", "utf-8")
        (out / "COVERAGE.json").write_text(json.dumps({"note": "raqamlar.sqlite yozuvlari; noyob hadislar soni emas",
                                                       "denominator": None}, ensure_ascii=False), "utf-8")
        (out / "data" / "entities.json").write_text(json.dumps(entities, ensure_ascii=False), "utf-8")
        with open(out / "data" / "units.jsonl", "w", encoding="utf-8") as fh:
            for u in units:
                fh.write(json.dumps(u, ensure_ascii=False) + "\n")
        with open(out / "data" / "evidence.jsonl", "w", encoding="utf-8") as fh:
            for e in ev:
                fh.write(json.dumps(e, ensure_ascii=False) + "\n")
        with open(out / "data" / "parallels.jsonl", "w", encoding="utf-8") as fh:
            for p in parallels:
                fh.write(json.dumps(p, ensure_ascii=False) + "\n")
        results.append(out)
    con.close()
    return results


def _rights(hadith_json: bool) -> list[dict]:
    if hadith_json:
        return [{"applies_to": a, "rights_status": "approved", "license_id": None, "license_url": "https://sunnah.com",
                 "license_evidence_file": None, "license_checked_at": "2026-10-23",
                 "redistribution_allowed": True, "commercial_use_allowed": None,
                 "required_attribution": "Sunnah.com", "share_alike_requirements": None,
                 "permission_evidence": SUNNAH_PERMISSION}
                for a in ("classical_body", "metadata", "derived_index")]
    return [{"applies_to": "classical_body", "rights_status": "unknown", "license_id": None, "license_url": None,
             "license_evidence_file": None, "license_checked_at": "2026-10-23", "redistribution_allowed": None,
             "commercial_use_allowed": None, "required_attribution": None, "share_alike_requirements": None,
             "permission_evidence": None}]


def _license_text(hadith_json: bool) -> str:
    if hadith_json:
        return ("Arabcha matn manbasi: sunnah.com (hadith-json 1.2.0 to'plami orqali).\n"
                f"Huquq: {SUNNAH_PERMISSION}.\n"
                "Raqam/roviy/status metama'lumotlari: foydalanuvchi loyihasi (0-Manba, dot-20261023-04).\n")
    return ("Huquq holati: unknown. Faqat mahalliy foydalanish (local_only). Ommaviy tarqatilmaydi.\n"
            "Manba: mahalliy hadis-qoshimcha nusxasi (Shamela asosidagi nashr metadata bilan).\n")


def all_books(manba: Path) -> list[str]:
    con = open_db(manba)
    books = [b for (b,) in con.execute("SELECT DISTINCT book FROM records ORDER BY book")]
    con.close()
    return books


def edition_index(manba: Path) -> dict[str, str]:
    """book -> asosiy (birinchi) edition_id; parallel havolalar uchun."""
    con = open_db(manba)
    idx = {b: editions_of(con, b)[0]["edition_id"] for b in all_books(manba)}
    con.close()
    return idx


def load_aux(manba: Path) -> tuple[dict, dict]:
    hr = manba / "manbalar" / "hadis-raqamlar"
    names = json.loads((hr / "kitob-nomlari.json").read_text("utf-8")) if (hr / "kitob-nomlari.json").exists() else {}
    persons = {p["id"]: p for p in json.loads((hr / "persons.json").read_text("utf-8"))} \
        if (hr / "persons.json").exists() else {}
    return names, persons


_ = gzip  # (hadis-qoshimcha .tsv.gz fayllari keyingi bosqichda bevosita o'qilishi mumkin)
