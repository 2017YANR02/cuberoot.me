"""Reviewed incremental leaf cards and metric hardscape materials.

Run canonical shanghai.blend with --round 1/2 for temporary candidate GLBs;
only --round 2 --apply saves, after its matching candidate has been inspected.
Sources, texture preparation and reproduction: ../references/alibaba-xuhui.md.
Plant species and material microstructure are proxies, not campus scans.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from refine_alibaba_districts import geometry_digest
from refine_alibaba_glazing import replace_mesh
from refine_bund_entrances import box
from refine_jin_mao import Mesh
from refine_peace_crown import ROOT, SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot

REVISION = 'alibaba-landscape-20260912'
OUTPUT = ROOT / '.tmp/png/space-alibaba-leaf-20260912'
PREFIX = 'authored/alibaba-xuhui-'
MAPS = {
    'leaves_diff': '2c667193084725e8553062ddbdc73c7d',
    'leaves_alpha': '63199ba87a9e8928424bd8c3b8017bd0',
    'leaves_normal': 'e81c5d7e7fc09af321e8c5ac5b4948f2',
    'branch_diff': '2da9ea379228636c4fda2fde9a11d760',
    'concrete_rough': '1828b2884b6dc899704410f74b35b2be',
    'concrete_nor_gl': 'fe71a8ff06acc83aadfdd694a42acfd6',
}


def image_node(mat, name, color=False):
    path = OUTPUT / (name + '.png')
    if name in MAPS and hashlib.md5(path.read_bytes()).hexdigest() != MAPS[name]:
        raise RuntimeError('Reference checksum mismatch: ' + name)
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    image.pack()  # A saved source must not depend on the temporary download folder.
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    return tex


def normal_map(mat, name, strength):
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = strength
    tex = image_node(mat, name)
    mat.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
    mat.node_tree.links.new(normal.outputs['Normal'], node.inputs['Normal'])


def leaves_material(mat):
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    color = image_node(mat, 'leaves_diff', True)
    alpha = image_node(mat, 'leaves_alpha')
    cutoff = mat.node_tree.nodes.new('ShaderNodeMath')
    cutoff.operation = 'GREATER_THAN'
    cutoff.inputs[1].default_value = .45
    links = mat.node_tree.links
    links.new(color.outputs['Color'], node.inputs['Base Color'])
    node.inputs['Base Color'].default_value = (1, 1, 1, 1)
    links.new(alpha.outputs['Color'], cutoff.inputs[0])
    links.new(cutoff.outputs[0], node.inputs['Alpha'])
    normal_map(mat, 'leaves_normal', .32)
    node.inputs['Roughness'].default_value = .78
    mat.use_backface_culling = False
    mat['spaceSurfaceProvenance'] = 'Poly Haven tree_small_02, Rico Cilliers, CC0; species proxy'


def leaf_cards(obj, round_number):
    old = obj.data
    if len(old.vertices) % (140 * 12) or len(old.polygons) * 3 != len(old.vertices):
        raise RuntimeError('Expected reviewed 140 folded patches per crown: ' + obj.name)
    mesh, normals = Mesh(), []
    for offset in range(0, len(old.vertices), 12):
        a, b, c, d = [old.vertices[offset+i].co.copy() for i in (0, 1, 4, 7)]
        centre = (a+c)/2
        u, v = (c-a).normalized(), (d-b).normalized()
        half = (c-a).length * .5 * (1.0 if round_number == 1 else 1.15)
        width = half * .448
        mesh.face([centre-u*half-v*width, centre-u*half+v*width,
                   centre+u*half+v*width, centre+u*half-v*width],
                  [( .002, .005), (.445, .005), (.445, .995), (.002, .995)])
        if offset % (140*12) == 0:
            crown = sum((old.vertices[offset+i*12].co+old.vertices[offset+i*12+4].co
                         for i in range(140)), Vector()) / 280
        # Rounded canopy normals avoid each flat twig card looking like a dark
        # plate. This is an authoring approximation, not added self-illumination.
        normal = (centre-crown).normalized()+Vector((0, 0, .45))
        normals.extend([normal.normalized()]*4)
    replace_mesh(obj, mesh)
    uv = obj.data.uv_layers.new(name='UVMap')
    for loop in obj.data.loops:
        uv.data[loop.index].uv = mesh.uv[loop.vertex_index]
    if round_number == 2:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.normals_split_custom_set_from_vertices(normals)
    obj['spaceAlibabaLandscapeRevision'] = REVISION
    return len(mesh.faces)


def metric_uv(obj, metres):
    obj.data = obj.data.copy()
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for polygon in obj.data.polygons:
        axes = [i for i in range(3) if i != max(range(3), key=lambda a: abs(polygon.normal[a]))]
        for index in polygon.loop_indices:
            p = obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv = (p[axes[0]]/metres, p[axes[1]]/metres)


def open_planters(objects):
    """Keep surveyed-independent outer bounds; recess the estimated planting bed.

    Bark-textured inset faces share the trunk mesh as a mulch proxy. Keeping
    existing mesh identities also preserves the browser lighting bindings.
    """
    counts = {}
    for district, suffix, dimensions in (
        ('y', 'planter', ((1.89, 1.89, .7), (4.455, 4.455, .7))),
        ('x', 'stone', ((3.6, 3.6, .8),)),
        ('z', 'stone', ((5.5, 2.7, .8), (5, 7, 1.2))),
    ):
        identity = PREFIX + district
        planter, trunk = objects[identity+'/'+suffix], objects[identity+'/trunk']
        data = planter.data
        if len(data.vertices) % 24 or any(len(p.vertices) != 4 for p in data.polygons):
            raise RuntimeError('Expected independent planter boxes: '+planter.name)
        walls, soil = Mesh(), Mesh()
        for polygon in trunk.data.polygons:
            soil.face([trunk.data.vertices[i].co.copy() for i in polygon.vertices])
        count = 0
        for start in range(0, len(data.vertices), 24):
            vertices = [v.co.copy() for v in data.vertices[start:start+24]]
            low = Vector([min(p[a] for p in vertices) for a in range(3)])
            high = Vector([max(p[a] for p in vertices) for a in range(3)])
            size, centre = high-low, (high+low)/2
            if not any((size-Vector(d)).length < .001 for d in dimensions):
                for offset in range(0, 24, 4):
                    walls.face(vertices[offset:offset+4])
                continue
            count += 1
            rim = min(.16, min(size.x, size.y)*.06)
            for sign in (-1, 1):
                box(walls, (centre.x+sign*(size.x-rim)/2, centre.y, centre.z),
                    (rim, size.y, size.z))
                box(walls, (centre.x, centre.y+sign*(size.y-rim)/2, centre.z),
                    (size.x-2*rim, rim, size.z))
            a, b, z = low.x+rim, low.y+rim, high.z-.12
            c, d = high.x-rim, high.y-rim
            soil.face([(a,b,z), (c,b,z), (c,d,z), (a,d,z)])
        if not count or district == 'y' and count != 44 or district == 'x' and count != 3:
            raise RuntimeError('Unexpected planter inventory: '+district+' '+str(count))
        replace_mesh(planter, walls)
        replace_mesh(trunk, soil)
        counts[district] = count
    return counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', type=int, choices=(1, 2), default=1)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != SOURCE.resolve() or scene.get('space_contract') != 2
            or scene.get('spaceAlibabaYCourtLightingRevision') != 'alibaba-y-court-light-20260912'
            or scene.get('spaceAlibabaLandscapeRevision')):
        raise RuntimeError('Expected reviewed canonical campus without this landscape pass')
    if args.apply and args.round != 2:
        raise RuntimeError('Only the second reviewed candidate can be saved')
    token = source_fingerprint()
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if args.apply:
        candidate = json.loads((OUTPUT/'round-2.json').read_text(encoding='utf8'))
        if candidate['sourceBefore'] != list(token) or candidate['scriptSha256'] != script_hash:
            raise RuntimeError('Source or script changed since candidate review')
    campus = [o for o in scene.objects if o.get('spaceId', '').startswith(PREFIX)]
    foliage = [o for o in campus if o.get('spaceId').rsplit('/', 1)[-1]
               in ('leaves', 'new-leaves', 'foliage', 'leaf-light')]
    ground = [o for o in campus if o.get('spaceId').rsplit('/', 1)[-1]
              in ('paving', 'planter', 'stone', 'trunk')]
    if len(foliage) != 6 or not ground:
        raise RuntimeError('Campus object set changed; inspect before editing')
    planter_ids = {PREFIX+d+'/'+suffix for d, suffix in
                   [('y', 'planter'), ('x', 'stone'), ('z', 'stone'),
                    ('y', 'trunk'), ('x', 'trunk'), ('z', 'trunk')]}
    unaffected = [o for o in scene.objects if o not in foliage and o.get('spaceId') not in planter_ids]
    geometry = geometry_digest(unaffected)
    rigs = export_snapshot(scene)
    ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    mats = {m for o in foliage+ground for m in o.data.materials}
    if any(o not in campus and o.type == 'MESH' and any(m in mats for m in o.data.materials)
           for o in scene.objects):
        raise RuntimeError('A landscape material is shared outside the campus')
    for mat in {o.data.materials[0] for o in foliage}:
        leaves_material(mat)
    counts = {o['spaceId']: leaf_cards(o, args.round) for o in foliage}
    planters = open_planters({o['spaceId']: o for o in ground}) if args.round == 2 else {}
    bark_mats = {o.data.materials[0] for o in ground if o['spaceId'].endswith('/trunk')}
    for mat in {o.data.materials[0] for o in ground}:
        node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        if mat in bark_mats:
            tex = image_node(mat, 'branch_diff', True)
            mat.node_tree.links.new(tex.outputs['Color'], node.inputs['Base Color'])
            mat['spaceSurfaceProvenance'] = 'Poly Haven tree_small_02 branch bark, CC0'
        else:
            normal_map(mat, 'concrete_nor_gl', .18)
            tex = image_node(mat, 'concrete_rough')
            mat.node_tree.links.new(tex.outputs['Color'], node.inputs['Roughness'])
            mat['spaceSurfaceProvenance'] = 'Poly Haven concrete_floor_02 microstructure, Rob Tuytel, CC0; campus base color retained'
    for obj in ground:
        metric_uv(obj, .65 if obj['spaceId'].endswith('/trunk') else 2)
    if geometry_digest(unaffected) != geometry or export_snapshot(scene) != rigs:
        raise RuntimeError('Unrelated geometry or authoring light rigs changed')
    if ids != Counter(o.get('spaceId') for o in scene.objects if o.get('space_export')):
        raise RuntimeError('Export identities changed')
    report = {'revision': REVISION, 'round': args.round, 'saved': False,
              'scriptSha256': script_hash, 'sourceBefore': list(token),
              'cards': counts, 'trianglesBefore': sum(counts.values())*4,
              'trianglesAfter': sum(counts.values())*2,
              'groundObjects': [o['spaceId'] for o in ground],
              'recessedPlanters': planters,
              'preservedGeometry': geometry, 'preservedRigs': list(rigs)}
    OUTPUT.mkdir(exist_ok=True, parents=True)
    assert_source_unchanged(token)
    if args.apply:
        backup = OUTPUT/'shanghai-before-landscape.blend'
        if backup.exists():
            raise RuntimeError('Backup already exists; do not overwrite')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene['spaceAlibabaLandscapeRevision'] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    else:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in foliage+ground:
            obj.hide_set(False)
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/f'round-{args.round}.glb'),
            export_format='GLB', use_selection=True, export_extras=True,
            export_attributes=True, export_yup=True, export_animations=False,
            export_cameras=False, export_lights=False, export_image_format='AUTO')
    (OUTPUT/('saved.json' if args.apply else f'round-{args.round}.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('LANDSCAPE_RESULT '+json.dumps(report))


if __name__ == '__main__':
    main()
