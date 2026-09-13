"""One-time photo-guided Jin Mao PBR and wash revision; review before --apply.

SOM photographs are references, not texture inputs or measured photometry.
See references/jin-mao.md. Geometry, meter UVs and runtime identities stay intact.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import refine_jin_mao as jm
import refine_jin_mao_body as body
import refine_swfc_top as exchange
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

REVISION = 'jin-mao-finish-20260913'
PROPERTY = 'spaceJinMaoFinishRevision'
ROOT_ID = 'root/132/0'
OUTPUT = jm.ROOT / '.tmp/png/space-jinmao-finish-20260913'
# sRGB appearance estimates, metallic, roughness and the existing runtime wash.
FINISHES = {
    'brushed aluminum': ((214, 216, 216), .82, .26, .025),
    'crown silver fins': ((216, 212, 201), .78, .27, 1.6),
    'shadow reveals': ((31, 39, 43), .25, .6, 0),
    'smoky blue glass': ((75, 95, 109), .34, .20, None),
    'vertical floodlit piers': ((208, 205, 197), .74, .25, 2.4),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def material_record(material):
    node = material.node_tree.nodes.get('Principled BSDF')
    if not node or len(material.node_tree.nodes) != 2:
        raise RuntimeError('Inspect artist node edits before replacing the finish')
    return {'color': list(node.inputs['Base Color'].default_value),
            'metallic': node.inputs['Metallic'].default_value,
            'roughness': node.inputs['Roughness'].default_value,
            'shader': material.get('spaceShaderKey'),
            'emission': node.inputs['Emission Strength'].default_value}


def author(objects):
    sources = {m.get('spaceMaterialId', '').split('/', 1)[-1]: m
               for o in objects for m in o.data.materials}
    if set(sources) != set(FINISHES) or any(
            m.get('spaceMaterialId') != jm.REVISION+'/'+name for name, m in sources.items()):
        raise RuntimeError('Expected the five original Jin Mao material roles')
    detail = {}
    for role, (rgb, metallic, roughness, wash) in FINISHES.items():
        source = sources[role]
        before = material_record(source)
        if before['emission'] != 0:
            raise RuntimeError('Source contains preview emission; inspect before applying')
        source.use_fake_user = True
        material = jm.make_material(source, role, rgb, wash, metallic, roughness)
        material.name = 'Jin Mao photo finish '+role
        material['spaceMaterialId'] = REVISION+'/'+role
        material[PROPERTY] = REVISION
        material['spaceSurfaceEstimate'] = 'Photo-guided PBR and wash, not measured optical or photometric data'
        affected = [o for o in objects if o.data.materials[0] == source]
        for obj in affected:
            obj.data.materials[0] = material
        detail[role] = {'before': before, 'after': material_record(material), 'meshes': len(affected)}
    return detail


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or len(args.label) > 64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a short lowercase filename label')
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.get('spaceId') == ROOT_ID]
    if (len(roots) != 1 or Path(bpy.data.filepath).resolve() != SOURCE.resolve()
            or scene.get('space_contract') != 2 or scene.get(PROPERTY)):
        raise RuntimeError('Expected canonical contract-v2 source without this one-time finish')
    root = roots[0]
    if root.get(body.PROFILE_PROPERTY) != body.PROFILE_REVISION or root.get(PROPERTY):
        raise RuntimeError('Expected the reviewed Jin Mao setbacks before this finish')
    objects = [o for o in root.children if o.type == 'MESH' and o.get('space_export')]
    if len(objects) != 51 or any(o.data.users != 1 or len(o.data.materials) != 1 for o in objects):
        raise RuntimeError('Expected 51 individually owned, single-material meshes')
    token = source_fingerprint()
    scripts = {p.name: sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT / args.label
    candidate = json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate:
        if (candidate['sourceBefore'] != list(token) or candidate['scripts'] != scripts
                or sha(directory/'finish.glb') != candidate['candidateSha256']):
            raise RuntimeError('Reviewed source, scripts or candidate changed')
    else:
        directory.mkdir(parents=True, exist_ok=False)
    original = list(scene.objects)
    digest, rigs, ids = geometry_digest(original), export_snapshot(scene), exchange.runtime_id_snapshot(scene)
    other = {o: (o.data, tuple(o.data.materials)) for o in original if o.type == 'MESH' and o not in objects}
    detail = author(objects)
    if (geometry_digest(original) != digest or export_snapshot(scene) != rigs
            or exchange.runtime_id_snapshot(scene) != ids
            or any(o.data != data or tuple(o.data.materials) != mats for o, (data, mats) in other.items())):
        raise RuntimeError('Geometry, transforms, runtime IDs, rigs or unrelated materials changed')
    report = {'revision': REVISION, 'saved': False, 'sourceBefore': list(token), 'scripts': scripts,
              'geometry': digest, 'preservedRigs': list(rigs), 'detail': detail,
              'estimated': ['PBR colors', 'metallic and roughness', 'night wash strengths']}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k] != v for k, v in report.items()):
            raise RuntimeError('Rebuilt materials differ from the reviewed candidate')
        backup = directory/'shanghai-before-jinmao-finish.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite a backup')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        root[PROPERTY] = scene[PROPERTY] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    else:
        targets = [root, *objects]
        expected = exchange.export_geometry_snapshot(root, targets)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in targets:
            obj.hide_set(False)
            obj.select_set(True)
        path = directory/'finish.glb'
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
            export_extras=True, export_attributes=True, export_yup=True, export_animations=False,
            export_cameras=False, export_lights=False, export_gpu_instances=True)
        raw = path.read_bytes()
        size, kind = struct.unpack_from('<II', raw, 12)
        if kind != 0x4E4F534A:
            raise RuntimeError('Missing GLB JSON')
        exchange.ROOT_ID = ROOT_ID
        report['exportGeometry'] = exchange.validate_export_geometry(json.loads(raw[20:20+size]), raw, expected)
        report['candidateSha256'] = sha(path)
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'), (json.dumps(report, indent=2)+'\n').encode())
    print('JIN_MAO_FINISH_RESULT '+json.dumps({k: v for k, v in report.items() if k != 'scripts'}), flush=True)


if __name__ == '__main__':
    main()
