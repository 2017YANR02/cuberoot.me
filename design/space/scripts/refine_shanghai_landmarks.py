"""Targeted Blender authoring, never a replacement of the Shanghai scene.

Run without --apply to review first; --baseline renders without authoring.
References and remaining measurement limits: ../references/shanghai-landmarks.md.
All geometry is metric. Existing roots, UV-dependent night shaders and clocks stay.
"""
import argparse
from collections import Counter, defaultdict
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
from refine_jin_mao import Mesh, linear

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-landmarks'
REVISION = 'shanghai-landmarks-20260908'
NUMBERS = ['1', '2', '3', '5', '6', '7', '9', '14', '15.1', '15', '16', '17', '18', '19', '23', '24', '26', '27', '28', '29', '33']
GLASS_IDS = {'material-90', 'material-55', 'material-69', 'material-75'}


def meshes(root):
    return [o for o in root.children_recursive if o.type == 'MESH' and o.get('space_export')]


def bounds(root):
    inverse = root.matrix_world.inverted()
    points = [inverse @ o.matrix_world @ Vector(p) for o in meshes(root) for p in o.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])


def material(source, name, rgb=None, metal=None, roughness=None, illumination=None):
    mat = source.copy()
    mat.name = name
    mat['spaceMaterialId'] = REVISION + '/' + name
    node = mat.node_tree.nodes.get('Principled BSDF')
    if rgb:
        color = tuple(linear(v / 255) for v in rgb) + (1,)
        mat.diffuse_color = color
        node.inputs['Base Color'].default_value = color
    if metal is not None:
        mat.metallic = metal
        node.inputs['Metallic'].default_value = metal
    if roughness is not None:
        mat.roughness = roughness
        node.inputs['Roughness'].default_value = roughness
    if illumination is not None:
        mat['spaceShaderKey'] = 'shanghai-illumination-' + str(illumination)
    node.inputs['Emission Strength'].default_value = 0
    return mat


def object_for(part, root, label, mat):
    obj = part.object(label, mat, root, root.users_collection[0])
    obj['spaceId'] = REVISION + '/' + root['spaceId'] + '/' + label
    return obj


def replace_mat(root, original_id, **kwargs):
    found = None
    for obj in meshes(root):
        for i, mat in enumerate(obj.data.materials):
            if mat.get('spaceMaterialId') == original_id:
                if found is None:
                    found = material(mat, **kwargs)
                obj.data.materials[i] = found
    if found is None:
        raise RuntimeError('Expected source material missing: ' + original_id)
    return found


def swfc(root):
    steel = replace_mat(root, 'material-33', name='SWFC anodized aluminum', rgb=(166, 181, 187), metal=.66, roughness=.29)
    replace_mat(root, 'material-32', name='SWFC blue reflective glazing', rgb=(108, 141, 159), metal=.5, roughness=.22)
    replace_mat(root, 'material-34', name='SWFC restrained blue edge lighting', rgb=(155, 180, 200), metal=.6, roughness=.25, illumination=.38)
    rail, reveal = Mesh(), Mesh()

    def width(z): return 29 - 4 * z / 492
    def depth(z): return 29 - 22 * (z / 492) ** 1.65
    def portal(z): return 13.8 + (20 - 13.8) * (z - 444) / 33
    # Physical rails follow the existing, documented double-arc envelope.
    # The 444..477 m aperture is kept clear on both faces, including mullions.
    for z in [i * 4.4 for i in range(1, 112)] + [444, 477, 486, 489]:
        if z >= 492: continue
        w, d = width(z), depth(z)
        for sign in [-1, 1]:
            spans = [(-w, w)] if not 444 < z < 477 else [(-w, -portal(z)), (portal(z), w)]
            for a, b in spans:
                rail.beam((a, sign * (d + .06), z), (b, sign * (d + .06), z), .12, .18)
            rail.beam((sign * (w + .06), -d, z), (sign * (w + .06), d, z), .12, .18)
    for side in [-1, 1]:
        for k in range(-19, 20):
            t = k / 20
            for j in range(123):
                a, b = j * 4, min(492, (j + 1) * 4)
                x1, x2 = t * width(a), t * width(b)
                # Conservative clipping prevents any frame bridging the portal.
                if b > 444 and a < 477 and min(abs(x1), abs(x2)) < portal(min(477, b)) + .1: continue
                rail.beam((x1, side * (depth(a) + .08), a), (x2, side * (depth(b) + .08), b), .085, .16)
        for k in range(-15, 16):
            t = k / 16
            for j in range(82):
                a, b = j * 6, min(492, (j + 1) * 6)
                rail.beam((side * (width(a) + .08), t * depth(a), a), (side * (width(b) + .08), t * depth(b), b), .085, .16)
    # Lined aperture soffit and sill; these remain inside the solid bridge/slab.
    for z in [443.85, 477.14]:
        for x in range(-18, 19, 2):
            if abs(x) < portal(min(477, max(444, z))) - .4:
                reveal.beam((x, -depth(z), z), (x, depth(z), z), .14, .2)
    object_for(rail, root, 'SWFC curtain wall mullions and floor rails', steel)
    object_for(reveal, root, 'SWFC aperture soffit battens', steel)
    root['spaceAuthoringRevision'] = REVISION
    root['spaceFacadeDetail'] = {'apertureBottom': 444., 'apertureTop': 477., 'estimated': ['aperture dimensions', 'mullion pitch', 'floor levels']}
    return {'name': root.name, 'physicalRails': True, 'portalClear': True}


def shanghai_tower(root):
    shell = next(o for o in meshes(root) if any(m.get('spaceMaterialId') == 'material-36' for m in o.data.materials))
    # Recover the actual imported UV-indexed rings, avoiding a differently sampled
    # replacement curve that would put new rails through the existing skin.
    rings = defaultdict(dict)
    uv = shell.data.uv_layers.active
    for poly in shell.data.polygons:
        for li in poly.loop_indices:
            vertex = shell.data.vertices[shell.data.loops[li].vertex_index].co
            coord = uv.data[li].uv
            i = round(coord.x / 330 * 96)
            # Lower 90% has unwarped z = row * 6.03; UV v carries actual z.
            if vertex.z < 543:
                row = round(vertex.z / 6.03)
                rings[row][i] = vertex.copy()
    if len(rings[0]) < 90:
        raise RuntimeError('Shanghai Tower UV topology changed; inspect before editing')
    base = rings[0]

    def at(i, t, radial=0):
        p = base[i].copy()
        # Base already contains the -0.34 rad site alignment.
        # glTF Y-up -> Blender Z-up maps (x, y, z) to (x, -z, y),
        # reversing rotation in the horizontal plane.
        angle = -t * math.radians(120)
        c, s = math.cos(angle), math.sin(angle)
        p = Vector((p.x * c - p.y * s, p.x * s + p.y * c, 0)) * (.5686 ** t)
        n = Vector((p.x, p.y, 0)).normalized()
        p += n * radial
        p.z = t * 603 + max(0, (t - .91) / .09) * (14.5 + 14.5 * math.cos(i / 96 * math.tau))
        return p

    alignment_error = max((at(i, row / 100) - p).length for row, ring in rings.items() for i, p in ring.items())
    assert alignment_error < .002, f'Curtain wall does not follow imported skin: {alignment_error:.4f} m'

    aluminum = replace_mat(root, 'material-39', name='Shanghai Tower silver curtain wall', rgb=(174, 190, 194), metal=.65, roughness=.3)
    replace_mat(root, 'material-36', name='Shanghai Tower pale glass outer skin', rgb=(145, 170, 179), metal=.43, roughness=.23)
    replace_mat(root, 'material-38', name='Shanghai Tower silver spiral seam', rgb=(187, 196, 194), metal=.64, roughness=.29, illumination=.32)
    rail, crown, inner = Mesh(), Mesh(), Mesh()
    indices = sorted(i for i in base if 1 <= i <= 95)
    for z in [i * 4.2 for i in range(1, 144)]:
        t = z / 603
        for a, b in zip(indices, indices[1:]):
            rail.beam(at(a, t, .12), at(b, t, .12), .13, .21)
    for i in indices:
        if i % 3 == 1 or i == 95: continue  # Existing physical mullions retained.
        for j in range(50):
            rail.beam(at(i, j / 50, .11), at(i, (j + 1) / 50, .11), .085, .14)
    # Recessed inner skin within the open crown: its circular geometry is visible
    # from above. Full occupied inner tower needs measured floor plans later.
    for i in range(64):
        a, b = i * math.tau / 64, (i + 1) * math.tau / 64
        inner.face([(math.cos(a) * 13.6, math.sin(a) * 13.6, 573),
                    (math.cos(b) * 13.6, math.sin(b) * 13.6, 573),
                    (math.cos(b) * 12.9, math.sin(b) * 12.9, 607),
                    (math.cos(a) * 12.9, math.sin(a) * 12.9, 607)], [(i, 573), (i + 1, 573), (i + 1, 607), (i, 607)])
    for i in indices[::4]:
        p = at(i, 1, -.5)
        q = Vector((p.x * .56, p.y * .56, 604))
        crown.beam(p, q, .19, .3)
        crown.beam(at(i, .96, -.5), q, .12, .22)
    object_for(rail, root, 'Shanghai Tower physical floor and vertical grid', aluminum)
    object_for(crown, root, 'Shanghai Tower recessed crown structure', aluminum)
    mat = material(aluminum, 'Shanghai Tower crown inner glazing', (91, 120, 134), .38, .24, .015)
    object_for(inner, root, 'Shanghai Tower crown inner skin', mat)
    root['spaceAuthoringRevision'] = REVISION
    root['spaceFacadeDetail'] = {'height': 632., 'twistDegrees': 120., 'crownInnerSkin': True, 'estimated': ['inner skin', 'frame spacing', 'crown struts']}
    return {'name': root.name, 'physicalRails': True, 'crownInnerSkin': True, 'skinAlignmentErrorMeters': alignment_error}


def glass_components(obj):
    """Weld duplicated glTF corners, returning separate planar window openings."""
    vertices, aliases, coordinates = [], {}, []
    for v in obj.data.vertices:
        key = tuple(round(c, 4) for c in v.co)
        if key not in aliases:
            aliases[key] = len(vertices)
            vertices.append(v.co.copy())
        coordinates.append(aliases[key])
    parents = list(range(len(vertices)))
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    faces = []
    for p in obj.data.polygons:
        ids = [coordinates[i] for i in p.vertices]
        for i in ids[1:]: parents[find(i)] = find(ids[0])
        faces.append(ids)
    groups, group_faces = defaultdict(set), defaultdict(list)
    for face in faces:
        index = find(face[0])
        groups[index].update(face)
        group_faces[index].append(face)
    for index, ids in groups.items():
        if len(ids) > 150: continue
        points = [vertices[i] for i in ids]
        normal = (vertices[group_faces[index][0][1]] - vertices[group_faces[index][0][0]]).cross(vertices[group_faces[index][0][2]] - vertices[group_faces[index][0][0]]).normalized()
        if normal.length < .9 or abs(normal.z) > .1: continue
        if max(abs((p - points[0]).dot(normal)) for p in points) > .015: continue
        yield points, normal, [[vertices[i] for i in face] for face in group_faces[index]]


def window_frames(root, glass, frame):
    parts, count = Mesh(), 0
    low, high = bounds(root)
    center = (low + high) / 2
    for obj in glass:
        transform = root.matrix_world.inverted() @ obj.matrix_world
        for points, normal, faces in glass_components(obj):
            points = [transform @ p for p in points]
            faces = [[transform @ p for p in f] for f in faces]
            normal = (transform.to_3x3() @ normal).normalized()
            mean = sum(points, Vector()) / len(points)
            if normal.dot(mean - center) < 0: normal = -normal
            u = Vector((0, 0, 1)).cross(normal).normalized()
            xs, zs = [p.dot(u) for p in points], [p.z for p in points]
            w, h = max(xs) - min(xs), max(zs) - min(zs)
            if not (.45 < w < 5.5 and .6 < h < 6): continue
            plane = mean.dot(normal)
            # Clip crossbars to the real outline, including curved and arched heads.
            def bar(axis, value):
                hits = []
                for face in faces:
                    for a, b in zip(face, face[1:] + face[:1]):
                        va, vb = (a.dot(u), b.dot(u)) if axis == 'x' else (a.z, b.z)
                        if abs(vb - va) > .0001 and min(va, vb) <= value <= max(va, vb):
                            p = a.lerp(b, (value - va) / (vb - va))
                            hits.append(p.z if axis == 'x' else p.dot(u))
                if len(hits) < 2 or max(hits) - min(hits) < .2: return
                ends = []
                for v in [min(hits) + .06, max(hits) - .06]:
                    x, z = (value, v) if axis == 'x' else (v, value)
                    ends.append(u * x + normal * (plane + .045) + Vector((0, 0, z)))
                parts.beam(*ends, .055, .095)
            bar('x', (min(xs) + max(xs)) / 2)
            bar('z', min(zs) + h * .58)
            if w > 2.5:
                for t in [.25, .75]: bar('x', min(xs) + w * t)
            count += 1
    if parts.faces: object_for(parts, root, root.name + ' fitted window muntins', frame)
    return count


def surface_images():
    """Original, tileable micro-surface maps, not claimed as photo scans."""
    rng = np.random.default_rng(421)
    n = 256
    y, x = np.mgrid[0:n, 0:n] / n
    broad = np.sin(x * math.tau * 3) * np.sin(y * math.tau * 5)
    grain = rng.random((n, n)).astype(np.float32)
    height = broad * .14 + grain * .3
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * .08
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * .08
    maps = {}
    normal = np.dstack((.5 - dx, .5 - dy, np.ones_like(x), np.ones_like(x)))
    rough = np.repeat((.64 + broad * .045 + grain * .075)[..., None], 4, axis=2)
    rough[..., 3] = 1
    for key, pixels in [('stone-normal', normal), ('stone-roughness', rough)]:
        im = bpy.data.images.new(REVISION + '-' + key, n, n, alpha=True)
        im.colorspace_settings.name = 'Non-Color'
        im.pixels.foreach_set(pixels.astype(np.float32).ravel())
        im.pack()
        maps[key] = im
    return maps


def stone_surface(obj, mat, maps):
    node = mat.node_tree.nodes.get('Principled BSDF')
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = maps['stone-normal']
    normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
    mat.node_tree.links.new(texture.outputs['Color'], normal.inputs['Color'])
    mat.node_tree.links.new(normal.outputs['Normal'], node.inputs['Normal'])
    rough = mat.node_tree.nodes.new('ShaderNodeTexImage')
    rough.image = maps['stone-roughness']
    mat.node_tree.links.new(rough.outputs['Color'], node.inputs['Roughness'])
    # Stone shader uses position, not UV. A new metric UV is safe for these meshes.
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv = (p[axes[0]] / .6, p[axes[1]] / .6)
    mat['spaceSurfaceProvenance'] = 'Original procedural stone micro-surface; not a scan'


def bund(root, number, maps):
    glass, updated, count = [], {}, 0
    for obj in list(meshes(root)):
        for i, original in enumerate(obj.data.materials):
            sid = original.get('spaceMaterialId', '')
            shader = str(original.get('spaceShaderKey', ''))
            if sid in GLASS_IDS: glass.append(obj)
            if 'bund-stone' not in shader and sid not in GLASS_IDS and not (number == '33' and sid == 'material-95'): continue
            key = (sid, obj.name)  # UV authoring stays per mesh, material remains local.
            mat = material(original, 'Bund ' + number + ' ' + sid + ' ' + obj.name)
            if 'bund-stone' in shader:
                stone_surface(obj, mat, maps)
                # Ivory trim should read as limestone, not yellow painted plastic.
                node = mat.node_tree.nodes.get('Principled BSDF')
                color = list(mat.diffuse_color)
                if 'false' in shader:
                    gray = sum(color[:3]) / 3
                    color[:3] = [v * .62 + gray * .38 for v in color[:3]]
                mat.diffuse_color = color
                node.inputs['Base Color'].default_value = color
                node.inputs['Metallic'].default_value = .025
                mat.metallic = .025
                count += 1
            elif sid in GLASS_IDS:
                node = mat.node_tree.nodes.get('Principled BSDF')
                node.inputs['Metallic'].default_value = .32
                node.inputs['Roughness'].default_value = .24
                mat.metallic, mat.roughness = .32, .24
            elif number == '33':
                color = tuple(linear(v / 255) for v in (103, 76, 58)) + (1,)
                mat.diffuse_color = color
                mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = color
            obj.data.materials[i] = mat
            updated[key] = mat
    sample = next(iter(updated.values()))
    frame = material(sample, 'Bund ' + number + ' painted metal window frames',
                     (58, 74, 65) if number in {'33', '6', '9', '19'} else (89, 85, 72), .42, .38, .025)
    # The frame material must not inherit surface texture connections or stone UV.
    node = frame.node_tree.nodes.get('Principled BSDF')
    for socket in ['Normal', 'Roughness']:
        for link in list(node.inputs[socket].links): frame.node_tree.links.remove(link)
    windows = window_frames(root, glass, frame)
    root['spaceAuthoringRevision'] = REVISION
    root['spaceFacadeDetail'] = {'bundNumber': number, 'fittedWindows': windows, 'stoneMeshes': count,
                               'estimated': ['window subdivisions', 'stone finish', 'lighting']}
    return {'name': root.name, 'number': number, 'windows': windows, 'stoneMeshes': count}


def review(roots, group, prefix, night=False):
    scene = bpy.context.scene
    # Independent review copies; never save these staging transforms or lights.
    for o in scene.objects:
        if o.type in {'MESH', 'LIGHT', 'FONT'}: o.hide_render = True
    stage = bpy.data.collections.new('Temporary review staging')
    scene.collection.children.link(stage)
    columns = min(len(roots), 6 if group == 'bund' else 3)
    rows = math.ceil(len(roots) / columns)
    spacing = 80 if group == 'bund' else 185
    row_height = 90
    staged = []
    focus_height = 0
    for index, root in enumerate(roots):
        lo, hi = bounds(root)
        factor = min(65 / (hi.x - lo.x), 73 / (hi.z - lo.z)) if group == 'bund' else 1
        center = (lo.x + hi.x) / 2
        focus_height = (hi.z - lo.z) * factor
        offset = Vector(((index % columns - (columns - 1) / 2) * spacing, 0, (rows - 1 - index // columns) * row_height if group == 'bund' else 0))
        transform = Matrix.Translation(offset) @ Matrix.Diagonal((factor, factor, factor, 1)) @ Matrix.Translation((-center, -hi.y, -lo.z)) @ root.matrix_world.inverted()
        for obj in meshes(root):
            copy = obj.copy()
            stage.objects.link(copy)
            copy.parent = None
            copy.matrix_world = transform @ obj.matrix_world
            copy.hide_render = False
            staged.append(copy)
        text = bpy.data.curves.new(root.name + ' label', 'FONT')
        text.body, text.align_x, text.size = root.name, 'CENTER', 2.25 if group == 'bund' else 9
        label = bpy.data.objects.new(text.name, text)
        stage.objects.link(label)
        label.location = offset + Vector((0, 5, -5 if group == 'bund' else -17))
        label.rotation_euler = (math.pi / 2, 0, math.pi)
        if night and group == 'bund':
            width, height = (hi.x - lo.x) * factor, (hi.z - lo.z) * factor
            # Distributed review fixtures reveal relief without emissive stone.
            # Positions and output are inspection lighting, not measured city fixtures.
            fixtures = [(width * x, 13 * factor, 2 * factor, height * .42, 5000)
                        for x in (-.36, 0, .36)]
            fixtures.append((0, 14 * factor, height * .78, height * .94, 2800))
            for fixture, (x, y, z, target_z, watts) in enumerate(fixtures):
                data = bpy.data.lights.new(root.name + ' review wash ' + str(fixture), 'AREA')
                data.energy, data.color, data.shape, data.size = watts * factor ** 2, (1, .82, .62), 'DISK', 5 * factor
                light = bpy.data.objects.new(data.name, data)
                stage.objects.link(light)
                light.location = offset + Vector((x, y, z))
                aim = offset + Vector((x * .75, 0, target_z))
                light.rotation_euler = (aim - light.location).to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.new('Landmark review world')
    world.use_nodes = True
    scene.world = world
    bg = world.node_tree.nodes.new('ShaderNodeBackground')
    output = world.node_tree.nodes.new('ShaderNodeOutputWorld')
    output.is_active_output = True
    world.node_tree.links.new(bg.outputs['Background'], output.inputs['Surface'])
    bg.inputs['Color'].default_value = (.035, .06, .105, 1) if night else (.54, .63, .72, 1)
    bg.inputs['Strength'].default_value = .3 if night else .55
    sun_data = bpy.data.lights.new('Review directional light', 'SUN')
    sun_data.energy, sun_data.angle = (.12 if night else 2.2), .12
    sun = bpy.data.objects.new(sun_data.name, sun_data)
    stage.objects.link(sun)
    sun.rotation_euler = Vector((-.4, -.65, -.9)).to_track_quat('-Z', 'Y').to_euler()
    if night:
        for mat in {m for obj in staged for m in obj.data.materials}:
            key = str(mat.get('spaceShaderKey', ''))
            if 'bund-stone' in key or 'bund-roof' in key: continue  # Actual review lights, no emissive stone.
            try: strength = float(key.split('shanghai-illumination-')[1].split('-')[0])
            except (IndexError, ValueError): strength = 0
            node = mat.node_tree.nodes.get('Principled BSDF')
            if node:
                node.inputs['Emission Color'].default_value = (1, .72, .43, 1)
                node.inputs['Emission Strength'].default_value = strength * .45
    cam_data = bpy.data.cameras.new('Landmark review camera')
    cam = bpy.data.objects.new(cam_data.name, cam_data)
    stage.objects.link(cam)
    aim = Vector((0, 0, (rows - 1) * row_height / 2 + 37 if group == 'bund' else 310))
    if group == 'bund' and len(roots) == 1: aim.z = focus_height / 2 - 1
    cam.location = aim + Vector((0, 900, 55 if group == 'bund' else 20))
    cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data.type, cam_data.ortho_scale, cam_data.clip_end = 'ORTHO', (max(columns * spacing + 12, rows * row_height * 4 / 3) if group == 'bund' else 760), 10000
    if group == 'bund' and len(roots) == 1: cam_data.ortho_scale = max(82, (focus_height + 14) * 4 / 3)
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples, scene.cycles.use_denoising = 'CPU', 20, True
    scene.render.threads_mode, scene.render.threads = 'FIXED', 14
    scene.render.resolution_x, scene.render.resolution_y = (2304, 1728) if group == 'bund' else (1400, 1400)
    if group == 'bund' and len(roots) == 1: scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = str(OUTPUT / (prefix + '-' + group + '.png'))
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--baseline', action='store_true')
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--night', action='store_true')
    parser.add_argument('--review-saved', action='store_true')
    parser.add_argument('--group', choices=['bund', 'towers'], default='bund')
    parser.add_argument('--focus', help='Bund street number for an individual close-up')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if scene.get('space_asset') != 'shanghai' or scene.get('space_contract') != 2 or Path(bpy.data.filepath).resolve() != ROOT / 'design/space/scenes/shanghai.blend':
        raise RuntimeError('Open the repository contract-v2 shanghai.blend')
    if args.apply and (args.baseline or args.review_saved): raise RuntimeError('Review mode cannot save')
    if args.focus and (args.group != 'bund' or args.focus not in NUMBERS + ['20', '13', '12']): raise RuntimeError('Focus must be a known Bund street number')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    by_id = {o.get('spaceId'): o for o in scene.objects if o.get('space_export')}
    original_ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    towers = [by_id['root/132/' + str(i)] for i in range(3)]
    buildings = [by_id['root/147/8/' + str(i)] for i in range(21)] + [by_id['root/147/' + str(i)] for i in [4, 5, 6]]
    report = {'revision': REVISION, 'saved': args.apply, 'buildings': []}
    if not args.baseline and not args.review_saved:
        if towers[1].get('spaceAuthoringRevision') == REVISION:
            raise RuntimeError('Already authored; inspect artist changes instead of rerunning')
        report['buildings'].extend([swfc(towers[1]), shanghai_tower(towers[2])])
        maps = surface_images()
        for root, number in zip(buildings, NUMBERS + ['20', '13', '12']):
            report['buildings'].append(bund(root, number, maps))
        bpy.context.view_layer.update()
        current = [o.get('spaceId') for o in scene.objects if o.get('space_export')]
        counts = Counter(current)
        assert all(counts[key] == count for key, count in original_ids.items()), 'Existing runtime roots or geometry changed'
        assert all(count == 1 for key, count in counts.items() if key not in original_ids), 'Duplicate authored IDs'
        assert abs(bounds(towers[0])[1].z - 420.5) < .1, 'Jin Mao changed'
        report['preservedOriginalIds'] = len(original_ids)
        report['newMeshes'] = len(current) - sum(original_ids.values())
        if args.apply:
            bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
    prefix = ('baseline' if args.baseline else 'refined') + ('-night' if args.night else '-day')
    if args.focus: prefix += '-' + args.focus
    (OUTPUT / (prefix + '-' + args.group + '.json')).write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print('LANDMARK_REVIEW ' + json.dumps(report), flush=True)
    if not args.no_render:
        selected = [buildings[(NUMBERS + ['20', '13', '12']).index(args.focus)]] if args.focus else buildings
        review(selected if args.group == 'bund' else towers, args.group, prefix, args.night)


if __name__ == '__main__':
    main()
