"""Render a 3D preview of the terrain (pastel stand-in colours) with simple building placeholders.
    blender -b --factory-startup --python preview_terrain.py -- OUT.png [view=oblique|top|low] [markers=1]
"""
import bpy, bmesh, sys, os, json, math
import numpy as np
from mathutils import Vector

W = os.environ.get("PETRAIDERS_TERRAIN_DIR", os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
VIEW = "oblique"
MARKERS = True
for a in argv[1:]:
    if a.startswith("view="):
        VIEW = a[5:]
    if a.startswith("markers="):
        MARKERS = a[8:] == "1"

h = np.load(os.path.join(W, "height.npy"))
from PIL import Image
col = np.array(Image.open(os.path.join(W, "PetRaiders_Colormap.png")).convert("RGB"))
layout = json.load(open(os.path.join(W, "layout.json")))
N = h.shape[0]
G0 = 32
STEP = 2
hs = h[::STEP, ::STEP]
cs = col[::STEP, ::STEP]
n = hs.shape[0]

# pastel display colours per Roblox material colour
mats = {tuple(v): k for k, v in layout["materials"].items()}
pastel = {"Grass": (0.47, 0.76, 0.40), "LeafyGrass": (0.40, 0.68, 0.36), "Pavement": (0.88, 0.83, 0.74),
          "Cobblestone": (0.78, 0.72, 0.62), "Ground": (0.66, 0.49, 0.34), "Rock": (0.62, 0.59, 0.68),
          "Snow": (0.97, 0.97, 1.0), "Sand": (0.9, 0.82, 0.6), "Slate": (0.4, 0.55, 0.5)}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
me = bpy.data.meshes.new("terrain")
xs = (np.arange(n) * STEP - N / 2 + 0.5)
verts = [(float(xs[i]), float(-xs[j]), float(hs[j, i] - G0)) for j in range(n) for i in range(n)]   # Blender Y = -Z(world)
faces = [(j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i) for j in range(n - 1) for i in range(n - 1)]
me.from_pydata(verts, [], faces)
me.update()
vc = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
flat = []
for j in range(n):
    for i in range(n):
        m = mats.get(tuple(int(c) for c in cs[j, i]), "Grass")
        r, g, b = pastel[m]
        flat += [r ** 2.2, g ** 2.2, b ** 2.2, 1.0]
vc.data.foreach_set("color", flat)
for p in me.polygons:
    p.use_smooth = True
ob = bpy.data.objects.new("terrain", me)
scene.collection.objects.link(ob)
mat = bpy.data.materials.new("t"); mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
attr = nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "col"
nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.85
me.materials.append(mat)


def solid(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (rgb[0] ** 2.2, rgb[1] ** 2.2, rgb[2] ** 2.2, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
    return m


def add_box(x, z, sx, sz, hgt, rot, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, hgt / 2))
    o = bpy.context.object
    o.scale = (sx, sz, hgt)
    o.rotation_euler = (0, 0, -math.radians(rot))
    o.data.materials.append(m)
    return o


def add_cyl(x, z, r, hgt, m, verts=24, cone=False):
    if cone:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=0, depth=hgt, location=(x, -z, hgt / 2))
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=hgt, location=(x, -z, hgt / 2))
    o = bpy.context.object
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


if MARKERS:
    white = solid("w", (0.95, 0.93, 0.88)); red = solid("r", (0.9, 0.35, 0.35)); purple = solid("p", (0.55, 0.35, 0.85))
    tree = solid("tree", (0.35, 0.72, 0.38)); trunk = solid("trunk", (0.55, 0.35, 0.2)); blue = solid("b", (0.3, 0.35, 0.6))
    egg = solid("egg", (0.95, 0.75, 0.85)); gold = solid("gold", (0.95, 0.8, 0.35))
    S = {s["id"]: s for s in layout["stations"]}
    add_cyl(0, 0, 4, 22, trunk); bpy.ops.mesh.primitive_uv_sphere_add(radius=18, location=(0, 0, 32)); bpy.context.object.data.materials.append(tree); bpy.ops.object.shade_smooth()
    e = S["eggs"]; add_cyl(e["x"], e["z"], 44, 6, white); add_cyl(e["x"], e["z"] , 46, 42, red, 32, cone=True)
    for p in layout["egg_pads"]:
        add_cyl(p["x"], p["z"], 4, 3, white, 12)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=4, location=(p["x"], -p["z"], 8)); o = bpy.context.object; o.scale = (1, 1, 1.3); o.data.materials.append(egg); bpy.ops.object.shade_smooth()
    s_ = S["purple_dome"]; add_box(s_["x"], s_["z"], 36, 36, 24, 45, white)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=12, location=(s_["x"], -s_["z"], 24)); bpy.context.object.data.materials.append(purple); bpy.ops.object.shade_smooth()
    s_ = S["red_house"]; add_box(s_["x"], s_["z"], 30, 40, 26, 45, red)
    s_ = S["leaderboards"]; add_box(s_["x"], s_["z"], 60, 4, 22, 45, blue)
    s_ = S["market"]; add_cyl(s_["x"], s_["z"], 14, 18, purple, 8, cone=True)
    s_ = S["raid"]; add_cyl(s_["x"], s_["z"], 14, 1.5, white); add_box(s_["x"] - 22, s_["z"], 4, 30, 30, 0, purple)
    s_ = S["rebirth"]; add_cyl(s_["x"], s_["z"], 16, 1.5, white); add_box(s_["x"] + 20, s_["z"], 8, 8, 40, 0, white)
    s_ = S["pedestals"]
    for i in range(2):
        for j in range(3):
            add_box(s_["x"] - 8 + 16 * i, s_["z"] - 16 + 16 * j, 6, 6, 6, 0, white)
    s_ = S["south_gate"]; add_box(s_["x"], s_["z"], 24, 4, 20, 0, white)

# camera / light
world = bpy.data.worlds.new("w"); world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.65, 0.95, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35)); scene.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
cam.data.clip_end = 5000
if VIEW == "top":
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 1030
    cam.location = (0, 0, 1200); cam.rotation_euler = (0, 0, 0)
elif VIEW == "low":
    cam.data.lens = 26
    cam.location = (0, 230, 30); cam.rotation_euler = (math.radians(84), 0, math.radians(180))
elif VIEW == "inside":
    cam.data.lens = 24
    cam.location = (40, -275, 120); cam.rotation_euler = (math.radians(68), 0, math.radians(-6))
else:
    cam.data.lens = 30
    cam.location = (0, -760, 560); cam.rotation_euler = (math.radians(52), 0, 0)
scene.render.engine = "CYCLES"; scene.cycles.samples = 32; scene.cycles.use_denoising = False
scene.render.resolution_x = 1600; scene.render.resolution_y = 1000 if VIEW != "top" else 1600
if VIEW == "top":
    scene.render.resolution_x = 1600
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
