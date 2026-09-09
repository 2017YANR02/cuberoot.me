"""Incremental, photo-referenced authoring of Bund 1 galleries and Bund 2 lanterns.

Preview without saving; --apply writes only the validated Shanghai source.
References/estimated dimensions: ../references/shanghai-landmarks.md.
Existing runtime IDs, geographic transforms and earlier entrance edits survive.
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
import refine_bund_entrances as entrances
import refine_shanghai_landmarks as previous
from refine_jin_mao import Mesh
from refine_bund_entrances import box, arc, extrude

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-bund-details'
REVISION = 'bund-galleries-20260909'
ARCHIVED = set()


def archive(obj, collection):
    if obj.name not in ARCHIVED:
        entrances.archive_mesh(obj, collection)
        ARCHIVED.add(obj.name)


def cut_volume(obj, lower, upper, collection):
    """Cut actual apertures; retain interpolated UV/custom data outside the cut."""
    archive(obj, collection)
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    for axis in range(3):
        for value in (lower[axis], upper[axis]):
            point, normal = Vector(), Vector()
            point[axis], normal[axis] = value, 1
            bmesh.ops.bisect_plane(mesh, geom=list(mesh.verts)+list(mesh.edges)+list(mesh.faces),
                                   dist=1e-5, plane_co=point, plane_no=normal)
    faces = [f for f in mesh.faces if all(
        all(lower[a]-1e-4 <= v.co[a] <= upper[a]+1e-4 for a in range(3)) for v in f.verts)]
    removed = len(faces)
    bmesh.ops.delete(mesh, geom=faces, context='FACES_ONLY')
    bmesh.ops.delete(mesh, geom=[v for v in mesh.verts if not v.link_faces], context='VERTS')
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return removed


def replace_geometry(obj, part, mat, collection):
    archive(obj, collection)
    data = bpy.data.meshes.new(obj.name+' '+REVISION)
    data.from_pydata(part.vertices, [], part.faces)
    data.update()
    data.materials.append(mat)
    obj.data = data
    uv_metric(obj)


def uv_metric(obj):
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for face in obj.data.polygons:
        normal_axis = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = [i for i in range(3) if i != normal_axis]
        for li in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv = (p[axes[0]]*.5, p[axes[1]]*.5)


def lathe(part, x, y, profile, steps=32):
    for (z1,r1),(z2,r2) in zip(profile,profile[1:]):
        for i in range(steps):
            a,b=math.tau*i/steps,math.tau*(i+1)/steps
            part.face([(x+r1*math.cos(a),y+r1*math.sin(a),z1),
                       (x+r1*math.cos(b),y+r1*math.sin(b),z1),
                       (x+r2*math.cos(b),y+r2*math.sin(b),z2),
                       (x+r2*math.cos(a),y+r2*math.sin(a),z2)])


def ionic(part, x, y, bottom, top, radius):
    height=top-bottom
    profile=[(bottom,0),(bottom,radius*1.28),(bottom+.12,radius*1.28),
             (bottom+.23,radius*1.08),(bottom+.34,radius),
             (bottom+height*.32,radius*.99),(top-.55,radius*.85),
             (top-.43,radius*.95),(top-.33,radius*1.12),(top-.26,radius*1.12),
             (top-.23,0)]
    lathe(part,x,y,profile)
    box(part,(x,y,top-.12),(radius*2.9,radius*2.35,.25))
    # Scrolls wrap inward in relief on both visible faces of the capital.
    for front in [-1,1]:
        for side in [-1,1]:
            cx=x+side*radius*1.02
            for i in range(32):
                points=[]
                for j in [i,i+1]:
                    a=j/32*math.pi*3.6
                    r=radius*.39*(1-j/40)
                    points.append((cx+side*r*math.cos(a),y+front*radius*1.03,top-.3+r*math.sin(a)))
                part.beam(*points,.06,.08,8)


def window(parts, x, bottom, width, height, y, curved=False):
    """Recessed glazing with fitted jambs, sill and sash; coordinates in metres."""
    trim,glass,metal=(parts[k] for k in ['trim','glass','metal'])
    box(glass,(x,y-.07,bottom+height/2),(width,.035,height))
    for side in [-1,1]:
        box(trim,(x+side*(width/2+.10),y+.10,bottom+height/2),(.20,.30,height+.26))
    for z in [bottom-.1,bottom+height+.1]:
        box(trim,(x,y+.17,z),(width+.44,.42,.20))
    for side in [-1,0,1]:
        box(metal,(x+side*width*.28,y-.015,bottom+height/2),(.045,.07,height-.10))
    for step in [1,2,3]:
        box(metal,(x,y-.01,bottom+height*step/4),(width-.09,.07,.045))
    if curved:
        # Segmental pediment over a rectangular door, as in the Club photograph.
        r=width*.7
        start,end=math.acos(width*.56/r),math.pi-math.acos(width*.56/r)
        arc(trim,x,bottom+height-.38,r,r+.17,y+.1,y+.42,start,end,32)
        box(trim,(x,y+.17,bottom+height+.17),(width+1,.4,.14))
        for side in [-1,1]:
            box(trim,(x+side*(width/2+.2),y+.16,bottom+height-.22),(.3,.35,.48))


def wall(parts, left, right, bottom, top, y, holes):
    """Masonry cells surround rectangular windows, leaving real clear openings."""
    xs=sorted({left,right,*[x for a,b,c,d in holes for x in (a,b)]})
    zs=sorted({bottom,top,*[z for a,b,c,d in holes for z in (c,d)]})
    for a,b in zip(xs,xs[1:]):
        for c,d in zip(zs,zs[1:]):
            x,z=(a+b)/2,(c+d)/2
            if not any(l < x < r and lo < z < hi for l,r,lo,hi in holes):
                box(parts['stone'],(x,y-.15,z),(b-a,.3,d-c))


def railing(part, left, right, bottom, y, curved=False, height=1.0):
    n=max(8,round((right-left)/.22))
    def point(t,z): return (left+(right-left)*t,y+(.62*math.sin(math.pi*t) if curved else 0),z)
    for z in [bottom+.12,bottom+height]:
        for i in range(n): part.beam(point(i/n,z),point((i+1)/n,z),.045,.065)
    for i in range(n+1): part.beam(point(i/n,bottom+.06),point(i/n,bottom+height),.035,.045)


def finish(root, parts, mats, detail):
    for name,part in parts.items():
        if not part.faces: continue
        obj=part.object(root.name+' '+REVISION+' '+name,mats[name],root,root.users_collection[0])
        obj['spaceId']=REVISION+'/'+root['spaceId']+'/'+name
        obj['spaceBundGalleryPart']=name
        uv_metric(obj)
    root['spaceBundGalleryRevision']=REVISION
    root['spaceBundGalleryDetail']=detail | {'estimated':True}
    root['spaceFacadeDetail']['stoneMeshes']=sum(
        'bund-stone' in str(mat.get('spaceShaderKey',''))
        for o in previous.meshes(root) for mat in o.data.materials)


def club(root, collection):
    parts,mats,by_id=entrances.parts_for(root)
    stone,trim,metal=(parts[n] for n in ['stone','trim','metal'])
    parts['columns'],parts['roof']=Mesh(),Mesh()
    mats['columns']=previous.material(mats['trim'],'Club pale rose stone columns',rgb=(211,196,169),metal=0,roughness=.65)
    mats['roof']=previous.material(by_id[root['spaceId']+'/5'].data.materials[0],'Club charcoal slate roof',rgb=(69,72,66),metal=.04,roughness=.8)
    for name,mat in mats.items(): mat['spaceMaterialId']=REVISION+'/'+root['spaceId']+'/'+name
    # The former single black pane and its floating surrounds are replaced,
    # including the six over-thick fluted columns. Keep the entrance below.
    removed=0
    for key,obj in by_id.items():
        if key.startswith(entrances.REVISION): continue
        if key in [root['spaceId']+'/4',root['spaceId']+'/5']: continue
        removed+=cut_volume(obj,(-13.94,-1.1,8.92),(13.94,2.5,18.90),collection)
    centers=[(i-2)*root['frontage']*.64/5 for i in range(5)]
    holes=[]
    for x in centers:
        for bottom,height in [(9.65,4.4),(16.0,2.5)]:
            holes.append((x-1.18,x+1.18,bottom,bottom+height))
            window(parts,x,bottom,2.36,height,-1.8,curved=bottom<10)
    wall(parts,-13.94,13.94,8.92,18.9,-1.8,holes)
    for side in [-1,1]:
        box(stone,(side*13.81,-.88,13.91),(.26,2.18,9.98))
    for i in range(6):
        x=(i/5-.5)*root['frontage']*.64
        ionic(parts['columns'],x,1.02,9.0,18.8,.53)
    for x in centers:
        railing(metal,x-1.5,x+1.5,9.1,.54,height=1.04)
        # Cross motifs sit behind the outer bars and remain bounded by the rails.
        for dx in [-.9,0,.9]:
            metal.beam((x+dx-.4,.56,9.23),(x+dx+.4,.56,10.10),.03,.04)
            metal.beam((x+dx+.4,.56,9.23),(x+dx-.4,.56,10.10),.03,.04)
    band=Mesh()
    box(band,(0,-1.62,9.13),(27.88,.23,.32))
    replace_geometry(by_id[root['spaceId']+'/4'],band,mats['stone'],collection)
    # Archive the original eight-post dark mushrooms; build pale stone lanterns
    # with four open arches, corner supports, roof ribs and urn-shaped finials.
    removed+=cut_volume(by_id[root['spaceId']+'/2'],(-18,-7,22.65),(18,.15,29),collection)
    roofs=Mesh()
    for sign in [-1,1]:
        cx,cy=sign*root['frontage']*.37,-3.4
        for z,width,depth in [(23.1,4.6,.35),(23.5,4.25,.32),(24.05,3.9,.26)]:
            box(trim,(cx,cy,z),(width,width,depth))
        for a in range(4):
            angle=a*math.pi/2
            # All four elevations use the same observed arch/paired-pier motif.
            face=Mesh()
            for side in [-1,1]:
                box(face,(side*1.48,0,25.2),(.65,.62,2.35))
                ionic(face,side*1.5,.36,24.12,26.65,.18)
                box(face,(side*1.48,.02,26.7),(.87,.85,.22))
            arc(face,0,26.13,.95,1.27,-.27,.31,steps=36)
            arc(face,0,26.13,1.3,1.45,-.20,.4,steps=36)
            for i in range(7):
                x=-1.07+i*2.14/6
                lathe(face,x,.03,[(23.67,.07),(23.80,.11),(24.02,.055),(24.13,.07)],12)
            box(face,(0,.03,24.18),(2.68,.37,.17))
            for polygon in face.faces:
                pts=[]
                for index in polygon:
                    x,y,z=face.vertices[index]
                    y+=1.44
                    pts.append((cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle),z))
                trim.face(pts)
        # Dome is smooth and pale in the photograph, rather than slate green.
        profile=[(27.04,1.92),(27.12,1.96)]
        profile += [(27.12+.97*math.sin(t*math.pi/2),1.96*math.cos(t*math.pi/2)) for t in [i/24 for i in range(1,25)]]
        lathe(roofs,cx,cy,profile,64)
        lathe(roofs,cx,cy,[(28.04,0),(28.04,.16),(28.12,.19),(28.21,.12),
                         (28.33,.2),(28.46,.14),(28.55,.065),(28.645,0)],32)
    replace_geometry(by_id[root['spaceId']+'/5'],roofs,mats['trim'],collection)
    by_id[root['spaceId']+'/5']['spaceBundGalleryPart']='lantern-roofs'
    for polygon in by_id[root['spaceId']+'/5'].data.polygons: polygon.use_smooth=True
    # The photo shows a recessed pitched slate roof, behind the front parapet.
    # Keep its estimated envelope beneath the two lantern finials.
    roof=parts['roof']
    back_y=min(v.co.y for v in by_id[root['spaceId']+'/0'].data.vertices)
    half_width=root['frontage']/2
    ridge_y=(-7+back_y)/2
    front_left,front_right=(-half_width,-7,22.55),(half_width,-7,22.55)
    back_left,back_right=(-half_width,back_y,22.55),(half_width,back_y,22.55)
    ridge_left,ridge_right=(-11,ridge_y,24.1),(11,ridge_y,24.1)
    for face in [[front_left,front_right,ridge_right,ridge_left],
                 [back_right,back_left,ridge_left,ridge_right],
                 [front_left,ridge_left,back_left],[front_right,back_right,ridge_right]]:
        roof.face(list(reversed(face)))
    roof.beam(ridge_left,ridge_right,.17,.14)
    for i in range(1,25):
        t=i/25
        for edge_y in [-7,back_y]:
            y=edge_y+(ridge_y-edge_y)*t
            half=half_width+(11-half_width)*t
            roof.beam((-half,y,22.56+1.55*t),(half,y,22.56+1.55*t),.026,.035)
    finish(root,parts,mats,{'lanterns':2,'lanternOpenArches':8,'backWallWindows':10,
                          'smoothIonicColumns':6,'backWallY':-1.8,'pitchedRoof':True,'removedFaces':removed})


def asia(root, collection):
    parts,mats,by_id=entrances.parts_for(root)
    for name,mat in mats.items(): mat['spaceMaterialId']=REVISION+'/'+root['spaceId']+'/'+name
    stone,trim,metal=(parts[n] for n in ['stone','trim','metal'])
    removed=0
    for key,obj in by_id.items():
        if key.startswith(entrances.REVISION): continue
        removed+=cut_volume(obj,(-12.8,-1.02,21.14),(12.8,1.4,29.92),collection)
        removed+=cut_volume(obj,(-12.8,-1.02,8.90),(12.8,1.4,21.14),collection)
    centers=[-5.76,0,5.76]
    holes=[]
    for x in centers:
        for bottom,height in [(21.6,3.4),(25.78,3.77)]:
            holes.append((x-2.14,x+2.14,bottom,bottom+height))
            window(parts,x,bottom,4.28,height,-2.7)
    wall(parts,-11.22,11.22,21.14,29.92,-2.7,holes)
    for side in [-1,1]:
        box(stone,(side*12.02,-.20,25.53),(1.56,.5,8.78))
        box(stone,(side*11.32,-1.44,25.53),(.2,2.85,8.78))
    for x in [-8.64,-2.88,2.88,8.64]:
        for dx in [-.34,.34]: ionic(trim,x+dx,.32,21.35,29.85,.29)
    for x in centers:
        for z in [21.38,25.50]:
            # Curved slab edge and iron guard form an actual balcony projection.
            for i in range(32):
                a,b=i/32,(i+1)/32
                x1,x2=x-2.85+5.7*a,x-2.85+5.7*b
                y1,y2=.09+.62*math.sin(math.pi*a),.09+.62*math.sin(math.pi*b)
                extrude_profile=[(x1,y1),(x2,y2),(x2,-2.6),(x1,-2.6)]
                trim.face([(u,v,z) for u,v in reversed(extrude_profile)])
                trim.face([(u,v,z-.26) for u,v in extrude_profile])
                trim.face([(x1,y1,z-.26),(x2,y2,z-.26),(x2,y2,z),(x1,y1,z)])
                if i==0: trim.face([(x1,-2.6,z-.26),(x1,y1,z-.26),(x1,y1,z),(x1,-2.6,z)])
                if i==31: trim.face([(x2,y2,z-.26),(x2,-2.6,z-.26),(x2,-2.6,z),(x2,y2,z)])
            railing(metal,x-2.8,x+2.8,z+.02,.04,curved=True,height=1.03)
    # Below the giant order, the photographed centre has three deep bays and
    # stone balcony rails. Replace the former eleven-window flat grid here.
    lower_holes=[]
    for x in centers:
        for bottom,height in [(9.08,3.0),(13.08,3.0),(17.08,3.83)]:
            lower_holes.append((x-2.14,x+2.14,bottom,bottom+height))
            window(parts,x,bottom,4.28,height,-2.7)
            box(trim,(x,-1.1,bottom-.12),(5.74,3.1,.24))
            for i in range(13):
                lathe(trim,x-2.06+i*4.12/12,.16,[(bottom,.07),(bottom+.13,.13),
                      (bottom+.32,.12),(bottom+.68,.065),(bottom+.80,.09)],12)
            box(trim,(x,.16,bottom+.86),(4.43,.46,.17))
        # Upper opening is a true semicircular arch with a recessed back wall.
        spring,radius=18.77,2.14
        for i in range(36):
            a,b=math.pi*i/36,math.pi*(i+1)/36
            x1,z1=x+radius*math.cos(a),spring+radius*math.sin(a)
            x2,z2=x+radius*math.cos(b),spring+radius*math.sin(b)
            extrude(stone,[(x2,z2),(x1,z1),(x1,21.14),(x2,21.14)],-2.65,.06)
        arc(trim,x,spring,radius,radius+.17,-.05,.24,steps=36)
    wall(parts,-12.8,12.8,8.90,21.14,-2.7,lower_holes)
    for x in [-10.35,-2.88,2.88,10.35]:
        width=4.90 if abs(x)>9 else 1.48
        box(stone,(x,-1.32,15.02),(width,2.76,12.24))
        for i in range(24):
            z=9.03+i*.5
            box(trim,(x,.085,z),(width,.055,.045))
    # Projecting pediments belong to the solid end wings, not every upper bay.
    for sign in [-1,1]:
        for x in [sign*root['frontage']/11*4,sign*root['frontage']/11*5]:
            extrude(trim,[(x-1.2,25.14),(x+1.2,25.14),(x,25.90)],-.20,.33)
            for side in [-1,1]: trim.beam((x+side*1.35,.46,25.11),(x,.46,25.96),.16,.23)
    finish(root,parts,mats,{'galleryBays':3,'pairedColumns':8,'curvedBalconies':6,
                          'stoneBalconies':9,'lowerArcades':3,'backWallWindows':15,
                          'backWallY':-2.7,'removedFaces':removed})


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--baseline',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--focus',choices=['1','2'],default='2')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and (args.review_saved or args.baseline): parser.error('Review cannot save')
    scene=bpy.context.scene
    source=ROOT/'design/space/scenes/shanghai.blend'
    if Path(bpy.data.filepath).resolve()!=source or scene.get('space_asset')!='shanghai' or scene.get('space_contract')!=2:
        raise RuntimeError('Open the repository contract-v2 Shanghai source')
    source_stat=source.stat()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    roots={o.get('spaceId'):o for o in scene.objects if o.get('space_export')}
    selected=[roots['root/147/8/'+str(i)] for i in range(2)]
    report={'revision':REVISION,'saved':False}
    if not (args.baseline or args.review_saved):
        if any(o.get('spaceBundGalleryRevision') for o in selected): raise RuntimeError('Already authored; do not overwrite artist edits')
        if any(o.get('spaceBundEntranceRevision')!=entrances.REVISION for o in selected): raise RuntimeError('Expected entrance revision')
        before=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        collection=bpy.data.collections.new('ARCHIVE before Bund galleries 20260909 (not exported)')
        scene.collection.children.link(collection)
        collection.hide_render=True; collection.hide_viewport=True
        asia(selected[0],collection)
        club(selected[1],collection)
        bpy.context.view_layer.update()
        after=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if not all(after[key]==count for key,count in before.items()): raise RuntimeError('Original runtime ID lost')
        # Instanced city objects deliberately carry no individual runtime ID.
        duplicates={str(key):count for key,count in after.items() if key is not None and count!=1}
        if duplicates: raise RuntimeError('Duplicate runtime IDs: '+json.dumps(duplicates))
        if any(not o.data.polygons for root in selected for o in previous.meshes(root)): raise RuntimeError('Empty runtime geometry')
        if abs(previous.bounds(selected[0])[1].z-34.46)>.03 or abs(previous.bounds(selected[1])[1].z-28.645)>.03:
            raise RuntimeError('Roof envelope unexpectedly changed')
        report.update(preservedIds=sum(1 for key in before if key is not None),newMeshes=sum(after.values())-sum(before.values()),
                      details=[o['spaceBundGalleryDetail'].to_dict() for o in selected])
        if args.apply:
            latest=source.stat()
            if (latest.st_mtime_ns,latest.st_size)!=(source_stat.st_mtime_ns,source_stat.st_size): raise RuntimeError('Source saved by another editor during review')
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
            report['saved']=True
    prefix=args.label+('-night-' if args.night else '-day-')+args.focus
    (OUTPUT/(prefix+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('BUND_GALLERY_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render:
        previous.OUTPUT=OUTPUT
        previous.review([selected[int(args.focus)-1]],'bund',prefix,args.night)


if __name__=='__main__': main()
