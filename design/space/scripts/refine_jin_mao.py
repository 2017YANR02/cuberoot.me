"""One-time Blender authoring pass; preview first, --apply saves with a backup.

Sources: SOM and Permasteelisa; see ../references/jin-mao.md. Heights and
floor sequence have documentary evidence; facade dimensions are photo estimates.
This edits only Jin Mao, archives its imported meshes and keeps runtime IDs.
Run through Blender --background shanghai.blend --threads 14 --python this.py.
"""
import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-jinmao'
FLOORS = [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1]
HEIGHT = 420.5
REVISION = 'jin-mao-blender-20260908'


class Mesh:
    def __init__(self):
        self.vertices, self.faces, self.uv = [], [], []

    def face(self, points, uv=None):
        offset = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(offset, offset + len(points))))
        self.uv.extend(uv or [(0, 0)] * len(points))

    def beam(self, a, b, width, depth=None, sides=4):
        a, b = Vector(a), Vector(b)
        direction = (b - a).normalized()
        helper = Vector((0, 0, 1)) if abs(direction.z) < .99 else Vector((0, 1, 0))
        u = direction.cross(helper).normalized() * width * .5
        v = direction.cross(u).normalized() * (depth or width) * .5
        angles = [2 * math.pi * i / sides + math.pi / 4 for i in range(sides)]
        rings = [[p + u * math.cos(t) + v * math.sin(t) for t in angles] for p in (a, b)]
        self.face(list(reversed(rings[0])))
        self.face(rings[1])
        for i in range(sides):
            j = (i + 1) % sides
            self.face([rings[0][i], rings[0][j], rings[1][j], rings[1][i]])

    def ring(self, plan, z, width, depth=None):
        for a, b in zip(plan, plan[1:] + plan[:1]):
            self.beam((*a, z), (*b, z), width, depth)

    def loft(self, lower, upper, bottom, top, cap=False):
        along = 0
        for i, a in enumerate(lower):
            j = (i + 1) % len(lower)
            b, c, d = lower[j], upper[i], upper[j]
            length = math.dist(a, b)
            self.face([(*a, bottom), (*b, bottom), (*d, top), (*c, top)],
                      [(along, bottom), (along + length, bottom), (along + length, top), (along, top)])
            along += length
        if cap:
            # Center fans avoid relying on exporter triangulation of a concave ring.
            for a, b in zip(upper, upper[1:] + upper[:1]):
                self.face([(0, 0, top), (*a, top), (*b, top)])

    def object(self, name, material, parent, collection):
        data = bpy.data.meshes.new(name)
        data.from_pydata(self.vertices, [], self.faces)
        data.update()
        layer = data.uv_layers.new(name='UVMap')
        for loop in data.loops:
            layer.data[loop.index].uv = self.uv[loop.vertex_index]
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        obj.parent = parent
        obj.data.materials.append(material)
        obj['space_export'] = True
        obj['spaceId'] = 'authored/jin-mao/' + name.replace(' ', '-').lower()
        obj['spaceName'] = name
        obj['spaceVisible'] = True
        obj['spaceCastShadow'] = True
        obj['spaceReceiveShadow'] = True
        return obj


def plan(half):
    points = []
    for side in range(4):
        angle = side * math.pi / 2
        for x, y in [(half * .73, half), (half * .32 + .9, half),
                     (half * .32, half - .65), (-half * .32, half - .65),
                     (-half * .32 - .9, half), (-half * .73, half)]:
            points.append((x * math.cos(angle) - y * math.sin(angle),
                           x * math.sin(angle) + y * math.cos(angle)))
    return points


def octagon(half):
    a = half * .68
    return [(half, a), (a, half), (-a, half), (-half, a),
            (-half, -a), (-a, -half), (a, -half), (half, -a)]


def linear(value):
    return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4


def make_material(source, name, rgb, illumination, metalness, roughness):
    material = source.copy()
    material.name = 'Jin Mao ' + name
    color = tuple(linear(v / 255) for v in rgb) + (1,)
    material.diffuse_color = color
    material.metallic, material.roughness = metalness, roughness
    node = material.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = color
    node.inputs['Metallic'].default_value = metalness
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Emission Strength'].default_value = 0
    material['spaceMaterialId'] = REVISION + '/' + name
    if illumination is not None:
        material['spaceShaderKey'] = 'shanghai-illumination-' + str(illumination)
    material['jinMaoPreviewLight'] = illumination or 0
    return material


def author(tower):
    original = list(tower.children)
    sources = {m.get('spaceMaterialId'): m for o in original if o.type == 'MESH' for m in o.data.materials}
    if set(sources) != {'material-27', 'material-28', 'material-29', 'material-30', 'material-31'}:
        raise RuntimeError('Jin Mao materials differ from the imported baseline; inspect artist edits first')
    archive = bpy.data.collections.new('ARCHIVE Jin Mao imported baseline (not exported)')
    bpy.context.scene.collection.children.link(archive)
    holder = bpy.data.objects.new('Jin Mao imported baseline', None)
    archive.objects.link(holder)
    holder.matrix_world = tower.matrix_world.copy()
    holder['space_export'] = False
    for obj in original:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        archive.objects.link(obj)
        obj.parent = holder
        obj['space_export'] = False
        obj.hide_render = True
        obj.hide_set(True)
    archive.hide_render = True
    archive.hide_viewport = True

    collection = tower.users_collection[0]
    materials = {
        'glass': make_material(sources['material-27'], 'smoky blue glass', (116, 139, 147), None, .38, .3),
        'steel': make_material(sources['material-28'], 'brushed aluminum', (186, 192, 194), .12, .56, .34),
        'piers': make_material(sources['material-29'], 'vertical floodlit piers', (192, 196, 197), 1.25, .48, .32),
        'crown': make_material(sources['material-31'], 'crown silver fins', (204, 206, 203), 2.2, .5, .3),
        'recess': make_material(sources['material-30'], 'shadow reveals', (43, 57, 61), 0, .25, .52),
    }
    generated = []
    bottom = 0
    for section, floors in enumerate(FLOORS):
        top = bottom + floors * 4.04
        half = 29.3 - section * .8
        lower, upper = plan(half), plan(half + .6)
        parts = {key: Mesh() for key in ['glass', 'steel', 'piers', 'recess']}
        parts['glass'].loft(lower, upper, bottom, top)
        # Physical floor rails and 1.4 m mullions, including chamfered shoulders.
        # Shader UVs use metres too, retaining the site's time-controlled windows.
        for i, a in enumerate(lower):
            j = (i + 1) % len(lower)
            b, c, d = lower[j], upper[i], upper[j]
            length = math.dist(a, b)
            count = max(1, round(length / 1.4))
            normal = Vector((b[1] - a[1], a[0] - b[0])).normalized()
            for k in range(count):
                t = k / count
                p = Vector(a).lerp(Vector(b), t) + normal * .22
                q = Vector(c).lerp(Vector(d), t) + normal * .22
                parts['steel'].beam((*p, bottom), (*q, top + .75), .18, .45)
                # Fin tips project above each setback, visible in the aerial photo.
                if section > 3:
                    parts['steel'].beam((*q, top + .75), (*q, top + 1.5), .1, sides=6)
        for floor in range(1, floors + 1):
            for offset, width in [(-.55, .12), (-.12, .19)]:
                z = bottom + floor * 4.04 + offset
                outline = plan(half + .6 * (z - bottom) / (top - bottom) + .28)
                parts['steel'].ring(outline, z, width, .25)
        for side in range(4):
            angle = side * math.pi / 2
            for sign in [-1, 1]:
                x = sign * (half * .32 + .48)
                def at(x, y, z):
                    return (x * math.cos(angle) - y * math.sin(angle),
                            x * math.sin(angle) + y * math.cos(angle), z)
                parts['piers'].beam(at(x, half + .5, bottom), at(x, half + 1.1, top + .45), 1.05, 1.25)
        parts['recess'].ring(upper, top - .25, .5, .72)
        parts['steel'].loft(plan(half + .62), plan(half + .62), top - .12, top, cap=True)
        parts['steel'].ring(plan(half + .75), top, .4, .65)
        for key, mesh in parts.items():
            generated.append(mesh.object(f'Jin Mao tier {section + 1:02d} {key}', materials[key], tower, collection))
        bottom = top

    glass, crown, shadow = Mesh(), Mesh(), Mesh()
    # A closely stepped crown base, followed by two separate flared fin stages.
    # These proportions are derived from the contractor's close photograph.
    for base, height, half in [(355.52, 7.5, 18.8), (363.02, 7, 15.1),
                               (370.02, 6.4, 11.3), (376.42, 5.5, 7.6)]:
        ring = octagon(half)
        glass.loft(ring, ring, base, base + height)
        for z in [base + i * 1.35 for i in range(1, math.ceil(height / 1.35))]:
            crown.ring(octagon(half + .2), z, .22, .32)
        crown.loft(octagon(half + .25), octagon(half + .25), base + height - .2, base + height, cap=True)
        for side in range(4):
            angle = side * math.pi / 2
            for sign in [-1, 1]:
                x, y = sign * half * .32, half + .42
                p = (x * math.cos(angle) - y * math.sin(angle), x * math.sin(angle) + y * math.cos(angle))
                crown.beam((*p, base), (*p, base + height + .5), .85, 1.2)
        for a, b in zip(ring, ring[1:] + ring[:1]):
            for k in range(max(1, round(math.dist(a, b) / 1.5))):
                t = k / max(1, round(math.dist(a, b) / 1.5))
                p = Vector(a).lerp(Vector(b), t)
                crown.beam((*p, base), (*p, base + height + 1), .19, .35)
    # The old cylindrical cap erased the open, four-wing profile. Each wing is
    # a thin panel with a sloping rim, tie rods and tiny projecting end brackets.
    for base, top, radius, flare in [(379, 389.2, 2.1, 5.8), (388, 400, 1.2, 4.1)]:
        for side in range(4):
            a = side * math.pi / 2 + math.pi / 4
            radial = Vector((math.cos(a), math.sin(a), 0))
            tangent = Vector((-math.sin(a), math.cos(a), 0))
            p = radial * radius + Vector((0, 0, base))
            q = radial * flare + Vector((0, 0, top))
            # Closed slab, not a single-sided sheet (visible from either bank).
            left, right = tangent * .2, -tangent * .2
            inner = Vector((0, 0, top - 1.7)) + radial * .65
            front, back = [p + left, q + left, inner + left], [p + right, q + right, inner + right]
            crown.face(front)
            crown.face(list(reversed(back)))
            for i in range(3):
                crown.face([front[i], back[i], back[(i + 1) % 3], front[(i + 1) % 3]])
            crown.beam(p, q, .24, sides=8)
            for k in range(1, 9):
                t = k / 9
                edge = p.lerp(q, t)
                center = radial * .7 + Vector((0, 0, edge.z - .25))
                shadow.beam(center, edge + radial * .32, .12, sides=6)
            crown.beam(q, q + Vector((0, 0, .65)), .16, sides=8)
    # Slender triangular lattice mast and regular tie bars, terminating at 420.5 m.
    for side in range(3):
        a = side * 2 * math.pi / 3
        crown.beam((math.cos(a) * .75, math.sin(a) * .75, 395),
                   (math.cos(a) * .09, math.sin(a) * .09, HEIGHT), .14, sides=8)
    for i in range(24):
        z = 396 + i
        r = .75 - (z - 395) / 25.5 * .66
        crown.ring([(math.cos(a * 2 * math.pi / 3) * r, math.sin(a * 2 * math.pi / 3) * r) for a in range(3)], z, .09)
    for name, mesh, mat in [('glazing', glass, materials['glass']), ('metalwork', crown, materials['crown']), ('tie rods', shadow, materials['recess'])]:
        generated.append(mesh.object('Jin Mao crown ' + name, mat, tower, collection))
    tower['spaceAuthoringRevision'] = REVISION
    tower['reconstruction'] = {'height': HEIGHT, 'floors': sum(FLOORS), 'sectionFloors': FLOORS,
                               'estimated': ['plan widths', 'floor heights', 'crown details', 'lighting'],
                               'reference': 'https://www.permasteelisagroup.com/historic-project/jin-mao-tower/'}
    return generated, materials


def camera(tower, name, eye, target, scale):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    collection = next((c for c in bpy.data.collections if c.name.startswith('PREVIEW')), bpy.context.scene.collection)
    collection.objects.link(obj)
    obj.location = tower.matrix_world @ Vector(eye)
    aim = tower.matrix_world @ Vector(target)
    obj.rotation_euler = (aim - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data.type, data.ortho_scale, data.clip_end = 'ORTHO', scale, 12000
    obj['space_export'] = False
    return obj


def render(tower, objects, cameras, prefix, night=False):
    scene = bpy.context.scene
    keep = {o.name for o in objects}
    for obj in scene.objects:
        if obj.type in {'MESH', 'LIGHT'}:
            obj.hide_render = obj.name not in keep
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples, scene.cycles.use_denoising = 'CPU', 16, True
    scene.render.threads_mode, scene.render.threads = 'FIXED', 14
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Jin Mao review world')
    scene.world, world.use_nodes = world, True
    bg = world.node_tree.nodes.new('ShaderNodeBackground')
    output = world.node_tree.nodes.new('ShaderNodeOutputWorld')
    output.is_active_output = True
    world.node_tree.links.new(bg.outputs['Background'], output.inputs['Surface'])
    bg.inputs['Color'].default_value = ((.045, .08, .14, 1) if night else (.58, .65, .72, 1))
    bg.inputs['Strength'].default_value = .35 if night else .65
    sun_data = bpy.data.lights.new('Jin Mao review sun', 'SUN')
    sun_data.energy, sun_data.angle = (.15 if night else 2.5), .15
    sun = bpy.data.objects.new(sun_data.name, sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = Vector((-170, 300, -420)).to_track_quat('-Z', 'Y').to_euler()
    if night:
        for material in {m for o in objects for m in o.data.materials}:
            node = material.node_tree.nodes.get('Principled BSDF')
            if node:
                key = str(material.get('spaceShaderKey', ''))
                try:
                    factor = float(key.split('shanghai-illumination-')[1].split('-')[0])
                except (ValueError, IndexError):
                    factor = 0
                node.inputs['Emission Color'].default_value = (.85, .73, .56, 1)
                node.inputs['Emission Strength'].default_value = factor * .65
    for name, cam in cameras.items():
        scene.camera = cam
        scene.render.resolution_x, scene.render.resolution_y = (780, 1000) if name == 'full' else (960, 960)
        scene.render.filepath = str(OUTPUT / (prefix + '-' + name + '.png'))
        bpy.ops.render.render(write_still=True)


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--apply', action='store_true')
    args.add_argument('--baseline', action='store_true')
    args.add_argument('--night', action='store_true')
    args.add_argument('--no-render', action='store_true')
    options = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if scene.get('space_asset') != 'shanghai' or scene.get('space_contract') != 2:
        raise RuntimeError('Open the contract-v2 shanghai.blend authoring source')
    if Path(bpy.data.filepath).resolve() != ROOT / 'design/space/scenes/shanghai.blend':
        raise RuntimeError('Use the repository source, not an unsaved or alternate project')
    tower = next(o for o in scene.objects if o.get('spaceId') == 'root/132/0')
    if tower.get('spaceAuthoringRevision'):
        raise RuntimeError('Already authored: continue editing the .blend; do not regenerate over it')
    if options.baseline and options.apply:
        raise RuntimeError('Baseline review must not save changes')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    tower_children = set(tower.children)
    original_ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export') and o not in tower_children)
    if options.baseline:
        objects = [o for o in tower.children if o.type == 'MESH']
    else:
        objects, _ = author(tower)
    bpy.context.view_layer.update()
    bounds = [tower.matrix_world.inverted() @ (o.matrix_world @ Vector(p)) for o in objects for p in o.bound_box]
    height = max(v.z for v in bounds) - min(v.z for v in bounds)
    assert abs(height - HEIGHT) < .1, height
    assert sum(FLOORS) == 88
    remaining = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    assert all(remaining[key] == count for key, count in original_ids.items()), 'Other runtime objects changed'
    if not options.baseline:
        ids = [o.get('spaceId') for o in objects]
        assert len(ids) == len(set(ids)) and all(remaining[key] == 1 for key in ids), 'Duplicate authored IDs'
    cameras = {
        'full': camera(tower, 'Jin Mao', (170, -300, 270), (0, 0, 211), 470),
        'crown': camera(tower, 'Jin Mao crown', (82, -132, 418), (0, 0, 381), 101),
    }
    report = {'revision': 'baseline' if options.baseline else REVISION, 'height': height,
              'floors': sum(FLOORS), 'sectionFloors': FLOORS, 'meshes': len(objects),
              'vertices': sum(len(o.data.vertices) for o in objects), 'preservedOtherIds': len(original_ids),
              'saved': options.apply, 'estimated': ['plan widths', 'floor heights', 'crown details', 'lighting']}
    if options.apply:
        scene.camera = cameras['full']
        bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
    prefix = ('baseline' if options.baseline else 'refined') + ('-night' if options.night else '-day')
    (OUTPUT / (prefix + '.json')).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('JIN_MAO_REVIEW ' + json.dumps(report), flush=True)
    if not options.no_render:
        render(tower, objects, cameras, prefix, options.night)


if __name__ == '__main__':
    main()
