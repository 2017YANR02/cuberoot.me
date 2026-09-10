"""Photo-guided Bund 13 roof pavilions and tower plinth, in the authored source.

Preview first; --apply saves before disposable render staging. Dimensions remain
photographic estimates; see ../references/shanghai-landmarks.md for provenance.
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
from refine_bund_entrances import box, extrude

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/bund-next'
REVISION = 'customs-roof-20260910'
# Existing roof footprint edges, in the building's local horizontal coordinates.
PAVILIONS = [(-16.45, 1.02, 3.95), (15.61, 1.27, 4.22)]


def cornice(part, half_width, front, z, projection, height):
    # One continuous chamfered profile avoids gaps between separate beams.
    h=half_width+projection
    flat=half_width-.65+projection*.42
    profile=[(-h,-front-1.65),(h,-front-1.65),(h,-.65+projection*.42),
             (flat,projection),(-flat,projection),(-h,-.65+projection*.42)]
    bottom=[(x,y,z-height/2) for x,y in profile]
    top=[(x,y,z+height/2) for x,y in profile]
    part.face(list(reversed(bottom))); part.face(top)
    for i in range(len(profile)):
        j=(i+1)%len(profile)
        part.face([bottom[i],bottom[j],top[j],top[i]])


def pavilion(parts, center, front, half_width):
    """Open arched face with chamfered cheeks and a layered stone entablature."""
    if half_width < 2 or not all(math.isfinite(v) for v in (center, front, half_width)):
        raise ValueError('Invalid pavilion footprint')
    local = frontages.parts()
    flat = half_width-.65
    bottom, height, width = 31.65, 3.20, 1.62
    galleries.wall(local, -flat, flat, 31.15, 39.50, 0,
                   [(-width/2, width/2, bottom, bottom+height)])
    windows.arch_window(local, 0, bottom, width, height, 0)
    # Cheeks join the retained side walls behind the edited front strip.
    for sign in [-1, 1]:
        a, b = sign*flat, sign*half_width
        cheek=[(a,0,31.15),(b,-.65,31.15),(b,-.65,39.5),(a,0,39.5)]
        side_wall=[(b,-.65,31.15),(b,-front-1.65,31.15),
                   (b,-front-1.65,39.5),(b,-.65,39.5)]
        local['stone'].face(cheek if sign<0 else list(reversed(cheek)))
        local['stone'].face(side_wall if sign<0 else list(reversed(side_wall)))
        # Narrow applied pilasters and capitals flanking the photographed arch.
        x = sign*1.12
        box(local['trim'],(x,.13,33.52),(.23,.34,3.74))
        for z,w,h in [(31.68,.37,.20),(35.27,.39,.18),(35.43,.46,.15)]:
            box(local['trim'],(x,.18,z),(w,.46,h))
    # Pediment tympanum, horizontal bed mould and sloping cornice profiles.
    extrude(local['stone'], [(-1.55,35.59),(1.55,35.59),(0,36.34)], .04,.30)
    for z,w,d,h in [(35.48,3.08,.56,.15),(35.64,3.30,.67,.12)]:
        box(local['trim'],(0,.16,z),(w,d,h))
    for dz,depth,thickness in [(0,.43,.11),(.11,.49,.10)]:
        for sign in [-1,1]:
            profile=[(sign*1.65,35.66+dz),(0,36.42+dz),
                     (0,36.42+dz+thickness),(sign*1.65,35.66+dz+thickness)]
            extrude(local['trim'],profile if sign>0 else list(reversed(profile)),.12,depth)
    # Thin ledges and broad upper fascia, with tiny dentils beneath the cornice.
    ledges = [(36.98,.17,.12),(37.20,.36,.20),(37.53,.20,.28),
              (38.00,.42,.18),(38.40,.25,.35),(39.46,.30,.14)]
    for z,projection,h in ledges:
        cornice(local['trim'],half_width,front,z,projection,h)
    count = round(flat*2/.26)
    for i in range(count):
        box(local['trim'],(-flat+.13+i*(flat*2-.26)/(count-1),.21,37.035),(.13,.31,.16))
    galleries.railing(local['metal'],-1.14,1.14,31.53,.41,height=.80)
    # Drawn in a local face plane so the reused arched reveal stays 60 cm deep.
    for name,part in local.items():
        part.vertices = [(x+center,y+front,z) for x,y,z in part.vertices]
        for face in part.faces:
            parts[name].face([part.vertices[i] for i in face])
    return {'center':center,'front':front,'archBottom':bottom,'archHeight':height,
            'archWidth':width,'pedimentTop':36.53}


def author(root, archive):
    base=root['spaceId']
    by_id={o.get('spaceId'):o for o in previous.meshes(root)}
    parts=frontages.parts()
    mats={k:by_id[base+'/'+str(i)].data.materials[0]
          for k,i in [('stone',0),('glass',1),('trim',2),('metal',3)]}
    for name,mat in list(mats.items()):
        mats[name]=mat.copy()
        mats[name]['spaceMaterialId']=REVISION+'/'+name
    # Match existing bronze sashes, without inheriting the old bright louver trim.
    mats['metal']=previous.material(mats['metal'],'Customs dark roof ironwork',
                                   rgb=(49,47,41),metal=.65,roughness=.43,illumination=.01)
    mats['metal']['spaceMaterialId']=REVISION+'/metal'
    removed=0
    # Replace the full front strip, including the inaccurate tall attic windows.
    # Retain the deep side/rear pavilions and every clock object and transform.
    for i in range(4):
        obj=by_id[base+'/'+str(i)]
        for left,right in [(-21.3,-11.80),(10.9,20.6)]:
            removed+=galleries.cut_volume(obj,(left,-1.5,31.15),(right,3.56,39.80),archive)
        removed+=galleries.cut_volume(obj,(-11.8,-2.80,31.15),(10.9,3.56,34.51),archive)
    pavilions=[pavilion(parts,*p) for p in PAVILIONS]
    # Low, recessed terrace windows, a walkable terrace and continuous iron rail.
    holes=[]
    for x in [-8,-4,0,4,8]:
        holes.append((x-.7,x+.7,31.58,32.73))
        frontages.sash(parts,x,31.58,1.4,1.15,-2.62,.55,2)
    galleries.wall(parts,-12.5,11.39,31.15,34.51,-2.62,holes)
    box(parts['stone'],(-.55,-.68,31.16),(24.05,3.88,.14))
    for z,d,h in [(33.50,.55,.12),(33.75,.68,.16),(34.1,.84,.25),(34.45,1.04,.18)]:
        box(parts['trim'],(-.55,-2.62+d/2,z),(24.05,d,h))
    galleries.railing(parts['metal'],-12.46,11.39,31.28,1.16,height=.82)
    # The photographed lower clock plinth is solid masonry, not two louvers.
    tx,cy=root['spaceBundFrontageDetail']['towerCenter']
    face=cy+7.25
    for i in [1,3]:
        removed+=galleries.cut_volume(by_id[base+'/'+str(i)],
            (tx-7.26,face-.15,34.6),(tx+7.26,face+.5,42.8),archive)
    for side in [-1,1]:
        x=tx+side*6.10
        box(parts['stone'],(x,face+.14,40.05),(1.80,.38,9.1))
        for z,w,d,h in [(43.05,2.07,.59,.17),(43.90,2.13,.69,.18),
                        (44.34,2.43,.94,.28),(44.60,2.04,.60,.18)]:
            box(parts['trim'],(x,face+.26,z),(w,d,h))
        for offset in [-.56,0,.56]:
            hero.rectangular_frame(parts['trim'],x+offset,face+.40,43.48,.43,.47,.055,.09)
    for z,d,h in [(35.17,.51,.13),(35.39,.68,.18),(42.10,.32,.12),(42.98,.52,.16)]:
        box(parts['trim'],(tx,face+d/2-.03,z),(14.7,d+.06,h))
    panel_centers=[tx-4.64+i*1.16 for i in range(9)]
    for x in panel_centers:
        hero.rectangular_frame(parts['trim'],x,face+.16,42.55,.85,.59,.07,.10)
    # Small physical shadow brackets below the tower ledge replace a flat slab.
    for x in [tx-6.4+i*.8 for i in range(17)]:
        box(parts['trim'],(x,face+.28,35.10),(.22,.44,.26))
    for name,part in parts.items():
        obj=part.object(root.name+' roof '+name,mats[name],root,root.users_collection[0])
        obj['spaceId']=REVISION+'/'+base+'/'+name
        obj['spaceCustomsRoofPart']=name
        galleries.uv_metric(obj)
        if name=='stone':
            for uv in obj.data.uv_layers.active.data: uv.uv.x*=.5
    root['spaceFacadeDetail']['stoneMeshes']=sum(
        'bund-stone' in str(m.get('spaceShaderKey','')) for o in previous.meshes(root) for m in o.data.materials)
    return {'pavilions':pavilions,'terraceWindows':5,'plinthPanels':9,'towerPiers':2,
            'towerFront':face,'removedFaces':removed,'estimated':True}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--wide',action='store_true')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and args.review_saved: parser.error('Review cannot save')
    source=ROOT/'design/space/scenes/shanghai.blend'
    scene=bpy.context.scene
    if Path(bpy.data.filepath).resolve()!=source or scene.get('space_asset')!='shanghai' or scene.get('space_contract')!=2:
        raise RuntimeError('Open the repository contract-v2 Shanghai source')
    initial=source.stat(); OUTPUT.mkdir(parents=True,exist_ok=True)
    root=next(o for o in scene.objects if o.get('space_export') and o.get('spaceId')=='root/147/5')
    report={'revision':REVISION,'saved':False}
    if args.review_saved:
        if root.get('spaceCustomsRoofRevision')!=REVISION: raise RuntimeError('Saved roof revision missing')
    else:
        if root.get('spaceCustomsRoofRevision'): raise RuntimeError('Already authored; preserve subsequent artist edits')
        if root.get('spaceBundFrontageRevision')!=frontages.REVISION: raise RuntimeError('Expected photo-guided frontage')
        before=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive=bpy.data.collections.new('ARCHIVE before Customs roof 20260910 (not exported)')
        scene.collection.children.link(archive); archive.hide_render=archive.hide_viewport=True
        detail=author(root,archive)
        root['spaceCustomsRoofRevision']=REVISION; root['spaceCustomsRoofDetail']=detail
        bpy.context.view_layer.update()
        after=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[k]!=n for k,n in before.items()): raise RuntimeError('Original runtime ID lost')
        if any(n!=1 for k,n in after.items() if k is not None): raise RuntimeError('Duplicate runtime ID')
        if any(not o.data.polygons for o in previous.meshes(root)): raise RuntimeError('Empty runtime geometry')
        if abs(previous.bounds(root)[1].z-79.2)>.025: raise RuntimeError('Clock tower envelope changed')
        report.update(preservedIds=sum(k is not None for k in before),newMeshes=4,details=detail)
        if args.apply:
            latest=source.stat()
            if (latest.st_mtime_ns,latest.st_size)!=(initial.st_mtime_ns,initial.st_size):
                raise RuntimeError('Source changed in another editor')
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
            report['saved']=True
    phase='review' if args.review_saved else 'author'
    (OUTPUT/(args.label+'-'+phase+'-roof.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('CUSTOMS_ROOF_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render:
        hero.OUTPUT=OUTPUT
        hero.review(root,'13',args.label,args.night,not args.wide,
                    None if args.wide else 38,None if args.wide else 47)


if __name__=='__main__': main()
