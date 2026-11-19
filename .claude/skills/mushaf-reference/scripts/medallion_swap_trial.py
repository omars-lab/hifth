"""Trial for item 45: take out the verse-number rings of unknown origin from a pinned page
and put another ring in each place. Rough, for looking at, not the shipped step.

Usage: python3 -I medallion_swap_trial.py <pinned.svg> <drawing.svg> <page_height_pts> <mode> <out.svg>

  pinned.svg   the pinned quran-svg page (raw upstream, before our copy step)
  drawing.svg  the Complex's drawing file for the same page, converted with pdftocairo -svg
  mode         A = the Complex's own tinted medallion, taken from the drawing file
               B = a plain ring of our own, drawn here, centred where the Complex centres his

Both modes place the new mark at the drawing file's medallion, never at the old ring.
Prints counts and sizes only.
"""
import math
import re
import sys

NUM = re.compile(r"-?\d+(?:\.\d+)?(?:e-?\d+)?")
GREEN = 'fill="rgb(75%, 90.830994%, 75.784302%)"'
TINT = "#bfe8c1"       # the same colour, written short
INK = "#231f20"        # the page's ink
RING = re.compile(r'<g transform="translate\([^)]*\) scale\([^)]*\)"><path d="m1248,4[^"]*"[^>]*/></g>')
NUMERAL = re.compile(r'<g transform="translate\(([-\d.]+)[ ,]([-\d.]+)\)" ayah:x')


def medallions(drawing, height):
    out = []
    for m in re.finditer(r"<path ([^>]*)>", drawing):
        attrs = m.group(1)
        if GREEN not in attrs:
            continue
        d = re.search(r' d="([^"]*)"', attrs).group(1)
        nums = [float(n) for n in NUM.findall(d)]
        xs, ys = nums[0::2], nums[1::2]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        if w > 25:      # the page border shares the colour
            continue
        # into the pinned page's frame: same x, y measured up from the foot
        flipped = []
        pair = []
        for tok in re.findall(r"[MLCZ]|" + NUM.pattern, d):
            if tok in "MLCZ":
                flipped.append(tok)
                continue
            pair.append(float(tok))
            if len(pair) == 2:
                flipped.append(f"{pair[0]:.2f} {height - pair[1]:.2f}")
                pair = []
        cx = (max(xs) + min(xs)) / 2
        cy = height - (max(ys) + min(ys)) / 2
        out.append({"d": " ".join(flipped).replace(" M", "M").replace(" L", "L").replace(" C", "C").replace(" Z", "Z"),
                    "cx": cx, "cy": cy, "w": w, "h": h})
    return out


def main():
    pinned_path, drawing_path, height, mode, out_path = sys.argv[1:6]
    height = float(height)
    pinned = open(pinned_path, encoding="utf-8").read()
    drawing = open(drawing_path, encoding="utf-8").read()
    found = RING.findall(pinned)
    # page 2 draws every ring twice at the same place; a copy right after its twin is one ring
    rings = [r for i, r in enumerate(found) if i == 0 or r != found[i - 1]]
    if len(rings) != len(found):
        print(f"ev=duplicates dropped={len(found) - len(rings)}")
    numerals = [(float(a), float(b)) for a, b in NUMERAL.findall(pinned)]
    meds = medallions(drawing, height)
    print(f"ev=count rings={len(rings)} numerals={len(numerals)} medallions={len(meds)}")
    if not (len(rings) == len(numerals) == len(meds)):
        print("ev=error msg=\"the three counts differ; not swapping\"")
        sys.exit(2)

    # pair each numeral with its nearest medallion; every pair must be close and unique
    used = set()
    pairs = []
    for tx, ty in numerals:
        best = min(range(len(meds)), key=lambda i: math.hypot(meds[i]["cx"] - tx, meds[i]["cy"] - ty))
        dist = math.hypot(meds[best]["cx"] - tx, meds[best]["cy"] - ty)
        if best in used or dist > 12:
            print(f"ev=error msg=\"no clean pairing\" numeral={tx:.1f},{ty:.1f} dist={dist:.1f}")
            sys.exit(2)
        used.add(best)
        pairs.append(meds[best])
    print(f"ev=paired n={len(pairs)} worst_numeral_offset={max(math.hypot(p['cx'] - t[0], p['cy'] - t[1]) for p, t in zip(pairs, numerals)):.2f}")

    def mark(med):
        if mode == "A":
            return f'<path d="{med["d"]}" fill="{TINT}"/>'
        r_out = med["w"] * 0.5
        r_in = r_out - 0.75
        cx, cy = med["cx"], med["cy"]
        ring = (f"M{cx - r_out:.2f} {cy:.2f}a{r_out:.2f} {r_out:.2f} 0 1 0 {2 * r_out:.2f} 0a{r_out:.2f} {r_out:.2f} 0 1 0 {-2 * r_out:.2f} 0Z"
                f"M{cx - r_in:.2f} {cy:.2f}a{r_in:.2f} {r_in:.2f} 0 1 0 {2 * r_in:.2f} 0a{r_in:.2f} {r_in:.2f} 0 1 0 {-2 * r_in:.2f} 0Z")
        return f'<path d="{ring}" fill="{INK}" fill-rule="evenodd"/>'

    # the rings come in page order, each just before its numeral; replace in that order
    it = iter(pairs)
    last = [None]

    def replace(m):
        twin = m.group(0) == last[0]
        last[0] = m.group(0)
        return "" if twin else mark(next(it))

    swapped = RING.sub(replace, pinned)
    left = len(RING.findall(swapped))
    open(out_path, "w", encoding="utf-8").write(swapped)
    print(f"ev=swapped mode={mode} rings_left={left} bytes_before={len(pinned.encode())} bytes_after={len(swapped.encode())}")


if __name__ == "__main__":
    main()
