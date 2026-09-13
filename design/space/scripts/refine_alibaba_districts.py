"""Incremental X/Z campus authoring. See references/alibaba-xuhui.md.

X follows 2020 built photographs; Z follows the published SOM 2022 design.
Dimensions without surveyed drawings are estimates. Never rebuild an authored
revision. Preview first; --apply saves before any temporary lighting changes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import shutil
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).parent))
from refine_alibaba_campus import ROOT, SOURCE, material, camera
from refine_jin_mao import Mesh
from refine_bund_entrances import box, cylinder, archive_and_filter

REVISION = 'alibaba-xz-20260912'
FOOTPRINTS = ROOT/'design/space/references/alibaba-xuhui-footprints.json'


def group(collection, name, identity, position):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = position
    obj['spaceId'] = identity
    obj['spaceName'] = name
    obj['space_export'] = True
    obj['spaceVisible'] = True
    obj['spaceAlibabaRevision'] = REVISION
    obj['spaceAlibabaEstimated'] = True
    return obj


def palette():
    specs = {
        'aluminum': ((192,201,205),.65,.3,0),
        'silver': ((220,225,224),.45,.3,0),
        'graphite': ((53,65,68),.4,.38,0),
        'x-glass': ((78,100,109),.56,.2,.025),
        'z-glass': ((213,227,232),.08,.14,0),
        'rail-glass': ((219,234,235),.02,.12,0),
        'interior': ((188,190,180),0,.82,.025),
        'lit-interior': ((223,214,191),0,.76,.32),
        'office': ((186,175,144),.25,.26,.24),
        'blinds': ((164,177,180),.35,.35,.07),
        'soffit': ((143,117,85),.25,.52,.035),
        'stone': ((153,159,154),.02,.83,0),
        'joint': ((111,120,118),0,.86,0),
        'deck': ((135,106,81),0,.8,0),
        'light': ((255,229,187),.1,.35,2.4),
        'trunk': ((86,76,56),0,.95,0),
        'leaves': ((64,95,49),0,.9,0),
        'new-leaves': ((99,126,62),0,.9,0),
        'solar': ((48,68,85),.58,.22,0),
    }
    mats = {k:material('XZ '+k,*v) for k,v in specs.items()}
    for key,mat in mats.items(): mat['spaceMaterialId'] = REVISION+'/'+key
    for key,transmission in (('z-glass',.62),('rail-glass',.84)):
        node=next(n for n in mats[key].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        node.inputs['Transmission Weight'].default_value=transmission
        node.inputs['IOR'].default_value=1.45
    return mats


def finish(parts, mats, root, collection):
    objects=[]
    for key,mesh in parts.items():
        if not mesh.faces: continue
        obj=mesh.object(root.name+' '+key,mats[key],root,collection)
        obj['spaceId']=root['spaceId']+'/'+key
        if key in ('leaves','new-leaves'):
            bm=bmesh.new(); bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.001)
            bm.to_mesh(obj.data); bm.free()
            for p in obj.data.polygons:p.use_smooth=True
        for p in obj.data.polygons:
            axes=[i for i in range(3) if i!=max(range(3),key=lambda a:abs(p.normal[a]))]
            for li in p.loop_indices:
                v=obj.data.vertices[obj.data.loops[li].vertex_index].co
                obj.data.uv_layers.active.data[li].uv=(v[axes[0]],v[axes[1]])
        objects.append(obj)
    return objects


def tree(parts,x,y,z,seed=0,scale=1):
    rng=random.Random(seed)
    cylinder(parts['trunk'],x,y,z,z+4.5*scale,.13*scale,.055*scale,8)
    for branch in range(7):
        angle=branch*2.4
        cx,cy=x+math.cos(angle)*.8*scale,y+math.sin(angle)*.8*scale
        cz=z+(3.5+rng.random()*1.8)*scale
        parts['trunk'].beam((x,y,z+2.6*scale),(cx,cy,cz),.07*scale)
        radius=(.85+rng.random()*.4)*scale
        rings=[]
        for i in range(7):
            phi=math.pi*i/6
            rings.append([(cx+radius*math.sin(phi)*math.cos(j*math.tau/9)*rng.uniform(.8,1.15),
                           cy+radius*math.sin(phi)*math.sin(j*math.tau/9)*rng.uniform(.8,1.15),
                           cz+radius*.9*math.cos(phi)) for j in range(9)])
        mesh=parts['leaves' if branch%3 else 'new-leaves']
        for i in range(6):
            for j in range(9):
                jj=(j+1)%9
                mesh.face([rings[i][j],rings[i+1][j],rings[i+1][jj]])
                mesh.face([rings[i][j],rings[i+1][jj],rings[i][jj]])


def rail(parts,a,b,z):
    a,b=Vector((*a,z)),Vector((*b,z))
    for h in (.12,1.1):parts['silver'].beam(a+Vector((0,0,h)),b+Vector((0,0,h)),.065)
    count=max(1,math.ceil((b-a).length/1.4))
    for n in range(count+1):
        p=a.lerp(b,n/count)
        parts['silver'].beam(p,p+Vector((0,0,1.1)),.04)
    # Thin glazing follows the published terrace details; glTF transmission
    # carries through to the web without alpha-blended railing sorting.
    parts['rail-glass'].face([a+Vector((0,0,.15)),b+Vector((0,0,.15)),
                              b+Vector((0,0,1.05)),a+Vector((0,0,1.05))])


def bench(parts,x,y,z,length=3):
    for n in range(5):box(parts['deck'],(x,y+(n-2)*.13,z+.48),(length,.11,.09))
    for s in (-1,1):box(parts['graphite'],(x+s*(length/2-.25),y,z+.23),(.08,.64,.46))


def site(parts,sx,sy,seed):
    box(parts['stone'],(0,0,-.06),(sx,sy,.18))
    for x in range(-int(sx/2)+1,int(sx/2),3):box(parts['joint'],(x,0,.039),(.016,sy-.3,.012))
    for y in range(-int(sy/2)+1,int(sy/2),3):box(parts['joint'],(0,y,.04),(sx-.3,.016,.012))
    for index,y in enumerate(range(-int(sy/2)+8,int(sy/2)-7,12)):
        for sign in (-1,1):
            x=sign*(sx/2-2.2)
            box(parts['graphite'],(x,y,.07),(2.7,2.7,.12))
            tree(parts,x,y,.15,seed+index+sign,1.1)
            bench(parts,x,y+3,.1)
    for y in (-sy/2+1.3,sy/2-1.3):
        for x in range(-int(sx/2)+6,int(sx/2)-5,10):
            box(parts['graphite'],(x,y,.48),(.18,.18,.9))
            box(parts['light'],(x,y,.91),(.21,.21,.07))


def lettering(collection,root,mats,body,name,location,rotation,size):
    data=bpy.data.curves.new(name,'FONT'); data.body=body; data.size=size
    data.align_x='CENTER'; data.extrude=.025; data.bevel_depth=.007
    font=Path('C:/Windows/Fonts/arial.ttf')
    if font.exists():data.font=bpy.data.fonts.load(str(font),check_existing=True)
    obj=bpy.data.objects.new(name,data); collection.objects.link(obj); obj.parent=root
    obj.location=location; obj.rotation_euler=rotation; data.materials.append(mats['silver'])
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active=obj; bpy.ops.object.convert(target='MESH')
    for key,value in {'space_export':True,'spaceVisible':True,'spaceId':root['spaceId']+'/sign','spaceName':name}.items():obj[key]=value
    return obj


def author_x(collection,mats):
    root=group(collection,'Alibaba X Art Tower','authored/alibaba-xuhui-x',(-3955,-9730,.12))
    root['spaceAlibabaReference']='Shanghai Xuhui 2020 built photos; OSM way/863990764'
    # Seven footprints partition the existing irregular ring. Storeys, lean
    # and the fold height are photo estimates, not seven invented OSM heights.
    blocks=[
        ('northwest',[(-3983,9692),(-3953,9689),(-3950,9716),(-3971,9719)],14,(3,3)),
        ('north',[(-3951,9684),(-3919,9684),(-3926,9714),(-3949,9713)],12,(-3,-4)),
        ('east',[(-3921,9696),(-3905,9701),(-3907,9722),(-3926,9714)],10,(2,4)),
        ('southeast',[(-3927,9726),(-3910,9736),(-3930,9761),(-3944,9740)],11,(-3,-3)),
        ('south',[(-3945,9740),(-3931,9762),(-3952,9775),(-3972,9756)],13,(4,-3)),
        ('southwest',[(-3998,9734),(-3971,9722),(-3957,9745),(-3986,9765)],14,(-4,2)),
        ('west',[(-4005,9707),(-3981,9702),(-3972,9719),(-3998,9733)],12,(3,4)),
    ]
    objects=[]
    for index,(name,points,floors,lean) in enumerate(blocks):
        wing=group(collection,'Art Tower '+name,root['spaceId']+'/'+name,(0,0,0)); wing.parent=root
        wing['spaceAlibabaStoreysEstimate']=floors
        plan=[Vector((x+3955,-y+9730)) for x,y in reversed(points)]
        centre=sum(plan,Vector((0,0)))/len(plan)
        # Narrow physical expansion joints between the independent towers.
        plan=[centre+(p-centre)*.966 for p in plan]
        height=5.5+(floors-1)*4.2
        def outline(z):
            t=z/height
            shift=Vector(lean)*1.9*(t if t<.52 else .52-(t-.52)*.35)
            return [p+shift for p in plan]
        parts={k:Mesh() for k in mats}
        heights=[0,5.5]+[5.5+n*4.2 for n in range(1,floors)]
        heights.append(height)
        heights=sorted(set(heights))
        for floor,(z0,z1) in enumerate(zip(heights,heights[1:])):
            bottom,top=outline(z0),outline(z1)
            parts['x-glass'].loft(bottom,top,z0,z1)
            for edge in range(4):
                a,b=bottom[edge],bottom[(edge+1)%4]
                c,d=top[edge],top[(edge+1)%4]
                normal=Vector(((b-a).y,-(b-a).x)).normalized()
                count=max(2,round((b-a).length/1.5))
                for n in range(count+1):
                    u=n/count
                    p,q=a.lerp(b,u)+normal*.04,c.lerp(d,u)+normal*.04
                    parts['graphite'].beam((*p,z0),(*q,z1),.07)
                    if n==count:continue
                    # Sparse whole-office spans, with a dark spandrel below.
                    if floor>0 and floor%4!=3 and (n+index)%7 in (0,1,2):
                        p1=a.lerp(b,(n+.08)/count)+normal*.022
                        p2=a.lerp(b,(n+.92)/count)+normal*.022
                        q1=c.lerp(d,(n+.08)/count)+normal*.022
                        q2=c.lerp(d,(n+.92)/count)+normal*.022
                        lo0=p1.lerp(q1,.3);lo1=p2.lerp(q2,.3)
                        hi0=p1.lerp(q1,.87);hi1=p2.lerp(q2,.87)
                        parts['office'].face([(*lo0,z0+(z1-z0)*.3),(*lo1,z0+(z1-z0)*.3),(*hi1,z0+(z1-z0)*.87),(*hi0,z0+(z1-z0)*.87)])
                # Continuous thin fins wrap every corner and follow the lean.
                for n in range(7):
                    t=(n+.35)/7; z=z0+(z1-z0)*t
                    p=a.lerp(c,t)+normal*.19; q=b.lerp(d,t)+normal*.19
                    parts['aluminum'].beam((*p,z),(*q,z),.68,.1)
            parts['silver'].ring(outline(z1),z1,.22,.2)
        roof=outline(height)
        parts['stone'].face([(*p,height) for p in roof])
        parts['silver'].ring(roof,height+1.0,.12)
        for p in roof:parts['silver'].beam((*p,height),(*p,height+1),.085)
        cx,cy=centre+Vector(lean)*.4
        box(parts['graphite'],(cx,cy,height+.8),(8,7,1.6))
        for n in range(7):box(parts['aluminum'],(cx,cy-3.55,height+.15+n*.2),(8,.13,.055))
        for xx in (-2,2):
            cylinder(parts['aluminum'],cx+xx,cy,height+1.6,height+1.85,1.25,steps=16)
            cylinder(parts['graphite'],cx+xx,cy,height+1.85,height+1.88,1,steps=16)
        objects.extend(finish(parts,mats,wing,collection))
    parts={k:Mesh() for k in mats};site(parts,112,106,101)
    # The original ring opens to the east. Keep passages and the court clear.
    for x,y in [(9,7),(8,-5),(-4,-3)]:
        box(parts['stone'],(x,y,.45),(3.6,3.6,.8));tree(parts,x,y,.9,120+int(x))
        bench(parts,x+3,y,.08,2)
    objects.extend(finish(parts,mats,root,collection))
    return root,objects,{'wings':len(blocks),'estimatedMaximumHeight':60.1}


def z_occupied(i,j,k):
    if not (0<=i<10 and 0<=j<6 and 0<=k<10):return False
    # The unroofed central court continues to ground level at the south.
    if 3<=i<=6 and 1<=j<=3:return False
    if 4<=i<=5 and j==0:return False
    if 3<=i<=6 and j>=4:return (j==5 and k<=7) or (j==4 and 3<=k<=4)
    # Three-storey stacked wings slide sideways; at each transition the floor
    # below becomes a terrace while the next volume projects into open air.
    side=i if i<5 else 9-i
    if k<=2:return side in (1,2) or (side==0 and j in (0,3,5))
    if k<=5:return side in (0,1) or (side==2 and j in (1,4))
    if k<=8:return side in (1,2) or (side==0 and j in (0,2,5))
    return (side in (1,2) and j in (0,1,4,5))


def author_z(collection,mats):
    root=group(collection,'Alibaba Z SOM design','authored/alibaba-xuhui-z',(-3986,-9479,.12))
    root['spaceAlibabaReference']='SOM supplied 2022 design renders; not verified as-built'
    root['spaceAlibabaEvidence']='design-2022'
    root.rotation_euler.z=math.radians(-2)
    parts={k:Mesh() for k in mats};dx,dy,h=12.8,13,4.9
    site(parts,141,91,300)
    terraces=[];exposed=0
    for k in range(10):
        z0,z1=k*h,(k+1)*h
        for i in range(10):
            for j in range(6):
                if not z_occupied(i,j,k):continue
                x,y=(i-4.5)*dx,(j-2.5)*dy
                box(parts['graphite'],(x,y,z0+.14),(dx,dy,.28))
                if not z_occupied(i,j,k+1):
                    box(parts['deck'],(x,y,z1-.02),(dx-.15,dy-.15,.24));terraces.append((i,j,k+1))
                if not z_occupied(i,j,k-1):
                    box(parts['soffit'],(x,y,z0-.035),(dx,dy,.16))
                    for n in range(14):box(parts['soffit'],(x-dx/2+.4+n*(dx-.8)/13,y,z0-.14),(.055,dy,.12))
                    for yy in (-dy/3,dy/3):box(parts['light'],(x,y+yy,z0-.21),(dx-.9,.035,.025))
                for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
                    if z_occupied(i+di,j+dj,k):continue
                    exposed+=1
                    normal=Vector((di,dj,0));along=Vector((-dj,di,0))
                    origin=Vector((x+di*dx/2,y+dj*dy/2,0));width=dy if di else dx
                    def fc(key,u,v,z,w,d,hh):
                        p=origin+along*u+normal*v+Vector((0,0,z))
                        box(parts[key],p,(d,w,hh) if di else (w,d,hh))
                    fc('z-glass',0,-.12,(z0+z1)/2,width,.07,h-.2)
                    fc('silver',0,.01,z1-.12,width,.28,.14)
                    fc('blinds',0,-.16,z0+.34,width,.07,.32)
                    for n in range(9):
                        u=-width/2+n*width/8
                        fc('silver',u,.01,(z0+z1)/2,.042,.22,h)
                        if n==8:continue
                        uu=u+width/16
                        lit=(i*13+j*7+k*3+n//3)%7 in (0,1,2,3)
                        # Recessed rooms give glazing depth, instead of an
                        # opaque illuminated rectangle placed on the facade.
                        fc('lit-interior' if lit else 'interior',uu,-4.1,z0+h*.48,width/8,.09,h*.8)
                        if n%3==0:
                            fc('interior',uu,-2.4,z0+.76,width/8-.35,1.25,.08)
                            fc('graphite',uu,-2.7,z0+1.04,.55,.05,.4)
                        if lit:fc('light',uu,-2,z1-.45,width/8-.5,.045,.025)
                        if (n+i+k)%4==0:
                            for line in range(7):fc('blinds',uu,-.19,z1-.35-line*.1,width/8-.08,.06,.025)
                        for z in (z0+.95,z1-.52):fc('graphite',u,.16,z,.11,.055,.055)
                    # Two-storey fine glass module break is visible in SOM's
                    # reference, without Y campus's deep aluminum bay frames.
                    if k%3==2:fc('silver',0,.02,z0+.12,width,.32,.22)
    terrace_set=set(terraces)
    for i,j,level in terraces:
        x,y=(i-4.5)*dx,(j-2.5)*dy;z=level*h
        for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
            if (i+di,j+dj,level) in terrace_set or z_occupied(i+di,j+dj,level):continue
            if di:rail(parts,(x+di*(dx/2-.25),y-dy/2+.25),(x+di*(dx/2-.25),y+dy/2-.25),z)
            else:rail(parts,(x-dx/2+.25,y+dj*(dy/2-.25)),(x+dx/2-.25,y+dj*(dy/2-.25)),z)
        if (i+j)%2==0:
            box(parts['stone'],(x-2,y+2,z+.4),(5.5,2.7,.8))
            tree(parts,x-2,y+2,z+.8,500+i*12+j,.6)
            bench(parts,x+2,y-2,z)
        if level>=9:
            for row in range(5):
                box(parts['solar'],(x,y-4+row*1.7,z+.42),(dx-1.4,1.5,.08))
                for n in range(8):box(parts['silver'],(x-dx/2+1+n*(dx-2)/7,y-4+row*1.7,z+.466),(.02,1.5,.012))
            box(parts['graphite'],(x,y+5,z+.65),(4,1.5,1.3))
    # Public court: raised planted edges, seating, pergola and stepped route.
    for x in (-17,17):
        for y in (-21,-6,9):
            box(parts['stone'],(x,y,.6),(5,7,1.2));tree(parts,x,y,1.2,600+int(x+y),1.15)
            bench(parts,x+(3.7 if x<0 else -3.7),y,.1,4)
            box(parts['light'],(x+(2.52 if x<0 else -2.52),y,.85),(.035,6,.045))
    for y in (-27,-26.6,-26.2,-25.8):
        step=round((y+27)/.4)+1
        box(parts['stone'],(0,y,.08*step),(14,.4,.16*step))
    for x in (-10,10):
        for y in (-3,8):box(parts['graphite'],(x,y,1.6),(.16,.16,3.2))
    for n in range(31):box(parts['soffit'],(-10+n*2/3,2.5,3.25),(.06,11.4,.17))
    objects=finish(parts,mats,root,collection)
    # The published SOM section labels this court Alibaba. Typeface/scale are
    # estimates; no made-up illuminated rooftop logo is added to X or Z.
    objects.append(lettering(collection,root,mats,'Alibaba','Alibaba Z court sign',(0,21.4,2.6),(math.pi/2,0,0),1.3))
    return root,objects,{'estimatedPlanMetres':[128,78],'exposedFacadeBays':exposed,'terraceCells':len(terraces),'evidence':'SOM design 2022'}


def geometry_digest(objects):
    digest=hashlib.sha256()
    from array import array
    for obj in sorted(objects,key=lambda o:o.name):
        digest.update(obj.name.encode());digest.update(str(list(obj.matrix_world)).encode())
        if obj.type=='MESH':
            data=array('f',[0])*(len(obj.data.vertices)*3)
            obj.data.vertices.foreach_get('co',data);digest.update(data.tobytes())
            indices=array('i',[0])*len(obj.data.loops)
            obj.data.loops.foreach_get('vertex_index',indices);digest.update(indices.tobytes())
    return digest.hexdigest()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true')
    parser.add_argument('--render',action='store_true')
    parser.add_argument('--output',default=str(ROOT/'.tmp/png/space-alibaba-full-20260912/candidate01'))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if Path(bpy.data.filepath).resolve()!=SOURCE.resolve():raise RuntimeError('Open canonical shanghai.blend')
    output=Path(args.output).resolve()
    if not output.is_relative_to(ROOT/'.tmp/png'):raise RuntimeError('Review artifacts must stay in .tmp/png')
    output.mkdir(parents=True,exist_ok=True)
    before=(SOURCE.stat().st_size,SOURCE.stat().st_mtime_ns)
    scene=bpy.context.scene
    if any(o.get('spaceAlibabaRevision')==REVISION for o in scene.objects):raise RuntimeError('Already authored; edit the current scene instead of rebuilding')
    y_objects=[o for o in scene.objects if str(o.get('spaceId','')).startswith('authored/alibaba-xuhui-y')]
    if not y_objects:raise RuntimeError('The completed Y campus must already exist')
    y_before=geometry_digest(y_objects)
    original_ids={o.get('spaceId') for o in scene.objects if o.get('space_export')}
    features=json.loads(FOOTPRINTS.read_text(encoding='utf-8'))['features']
    def match(points,obj):
        pts=[obj.matrix_world@p for p in points]
        return any(all((abs(p.z+.65)<.02 or abs(p.z-11.35)<.02) and
                       any(abs(p.x-x)<.02 and abs(p.y+y)<.02 for x,y in f['points']) for p in pts) for f in features)
    archive=bpy.data.collections.new('ARCHIVE Alibaba XZ fallback footprints (not exported)');scene.collection.children.link(archive)
    removed={}
    for identity in ('root/13','root/14','root/63'):
        obj=next(o for o in scene.objects if o.get('spaceId')==identity)
        removed[identity]=archive_and_filter(obj,lambda pts:match(pts,obj),archive)
    if sum(removed.values())!=148:raise RuntimeError('Expected 148 unique footprint faces: '+str(removed))
    archive.hide_viewport=True;archive.hide_render=True
    collection=bpy.data.collections.new('AUTHORING Alibaba X and Z campus');scene.collection.children.link(collection)
    mats=palette();x,xo,xreport=author_x(collection,mats);z,zo,zreport=author_z(collection,mats)
    bpy.context.view_layer.update()
    objects=xo+zo
    if len([o for o in x.children if o.type=='EMPTY'])!=7:raise RuntimeError('X must have seven independently editable wings')
    if geometry_digest(y_objects)!=y_before:raise RuntimeError('Y campus changed')
    if not original_ids.issubset({o.get('spaceId') for o in scene.objects if o.get('space_export')}):raise RuntimeError('Existing city identity removed')
    if any(not math.isfinite(c) for o in objects for v in o.data.vertices for c in v.co):raise RuntimeError('Nonfinite geometry')
    verts=[];faces=[]
    for obj in zo:
        offset=len(verts);transform=z.matrix_world.inverted()@obj.matrix_world
        verts.extend(transform@v.co for v in obj.data.vertices)
        faces.extend([offset+i for i in p.vertices] for p in obj.data.polygons)
    bvh=BVHTree.FromPolygons(verts,faces)
    rays=[]
    for name,origin,direction,length,expected in [
        ('Z open court',(0,-15,60),(0,0,-1),58,False),
        ('Z ground passage',(0,-50,2),(0,1,0),18,False),
        ('Z north bridge',(0,19.5,60),(0,0,-1),59,True),
        ('Z southwest cantilever',(-58,-32,10),(0,0,1),20,True),
    ]:
        hit=bvh.ray_cast(Vector(origin),Vector(direction),length)[0] is not None
        rays.append({'name':name,'hit':hit,'expected':expected,'pass':hit==expected})
    if not all(r['pass'] for r in rays):raise RuntimeError('Z opening guard: '+json.dumps(rays))
    preview=bpy.data.collections.new('PREVIEW Alibaba XZ cameras (not exported)');scene.collection.children.link(preview)
    cameras=[camera(preview,'Alibaba X Art Tower',x,(126,-137,92),(0,0,23)),
             camera(preview,'Alibaba Z campus',z,(170,-140,95),(0,0,23)),
             camera(preview,'Alibaba Z courtyard',z,(0,-53,5),(0,10,20)),
             camera(preview,'Alibaba whole campus',z,(375,-430,290),(0,-120,24))]
    cameras[2].data.lens=28
    report={'revision':REVISION,'X':xreport,'Z':zreport,'removedFallbackFaces':removed,
            'YGeometryUnchanged':geometry_digest(y_objects)==y_before,'originalIdsPreserved':True,
            'meshes':len(objects),'vertices':sum(len(o.data.vertices) for o in objects),
            'polygons':sum(len(o.data.polygons) for o in objects),'rayChecks':rays,'sourceFingerprint':before,'applied':False}
    def assert_unchanged():
        if (SOURCE.stat().st_size,SOURCE.stat().st_mtime_ns)!=before:raise RuntimeError('Disk source changed; refusing overwrite')
    assert_unchanged()
    if args.apply:
        backup=output/'shanghai-before-xz.blend'
        if backup.exists():raise RuntimeError('Backup exists')
        shutil.copy2(SOURCE,backup);assert_unchanged()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True);report['applied']=True
    (output/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('ALIBABA_XZ_RESULT '+json.dumps(report),flush=True)
    if args.render:
        keep={o.name for o in [x,z,*x.children,*objects,*y_objects,*cameras]}
        for obj in scene.objects:
            if obj.name not in keep:obj.hide_render=True
        scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
        scene.render.threads_mode='FIXED';scene.render.threads=14
        scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
        scene.world=bpy.data.worlds.new('Alibaba XZ temporary stage');scene.world.use_nodes=True
        background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
        background.inputs[0].default_value=(.55,.65,.8,1);background.inputs[1].default_value=.65
        light=bpy.data.lights.new('XZ review sun','SUN');light.energy=2.3;light.angle=.08
        obj=bpy.data.objects.new(light.name,light);scene.collection.objects.link(obj);obj.rotation_euler=(.5,-.45,-.65)
        for index in (0,1,3):
            scene.camera=cameras[index];scene.render.filepath=str(output/['x-day.png','z-day.png','','whole-day.png'][index]);bpy.ops.render.render(write_still=True)
        light.energy=.12;background.inputs[0].default_value=(.12,.17,.26,1);background.inputs[1].default_value=.24
        for mat in set(mats.values())|{m for o in y_objects if o.type=='MESH' for m in o.data.materials}:
            node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if node:
                node.inputs['Emission Color'].default_value=mat.diffuse_color
                node.inputs['Emission Strength'].default_value=float(mat.get('spaceIllumination',0))
        for index,name in ((3,'whole-night.png'),(2,'z-court-night.png')):
            scene.camera=cameras[index];scene.render.filepath=str(output/name);bpy.ops.render.render(write_still=True)


if __name__=='__main__':main()
