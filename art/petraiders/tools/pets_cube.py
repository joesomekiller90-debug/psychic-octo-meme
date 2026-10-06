"""Pet Simulator-style cube pets for PetRaiders.

    blender -b --factory-startup --python pets_cube.py -- OUT.blend [only=Pet1,Pet2]

Each pet is built at the origin, feet on z=0, facing -Y (same frame as the original assets),
as parts named <Role>_<Pet>.  Roles: Main, Accent, Detail, Eyes, EyeShine, Glow (as before)
plus Blush, Mouth and (a few pets) Teeth.
"""
import bpy, sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "pets_cube.blend"
ONLY = None
for a in argv[1:]:
    if a.startswith("only="):
        ONLY = set(a[5:].split(","))

SMALL = {"AcornSquirrel", "BumblePup", "GolemCub", "KnightCorgi", "LanternMoth", "MeadowStag",
         "RubbleMole", "RuneOwl", "SkellyKitten", "SleepyOrb", "SproutBunny"}
LARGE = {"BatPup", "LilMossjaw", "MossbackTurtle", "RuinGryphon", "RuinheartDragon", "SlimeBuddy"}


# ------------------------------------------------------------------ shared features
class Pet:
    def __init__(self, B, S, D=None, H=None, z0=0.12, r=None, seg=2, role="Main"):
        self.B = B
        self.S, self.D, self.H, self.z0 = S, D or S, H or S, z0
        self.r = 0.13 * S if r is None else r
        B.add(role, rbox(self.S, self.D, self.H, self.r, seg), T(0, 0, z0 + self.H / 2))
        self.fy = -self.D / 2          # front plane
        self.by = self.D / 2           # back plane
        self.top = z0 + self.H
        self.cz = z0 + self.H / 2

    def front(self, x, z, lift=0.0, rot=0.0, s=1.0):
        """Matrix putting a local-XY decal on the front face at (x, z), facing -Y."""
        return T(x, self.fy + 0.004 - lift, z) @ FRONT @ T(rz=rot, s=s)

    def side(self, sign, y, z, lift=0.0, rot=0.0):
        """Decal on the +X (sign=1) or -X side face (local +Y = up, +Z = outward)."""
        R = Euler((0, math.radians(90 * sign), 0)).to_matrix().to_4x4() @ Euler((0, 0, math.radians(90 * sign))).to_matrix().to_4x4()
        return T(sign * (self.S / 2 - 0.004 + lift), y, z) @ R @ T(rz=rot)

    def topface(self, x, y, lift=0.0, rot=0.0):
        return T(x, y, self.top - 0.004 + lift) @ T(rz=rot)


def eyes(P, dx=None, z=None, rw=None, rh=None, n=14, shine=True, role="Eyes"):
    S, H = P.S, P.H
    dx = 0.2 * S if dx is None else dx
    z = P.cz + 0.07 * H if z is None else z
    rw = 0.105 * S if rw is None else rw
    rh = 0.13 * S if rh is None else rh
    h = 0.32 * rw
    P.B.add(role, dome(rw, rh, h, n=n, k=2, skirt=0.0), P.front(dx, z), mirror=True)
    if shine:
        big = dome(0.36 * rw, 0.36 * rw, 0.05 * rw, n=10, k=1, skirt=0.0)
        small = dome(0.17 * rw, 0.17 * rw, 0.04 * rw, n=7, k=1, skirt=0.0)
        for x in (dx, -dx):
            P.B.add("EyeShine", big, P.front(x - 0.3 * rw, z + 0.36 * rh, lift=0.74 * h))
            P.B.add("EyeShine", small, P.front(x + 0.32 * rw, z - 0.34 * rh, lift=0.76 * h))
    return dict(dx=dx, z=z, rw=rw, rh=rh, h=h)


def closed_eyes(P, dx=None, z=None, w=None):
    S = P.S
    dx = 0.2 * S if dx is None else dx
    z = P.cz + 0.04 * P.H if z is None else z
    w = 0.2 * S if w is None else w
    arc = [(w * (i / 6 - 0.5), -0.35 * w * math.sin(math.pi * i / 6)) for i in range(7)]
    P.B.add("Eyes", prism(stroke_pts(arc, 0.045 * S), 0.02, base=False), P.front(dx, z), mirror=True)


def blush(P, dx=None, z=None, rx=None, ry=None):
    S = P.S
    dx = 0.33 * S if dx is None else dx
    z = P.cz - 0.07 * P.H if z is None else z
    rx = 0.075 * S if rx is None else rx
    ry = 0.042 * S if ry is None else ry
    P.B.add("Blush", dome(rx, ry, 0.01, n=10, k=1, skirt=0.0), P.front(dx, z), mirror=True)


def mouth(P, kind="w", z=None, w=None, lift=0.0):
    S = P.S
    z = P.cz - 0.13 * P.H if z is None else z
    w = 0.14 * S if w is None else w
    t = 0.028 * S
    if kind == "w":
        path = []
        for half in (-1, 1):
            a, b = (-w / 2, 0.0) if half < 0 else (0.0, w / 2)
            for i in range(4):
                x = a + (b - a) * i / 3
                if half > 0 and i == 0:
                    continue
                path.append((x, -0.24 * w * math.sin(math.pi * i / 3)))
    elif kind == "smile":
        path = [(w * (i / 5 - 0.5), -0.28 * w * math.sin(math.pi * i / 5)) for i in range(6)]
    elif kind == "flat":
        path = [(-w / 2, 0.0), (0.0, -0.02 * w), (w / 2, 0.0)]
    elif kind == "grin":   # open smile: a filled half-moon
        pts = [(w * 0.5 * math.cos(math.pi + math.pi * i / 8), w * 0.42 * math.sin(math.pi + math.pi * i / 8)) for i in range(9)]
        P.B.add("Mouth", prism(pts if _area(pts) > 0 else pts[::-1], 0.02), P.front(0, z, lift=lift))
        return
    elif kind == "o":
        P.B.add("Mouth", dome(0.3 * w, 0.36 * w, 0.01, n=10, k=1, skirt=0.0), P.front(0, z, lift=lift))
        return
    P.B.add("Mouth", prism(stroke_pts(path, t), 0.018), P.front(0, z, lift=lift))


def _area(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def ccw(pts):
    return pts if _area(pts) > 0 else pts[::-1]


def feet(P, role="Main", n=4, w=None, h=None, inset=0.26, round_=False):
    S, D = P.S, P.D
    w = 0.2 * S if w is None else w
    h = P.z0 + 0.06 if h is None else h
    f = rbox(w, w * 1.1, h, 0.3 * min(w, h), 1) if round_ else box_open(w, w * 1.1, h)
    ys = (-inset * D, inset * D) if n == 4 else (-inset * D,)
    for y in ys:
        P.B.add(role, f, T(0.28 * S, y, h / 2), mirror=True)


def ear(P, role, inner_role, x, w, h, depth, tilt=10.0, z=None, y=0.0, bevel=True, inner=0.6, n=3,
        bulge=0.1, tip=0.16, rx=0.0):
    """Rounded-triangle ear on top of the head, leaning outward by `tilt` degrees; optional inner ear."""
    z = P.top - 0.1 * h if z is None else z
    e = prism(ear_pts(w, h, n=n, bulge=bulge, tip=tip), depth, bevel=0.22 * depth if bevel else 0.0, base=True)
    M = T(x, y + depth / 2, z, rx=rx, ry=tilt) @ FRONT
    P.B.add(role, e, M, mirror=True)
    if inner_role:
        ie = prism(ear_pts(w * inner, h * inner, n=max(2, n - 1), bulge=bulge, tip=tip), 0.012, base=False)
        P.B.add(inner_role, ie, M @ T(0, 0.14 * h, depth), mirror=True)
    return M


def patch(P, role, x, z, rx, ry, n=14, lift=0.0, h=0.01):
    P.B.add(role, dome(rx, ry, h, n=n, k=1, skirt=0.0), P.front(x, z, lift=lift))


XZ = Euler((math.radians(90), 0, 0)).to_matrix().to_4x4()   # local XY -> world XZ (thickness along -Y)


# ------------------------------------------------------------------ the pets
def AcornSquirrel(B):
    P = Pet(B, 1.38, z0=0.14)
    S = P.S
    ear(P, "Main", "Accent", 0.3 * S, 0.3 * S, 0.4 * S, 0.1 * S, tilt=8)
    # big fluffy tail rising behind the body, off to one side so it reads from the front
    B.add("Main", rbox(0.56 * S, 0.44 * S, 0.6 * S, 0.17 * S, 1), T(0.12 * S, P.by + 0.14 * S, P.z0 + 0.38 * S, rx=-12, ry=10))
    B.add("Main", rbox(0.62 * S, 0.46 * S, 0.66 * S, 0.18 * S, 1), T(0.2 * S, P.by + 0.3 * S, P.top - 0.08 * S, rx=10, ry=14))
    B.add("Accent", rbox(0.46 * S, 0.36 * S, 0.34 * S, 0.13 * S, 1), T(0.26 * S, P.by + 0.42 * S, P.top + 0.3 * S, rx=-30, ry=14))
    # muzzle, face, buck teeth
    patch(P, "Accent", 0, P.cz - 0.15 * S, 0.17 * S, 0.11 * S, n=12)
    eyes(P)
    blush(P)
    mouth(P, "w", z=P.cz - 0.12 * S, w=0.12 * S, lift=0.01)
    B.add("Teeth", box_open(0.07 * S, 0.03, 0.06 * S, open_top=False), T(0, P.fy - 0.012, P.cz - 0.175 * S))
    # acorn held in front by two paws
    ay, az = P.fy - 0.13 * S, P.z0 + 0.3 * S
    B.add("Accent", sphere(0.12 * S, 0.12 * S, 0.15 * S, seg=8, rings=4), T(0, ay, az))
    B.add("Detail", dome(0.14 * S, 0.14 * S, 0.08 * S, n=8, k=2, skirt=0.03 * S), T(0, ay, az + 0.06 * S))
    B.add("Detail", cyl(0.02 * S, 0.015 * S, 0.07 * S, seg=5), T(0, ay, az + 0.13 * S))
    B.add("Main", box_open(0.12 * S, 0.12 * S, 0.1 * S, open_top=False), T(0.16 * S, ay + 0.02, az + 0.03 * S, ry=-20), mirror=True)
    feet(P, "Main")


def BatPup(B):
    P = Pet(B, 1.4, z0=0.32)
    S = P.S
    ear(P, "Main", "Accent", 0.3 * S, 0.42 * S, 0.58 * S, 0.1 * S, tilt=16, tip=0.1)
    for (x, a) in ((-0.07, -20), (0.0, 0), (0.08, 22)):
        B.add("Main", prism(leaf_pts(0.17 * S, 0.09 * S, n=4), 0.05 * S, base=True), T(x * S, 0.02, P.top - 0.02, ry=a) @ FRONT)
    W, Hh = 1.05 * S, 0.62 * S
    out = [(0.0, 0.0), (0.18 * W, 0.42 * Hh), (0.55 * W, 0.62 * Hh), (W, 0.7 * Hh), (0.86 * W, 0.08 * Hh),
           (0.7 * W, 0.24 * Hh), (0.55 * W, -0.06 * Hh), (0.38 * W, 0.12 * Hh), (0.2 * W, -0.12 * Hh)]
    wing = prism(ccw(out), 0.05 * S, bevel=0.012 * S, base=True)
    Mw = T(0.44 * S, 0.12 * S, P.cz - 0.05 * S, rz=-8) @ XZ
    B.add("Detail", wing, Mw, mirror=True)
    bone = tube([(0.0, 0, 0), (0.18 * W, 0, 0.42 * Hh), (0.55 * W, 0, 0.62 * Hh), (W, 0, 0.7 * Hh)], [0.05 * S, 0.04 * S, 0.03 * S, 0.0], seg=6)
    B.add("Main", bone, T(0.44 * S, 0.12 * S - 0.03 * S, P.cz - 0.05 * S, rz=-8), mirror=True)
    patch(P, "Accent", 0, P.cz - 0.22 * S, 0.22 * S, 0.11 * S)
    eyes(P)
    blush(P)
    mouth(P, "smile", z=P.cz - 0.12 * S, w=0.13 * S)
    fang = prism([(-0.03 * S, 0), (0.03 * S, 0), (0.0, -0.07 * S)], 0.025, base=True)
    B.add("Teeth", fang, P.front(0.045 * S, P.cz - 0.145 * S, lift=0.004), mirror=True)
    B.add("Accent", rbox(0.15 * S, 0.15 * S, 0.2 * S, 0.06 * S, 1), T(0.2 * S, 0, P.z0 - 0.05 * S), mirror=True)


def BumblePup(B):
    P = Pet(B, 1.38, z0=0.13)
    S, D, H = P.S, P.D, P.H
    for y in (0.1, 0.32):
        B.add("Accent", rbox(S + 0.03, 0.13 * D, H + 0.03, P.r + 0.015, 1), T(0, y * D, P.cz))
    B.add("Accent", cyl(0.1 * S, 0.0, 0.22 * S, seg=6), T(0, P.by - 0.02, P.cz - 0.05 * S, rx=-90))
    for sgn in (1, -1):
        pts = bez((0.18 * S * sgn, -0.1 * S, P.top - 0.03), (0.2 * S * sgn, -0.12 * S, P.top + 0.25 * S),
                  (0.32 * S * sgn, -0.2 * S, P.top + 0.38 * S), (0.36 * S * sgn, -0.24 * S, P.top + 0.42 * S), n=3)
        B.add("Accent", tube(pts, [0.03 * S] * 3 + [0.022 * S], seg=5))
        B.add("Blush", sphere(0.075 * S, seg=7, rings=4), T(*pts[-1]))
    wing = prism(ellipse_pts(0.26 * S, 0.42 * S, 10), 0.04 * S, base=True)
    for sgn in (1, -1):
        B.add("Detail", wing, T(0.25 * S * sgn, 0.18 * S, P.top + 0.2 * S, rx=-70, ry=35 * sgn))
    eyes(P)
    blush(P)
    mouth(P, "w")
    feet(P, "Accent")


def GolemCub(B):
    P = Pet(B, 1.5, z0=0.12, r=0.09, seg=2)
    S = P.S
    B.add("Accent", rbox(0.72 * S, 0.62 * S, 0.1 * S, 0.04 * S, 2), T(-0.12 * S, 0.06 * S, P.top + 0.01))
    B.add("Accent", rbox(0.3 * S, 0.26 * S, 0.08 * S, 0.035 * S, 1), T(0.3 * S, -0.22 * S, P.top + 0.005))
    for x, l in ((-0.3, 0.16), (-0.14, 0.24), (0.02, 0.12)):
        B.add("Accent", box_open(0.1 * S, 0.05 * S, l * S), T(x * S, P.fy + 0.01, P.top - l * S / 2 + 0.02, rx=180))
    E = eyes(P, z=P.cz + 0.02 * S)
    for sgn in (1, -1):
        B.add("Main", rbox(0.26 * S, 0.1 * S, 0.08 * S, 0.03 * S, 1), T(0.2 * S * sgn, P.fy - 0.03 * S, E["z"] + 0.2 * S, ry=-12 * sgn))
    B.add("Glow", prism([(0, 0.11 * S), (-0.06 * S, 0), (0, -0.11 * S), (0.06 * S, 0)][::-1], 0.02, bevel=0.008, base=False),
          P.front(0, P.cz - 0.29 * S))
    blush(P, z=P.cz - 0.1 * S)
    mouth(P, "flat", z=P.cz - 0.15 * S, w=0.12 * S)
    crack = prism(ccw(stroke_pts([(0, 0), (0.06 * S, -0.08 * S), (0.02 * S, -0.16 * S), (0.09 * S, -0.26 * S)], 0.022 * S)), 0.012)
    B.add("Detail", crack, P.side(1, -0.15 * S, P.top - 0.2 * S))
    B.add("Detail", crack, P.side(-1, 0.2 * S, P.cz + 0.1 * S, rot=30))
    B.add("Detail", crack, P.front(-0.38 * S, P.top - 0.16 * S, rot=-20, s=0.8))
    B.add("Main", rbox(0.26 * S, 0.3 * S, 0.3 * S, 0.06 * S, 1), T(0.62 * S, -0.05 * S, P.z0 + 0.26 * S), mirror=True)
    feet(P, "Main", w=0.26 * S)


def KnightCorgi(B):
    P = Pet(B, 1.42, z0=0.13)
    S, D, H = P.S, P.D, P.H
    # rounded helmet cap with a crest and a white plume; ears poke out of it
    ch = 0.4 * H
    B.add("Detail", rbox(S + 0.07, D + 0.07, ch, 0.42 * ch, 2), T(0, 0, P.top - ch / 2 + 0.06 * S))
    B.add("Detail", rbox(0.1 * S, D * 0.9, 0.12 * S, 0.04 * S, 1), T(0, 0.02, P.top + 0.07 * S))
    B.add("Accent", prism(leaf_pts(0.5 * S, 0.24 * S, n=5, fat=0.6), 0.08 * S, base=True),
          T(0, 0.3 * S, P.top + 0.06 * S, rx=-35) @ FRONT @ T(z=-0.04 * S))
    ear(P, "Main", "Accent", 0.34 * S, 0.34 * S, 0.4 * S, 0.1 * S, tilt=22, z=P.top + 0.02 * S)
    patch(P, "Accent", 0, P.cz - 0.2 * S, 0.24 * S, 0.17 * S, n=14)
    eyes(P, z=P.cz - 0.01 * S)
    blush(P, z=P.cz - 0.11 * S)
    B.add("Eyes", dome(0.05 * S, 0.035 * S, 0.03 * S, n=8, k=1, skirt=0.0), P.front(0, P.cz - 0.13 * S, lift=0.01))
    mouth(P, "w", z=P.cz - 0.19 * S, w=0.12 * S, lift=0.01)
    # round shield with a gold paw
    B.add("Detail", cyl(0.34 * S, 0.34 * S, 0.07 * S, seg=12), T(S / 2 + 0.01, 0.06 * S, P.cz - 0.08 * S, ry=90))
    paw = [((0.0, -0.03), 0.085), ((-0.08, 0.08), 0.038), ((0.08, 0.08), 0.038), ((-0.12, 0.0), 0.034), ((0.12, 0.0), 0.034)]
    for (py, pz), r_ in paw:
        B.add("Glow", dome(r_ * S, r_ * 0.9 * S, 0.015 * S, n=8, k=1, skirt=0.0),
              T(S / 2 + 0.08 * S - 0.003, 0.06 * S + py * S, P.cz - 0.08 * S + pz * S, ry=90))
    feet(P, "Main")


def LanternMoth(B):
    P = Pet(B, 1.32, z0=0.16)
    S = P.S
    # fluffy chest fluff (Accent)
    for (x, z, r_) in ((-0.2, -0.3, 0.16), (0.2, -0.3, 0.16), (0.0, -0.36, 0.18)):
        B.add("Accent", sphere(r_ * S, r_ * 0.8 * S, r_ * 0.85 * S, seg=6, rings=4), T(x * S, P.fy + 0.04 * S, P.cz + z * S))
    # feathery antennae with glowing tips
    for sgn in (1, -1):
        pts = bez((0.15 * S * sgn, -0.05 * S, P.top - 0.02), (0.15 * S * sgn, -0.1 * S, P.top + 0.3 * S),
                  (0.3 * S * sgn, -0.12 * S, P.top + 0.45 * S), (0.42 * S * sgn, -0.12 * S, P.top + 0.5 * S), n=3)
        B.add("Detail", tube(pts, [0.025 * S] * 3 + [0.02 * S], seg=5))
        B.add("Glow", sphere(0.06 * S, seg=6, rings=4), T(*pts[-1]))
    # moth wings (upper + lower lobe in one outline) spreading out behind, with glowing lantern spots
    W, Hh = 0.95 * S, 0.8 * S
    outline = [(0, 0), (0.05, -0.2), (0.22, -0.42), (0.42, -0.46), (0.56, -0.32), (0.55, -0.1), (0.7, 0.12),
               (0.92, 0.28), (1.0, 0.5), (0.9, 0.7), (0.65, 0.76), (0.38, 0.62), (0.15, 0.36)]
    wing = prism(ccw([(x * W, y * Hh) for x, y in outline]), 0.045 * S, bevel=0.012 * S, base=True)
    Mw = T(0.36 * S, 0.3 * S, P.cz + 0.12 * S, rz=-28, ry=-12)
    B.add("Detail", wing, Mw @ XZ, mirror=True)
    for (x, y, r_) in ((0.62, 0.48, 0.13), (0.3, -0.24, 0.08)):
        spot = dome(r_ * S, r_ * S, 0.02 * S, n=8, k=1, skirt=0.0)
        B.add("Glow", spot, Mw @ XZ @ T(x * W, y * Hh, 0.045 * S - 0.012 * S), mirror=True)
        B.add("Glow", spot, Mw @ XZ @ T(x * W, y * Hh, 0.0, rx=180), mirror=True)
    eyes(P)
    blush(P)
    mouth(P, "w")
    feet(P, "Main", w=0.17 * S)


def LilMossjaw(B):
    P = Pet(B, 1.5, D=1.5, z0=0.14)
    S, D, H = P.S, P.D, P.H
    sw, sd, sh = 0.86 * S, 0.5 * S, 0.34 * H
    sy, sz = P.fy - sd / 2 + 0.06 * S, P.z0 + 0.28 * H
    B.add("Main", rbox(sw, sd, sh, 0.1 * S, 2), T(0, sy, sz))
    for sgn in (1, -1):
        B.add("Eyes", dome(0.035 * S, 0.025 * S, 0.02 * S, n=6, k=1, skirt=0.0), T(0.1 * S * sgn, sy - 0.08 * S, sz + sh / 2 - 0.002))
    tooth = prism([(-0.035 * S, 0), (0.035 * S, 0), (0, -0.075 * S)], 0.03 * S, base=True)
    for x in (-0.3, -0.15, 0.0, 0.15, 0.3):
        B.add("Teeth", tooth, T(x * S, sy - sd / 2 - 0.004, sz + 0.02 * S) @ FRONT)
    for sgn in (1, -1):
        B.add("Teeth", tooth, T(sgn * (sw / 2 + 0.004), sy - 0.1 * S, sz + 0.02 * S) @ Euler((math.radians(90), 0, math.radians(90 * sgn))).to_matrix().to_4x4())
    for sgn in (1, -1):
        B.add("Main", rbox(0.36 * S, 0.3 * S, 0.22 * S, 0.1 * S, 2), T(0.24 * S * sgn, P.fy + 0.16 * S, P.top + 0.02))
    eyes(P, z=P.top - 0.12 * S, rw=0.11 * S, rh=0.12 * S, dx=0.24 * S, n=16)
    blush(P, dx=0.38 * S, z=P.cz + 0.08 * S)
    patch(P, "Accent", 0, P.cz - 0.32 * S, 0.3 * S, 0.12 * S)
    crown = ccw([(x * S, y * S) for x, y in [(-0.3, 0), (0.3, 0), (0.3, 0.2), (0.2, 0.12), (0.1, 0.26), (0.0, 0.14), (-0.1, 0.26), (-0.2, 0.12), (-0.3, 0.2)]])
    cr = prism(crown, 0.08 * S, bevel=0.015 * S, base=True)
    B.add("Detail", cr, T(0, 0.2 * S, P.top - 0.02) @ FRONT)
    B.add("Detail", cr, T(0, 0.62 * S, P.top - 0.02) @ FRONT)
    B.add("Detail", cr, T(0.3 * S, 0.41 * S, P.top - 0.02, rz=90) @ FRONT, mirror=True)
    for x in (-0.1, 0.1):
        B.add("Glow", dome(0.04 * S, 0.04 * S, 0.02 * S, n=6, k=1, skirt=0.0), T(x * S, 0.2 * S - 0.084 * S, P.top + 0.07 * S) @ FRONT)
    scute = cyl(0.09 * S, 0.0, 0.12 * S, seg=4)
    for y in (0.62, 0.9):
        B.add("Accent", scute, T(0, y * 0.5 * D + 0.1, P.top - 0.02, rz=45))
    tail = tube([(0, P.by - 0.05, P.z0 + 0.3 * S), (0, P.by + 0.3 * S, P.z0 + 0.2 * S), (0.1 * S, P.by + 0.6 * S, P.z0 + 0.1 * S)],
                [0.2 * S, 0.12 * S, 0.0], seg=8)
    B.add("Main", tail)
    feet(P, "Main", w=0.24 * S, round_=True)


def MeadowStag(B):
    P = Pet(B, 1.34, z0=0.2)
    S = P.S
    ear_o = prism(leaf_pts(0.36 * S, 0.2 * S, n=5), 0.07 * S, bevel=0.02 * S, base=True)
    for sgn in (1, -1):
        B.add("Main", ear_o, T(0.46 * S * sgn, 0, P.top - 0.14 * S, ry=-80 * sgn) @ FRONT)
    flower = prism(star_pts(0.09 * S, 0.05 * S, 5), 0.03 * S, base=False)
    for sgn in (1, -1):
        base = (0.2 * S * sgn, 0.0, P.top - 0.03)
        beam = [Vector(base), Vector((0.24 * S * sgn, 0.02, P.top + 0.25 * S)), Vector((0.38 * S * sgn, 0.05, P.top + 0.48 * S)),
                Vector((0.44 * S * sgn, 0.05, P.top + 0.62 * S))]
        B.add("Detail", tube(beam, [0.045 * S, 0.04 * S, 0.035 * S, 0.025 * S], seg=6))
        tine = [beam[1] + Vector((0, 0, 0.05 * S)), beam[1] + Vector((-0.12 * S * sgn, 0, 0.22 * S))]
        B.add("Detail", tube(tine, [0.03 * S, 0.02 * S], seg=5))
        for tip in (beam[-1], tine[-1]):
            B.add("Glow", flower, T(tip.x, tip.y - 0.01, tip.z + 0.01) @ FRONT)
    spot = dome(0.08 * S, 0.07 * S, 0.01, n=8, k=1, skirt=0.0)
    for (x, y) in ((-0.2, 0.1), (0.15, 0.25), (0.3, -0.1)):
        B.add("Accent", spot, P.topface(x * S, y * S))
    for sgn in (1, -1):
        for (y, z) in ((0.15, 0.1), (-0.12, -0.15)):
            B.add("Accent", spot, P.side(sgn, y * S, P.cz + z * S))
    patch(P, "Accent", 0, P.cz - 0.2 * S, 0.22 * S, 0.14 * S, n=12)
    eyes(P)
    blush(P)
    B.add("Eyes", dome(0.06 * S, 0.04 * S, 0.035 * S, n=8, k=1, skirt=0.0), P.front(0, P.cz - 0.13 * S, lift=0.01))
    mouth(P, "w", z=P.cz - 0.2 * S, w=0.11 * S, lift=0.01)
    B.add("Accent", prism(leaf_pts(0.2 * S, 0.14 * S, n=3), 0.06 * S, base=True), T(0, P.by + 0.02, P.cz + 0.1 * S, rx=-160) @ FRONT)
    feet(P, "Detail", w=0.17 * S, h=P.z0 + 0.06)


def MossbackTurtle(B):
    P = Pet(B, 1.45, D=1.55, H=1.2, z0=0.2)
    S, D, H = P.S, P.D, P.H
    # domed shell over the top and back (Accent) with hex plates (Detail)
    sh_h = 0.7 * H
    B.add("Accent", rbox(S + 0.18, 0.92 * D, sh_h, 0.34 * sh_h, 3), T(0, 0.1 * D, P.top - 0.22 * H))
    shell_top = P.top - 0.22 * H + sh_h / 2
    plate = prism([(0.17 * S * math.cos(math.radians(30 + 60 * i)), 0.17 * S * math.sin(math.radians(30 + 60 * i))) for i in range(6)],
                  0.04 * S, bevel=0.015 * S, base=False)
    for (x, y) in ((0, 0.1), (-0.3, -0.08), (0.3, -0.08), (-0.3, 0.3), (0.3, 0.3), (0, 0.46)):
        B.add("Detail", plate, T(x * S, y * D, shell_top - 0.004))
    for (x, y, s) in ((-0.22, 0.2, 1.0), (0.1, 0.42, 0.75), (0.3, 0.12, 0.6)):
        z = shell_top + 0.02
        B.add("EyeShine", cyl(0.05 * S * s, 0.04 * S * s, 0.18 * S * s, seg=6), T(x * S, y * D, z - 0.02))
        B.add("Glow", dome(0.15 * S * s, 0.15 * S * s, 0.11 * S * s, n=10, k=2, skirt=0.02, base=True), T(x * S, y * D, z + 0.14 * S * s))
        B.add("EyeShine", dome(0.03 * S * s, 0.03 * S * s, 0.01, n=6, k=1, skirt=0.0), T(x * S + 0.06 * S * s, y * D, z + 0.14 * S * s + 0.09 * S * s, ry=40))
    eyes(P, z=P.cz - 0.04 * S)
    blush(P, z=P.cz - 0.17 * S)
    mouth(P, "smile", z=P.cz - 0.21 * S)
    leg = rbox(0.3 * S, 0.3 * S, 0.3 * S, 0.1 * S, 2)
    for y in (-0.28 * D, 0.3 * D):
        B.add("Main", leg, T(0.42 * S, y, 0.13 * S), mirror=True)
    B.add("Main", cyl(0.12 * S, 0.0, 0.3 * S, seg=8), T(0, P.by - 0.02, P.z0 + 0.25 * S, rx=-75))


def RubbleMole(B):
    P = Pet(B, 1.3, z0=0.12)
    S = P.S
    B.add("Detail", dome(0.56 * S, 0.56 * S, 0.34 * S, n=14, k=2, skirt=0.02, base=True), T(0, 0.02, P.top - 0.1 * S))
    B.add("Detail", cyl(0.66 * S, 0.66 * S, 0.05 * S, seg=14), T(0, -0.04 * S, P.top - 0.12 * S))
    B.add("Detail", cyl(0.12 * S, 0.12 * S, 0.1 * S, seg=8), T(0, -0.5 * S, P.top + 0.03 * S, rx=90))
    B.add("Glow", dome(0.1 * S, 0.1 * S, 0.04 * S, n=8, k=1, skirt=0.0), T(0, -0.6 * S - 0.004, P.top + 0.03 * S) @ FRONT)
    eyes(P, z=P.cz + 0.02 * S, rw=0.09 * S, rh=0.11 * S)
    B.add("Accent", sphere(0.12 * S, 0.1 * S, 0.09 * S, seg=8, rings=5), T(0, P.fy - 0.05 * S, P.cz - 0.12 * S))
    B.add("EyeShine", dome(0.03 * S, 0.02 * S, 0.01, n=6, k=1, skirt=0.0), T(-0.04 * S, P.fy - 0.13 * S, P.cz - 0.09 * S) @ FRONT)
    blush(P, z=P.cz - 0.12 * S)
    B.add("Teeth", box_open(0.09 * S, 0.03, 0.07 * S, open_top=False), T(0, P.fy - 0.012, P.cz - 0.255 * S))
    for sgn in (1, -1):
        B.add("Accent", rbox(0.2 * S, 0.12 * S, 0.24 * S, 0.06 * S, 1), T(0.4 * S * sgn, P.fy - 0.06 * S, P.z0 + 0.22 * S))
        for k in (-1, 0, 1):
            B.add("Teeth", cyl(0.025 * S, 0.0, 0.1 * S, seg=4), T((0.4 + 0.06 * k) * S * sgn, P.fy - 0.1 * S, P.z0 + 0.1 * S, rx=200))
    feet(P, "Main")


def RuinGryphon(B):
    P = Pet(B, 1.45, z0=0.14)
    S, D, H = P.S, P.D, P.H
    B.add("Accent", rbox(S + 0.025, D + 0.025, 0.42 * H, P.r + 0.0125, 2), T(0, 0, P.z0 + 0.2 * H))
    for x, a, l in ((-0.12, -18, 0.34), (0.0, 0, 0.42), (0.12, 18, 0.34)):
        B.add("Main", prism(leaf_pts(l * S, 0.14 * S, n=4), 0.05 * S, bevel=0.012 * S, base=True),
              T(x * S, 0.05 * S, P.top - 0.03, rx=-25, ry=a) @ FRONT)
    for sgn in (1, -1):
        for i, (l, a) in enumerate(((0.62, 35), (0.54, 15), (0.44, -5))):
            M = T(0.5 * S * sgn, 0.18 * S + 0.06 * i * S, P.cz + 0.15 * S - 0.12 * i * S, ry=-a * sgn - 20 * sgn) @ XZ
            B.add("Main" if i < 2 else "Accent", prism(leaf_pts(l * S, 0.2 * S, n=5), 0.05 * S, bevel=0.012 * S, base=True), M @ T(rz=-90 * sgn))
        B.add("Glow", prism([(0, 0.06 * S), (-0.035 * S, 0), (0, -0.06 * S), (0.035 * S, 0)][::-1], 0.01, base=False),
              P.side(sgn, 0.0, P.cz + 0.12 * S))
    beak = cyl(0.11 * S, 0.0, 0.2 * S, seg=4)
    B.add("Detail", beak, T(0, P.fy + 0.03 * S, P.cz - 0.1 * S, rx=90, rz=45) @ T(s=(1.0, 0.75, 1.0)))
    eyes(P, z=P.cz + 0.08 * S, n=16)
    blush(P)
    tail = [(0, P.by - 0.02, P.z0 + 0.3 * S), (0, P.by + 0.25 * S, P.z0 + 0.35 * S), (0, P.by + 0.4 * S, P.z0 + 0.6 * S)]
    B.add("Accent", tube(tail, [0.06 * S, 0.05 * S, 0.04 * S], seg=6))
    B.add("Main", sphere(0.12 * S, seg=8, rings=5), T(0, P.by + 0.42 * S, P.z0 + 0.66 * S))
    feet(P, "Detail", w=0.18 * S, round_=True)


def RuinheartDragon(B):
    P = Pet(B, 1.55, z0=0.14)
    S, D, H = P.S, P.D, P.H
    for sgn in (1, -1):
        horn = tube(bez((0.26 * S * sgn, 0.1 * S, P.top - 0.04), (0.28 * S * sgn, 0.12 * S, P.top + 0.2 * S),
                        (0.36 * S * sgn, 0.26 * S, P.top + 0.32 * S), (0.42 * S * sgn, 0.36 * S, P.top + 0.36 * S), n=4),
                    [0.09 * S, 0.07 * S, 0.05 * S, 0.03 * S, 0.0], seg=7)
        B.add("Accent", horn)
    for y in (-0.05, 0.18, 0.4):
        B.add("Detail", cyl(0.09 * S, 0.0, 0.16 * S, seg=4), T(0, y * D, P.top - 0.02, rz=45))
    W, Hh = 1.0 * S, 0.62 * S
    out = [(0.0, 0.0), (0.2 * W, 0.48 * Hh), (0.6 * W, 0.68 * Hh), (W, 0.78 * Hh), (0.82 * W, 0.12 * Hh),
           (0.62 * W, 0.3 * Hh), (0.45 * W, 0.02 * Hh), (0.28 * W, 0.16 * Hh)]
    wing = prism(ccw(out), 0.05 * S, bevel=0.012 * S, base=True)
    arm = tube([(0, 0, 0), (0.2 * W, 0, 0.48 * Hh), (0.6 * W, 0, 0.68 * Hh), (W, 0, 0.78 * Hh)], [0.05 * S, 0.04 * S, 0.03 * S, 0.0], seg=6)
    Mw = T(0.4 * S, 0.3 * S, P.cz + 0.05 * S, rz=-25)
    B.add("Detail", wing, Mw @ XZ, mirror=True)
    B.add("Main", arm, Mw @ T(y=-0.03 * S), mirror=True)
    patch(P, "Accent", 0, P.z0 + 0.24 * H, 0.32 * S, 0.2 * S, n=16)
    heart = [(0.0, -0.11), (0.1, 0.0), (0.11, 0.07), (0.06, 0.11), (0.0, 0.07), (-0.06, 0.11), (-0.11, 0.07), (-0.1, 0.0)]
    B.add("Glow", prism(ccw([(x * 1.3 * S, y * 1.3 * S) for x, y in heart]), 0.04 * S, bevel=0.012 * S, base=False),
          P.front(0, P.z0 + 0.22 * H, lift=0.012))
    eyes(P, z=P.cz + 0.16 * S, n=16)
    blush(P, z=P.cz + 0.03 * S)
    mouth(P, "smile", z=P.cz - 0.0 * S, w=0.13 * S)
    fang = prism([(-0.025 * S, 0), (0.025 * S, 0), (0.0, -0.055 * S)], 0.02, base=True)
    B.add("Teeth", fang, P.front(0.04 * S, P.cz - 0.025 * S, lift=0.004), mirror=True)
    for sgn in (1, -1):
        B.add("Eyes", dome(0.025 * S, 0.018 * S, 0.012, n=6, k=1, skirt=0.0), P.front(0.07 * S * sgn, P.cz + 0.06 * S))
    tail = bez((0, P.by - 0.05, P.z0 + 0.3 * S), (0, P.by + 0.4 * S, P.z0 + 0.2 * S), (0.2 * S, P.by + 0.55 * S, P.z0 + 0.25 * S),
               (0.35 * S, P.by + 0.6 * S, P.z0 + 0.45 * S), n=5)
    B.add("Main", tube(tail, [0.18 * S, 0.14 * S, 0.11 * S, 0.08 * S, 0.06 * S, 0.04 * S], seg=8))
    spade = [(0, 0), (0.12 * S, 0.06 * S), (0.0, 0.22 * S), (-0.12 * S, 0.06 * S)]
    B.add("Detail", prism(ccw(spade), 0.04 * S, bevel=0.01 * S, base=True), T(tail[-1].x, tail[-1].y, tail[-1].z - 0.02, rz=-60) @ XZ)
    feet(P, "Main", w=0.24 * S, round_=True)


def RuneOwl(B):
    P = Pet(B, 1.4, z0=0.12)
    S = P.S
    ear(P, "Main", None, 0.34 * S, 0.22 * S, 0.36 * S, 0.09 * S, tilt=24, tip=0.1)
    for sgn in (1, -1):
        patch(P, "Accent", 0.19 * S * sgn, P.cz + 0.07 * S, 0.2 * S, 0.21 * S, n=14)
    eyes(P, z=P.cz + 0.07 * S, rw=0.12 * S, rh=0.13 * S, dx=0.19 * S)
    B.add("Detail", prism([(-0.07 * S, 0.0), (0.0, -0.14 * S), (0.07 * S, 0.0)], 0.06 * S, bevel=0.015 * S, base=True),
          P.front(0, P.cz - 0.06 * S, lift=0.012))
    blush(P, dx=0.37 * S, z=P.cz - 0.13 * S)
    sc = dome(0.1 * S, 0.06 * S, 0.012, n=8, k=1, skirt=0.0)
    for (x, z) in ((-0.12, -0.3), (0.12, -0.3), (0.0, -0.38)):
        B.add("Accent", sc, P.front(x * S, P.cz + z * S))
    B.add("Glow", prism([(0, 0.08 * S), (-0.05 * S, 0), (0, -0.08 * S), (0.05 * S, 0)][::-1], 0.01, base=False),
          P.front(0, P.cz - 0.34 * S, lift=0.012))
    # folded wings on the sides with cream feather tips
    wing = prism(leaf_pts(0.62 * S, 0.5 * S, n=5, fat=0.6), 0.06 * S, bevel=0.015 * S, base=True)
    tipf = prism(leaf_pts(0.2 * S, 0.12 * S, n=3), 0.03 * S, base=True)
    for sgn in (1, -1):
        Mw = P.side(sgn, 0.05 * S, P.cz + 0.24 * S, rot=180 + 12 * sgn)
        B.add("Main", wing, Mw)
        for k in (-1, 0, 1):
            B.add("Accent", tipf, Mw @ T(0.11 * S * k, 0.5 * S, 0.06 * S - 0.01))
    feet(P, "Detail", w=0.17 * S, n=2)


def SkellyKitten(B):
    P = Pet(B, 1.36, z0=0.13)
    S = P.S
    ear(P, "Main", "Accent", 0.3 * S, 0.34 * S, 0.38 * S, 0.1 * S, tilt=10)
    patch(P, "Accent", 0, P.cz - 0.12 * S, 0.17 * S, 0.12 * S, n=12)
    E = eyes(P, z=P.cz + 0.1 * S, rw=0.12 * S, rh=0.13 * S)
    for x in (E["dx"], -E["dx"]):
        B.add("Glow", dome(0.04 * S, 0.04 * S, 0.01, n=6, k=1, skirt=0.0), P.front(x + 0.01 * S, E["z"] - 0.02 * S, lift=0.9 * E["h"]))
    B.add("Eyes", prism([(-0.03 * S, 0.02 * S), (0.0, -0.03 * S), (0.03 * S, 0.02 * S)], 0.012, base=False), P.front(0, P.cz - 0.07 * S, lift=0.01))
    mouth(P, "flat", z=P.cz - 0.14 * S, w=0.16 * S, lift=0.01)
    for x in (-0.05, 0.0, 0.05):
        B.add("Mouth", box_open(0.012 * S, 0.02, 0.05 * S, open_top=False), T(x * S, P.fy - 0.02, P.cz - 0.14 * S))
    blush(P, z=P.cz - 0.05 * S)
    # ribcage on the lower front: spine and ribs (Accent)
    B.add("Accent", box_open(0.04 * S, 0.02, 0.2 * S, open_top=False), T(0, P.fy - 0.006, P.z0 + 0.17 * S))
    rib = prism(ccw(stroke_pts([(0, 0), (0.1 * S, -0.01 * S), (0.17 * S, -0.05 * S)], 0.035 * S)), 0.014, base=False)
    for z in (0.22, 0.12):
        B.add("Accent", rib, P.front(0.02 * S, P.z0 + z * S), mirror=True)
    for i, p in enumerate(((0, 0.1, 0.0), (0.06, 0.25, 0.1), (0.12, 0.34, 0.25))):
        B.add("Accent", sphere(0.075 * S - 0.01 * i, seg=6, rings=4), T(p[0] * S, P.by + p[1] * S, P.z0 + 0.3 * S + p[2] * S))
    bow = bez((0.38 * S, P.by + 0.05, P.z0 + 0.1 * S), (0.6 * S, P.by + 0.1, P.cz), (0.6 * S, P.by + 0.1, P.cz + 0.3 * S),
              (0.38 * S, P.by + 0.05, P.top + 0.05 * S), n=5)
    B.add("Detail", tube(bow, 0.035 * S, seg=4))
    B.add("Accent", tube([bow[0], bow[-1]], 0.008 * S, seg=3))
    feet(P, "Main")


def SleepyOrb(B):
    P = Pet(B, 1.42, z0=0.15, r=0.3 * 1.42, seg=3)
    S = P.S
    closed_eyes(P, z=P.cz + 0.02 * S)
    blush(P, z=P.cz - 0.09 * S)
    mouth(P, "o", z=P.cz - 0.15 * S, w=0.1 * S)
    B.add("Glow", sphere(0.07 * S, seg=6, rings=4), T(0.09 * S, P.fy - 0.05 * S, P.cz - 0.2 * S))
    cap = tube(bez((0, 0.05 * S, P.top - 0.06 * S), (0, 0.05 * S, P.top + 0.25 * S), (0.2 * S, 0.1 * S, P.top + 0.45 * S),
                   (0.5 * S, 0.15 * S, P.top + 0.35 * S), n=4), [0.4 * S, 0.3 * S, 0.19 * S, 0.1 * S, 0.0], seg=10)
    B.add("Accent", cap)
    B.add("Detail", tube([(0, 0.05 * S, P.top - 0.12 * S), (0, 0.05 * S, P.top - 0.0 * S)], 0.43 * S, seg=10))
    B.add("Detail", sphere(0.11 * S, seg=8, rings=5), T(0.5 * S, 0.15 * S, P.top + 0.33 * S))
    zz = [(-0.5, 0.5), (0.5, 0.5), (0.5, 0.3), (-0.15, -0.3), (0.5, -0.3), (0.5, -0.5), (-0.5, -0.5), (-0.5, -0.3), (0.15, 0.3), (-0.5, 0.3)]
    for (x, z, s) in ((0.62, 0.62, 0.22), (0.8, 0.95, 0.16), (0.68, 1.22, 0.12)):
        pts = ccw([(px * s * S, py * s * S) for px, py in zz])
        B.add("Accent", prism(pts, 0.05 * S, base=True), T(x * S, 0.0, P.z0 + z * S + 0.5 * S) @ FRONT)
    for (x, z, s) in ((-0.62, 1.15, 0.1), (0.95, 0.55, 0.07)):
        B.add("Glow", prism(star_pts(s * S, 0.35 * s * S, 4), 0.03 * S, base=True), T(x * S, 0, P.z0 + z * S) @ FRONT)
    feet(P, "Accent", w=0.24 * S, inset=0.2)


def SlimeBuddy(B):
    P = Pet(B, 1.55, z0=0.06, r=0.24 * 1.55, seg=3)
    S, D, H = P.S, P.D, P.H
    # gooey puddle: a flattened blob spreading past the base, plus a few droplets
    B.add("Main", sphere(0.68 * S, 0.66 * S, 0.1 * S, seg=14, rings=5), T(0, 0, 0.06 * S))
    for (x, y, r_) in ((0.62, -0.42, 0.11), (-0.58, 0.5, 0.09), (-0.66, -0.2, 0.07)):
        B.add("Main", sphere(r_ * S, r_ * S, 0.6 * r_ * S, seg=8, rings=4), T(x * S, y * S, 0.04 * S))
    for (x, y, l) in ((-0.3, -1, 0.3), (0.24, -1, 0.18), (1, 0.12, 0.26), (-1, -0.2, 0.22), (0.05, 1, 0.3)):
        px, py = (x * S, y * (D / 2 + 0.005)) if abs(y) == 1 else (x * (S / 2 + 0.005), y * S)
        top_z = P.top - 0.14 * S
        B.add("Main", tube([(px, py, top_z), (px, py, top_z - l * S)], [0.065 * S, 0.075 * S], seg=7, cap0=False, cap1=False))
        B.add("Main", sphere(0.09 * S, seg=7, rings=5), T(px, py, top_z - l * S))
    B.add("Main", sphere(0.3 * S, 0.3 * S, 0.22 * S, seg=10, rings=6), T(0.1 * S, 0.05 * S, P.top - 0.02))
    B.add("Main", sphere(0.15 * S, seg=8, rings=5), T(0.16 * S, 0.08 * S, P.top + 0.2 * S))
    for (x, y, r_) in ((-0.25, 0.2, 0.12), (0.3, -0.25, 0.08)):
        B.add("Accent", dome(r_ * S, r_ * S, 0.01, n=10, k=1, skirt=0.0), P.topface(x * S, y * S))
    B.add("Accent", dome(0.1 * S, 0.08 * S, 0.01, n=10, k=1, skirt=0.0), P.side(1, 0.2 * S, P.cz + 0.1 * S))
    B.add("EyeShine", prism(ccw(stroke_pts([(0, 0), (0.08 * S, 0.12 * S), (0.2 * S, 0.18 * S)], 0.05 * S)), 0.012), P.front(-0.42 * S, P.top - 0.42 * S))
    eyes(P, z=P.cz + 0.08 * S, rw=0.12 * S, rh=0.14 * S, n=16)
    blush(P, z=P.cz - 0.08 * S)
    mouth(P, "grin", z=P.cz - 0.14 * S, w=0.2 * S)
    # little bubbles floating in the goo (Detail)
    for (x, z, r_) in ((0.36, 0.12, 0.05), (0.42, -0.02, 0.035), (-0.4, -0.3, 0.045)):
        B.add("Detail", dome(r_ * S, r_ * S, 0.6 * r_ * S, n=8, k=1, skirt=0.0), P.front(x * S, P.cz + z * S))


def SproutBunny(B):
    P = Pet(B, 1.3, z0=0.12)
    S = P.S
    ear(P, "Main", "Accent", 0.22 * S, 0.28 * S, 0.72 * S, 0.1 * S, tilt=6, inner=0.66, bulge=0.06, tip=0.4, n=3)
    B.add("Detail", tube([(0, 0.02, P.top - 0.02), (0.02 * S, 0.0, P.top + 0.18 * S)], 0.03 * S, seg=5))
    for sgn in (1, -1):
        B.add("Detail", prism(leaf_pts(0.26 * S, 0.16 * S, n=5), 0.03 * S, bevel=0.008 * S, base=True),
              T(0.02 * S, 0.0, P.top + 0.17 * S, ry=-60 * sgn) @ FRONT)
    eyes(P)
    blush(P)
    B.add("Accent", dome(0.05 * S, 0.035 * S, 0.025 * S, n=8, k=1, skirt=0.0), P.front(0, P.cz - 0.09 * S))
    mouth(P, "w", z=P.cz - 0.15 * S, w=0.12 * S)
    B.add("Accent", sphere(0.15 * S, seg=8, rings=5), T(0, P.by + 0.06 * S, P.z0 + 0.3 * S))
    feet(P, "Main")


PETS = [AcornSquirrel, BatPup, BumblePup, GolemCub, KnightCorgi, LanternMoth, LilMossjaw, MeadowStag,
        MossbackTurtle, RubbleMole, RuinGryphon, RuinheartDragon, RuneOwl, SkellyKitten, SleepyOrb, SlimeBuddy,
        SproutBunny]


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    report = {}
    all_objs = []
    for fn in PETS:
        name = fn.__name__
        if ONLY and name not in ONLY:
            continue
        B = Builder(name)
        fn(B)
        objs = B.build()
        all_objs += objs
        tr = B.tris()
        total = sum(tr.values())
        lo, hi = (300, 800) if name in SMALL else (400, 2000)
        flag = "" if lo <= total <= hi else f"  <-- OUT OF RANGE {lo}-{hi}"
        report[name] = dict(total=total, parts=tr)
        print(f"PET {name:16s} {'small' if name in SMALL else 'large'} tris {total:5d}  " + " ".join(f"{k}:{v}" for k, v in sorted(tr.items())) + flag, flush=True)
    json.dump(report, open(os.path.splitext(OUT)[0] + "_tris.json", "w"), indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
