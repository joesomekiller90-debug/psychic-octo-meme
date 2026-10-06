"""High-quality upgrade for low-poly kitbashed game assets (Blender 4.0+).

    blender -b --factory-startup --python hq_upgrade.py -- IN.fbx OUT.fbx OUT.blend REPORT.json [only=Asset1,Asset2]

Every object keeps its name, transform, pivot and UV map.  Per object:
  1. Rebuild clean topology from the exported triangles: flat convex regions (cylinder caps,
     box faces) become single polygons, other planar triangle pairs become quads.
  2. Decide which edges are really hard (crisp after smoothing):
       - faces meeting at >= 75 deg (box edges, cylinder rims, rims of thin shapes),
       - flat faces meeting their neighbours at >= 30 deg,
       - moderate angles that the source file flagged sharp (or, for sources exported fully
         smooth, >= 50 deg) -- unless the edge belongs to a run of moderate-angle edges that
         turns through >= 90 deg (cylinder sides, coarse arcs, existing bevel profiles),
         which is curvature that should become smooth.
     UV-sphere, diamond (bipyramid) and torus shaped parts are always smooth.
  3. Pointy tips (cone apexes of ears, claws, spikes, horns) and sharp turns along a hard
     edge (star points, zig-zags) become creased corners so they stay pointy.
  4. Fit the control cage so the Catmull-Clark limit surface passes through the original
     vertices (no shrinking: eyes, decals and joints keep their size and placement).  Each
     cage vertex may move at most ~half its shortest edge, which rules out bulges and lips.
  5. Subdivide each loose part with its own level (0-2), chosen from how coarse its facets
     are relative to the asset size.  Hard edges keep split normals; everything else is smooth.
"""
import bpy, bmesh, sys, math, json, time
from collections import defaultdict
import numpy as np
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_FBX, OUT_BLEND, REPORT = argv[:4]
ONLY = None
for a in argv[4:]:
    if a.startswith("only="):
        ONLY = set(a[5:].split(","))

P = dict(
    SMOOTH_BELOW=15.0,       # deg; always smooth
    HARD_ABOVE=75.0,         # deg; always hard (outside round primitives)
    FLAT_HARD=30.0,          # deg; flat region boundary is hard from this angle
    FLAGGED_MIN=25.0,        # deg; source-flagged edges count from this angle
    GEOM_HARD=50.0,          # deg; for fully smooth sources
    ARC_TURN=90.0,           # deg; total turn of a moderate-angle edge run that marks curvature
    TIP_DEFICIT=200.0,       # deg; angle deficit that makes a vertex a pointy tip
    CORNER_ANGLE=100.0,      # deg; hard-edge path turning tighter than this keeps a corner
    MAX_LEVEL=2,
    EPS=0.0007,              # target facet sagitta / asset bounding diagonal
    FIT_ITERS=40,
    FIT_CLAMP=0.5,           # max cage displacement as a fraction of the vertex's shortest edge
    PLANAR_TOL=0.5,          # deg
    TRI_CAP=15000,           # per object (Roblox MeshPart limit is 20k)
)
R = math.radians


def log(*a):
    print(*a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
scene = bpy.context.scene
objs = sorted((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: o.name)


def asset_of(o):
    return o.name.split("_", 1)[1].split(".")[0]


abox = {}
for o in objs:
    co = np.array([v.co[:] for v in o.data.vertices])
    lo, hi = co.min(0), co.max(0)
    a = asset_of(o)
    abox[a] = (np.minimum(abox[a][0], lo), np.maximum(abox[a][1], hi)) if a in abox else (lo, hi)
adiag = {a: float(np.linalg.norm(hi - lo)) for a, (lo, hi) in abox.items()}


def flagged_sharp_edges(me):
    """Edges where the imported custom split normals differ between the two faces."""
    if not me.has_custom_normals:
        return None
    me.calc_normals_split()
    nl = len(me.loops)
    ln = np.empty(nl * 3); me.loops.foreach_get("normal", ln); ln = ln.reshape(-1, 3)
    lv = np.empty(nl, dtype=np.int64); me.loops.foreach_get("vertex_index", lv)
    le = np.empty(nl, dtype=np.int64); me.loops.foreach_get("edge_index", le)
    d = defaultdict(list)
    for p in me.polygons:
        s, t = p.loop_start, p.loop_total
        for i in range(t):
            li, lj = s + i, s + (i + 1) % t
            d[(int(le[li]), int(lv[li]))].append(ln[li])
            d[(int(le[li]), int(lv[lj]))].append(ln[lj])
    sharp = set()
    for (e, v), ns in d.items():
        if len(ns) >= 2 and float(np.dot(ns[0], ns[1])) < 0.9999:
            sharp.add(e)
    return sharp


def face_islands(bm):
    seen = {}
    islands = []
    for f in bm.faces:
        if f in seen:
            continue
        cur = [f]; seen[f] = len(islands); stack = [f]
        while stack:
            x = stack.pop()
            for e in x.edges:
                for g in e.link_faces:
                    if g not in seen:
                        seen[g] = len(islands); stack.append(g); cur.append(g)
        islands.append(cur)
    return islands


def boundary_loops(faces):
    fs = set(faces)
    bedges = [e for f in faces for e in f.edges if sum(g in fs for g in e.link_faces) == 1]
    nxt = defaultdict(list)
    for e in bedges:
        a, b = e.verts
        nxt[a].append(b); nxt[b].append(a)
    if any(len(v) != 2 for v in nxt.values()):
        return None
    loops, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        loop = [start]; seen.add(start); prev, cur = None, start
        while True:
            n = [x for x in nxt[cur] if x is not prev]
            nx = n[0] if n else None
            if nx is None or nx is start:
                break
            loop.append(nx); seen.add(nx); prev, cur = cur, nx
        loops.append(loop)
    return loops


def rebuild_topology(bm, scale):
    """Flat convex regions -> one polygon each; remaining planar triangle pairs -> quads."""
    flat = set()
    seen = set()
    regions = []
    tol = R(P["PLANAR_TOL"])
    for f in bm.faces:
        if f in seen:
            continue
        n0 = f.normal.copy(); d0 = n0.dot(f.verts[0].co)
        reg = [f]; seen.add(f); stack = [f]
        while stack:
            x = stack.pop()
            for e in x.edges:
                for g in e.link_faces:
                    if g in seen or g.normal.angle(n0, 1.0) > tol:
                        continue
                    if any(abs(n0.dot(v.co) - d0) > 1e-5 * scale for v in g.verts):
                        continue
                    seen.add(g); reg.append(g); stack.append(g)
        if len(reg) >= 2:
            regions.append((reg, n0))
    for reg, n0 in regions:
        loops = boundary_loops(reg)
        if not loops or len(loops) != 1:
            continue
        loop = loops[0]
        pts = [v.co for v in loop]
        m = len(pts)
        sgn = [(pts[(i + 1) % m] - pts[i]).cross(pts[(i + 2) % m] - pts[(i + 1) % m]).dot(n0) for i in range(m)]
        eps = 1e-9 * scale * scale
        if not (all(s >= -eps for s in sgn) or all(s <= eps for s in sgn)):
            continue  # concave outline (letters, stars, leaves): keep the triangulation
        res = bmesh.ops.dissolve_faces(bm, faces=reg, use_verts=False)
        # a quad rebuilt from two triangles is ordinary topology; only real caps / panels
        # (three or more source faces, or a polygon with more than four sides) count as flat
        for nf in res["region"]:
            if len(reg) >= 3 or len(nf.verts) > 4:
                flat.add(nf)
    tris = [f for f in bm.faces if len(f.verts) == 3]
    bmesh.ops.join_triangles(bm, faces=tris, cmp_seam=False, cmp_sharp=False, cmp_uvs=False,
                             cmp_vcols=False, cmp_materials=False,
                             angle_face_threshold=R(3.0), angle_shape_threshold=R(60.0))
    return [f for f in flat if f.is_valid]


def sphere_poles(faces):
    """The two pole vertices of a UV-sphere / bipyramid shaped piece, or None."""
    verts = {v for f in faces for v in f.verts}
    if any(len(f.verts) > 4 for f in faces):
        return None
    cands = [v for v in verts if len(v.link_faces) >= 3 and all(len(f.verts) == 3 for f in v.link_faces)]
    if len(cands) < 2:
        return None
    if len(cands) > 2:
        # pure-triangle bipyramids: every vertex is a fan; the apexes have the highest valence,
        # ties (octahedra) go to the farthest-apart pair
        best = max(len(v.link_edges) for v in cands)
        top = [v for v in cands if len(v.link_edges) == best]
        if len(top) < 2:
            return None
        pair = max(((a, b) for i, a in enumerate(top) for b in top[i + 1:]), key=lambda ab: (ab[0].co - ab[1].co).length)
        cands = list(pair)
    poles = set(cands)
    if min(len(v.link_edges) for v in cands) <= 4:
        return None          # 4-sided diamonds (gems, arrowheads, fangs) stay faceted
    for f in faces:
        if len(f.verts) == 3 and sum(v in poles for v in f.verts) != 1:
            return None
    for v in verts:
        if v not in poles and len(v.link_edges) != 4:
            return None
    return cands


def classify(faces):
    """'sphere' for UV-sphere / bipyramid topology, 'torus' for all-quad valence-4, else 'other'."""
    verts = {v for f in faces for v in f.verts}
    sizes = [len(f.verts) for f in faces]
    if all(s == 4 for s in sizes) and all(len(v.link_edges) == 4 for v in verts):
        return "torus"
    return "sphere" if sphere_poles(faces) else "other"


def dihedral(e):
    return math.degrees(e.calc_face_angle(0.0)) if len(e.link_faces) == 2 else 0.0


def arc_run(e, ang):
    """Edges reached by walking across quads (edge ring) from e while the angle stays moderate."""
    lo, hi = P["SMOOTH_BELOW"] * 0.6, P["HARD_ABOVE"]
    run = [e.index]
    seen = {e.index}
    for f0 in e.link_faces:
        cur_e, cur_f = e, f0
        while len(cur_f.verts) == 4:
            l = next(l for l in cur_f.loops if l.edge.index == cur_e.index)
            opp = l.link_loop_next.link_loop_next.edge
            if opp.index in seen or len(opp.link_faces) != 2 or not (lo <= ang[opp.index] < hi):
                break
            run.append(opp.index); seen.add(opp.index)
            cur_f = next(g for g in opp.link_faces if g.index != cur_f.index)
            cur_e = opp
    return run


def angle_deficit(v):
    return 360.0 - math.degrees(sum(l.calc_angle() for l in v.link_loops))


def surface_dev(src_me, out_me):
    """Max distance of the new surface from the original surface (and its 99th percentile)."""
    bm0 = bmesh.new(); bm0.from_mesh(src_me)
    tree = BVHTree.FromBMesh(bm0)
    co = np.empty(len(out_me.vertices) * 3); out_me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    from mathutils import Vector
    d = np.array([tree.find_nearest(Vector(c))[3] for c in co])
    bm0.free()
    return float(d.max()), float(np.percentile(d, 99))


report = {"params": P, "objects": {}}
t0 = time.time()

for ob in objs:
    if ONLY and asset_of(ob) not in ONLY:
        continue
    me = ob.data
    D = adiag[asset_of(ob)]
    src_copy = me.copy()
    flagged = flagged_sharp_edges(me)
    src_smooth_all = flagged is None
    tris_before = sum(len(p.vertices) - 2 for p in me.polygons)
    if me.has_custom_normals:
        with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()

    bm = bmesh.new(); bm.from_mesh(me)
    bm.edges.ensure_lookup_table()
    # source flags live on edges; keep them through the topology rebuild via an int layer
    flag_layer = bm.edges.layers.int.new("src_sharp")
    for e in bm.edges:
        e[flag_layer] = 1 if (flagged and e.index in flagged) else 0
    flat = rebuild_topology(bm, D)
    bm.verts.index_update(); bm.edges.index_update(); bm.faces.index_update()
    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()

    ang = [dihedral(e) for e in bm.edges]   # indexed by edge index
    flat = {f.index for f in flat}
    islands = face_islands(bm)
    ecrease = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
    vcrease = bm.verts.layers.float.get("crease_vert") or bm.verts.layers.float.new("crease_vert")
    isl_info = []
    for faces in islands:
        kind = classify(faces)
        verts = {v.index: v for f in faces for v in f.verts}.values()
        edges = {e.index: e for f in faces for e in f.edges}.values()
        hard = set()   # edge indices
        if kind == "other":
            arc_smooth = set()
            for e in edges:
                a = ang[e.index]
                if a < P["SMOOTH_BELOW"]:
                    continue
                if a >= P["HARD_ABOVE"]:
                    hard.add(e.index); continue
                if any(f.index in flat for f in e.link_faces):
                    if a >= P["FLAT_HARD"]:
                        hard.add(e.index)
                    continue
                if e.index in arc_smooth:
                    continue
                run = arc_run(e, ang)
                if len(run) >= 3 and sum(ang[x] for x in run) >= P["ARC_TURN"]:
                    arc_smooth.update(run)
                    continue
                if src_smooth_all:
                    if a >= P["GEOM_HARD"]:
                        hard.add(e.index)
                elif e[flag_layer] and a >= P["FLAGGED_MIN"]:
                    hard.add(e.index)
        for e in edges:
            e.smooth = e.index not in hard
            e[ecrease] = 1.0 if e.index in hard else 0.0
        corners = set()
        s_crease = 0.0
        for v in verts:
            hv = [e for e in v.link_edges if e.index in hard]
            if len(hv) <= 1:
                if angle_deficit(v) >= P["TIP_DEFICIT"]:
                    corners.add(v)
            elif len(hv) == 2:
                a = hv[0].other_vert(v).co - v.co
                b = hv[1].other_vert(v).co - v.co
                aa = math.degrees(a.angle(b, math.pi))
                if aa < P["CORNER_ANGLE"]:
                    corners.add(v)
                else:
                    s_crease = max(s_crease, (a.length + b.length) / 2 * (math.pi - R(aa)) / 8)
            v[vcrease] = 1.0 if v in corners else 0.0
        s_smooth = 0.0
        for e in edges:
            if e.index in hard or len(e.link_faces) != 2:
                continue
            s_smooth = max(s_smooth, e.calc_length() * R(ang[e.index]) / 8)
        s0 = max(s_smooth, s_crease)
        k = 0
        while k < P["MAX_LEVEL"] and s0 / (4 ** k) > P["EPS"] * D:
            k += 1
        isl_info.append(dict(kind=kind, faces=len(faces), verts=len(verts), hard=len(hard),
                             corners=len(corners), s0=round(s0 / D, 6), level=k))
    for f in bm.faces:
        f.smooth = True
    bm.edges.layers.int.remove(flag_layer)

    cage = bpy.data.meshes.new(me.name + "_cage")
    bm.to_mesh(cage)
    nv = len(cage.vertices)
    orig_co = np.empty(nv * 3); cage.vertices.foreach_get("co", orig_co); orig_co = orig_co.reshape(-1, 3)
    # shortest incident edge per vertex -> displacement bound
    ev_ = np.empty(len(cage.edges) * 2, dtype=np.int64); cage.edges.foreach_get("vertices", ev_); ev_ = ev_.reshape(-1, 2)
    elen = np.linalg.norm(orig_co[ev_[:, 0]] - orig_co[ev_[:, 1]], axis=1)
    short = np.full(nv, np.inf)
    np.minimum.at(short, ev_[:, 0], elen); np.minimum.at(short, ev_[:, 1], elen)
    bound = P["FIT_CLAMP"] * short

    # ---- fit: make the limit surface interpolate the original vertices ----
    fit_ob = bpy.data.objects.new("_fit", cage)
    scene.collection.objects.link(fit_ob)
    mod = fit_ob.modifiers.new("fit", "SUBSURF")
    mod.levels = 1; mod.render_levels = 1; mod.use_limit_surface = True; mod.quality = 4
    mod.use_creases = True; mod.use_custom_normals = False
    co = orig_co.copy()
    resid = None
    for it in range(P["FIT_ITERS"]):
        dg = bpy.context.evaluated_depsgraph_get(); dg.update()
        ev = fit_ob.evaluated_get(dg); m2 = ev.to_mesh()
        lim = np.empty(len(m2.vertices) * 3); m2.vertices.foreach_get("co", lim)
        ev.to_mesh_clear()
        err = orig_co - lim.reshape(-1, 3)[:nv]
        resid = float(np.linalg.norm(err, axis=1).max())
        if resid < 1e-6 * D:
            break
        d = co + err - orig_co
        mag = np.linalg.norm(d, axis=1)
        over = mag > bound
        d[over] *= (bound[over] / mag[over])[:, None]
        co = orig_co + d
        cage.vertices.foreach_set("co", co.ravel()); cage.update()
    fit_ob.modifiers.remove(mod)

    # ---- build the final mesh island by island ----
    fitted = bmesh.new(); fitted.from_mesh(cage)
    fitted_islands = face_islands(fitted)
    assert len(fitted_islands) == len(isl_info)
    tmp_me = bpy.data.meshes.new("_tmp")
    tmp_ob = bpy.data.objects.new("_tmp", tmp_me)
    scene.collection.objects.link(tmp_ob)
    sub = tmp_ob.modifiers.new("sub", "SUBSURF")
    sub.use_limit_surface = True; sub.quality = 4; sub.use_creases = True; sub.use_custom_normals = False
    sub.uv_smooth = "PRESERVE_BOUNDARIES"

    def emit(levels):
        res = bmesh.new()
        for idx, faces in enumerate(fitted_islands):
            k = levels[idx]
            part = fitted.copy()
            keep = {f.index for f in faces}
            part.faces.ensure_lookup_table()
            bmesh.ops.delete(part, geom=[f for f in part.faces if f.index not in keep], context="FACES")
            bmesh.ops.delete(part, geom=[v for v in part.verts if not v.link_faces], context="VERTS")
            part.to_mesh(tmp_me)
            if k == 0:
                # unsubdivided island: original (unfitted) coordinates; deletion keeps vertex order
                vids = sorted({v.index for f in faces for v in f.verts})
                tmp_me.vertices.foreach_set("co", orig_co[vids].ravel())
                tmp_me.update()
                res.from_mesh(tmp_me)
            else:
                sub.levels = k; sub.render_levels = k
                tmp_me.update()
                dg = bpy.context.evaluated_depsgraph_get(); dg.update()
                ev = tmp_ob.evaluated_get(dg); m2 = ev.to_mesh()
                res.from_mesh(m2)
                ev.to_mesh_clear()
            part.free()
        return res

    levels = [i["level"] for i in isl_info]
    out = emit(levels)
    ntris = sum(len(f.verts) - 2 for f in out.faces)
    while ntris > P["TRI_CAP"] and max(levels) > 0:
        j = max(range(len(levels)), key=lambda i: (levels[i], isl_info[i]["faces"]))
        levels[j] -= 1
        out.free(); out = emit(levels)
        ntris = sum(len(f.verts) - 2 for f in out.faces)
    for i, k in enumerate(levels):
        isl_info[i]["level"] = k
    for f in out.faces:
        f.smooth = True
    out.to_mesh(me)
    out.free(); fitted.free(); bm.free()
    me.use_auto_smooth = True
    me.auto_smooth_angle = math.pi
    for a in ("crease_edge", "crease_vert"):
        if a in me.attributes:
            me.attributes.remove(me.attributes[a])
    bpy.data.objects.remove(fit_ob); bpy.data.objects.remove(tmp_ob)
    bpy.data.meshes.remove(cage); bpy.data.meshes.remove(tmp_me)

    dev_max, dev_p99 = surface_dev(src_copy, me)
    bpy.data.meshes.remove(src_copy)
    nsharp = sum(1 for e in me.edges if e.use_edge_sharp)
    report["objects"][ob.name] = dict(tris_before=tris_before, tris_after=ntris, fit_resid=resid / D,
                                      dev_max=dev_max / D, dev_p99=dev_p99 / D, sharp_edges=nsharp,
                                      src_smooth_all=src_smooth_all, islands=isl_info)
    log(f"{ob.name:28s} tris {tris_before:5d} -> {ntris:6d}  isl {len(isl_info):2d} lv {''.join(map(str, levels))} "
        f"kind {''.join(i['kind'][0] for i in isl_info)} hard {sum(i['hard'] for i in isl_info):4d} "
        f"dev {dev_max / D * 100:.2f}% p99 {dev_p99 / D * 100:.2f}% fit {resid / D:.0e}")

log(f"done in {time.time() - t0:.1f}s")
json.dump(report, open(REPORT, "w"), indent=1)

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.ops.export_scene.fbx(
    filepath=OUT_FBX, use_selection=True, object_types={"MESH"},
    axis_forward="-Z", axis_up="Y", global_scale=1.0, apply_unit_scale=True,
    apply_scale_options="FBX_SCALE_NONE", bake_space_transform=False,
    use_mesh_modifiers=True, mesh_smooth_type="OFF", use_triangles=True,
    use_tspace=False, add_leaf_bones=False, bake_anim=False, path_mode="AUTO",
    embed_textures=False, use_custom_props=False,
)
log("exported", OUT_FBX)
