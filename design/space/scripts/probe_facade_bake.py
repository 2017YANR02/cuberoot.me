"""Bake one saved Bund building for lighting research, without editing the city.

Outputs live only in .tmp/png/space-light-bake/<label>. This is a prototype,
not a production exporter: object IDs are merged for the isolated bake, and
the light rig is an estimated Blender preview, not calibrated photometry.
See ../references/facade-baking.md for the acceptance boundary.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'design/space/scenes/shanghai.blend'
BUILDINGS = {'12': 'root/147/6', '13': 'root/147/5', '20': 'root/147/4'}


def uv_hash(layer):
    values = np.empty(len(layer.data) * 2, dtype=np.float32)
    layer.data.foreach_get('uv', values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--building', choices=BUILDINGS, default='12')
    parser.add_argument('--size', type=int, choices=(512, 1024, 2048), default=1024)
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--label', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not 1 <= args.samples <= 128:
        parser.error('samples must be between 1 and 128')
    if not args.label or len(args.label) > 64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('label must be 1-64 lowercase ASCII letters, digits, hyphens or underscores')
    source_scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE or source_scene.get('space_asset') != 'shanghai' or source_scene.get('space_contract') != 2:
        raise RuntimeError('Open the saved canonical Shanghai scene, contract 2')
    output = ROOT / '.tmp/png/space-light-bake' / args.label
    if output.exists():
        raise RuntimeError('Evidence folder already exists; use a new label')
    root = next((o for o in source_scene.objects if o.get('spaceId') == BUILDINGS[args.building]), None)
    if root is None or not root.get('spaceFacadeRig'):
        raise RuntimeError('Building must have its authored native facade rig')
    meshes = [o for o in root.children_recursive if o.type == 'MESH' and o.get('space_export') and not o.hide_render]
    lights = sorted((o for o in root.children if 'spaceFacadeSlot' in o), key=lambda o: o['spaceFacadeSlot'])
    if not meshes or [o['spaceFacadeSlot'] for o in lights] != list(range(6)):
        raise RuntimeError('Missing building meshes or complete six-lamp rig')
    if any(o.type != 'LIGHT' or o.data.type != 'SPOT' or not math.isfinite(o.data.energy) or o.data.energy <= 0 for o in lights):
        raise RuntimeError('Bake lights must be positive-power native spotlights')
    if any(o.modifiers or len(o.data.uv_layers) > 1 or not o.data.materials or any(m is None or not m.use_nodes for m in o.data.materials) for o in meshes):
        raise RuntimeError('Prototype requires unmodified meshes with zero/one UV layer and node materials; inspect author edits first')
    stamp = (SOURCE.stat().st_size, SOURCE.stat().st_mtime_ns)
    output.mkdir(parents=True)
    start = time.monotonic()
    report = {'prototype': True, 'building': args.building, 'source': str(SOURCE),
              'sourceStamp': stamp, 'rigRevision': root['spaceFacadeRig'],
              'sourceMeshes': len(meshes), 'sourceFaces': sum(len(o.data.polygons) for o in meshes),
              'size': args.size, 'samples': args.samples, 'threads': 14,
              'lightWatts': [o.data.energy for o in lights],
              'limitations': ['Estimated light rig, not measured photometry',
                              'Only this building occludes light; neighbours omitted',
                              'Diffuse bake does not replace view-dependent specular reflections',
                              'UV atlas, radiometric scaling and runtime integration not yet accepted']}
    (output / 'started.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    # Separate scene and data copies: no source mesh, UV or material is mutated.
    scene = bpy.data.scenes.new('Facade bake probe ' + args.building)
    bpy.context.window.scene = scene
    offset = root.matrix_world.translation.copy()
    materials = {}
    receivers = []
    for original in meshes:
        obj = bpy.data.objects.new(original.name, original.data.copy())
        scene.collection.objects.link(obj)
        obj.matrix_world = original.matrix_world.copy()
        obj.location -= offset
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name='SurfaceUV')
        obj.data.uv_layers[0].name = 'SurfaceUV'
        for i, material in enumerate(original.data.materials):
            if material not in materials:
                copy = material.copy()
                materials[material] = copy
                uv = copy.node_tree.nodes.new('ShaderNodeUVMap')
                uv.uv_map = 'SurfaceUV'
                # Explicitly preserve the original texture coordinates when the
                # bake layer becomes active; never silently retarget base color.
                for node in copy.node_tree.nodes:
                    if node.type == 'UVMAP':
                        node.uv_map = 'SurfaceUV'
                    if node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
                        copy.node_tree.links.new(uv.outputs['UV'], node.inputs['Vector'])
            obj.data.materials[i] = materials[material]
        receivers.append(obj)
    for original in lights:
        obj = bpy.data.objects.new(original.name, original.data.copy())
        scene.collection.objects.link(obj)
        obj.matrix_world = original.matrix_world.copy()
        obj.location -= offset
    bpy.ops.object.select_all(action='DESELECT')
    for obj in receivers:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = receivers[0]
    bpy.ops.object.join()
    receiver = bpy.context.object
    receiver.name = 'Bund ' + args.building + ' bake probe'
    if len(receiver.data.polygons) != report['sourceFaces']:
        raise RuntimeError('Joining changed the face count')
    before_uv = uv_hash(receiver.data.uv_layers[0])
    light_uv = receiver.data.uv_layers.new(name='LightUV')
    receiver.data.uv_layers.active = light_uv
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008, area_weight=0., correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    if uv_hash(receiver.data.uv_layers[0]) != before_uv:
        raise RuntimeError('Unwrap changed original surface UVs')
    uv_values = np.empty(len(light_uv.data) * 2, dtype=np.float32)
    light_uv.data.foreach_get('uv', uv_values)
    if not np.all(np.isfinite(uv_values)) or uv_values.min() < -1e-5 or uv_values.max() > 1.00001:
        raise RuntimeError('Light UV coordinates are non-finite or outside the atlas')
    print('FACADE_BAKE_UNWRAPPED', len(receiver.data.polygons), flush=True)
    image = bpy.data.images.new('Bund ' + args.building + ' diffuse light', args.size, args.size, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in receiver.data.materials:
        for node in material.node_tree.nodes:
            node.select = False
        target = material.node_tree.nodes.new('ShaderNodeTexImage')
        target.name = 'Diffuse light bake target'
        target.image = image
        target.select = True
        material.node_tree.nodes.active = target
    scene.world = bpy.data.worlds.new('Black world for facade bake')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.
    scene.render.engine = 'CYCLES'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 14
    scene.cycles.device = 'CPU'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.render.bake.use_pass_color = False
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.margin = 8
    scene.render.bake.use_clear = True
    print('FACADE_BAKE_START', args.size, args.samples, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='LightUV')
    pixels = np.empty(args.size * args.size * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb = pixels.reshape(-1, 4)[:, :3]
    if not np.all(np.isfinite(rgb)) or float(rgb.max()) <= 0:
        raise RuntimeError('Bake is empty or non-finite; do not publish it')
    report['bakePixelValues'] = {'min': float(rgb.min()), 'max': float(rgb.max()),
                          'positivePixels': int(np.count_nonzero(rgb.max(axis=1) > 1e-7)),
                          'percentiles': [float(v) for v in np.percentile(rgb.max(axis=1), [50, 90, 99, 99.9])]}
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.exr_codec = 'ZIP'
    image.save_render(str(output / 'diffuse-light.exr'), scene=scene)
    image.pack()
    # The unused bake target is deliberately not connected as albedo or AO.
    # Export both UV sets and restore base texture coordinates for glTF.
    receiver.data.uv_layers[0].active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    receiver.select_set(True)
    bpy.context.view_layer.objects.active = receiver
    bpy.ops.export_scene.gltf(filepath=str(output / 'building.glb'), export_format='GLB',
                              use_selection=True, export_texcoords=True, export_extras=False,
                              export_yup=True, export_animations=False, export_lights=False)
    # Store only the probe scene plus its dependent data, never the whole city.
    bpy.data.libraries.write(str(output / 'probe.blend'), {scene}, fake_user=True, compress=True)
    if (SOURCE.stat().st_size, SOURCE.stat().st_mtime_ns) != stamp:
        raise RuntimeError('Canonical city changed while probing; results refer to the earlier source stamp')
    report['sourceUnchanged'] = True
    report['surfaceUvUnchanged'] = True
    report['uvLayers'] = [u.name for u in receiver.data.uv_layers]
    report['elapsedSeconds'] = round(time.monotonic() - start, 2)
    report['files'] = {p.name: p.stat().st_size for p in output.iterdir() if p.is_file()}
    (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print('FACADE_BAKE_RESULT', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
