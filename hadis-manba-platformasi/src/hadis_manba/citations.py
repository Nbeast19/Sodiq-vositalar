"""Standart iqtibos kartasi (16-bo'lim). Faqat haqiqiy maydonlardan yig'iladi;
yo'q maydon o'rniga taxmin emas, noma'lumlik sababi yoziladi."""
from __future__ import annotations

UNKNOWN = "noma'lum"


def _title(work: dict) -> str:
    return work.get("title_ar") or work.get("title_uz") or f"[{work.get('work_id')}: nom yo'q]"


def _authors(work: dict) -> str:
    names = [a.get("name_ar") or a.get("name_uz") or a.get("person_id") for a in work.get("authors", []) if a]
    return "، ".join(names) if names else f"muallif {UNKNOWN}"


def _number_line(numbers: list[dict]) -> str:
    if not numbers:
        return f"raqam {UNKNOWN} (manbada raqam berilmagan yoki import qilinmagan)"
    parts = []
    for n in numbers:
        label = n.get("scheme_label") or n.get("scheme_id")
        if n.get("number_text") is None:
            parts.append(f"{label} bo'yicha raqamsiz ({n.get('original_value') or n.get('number_status')})")
            continue
        vol = f"{n['volume']}-jild, " if n.get("volume") else ""
        var = f" ({n['variant']})" if n.get("variant") else ""
        parts.append(f"{label} bo'yicha {vol}{n['number_text']}{var}")
    return "; ".join(parts)


def _page(volume, page) -> str:
    if page is None:
        return f"jild:sahifa {UNKNOWN}"
    return f"{volume}:{page}" if volume else f"sahifa {page}"


def _status(statuses: dict, limitations: list[str]) -> str:
    keys = ("text_preservation_status", "number_status", "commentary_link_status", "commentary_end_status",
            "semantic_review_status")
    s = ", ".join(f"{k}={statuses[k]}" for k in keys if k in statuses) or "holat ko'rsatilmagan"
    if limitations:
        s += "; cheklov: " + " | ".join(x.rstrip(". ") for x in limitations)
    return s


ROLE_LABELS = {
    "hadith_text": "Hadis lafzi (sharhda keltirilgan)",
    "commentator": "Shorih",
    "quoted_scholar": "Naql",
    "editor_note": "Muhaqqiq/muharrir hoshiyasi",
    "attribution_unresolved": "Mualliflik aniqlanmagan (attribution_unresolved)",
}


def _layers(c: dict) -> list[str]:
    """Hadis lafzi, shorih nasri, naql va hoshiya alohida qatorlarda — bitta "shorih aytdi"ga qo'shilmaydi."""
    out = []
    for s in c.get("segments", []):
        who = s.get("person") or {}
        name = who.get("name_ar") or who.get("name_uz") or ""
        label = ROLE_LABELS.get(s["role"], s["role"])
        if s["role"] == "quoted_scholar":
            label = f"Naql — {name} so'zi (shorih keltirgan)"
        elif name:
            label = f"{label} ({name})"
        out.append(f"Iqtibos [{label}]: {c['text_ar'][s['start']:s['end']].strip()}")
    if not out:
        out.append(f"Iqtibos: {c['text_ar']}")
    if c.get("truncated"):
        out.append("[…] matn shu yerda kesildi")
    return out


def unit_citation(h: dict, core) -> str:
    ed = core._edition(h["edition_id"]) or {}
    lines = [
        f"{_title(h['work'])} ({_authors(h['work'])}), {_number_line(h['numbers'])}.",
        f"Nashr: {ed.get('label') or h['edition_id']}.",
        f"Iqtibos: {h['text_ar']}",
        f"Qamrov: {'to‘liq mahalliy birlik' if h['text_kind'] == 'full' else h['text_kind']}.",
        f"Holat: {_status(h['statuses'], h['limitations'])}.",
        f"Manba: {h['unit_id']} @ {core.lib.corpus_version()}",
    ]
    return "\n".join(lines)


def occurrence_citation(c: dict, core) -> str:
    base_line = None
    for l in c["links"]:
        if l["activation"]["state"] == "active":
            h = core.get_hadith(l["target_unit_id"])["results"][0]
            base_line = f"{_title(h['work'])}, {_number_line(h['numbers'])}."
            break
    if base_line is None and c["links"]:
        l = c["links"][0]
        base_line = (f"[asos: {l['target_work_id']} / {l['target_edition_id']} / {l['target_unit_id']} — "
                     f"asosiy kitob o'rnatilmagan, bibliografik havola]")
    ed = c.get("edition") or {}
    scope = {"full_section": "to‘liq mahalliy bo‘lim", "preview_window": "ko‘rish oynasi (tugash chegarasi tasdiqlanmagan)",
             "fragment": "parcha"}[c["scope"]]
    lines = [
        base_line or "[asos hadis bog'lamasi yo'q]",
        f"{_authors(c['commentary'])}, {_title(c['commentary'])}, {ed.get('label') or c['edition_id']}, "
        f"{_page(c.get('volume'), c.get('page'))}.",
        *_layers(c),
        f"Qamrov: {scope}.",
        f"Holat: {_status(c['statuses'], c['limitations'])}.",
        f"Manba: {c['occurrence_id']} @ {core.lib.corpus_version()}",
    ]
    return "\n".join(lines)
