"""Hadis Manba paket formati (.hmz) — yaratish, o'qish va tekshirish.

Paket oddiy ZIP. Ichida:
  package.json      manifest (docs/PACKAGE-FORMAT.md)
  LICENSE           ma'lumot litsenziyasi/sharti
  ATTRIBUTION       kimga nisbat berish kerakligi
  COVERAGE.json     haqiqiy qamrov
  SHA256SUMS        har bir fayl xeshi
  data/...          entity, unit, sharh va bog'lama fayllari (JSON / JSONL)
Paket ichida bajariladigan kod bo'lmaydi va bo'lsa ham bajarilmaydi.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from . import model
from .arabic import NORMALIZATION_VERSION, normalize
from .safezip import Limits, UnsafeZip, check_zip, read_member

PACKAGE_EXT = ".hmz"
REQUIRED_FILES = ("package.json", "LICENSE", "ATTRIBUTION", "COVERAGE.json", "SHA256SUMS")
ALLOWED_TOP = set(REQUIRED_FILES)
DATA_FILES = {
    "data/entities.json", "data/units.jsonl", "data/occurrences.jsonl", "data/links.jsonl",
    "data/evidence.jsonl", "data/parallels.jsonl", "data/corrections.jsonl", "data/reviews.jsonl",
}
SEARCH_INDEX_VERSION = "fts5-trigram-v1+web-substring-v1"
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:\-]{0,199}$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
ZIP_DATE = (1980, 1, 1, 0, 0, 0)


class PackageError(Exception):
    def __init__(self, errors):
        self.errors = errors if isinstance(errors, list) else [errors]
        super().__init__("; ".join(self.errors[:10]))


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_text(s: str) -> str:
    return sha256_bytes(s.encode("utf-8"))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def read_jsonl(b: bytes, name: str) -> list[dict]:
    out = []
    for i, line in enumerate(b.decode("utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:  # taxmin bilan tuzatilmaydi — xato qaytariladi
            raise PackageError(f"{name}:{i}: JSON xato: {e.msg}") from None
        if not isinstance(obj, dict):
            raise PackageError(f"{name}:{i}: obyekt kutilgan")
        out.append(obj)
    return out


def dump_jsonl(rows: list[dict]) -> bytes:
    return "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows).encode("utf-8")


# ---------------------------------------------------------------- validatsiya

def _status_errors(where: str, statuses: dict) -> list[str]:
    errs = []
    if not isinstance(statuses, dict):
        return [f"{where}: statuses obyekt bo'lishi kerak"]
    for k, v in statuses.items():
        if k not in model.STATUS_KEYS:
            errs.append(f"{where}: noma'lum holat maydoni {k}")
        elif v not in model.STATUS_VALUES:
            errs.append(f"{where}: {k}={v!r} ruxsat etilmagan qiymat")
    return errs


def validate_rights(rights: list) -> list[str]:
    errs = []
    if not isinstance(rights, list) or not rights:
        return ["rights: kamida bitta huquq yozuvi kerak"]
    for i, r in enumerate(rights):
        w = f"rights[{i}]"
        if r.get("rights_status") not in model.RIGHTS_STATUS:
            errs.append(f"{w}: rights_status noto'g'ri")
        if r.get("applies_to") not in model.RIGHTS_APPLIES_TO:
            errs.append(f"{w}: applies_to noto'g'ri")
        for k in ("redistribution_allowed", "commercial_use_allowed"):
            if r.get(k) not in (True, False, None):
                errs.append(f"{w}: {k} true/false/null bo'lishi kerak")
        if r.get("rights_status") in ("unknown", "restricted") and r.get("redistribution_allowed") is True:
            errs.append(f"{w}: unknown/restricted huquqda redistribution_allowed=true bo'lishi mumkin emas")
        if r.get("rights_status") == "approved" and not (r.get("license_id") or r.get("permission_evidence")):
            errs.append(f"{w}: approved uchun license_id yoki permission_evidence kerak")
    return errs


def validate_manifest(m: dict) -> list[str]:
    errs = []
    for k in ("package_id", "kind", "package_version", "schema_version", "title", "rights",
              "normalization_version", "compatible_app_versions"):
        if k not in m:
            errs.append(f"manifest: {k} yo'q")
    if errs:
        return errs
    if not ID_RE.match(m["package_id"]):
        errs.append("manifest: package_id formati noto'g'ri")
    if m["kind"] not in model.PACKAGE_KINDS:
        errs.append("manifest: kind noto'g'ri")
    if not VERSION_RE.match(str(m["package_version"])):
        errs.append("manifest: package_version X.Y.Z bo'lishi kerak")
    if m["schema_version"].split(".")[0] != model.SCHEMA_VERSION.split(".")[0]:
        errs.append(f"manifest: schema_version {m['schema_version']} mos emas")
    if m["normalization_version"] != NORMALIZATION_VERSION:
        errs.append(f"manifest: normalization_version {m['normalization_version']} bu dastur bilan mos emas")
    if m["kind"] in ("base_book", "commentary"):
        for k in ("work_id", "edition_id", "author_ids", "source_metadata", "attribution"):
            if k not in m:
                errs.append(f"manifest: {k} yo'q")
    if m["kind"] == "commentary":
        req = m.get("requires_for_linked_reading")
        if not isinstance(req, list):
            errs.append("manifest: commentary uchun requires_for_linked_reading ro'yxati kerak")
        else:
            for i, r in enumerate(req):
                for k in ("target_work_id", "target_edition_id", "compatible_package_versions"):
                    if k not in r:
                        errs.append(f"requires_for_linked_reading[{i}]: {k} yo'q")
    if m["kind"] == "selection" and not isinstance(m.get("contains"), list):
        errs.append("manifest: selection uchun contains ro'yxati kerak")
    errs += validate_rights(m["rights"])
    return errs


def validate_unit(u: dict, work_id: str, edition_id: str) -> list[str]:
    w = f"unit {u.get('unit_id')}"
    errs = []
    for k in ("unit_id", "seq", "unit_type", "text_kind", "text_ar", "current_text_sha256", "statuses"):
        if k not in u:
            errs.append(f"{w}: {k} yo'q")
    if errs:
        return errs
    if not ID_RE.match(u["unit_id"]):
        errs.append(f"{w}: unit_id formati noto'g'ri")
    if u.get("work_id", work_id) != work_id or u.get("edition_id", edition_id) != edition_id:
        errs.append(f"{w}: boshqa asar/nashrga tegishli")
    if u["unit_type"] not in model.UNIT_TYPES:
        errs.append(f"{w}: unit_type noto'g'ri")
    if u.get("attribution_kind", "unknown") not in model.ATTRIBUTION_KINDS:
        errs.append(f"{w}: attribution_kind noto'g'ri")
    if u["text_kind"] not in model.TEXT_KINDS:
        errs.append(f"{w}: text_kind noto'g'ri")
    if sha256_text(u["text_ar"]) != u["current_text_sha256"]:
        errs.append(f"{w}: current_text_sha256 joriy matnga mos emas")
    errs += _status_errors(w, u["statuses"])
    for n in u.get("numbers", []):
        if n.get("number_status") not in model.STATUS_VALUES:
            errs.append(f"{w}: number_status noto'g'ri")
        if n.get("page") in ("0", 0):
            errs.append(f"{w}: noma'lum sahifa 0 bilan yozilmaydi — null va sabab bering")
        if n.get("number_int") is not None and str(n.get("number_text")) != str(n.get("number_int")):
            errs.append(f"{w}: number_int faqat yagona butun son uchun (guruh '{n.get('number_text')}' integerga aylanmaydi)")
    for i in u.get("identifiers", []):
        if not i.get("namespace") or i.get("value") is None:
            errs.append(f"{w}: identifier namespace/value kerak")
    for g in u.get("gradings", []):
        if not g.get("scholar_person_id") or not g.get("source_ref"):
            errs.append(f"{w}: hukmda olim va manba majburiy")
    for t in u.get("topics", []):
        if t.get("origin") not in model.TOPIC_ORIGINS:
            errs.append(f"{w}: mavzu origin noto'g'ri")
    for n in u.get("narrators", []):
        if n.get("narrator_identity_status") not in model.STATUS_VALUES:
            errs.append(f"{w}: narrator_identity_status noto'g'ri")
        if n.get("fallback_person_id") and n.get("fallback_person_id") == n.get("terminal_person_id"):
            errs.append(f"{w}: zaxira shaxs terminal shaxs bilan birlashtirilmaydi")
    return errs


def validate_occurrence(o: dict) -> list[str]:
    w = f"occurrence {o.get('occurrence_id')}"
    errs = []
    for k in ("occurrence_id", "seq", "link_kind", "lemma_kind", "text_ar", "current_text_sha256",
              "scope", "segments", "statuses"):
        if k not in o:
            errs.append(f"{w}: {k} yo'q")
    if errs:
        return errs
    if o["link_kind"] not in model.COMMENTARY_LINK_KINDS:
        errs.append(f"{w}: link_kind noto'g'ri")
    if o["lemma_kind"] not in model.LEMMA_KINDS:
        errs.append(f"{w}: lemma_kind noto'g'ri")
    if o["lemma_kind"] == "iqtibos_yoq" and o.get("lemma_text"):
        errs.append(f"{w}: iqtibos_yoq joyida lemma matni bo'lmaydi")
    if o["scope"] not in model.COMMENTARY_SCOPES:
        errs.append(f"{w}: scope noto'g'ri")
    if sha256_text(o["text_ar"]) != o["current_text_sha256"]:
        errs.append(f"{w}: current_text_sha256 joriy matnga mos emas")
    st = o["statuses"]
    errs += _status_errors(w, st)
    if o["scope"] == "full_section" and st.get("commentary_end_status") != "verified":
        errs.append(f"{w}: tugash chegarasi tasdiqlanmagan bo'lsa full_section bo'lmaydi")
    n = len(o["text_ar"])
    for s in o["segments"]:
        if s.get("role") not in model.SEGMENT_ROLES:
            errs.append(f"{w}: segment role noto'g'ri")
        if not (0 <= s.get("start", -1) < s.get("end", -1) <= n):
            errs.append(f"{w}: segment chegarasi matndan tashqarida")
        if s.get("role") == "quoted_scholar" and not s.get("person_id"):
            errs.append(f"{w}: naql qilingan olim noma'lum bo'lsa role=attribution_unresolved bo'lsin")
    return errs


# ---------------------------------------------------------------- yaratish

def build_package(src_dir: Path, out_dir: Path) -> Path:
    """Manba papkasidan (package.json + data/*) deterministik .hmz yaratadi."""
    src_dir, out_dir = Path(src_dir), Path(out_dir)
    manifest = json.loads((src_dir / "package.json").read_text("utf-8"))
    files: dict[str, bytes] = {}
    for name in ("LICENSE", "ATTRIBUTION"):
        files[name] = (src_dir / name).read_bytes()
    entities = json.loads((src_dir / "data" / "entities.json").read_text("utf-8"))
    files["data/entities.json"] = json.dumps(entities, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8")

    units = occurrences = []
    if manifest["kind"] == "base_book":
        units = read_jsonl((src_dir / "data" / "units.jsonl").read_bytes(), "units.jsonl")
        for u in units:
            u.setdefault("work_id", manifest["work_id"])
            u.setdefault("edition_id", manifest["edition_id"])
            u["current_text_sha256"] = sha256_text(u["text_ar"])
            u["normalized_text_sha256"] = sha256_text(normalize(u["text_ar"]))
        files["data/units.jsonl"] = dump_jsonl(units)
    if manifest["kind"] == "commentary":
        occurrences = read_jsonl((src_dir / "data" / "occurrences.jsonl").read_bytes(), "occurrences.jsonl")
        for o in occurrences:
            o.setdefault("work_id", manifest["work_id"])
            o.setdefault("edition_id", manifest["edition_id"])
            o["current_text_sha256"] = sha256_text(o["text_ar"])
        files["data/occurrences.jsonl"] = dump_jsonl(occurrences)
        files["data/links.jsonl"] = dump_jsonl(read_jsonl((src_dir / "data" / "links.jsonl").read_bytes(), "links.jsonl"))
    for opt in ("evidence", "parallels", "corrections", "reviews"):
        p = src_dir / "data" / f"{opt}.jsonl"
        if p.exists():
            files[f"data/{opt}.jsonl"] = dump_jsonl(read_jsonl(p.read_bytes(), p.name))

    coverage = json.loads((src_dir / "COVERAGE.json").read_text("utf-8")) if (src_dir / "COVERAGE.json").exists() else {}
    coverage["computed"] = compute_coverage(manifest["kind"], units, occurrences,
                                            read_jsonl(files.get("data/links.jsonl", b""), "links"))
    files["COVERAGE.json"] = json.dumps(coverage, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8")

    manifest["schema_version"] = model.SCHEMA_VERSION
    manifest["normalization_version"] = NORMALIZATION_VERSION
    manifest["search_index_version"] = SEARCH_INDEX_VERSION
    manifest["provides_units"] = len(units) if units else len(occurrences)
    manifest["coverage"] = coverage["computed"]
    manifest["file_hashes"] = {k: sha256_bytes(v) for k, v in sorted(files.items())}
    data_bytes = sum(len(v) for v in files.values())
    manifest["installed_bytes"] = data_bytes * 3  # matn + qidiruv nusxasi + indeks (taxminiy, o'lchanmagan)
    manifest["temporary_space_bytes"] = data_bytes * 2
    manifest["compressed_bytes"] = None  # ZIP o'z hajmini ichida saqlay olmaydi; tashqi *.manifest.json'da
    errs = validate_manifest(manifest)
    if errs:
        raise PackageError(errs)
    files["package.json"] = json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8")
    sums = "".join(f"{sha256_bytes(v)}  {k}\n" for k, v in sorted(files.items()))
    files["SHA256SUMS"] = sums.encode("utf-8")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name in sorted(files):
            zi = zipfile.ZipInfo(name, ZIP_DATE)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            zf.writestr(zi, files[name])
    blob = buf.getvalue()
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{manifest['package_id']}-{manifest['package_version']}{PACKAGE_EXT}"
    out.write_bytes(blob)
    sidecar = dict(manifest)
    sidecar["compressed_bytes"] = len(blob)
    sidecar["package_sha256"] = sha256_bytes(blob)
    sidecar["file_name"] = out.name
    (out_dir / f"{manifest['package_id']}-{manifest['package_version']}.manifest.json").write_text(
        json.dumps(sidecar, ensure_ascii=False, sort_keys=True, indent=1), "utf-8")
    # selftest: yaratilgan paket o'qiladi va tekshiruvdan o'tadi
    open_package(out)
    return out


def build_selection(manifests: list[dict], selection_id: str, title: dict, version: str, out_dir: Path,
                    package_files: list[Path] | None = None) -> Path:
    """'Kitob + tanlangan sharhlar' yig'masi. package_files berilsa, ichki paketlar ZIPga qo'shiladi."""
    m = {
        "package_id": selection_id, "kind": "selection", "package_version": version,
        "schema_version": model.SCHEMA_VERSION, "normalization_version": NORMALIZATION_VERSION,
        "title": title, "compatible_app_versions": f">={model.APP_VERSION}",
        "contains": [{"package_id": x["package_id"], "package_version": x["package_version"],
                      "package_sha256": x["package_sha256"], "kind": x["kind"]} for x in manifests],
        "rights": [{"applies_to": "metadata", "rights_status": "approved", "license_id": "CC0-1.0",
                    "redistribution_allowed": True, "commercial_use_allowed": True,
                    "required_attribution": "ichki paketlarning ATTRIBUTION fayllariga qarang"}],
    }
    errs = validate_manifest(m)
    if errs:
        raise PackageError(errs)
    files = {
        "package.json": json.dumps(m, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8"),
        "LICENSE": "Yig'ma manifesti CC0-1.0. Ichki paketlar o'z LICENSE fayliga ega.\n".encode("utf-8"),
        "ATTRIBUTION": "Ichki paketlarning ATTRIBUTION fayllariga qarang.\n".encode("utf-8"),
        "COVERAGE.json": b"{}",
    }
    for p in package_files or []:
        files[f"packages/{Path(p).name}"] = Path(p).read_bytes()
    files["SHA256SUMS"] = "".join(f"{sha256_bytes(v)}  {k}\n" for k, v in sorted(files.items())).encode()
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{selection_id}-{version}{PACKAGE_EXT}"
    with zipfile.ZipFile(out, "w") as zf:
        for name in sorted(files):
            zi = zipfile.ZipInfo(name, ZIP_DATE)
            zi.compress_type = zipfile.ZIP_STORED if name.startswith("packages/") else zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            zf.writestr(zi, files[name])
    return out


def compute_coverage(kind: str, units: list[dict], occurrences: list[dict], links: list[dict]) -> dict:
    c: dict = {"kind": kind}
    if kind == "base_book":
        by_type: dict[str, int] = {}
        by_text: dict[str, int] = {}
        nums = set()
        status_counts: dict[str, dict[str, int]] = {}
        for u in units:
            by_type[u["unit_type"]] = by_type.get(u["unit_type"], 0) + 1
            by_text[u["text_kind"]] = by_text.get(u["text_kind"], 0) + 1
            for n in u.get("numbers", []):
                if n.get("number_text") is not None:
                    nums.add((n["scheme_id"], n.get("volume"), str(n["number_text"]), n.get("variant")))
            for k, v in u.get("statuses", {}).items():
                status_counts.setdefault(k, {}).setdefault(v, 0)
                status_counts[k][v] += 1
        c.update({"source_records": len(units), "by_unit_type": by_type, "by_text_kind": by_text,
                  "distinct_printed_numbers": len(nums), "status_counts": status_counts})
    elif kind == "commentary":
        targets = {l["target_unit_id"] for l in links}
        link_status: dict[str, int] = {}
        for l in links:
            link_status[l["commentary_link_status"]] = link_status.get(l["commentary_link_status"], 0) + 1
        scopes: dict[str, int] = {}
        for o in occurrences:
            scopes[o["scope"]] = scopes.get(o["scope"], 0) + 1
        c.update({"occurrences": len(occurrences), "links": len(links),
                  "distinct_linked_units": len(targets), "link_status_counts": link_status,
                  "scope_counts": scopes,
                  "legacy_unreviewed_links": sum(1 for l in links if l.get("legacy_confidence"))})
    return c


# ---------------------------------------------------------------- o'qish

@dataclass
class Package:
    path: Path
    sha256: str
    manifest: dict
    files: dict[str, bytes] = field(repr=False)

    def jsonl(self, name: str) -> list[dict]:
        b = self.files.get(name)
        return read_jsonl(b, name) if b else []

    @property
    def entities(self) -> dict:
        b = self.files.get("data/entities.json")
        return json.loads(b) if b else {}


def open_package(path: Path, limits: Limits | None = None) -> Package:
    """Paketni xavfsiz ochib, SHA256 va sxema bo'yicha to'liq tekshiradi."""
    path = Path(path)
    blob_sha = sha256_file(path)
    errors: list[str] = []
    try:
        with zipfile.ZipFile(path) as zf:
            infos = check_zip(zf, limits)
            files = {}
            for info in infos:
                if info.is_dir():
                    continue
                n = info.filename
                if n not in ALLOWED_TOP and n not in DATA_FILES and not n.startswith("packages/"):
                    errors.append(f"ruxsat etilmagan fayl: {n}")
                    continue
                files[n] = read_member(zf, info)
    except zipfile.BadZipFile as e:
        raise PackageError(f"ZIP buzilgan: {e}") from None
    except UnsafeZip as e:
        raise PackageError(f"xavfsizlik: {e}") from None
    for req in REQUIRED_FILES:
        if req not in files:
            errors.append(f"majburiy fayl yo'q: {req}")
    if errors:
        raise PackageError(errors)
    # SHA256SUMS: har fayl ro'yxatda, ro'yxatdagi har fayl mavjud va xeshi mos
    listed = {}
    for line in files["SHA256SUMS"].decode("utf-8").splitlines():
        if line.strip():
            h, _, name = line.partition("  ")
            listed[name] = h
    present = set(files) - {"SHA256SUMS"}
    if set(listed) != present:
        errors.append(f"SHA256SUMS ro'yxati fayllarga mos emas: {sorted(set(listed) ^ present)}")
    for name, h in listed.items():
        if name in files and sha256_bytes(files[name]) != h:
            errors.append(f"xesh mos emas: {name}")
    try:
        manifest = json.loads(files["package.json"])
    except json.JSONDecodeError as e:
        raise PackageError(f"package.json JSON xato: {e.msg}") from None
    errors += validate_manifest(manifest)
    if errors:
        raise PackageError(errors)
    pkg = Package(path, blob_sha, manifest, files)
    if manifest["kind"] != "selection":
        for name, h in manifest.get("file_hashes", {}).items():
            if name not in files or sha256_bytes(files[name]) != h:
                errors.append(f"manifest file_hashes mos emas: {name}")
        errors += validate_content(pkg)
    if errors:
        raise PackageError(errors)
    return pkg


def validate_content(pkg: Package) -> list[str]:
    m = pkg.manifest
    errs: list[str] = []
    if m["kind"] == "base_book":
        seen = set()
        for u in pkg.jsonl("data/units.jsonl"):
            errs += validate_unit(u, m["work_id"], m["edition_id"])
            if u.get("unit_id") in seen:
                errs.append(f"takroriy unit_id {u.get('unit_id')}")
            seen.add(u.get("unit_id"))
            if not u.get("unit_id", "").startswith(m["edition_id"] + ":"):
                errs.append(f"unit_id nashr namespace'i bilan boshlanishi kerak: {u.get('unit_id')}")
    elif m["kind"] == "commentary":
        occ_ids = set()
        for o in pkg.jsonl("data/occurrences.jsonl"):
            errs += validate_occurrence(o)
            if o.get("occurrence_id") in occ_ids:
                errs.append(f"takroriy occurrence_id {o.get('occurrence_id')}")
            occ_ids.add(o.get("occurrence_id"))
        allowed_targets = {(r["target_work_id"], r["target_edition_id"]) for r in m.get("requires_for_linked_reading", [])}
        for l in pkg.jsonl("data/links.jsonl"):
            if l.get("occurrence_id") not in occ_ids:
                errs.append(f"link {l.get('link_id')}: noma'lum occurrence")
            if (l.get("target_work_id"), l.get("target_edition_id")) not in allowed_targets:
                errs.append(f"link {l.get('link_id')}: manifestda e'lon qilinmagan nashrga bog'lama")
            if l.get("commentary_link_status") not in model.STATUS_VALUES:
                errs.append(f"link {l.get('link_id')}: status noto'g'ri")
    return errs
