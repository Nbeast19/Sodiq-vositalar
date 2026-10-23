"""Umumiy lug'atlar: holatlar, turlar, huquq qiymatlari.

Bu ro'yxatlar paket validatori, SQLite sxemasi va hujjatlar (docs/SCHEMA.md)
uchun yagona manba.
"""

SCHEMA_VERSION = "1.0.0"
APP_VERSION = "0.1.0"

# 11-bo'lim: umumiy ilmiy holatlar
STATUS_VALUES = ("verified", "limited", "conflict", "not_found", "unreviewed", "not_applicable")

# 11-bo'lim: bir-birini bosib ketmaydigan holat maydonlari
STATUS_KEYS = (
    "transport_integrity",
    "source_identity_status",
    "edition_identity_status",
    "number_status",
    "narrator_identity_status",
    "text_preservation_status",
    "commentary_link_status",
    "commentary_start_status",
    "commentary_end_status",
    "printed_page_status",
    "semantic_review_status",
    "rights_status",
)

UNIT_TYPES = (
    "hadith",          # Nabiy ﷺga nisbat berilgan rivoyat
    "athar_sahabi",    # sahoba asari
    "athar_tabii",     # tobi'iy asari
    "author_statement",  # masalan Molik bayoni
    "chapter_heading",   # bob sarlavhasi
    "editor_note",       # muharrir/muhaqqiq izohi
    "introduction",      # muqaddima
    "text_block",        # turi aniqlanmagan raqamli matn bloki
    "test_fixture",      # faqat sinov namunasi
)

# Rivoyatning nisbat turi (hukm emas!)
ATTRIBUTION_KINDS = ("marfu", "mawquf", "maqtu", "mursal", "balagh", "not_applicable", "unknown")

TEXT_KINDS = ("full", "fragment", "empty", "heading")

COMMENTARY_LINK_KINDS = ("mustaqil", "umumiy", "qisqa_izoh", "havola", "tekshirilmagan")  # oxirgisi: eski qatlam, turi aniqlanmagan
LEMMA_KINDS = ("iqtibos", "parcha", "iqtibos_yoq", "matn_boshi", "qisqa_iqtibos", "tekshirilmagan")
COMMENTARY_SCOPES = ("full_section", "preview_window", "fragment")
SEGMENT_ROLES = ("hadith_text", "commentator", "quoted_scholar", "editor_note", "attribution_unresolved")

TOPIC_ORIGINS = ("source_heading", "editorial_tag", "ai_suggestion")
PARALLEL_RELATIONS = ("same_report", "parallel_variant", "exact_text", "number_correspondence", "uncertain")

PACKAGE_KINDS = ("base_book", "commentary", "selection")

RIGHTS_STATUS = ("approved", "conditional", "unknown", "restricted")
RIGHTS_APPLIES_TO = ("code", "classical_body", "translation", "editorial_notes", "scan", "metadata", "derived_index")

# Original IMKONSIZ / RAQAMSIZ kabi qiymatlar o'chirilmaydi: original_value + reason saqlanadi,
# yangi modelga quyidagicha ma'no bo'yicha xaritalanadi.
LEGACY_VALUE_HINTS = {
    "IMKONSIZ": "original qiymat saqlanadi; sababga ko'ra not_applicable / not_found / limited",
    "RAQAMSIZ": "tanlangan tizimda mustaqil son yo'q; matn yo'q degani emas",
}
