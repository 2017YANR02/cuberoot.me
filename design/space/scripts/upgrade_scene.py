"""Add stable web behavior tags to a baseline without replacing edited geometry."""
import json
from pathlib import Path
import bpy

scene = bpy.context.scene
key = scene.get('space_asset')
if not key or scene.get('space_schema') != 1:
    raise RuntimeError('Expected a Space source project')
report = json.loads((Path('E:/CubeRoot-Assets/space/bootstrap') / (key + '.json')).read_text(encoding='utf-8'))
if report['schemaVersion'] != 2:
    raise RuntimeError('Capture schema 2 metadata first')
metadata = {node['id']: node['extras'] for node in report['nodes']}
updated = 0
for obj in scene.objects:
    props = metadata.get(obj.get('spaceId'))
    if props:
        for name, value in props.items():
            obj[name] = value
        updated += 1
for material in bpy.data.materials:
    props = report['materialMetadata'].get(material.get('spaceMaterialId'))
    if props:
        for name, value in props.items():
            material[name] = value
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.overlay.show_relationship_lines = False
            area.spaces.active.overlay.show_extras = False
scene['space_contract'] = 2
# Blender creates a .blend1 backup; never reconstruct the user's geometry here.
bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
print('SPACE_UPGRADE_RESULT ' + json.dumps({'asset': key, 'taggedObjects': updated}))
