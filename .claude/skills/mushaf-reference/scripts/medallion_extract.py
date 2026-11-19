"""Write the verse-medallion template the copy step would use (item 45 on the launch page).

It takes ONE medallion, the Complex's pale green verse-end mark, from one page of the Complex's
own 1441H Hafs drawing files, and fits a straight line that places it from each verse number on
our pinned pages: one line for the regular pages and one for pages 1 and 2, which draw the mark
smaller. The copy step then needs no drawing file: only this template.

Usage:
  python3 -I medallion_extract.py <out.json> <template.ai> <template_url> <template_page> \
      --regular <pinned.svg>:<drawing.svg> [...] --small <pinned.svg>:<drawing.svg> [...]

  template.ai     the drawing file the shape is taken from (only hashed, so the source is named)
  template_url    where that file was downloaded from
  template_page   its page number
  pinned:drawing  a raw pinned page and the same page of the drawing files, converted with
                  `pdftocairo -svg`. The template's own page must be the first --regular pair.

Prints counts and fit quality only.
"""
import hashlib
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from medallion_offsets import fit, path_bounds  # noqa: E402
from medallion_swap_trial import medallions  # noqa: E402

HEIGHT = 547.086  # the drawing files' page height in points; the marker frame's y runs up from it
NUM = re.compile(r"-?\d+(?:\.\d+)?(?:e-?\d+)?")
NUMERAL = re.compile(r'<g transform="translate\(([-\d.]+)[ ,]([-\d.]+)\)" ayah:x[^>]*><path d="([^"]*)"')


def numeral_centres(pinned):
    out = []
    for tx, ty, d in NUMERAL.findall(pinned):
        x0, y0, x1, y1 = path_bounds(d)
        out.append((float(tx) + (x0 + x1) / 2, float(ty) + (y0 + y1) / 2))
    return out


def relative(med):
    """The medallion's outline with its own centre at 0,0 (marker frame, y up)."""
    out, pair = [], []
    for tok in re.findall(r"[MLCZ]|" + NUM.pattern, med["d"]):
        if tok in "MLCZ":
            out.append(tok)
            continue
        pair.append(float(tok))
        if len(pair) == 2:
            out.append(f"{pair[0] - med['cx']:.3f} {pair[1] - med['cy']:.3f}")
            pair = []
    return " ".join(out).replace(" M", "M").replace(" L", "L").replace(" C", "C").replace(" Z", "Z")


def measure(pairs, label):
    """Fit medallion-minus-numeral as a + b*x + c*y over every verse end of the pairs."""
    rows, dxs, dys, widths, first = [], [], [], [], None
    for pinned_path, drawing_path in pairs:
        meds = medallions(open(drawing_path, encoding="utf-8").read(), HEIGHT)
        centres = numeral_centres(open(pinned_path, encoding="utf-8").read())
        if len(meds) != len(centres):
            sys.exit(f'ev=error msg="{pinned_path}: {len(centres)} verse numbers but {len(meds)} medallions"')
        first = first or meds[0]
        widths += [m["w"] for m in meds]
        for cx, cy in centres:
            med = min(meds, key=lambda m: math.hypot(m["cx"] - cx, m["cy"] - cy))
            rows.append((1.0, cx, cy))
            dxs.append(med["cx"] - cx)
            dys.append(med["cy"] - cy)
    line = {"fittedOn": len(dxs)}
    for name, vals in (("dx", dxs), ("dy", dys)):
        coef = fit(rows, vals)
        left = max(abs(v - (coef[0] + coef[1] * r[1] + coef[2] * r[2])) for v, r in zip(vals, rows))
        line[name] = [round(c, 6) for c in coef]
        print(f"ev=fit pages={label} which={name} verses={len(vals)} worst_left_over={left:.3f}")
    return line, first, sum(widths) / len(widths)


def main():
    out_path, ai_path, url, tpl_page = sys.argv[1:5]
    groups, key = {"--regular": [], "--small": []}, None
    for a in sys.argv[5:]:
        if a in groups:
            key = a
        else:
            groups[key].append(a.split(":"))
    regular, template, regular_w = measure(groups["--regular"], "regular")
    small, _, small_w = measure(groups["--small"], "small")
    small["scale"] = round(small_w / regular_w, 4)
    small["pages"] = [1, 2]
    doc = {
        "about": "The Complex's own verse-end medallion, taken unaltered from one page of its free "
                 "1441H Hafs drawing files, and the lines that place it from each verse number. "
                 "Written by .claude/skills/mushaf-reference/scripts/medallion_extract.py; do not edit by hand.",
        "source": {"url": url, "page": int(tpl_page),
                   "sha256": hashlib.sha256(open(ai_path, "rb").read()).hexdigest(),
                   "which": "the first medallion in the file"},
        "fill": "#bfe8c1",
        "width": round(template["w"], 3),
        "height": round(template["h"], 3),
        "d": relative(template),
        "how": "medallion centre = numeral centre + (a + b*x + c*y) for dx and for dy, x and y the "
               "numeral centre; on the small pages the shape is also scaled by small.scale",
        "regular": regular,
        "small": small,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"ev=written small_scale={small['scale']} d_chars={len(doc['d'])}")


if __name__ == "__main__":
    main()
