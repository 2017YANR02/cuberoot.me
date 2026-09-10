"""Photo-guided HSBC drum increment; never saves the canonical Shanghai file.

Import author(root, archive) for the parent's serialized integration. CLI renders
an in-memory candidate, or saves a candidate only in its isolated evidence folder.
All dimensions are photographic estimates. See ../references/hsbc-drum.md.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_frontages as frontages
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_shanghai_landmarks as previous
from refine_bund_entrances import box, extrude
from refine_jin_mao import Mesh

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-parallel-20260910/hsbc'
REVISION = 'hsbc-drum-20260910'
BUILDING_ID = 'root/147/6'
CENTER_Y = -4.7


def append_face(parts, face, angle, distance):
    """Reuse the front-facing helpers around an octagonal drum."""
    c, s = math.cos(angle), math.sin(angle)
    for name, part in face.items():
        for polygon in part.faces:
            parts[name].face([(x*c-(y+distance)*s,
                               x*s+(y+distance)*c+CENTER_Y, z)
                              for x,y,z in (part.vertices[i] for i in polygon)])


def octagonal_band(part, radius, z, height):
    # Annular moulding: a solid full disk would seal the balcony/crown void.
    outer=[(radius*math.cos(math.pi/8+i*math.pi/4),
            CENTER_Y+radius*math.sin(math.pi/8+i*math.pi/4)) for i in range(8)]
    inner=[((radius-.36)*math.cos(math.pi/8+i*math.pi/4),
            CENTER_Y+(radius-.36)*math.sin(math.pi/8+i*math.pi/4)) for i in range(8)]
    bottom,top=z-height/2,z+height/2
    for i in range(8):
        j=(i+1)%8
        a,b,c,d=outer[i],outer[j],inner[j],inner[i]
        part.face([(*a,bottom),(*b,bottom),(*b,top),(*a,top)])
        part.face([(*c,bottom),(*d,bottom),(*d,top),(*c,top)])
        part.face([(*a,top),(*b,top),(*c,top),(*d,top)])
        part.face([(*d,bottom),(*c,bottom),(*b,bottom),(*a,bottom)])


def balustrade(part, width, y, bottom, height=.86):
    """Turned stone balusters, rather than the previous pointed thin rods."""
    for z,w,d,h in [(bottom,width,.42,.15),
                     (bottom+height,width+.16,.47,.16)]:
        box(part,(0,y,z),(w,d,h))
    count=max(4,round((width-.22)/.46))
    for i in range(count):
        x=-width/2+.22+i*(width-.44)/(count-1)
        profile=[(bottom+.07,.115),(bottom+.16,.115),
                 (bottom+.21,.075),(bottom+.30,.105),
                 (bottom+.42,.11),(bottom+.56,.055),
                 (bottom+height-.13,.07),(bottom+height-.06,.10)]
        galleries.lathe(part,x,y,profile,12)


def pediment(parts, half_width, bottom, peak, y):
    extrude(parts['stone'],[(-half_width,bottom),(half_width,bottom),(0,peak)],y-.20,y+.02)
    for z,w,d,h in [(bottom-.12,half_width*2+.18,.62,.18),
                     (bottom+.02,half_width*2+.42,.72,.14)]:
        box(parts['trim'],(0,y,z),(w,d,h))
    for sign in [-1,1]:
        for dz,depth in [(0,.17),(.13,.23)]:
            a,b=(sign*(half_width+.17),bottom+dz),(0,peak+dz)
            profile=[a,b,(b[0],b[1]+.11),(a[0],a[1]+.11)]
            extrude(parts['trim'],profile if sign>0 else list(reversed(profile)),y-.12,y+depth)


def lower_stage(parts):
    radius=10.0
    half=radius*math.sin(math.pi/8)
    distance=radius*math.cos(math.pi/8)
    for side in range(8):
        face=frontages.parts()
        # The riverfront has two round shafts between outer square piers.
        # Only that photographed face is changed to a portico; hidden sides
        # retain the previous single-bay interpretation, with recessed glazing.
        if side==0:
            galleries.wall(face,-half,half,29.4,33.6,0,[(-2.65,2.65,29.8,32.87)])
            frontages.sash(face,0,29.8,5.3,3.07,0,.82,6)
            for x in [-1.0,1.0]:
                # This single profile includes the shaft. A second cylinder
                # overlaps it and creates the black sliver seen in round 1.
                galleries.lathe(face['trim'],x,.13,[(29.8,.33),(29.9,.33),(29.96,.255),
                    (32.60,.235),(32.71,.29),(32.78,.32)],40)
                box(face['trim'],(x,.13,32.82),(.71,.67,.13))
            for x in [-2.87,2.87]:
                box(face['trim'],(x,.03,31.34),(.47,.28,3.11))
                box(face['trim'],(x,.05,32.84),(.69,.51,.18))
            pediment(face,3.31,33.13,33.83,.12)
        else:
            galleries.wall(face,-half,half,29.4,33.6,0,[(-.95,.95,29.97,32.72)])
            frontages.sash(face,0,29.97,1.90,2.75,0,.55,2)
            hero.rectangular_frame(face['trim'],0,.065,31.345,2.13,2.98,.11,.16)
            for x in [-2.86,2.86]:
                hero.rectangular_frame(face['trim'],x,.075,31.25,.77,2.38,.065,.12)
        append_face(parts,face,side*math.pi/4,distance)
    for r,z,h in [(10.2,29.48,.16),(10.12,29.70,.12),
                   (10.28,33.14,.17),(10.45,33.38,.17),(10.32,33.59,.14)]:
        octagonal_band(parts['trim'],r,z,h)


def upper_stage(parts):
    radius=8.4
    half=radius*math.sin(math.pi/8)
    distance=radius*math.cos(math.pi/8)
    for side in range(8):
        face=frontages.parts()
        if side%2==0:
            galleries.wall(face,-half,half,33.67,37.72,0,[(-1.04,1.04,34.0,36.64)])
            frontages.sash(face,0,34.0,2.08,2.64,0,.57,2)
            hero.rectangular_frame(face['trim'],0,.04,35.32,2.33,2.89,.13,.17)
            box(face['trim'],(0,.13,36.91),(2.74,.48,.16))
            box(face['stone'],(0,.44,33.83),(3.47,1.14,.20))
            balustrade(face['trim'],3.26,.86,33.99,.87)
        else:
            # The photographed chamfer is a broad decorated stone pier, not
            # another copy of the principal opening and projecting balcony.
            galleries.wall(face,-half,half,33.67,37.72,0,[])
            for z,w,h in [(36.20,1.40,1.03),(34.95,1.16,1.04)]:
                hero.rectangular_frame(face['trim'],0,.04,z,w,h,.095,.16)
                hero.rectangular_frame(face['trim'],0,.135,z,w-.25,h-.25,.035,.04)
            for sign in [-1,1]:
                for offset in [-.15,0,.15]:
                    face['trim'].beam((-.43,.16,36.20+offset-sign*.22),
                                       (.43,.16,36.20+offset+sign*.22),.022,.025)
        # Massive shallow pilasters, a true recessed central window and a
        # balcony; no repeated triangular gable in front of every upper window.
        for x in [-2.12,2.12]:
            box(face['stone'],(x,.11,35.67),(.68,.33,3.47))
            hero.rectangular_frame(face['trim'],x,.285,35.60,.50,2.79,.055,.10)
            for z,w,h in [(33.94,.85,.17),(37.33,.89,.17)]:
                box(face['trim'],(x,.15,z),(w,.49,h))
        # A second, continuous railing is visible at the foot of the dome.
        balustrade(face['trim'],half*2-.26,.52,37.69,.84)
        append_face(parts,face,side*math.pi/4,distance)
    for r,z,h in [(8.63,37.31,.15),(8.8,37.51,.19),
                   (8.86,37.70,.13),(8.88,38.55,.18)]:
        octagonal_band(parts['trim'],r,z,h)
    # Eight corner plinths and paired aiming projectors visible in the night
    # photograph. Back-side repetitions and fixture sizes are estimates.
    for corner in range(8):
        a=math.pi/8+corner*math.pi/4
        x,y=8.82*math.cos(a),CENTER_Y+8.82*math.sin(a)
        for z,w,h in [(37.64,.78,.34),(38.24,.64,.94),(38.83,.48,.25),
                       (39.01,.42,.14)]:
            box(parts['trim'],(x,y,z),(w,w,h))
        fixtures={'metal':Mesh(),'lenses':Mesh()}
        for offset in [-.17,.17]:
            hero.fixture(fixtures['metal'],fixtures['lenses'],offset,0,39.08,.24)
        append_face(parts,fixtures,a-math.pi/2,8.82)
    # Four rectangular, flat-headed dormers project through the smooth dome
    # skirt. The facade photo establishes the front; reverse sides are inferred.
    for side in range(4):
        face=frontages.parts() | {'lenses':Mesh()}
        galleries.wall(face,-1.12,1.12,37.75,39.38,0,[(-.49,.49,38.11,38.91)])
        frontages.sash(face,0,38.11,.98,.80,0,.40,2)
        for x in [-1.03,1.03]: box(face['trim'],(x,.03,38.58),(.17,.25,1.32))
        for z,w,d,h in [(39.28,2.40,.62,.16),(39.46,2.59,.72,.15)]:
            box(face['trim'],(0,-.10,z),(w,d,h))
        # Seal the roof and cheeks behind the sash, joining the dome surface.
        for x in [-1.09,1.09]: box(face['stone'],(x,-.67,38.51),(.12,1.34,1.52))
        box(face['stone'],(0,-.62,39.29),(2.18,1.24,.18))
        for x in [-.78,-.26,.26,.78]:
            hero.fixture(face['metal'],face['lenses'],x,0,39.58,.20)
        append_face(parts,face,side*math.pi/2,8.53)


def author(root, archive):
    """Apply only to the caller's in-memory scene; caller owns serialized save."""
    if root.get('spaceId')!=BUILDING_ID:
        raise RuntimeError('HSBC root/147/6 required')
    if root.get('spaceHsbcDrumRevision'):
        raise RuntimeError('Already authored; refusing to overwrite later artist edits')
    if root.get('spaceBundHeroRevision')!=hero.REVISION:
        raise RuntimeError('Expected existing photo-guided HSBC column refinement')
    by_id={o.get('spaceId'):o for o in previous.meshes(root)}
    required=[BUILDING_ID+'/'+str(i) for i in range(6)]
    edited={BUILDING_ID+'/'+str(i) for i in [0,1,2,4,5]}
    if any(key not in by_id for key in required):
        raise RuntimeError('Required imported HSBC material meshes missing')
    if any(str(key).startswith(REVISION+'/') for key in by_id):
        raise RuntimeError('Partial HSBC revision already exists')
    before={key:(obj.matrix_world.copy(),len(obj.data.polygons)) for key,obj in by_id.items()}
    height=previous.bounds(root)[1].z
    parts=frontages.parts() | {'dome':Mesh(),'lenses':Mesh()}
    sources={name:by_id[BUILDING_ID+'/'+str(index)].data.materials[0]
          for name,index in [('stone',0),('glass',1),('trim',2),('metal',4)]}
    mats={name:sources[name].copy() for name in ['stone','glass']}
    mats['trim']=previous.material(sources['trim'],'HSBC drum warm limestone',
                                   rgb=(178,170,151),metal=.04,roughness=.70,illumination=.08)
    mats['metal']=previous.material(sources['metal'],'HSBC drum bronze and fixtures',
                                    rgb=(53,48,38),metal=.64,roughness=.45,illumination=.005)
    mats['dome']=previous.material(mats['trim'],'HSBC smooth pale dome',
                                   rgb=(200,198,182),metal=.02,roughness=.73,illumination=.06)
    mats['lenses']=previous.material(mats['trim'],'HSBC crown projector lenses',
                                     rgb=(224,213,184),metal=.10,roughness=.22,illumination=.3)
    for name,mat in mats.items(): mat['spaceMaterialId']=REVISION+'/'+name
    removed=0
    # Only the disconnected imported crown is replaced. The .001 m floor gap
    # preserves the existing 29.4 m main roof, all six giant columns and signs.
    for key in [BUILDING_ID+'/'+str(i) for i in [0,1,2,4]]:
        removed+=galleries.cut_volume(by_id[key],(-11,-15.71,29.401),(11,6.31,43.52),archive)
    lower_stage(parts)
    upper_stage(parts)
    profile=[(37.90+5.312*math.sin(i*math.pi/64),8.3*math.cos(i*math.pi/64))
             for i in range(33)]
    galleries.lathe(parts['dome'],0,CENTER_Y,profile,96)
    # Thin horizontal skirt mouldings replace sixteen invented prominent ribs.
    for z,r,h in [(37.97,8.36,.13),(38.19,8.34,.12),(38.41,8.30,.11)]:
        galleries.lathe(parts['dome'],0,CENTER_Y,[(z-h/2,r),(z+h/2,r)],96)
    galleries.lathe(parts['metal'],0,CENTER_Y,[(42.94,1.78),(43.09,1.78),
                      (43.15,1.57),(43.31,1.57),(43.38,1.84),(43.49,1.84)],64)
    for name,part in parts.items():
        if not part.faces: raise RuntimeError('Empty authored crown part: '+name)
        if name=='dome':
            # The old dome has its own imported material batch. Replace its
            # data in place so neither its old skin nor an empty runtime ID is
            # left behind. Preserve the existing object transform and ID.
            obj=by_id[BUILDING_ID+'/5']
            galleries.archive(obj,archive)
            data=bpy.data.meshes.new(REVISION+'/dome')
            data.from_pydata(part.vertices,[],part.faces)
            data.materials.append(mats[name])
            data.update()
            obj.data=data
        else:
            obj=part.object(root.name+' '+REVISION+' '+name,mats[name],root,root.users_collection[0])
            obj['spaceId']=REVISION+'/'+BUILDING_ID+'/'+name
        obj['spaceHsbcDrumPart']=name
        if name=='lenses': obj['spaceBundHeroPart']='lamp-lenses'
        galleries.uv_metric(obj)
        if name=='stone':
            for uv in obj.data.uv_layers.active.data: uv.uv.x*=.5
        if name=='dome':
            # The projecting dormers are actual openings in the curved skin.
            # Without this subtraction the curved dome would occlude their
            # recessed glass, despite the outer dormer frame being present.
            for minimum,maximum in [
                ((-1.10,CENTER_Y+7.18,37.76),(1.10,CENTER_Y+9,39.29)),
                ((-1.10,CENTER_Y-9,37.76),(1.10,CENTER_Y-7.18,39.29)),
                ((7.18,CENTER_Y-1.10,37.76),(9,CENTER_Y+1.10,39.29)),
                ((-9,CENTER_Y-1.10,37.76),(-7.18,CENTER_Y+1.10,39.29)),
            ]:
                galleries.cut_volume(obj,minimum,maximum,archive)
            # Mesh.face emits separate corner vertices. Weld only this new
            # curved skin so smooth shading actually crosses polygon edges.
            bm=bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
            bm.to_mesh(obj.data)
            bm.free()
            for face in obj.data.polygons: face.use_smooth=True
    bpy.context.view_layer.update()
    after={o.get('spaceId'):o for o in previous.meshes(root)}
    for key,(matrix,faces) in before.items():
        if key not in after or after[key].matrix_world!=matrix:
            raise RuntimeError('Original runtime identity or transform changed: '+key)
        if key not in edited and len(after[key].data.polygons)!=faces:
            raise RuntimeError('Unrelated HSBC detail changed: '+key)
    if any(not obj.data.polygons for obj in after.values()): raise RuntimeError('Empty runtime mesh')
    if abs(previous.bounds(root)[1].z-height)>.001: raise RuntimeError('Original apex height changed')
    detail={'estimated':True,'editedHeightMetres':[29.401,43.52],
            'retainedHeightMetres':height,'frontDrumColumns':2,'upperRecessedWindows':4,
            'upperBalconies':4,'diagonalDecoratedPiers':4,
            'crownBalustradeFaces':8,'flatHeadedDormers':4,
            'projectors':32,'removedFaces':removed,'newMeshes':len(parts)-1,
            'reusedDomeId':BUILDING_ID+'/5',
            'inferred':'Reverse drum faces, four-way dormer repetition and all fine dimensions',
            'lighting':'Fixture geometry only; preview illumination is not surveyed or exported'}
    root['spaceHsbcDrumRevision']=REVISION
    root['spaceHsbcDrumDetail']=detail
    root['spaceFacadeDetail']['stoneMeshes']=sum(
        'bund-stone' in str(m.get('spaceShaderKey',''))
        for o in previous.meshes(root) for m in o.data.materials)
    return detail


def review(root, label, night=False, wide=False):
    # hero.review sets 14 threads internally. A render-init handler enforces the
    # allocation limit after staging and before Cycles starts its render job.
    def cap_threads(scene, *unused):
        scene.render.threads_mode='FIXED'
        scene.render.threads=8
        print('HSBC_RENDER_THREADS '+str(scene.render.threads),flush=True)
    original=hero.OUTPUT
    hero.OUTPUT=OUTPUT
    bpy.app.handlers.render_init.append(cap_threads)
    bpy.app.handlers.render_pre.append(cap_threads)
    try:
        hero.review(root,'12',label,night,not wide,None if wide else 37.0,None if wide else 27)
        if bpy.context.scene.render.threads!=8: raise RuntimeError('Render thread cap was not applied')
    finally:
        bpy.app.handlers.render_init.remove(cap_threads)
        bpy.app.handlers.render_pre.remove(cap_threads)
        hero.OUTPUT=original


def verify(root):
    """Probe actual first-hit surfaces, including preserved neighboring meshes."""
    inverse=root.matrix_world.inverted()
    objects=list(previous.meshes(root))
    checks=[]

    def probe(label,origin,direction,part,expected_depth):
        hits=[]
        start=Vector(origin)
        direction=Vector(direction).normalized()
        for obj in objects:
            into=obj.matrix_world.inverted() @ root.matrix_world
            hit,location,normal,index=obj.ray_cast(into @ start,
                                                  (into.to_3x3() @ direction).normalized(),distance=100)
            if hit:
                depth=(inverse @ obj.matrix_world @ location-start).length
                if depth<6: hits.append((depth,obj.get('spaceId')))
        if not hits: raise RuntimeError('Crown probe missed: '+label)
        depth,identity=min(hits)
        wanted=BUILDING_ID+'/5' if part=='dome' else REVISION+'/'+BUILDING_ID+'/'+part
        if identity!=wanted or abs(depth-expected_depth)>.025:
            raise RuntimeError(f'Crown probe {label}: {identity} at {depth:.4f}, expected {wanted} at {expected_depth:.4f}')
        checks.append({'name':label,'firstId':identity,'depth':depth})

    distance=8.4*math.cos(math.pi/8)
    for side in range(8):
        a=side*math.pi/4
        c,s=math.cos(a),math.sin(a)
        x,z=.34,35.58
        origin=(x*c-(distance+1.4)*s,x*s+(distance+1.4)*c+CENTER_Y,z)
        probe('upper-drum-'+str(side),origin,(s,-c,0),
              'glass' if side%2==0 else 'stone',1.97 if side%2==0 else 1.4)
    for side in range(4):
        a=side*math.pi/2
        c,s=math.cos(a),math.sin(a)
        # Aim above the continuous crown handrail, which legitimately hides
        # the lower pane from a horizontal eye-level ray.
        x,z=.23,38.72
        probe('dormer-'+str(side),(x*c-10*s,x*s+10*c+CENTER_Y,z),
              (s,-c,0),'glass',1.87)
    probe('front-lower-portico',(.40,CENTER_Y+10*math.cos(math.pi/8)+1.4,31.2),
          (0,-1,0),'glass',2.22)
    dome_radius=8.3*math.sqrt(1-((40.5-37.9)/5.312)**2)
    # Polygon chord interpolation at this latitude is within the 25 mm tolerance.
    probe('smooth-dome',(0,CENTER_Y+10,40.5),(0,-1,0),'dome',10-dome_radius)
    return checks


def main():
    parser=argparse.ArgumentParser()
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument('--baseline',action='store_true')
    modes.add_argument('--review-saved',action='store_true')
    parser.add_argument('--save-candidate',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--wide',action='store_true')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in args.label):
        parser.error('Label must contain only ASCII letters, numbers, dash or underscore')
    if args.save_candidate and (args.baseline or args.review_saved): parser.error('Read-only review cannot save')
    source=ROOT/'design/space/scenes/shanghai.blend'
    scene=bpy.context.scene
    if scene.get('space_asset')!='shanghai' or scene.get('space_contract')!=2:
        raise RuntimeError('Expected contract-v2 Shanghai scene')
    opened=Path(bpy.data.filepath).resolve()
    if opened!=source.resolve() and not (args.review_saved and opened.is_relative_to(OUTPUT.resolve())):
        raise RuntimeError('Open the canonical source, or an isolated saved candidate for review')
    initial=source.stat()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    root=next(o for o in scene.objects if o.get('space_export') and o.get('spaceId')==BUILDING_ID)
    report={'revision':REVISION,'canonicalSourceSaved':False,
            'sourceSize':initial.st_size,'sourceMtimeNs':initial.st_mtime_ns}
    if args.review_saved:
        if root.get('spaceHsbcDrumRevision')!=REVISION: raise RuntimeError('Saved crown revision missing')
    elif not args.baseline:
        before=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive=bpy.data.collections.new('ARCHIVE before '+REVISION+' (not exported)')
        scene.collection.children.link(archive)
        archive.hide_render=archive.hide_viewport=True
        report['details']=author(root,archive)
        report['surfaceProbes']=verify(root)
        after=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[key]!=count for key,count in before.items()): raise RuntimeError('Original runtime ID lost')
        if any(count!=1 for key,count in after.items() if key is not None): raise RuntimeError('Duplicate runtime ID')
        report['preservedIds']=sum(key is not None for key in before)
        if args.save_candidate:
            candidate=OUTPUT/(args.label+'.blend')
            if candidate.exists(): raise RuntimeError('Candidate already exists; choose a fresh label')
            latest=source.stat()
            if (latest.st_mtime_ns,latest.st_size)!=(initial.st_mtime_ns,initial.st_size):
                raise RuntimeError('Canonical source changed during authoring; reopen latest version')
            bpy.ops.wm.save_as_mainfile(filepath=str(candidate),compress=True)
            report['candidateSaved']=str(candidate)
    if args.review_saved: report['surfaceProbes']=verify(root)
    (OUTPUT/(args.label+'-report.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('HSBC_DRUM_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render: review(root,args.label,args.night,args.wide)


if __name__=='__main__': main()
