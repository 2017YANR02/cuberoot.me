"""Read the Web's room/city cameras and convert Y-up to Blender Z-up."""
import json
import math
from pathlib import Path

from mathutils import Vector

CAMERAS = Path(__file__).resolve().parents[3] / 'core/packages/client/app/[lang]/space/space-room-cameras.json'
CITY_CAMERAS = CAMERAS.with_name('space-shanghai-cameras.json')
NAMES = {'interior': 'Living room', 'study': 'Study', 'bedroom': 'Bedroom', 'bathroom': 'Bathroom',
         'courtyard': 'Courtyard', 'garage': 'Garage', 'cinema': 'Cinema', 'gym': 'Gym'}


def room_cameras(key):
    if key == 'shanghai':
        return {}
    group = 'company' if key.startswith('company-') else 'villa'
    return {NAMES[name]: tuple((x, -z, y) for x, y, z in pair)
            for name, pair in json.loads(CAMERAS.read_text(encoding='utf-8'))[group].items()}


def aim(camera, position, target):
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def city_camera(scene, name):
    """Use a Web review preset, or retain an existing authored camera by name."""
    import bpy
    if scene.get('space_asset') != 'shanghai':
        raise RuntimeError('Open the Shanghai authoring scene first')
    presets = json.loads(CITY_CAMERAS.read_text(encoding='utf-8'))
    entry = next(((key, value) for key, value in presets.items()
                  if name in (key, value['en'], value['zh'])), None)
    if entry is None:
        camera = scene.objects.get(name)
        if camera is not None and camera.type == 'CAMERA':
            return camera
        raise ValueError('Unknown Shanghai view: ' + name)
    key, preset = entry
    camera_name = 'Web review | ' + preset['en']
    camera = scene.objects.get(camera_name)
    if camera and (camera.type != 'CAMERA' or camera.get('space_review_camera') != key):
        raise RuntimeError('Refusing to replace an authored object: ' + camera_name)
    if camera is None:
        camera = bpy.data.objects.new(camera_name, bpy.data.cameras.new(camera_name))
        preview = next((c for c in scene.collection.children if c.name.startswith('PREVIEW |')), None)
        if preview is None:
            preview = bpy.data.collections.new('PREVIEW | cameras and lighting (not exported)')
            scene.collection.children.link(preview)
        preview.objects.link(camera)
        camera['space_review_camera'] = key
        camera['space_export'] = False
    convert = lambda point: (point[0], -point[2], point[1])
    aim(camera, convert(preset['camera']), convert(preset['target']))
    camera.data.type = 'PERSP'
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.lens = camera.data.sensor_height / (2 * math.tan(math.radians(preset.get('fov', 46)) / 2))
    camera.data.clip_start = preset.get('near', 1)
    camera.data.clip_end = 100000
    return camera
