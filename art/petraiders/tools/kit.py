"""Tiny low-poly modelling kit for Blender 4.x (bmesh based).

Every primitive returns a bmesh in local space.  Builder.add(role, bm, M) transforms it and
appends it to the part '<Role>_<Asset>'.  Shading: faces smooth, edges sharper than ~40 deg
are marked sharp (meshes use auto-smooth 180 deg, so only marked edges split normals).
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler

TAU = math.tau


def _bm():
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    return bm


def finalize(bm, sharp=40.0):
    bm.normal_update()
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = math.degrees(e.calc_face_angle(0.0)) < sharp
        else:
            e.smooth = True
    return bm


def T(x=0.0, y=0.0, z=0.0, rx=0.0, ry=0.0, rz=0.0, s=1.0):
    """Translation @ rotation (degrees, XYZ) @ scale (float or 3-tuple)."""
    sc = (s, s, s) if isinstance(s, (int, float)) else s
    return (Matrix.Translation((x, y, z)) @ Euler((math.radians(rx), math.radians(ry), math.radians(rz))).to_matrix().to_4x4()
            @ Matrix.Diagonal((sc[0], sc[1], sc[2], 1.0)))


MIRROR_X = Matrix.Diagonal((-1.0, 1.0, 1.0, 1.0))
FRONT = Euler((math.radians(90), 0, 0)).to_matrix().to_4x4()   # local +Z -> world -Y, local +Y -> world +Z


# ---------------------------------------------------------------- primitives
def rbox(sx, sy, sz, r=0.0, seg=2):
    """Box centred at the origin with rounded (bevelled) edges."""
    bm = _bm()
    bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if r > 0:
        r = min(r, 0.49 * min(sx, sy, sz))
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, offset_type="OFFSET", segments=seg,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    return finalize(bm)


def sphere(rx, ry=None, rz=None, seg=12, rings=6):
    ry = rx if ry is None else ry
    rz = rx if rz is None else rz
    bm = _bm()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0, calc_uvs=True)
    for v in bm.verts:
        v.co = Vector((v.co.x * rx, v.co.y * ry, v.co.z * rz))
    return finalize(bm, sharp=89)


def cyl(r1, r2, h, seg=12, caps=True, sharp=40.0):
    """Cylinder / cone along Z from z=0 to z=h."""
    bm = _bm()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r1, radius2=r2,
                          depth=h, calc_uvs=True)
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0, 0, h / 2))
    return finalize(bm, sharp)


def dome(rx, ry, h, n=16, k=2, skirt=0.02, base=False):
    """Low dome (spherical cap) on z=0 pointing +Z, with a short skirt below z=0 so it can be
    embedded in a surface.  Used for eyes, highlights, cheeks, spots, buttons."""
    bm = _bm()
    rings = []
    if skirt > 0:
        rings.append([bm.verts.new((rx * math.cos(TAU * j / n), ry * math.sin(TAU * j / n), -skirt)) for j in range(n)])
    for i in range(k):
        t = (i / k) * (math.pi / 2)
        c, z = math.cos(t), math.sin(t) * h
        rings.append([bm.verts.new((rx * c * math.cos(TAU * j / n), ry * c * math.sin(TAU * j / n), z)) for j in range(n)])
    top = bm.verts.new((0, 0, h))
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    for j in range(n):
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % n], top))
    if base:
        bm.faces.new(list(reversed(rings[0])))
    return finalize(bm, sharp=50)


def prism(pts, depth, bevel=0.0, base=False, sharp=40.0):
    """Extrude a 2D outline (list of (x, y), counter-clockwise) along +Z from 0 to depth.
    bevel>0 chamfers the top rim.  The base (z=0) face is omitted unless base=True."""
    bm = _bm()
    bot = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    n = len(bot)
    if bevel > 0:
        mid = [bm.verts.new((x, y, depth - bevel)) for x, y in pts]
        # inset the outline for the top ring
        top_pts = _inset(pts, bevel)
        top = [bm.verts.new((x, y, depth)) for x, y in top_pts]
        rings = [bot, mid, top]
    else:
        top = [bm.verts.new((x, y, depth)) for x, y in pts]
        rings = [bot, top]
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    bm.faces.new(rings[-1])
    if base:
        bm.faces.new(list(reversed(bot)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return finalize(bm, sharp)


def _inset(pts, d):
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1 = (p1 - p0).normalized(); e2 = (p2 - p1).normalized()
        n1 = Vector((-e1.y, e1.x)); n2 = Vector((-e2.y, e2.x))
        nn = (n1 + n2)
        if nn.length < 1e-6:
            nn = n1
        nn.normalize()
        cosh = max(0.35, nn.dot(n1))
        q = p1 + nn * (d / cosh)
        out.append((q.x, q.y))
    return out


def tube(points, radii, seg=8, cap0=True, cap1=True, sharp=50.0):
    """Sweep a circle along a polyline.  radii: float or list; a radius of 0 makes a point."""
    pts = [Vector(p) for p in points]
    if isinstance(radii, (int, float)):
        radii = [radii] * len(pts)
    bm = _bm()
    tans = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, len(pts) - 1)]
        tans.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = tans[0].cross(up).normalized()
    rings = []
    prev_t = tans[0]
    for i, (p, t, r) in enumerate(zip(pts, tans, radii)):
        if i > 0:
            q = prev_t.rotation_difference(t)
            nrm = (q @ nrm)
            nrm = (nrm - t * nrm.dot(t)).normalized()
        bin_ = t.cross(nrm)
        prev_t = t
        if r <= 1e-6:
            rings.append([bm.verts.new(p)])
        else:
            rings.append([bm.verts.new(p + (nrm * math.cos(TAU * j / seg) + bin_ * math.sin(TAU * j / seg)) * r) for j in range(seg)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for j in range(seg):
                bm.faces.new((a[0], b[j], b[(j + 1) % seg]))
        elif len(b) == 1:
            for j in range(seg):
                bm.faces.new((a[j], a[(j + 1) % seg], b[0]))
        else:
            for j in range(seg):
                bm.faces.new((a[j], a[(j + 1) % seg], b[(j + 1) % seg], b[j]))
    if cap0 and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if cap1 and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return finalize(bm, sharp)


def bez(p0, p1, p2, p3, n=6):
    p0, p1, p2, p3 = map(Vector, (p0, p1, p2, p3))
    out = []
    for i in range(n + 1):
        t = i / n
        out.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3)
    return out


def ear_pts(w, h, n=3, bulge=0.1, tip=0.16):
    """Rounded-triangle ear outline: base on y=0 (width w), tip at (0, h), counter-clockwise."""
    right = []
    for i in range(1, n + 1):
        t = i / (n + 1)
        x = (w / 2) * (1 - t) + (tip * w / 2) * t + bulge * w * math.sin(math.pi * t)
        right.append((x, h * t))
    left = [(-x, y) for x, y in reversed(right)]
    return [(-w / 2, 0.0), (w / 2, 0.0)] + right + [(tip * w / 2, h), (0.0, h * 1.03), (-tip * w / 2, h)] + left


def box_open(sx, sy, sz, open_top=True):
    """Plain box (flat shaded) without its top face -- cheap feet/legs tucked under a body."""
    bm = _bm()
    bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if open_top:
        tops = [f for f in bm.faces if f.normal.z > 0.9]
        bmesh.ops.delete(bm, geom=tops, context="FACES_ONLY")
    return finalize(bm)


def _area2(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def ccw(pts):
    """Return the outline in counter-clockwise order."""
    return pts if _area2(pts) > 0 else pts[::-1]


def ellipse_pts(rx, ry, n=12, start=0.0):
    return [(rx * math.cos(start + TAU * j / n), ry * math.sin(start + TAU * j / n)) for j in range(n)]


def star_pts(r_out, r_in, points=5, start=90.0):
    out = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(start) + math.pi * i / points
        out.append((r * math.cos(a), r * math.sin(a)))
    return out


def stroke_pts(path, width):
    """Outline (CCW) of a thick 2D polyline with rounded-ish ends (for mouths, brows, cracks)."""
    path = [Vector(p) for p in path]
    left, right = [], []
    for i, p in enumerate(path):
        a = path[max(i - 1, 0)]; b = path[min(i + 1, len(path) - 1)]
        d = (b - a).normalized()
        nn = Vector((-d.y, d.x))
        w = width / 2 * (0.75 if i in (0, len(path) - 1) else 1.0)
        left.append(p + nn * w); right.append(p - nn * w)
    pts = right + list(reversed(left))
    return [(v.x, v.y) for v in pts]


def leaf_pts(length, width, n=6, fat=0.8):
    """Pointed leaf / petal / ear outline along +Y from the origin (counter-clockwise)."""
    right = [(width / 2 * math.sin(math.pi * i / n) ** fat, length * i / n) for i in range(1, n)]
    left = [(-x, y) for x, y in reversed(right)]
    return [(0.0, 0.0)] + right + [(0.0, length)] + left


# ---------------------------------------------------------------- builder
class Builder:
    def __init__(self, asset):
        self.asset = asset
        self.parts = {}

    def bm(self, role):
        if role not in self.parts:
            self.parts[role] = _bm()
        return self.parts[role]

    def add(self, role, src, M=None, mirror=False):
        """Append src (bmesh) transformed by M; mirror=True also adds the X-mirrored copy."""
        mats = [M if M is not None else Matrix()]
        if mirror:
            mats.append(MIRROR_X @ mats[0])
        for m in mats:
            tmp = src.copy()
            bmesh.ops.transform(tmp, matrix=m, verts=tmp.verts[:])
            if m.determinant() < 0:
                bmesh.ops.reverse_faces(tmp, faces=tmp.faces[:])
            me = bpy.data.meshes.new("_t")
            tmp.to_mesh(me)
            tmp.free()
            self.bm(role).from_mesh(me)
            bpy.data.meshes.remove(me)

    def tris(self):
        return {r: sum(len(f.verts) - 2 for f in b.faces) for r, b in self.parts.items()}

    def build(self, collection=None):
        objs = []
        for role, b in self.parts.items():
            me = bpy.data.meshes.new(f"{self.asset}_{role}")
            b.to_mesh(me)
            me.use_auto_smooth = True
            me.auto_smooth_angle = math.pi
            ob = bpy.data.objects.new(f"{role}_{self.asset}", me)
            (collection or bpy.context.scene.collection).objects.link(ob)
            objs.append(ob)
        return objs


def export_fbx(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.fbx(
        filepath=path, use_selection=True, object_types={"MESH"},
        axis_forward="-Z", axis_up="Y", global_scale=1.0, apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE", bake_space_transform=False,
        use_mesh_modifiers=True, mesh_smooth_type="OFF", use_triangles=True,
        use_tspace=False, add_leaf_bones=False, bake_anim=False, path_mode="AUTO",
        embed_textures=False, use_custom_props=False)
