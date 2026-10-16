"""Builds a plain white bolt-action sniper rifle for Roblox, ready for skins.

Run with Blender:   blender --background --python build_sniper.py
or with pip's bpy:  python build_sniper.py

1 Blender unit = 1 Roblox stud. The rifle is modelled with the barrel along +Y
and up along +Z, which the FBX export (Y up, -Z forward) turns into a barrel
pointing along the part's LookVector.

Outputs (next to this script):
  Sniper.fbx               one MeshPart named Handle with a single UV atlas:
                           one texture = one skin
  Sniper_Parts.fbx         the same rifle split into named parts, each with its
                           own UVs (the stock is named Handle)
  Sniper_UV_Template.png   UV layout of Sniper.fbx to paint skins over
  SniperSetup.server.luau  Tool script: grip position, white colour, welds
  Sniper.blend             editable source scene
  sniper_preview.png       render
"""

import math
import os

import bpy  # must come before bmesh when using the pip bpy module
import bmesh
import numpy as np
from mathutils import Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Layout (studs). The bore axis runs along Y at x = 0, z = 0.
# ---------------------------------------------------------------------------
BUTT_Y = -2.42           # back of the stock (the butt pad sits behind it)
FORE_END_Y = 0.98        # front of the stock
RECEIVER = (-0.64, 0.43)
RECEIVER_R = 0.125
BARREL_END_Y = 2.45
SCOPE_Z = 0.42           # height of the scope's axis
SCOPE_RINGS_Y = (-0.40, 0.30)
RAIL = (-0.6, 0.42)
RAIL_TOP = 0.185
GRIP_POINT = Vector((0.0, -0.98, -0.42))  # where the hand holds the pistol grip

# stock side profile, as (y, value) keys
STOCK_TOP = [(-2.42, -0.05), (-1.6, -0.07), (-1.18, -0.15), (-0.98, -0.15), (-0.84, -0.02), (0.98, -0.02)]
STOCK_BOTTOM = [
    (-2.42, -0.72), (-2.05, -0.64), (-1.5, -0.43), (-1.3, -0.45), (-1.1, -0.66),
    (-0.97, -0.63), (-0.86, -0.31), (-0.8, -0.29), (0.3, -0.29), (0.98, -0.24),
]
STOCK_HALF_WIDTH = [(-2.42, 0.13), (-1.8, 0.13), (-1.3, 0.088), (-1.05, 0.095), (-0.85, 0.15), (0.2, 0.14), (0.98, 0.105)]

WHITE = (0.9, 0.9, 0.91)
RING_N = 24
SMOOTH_ANGLE = math.radians(40)


# ---------------------------------------------------------------------------
# Mesh helpers
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


def finish(bm, name, material, parent=None, smooth_angle=SMOOTH_ANGLE):
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        face.smooth = True
    bm.to_mesh(mesh)
    bm.free()
    mesh.set_sharp_from_angle(angle=smooth_angle)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def loft(bm, rings, cap_start=True, cap_end=True):
    """Bridges a list of equal-length vertex rings with quads. A ring of
    length 1 is treated as a point and fanned with triangles."""
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


def frame(axis, side):
    t = axis.normalized()
    a = (side - t * side.dot(t)).normalized()
    return t, a, t.cross(a).normalized()


def lathe(bm, origin, axis, side, profile, n=RING_N, knurl=0.06, caps=(True, True)):
    """Revolves a profile of (t, r) or (t, r, knurled) entries around `axis`.
    r = 0 makes a point (a rounded or pointed end). Knurled rings alternate
    their radius to cut grip ridges."""
    origin = Vector(origin)
    t_axis, a, b = frame(Vector(axis), Vector(side))
    rings = []
    for entry in profile:
        t, r = entry[0], entry[1]
        knurled = len(entry) > 2 and entry[2]
        centre = origin + t_axis * t
        if r <= 0:
            rings.append([centre])
            continue
        ring = []
        for i in range(n):
            ang = 2 * math.pi * i / n
            rr = r * (1 - knurl) if knurled and i % 2 else r
            ring.append(centre + a * (rr * math.cos(ang)) + b * (rr * math.sin(ang)))
        rings.append(ring)
    return loft(bm, rings, cap_start=caps[0], cap_end=caps[1])


def knurl_band(t0, t1, r):
    return [(t0, r), (t0 + 0.006, r, True), (t1 - 0.006, r, True), (t1, r)]


def tube(bm, origin, axis, side, length, r_in, r_out, n=RING_N):
    """Hollow ring (for scope rings and the like)."""
    profile = [(0, r_in), (0, r_out), (length, r_out), (length, r_in), (0, r_in)]
    lathe(bm, origin, axis, side, profile, n=n, caps=(False, False))


def cylinder(bm, origin, axis, side, length, r, n=16):
    lathe(bm, origin, axis, side, [(0, r), (length, r)], n=n)


def add_box(bm, center, size, bevel=0.0, segments=2):
    m = Matrix.LocRotScale(Vector(center), None, Vector(size))
    verts = bmesh.ops.create_cube(bm, size=1.0, matrix=m)["verts"]
    if bevel:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(
            bm, geom=edges, offset=bevel, segments=segments, profile=0.5,
            affect='EDGES', clamp_overlap=True,
        )


def swept_ring(center, tangent, side, r_side, r_other, n):
    t, a, b = frame(tangent, side)
    return [
        center + a * (r_side * math.cos(2 * math.pi * i / n)) + b * (r_other * math.sin(2 * math.pi * i / n))
        for i in range(n)
    ]


def sweep(bm, centers, radii, side, n=16, end_points=(None, None)):
    """Lofts ellipses along a polyline. End points close an end with a
    rounded fan instead of a flat cap."""
    centers = [Vector(c) for c in centers]
    rings = []
    for k, (c, (rs, ro)) in enumerate(zip(centers, radii)):
        prev_c = centers[max(k - 1, 0)]
        next_c = centers[min(k + 1, len(centers) - 1)]
        rings.append(swept_ring(c, next_c - prev_c, Vector(side), rs, ro, n))
    start, end = end_points
    if start is not None:
        rings.insert(0, [Vector(start)])
    if end is not None:
        rings.append([Vector(end)])
    loft(bm, rings, cap_start=start is None, cap_end=end is None)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp_profile(profile, u):
    """Piecewise-smooth interpolation through (u, value) keys."""
    for (u0, v0), (u1, v1) in zip(profile, profile[1:]):
        if u <= u1:
            return v0 + (v1 - v0) * smoothstep(u0, u1, u)
    return profile[-1][1]


X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


# ---------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------
def stock_section(y, scale=1.0, n=28, p=3.2):
    """Rounded-rectangle (superellipse) cross-section of the stock at y."""
    top, bot = lerp_profile(STOCK_TOP, y), lerp_profile(STOCK_BOTTOM, y)
    hw = lerp_profile(STOCK_HALF_WIDTH, y) * scale
    zc, hh = (top + bot) / 2, (top - bot) / 2 * scale
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        ring.append(Vector((
            hw * math.copysign(abs(c) ** (2 / p), c),
            y,
            zc + hh * math.copysign(abs(s) ** (2 / p), s),
        )))
    return ring


def build_stock(mat, parent, name):
    """Sporter stock: raised comb, slim wrist, pistol grip, and a fore-end
    that the barrel and receiver sit into."""
    bm = bmesh.new()
    stations = 72
    rings = [stock_section(BUTT_Y + (FORE_END_Y - BUTT_Y) * k / (stations - 1)) for k in range(stations)]
    # round off the fore-end tip
    for dy, s in ((0.025, 0.85), (0.045, 0.55)):
        ring = stock_section(FORE_END_Y, s)
        zc = sum(v.z for v in ring) / len(ring)
        rings.append([Vector((v.x, FORE_END_Y + dy, zc + (v.z - zc))) for v in ring])
    loft(bm, rings)

    # sling studs under the butt and the fore-end
    for y in (-1.95, 0.72):
        bottom = lerp_profile(STOCK_BOTTOM, y)
        cylinder(bm, (0, y, bottom + 0.02), -Z, X, 0.06, 0.028, n=12)
        tube(bm, (-0.012, y, bottom - 0.065), X, Y, 0.024, 0.018, 0.035, n=12)
    return finish(bm, name, mat, parent)


def build_buttpad(mat, parent):
    bm = bmesh.new()
    rings = []
    for dy, s in ((0.005, 0.97), (-0.01, 1.01), (-0.07, 1.01), (-0.085, 0.95)):
        ring = stock_section(BUTT_Y, s)
        zc = sum(v.z for v in ring) / len(ring)
        rings.append([Vector((v.x, BUTT_Y + dy, zc + (v.z - zc))) for v in ring])
    loft(bm, rings)
    return finish(bm, "Buttpad", mat, parent)


def build_receiver(mat, parent):
    bm = bmesh.new()
    y0, y1 = RECEIVER
    lathe(bm, (0, 0, 0), Y, X, [
        (y0, 0), (y0, RECEIVER_R - 0.015), (y0 + 0.02, RECEIVER_R),
        (y1 - 0.03, RECEIVER_R), (y1, RECEIVER_R - 0.015), (y1, 0),
    ], n=32)
    # ejection port frame on the right side and the bolt release on the left
    add_box(bm, (RECEIVER_R - 0.012, -0.05, 0.035), (0.03, 0.34, 0.1), bevel=0.008)
    add_box(bm, (-RECEIVER_R + 0.005, -0.5, 0.0), (0.03, 0.08, 0.04), bevel=0.006)
    return finish(bm, "Receiver", mat, parent)


def build_rail(mat, parent):
    """Picatinny-style rail with cross slots."""
    bm = bmesh.new()
    y0, y1 = RAIL
    add_box(bm, (0, (y0 + y1) / 2, 0.12), (0.15, y1 - y0, 0.06), bevel=0.008)
    teeth = 14
    pitch = (y1 - y0 - 0.06) / (teeth - 1)
    for k in range(teeth):
        add_box(bm, (0, y0 + 0.03 + k * pitch, RAIL_TOP - 0.02), (0.17, 0.038, 0.04), bevel=0.006)
    return finish(bm, "Rail", mat, parent)


def build_bolt(mat, parent):
    bm = bmesh.new()
    # bolt shroud at the back of the receiver
    lathe(bm, (0, 0, 0), Y, X, [
        (-0.89, 0), (-0.89, 0.05), (-0.87, 0.075), (-0.8, 0.09), (RECEIVER[0] + 0.02, 0.095),
        (RECEIVER[0] + 0.02, 0),
    ], n=24)
    # handle: root collar, a swept stem bending down and back, and a ball knob
    root = Vector((0.1, -0.48, 0.03))
    cylinder(bm, root, X, Y, 0.05, 0.045, n=16)
    stem = [root + Vector(d) for d in ((0.04, 0, 0), (0.09, -0.02, -0.03), (0.14, -0.06, -0.09), (0.17, -0.1, -0.15))]
    sweep(bm, stem, [(0.026, 0.026)] * len(stem), Y, n=12)
    knob = stem[-1] + Vector((0.02, -0.02, -0.03))
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.058, matrix=Matrix.Translation(knob))
    return finish(bm, "Bolt", mat, parent)


def build_barrel(mat, parent):
    bm = bmesh.new()
    y0 = RECEIVER[1] - 0.03
    lathe(bm, (0, 0, 0), Y, X, [
        (y0, 0), (y0, 0.105), (y0 + 0.2, 0.105), (y0 + 0.23, 0.095), (y0 + 0.3, 0.085),
        (BARREL_END_Y - 0.05, 0.058), (BARREL_END_Y - 0.01, 0.058), (BARREL_END_Y, 0.052),
        # recessed muzzle crown and bore
        (BARREL_END_Y, 0.03), (BARREL_END_Y - 0.02, 0.026), (BARREL_END_Y - 0.02, 0),
    ], n=28)
    return finish(bm, "Barrel", mat, parent)


def build_magazine(mat, parent):
    """Detachable box magazine in front of the trigger guard."""
    bm = bmesh.new()
    add_box(bm, (0, -0.15, -0.34), (0.15, 0.25, 0.26), bevel=0.02)
    add_box(bm, (0, -0.15, -0.48), (0.17, 0.29, 0.035), bevel=0.012)
    for z in (-0.38, -0.42):  # grip ribs on the sides
        add_box(bm, (0, -0.15, z), (0.165, 0.18, 0.012), bevel=0.004, segments=1)
    add_box(bm, (0, -0.02, -0.33), (0.06, 0.03, 0.06), bevel=0.008)  # release latch
    return finish(bm, "Magazine", mat, parent)


def build_trigger_guard(mat, parent):
    bm = bmesh.new()
    add_box(bm, (0, -0.58, -0.285), (0.11, 0.5, 0.03), bevel=0.008)  # floor plate
    loop = [(-0.38, -0.28), (-0.4, -0.37), (-0.47, -0.43), (-0.6, -0.45), (-0.72, -0.43), (-0.79, -0.36), (-0.8, -0.28)]
    sweep(bm, [(0, y, z) for y, z in loop], [(0.035, 0.018)] * len(loop), X, n=12)
    trigger = [(-0.54, -0.27), (-0.545, -0.32), (-0.565, -0.36), (-0.595, -0.385)]
    radii = [(0.018, 0.011), (0.017, 0.01), (0.016, 0.009), (0.014, 0.008)]
    sweep(bm, [(0, y, z) for y, z in trigger], radii, X, n=10, end_points=(None, (0, -0.61, -0.392)))
    return finish(bm, "TriggerGuard", mat, parent)


def build_scope(mat, parent):
    """Riflescope: knurled eyepiece and power ring, main tube, turret saddle
    with elevation, windage and side-focus turrets, and an objective bell with
    a sunshade."""
    bm = bmesh.new()
    prof = [(-0.955, 0), (-0.955, 0.088), (-1.0, 0.09), (-1.0, 0.116)]
    prof += knurl_band(-0.98, -0.84, 0.12)
    prof += [(-0.82, 0.118), (-0.78, 0.112), (-0.745, 0.1)]
    prof += knurl_band(-0.735, -0.665, 0.1)
    prof += [(-0.64, 0.09), (-0.6, 0.079), (-0.2, 0.079), (-0.19, 0.1), (0.15, 0.1), (0.16, 0.079), (0.42, 0.079),
             (0.6, 0.135), (0.64, 0.143)]
    prof += knurl_band(0.66, 0.74, 0.143)
    prof += [(1.03, 0.143), (1.03, 0.126), (0.975, 0.124), (0.975, 0)]
    lathe(bm, (0, 0, SCOPE_Z), Y, X, prof, n=40)

    def turret(axis, side, base_r, cap_r, height):
        lathe(bm, (0, -0.02, SCOPE_Z), axis, side, [
            (0.0, base_r), (0.09, base_r), (0.09, cap_r - 0.004),
            *knurl_band(0.1, height - 0.02, cap_r),
            (height - 0.01, cap_r - 0.008), (height, cap_r - 0.02), (height, 0),
        ], n=32, knurl=0.08)

    turret(Z, X, 0.055, 0.07, 0.22)    # elevation
    turret(X, Y, 0.05, 0.062, 0.2)     # windage
    turret(-X, Y, 0.06, 0.08, 0.17)    # side focus / parallax
    return finish(bm, "Scope", mat, parent)


def build_lens(mat, parent):
    bm = bmesh.new()
    lathe(bm, (0, 0, SCOPE_Z), Y, X, [(-0.968, 0), (-0.968, 0.086), (-0.958, 0.086), (-0.958, 0)], n=32)
    lathe(bm, (0, 0, SCOPE_Z), Y, X, [(0.978, 0), (0.978, 0.122), (0.99, 0.122), (0.99, 0)], n=32)
    return finish(bm, "Lens", mat, parent)


def build_scope_mounts(mat, parent):
    """Two scope rings with clamp screws, standing on rail clamps."""
    bm = bmesh.new()
    ring_r = 0.079
    for y in SCOPE_RINGS_Y:
        tube(bm, (0, y - 0.045, SCOPE_Z), Y, X, 0.09, ring_r, 0.1, n=32)
        for side in (1, -1):
            add_box(bm, (side * 0.11, y, SCOPE_Z), (0.05, 0.09, 0.05), bevel=0.01)
            for dy in (-0.025, 0.025):
                cylinder(bm, (side * 0.135, y + dy, SCOPE_Z), side * X, Y, 0.012, 0.016, n=12)
        add_box(bm, (0, y, (RAIL_TOP + SCOPE_Z - ring_r) / 2 + 0.01), (0.1, 0.09, SCOPE_Z - ring_r - RAIL_TOP + 0.04),
                bevel=0.012)
        add_box(bm, (0, y, RAIL_TOP - 0.005), (0.21, 0.11, 0.06), bevel=0.012)
        cylinder(bm, (0.105, y, RAIL_TOP - 0.01), X, Y, 0.03, 0.022, n=12)  # cross bolt
    return finish(bm, "ScopeMounts", mat, parent)


# ---------------------------------------------------------------------------
# UVs, export, render
# ---------------------------------------------------------------------------
def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def uv_unwrap(obj, margin):
    select_only(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')


def origin_to_bounds(obj):
    select_only(obj)
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')


def bounds_center(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(pts, Vector()) / 8


def roblox_offset(point, part):
    """Blender-space point relative to the part's bounds centre, in the
    part's Roblox space (X right, Y up, -Z forward)."""
    d = point - bounds_center(part)
    return Vector((d.x, d.z, -d.y))


def combine(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.duplicate()
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.join()
    combined = bpy.context.active_object
    combined.name = name
    combined.data.name = name
    # one material: a single skin texture covers the whole rifle
    mat = combined.data.materials[0]
    combined.data.materials.clear()
    combined.data.materials.append(mat)
    for poly in combined.data.polygons:
        poly.material_index = 0
    return combined


def write_uv_template(obj, path, size=2048):
    """Draws the UV layout: islands filled light grey with dark outlines."""
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    uv = obj.data.uv_layers.active.data
    polys = []
    for poly in obj.data.polygons:
        polys.append([(uv[i].uv.x * size, (1 - uv[i].uv.y) * size) for i in poly.loop_indices])
    for pts in polys:
        draw.polygon(pts, fill=(222, 224, 228))
    for pts in polys:
        draw.line(pts + [pts[0]], fill=(70, 74, 82), width=1)
    img.save(path)


FBX_KWARGS = dict(
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


def export_fbx(objects, filename):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.fbx(filepath=os.path.join(OUT_DIR, filename), use_selection=True, **FBX_KWARGS)


SETUP_SCRIPT = """--!strict
-- Generated by build_sniper.py. Put this Script inside the Sniper Tool.
-- It puts the hand on the pistol grip, makes the rifle plain white (the base
-- for skins) and, for Sniper_Parts.fbx, welds every part to Handle.

local tool = script.Parent :: Tool
local handle = tool:WaitForChild("Handle") :: BasePart

-- Pistol-grip position in Handle space. Sniper.fbx is one mesh; in
-- Sniper_Parts.fbx, Handle is the stock, so the offset differs.
local GRIP_SINGLE = Vector3.new({single})
local GRIP_PARTS = Vector3.new({parts})

local parts: {{ BasePart }} = {{}}
for _, d in tool:GetDescendants() do
	if d:IsA("BasePart") then
		table.insert(parts, d)
	end
end
tool.Grip = CFrame.new(if #parts > 1 then GRIP_PARTS else GRIP_SINGLE)

for _, part in parts do
	part.Color = Color3.fromRGB(255, 255, 255)
	part.Material = Enum.Material.SmoothPlastic
	part.Anchored = false
	part.CanCollide = false
	part.Massless = true
	if part ~= handle then
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = handle
		weld.Part1 = part
		weld.Parent = part
	end
end
"""


def fmt(v):
    return ", ".join(f"{c:.3f}" for c in v)


def setup_render(scene, target):
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    coords = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.4
    ramp.color_ramp.elements[0].color = (0.01, 0.01, 0.012, 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (0.35, 0.36, 0.4, 1)
    links.new(coords.outputs["Generated"], sep.inputs["Vector"])
    links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], nodes["Background"].inputs["Color"])
    nodes["Background"].inputs["Strength"].default_value = 0.35
    scene.world = world

    def light(name, loc, energy, size, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.color = color
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(obj)

    light("Key", (3.0, -2.5, 4.0), 380, 2.5, (1.0, 0.97, 0.94))
    light("Fill", (4.0, 3.0, -0.5), 90, 4.0, (0.8, 0.86, 1.0))
    light("Rim", (-3.0, 1.5, 2.5), 450, 2.0)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 38
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (4.9, -3.3, 1.6)
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'


def add_backdrop(path):
    """Composites the transparent render over a near-black vertical gradient."""
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    bg = np.array([0.01, 0.01, 0.012], dtype=np.float32) + t * np.array([0.05, 0.05, 0.06], dtype=np.float32)
    alpha = px[:, :, 3:4]
    px[:, :, :3] = px[:, :, :3] + bg * (1 - alpha)  # render output is premultiplied
    px[:, :, 3] = 1.0
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.save()


def main():
    scene = reset_scene()
    white = make_material("White", WHITE, 0.0, 0.42)

    root = bpy.data.objects.new("SniperModel", None)
    scene.collection.objects.link(root)
    parts = [
        build_stock(white, root, "Handle"),
        build_buttpad(white, root),
        build_receiver(white, root),
        build_rail(white, root),
        build_bolt(white, root),
        build_barrel(white, root),
        build_magazine(white, root),
        build_trigger_guard(white, root),
        build_scope(white, root),
        build_lens(white, root),
        build_scope_mounts(white, root),
    ]
    for p in parts:
        uv_unwrap(p, margin=0.01)

    combined = combine(parts, "Handle")
    uv_unwrap(combined, margin=0.004)
    for p in parts:
        p.name = "Handle" if p.name.startswith("Handle") else p.name
    combined.name = "Handle"  # the parts' stock took the name first
    for obj in parts + [combined]:
        origin_to_bounds(obj)

    stock = parts[0]
    grip_single = roblox_offset(GRIP_POINT, combined)
    grip_parts = roblox_offset(GRIP_POINT, stock)

    for obj in parts + [combined]:
        obj.data.calc_loop_triangles()
    print(f"Sniper built: {len(combined.data.loop_triangles)} triangles")
    for p in parts:
        print(f"  {p.name:12s} {len(p.data.loop_triangles):5d} tris  size {tuple(round(d, 2) for d in p.dimensions)}")
    print("  combined size", tuple(round(d, 2) for d in combined.dimensions))
    print("  grip (single mesh)", fmt(grip_single), " grip (parts)", fmt(grip_parts))

    # exports: the parts version and the single-mesh version can't both be
    # called Handle in one scene, so rename around each export
    combined.name = "SniperCombined"
    stock.name = "Handle"
    export_fbx([root] + parts, "Sniper_Parts.fbx")
    stock.name = "Stock"
    combined.name = "Handle"
    export_fbx([combined], "Sniper.fbx")
    write_uv_template(combined, os.path.join(OUT_DIR, "Sniper_UV_Template.png"))
    with open(os.path.join(OUT_DIR, "SniperSetup.server.luau"), "w") as f:
        f.write(SETUP_SCRIPT.format(single=fmt(grip_single), parts=fmt(grip_parts)))

    # keep the .blend tidy: show the parts, hide the combined copy
    combined.hide_render = True
    combined.hide_set(True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "Sniper.blend"))

    setup_render(scene, target=Vector((0.0, -0.3, -0.05)))
    preview = os.path.join(OUT_DIR, "sniper_preview.png")
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    add_backdrop(preview)
    print("Done:", OUT_DIR)


if __name__ == "__main__":
    main()
