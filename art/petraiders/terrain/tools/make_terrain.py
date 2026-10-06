"""Pet Raiders hub terrain: heightmap + colormap for Roblox Studio's Terrain Editor > Import.

1 pixel = 1 stud.  Image x -> world +X (east), image y -> world +Z (south); image centre = world (0, 0).
Heightmap: 8-bit grey, black = bottom of the import region, white = top (region height 256 studs).
Play ground level = grey 32 (32 studs above the region bottom).
Colormap: exact Roblox terrain colormap colours, no anti-aliasing.
"""
import json, math, os
import numpy as np
from PIL import Image

N = 1024                 # pixels = studs
HALF_PLAY = 300          # play area is 600 x 600 studs (rounded square)
REGION_H = 256           # import region height (studs)
G0 = 32                  # ground level, studs above region bottom
OUT = os.environ.get("PETRAIDERS_TERRAIN_DIR", os.path.dirname(os.path.abspath(__file__)))

MAT = {  # Roblox colormap colours
    "Grass": (106, 127, 63), "LeafyGrass": (115, 132, 74), "Pavement": (148, 148, 140),
    "Cobblestone": (132, 123, 90), "Ground": (102, 92, 59), "Rock": (102, 108, 111),
    "Snow": (195, 199, 218), "Sand": (143, 126, 95), "Slate": (63, 127, 107),
}

ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)
X = xs - N / 2 + 0.5
Z = ys - N / 2 + 0.5


# ------------------------------------------------------------------ layout (world studs, X east, Z south)
def P(x, z):
    return np.array([float(x), float(z)])


PLAZA_R = 52
EGG_C, EGG_LOOP_R, EGG_LOOP_W = P(0, -190), 90, 18
EGG_TENT_R, EGG_PAD_RING, EGG_PAD_R = 48, 68, 12
RING_A, RING_P, RING_W = 200, 4.0, 16
SPOKE_W = 18

eggs = []
for k in range(8):
    a = math.radians(22.5 + 45 * k)
    eggs.append(EGG_C + EGG_PAD_RING * np.array([math.cos(a), math.sin(a)]))
EGG_NAMES = ["Egg pad 1", "Egg pad 2", "Egg pad 3", "Egg pad 4", "Egg pad 5", "Egg pad 6", "Egg pad 7", "Egg pad 8"]


def ring_pt(theta):
    c, s = math.cos(theta), math.sin(theta)
    r = RING_A / (abs(c) ** RING_P + abs(s) ** RING_P) ** (1 / RING_P)
    return P(r * c, r * s)


diag = ring_pt(math.radians(45))[0]           # ring corner coordinate (~168)

stations = [
    dict(id="spawn", name="Spawn Plaza + Big Tree", kind="circle", c=P(0, 0), r=PLAZA_R, note="SpawnLocation + big tree in the centre"),
    dict(id="eggs", name="Egg Hatchery (tent)", kind="circle", c=EGG_C, r=EGG_TENT_R, note="Circus tent centre; 8 egg pads ring it, each joined to the loop path"),
    dict(id="training", name="Training Grounds", kind="rect", c=P(0, 125), size=(84, 84), mat="Ground", note="Dirt square; path enters north side, exits south to the ring road"),
    dict(id="raid", name="Raid Portal", kind="circle", c=P(-206, 0), r=30, note="Round portal pad in the middle, portal arch on the west edge"),
    dict(id="rebirth", name="Rebirth Obelisk (light beam)", kind="circle", c=P(206, 0), r=30, note="White round pad + obelisk on the east edge"),
    dict(id="leaderboards", name="Leaderboards", kind="rect", c=P(diag + 30, -diag - 30), size=(74, 30), rot=45, note="Board wall faces the plaza (south-west)"),
    dict(id="purple_dome", name="Purple Dome Building", kind="rect", c=P(-diag - 32, -diag - 32), size=(60, 60), rot=45, note="Door faces the plaza (south-east)"),
    dict(id="red_house", name="Red House", kind="rect", c=P(diag + 32, diag + 32), size=(56, 60), rot=45, note="Door faces the plaza (north-west)"),
    dict(id="market", name="Market Stall (purple/yellow tent)", kind="rect", c=P(-diag - 28, diag + 28), size=(46, 46), rot=45, note="Counter faces the plaza (north-east)"),
    dict(id="pedestals", name="Pedestal Rows (white blocks)", kind="rect", c=P(238, 98), size=(46, 64), rot=22.5, note="2 x 3 rows of white blocks"),
    dict(id="flex_a", name="Spare Pad A (new station)", kind="rect", c=P(-238, 98), size=(46, 64), rot=-22.5, note="Free paved pad on the ring road"),
    dict(id="flex_b", name="Spare Pad B (new station)", kind="rect", c=P(238, -98), size=(46, 64), rot=-22.5, note="Free paved pad on the ring road"),
    dict(id="flex_c", name="Spare Pad C (new station)", kind="rect", c=P(-238, -98), size=(46, 64), rot=22.5, note="Free paved pad on the ring road"),
    dict(id="south_gate", name="South Gate (stone arch lookout)", kind="circle", c=P(0, 284), r=14, note="Path ends at the mountain foot - put a stone arch here"),
]

# path polylines (centre lines) with widths
paths = []
SPOKES = {
    "N": [P(0, -PLAZA_R + 4), P(0, EGG_C[1] + EGG_LOOP_R)],
    "S": [P(0, PLAZA_R - 4), P(0, 125 - 42)],
    "S2": [P(0, 125 + 42), P(0, RING_A + 2)],
    "E": [P(PLAZA_R - 4, 0), P(206 - 30 + 4, 0)],
    "W": [P(-PLAZA_R + 4, 0), P(-206 + 30 - 4, 0)],
}
for sx, sz, key in ((1, -1, "NE"), (-1, -1, "NW"), (1, 1, "SE"), (-1, 1, "SW")):
    d = np.array([sx, sz]) / math.sqrt(2)
    SPOKES[key] = [d * (PLAZA_R - 4), P(sx * diag, sz * diag)]
for k, v in SPOKES.items():
    paths.append(dict(name=f"spoke_{k}", pts=v, w=SPOKE_W if k != "S2" else 16))
ring = [ring_pt(t) for t in np.linspace(0, 2 * math.pi, 361)]
paths.append(dict(name="ring_road", pts=ring, w=RING_W, skip_inside=(EGG_C, EGG_LOOP_R)))
egg_loop = [EGG_C + EGG_LOOP_R * np.array([math.cos(t), math.sin(t)]) for t in np.linspace(0, 2 * math.pi, 241)]
paths.append(dict(name="egg_loop", pts=egg_loop, w=EGG_LOOP_W))
paths.append(dict(name="south_gate_spur", pts=[P(0, RING_A), P(0, 284)], w=12))
# egg area: every egg pad joins the loop, and 4 walkways cross the lawn to the tent
for k, e in enumerate(eggs):
    u = (e - EGG_C) / np.linalg.norm(e - EGG_C)
    paths.append(dict(name=f"egg_pad_link_E{k + 1}", pts=[e, EGG_C + EGG_LOOP_R * u], w=10))
for k, side in enumerate("ESWN"):
    a = math.radians(90 * k)
    u = np.array([math.cos(a), math.sin(a)])
    paths.append(dict(name=f"tent_walk_{side}", pts=[EGG_C + (EGG_TENT_R - 4) * u, EGG_C + EGG_LOOP_R * u], w=12))
# short connectors from the ring road onto the side pads (they sit just outside the ring)
for st in stations:
    if st["id"] in ("pedestals", "flex_a", "flex_b", "flex_c", "leaderboards", "purple_dome", "red_house", "market"):
        c = st["c"]
        th = math.atan2(c[1], c[0])
        paths.append(dict(name=f"link_{st['id']}", pts=[ring_pt(th), c], w=14))


# ------------------------------------------------------------------ rasterise
def seg_dist(ax, az, bx, bz):
    vx, vz = bx - ax, bz - az
    L2 = vx * vx + vz * vz
    t = np.clip(((X - ax) * vx + (Z - az) * vz) / max(L2, 1e-9), 0, 1)
    return np.hypot(X - (ax + t * vx), Z - (az + t * vz))


def poly_dist(pts):
    d = np.full(X.shape, 1e9)
    for a, b in zip(pts, pts[1:]):
        # quick reject by bbox
        d = np.minimum(d, seg_dist(a[0], a[1], b[0], b[1]))
    return d


def rot_rect_mask(c, size, rot_deg, grow=0.0):
    t = math.radians(rot_deg)
    ux, uz = math.cos(t), math.sin(t)
    dx, dz = X - c[0], Z - c[1]
    lu = dx * ux + dz * uz
    lv = -dx * uz + dz * ux
    return (np.abs(lu) <= size[0] / 2 + grow) & (np.abs(lv) <= size[1] / 2 + grow)


pave = np.zeros(X.shape, bool)
for p in paths:
    d = poly_dist(p["pts"])
    m = d <= p["w"] / 2
    if "skip_inside" in p:
        c, r = p["skip_inside"]
        m &= np.hypot(X - c[0], Z - c[1]) > r
    pave |= m

ground_mat = np.zeros(X.shape, bool)       # dirt (training grounds)
cobble = np.zeros(X.shape, bool)
planter = np.zeros(X.shape, bool)
station_mask = np.zeros(X.shape, bool)
for st in stations:
    if st["kind"] == "circle":
        m = np.hypot(X - st["c"][0], Z - st["c"][1]) <= st["r"]
    else:
        m = rot_rect_mask(st["c"], st["size"], st.get("rot", 0.0))
    station_mask |= m
    if st.get("mat") == "Ground":
        ground_mat |= m
    else:
        pave |= m
for e in eggs:
    m = np.hypot(X - e[0], Z - e[1]) <= EGG_PAD_R
    pave |= m
    station_mask |= m
rp = np.hypot(X, Z)
cobble = (rp <= PLAZA_R) & (rp >= PLAZA_R - 6)
planter = rp <= 13
pave &= ~ground_mat

walk = pave | ground_mat          # everything a player walks on that must stay flat

# ------------------------------------------------------------------ height field
rng = np.random.default_rng(7)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# rounded-square "distance beyond the play area"
ps = 6.0
s = (np.abs(X / HALF_PLAY) ** ps + np.abs(Z / HALF_PLAY) ** ps) ** (1 / ps)
t_out = (s - 1.0) * HALF_PLAY            # ~studs beyond the edge (negative inside)
corner = (np.abs(X) * np.abs(Z)) / (HALF_PLAY ** 2)       # 0 on edge middles, 1 at corners
corner = np.clip(corner, 0, 1)


def dome(cx, cz, R, H, power=1.6):
    d = np.hypot(X - cx, Z - cz) / R
    return H * np.clip(1 - d * d, 0, 1) ** power


def softmax(fields, k=0.06):
    m = np.maximum.reduce(fields)
    acc = sum(np.exp(k * (f - m)) for f in fields)
    return m + np.log(acc) / k


# mountain base ridge: rises from the play edge, higher toward the corners
ridge = (34 + 40 * corner) * smoothstep(0, 190, t_out)
fields = [ridge]
# rounded peaks along the border band (bigger at the corners)
peaks = []
perim = []
for side in range(4):
    for u in np.linspace(-1.15, 1.15, 7):
        off = rng.uniform(125, 185)
        along = u * (HALF_PLAY + 40)
        if side == 0:
            cx, cz = along, -(HALF_PLAY + off)
        elif side == 1:
            cx, cz = HALF_PLAY + off, along
        elif side == 2:
            cx, cz = along, HALF_PLAY + off
        else:
            cx, cz = -(HALF_PLAY + off), along
        cnr = min(1.0, (abs(cx) * abs(cz)) / (HALF_PLAY + 120) ** 2)
        H = rng.uniform(95, 140) + 65 * cnr
        R = rng.uniform(125, 165) + 25 * cnr
        peaks.append((cx, cz, R, H))
for sx in (-1, 1):
    for sz in (-1, 1):
        peaks.append((sx * (HALF_PLAY + 165), sz * (HALF_PLAY + 165), 195, 208))     # big corner massifs
for (cx, cz, R, H) in peaks:
    fields.append(dome(cx, cz, R, H))
mount = softmax(fields, k=0.05)
# cap the climb from the play edge so the mountains rise gently (~33 deg at first, steeper further out)
tp = np.maximum(t_out, 0.0)
cap = 0.65 * tp + 0.0028 * tp * tp
kk = 0.12
mount = -np.log(np.exp(-kk * mount) + np.exp(-kk * cap)) / kk
mount = np.maximum(mount, 0.0) * smoothstep(-2, 6, t_out)

# foothills just outside the edge (rolling, small)
foot = np.zeros(X.shape)
for _ in range(70):
    side = rng.integers(4)
    along = rng.uniform(-HALF_PLAY - 60, HALF_PLAY + 60)
    off = rng.uniform(5, 70)
    if side == 0:
        cx, cz = along, -(HALF_PLAY + off)
    elif side == 1:
        cx, cz = HALF_PLAY + off, along
    elif side == 2:
        cx, cz = along, HALF_PLAY + off
    else:
        cx, cz = -(HALF_PLAY + off), along
    foot = np.maximum(foot, dome(cx, cz, rng.uniform(22, 42), rng.uniform(6, 16), power=2.0))
foot *= smoothstep(-8, 12, t_out)

# gentle decorative mounds inside the play area, kept clear of paths and stations
mounds = np.zeros(X.shape)
mound_list = []
wy, wx = np.nonzero(walk[::2, ::2])
wpts = np.stack([wx * 2 - N / 2 + 0.5, wy * 2 - N / 2 + 0.5], 1)
cands = []
for k in range(8):
    a = math.radians(22.5 + 45 * k)
    for rad in (110, 150):
        cands.append((rad * math.cos(a), rad * math.sin(a)))
for k in range(16):
    a = math.radians(11.25 + 22.5 * k)
    cands.append((262 * math.cos(a), 262 * math.sin(a)))
for (cx, cz) in cands:
    dmin = np.min(np.hypot(wpts[:, 0] - cx, wpts[:, 1] - cz))
    R = min(40.0, dmin - 12.0)
    if R < 16 or max(abs(cx), abs(cz)) + R > HALF_PLAY + 10:
        continue
    H = float(np.clip(R * 0.18, 3.0, 8.0))
    mounds = np.maximum(mounds, dome(cx, cz, R, H, power=2.0))
    mound_list.append(dict(x=round(cx, 1), z=round(cz, 1), radius=round(R, 1), height=round(H, 1)))

h = G0 + np.maximum.reduce([mount, foot, mounds])

# light blur for soft cartoon shapes, then re-flatten everything walkable
def blur(a, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2)
    k /= k.sum()
    a = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 0, np.pad(a, 3 * r, mode="edge"))
    a = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 1, a)
    return a[3 * r:-3 * r, 3 * r:-3 * r]


h = blur(h, 3)
flat_zone = (t_out <= 0)
flat_zone &= mounds <= 1e-6
h[walk] = G0
h[flat_zone & (mounds <= 1e-6)] = G0
h = np.clip(h, 0, 255)

# ------------------------------------------------------------------ materials
gy, gx = np.gradient(h)
slope = np.degrees(np.arctan(np.hypot(gx, gy)))
above = h - G0
noise = blur(rng.normal(0, 1, X.shape), 18)
noise /= noise.std() + 1e-9
mat = np.empty(X.shape, dtype=object)
mat[:] = "Grass"
outside = t_out > 0
mat[outside & (above > 2)] = "LeafyGrass"
rock_line = 92 + 14 * noise
snow_line = 162 + 8 * noise
mat[outside & (above > 34 + 10 * noise)] = "Grass"           # upper meadows: lighter green bands
mat[outside & (above > 60 + 12 * noise)] = "LeafyGrass"
mat[(above > rock_line) | (outside & (slope > 62))] = "Rock"
mat[above > snow_line] = "Snow"
mat[pave] = "Pavement"
mat[cobble] = "Cobblestone"
mat[ground_mat] = "Ground"
mat[planter] = "Grass"

col = np.zeros(X.shape + (3,), np.uint8)
for name, rgb in MAT.items():
    col[mat == name] = rgb
hm = np.round(h).astype(np.uint8)

Image.fromarray(hm, "L").save(os.path.join(OUT, "PetRaiders_Heightmap.png"), optimize=True)
Image.fromarray(col, "RGB").save(os.path.join(OUT, "PetRaiders_Colormap.png"), optimize=True)
np.save(os.path.join(OUT, "height.npy"), h)
np.save(os.path.join(OUT, "matidx.npy"), np.searchsorted(sorted(MAT), mat.astype(str)))

layout = dict(
    import_settings=dict(position=[0, 96, 0], size=[N, REGION_H, N], ground_y=0,
                         note="Region bottom = Y-32 (ground_y - 32); ground level = grey 32; Y position assumes your current ground top is at Y=0"),
    axes="X = east (image right), Z = south (image down), north = -Z (top of the images)",
    play_area=dict(half=HALF_PLAY, size=2 * HALF_PLAY, shape="rounded square (superellipse p=6)"),
    stations=[dict(id=s_["id"], name=s_["name"], x=round(float(s_["c"][0]), 1), z=round(float(s_["c"][1]), 1),
                   footprint=(dict(radius=s_["r"]) if s_["kind"] == "circle" else dict(size=list(s_["size"]), rotation_deg=s_.get("rot", 0))),
                   note=s_["note"]) for s_ in stations],
    egg_pads=[dict(name=n, x=round(float(e[0]), 1), z=round(float(e[1]), 1), radius=EGG_PAD_R) for n, e in zip(EGG_NAMES, eggs)],
    paths=[dict(name=p["name"], width=p["w"], points=[[round(float(q[0]), 1), round(float(q[1]), 1)] for q in p["pts"]][:: (6 if len(p["pts"]) > 50 else 1)])
           for p in paths],
    mounds=mound_list,
    materials={k: list(v) for k, v in MAT.items()},
)
json.dump(layout, open(os.path.join(OUT, "layout.json"), "w"), indent=1)

counts = {k: int((mat == k).sum()) for k in MAT}
print("height range", float(h.min()), float(h.max()), "peak above ground", float(h.max() - G0))
print("material pixels", counts)
print("mounds", len(mound_list))
