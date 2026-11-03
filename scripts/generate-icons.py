#!/usr/bin/env python3
"""Generate Attendly PWA icons without third-party image libraries.

Produces crisp, deterministic PNGs (RGBA) for the web app manifest. Run with:
    python3 scripts/generate-icons.py
The output lives in public/icons/ and is committed so Vercel needs no build-time
image tooling.
"""
from __future__ import annotations

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
ACCENT_A = (139, 124, 255)  # #8B7CFF
ACCENT_B = (84, 214, 208)   # #54D6D0


def crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc32(tag + data))


def write_png(path: str, size: int, maskable: bool = False) -> None:
    rows = bytearray()
    radius = 0.22
    # Glyph is smaller on maskable icons so it survives platform masks.
    glyph_scale = 0.62 if maskable else 1.0

    def segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

    for y in range(size):
        rows.append(0)  # PNG filter: none
        v = (y + 0.5) / size
        for x in range(size):
            u = (x + 0.5) / size

            # Rounded-square background (maskable icons are full-bleed).
            inside = True
            alpha = 255
            if not maskable:
                dx = min(u, 1 - u)
                dy = min(v, 1 - v)
                if dx < radius and dy < radius:
                    inside = math.hypot(radius - dx, radius - dy) <= radius
                if not inside:
                    alpha = 0

            t = max(0.0, min(1.0, (u + v) / 2))
            r = int(ACCENT_A[0] + (ACCENT_B[0] - ACCENT_A[0]) * t)
            g = int(ACCENT_A[1] + (ACCENT_B[1] - ACCENT_A[1]) * t)
            b = int(ACCENT_A[2] + (ACCENT_B[2] - ACCENT_A[2]) * t)

            gu = (u - 0.5) / glyph_scale + 0.5
            gv = (v - 0.5) / glyph_scale + 0.5
            stroke = 0.055
            d = min(
                segment_distance(gu, gv, 0.27, 0.78, 0.5, 0.22),
                segment_distance(gu, gv, 0.73, 0.78, 0.5, 0.22),
                segment_distance(gu, gv, 0.365, 0.60, 0.635, 0.60),
            )
            if inside and d < stroke:
                r, g, b = 255, 255, 255
            elif inside and math.hypot(gu - 0.5, gv - 0.22) < 0.045:
                r, g, b = 255, 255, 255

            rows.extend((r, g, b, alpha))

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    data = header + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(data)
    print(f"wrote {path} ({size}x{size}, maskable={maskable})")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    write_png(os.path.join(OUT_DIR, "icon-192.png"), 192)
    write_png(os.path.join(OUT_DIR, "icon-512.png"), 512)
    write_png(os.path.join(OUT_DIR, "icon-maskable-512.png"), 512, maskable=True)
    write_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), 180)


if __name__ == "__main__":
    main()
