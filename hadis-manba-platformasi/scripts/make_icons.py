"""PWA ikonkalari: yashil fon, oq ochiq kitob (yozuvsiz). Tashqi kutubxonasiz PNG."""
import struct
import zlib
from pathlib import Path

GREEN, WHITE, LINE = (29, 92, 74), (255, 255, 255), (200, 220, 212)


def pixel(x, y):
    # 0..1 koordinatalar; markazda ochiq kitob: ikki sahifa
    if 0.18 <= y <= 0.78:
        left = 0.14 <= x <= 0.49 and y >= 0.22 + (0.49 - x) * 0.12
        right = 0.51 <= x <= 0.86 and y >= 0.22 + (x - 0.51) * 0.12
        if left or right:
            for ly in (0.36, 0.46, 0.56, 0.66):
                if abs(y - ly) < 0.012 and (0.2 <= x <= 0.44 or 0.56 <= x <= 0.8):
                    return LINE
            return WHITE
    return GREEN


def png(size, path):
    raw = b"".join(b"\x00" + b"".join(bytes(pixel((i + .5) / size, (j + .5) / size)) for i in range(size))
                   for j in range(size))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(data)


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "web" / "ikonkalar"
    out.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "ikonka-192.png"), (512, "ikonka-512.png"), (180, "apple-touch-icon.png")):
        png(size, out / name)
