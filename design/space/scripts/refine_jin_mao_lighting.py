"""Add six editable entrance lights to the current Jin Mao scene, without rebuilding it.

Call prepare(scene) in Blender, export normally, review the actual website, then
call save(scene). Existing revisions must be edited in place, never re-created.
Positions follow the existing canopy lamp housings; power is a visual estimate.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

from facade_rig import export_snapshot
from pack_gltf import atomic_write
from refine_jin_mao_podium import CANOPIES, DATA, site_plan
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged

REVISION = 'jin-mao-entrance-lighting-20261103'
PROPERTY = 'spaceJinMaoLightingRevision'
ROOT_ID = 'root/132/0'
OUTPUT = Path(__file__).resolve().parents[3] / '.tmp/png/space-jinmao-lighting-20261103'
_prepared = None


def _geometry(scene):
    # This increment only edits light data and one material extra. Preserve the
    # live artist's meshes, assignments and transforms, including unsaved edits.
    return {o: (o.data, tuple(o.data.materials), o.matrix_world.copy(),
                len(o.data.vertices), len(o.data.polygons))
            for o in scene.objects if o.type == 'MESH'}


def _check_geometry(scene, before):
    after = _geometry(scene)
    if before != after:
        raise RuntimeError('A mesh, assignment or transform changed during the lighting edit')


def prepare(scene):
    global _prepared
    if (Path(bpy.data.filepath).resolve() != SOURCE.resolve()
            or scene.get('space_asset') != 'shanghai' or scene.get('space_contract') != 2):
        raise RuntimeError('Open the current canonical Shanghai source')
    if scene.get(PROPERTY):
        raise RuntimeError('Jin Mao entrance lights already exist; edit the current rig')
    roots = [o for o in scene.objects if o.get('spaceId') == ROOT_ID]
    if len(roots) != 1:
        raise RuntimeError('Expected one Jin Mao root')
    root = roots[0]
    if root.get('spaceFacadeRig') or root.get('facadeLighting'):
        raise RuntimeError('Existing Jin Mao light work must be inspected first')
    if root.get('spaceJinMaoEntrancesRevision') != 'jin-mao-entrances-20260913':
        raise RuntimeError('Expected the current canopy housings and paving')
    materials = {m for o in root.children if o.type == 'MESH' for m in o.data.materials}
    piers = [m for m in materials if m.get('spaceMaterialId') ==
             'jin-mao-finish-20260913/vertical floodlit piers']
    if (len(piers) != 1 or piers[0].get('spaceShaderKey') != 'shanghai-illumination-2.4'
            or 'spaceIlluminationHeight' in piers[0]):
        raise RuntimeError('Inspect the existing pier material before changing its wash')
    token = source_fingerprint()
    geometry = _geometry(scene)
    before = export_snapshot(scene)
    collection = bpy.data.collections.new('AUTHORING | Jin Mao entrance lights (metadata export)')
    scene.collection.children.link(collection)
    inverse = root.matrix_world.inverted()
    local = lambda p: inverse @ Vector((p[0]+218, p[1]-1796, p[2]-.65))
    center = local((0, 0, 6))
    root['facadeLighting'] = {'width': 70., 'height': 12.12,
                             'centre': [center.x, center.z, -center.y], 'washTop': 0.}
    buildings = {b['id']: b for b in json.loads(DATA.read_text())['polygons']}
    for entrance_index, entrance in enumerate(('south', 'east', 'north')):
        polygon = site_plan(buildings[CANOPIES[entrance]])
        coords = polygon if entrance == 'east' else [(y, -x) for x, y in polygon]
        u0, u1 = min(p[0] for p in coords), max(p[0] for p in coords)
        v0, v1 = min(p[1] for p in coords), max(p[1] for p in coords)
        point = (lambda u, v, z: (u, v, z)) if entrance == 'east' else (lambda u, v, z: (-v, u, z))
        inner = u1 if entrance == 'south' else u0
        outer = u0+2 if entrance == 'south' else u1-2
        for index, (v, height, target_u, target_z, power) in enumerate((
                (v0+4, 4.70, inner, 2.4, 180.),
                (v0+9, 4.05, outer, .4, 60.))):
            name = f'Jin Mao {entrance} entrance {index+1}'
            data = bpy.data.lights.new(name, 'SPOT')
            lamp = bpy.data.objects.new(name, data)
            collection.objects.link(lamp)
            lamp.parent = root
            lamp.location = local(point((u0+u1)/2, v, height))
            target = local(point(target_u, (v0+v1)/2, target_z))
            lamp.rotation_euler = (target-lamp.location).to_track_quat('-Z', 'Y').to_euler()
            srgb = (1., 233/255, 207/255)
            data.color = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb]
            data.energy = power*.05
            data.spot_size = math.pi*.64
            data.spot_blend = .8
            data.use_custom_distance = True
            data.cutoff_distance = 32.
            data.shadow_soft_size = .15
            lamp['spaceFacadeSlot'] = entrance_index*2+index
            lamp['spaceCandela'] = power
            lamp['space_export'] = False
            lamp['spaceLightingEstimate'] = 'Aggregate canopy downlights; position and power estimated'
    root['spaceFacadeRig'] = REVISION
    piers[0]['spaceIlluminationHeight'] = {'bottom': 10., 'top': 45.}
    root[PROPERTY] = scene[PROPERTY] = REVISION
    bpy.context.view_layer.update()
    _check_geometry(scene, geometry)
    after = export_snapshot(scene)
    if any(after[key] != value for key, value in before.items()) or len(after) != len(before)+1:
        raise RuntimeError('Existing city light rigs changed')
    assert_source_unchanged(token)
    report = {'revision': REVISION, 'saved': False, 'sourceBefore': list(token),
              'root': ROOT_ID, 'previousRigsPreserved': list(before), 'rig': after[ROOT_ID],
              'heightFade': piers[0]['spaceIlluminationHeight'].to_dict(),
              'preservedMeshes': len(geometry), 'newLights': 6,
              'estimated': ['Aggregate lamp placement', 'Candela', 'Pier wash transition heights']}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    atomic_write(OUTPUT/'candidate.json', (json.dumps(report, indent=2)+'\n').encode())
    _prepared = (token, geometry, report)
    return report


def save(scene):
    if _prepared is None or scene.get(PROPERTY) != REVISION:
        raise RuntimeError('Prepare and review this live increment first')
    token, geometry, report = _prepared
    _check_geometry(scene, geometry)
    assert_source_unchanged(token)
    rig = export_snapshot(scene)[ROOT_ID]
    root = next(o for o in scene.objects if o.get('spaceId') == ROOT_ID)
    # An interactive export may leave this derived cache in the live scene.
    # Keep the native lights as the editable source, as in the normal pipeline.
    if 'lamps' in root['facadeLighting']:
        del root['facadeLighting']['lamps']
    # The maintainer explicitly declined automatic/operation-before backups.
    # Restore the user's preference immediately; do not persist a host setting.
    versions = bpy.context.preferences.filepaths.save_version
    try:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    finally:
        bpy.context.preferences.filepaths.save_version = versions
    final = {**report, 'saved': True, 'sourceAfter': list(source_fingerprint()), 'rig': rig}
    atomic_write(OUTPUT/'saved.json', (json.dumps(final, indent=2)+'\n').encode())
    return final
