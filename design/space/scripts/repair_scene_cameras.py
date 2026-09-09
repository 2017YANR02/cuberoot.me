"""One-time repair of untouched import camera presets, preserving authored cameras."""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from preview_cameras import aim, room_cameras

legacy = {
    'Living room': ((6, -7, 1.7), (-4, 1, 1.5)),
    'Study': ((-17, 5, 1.7), (-25, 10, 1.4)),
    'Bedroom': ((-17, -8, 6.7), (-25, -6, 6.2)),
    'Bathroom': ((-8, 10, 6.7), (-3, 12, 6.2)),
}
results = []
for source in sorted((Path(__file__).resolve().parents[1] / 'scenes').glob('*.blend')):
    original_time = source.stat().st_mtime_ns
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    key = scene.get('space_asset')
    if key != source.stem or scene.get('space_contract') != 2:
        raise RuntimeError(f'Unexpected source contract: {source}')
    presets = room_cameras(key)
    preview = next((c for c in scene.collection.children if c.name.startswith('PREVIEW |')), None)
    if not preview:
        raise RuntimeError(f'Missing preview collection: {source}')
    changed = []
    for name in set(presets) | set(legacy):
        obj = preview.objects.get(name)
        if obj:
            if obj.type != 'CAMERA' or obj.get('space_export') or name not in legacy:
                continue
            position, target = legacy[name]
            rotation = (Vector(target) - Vector(position)).to_track_quat('-Z', 'Y')
            if ((obj.location - Vector(position)).length > .0001
                    or obj.rotation_euler.to_quaternion().rotation_difference(rotation).angle > .0001):
                continue
        elif name not in presets:
            continue
        if name not in presets:
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            if obj is None:
                obj = bpy.data.objects.new(name, bpy.data.cameras.new(name))
                preview.objects.link(obj)
                obj.data.lens = 22
                obj.data.clip_end = 100000
            aim(obj, *presets[name])
        changed.append(name)
    if changed:
        if source.stat().st_mtime_ns != original_time:
            raise RuntimeError(f'Source changed during repair; refusing save: {source}')
        bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    results.append({'asset': key, 'cameras': sorted(changed)})
print('SPACE_CAMERA_REPAIR_RESULT ' + json.dumps(results))
