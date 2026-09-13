"""Incremental campus glazing, office depth and foliage, September 2026.

References: ../references/alibaba-xuhui.md. Interior fitout, vegetation and
photometry are visual estimates. Run against canonical shanghai.blend, preview
first, then --apply. Follow with --polish-glass preview / --polish-glass --apply
for the separately reviewed clear-glass finish, then --balance-night preview /
--balance-night --apply for window brightness. Existing light rigs stay intact.
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
from refine_alibaba_campus import DX, DY, LEVELS, occupied, material
from refine_alibaba_districts import geometry_digest
from refine_bund_entrances import box
from refine_jin_mao import Mesh, linear
from refine_peace_crown import ROOT, SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot

REVISION = 'alibaba-glazing-foliage-20260912'
OUTPUT = ROOT / '.tmp/png/space-alibaba-refinement-20260912'
Y = 'authored/alibaba-xuhui-y'
XZ = 'alibaba-xz-20260912/'


def tune(mat, rgb, rough, metal=0, transmission=0, illumination=0):
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    color = tuple(linear(c / 255) for c in rgb) + (1,)
    mat.diffuse_color = color
    mat.metallic, mat.roughness = metal, rough
    for name, value in [('Base Color', color), ('Metallic', metal),
                        ('Roughness', rough), ('Transmission Weight', transmission), ('IOR', 1.45)]:
        node.inputs[name].default_value = value
    mat['spaceIllumination'] = illumination


def replace_mesh(obj, mesh):
    # Keep object identity/transforms; retain the previous data locally for edit
    # recovery as well as the whole-source backup. Unused datablocks do not export.
    previous = obj.data
    previous.use_fake_user = True
    data = bpy.data.meshes.new(obj.name + ' glazing refinement')
    data.from_pydata(mesh.vertices, [], mesh.faces)
    data.update()
    for mat in previous.materials:
        data.materials.append(mat)
    obj.data = data
    obj['spaceAlibabaSurfaceRevision'] = REVISION


def office_depth(objects, root):
    original = {key: Mesh() for key in ('glass-lit', 'glass-dim')}
    backs = {key: Mesh() for key in original}
    parts = {key: Mesh() for key in ('desks', 'chairs', 'blinds')}
    bays = 0
    for k in range(11):
        z0, z1 = LEVELS[k:k+2]
        h = z1-z0
        for i in range(8):
            for j in range(8):
                if not occupied(i, j, k):
                    continue
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if occupied(i+di, j+dj, k):
                        continue
                    bays += 1
                    width = DY if di else DX
                    normal, along = Vector((di, dj, 0)), Vector((-dj, di, 0))
                    origin = Vector(((i-3.5)*DX+di*DX/2, (j-3.5)*DY+dj*DY/2, 0))

                    def fc(mesh, u, v, z, w, d, hh):
                        box(mesh, origin+along*u+normal*v+Vector((0, 0, z)),
                            (d, w, hh) if di else (w, d, hh))

                    lit = k in (0, 1, 2, 3, 5, 6, 8, 9) and not (i < 2 and j > 5 and k > 5)
                    for q in range(6):
                        u = -width/2+(q+.5)*width/6
                        fc(original['glass-dim'], u, -.47, (z0+z1)/2, width/6-.07, .03, h-.65)
                        if lit:
                            fc(original['glass-lit'], u, -.445, z0+h*.63, width/6-.07, .012, h*.57)
                        # A physical wall behind the glazing, with a dark lower
                        # panel. Contiguous occupied zones avoid random twinkles.
                        fc(backs['glass-dim'], u, -3.95, z0+h*.19,
                           width/6-.04, .06, h*.28)
                        fc(backs['glass-lit' if lit else 'glass-dim'], u, -4,
                           z0+h*.62, width/6-.04, .06, h*.57)
                        if q in (1, 4):
                            fc(parts['desks'], u, -2.4, z0+.78, 1.6, .85, .065)
                            for side in (-.66, .66):
                                fc(parts['chairs'], u+side, -2.4, z0+.37, .04, .6, .72)
                            fc(parts['chairs'], u, -2.62, z0+1.08, .56, .06, .36)
                            fc(parts['chairs'], u, -1.62, z0+.45, .45, .43, .07)
                            fc(parts['chairs'], u, -1.38, z0+.73, .44, .06, .5)
                        if (q//2+i+j+k) % 4 == 0:
                            for slat in range(8):
                                fc(parts['blinds'], u, -.7, z1-.38-slat*.11,
                                   width/6-.12, .065, .025)
    # Check the precise original pane mesh before replacing it; never silently
    # overwrite manual authoring just because the initial revision still exists.
    for key, expected in original.items():
        obj = objects[Y+'/'+key]
        if len(obj.data.vertices) != len(expected.vertices) or any(
                (v.co-Vector(p)).length > .0001 for v, p in zip(obj.data.vertices, expected.vertices)):
            raise RuntimeError('Y pane mesh has changed; review '+key)
        replace_mesh(obj, backs[key])

    light = objects[Y+'/light']
    data = light.data.copy()
    light.data = data
    moved = 0
    if len(data.vertices) % 24:
        raise RuntimeError('Expected Y light boxes')
    for start in range(0, len(data.vertices), 24):
        verts = list(data.vertices[start:start+24])
        lo = Vector([min(v.co[a] for v in verts) for a in range(3)])
        hi = Vector([max(v.co[a] for v in verts) for a in range(3)])
        size, centre = hi-lo, (hi+lo)/2
        axis = 0 if size.x < size.y else 1
        if abs(size.z-.045) < .0001 and abs(size[axis]-.025) < .0001:
            grid = DX if axis == 0 else DY
            offset = round(centre[axis]/grid)*grid-centre[axis]
            if abs(abs(offset)-.42) > .0001:
                raise RuntimeError('Office light edited; stop before moving')
            for vertex in verts:
                vertex.co[axis] -= math.copysign(1.68, offset)
            moved += 1
    mats = {
        'desks': material('office pale timber', (173, 154, 124), rough=.7),
        'chairs': material('office charcoal furniture', (55, 61, 60), rough=.73),
        'blinds': material('office aluminum blinds', (171, 180, 176), metal=.32, rough=.38),
    }
    for key, part in parts.items():
        mats[key]['spaceMaterialId'] = REVISION+'/'+key
        obj = part.object('Alibaba Y '+key, mats[key], root, root.users_collection[0])
        obj['spaceId'] = Y+'/interior-'+key
        obj['spaceAlibabaSurfaceRevision'] = REVISION
    return {'bays': bays, 'recessedCeilingStrips': moved, 'desks': bays*2, 'backWallDepthMetres': 4}


def leaf_crowns(obj):
    # The authored trees are welded, disconnected crowns. Recover their bounds
    # so the refinement follows existing landscaping instead of scattering trees.
    data = obj.data
    neighbors = [[] for _ in data.vertices]
    for edge in data.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    unseen = set(range(len(data.vertices)))
    part, count = Mesh(), 0
    rng = random.Random(int(hashlib.sha256(obj['spaceId'].encode()).hexdigest()[:8], 16))
    while unseen:
        first = min(unseen)
        unseen.remove(first)
        pending, component = [first], []
        while pending:
            index = pending.pop()
            component.append(data.vertices[index].co.copy())
            for other in neighbors[index]:
                if other in unseen:
                    unseen.remove(other)
                    pending.append(other)
        if len(component) < 12:
            raise RuntimeError('Unexpected isolated foliage; inspect '+obj.name)
        lo = Vector([min(v[a] for v in component) for a in range(3)])
        hi = Vector([max(v[a] for v in component) for a in range(3)])
        centre, radius = (lo+hi)/2, (hi-lo)/2
        if min(radius) < .2 or max(radius) > 3:
            raise RuntimeError('Unexpected crown dimensions: '+str(radius))
        count += 1
        # Each folded lanceolate patch represents a small leaf cluster. Open
        # gaps and varied normals are real geometry, requiring no alpha textures.
        for _ in range(140):
            azimuth, polar = rng.uniform(0, math.tau), rng.uniform(-1, 1)
            radial = rng.uniform(.28, 1)**(1/3)
            direction = Vector((math.sqrt(1-polar*polar)*math.cos(azimuth),
                                math.sqrt(1-polar*polar)*math.sin(azimuth), polar))
            pos = centre+Vector([direction[a]*radius[a]*radial for a in range(3)])
            normal = Vector((rng.uniform(-.8, .8), rng.uniform(-.8, .8), rng.uniform(.2, 1))).normalized()
            u = normal.cross(Vector((0, 1, 0))).normalized()
            v = normal.cross(u).normalized()
            length = min(radius)*rng.uniform(.18, .32)
            width = length*rng.uniform(.3, .48)
            a, b, c, d = pos-u*length, pos-v*width, pos+u*length, pos+v*width
            ridge = pos+normal*width*.23
            for p, q in ((a, b), (b, c), (c, d), (d, a)):
                part.face([p, q, ridge])
    replace_mesh(obj, part)
    return count


def polish_surface(scene, apply, night=False):
    marker = 'spaceAlibabaNightBalance' if night else 'spaceAlibabaGlassFinish'
    prefix = 'night' if night else 'glass'
    required_report = 'glass-saved-report.json' if night else 'saved-report.json'
    if (scene.get('spaceAlibabaSurfaceRevision') != REVISION or scene.get(marker)
            or (night and scene.get('spaceAlibabaGlassFinish') != REVISION+'-clear-glass')):
        raise RuntimeError('Expected preceding surface pass without this finish')
    token = source_fingerprint()
    if list(token) != json.loads((OUTPUT/required_report).read_text(encoding='utf8'))['sourceAfter']:
        raise RuntimeError('Source changed since surface pass; review incremental edits')
    before_geometry = geometry_digest(scene.objects)
    before_rigs = export_snapshot(scene)
    if night:
        y = next(o for o in scene.objects if o.get('spaceId') == Y+'/glass-lit')
        z = next(m for m in bpy.data.materials if m.get('spaceMaterialId') == XZ+'lit-interior')
        mats = {y.data.materials[0], z}
        if any(o.type == 'MESH' and not o.get('spaceId', '').startswith('authored/alibaba-xuhui-')
               and any(m in mats for m in o.data.materials) for o in scene.objects):
            raise RuntimeError('Window material is shared outside the campus')
        for mat in mats:
            if abs(mat.get('spaceIllumination', 0)-.85) > .0001:
                raise RuntimeError('Window brightness changed since review')
            mat['spaceIllumination'] = .2
        values = {'windowIllumination': .2}
    else:
        obj = next(o for o in scene.objects if o.get('spaceId') == Y+'/glass')
        mat = obj.data.materials[0]
        if any(o != obj and o.type == 'MESH' and mat in o.data.materials[:]
               for o in scene.objects):
            raise RuntimeError('Y glass material is shared; inspect before editing')
        tune(mat, (240, 248, 245), .012, transmission=.98)
        mat.use_backface_culling = True
        values = {'roughness': .012, 'transmission': .98, 'backfaceCulling': True}
    if geometry_digest(scene.objects) != before_geometry or export_snapshot(scene) != before_rigs:
        raise RuntimeError('Surface finish changed geometry or native light rigs')
    report = {'revision': REVISION+('-night-balance' if night else '-clear-glass'),
              'sourceBefore': list(token), 'saved': False, **values, 'preservedGeometry': before_geometry,
              'preservedRigs': list(before_rigs)}
    assert_source_unchanged(token)
    if apply:
        if json.loads((OUTPUT/(prefix+'-candidate-report.json')).read_text(encoding='utf8')) != report:
            raise RuntimeError('Surface candidate changed; inspect before saving')
        backup = OUTPUT/('shanghai-before-'+prefix+'-finish.blend')
        if backup.exists(): raise RuntimeError('Surface finish backup already exists')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene[marker] = report['revision']
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    (OUTPUT/(prefix+('-saved-report.json' if apply else '-candidate-report.json'))).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('CAMPUS_SURFACE_FINISH '+json.dumps(report))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    finish = parser.add_mutually_exclusive_group()
    finish.add_argument('--polish-glass', action='store_true')
    finish.add_argument('--balance-night', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE.resolve() or scene.get('space_contract') != 2:
        raise RuntimeError('Open canonical contract-v2 Shanghai')
    if args.polish_glass or args.balance_night:
        polish_surface(scene, args.apply, args.balance_night)
        return
    if scene.get('spaceAlibabaSurfaceRevision'):
        raise RuntimeError('Surface refinement already exists; edit it incrementally')
    token = source_fingerprint()
    objects = {o.get('spaceId'): o for o in scene.objects if o.get('spaceId')}
    root = objects[Y]
    if (root.get('spaceAlibabaRevision') != 'alibaba-xuhui-y-20260912'
            or scene.get('spaceAlibabaCourtLightingRevision') != 'alibaba-z-court-light-20260912'):
        raise RuntimeError('Expected reviewed XYZ campus and Z court lighting')
    foliage = [o for identity, o in objects.items() if identity.startswith('authored/alibaba-xuhui-')
               and identity.rsplit('/', 1)[-1] in ('leaves', 'new-leaves', 'foliage', 'leaf-light')]
    changed = {objects[Y+'/'+key] for key in ('glass-lit', 'glass-dim', 'light')} | set(foliage)
    preserved = [o for o in scene.objects if o not in changed]
    before_geometry = geometry_digest(preserved)
    before_rigs = export_snapshot(scene)
    before_ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    allowed_mats = {objects[Y+'/'+key].data.materials[0] for key in ('glass', 'glass-lit', 'glass-dim')}
    allowed_mats |= {m for m in bpy.data.materials if m.get('spaceMaterialId') in
                    (XZ+'z-glass', XZ+'lit-interior', XZ+'office')}
    for obj in scene.objects:
        if obj.type == 'MESH' and not obj.get('spaceId', '').startswith('authored/alibaba-xuhui-'):
            if any(m in allowed_mats for m in obj.data.materials):
                raise RuntimeError('Campus material is shared with an unrelated mesh')
    office = office_depth(objects, root)
    tune(objects[Y+'/glass'].data.materials[0], (240, 248, 245), .065, transmission=.91)
    tune(objects[Y+'/glass-lit'].data.materials[0], (228, 223, 208), .78, illumination=.85)
    tune(objects[Y+'/glass-dim'].data.materials[0], (125, 140, 137), .82, illumination=.025)
    for mat in allowed_mats:
        identity = mat.get('spaceMaterialId')
        if identity == XZ+'z-glass': tune(mat, (242, 250, 248), .045, transmission=.94)
        if identity == XZ+'lit-interior': tune(mat, (238, 227, 203), .76, illumination=.85)
        if identity == XZ+'office': tune(mat, (193, 187, 164), .45, metal=.12, illumination=.55)
    crowns = {obj['spaceId']: leaf_crowns(obj) for obj in foliage}
    bpy.context.view_layer.update()
    after_ids = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    expected_ids = before_ids + Counter({Y+'/interior-'+k: 1 for k in ('desks', 'chairs', 'blinds')})
    if geometry_digest(preserved) != before_geometry or export_snapshot(scene) != before_rigs:
        raise RuntimeError('Unrelated geometry or existing light rigs changed')
    if after_ids != expected_ids:
        raise RuntimeError('Unexpected runtime identities changed')
    report = {'revision': REVISION, 'sourceBefore': list(token), 'saved': False,
              'office': office, 'crowns': crowns, 'leavesPerCrown': 140,
              'preservedGeometry': before_geometry, 'preservedRigs': list(before_rigs),
              'runtimeObjects': sum(after_ids.values())}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assert_source_unchanged(token)
    if args.apply:
        if json.loads((OUTPUT/'candidate-report.json').read_text(encoding='utf8')) != report:
            raise RuntimeError('Preview or current source changed; review again')
        backup = OUTPUT/'shanghai-before-glazing.blend'
        if backup.exists(): raise RuntimeError('Backup exists; inspect previous apply')
        shutil.copy2(SOURCE, backup)
        assert_source_unchanged(token)
        scene['spaceAlibabaSurfaceRevision'] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        report.update(saved=True, sourceAfter=list(source_fingerprint()))
    (OUTPUT/('saved-report.json' if args.apply else 'candidate-report.json')).write_text(
        json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('CAMPUS_REFINEMENT '+json.dumps(report))


if __name__ == '__main__':
    main()
