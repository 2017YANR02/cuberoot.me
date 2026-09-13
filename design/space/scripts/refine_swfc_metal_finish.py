"""Photo-guided, estimated metal waviness for SWFC 100F; candidate before apply.

See references/swfc-top.md. The normal map is original procedural artwork, not
a photograph or a measured surface scan. Floor glass and floor tiling stay flat.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import refine_swfc_hall_lighting as lighting
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

hall, top = lighting.hall, lighting.top
REVISION = 'swfc-metal-finish-20260913'
PROPERTY = 'spaceSwfcMetalFinishRevision'
OUTPUT = top.ROOT/'.tmp/png/space-swfc-metal-20260913'


def normal_image(directory):
    size = 1024
    y, x = np.mgrid[0:size, 0:size]/(size-1)
    tile_x, tile_y = np.minimum((x*4).astype(int), 3), np.minimum((y*4).astype(int), 3)
    x, y = x*4-tile_x, y*4-tile_y
    phase = tile_x*1.37+tile_y*2.19
    # Smooth, irregular broad forming marks with restrained finer ripples.
    # A flat border keeps separate panels from bending their joints.
    envelope = np.sin(np.pi*x)**2*np.sin(np.pi*y)**2
    height = envelope*(np.sin(2*np.pi*((2.8+.17*tile_x)*x+1.3*y)+phase) +
                       .42*np.sin(2*np.pi*(.6*x+(4.4+.21*tile_y)*y)+.7-phase) +
                       .12*np.sin(2*np.pi*(9*x-2*y)+1.3+phase))
    dy, dx = np.gradient(height, 1/(size-1))
    slope = max(float(np.max(np.abs(dx))), float(np.max(np.abs(dy))))
    normals = np.stack((-dx/slope*.65, -dy/slope*.65, np.ones_like(x)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    # Every atlas tile has a neutral margin, including collapsed floor UVs.
    border = (x < .02) | (x > .98) | (y < .02) | (y > .98)
    normals[border] = (0, 0, 1)
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = normals*.5+.5
    image = bpy.data.images.new('SWFC polished metal normal (estimated)', size, size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.file_format = 'PNG'
    image.filepath_raw = str(directory/'metal-normal.png')
    image.save()
    image.pack()
    return image


def author(root, image, strength):
    counts = {}
    for role, factor, roughness in [('interior-mirror', 1., .09), ('interior-frame', .6, .14)]:
        obj = next(o for o in root.children if o.get('spaceId') == hall.NEW_IDS[role])
        # Edit only these surfaces, their UVs and material assignments. Retain
        # original mesh datablocks for recovery inside the authoring file.
        original = obj.data
        original.use_fake_user = True
        obj.data = original.copy()
        uv = obj.data.uv_layers.active
        if role == 'interior-mirror':
            # The first hall used 50 mm open seams. Photographs show narrow
            # joints: use an explicitly estimated 6 mm, keeping each closed
            # sheet and the existing central lamp channel intact.
            for vertex in obj.data.vertices:
                u, v, z = hall.diagonal(vertex.co)
                grid = round((u+25)/2.5)*2.5-25
                if z > 476.8 and abs(abs(u-grid)-.025) < .0001:
                    vertex.co = top.xyz((grid+math.copysign(.003, u-grid), v, z), hall.ANGLE)
            obj.data.update()
        textured = 0
        for polygon in obj.data.polygons:
            points = [hall.diagonal(obj.data.vertices[obj.data.loops[i].vertex_index].co) for i in polygon.loop_indices]
            active = role == 'interior-frame' or min(p[2] for p in points) > 476.8
            spans = [max(p[k] for p in points)-min(p[k] for p in points) for k in range(3)]
            axes = sorted(range(3), key=lambda k: spans[k], reverse=True)[:2]
            minimum = [min(p[k] for p in points) for k in axes]
            active = active and min(spans[k] for k in axes) > .03
            centre_u = sum(p[0] for p in points)/len(points)
            centre_v = sum(p[1] for p in points)/len(points)
            tile = (round((centre_u+25)/2.5)*7 + (3 if centre_v > 0 else 0) + (5 if role == 'interior-frame' else 0)) % 16
            for loop, point in zip(polygon.loop_indices, points, strict=True):
                uv.data[loop].uv = tuple(((tile % 4 if j == 0 else tile//4)+.04+.92*(point[k]-minimum[j])/spans[k])/4
                                        for j, k in enumerate(axes)) if active else (.001, .001)
            textured += int(active)
        material = obj.data.materials[0].copy()
        material.name = 'SWFC formed polished metal '+role
        material['spaceMaterialId'] = REVISION+'/'+role
        material[PROPERTY] = REVISION
        material['spaceSurfaceEstimate'] = 'Photo-guided normal waviness, not surveyed sheet deformation'
        material.roughness = roughness
        nodes, links = material.node_tree.nodes, material.node_tree.links
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Roughness'].default_value = roughness
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        normal = nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = strength*factor
        links.new(texture.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
        obj.data.materials[0] = material
        counts[role] = {'texturedFaces': textured, 'normalStrength': strength*factor, 'roughness': roughness}
    counts['estimatedCeilingJointMetres'] = .006
    counts['normalAtlasVariants'] = 16
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--strength', type=float, default=.065)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a lowercase filename label')
    if not math.isfinite(args.strength) or not .001 <= args.strength <= .15:
        parser.error('Normal strength must be finite within .001.. .15')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE.resolve() or scene.get(lighting.PROPERTY) != lighting.REVISION or scene.get(PROPERTY):
        raise RuntimeError('Expected canonical hall lighting revision without this one-time finish')
    token = source_fingerprint()
    hashes = {str(p.relative_to(top.ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT/args.label
    if directory.exists() and not args.apply:
        raise RuntimeError('Use a new candidate label')
    candidate = json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate and (candidate['sourceBefore'] != list(token) or candidate['scriptHashes'] != hashes or
                      hashlib.sha256((directory/'hall.glb').read_bytes()).hexdigest() != candidate['glbSha256']):
        raise RuntimeError('Source, scripts or reviewed candidate changed')
    directory.mkdir(parents=True, exist_ok=True)
    objects = list(scene.objects)
    root = next(o for o in objects if o.get('spaceId') == top.ROOT_ID)
    unchanged = [o for o in objects if o.get('spaceId') != hall.NEW_IDS['interior-mirror']]
    digest, rigs, ids = geometry_digest(unchanged), export_snapshot(scene), top.runtime_id_snapshot(scene)
    other = {o: (o.data, tuple(o.data.materials)) for o in objects if o.type == 'MESH' and o.get('spaceId') not in
             (hall.NEW_IDS['interior-mirror'], hall.NEW_IDS['interior-frame'])}
    image = normal_image(directory)
    detail = author(root, image, args.strength)
    if geometry_digest(unchanged) != digest or export_snapshot(scene) != rigs or top.runtime_id_snapshot(scene) != ids:
        raise RuntimeError('Unrelated geometry, transforms, rigs or identities changed')
    if any(o.data != data or tuple(o.data.materials) != mats for o, (data, mats) in other.items()):
        raise RuntimeError('Unrelated material or mesh datablock changed')
    checks = hall.validate(root)
    report = {'revision': REVISION, 'saved': False, 'sourceBefore': list(token), 'scriptHashes': hashes,
              'detail': detail, 'checks': checks, 'preservedGeometry': digest, 'preservedRigs': list(rigs),
              'textureSha256': hashlib.sha256((directory/'metal-normal.png').read_bytes()).hexdigest()}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k] != v for k, v in report.items()):
            raise RuntimeError('Rebuilt candidate differs from reviewed result')
        backup = directory/'shanghai-before-metal-finish.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite backup')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene[PROPERTY] = root[PROPERTY] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    else:
        root['facadeLighting'] = rigs[top.ROOT_ID]
        bpy.ops.object.select_all(action='DESELECT')
        targets = [root]+[o for o in root.children_recursive if o.get('space_export')]
        expected = top.export_geometry_snapshot(root, targets)
        for obj in targets:
            obj.hide_set(False)
            obj.select_set(True)
        path = directory/'hall.glb'
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
            export_extras=True, export_attributes=True, export_yup=True, export_animations=False,
            export_cameras=False, export_lights=False, export_gpu_instances=True)
        raw = path.read_bytes()
        size, kind = struct.unpack_from('<II', raw, 12)
        if kind != 0x4E4F534A:
            raise RuntimeError('Missing GLB JSON')
        report['exportGeometry'] = top.validate_export_geometry(json.loads(raw[20:20+size]), raw, expected)
        report.update(glbBytes=len(raw), glbSha256=hashlib.sha256(raw).hexdigest())
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'), (json.dumps(report, indent=2)+'\n').encode())
    print('METAL_FINISH_RESULT '+json.dumps({k: report[k] for k in ('saved', 'detail', 'checks')}), flush=True)


if __name__ == '__main__':
    main()
