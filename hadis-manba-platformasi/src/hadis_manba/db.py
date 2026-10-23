"""Kompyuter yadrosining SQLite + FTS5 sxemasi."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = r"""
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- O'rnatilgan paket versiyalari. Bir paketdan bitta 'active' bo'ladi.
CREATE TABLE IF NOT EXISTS package_versions (
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  kind TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  stored_file TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active','superseded','removed')),
  installed_at TEXT NOT NULL,
  PRIMARY KEY (package_id, package_version, sha256)
);

-- Append-only import jurnali (UPDATE/DELETE trigger bilan taqiqlangan).
CREATE TABLE IF NOT EXISTS import_journal (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  package_id TEXT,
  package_version TEXT,
  sha256 TEXT,
  detail TEXT
);
CREATE TRIGGER IF NOT EXISTS import_journal_no_update BEFORE UPDATE ON import_journal
BEGIN SELECT RAISE(ABORT, 'import_journal append-only'); END;
CREATE TRIGGER IF NOT EXISTS import_journal_no_delete BEFORE DELETE ON import_journal
BEGIN SELECT RAISE(ABORT, 'import_journal append-only'); END;

CREATE TABLE IF NOT EXISTS rights (
  package_id TEXT NOT NULL,
  applies_to TEXT NOT NULL,
  rights_status TEXT NOT NULL,
  license_id TEXT, license_url TEXT, license_evidence_file TEXT, license_evidence_sha256 TEXT,
  license_checked_at TEXT,
  redistribution_allowed INTEGER, commercial_use_allowed INTEGER,
  required_attribution TEXT, share_alike_requirements TEXT, permission_evidence TEXT
);

CREATE TABLE IF NOT EXISTS works (
  work_id TEXT NOT NULL, package_id TEXT NOT NULL,
  title_ar TEXT, title_uz TEXT, work_type TEXT, author_ids TEXT, data TEXT,
  PRIMARY KEY (work_id, package_id)
);
CREATE TABLE IF NOT EXISTS persons (
  person_id TEXT NOT NULL, package_id TEXT NOT NULL,
  name_ar TEXT, name_uz TEXT, data TEXT,
  PRIMARY KEY (person_id, package_id)
);
CREATE TABLE IF NOT EXISTS work_contributors (
  work_id TEXT NOT NULL, person_id TEXT NOT NULL, role TEXT NOT NULL,
  evidence_id TEXT, package_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS editions (
  edition_id TEXT NOT NULL, package_id TEXT NOT NULL, work_id TEXT NOT NULL,
  label TEXT, data TEXT,
  PRIMARY KEY (edition_id, package_id)
);
CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT NOT NULL, package_id TEXT NOT NULL, edition_id TEXT,
  url TEXT, revision TEXT, retrieved_at TEXT, sha256 TEXT, data TEXT,
  PRIMARY KEY (source_id, package_id)
);
CREATE TABLE IF NOT EXISTS source_files (
  file_id TEXT NOT NULL, package_id TEXT NOT NULL, source_id TEXT,
  path TEXT, layer TEXT CHECK (layer IN ('raw','derived','search')), sha256 TEXT, bytes INTEGER,
  license_id TEXT, data TEXT,
  PRIMARY KEY (file_id, package_id)
);
CREATE TABLE IF NOT EXISTS numbering_schemes (
  scheme_id TEXT NOT NULL, package_id TEXT NOT NULL, work_id TEXT, edition_id TEXT,
  label TEXT, data TEXT,
  PRIMARY KEY (scheme_id, package_id)
);

CREATE TABLE IF NOT EXISTS text_units (
  unit_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  unit_type TEXT NOT NULL,
  attribution_kind TEXT,
  text_kind TEXT NOT NULL,
  book_label TEXT, chapter_ar TEXT,
  text_ar TEXT NOT NULL,
  text_norm TEXT NOT NULL,
  raw_sha256 TEXT,
  current_text_sha256 TEXT NOT NULL,
  normalized_text_sha256 TEXT NOT NULL,
  statuses TEXT NOT NULL,
  limitations TEXT NOT NULL,
  location TEXT,
  data TEXT
);
CREATE INDEX IF NOT EXISTS text_units_pkg ON text_units(package_id, seq);
CREATE INDEX IF NOT EXISTS text_units_work ON text_units(work_id, edition_id);

-- Original identifikatorlar namespace bilan: book, record_id, row, bizning_id ...
CREATE TABLE IF NOT EXISTS unit_identifiers (
  unit_id TEXT NOT NULL, namespace TEXT NOT NULL, value TEXT NOT NULL,
  source_table_sha256 TEXT, package_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS unit_identifiers_lookup ON unit_identifiers(namespace, value);

CREATE TABLE IF NOT EXISTS number_assertions (
  assertion_id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL, scheme_id TEXT NOT NULL,
  volume TEXT, number_text TEXT, number_int INTEGER, variant TEXT,
  number_status TEXT NOT NULL, original_value TEXT, reason TEXT,
  page_volume TEXT, page TEXT, printed_page_status TEXT,
  evidence_id TEXT, package_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS number_assertions_lookup ON number_assertions(scheme_id, number_int, volume);

CREATE TABLE IF NOT EXISTS narrator_assertions (
  assertion_id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  terminal_person_id TEXT, fallback_person_id TEXT,
  narrator_identity_status TEXT NOT NULL,
  interpretation TEXT, original_value TEXT, reason TEXT,
  evidence_id TEXT, package_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grading_assertions (
  assertion_id TEXT PRIMARY KEY, unit_id TEXT NOT NULL,
  grade TEXT NOT NULL, scholar_person_id TEXT NOT NULL, source_ref TEXT NOT NULL,
  scope TEXT, evidence_id TEXT, package_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS topic_assertions (
  assertion_id TEXT PRIMARY KEY, unit_id TEXT NOT NULL,
  topic TEXT NOT NULL, lang TEXT, origin TEXT NOT NULL, package_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parallel_relations (
  relation_id TEXT PRIMARY KEY, from_unit_id TEXT NOT NULL, to_unit_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, evidence_id TEXT, package_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commentary_occurrences (
  occurrence_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL, work_id TEXT NOT NULL, edition_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  link_kind TEXT NOT NULL, lemma_kind TEXT NOT NULL, lemma_text TEXT,
  text_ar TEXT NOT NULL, text_norm TEXT NOT NULL,
  current_text_sha256 TEXT NOT NULL,
  scope TEXT NOT NULL,
  volume TEXT, page TEXT,
  segments TEXT NOT NULL,
  statuses TEXT NOT NULL, limitations TEXT NOT NULL,
  location TEXT, data TEXT
);

CREATE TABLE IF NOT EXISTS commentary_links (
  link_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  target_work_id TEXT NOT NULL, target_edition_id TEXT NOT NULL, target_unit_id TEXT NOT NULL,
  commentary_link_status TEXT NOT NULL, legacy_confidence TEXT,
  evidence_id TEXT, package_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS commentary_links_target ON commentary_links(target_unit_id);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id TEXT PRIMARY KEY, package_id TEXT NOT NULL,
  kind TEXT, quote TEXT, location TEXT, file_sha256 TEXT, coverage TEXT, data TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
  review_id TEXT PRIMARY KEY, package_id TEXT NOT NULL, target_id TEXT NOT NULL,
  review_kind TEXT NOT NULL CHECK (review_kind IN ('technical','scholarly')),
  status TEXT NOT NULL, reviewer TEXT, at TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS text_corrections (
  correction_id TEXT PRIMARY KEY, package_id TEXT NOT NULL, target_id TEXT NOT NULL,
  original_location TEXT, before_text TEXT, after_text TEXT, reason TEXT,
  evidence_edition TEXT, evidence_page TEXT, confirmation_kind TEXT, affected_links TEXT
);
CREATE TABLE IF NOT EXISTS coverage (
  package_id TEXT NOT NULL, work_id TEXT, edition_id TEXT, data TEXT NOT NULL
);

-- Qidiruv qatlami: normalizatsiyalangan nusxa, trigram FTS (ichki qism bo'yicha qidiruv).
CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  target_id UNINDEXED, target_kind UNINDEXED, package_id UNINDEXED, text_norm,
  tokenize = 'trigram'
);
"""

# Paketga tegishli barcha jadvallar (o'chirish/almashtirishda ishlatiladi).
PACKAGE_TABLES = (
    "rights", "works", "persons", "work_contributors", "editions", "sources", "source_files",
    "numbering_schemes", "text_units", "unit_identifiers", "number_assertions", "narrator_assertions",
    "grading_assertions", "topic_assertions", "parallel_relations", "commentary_occurrences",
    "commentary_links", "evidence", "reviews", "text_corrections", "coverage", "search_fts",
)


def connect(path: Path | str, readonly: bool = False) -> sqlite3.Connection:
    if readonly:
        uri = Path(path).resolve().as_uri() + "?mode=ro"
        con = sqlite3.connect(uri, uri=True, isolation_level=None, check_same_thread=False)
    else:
        con = sqlite3.connect(str(path), isolation_level=None, check_same_thread=False)
        con.executescript(SCHEMA)
        con.execute("PRAGMA journal_mode=WAL")
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con
