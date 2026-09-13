"""Incremental 100F fitout on the reviewed SWFC envelope, never a city rebuild.

Owner hall plan: 50 x 6.2 m, clear height 3--3.85 m. Owner brochure: 55 m
skywalk with three transparent floor strips. These describe different extents;
panel pitch, strip width, lining and structure remain photo estimates.
References and acceptance limits: ../references/swfc-top.md.
Default writes a temporary candidate. --apply requires its unchanged source,
script dependencies and GLB, and preserves a complete source backup.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).parent))
import refine_swfc_top as top
from refine_alibaba_districts import geometry_digest
from refine_jin_mao import Mesh, linear
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

REVISION = 'swfc-skywalk-20260913'
PROPERTY = 'spaceSwfcSkywalkRevision'
OUTPUT = top.ROOT / '.tmp/png/space-swfc-skywalk-20260913'
NEW_IDS = {k: REVISION+'/'+k for k in ('floor-glass', 'window-glass', 'interior-mirror',
                                      'interior-frame', 'floor-joints')}
CHANGED = ('glass', 'frame', 'mechanical', 'soffit', 'soffit_panels')
ANGLE = 85.04
FLOOR, HALF_HALL, HALF_CLEAR, BAY = 474., 25., 3.1, 2.5
STRIPS = ((-2.4, -1.6), (-.4, .4), (1.6, 2.4))


def diagonal(point):
    return top.xyz(point, -ANGLE)


def parts_of(obj):
    """Read current mesh in bridge axes, preserving UVs on every retained face."""
    uv = obj.data.uv_layers.active
    for polygon in obj.data.polygons:
        yield [(*diagonal(obj.data.vertices[i].co),
                *(tuple(uv.data[j].uv) if uv else (0., 0.)))
               for i, j in zip(polygon.vertices, polygon.loop_indices, strict=True)]


def face(part, points):
    if len(points) >= 3:
        top.clean_face(part, [p[:3] for p in points], [p[3:5] for p in points])


def window_patch(points):
    """Separate the 100F window zone, retaining the rest of each original quad."""
    inside, outside = points, []
    for axis, bound, greater in ((0, -25., True), (0, 25., False),
                                  (2, 474.18, True), (2, 477.80, False)):
        outside.append(top.clip(inside, axis, bound, not greater))
        inside = top.clip(inside, axis, bound, greater)
    return inside, outside


def install(obj, part):
    previous = obj.data
    previous.use_fake_user = True
    data = top.candidate_mesh(part, obj.name+' 100F refinement', ANGLE)
    for material in previous.materials:
        data.materials.append(material)
    obj.data = data
    obj[PROPERTY] = REVISION


def material(role):
    mat = top.make_top_material('top_glass')
    mat.name = 'SWFC 100F '+role
    mat['spaceMaterialId'] = NEW_IDS[role]+'/material'
    mat['spaceSwfcTopMaterialRole'] = role
    glass = role in ('floor-glass', 'window-glass')
    mirror = role == 'interior-mirror'
    rgb = (.965, .985, .985) if glass else (.79, .82, .83) if mirror else (
        (.79, .81, .80) if role == 'interior-frame' else (.13, .16, .17))
    color = tuple(linear(v) for v in rgb)+(1.,)
    rough = .045 if glass else .09 if mirror else .36
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    values = {'Base Color': color, 'Roughness': rough, 'Metallic': 1. if mirror else 0.,
              'Transmission Weight': .94 if glass else 0., 'IOR': 1.45}
    for key, value in values.items():
        next(s for s in node.inputs if s.identifier == key).default_value = value
    mat.diffuse_color, mat.roughness, mat.metallic = color, rough, float(mirror)
    return mat


def author(objects):
    added = {role: Mesh() for role in NEW_IDS}
    removed = {}
    # Replace the old flat floor, its raised crossing rods and continuous blind
    # soffit. Keep the rest of the tower, crown, 97F canopy and mullions verbatim.
    for role in CHANGED:
        obj, kept, count = objects[top.OUTPUT_IDS[role]], Mesh(), 0
        for points in parts_of(obj):
            z = [p[2] for p in points]
            flat_floor = max(abs(h-FLOOR) for h in z) < .002
            old_soffit = min(z) > top.SOFFIT-.002 and max(z) < top.SOFFIT+.042
            floor_rod = min(z) > FLOOR-.15 and max(z) < FLOOR+.15
            if ((role in ('glass', 'frame') and flat_floor)
                    or (role in ('soffit_panels', 'mechanical') and old_soffit)
                    or (role == 'soffit' and floor_rod)):
                count += 1
                continue
            if role == 'glass':
                pane, rest = window_patch(points)
                if len(pane) >= 3:
                    for outside in rest:
                        face(kept, outside)
                    normal = (Vector(pane[1][:3])-Vector(pane[0][:3])).cross(
                        Vector(pane[2][:3])-Vector(pane[0][:3])).normalized()
                    top.thin_panel(added['window-glass'], [p[:3] for p in pane],
                                   tuple(-normal*.018), [p[3:5] for p in pane])
                    count += 1
                    continue
            face(kept, points)
        if not count:
            raise RuntimeError('Expected reviewed 100F detail missing: '+role)
        removed[role] = count
        # The bottom panels are rebuilt below; all other retained faces survive.
        if role == 'soffit_panels':
            soffit = kept
        else:
            install(obj, kept)

    floor_solid, joint = Mesh(), added['floor-joints']
    u_breaks = [-top.DIAMOND, -27.5] + [i*BAY for i in range(-10, 12)] + [top.DIAMOND]
    v_breaks = [-top.DIAMOND, -2.4, -1.6, -.4, .4, 1.6, 2.4, top.DIAMOND]
    panes = 0
    for u0, u1 in zip(u_breaks, u_breaks[1:]):
        for v0, v1 in zip(v_breaks, v_breaks[1:]):
            cell = top.clip(top.clip(top.clip(top.clip(top.plan(FLOOR), 0, u0, True),
                    0, u1, False), 1, v0, True), 1, v1, False)
            if len(cell) < 3:
                continue
            is_glass = -27.5 <= u0 < u1 <= 27.5 and (v0, v1) in STRIPS
            if is_glass:
                inset = [(u0+.018, v0+.018), (u1-.018, v0+.018),
                         (u1-.018, v1-.018), (u0+.018, v1-.018)]
                top.thin_panel(added['floor-glass'], [(u,v,FLOOR) for u,v in inset], (0,0,-.04))
                panes += 1
                # Flush seams and edge supports, never rods above walking level.
                for a, b in zip(cell, cell[1:]+cell[:1]):
                    joint.beam((*a,FLOOR-.022), (*b,FLOOR-.022), .050, .05)
            else:
                top.horizontal(floor_solid, cell, FLOOR)
            lower = top.clip(top.clip(top.clip(top.clip(top.plan(top.SOFFIT), 0, u0, True),
                    0, u1, False), 1, v0, True), 1, v1, False)
            if len(lower) >= 3 and not is_glass:
                top.thin_panel(soffit, [(u,v,top.SOFFIT) for u,v in reversed(lower)], (0,0,.04))
    # The non-glass walking surface is reflective, as in the owner's hall photo.
    for poly in floor_solid.faces:
        added['interior-mirror'].face([floor_solid.vertices[i] for i in poly])
    install(objects[top.EXTRA_IDS['soffit_panels']], soffit)

    mirror, frame = added['interior-mirror'], added['interior-frame']
    # Hall dimensions are owner-labelled; the facet/rib arrangement is estimated
    # from pic_140, which shows pale ribs and a folded reflective ceiling.
    roof = [(-HALF_CLEAR,477.), (-.28,477.85), (.28,477.85), (HALF_CLEAR,477.)]
    for index in range(20):
        u0, u1 = -HALF_HALL+index*BAY, -HALF_HALL+(index+1)*BAY
        for (v0,z0),(v1,z1) in zip(roof,roof[1:]):
            # Viewed from below: clockwise in UV, closed 20 mm lining.
            top.thin_panel(mirror, [(u0+.025,v1,z1),(u1-.025,v1,z1),
                                   (u1-.025,v0,z0),(u0+.025,v0,z0)], (0,0,.02))
        for side in (-1,1):
            # Reflective deep sill outside the 6.2 m clear central aisle.
            d = top.half_depth(FLOOR+.10)
            cell = [(u0,side*HALF_CLEAR),(u1,side*HALF_CLEAR),(u1,side*d),(u0,side*d)]
            top.horizontal(mirror, cell if side > 0 else list(reversed(cell)), FLOOR+.10)
    for index in range(11):
        u = -25.+index*5.
        # The owner's photo shows broad, continuous folded piers, not thin
        # sticks. Width and cladding depth remain visual estimates.
        for side in (-1,1):
            # clean_face fans convex polygons. Split the concave folded profile
            # at its elbow so triangulation cannot fill the clear aisle.
            sections = [((3.1,474.),(4.15,474.),(4.15,477.30),(3.1,477.)),
                        ((3.1,477.),(4.15,477.30),(.28,478.06),(.28,477.85))]
            for section in sections:
                points = [(u-.36,side*v,z) for v,z in section]
                top.thin_panel(frame, list(reversed(points)) if side>0 else points, (.72,0,0))
    root = objects[top.ROOT_ID]
    created = []
    for role, part in added.items():
        obj = bpy.data.objects.new('SWFC 100F '+role, top.candidate_mesh(part, role, ANGLE))
        root.users_collection[0].objects.link(obj)
        obj.parent = root
        obj.data.materials.append(material(role))
        for key, value in {'space_export':True,'spaceId':NEW_IDS[role],'spaceName':obj.name,
                           'spaceVisible':True,'spaceCastShadow':role not in ('floor-glass','window-glass'),
                           'spaceReceiveShadow':True,PROPERTY:REVISION,'spaceOpticsEstimated':True}.items():
            obj[key] = value
        created.append(obj)
    return created, {'removedFaces':removed, 'glassFloorPanels':panes, 'hallMetres':[50,6.2],
                     'clearHeightMetres':[3,3.85], 'skywalkMetres':55,
                     'estimated':['floor strip widths','panel pitch','ribs','sills','lining','optics','soffit depth']}


def tree(objects):
    vertices, faces = [], []
    for obj in objects:
        offset = len(vertices)
        vertices.extend(diagonal(v.co) for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
    return BVHTree.FromPolygons(vertices, faces)


def validate(root):
    objects = [o for o in root.children_recursive if o.type == 'MESH' and o.get('space_export')]
    all_surfaces = tree(objects)
    frame = tree([o for o in objects if o.get('spaceId') == NEW_IDS['interior-frame']])
    aisle_probes = 0
    for v in (-3.09,-2.,0.,2.,3.09):
        for z in (475.,476.,476.9):
            if frame.ray_cast(Vector((-26.,v,z)),Vector((1,0,0)),52.)[0] is not None:
                raise RuntimeError('Interior pier triangulation intrudes into the clear aisle')
            aisle_probes += 1
    opaque = tree([o for o in objects if o.get('spaceId') not in
                   (NEW_IDS['floor-glass'],NEW_IDS['window-glass'],top.EXTRA_IDS['top_glass'])])
    probes = []
    for u in (-23.75,-13.75,1.25,13.75,23.75):
        for v in (-2.,0.,2.):
            point, normal, _, _ = all_surfaces.ray_cast(Vector((u,v,474.2)),Vector((0,0,-1)),.4)
            hidden = opaque.ray_cast(Vector((u,v,473.93)),Vector((0,0,-1)),2.6)[0]
            if point is None or abs(point.z-FLOOR)>.002 or normal.z<.99 or hidden is not None:
                raise RuntimeError('Glass walk has a gap, inverted face or blind backing: '+str((u,v,point,hidden)))
            probes.append([u,v,float(point.z)])
    for v, expected in ((0.,477.85),(-3.09,477.003), (3.09,477.003)):
        point = all_surfaces.ray_cast(Vector((1.25,v,475.5)),Vector((0,0,1)),4)[0]
        if point is None or abs(point.z-expected)>.02:
            raise RuntimeError('Owner hall headroom does not match: '+str((v,point)))
    return {'glassFloorAndClearUnderside':probes, 'hallHeadroom':True,
            'clearAisleProbes':aisle_probes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a single lowercase filename label')
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve()!=SOURCE.resolve() or scene.get('space_contract')!=2
            or scene.get(top.PROPERTY)!=top.REVISION or scene.get(PROPERTY)):
        raise RuntimeError('Expected canonical reviewed SWFC, without this one-time fitout')
    token = source_fingerprint()
    # Include imported implementation: changing a helper invalidates review too.
    hashes = {str(p.relative_to(top.ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT/args.label
    if directory.exists() and not args.apply:
        raise RuntimeError('Use a new preview label')
    candidate = None
    if args.apply:
        candidate = json.loads((directory/'candidate.json').read_text(encoding='utf8'))
        if (candidate['sourceBefore']!=list(token) or candidate['scriptHashes']!=hashes
                or hashlib.sha256((directory/'skywalk.glb').read_bytes()).hexdigest()!=candidate['glbSha256']):
            raise RuntimeError('Source, implementation or reviewed GLB changed')
    original = list(scene.objects)
    objects = {o.get('spaceId'):o for o in original if o.get('spaceId') and o.get('space_export')}
    root = objects[top.ROOT_ID]
    unchanged = [o for o in original if o.get('spaceId') not in [top.OUTPUT_IDS[r] for r in CHANGED]]
    digest, rigs, ids = geometry_digest(unchanged), export_snapshot(scene), top.runtime_id_snapshot(scene)
    created, detail = author(objects)
    bpy.context.view_layer.update()
    if geometry_digest(unchanged)!=digest or export_snapshot(scene)!=rigs:
        raise RuntimeError('Unrelated geometry, transforms or lights changed')
    if top.runtime_id_snapshot(scene)!=ids+Counter(NEW_IDS.values()):
        raise RuntimeError('Runtime identities changed')
    checks = validate(root)
    report = {'revision':REVISION,'saved':False,'sourceBefore':list(token),'scriptHashes':hashes,
              'detail':detail,'checks':checks,'preservedGeometry':digest,'preservedRigs':list(rigs)}
    assert_source_unchanged(token)
    if args.apply:
        if any(report[k]!=candidate[k] for k in report):
            raise RuntimeError('Candidate differs from reviewed geometry or checks')
        backup = directory/'shanghai-before-skywalk.blend'
        if backup.exists():
            raise RuntimeError('Refusing to replace an existing backup')
        shutil.copy2(SOURCE,backup)
        assert_source_unchanged(token)
        scene[PROPERTY] = root[PROPERTY] = REVISION
        root['spaceSwfcSkywalkDetails'] = json.dumps(detail,separators=(',',':'))
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report.update(saved=True,sourceAfter=list(source_fingerprint()))
    else:
        directory.mkdir(parents=True)
        bpy.ops.object.select_all(action='DESELECT')
        targets = [root]+[o for o in root.children_recursive if o.get('space_export')]
        expected = top.export_geometry_snapshot(root,targets)
        for obj in targets:
            obj.hide_set(False)
            obj.select_set(True)
        path = directory/'skywalk.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False,export_gpu_instances=True)
        raw = path.read_bytes()
        size, kind = struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('GLB JSON missing')
        document = json.loads(raw[20:20+size])
        report['exportGeometry'] = top.validate_export_geometry(document,raw,expected)
        mats = {m.get('extras',{}).get('spaceMaterialId'):m for m in document['materials']}
        for role in ('floor-glass','window-glass'):
            transmission = mats[NEW_IDS[role]+'/material'].get('extensions',{}).get(
                'KHR_materials_transmission',{}).get('transmissionFactor',0)
            if abs(transmission-.94)>.0001:
                raise RuntimeError('Transparent glass did not export')
        report.update(glbBytes=len(raw),glbSha256=hashlib.sha256(raw).hexdigest())
    assert_source_unchanged(source_fingerprint() if args.apply else token)
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),
                 (json.dumps(report,indent=2)+'\n').encode('utf8'))
    print('SKYWALK_RESULT '+json.dumps({k:report[k] for k in ('revision','saved','detail','checks')}),flush=True)


if __name__ == '__main__':
    main()
