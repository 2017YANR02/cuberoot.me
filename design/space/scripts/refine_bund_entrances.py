"""Incremental, photo-referenced Bund 1/2 roof and entrance authoring.

Preview by default. --apply saves only the authored scene, before review staging.
Metric dimensions below are photo estimates, not measured architectural drawings.
See ../references/shanghai-landmarks.md for the actual photographs and limits.
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
import refine_shanghai_landmarks as previous
from refine_jin_mao import Mesh

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-bund12'
REVISION = 'bund-entrances-20260908'


def box(part, center, size):
    x, y, z = center
    a, b, c = [v / 2 for v in size]
    pts = [(x + i*a, y + j*b, z + k*c) for i,j,k in
           [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    for ids in [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
        part.face([pts[i] for i in ids])


def extrude(part, profile, back, front):
    # Profile runs counterclockwise in x/z; front normal points toward +Y.
    part.face([(x, back, z) for x,z in profile])
    part.face([(x, front, z) for x,z in reversed(profile)])
    for a,b in zip(profile, profile[1:]+profile[:1]):
        part.face([(a[0],back,a[1]),(b[0],back,b[1]),(b[0],front,b[1]),(a[0],front,a[1])])


def arc(part, x, z, inner, outer, back, front, start=0, end=math.pi, steps=48):
    for i in range(steps):
        a = start + (end-start)*i/steps
        b = start + (end-start)*(i+1)/steps
        extrude(part, [(x+inner*math.cos(a),z+inner*math.sin(a)),
                       (x+outer*math.cos(a),z+outer*math.sin(a)),
                       (x+outer*math.cos(b),z+outer*math.sin(b)),
                       (x+inner*math.cos(b),z+inner*math.sin(b))],back,front)


def cylinder(part, x, y, bottom, top, radius, upper=None, steps=40):
    upper = radius if upper is None else upper
    for i in range(steps):
        a,b = math.tau*i/steps, math.tau*(i+1)/steps
        p,q = (x+radius*math.cos(a),y+radius*math.sin(a)),(x+radius*math.cos(b),y+radius*math.sin(b))
        r,s = (x+upper*math.cos(a),y+upper*math.sin(a)),(x+upper*math.cos(b),y+upper*math.sin(b))
        part.face([(*p,bottom),(*q,bottom),(*s,top),(*r,top)])
        part.face([(x,y,top),(*r,top),(*s,top)])
        part.face([(x,y,bottom),(*q,bottom),(*p,bottom)])


def archive_mesh(obj, archive):
    backup = obj.copy()
    backup.data = obj.data.copy()
    archive.objects.link(backup)
    backup.name = 'Before entrance refinement ' + obj.name
    backup['space_export'] = False
    backup.hide_render = True
    # Keep archival IDs out of runtime identity lookups.
    backup['archivedSpaceId'] = backup.get('spaceId', '')
    if 'spaceId' in backup: del backup['spaceId']


def archive_and_filter(obj, predicate, archive):
    """Preserve the source mesh and all custom layers; edit only targeted faces."""
    archive_mesh(obj, archive)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    faces = [f for f in bm.faces if predicate([v.co for v in f.verts])]
    if not faces:
        bm.free()
        raise RuntimeError('Expected removable roof geometry missing: ' + obj.name)
    count = len(faces)
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return count


def entrance_strip(obj, archive):
    """Clip a bounded facade strip, including imported disconnected triangles.

    Plane cuts preserve UV layers and avoid a solid Boolean assumption about
    the captured facade. Side/back walls and the remaining window bays stay.
    """
    archive_mesh(obj, archive)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for axis, value in [(0,-6.1),(0,6.1),(2,5.2),(2,8.92),(1,-1.12)]:
        normal = Vector((int(axis==0),int(axis==1),int(axis==2)))
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                              plane_co=normal*value, plane_no=normal, dist=1e-6)
    faces = [f for f in bm.faces if (lambda p: -6.1<p.x<6.1 and 5.2<p.z<8.92 and p.y>-1.12)(f.calc_center_median())]
    count = len(faces)
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return count


def parts_for(root):
    by_id = {o.get('spaceId'): o for o in previous.meshes(root)}
    root_id = root['spaceId']
    source = {label:by_id[root_id+'/'+str(index)].data.materials[0]
              for label,index in [('stone',0),('glass',1),('trim',2),('metal',3)]}
    mats = {name:previous.material(mat, root.name+' entrance '+name) for name,mat in source.items()}
    for name,mat in mats.items(): mat['spaceMaterialId'] = REVISION+'/'+root_id+'/'+name
    return {name:Mesh() for name in mats}, mats, by_id


def finish(root, parts, mats, detail):
    count = 0
    for name,part in parts.items():
        if not part.faces: continue
        label = root.name + ' photo referenced ' + name
        obj = part.object(label, mats[name], root, root.users_collection[0])
        obj['spaceId'] = REVISION+'/'+root['spaceId']+'/'+name
        obj['spaceBundEntrancePart'] = name
        obj['spaceBundEntranceRevision'] = REVISION
        # Metric UVs for the existing stone micro-surface maps.
        uv = obj.data.uv_layers.active
        for face in obj.data.polygons:
            axis = max(range(3), key=lambda i:abs(face.normal[i]))
            axes = [i for i in range(3) if i != axis]
            for li in face.loop_indices:
                p = obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv.data[li].uv = (p[axes[0]]*.5,p[axes[1]]*.5)
        if 'bund-stone' in str(mats[name].get('spaceShaderKey')): count += 1
    root['spaceFacadeDetail']['stoneMeshes'] += count
    root['spaceBundEntranceRevision'] = REVISION
    root['spaceBundEntranceDetail'] = detail | {'estimated':True}


def asia(root, archive):
    parts,mats,by_id = parts_for(root)
    stone,trim,glass,metal = (parts[n] for n in ['stone','trim','glass','metal'])
    removed = sum(archive_and_filter(by_id[root['spaceId']+'/'+str(i)],
                  lambda points:min(p.z for p in points)>30.44, archive) for i in [0,2])
    width = float(root['frontage'])
    # Two attic blocks: actual semicircular openings, flat entablatures and
    # shallow concave returns at their ends, replacing the imported triangles.
    for sign in [-1,1]:
        cx, spring, radius, top = sign*width*.37,30.65,2.05,34.15
        half = 3.65
        for side in [-1,1]:
            box(stone,(cx+side*(half+radius)/2,-.18,(spring+top)/2),(half-radius,.55,top-spring))
            box(stone,(cx+side*(half-.18),-3.2,(spring+top)/2),(.36,6.3,top-spring))
        for i in range(48):
            a,b=math.pi*i/48,math.pi*(i+1)/48
            x1,z1=cx+radius*math.cos(a),spring+radius*math.sin(a)
            x2,z2=cx+radius*math.cos(b),spring+radius*math.sin(b)
            extrude(stone,[(x2,z2),(x1,z1),(x1,top),(x2,top)],-.46,.1)
        box(stone,(cx,-6.15,(spring+top)/2),(half*2,.35,top-spring))
        box(stone,(cx,-3.05,top-.12),(half*2,6.25,.24))
        # Front glazing remains recessed behind the arch, with a clear opening
        # in the stone wall rather than a dark disk pasted onto a solid block.
        profile=[(cx+radius*math.cos(math.pi*i/48),spring+radius*math.sin(math.pi*i/48)) for i in range(49)]
        extrude(glass,profile,-.41,-.4)
        arc(trim,cx,spring,radius,radius+.28,-.03,.3)
        for k in range(-3,4):
            x=k*.52
            z=spring+math.sqrt(radius**2-x**2)
            box(metal,(cx+x,-.31,(spring+z)/2),(.065,.12,z-spring))
        for z in [spring+.58,spring+1.18]:
            span=math.sqrt(radius**2-(z-spring)**2)
            box(metal,(cx,-.31,z),(span*2,.12,.07))
        for k in range(17):
            angle=math.pi*(k+.5)/17
            a=(cx+(radius+.3)*math.cos(angle),.33,spring+(radius+.3)*math.sin(angle))
            b=(cx+(radius+.66)*math.cos(angle),.33,spring+(radius+.66)*math.sin(angle))
            trim.beam(a,b,.075,.12)
        box(trim,(cx,-.06,top+.04),(half*2+.3,.95,.24))
        box(trim,(cx,-.03,top+.24),(half*2+.5,1.04,.14))
        # Photo-visible scroll ends terminate the flat cap, without gable peaks.
        for side in [-1,1]:
            for j in range(12):
                a,b=j/12,(j+1)/12
                trim.beam((cx+side*(half+.12+a*.55),.28,top-.05-.6*a*a),
                          (cx+side*(half+.12+b*.55),.28,top-.05-.6*b*b),.14,.2)
        for y in [-1.4,-3.5,-5.65]:
            box(trim,(cx,y,top+.12),(half*2,.13,.17))
    # Central roof railing is dark metal, not a stone balustrade.
    span=width*.37-4.3
    for z in [30.95,31.8]: box(metal,(0,-.2,z),(span*2,.075,.075))
    for i in range(39): box(metal,(-span+span*2*i/38,-.2,31.38),(.045,.06,.86))
    # Paired Ionic entrance shafts and a barrel-vaulted canopy.
    # The existing central recessed window serves as a dark doorway behind it.
    for side in [-1,1]:
        for offset in [-.42,.42]:
            x=side*2.38+offset
            cylinder(trim,x,1.32,.1,6.7,.3,.255)
            for z,r,h in [(.2,.45,.23),(.47,.35,.18),(6.48,.37,.18)]:
                cylinder(trim,x,1.32,z-h/2,z+h/2,r)
            box(trim,(x,1.32,6.77),(.86,.82,.23))
            for s in [-1,1]: arc(trim,x+s*.27,6.6,.13,.18,1.53,1.69,0,math.tau,24)
    for z,depth,h in [(6.97,2.3,.24),(7.2,2.45,.18)]:
        box(trim,(0,.85,z),(6.55,depth,h))
    arc(trim,0,7.25,2.48,2.82,-.25,2.13)
    arc(trim,0,7.25,2.48,2.59,2.12,2.28)
    for side in [-1,1]:
        box(trim,(side*3.1,1,7.42),(.65,2.5,.22))
    finish(root,parts,mats,{'atticHalfRoundWindows':2,'atticCapHeight':34.46,
                          'pairedEntranceColumns':4,'barrelCanopy':True,'removedRoofFaces':removed})
    return {'building':root.name,'removedRoofFaces':removed}


def club(root, archive):
    parts,mats,by_id=parts_for(root)
    stone,trim,glass,metal=(parts[n] for n in ['stone','trim','glass','metal'])
    removed=archive_and_filter(by_id[root['spaceId']+'/2'],
              lambda ps:min(p.z for p in ps)>22.59 and min(p.y for p in ps)>-.72,archive)
    width=float(root['frontage'])
    for sign in [-1,1]:
        cx=sign*width*.37
        extrude(stone,[(cx-3.5,22.42),(cx+3.5,22.42),(cx,24.48)],-.4,.18)
        for side in [-1,1]:
            a=(cx+side*3.65,.47,22.42)
            b=(cx,.47,24.56)
            trim.beam(a,b,.33,.52)
            trim.beam((a[0],.55,a[2]-.24),(b[0],.55,b[2]-.24),.12,.19)
        box(trim,(cx,.35,22.42),(7.5,.85,.32))
        # A central relief and drooping festoon are estimated from the photo.
        arc(trim,cx,23.33,.2,.38,.2,.4,0,math.tau,32)
        for side in [-1,1]:
            for i in range(18):
                a,b=i/18,(i+1)/18
                trim.beam((cx+side*(.4+a*1.45),.37,23.15-.37*math.sin(a*math.pi)),
                          (cx+side*(.4+b*1.45),.37,23.15-.37*math.sin(b*math.pi)),.12,.16,8)
    # Low panelled parapet between the gables, with the existing domed
    # pavilions kept at their original metric positions and heights.
    span=width*.37-3.65
    box(stone,(0,-.1,22.9),(span*2,.5,.65))
    box(trim,(0,.02,23.3),(span*2+.16,.75,.18))
    for i in range(19):
        x=-span+.25+(span*2-.5)*i/18
        box(trim,(x,.23,22.94),(.11,.17,.52))
    # Replace the three conflicting upper entrance windows with solid masonry
    # around two real circular openings. The original front is a triangle soup,
    # so a solid Boolean can silently leave disks or overlapping window frames.
    clipped = sum(entrance_strip(o,archive) for o in list(by_id.values()))
    lower,upper,radius,center=5.2,8.92,.76,7.65
    for left,right in [(-6.1,-3.9-radius),(-3.9+radius,-1.18),(1.18,3.9-radius),(3.9+radius,6.1)]:
        box(stone,((left+right)/2,-.18,(lower+upper)/2),(right-left,.56,upper-lower))
    # The central entrance arch rises behind the pitched canopy.
    for i in range(32):
        a,b=math.pi*i/32,math.pi*(i+1)/32
        x1,z1=1.18*math.cos(a),lower+1.18*math.sin(a)
        x2,z2=1.18*math.cos(b),lower+1.18*math.sin(b)
        extrude(stone,[(x2,z2),(x1,z1),(x1,upper),(x2,upper)],-.46,.1)
    profile=[(1.18*math.cos(math.pi*i/32),lower+1.18*math.sin(math.pi*i/32)) for i in range(33)]
    extrude(glass,profile,-.82,-.81)
    arc(trim,0,lower,1.18,1.37,-.05,.18)
    # Low relief garland above the entrance, visible in the reference photo;
    # sculptural contours are simplified, not a photogrammetric reproduction.
    for i in range(32):
        a,b=-1.35+2.7*i/32,-1.35+2.7*(i+1)/32
        trim.beam((a,.28,8.38-.4*math.cos(a/1.35*math.pi/2)),
                  (b,.28,8.38-.4*math.cos(b/1.35*math.pi/2)),.18,.23,8)
    for side in [-1,1]:
        arc(trim,side*1.44,8.4,.09,.19,.1,.3,0,math.tau,24)
        trim.beam((side*1.44,.25,8.25),(side*1.57,.25,7.65),.12,.16)
    for x in [-3.9,3.9]:
        profile=[(x+.76*math.cos(math.tau*i/64),7.65+.76*math.sin(math.tau*i/64)) for i in range(64)]
        for i in range(32):
            a,b=-math.pi/2+math.pi*i/32,-math.pi/2+math.pi*(i+1)/32
            x1,x2=x+radius*math.sin(a),x+radius*math.sin(b)
            z1,z2=radius*math.cos(a),radius*math.cos(b)
            extrude(stone,[(x1,center+z1),(x2,center+z2),(x2,upper),(x1,upper)],-.46,.1)
            extrude(stone,[(x1,lower),(x2,lower),(x2,center-z2),(x1,center-z1)],-.46,.1)
        arc(trim,x,7.65,.76,.96,-.1,.45,0,math.tau,64)
        arc(trim,x,7.65,.96,1.05,.09,.25,0,math.tau,64)
        extrude(glass,profile,-.82,-.81)
        box(metal,(x,-.7,7.65),(.055,.08,1.45))
    # Sloped metal and glass entrance canopy, with a small central front gable.
    # The 0.75 m side pitch and protrusion are estimated from the photo.
    for side in [-1,1]:
        for i in range(7):
            a,b=side*(1.8+i*.88),side*(1.8+(i+1)*.88)
            panel=[(a,.15,5.1),(b,.15,5.1),(b,3.75,4.35),(a,3.75,4.35)]
            glass.face(panel if side>0 else list(reversed(panel)))
            metal.beam((a,.12,5.15),(a,3.8,4.39),.09,.12)
        panel=[(0,.15,5.5),(side*1.8,.15,5.1),(side*1.8,3.75,4.35),(0,3.75,5.12)]
        glass.face(panel if side>0 else list(reversed(panel)))
        metal.beam((0,3.82,5.18),(side*1.84,3.82,4.39),.15,.18)
        metal.beam((side*1.84,3.82,4.39),(side*7.96,3.82,4.39),.14,.2)
        for x in [side*3.6,side*7.7]:
            metal.beam((x,.1,7),(x,3.75,4.4),.065,.065,8)
            metal.beam((x,.12,3.1),(x,2.6,4.57),.095,.1)
    for y in [.2,1.1,2,2.9,3.75]:
        z=5.1-(y-.15)/3.6*.75
        for side in [-1,1]:
            metal.beam((side*1.8,y,z+.04),(side*7.96,y,z+.04),.065,.09)
        metal.beam((-1.8,y,z+.04),(0,y,5.5-(y-.15)/3.6*.38+.04),.065,.09)
        metal.beam((0,y,5.5-(y-.15)/3.6*.38+.04),(1.8,y,z+.04),.065,.09)
    root['spaceFacadeDetail']['fittedWindows'] -= 3
    finish(root,parts,mats,{'endGables':2,'entranceOculi':2,'canopyWidth':15.92,
                          'canopyProjection':3.85,'canopyType':'pitched metal and glass',
                          'replacedUpperEntranceBays':3,
                          'removedParapetFaces':removed,'replacedSpandrelFaces':clipped})
    return {'building':root.name,'removedParapetFaces':removed,'replacedSpandrelFaces':clipped}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--baseline',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--focus',choices=['1','2'],default='1')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and (args.review_saved or args.baseline): raise RuntimeError('Review cannot save')
    scene=bpy.context.scene
    if Path(bpy.data.filepath).resolve()!=ROOT/'design/space/scenes/shanghai.blend' or scene.get('space_contract')!=2 or scene.get('space_asset')!='shanghai':
        raise RuntimeError('Use the repository contract-v2 Shanghai source')
    OUTPUT.mkdir(parents=True,exist_ok=True)
    roots={o.get('spaceId'):o for o in scene.objects if o.get('space_export')}
    selected=[roots['root/147/8/'+str(i)] for i in range(2)]
    report={'revision':REVISION,'saved':False,'buildings':[]}
    original=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
    if not args.baseline and not args.review_saved:
        if any(o.get('spaceBundEntranceRevision') for o in selected):
            raise RuntimeError('Already refined; inspect artist edits before rerunning')
        if any(o.get('spaceAuthoringRevision')!=previous.REVISION for o in selected):
            raise RuntimeError('Expected previous landmark authoring revision')
        archive=bpy.data.collections.new('ARCHIVE Bund 1 and 2 before entrance authoring (not exported)')
        scene.collection.children.link(archive)
        archive.hide_render=True; archive.hide_viewport=True
        report['buildings']=[asia(selected[0],archive),club(selected[1],archive)]
        bpy.context.view_layer.update()
        current=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        assert all(current[key]==count for key,count in original.items()),'Runtime identity changed'
        assert all(count==1 for key,count in current.items() if key not in original),'Duplicate new IDs'
        assert 34.3<previous.bounds(selected[0])[1].z<34.6,'Asia attic cap or old triangles remain'
        assert abs(previous.bounds(selected[1])[1].z-28.645)<.02,'Club pavilion height changed'
        report['preservedIds']=len(original)
        report['newMeshes']=sum(current.values())-sum(original.values())
        if args.apply:
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
            report['saved']=True
    prefix=args.label+('-night-' if args.night else '-day-')+args.focus
    (OUTPUT/(prefix+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('BUND_ENTRANCE_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render:
        previous.OUTPUT=OUTPUT
        previous.review([selected[int(args.focus)-1]],'bund',prefix,args.night)


if __name__=='__main__': main()
