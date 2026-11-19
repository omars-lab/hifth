"""List the tinted medallions in a drawing file converted with `pdftocairo -svg`,
and check whether they are all the same shape.

Usage: python3 -I medallion_list.py <converted.svg> [--fill 'rgb(75%, 90.830994%, 75.784302%)']

Prints, per tinted path: its bounds, its size, and a fingerprint of the shape moved to
its own origin. Paths whose fingerprints match are the same drawing placed twice.
"""
import hashlib
import re
import sys

NUM = re.compile(r"-?\d+(?:\.\d+)?(?:e-?\d+)?")


def bounds(d):
    nums = [float(n) for n in NUM.findall(d)]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def fingerprint(d, x0, y0, places=1):
    """The path moved to its own origin, rounded, hashed. Works because pdftocairo
    writes absolute M/L/C/Z commands with x,y pairs only."""
    out = []
    pair = []
    for tok in re.findall(r"[MLCZ]|" + NUM.pattern, d):
        if tok in "MLCZ":
            out.append(tok)
            continue
        pair.append(float(tok))
        if len(pair) == 2:
            out.append(f"{round(pair[0] - x0, places)},{round(pair[1] - y0, places)}")
            pair = []
    return hashlib.sha1(" ".join(out).encode()).hexdigest()[:10], len(out)


def main():
    path = sys.argv[1]
    fill = "rgb(75%, 90.830994%, 75.784302%)"
    if "--fill" in sys.argv:
        fill = sys.argv[sys.argv.index("--fill") + 1]
    svg = open(path, encoding="utf-8").read()
    rows = []
    for m in re.finditer(r"<path ([^>]*)>", svg):
        attrs = m.group(1)
        if f'fill="{fill}"' not in attrs:
            continue
        d = re.search(r' d="([^"]*)"', attrs).group(1)
        tr = re.search(r'transform="([^"]*)"', attrs)
        x0, y0, x1, y1 = bounds(d)
        fp, n = fingerprint(d, x0, y0)
        rows.append((x0, y0, x1 - x0, y1 - y0, fp, n, tr.group(1) if tr else ""))
    for x0, y0, w, h, fp, n, tr in rows:
        print(f"at {x0:8.3f},{y0:8.3f}  size {w:6.3f}x{h:6.3f}  shape {fp} ({n} parts)  {tr}")
    shapes = {r[4] for r in rows}
    print(f"ev=medallions count={len(rows)} distinct_shapes={len(shapes)}")


if __name__ == "__main__":
    main()
