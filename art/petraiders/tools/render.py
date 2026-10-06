"""Preview renderer: blender -b --python render.py -- <fbx> <outdir> <camjson> [size] [samples] [only=Asset1,Asset2] [view=front|side|top]

Renders every asset (objects grouped by the name after the first underscore) on its own,
with stand-in colours per part role (the FBX has no materials).  Camera framing is stored
in <camjson> on the first run and reused afterwards so before/after renders line up.
"""
import bpy, sys, os, json, math, colorsys, zlib
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
fbx, outdir, camjson = argv[0], argv[1], argv[2]
size = int(argv[3]) if len(argv) > 3 else 400
samples = int(argv[4]) if len(argv) > 4 else 48
only = None
view = "front"
palette = {}
for a in argv[5:]:
    if a.startswith("only="):
        only = set(a[5:].split(","))
    if a.startswith("view="):
        view = a[5:]
    if a.startswith("palette="):
        palette = json.load(open(a[8:]))
os.makedirs(outdir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
if fbx.endswith(".blend"):
    with bpy.data.libraries.load(fbx) as (src, dst):
        dst.objects = src.objects
    for o in dst.objects:
        bpy.context.scene.collection.objects.link(o)
else:
    bpy.ops.import_scene.fbx(filepath=fbx)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = samples
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 4
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.film_transparent = False
scene.render.filter_size = 1.2
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

world = bpy.data.worlds.new("W")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.62, 0.66, 0.72, 1)
bg.inputs[1].default_value = 0.55
scene.world = world

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.2
sun.data.angle = math.radians(8)
scene.collection.objects.link(sun)
fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "SUN"))
fill.data.energy = 0.8
scene.collection.objects.link(fill)

def mat(name, rgb, rough=0.45, emit=None, spec=0.5):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    if emit is not None:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = 2.5
    return m

def hue_of(name):
    return (zlib.crc32(name.encode()) % 1000) / 1000.0

def srgb2lin(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def hex_lin(hx):
    hx = hx.lstrip("#")
    return srgb2lin(tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)))


def role_mat(role, asset):
    pal = palette.get(asset, {})
    if role in pal:
        c = hex_lin(pal[role])
        if role == "Glow":
            return mat(f"{role}_{asset}", c, emit=c)
        if role == "EyeShine":
            return mat(f"{role}_{asset}", c, rough=0.3, emit=c)
        return mat(f"{role}_{asset}", c, rough=0.15 if role == "Eyes" else 0.45)
    if role == "Blush":
        return mat("Blush", srgb2lin((1.0, 0.56, 0.66)))
    if role == "Mouth":
        return mat("Mouth", srgb2lin((0.23, 0.12, 0.14)), rough=0.4)
    if role == "Teeth":
        return mat("Teeth", (0.95, 0.95, 0.93), rough=0.35)
    h = hue_of(asset)
    if role == "Main":
        return mat(f"Main_{asset}", srgb2lin(colorsys.hsv_to_rgb(h, 0.42, 0.92)))
    if role == "Accent":
        return mat(f"Accent_{asset}", srgb2lin(colorsys.hsv_to_rgb((h + 0.45) % 1, 0.55, 0.85)))
    if role == "Detail":
        return mat(f"Detail_{asset}", srgb2lin(colorsys.hsv_to_rgb((h + 0.08) % 1, 0.55, 0.5)))
    if role == "Eyes":
        return mat("Eyes", (0.01, 0.01, 0.012), rough=0.15)
    if role == "EyeShine":
        return mat("EyeShine", (1, 1, 1), rough=0.3, emit=(1, 1, 1))
    if role == "Glow":
        c = srgb2lin(colorsys.hsv_to_rgb((h + 0.2) % 1, 0.65, 1.0))
        return mat(f"Glow_{asset}", c, emit=c)
    return mat("Other", (0.7, 0.7, 0.7))

assets = {}
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    role, asset = o.name.split("_", 1)
    asset = asset.split(".")[0]
    assets.setdefault(asset, []).append(o)
    o.data.materials.clear()
    o.data.materials.append(role_mat(role, asset))

cams = json.load(open(camjson)) if os.path.exists(camjson) else {}

def bounds(objs):
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 60
scene.collection.objects.link(cam)
scene.camera = cam

for asset, objs in sorted(assets.items()):
    if only and asset not in only:
        continue
    if asset not in cams:
        lo, hi = bounds(objs)
        center = (lo + hi) / 2
        radius = (hi - lo).length / 2
        # facing: eyes relative to main body, else Blender front (-Y)
        eyes = [o for o in objs if o.name.startswith("Eyes_")]
        main = [o for o in objs if o.name.startswith("Main_")] or objs
        front = Vector((0, -1, 0))
        if eyes:
            elo, ehi = bounds(eyes); mlo, mhi = bounds(main)
            d = (elo + ehi) / 2 - (mlo + mhi) / 2
            d.z = 0
            if abs(d.x) > abs(d.y):
                front = Vector((math.copysign(1, d.x), 0, 0))
            else:
                front = Vector((0, math.copysign(1, d.y), 0))
        cams[asset] = dict(center=list(center), radius=radius, front=list(front))
    c = cams[asset]
    center, radius, front = Vector(c["center"]), c["radius"], Vector(c["front"])
    side = front.cross(Vector((0, 0, 1)))
    if view == "front":
        az, el = math.radians(-28), math.radians(16)
    elif view == "side":
        az, el = math.radians(-90), math.radians(8)
    elif view == "back":
        az, el = math.radians(150), math.radians(20)
    else:  # top
        az, el = math.radians(-20), math.radians(62)
    d = (front * math.cos(az) + side * math.sin(az)) * math.cos(el) + Vector((0, 0, math.sin(el)))
    dist = radius / math.tan(math.atan(18 / cam.data.lens)) * 1.08
    cam.location = center + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_start = dist * 0.01
    cam.data.clip_end = dist * 10
    # key light from camera-left/top, fill from right
    key_dir = (front * 0.6 - side * 0.7 + Vector((0, 0, 0.9))).normalized()
    sun.rotation_euler = (-key_dir).to_track_quat("-Z", "Y").to_euler()
    fill_dir = (front * 0.5 + side * 0.8 + Vector((0, 0, 0.1))).normalized()
    fill.rotation_euler = (-fill_dir).to_track_quat("-Z", "Y").to_euler()
    for a2, o2 in assets.items():
        for o in o2:
            o.hide_render = a2 != asset
    scene.render.filepath = os.path.join(outdir, f"{asset}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", asset, flush=True)

json.dump(cams, open(camjson, "w"), indent=1)
