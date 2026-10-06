"""Labelled layout reference map (top-down) for placing buildings on the new terrain."""
import json, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W = os.environ.get("PETRAIDERS_TERRAIN_DIR", os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(W, "layout.json")))
col = np.array(Image.open(os.path.join(W, "PetRaiders_Colormap.png")).convert("RGB"))
h = np.load(os.path.join(W, "height.npy"))
N = col.shape[0]
SC = 1.5                      # px per stud in the reference
CROP = 380                    # show +/- 380 studs (play area + foothills)
pastel = {"Grass": (126, 196, 104), "LeafyGrass": (106, 176, 92), "Pavement": (232, 222, 200),
          "Cobblestone": (206, 190, 164), "Ground": (176, 128, 88), "Rock": (170, 162, 188),
          "Snow": (246, 247, 255), "Sand": (230, 210, 160), "Slate": (100, 140, 130)}
img = np.zeros_like(col)
for name, rgb in L["materials"].items():
    m = np.all(col == np.array(rgb), axis=-1)
    img[m] = pastel[name]
# hill shading
gy, gx = np.gradient(h)
shade = np.clip(1.0 - 0.35 * (gx * 0.6 - gy * 0.8), 0.6, 1.25)
img = np.clip(img.astype(float) * shade[..., None], 0, 255).astype(np.uint8)
c0 = N // 2 - CROP
crop = Image.fromarray(img[c0:c0 + 2 * CROP, c0:c0 + 2 * CROP]).resize((int(2 * CROP * SC),) * 2, Image.LANCZOS)

PANEL = 760
H = crop.height + 120 + 190
canvas = Image.new("RGB", (crop.width + PANEL, H), (28, 30, 38))
canvas.paste(crop, (0, 120))
d = ImageDraw.Draw(canvas)
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f_title, f_b, f_s, f_xs = ImageFont.truetype(FB, 34), ImageFont.truetype(FB, 20), ImageFont.truetype(F, 17), ImageFont.truetype(F, 14)


def to_px(x, z):
    return ((x + CROP) * SC, (z + CROP) * SC + 120)


# grid every 50 studs
for v in range(-350, 351, 50):
    a = to_px(v, -CROP); b = to_px(v, CROP)
    d.line([a, b], fill=(255, 255, 255, 60) if v else (255, 255, 255), width=1 if v else 2)
    a = to_px(-CROP, v); b = to_px(CROP, v)
    d.line([a, b], fill=(255, 255, 255) if v == 0 else (235, 235, 235), width=2 if v == 0 else 1)
    if v % 100 == 0:
        x, y = to_px(v, -CROP)
        d.text((x + 3, y + 3), f"X {v}", fill=(30, 30, 30), font=f_xs)
        x, y = to_px(-CROP, v)
        d.text((x + 3, y + 3), f"Z {v}", fill=(30, 30, 30), font=f_xs)
# play-area outline
pts = []
for t in np.linspace(0, 2 * math.pi, 400):
    c, s_ = math.cos(t), math.sin(t)
    r = 300 / (abs(c) ** 6 + abs(s_) ** 6) ** (1 / 6)
    pts.append(to_px(r * c, r * s_))
d.line(pts + [pts[0]], fill=(255, 255, 255), width=3)

colors = [(231, 76, 60), (52, 152, 219), (155, 89, 182), (241, 196, 15), (26, 188, 156), (230, 126, 34),
          (46, 204, 113), (233, 30, 99), (0, 150, 136), (121, 85, 72), (96, 125, 139), (63, 81, 181),
          (205, 220, 57), (255, 87, 34)]
for i, s in enumerate(L["stations"]):
    x, y = to_px(s["x"], s["z"])
    r = 17
    c = colors[i % len(colors)]
    d.ellipse([x - r, y - r, x + r, y + r], fill=c, outline=(255, 255, 255), width=3)
    num = str(i + 1)
    tw = d.textlength(num, font=f_b)
    d.text((x - tw / 2, y - 12), num, fill=(255, 255, 255), font=f_b)
for j, e in enumerate(L["egg_pads"]):
    x, y = to_px(e["x"], e["z"])
    r = 11
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 182, 213), outline=(120, 40, 80), width=2)
    t = f"E{j + 1}"
    tw = d.textlength(t, font=f_xs)
    d.text((x - tw / 2, y - 8), t, fill=(90, 20, 60), font=f_xs)
# compass + scale bar
cx, cy = crop.width - 70, 190
d.polygon([(cx, cy - 40), (cx - 16, cy + 10), (cx + 16, cy + 10)], fill=(255, 255, 255))
d.text((cx - 9, cy + 14), "N", fill=(255, 255, 255), font=f_b)
d.text((cx - d.textlength("(-Z)", font=f_xs) / 2, cy + 36), "(-Z)", fill=(255, 255, 255), font=f_xs)
x0, y0 = 30, crop.height + 120 + 40
d.rectangle([x0, y0, x0 + 100 * SC, y0 + 10], fill=(255, 255, 255))
d.text((x0, y0 - 24), "100 studs", fill=(255, 255, 255), font=f_s)
legend = ["Pink E1-E8 = egg pads.  Pale paths = Pavement, brown = dirt (Ground).",
          "Grass slopes rise into the mountains outside the white line."]
for k, line in enumerate(legend):
    assert x0 + 200 + d.textlength(line, font=f_s) < crop.width - 10, line
    d.text((x0 + 200, y0 - 22 + 24 * k), line, fill=(200, 205, 215), font=f_s)

d.text((20, 18), "Pet Raiders hub - layout reference", fill=(255, 255, 255), font=f_title)
d.text((20, 66), "Top-down, north (-Z) is up, X to the right. Coordinates are world studs on the flat ground (Y = 0 by default).",
       fill=(200, 205, 215), font=f_s)
d.text((20, 90), "Play area 600 x 600 studs (white outline), ~30% bigger than the current map. Grid every 50 studs. "
       "Orientation Y = Studio rotation of the pad's first side.", fill=(200, 205, 215), font=f_s)
px = crop.width + 24
y = 130
d.text((px, y), "Stations (put the building's centre here)", fill=(255, 255, 255), font=f_b); y += 34
for i, s in enumerate(L["stations"]):
    c = colors[i % len(colors)]
    d.ellipse([px, y + 2, px + 22, y + 24], fill=c)
    d.text((px + 11 - d.textlength(str(i + 1), font=f_xs) / 2, y + 4), str(i + 1), fill=(255, 255, 255), font=f_xs)
    d.text((px + 32, y), s["name"], fill=(255, 255, 255), font=f_b)
    fp = s["footprint"]
    fps = f"pad r={fp['radius']}" if "radius" in fp else f"pad {fp['size'][0]}x{fp['size'][1]}" + (f", Orientation Y {-fp['rotation_deg']:g}°" if fp.get("rotation_deg") else "")
    d.text((px + 32, y + 24), f"X {s['x']:.0f}   Z {s['z']:.0f}   ({fps})", fill=(190, 200, 215), font=f_s)
    d.text((px + 32, y + 46), s["note"], fill=(150, 160, 175), font=f_xs)
    y += 74
y += 6
d.text((px, y), "Egg pads E1-E8 (around the hatchery tent)", fill=(255, 255, 255), font=f_b); y += 30
for j, e in enumerate(L["egg_pads"]):
    d.text((px + (j % 2) * 360, y + (j // 2) * 24), f"E{j + 1}:  X {e['x']:.0f}  Z {e['z']:.0f}", fill=(255, 205, 225), font=f_s)
y += 4 * 24 + 16
d.text((px, y), "Paths: 8 spokes from the plaza, a ring road through", fill=(200, 205, 215), font=f_s); y += 22
d.text((px, y), "every station, and a full loop around the egg pads", fill=(200, 205, 215), font=f_s); y += 22
d.text((px, y), "(each pad joins the loop; 4 walkways lead into the tent).", fill=(200, 205, 215), font=f_s)
canvas.save(os.path.join(W, "PetRaiders_Layout_Reference.png"), optimize=True)
print("saved", canvas.size)
