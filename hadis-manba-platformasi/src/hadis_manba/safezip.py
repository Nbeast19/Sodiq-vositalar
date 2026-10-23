"""ZIP fayllarni xavfsiz o'qish (14-bo'lim).

Hech narsa diskka ochilmaydi va bajarilmaydi: a'zolar xotiraga cheklangan
hajmda o'qiladi. Yo'l, symlink, fayl soni va siqilish nisbati tekshiriladi.
"""
from __future__ import annotations

import stat
import zipfile
from dataclasses import dataclass

GiB = 1024 ** 3


class UnsafeZip(Exception):
    """ZIP xavfsizlik tekshiruvidan o'tmadi."""


@dataclass
class Limits:
    max_files: int = 20000
    max_total_uncompressed: int = 8 * GiB
    max_member: int = 2 * GiB
    max_ratio: int = 200          # siqilish nisbati (zip bomb belgisi)
    ratio_min_size: int = 1024 * 1024


def check_name(name: str) -> None:
    if not name or "\x00" in name:
        raise UnsafeZip(f"bo'sh yoki noto'g'ri nom: {name!r}")
    if name.startswith(("/", "\\")) or (len(name) > 1 and name[1] == ":"):
        raise UnsafeZip(f"mutlaq yo'l: {name}")
    if "\\" in name:
        raise UnsafeZip(f"teskari slesh yo'lda: {name}")
    parts = name.split("/")
    if any(p == ".." for p in parts):
        raise UnsafeZip(f"'..' bilan tashqariga chiqish: {name}")


def check_zip(zf: zipfile.ZipFile, limits: Limits | None = None) -> list[zipfile.ZipInfo]:
    limits = limits or Limits()
    infos = zf.infolist()
    if len(infos) > limits.max_files:
        raise UnsafeZip(f"fayllar soni juda ko'p: {len(infos)} > {limits.max_files}")
    total = 0
    seen = set()
    for info in infos:
        check_name(info.filename)
        if info.filename in seen:
            raise UnsafeZip(f"takroriy a'zo nomi: {info.filename}")
        seen.add(info.filename)
        mode = (info.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode):
            raise UnsafeZip(f"symlink taqiqlangan: {info.filename}")
        if info.flag_bits & 0x1:
            raise UnsafeZip(f"shifrlangan a'zo: {info.filename}")
        if info.file_size > limits.max_member:
            raise UnsafeZip(f"a'zo juda katta: {info.filename}")
        if (info.file_size > limits.ratio_min_size and info.compress_size > 0
                and info.file_size / info.compress_size > limits.max_ratio):
            raise UnsafeZip(f"siqilish nisbati shubhali (zip bomb?): {info.filename}")
        total += info.file_size
        if total > limits.max_total_uncompressed:
            raise UnsafeZip("ochilgan umumiy hajm chegaradan oshdi")
    return infos


def read_member(zf: zipfile.ZipFile, info: zipfile.ZipInfo, limit: int | None = None) -> bytes:
    """A'zoni e'lon qilingan hajmdan oshirmay o'qiydi (soxta sarlavhaga qarshi)."""
    cap = info.file_size if limit is None else min(limit, info.file_size)
    chunks = []
    got = 0
    with zf.open(info) as fh:
        while True:
            block = fh.read(1024 * 1024)
            if not block:
                break
            got += len(block)
            if got > cap:
                raise UnsafeZip(f"a'zo e'lon qilinganidan katta: {info.filename}")
            chunks.append(block)
    return b"".join(chunks)
