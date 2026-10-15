"""Builds a low-poly duel knife for Roblox and exports it.

Run with Blender:   blender --background --python build_knife.py
or with pip's bpy:  python build_knife.py

1 Blender unit = 1 Roblox stud. The knife is modelled with the blade pointing
along +Y and the cutting edge facing -Z, which the FBX export (Y up, -Z forward)
turns into a blade pointing along the part's LookVector with the edge down.

Outputs (next to this script):
  Knife.blend           editable source scene
  Knife.fbx             4 MeshParts: Blade, Guard, Handle, Pommel
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
BLADE_START = -0.04  # blade root sits inside the guard
BLADE_LEN = 1.65
SPINE_Z = 0.17       # top of the blade (spine)
EDGE_Z = -0.25       # bottom of the blade (cutting edge)
SPINE_HALF_T = 0.045  # half thickness at the spine
GRIND = 0.42         # grind line height, as a fraction from the edge to the spine

GUARD_HALF = Vector((0.15, 0.06, 0.0))  # x, y half sizes; z from GUARD_Z
GUARD_Z = (-0.42, 0.31)

HANDLE_TOP = -0.06
HANDLE_BOTTOM = -1.08
HANDLE_RX = 0.125
HANDLE_RZ = 0.165
WRAPS = 7

POMMEL_BOTTOM = -1.30

RING_SEGMENTS = 16
SMOOTH_ANGLE = math.radians(32)


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
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True
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


def ellipse(y, rx, rz, n=RING_SEGMENTS):
    return [
        Vector((rx * math.cos(2 * math.pi * i / n), y, rz * math.sin(2 * math.pi * i / n)))
        for i in range(n)
    ]


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------
def build_blade(material, parent):
    """Drop-point blade with a sabre grind, a swedge on the spine near the tip,
    and a belly that sweeps up into the point."""
    bm = bmesh.new()
    tip_z = 0.02
    stations = 22
    rings = []
    for k in range(stations):
        t = k / stations
        # cluster stations toward the tip where the profile curves
        t = 1 - (1 - t) ** 1.6
        y = BLADE_START + t * BLADE_LEN

        # spine drops toward the tip after 62% of the length
        drop = smoothstep(0.62, 1.0, t)
        z_top = SPINE_Z + (tip_z - SPINE_Z) * drop ** 1.3
        # edge sweeps up (belly) after 55% of the length
        belly = smoothstep(0.55, 1.0, t)
        z_bot = EDGE_Z + (tip_z - EDGE_Z) * belly ** 1.7

        # thickness tapers along the blade, faster in the swedge zone
        half_t = SPINE_HALF_T * (1 - 0.35 * t) * (1 - 0.75 * smoothstep(0.7, 1.0, t))
        z_grind = z_bot + (z_top - z_bot) * GRIND
        edge_half_t = 0.004 * (1 - t)

        rings.append([
            Vector((half_t, y, z_top)),
            Vector((half_t, y, z_grind)),
            Vector((edge_half_t, y, z_bot)),
            Vector((-edge_half_t, y, z_bot)),
            Vector((-half_t, y, z_grind)),
            Vector((-half_t, y, z_top)),
        ])
    rings.append([Vector((0.0, BLADE_START + BLADE_LEN, tip_z))])
    loft(bm, rings, cap_start=True, cap_end=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # the grind bevel is only ~13 degrees off the flat, so shade the blade flat
    # to keep the spine, grind line and edge crisp
    return bm_to_object(bm, "Blade", material, parent, smooth_angle=0.0)


def build_guard(material, parent):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    z0, z1 = GUARD_Z
    for v in bm.verts:
        v.co.x *= GUARD_HALF.x * 2
        v.co.y *= GUARD_HALF.y * 2
        v.co.z = (z0 + z1) / 2 + v.co.z * (z1 - z0)
    # taper the quillons: thinner at the ends than at the centre
    bmesh.ops.subdivide_edges(
        bm,
        edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.1],
        cuts=2,
        use_grid_fill=True,
    )
    for v in bm.verts:
        end = abs(v.co.z - (z0 + z1) / 2) / ((z1 - z0) / 2)
        v.co.x *= 1 - 0.3 * end
        # sweep the lower quillon slightly forward, toward the blade
        if v.co.z < z0 + 0.2:
            v.co.y += 0.06 * smoothstep(z0 + 0.2, z0, v.co.z)
    bmesh.ops.bevel(
        bm,
        geom=list(bm.edges),
        offset=0.025,
        segments=2,
        profile=0.5,
        affect='EDGES',
    )
    return bm_to_object(bm, "Guard", material, parent)


def build_handle(material, parent):
    """Oval grip with raised cord wraps."""
    bm = bmesh.new()
    length = HANDLE_TOP - HANDLE_BOTTOM
    wrap_len = length / WRAPS
    gap = wrap_len * 0.18
    rings = []
    for w in range(WRAPS):
        y0 = HANDLE_TOP - w * wrap_len
        y1 = y0 - wrap_len
        for y, ridge in ((y0, 0.92), (y0 - gap, 1.0), (y1 + gap, 1.0), (y1, 0.92)):
            # gentle palm swell around the middle of the grip
            u = (HANDLE_TOP - y) / length
            swell = 1 + 0.08 * math.sin(math.pi * u)
            rings.append(ellipse(y, HANDLE_RX * ridge * swell, HANDLE_RZ * ridge * swell))
    loft(bm, rings)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return bm_to_object(bm, "Handle", material, parent)


def build_pommel(material, parent):
    bm = bmesh.new()
    top = HANDLE_BOTTOM + 0.02
    h = top - POMMEL_BOTTOM
    profile = [  # (fraction down the pommel, radius scale)
        (0.00, 0.90),
        (0.18, 1.18),
        (0.62, 1.18),
        (0.80, 1.00),
        (1.00, 0.62),
    ]
    rings = [ellipse(top - f * h, HANDLE_RX * s, HANDLE_RZ * s) for f, s in profile]
    rings.append([Vector((0.0, POMMEL_BOTTOM - 0.015, 0.0))])
    loft(bm, rings, cap_start=True, cap_end=False)
    return bm_to_object(bm, "Pommel", material, parent)


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
    # studio gradient (dark floor, bright ceiling) so the steel has something to reflect
    coords = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.03, 0.035, 0.045, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.9, 0.92, 1.0, 1)
    links.new(coords.outputs["Generated"], sep.inputs["Vector"])
    links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], nodes["Background"].inputs["Color"])
    nodes["Background"].inputs["Strength"].default_value = 0.8
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
    cam_data.lens = 62
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (5.0, -0.9, 2.4)
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

    steel = make_material("BladeSteel", (0.80, 0.82, 0.85), 1.0, 0.22)
    brass = make_material("GuardGold", (0.83, 0.62, 0.22), 1.0, 0.3)
    grip = make_material("GripWrap", (0.012, 0.012, 0.014), 0.0, 0.85)

    root = bpy.data.objects.new("KnifeModel", None)
    scene.collection.objects.link(root)

    parts = [
        build_blade(steel, root),
        build_guard(brass, root),
        build_handle(grip, root),
        build_pommel(brass, root),
    ]
    uv_unwrap(parts)
    set_origin_to_bounds(parts)

    for p in parts:
        p.data.calc_loop_triangles()
    tris = sum(len(p.data.loop_triangles) for p in parts)
    print(f"Knife built: {len(parts)} parts, {tris} triangles")
    for p in parts:
        print(f"  {p.name:7s} size (studs) {tuple(round(d, 3) for d in p.dimensions)}")

    setup_render(scene, target=Vector((0.0, 0.17, -0.05)))
    export(parts, root)
    preview = os.path.join(OUT_DIR, "knife_preview.png")
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    add_backdrop(preview)
    print("Done:", OUT_DIR)


if __name__ == "__main__":
    main()
