"""Photo-guided SWFC end portal and exit fixtures; review before one-time apply.

Ullrich's 2008 photo supports one end elevation, not the unseen lift lobby or
the opposite end. Its assignment to +u, panel dimensions and fixture spacing
are estimates. The simplified escape pictogram is not a traced original sign.
See ../references/swfc-top.md for dates, sources and remaining uncertainty.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_swfc_metal_finish as metal
from refine_jin_mao import Mesh
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

hall, top, lighting = metal.hall, metal.top, metal.lighting
REVISION = 'swfc-hall-ends-20260913'
PROPERTY = 'spaceSwfcHallEndsRevision'
OUTPUT = top.ROOT/'.tmp/png/space-swfc-ends-20260913'
IDS = {r: REVISION+'/'+r for r in ('panels', 'metal', 'dark', 'sign-green', 'sign-white')}


def fixture(parts, origin, across, up, scale=1.):
    """Closed sign housing and separately inset luminous face, in metres."""
    origin, across, up = Vector(origin), Vector(across), Vector(up)
    normal = across.cross(up)

    def plate(role, x0, y0, x1, y1, depth, thickness):
        points = [tuple(origin+across*x*scale+up*y*scale+normal*depth)
                  for x, y in ((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
        top.thin_panel(parts[role], points, tuple(-normal*thickness))

    plate('metal', -.23,-.09,.23,.09,.02,.035)
    plate('sign-green', -.211,-.072,.211,.072,.022,.002)
    # Door frame and a walking person. No unverified fine text or direction arrow.
    plate('sign-white', .087,-.053,.098,.054,.023,.0006)
    plate('sign-white', .087,.044,.143,.054,.023,.0006)
    plate('sign-white', .132,-.053,.143,.054,.023,.0006)
    def glyph(points):
        signed_area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
        if signed_area < 0:
            points = list(reversed(points))
        top.thin_panel(parts['sign-white'],
            [tuple(origin+across*x*scale+up*y*scale+normal*.023) for x,y in points],
            tuple(-normal*.0006))

    glyph([(-.004+.013*math.cos(i*math.tau/20),.040+.013*math.sin(i*math.tau/20)) for i in range(20)])
    # Convex pieces form a leaning torso and bent limbs, with a rounded head.
    for points in (
        [(-.024,.026),(-.006,.023),(.008,-.006),(-.012,-.014)],
        [(-.026,.024),(-.057,.015),(-.052,.003),(-.020,.013)],
        [(-.054,.013),(-.072,-.004),(-.063,-.011),(-.048,.004)],
        [(-.008,.019),(.021,.003),(.015,-.008),(-.013,.007)],
        [(.015,.002),(.043,.003),(.043,-.008),(.015,-.009)],
        [(-.010,-.007),(-.038,-.020),(-.031,-.033),(.002,-.022)],
        [(-.038,-.021),(-.055,-.047),(-.043,-.053),(-.026,-.031)],
        [(-.005,-.015),(.020,-.032),(.029,-.021),(.005,-.005)],
        [(.020,-.026),(.026,-.053),(.039,-.049),(.033,-.022)]):
        glyph(points)


def author(root):
    parts = {r: Mesh() for r in IDS}
    box = top.box
    # A single photographed front elevation at the 50 m hall boundary.
    # Left doorway remains genuinely open. Do not infer an entire hidden lobby.
    for lo, hi in ((-2.7,-1.65),(-1.65,.65),(2.55,2.7)):
        box(parts['panels'], (25.,lo,474.), (25.12,hi,476.32))
    box(parts['panels'], (25.,-2.7,476.32), (25.12,2.7,476.5))
    # Dark inset at the opposite side of the doorway, with visible metal edges.
    box(parts['dark'], (24.978,-2.65,474.08), (24.998,-1.7,476.30))
    for v in (-2.7,-1.67,.65,2.55,2.7):
        box(parts['metal'], (24.97,v-.015,474.01), (25.145,v+.015,476.33))
    for z in (475.1,475.85):
        box(parts['metal'], (24.96,-2.65,z-.009), (24.977,-1.7,z+.009))
    box(parts['metal'], (24.96,-2.18,474.08), (24.977,-2.162,476.3))
    for z in (474.035,476.325,476.5):
        # Leave the doorway threshold flush rather than spanning it with a bar.
        for lo, hi in ((-2.7,.65),(2.55,2.7)) if z < 474.1 else ((-2.7,2.7),):
            box(parts['metal'], (24.966,lo,z-.012), (25.15,hi,z+.012))
    # Fine vertical panel joint, not a texture or an invented advertisement.
    box(parts['dark'], (24.996,-.506,474.07), (24.999,-.5,476.31))
    # Return reveals make the door opening legible from oblique views.
    for v in (.65,2.55):
        box(parts['panels'], (25.12,v-.018,474.), (25.38,v+.018,476.32))
    # Photographed low green boxes on aisle-facing metal piers; spacing estimated.
    for u in (-20.,-10.,0.,10.,20.):
        for side in (-1,1):
            fixture(parts, (u,side*3.09,474.36), (side,0,0), (0,0,1))
    # Over-door box and a suspended central box visible in the 2008 photograph.
    fixture(parts, (24.95,1.6,476.39), (0,-1,0), (0,0,1), .8)
    fixture(parts, (24.6,0,476.94), (0,-1,0), (0,0,1), 1.35)
    for v in (-.22,.22):
        parts['metal'].beam((24.62,v,477.80),(24.62,v,477.05),.009,sides=8)
    mats = {r: lighting.material(REVISION+'/'+r, rgb, metallic, rough)
            for r,rgb,metallic,rough in (
                ('panels',(.78,.79,.76),.08,.38),
                ('metal',(.67,.70,.70),.88,.22),
                ('dark',(.09,.115,.12),.25,.32),
                ('sign-green',(.025,.32,.12),0.,.4),
                ('sign-white',(.83,.95,.88),0.,.36))}
    for r,strength in (('sign-green',.85),('sign-white',1.2)):
        node = next(n for n in mats[r].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        node.inputs['Emission Color'].default_value = mats[r].diffuse_color
        node.inputs['Emission Strength'].default_value = strength
    for role, part in parts.items():
        obj = bpy.data.objects.new('SWFC hall end '+role,top.candidate_mesh(part,role,hall.ANGLE))
        root.users_collection[0].objects.link(obj)
        obj.parent = root
        obj.data.materials.append(mats[role])
        for key,value in {'spaceId':IDS[role],'space_export':True,'spaceVisible':True,
                          'spaceName':obj.name,'spaceCastShadow':True,'spaceReceiveShadow':True,
                          PROPERTY:REVISION,'spaceDimensionsEstimated':True}.items():
            obj[key] = value
    bpy.context.view_layer.update()
    return {'documentedEndElevations':1,'lowExitFixtures':10,'overDoorFixtures':1,
            'suspendedFixtures':1,'estimatedDoorClearWidth':1.9,'estimatedDoorClearHeight':2.32,
            'endAxisAssignmentEstimated':True,'signArtwork':'simplified pictogram, not a facsimile'}


def validate(root):
    checks = hall.validate(root)
    solids = hall.tree([o for o in root.children if o.get('spaceId') in IDS.values()])
    # Test the actual aperture at several heights; a single centre ray misses headers.
    for v in (.70,1.1,1.6,2.1,2.50):
        for z in (474.04,475.,476.25):
            if solids.ray_cast(Vector((24.,v,z)),Vector((1,0,0)),1.5)[0] is not None:
                raise RuntimeError('The end doorway is obstructed')
    for v in (-2.2,-1.,0.,2.63):
        if solids.ray_cast(Vector((24.,v,475.)),Vector((1,0,0)),1.5)[0] is None:
            raise RuntimeError('An end panel is missing')
    checks.update(endOpeningRays=15,endPanelRays=4)
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label',required=True)
    parser.add_argument('--apply',action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a lowercase filename label')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve()!=SOURCE.resolve() or scene.get(metal.PROPERTY)!=metal.REVISION or scene.get(PROPERTY):
        raise RuntimeError('Expected canonical metal finish without this one-time end revision')
    token = source_fingerprint()
    hashes = {str(p.relative_to(top.ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT/args.label
    if directory.exists() and not args.apply:
        raise RuntimeError('Use a new candidate label')
    candidate = json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate and (candidate['sourceBefore']!=list(token) or candidate['scriptHashes']!=hashes or
            hashlib.sha256((directory/'hall.glb').read_bytes()).hexdigest()!=candidate['glbSha256']):
        raise RuntimeError('Source, scripts or reviewed GLB changed')
    original = list(scene.objects)
    root = next(o for o in original if o.get('spaceId')==top.ROOT_ID)
    digest, rigs, ids = geometry_digest(original),export_snapshot(scene),top.runtime_id_snapshot(scene)
    assignments = {o:tuple(o.data.materials) for o in original if o.type=='MESH'}
    detail = author(root)
    if geometry_digest(original)!=digest or export_snapshot(scene)!=rigs:
        raise RuntimeError('Original geometry or lighting rigs changed')
    if any(tuple(o.data.materials)!=m for o,m in assignments.items()) or top.runtime_id_snapshot(scene)!=ids+Counter(IDS.values()):
        raise RuntimeError('Original materials or runtime identities changed')
    checks = validate(root)
    report = {'revision':REVISION,'saved':False,'sourceBefore':list(token),'scriptHashes':hashes,
              'detail':detail,'checks':checks,'preservedGeometry':digest,'preservedRigs':list(rigs)}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt candidate differs from reviewed result')
        backup = directory/'shanghai-before-hall-ends.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite backup')
        shutil.copy2(SOURCE,backup)
        assert_source_unchanged(token)
        scene[PROPERTY] = root[PROPERTY] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report.update(saved=True,sourceAfter=list(source_fingerprint()))
    else:
        directory.mkdir(parents=True)
        root['facadeLighting'] = rigs[top.ROOT_ID]
        bpy.ops.object.select_all(action='DESELECT')
        targets = [root]+[o for o in root.children_recursive if o.get('space_export')]
        expected = top.export_geometry_snapshot(root,targets)
        for obj in targets:
            obj.hide_set(False);obj.select_set(True)
        path = directory/'hall.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False,export_gpu_instances=True)
        raw = path.read_bytes()
        size,kind = struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('Missing GLB JSON')
        report['exportGeometry'] = top.validate_export_geometry(json.loads(raw[20:20+size]),raw,expected)
        report.update(glbBytes=len(raw),glbSha256=hashlib.sha256(raw).hexdigest())
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),(json.dumps(report,indent=2)+'\n').encode())
    print('HALL_ENDS_RESULT '+json.dumps({k:report[k] for k in ('saved','detail','checks')}),flush=True)


if __name__ == '__main__':
    main()
