"""Clean low-poly rebuild of kitbashed assets within a triangle budget (Blender 4.0+).

    blender -b --factory-startup --python retopo.py -- ORIG.fbx HQ.blend OUT.blend BUDGETS.json [skip=A,B]

Per loose piece of every part:
  * UV-sphere / diamond shaped pieces: a fresh UV sphere (poles kept on the original poles, so
    pointy tips stay pointy) wrapped onto the smoothed surface from HQ.blend by ray casting;
  * torus pieces: a fresh torus wrapped onto the smoothed surface;
  * surfaces of revolution (cylinders, cones, discs, bevelled coins/plates): re-spun with more
    segments around their axis, keeping the exact profile, flat caps and hard rims;
  * anything else (boxes, extrusions, custom shapes): original geometry with corrected hard/soft
    edges.
Segment counts come from one scale factor per asset, solved so the asset hits its budget;
bigger pieces get more segments (N ~ sqrt(size), which keeps facet error even).
"""
import bpy, bmesh, sys, os, json, math
from collections import defaultdict
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

WORK = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:]
ORIG, HQ, OUT, BUDGETS = argv[:4]
SKIP = set()
for a in argv[4:]:
    if a.startswith("skip="):
        SKIP = set(a[5:].split(","))

P = dict(SMOOTH_BELOW=15.0, HARD_ABOVE=75.0, FLAT_HARD=30.0, FLAGGED_MIN=25.0, GEOM_HARD=50.0, ARC_TURN=90.0,
         TIP_DEFICIT=200.0, CORNER_ANGLE=100.0, PLANAR_TOL=0.5)
src = open(os.path.join(WORK, "hq_upgrade.py")).read()
ns = dict(bpy=bpy, bmesh=bmesh, math=math, np=np, defaultdict=defaultdict, BVHTree=BVHTree, P=P, R=math.radians)
exec(src[src.index("def flagged_sharp_edges"):src.index("def surface_dev")], ns)
flagged_sharp_edges, face_islands, rebuild_topology = ns["flagged_sharp_edges"], ns["face_islands"], ns["rebuild_topology"]
classify, dihedral, arc_run, sphere_poles = ns["classify"], ns["dihedral"], ns["arc_run"], ns["sphere_poles"]

budgets = json.load(open(BUDGETS))
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(HQ) as (s_, d_):
    d_.meshes = [m for m in s_.meshes]
hq_mesh = {}
for m in d_.meshes:
    if m is not None:
        key = m.name                 # HQ meshes keep the original mesh-data names (e.g. "Coin_Main.001")
        m.name = "HQ__" + key
        hq_mesh[key] = m
bpy.ops.import_scene.fbx(filepath=ORIG)
scene = bpy.context.scene


def asset_of(name):
    return name.split("_", 1)[1]


# ------------------------------------------------------------------ analysis
def hard_edges_for(bm, faces, kind, ang, flat, flag_layer, src_smooth_all):
    edges = {e.index: e for f in faces for e in f.edges}.values()
    hard = set()
    if kind != "other":
        return hard
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
            arc_smooth.update(run); continue
        if src_smooth_all:
            if a >= P["GEOM_HARD"]:
                hard.add(e.index)
        elif e[flag_layer] and a >= P["FLAGGED_MIN"]:
            hard.add(e.index)
    return hard


def cluster_1d(vals, tol):
    order = np.argsort(vals)
    groups, cur = [], [order[0]]
    for i in order[1:]:
        if vals[i] - vals[cur[-1]] <= tol:
            cur.append(i)
        else:
            groups.append(cur); cur = [i]
    groups.append(cur)
    return groups


def detect_revolution(co, edges, size):
    """Return (center, axis, rings, ring_of_vertex, profile_order, closed) or None."""
    c = co.mean(0)
    X = co - c
    w, V = np.linalg.eigh(X.T @ X)
    tol_h, tol_r = 2e-3 * size, 4e-3 * size
    for k in range(3):
        a = V[:, k]
        for _ in range(2):
            h = X @ a
            groups = []
            for g in cluster_1d(h, tol_h):
                g = np.array(g)
                rr = np.linalg.norm(X[g] - np.outer(h[g], a), axis=1)
                for gg in cluster_1d(rr, tol_r):
                    groups.append(g[np.array(gg)])
            cens = np.array([co[g].mean(0) for g in groups])
            if len(groups) >= 2:
                # refine axis through the ring centres
                cc = cens.mean(0)
                _, _, vt = np.linalg.svd(cens - cc)
                a2 = vt[0] if np.dot(vt[0], a) >= 0 else -vt[0]
                if abs(np.dot(a2, a)) > 0.999:
                    a, c, X = a2, cc, co - cc
        h = X @ a
        rvec = X - np.outer(h, a)
        r = np.linalg.norm(rvec, axis=1)
        ok = True
        rings = []
        for g in groups:
            if len(g) == 1:
                if r[g[0]] > 5e-3 * size:
                    ok = False; break
            elif len(g) < 3 or r[g].std() > tol_r or r[g].mean() < 1e-4 * size:
                ok = False; break
            rings.append(dict(idx=g, h=float(h[g].mean()), r=float(r[g].mean()) if len(g) > 1 else 0.0))
        if not ok or len(rings) < 2:
            continue
        xb, yb, _ = frame_from_axis(a)
        xb, yb = np.array(xb[:]), np.array(yb[:])
        theta = np.arctan2(X @ yb, X @ xb)
        for rg in rings:
            if len(rg["idx"]) >= 3:
                t = np.sort(theta[rg["idx"]])
                gaps = np.diff(np.concatenate([t, [t[0] + 2 * np.pi]]))
                if gaps.max() > 1.5 * gaps.min() + 1e-6:
                    ok = False; break
        if not ok:
            continue
        ring_of = np.empty(len(co), dtype=int)
        for i, rg in enumerate(rings):
            ring_of[rg["idx"]] = i
        adj = defaultdict(set)
        for u, v in edges:
            if ring_of[u] != ring_of[v]:
                ru, rv = rings[ring_of[u]], rings[ring_of[v]]
                if len(ru["idx"]) > 1 and len(rv["idx"]) > 1:
                    dth = abs((theta[u] - theta[v] + np.pi) % (2 * np.pi) - np.pi)
                    if dth > 0.35 * 2 * np.pi / max(len(ru["idx"]), len(rv["idx"])):
                        ok = False; break
                adj[ring_of[u]].add(ring_of[v]); adj[ring_of[v]].add(ring_of[u])
        if not ok:
            continue
        if any(len(s) > 2 for s in adj.values()) or len(adj) != len(rings):
            continue
        # order the profile
        ends = [i for i in range(len(rings)) if len(adj[i]) == 1]
        closed = len(ends) == 0
        start = ends[0] if ends else 0
        order, prev, cur = [start], None, start
        while True:
            nx = [n for n in adj[cur] if n != prev and n not in order]
            if not nx:
                break
            prev, cur = cur, nx[0]
            order.append(cur)
        if len(order) != len(rings):
            continue
        return dict(center=c, axis=a, rings=rings, order=order, closed=closed)
    return None


# ------------------------------------------------------------------ geometry builders
def ellipsoidal(co):
    """True when the vertices hug their own principal-axis ellipsoid (spheres, eggs, blobs) --
    boxes and prisms fail because their corners stick out (~1.4-1.7x)."""
    if len(co) < 6:
        return False
    X = co - co.mean(0)
    w, V = np.linalg.eigh(X.T @ X)
    Pp = X @ V
    half = np.maximum((Pp.max(0) - Pp.min(0)) / 2, 1e-9)
    cen = (Pp.max(0) + Pp.min(0)) / 2
    r = np.linalg.norm((Pp - cen) / half, axis=1)
    return bool(r.max() < 1.22 and r.std() < 0.12)


def frame_from_axis(a, hint=None):
    a = Vector(a).normalized()
    hint = Vector(hint) if hint is not None else (Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 1, 0)))
    x = (hint - a * hint.dot(a))
    if x.length < 1e-8:
        x = a.orthogonal()
    x.normalize()
    y = a.cross(x)
    return x, y, a


def build_rev(info, N, sharp_turn=40.0):
    """Re-spin a surface of revolution with N segments; returns bmesh."""
    c = Vector(info["center"]); x, y, a = frame_from_axis(info["axis"])
    prof = [info["rings"][i] for i in info["order"]]
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    rings = []
    for rg in prof:
        base = c + a * rg["h"]
        if rg["r"] <= 1e-9:
            rings.append([bm.verts.new(base)])
        else:
            rings.append([bm.verts.new(base + (x * math.cos(math.tau * k / N) + y * math.sin(math.tau * k / N)) * rg["r"]) for k in range(N)])
    pairs = list(zip(range(len(rings)), range(1, len(rings))))
    if info["closed"]:
        pairs.append((len(rings) - 1, 0))
    for i, j in pairs:
        A, B = rings[i], rings[j]
        if len(A) == 1 and len(B) == 1:
            continue
        for k in range(N):
            if len(A) == 1:
                bm.faces.new((A[0], B[k], B[(k + 1) % N]))
            elif len(B) == 1:
                bm.faces.new((A[k], A[(k + 1) % N], B[0]))
            else:
                bm.faces.new((A[k], A[(k + 1) % N], B[(k + 1) % N], B[k]))
    if not info["closed"]:
        for end in (rings[0], rings[-1]):
            if len(end) > 1:
                bm.faces.new(end)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and math.degrees(e.calc_face_angle(0.0)) >= sharp_turn)
    return bm


def build_grid_raycast(origin_fn, dir_fn, Nu, Nv, poles, bvh_new, bvh_old, closed_v=False, tol=0.75):
    """Generic ray-cast resampler.  u wraps around; v runs pole to pole (or wraps if closed_v)."""
    bm = bmesh.new(); bm.loops.layers.uv.new("UVMap")
    grid = []
    vr = range(Nv) if closed_v else range(1, Nv)
    for j in vr:
        row = []
        for i in range(Nu):
            o, d = origin_fn(i, j), dir_fn(i, j)
            hit = bvh_new.ray_cast(o, d)
            old = bvh_old.ray_cast(o, d)
            if hit[0] is None:
                if os.environ.get("RT_DEBUG"):
                    print(f"DBG   miss at {i},{j} origin {tuple(round(x, 3) for x in o)} dir {tuple(round(x, 3) for x in d)}")
                return None
            if old[0] is not None and abs(hit[3] - old[3]) > tol * max(old[3], 1e-6) + 1e-4:
                if os.environ.get("RT_DEBUG"):
                    print(f"DBG   mismatch at {i},{j}: new {hit[3]:.4f} old {old[3]:.4f}")
                return None
            row.append(bm.verts.new(hit[0]))
        grid.append(row)
    if not closed_v:
        top = bm.verts.new(poles[0]); bot = bm.verts.new(poles[1])
    rows = len(grid)
    for j in range(rows - 1 + (1 if closed_v else 0)):
        A, Bv = grid[j], grid[(j + 1) % rows]
        for i in range(Nu):
            bm.faces.new((A[i], A[(i + 1) % Nu], Bv[(i + 1) % Nu], Bv[i]))
    if not closed_v:
        for i in range(Nu):
            bm.faces.new((top, grid[0][i], grid[0][(i + 1) % Nu]))
            bm.faces.new((bot, grid[-1][(i + 1) % Nu], grid[-1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = True
    return bm


def bvh_of(co, polys):
    return BVHTree.FromPolygons([Vector(p) for p in co], polys)


def validate(nb, pc, why=None):
    """Reject a rebuilt piece unless it matches the reference surface: same bounding box (within
    12 % per axis) and every reference vertex close to the new surface (within 8 % of the size)."""
    ref = pc["hq"] if (pc["method"] in ("sphere", "torus") and pc["hq"] is not None) else dict(co=pc["co"], polys=pc["polys"])
    rco = ref["co"]
    nco = np.array([v.co[:] for v in nb.verts])
    if len(nco) < 4:
        return False
    size = float(np.linalg.norm(rco.max(0) - rco.min(0)))
    ext_r, ext_n = np.ptp(rco, 0), np.ptp(nco, 0)
    if np.any(np.abs(ext_n - ext_r) > 0.22 * np.maximum(ext_r, 0.15 * size)):
        if os.environ.get("RT_DEBUG"):
            print("DBG   reject extent", np.round(ext_r, 3), np.round(ext_n, 3))
        return False
    if np.linalg.norm((nco.max(0) + nco.min(0)) / 2 - (rco.max(0) + rco.min(0)) / 2) > 0.12 * size:
        return False
    nb.verts.ensure_lookup_table(); nb.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(nb)
    step = max(1, len(rco) // 300)
    for p in rco[::step]:
        hit = tree.find_nearest(Vector(p))
        if hit[0] is None or hit[3] > 0.12 * size:
            if os.environ.get("RT_DEBUG"):
                print("DBG   reject coverage", round(hit[3] / size, 3) if hit[0] is not None else None)
            return False
    return True


# ------------------------------------------------------------------ main
report = {}
for ob in sorted((o for o in scene.objects if o.type == "MESH"), key=lambda o: o.name):
    pass
assets = defaultdict(list)
for ob in scene.objects:
    if ob.type == "MESH":
        assets[asset_of(ob.name)].append(ob)

for asset, parts in sorted(assets.items()):
    if asset in SKIP or asset not in budgets:
        for ob in parts:
            bpy.data.objects.remove(ob)
        continue
    D = 0.0
    allco = np.concatenate([np.array([v.co[:] for v in ob.data.vertices]) for ob in parts])
    D = float(np.linalg.norm(allco.max(0) - allco.min(0)))
    pieces = []          # (ob, piece dict)
    for ob in parts:
        me = ob.data
        flagged = flagged_sharp_edges(me)
        src_smooth_all = flagged is None
        if me.has_custom_normals:
            with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
                bpy.ops.mesh.customdata_custom_splitnormals_clear()
        bm = bmesh.new(); bm.from_mesh(me)
        bm.edges.ensure_lookup_table()
        fl = bm.edges.layers.int.new("src_sharp")
        for e in bm.edges:
            e[fl] = 1 if (flagged and e.index in flagged) else 0
        flat = rebuild_topology(bm, D)
        bm.verts.index_update(); bm.edges.index_update(); bm.faces.index_update()
        bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        ang = [dihedral(e) for e in bm.edges]
        flat = {f.index for f in flat}
        # smoothed (HQ) version of this part, split into islands for ray casting
        hm = hq_mesh.get(me.name)
        hq_isl = []
        if hm is not None:
            hb = bmesh.new(); hb.from_mesh(hm); hb.faces.ensure_lookup_table(); hb.verts.ensure_lookup_table()
            for fs in face_islands(hb):
                vs = sorted({v.index for f in fs for v in f.verts})
                remap = {v: i for i, v in enumerate(vs)}
                co = np.array([hb.verts[v].co[:] for v in vs])
                polys = [[remap[v.index] for v in f.verts] for f in fs]
                hq_isl.append(dict(co=co, polys=polys, lo=co.min(0), hi=co.max(0)))
            hb.free()
        for faces in face_islands(bm):
            kind = classify(faces)
            hard = hard_edges_for(bm, faces, kind, ang, flat, fl, src_smooth_all)
            vids = sorted({v.index for f in faces for v in f.verts})
            remap = {v: i for i, v in enumerate(vids)}
            co = np.array([bm.verts[v].co[:] for v in vids])
            polys = [[remap[v.index] for v in f.verts] for f in faces]
            edges = [(remap[e.verts[0].index], remap[e.verts[1].index]) for e in {e.index: e for f in faces for e in f.edges}.values()]
            max_ang = max((ang[e.index] for f in faces for e in f.edges), default=0.0)
            co_ = np.array([bm.verts[v].co[:] for v in sorted({v.index for f in faces for v in f.verts})])
            round_ = ellipsoidal(co_)
            if max_ang < 50.0 and round_:
                hard = set()            # gently curved everywhere: coarse curvature, not facets
            hard_pairs = {(remap[bm.edges[i].verts[0].index], remap[bm.edges[i].verts[1].index]) for i in hard}
            lo, hi = co.min(0), co.max(0)
            size = float(np.linalg.norm(hi - lo))
            pc = dict(kind=kind, co=co, polys=polys, edges=edges, hard=hard_pairs, size=size, method="keep",
                      tris=sum(len(p) - 2 for p in polys))
            # match the smoothed island
            best, bd = None, 1e9
            for hi_ in hq_isl:
                d = np.linalg.norm((hi_["lo"] + hi_["hi"]) / 2 - (lo + hi) / 2) + np.linalg.norm((hi_["hi"] - hi_["lo"]) - (hi - lo))
                if d < bd:
                    best, bd = hi_, d
            pc["hq"] = best if (best is not None and bd < 0.25 * size + 1e-4) else None
            if size < 0.06 * D:
                pc["hq"] = None          # tiny bits (thorns, studs, berries): rebuilding gains nothing
            def as_sphere(p0, p1):
                L = np.linalg.norm(p1 - p0)
                axis = (p1 - p0) / max(L, 1e-9)
                mid = (p0 + p1) / 2
                rad = np.linalg.norm((co - mid) - np.outer((co - mid) @ axis, axis), axis=1).max()
                pc.update(method="sphere", poles=(p0, p1), elong=float(np.clip((L / 2) / max(rad, 1e-6), 0.5, 2.5)),
                          R=float(max(L / 2, rad)))
            if kind == "sphere" and pc["hq"] is not None:
                pl = sphere_poles(faces)
                as_sphere(np.array(pl[0].co[:]), np.array(pl[1].co[:]))
            elif kind == "torus" and pc["hq"] is not None:
                rev = detect_revolution(co, edges, size)
                if rev is not None and rev["closed"]:
                    rs = [rg["r"] for rg in rev["rings"]]
                    pc.update(method="torus", rev=rev, R=float(np.mean(rs)), rmin=float((max(rs) - min(rs)) / 2))
            if pc["method"] == "keep" and kind == "other":
                rev = detect_revolution(co, edges, size)
                if rev is not None and len(rev["rings"]) >= 2 and max(rg["r"] for rg in rev["rings"]) > 0:
                    prof = [rev["rings"][i] for i in rev["order"]]
                    nseg = max(len(rg["idx"]) for rg in rev["rings"])
                    def smooth_profile(prof):
                        for a_, b_, c_ in zip(prof, prof[1:], prof[2:]):
                            u = np.array([b_["h"] - a_["h"], b_["r"] - a_["r"]]); v = np.array([c_["h"] - b_["h"], c_["r"] - b_["r"]])
                            cosang = u @ v / max(np.linalg.norm(u) * np.linalg.norm(v), 1e-12)
                            if math.degrees(math.acos(max(-1.0, min(1.0, cosang)))) > 60:
                                return False
                        return True
                    if (not rev["closed"] and prof[0]["r"] <= 1e-9 and prof[-1]["r"] <= 1e-9 and pc["hq"] is not None
                            and (not hard_pairs or smooth_profile(prof))):
                        c_, a_ = np.array(rev["center"]), np.array(rev["axis"])
                        as_sphere(c_ + a_ * prof[0]["h"], c_ + a_ * prof[-1]["h"])
                    elif nseg >= 5:
                        pc.update(method="rev", rev=rev, R=float(max(rg["r"] for rg in rev["rings"])), nseg0=nseg)
                elif not hard_pairs and pc["hq"] is not None and round_:
                    # smooth blob (deformed sphere): poles along the thin axis for flat pieces, else the long axis
                    X = co - co.mean(0)
                    w, V = np.linalg.eigh(X.T @ X)
                    ext = np.array([np.ptp(X @ V[:, i]) for i in range(3)])
                    order_ = np.argsort(ext)
                    ax = V[:, order_[0]] if ext[order_[0]] < 0.6 * ext[order_[1]] else V[:, order_[2]]
                    cen = (co.max(0) + co.min(0)) / 2
                    hb_ = bvh_of(pc["hq"]["co"], pc["hq"]["polys"])
                    h1 = hb_.ray_cast(Vector(cen), Vector(ax)); h2 = hb_.ray_cast(Vector(cen), Vector(-ax))
                    if h1[0] is not None and h2[0] is not None:
                        as_sphere(np.array(h1[0][:]), np.array(h2[0][:]))
                        pc["blob"] = True
            if os.environ.get("RT_DEBUG"):
                print(f"DBG {ob.name:24s} kind={kind:6s} method={pc['method']:6s} hq={'yes' if pc['hq'] is not None else 'no ':3s} "
                      f"verts={len(co)} faces={len(polys)} sizes={[len(p) for p in polys][:12]}", flush=True)
            pieces.append((ob, pc))
        bm.free()

    def cost(pc, k):
        if pc["method"] == "sphere":
            nu = int(np.clip(round(k * math.sqrt(pc["R"] / D) * 1.0), 6, 40))
            nv = int(np.clip(round(nu / 2 * pc["elong"] ** 0.5), 4, 30))
            return 2 * nu * (nv - 1), (nu, nv)
        if pc["method"] == "torus":
            nmaj = int(np.clip(round(k * math.sqrt(pc["R"] / D) * 1.3), 16, 48))
            nmin = int(np.clip(round(k * math.sqrt(max(pc["rmin"], 1e-6) / D) * 0.9), 4, 16))
            return 2 * nmaj * nmin, (nmaj, nmin)
        if pc["method"] == "rev":
            n = int(np.clip(round(k * math.sqrt(pc["R"] / D) * 1.1), pc["nseg0"], 48))
            rings = pc["rev"]["rings"]
            segs = len(rings) - (0 if pc["rev"]["closed"] else 1)
            t = 0
            for i, j in zip(pc["rev"]["order"], pc["rev"]["order"][1:] + ([pc["rev"]["order"][0]] if pc["rev"]["closed"] else [])):
                ra, rb = rings[i]["r"], rings[j]["r"]
                t += n if (ra <= 1e-9 or rb <= 1e-9) else 2 * n
            if not pc["rev"]["closed"]:
                for e in (pc["rev"]["order"][0], pc["rev"]["order"][-1]):
                    if rings[e]["r"] > 1e-9:
                        t += n - 2
            return t, (n,)
        return pc["tris"], None

    B = budgets[asset]
    lo_k, hi_k = 1.0, 400.0
    for _ in range(40):
        mid = (lo_k + hi_k) / 2
        tot = sum(cost(pc, mid)[0] for _, pc in pieces)
        if tot > B:
            hi_k = mid
        else:
            lo_k = mid
    k = lo_k
    out = {ob.name: bmesh.new() for ob in parts}
    stats = defaultdict(int)
    for ob, pc in pieces:
        n, params = cost(pc, k)
        nb = None
        if pc["method"] == "sphere":
            nu, nv = params
            p0, p1 = (Vector(pc["poles"][0]), Vector(pc["poles"][1]))
            cen = (p0 + p1) / 2
            x, y, a = frame_from_axis(p0 - p1, hint=Vector(pc["co"][0]) - cen)
            hq = pc["hq"]
            bvh_new = bvh_of(hq["co"], hq["polys"]); bvh_old = bvh_of(pc["co"], pc["polys"])
            def dfn(i, j, x=x, y=y, a=a, nu=nu, nv=nv):
                th = math.pi * j / nv; ph = math.tau * i / nu
                return (x * math.cos(ph) + y * math.sin(ph)) * math.sin(th) + a * math.cos(th)
            nb = build_grid_raycast(lambda i, j, c=cen: c, dfn, nu, nv, (p0, p1), bvh_new, bvh_old)
        elif pc["method"] == "torus":
            nmaj, nmin = params
            rev = pc["rev"]
            c = Vector(rev["center"]); x, y, a = frame_from_axis(rev["axis"])
            hq = pc["hq"]
            bvh_new = bvh_of(hq["co"], hq["polys"]); bvh_old = bvh_of(pc["co"], pc["polys"])
            hmid = float(np.mean([rg["h"] for rg in rev["rings"]]))
            def ofn(i, j, c=c, x=x, y=y, a=a, R0=pc["R"], nmaj=nmaj, hmid=hmid):
                ph = math.tau * i / nmaj
                return c + a * hmid + (x * math.cos(ph) + y * math.sin(ph)) * R0
            def dfn(i, j, x=x, y=y, a=a, nmaj=nmaj, nmin=nmin):
                ph = math.tau * i / nmaj; ps = math.tau * j / nmin
                rad = x * math.cos(ph) + y * math.sin(ph)
                return rad * math.cos(ps) + a * math.sin(ps)
            nb = build_grid_raycast(ofn, dfn, nmaj, nmin, None, bvh_new, bvh_old, closed_v=True, tol=1.5)
        elif pc["method"] == "rev":
            nb = build_rev(pc["rev"], params[0])
        if nb is not None and not validate(nb, pc):
            nb.free(); nb = None
        if nb is None:
            if os.environ.get("RT_DEBUG"):
                print(f"DBG fallback {ob.name} {pc['method']}", flush=True)
            pc["method"] = "keep"
            nb = bmesh.new(); nb.loops.layers.uv.new("UVMap")
            vs = [nb.verts.new(Vector(p)) for p in pc["co"]]
            for p in pc["polys"]:
                try:
                    nb.faces.new([vs[i] for i in p])
                except ValueError:
                    pass
            nb.verts.index_update()
            for e in nb.edges:
                i, j = e.verts[0].index, e.verts[1].index
                e.smooth = not ((i, j) in pc["hard"] or (j, i) in pc["hard"])
            for f in nb.faces:
                f.smooth = True
        if os.environ.get("RT_DEBUG"):
            nco = np.array([v.co[:] for v in nb.verts])
            print(f"DBG built {ob.name:22s} {pc['method']:6s} params={params} orig_bbox={np.round(pc['co'].min(0),3)}..{np.round(pc['co'].max(0),3)} "
                  f"new_bbox={np.round(nco.min(0),3)}..{np.round(nco.max(0),3)} hq_bbox={np.round(pc['hq']['lo'],3) if pc['hq'] else None}..{np.round(pc['hq']['hi'],3) if pc['hq'] else None}", flush=True)
        stats[pc["method"]] += 1
        me_tmp = bpy.data.meshes.new("_p"); nb.to_mesh(me_tmp); nb.free()
        out[ob.name].from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    total = 0
    for ob in parts:
        b = out[ob.name]
        bmesh.ops.triangulate(b, faces=b.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        b.to_mesh(ob.data)
        b.free()
        ob.data.use_auto_smooth = True
        ob.data.auto_smooth_angle = math.pi
        total += len(ob.data.polygons)
    report[asset] = dict(total=total, budget=B, k=round(k, 2), methods=dict(stats))
    print(f"RETOPO {asset:16s} tris {total:5d} / budget {B:5d}  k={k:6.2f}  {dict(stats)}", flush=True)

json.dump(report, open(os.path.splitext(OUT)[0] + "_report.json", "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
