"""Item 45 trial: put the template's ONE medallion at every verse end of a pinned page, placed
from the page's own numerals by the template's line. No drawing file is read for the page. If
the overlay against the drawing still matches, the copy step needs only the template.

Usage: python3 -I medallion_place_trial.py <pinned.svg> <template.json> <page> <out.svg>
  template.json  written by medallion_extract.py
  page           the page number; pages 1 and 2 use the template's small line and scale
"""
import json
import re
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from medallion_offsets import path_bounds  # noqa: E402
from medallion_swap_trial import RING  # noqa: E402

NUM = re.compile(r"-?\d+(?:\.\d+)?(?:e-?\d+)?")
NUMERAL = re.compile(r'<g transform="translate\(([-\d.]+)[ ,]([-\d.]+)\)" ayah:x[^>]*><path d="([^"]*)"')


def place(d, cx, cy, scale):
    out, pair = [], []
    for tok in re.findall(r"[MLCZ]|" + NUM.pattern, d):
        if tok in "MLCZ":
            out.append(tok)
            continue
        pair.append(float(tok))
        if len(pair) == 2:
            out.append(f"{cx + pair[0] * scale:.2f} {cy + pair[1] * scale:.2f}")
            pair = []
    return " ".join(out).replace(" M", "M").replace(" L", "L").replace(" C", "C").replace(" Z", "Z")


def main():
    pinned_path, tpl_path, page, out_path = sys.argv[1:5]
    pinned = open(pinned_path, encoding="utf-8").read()
    tpl = json.load(open(tpl_path, encoding="utf-8"))
    line = tpl["small"] if int(page) in tpl["small"]["pages"] else tpl["regular"]
    scale = line.get("scale", 1.0)
    centres = []
    for tx, ty, d in NUMERAL.findall(pinned):
        x0, y0, x1, y1 = path_bounds(d)
        nx, ny = float(tx) + (x0 + x1) / 2, float(ty) + (y0 + y1) / 2
        dx = line["dx"][0] + line["dx"][1] * nx + line["dx"][2] * ny
        dy = line["dy"][0] + line["dy"][1] * nx + line["dy"][2] * ny
        centres.append((nx + dx, ny + dy))
    it = iter(centres)
    last = [None]

    def replace(m):
        twin = m.group(0) == last[0]   # pages 1 and 2 draw each ring twice, one on the other
        last[0] = m.group(0)
        if twin:
            return ""
        cx, cy = next(it)
        return f'<path d="{place(tpl["d"], cx, cy, scale)}" fill="{tpl["fill"]}"/>'

    swapped = RING.sub(replace, pinned)
    left = sum(1 for _ in it)
    print(f"ev=placed page={page} numerals={len(centres)} unused={left} rings_left={len(RING.findall(swapped))}")
    open(out_path, "w", encoding="utf-8").write(swapped)


if __name__ == "__main__":
    main()
