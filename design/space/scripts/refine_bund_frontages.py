"""Incremental photo-guided Customs and Peace Hotel riverfront reconstruction.

Preview first; --apply saves the validated source before temporary render staging.
Window spacing and ornament are photo estimates, not surveyed 1:1 dimensions.
Sources and discrepancies: ../references/shanghai-landmarks.md.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_bund_windows as windows
import refine_shanghai_landmarks as previous
from refine_bund_entrances import box, arc
from refine_jin_mao import Mesh

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/bund-frontages'
REVISION = 'bund-frontages-20260909'
AXES = [-16, -9.6, -4.8, 0, 4.8, 9.6, 16]
LEVELS = [12, 16.3, 20.6, 24.9]
PANELS = [15.7, 20.0, 24.3]


def parts():
    return {k: Mesh() for k in ['stone', 'trim', 'glass', 'metal']}


def material(source, name, **kwargs):
    mat = previous.material(source, name, **kwargs)
    mat['spaceMaterialId'] = REVISION + '/' + name
    return mat


def finish(root, meshes, mats, city=False):
    for name, part in meshes.items():
        if not part.faces: continue
        if city:
            # Local horizontal/front/Z to Peace's geographic +X riverfront.
            part.vertices = [(-1328+y, -1367-x, z) for x,y,z in part.vertices]
        obj = part.object(root.name+' riverfront '+name, mats[name], root, root.users_collection[0])
        obj['spaceId'] = REVISION+'/'+root['spaceId']+'/'+name
        obj['spaceBundFrontagePart'] = name
        galleries.uv_metric(obj)
        if name == 'stone':
            # Reuse the previous packed 4 x 2 m coursed stone maps.
            for uv in obj.data.uv_layers.active.data: uv.uv.x *= .5


def sash(meshes, x, bottom, width, height, front, recess=.55, divisions=3):
    """Dark recessed glazing with thin bronze frame, transoms and real reveals."""
    if width <= 0 or height <= 0 or recess <= .08 or divisions < 1:
        raise ValueError('Invalid sash dimensions')
    glass, metal, stone = (meshes[k] for k in ['glass', 'metal', 'stone'])
    y = front-recess
    box(glass, (x,y-.012,bottom+height/2), (width,.024,height))
    hero.rectangular_frame(metal,x,y+.045,bottom+height/2,width-.045,height-.045,.055,.075)
    for i in range(1,divisions):
        box(metal,(x-width/2+width*i/divisions,y+.06,bottom+height/2),(.038,.08,height))
    for t in [.18,.83,.94]:
        box(metal,(x,y+.063,bottom+height*t),(width,.08,.04))
    for side in [-1,1]:
        box(stone,(x+side*(width/2+.035),front-recess/2,bottom+height/2),(.07,recess,height))
    for z in [bottom-.04,bottom+height+.04]:
        box(stone,(x,front-recess/2,z),(width+.14,recess,.08))


def append_object(part, obj):
    for face in obj.data.polygons:
        part.face([tuple(obj.data.vertices[i].co) for i in face.vertices])


def customs(root, archive):
    by_id = {o.get('spaceId'):o for o in previous.meshes(root)}
    base = root['spaceId']
    meshes = parts()
    mats = {k:by_id[base+'/'+str(i)].data.materials[0] for k,i in [('stone',0),('glass',1),('trim',2),('metal',3)]}
    mats['trim'] = material(mats['trim'],'13 warm limestone dressings',rgb=(185,176,157),metal=.04,roughness=.68,illumination=.12)
    by_id[base+'/2'].data.materials[0] = mats['trim']
    mats['metal'] = material(mats['metal'],'13 narrow bronze sashes',rgb=(76,67,48),metal=.58,roughness=.4,illumination=.015)
    # Remove the complete old window strip, including the four applied piers.
    # Keep side/rear elevations, clock subtrees, roof, signs and cornice frieze.
    removed = 0
    for i in range(4):
        removed += galleries.cut_volume(by_id[base+'/'+str(i)],(-19,-1.31,.02),(19,3.56,29.28),archive)
    for x in [-12,-4,4,12]:
        removed += galleries.cut_volume(by_id[base+'/0'],(x-1.09,.23,29.28),(x+1.09,1.87,29.60),archive)
    muntins = next(o for o in by_id.values() if 'fitted window muntins' in str(o.get('spaceId')))
    removed += galleries.cut_volume(muntins,(-19,-1.31,.02),(19,3.56,29.28),archive)
    # Continuous bands are open through every glazing and bronze spandrel.
    holes = [(x-1.48,x+1.48,11.65,28.45) for x in AXES]
    holes += [(x-1.34,x+1.34,7.55,10.12) for x in AXES]
    holes += [(x-1.6,x+1.6,.3,6.10) for x in [-8,-4,0,4,8]]
    holes += [(x-.92,x+.92,1.35,4.72) for x in [-16,16]]
    galleries.wall(meshes,-19,19,.02,29.28,.16,holes)
    # Ground portico: four fluted Doric shafts separating five square portals.
    for x in [-6,-2,2,6]:
        hero.fluted_column(meshes['trim'],x,.94,.38,5.75,.59,.52,20)
        galleries.lathe(meshes['trim'],x,.94,[(.25,.69),(.39,.69),(.45,.59),(5.69,.52),(5.82,.59),(5.96,.74)],64)
        box(meshes['trim'],(x,.94,6.04),(1.55,1.55,.17))
    for x in [-8,-4,0,4,8]:
        sash(meshes,x,.3,3.2,5.8,.16,.99,4)
        # Bronze lower doorwork and handles, beneath the retained sign system.
        hero.rectangular_frame(meshes['metal'],x,-.74,1.45,2.95,2.15,.055,.09)
        for side in [-1,1]:
            box(meshes['metal'],(x+side*.17,-.64,1.58),(.035,.06,.45))
    for x in [-16,16]: sash(meshes,x,1.35,1.84,3.37,.16,.62,2)
    for x in AXES:
        sash(meshes,x,7.55,2.68,2.57,.16,.55,3)
        for z in LEVELS: sash(meshes,x,z,2.96,3.2,.16,.55,4)
        for z,h in [(11.83,.36),(28.28,.34)]:
            box(meshes['metal'],(x,-.30,z),(2.96,.15,h))
        for side in [-1,1]:
            box(meshes['metal'],(x+side*1.43,-.28,20.05),(.065,.16,16.8))
    for z,w,d,h in [(6.30,20.9,1.50,.26),(6.58,38.4,.9,.24),(7.02,38.2,.62,.18),
                      (10.65,26.2,.50,.17),(11.13,26.3,.74,.18)]:
        box(meshes['trim'],(0,.17+d/2,z),(w,d,h))
    # Recover the existing frieze, replace all twelve misplaced panel plates.
    plates = by_id[hero.REVISION+'/'+base+'/bronze-panels']
    ornament = by_id[hero.REVISION+'/'+base+'/bronze-relief']
    galleries.cut_volume(ornament,(-19,-1,0),(19,2,29),archive)
    panels, relief = Mesh(), Mesh()
    append_object(relief,ornament)
    for x in AXES:
        for z in PANELS:
            box(panels,(x,.135,z),(2.96,.13,1.05))
            for w,h,y in [(2.84,.92,.24),(2.66,.75,.28),(2.44,.54,.30)]:
                hero.rectangular_frame(relief,x,y,z,w,h,.045,.05)
            arc(relief,x,z,.11,.16,.25,.35,0,math.tau,32)
            for i in range(12):
                a=math.tau*i/12
                relief.beam((x+.055*math.cos(a),.34,z+.055*math.sin(a)),
                            (x+.12*math.cos(a),.35,z+.12*math.sin(a)),.025,.03,6)
            for i in range(17): box(relief,(x-1.30+i*2.60/16,.29,z-.44),(.075,.075,.065))
    galleries.replace_geometry(plates,panels,plates.data.materials[0],archive)
    galleries.replace_geometry(ornament,relief,ornament.data.materials[0],archive)
    box(meshes['stone'],(0,-.10,29.84),(37.8,.60,1.16))
    # Three tall grilles below the clock, located from the existing tower box.
    body = by_id[base+'/0']
    level_vertices = [v.co for v in body.data.vertices if abs(v.co.z-43)<.01]
    # At 43 m only the 14.5 m tower and its next tier meet.
    tx = (min(v.x for v in level_vertices)+max(v.x for v in level_vertices))/2
    cy = (min(v.y for v in level_vertices)+max(v.y for v in level_vertices))/2
    front = cy+5.5
    for i in range(4):
        removed += galleries.cut_volume(by_id[base+'/'+str(i)],(tx-5.45,front-.9,43.26),(tx+5.45,front+.4,49.22),archive)
    tower_holes=[]
    for x in [tx-2.18,tx,tx+2.18]:
        tower_holes.append((x-.61,x+.61,43.72,48.65))
        sash(meshes,x,43.72,1.22,4.93,front,.65,2)
        for j in range(7):
            z=43.92+j*.66
            for sign in [-1,1]:
                meshes['metal'].beam((x-sign*.52,front-.51,z),(x+sign*.52,front-.51,z+.52),.035,.045)
    galleries.wall(meshes,tx-5.45,tx+5.45,43.26,49.22,front,tower_holes)
    finish(root,meshes,mats)
    root['spaceBundHeroDetail']['bronzeSpandrels']=21
    root['spaceBundHeroDetail']['rosettes']=21
    root['spaceBundHeroDetail']['remaining']='Roof side pavilions, side elevations and exact survey dimensions remain'
    return {'windowAxes':AXES,'mainWindowLevels':LEVELS,'bronzePanelLevels':PANELS,'bronzeSpandrels':21,
            'mainWindows':28,'portals':5,'doricColumns':4,'towerGrilles':3,'towerCenter':[tx,cy],
            'towerFront':front,'removedFaces':removed}


def peace(root,archive):
    base=root['spaceId']; by_id={o.get('spaceId'):o for o in previous.meshes(root)}
    mats={k:by_id[base+'/'+str(i)].data.materials[0] for k,i in [('stone',0),('glass',4),('trim',1),('metal',3)]}
    mats['trim']=material(mats['trim'],'20 sandstone dressings',rgb=(174,158,131),metal=.03,roughness=.68,illumination=.12)
    by_id[base+'/1'].data.materials[0]=mats['trim']
    by_id[hero.REVISION+'/'+base+'/roof-crest'].data.materials[0]=mats['trim']
    mats['metal']=material(mats['metal'],'20 dark upper window frames',rgb=(51,57,53),metal=.45,roughness=.36,illumination=.015)
    meshes=parts(); removed=0
    # Rebuild the top twenty metres of the riverfront. The west wings and
    # mapped courtyards are outside this box. All copper roof objects survive.
    for i in range(5):
        removed+=galleries.cut_volume(by_id[base+'/'+str(i)],(-1317.25,-1379.75,38.78),(-1312.45,-1354.25,57.69),archive)
    # Lower upper tier has three groups of three sashes, with stone spandrels.
    holes=[]
    for group in [-7.4,0,7.4]:
        for offset in [-1.72,0,1.72]:
            x=group+offset
            for z in [39.05,43.25]:
                holes.append((x-.58,x+.58,z,z+2.80))
                sash(meshes,x,z,1.16,2.80,15.0,.55,2)
            hero.rectangular_frame(meshes['trim'],x,15.055,42.62,1.10,.72,.045,.07)
    galleries.wall(meshes,-12.75,12.75,38.78,46.50,15.0,holes)
    # The first candidate exposed the old solid tier behind the new skin.
    # Close its bottom, roof and side returns; keep all glazing apertures open.
    box(meshes['stone'],(0,12.87,38.68),(25.5,4.26,.36))
    box(meshes['stone'],(0,12.87,46.50),(25.5,4.26,.16))
    for x in [-12.75,12.75]:
        box(meshes['stone'],(x,12.87,42.64),(.16,4.26,7.72))
    # Side shoulders rise around a recessed central arch. The photographed
    # front has triple side windows and narrow terraces, not four bare panes.
    for left,right in [(-12.75,-3.35),(3.35,12.75)]:
        holes=[]
        for x in [-9.12,-7.4,-5.68] if left < 0 else [5.68,7.4,9.12]:
            holes.append((x-.58,x+.58,47.08,49.88))
            sash(meshes,x,47.08,1.16,2.80,13.2,.55,2)
        galleries.wall(meshes,left,right,46.50,53.15,13.2,holes)
        for z,h,d in [(50.55,.16,.35),(52.70,.16,.43),(53.13,.26,.65)]:
            box(meshes['trim'],((left+right)/2,13.2+d/2,z),(right-left+.12,d,h))
        for j in range(12):
            x=left+.30+j*(right-left-.60)/11
            hero.rectangular_frame(meshes['trim'],x,13.27,51.74,.30,.96,.035,.065)
        galleries.railing(meshes['metal'],left+.16,right-.16,53.3,13.15,height=.77)
        # Terrace deck and a return to the recessed top storey.
        box(meshes['trim'],((left+right)/2,12.35,53.24),(right-left,2.35,.16))
        for x in [left,right]: box(meshes['stone'],(x,11.97,49.825),(.14,2.46,6.65))
    # Build the arch near y=0 then translate its masonry, avoiding the original
    # arch helper's fixed back depth being stretched across the whole building.
    arch_parts=parts()
    windows.arch_window(arch_parts,0,48.02,3.90,4.38,0)
    for key,part in arch_parts.items():
        part.vertices=[(x,y+11.8,z) for x,y,z in part.vertices]
        for face in part.faces: meshes[key].face([part.vertices[i] for i in face])
    galleries.wall(meshes,-3.35,3.35,46.50,53.30,11.8,[(-1.95,1.95,48.02,52.40)])
    for x in [-1.0,1.0]:
        box(meshes['metal'],(x,11.30,49.54),(.045,.08,2.85))
    for z in [48.95,49.90,50.40]: box(meshes['metal'],(0,11.31,z),(3.70,.08,.045))
    # The photograph shows a solid carved parapet, not an open balustrade.
    box(meshes['trim'],(0,13.7,47.83),(6.9,4.2,.28))
    for x in [-2.5,-1.25,0,1.25,2.5]:
        box(meshes['trim'],(x,14.15,47.40),(.24,1.10,.60))
    box(meshes['stone'],(0,15.45,48.43),(6.65,.36,.85))
    for x in [-3+i*.6 for i in range(11)]:
        hero.rectangular_frame(meshes['trim'],x,15.66,48.43,.34,.63,.038,.065)
        for dx in [-.06,.06]: box(meshes['trim'],(x+dx,15.70,48.41),(.035,.06,.39))
    for z in [48.02,48.85]: box(meshes['trim'],(0,15.60,z),(6.85,.36,.17))
    for x in [-3.30,3.30]: box(meshes['stone'],(x,13.65,48.43),(.20,3.62,.85))
    top_holes=[]
    for x in [-8,-4,0,4,8]:
        top_holes.append((x-.70,x+.70,54.30,56.34))
        sash(meshes,x,54.30,1.40,2.04,11.5,.55,2)
    galleries.wall(meshes,-11.5,11.5,53.30,57.69,11.5,top_holes)
    for x in [-11.5,11.5]: box(meshes['stone'],(x,11.08,55.5),(.14,.84,4.4))
    box(meshes['stone'],(0,11.08,57.69),(23,.84,.14))
    for z,h,d in [(56.98,.19,.5),(57.30,.25,.9),(57.58,.16,.65)]:
        box(meshes['trim'],(0,11.5+d/2,z),(23.5,d,h))
    for i in range(37): box(meshes['trim'],(-11.3+i*22.6/36,11.87,57.03),(.20,.45,.28))
    finish(root,meshes,mats,city=True)
    root['spaceBundHeroDetail']['remaining']='Full-height riverfront grouping, side elevations and exact dimensions still need reconstruction'
    return {'upperGroupedWindows':24,'topWindows':5,'centralArches':1,'terraces':2,'carvedParapetPanels':11,'removedFaces':removed}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--close',action='store_true')
    parser.add_argument('--suite',action='store_true',help='Review both frontages by day and night, plus tower grilles')
    parser.add_argument('--focus',choices=['13','20'],default='13')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and args.review_saved: parser.error('Review cannot save')
    scene=bpy.context.scene; source=ROOT/'design/space/scenes/shanghai.blend'
    if Path(bpy.data.filepath).resolve()!=source or scene.get('space_asset')!='shanghai' or scene.get('space_contract')!=2:
        raise RuntimeError('Open the repository contract-v2 Shanghai source')
    initial=source.stat(); OUTPUT.mkdir(parents=True,exist_ok=True)
    by_id={o.get('spaceId'):o for o in scene.objects if o.get('space_export')}
    roots={n:by_id[hero.IDS[n]] for n in ['13','20']}
    report={'revision':REVISION,'saved':False,'buildings':{}}
    if args.review_saved and any(r.get('spaceBundFrontageRevision')!=REVISION for r in roots.values()):
        raise RuntimeError('The saved source does not contain this frontage revision')
    if not args.review_saved:
        if any(r.get('spaceBundFrontageRevision') for r in roots.values()): raise RuntimeError('Already authored; preserve subsequent edits')
        if any(r.get('spaceBundHeroRevision')!=hero.REVISION for r in roots.values()): raise RuntimeError('Author the preceding hero revision first')
        before=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive=bpy.data.collections.new('ARCHIVE before Bund riverfronts 20260909 (not exported)')
        scene.collection.children.link(archive); archive.hide_render=archive.hide_viewport=True
        for number,author in [('13',customs),('20',peace)]:
            root=roots[number]; detail=author(root,archive)
            root['spaceBundFrontageRevision']=REVISION
            root['spaceBundFrontageDetail']=detail|{'estimated':True}
            root['spaceFacadeDetail']['stoneMeshes']=sum('bund-stone' in str(m.get('spaceShaderKey','')) for o in previous.meshes(root) for m in o.data.materials)
            report['buildings'][number]=detail
        bpy.context.view_layer.update()
        after=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[k]!=n for k,n in before.items()): raise RuntimeError('Original runtime ID lost')
        if any(n!=1 for k,n in after.items() if k is not None): raise RuntimeError('Duplicate runtime ID')
        for number,height in [('13',79.2),('20',77)]:
            if abs(previous.bounds(roots[number])[1].z-height)>.025: raise RuntimeError('Roof envelope changed: '+number)
        if any(not o.data.polygons for r in roots.values() for o in previous.meshes(r)): raise RuntimeError('Empty runtime geometry')
        report.update(preservedIds=sum(k is not None for k in before),newMeshes=sum(after.values())-sum(before.values()))
        if args.apply:
            latest=source.stat()
            if (latest.st_mtime_ns,latest.st_size)!=(initial.st_mtime_ns,initial.st_size): raise RuntimeError('Source changed in another editor')
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
            report['saved']=True
    (OUTPUT/(args.label+'-'+args.focus+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('BUND_FRONTAGE_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render:
        hero.OUTPUT=OUTPUT
        if args.suite:
            for number in ['13','20']:
                for night in [False,True]:
                    hero.review(roots[number],number,args.label,night,True,18 if number=='13' else 49,42 if number=='13' else 28)
            hero.review(roots['13'],'13',args.label+'-tower',False,True,46,18)
        else:
            hero.review(roots[args.focus],args.focus,args.label,args.night,args.close,
                        (18 if args.focus=='13' else 49) if args.close else None,
                        (42 if args.focus=='13' else 28) if args.close else None)


if __name__=='__main__': main()
