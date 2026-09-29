#!/usr/bin/env python3
"""Fill the app icon set from the web app's own icon.

    python3 native/scripts/make-appicon.py [source.png] [appiconset dir]

Every size the Mac and iPad targets ask for is cut from one square PNG with
`sips` (built into macOS), and Contents.json is rewritten to name each file.
The source is the web app's *maskable* icon: opaque and full-bleed, because
iOS applies its own rounded mask and macOS 26 does the same, so an icon that
already carries rounded corners would be masked twice and show a dark rim.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "apps/web/public/icons/icon-maskable-512.png"
DEST = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "native/Hifth/Resources/Assets.xcassets/AppIcon.appiconset"

# (idiom, size in points, scale) → pixels. The 1024 universal entry is what iOS
# and iPadOS use for every size on device; the Mac wants each size laid out.
MAC = [16, 32, 128, 256, 512]


def cut(px: int, name: str) -> None:
    out = DEST / name
    subprocess.run(
        ["sips", "-s", "format", "png", "-z", str(px), str(px), str(SOURCE), "--out", str(out)],
        check=True,
        capture_output=True,
    )


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"no source icon at {SOURCE}")
    DEST.mkdir(parents=True, exist_ok=True)
    images = []
    cut(1024, "AppIcon-1024.png")
    images.append({"filename": "AppIcon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"})
    for pt in MAC:
        for scale in (1, 2):
            name = f"icon_{pt}x{pt}{'@2x' if scale == 2 else ''}.png"
            cut(pt * scale, name)
            images.append({"filename": name, "idiom": "mac", "scale": f"{scale}x", "size": f"{pt}x{pt}"})
    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    (DEST / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")
    print(f"wrote {len(images)} icons to {DEST.relative_to(ROOT)} from {SOURCE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
