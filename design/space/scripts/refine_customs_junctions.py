"""Incremental Customs House roof returns and dielectric glazing.

Every CLI mode is read-only; the parent authoring pipeline owns source saving.
See ../references/customs-junctions.md for photographic and ray evidence.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_customs_roof as roof
import refine_shanghai_landmarks as previous
from refine_bund_entrances import box
from refine_jin_mao import Mesh

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-parallel-20260910/customs'
REVISION = 'customs-junctions-20260910'
ROOT_ID = 'root/147/5'
PROJECTOR_OFFSETS = (-6.1, -3.05, 0, 3.05, 6.1)
GLASS_IDS = {'shanghai-landmarks-20260908/Bund 13 material-69 Mesh_242',
             roof.REVISION + '/glass'}


def trim_glazing_at_returns(root, archive):
    """Remove legacy glazing only where it intersects the new inner cornice."""
    if root.get('spaceId') != ROOT_ID or root.get('spaceCustomsGlazingRevision'):
        raise RuntimeError('Unexpected building or already corrected glazing')
    obj = next(o for o in previous.meshes(root) if o.get('spaceId') == ROOT_ID + '/1')
    local = root.matrix_world.inverted() @ obj.matrix_world
    if max(abs(local[r][c] - Matrix.Identity(4)[r][c])
           for r in range(4) for c in range(4)) > .001:
        raise RuntimeError('Glazing authoring basis changed')
    galleries.archive(obj, archive)
    obj.data = obj.data.copy()
    removed = 0
    # Two first-hit probes found old glass 3.7–6.7 cm ahead of the right
    # pavilion's inner ledges. Preserve glass between those two stone bands.
    for height, thickness in ((36.98, .12), (37.53, .28)):
        removed += galleries.cut_volume(obj, (10.9, -6.346, height - thickness / 2),
                                        (11.40, -1.50, height + thickness / 2), archive)
    if not removed:
        raise RuntimeError('Expected overlapping legacy glazing was not found')
    root['spaceCustomsGlazingRevision'] = REVISION + '-glass-return'
    return removed


def author(root, archive):
    """Apply once in memory; caller owns source saving and global validation."""
    if root.get('spaceId') != ROOT_ID:
        raise RuntimeError('This refinement only supports Bund 13')
    if root.get('spaceCustomsJunctionRevision'):
        raise RuntimeError('Already authored; preserve subsequent artist edits')
    if root.get('spaceCustomsRoofRevision') != roof.REVISION:
        raise RuntimeError('Expected photo-guided Customs roof revision')
    by_id = {o.get('spaceId'): o for o in previous.meshes(root)}
    old_trim = by_id[ROOT_ID + '/2']
    new_trim = by_id[roof.REVISION + '/' + ROOT_ID + '/trim']
    # The existing helpers cut in mesh coordinates. Refuse a changed authoring
    # basis rather than silently moving the cut when an artist edits transforms.
    for obj in (old_trim, new_trim):
        local = root.matrix_world.inverted() @ obj.matrix_world
        if max(abs(local[r][c] - Matrix.Identity(4)[r][c])
               for r in range(4) for c in range(4)) > .001:
            raise RuntimeError('Roof authoring basis changed; inspect before editing')
    returns = []
    for center, front, half_width in roof.PAVILIONS:
        left, right = center - half_width - .7, center + half_width + .7
        legacy = [v.co for v in old_trim.data.vertices
                  if left < v.co.x < right and -8.5 < v.co.y < -1.49
                  and 36.85 < v.co.z < 39.81]
        rear_vertices = [v for v in new_trim.data.vertices
                         if left < v.co.x < right and abs(v.co.y + 1.65) < .001
                         and 36.85 < v.co.z < 39.81]
        if not legacy or len(rear_vertices) != 72:
            raise RuntimeError('Expected six complete cornice returns are missing')
        back = min(v.y for v in legacy)
        if not -8.5 < back < -5:
            raise RuntimeError('Front pavilion rear extent is outside inspected range')
        returns.append({'center': center, 'back': back, 'vertices': rear_vertices,
                        'legacyTop': max(v.z for v in legacy), 'cut': (left, right)})
    galleries.archive(old_trim, archive)
    galleries.archive(new_trim, archive)
    # Copy data before changing it: archives and accidental linked duplicates
    # must retain their geometry and material slots.
    old_trim.data = old_trim.data.copy()
    new_trim.data = new_trim.data.copy()
    removed = 0
    for item in returns:
        left, right = item['cut']
        removed += galleries.cut_volume(old_trim, (left, -8.5, 36.85),
                                        (right, -1.49, 39.81), archive)
        # Retrieve vertices from the copied data by stable vertex indices.
        for vertex in item['vertices']:
            new_trim.data.vertices[vertex.index].co.y = item['back']
    new_trim.data.update()
    galleries.uv_metric(new_trim)

    # The inherited opaque glazing proxy was 32% metallic. Keep existing shader
    # bindings and topology, but remove the coloured metallic mirror response.
    glass_materials, glass_objects = {}, []
    for obj in previous.meshes(root):
        slots = [(i, mat) for i, mat in enumerate(obj.data.materials)
                 if mat.get('spaceMaterialId') in GLASS_IDS]
        if not slots:
            continue
        galleries.archive(obj, archive)
        obj.data = obj.data.copy()
        for i, source in slots:
            key = source.get('spaceMaterialId')
            if key not in glass_materials:
                mat = previous.material(source, 'Customs neutral dielectric glazing',
                                        rgb=(47, 53, 53), metal=0, roughness=.34)
                mat['spaceMaterialId'] = REVISION + '/glass-' + str(len(glass_materials))
                glass_materials[key] = mat
            obj.data.materials[i] = glass_materials[key]
        glass_objects.append(obj['spaceId'])
    if len(glass_materials) != 2:
        raise RuntimeError('Expected both retained and new roof glazing materials')
    removed_glass = trim_glazing_at_returns(root, archive)

    # Projectors are visible above the real plinth ledge in the reference.
    # The photo resolves five front-facing fixtures. Dimensions and spacing are
    # estimated; the two oblique side fixtures remain outside this increment.
    tx, cy = root['spaceBundFrontageDetail']['towerCenter']
    face = cy + 7.25
    housing, lenses = Mesh(), Mesh()
    anchors = []
    tilt = Matrix.Rotation(math.radians(120), 4, 'X')
    for offset in PROJECTOR_OFFSETS:
        x, y, z = tx + offset, face + .44, 35.49
        box(housing, (x, y, z + .025), (.37, .30, .05))
        for side in (-1, 1):
            box(housing, (x + side * .21, y, z + .14), (.035, .11, .23))
        head, lens = Mesh(), Mesh()
        box(head, (0, 0, 0), (.40, .16, .26))
        box(lens, (0, .083, 0), (.34, .01, .21))
        origin = Vector((x, y, z + .22))
        for destination, part in ((housing, head), (lenses, lens)):
            for polygon in part.faces:
                destination.face([tilt @ Vector(part.vertices[i]) + origin for i in polygon])
        anchors.append([x, y, z + .22])
    source = by_id[ROOT_ID + '/3'].data.materials[0]
    for label, part, rgb, metal, roughness, illumination in (
            ('plinth-projectors', housing, (39, 43, 41), .5, .45, 0),
            ('plinth-lenses', lenses, (255, 219, 166), .05, .3, 1.2)):
        mat = previous.material(source, 'Customs ' + label, rgb=rgb, metal=metal,
                                roughness=roughness, illumination=illumination)
        mat['spaceMaterialId'] = REVISION + '/' + label
        obj = part.object(root.name + ' ' + label, mat, root, root.users_collection[0])
        obj['spaceId'] = REVISION + '/' + ROOT_ID + '/' + label
        obj['spaceCustomsJunctionPart'] = label
        if label == 'plinth-lenses':
            obj['spaceBundHeroPart'] = 'lamp-lenses'
        galleries.uv_metric(obj)
    detail = {
        'returns': [{k: v for k, v in item.items() if k not in {'vertices', 'cut'}}
                    for item in returns],
        'removedFaces': removed, 'glassObjects': glass_objects,
        'removedOverlappingGlassFaces': removed_glass,
        'glazingMetalness': 0., 'glazingRoughness': .34,
        'plinthProjectors': len(PROJECTOR_OFFSETS), 'projectorAnchors': anchors,
        'estimated': True, 'runtimeLightsUpdated': False,
        'lightingBoundary': 'Fixture geometry only; browser pooled lights need separate verification'}
    root['spaceCustomsJunctionRevision'] = REVISION
    root['spaceCustomsJunctionDetail'] = detail
    return detail


def review(root, label, night=False, corrected_lights=False):
    """Use the common stage; an optional second shot isolates lamp occlusion."""
    hero.OUTPUT = OUTPUT
    hero.review(root, '13', label, night, True, 38, 47)
    if not corrected_lights:
        return
    if not night:
        raise ValueError('Corrected inspection lighting is only meaningful at night')
    lo, hi = previous.bounds(root)
    tx, cy = root['spaceBundFrontageDetail']['towerCenter']
    shift = Vector((-(lo.x + hi.x) / 2, -hi.y, -lo.z))
    # This is diagnostic lighting and must never be saved into the source.
    stage = bpy.context.scene.camera.users_collection[0]
    for index, offset in enumerate(PROJECTOR_OFFSETS):
        data = bpy.data.lights.new('Diagnostic plinth projector ' + str(index), 'AREA')
        data.energy, data.color, data.size = 45, (1, .8, .56), .24
        light = bpy.data.objects.new(data.name, data)
        stage.objects.link(light)
        light.location = Vector((tx + offset, cy + 7.69, 35.85)) + shift
        target = Vector((tx + offset, cy + 7.27, 41)) + shift
        light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.render.filepath = str(OUTPUT / (label + '-13-night-plinth-lighting.png'))
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--baseline', action='store_true')
    modes.add_argument('--review-saved', action='store_true')
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--night', action='store_true')
    parser.add_argument('--corrected-lights', action='store_true')
    parser.add_argument('--label', default='candidate')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.corrected_lights and (not args.night or args.no_render):
        parser.error('Lighting comparison requires a night render')
    if Path(args.label).name != args.label or any(c in args.label for c in '/\\:'):
        parser.error('Label must be a filename component')
    source = ROOT / 'design/space/scenes/shanghai.blend'
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != source or scene.get('space_asset') != 'shanghai' or scene.get('space_contract') != 2:
        raise RuntimeError('Open the repository contract-v2 Shanghai source')
    initial = source.stat()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    exported = [o for o in scene.objects if o.get('space_export')]
    before = Counter(o.get('spaceId') for o in exported)
    transforms = {o.name: o.matrix_world.copy() for o in exported}
    clocks = {o.name: {k: o[k] for k in o.keys() if 'clock' in k.lower()} for o in exported}
    root = next(o for o in exported if o.get('spaceId') == ROOT_ID)
    report = {'revision': REVISION, 'saved': False}
    if args.review_saved:
        if root.get('spaceCustomsJunctionRevision') != REVISION:
            raise RuntimeError('Saved junction revision missing')
    elif not args.baseline:
        archive = bpy.data.collections.new('ARCHIVE before Customs junctions 20260910 (not exported)')
        scene.collection.children.link(archive)
        archive.hide_render = archive.hide_viewport = True
        report['details'] = author(root, archive)
        bpy.context.view_layer.update()
        after = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[k] != count for k, count in before.items()):
            raise RuntimeError('Original runtime ID lost')
        if any(count != 1 for key, count in after.items() if key is not None):
            raise RuntimeError('Duplicate runtime ID')
        if any(not o.data.polygons for o in previous.meshes(root)):
            raise RuntimeError('Empty runtime geometry')
        for obj in exported:
            if obj.matrix_world != transforms[obj.name]:
                raise RuntimeError('Existing object transform changed: ' + obj.name)
            if clocks[obj.name] != {k: obj[k] for k in obj.keys() if 'clock' in k.lower()}:
                raise RuntimeError('Clock binding changed: ' + obj.name)
        if abs(previous.bounds(root)[1].z - 79.2) > .025:
            raise RuntimeError('Clock tower envelope changed')
        report.update(preservedIds=sum(key is not None for key in before),
                      newMeshes=sum(after.values()) - sum(before.values()))
    latest = source.stat()
    if (latest.st_mtime_ns, latest.st_size) != (initial.st_mtime_ns, initial.st_size):
        raise RuntimeError('Source changed during inspection; reopen the current source')
    phase = 'review' if args.review_saved or args.baseline else 'author'
    (OUTPUT / (args.label + '-' + phase + '.json')).write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print('CUSTOMS_JUNCTION_REVIEW ' + json.dumps(report), flush=True)
    if not args.no_render:
        review(root, args.label, args.night, args.corrected_lights)


if __name__ == '__main__':
    main()
