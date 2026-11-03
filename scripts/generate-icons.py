#!/usr/bin/env python3
"""Generate Attendly "Obsidian Academic" PWA icons without image libraries.

Deep obsidian surface with a muted-teal calendar-check glyph. No gradients,
one accent. Produces deterministic RGBA PNGs:
    python3 scripts/generate-icons.py
Outputs are committed so Vercel needs no build-time image tooling.
"""
from __future__ import annotations

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
OBSIDIAN = (9, 13, 20)        # #090D14
TEAL = (56, 184, 165)         # #38B8A5


def crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc32(tag + data))


def segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def inside_rounded_rect(u: float, v: float, x0: float, y0: float, x1: float, y1: float, r: float) -> bool:
    cx = min(max(u, x0 + r), x1 - r)
    cy = min(max(v, y0 + r), y1 - r)
    if x0 <= u <= x1 and y0 <= v <= y1:
        return True
    return math.hypot(u - cx, v - cy) <= r


def write_png(path: str, size: int, maskable: bool = False, opaque: bool = False) -> None:
    rows = bytearray()
    radius = 0.22
    glyph_scale = 0.62 if maskable else 1.0  # maskable glyph survives platform masks

    for y in range(size):
        rows.append(0)  # PNG filter: none
        v = (y + 0.5) / size
        for x in range(size):
            u = (x + 0.5) / size

            # Rounded obsidian tile; maskable / apple-touch icons are full-bleed.
            inside = True
            alpha = 255
            if not maskable and not opaque:
                dx = min(u, 1 - u)
                dy = min(v, 1 - v)
                if dx < radius and dy < radius:
                    inside = math.hypot(radius - dx, radius - dy) <= radius
                if not inside:
                    alpha = 0

            r, g, b = OBSIDIAN

            # Glyph coordinate space (scaled down for maskable).
            gu = (u - 0.5) / glyph_scale + 0.5
            gv = (v - 0.5) / glyph_scale + 0.5

            outer = inside_rounded_rect(gu, gv, 0.20, 0.25, 0.80, 0.78, 0.07)
            inner = inside_rounded_rect(gu, gv, 0.235, 0.285, 0.765, 0.745, 0.035)
            outline = outer and not inner

            top_bar = 0.20 <= gu <= 0.80 and 0.375 <= gv <= 0.405
            left_ring = segment_distance(gu, gv, 0.33, 0.18, 0.33, 0.27) < 0.018
            right_ring = segment_distance(gu, gv, 0.67, 0.18, 0.67, 0.27) < 0.018
            check = min(
                segment_distance(gu, gv, 0.355, 0.555, 0.455, 0.655),
                segment_distance(gu, gv, 0.455, 0.655, 0.655, 0.455),
            ) < 0.026

            if inside and (outline or top_bar or left_ring or right_ring or check):
                r, g, b = TEAL

            rows.extend((r, g, b, alpha))

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    data = header + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(data)
    print(f"wrote {path} ({size}x{size}, maskable={maskable}, opaque={opaque})")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    write_png(os.path.join(OUT_DIR, "icon-192.png"), 192)
    write_png(os.path.join(OUT_DIR, "icon-512.png"), 512)
    write_png(os.path.join(OUT_DIR, "icon-maskable-512.png"), 512, maskable=True, opaque=True)
    write_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), 180, opaque=True)


if __name__ == "__main__":
    main()
