"""Arabcha qidiruv normalizatsiyasi.

Asl matn hech qachon o'zgartirilmaydi. Bu modul faqat *qidiruv* nusxasini
(search qatlami) yasaydi. Profil nomi va versiyasi har paket manifestida
`normalization_version` sifatida yoziladi; JavaScript nusxasi
(web/js/arabic.js) aynan shu qoidalarni bajaradi va ikkalasi
tests/arabic_vectors.json bo'yicha bir xil natija berishi shart.
"""
from __future__ import annotations

NORMALIZATION_VERSION = "ar-search-v1"

# O'chiriladigan belgilar: harakatlar, Qur'on belgilari, tatvil, ko'rinmas boshqaruv belgilari.
_REMOVE = set()
_REMOVE.update(range(0x0610, 0x061B))   # Qur'on kichik belgilari (ARABIC SIGN SALLALLAHOU ... )
_REMOVE.update(range(0x064B, 0x0660))   # fatha, kasra, damma, tanvin, shadda, sukun va boshqalar
_REMOVE.add(0x0670)                     # xanjar alif (superscript alef)
_REMOVE.update(range(0x06D6, 0x06DD))   # Qur'on pauza belgilari
_REMOVE.update(range(0x06DF, 0x06E5))
_REMOVE.update(range(0x06E7, 0x06E9))
_REMOVE.update(range(0x06EA, 0x06EE))
_REMOVE.add(0x0640)                     # tatvil
_REMOVE.update((0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x061C, 0xFEFF))  # ZW*, LRM/RLM, ALM, BOM

# Harf almashtirishlar (faqat qidiruv nusxasida).
_MAP = {
    0x0622: "ا",  # آ -> ا
    0x0623: "ا",  # أ -> ا
    0x0625: "ا",  # إ -> ا
    0x0671: "ا",  # ٱ -> ا
    0x0672: "ا",
    0x0673: "ا",
    0x0649: "ي",  # ى -> ي
    0x0629: "ه",  # ة -> ه
    0x0624: "و",  # ؤ -> و
    0x0626: "ي",  # ئ -> ي
    0x06CC: "ي",  # fors ی -> ي
    0x06A9: "ك",  # fors ک -> ك
}
_WS = {0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
       0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000}


def normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Qidiruv nusxasi va har bir belgining asl matndagi indeksini qaytaradi.

    Indekslar Python `str` indekslari (Unicode kod nuqtalari). JS tomoni ham
    kod nuqtalari bo'yicha ishlaydi (Array.from), shu sabab ikkalasi mos.
    """
    out: list[str] = []
    pos: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        cp = ord(ch)
        if cp in _REMOVE:
            continue
        if cp in _WS:
            if not prev_space:
                out.append(" ")
                pos.append(i)
                prev_space = True
            continue
        if 0x41 <= cp <= 0x5A:  # faqat ASCII katta harflar kichraytiriladi (JS bilan aynan mos)
            ch = chr(cp + 32)
        out.append(_MAP.get(cp, ch))
        pos.append(i)
        prev_space = False
    if out and out[-1] == " ":
        out.pop()
        pos.pop()
    return "".join(out), pos


def normalize(text: str) -> str:
    return normalize_with_map(text)[0]


def snippet(original: str, norm_start: int, norm_len: int, pos_map: list[int], window: int = 80) -> dict:
    """Topilgan joyni asl matnda ko'rsatadigan parcha (asl belgilar bilan)."""
    if not pos_map or norm_len <= 0:
        return {"text": original[: window * 2], "match_start": None, "match_end": None, "truncated": len(original) > window * 2}
    o_start = pos_map[norm_start]
    o_end = pos_map[min(norm_start + norm_len, len(pos_map)) - 1] + 1
    # tugash nuqtasidan keyin keladigan harakatlarni ham parchaga qo'shamiz
    while o_end < len(original) and ord(original[o_end]) in _REMOVE:
        o_end += 1
    a = max(0, o_start - window)
    b = min(len(original), o_end + window)
    # parcha so'z o'rtasida (yoki harakat belgisi bilan) boshlanmasin/tugamasin
    while a > 0 and ord(original[a - 1]) not in _WS:
        a -= 1
    while b < len(original) and ord(original[b]) not in _WS:
        b += 1
    return {
        "text": original[a:b],
        "match_start": o_start - a,
        "match_end": o_end - a,
        "truncated": a > 0 or b < len(original),
        "original_offset": a,
    }
