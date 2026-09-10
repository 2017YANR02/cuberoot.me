"""Photo-guided Peace Hotel long window bands; incremental Blender authoring.

Preview before --apply. Preserve existing IDs, signs, roof and other buildings.
Fine dimensions are estimates; see ../references/shanghai-landmarks.md.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_frontages as frontages
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_bund_windows as windows
import refine_shanghai_landmarks as previous
from refine_bund_entrances import box, arc

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/bund-peace-facade'
REVISION = 'peace-riverfront-20260909'
AXES = [group+offset for group in [-7.4, 0, 7.4] for offset in [-1.72, 0, 1.72]]
LEVELS = [9.65+4.2*i for i in range(7)]


def author(root, archive):
    base = root['spaceId']
    by_id = {o.get('spaceId'): o for o in previous.meshes(root)}
    meshes = frontages.parts()
    mats = {k: by_id[base+'/'+str(i)].data.materials[0] for k,i in [('stone',0),('trim',1),('glass',4),('metal',3)]}
    mats['metal'] = previous.material(mats['metal'], 'Peace long bronze sashes', rgb=(55,58,49), metal=.42, roughness=.36, illumination=.012)
    mats['glass'] = previous.material(mats['glass'], 'Peace recessed riverfront glazing', rgb=(72,91,93), metal=.18, roughness=.29)
    for k in ['metal', 'glass']: mats[k]['spaceMaterialId'] = REVISION+'/'+k
    removed = 0
    targets = [by_id[base+'/'+str(i)] for i in range(5)]
    targets += [o for o in by_id.values() if 'fitted window muntins' in str(o.get('spaceId'))]
    # Replace only the old central window strip. The long mapped side wings,
    # entrance lettering, roof and all previous upper details remain authored.
    for obj in targets:
        removed += galleries.cut_volume(obj, (-1317.25,-1379.75,8.80), (-1310.85,-1354.25,38.78), archive)
    # The previous tier's closing slab overlaps the lower skin at 38.50 m.
    # Remove both coincident faces and join the new wall at its 38.86 m top.
    upper_stone = by_id[frontages.REVISION+'/'+base+'/stone']
    removed += galleries.cut_volume(upper_stone,(-1317.26,-1379.76,38.49),(-1312.99,-1354.24,38.86),archive)
    # The upper tier's top and side closure boxes also coincide with its skin.
    # Cut their exposed overlap and replace each strip with one facing surface.
    for obj in targets:
        removed += galleries.cut_volume(obj,(-1317.26,-1379.84,38.78),(-1312.44,-1354.16,46.59),archive)
    for left,right in [(-12.83,-12.66),(12.66,12.83)]:
        removed += galleries.cut_volume(upper_stone,(-1313.301,-1367-right,38.86),(-1312.999,-1367-left,46.59),archive)
        galleries.wall(meshes,left,right,38.86,46.58,15,[])
    removed += galleries.cut_volume(upper_stone,(-1313.301,-1379.66,46.41),(-1312.999,-1354.34,46.59),archive)
    galleries.wall(meshes,-12.66,12.66,46.41,46.58,15,[])
    holes = []
    for x in AXES:
        for z in LEVELS:
            holes.append((x-.58,x+.58,z,z+2.45))
            frontages.sash(meshes,x,z,1.16,2.45,15.0,.55,2)
            # Tall inset spandrel fields read as one continuous vertical band.
            panel_z = z+3.35
            box(meshes['trim'],(x,15.005,panel_z),(1.12,.03,1.60))
            hero.rectangular_frame(meshes['trim'],x,15.032,panel_z,1.05,1.52,.028,.035)
            hero.rectangular_frame(meshes['metal'],x,15.053,panel_z,.88,1.35,.015,.020)
        for side in [-1,1]:
            box(meshes['trim'],(x+side*.64,15.025,23.95),(.055,.05,29.4))
    galleries.wall(meshes,-12.75,12.75,8.80,38.86,15,holes)
    # Solid returns and a base ledge close the transition to the old side wings.
    for x in [-12.75,12.75]:
        box(meshes['stone'],(x,12.72,23.83),(.16,3.96,30.06))
    box(meshes['stone'],(0,13.6,8.81),(25.5,5.8,.20))
    for z,h,depth in [(8.83,.18,1.7),(9.05,.12,.45)]:
        box(meshes['trim'],(0,15+depth/2,z),(25.65,depth,h))
    # The old generic windows over the central entrance do not occur in the
    # riverfront reference. Keep the separate lettering, canopy and doorwork.
    for obj in targets:
        removed += galleries.cut_volume(obj,(-1313,-1371.79,6.15),(-1310.85,-1362.21,8.41),archive)
    galleries.wall(meshes,-4.79,4.79,6.15,8.41,16.5,[])
    # Ground-level arches visible in the source photo, either side of the
    # retained central entrance. Fanlights have concentric arcs and radial bars.
    for x in [-7.4,7.4]:
        for obj in targets:
            removed += galleries.cut_volume(obj,(-1313,-1367-x-2.61,.59),(-1310.85,-1367-x+2.61,8.41),archive)
        local = frontages.parts()
        windows.arch_window(local,x,.70,4.8,7.5,0)
        spring=.70+7.5-2.4
        for radius in [.70,1.12,1.78,2.32]: arc(local['metal'],x,spring,radius,radius+.035,-.55,-.48,0,math.pi,48)
        for j in range(1,12):
            a=math.pi*j/12
            local['metal'].beam((x+.7*math.cos(a),-.46,spring+.7*math.sin(a)),(x+2.32*math.cos(a),-.46,spring+2.32*math.sin(a)),.04,.05)
        for dx in [-1.55,-.78,.78,1.55]:
            box(local['metal'],(x+dx,-.48,3.25),(.045,.07,5.0))
        for z in [1.35,2.85,4.55,5.75]: box(local['metal'],(x,-.48,z),(4.65,.07,.055))
        for key,part in local.items():
            for face in part.faces: meshes[key].face([(part.vertices[i][0],part.vertices[i][1]+16.5,part.vertices[i][2]) for i in face])
        galleries.wall(meshes,x-2.61,x+2.61,.59,8.41,16.5,[(x-2.4,x+2.4,.7,8.2)])
    # Shallow repeated relief above the ground arches, seen below the long bays.
    for x in [-12.1+i*24.2/47 for i in range(48)]:
        hero.rectangular_frame(meshes['trim'],x,16.60,8.48,.38,.40,.035,.07)
    for key,part in meshes.items():
        part.vertices=[(-1328+y,-1367-x,z) for x,y,z in part.vertices]
        obj=part.object(root.name+' long riverfront '+key,mats[key],root,root.users_collection[0])
        obj['spaceId']=REVISION+'/'+base+'/'+key
        obj['spacePeaceRiverfrontPart']=key
        galleries.uv_metric(obj)
        if key=='stone':
            for uv in obj.data.uv_layers.active.data: uv.uv.x *= .5
    root['spaceBundHeroDetail']['remaining']='Side elevations, roof relief, exact survey dimensions and observed lighting remain'
    root['spaceFacadeDetail']['stoneMeshes']=sum('bund-stone' in str(m.get('spaceShaderKey','')) for o in previous.meshes(root) for m in o.data.materials)
    return {'windowAxes':AXES,'levels':LEVELS,'windows':63,'spandrels':63,'groundArches':2,'fanlightRibs':22,'estimated':True,'removedFaces':removed}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--suite',action='store_true')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and args.review_saved: parser.error('Review cannot save')
    source=ROOT/'design/space/scenes/shanghai.blend'; scene=bpy.context.scene
    if Path(bpy.data.filepath).resolve()!=source or scene.get('space_contract')!=2 or scene.get('space_asset')!='shanghai':
        raise RuntimeError('Open the repository authored Shanghai source')
    initial=source.stat()
    root=next(o for o in scene.objects if o.get('space_export') and o.get('spaceId')==hero.IDS['20'])
    report={'revision':REVISION,'saved':False}
    if args.review_saved:
        if root.get('spacePeaceRiverfrontRevision')!=REVISION: raise RuntimeError('Revision missing')
    else:
        if root.get('spacePeaceRiverfrontRevision'): raise RuntimeError('Already authored; preserve subsequent edits')
        if root.get('spaceBundFrontageRevision')!=frontages.REVISION: raise RuntimeError('Previous frontage required')
        before=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive=bpy.data.collections.new('ARCHIVE before Peace long windows 20260909 (not exported)')
        scene.collection.children.link(archive); archive.hide_render=archive.hide_viewport=True
        detail=author(root,archive)
        root['spacePeaceRiverfrontRevision']=REVISION; root['spacePeaceRiverfrontDetail']=detail
        bpy.context.view_layer.update()
        after=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[k]!=n for k,n in before.items()) or any(n!=1 for k,n in after.items() if k is not None): raise RuntimeError('Runtime IDs changed or duplicated')
        if abs(previous.bounds(root)[1].z-77)>.025: raise RuntimeError('Roof envelope changed')
        if any(not o.data.polygons for o in previous.meshes(root)): raise RuntimeError('Empty exported mesh')
        report.update(detail=detail,preservedIds=sum(k is not None for k in before),newMeshes=sum(after.values())-sum(before.values()))
        if args.apply:
            latest=source.stat()
            if (initial.st_size,initial.st_mtime_ns)!=(latest.st_size,latest.st_mtime_ns): raise RuntimeError('Source changed in another editor')
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True); report['saved']=True
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/(args.label+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('PEACE_RIVERFRONT '+json.dumps(report),flush=True)
    hero.OUTPUT=OUTPUT
    hero.review(root,'20',args.label,False,True,26,43)
    if args.suite:
        hero.review(root,'20',args.label,False,False)
        hero.review(root,'20',args.label,True,True,26,43)
        hero.review(root,'20',args.label+'-entrance',False,True,5,29)


if __name__=='__main__': main()
