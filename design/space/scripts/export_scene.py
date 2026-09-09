"""Run with blender scene.blend --background --threads 14 --python this.py."""
import json
import re
import sys
import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
repository = root.parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from pack_gltf import atomic_write, pack

scene = bpy.context.scene
key = scene.get('space_asset')
if not isinstance(key, str) or not re.fullmatch(r'shanghai|(minimal|modern|cyberpunk|vintage|italian|penthouse|japanese|company)-(original|island|shanghai)', key):
    raise RuntimeError('Unknown Space asset key')
source = Path(bpy.data.filepath).resolve()
if scene.get('space_schema') != 1 or scene.get('space_contract') != 2 or source != (root / 'scenes' / (key + '.blend')).resolve():
    raise RuntimeError('Open the saved contract-v2 Space source in design/space/scenes first')
output = repository / 'core/packages/client/public/assets/space/blender-v1'
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
selected = []
for obj in scene.objects:
    if obj.get('space_export'):
        obj.hide_set(False); obj.select_set(True); selected.append(obj)
if not selected:
    raise RuntimeError('No exportable Space objects')
target = output / (key + '.glb')
temporary = Path('E:/CubeRoot-Assets/space/export') / (key + '.glb')
temporary.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(temporary), export_format='GLB', use_selection=True,
    export_extras=True, export_attributes=True, export_yup=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_gpu_instances=True, export_image_format='AUTO')
summary = {'asset': key, 'source': str(Path(bpy.data.filepath).relative_to(repository)).replace('\\', '/'), 'objects': len(selected), 'blender': bpy.app.version_string, **pack(temporary, target)}
atomic_write(output / (key + '.json'), (json.dumps(summary, indent=2) + '\n').encode('utf-8'))
print('SPACE_EXPORT_RESULT ' + json.dumps(summary))
