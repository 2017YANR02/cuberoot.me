"""Separate the photo-observed dark polished floor from the silver ceiling.

Surface chemistry and PBR values are estimates; the referenced photographs
support the appearance, not a surveyed material specification. Geometry and
glass openings stay unchanged. Review the candidate before --apply.
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
import bmesh

sys.path.insert(0, str(Path(__file__).parent))
import refine_swfc_hall_ends as ends
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

hall, top, lighting = ends.hall, ends.top, ends.lighting
REVISION = 'swfc-floor-finish-20260913'
PROPERTY = 'spaceSwfcFloorFinishRevision'
FLOOR_ID = REVISION+'/floor'
OUTPUT = top.ROOT/'.tmp/png/space-swfc-optics-20260913'


def face_snapshot(objects):
    """Exact coordinates and authored UVs, independent of mesh partitioning."""
    faces = Counter()
    for obj in objects:
        uv = obj.data.uv_layers.active.data
        for face in obj.data.polygons:
            points = [tuple(obj.data.vertices[obj.data.loops[i].vertex_index].co)+tuple(uv[i].uv)
                      for i in face.loop_indices]
            # BMesh may rotate a polygon's start vertex, but not its winding.
            faces[min(tuple(points[i:]+points[:i]) for i in range(len(points)))] += 1
    return faces


def author(root):
    source = next(o for o in root.children if o.get('spaceId')==hall.NEW_IDS['interior-mirror'])
    before = face_snapshot([source])
    original = source.data
    original.use_fake_user = True
    source.data = original.copy()
    floor = source.copy()
    floor.data = original.copy()
    floor.name = 'SWFC dark polished walking floor'
    root.users_collection[0].objects.link(floor)
    floor['spaceId'] = FLOOR_ID
    floor['spaceName'] = floor.name
    floor[PROPERTY] = REVISION
    for obj in (source, floor):
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        removed = [f for f in mesh.faces if (max(v.co.z for v in f.verts) < 474.03) != (obj == floor)]
        bmesh.ops.delete(mesh, geom=removed, context='FACES')
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()
    if not floor.data.polygons or face_snapshot([source, floor])!=before:
        raise RuntimeError('Floor split changed geometry, UVs or winding')
    material = lighting.material(REVISION+'/dark-polished', (.055,.061,.065), 0., .10)
    material['spaceSurfaceEstimate'] = 'Photo-guided dark polished dielectric; chemistry and optical values unmeasured'
    floor.data.materials.clear()
    floor.data.materials.append(material)
    bpy.context.view_layer.update()
    return source, floor, {'floorFaces':len(floor.data.polygons), 'retainedLiningFaces':len(source.data.polygons),
                           'geometryAndUVsUnchanged':True, 'metalness':0., 'roughness':.10,
                           'baseColorSRGB':[.055,.061,.065], 'materialSpecificationEstimated':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label',required=True)
    parser.add_argument('--apply',action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a lowercase filename label')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve()!=SOURCE.resolve() or scene.get(ends.PROPERTY)!=ends.REVISION or scene.get(PROPERTY):
        raise RuntimeError('Expected canonical hall ends without this one-time floor revision')
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
    others = [o for o in original if o.get('spaceId')!=hall.NEW_IDS['interior-mirror']]
    digest, rigs, ids = geometry_digest(others),export_snapshot(scene),top.runtime_id_snapshot(scene)
    assignments = {o:tuple(o.data.materials) for o in original if o.type=='MESH'}
    source, floor, detail = author(root)
    if geometry_digest(others)!=digest or export_snapshot(scene)!=rigs:
        raise RuntimeError('Other geometry or lighting rigs changed')
    if any(tuple(o.data.materials)!=m for o,m in assignments.items()) or top.runtime_id_snapshot(scene)!=ids+Counter([FLOOR_ID]):
        raise RuntimeError('Original materials or runtime identities changed')
    report = {'revision':REVISION,'saved':False,'sourceBefore':list(token),'scriptHashes':hashes,
              'detail':detail,'checks':ends.validate(root),'preservedGeometry':digest,'preservedRigs':list(rigs)}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt candidate differs from reviewed result')
        backup = directory/'shanghai-before-floor-finish.blend'
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
    print('FLOOR_FINISH_RESULT '+json.dumps({k:report[k] for k in ('saved','detail','checks')}),flush=True)


if __name__ == '__main__':
    main()
