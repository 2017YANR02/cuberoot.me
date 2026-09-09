"""Incremental Shanghai Club window grouping, from the recorded exterior photos.

Preview by default; --apply saves the authored source before disposable staging.
Dimensions are photo estimates. Existing geography, IDs and other buildings stay.
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
import refine_bund_entrances as entrances
import refine_bund_galleries as galleries
import refine_shanghai_landmarks as previous
from refine_bund_entrances import box, arc, extrude

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-bund-windows'
REVISION = 'bund-windows-20260909'


def arch_window(parts, x, bottom, width, height, y):
    radius = width / 2
    spring = bottom + height - radius
    profile = [(x-radius, bottom), (x+radius, bottom)]
    profile += [(x+radius*math.cos(a), spring+radius*math.sin(a))
                for a in [math.pi*i/32 for i in range(33)]]
    extrude(parts['glass'], profile, y-.62, y-.60)
    # True jambs and curved soffits; glazing is behind a 60 cm reveal.
    for side in [-1, 1]:
        box(parts['trim'], (x+side*(radius+.055), y-.16, (bottom+spring)/2),
            (.11, .53, spring-bottom))
    arc(parts['trim'], x, spring, radius, radius+.11, y-.43, y+.105, steps=32)
    box(parts['trim'], (x, y-.11, bottom-.07), (width+.28, .65, .14))
    box(parts['metal'], (x, y-.56, (bottom+spring+radius)/2), (.035, .06, height))
    for z in [bottom+.55, spring]:
        box(parts['metal'], (x, y-.55, z), (width, .07, .045))
    # Fill only the spandrels above the arch, leaving the curved aperture clear.
    for i in range(32):
        a, b = math.pi*i/32, math.pi*(i+1)/32
        x1, z1 = x+radius*math.cos(a), spring+radius*math.sin(a)
        x2, z2 = x+radius*math.cos(b), spring+radius*math.sin(b)
        extrude(parts['stone'], [(x2,z2),(x1,z1),(x1,bottom+height),(x2,bottom+height)], -1.10, y)


def author(root, collection):
    parts, mats, by_id = entrances.parts_for(root)
    for name, mat in mats.items():
        mat['spaceMaterialId'] = REVISION+'/'+root['spaceId']+'/'+name
    removed = 0
    # Remove all old front attic windows together so no half arch survives at
    # a narrow patch boundary. Side walls beyond the front metre remain intact.
    for obj in by_id.values():
        if str(obj.get('spaceId', '')).startswith(entrances.REVISION):
            continue  # Retain the recently authored pediments above this strip.
        removed += galleries.cut_volume(obj, (-18.9,-1.10,18.86), (18.9,2.3,22.55), collection)
    # Remove the remaining large old dentils on the two end bays. The six
    # column capitals stop below this cut and retain their original geometry.
    for side in [-1, 1]:
        left, right = sorted([side*13.94,side*18.9])
        removed += galleries.cut_volume(by_id[root['spaceId']+'/2'],
            (left,-1.10,18.38),(right,2.3,18.86),collection)
    centers = [(i-2)*root['frontage']*.64/5 for i in range(5)]
    holes, attic_centers = [], []
    for center in centers:
        for offset in [-.93, 0, .93]:
            x = center + offset
            holes.append((x-.34, x+.34, 19.76, 21.68))
            arch_window(parts, x, 19.76, .68, 1.92, .03)
            attic_centers.append(x)
    for side in [-1, 1]:
        x = side*root['frontage']*.37
        holes.append((x-1.70, x+1.70, 19.76, 22.20))
        arch_window(parts, x, 19.76, 3.4, 2.44, .03)
    # Wall helper creates a 30 cm skin. Extend its returns to the old inner wall
    # with individual reveals; never place an uncut solid box behind the glass.
    galleries.wall(parts, -18.46, 18.46, 18.86, 22.55, .03, holes)
    for side in [-1, 1]:
        # Back returns meet the wall skin without a coincident front face.
        box(parts['stone'], (side*18.39,-.685,20.705), (.14,.83,3.69))
    for left, right, low, high in holes:
        for x in [left-.025, right+.025]:
            box(parts['stone'], (x,-.685,(low+high)/2), (.05,.83,high-low))
    # Stepped entablature and small dentils cast real shadows beneath the attic.
    for z, depth, height in [(18.89,.50,.14),(19.12,.54,.18),(19.30,.85,.16),(19.46,.64,.14),
                             (22.27,.47,.12),(22.53,.68,.18)]:
        box(parts['trim'], (0,-.10+depth/2,z), (37.1,depth,height))
    for i in range(94):
        box(parts['trim'], (-18.3+i*36.6/93,.34,18.97), (.15,.32,.15))
    # Replace five broad upper back-wall panes with five pairs of narrow sashes.
    for name in ['stone','glass','trim','metal']:
        obj = by_id[galleries.REVISION+'/'+root['spaceId']+'/'+name]
        removed += galleries.cut_volume(obj, (-13.94,-2.15,15.82), (13.94,-1.05,18.90), collection)
    paired_holes, paired_centers = [], []
    for center in centers:
        for offset in [-.60, .60]:
            x = center+offset
            paired_holes.append((x-.435,x+.435,16.20,18.20))
            galleries.window(parts,x,16.20,.87,2.0,-1.8)
            paired_centers.append(x)
        box(parts['trim'], (center,-1.58,18.40), (2.86,.38,.16))
        box(parts['trim'], (center,-1.58,16.01), (2.86,.38,.14))
    galleries.wall(parts,-13.94,13.94,15.82,18.90,-1.8,paired_holes)
    # The photographed columns read as warm buff against the pale wall.
    # Copy the material so no other building or archived state changes with it.
    columns = by_id[galleries.REVISION+'/'+root['spaceId']+'/columns']
    galleries.archive(columns,collection)
    columns.data = columns.data.copy()
    column_mat = previous.material(columns.data.materials[0], 'Club warm buff columns',
                                   rgb=(203,179,143),roughness=.70)
    column_mat['spaceMaterialId'] = REVISION+'/'+root['spaceId']+'/columns'
    columns.data.materials[0] = column_mat
    for name, part in parts.items():
        if not part.faces: continue
        obj = part.object(root.name+' '+REVISION+' '+name,mats[name],root,root.users_collection[0])
        obj['spaceId'] = REVISION+'/'+root['spaceId']+'/'+name
        obj['spaceBundWindowPart'] = name
        galleries.uv_metric(obj)
    root['spaceFacadeDetail']['stoneMeshes'] = sum(
        'bund-stone' in str(mat.get('spaceShaderKey',''))
        for o in previous.meshes(root) for mat in o.data.materials)
    root['spaceBundWindowRevision'] = REVISION
    root['spaceBundWindowDetail'] = {'atticGroups':5,'atticWindows':15,'endArches':2,
        'pairedGroups':5,'pairedWindows':10,'atticCenters':attic_centers,
        'pairedCenters':paired_centers,'estimated':True,'removedFaces':removed}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--baseline',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--oblique',action='store_true',help='Also render a side view to inspect returns')
    parser.add_argument('--label',default='candidate')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and (args.baseline or args.review_saved): parser.error('Review cannot save')
    scene = bpy.context.scene
    source = ROOT/'design/space/scenes/shanghai.blend'
    if Path(bpy.data.filepath).resolve()!=source or scene.get('space_asset')!='shanghai' or scene.get('space_contract')!=2:
        raise RuntimeError('Open the repository contract-v2 Shanghai source')
    source_stat = source.stat()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    root = next(o for o in scene.objects if o.get('spaceId')=='root/147/8/1' and o.get('space_export'))
    report = {'revision':REVISION,'saved':False}
    if not (args.baseline or args.review_saved):
        if root.get('spaceBundWindowRevision'): raise RuntimeError('Already authored; preserve subsequent artist edits')
        if root.get('spaceBundGalleryRevision')!=galleries.REVISION: raise RuntimeError('Expected gallery revision')
        before = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive = bpy.data.collections.new('ARCHIVE before Bund windows 20260909 (not exported)')
        scene.collection.children.link(archive)
        archive.hide_render = archive.hide_viewport = True
        author(root,archive)
        bpy.context.view_layer.update()
        after = Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[k]!=n for k,n in before.items()): raise RuntimeError('Original runtime ID lost')
        if any(n!=1 for k,n in after.items() if k is not None): raise RuntimeError('Duplicate runtime ID')
        if any(not o.data.polygons for o in previous.meshes(root)): raise RuntimeError('Empty runtime geometry')
        if abs(previous.bounds(root)[1].z-28.645)>.03: raise RuntimeError('Roof envelope changed')
        report.update(preservedIds=sum(k is not None for k in before),newMeshes=sum(after.values())-sum(before.values()),
                      details=root['spaceBundWindowDetail'].to_dict())
        if args.apply:
            latest = source.stat()
            if (latest.st_mtime_ns,latest.st_size)!=(source_stat.st_mtime_ns,source_stat.st_size):
                raise RuntimeError('Source changed in another editor')
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
            report['saved'] = True
    prefix=args.label+('-night' if args.night else '-day')
    (OUTPUT/(prefix+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('BUND_WINDOW_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render:
        previous.OUTPUT=OUTPUT
        previous.review([root],'bund',prefix,args.night)
        if args.oblique:
            cam = scene.camera
            aim = cam.location-Vector((0,900,55))
            cam.location = aim+Vector((360,900,90))
            cam.rotation_euler = (aim-cam.location).to_track_quat('-Z','Y').to_euler()
            cam.data.ortho_scale *= 1.30
            scene.render.filepath = str(OUTPUT/(prefix+'-oblique.png'))
            bpy.ops.render.render(write_still=True)


if __name__=='__main__': main()
