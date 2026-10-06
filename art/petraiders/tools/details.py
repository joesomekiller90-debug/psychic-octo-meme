"""Detail pass for eggs, items, enemies and projectiles (keeps their designs, adds detail).

    blender -b --factory-startup --python details.py -- IN.blend OUT.blend [only=A,B]

New geometry goes into each asset's existing parts (Main/Accent/Detail/Eyes/EyeShine/Glow), so
in-game colours still apply.  Decals on curved surfaces are wrapped onto the surface.
"""
import bpy, bmesh, sys, os, math, random, json
from collections import defaultdict
import numpy as np
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *

argv = sys.argv[sys.argv.index("--") + 1:]
IN, OUT = argv[0], argv[1]
ONLY = None
for a in argv[2:]:
    if a.startswith("only="):
        ONLY = set(a[5:].split(","))

bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(IN) as (s_, d_):
    d_.objects = s_.objects
scene = bpy.context.scene
for o in d_.objects:
    if o is not None and o.type == "MESH":
        scene.collection.objects.link(o)


def objs_of(asset):
    return {o.name.split("_", 1)[0]: o for o in scene.objects if o.type == "MESH" and o.name.split("_", 1)[1] == asset}


class A:
    """Detail accumulator for one asset with surface helpers."""
    def __init__(self, asset):
        self.asset = asset
        self.objs = objs_of(asset)
        self.add_bm = defaultdict(lambda: None)
        self.B = Builder(asset)
        co = np.concatenate([np.array([v.co[:] for v in o.data.vertices]) for o in self.objs.values()])
        self.lo, self.hi = co.min(0), co.max(0)
        self.c = (self.lo + self.hi) / 2
        self.size = float(np.linalg.norm(self.hi - self.lo))
        self.bvh = {}
        allv, allp, off = [], [], 0
        for role, o in self.objs.items():
            me = o.data
            vs = [v.co.copy() for v in me.vertices]
            ps = [list(p.vertices) for p in me.polygons]
            self.bvh[role] = BVHTree.FromPolygons(vs, ps)
            allv += vs
            allp += [[i + off for i in p] for p in ps]
            off += len(vs)
        self.all = BVHTree.FromPolygons(allv, allp)

    def cast(self, origin, direction, role=None):
        t = self.all if role is None else self.bvh[role]
        hit = t.ray_cast(Vector(origin), Vector(direction).normalized())
        return (hit[0], hit[1]) if hit[0] is not None else (None, None)

    def onto(self, target, d, role=None, up=(0, 0, 1)):
        """Hit point/normal on the surface seen from direction d (pointing outward from target)."""
        d = Vector(d).normalized()
        p, n = self.cast(Vector(target) + d * self.size * 2, -d, role)
        if p is None:
            return None, None, None
        return p, n, frame(n, up)

    def add(self, role, bm, M=None, mirror=False):
        self.B.add(role, bm, M if M is not None else Matrix(), mirror=mirror)

    def conform(self, role, bm, M, surf_role=None, lift=0.004):
        """Add a decal whose base (local z=0) is wrapped onto the surface along the decal normal."""
        n0 = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
        tmp = bm.copy()
        hs = [v.co.z for v in tmp.verts]
        bmesh.ops.transform(tmp, matrix=M, verts=tmp.verts[:])
        t = self.all if surf_role is None else self.bvh[surf_role]
        for v, hz in zip(tmp.verts, hs):
            base = v.co - n0 * hz
            hit = t.ray_cast(base + n0 * self.size * 0.2, -n0)
            if hit[0] is not None and (hit[0] - base).length < self.size * 0.15:
                v.co = hit[0] + n0 * (hz + lift)
        me = bpy.data.meshes.new("_c"); tmp.to_mesh(me); tmp.free()
        b2 = bmesh.new(); b2.from_mesh(me); bpy.data.meshes.remove(me)
        finalize(b2)
        self.B.add(role, b2, Matrix())

    def commit(self):
        added = 0
        for role, b in self.B.parts.items():
            ob = self.objs.get(role)
            if ob is None:
                me = bpy.data.meshes.new(f"{self.asset}_{role}")
                ob = bpy.data.objects.new(f"{role}_{self.asset}", me)
                scene.collection.objects.link(ob)
                me.use_auto_smooth = True; me.auto_smooth_angle = math.pi
                self.objs[role] = ob
            bm = bmesh.new(); bm.from_mesh(ob.data)
            n0 = len(bm.faces)
            tmp = bpy.data.meshes.new("_a"); b.to_mesh(tmp)
            bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
            bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method="BEAUTY", ngon_method="BEAUTY")
            bm.to_mesh(ob.data); bm.free()
            ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.pi
        return sum(len(o.data.polygons) for o in self.objs.values())


def frame(n, up=(0, 0, 1)):
    z = Vector(n).normalized()
    u = Vector(up)
    if abs(u.dot(z)) > 0.97:
        u = Vector((0, 1, 0)) if abs(z.y) < 0.9 else Vector((1, 0, 0))
    y = (u - z * u.dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def at(p, R, s=1.0, rz=0.0):
    M = R.to_4x4()
    M.translation = p
    return M @ T(rz=rz, s=s)


def sph_dir(az, el):
    """Direction from azimuth (deg, 0 = front -Y, 90 = +X) and elevation (deg)."""
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))


def spread(n, seed, el_lo=-35, el_hi=55, avoid=()):
    rng = random.Random(seed)
    pts = []
    tries = 0
    while len(pts) < n and tries < 4000:
        tries += 1
        az, el = rng.uniform(0, 360), math.degrees(math.asin(rng.uniform(math.sin(math.radians(el_lo)), math.sin(math.radians(el_hi)))))
        d = sph_dir(az, el)
        if any(d.angle(q) < math.radians(24) for q in pts + list(avoid)):
            continue
        pts.append(d)
    return pts


def sparkle(r, t=0.02):
    return prism(star_pts(r, 0.32 * r, 4), t, base=False)


def star5(r, t=0.02):
    return prism(star_pts(r, 0.45 * r, 5), t, base=False)


# ------------------------------------------------------------------ eggs
EGG_C = Vector((0, 0, 2.0))


def egg_scatter(X, role, shape, n, seed, el=(-30, 55), size_jit=0.25, avoid_roles=(), rot=True):
    rng = random.Random(seed)
    placed = 0
    for d in spread(n * 3, seed, *el):
        if placed >= n:
            break
        p, nrm, R = X.onto(EGG_C, d, role="Main")
        if p is None:
            continue
        # skip spots covered by existing decals
        q, _ = X.cast(p + nrm * 0.6, -nrm)
        if q is not None and (q - p).length > 0.02:
            continue
        s = 1.0 + rng.uniform(-size_jit, size_jit)
        X.conform(role, shape, at(p, R, s=s, rz=rng.uniform(0, 360) if rot else 0), surf_role="Main")
        placed += 1


def AncientEgg(X):
    egg_scatter(X, "Accent", dome(0.09, 0.07, 0.015, n=8, k=1, skirt=0.0), 10, 3)
    crack = prism(ccw(stroke_pts([(0, 0), (0.08, -0.15), (0.0, -0.3), (0.1, -0.48)], 0.05)), 0.02, base=False)
    for az in (25, 200):
        p, n, R = X.onto(EGG_C + Vector((0, 0, 1.1)), sph_dir(az, 30), role="Main")
        X.conform("Accent", crack, at(p, R), surf_role="Main")
    for az in range(20, 360, 72):     # pebbles between the crystals
        d = sph_dir(az, 0)
        X.add("Accent", sphere(0.16, 0.14, 0.1, seg=6, rings=4), T(d.x * 1.6, d.y * 1.6, 0.06, rz=az))


def BossEgg(X):
    # crown of spikes on top + extra claw marks on the back
    for i in range(5):
        a = i * 72
        d = sph_dir(a, 62)
        p, n, R = X.onto(EGG_C + Vector((0, 0, 1.0)), d, role="Main")
        X.add("Main", cyl(0.16, 0.0, 0.42, seg=6), at(p - n * 0.05, frame(n)))
    claw = prism(ccw(stroke_pts([(0, 0.5), (0.05, 0.2), (0.0, -0.2), (-0.08, -0.5)], 0.07)), 0.02, base=False)
    for k in (-1, 0, 1):
        p, n, R = X.onto(EGG_C, sph_dir(180 + 14 * k, 8 - 6 * abs(k)), role="Main")
        X.conform("Glow", claw, at(p, R, rz=-12), surf_role="Main")
    egg_scatter(X, "Glow", dome(0.05, 0.05, 0.01, n=6, k=1, skirt=0.0), 8, 11)


def CelestialEgg(X):
    egg_scatter(X, "Glow", star5(0.11), 7, 5, avoid_roles=("Glow",))
    egg_scatter(X, "Glow", dome(0.04, 0.04, 0.01, n=6, k=1, skirt=0.0), 10, 9)
    # orbit ring
    ring = tube([(1.85 * math.cos(t), 1.85 * math.sin(t), 0) for t in np.linspace(0, math.tau, 33)], 0.05, seg=4, cap0=False, cap1=False)
    X.add("Glow", ring, T(0, 0, 1.85, rx=18, ry=-12))


def MeadowEgg(X):
    leaf = prism(leaf_pts(0.42, 0.22, n=5), 0.025, base=False)
    egg_scatter(X, "Accent", leaf, 5, 21)
    for i in range(12):    # grass tuft around the base, leaning outward against the shell
        a = i * 30 + (i % 2) * 8
        d = sph_dir(a, 0)
        p, n = X.cast(Vector((0, 0, 0.32)) + d * 3.0, -d, role="Main")
        if p is None:
            continue
        X.add("Accent", prism(leaf_pts(0.36 + 0.12 * (i % 3), 0.13, n=4), 0.035, base=True),
              T(p.x, p.y, 0.0, rz=a + 180) @ Euler((math.radians(90 - 18), 0, 0)).to_matrix().to_4x4())


def Mystery1KEgg(X):
    egg_scatter(X, "Detail", sparkle(0.12), 6, 31)
    egg_scatter(X, "Accent", dome(0.05, 0.05, 0.01, n=6, k=1, skirt=0.0), 8, 33, el=(0, 60))


def Mystery10KEgg(X):
    egg_scatter(X, "Detail", sparkle(0.14), 8, 41)
    # crown of upward teeth near the top (Accent), wrapped onto the shell
    tooth = prism([(-0.13, 0.0), (0.13, 0.0), (0.0, 0.24)], 0.035, base=False)
    for i in range(14):
        az = i * 360 / 14
        p, n, R = X.onto(Vector((0, 0, 3.05)), sph_dir(az, 0), role="Main")
        if p is not None:
            X.conform("Accent", tooth, at(p, R), surf_role="Main")
    for az in (0, 90, 180, 270):
        p, n, R = X.onto(Vector((0, 0, 3.0)), sph_dir(az + 360 / 28, 0), role="Main")
        X.add("Detail", dome(0.06, 0.06, 0.035, n=8, k=1, skirt=0.01), at(p, R))


def RebornEgg(X):
    egg_scatter(X, "Glow", dome(0.05, 0.05, 0.012, n=6, k=1, skirt=0.0), 12, 51, el=(-10, 70))
    flame = prism(ccw([(0, 0), (0.12, 0.1), (0.1, 0.3), (0.03, 0.5), (0.05, 0.3), (-0.06, 0.18), (-0.1, 0.06)]), 0.03, base=False)
    for az in (30, 150, 270):
        p, n, R = X.onto(EGG_C + Vector((0, 0, 1.2)), sph_dir(az, 50), role="Main")
        X.conform("Glow", flame, at(p, R, s=1.3), surf_role="Main")


def RuinsEgg(X):
    crack = prism(ccw(stroke_pts([(0, 0), (0.1, -0.16), (0.02, -0.32), (0.12, -0.5), (0.06, -0.62)], 0.045)), 0.02, base=False)
    for az, el in ((40, 10), (140, -5), (220, 20), (300, 0)):
        p, n, R = X.onto(EGG_C, sph_dir(az, el), role="Main")
        X.conform("Accent", crack, at(p, R, rz=15), surf_role="Main")
    egg_scatter(X, "Accent", prism(ccw([(0, 0), (0.1, 0.02), (0.12, 0.1), (0.03, 0.12)]), 0.02, base=False), 6, 61)


# ------------------------------------------------------------------ items
def rivet(r=0.04, n=6):
    return dome(r, r, 0.6 * r, n=n, k=1, skirt=0.0)


def strap_rivets(X, role="Accent", r=0.045, along=4):
    """Rivets down the front of each vertical strap piece of a chest (straps are thin tall islands)."""
    me = X.objs[role].data
    bm = bmesh.new(); bm.from_mesh(me)
    seen, isl = set(), []
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, cur = [v], [v.co.copy()]
        seen.add(v.index)
        while stack:
            x = stack.pop()
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen:
                    seen.add(y.index); stack.append(y); cur.append(y.co.copy())
        isl.append(np.array([c[:] for c in cur]))
    bm.free()
    for c in isl:
        lo, hi = c.min(0), c.max(0)
        ext = hi - lo
        if ext[2] > 3 * max(ext[0], ext[1]) and ext[1] < 0.12:     # vertical strap on the front/back face
            sgn = -1 if lo[1] < 0 else 1
            y = lo[1] if sgn < 0 else hi[1]
            for t in np.linspace(0.15, 0.85, along):
                X.add(role, rivet(r), T((lo[0] + hi[0]) / 2, y - 0.004 * sgn, lo[2] + t * ext[2]) @ (FRONT if sgn < 0 else T(rx=-90)))


def chest_common(X, w, d, body_h, role_strap="Accent"):
    strap_rivets(X, role_strap)
    # side handles (rings) and plank grooves on the front/back
    ring = tube([(0.16 * math.cos(t), 0, 0.16 * math.sin(t)) for t in np.linspace(math.pi, 2 * math.pi, 9)], 0.035, seg=5)
    for sgn in (1, -1):
        X.add(role_strap, ring, T(sgn * (w / 2 + 0.02), 0, body_h * 0.62, rz=90))
        X.add(role_strap, rivet(0.05), T(sgn * (w / 2 + 0.004), 0.16, body_h * 0.62, ry=90 * sgn))
        X.add(role_strap, rivet(0.05), T(sgn * (w / 2 + 0.004), -0.16, body_h * 0.62, ry=90 * sgn))
    for z in (0.33, 0.66):
        for sgn in (1, -1):
            X.add("Main", box_open(w * 0.22, 0.012, 0.025, open_top=False), T(sgn * w * 0.18, -d / 2 - 0.004, body_h * z))
            X.add("Main", box_open(w * 0.22, 0.012, 0.025, open_top=False), T(sgn * w * 0.18, d / 2 + 0.004, body_h * z))


def DailyChest(X):
    chest_common(X, 2.415, 1.509, 1.147)
    X.add("Glow", sparkle(0.12, 0.03), T(0.42, -0.9, 1.55) @ FRONT)


def FloorChest(X):
    chest_common(X, 1.811, 1.132, 0.86)


def VipChest(X):
    chest_common(X, 2.415, 1.509, 1.147)
    for x in (-0.95, 0.95):
        X.add("Glow", dome(0.07, 0.07, 0.04, n=8, k=1, skirt=0.01), T(x, -0.79, 1.0) @ FRONT)
    X.add("Glow", sparkle(0.12, 0.03), T(-0.62, -0.95, 1.95) @ FRONT)


def Coin(X):
    dot = dome(0.022, 0.022, 0.012, n=6, k=1, skirt=0.0)
    for side in (-1, 1):
        for i in range(12):
            a = math.tau * i / 12 + math.pi / 12
            x, z = 0.36 * math.cos(a), 0.5 + 0.36 * math.sin(a)
            X.add("Accent", dot, T(x, side * 0.0705, z) @ (FRONT if side < 0 else T(rx=-90)))


def EggPedestal(X):
    stud = dome(0.08, 0.08, 0.05, n=6, k=1, skirt=0.0)
    for i in range(16):
        a = math.tau * i / 16
        X.add("Accent", stud, T(2.86 * math.cos(a), 2.86 * math.sin(a), 2.92))
        X.add("Accent", stud, T(2.95 * math.cos(a + 0.2), 2.95 * math.sin(a + 0.2), 0.3))
    rune = prism([(0, 0.18), (-0.1, 0), (0, -0.18), (0.1, 0)][::-1], 0.03, bevel=0.01, base=False)
    for i in range(8):
        a = math.tau * (i + 0.5) / 8
        d = Vector((math.cos(a), math.sin(a), 0))
        p, n, R = X.onto(Vector((0, 0, 1.55)), d, role="Main")
        if p is not None:
            X.add("Glow", rune, at(p, R))


def BigTreat(X):
    rng = random.Random(7)
    sprinkle = tube([(-0.05, 0, 0), (0.05, 0, 0)], 0.018, seg=5)
    for i in range(18):
        x, y = rng.uniform(-1.0, 1.0), rng.uniform(-0.25, 0.25)
        if abs(x) > 0.55:
            y = rng.uniform(-0.45, 0.45)
        p, n = X.cast((x, y, 2.0), (0, 0, -1), role="Accent")
        if p is None:
            continue
        X.add("Detail", sprinkle, T(p.x, p.y, p.z + 0.012, rz=rng.uniform(0, 180)))


def SmallTreat(X):
    rng = random.Random(9)
    chip = sphere(0.06, 0.05, 0.035, seg=6, rings=4)
    for i in range(6):
        a, r = rng.uniform(0, math.tau), rng.uniform(0.1, 0.4)
        p, n = X.cast((r * math.cos(a), 1.0, 0.55 + r * math.sin(a)), (0, -1, 0), role="Main")
        if p is not None:
            X.add("Detail", chip, T(p.x, p.y, p.z))
    crumb = dome(0.025, 0.02, 0.012, n=5, k=1, skirt=0.0)
    for i in range(14):
        a, r = rng.uniform(0, math.tau), rng.uniform(0.05, 0.48)
        side = -1 if i % 2 else 1
        p, n = X.cast((r * math.cos(a), side * 1.0, 0.55 + r * math.sin(a)), (0, -side, 0), role="Main")
        if p is not None:
            X.add("Main", crumb, at(p, frame(n)))


def Feast(X):
    for x in (-0.4, 0.4):
        for dz in (0.0, 0.06):
            X.add("Accent", tube([(x * 1.0, -0.05, 1.0 + dz), (x * 1.0, 0.05, 1.0 + dz)], 0.04, seg=6), Matrix())
    for x, y in ((-0.8, -0.5), (0.8, -0.5), (-0.8, 0.5), (0.8, 0.5)):
        X.add("Accent", rivet(0.045), T(x, y, 0.92))
    X.add("Accent", rbox(0.14, 0.05, 0.16, 0.02, 1), T(0, -0.6, 0.78))


def PhoenixFeather(X):
    rng = random.Random(4)
    for i in range(7):
        X.add("Glow", sparkle(0.04 + 0.03 * rng.random(), 0.01), T(0.05 + rng.uniform(-0.35, 0.35), -0.01, 0.5 + rng.uniform(0.2, 1.0)) @ FRONT)
    for z in (0.45, 0.65, 0.85):
        X.add("Glow", sphere(0.025, seg=6, rings=4), T(0.045 + (z - 0.45) * 0.1, -0.02, z))


# ------------------------------------------------------------------ enemies / projectiles
def Bat(X):
    # finger bones laid along each wing membrane (ray-cast onto it), fur tuft, wing-tip claws
    for sgn in (1, -1):
        for (x1, z1) in ((1.6, 2.65), (1.95, 2.05), (2.2, 1.5)):
            pts = []
            for t in np.linspace(0.0, 1.0, 5):
                x = (0.75 + (x1 - 0.75) * t) * sgn
                z = 1.95 + (z1 - 1.95) * t + 0.25 * math.sin(math.pi * t)
                p, n = X.cast((x, -6.0, z), (0, 1, 0), role="Accent")
                if p is None:
                    continue
                pts.append(p + Vector((0, -0.04, 0)))
            if len(pts) >= 3:
                X.add("Main", tube(pts, [0.04] + [0.032] * (len(pts) - 2) + [0.0], seg=5))
        X.add("EyeShine", cyl(0.04, 0.0, 0.14, seg=5), T(2.36 * sgn, -0.1, 2.92, ry=-30 * sgn))
    for i, a in enumerate((-25, 0, 25)):
        X.add("Main", cyl(0.07, 0.0, 0.28, seg=5), T(0.09 * (i - 1), 0.0, 2.05, ry=a))


def BrambleBrute(X):
    rng = random.Random(12)
    for i in range(16):
        d = sph_dir(rng.uniform(0, 360), rng.uniform(-10, 60))
        p, n, R = X.onto(Vector((0, 0, 2.6)), d, role="Main")
        if p is None:
            continue
        if i % 3 == 0:
            for k in range(3):
                off = Vector((0.08 * math.cos(k * 2.1), 0.08 * math.sin(k * 2.1), 0))
                X.add("Detail", sphere(0.08, seg=6, rings=4), at(p + (R @ off) + n * 0.05, R))
        else:
            X.add("Accent", prism(leaf_pts(0.32, 0.16, n=4), 0.03, base=True), at(p, R, rz=rng.uniform(0, 360)) @ T(rx=60))
    for i in range(10):      # extra thorns on the arms
        d = sph_dir(rng.choice((80, 280)) + rng.uniform(-30, 30), rng.uniform(-40, 30))
        p, n, R = X.onto(Vector((0, 0, 1.6)), d, role="Accent")
        if p is None:
            continue
        X.add("Accent", cyl(0.06, 0.0, 0.25, seg=5), at(p - n * 0.03, frame(n)))


def Mossjaw(X):
    rng = random.Random(5)
    # row of back spikes along the spine and moss tufts
    for i in range(7):
        y = 1.2 + i * 0.75
        p, n = X.cast((0, y, 12.0), (0, 0, -1), role="Main")
        if p is None:
            continue
        X.add("Detail", cyl(0.32 - 0.02 * i, 0.0, 0.7 - 0.04 * i, seg=5), at(p - n * 0.08, frame(n), rz=36))
    for i in range(8):
        d = sph_dir(rng.uniform(90, 270), rng.uniform(20, 60))
        p, n, R = X.onto(Vector((0, 1.5, 5.0)), d, role="Main")
        if p is None:
            continue
        for k in range(3):
            X.add("Accent", prism(leaf_pts(0.45, 0.2, n=4), 0.05, base=True), at(p, R, rz=k * 120 + rng.uniform(0, 40)) @ T(rx=55))


def ShieldGolem(X):
    rng = random.Random(8)
    crack = prism(ccw(stroke_pts([(0, 0), (0.1, -0.15), (0.02, -0.3), (0.14, -0.46)], 0.05)), 0.02, base=False)
    for (az, el) in ((60, 30), (120, 10), (200, 40), (300, 20)):
        p, n, R = X.onto(Vector((0, 0.2, 3.0)), sph_dir(az, el), role="Main")
        if p is not None:
            X.add("Detail", crack, at(p + n * 0.004, R, rz=rng.uniform(-30, 30)))
    for (az, el) in ((70, 55), (290, 55), (180, 70)):
        p, n, R = X.onto(Vector((0, 0.3, 3.4)), sph_dir(az, el), role="Main")
        if p is not None:
            X.add("Accent", rbox(0.5, 0.42, 0.12, 0.05, 1), at(p, R))
    for sgn in (1, -1):
        p, n, R = X.onto(Vector((1.4 * sgn, 0.3, 2.4)), Vector((sgn, 0, 0.2)), role="Main")
        if p is not None:
            X.add("Glow", prism([(0, 0.16), (-0.08, 0), (0, -0.16), (0.08, 0)][::-1], 0.02, base=False), at(p + n * 0.005, R))


def SkeletonArcher(X):
    # quiver with arrows on the back, feather in the hat, belt
    q = cyl(0.17, 0.15, 1.0, seg=8)
    X.add("Detail", q, T(0.25, 0.45, 1.9, rx=-15, ry=20))
    for k in range(3):
        base = Matrix.Translation((0.25, 0.45, 1.9)) @ Euler((math.radians(-15), math.radians(20), 0)).to_matrix().to_4x4()
        X.add("Main", cyl(0.02, 0.02, 0.45, seg=4), base @ T(0.06 * (k - 1), 0.03 * k, 0.9))
        X.add("EyeShine", prism(ccw([(0, 0), (0.06, 0.05), (0.06, 0.16), (0.0, 0.1)]), 0.01, base=True), base @ T(0.06 * (k - 1), 0.03 * k, 1.3) @ T(rx=90))
    X.add("Accent", prism(leaf_pts(0.6, 0.2, n=5), 0.03, base=True), T(0.42, 0.1, 3.95, ry=40, rx=-20) @ FRONT)
    X.add("Detail", tube([(0.42 * math.cos(t), 0.3 * math.sin(t) + 0.05, 1.55) for t in np.linspace(0, math.tau, 13)], 0.035, seg=4, cap0=False, cap1=False))


def Acorn(X):
    X.add("Accent", prism(leaf_pts(0.22, 0.12, n=4), 0.015, base=True), T(0.05, 0.0, 0.58, ry=-55) @ FRONT)


def Arrow(X):
    for y in (0.55, 0.62):
        X.add("Detail", tube([(0, y - 0.02, 0), (0, y + 0.02, 0)], 0.045, seg=6), T(0, 0, 0))


def RuneBolt(X):
    for i, (y, s) in enumerate(((0.95, 0.09), (1.15, 0.06), (1.32, 0.04))):
        X.add("Glow", sparkle(s, 0.015), T(0.05 * (i % 2), y, 0.0, rx=90))


def StarBolt(X):
    for i, (x, y, s) in enumerate(((0.3, 0.9, 0.08), (0.5, 1.1, 0.06), (0.2, 1.25, 0.05))):
        X.add("Glow", sparkle(s, 0.015), T(x, y, 0.1 * i, rx=90))


def SlimeGlob(X):
    for (x, y, l) in ((0.15, -0.2, 0.18), (-0.12, 0.1, 0.14), (0.05, 0.3, 0.12)):
        p, n = X.cast((x, y, 2.0), (0, 0, -1), role="Main")
        if p is None:
            continue
        X.add("Main", tube([(p.x, p.y, p.z - 0.25), (p.x, p.y, p.z - 0.25 - l)], [0.035, 0.04], seg=6, cap0=False, cap1=False))
        X.add("Main", sphere(0.05, seg=6, rings=4), T(p.x, p.y, p.z - 0.25 - l))


RECIPES = [AncientEgg, BossEgg, CelestialEgg, MeadowEgg, Mystery1KEgg, Mystery10KEgg, RebornEgg, RuinsEgg,
           DailyChest, FloorChest, VipChest, Coin, EggPedestal, BigTreat, SmallTreat, Feast, PhoenixFeather,
           Bat, BrambleBrute, Mossjaw, ShieldGolem, SkeletonArcher, Acorn, Arrow, RuneBolt, StarBolt, SlimeGlob]

assets_here = {o.name.split("_", 1)[1] for o in scene.objects if o.type == "MESH"}
report = {}
for fn in RECIPES:
    name = fn.__name__
    if name not in assets_here or (ONLY and name not in ONLY):
        continue
    X = A(name)
    before = sum(len(o.data.polygons) for o in X.objs.values())
    fn(X)
    after = X.commit()
    report[name] = dict(before=before, after=after)
    print(f"DETAIL {name:16s} tris {before:5d} -> {after:5d}  (+{after - before})", flush=True)
json.dump(report, open(os.path.splitext(OUT)[0] + "_details.json", "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
