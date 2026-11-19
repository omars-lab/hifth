"""Item 45: overlay one pinned page, and the shipped page, on the Complex's drawing file,
using only the page's own transform (no fitting). Usage:
    python3 -I medallion_overlay.py <page> <out_dir> <pin.json> <shipped_dir> <ai_url_base>
Prints facts only (hashes, transforms, pixel counts); pictures go to out_dir. The pictures show
scripture: keep out_dir in the session's scratch folder, never in the repo."""
import hashlib, json, re, subprocess, sys, urllib.parse, os

page, out, pin_path, shipped_dir, base = sys.argv[1:6]
n = int(page)
os.makedirs(out, exist_ok=True)
dl = os.path.join(out, "dl"); os.makedirs(dl, exist_ok=True)
p3 = f"{n:03d}"
ai = os.path.join(dl, f"{p3}.ai")
up = os.path.join(dl, f"upstream-{p3}.svg")
folder = urllib.parse.quote("1441 مصحف حفص-إليستريتور")
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True)
if not os.path.exists(ai):
    run("curl", "-sS", "-f", "-o", ai, f"{base}/{folder}/{p3}___Hafs39__DM.ai")
if not os.path.exists(up):
  run("curl", "-sS", "-f", "-o", up,
    f"https://raw.githubusercontent.com/quranpedia/quran-svg/5fbcb1d4d92b5a2972ab51472fe991b6066bb6e2/mushafs/hafs/kfqc/svg/{p3}.svg")

pin = json.load(open(pin_path))
entry = next(e for e in pin["pages"] if e["page"] == n) if "pages" in pin else None
sha = hashlib.sha256(open(up, "rb").read()).hexdigest()
print(f"ev=hash page={n} upstream_matches_pin={entry is not None and entry.get('upstream') == sha}")

fonts = run("pdffonts", ai).stdout.strip().splitlines()
print(f"ev=fonts page={n} embedded_fonts={max(0, len(fonts) - 2)}")
info = run("pdfinfo", ai).stdout
h_pdf = float(re.search(r"Page size:\s+[\d.]+ x ([\d.]+)", info).group(1))

def geom(path):
    s = open(path).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    mats = re.findall(r'transform="matrix\(([^)]*)\)"', s)
    return s, vb, mats

k = 3
results = {}
for label, svg in (("upstream", up), ("shipped", os.path.join(shipped_dir, f"{n}.svg"))):
    s, vb, mats = geom(svg)
    print(f"ev=geom page={n} which={label} viewBox={'_'.join(map(str, vb))} matrices={len(mats)} first={mats[0].replace(' ', '_') if mats else 'none'}")
    a, _, _, d, e, f = [float(v) for v in re.split(r"[ ,]+", mats[0].strip())]
    dpi = 72 * k * a
    w, h = round(vb[2] * k), round(vb[3] * k)
    ox = round(k * (vb[0] - e)); oy = round(k * a * h_pdf - k * (f - vb[1]))
    ai_png = os.path.join(out, f"ai-{p3}-{label}")
    run("pdftoppm", "-png", "-r", f"{dpi:.4f}", "-singlefile", ai, ai_png)
    ai_crop = os.path.join(out, f"ai-crop-{p3}-{label}.png")
    run("magick", ai_png + ".png", "-crop", f"{w}x{h}+{ox}+{oy}", "+repage", "-colorspace", "gray", ai_crop)
    svg_png = os.path.join(out, f"{label}-{p3}.png")
    run("rsvg-convert", "-w", str(w), "-h", str(h), "-b", "white", "-o", svg_png, svg)
    run("magick", svg_png, "-colorspace", "gray", svg_png)
    run("magick", svg_png, ai_crop, ai_crop, "-combine", os.path.join(out, f"overlay-{p3}-{label}.png"))
    r = subprocess.run(["magick", "compare", "-metric", "AE", "-fuzz", "50%", svg_png, ai_crop,
                        os.path.join(out, f"diff-{p3}-{label}.png")], capture_output=True, text=True)
    ink = run("magick", svg_png, "-threshold", "50%", "-negate", "-format", "%[fx:round(mean*w*h)]", "info:").stdout
    print(f"ev=overlay page={n} which={label} size={w}x{h} offset={ox},{oy} differing_px={r.stderr.split()[0]} ink_px={ink}")
    # The grey compare above cannot see the pale green medallions (grey 0.85 is within its 50%
    # tolerance of white). So also compare a mask of "green is well above red" on both renders.
    svg_col = os.path.join(out, f"{label}-{p3}-colour.png")
    run("rsvg-convert", "-w", str(w), "-h", str(h), "-b", "white", "-o", svg_col, svg)
    ai_col = os.path.join(out, f"ai-colour-{p3}-{label}.png")
    run("magick", ai_png + ".png", "-crop", f"{w}x{h}+{ox}+{oy}", "+repage", ai_col)
    masks = []
    for src in (svg_col, ai_col):
        mk = src.replace(".png", "-tint.png")
        run("magick", src, "-fx", "(g-r)>0.08 && g>0.6 ? 1 : 0", "-colorspace", "gray", mk)
        masks.append(mk)
    r2 = subprocess.run(["magick", "compare", "-metric", "AE", masks[0], masks[1],
                         os.path.join(out, f"tint-diff-{p3}-{label}.png")], capture_output=True, text=True)
    tint = [run("magick", mk, "-format", "%[fx:round(mean*w*h)]", "info:").stdout for mk in masks]
    # The drawing has other green (borders, surah frames) that we never draw, so the fair number is
    # the share of OUR green that falls where the drawing has none. About 5% is the renderers' floor.
    both = run("magick", masks[0], masks[1], "-compose", "multiply", "-composite",
               "-format", "%[fx:round(mean*w*h)]", "info:").stdout
    off = (int(tint[0]) - int(both)) / max(1, int(tint[0]))
    print(f"ev=tint page={n} which={label} tint_px_ours={tint[0]} tint_px_drawing={tint[1]} "
          f"differing_px={r2.stderr.split()[0]} ours_off_drawing={off:.4f}")
