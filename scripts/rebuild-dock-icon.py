#!/usr/bin/env python3
"""Rebuild dock icon: scale by eye bbox to match Hidemium ~79.5% height."""
import struct
import zlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    "/Users/hachitech/.cursor/projects/Volumes-BuildCore-AutoTestCoreHidemium/assets/"
    "image-105e8870-4b5e-4324-915e-d4bf02d97c92.png"
)
OUT = ROOT / "build" / "icons"
UI = ROOT / "src" / "renderer" / "assets"
TMP = Path("/tmp/logo-src.png")


def read_png(path):
    data = Path(path).read_bytes()
    pos = 8
    idat = b""
    w = h = ct = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            w, h, _, ct = struct.unpack(">IIBB", chunk[:10])
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(idat)
    bpp = 4 if ct == 6 else 3
    stride = w * bpp
    rows = []
    i = 0
    prev = bytearray(stride)
    for _ in range(h):
        filt = raw[i]
        i += 1
        row = bytearray(raw[i : i + stride])
        i += stride
        if filt == 1:
            for x in range(bpp, stride):
                row[x] = (row[x] + row[x - bpp]) & 255
        elif filt == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                left = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                row[x] = (row[x] + pr) & 255
        prev = row
        if bpp == 3:
            rgba = bytearray()
            for x in range(0, stride, 3):
                rgba.extend([row[x], row[x + 1], row[x + 2], 255])
            rows.append(rgba)
        else:
            rows.append(row)
    return w, h, rows


def write_png(path, w, h, rows):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    for row in rows:
        raw.append(0)
        raw.extend(row)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    Path(path).write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 6))
        + chunk(b"IEND", b"")
    )


def is_blue(r, g, b):
    return (b >= 90 and b >= r + 25 and b >= g + 10) or (
        b >= 70 and b > r + 20 and g < 150
    )


def bbox(rows, w, h, pred=None):
    minx = miny = 10**9
    maxx = maxy = -1
    for y, row in enumerate(rows):
        for x in range(w):
            if row[x * 4 + 3] <= 10:
                continue
            if pred and not pred(x, y):
                continue
            minx = min(minx, x)
            maxx = max(maxx, x)
            miny = min(miny, y)
            maxy = max(maxy, y)
    return minx, miny, maxx, maxy


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    UI.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["sips", "-s", "format", "png", str(SRC), "--out", str(TMP)],
        stdout=subprocess.DEVNULL,
    )

    w, h, rows = read_png(TMP)
    masked = []
    for row in rows:
        nr = bytearray(len(row))
        for x in range(w):
            i = x * 4
            r, g, b = row[i], row[i + 1], row[i + 2]
            if r >= 240 and g >= 240 and b >= 240:
                continue
            if is_blue(r, g, b):
                nr[i : i + 4] = bytes((r, g, b, 255))
        masked.append(nr)

    fx0, fy0, fx1, fy1 = bbox(masked, w, h)
    fcw, fch = fx1 - fx0 + 1, fy1 - fy0 + 1

    def eye_pred(x, y):
        return not (x >= fx0 + int(fcw * 0.72) and y >= fy0 + int(fch * 0.68))

    ex0, ey0, ex1, ey1 = bbox(masked, w, h, eye_pred)
    ech = ey1 - ey0 + 1
    scale = (0.7949 * 1024) / ech
    print(f"eye_h={ech} scale={scale:.4f}")

    n = 1024
    out = [bytearray(n * 4) for _ in range(n)]
    cx = (fx0 + fx1) / 2
    cy = (fy0 + fy1) / 2
    oc = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            sx = cx + (x - oc) / scale
            sy = cy + (y - oc) / scale
            if sx < 0 or sy < 0 or sx >= w - 1 or sy >= h - 1:
                continue
            x0 = int(sx)
            y0 = int(sy)
            dx = sx - x0
            dy = sy - y0

            def pix(xx, yy):
                row = masked[yy]
                i = xx * 4
                return row[i], row[i + 1], row[i + 2], row[i + 3]

            p00, p10, p01, p11 = (
                pix(x0, y0),
                pix(x0 + 1, y0),
                pix(x0, y0 + 1),
                pix(x0 + 1, y0 + 1),
            )
            a = (
                p00[3] * (1 - dx) * (1 - dy)
                + p10[3] * dx * (1 - dy)
                + p01[3] * (1 - dx) * dy
                + p11[3] * dx * dy
            )
            if a < 128:
                continue
            r = int(
                p00[0] * (1 - dx) * (1 - dy)
                + p10[0] * dx * (1 - dy)
                + p01[0] * (1 - dx) * dy
                + p11[0] * dx * dy
            )
            g = int(
                p00[1] * (1 - dx) * (1 - dy)
                + p10[1] * dx * (1 - dy)
                + p01[1] * (1 - dx) * dy
                + p11[1] * dx * dy
            )
            b = int(
                p00[2] * (1 - dx) * (1 - dy)
                + p10[2] * dx * (1 - dy)
                + p01[2] * (1 - dx) * dy
                + p11[2] * dx * dy
            )
            if not is_blue(r, g, b):
                continue
            i = x * 4
            out[y][i : i + 4] = bytes((r, g, b, 255))

    fx0, fy0, fx1, fy1 = bbox(out, n, n)
    ex0, ey0, ex1, ey1 = bbox(
        out,
        n,
        n,
        lambda x, y: not (
            x >= fx0 + int((fx1 - fx0 + 1) * 0.72)
            and y >= fy0 + int((fy1 - fy0 + 1) * 0.68)
        ),
    )
    print(
        f"final eye_h%={(ey1 - ey0 + 1) / n * 100:.1f} "
        f"full_h%={(fy1 - fy0 + 1) / n * 100:.1f}"
    )

    write_png(OUT / "icon.png", n, n, out)
    write_png(OUT / "dock-icon.png", n, n, out)
    write_png(UI / "app-logo.png", n, n, out)

    for size in (16, 32, 64, 128, 256, 512):
        subprocess.check_call(
            [
                "sips",
                "-z",
                str(size),
                str(size),
                str(OUT / "icon.png"),
                "--out",
                str(OUT / f"icon-{size}.png"),
            ],
            stdout=subprocess.DEVNULL,
        )
    subprocess.check_call(
        [
            "sips",
            "-z",
            "32",
            "32",
            str(OUT / "icon.png"),
            "--out",
            str(UI / "app-logo-32.png"),
        ],
        stdout=subprocess.DEVNULL,
    )
    print("done", (OUT / "dock-icon.png").stat().st_size)


if __name__ == "__main__":
    main()
