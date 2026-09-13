"""Incremental X/Y/Z envelope detail; references/alibaba-xuhui.md records limits.

Run on canonical shanghai.blend, preview --round 1 then --round 2. Only a reviewed
round 2 with the same source and script fingerprint may be saved using --apply.
No original building massing, planting or authoring light rigs are regenerated.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from refine_alibaba_campus import DX, DY, LEVELS, occupied, material
from refine_alibaba_districts import geometry_digest, z_occupied
from refine_alibaba_glazing import replace_mesh, tune
from refine_bund_entrances import box, cylinder
from refine_jin_mao import Mesh
from refine_peace_crown import ROOT, SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot

REVISION = 'alibaba-envelope-20260912'
OUTPUT = ROOT / '.tmp/png/space-alibaba-envelope-20260912'
PREFIX = 'authored/alibaba-xuhui-'


def signature(points):
    # Blender stores float32 vertices; normalize generated float64 coordinates
    # before quantizing, so half-millimetre edges match their saved originals.
    return tuple(sorted(tuple(round(float(c), 3) for c in Vector(p)) for p in points))


def splice(obj, removed, added):
    """Replace only exactly matched faces, keeping all remaining vertex UVs."""
    expected = Counter(signature([removed.vertices[i] for i in face]) for face in removed.faces)
    mesh, data = Mesh(), obj.data
    uv = data.uv_layers.active
    for polygon in data.polygons:
        points = [data.vertices[i].co.copy() for i in polygon.vertices]
        key = signature(points)
        if expected[key]:
            expected[key] -= 1
        else:
            mesh.face(points, [tuple(uv.data[i].uv) for i in polygon.loop_indices] if uv else None)
    if any(expected.values()):
        raise RuntimeError('Original detail changed; refusing partial patch: '+obj.name+' '+str(sum(expected.values())))
    for face in added.faces:
        mesh.face([added.vertices[i] for i in face], [added.uv[i] for i in face])
    replace_mesh(obj, mesh)
    layer = obj.data.uv_layers.new(name='UVMap')
    for loop in obj.data.loops:
        layer.data[loop.index].uv = mesh.uv[loop.vertex_index]
    obj['spaceAlibabaEnvelopeRevision'] = REVISION


def add_part(mesh, parent, key, mat):
    obj = mesh.object('Alibaba '+key, mat, parent, parent.users_collection[0])
    obj['spaceId'] = parent['spaceId']+'/'+key
    obj['spaceAlibabaEnvelopeRevision'] = REVISION
    obj['spaceAlibabaEstimated'] = True
    return obj


def x_envelope(objects, round_number):
    wings = [o for o in objects.values() if o.type == 'EMPTY' and o.parent
             and o.parent.get('spaceId') == PREFIX+'x']
    if len(wings) != 7:
        raise RuntimeError('Expected all seven X wings')
    backing = material('X recessed office walls', (155, 161, 153), rough=.82, light=.015)
    backing['spaceMaterialId'] = REVISION+'/x-backwall'
    metal = objects[PREFIX+'z/silver'].data.materials[0]
    changed, added, office_count = [], [], 0
    for wing in wings:
        identity = wing['spaceId']
        glass, office = objects[identity+'/x-glass'], objects[identity+'/office']
        if any(len(p.vertices) != 4 for p in glass.data.polygons):
            raise RuntimeError('X glazing must retain its original planar wall quads')
        surfaces, depth, screens, moved = [], Mesh(), Mesh(), Mesh()
        for polygon in glass.data.polygons:
            points = [glass.data.vertices[i].co.copy() for i in polygon.vertices]
            a, b, d, c = points
            normal = Vector(((b-a).y, -(b-a).x, 0)).normalized()
            z0, z1 = a.z, c.z
            surfaces.append((a, c, normal, z0, z1))
            depth.face([p-normal*2.4 for p in points])
            # Physical ceiling, sill and spandrel behind the continuous glass.
            depth.face([a-normal*.1, b-normal*.1, b-normal*2.4, a-normal*2.4])
            depth.face([c-normal*2.4, d-normal*2.4, d-normal*.1, c-normal*.1])
            e, f = a.lerp(c, .22), b.lerp(d, .22)
            depth.face([a-normal*.17, b-normal*.17, f-normal*.17, e-normal*.17])
            # Inset room returns create parallax without inventing a full fitout.
            for n in range(1, max(2, round((b-a).length/6))):
                u = n/max(2, round((b-a).length/6))
                low, high = a.lerp(b, u), c.lerp(d, u)
                depth.face([low-normal*.8, low-normal*2.4, high-normal*2.4, high-normal*.8])
        for polygon in office.data.polygons:
            pts = [office.data.vertices[i].co.copy() for i in polygon.vertices]
            centre = sum(pts, Vector())/len(pts)
            candidates = [(abs((centre-a.lerp(c, (centre.z-lo)/(hi-lo))).dot(n)), n)
                          for a, c, n, lo, hi in surfaces if lo < centre.z < hi]
            distance, normal = min(candidates, key=lambda pair: pair[0])
            if distance > .03:
                raise RuntimeError('X occupied window no longer lies on its original facade')
            moved.face([p-normal*2.25 for p in pts])
            office_count += 1
        replace_mesh(office, moved)
        office['spaceAlibabaEnvelopeRevision'] = REVISION
        changed.extend([glass, office])
        # Preserve the pre-existing mechanical block and fill its three bare sides.
        graphite = objects[identity+'/graphite']
        top = max(v.co.z for v in glass.data.vertices)
        roof_vertices = [v.co for v in graphite.data.vertices if abs(v.co.z-(top+1.6)) < .001]
        if len(roof_vertices) < 4:
            raise RuntimeError('Missing reviewed rooftop mechanical enclosure')
        cx = (min(v.x for v in roof_vertices)+max(v.x for v in roof_vertices))/2
        cy = (min(v.y for v in roof_vertices)+max(v.y for v in roof_vertices))/2
        for n in range(8):
            z = top+.14+n*.18
            box(screens, (cx, cy+3.55, z), (8, .16, .045))
            for sign in (-1, 1):
                box(screens, (cx+sign*4.05, cy, z), (.16, 7, .045))
        for xx in (-2, 2):
            cylinder(screens, cx+xx, cy, top+1.89, top+1.96, .16, steps=12)
            for n in range(8):
                angle = n*math.tau/8
                screens.beam((cx+xx+.16*math.cos(angle), cy+.16*math.sin(angle), top+1.91),
                             (cx+xx+.96*math.cos(angle+.24), cy+.96*math.sin(angle+.24), top+1.91), .085, .018)
            for offset in (-.65, -.32, 0, .32, .65):
                half = math.sqrt(1-offset*offset)
                screens.beam((cx+xx+offset, cy-half, top+1.99),
                             (cx+xx+offset, cy+half, top+1.99), .022)
        added.extend([add_part(depth, wing, 'recessed-office-shell', backing),
                      add_part(screens, wing, 'mechanical-screen-detail', metal)])
    for mat in {objects[o['spaceId']+'/x-glass'].data.materials[0] for o in wings}:
        tune(mat, (230, 239, 237), .055 if round_number == 1 else .025, transmission=.96)
        mat.use_backface_culling = True
    for mat in {objects[o['spaceId']+'/office'].data.materials[0] for o in wings}:
        # The first web review was too dark after moving the occupied windows
        # behind the glass; retain sparse occupancy with a modest interior lift.
        tune(mat, (191, 184, 165), .8, illumination=.16 if round_number == 1 else .22)
    return changed, added, {'wings': len(wings), 'recessedOccupiedWindows': office_count, 'fanGrilles': 14}


def y_envelope(objects, round_number):
    root = objects[PREFIX+'y']
    silver, light, dark, frame = (objects[PREFIX+'y/'+key] for key in ('silver', 'light', 'dark', 'frame'))
    removed, added = ({k: Mesh() for k in ('silver', 'light', 'dark', 'frame')} for _ in range(2))
    folded, seams, doors = Mesh(), Mesh(), Mesh()
    ceilings, bays, door_count, cleared_doors = 0, 0, 0, 0
    entrances = {(5, 0, 0, -1), (2, 0, 0, -1), (5, 1, -1, 0), (2, 1, 1, 0)}
    for k in range(11):
        z0, z1 = LEVELS[k:k+2]
        for i in range(8):
            for j in range(8):
                if not occupied(i, j, k):
                    continue
                x, y = (i-3.5)*DX, (j-3.5)*DY
                if k > 0 and not occupied(i, j, k-1):
                    ceilings += 1
                    for n in range(12):
                        xx = x-DX/2+.5+n*(DX-1)/11
                        box(removed['silver'], (xx, y, z0-.18), (.055, DY, .25))
                        if n % 2 == 0:
                            box(removed['light'], (xx+.1, y, z0-.195), (.07, DY-.7, .03))
                    pitch_count = 36 if round_number == 1 else 48
                    for n in range(pitch_count):
                        xx = x-DX/2+.16+(n+.5)*(DX-.32)/pitch_count
                        box(added['silver'], (xx, y, z0-.17), (.04, DY-.14, .22))
                        if n % 2 == 0:
                            # Similar emitting area to the six original strips.
                            box(added['light'], (xx+.05, y, z0-.285), (.84/pitch_count, DY-.7, .025))
                    for yy in (-DY/2+.18, DY/2-.18):
                        box(folded, (x, y+yy, z0-.17), (DX, .12, .23))
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if occupied(i+di, j+dj, k):
                        continue
                    bays += 1
                    normal, along = Vector((di, dj, 0)), Vector((-dj, di, 0))
                    origin = Vector((x+di*DX/2, y+dj*DY/2, 0))
                    width = DY if di else DX
                    def pt(u, v, z):
                        return origin+along*u+normal*v+Vector((0, 0, z))
                    def fc(mesh, u, v, z, w, d, h):
                        box(mesh, pt(u, v, z), (d, w, h) if di else (w, d, h))
                    # Folded aluminum returns and real gaps between individual
                    # cassettes follow the documented silver-cladding closeup.
                    for q in range(6):
                        a, b = -width/2+q*width/6+.014, -width/2+(q+1)*width/6-.014
                        for z, sign in ((z0+.17, 1), (z1-.15, -1)):
                            folded.face([pt(a, .355, z), pt(b, .355, z),
                                         pt(b, -.43, z+sign*.29), pt(a, -.43, z+sign*.29)])
                        if q:
                            for z, sign in ((z0+.17, 1), (z1-.15, -1)):
                                seams.beam(pt(a-.014, .351, z), pt(a-.014, -.43, z+sign*.29), .012)
                    if k == 0:
                        # Existing ground-floor doors were crossed by continuous
                        # fins and a 35 cm plinth. Clear every existing opening.
                        cleared_doors += 1
                        gap = 3.6 if (i, j, di, dj) in entrances else 1.55
                        for n in range(1, 4):
                            z = z0+(z1-z0)*n/5
                            fc(removed['silver'], 0, -.09, z, width-.38, .43, .09)
                            span = (width-.38-gap)/2
                            for sign in (-1, 1):
                                fc(added['silver'], sign*(gap+span)/2, -.09, z, span, .43, .09)
                        fc(removed['frame'], 0, 0, .19, width, .7, .32)
                        span = (width-gap)/2
                        for sign in (-1, 1):
                            fc(added['frame'], sign*(gap+span)/2, 0, .19, span, .7, .32)
                    if k == 0 and (i, j, di, dj) in entrances:
                        door_count += 1
                        for u in (-.75, 0, .75):
                            fc(removed['dark'], u, -.2, 1.65, .045, .1, 3.3)
                        fc(removed['silver'], 0, -.2, 3.3, 1.55, .12, .06)
                        for u in (-.12, .12):
                            fc(removed['silver'], u, -.12, 1.2, .032, .12, .65)
                        # Deep portal, two glass leaves, visible pull bars and
                        # closer housings. Dimensions are reference estimates.
                        for u in (-1.75, 0, 1.75):
                            fc(doors, u, -.18, 1.66, .065, .24, 3.3)
                        for z in (.10, 3.29):
                            fc(doors, 0, -.18, z, 3.56, .24, .08)
                        for u in (-.92, .92):
                            fc(doors, u, -.05, 3.12, .4, .12, .075)
                            for sign in (-1, 1):
                                fc(doors, u+sign*.65, -.11, .2, .065, .17, .16)
                        for u in (-.18, .18):
                            fc(folded, u, .025, 1.35, .035, .035, .85)
                            for z in (.95, 1.75):
                                fc(folded, u, -.04, z, .035, .16, .035)
                        fc(folded, 0, -.12, .055, 3.6, .5, .035)
    if bays != 496 or door_count != 4:
        raise RuntimeError('Y opening inventory changed')
    for key, obj in (('silver', silver), ('light', light), ('dark', dark), ('frame', frame)):
        splice(obj, removed[key], added[key])
    detail = [add_part(folded, root, 'folded-panel-returns', silver.data.materials[0]),
              add_part(seams, root, 'panel-joint-reveals', objects[PREFIX+'y/dark'].data.materials[0]),
              add_part(doors, root, 'entrance-door-hardware', objects[PREFIX+'y/dark'].data.materials[0])]
    return [silver, light, dark, frame], detail, {'bays': bays, 'soffitCells': ceilings,
        'soffitFinsPerCell': pitch_count, 'doorPortals': door_count,
        'clearedExistingDoorways': cleared_doors, 'cassetteFaces': bays*12}


def z_envelope(objects):
    root = objects[PREFIX+'z']
    joints, trim = Mesh(), Mesh()
    ceilings, panels = 0, 0
    dx, dy, h = 12.8, 13, 4.9
    for k in range(10):
        for i in range(10):
            for j in range(6):
                if not z_occupied(i, j, k):
                    continue
                x, y, z = (i-4.5)*dx, (j-2.5)*dy, k*h
                if not z_occupied(i, j, k-1):
                    ceilings += 1
                    for n in range(1, 8):
                        box(joints, (x-dx/2+n*dx/8, y, z-.119), (.018, dy, .012))
                    for n in range(1, 5):
                        box(joints, (x, y-dy/2+n*dy/5, z-.119), (dx, .018, .012))
                    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        if z_occupied(i+di, j+dj, k):
                            continue
                        box(trim, (x+di*dx/2, y+dj*dy/2, z-.1),
                            (.045, dy, .12) if di else (dx, .045, .12))
                if k >= 8 and not z_occupied(i, j, k+1):
                    level = (k+1)*h
                    for row in range(5):
                        panels += 1
                        yy = y-4+row*1.7
                        for sign in (-1, 1):
                            box(trim, (x, yy+sign*.765, level+.43), (dx-1.32, .035, .11))
                        for xx in (-3.5, 3.5):
                            box(trim, (x+xx, yy, level+.24), (.065, 1.5, .32))
    created = [add_part(joints, root, 'soffit-panel-joints', objects[PREFIX+'z/graphite'].data.materials[0]),
               add_part(trim, root, 'soffit-drips-and-pv-frames', objects[PREFIX+'z/silver'].data.materials[0])]
    return created, {'soffitCells': ceilings, 'solarPanelFrames': panels, 'evidence': 'SOM design 2022, not verified as-built'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', choices=(1, 2), type=int, default=1)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != SOURCE.resolve() or scene.get('space_contract') != 2
            or scene.get('spaceAlibabaLandscapeRevision') != 'alibaba-landscape-20260912'
            or scene.get('spaceAlibabaEnvelopeRevision')):
        raise RuntimeError('Expected current canonical campus, without this envelope pass')
    token = source_fingerprint()
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if args.apply:
        candidate = json.loads((OUTPUT/'round-2.json').read_text(encoding='utf8'))
        if args.round != 2 or candidate['sourceBefore'] != list(token) or candidate['scriptSha256'] != script_hash:
            raise RuntimeError('Only the unchanged reviewed second candidate can be saved')
    original = list(scene.objects)
    objects = {o['spaceId']: o for o in original if o.get('space_export') and o.get('spaceId')}
    modified_ids = {PREFIX+'y/'+key for key in ('silver', 'light', 'dark', 'frame')} | {
        identity for identity in objects if identity.startswith(PREFIX+'x/') and identity.endswith('/office')}
    unaffected = [o for o in original if o.get('spaceId') not in modified_ids]
    digest, rigs = geometry_digest(unaffected), export_snapshot(scene)
    ids = Counter(o['spaceId'] for o in original if o.get('space_export') and o.get('spaceId'))
    xc, xa, xr = x_envelope(objects, args.round)
    yc, ya, yr = y_envelope(objects, args.round)
    za, zr = z_envelope(objects)
    added = xa+ya+za
    bpy.context.view_layer.update()
    if geometry_digest(unaffected) != digest or export_snapshot(scene) != rigs:
        raise RuntimeError('Unrelated geometry, transforms or facade rigs changed')
    after = Counter(o['spaceId'] for o in scene.objects if o.get('space_export') and o.get('spaceId'))
    if after != ids+Counter(o['spaceId'] for o in added) or any(n != 1 for n in after.values()):
        raise RuntimeError('Export identity collision or loss')
    report = {'revision': REVISION, 'round': args.round, 'saved': False,
        'sourceBefore': list(token), 'scriptSha256': script_hash, 'x': xr, 'y': yr, 'z': zr,
        'newObjects': [o['spaceId'] for o in added], 'changedObjects': [o['spaceId'] for o in xc+yc],
        'preservedGeometry': digest, 'preservedRigs': list(rigs)}
    OUTPUT.mkdir(exist_ok=True, parents=True)
    assert_source_unchanged(token)
    if args.apply:
        backup = OUTPUT/'shanghai-before-envelope.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite existing backup')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene['spaceAlibabaEnvelopeRevision'] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    else:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in xc+yc+added:
            obj.hide_set(False)
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/f'round-{args.round}.glb'),
            export_format='GLB', use_selection=True, export_extras=True, export_attributes=True,
            export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    (OUTPUT/('saved.json' if args.apply else f'round-{args.round}.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('ENVELOPE_RESULT '+json.dumps(report))


if __name__ == '__main__':
    main()
