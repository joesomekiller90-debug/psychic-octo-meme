"""montage.py out.png cols dirA [dirB] -- builds a labelled contact sheet.
With two dirs, each cell shows A (left) and B (right) side by side."""
import sys, os
from PIL import Image, ImageDraw, ImageFont

out, cols, dirs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
only = None
if dirs and dirs[-1].startswith("only="):
    only = dirs.pop()[5:].split(",")
names = sorted(f[:-4] for f in os.listdir(dirs[0]) if f.endswith(".png"))
if only:
    names = [n for n in names if n in only]
tiles = []
for n in names:
    ims = [Image.open(os.path.join(d, n + ".png")).convert("RGB") for d in dirs if os.path.exists(os.path.join(d, n + ".png"))]
    w, h = ims[0].size
    t = Image.new("RGB", (w * len(ims), h + 22), (24, 24, 28))
    for i, im in enumerate(ims):
        t.paste(im, (i * w, 22))
    dr = ImageDraw.Draw(t)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    label = n if len(ims) == 1 else f"{n}   (before | after)"
    dr.text((6, 3), label, fill=(235, 235, 235), font=font)
    tiles.append(t)
tw, th = tiles[0].size
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (tw * cols, th * rows), (24, 24, 28))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
sheet.save(out, optimize=True)
print(out, sheet.size)
