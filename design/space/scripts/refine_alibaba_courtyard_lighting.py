"""Incrementally add a web-reviewed Y or Z court rig to the current XYZ scene.

This is an estimated lighting design, not measured photometry. Native Blender
lights export through the existing six-spot pool; no extra runtime light pool.
Default is the original Z pass; --district y adds the later Y court pass.
Run once without --apply, then --apply after reviewing candidate-report.json.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from facade_rig import export_snapshot
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, ROOT, source_fingerprint, assert_source_unchanged

REVISION = 'alibaba-z-court-light-20260912'
OUTPUT = ROOT / '.tmp/png/space-alibaba-full-20260912/court-light'
CONFIG = json.loads('[{"position":[-24,12,18],"target":[-9,0,10],"color":[1,0.83,0.63],"intensity":1200,"angle":0.85,"penumbra":0.85,"distance":45},{"position":[24,12,18],"target":[9,0,10],"color":[1,0.83,0.63],"intensity":1200,"angle":0.85,"penumbra":0.85,"distance":45},{"position":[-24,12,-8],"target":[-9,0,-2],"color":[1,0.83,0.63],"intensity":1200,"angle":0.85,"penumbra":0.85,"distance":45},{"position":[24,12,-8],"target":[9,0,-2],"color":[1,0.83,0.63],"intensity":1200,"angle":0.85,"penumbra":0.85,"distance":45},{"position":[-8,7,-6],"target":[-2,4,-12.72],"color":[1,0.83,0.63],"intensity":500,"angle":0.75,"penumbra":0.85,"distance":45},{"position":[8,7,-6],"target":[2,4,-12.72],"color":[1,0.83,0.63],"intensity":500,"angle":0.75,"penumbra":0.85,"distance":45}]')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--district', choices=('y', 'z'), default='z')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    is_y = args.district == 'y'
    revision = 'alibaba-y-court-light-20260912' if is_y else REVISION
    output = ROOT / '.tmp/png/space-alibaba-refinement-20260912/y-court-light' if is_y else OUTPUT
    marker = 'spaceAlibabaYCourtLightingRevision' if is_y else 'spaceAlibabaCourtLightingRevision'
    config = [
        {'position': [x, 9, z], 'target': [-3 if x < 0 else 3, 0, z],
         'color': [1, .87, .7], 'intensity': 850, 'angle': .9, 'penumbra': .85, 'distance': 32}
        for z in (27, 0, -27) for x in (-11, 11)
    ] if is_y else CONFIG
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != SOURCE.resolve()
            or scene.get('space_asset') != 'shanghai' or scene.get('space_contract') != 2):
        raise RuntimeError('Open the current canonical Shanghai scene')
    identity = 'authored/alibaba-xuhui-' + args.district
    root = next(o for o in scene.objects if o.get('spaceId') == identity)
    sign = None if is_y else next(o for o in root.children if o.get('spaceId') == identity+'/sign')
    required = 'alibaba-xuhui-y-20260912' if is_y else 'alibaba-xz-20260912'
    if root.get('spaceAlibabaRevision') != required or root.get('spaceFacadeRig') or scene.get(marker):
        raise RuntimeError('Expected the reviewed XYZ source without the courtyard rig')
    if is_y and scene.get('spaceAlibabaNightBalance') != 'alibaba-glazing-foliage-20260912-night-balance':
        raise RuntimeError('Review and save the Y glazing and window balance first')
    if sign and (sign.location - Vector((0, 21.4, 2.6))).length > .001:
        raise RuntimeError('The sign was edited; review the current scene before applying')
    token = source_fingerprint()
    if is_y and list(token) != json.loads((output.parent/'night-saved-report.json').read_text(encoding='utf8'))['sourceAfter']:
        raise RuntimeError('Source changed since window review; inspect incremental edits')
    others = [o for o in scene.objects if o != sign]
    geometry = geometry_digest(others)
    ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    before = export_snapshot(scene)
    collection = bpy.data.collections.new('AUTHORING | Alibaba '+args.district.upper()+' court lighting')
    scene.collection.children.link(collection)
    root['facadeLighting'] = {'width': 108. if is_y else 128., 'height': 55. if is_y else 49.,
                              'centre': [0., 8. if is_y else 12., 0.], 'washTop': 0.}
    root['spaceFacadeRig'] = revision
    for slot, record in enumerate(config):
        data = bpy.data.lights.new(f'Alibaba {args.district.upper()} court spot {slot+1}', 'SPOT')
        obj = bpy.data.objects.new(data.name, data)
        collection.objects.link(obj)
        obj.parent = root
        zup = lambda p: Vector((p[0], -p[2], p[1]))
        obj.location = zup(record['position'])
        obj.rotation_euler = (zup(record['target'])-obj.location).to_track_quat('-Z', 'Y').to_euler()
        data.color = record['color']
        data.energy = record['intensity']*.05
        data.spot_size = record['angle']*2
        data.spot_blend = record['penumbra']
        data.use_custom_distance = True
        data.cutoff_distance = record['distance']
        data.shadow_soft_size = .15
        obj['spaceFacadeSlot'] = slot
        obj['spaceCandela'] = float(record['intensity'])
        obj['spaceLightingEstimate'] = 'Visual courtyard proxy; not surveyed fixtures or calibrated photometry'
    # Move the existing letters in front of the courtyard glass and above the
    # pergola. Keep their authored mesh, typeface and material unchanged.
    if sign:
        sign.location = (0, 12.72, 4)
    bpy.context.view_layer.update()
    after = export_snapshot(scene)
    if len(after) != len(before)+1 or any(after[key] != value for key, value in before.items()):
        raise RuntimeError('An existing light rig changed')
    if geometry_digest(others) != geometry or ids != Counter(
            o.get('spaceId') for o in scene.objects if o.get('space_export')):
        raise RuntimeError('Unrelated geometry, transforms or runtime identities changed')
    for actual, expected in zip(after[root['spaceId']]['lamps'], config, strict=True):
        for key in ('position', 'color'):
            # Blender float32 world/local roundtrip at ~9.5 km measured a
            # 0.366 mm offset. Allow 2 mm for position only, not color or aim.
            tolerance = .002 if key == 'position' else .0002
            if max(abs(a-b) for a,b in zip(actual[key], expected[key], strict=True)) > tolerance:
                raise RuntimeError(f'Lamp export vector mismatch: {key}: {actual[key]} vs {expected[key]}')
        for key in ('intensity', 'angle', 'penumbra', 'distance'):
            if abs(actual[key]-expected[key]) > .00001:
                raise RuntimeError('Lamp export scalar mismatch: '+key)
        aim = (Vector(expected['target'])-Vector(expected['position'])).normalized()
        direction = (Vector(actual['target'])-Vector(actual['position'])).normalized()
        if aim.dot(direction) < .99999:
            raise RuntimeError('Lamp aim export mismatch')
    report = {'revision': revision, 'sourceBefore': list(token), 'saved': False,
              'preservedRigs': list(before), 'facadeRigs': len(after), 'runtimePool': 6,
              'unchangedGeometry': geometry, 'signPositionBlender': list(sign.location) if sign else None,
              'lamps': after[root['spaceId']]['lamps']}
    output.mkdir(parents=True, exist_ok=True)
    assert_source_unchanged(token)
    if args.apply:
        candidate = json.loads((output/'candidate-report.json').read_text(encoding='utf8'))
        if candidate != report:
            raise RuntimeError('Candidate or current source changed; review again')
        backup = output/'shanghai-before-court-light.blend'
        if backup.exists():
            raise RuntimeError('Backup exists; inspect previous apply')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene[marker] = revision
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    (output/('saved-report.json' if args.apply else 'candidate-report.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'saved': report['saved'], 'rigs': len(after), 'preserved': len(before)}))


if __name__ == '__main__':
    main()
