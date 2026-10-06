"""Generate PetRaidersTerrainSetup.lua (run in Roblox Studio after the terrain import) from layout.json.

The script is self-contained: the design data (station pads, egg pads, path centre lines and a
coarse material grid used to detect how the import landed) is baked into it.
"""
import json, math, os
import numpy as np
from PIL import Image

W = os.environ.get("PETRAIDERS_TERRAIN_DIR", os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(W, "layout.json")))
col = np.array(Image.open(os.path.join(W, "PetRaiders_Colormap.png")).convert("RGB"))
hgt = np.array(Image.open(os.path.join(W, "PetRaiders_Heightmap.png")).convert("L")).astype(int)
N = col.shape[0]
G0 = 32
CODE = {"Grass": "g", "LeafyGrass": "l", "Pavement": "p", "Cobblestone": "c", "Ground": "d", "Rock": "r",
        "Snow": "s", "Sand": "a", "Slate": "t"}
WALK = set("pcd")
code = np.full((N, N), "?", dtype="<U1")
for name, rgb in L["materials"].items():
    code[np.all(col == np.array(rgb), axis=-1)] = CODE[name]
assert (code != "?").all(), "colormap has unknown colours"

EGG_C = next(s for s in L["stations"] if s["id"] == "eggs")
EGG_C = (EGG_C["x"], EGG_C["z"])
EGG_LOOP_R = 90


def px(x, z):
    return int(math.floor(x + N / 2)), int(math.floor(z + N / 2))


def design_code(x, z):
    i, j = px(x, z)
    return code[j, i]


def design_flat(x, z):
    i, j = px(x, z)
    return hgt[j, i] == G0


# ---------------------------------------------------------------- orientation grid (interior cells only)
STEP, HALF, R_IN = 8, 296, 6
rows = []
for z in range(-HALF, HALF + 1, STEP):
    row = []
    for x in range(-HALF, HALF + 1, STEP):
        s = (abs(x / 300) ** 6 + abs(z / 300) ** 6) ** (1 / 6)
        i, j = px(x, z)
        win = code[j - R_IN:j + R_IN + 1, i - R_IN:i + R_IN + 1]
        row.append(win[0, 0] if s < 0.97 and (win == win[0, 0]).all() else ".")
    rows.append("".join(row))
cells = sum(len(r) - r.count(".") for r in rows)

# ---------------------------------------------------------------- path centre-line samples (every 4 studs)
paths = []
bad = []
for p in L["paths"]:
    pts = p["points"]
    out = []
    for a, b in zip(pts, pts[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(round(seg / 4)))
        for k in range(n + (1 if b is pts[-1] else 0)):
            t = k / n
            x, z = a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])
            if p["name"] == "ring_road" and math.hypot(x - EGG_C[0], z - EGG_C[1]) < EGG_LOOP_R:
                continue                       # the ring road hands over to the egg loop here
            q = (int(round(x)), int(round(z)))
            if out and out[-1] == q:
                continue
            out.append(q)
            if design_code(*q) not in WALK or not design_flat(*q):
                bad.append((p["name"], q, design_code(*q)))
    paths.append((p["name"], p["width"], out))
assert not bad, f"path samples off the paving in the design: {bad[:10]}"
n_samples = sum(len(o) for _, _, o in paths)

# ---------------------------------------------------------------- station / egg pad probe points
colors = [(231, 76, 60), (52, 152, 219), (155, 89, 182), (241, 196, 15), (26, 188, 156), (230, 126, 34),
          (46, 204, 113), (233, 30, 99), (0, 150, 136), (121, 85, 72), (96, 125, 139), (63, 81, 181),
          (205, 220, 57), (255, 87, 34)]
FRONT = {"raid", "rebirth", "leaderboards", "purple_dome", "red_house", "market", "pedestals", "flex_a",
         "flex_b", "flex_c", "south_gate"}
stations = []
for n, s in enumerate(L["stations"], 1):
    fp = s["footprint"]
    probes = []
    if "radius" in fp:
        r = fp["radius"]
        cand = [(0, 0)] + [(0.6 * r * math.cos(a), 0.6 * r * math.sin(a)) for a in np.radians([0, 90, 180, 270])]
    else:
        t = math.radians(fp.get("rotation_deg", 0))
        u, v = (math.cos(t), math.sin(t)), (-math.sin(t), math.cos(t))
        cand = [(0, 0)] + [(su * 0.35 * fp["size"][0] * u[0] + sv * 0.35 * fp["size"][1] * v[0],
                            su * 0.35 * fp["size"][0] * u[1] + sv * 0.35 * fp["size"][1] * v[1])
                           for su, sv in ((1, 1), (1, -1), (-1, 1), (-1, -1))]
    for dx, dz in cand:
        q = (round(s["x"] + dx, 1), round(s["z"] + dz, 1))
        if design_code(*q) in WALK:                 # (the plaza centre is the tree planter: skipped)
            probes.append(q)
    assert len(probes) >= 4, (s["id"], probes)
    stations.append(dict(n=n, s=s, probes=probes, color=colors[(n - 1) % len(colors)]))
for e in L["egg_pads"]:
    assert design_code(e["x"], e["z"]) in WALK


# ---------------------------------------------------------------- emit Luau
def lua_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def num(v):
    v = round(float(v), 1)
    return str(int(v)) if v == int(v) else str(v)


st_lines = []
for st in stations:
    s, fp = st["s"], st["s"]["footprint"]
    shape = (f"r = {num(fp['radius'])}" if "radius" in fp else
             f"sx = {num(fp['size'][0])}, sz = {num(fp['size'][1])}, rot = {num(fp.get('rotation_deg', 0))}")
    probes = ", ".join(f"{num(x)}, {num(z)}" for x, z in st["probes"])
    c = st["color"]
    st_lines.append(
        f'\t{{ n = {st["n"]}, id = {lua_str(s["id"])}, name = {lua_str(s["name"])}, x = {num(s["x"])}, z = {num(s["z"])}, '
        f'{shape}, front = {"true" if s["id"] in FRONT else "false"}, color = {{ {c[0]}, {c[1]}, {c[2]} }},\n'
        f'\t\tnote = {lua_str(s["note"])},\n\t\tprobes = {{ {probes} }} }},')
egg_lines = [f'\t{{ name = "E{k}", x = {num(e["x"])}, z = {num(e["z"])}, r = {num(e["radius"])} }},'
             for k, e in enumerate(L["egg_pads"], 1)]
path_lines = []
for name, w, pts in paths:
    flat = ", ".join(f"{x}, {z}" for x, z in pts)
    path_lines.append(f'\t{{ name = {lua_str(name)}, w = {w}, pts = {{ {flat} }} }},')
grid_lines = [f'\t\t"{r}",' for r in rows]

imp = L["import_settings"]
lua = (open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "setup_template.luau")).read()
       .replace("--@@STATIONS@@", "\n".join(st_lines))
       .replace("--@@EGGPADS@@", "\n".join(egg_lines))
       .replace("--@@PATHS@@", "\n".join(path_lines))
       .replace("--@@GRID@@", "\n".join(grid_lines))
       .replace("@@GRID_STEP@@", str(STEP)).replace("@@GRID_HALF@@", str(HALF))
       .replace("@@IMPORT_POS@@", ", ".join(str(v) for v in imp["position"]))
       .replace("@@IMPORT_SIZE@@", ", ".join(str(v) for v in imp["size"])))
assert "@@" not in lua
out = os.path.join(W, "PetRaidersTerrainSetup.lua")
open(out, "w").write(lua)
print(f"wrote {out}: {len(lua) / 1024:.1f} KB, grid cells {cells}, path samples {n_samples} on {len(paths)} paths, "
      f"{len(stations)} stations")
