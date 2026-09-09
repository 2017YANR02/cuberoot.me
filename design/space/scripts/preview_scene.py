"""Render the saved authoring scene without opening a window or saving the blend."""
import argparse
import json
import re
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--camera', default='Overview')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
scene = bpy.context.scene
key = scene.get('space_asset')
if not isinstance(key, str) or not re.fullmatch(r'shanghai|(minimal|modern|cyberpunk|vintage|italian|penthouse|japanese|company)-(original|island|shanghai)', key):
    parser.error('Open a Space source scene first')
camera = scene.objects.get(args.camera)
if camera is None or camera.type != 'CAMERA':
    parser.error('Unknown camera. Available: ' + ', '.join(o.name for o in scene.objects if o.type == 'CAMERA'))

repository = Path(__file__).resolve().parents[3]
output = repository / '.tmp/png/space-blender'
output.mkdir(parents=True, exist_ok=True)
target = output / (key + '-' + re.sub(r'[^a-z0-9]+', '-', args.camera.lower()).strip('-') + '-preview.png')
scene.camera = camera
# The web runtime's RectAreaLights travel as metadata, not glTF light objects.
# Recreate them for this unsaved preview. The power conversion is an exposure
# approximation, not measured fixture photometry or a web-render equivalence.
for obj in list(scene.objects):
    for index, entry in enumerate(obj.get('spaceLights', [])):
        data = bpy.data.lights.new(f'Preview area {index}', 'AREA')
        data.shape = 'RECTANGLE'
        data.size = entry['width']
        data.size_y = entry['height']
        data.color = entry['color']
        data.energy = entry['intensity'] * entry['width'] * entry['height'] * 20
        light = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(light)
        x, y, z = entry['position']
        light.location = (x, -z, y)
        x, y, z, w = entry['quaternion']
        light.rotation_mode = 'QUATERNION'
        light.rotation_quaternion = Quaternion(Vector((1, 0, 0)), 1.5707963267948966) @ Quaternion((w, x, y, z))
scene.render.engine = 'CYCLES'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 14
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 750
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(target)
bpy.ops.render.render(write_still=True)
print('SPACE_PREVIEW_RESULT ' + json.dumps({'asset': key, 'camera': camera.name, 'image': target.relative_to(repository).as_posix()}))
