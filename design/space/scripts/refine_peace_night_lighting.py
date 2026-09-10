"""Incrementally edit six existing Peace Hotel lights and its distant roof wash.

Default validates a disposable candidate; --apply requires that exact candidate
and source fingerprint, makes a backup, then saves the canonical source.
Photo provenance and estimate boundaries: ../references/peace-crown.md.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import facade_rig
import refine_peace_crown as guard

OUTPUT = guard.ROOT / '.tmp/png/space-night-20260910'
REVISION = 'peace-night-roof-20260910'
PROPERTY = 'spacePeaceNightRevision'
ROOF_KEY = 'shanghai-illumination-0.001-bund-roof-shadowed-1.7-64'
ROOF_WASH = {'bottom': 60., 'top': 73.6, 'color': [.18, 1., .28]}


def lamps():
    green = {'color': [.18, 1., .28], 'intensity': 50., 'angle': 1.05,
             'penumbra': .85, 'distance': 27.}
    crown = {'color': [1., .72, .4], 'intensity': 24., 'angle': 1.02,
             'penumbra': .8, 'distance': 5.}
    return [
        dict(green, position=[-1314.8, 60.6, 1362.], target=[-1318.6, 63., 1362.]),
        dict(green, position=[-1314.8, 60.6, 1372.], target=[-1318.6, 63., 1372.]),
        dict(crown, position=[-1325.6, 74.2, 1367.], target=[-1327., 75.3, 1367.]),
        dict(crown, position=[-1328., 74.2, 1369.4], target=[-1328., 75.3, 1368.]),
        dict(green, position=[-1333., 60.6, 1380.2], target=[-1333., 63., 1376.4]),
        dict(green, position=[-1323., 60.6, 1380.2], target=[-1323., 63., 1376.4]),
    ]


def export_snapshot(scene):
    roots = [o for o in scene.objects if o.get('spaceFacadeRig')]
    original = {o: o['facadeLighting'].to_dict() for o in roots}
    try:
        if facade_rig.export_facade_rigs(scene) != 3:
            raise RuntimeError('Expected all three existing authored rigs')
        return {o['spaceId']: o['facadeLighting'].to_dict() for o in roots}
    finally:
        # Derived targets belong only in exports, never the authored source.
        for obj, value in original.items():
            obj['facadeLighting'] = value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != guard.SOURCE or scene.get('space_contract') != 2
            or scene.get('space_asset') != 'shanghai' or not scene.get('spaceBundColorEncodingRevision')):
        raise RuntimeError('Open the current canonical Shanghai authoring source')
    if scene.get(PROPERTY):
        raise RuntimeError('Night revision exists; edit current lights instead of rerunning this increment')
    token = guard.source_fingerprint()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT / 'candidate-report.json'
    candidate = json.loads(report_path.read_text(encoding='utf8')) if args.apply else None
    before = export_snapshot(scene)
    root = next(o for o in scene.objects if o.get('spaceId') == 'root/147/4')
    slots = sorted((o for o in root.children if 'spaceFacadeSlot' in o), key=lambda o: o['spaceFacadeSlot'])
    config = lamps()
    transforms = {o: o.matrix_world.copy() for o in scene.objects if o not in slots}
    ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    images = {im: hashlib.sha256(bytes(im.packed_file.data)).hexdigest()
              for im in bpy.data.images if im.packed_file}
    materials = [bpy.data.materials.get(name) for name in ('20 patinated standing seams', '20 weathered copper roof')]
    if any(m is None or m.get('spaceShaderKey') != ROOF_KEY or 'spaceRoofWash' in m for m in materials):
        raise RuntimeError('Copper material provenance changed; review before editing')
    for obj, record in zip(slots, config, strict=True):
        if obj.matrix_parent_inverse != Matrix.Identity(4) or tuple(obj.scale) != (1., 1., 1.):
            raise RuntimeError('Unexpected authored lamp parent inverse or scale')
        zup = lambda p: Vector((p[0], -p[2], p[1]))
        obj.location = zup(record['position'])
        obj.rotation_mode = 'XYZ'
        obj.rotation_euler = (zup(record['target']) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        obj.data.color = record['color']
        obj.data.energy = record['intensity'] * .05  # Preview watts, not physical calibration.
        obj.data.spot_size = record['angle'] * 2
        obj.data.spot_blend = record['penumbra']
        obj.data.use_custom_distance = True
        obj.data.cutoff_distance = record['distance']
        obj['spaceCandela'] = record['intensity']
    for mat in materials:
        mat['spaceRoofWash'] = ROOF_WASH
        mat['spaceShaderKey'] = ROOF_KEY.replace('-1.7-64', '-0.85-64')
    bpy.context.view_layer.update()
    after = export_snapshot(scene)
    if any(before[key] != after[key] for key in before if key != root['spaceId']):
        raise RuntimeError('Another building light rig changed')
    for actual, expected in zip(after[root['spaceId']]['lamps'], config, strict=True):
        for key in ('position', 'color'):
            if max(abs(a-b) for a, b in zip(actual[key], expected[key], strict=True)) > .0002:
                raise RuntimeError('Authored lamp vector failed export roundtrip: '+key)
        aim = (Vector(expected['target']) - Vector(expected['position'])).normalized()
        direction = (Vector(actual['target']) - Vector(actual['position'])).normalized()
        if aim.dot(direction) < .99999:
            raise RuntimeError('Authored lamp aim failed export roundtrip')
        for key in ('intensity', 'angle', 'penumbra', 'distance'):
            if abs(actual[key] - expected[key]) > .00001:
                raise RuntimeError('Authored lamp scalar failed export roundtrip: '+key)
    if ids != Counter(o.get('spaceId') for o in scene.objects if o.get('space_export')) or any(
            obj.matrix_world != matrix for obj, matrix in transforms.items()):
        raise RuntimeError('Runtime identities or unrelated transforms changed')
    if any(hashlib.sha256(bytes(im.packed_file.data)).hexdigest() != value for im, value in images.items()):
        raise RuntimeError('Packed image changed')
    report = {'revision': REVISION, 'sourceBefore': list(token), 'saved': False,
              'before': before, 'after': after, 'requestedLamps': config, 'roofWash': ROOF_WASH,
              'roofStrength': .85, 'runtimeObjects': sum(ids.values()), 'preservedPackedImages': len(images)}
    if candidate is not None and report != candidate:
        raise RuntimeError('Candidate or source changed; inspect again before applying')
    scene[PROPERTY] = REVISION
    guard.assert_source_unchanged(token)
    if args.apply:
        backup = OUTPUT / 'shanghai-before-night-roof.blend'
        if backup.exists():
            raise RuntimeError('Backup exists; inspect the earlier apply first')
        shutil.copy2(guard.SOURCE, backup)
        report['backupSha256'] = hashlib.sha256(backup.read_bytes()).hexdigest()
        guard.assert_source_unchanged(token)
        bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(guard.SOURCE), compress=True)
        report.update(saved=True, sourceAfter=guard.source_fingerprint())
    (OUTPUT / ('saved-report.json' if args.apply else 'candidate-report.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('PEACE_NIGHT '+json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
