"""Export six editable Blender spotlights into the fixed Three.js facade pool."""
import math
from mathutils import Vector


def export_facade_rigs(scene):
    count = 0
    for root in scene.objects:
        if not root.get('spaceFacadeRig'):
            continue
        lamps = sorted((o for o in root.children if 'spaceFacadeSlot' in o),
                       key=lambda o: o['spaceFacadeSlot'])
        if [o['spaceFacadeSlot'] for o in lamps] != list(range(6)):
            raise RuntimeError(f'{root.name}: expected facade light slots 0 through 5')
        if not root.get('space_export') or not root.get('facadeLighting'):
            raise RuntimeError(f'{root.name}: facade rig needs an exportable frontage')
        result = []
        for obj in lamps:
            if obj.type != 'LIGHT' or obj.data.type != 'SPOT' or obj.get('space_export'):
                raise RuntimeError(f'{obj.name}: facade helpers must be non-exported SPOT lights')
            local = root.matrix_world.inverted() @ obj.matrix_world
            position = local.translation
            direction = local.to_3x3() @ Vector((0, 0, -1))
            if direction.length < .00001:
                raise RuntimeError(f'{obj.name}: invalid light direction')
            target = position + direction.normalized() * 10
            data = obj.data
            intensity = obj.get('spaceCandela')
            if not isinstance(intensity, (float, int)) or not math.isfinite(intensity) or intensity < 0:
                raise RuntimeError(f'{obj.name}: spaceCandela must be finite and non-negative')
            if not data.use_custom_distance or data.cutoff_distance <= .3:
                raise RuntimeError(f'{obj.name}: set Custom Distance above 0.3 m')
            if not 0 < data.spot_size <= math.pi or not 0 <= data.spot_blend <= 1:
                raise RuntimeError(f'{obj.name}: invalid spot cone')
            color = list(data.color)
            if not all(math.isfinite(v) and 0 <= v <= 1 for v in color):
                raise RuntimeError(f'{obj.name}: invalid linear light color')
            # glTF rotates geometry from Blender Z-up to Three.js Y-up, but extras
            # are plain JSON and need that same basis conversion explicitly.
            yup = lambda v: [float(v.x), float(v.z), float(-v.y)]
            record = {'position': yup(position), 'target': yup(target), 'color': color,
                      'intensity': intensity, 'angle': float(data.spot_size / 2),
                      'penumbra': float(data.spot_blend), 'distance': float(data.cutoff_distance)}
            if not all(math.isfinite(v) for v in record['position'] + record['target']):
                raise RuntimeError(f'{obj.name}: non-finite transform')
            result.append(record)
        # Export only: never save derived metadata back over the artist's source.
        root['facadeLighting']['lamps'] = result
        count += 1
    return count


def export_snapshot(scene):
    """Inspect all three rigs without persisting derived lamp metadata."""
    roots = [o for o in scene.objects if o.get('spaceFacadeRig')]
    original = {o: o['facadeLighting'].to_dict() for o in roots}
    try:
        if export_facade_rigs(scene) != 3:
            raise RuntimeError('Expected all three existing authored rigs')
        return {o['spaceId']: o['facadeLighting'].to_dict() for o in roots}
    finally:
        for obj, value in original.items():
            obj['facadeLighting'] = value


def run_lighting_increment(*, root_id, config, output, revision, property_name,
                           edit_wash, backup_name, required_revisions=()):
    """Shared candidate/apply boundary for the two reviewed six-light edits."""
    import argparse
    from collections import Counter
    import hashlib
    import json
    from pathlib import Path
    import shutil
    import sys

    import bpy
    from mathutils import Matrix
    import refine_peace_crown as guard

    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != guard.SOURCE or scene.get('space_contract') != 2
            or scene.get('space_asset') != 'shanghai' or not scene.get('spaceBundColorEncodingRevision')):
        raise RuntimeError('Open the current canonical Shanghai authoring source')
    if any(scene.get(key) != value for key, value in required_revisions):
        raise RuntimeError('Required prior lighting revision missing or changed')
    if scene.get(property_name):
        raise RuntimeError('Night revision exists; edit current lights instead of rerunning this increment')
    token = guard.source_fingerprint()
    output.mkdir(parents=True, exist_ok=True)
    candidate = json.loads((output / 'candidate-report.json').read_text(encoding='utf8')) if args.apply else None
    before = export_snapshot(scene)
    roots = [o for o in scene.objects if o.get('spaceId') == root_id]
    if len(roots) != 1 or root_id not in before:
        raise RuntimeError('Expected one existing authored frontage: ' + root_id)
    root = roots[0]
    slots = sorted((o for o in root.children if 'spaceFacadeSlot' in o), key=lambda o: o['spaceFacadeSlot'])
    if len(config) != 6:
        raise RuntimeError('Expected exactly six requested lamps')
    transforms = {o: o.matrix_world.copy() for o in scene.objects if o not in slots}
    ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    images = {im: hashlib.sha256(bytes(im.packed_file.data)).hexdigest()
              for im in bpy.data.images if im.packed_file}
    for obj, record in zip(slots, config, strict=True):
        if (obj.matrix_parent_inverse != Matrix.Identity(4) or tuple(obj.scale) != (1., 1., 1.)
                or obj.data.users != 1):
            raise RuntimeError('Unexpected authored lamp parent inverse, scale or shared light data')
        zup = lambda p: Vector((p[0], -p[2], p[1]))
        obj.location = zup(record['position'])
        obj.rotation_mode = 'XYZ'
        obj.rotation_euler = (zup(record['target']) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        obj.data.color = record['color']  # Blender and the runtime contract use linear RGB.
        obj.data.energy = record['intensity'] * .05  # Preview watts, not physical calibration.
        obj.data.spot_size = record['angle'] * 2
        obj.data.spot_blend = record['penumbra']
        obj.data.use_custom_distance = True
        obj.data.cutoff_distance = record['distance']
        obj['spaceCandela'] = record['intensity']
    wash_report = edit_wash(root)
    bpy.context.view_layer.update()
    after = export_snapshot(scene)
    if any(before[key] != after[key] for key in before if key != root_id):
        raise RuntimeError('Another building light rig changed')
    for actual, expected in zip(after[root_id]['lamps'], config, strict=True):
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
    report = {'revision': revision, 'sourceBefore': list(token), 'saved': False,
              'before': before, 'after': after, 'requestedLamps': config, **wash_report,
              'runtimeObjects': sum(ids.values()), 'preservedPackedImages': len(images)}
    if candidate is not None and report != candidate:
        raise RuntimeError('Candidate or source changed; inspect again before applying')
    scene[property_name] = revision
    guard.assert_source_unchanged(token)
    if args.apply:
        backup = output / backup_name
        if backup.exists():
            raise RuntimeError('Backup exists; inspect the earlier apply first')
        shutil.copy2(guard.SOURCE, backup)
        report['backupSha256'] = hashlib.sha256(backup.read_bytes()).hexdigest()
        guard.assert_source_unchanged(token)
        bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(guard.SOURCE), compress=True)
        report.update(saved=True, sourceAfter=guard.source_fingerprint())
    (output / ('saved-report.json' if args.apply else 'candidate-report.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    return report
