"""Builds a Bowie-style duel knife for Roblox and exports it.

Run with Blender:   blender --background --python build_knife.py
or with pip's bpy:  python build_knife.py

1 Blender unit = 1 Roblox stud. The knife is modelled with the blade pointing
along +Y and the cutting edge facing -Z, which the FBX export (Y up, -Z forward)
turns into a blade pointing along the part's LookVector with the edge down.

Outputs (next to this script):
  Knife.blend           editable source scene
  Knife.fbx             3 MeshParts: Blade, Guard, Handle
  Knife_Combined.fbx    the same knife as a single mesh
  knife_preview.png     render
"""

import math
import os

import bpy  # must come before bmesh when using the pip bpy module
import bmesh
import numpy as np
from mathutils import Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Dimensions (studs)
# ---------------------------------------------------------------------------
BLADE_START = 0.0     # blade root sits inside the guard
BLADE_LEN = 1.8
SPINE_Z = 0.21        # top of the blade (spine)
EDGE_Z = -0.33        # bottom of the blade (cutting edge)
TIP_Z = 0.03          # height of the point
CLIP_START = 0.56     # fraction of the length where the clip point begins
BELLY_START = 0.42    # fraction of the length where the edge starts sweeping up
SPINE_HALF_T = 0.05   # half thickness at the spine
GRIND = 0.66          # primary grind line, as a fraction from the edge to the spine
EDGE_BEVEL = 0.14     # secondary (cutting) bevel height, same scale
FULLER = (0.1, 0.52)  # fuller groove start and end, as fractions of the length
FULLER_DEPTH = 0.022
RICASSO = 0.085       # unsharpened section before the plunge line
CHOIL = (0.02, 0.07)  # rounded notch at the start of the edge
CHOIL_DEPTH = 0.05
JIMPING = (0.1, 0.26) # thumb notches on the spine
JIMPING_NOTCHES = 7
JIMPING_DEPTH = 0.016

GUARD_Z = (-0.5, 0.36)    # crescent guard extent, edge side to spine side
GUARD_CURVE = 0.2         # how far the guard tips sweep toward the blade
GUARD_R = (0.085, 0.06)   # guard cross-section radii (x, y)

HANDLE_TOP = -0.08
HANDLE_LEN = 1.12
HANDLE_RX = 0.12
HANDLE_RZ = 0.17

RING_SEGMENTS = 20
SMOOTH_ANGLE = math.radians(50)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'NONE'
    return scene


def make_material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = (*color, 1.0)
    return mat


def bm_to_object(bm, name, material, parent=None, smooth_angle=SMOOTH_ANGLE):
    """smooth_angle=None keeps the sharp edges already marked in the bmesh."""
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        face.smooth = True
    bm.to_mesh(mesh)
    bm.free()

    if smooth_angle is not None:
        mesh.set_sharp_from_angle(angle=smooth_angle)
    mesh.materials.append(material)

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def loft(bm, rings, cap_start=True, cap_end=True):
    """Bridges a list of equal-length vertex rings with quads.

    A ring of length 1 is treated as a point and fanned with triangles.
    Returns the created vertex rings.
    """
    vert_rings = [[bm.verts.new(co) for co in ring] for ring in rings]
    for a, b in zip(vert_rings, vert_rings[1:]):
        if len(a) == 1 or len(b) == 1:
            ring, tip = (b, a[0]) if len(a) == 1 else (a, b[0])
            n = len(ring)
            for i in range(n):
                bm.faces.new((ring[i], ring[(i + 1) % n], tip))
            continue
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_start and len(vert_rings[0]) > 2:
        bm.faces.new(vert_rings[0])
    if cap_end and len(vert_rings[-1]) > 2:
        bm.faces.new(vert_rings[-1])
    return vert_rings


def swept_ring(center, tangent, side, r_side, r_other, n=RING_SEGMENTS):
    """Ellipse around `center`, perpendicular to `tangent`. `side` is the
    direction the r_side radius points along."""
    t = tangent.normalized()
    a = (side - t * side.dot(t)).normalized()
    b = t.cross(a).normalized()
    return [
        center
        + a * (r_side * math.cos(2 * math.pi * i / n))
        + b * (r_other * math.sin(2 * math.pi * i / n))
        for i in range(n)
    ]


def sweep(bm, centers, radii, side, n=RING_SEGMENTS, end_points=(None, None)):
    """Lofts ellipses along a polyline. Optional end points close each end
    with a rounded fan instead of a flat cap."""
    rings = []
    for k, (c, (rs, ro)) in enumerate(zip(centers, radii)):
        prev_c = centers[max(k - 1, 0)]
        next_c = centers[min(k + 1, len(centers) - 1)]
        rings.append(swept_ring(c, next_c - prev_c, side, rs, ro, n))
    start, end = end_points
    if start is not None:
        rings.insert(0, [start])
    if end is not None:
        rings.append([end])
    return loft(bm, rings, cap_start=start is None, cap_end=end is None)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp_profile(profile, u):
    """Piecewise-smooth interpolation through (u, value) keys."""
    for (u0, v0), (u1, v1) in zip(profile, profile[1:]):
        if u <= u1:
            return v0 + (v1 - v0) * smoothstep(u0, u1, u)
    return profile[-1][1]


# ---------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------
def blade_profile(t, notches=True):
    """Spine and edge heights at fraction t along the blade. With
    notches=False the jimping and choil are left out, which gives the smooth
    outline the grind lines and fuller are placed against."""
    # clip point: the spine dips in a concave curve down to the point
    s = max(0.0, (t - CLIP_START) / (1 - CLIP_START))
    z_top = SPINE_Z - (SPINE_Z - TIP_Z) * (1 - (1 - s) ** 1.9)
    # belly: the edge sweeps up in a convex curve to the point
    b = max(0.0, (t - BELLY_START) / (1 - BELLY_START))
    z_bot = EDGE_Z + (TIP_Z - EDGE_Z) * b ** 2.3
    if not notches:
        return z_top, z_bot

    # jimping: thumb notches cut into the spine
    j0, j1 = JIMPING
    if j0 <= t <= j1:
        phase = (t - j0) / (j1 - j0) * JIMPING_NOTCHES
        z_top -= JIMPING_DEPTH * (1 - abs(2 * (phase % 1.0) - 1))
    # choil: rounded notch where the sharpened edge begins
    c0, c1 = CHOIL
    if c0 < t < c1:
        u = (t - c0) / (c1 - c0) * 2 - 1
        z_bot += CHOIL_DEPTH * math.sqrt(1 - u * u)
    return z_top, z_bot


def blade_stations():
    """Fractions along the blade where cross-sections are placed: denser
    toward the curved tip, plus extra ones to cut the choil and jimping."""
    base = [1 - (1 - k / 36) ** 1.5 for k in range(36)]
    c0, c1 = CHOIL
    choil = [c0 + (c1 - c0) * k / 8 for k in range(9)]
    j0, j1 = JIMPING
    jimping = [j0 + (j1 - j0) * k / (2 * JIMPING_NOTCHES) for k in range(2 * JIMPING_NOTCHES + 1)]
    features = sorted(choil + jimping)
    # drop base stations that would crowd the feature stations
    kept = [t for t in base if t == 0.0 or min(abs(t - f) for f in features) > 0.006]
    stations = sorted(kept + features)
    detail = {t for t in features}
    return stations, detail


def build_blade(material, parent):
    """Bowie blade: clip point with a sharpened swedge, a fuller groove, thumb
    jimping on the spine, an unsharpened ricasso with a choil and plunge line,
    a flat primary grind and a bright secondary cutting bevel."""
    bm = bmesh.new()
    stations, detail = blade_stations()
    f0, f1 = FULLER
    rings = []
    for t in stations:
        y = BLADE_START + t * BLADE_LEN
        z_top, z_bot = blade_profile(t)
        smooth_top, smooth_bot = blade_profile(t, notches=False)
        h = smooth_top - smooth_bot

        taper = 1 - 0.45 * t
        spine_t = SPINE_HALF_T * taper
        # the clip is ground to a false edge
        clip_t = spine_t * (1 - 0.85 * smoothstep(CLIP_START, CLIP_START + 0.16, t))
        # ricasso: full thickness until the plunge line, then the grind starts
        g = smoothstep(RICASSO, RICASSO + 0.05, t)
        bevel_t = spine_t * (1 - 0.62 * g)
        edge_t = spine_t * 0.55 * (1 - g) + 0.004 * (1 - t) * g
        z_grind = smooth_bot + h * GRIND
        z_bevel = z_bot + h * EDGE_BEVEL * g + 0.012 * (1 - g)

        # fuller groove in the flat between the grind line and the spine,
        # fading in and out at its ends
        fade = smoothstep(f0, f0 + 0.07, t) * (1 - smoothstep(f1 - 0.07, f1, t))
        depth = FULLER_DEPTH * fade
        upper = smooth_top - z_grind
        zf_top = z_grind + upper * 0.8
        zf_bot = z_grind + upper * 0.3
        inset = (zf_top - zf_bot) * 0.28

        side = [
            (clip_t, z_top),
            (spine_t, zf_top),
            (spine_t - depth, zf_top - inset),
            (spine_t - depth, zf_bot + inset),
            (spine_t, zf_bot),
            (spine_t, z_grind),
            (bevel_t, z_bevel),
            (edge_t, z_bot),
        ]
        ring = [Vector((x, y, z)) for x, z in side]
        ring += [Vector((-x, y, z)) for x, z in reversed(side)]
        rings.append(ring)
    rings.append([Vector((0.0, BLADE_START + BLADE_LEN, TIP_Z))])
    vert_rings = loft(bm, rings, cap_start=True, cap_end=False)

    # every lengthwise edge is a bevel crease; the cross edges stay smooth so
    # the curved clip and belly shade cleanly, except where notches are cut
    sharp_rings = {0} | {k for k, t in enumerate(stations) if t in detail}
    ring_of = {v: k for k, ring in enumerate(vert_rings) for v in ring}
    for e in bm.edges:
        a, b = (ring_of[v] for v in e.verts)
        if a != b or a in sharp_rings:
            e.smooth = False
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return bm_to_object(bm, "Blade", material, parent, smooth_angle=None)


def build_guard(material, parent):
    """Slim gold crescent guard whose tips sweep toward the blade, plus the
    gold collar between the guard and the grip."""
    bm = bmesh.new()
    z0, z1 = GUARD_Z
    zc = (z0 + z1) / 2
    half = (z1 - z0) / 2
    steps = 22
    centers, radii = [], []
    for k in range(steps + 1):
        z = z0 + (z1 - z0) * k / steps
        u = (z - zc) / half  # -1 .. 1
        # flat across the blade root so it stays covered, sweeping only at the tips
        y = 0.0 + GUARD_CURVE * u ** 4
        centers.append(Vector((0.0, y, z)))
        # thick in the middle, thin arms, small rounded knobs at the tips
        end = abs(u)
        scale = 1.0 - 0.4 * smoothstep(0.7, 0.88, end) + 0.2 * smoothstep(0.88, 0.97, end)
        radii.append((GUARD_R[0] * scale, GUARD_R[1] * scale))
    tip_lo = centers[0] + (centers[0] - centers[1]).normalized() * radii[0][1] * 0.9
    tip_hi = centers[-1] + (centers[-1] - centers[-2]).normalized() * radii[-1][1] * 0.9
    sweep(bm, centers, radii, Vector((1, 0, 0)), end_points=(tip_lo, tip_hi))

    # collar: short oval band around the top of the grip
    collar = [  # (y, scale)
        (-0.02, 0.86),
        (-0.04, 1.0),
        (-0.13, 1.0),
        (-0.15, 0.9),
    ]
    rings = [
        swept_ring(Vector((0, y, 0)), Vector((0, 1, 0)), Vector((1, 0, 0)),
                   HANDLE_RX * 1.08 * s, HANDLE_RZ * 1.02 * s)
        for y, s in collar
    ]
    loft(bm, rings)
    return bm_to_object(bm, "Guard", material, parent, smooth_angle=math.radians(40))


def build_handle(material, parent):
    """Straight smooth black grip: slim neck, palm swell, a waist, then a
    slightly flared rounded butt."""
    bm = bmesh.new()
    steps = 30
    width = [(0.0, 0.9), (0.3, 1.03), (0.7, 0.95), (0.92, 1.08), (1.0, 1.04)]
    height = [(0.0, 0.9), (0.3, 1.0), (0.7, 0.94), (0.92, 1.1), (1.0, 1.06)]
    centers, radii = [], []
    for k in range(steps + 1):
        u = k / steps
        y = HANDLE_TOP - u * HANDLE_LEN
        centers.append(Vector((0.0, y, 0.0)))
        radii.append((HANDLE_RX * lerp_profile(width, u), HANDLE_RZ * lerp_profile(height, u)))

    # round off the butt with a few shrinking rings before closing it
    last, prev = centers[-1], centers[-2]
    direction = (last - prev).normalized()
    rx, rz = radii[-1]
    for f in (0.35, 0.65, 0.88):
        centers.append(last + direction * (rx * 0.9 * f))
        shrink = math.sqrt(1 - f * f)
        radii.append((rx * shrink, rz * shrink))
    butt = last + direction * rx * 0.9
    sweep(bm, centers, radii, Vector((1, 0, 0)), end_points=(None, butt))
    return bm_to_object(bm, "Handle", material, parent)


# ---------------------------------------------------------------------------
# Scene, render and export
# ---------------------------------------------------------------------------
def uv_unwrap(objects):
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')


def set_origin_to_bounds(objects):
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')


def setup_render(scene, target):
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    # sky-blue studio gradient (dark floor, bright ceiling) so the steel has something to reflect
    coords = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.2, 0.22, 0.26, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.75, 0.88, 1.0, 1)
    links.new(coords.outputs["Generated"], sep.inputs["Vector"])
    links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], nodes["Background"].inputs["Color"])
    nodes["Background"].inputs["Strength"].default_value = 0.9
    scene.world = world

    def light(name, kind, loc, energy, size, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = color
        if kind == 'AREA':
            data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        direction = target - Vector(loc)
        obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(obj)

    light("Key", 'AREA', (2.5, -1.0, 3.0), 650, 2.5, (1.0, 0.95, 0.9))
    light("Fill", 'AREA', (-3.0, -1.5, 1.0), 220, 3.0, (0.75, 0.82, 1.0))
    light("Rim", 'AREA', (-0.5, 3.0, -2.0), 500, 2.0, (1.0, 0.85, 0.7))

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 58
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (5.4, -0.9, 2.3)
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 900
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'


def add_backdrop(path):
    """Composites the transparent render over a dark vertical gradient."""
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    bg = np.array([0.10, 0.11, 0.14], dtype=np.float32) + t * np.array([0.08, 0.08, 0.09], dtype=np.float32)
    alpha = px[:, :, 3:4]
    px[:, :, :3] = px[:, :, :3] + bg * (1 - alpha)  # render output is premultiplied
    px[:, :, 3] = 1.0
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.save()


def export(parts, root):
    bpy.context.preferences.filepaths.save_version = 0  # no Knife.blend1 backups
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "Knife.blend"))

    fbx_kwargs = dict(
        object_types={'EMPTY', 'MESH'},
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_NONE',
        axis_forward='-Z',
        axis_up='Y',
        bake_space_transform=True,
        mesh_smooth_type='FACE',
        use_mesh_modifiers=True,
        add_leaf_bones=False,
        bake_anim=False,
    )

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for obj in parts:
        obj.select_set(True)
    bpy.ops.export_scene.fbx(
        filepath=os.path.join(OUT_DIR, "Knife.fbx"), use_selection=True, **fbx_kwargs
    )

    # single-mesh variant: duplicate, join, export, then discard
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.duplicate()
    dupes = list(bpy.context.selected_objects)
    bpy.context.view_layer.objects.active = dupes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.join()
    combined = bpy.context.active_object
    combined.name = "Knife"
    combined.data.name = "Knife"
    bpy.ops.export_scene.fbx(
        filepath=os.path.join(OUT_DIR, "Knife_Combined.fbx"), use_selection=True, **fbx_kwargs
    )
    bpy.data.objects.remove(combined, do_unlink=True)


def main():
    scene = reset_scene()

    steel = make_material("BladeSteel", (0.88, 0.9, 0.93), 1.0, 0.16)
    gold = make_material("GuardGold", (0.95, 0.68, 0.2), 1.0, 0.25)
    grip = make_material("GripBlack", (0.01, 0.01, 0.012), 0.0, 0.45)

    root = bpy.data.objects.new("KnifeModel", None)
    scene.collection.objects.link(root)

    parts = [
        build_blade(steel, root),
        build_guard(gold, root),
        build_handle(grip, root),
    ]
    uv_unwrap(parts)
    set_origin_to_bounds(parts)

    for p in parts:
        p.data.calc_loop_triangles()
    tris = sum(len(p.data.loop_triangles) for p in parts)
    print(f"Knife built: {len(parts)} parts, {tris} triangles")
    for p in parts:
        print(f"  {p.name:7s} size (studs) {tuple(round(d, 3) for d in p.dimensions)}")

    setup_render(scene, target=Vector((0.0, 0.2, -0.05)))
    export(parts, root)
    preview = os.path.join(OUT_DIR, "knife_preview.png")
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    add_backdrop(preview)
    print("Done:", OUT_DIR)


if __name__ == "__main__":
    main()
