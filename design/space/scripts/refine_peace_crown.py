"""Incremental Peace Hotel copper crown details, referenced to real photographs.

CLI only renders a baseline, disposable candidate or saved revision. It never
saves a .blend. The coordinating process calls author(root, archive), checks
assert_source_unchanged(token), then owns the reviewed source save.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_shanghai_landmarks as previous
from refine_bund_entrances import box, extrude
from refine_jin_mao import Mesh

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'design/space/scenes/shanghai.blend'
OUTPUT = ROOT / '.tmp/png/space-parallel-20260910/peace'
REVISION = 'peace-crown-20260910'
PROPERTY = 'spacePeaceCrownRevision'
CX, CY, HALF = -1328, -1367, 11.52588


def source_fingerprint():
    stat = SOURCE.stat()
    return stat.st_size, stat.st_mtime_ns


def assert_source_unchanged(token):
    if source_fingerprint() != token:
        raise RuntimeError('Shanghai source changed; reload and reapply reviewed increments')


def point(u, v, z, face):
    angle = face * math.pi / 2
    c, s = round(math.cos(angle)), round(math.sin(angle))
    return CX + u*c-v*s, CY + u*s+v*c, z


def append_face(part, local, face):
    for polygon in local.faces:
        part.face([point(*local.vertices[i], face) for i in polygon])


def finish(root, part, source, key, rgb, roughness):
    mat = previous.material(source, 'Peace crown '+key, rgb=rgb,
                            metal=.48 if key != 'recess' else .12, roughness=roughness,
                            illumination=0)
    mat['spaceMaterialId'] = REVISION+'/'+key
    mat['spaceSurfaceProvenance'] = 'Photo-estimated copper; original geometry, not a scanned material'
    obj = part.object('Peace crown '+key, mat, root, root.users_collection[0])
    obj['spaceId'] = REVISION+'/'+root['spaceId']+'/'+key
    obj['spacePeaceCrownPart'] = key
    galleries.uv_metric(obj)
    return obj


def author(root, archive):
    """Mutate only the existing crown mesh and add three detail meshes in memory."""
    if root.get('spaceId') != hero.IDS['20'] or not root.get('space_export'):
        raise RuntimeError('Expected the exported Peace Hotel root')
    if root.get(PROPERTY) or any(str(o.get('spaceId', '')).startswith(REVISION+'/')
                                 for o in bpy.context.scene.objects):
        raise RuntimeError('Peace crown already authored; preserve later work')
    if root.get('spaceBundHeroRevision') != hero.REVISION:
        raise RuntimeError('Photo-guided copper roof prerequisite missing')
    by_id = {o.get('spaceId'): o for o in previous.meshes(root)}
    roof = by_id.get(root['spaceId']+'/5')
    edging = by_id.get(hero.REVISION+'/'+root['spaceId']+'/copper-edging')
    if roof is None or edging is None:
        raise RuntimeError('Expected roof or copper edging identity missing')
    if not any(abs(v.co.x-(CX+1.05)) < .002 and 74.19 < v.co.z < 76.11
               for v in roof.data.vertices):
        raise RuntimeError('Crown shape changed; review current geometry before authoring')
    scene = bpy.context.scene
    before = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    root_transform = root.matrix_world.copy()
    old_height = previous.bounds(root)[1].z
    parts = {key: Mesh() for key in ['copper', 'raised-copper', 'recess']}
    removed = 0
    for face in range(4):
        # Open the original solid lantern skin. Recess backs and inclined louver
        # blades then have actual depth, rather than painted black rectangles.
        limits = [point(u, v, z, face) for u in [-.66, .66]
                  for v in [1.035, 1.065] for z in [74.51, 75.79]]
        lower = tuple(min(p[i] for p in limits) for i in range(3))
        upper = tuple(max(p[i] for p in limits) for i in range(3))
        count = galleries.cut_volume(roof, lower, upper, archive)
        if not count:
            raise RuntimeError('Expected lantern opening was not cut')
        removed += count
        local = {key: Mesh() for key in parts}
        box(local['recess'], (0, .80, 75.15), (1.34, .05, 1.30))
        for side in [-1, 1]:
            box(local['copper'], (side*.68, .945, 75.15), (.06, .30, 1.34))
            # Paired narrow pilasters, with capital and base plates.
            for x in [side*.78, side*.96]:
                box(local['copper'], (x, 1.085, 75.13), (.075, .105, 1.48))
                for z in [74.40, 75.86]:
                    box(local['raised-copper'], (x, 1.10, z), (.13, .15, .10))
        for z in [74.49, 75.81]:
            box(local['copper'], (0, .945, z), (1.42, .30, .055))
        for i in range(10):
            z = 74.56+i*.122
            # Inclined blades overlap in elevation, while the dark cavity
            # remains visible from below and from an oblique viewpoint.
            extrude(local['raised-copper'], [(-.65,z),(.65,z),(.65,z+.030),(-.65,z+.030)], 1.025, 1.115)
            local['recess'].face([(-.65,.87,z+.105),(.65,.87,z+.105),(.65,1.11,z),(-.65,1.11,z)])
        # Layered cornice and restrained pressed-metal frieze below the cap.
        for z, depth, width, height in [(74.29,.24,2.40,.13), (74.38,.19,2.28,.09),
                                      (75.98,.22,2.43,.12), (76.10,.28,2.54,.10)]:
            box(local['copper'], (0, 1.08, z), (width, depth, height))
        for x in [-.91, -.61, -.30, 0, .30, .61, .91]:
            box(local['raised-copper'], (x, 1.215, 75.995), (.080,.04,.092))
        # A fine rail around the cap is visible on the dated-unknown references.
        for x in [-.36, 0, .36]:
            box(local['recess'], (x,.38,76.78), (.021,.024,.27))
        box(local['recess'], (0,.38,76.895), (.77,.023,.023))
        # Wide folded copper eaves band with repeated shallow sagging motifs.
        # Count and metric relief are estimates; no invented figurative crest.
        box(local['copper'], (0,HALF+.145,59.915), (2*HALF,.10,.35))
        for z in [59.742,60.088]:
            box(local['raised-copper'], (0,HALF+.206,z), (2*HALF,.040,.042))
        step = 2*HALF/20
        for i in range(20):
            center = -HALF+(i+.5)*step
            coords = [(center+(t/16-.5)*(step-.11), HALF+.212,
                       59.99-.15*math.sin(math.pi*t/16)) for t in range(17)]
            for a,b in zip(coords,coords[1:]):
                local['raised-copper'].beam(a,b,.039,.041)
            box(local['raised-copper'],(center-step/2,HALF+.21,59.922),(.027,.035,.23))
        for key in parts:
            append_face(parts[key],local[key],face)
    # Four hip caps have regularly repeated transverse joints in the photos.
    # The original hip profile and parallel roof sheet seams stay intact.
    for face in range(4):
        local = Mesh()
        for i in range(1,40):
            t = i/40
            u = HALF-(HALF-1.6)*t
            z = 60+13.6*t
            center = Vector((u,u,z))
            # A short collar follows the existing cap section. The first
            # preview's crosswise bars read as projecting spikes, whereas
            # the photographed joints sit almost flush with the folded cap.
            tangent = Vector((1.6-HALF,1.6-HALF,13.6)).normalized()*.021
            local.beam(center-tangent,center+tangent,.180,.230)
        append_face(parts['raised-copper'],local,face)
    source = edging.data.materials[0]
    for key,rgb,roughness in [('copper',(113,64,55),.49),
                              ('raised-copper',(143,91,70),.44),
                              ('recess',(52,70,62),.60)]:
        finish(root,parts[key],source,key,rgb,roughness)
    bpy.context.view_layer.update()
    after = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    if any(after[key] != count for key,count in before.items()) or any(
            count != 1 for key,count in after.items() if key is not None):
        raise RuntimeError('Original runtime IDs changed or duplicated')
    if root.matrix_world != root_transform or abs(previous.bounds(root)[1].z-old_height) > .001:
        raise RuntimeError('Root transform or maximum roof height changed')
    if any(not obj.data.polygons for obj in previous.meshes(root)):
        raise RuntimeError('Empty exported geometry')
    detail = {'lanternOpenings':4, 'louverBlades':40, 'hipCapJoints':156,
              'eavesSwags':80, 'newMeshes':3, 'removedRoofFaces':removed,
              'estimated':True, 'photoCaptureDate':'unknown',
              'reference':'design/space/references/peace-crown.md',
              'remaining':'Exact relief profiles, rear-face evidence, survey dimensions and calibrated night fixtures'}
    root[PROPERTY] = REVISION
    root['spacePeaceCrownDetail'] = detail
    return detail


def review(root, label, night=False, lantern=False, threads=8):
    """Reuse the established stage, cap threads at render_pre, add oblique view."""
    if not 1 <= threads <= 8:
        raise ValueError('This review is limited to 8 CPU threads')
    def configure(scene, _depsgraph=None):
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = threads
        # Aim at the crown itself: the hotel's asymmetrical side wings make
        # the complete building bounding-box centre unsuitable for this crop.
        staged_roof = next(o for o in scene.objects if o.type == 'MESH'
                           and not o.hide_render and o.get('spaceId') == root['spaceId']+'/5')
        aim = staged_roof.matrix_world @ Vector((CX,CY,75.10 if lantern else 66.4))
        scene.camera.location = aim+Vector((80,200,16))
        scene.camera.rotation_euler = (aim-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        print('PEACE_CROWN_RENDER_THREADS '+str(scene.render.threads),flush=True)
    hero.OUTPUT = OUTPUT
    bpy.app.handlers.render_pre.append(configure)
    try:
        hero.review(root,'20',label,night,True,75.10 if lantern else 66.4,6.6 if lantern else 34)
    finally:
        bpy.app.handlers.render_pre.remove(configure)


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--baseline',action='store_true')
    mode.add_argument('--review-saved',action='store_true')
    parser.add_argument('--label',default='candidate')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--lantern',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in args.label):
        parser.error('Label must be a single alphanumeric filename')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve() != SOURCE or scene.get('space_contract') != 2 or scene.get('space_asset') != 'shanghai':
        raise RuntimeError('Open the authored repository Shanghai source')
    token = source_fingerprint()
    root = next(o for o in scene.objects if o.get('space_export') and o.get('spaceId') == hero.IDS['20'])
    report = {'revision':REVISION,'saved':False,'sourceFingerprint':token}
    if args.review_saved:
        if root.get(PROPERTY) != REVISION:
            raise RuntimeError('Saved crown revision missing')
        report['detail'] = root['spacePeaceCrownDetail'].to_dict()
    elif not args.baseline:
        archive = bpy.data.collections.new('ARCHIVE before '+REVISION+' (not exported)')
        scene.collection.children.link(archive)
        archive.hide_render = archive.hide_viewport = True
        report['detail'] = author(root,archive)
    assert_source_unchanged(token)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/(args.label+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('PEACE_CROWN '+json.dumps(report),flush=True)
    if not args.no_render:
        review(root,args.label,args.night,args.lantern)


if __name__ == '__main__':
    main()
