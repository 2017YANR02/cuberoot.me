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
import bmesh
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'design/space/scenes/shanghai.blend'
BUILDINGS = {'12': 'root/147/6', '13': 'root/147/5', '20': 'root/147/4'}


def uv_hash(layer):
    values = np.empty(len(layer.data) * 2, dtype=np.float32)
    layer.data.foreach_get('uv', values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def geometry_hash(mesh):
    """Check source geometry and shading normals across light-UV edits."""
    mesh.calc_loop_triangles()
    digest = hashlib.sha256()
    for data, prop, width, dtype in (
        (mesh.vertices, 'co', 3, np.float32),
        (mesh.loops, 'vertex_index', 1, np.int32),
        (mesh.polygons, 'loop_total', 1, np.int32),
        (mesh.loop_triangles, 'loops', 3, np.int32),
        (mesh.corner_normals, 'vector', 3, np.float32),
    ):
        values = np.empty(len(data) * width, dtype=dtype)
        data.foreach_get(prop, values)
        digest.update(values.tobytes())
    return digest.hexdigest()


def unwrap_light_uv(receiver, size):
    """Weld only a disposable UV proxy; transfer by original face-corner ID."""
    mesh = receiver.data
    surface_hash = uv_hash(mesh.uv_layers[0])
    original_geometry = geometry_hash(mesh)
    source_attribute = '_probeSourceLoop'
    if source_attribute in mesh.attributes:
        raise RuntimeError('Reserved probe corner attribute already exists')
    light_uv = mesh.uv_layers.new(name='LightUV')
    proxy = bpy.data.objects.new('Disposable light UV proxy', mesh.copy())
    bpy.context.scene.collection.objects.link(proxy)
    proxy.matrix_world = receiver.matrix_world.copy()

    def editable_copy(excluded=()):
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.verts.index_update()
        bm.faces.index_update()
        corner = bm.loops.layers.int.new(source_attribute)
        for face in bm.faces:
            polygon = mesh.polygons[face.index]
            if len(face.loops) != polygon.loop_total:
                raise RuntimeError('Proxy changed polygon corners')
            for loop, index in zip(face.loops, polygon.loop_indices):
                if loop.vert.index != mesh.loops[index].vertex_index:
                    raise RuntimeError('Proxy corner order differs from source')
                loop[corner] = index + 1
        bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.index not in excluded], dist=1e-5)
        return bm, corner

    # glTF imports can have disconnected corners at every face. Smart Project
    # then spends nearly the whole atlas on padding, even with valid 0..1 UVs.
    bm, corner = editable_copy()
    surviving = {loop[corner] - 1 for face in bm.faces for loop in face.loops}
    protected = [p for p in mesh.polygons if any(i not in surviving for i in p.loop_indices)]
    if protected:
        # Coincident/degenerate faces must keep their own corners. A full weld
        # can discard them; retry with their vertices excluded from welding.
        bm.free()
        bm, corner = editable_copy({v for p in protected for v in p.vertices})
    proxy_vertices = len(bm.verts)
    bm.to_mesh(proxy.data)
    bm.free()
    receiver.select_set(False)
    proxy.select_set(True)
    bpy.context.view_layer.objects.active = proxy
    proxy.data.uv_layers.active = proxy.data.uv_layers['LightUV']
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=2 / size,
                             margin_method='FRACTION', area_weight=0., correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Edit mode can rebuild storage and reorder corners; reacquire RNA data and
    # transfer by retained IDs, not by the proxy's current loop ordering.
    ids = np.empty(len(proxy.data.loops), dtype=np.int32)
    proxy.data.attributes[source_attribute].data.foreach_get('value', ids)
    if len(proxy.data.polygons) != len(mesh.polygons) or not np.array_equal(np.sort(ids), np.arange(1, len(mesh.loops) + 1)):
        raise RuntimeError('Proxy lost, duplicated or changed source face corners')
    proxy_uv = np.empty(len(ids) * 2, dtype=np.float32)
    proxy.data.uv_layers['LightUV'].data.foreach_get('uv', proxy_uv)
    values = np.empty_like(proxy_uv).reshape(-1, 2)
    values[ids - 1] = proxy_uv.reshape(-1, 2)
    if not np.isfinite(values).all() or values.min() < -1e-5 or values.max() > 1.00001:
        raise RuntimeError('Light UV coordinates are non-finite or outside the atlas')
    light_uv.data.foreach_set('uv', values.reshape(-1))
    if uv_hash(mesh.uv_layers[0]) != surface_hash:
        raise RuntimeError('Unwrap changed original surface UVs')
    if geometry_hash(mesh) != original_geometry:
        raise RuntimeError('Unwrap changed source geometry, tessellation or shading normals')
    mesh.calc_loop_triangles()
    triangle_loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get('loops', triangle_loops)
    coords = values[triangle_loops.reshape(-1, 3)]
    a, b = coords[:, 1] - coords[:, 0], coords[:, 2] - coords[:, 0]
    areas = np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]) / 2
    surface_areas = np.array([t.area for t in mesh.loop_triangles], dtype=np.float64)
    subpixel = areas * size ** 2 < 1
    metrics = {'method': 'welded proxy with face-corner transfer', 'paddingPixels': 2,
               'sourceGeometryUnchanged': True, 'sourceGeometryHash': original_geometry,
               'sourceGeometryHashVersion': 'positions-corners-triangles-cornerNormals-v2',
               'sourceVertices': len(mesh.vertices), 'proxyVertices': proxy_vertices,
               'protectedFaces': len(protected), 'mappedCorners': len(ids),
               'triangleAreaSum': float(areas.sum()), 'triangles': len(areas),
               'subpixelTriangles': int(subpixel.sum()),
               'subpixelSurfaceFraction': float(surface_areas[subpixel].sum() / surface_areas.sum()),
               'trianglePixelsPercentiles': [float(v) for v in np.percentile(areas * size ** 2, [0, 10, 50, 90, 100])]}
    # This rejects gross padding failures, not subtle overlaps or visual seams.
    if metrics['triangleAreaSum'] < .05:
        raise RuntimeError('Less than 5% atlas triangle area; inspect density before baking')
    proxy.hide_render = True
    proxy.hide_set(True)
    proxy.select_set(False)
    receiver.select_set(True)
    bpy.context.view_layer.objects.active = receiver
    mesh.uv_layers.active = mesh.uv_layers['LightUV']
    return metrics, proxy


def calibrate(output):
    """Measure a unit-radiance diffuse bake and export a distinct second UV set."""
    if bpy.data.filepath:
        raise RuntimeError('Calibration requires --factory-startup without an opened file')
    output.mkdir(parents=True)
    start = time.monotonic()
    scene = bpy.data.scenes.new('Diffuse light calibration')
    bpy.context.window.scene = scene
    bpy.ops.mesh.primitive_plane_add(size=2)
    receiver = bpy.context.object
    receiver.data.uv_layers[0].name = 'SurfaceUV'
    surface_uv = uv_hash(receiver.data.uv_layers[0])
    light_uv = receiver.data.uv_layers.new(name='LightUV')
    # Different UV coordinates make accidental channel duplication detectable.
    for loop in light_uv.data:
        loop.uv.x = 1 - loop.uv.x
    receiver.data.uv_layers.active = light_uv
    material = bpy.data.materials.new('Calibration diffuse 0.5')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (.5, .5, .5, 1)
    surface = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(diffuse.outputs[0], surface.inputs['Surface'])
    receiver.data.materials.append(material)
    image = bpy.data.images.new('Unit-radiance diffuse light', 64, 64, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    target = nodes.new('ShaderNodeTexImage')
    target.image = image
    nodes.active = target
    scene.world = bpy.data.worlds.new('Unit-radiance world')
    scene.world.use_nodes = True
    background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (1, 1, 1, 1)
    background.inputs['Strength'].default_value = 1
    scene.render.engine = 'CYCLES'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 8
    scene.cycles.use_denoising = False
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='LightUV')
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)[:, :3]
    if not np.isfinite(pixels).all() or not np.allclose(pixels, 1., atol=1e-5, rtol=0):
        raise RuntimeError('Unit-radiance diffuse bake differs from 1; inspect before deriving a scale')
    if uv_hash(receiver.data.uv_layers[0]) != surface_uv:
        raise RuntimeError('Calibration changed the surface UVs')
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.color_mode = 'RGB'
    image.save_render(str(output / 'diffuse-light.exr'), scene=scene)
    # A constant image cannot detect a vertical flip. Save asymmetric rows
    # through the same EXR pipeline and check them on the actual exported UV1.
    orientation = bpy.data.images.new('EXR orientation grid', 64, 64, alpha=False, float_buffer=True)
    orientation.colorspace_settings.name = 'Non-Color'
    grid = np.ones((64, 64, 4), dtype=np.float32)
    grid[:32, :32, :3], grid[:32, 32:, :3] = (1, 0, 0), (0, 1, 0)
    grid[32:, :32, :3], grid[32:, 32:, :3] = (0, 0, 1), (1, 1, 0)
    orientation.pixels.foreach_set(grid.reshape(-1))
    orientation.save_render(str(output / 'orientation.exr'), scene=scene)
    receiver.data.uv_layers[0].active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    receiver.select_set(True)
    bpy.context.view_layer.objects.active = receiver
    bpy.ops.export_scene.gltf(filepath=str(output / 'building.glb'), export_format='GLB',
                              use_selection=True, use_active_scene=True, export_texcoords=True, export_extras=False,
                              export_yup=True, export_animations=False, export_lights=False)
    report = {'calibration': True, 'version': bpy.app.version_string, 'size': 64,
              'samples': 8, 'threads': 2, 'worldRadiance': 1, 'diffuseColor': .5,
              'colorPass': False, 'min': float(pixels.min()), 'max': float(pixels.max()),
              'mean': float(pixels.mean()), 'surfaceUvUnchanged': True,
              'uvLayers': [u.name for u in receiver.data.uv_layers],
              'orientationUvQuadrants': {'bottomLeft': [1, 0, 0], 'bottomRight': [0, 1, 0],
                                         'topLeft': [0, 0, 1], 'topRight': [1, 1, 0]},
              'elapsedSeconds': round(time.monotonic() - start, 3),
              'runtimeValidation': 'GLB UV channels and browser lightMap scale must be checked separately'}
    (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print('FACADE_CALIBRATION_RESULT', json.dumps(report), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--building', choices=BUILDINGS, default='12')
    parser.add_argument('--size', type=int, choices=(512, 1024, 2048, 4096), default=1024)
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--label', required=True)
    parser.add_argument('--calibrate', action='store_true', help='Bake a tiny unit-radiance plane without loading the city')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not 1 <= args.samples <= 128:
        parser.error('samples must be between 1 and 128')
    if not args.label or len(args.label) > 64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('label must be 1-64 lowercase ASCII letters, digits, hyphens or underscores')
    output = ROOT / '.tmp/png/space-light-bake' / args.label
    if output.exists():
        raise RuntimeError('Evidence folder already exists; use a new label')
    if args.calibrate:
        calibrate(output)
        return
    source_scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE or source_scene.get('space_asset') != 'shanghai' or source_scene.get('space_contract') != 2:
        raise RuntimeError('Open the saved canonical Shanghai scene, contract 2')
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
    report['lightUv'], uv_proxy = unwrap_light_uv(receiver, args.size)
    # Unlink the temporary proxy before baking/exporting the isolated scene;
    # no source data or file is deleted, and only the receiver casts shadows.
    scene.collection.objects.unlink(uv_proxy)
    print('FACADE_BAKE_UNWRAPPED', json.dumps(report['lightUv']), flush=True)
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
    # A saved Chinese UI scene can give default nodes localized display names.
    background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
    background.inputs['Strength'].default_value = 0.
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
                              use_selection=True, use_active_scene=True, export_texcoords=True, export_extras=False,
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
