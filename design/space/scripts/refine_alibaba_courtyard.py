"""Incremental Y courtyard hardscape, using the photographed material layout.

See ../references/alibaba-xuhui.md. Tile sizes, bed lengths and plant species
are visual estimates, not survey data. Preview both rounds on the canonical
source; --round 2 --apply requires the unchanged reviewed candidate.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import random
import shutil
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from facade_rig import export_snapshot
from refine_alibaba_campus import occupied, material
from refine_alibaba_districts import geometry_digest
from refine_alibaba_envelope import splice
from refine_alibaba_glazing import replace_mesh, tune
from refine_alibaba_landscape import metric_uv
from refine_bund_entrances import box
from refine_jin_mao import Mesh
from refine_peace_crown import ROOT, SOURCE, source_fingerprint, assert_source_unchanged

REVISION = 'alibaba-courtyard-20260912'
OUTPUT = ROOT / '.tmp/png/space-alibaba-courtyard-20260912'
Y = 'authored/alibaba-xuhui-y'
BEDS = [(-7, -20), (7, 22), (-7, 30), (7, -30)]


def add(mesh, root, key, mat):
    obj = mesh.object('Alibaba courtyard '+key, mat, root, root.users_collection[0])
    obj['spaceId'] = Y+'/'+key
    obj['spaceAlibabaCourtyardRevision'] = REVISION
    obj['spaceAlibabaEstimated'] = True
    return obj


def in_public_court(x, y):
    i, j = math.floor((x+54)/13.5), math.floor((y+42)/10.5)
    return not occupied(i, j, 0)


def paving(objects, round_number):
    """Flush small slabs and recessed linear drains; no overlapping floor caps."""
    root = objects[Y]
    slabs, bands, grilles = [Mesh() for _ in range(3)], Mesh(), Mesh()
    pitch = 1.0 if round_number == 1 else .75
    gap, width = .008, .3
    drains = (-9.75, 9.75)
    xs = sorted({-58, 58} | {n*pitch for n in range(math.ceil(-58/pitch), math.floor(58/pitch)+1)}
                | {x+sign*width/2 for x in drains for sign in (-1, 1)}
                | {-54, -13.5, 13.5, 54})
    ys = sorted({-46, 46, -42, 42} | {n*pitch for n in range(math.ceil(-46/pitch), math.floor(46/pitch)+1)})
    rng, count = random.Random(20260912), 0
    for a, b in zip(xs, xs[1:]):
        for c, d in zip(ys, ys[1:]):
            x, y = (a+b)/2, (c+d)/2
            if b-a < gap or d-c < gap or not in_public_court(x, y):
                continue
            if any(abs(x-drain) < width/2 for drain in drains):
                continue
            mesh = slabs[rng.choices(range(3), weights=(1, 3, 1))[0]]
            # A 2 mm chamfer catches grazing light without chunky raised tiles.
            a0, b0, c0, d0 = a+gap/2, b-gap/2, c+gap/2, d-gap/2
            low = [(a0,c0,.012), (b0,c0,.012), (b0,d0,.012), (a0,d0,.012)]
            top = [(a0+.002,c0+.002,.014), (b0-.002,c0+.002,.014),
                   (b0-.002,d0-.002,.014), (a0+.002,d0-.002,.014)]
            mesh.face(top, [(p[0]/2, p[1]/2) for p in top])
            for n in range(4):
                q = (n+1) % 4
                pts = [low[n], low[q], top[q], top[n]]
                mesh.face(pts, [(p[0]/2, p[1]/2) for p in pts])
            count += 1
    # Keep the original joint object's identity, replacing its oversized grid.
    for x in drains:
        box(bands, (x, 0, .002), (width, 92, .012))
        for dx in (-width/2+.028, 0, width/2-.028):
            box(grilles, (x+dx, 0, .010), (.018, 91.96, .007))
        for n in range(460):
            box(grilles, (x, -45.9+n*.2, .010), (width-.028, .025, .007))
    replace_mesh(objects[Y+'/joint'], bands)
    objects[Y+'/joint']['spaceAlibabaCourtyardRevision'] = REVISION
    metric_uv(objects[Y+'/joint'], 2)
    added = []
    for i, mesh in enumerate(slabs):
        mat = objects[Y+'/paving'].data.materials[0].copy()
        mat.name = 'Y fine granite '+str(i)
        mat['spaceMaterialId'] = REVISION+'/granite-'+str(i)
        rgb = [(147, 151, 147), (154, 157, 153), (160, 162, 157)][i]
        tune(mat, rgb, .8, metal=.02)
        for node in mat.node_tree.nodes:
            if node.type == 'NORMAL_MAP':
                node.inputs['Strength'].default_value = .09
        added.append(add(mesh, root, 'granite-slabs-'+str(i), mat))
    mat = material('Y drainage brushed steel', (116, 123, 119), metal=.48, rough=.48)
    mat['spaceMaterialId'] = REVISION+'/drain-steel'
    added.append(add(grilles, root, 'courtyard-drain-grilles', mat))
    return added, {'slabs': count, 'pitchMetres': pitch, 'gapMetres': gap,
                   'drainLengthMetres': 184, 'drainCrossbars': 920}


def planting(objects, round_number):
    """Extend only four existing ground beds; retain trees and rooftop planting."""
    old_walls, walls, old_soil, soil = Mesh(), Mesh(), Mesh(), Mesh()
    old_half, new_half, rim = 4.455/2, (3.3 if round_number == 1 else 3.75), .16
    # Read the saved float32 wall vertices. Reconstructing their half-millimetre
    # bounds in float64 can round to different splice signatures.
    for key, target, expected in (('planter', old_walls, 24), ('trunk', old_soil, 1)):
        data = objects[Y+'/'+key].data
        for x, y in BEDS:
            matched = 0
            for polygon in data.polygons:
                points = [data.vertices[i].co.copy() for i in polygon.vertices]
                if (all(abs(p.x-x) <= old_half+.0001 and abs(p.y-y) <= old_half+.0001
                        and .0799 <= p.z <= .7801 for p in points)
                        and (key == 'planter' or all(abs(p.z-.66) < .0001 for p in points))):
                    target.face(points)
                    matched += 1
            if matched != expected:
                raise RuntimeError(f'Unexpected ground bed {key} at {x},{y}: {matched}')
    for x, y in BEDS:
        for sign in (-1, 1):
            box(walls, (x+sign*(old_half-rim/2), y, .43), (rim, new_half*2, .7))
            box(walls, (x, y+sign*(new_half-rim/2), .43), (old_half*2-2*rim, rim, .7))
        a, b, c, d = x-old_half+rim, y-new_half+rim, x+old_half-rim, y+new_half-rim
        soil.face([(a,b,.66), (c,b,.66), (c,d,.66), (a,d,.66)])
    for key, removed, added in (('planter', old_walls, walls), ('trunk', old_soil, soil)):
        splice(objects[Y+'/'+key], removed, added)
        objects[Y+'/'+key]['spaceAlibabaCourtyardRevision'] = REVISION
        metric_uv(objects[Y+'/'+key], .65 if key == 'trunk' else 2)

    shrubs, normals = [Mesh(), Mesh()], [[], []]
    rng, cards = random.Random(395804), 0
    spacing = .23 if round_number == 1 else .18
    for x, y in BEDS:
        # Narrow clipped hedges around the perimeter leave soil at each trunk.
        hx, hy = old_half-rim-.22, new_half-rim-.22
        for ix in range(math.ceil(hx*2/spacing)):
            for iy in range(math.ceil(hy*2/spacing)):
                xx, yy = -hx+(ix+.5)*spacing, -hy+(iy+.5)*spacing
                if abs(xx) < hx-.62 and abs(yy) < hy-.8:
                    continue
                z = 1.04+rng.uniform(-.055, .055)
                for level in (0, -.2):
                    centre = Vector((x+xx+rng.uniform(-.055, .055), y+yy+rng.uniform(-.055, .055), z+level))
                    angle = rng.uniform(0, math.tau)
                    u = Vector((math.cos(angle), math.sin(angle), rng.uniform(-.3, .3))).normalized()*.23
                    v = Vector((-math.sin(angle)*.6, math.cos(angle)*.6, .8))*.103
                    index = rng.randrange(2)
                    # Reuse the packed photographed twig atlas, not opaque boxes.
                    shrubs[index].face([centre-u-v, centre-u+v, centre+u+v, centre+u-v],
                                       [(.002,.005), (.445,.005), (.445,.995), (.002,.995)])
                    outward = Vector((xx/hx, yy/hy, 2)).normalized()
                    normals[index].extend([outward]*4)
                    cards += 1
    added = []
    for i, (mesh, key) in enumerate(zip(shrubs, ('foliage', 'leaf-light'))):
        obj = add(mesh, objects[Y], 'courtyard-hedge-'+str(i), objects[Y+'/'+key].data.materials[0])
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.normals_split_custom_set_from_vertices(normals[i])
        added.append(obj)
    return added, {'extendedBeds': 4, 'bedMetres': [4.455, new_half*2], 'hedgeCards': cards}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', type=int, choices=(1, 2), default=1)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != SOURCE.resolve() or scene.get('space_contract') != 2
            or scene.get('spaceAlibabaEnvelopeRevision') != 'alibaba-envelope-20260912'
            or scene.get('spaceAlibabaCourtyardRevision')):
        raise RuntimeError('Expected canonical reviewed envelope without this courtyard pass')
    token = source_fingerprint()
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if args.apply:
        candidate = json.loads((OUTPUT/'round-2.json').read_text(encoding='utf8'))
        if args.round != 2 or candidate['sourceBefore'] != list(token) or candidate['scriptSha256'] != script_hash:
            raise RuntimeError('Only the unchanged reviewed second candidate can be saved')
    original = list(scene.objects)
    objects = {o['spaceId']: o for o in original if o.get('space_export') and o.get('spaceId')}
    modified_ids = {Y+'/'+key for key in ('joint', 'planter', 'trunk')}
    unaffected = [o for o in original if o.get('spaceId') not in modified_ids]
    digest, rigs = geometry_digest(unaffected), export_snapshot(scene)
    ids = Counter(o['spaceId'] for o in original if o.get('space_export') and o.get('spaceId'))
    pa, pr = paving(objects, args.round)
    ha, hr = planting(objects, args.round)
    added = pa+ha
    bpy.context.view_layer.update()
    if geometry_digest(unaffected) != digest or export_snapshot(scene) != rigs:
        raise RuntimeError('Unrelated geometry, transforms or facade rigs changed')
    after = Counter(o['spaceId'] for o in scene.objects if o.get('space_export') and o.get('spaceId'))
    if after != ids+Counter(o['spaceId'] for o in added) or any(n != 1 for n in after.values()):
        raise RuntimeError('Export identity collision or loss')
    report = {'revision': REVISION, 'round': args.round, 'saved': False,
        'sourceBefore': list(token), 'scriptSha256': script_hash, 'paving': pr, 'planting': hr,
        'newObjects': [o['spaceId'] for o in added], 'changedObjects': sorted(modified_ids),
        'preservedGeometry': digest, 'preservedRigs': list(rigs)}
    OUTPUT.mkdir(exist_ok=True, parents=True)
    assert_source_unchanged(token)
    if args.apply:
        backup = OUTPUT/'shanghai-before-courtyard.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite existing backup')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene['spaceAlibabaCourtyardRevision'] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    else:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [objects[key] for key in modified_ids]+added:
            obj.hide_set(False)
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/f'round-{args.round}.glb'),
            export_format='GLB', use_selection=True, export_extras=True, export_attributes=True,
            export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    (OUTPUT/('saved.json' if args.apply else f'round-{args.round}.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('COURTYARD_RESULT '+json.dumps(report))


if __name__ == '__main__':
    main()
