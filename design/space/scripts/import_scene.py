"""Blender background import. Never overwrites an existing authored .blend."""
import argparse
import json
import math
import re
import sys
from pathlib import Path

import bpy
sys.path.insert(0, str(Path(__file__).parent))
from preview_cameras import aim, room_cameras

parser = argparse.ArgumentParser()
parser.add_argument('--key', required=True)
parser.add_argument('--cache', default='E:/CubeRoot-Assets/space/bootstrap')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not re.fullmatch(r'shanghai|(minimal|modern|cyberpunk|vintage|italian|penthouse|japanese|company)-(original|island|shanghai)', args.key):
    parser.error('Unknown Space asset key')
root = Path(__file__).resolve().parents[1]
target = root / 'scenes' / (args.key + '.blend')
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    raise RuntimeError(f'Authored source already exists; refusing overwrite: {target}')
source = Path(args.cache) / (args.key + '.glb')
report = json.loads(source.with_suffix('.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.threads_mode = 'FIXED'
bpy.context.scene.render.threads = 14
bpy.ops.import_scene.gltf(filepath=str(source), import_pack_images=True)
scene = bpy.context.scene
scene.name = args.key
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene['space_schema'] = 1
scene['space_contract'] = report['schemaVersion']
scene['space_asset'] = args.key
scene['space_source_report'] = json.dumps({k: v for k, v in report.items() if k != 'nodes'}, ensure_ascii=False)
scene['space_note'] = 'Imported baseline, not a claim of surveyed 1:1 accuracy. Dynamic water, weather and interactions remain in Three.js.'
collection = bpy.data.collections.new('AUTHORING | ' + args.key)
scene.collection.children.link(collection)
for obj in list(scene.objects):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    obj['space_export'] = True
    if obj.type == 'MESH':
        obj.data.name = obj.name + ' geometry'
        # Keep custom glTF attributes for the web lighting shaders.
        for attribute in obj.data.attributes:
            if attribute.name.lower() in ('_buildingdata', '_bundbuildingid', '_bundlighttop'):
                attribute.name = attribute.name.upper()

preview = bpy.data.collections.new('PREVIEW | cameras and lighting (not exported)')
scene.collection.children.link(preview)
def preview_object(name, data):
    obj = bpy.data.objects.new(name, data); preview.objects.link(obj); return obj

def camera(name, position, target_point, lens=38):
    obj = preview_object(name, bpy.data.cameras.new(name))
    aim(obj, position, target_point)
    obj.data.lens = lens; obj.data.clip_end = 100000; return obj

city = args.key == 'shanghai'
scene.camera = camera('Overview', (3200, 1800, 950) if city else (48, -55, 36), (0, 0, 0) if city else (-6, 2, 3))
for name, (position, target_point) in room_cameras(args.key).items():
    camera(name, position, target_point, 22)
sun = preview_object('Preview sun', bpy.data.lights.new('Preview sun', 'SUN'))
sun.data.energy = 2; sun.data.angle = math.radians(12)
sun.rotation_euler = (math.radians(25), math.radians(-20), math.radians(-35))
world = bpy.data.worlds.new('Preview daylight')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32, .42, .55, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
scene.world = world
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1600; scene.render.resolution_y = 1000; scene.render.resolution_percentage = 100
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.clip_end = 100000
            area.spaces.active.region_3d.view_distance = 4500 if city else 95
            area.spaces.active.region_3d.view_location = (0, 0, 150) if city else (-6, 0, 3)
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.overlay.show_extras = False
            area.spaces.active.overlay.show_relationship_lines = False
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
summary = {'asset': args.key, 'blend': str(target), 'bytes': target.stat().st_size, 'objects': len(collection.objects), 'meshes': sum(o.type == 'MESH' for o in collection.objects), 'materials': len(bpy.data.materials), 'images': len(bpy.data.images), 'packedImages': sum(bool(i.packed_file) for i in bpy.data.images), 'source': report['meshes']}
(root / 'scenes' / (args.key + '.import.json')).write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
print('SPACE_IMPORT_RESULT ' + json.dumps(summary))
