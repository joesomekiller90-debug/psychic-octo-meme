"""Assemble final files and verify them by re-importing.

    blender -b --factory-startup --python assemble.py -- OUT_DIR
"""
import bpy, bmesh, sys, os, json, math
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import export_fbx

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
PETS = {"AcornSquirrel", "BatPup", "BumblePup", "GolemCub", "KnightCorgi", "LanternMoth", "LilMossjaw", "MeadowStag",
        "MossbackTurtle", "RubbleMole", "RuinGryphon", "RuinheartDragon", "RuneOwl", "SkellyKitten", "SleepyOrb",
        "SlimeBuddy", "SproutBunny"}


def load(path, keep):
    with bpy.data.libraries.load(path) as (s_, d_):
        d_.objects = [n for n in s_.objects if keep(n)]
    out = []
    for o in d_.objects:
        if o is not None and o.type == "MESH":
            bpy.context.scene.collection.objects.link(o)
            out.append(o)
    return out


def clean(o):
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges[:])
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.to_mesh(me); bm.free()
    me.use_auto_smooth = True
    me.auto_smooth_angle = math.pi
    me.materials.clear()
    o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0); o.scale = (1, 1, 1)
    asset = o.name.split("_", 1)[1]
    role = o.name.split("_", 1)[0]
    me.name = f"{asset}_{role}"


def build(name, sources):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = []
    for path, keep in sources:
        objs += load(path, keep)
    names = [o.name for o in objs]
    assert len(names) == len(set(names)), "duplicate object names"
    for o in objs:
        clean(o)
    fbx = os.path.join(OUT, name + ".fbx")
    export_fbx(fbx, objs)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, name + ".blend"))
    return fbx


def verify(fbx, original):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=original)
    orig = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == "MESH"}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx)
    new = {}
    bad = []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        me = o.data
        t = sum(len(p.vertices) - 2 for p in me.polygons)
        new[o.name] = t
        if any(abs(c) > 1e-5 for c in o.location) or any(abs(c) > 1e-5 for c in o.rotation_euler) or any(abs(c - 1) > 1e-5 for c in o.scale):
            bad.append(f"{o.name}: non-identity transform {tuple(o.location)} {tuple(o.rotation_euler)} {tuple(o.scale)}")
        if len(me.materials):
            bad.append(f"{o.name}: has materials")
        if t > 20000:
            bad.append(f"{o.name}: {t} tris > Roblox 20k limit")
        if not me.uv_layers:
            bad.append(f"{o.name}: no UV map")
    per_asset = defaultdict(lambda: [0, 0])
    for n, t in orig.items():
        per_asset[n.split("_", 1)[1]][0] += t
    for n, t in new.items():
        per_asset[n.split("_", 1)[1]][1] += t
    missing = sorted(set(orig) - set(new))
    added = sorted(set(new) - set(orig))
    return dict(objects=len(new), missing=missing, added=added, problems=bad,
                per_asset={a: dict(before=b, after=c) for a, (b, c) in sorted(per_asset.items())}, parts=new)


W = os.path.dirname(os.path.abspath(__file__))
a3 = build("A3_PetsEggsItems_v2", [(os.path.join(W, "pets_cube.blend"), lambda n: n.split("_", 1)[1] in PETS),
                                    (os.path.join(W, "det_a3.blend"), lambda n: n.split("_", 1)[1] not in PETS)])
a4 = build("A4_EnemiesProjectiles_v2", [(os.path.join(W, "det_a4.blend"), lambda n: True)])
rep = {"A3": verify(a3, os.path.join(W, "A3_PetsEggsItems.fbx")), "A4": verify(a4, os.path.join(W, "A4_EnemiesProjectiles.fbx"))}
json.dump(rep, open(os.path.join(OUT, "verify.json"), "w"), indent=1)
for k, r in rep.items():
    print(f"VERIFY {k}: objects={r['objects']} missing={r['missing']} problems={r['problems'][:5]}")
    print(f"VERIFY {k}: added parts={len(r['added'])}")
    for a, v in r["per_asset"].items():
        print(f"VERIFY {k}  {a:16s} {v['before']:5d} -> {v['after']:5d}")
