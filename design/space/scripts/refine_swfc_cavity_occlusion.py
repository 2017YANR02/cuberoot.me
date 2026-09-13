"""Bake the existing SWFC soffit's ambient visibility, without changing albedo.

Cycles AO describes this approximate model, not measured site illumination.
The standard glTF occlusion texture uses a second UV layer. Review the candidate
before --apply; applying reuses its exact pixels and UVs, never a fresh bake.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import refine_swfc_floor_finish as floor
from probe_facade_bake import geometry_hash, uv_hash, unwrap_light_uv
from io_scene_gltf2.blender.com.material_helpers import create_settings_group, get_gltf_node_name

top, hall = floor.top, floor.hall
REVISION = 'swfc-cavity-occlusion-20260913'
PROPERTY = 'spaceSwfcCavityOcclusionRevision'
TARGET_ID = top.EXTRA_IDS['soffit_panels']
OUTPUT = top.ROOT/'.tmp/png/space-swfc-underfloor-20260913'
SIZE, DISTANCE, SAMPLES = 1024, 12., 32


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bake(root, original, directory):
    """Isolated copies reuse the existing UV-proxy and Blender Cycles baker."""
    source = bpy.context.scene
    scene = bpy.data.scenes.new('Temporary SWFC cavity bake')
    bpy.context.window.scene = scene
    excluded = {hall.NEW_IDS['floor-glass'], hall.NEW_IDS['window-glass'], top.EXTRA_IDS['top_glass']}
    for obj in root.children_recursive:
        if obj.type != 'MESH' or not obj.get('space_export') or obj.get('spaceId') in excluded:
            continue
        copy = bpy.data.objects.new(obj.name, obj.data.copy() if obj == original else obj.data)
        scene.collection.objects.link(copy)
        copy.matrix_world = obj.matrix_world.copy()
        copy.location -= root.matrix_world.translation
        if obj == original:
            receiver = copy
    bpy.context.view_layer.objects.active = receiver
    receiver.select_set(True)
    metrics, proxy = unwrap_light_uv(receiver, SIZE)
    scene.collection.objects.unlink(proxy)
    bpy.context.view_layer.objects.active = receiver
    image = bpy.data.images.new(REVISION+'/ambient-visibility', SIZE, SIZE, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    # Unused atlas pixels are unoccluded. A black clear would darken distant
    # exterior faces when mipmaps average their UV islands with the padding.
    image.pixels.foreach_set(np.ones(SIZE*SIZE*4, dtype=np.float32))
    image.update()
    material = bpy.data.materials.new('Temporary SWFC AO bake shader')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    ao = nodes.new('ShaderNodeAmbientOcclusion')
    ao.inputs['Distance'].default_value = DISTANCE
    ao.samples = SAMPLES
    emission = nodes.new('ShaderNodeEmission')
    links.new(ao.outputs['AO'], emission.inputs['Color'])
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    target = nodes.new('ShaderNodeTexImage')
    target.image = image
    nodes.active = target
    receiver.data.materials.clear()
    receiver.data.materials.append(material)
    scene.render.engine = 'CYCLES'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 14
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
    scene.render.bake.margin = 2
    scene.render.bake.use_clear = False
    scene.render.bake.use_selected_to_active = False
    print('CAVITY_BAKE_START', flush=True)
    bpy.ops.object.bake(type='EMIT', uv_layer='LightUV')
    pixels = np.empty(SIZE*SIZE*4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(SIZE, SIZE, 4)
    if not np.isfinite(pixels).all() or pixels.min() < 0 or pixels.max() > 1:
        raise RuntimeError('Invalid ambient visibility pixels')
    faces = {}
    for side in ('top', 'bottom'):
        values = []
        for face in receiver.data.polygons:
            if (face.normal.z > .99 if side == 'top' else face.normal.z < -.99):
                uv = np.mean([receiver.data.uv_layers['LightUV'].data[i].uv[:] for i in face.loop_indices], axis=0)
                x, y = np.clip((uv*SIZE).astype(int), 0, SIZE-1)
                values.append(float(pixels[y, x, 0]))
        faces[side] = {'count':len(values), 'centroidPercentiles':np.percentile(values, [0,10,50,90,100]).tolist()}
    if faces['top']['centroidPercentiles'][2] >= faces['bottom']['centroidPercentiles'][2]:
        raise RuntimeError('Enclosed side is no darker than exterior; inspect occluders and normals')
    image.filepath_raw = str(directory/'occlusion.png')
    image.file_format = 'PNG'
    image.save()
    values = np.empty(len(receiver.data.loops)*2, dtype=np.float32)
    receiver.data.uv_layers['LightUV'].data.foreach_get('uv', values)
    report = {'uv':metrics, 'faces':faces, 'excludedTransparent':sorted(excluded),
              'distanceMetres':DISTANCE, 'samples':SAMPLES, 'size':SIZE, 'atlasBackground':1,
              'geometryHash':geometry_hash(original.data), 'surfaceUVHash':uv_hash(original.data.uv_layers[0]),
              'lightUV':values.tolist()}
    (directory/'bake.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    bpy.context.window.scene = source
    # Only the disposable bake scene is removed; no authored object is edited.
    bpy.data.scenes.remove(scene)
    return report


def attach(obj, directory, report):
    if geometry_hash(obj.data) != report['geometryHash'] or uv_hash(obj.data.uv_layers[0]) != report['surfaceUVHash']:
        raise RuntimeError('Bake receiver geometry or original UV changed')
    if len(obj.data.uv_layers) != 1 or len(obj.data.materials) != 1:
        raise RuntimeError('Expected one unmodified soffit material and surface UV')
    old = obj.data
    old.use_fake_user = True
    obj.data = old.copy()
    uv = obj.data.uv_layers.new(name='CavityAO')
    values = np.asarray(report['lightUV'], dtype=np.float32)
    if len(values) != len(obj.data.loops)*2 or not np.isfinite(values).all() or values.min() < 0 or values.max() > 1:
        raise RuntimeError('Invalid candidate UVs')
    uv.data.foreach_set('uv', values)
    obj.data.uv_layers.active_index = 0
    obj.data.uv_layers[0].active_render = True
    material = old.materials[0].copy()
    material.name = REVISION+'/soffit'
    material[PROPERTY] = REVISION
    material['spaceOcclusionEstimate'] = 'Cycles ambient visibility of approximate authored geometry; 12 m radius; transparent floor and windows excluded'
    obj.data.materials[0] = material
    nodes, links = material.node_tree.nodes, material.node_tree.links
    image = bpy.data.images.load(str(directory/'occlusion.png'), check_existing=False)
    image.name = REVISION+'/ambient-visibility'
    image.colorspace_settings.name = 'Non-Color'
    image.pack()
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.interpolation = 'Linear'
    coordinate = nodes.new('ShaderNodeUVMap')
    coordinate.uv_map = 'CavityAO'
    links.new(coordinate.outputs['UV'], texture.inputs['Vector'])
    group = nodes.new('ShaderNodeGroup')
    group.node_tree = create_settings_group(get_gltf_node_name())
    links.new(texture.outputs['Color'], group.inputs['Occlusion'])
    if geometry_hash(obj.data) != report['geometryHash'] or uv_hash(obj.data.uv_layers[0]) != report['surfaceUVHash']:
        raise RuntimeError('Attaching AO changed geometry or surface UV')


def check_export(document, target_material):
    material = next(m for m in document['materials'] if m['name'] == target_material.name)
    occlusion = material['occlusionTexture']
    if occlusion.get('texCoord', 0) != 1 or occlusion.get('strength', 1) != 1:
        raise RuntimeError('Occlusion must use the complete independent second UV layer')
    if 'baseColorTexture' in material['pbrMetallicRoughness'] or material.get('emissiveFactor', [0,0,0]) != [0,0,0]:
        raise RuntimeError('AO must not become albedo or emission')
    index = document['materials'].index(material)
    primitives = [p for mesh in document['meshes'] for p in mesh['primitives'] if p.get('material') == index]
    if not primitives or any('TEXCOORD_1' not in p['attributes'] for p in primitives):
        raise RuntimeError('Export lost the occlusion UVs')
    return {'texCoord':1, 'strength':1, 'material':material['name'], 'primitives':len(primitives),
            'baseColorFactor':material['pbrMetallicRoughness']['baseColorFactor']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or len(args.label)>64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a short lowercase filename label')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != floor.SOURCE.resolve() or scene.get(floor.PROPERTY) != floor.REVISION or scene.get(PROPERTY):
        raise RuntimeError('Expected saved floor-finish source without this one-time AO revision')
    token = floor.source_fingerprint()
    hashes = {str(p.relative_to(top.ROOT)):sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT/args.label
    candidate = json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate:
        if candidate['sourceBefore'] != list(token) or candidate['scriptHashes'] != hashes or any(
                sha(directory/name) != value for name,value in candidate['files'].items()):
            raise RuntimeError('Source, scripts or reviewed candidate changed')
    else:
        directory.mkdir(parents=True, exist_ok=False)
    original = list(scene.objects)
    root = next(o for o in original if o.get('spaceId') == top.ROOT_ID)
    obj = next(o for o in root.children if o.get('spaceId') == TARGET_ID)
    geometry, rigs, ids = floor.geometry_digest(original), floor.export_snapshot(scene), top.runtime_id_snapshot(scene)
    assignments = {o:tuple(o.data.materials) for o in original if o.type == 'MESH' and o != obj}
    albedo = tuple(next(n for n in obj.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value)
    detail = json.loads((directory/'bake.json').read_text()) if args.apply else bake(root,obj,directory)
    attach(obj,directory,detail)
    if (floor.geometry_digest(original) != geometry or floor.export_snapshot(scene) != rigs or
            top.runtime_id_snapshot(scene) != ids or any(tuple(o.data.materials) != mats for o,mats in assignments.items())):
        raise RuntimeError('Authored geometry, identities, other materials or light rigs changed')
    if tuple(next(n for n in obj.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value) != albedo:
        raise RuntimeError('Source albedo changed')
    report = {'revision':REVISION, 'saved':False, 'sourceBefore':list(token), 'scriptHashes':hashes,
              'checks':floor.ends.validate(root), 'preservedGeometry':geometry, 'preservedRigs':list(rigs),
              'detail':{k:v for k,v in detail.items() if k != 'lightUV'}}
    floor.assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k] != v for k,v in report.items()):
            raise RuntimeError('Rebuilt candidate differs from reviewed result')
        backup = directory/'shanghai-before-cavity-ao.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite backup')
        shutil.copy2(floor.SOURCE,backup)
        floor.assert_source_unchanged(token)
        scene[PROPERTY] = root[PROPERTY] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(floor.SOURCE),compress=True)
        report.update(saved=True, sourceAfter=list(floor.source_fingerprint()))
    else:
        root['facadeLighting'] = rigs[top.ROOT_ID]
        bpy.ops.object.select_all(action='DESELECT')
        targets = [root]+[o for o in root.children_recursive if o.get('space_export')]
        expected = top.export_geometry_snapshot(root,targets)
        for target in targets:
            target.hide_set(False)
            target.select_set(True)
        path = directory/'hall.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False,export_gpu_instances=True)
        raw = path.read_bytes()
        size,kind = struct.unpack_from('<II',raw,12)
        if kind != 0x4E4F534A:
            raise RuntimeError('Missing GLB JSON')
        document = json.loads(raw[20:20+size])
        report['exportGeometry'] = top.validate_export_geometry(document,raw,expected)
        report['occlusionExport'] = check_export(document,obj.data.materials[0])
        report['files'] = {name:sha(directory/name) for name in ('hall.glb','bake.json','occlusion.png')}
    floor.atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),(json.dumps(report,indent=2)+'\n').encode())
    print('CAVITY_RESULT '+json.dumps({k:report[k] for k in ('saved','detail','checks')}),flush=True)


if __name__ == '__main__':
    main()
