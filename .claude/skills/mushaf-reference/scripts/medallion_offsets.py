"""Item 45: is the Complex's medallion always at the same place relative to its numeral?
If so, the copy step can place it from the pinned page alone, with no drawing file.

Usage: python3 -I medallion_offsets.py <pinned.svg> <drawing.svg> <page_height_pts>
Prints, per verse end, the medallion centre minus the numeral's centre, the spread, and a
straight-line fit of the offset against the numeral's place with what the line leaves over.
"""
import math
import re
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from medallion_swap_trial import medallions  # noqa: E402

TOK = re.compile(r"[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?")
ARGS = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6, "s": 4, "q": 4, "t": 2, "z": 0}


def path_bounds(d):
    """Bounds of every end and control point, absolute. Good enough for a centre."""
    xs, ys = [], []
    x = y = sx = sy = 0.0
    cmd = None
    toks = TOK.findall(d)
    i = 0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in "Zz":
                x, y = sx, sy
            continue
        n = ARGS[cmd.lower()]
        a = [float(v) for v in toks[i:i + n]]
        i += n
        rel = cmd.islower()
        c = cmd.lower()
        if c == "h":
            x = x + a[0] if rel else a[0]
        elif c == "v":
            y = y + a[0] if rel else a[0]
        else:
            pts = [(a[k], a[k + 1]) for k in range(0, n, 2)]
            for px, py in pts:
                xs.append(px + x if rel else px)
                ys.append(py + y if rel else py)
            ex, ey = pts[-1]
            x, y = (x + ex, y + ey) if rel else (ex, ey)
            if c == "m":
                sx, sy = x, y
                cmd = "l" if rel else "L"
        xs.append(x)
        ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def main():
    pinned = open(sys.argv[1], encoding="utf-8").read()
    drawing = open(sys.argv[2], encoding="utf-8").read()
    height = float(sys.argv[3])
    meds = medallions(drawing, height)
    groups = re.findall(r'<g transform="translate\(([-\d.]+)[ ,]([-\d.]+)\)" ayah:x[^>]*><path d="([^"]*)"', pinned)
    dxs, dys, centres = [], [], []
    for tx, ty, d in groups:
        x0, y0, x1, y1 = path_bounds(d)
        cx, cy = float(tx) + (x0 + x1) / 2, float(ty) + (y0 + y1) / 2
        centres.append((cx, cy))
        med = min(meds, key=lambda m: math.hypot(m["cx"] - cx, m["cy"] - cy))
        dxs.append(med["cx"] - cx)
        dys.append(med["cy"] - cy)
        print(f"numeral_centre {cx:7.2f},{cy:7.2f}  medallion_minus_numeral {dxs[-1]:+.3f},{dys[-1]:+.3f}  numeral_width {x1 - x0:.2f}")
    print(f"ev=offset n={len(dxs)} dx_min={min(dxs):+.3f} dx_max={max(dxs):+.3f} dy_min={min(dys):+.3f} dy_max={max(dys):+.3f}")
    # fit each offset as a + b*x + c*y; what is left over says whether the numeral alone places the mark
    for name, vals in (("dx", dxs), ("dy", dys)):
        coef = fit([(1.0, cx, cy) for cx, cy in centres], vals)
        resid = [v - (coef[0] + coef[1] * cx + coef[2] * cy) for v, (cx, cy) in zip(vals, centres)]
        print(f"ev=fit which={name} a={coef[0]:+.4f} b={coef[1]:+.6f} c={coef[2]:+.6f} worst_left_over={max(abs(r) for r in resid):.3f}")


def fit(rows, ys):
    """Least squares by the normal equations; three unknowns, so plain Gauss is enough."""
    n = len(rows[0])
    m = [[sum(r[i] * r[j] for r in rows) for j in range(n)] + [sum(r[i] * y for r, y in zip(rows, ys))] for i in range(n)]
    for i in range(n):
        p = max(range(i, n), key=lambda k: abs(m[k][i]))
        m[i], m[p] = m[p], m[i]
        for k in range(n):
            if k != i:
                f = m[k][i] / m[i][i]
                m[k] = [a - f * b for a, b in zip(m[k], m[i])]
    return [m[i][n] / m[i][i] for i in range(n)]


if __name__ == "__main__":
    main()
