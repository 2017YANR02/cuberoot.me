"""Photo-guided incremental authoring of Bund 12, 13 and 20.

Run inside the existing Shanghai Blender source; preview before --apply.
All fine dimensions, ornament and fixtures are estimates, not surveyed replicas.
Photo links and remaining discrepancies: ../references/shanghai-landmarks.md.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_bund_galleries as galleries
import refine_bund_entrances as entrances
import refine_shanghai_landmarks as previous
from refine_jin_mao import Mesh, linear
from refine_bund_entrances import box, arc, extrude, cylinder

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/bund-hero-details'
REVISION = 'bund-hero-details-20260909'
IDS = {'20': 'root/147/4', '13': 'root/147/5', '12': 'root/147/6'}
# 2021 frontal photograph: two close inner pairs; metric spacing is estimated.
HSBC_COLUMN_AXES = [-12.7, -6.0, -3.4, 3.4, 6.0, 12.7]


def copied(source, name, **kwargs):
    mat = previous.material(source, name, **kwargs)
    mat['spaceMaterialId'] = REVISION + '/' + name
    return mat


def finish(root, part, mat, name):
    obj = part.object(root.name + ' ' + name, mat, root, root.users_collection[0])
    obj['spaceId'] = REVISION + '/' + root['spaceId'] + '/' + name
    obj['spaceBundHeroPart'] = name
    galleries.uv_metric(obj)
    return obj


def masonry(obj, number, archive):
    """Packed metric PBR maps: staggered 1 m blocks, 0.5 m courses, 9 mm joints.

    Original procedural surface, deliberately not a photograph or stone scan.
    Only the body receives courses; trim and columns retain fine stone grain.
    """
    galleries.archive(obj, archive)
    mat = copied(obj.data.materials[0], number + ' coursed stone')
    obj.data.materials[0] = mat
    n, m = 1024, 512
    zz, xx = np.mgrid[0:m, 0:n].astype(np.float32)
    xx, zz = xx / n * 4, zz / m * 2
    row = np.floor(zz / .5).astype(int)
    col = np.floor(xx + (row % 2) * .5).astype(int) % 4
    u, v = (xx + (row % 2) * .5) % 1, zz % .5
    distance = np.minimum(np.minimum(u, 1-u), np.minimum(v, .5-v))
    joint = np.clip((.009-distance)/.006, 0, 1)
    rng = np.random.default_rng(int(number) * 137)
    blocks = rng.uniform(-.035, .035, (4, 4))[row, col]
    grain = rng.normal(0, .004, (m, n))
    height = -.006 * joint + grain * .035
    dx = (np.roll(height,-1,1)-np.roll(height,1,1)) / (8/n)
    dy = (np.roll(height,-1,0)-np.roll(height,1,0)) / (4/m)
    normal = np.dstack((-dx, -dy, np.ones_like(dx)))
    normal /= np.linalg.norm(normal, axis=2)[...,None]
    node = mat.node_tree.nodes.get('Principled BSDF')
    base = np.array(node.inputs['Base Color'].default_value[:3])
    color = np.clip(base[None,None,:] * (1 + blocks + grain - joint*.13)[...,None], 0, 1)
    for label, pixels, socket in [('albedo',color,'Base Color'), ('normal',normal*.5+.5,'Normal')]:
        image = bpy.data.images.new(REVISION+'/'+number+'/'+label,n,m,alpha=True)
        # Blender image pixel values are scene-linear for color images.
        image.colorspace_settings.name = 'sRGB' if label == 'albedo' else 'Non-Color'
        image.pixels.foreach_set(np.dstack((pixels,np.ones((m,n)))).astype(np.float32).ravel())
        image.pack()
        texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        if label == 'normal':
            bump = mat.node_tree.nodes.new('ShaderNodeNormalMap')
            mat.node_tree.links.new(texture.outputs['Color'], bump.inputs['Color'])
            mat.node_tree.links.new(bump.outputs['Normal'], node.inputs[socket])
        else:
            mat.node_tree.links.new(texture.outputs['Color'], node.inputs[socket])
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for face in obj.data.polygons:
        axis = max(range(3),key=lambda i:abs(face.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv = (p[axes[0]]/4,p[axes[1]]/2)
    mat['spaceSurfaceProvenance'] = 'Original procedural ashlar, 1 x 0.5 m photo-estimated blocks; not a scan'
    obj['spaceMasonryCourseMetres'] = .5


def rectangular_frame(part,x,y,z,w,h,thickness=.04,depth=.06):
    for side in [-1,1]:
        box(part,(x+side*w/2,y,z),(thickness,depth,h))
        box(part,(x,y,z+side*h/2),(w,depth,thickness))


def fixture(housing,lens,x,y,z,width=.42):
    # Small black LED projector, bracket and raised warm lens. The browser's
    # existing pooled facade lights still supply real illumination at runtime.
    box(housing,(x,y,z+.04),(width*.8,.32,.08))
    for side in [-1,1]:
        box(housing,(x+side*width*.46,y,z+.18),(.045,.16,.25))
    box(housing,(x,y,z+.27),(width,.25,.23))
    box(lens,(x,y+.132,z+.29),(width*.82,.018,.12))


def fluted_column(part,x,y,bottom,top,radius,upper,flutes=24):
    # Concave channels replace the old smooth cylinder and raised wires.
    rings=[]
    for t in [0,.015,.04,.12,.32,.65,.90,.97,.99,1]:
        r = radius+(upper-radius)*t + .025*math.sin(math.pi*t)
        fade = min(1,t/.035,(1-t)/.035)
        ring=[]
        for i in range(flutes*8):
            a=math.tau*i/(flutes*8)
            valley=(.5-.5*math.cos(a*flutes))**.6
            rr=r-.058*valley*max(0,fade)
            ring.append((x+rr*math.cos(a),y+rr*math.sin(a),bottom+(top-bottom)*t))
        rings.append(ring)
    for low,high in zip(rings,rings[1:]):
        for i in range(len(low)):
            j=(i+1)%len(low)
            part.face([low[i],low[j],high[j],high[i]])


def hsbc(root,archive):
    by_id={o.get('spaceId'):o for o in previous.meshes(root)}
    trim=by_id[root['spaceId']+'/2']
    columns, ornaments, lamps, lenses=Mesh(),Mesh(),Mesh(),Mesh()
    # Preserve the paired rhythm visible in the dated frontal photograph.
    old_xs=[-12.7,-6.3,-4.5,4.5,6.3,12.7]
    xs=HSBC_COLUMN_AXES
    removed=0
    for x in old_xs:
        # Shafts/base are in trim, but the original raised wires and leaves
        # belong to the body material. Cut both or the old capitals float.
        for obj in [trim,by_id[root['spaceId']+'/0']]:
            removed += galleries.cut_volume(obj,(x-1.36,1.03,6.50),(x+1.36,3.48,23.08),archive)
    for x in xs:
        fluted_column(columns,x,2.1,7.27,21.66,.862,.736)
        galleries.lathe(ornaments,x,2.1,[(6.81,1.10),(6.94,1.10),(6.98,.98),
                          (7.03,1.02),(7.10,1.02),(7.18,.94),(7.26,.90),(7.29,.87)],64)
        galleries.lathe(ornaments,x,2.1,[(21.62,.74),(22.39,.84),(22.52,.97),(22.70,1.04),(22.91,1.09)],64)
        box(ornaments,(x,2.1,22.99),(2.22,2.22,.18))
        # Two overlapping rings of carved leaves around the capital, with
        # narrow raised midribs. Silhouette is estimated from the archive photo.
        for row in range(2):
            for i in range(8):
                a=math.tau*(i+row*.5)/8
                center=Vector((x+.76*math.cos(a),2.1+.76*math.sin(a),21.63+row*.37))
                side=Vector((-.15*math.sin(a),.15*math.cos(a),0))
                tip=center+Vector((.23*math.cos(a),.23*math.sin(a),.58))
                mid=center+Vector((.17*math.cos(a),.17*math.sin(a),.25))
                ornaments.face([center-side,center+side,tip])
                ornaments.face([center+side,mid,tip])
                ornaments.beam(center,tip,.04,.05,6)
    for x in [-37.5,-32.5,-28,-23.5,-19,19,23.5,28,32.5,37.5]:
        for z in [12.0,16.95,22.0]:
            rectangular_frame(ornaments,x,.19,z,2.65,.78,.065,.10)
            for side in [-1,1]:
                box(ornaments,(x+side*.92,.33,z-.46),(.20,.45,.32))
    for x in [-35,-25,-15,-5,5,15,25,35]: fixture(lamps,lenses,x,1.02,24.14)
    # Bracketed linear picture lights above the actual existing bank sign.
    for x in [-2.5,0,2.5]:
        box(lamps,(x,1.28,6.90),(.80,.24,.12))
        box(lenses,(x,1.30,6.83),(.68,.15,.025))
        box(lamps,(x,1.08,6.84),(.05,.40,.06))
    finish(root,columns,copied(trim.data.materials[0],'12 fluted columns'),'fluted-columns')
    finish(root,ornaments,copied(trim.data.materials[0],'12 capital and window carving'),'stone-carving')
    lamp_parts(root,lamps,lenses,by_id[root['spaceId']+'/3'].data.materials[0])
    return {'flutedColumns':6,'columnAxes':xs,'flutesPerColumn':24,'capitalLeaves':96,'windowPanels':30,
            'projectors':8,'signLights':3,'removedFaces':removed}


def lamp_parts(root,lamps,lenses,source):
    finish(root,lamps,copied(source,root.name+' lamp housings',rgb=(39,43,41),metal=.5,roughness=.45,illumination=0),'lamp-housings')
    finish(root,lenses,copied(source,root.name+' warm lamp lenses',rgb=(255,219,166),metal=.05,roughness=.3,illumination=1.2),'lamp-lenses')


def customs(root,archive):
    parts,mats,by_id=entrances.parts_for(root)
    for key,mat in mats.items(): mat['spaceMaterialId']=REVISION+'/13/'+key
    bronze=parts['metal']
    relief=Mesh()
    lamps,lenses=Mesh(),Mesh()
    # Existing spandrels have five generic bars. Replace the bars with nested
    # bronze mouldings, beads and a central rosette visible in the real photo.
    for x in [-8,0,8]:
        for z in [11.5,15.8,20.2,24.6]:
            for suffix in ['/2','/3']:
                galleries.cut_volume(by_id[root['spaceId']+suffix],(x-1.23,-.01,z-.54),(x+1.23,.58,z+.54),archive)
            box(bronze,(x,.135,z),(2.32,.13,1.05))
            for w,h,y in [(2.20,.92,.24),(2.02,.75,.28),(1.82,.54,.30)]:
                rectangular_frame(relief,x,y,z,w,h,.045,.05)
            arc(relief,x,z,.11,.16,.25,.35,0,math.tau,32)
            for i in range(12):
                a=math.tau*i/12
                relief.beam((x+.055*math.cos(a),.34,z+.055*math.sin(a)),
                            (x+.12*math.cos(a),.35,z+.12*math.sin(a)),.025,.03,6)
            for i in range(13):
                box(relief,(x-.99+i*1.98/12,.29,z-.44),(.075,.075,.065))
    # Repeat the square and reeded top frieze with actual shadowed profiles.
    for i in range(42):
        x=-18.05+i*36.1/41
        rectangular_frame(relief,x,.93,30.05,.58,.51,.065,.09)
        rectangular_frame(relief,x,.99,30.05,.36,.29,.045,.055)
        for offset in [-.19,0,.19]:
            relief.beam((x+offset,.91,29.31),(x+offset,.97,29.76),.065,.10,6)
    for x in [-16,-12,-8,-4,0,4,8,12,16]: fixture(lamps,lenses,x,1.01,31.11,.40)
    # Projectors below the clock, as seen on the stone cornice in the photo.
    for x in [-5.1,-2.6,0,2.6,5.1]: fixture(lamps,lenses,x-1.36155,.62,49.90,.30)
    finish(root,bronze,copied(mats['metal'],'13 bronze spandrel backs',rgb=(82,70,49),metal=.55,roughness=.43,illumination=.02),'bronze-panels')
    finish(root,relief,copied(mats['metal'],'13 aged bronze relief',rgb=(139,118,75),metal=.62,roughness=.40,illumination=.025),'bronze-relief')
    lamp_parts(root,lamps,lenses,mats['metal'])
    return {'bronzeSpandrels':12,'rosettes':12,'friezePanels':42,'projectors':14,
            'remaining':'Seven window axes, rectangular entry portals and tower louvres still need reconstruction'}


def peace(root,archive):
    by_id={o.get('spaceId'):o for o in previous.meshes(root)}
    old_roof=by_id[root['spaceId']+'/5']
    metal=by_id[root['spaceId']+'/3']
    galleries.cut_volume(metal,(-1342,-1381,57.9),(-1314,-1353,78),archive)
    roof,seams,red,crest,lamps,lenses=Mesh(),Mesh(),Mesh(),Mesh(),Mesh(),Mesh()
    cx,cy=-1328,-1367
    half,tip=11.52588,1.6
    # The photograph has a truncated copper roof and a separate narrow lantern,
    # not a pyramid that runs all the way to the tip. Keep the 77 m envelope.
    ring=lambda r:[(cx-r,cy-r),(cx+r,cy-r),(cx+r,cy+r),(cx-r,cy+r)]
    roof.loft(ring(half),ring(half),58,60)
    roof.loft(ring(half),ring(tip),60,73.6)
    roof.loft(ring(tip),ring(1.05),73.6,74.2)
    roof.loft(ring(1.05),ring(1.05),74.2,76.1)
    roof.loft(ring(1.22),ring(.35),76.1,76.6)
    roof.face([(*p,76.6) for p in ring(.35)])
    cylinder(seams,cx,cy,76.6,77,.09,.05,16)
    for side in range(4):
        angle=side*math.pi/2
        def point(u,v,z):
            return (cx+u*math.cos(angle)-v*math.sin(angle),cy+u*math.sin(angle)+v*math.cos(angle),z)
        def add_face_part(part):
            for i,p in enumerate(part.vertices): part.vertices[i]=point(*p)
        face_seams,face_red,face_crest,face_lamps,face_lenses=Mesh(),Mesh(),Mesh(),Mesh(),Mesh()
        # Parallel standing seams end on the hip or narrow top ridge. They do
        # not converge into one fan, unlike the previous approximation.
        for i in range(65):
            u=-half+(i+.5)*half*2/65
            stop=min(1,(half-abs(u))/(half-tip))
            if stop<=0: continue
            v=half-(half-tip)*stop
            z=60+(73.6-60)*stop
            face_seams.beam((u,half+.026,60),(u,v+.026,z),.045,.055,4)
        for z in [58.1,59.9]: box(face_red,(0,half+.065,z),(half*2,.16,.16))
        for side_edge in [-1,1]:
            face_red.beam((side_edge*half,half,60),(side_edge*tip,tip,73.6),.17,.22)
            box(face_red,(side_edge*1.07,1.07,75.14),(.17,.17,1.92))
        for z in [74.30,75.92]: box(face_red,(0,1.10,z),(2.40,.20,.16))
        # Relief crest on each base face. Front motif observed in the photo;
        # repeats on the other sides remain explicitly estimated.
        shield=[(-.72,58.65),(-.77,60.40),(-.35,60.52),(0,60.95),(.35,60.52),(.77,60.40),(.72,58.65),(0,58.32)]
        # Nested bevels and an inset field keep the crest from being a flat slab.
        shield=list(reversed(shield))
        extrude(face_crest,shield,half+.13,half+.40)
        for scale,depth in [(1,.43),(.84,.48),(.70,.43)]:
            outline=[(u*scale,59.55+(z-59.55)*scale) for u,z in shield]
            for a,b in zip(outline,outline[1:]+outline[:1]):
                face_crest.beam((a[0],half+depth,a[1]),(b[0],half+depth,b[1]),.08,.09,6)
        for u in [-10.6,-8,-5.3,-2.65,2.65,5.3,8,10.6]:
            box(face_red,(u,half+.07,59.0),(.085,.13,1.75))
            arc(face_crest,u,58.42,.14,.20,half+.16,half+.24,0,math.pi,24)
        for hand in [-1,1]:
            for i in range(52):
                a=i/52*math.pi*3.5
                b=(i+1)/52*math.pi*3.5
                r1=.7*(1-i/64)
                r2=.7*(1-(i+1)/64)
                face_crest.beam((hand*(1.40+r1*math.cos(a)),half+.26,58.8+r1*math.sin(a)),
                                (hand*(1.40+r2*math.cos(b)),half+.26,58.8+r2*math.sin(b)),.095,.13,6)
        for u in [-9,-4.5,4.5,9]: fixture(face_lamps,face_lenses,u,half+.22,58.2,.35)
        for dest,source in [(seams,face_seams),(red,face_red),(crest,face_crest),(lamps,face_lamps),(lenses,face_lenses)]:
            add_face_part(source)
            for face in source.faces: dest.face([source.vertices[i] for i in face])
    roof_mat=copied(old_roof.data.materials[0],'20 weathered copper roof',rgb=(91,130,115),metal=.53,roughness=.49)
    galleries.replace_geometry(old_roof,roof,roof_mat,archive)
    # Subtle, repeatable copper variation; generated PBR, not a photographic scan.
    n=512
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n*math.tau
    patina=.025*np.sin(xx*3+np.sin(yy*2))+.017*np.sin(xx*11-yy*7)+.008*np.cos(xx*31+yy*17)
    base=np.array(roof_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3])
    pixels=np.clip(base[None,None,:]*(1+patina[...,None]),0,1)
    image=bpy.data.images.new(REVISION+'/20/copper-albedo',n,n,alpha=True)
    image.colorspace_settings.name='sRGB'
    image.pixels.foreach_set(np.dstack((pixels,np.ones((n,n)))).astype(np.float32).ravel()); image.pack()
    texture=roof_mat.node_tree.nodes.new('ShaderNodeTexImage'); texture.image=image
    roof_mat.node_tree.links.new(texture.outputs['Color'],roof_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    finish(root,seams,copied(old_roof.data.materials[0],'20 patinated standing seams',rgb=(93,134,111),metal=.62,roughness=.39),'copper-standing-seams')
    finish(root,red,copied(metal.data.materials[0],'20 oxidized copper edging',rgb=(118,63,55),metal=.45,roughness=.51,illumination=0),'copper-edging')
    finish(root,crest,copied(by_id[root['spaceId']+'/1'].data.materials[0],'20 stone roof crest'),'roof-crest')
    lamp_parts(root,lamps,lenses,metal.data.materials[0])
    return {'parallelRoofSeams':260,'lantern':True,'crestFaces':4,'projectors':16,
            'roofTopMetres':77,'remaining':'Front setbacks, arched upper window and full-height grouped window bays still need reconstruction'}


def review(root,number,label,night=False,close=False,aim_height=None,scale=None):
    """Disposable per-building photography stage; never saved or exported."""
    scene=bpy.context.scene
    for obj in scene.objects:
        if obj.type in {'MESH','LIGHT','FONT'}: obj.hide_render=True
    stage=bpy.data.collections.new('Temporary hero detail review')
    scene.collection.children.link(stage)
    # Peace is authored in city coordinates, with its riverfront facing +X.
    rotation=Matrix.Rotation(math.pi/2,4,'Z') if number=='20' else Matrix.Identity(4)
    transform=rotation @ root.matrix_world.inverted()
    points=[transform @ o.matrix_world @ Vector(p) for o in previous.meshes(root) for p in o.bound_box]
    lo=Vector([min(p[i] for p in points) for i in range(3)])
    hi=Vector([max(p[i] for p in points) for i in range(3)])
    transform=Matrix.Translation((-(lo.x+hi.x)/2,-hi.y,-lo.z)) @ transform
    staged=[]
    for obj in previous.meshes(root):
        copy=obj.copy()
        copy.data=obj.data.copy()
        stage.objects.link(copy)
        copy.parent=None
        copy.matrix_world=transform @ obj.matrix_world
        copy.hide_render=False
        # Material copies keep inspection emission out of the authored source.
        for i,mat in enumerate(copy.data.materials):
            m=mat.copy()
            copy.data.materials[i]=m
            node=m.node_tree.nodes.get('Principled BSDF')
            key=str(m.get('spaceShaderKey',''))
            strength=0
            if night and 'shanghai-illumination-' in key:
                try: strength=min(.18,float(key.split('shanghai-illumination-')[1].split('-')[0])*.12)
                except ValueError: pass
                if obj.get('spaceBundHeroPart')=='lamp-lenses': strength=3
            if node:
                node.inputs['Emission Color'].default_value=(1,.67,.34,1)
                node.inputs['Emission Strength'].default_value=strength
        staged.append(copy)
    width,height=hi.x-lo.x,hi.z-lo.z
    if night:
        for i,x in enumerate([-width*.36,-width*.12,width*.12,width*.36]):
            data=bpy.data.lights.new('Review facade wash '+str(i),'AREA')
            data.energy,data.color,data.shape,data.size=5800,(1,.80,.56),'DISK',3
            light=bpy.data.objects.new(data.name,data); stage.objects.link(light)
            light.location=(x,9,4)
            light.rotation_euler=(Vector((x*.85,-1,height*.42))-light.location).to_track_quat('-Z','Y').to_euler()
        data=bpy.data.lights.new('Review crown wash','AREA')
        data.energy,data.color,data.size=2400,(1,.85,.64),4
        light=bpy.data.objects.new(data.name,data); stage.objects.link(light)
        light.location=(0,12,height*.68)
        light.rotation_euler=(Vector((0,-6,height*.88))-light.location).to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new('Hero review world'); world.use_nodes=True; scene.world=world
    bg=world.node_tree.nodes.new('ShaderNodeBackground')
    output=world.node_tree.nodes.new('ShaderNodeOutputWorld')
    output.is_active_output=True
    world.node_tree.links.new(bg.outputs['Background'],output.inputs['Surface'])
    bg.inputs['Color'].default_value=(.035,.055,.105,1) if night else (.57,.65,.76,1)
    bg.inputs['Strength'].default_value=.40 if night else .65
    data=bpy.data.lights.new('Review sun','SUN'); data.energy=.12 if night else 2.0; data.angle=.15
    light=bpy.data.objects.new(data.name,data); stage.objects.link(light)
    light.rotation_euler=Vector((-.5,-.7,-1)).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Detail review camera',bpy.data.cameras.new('Detail review camera'))
    stage.objects.link(cam); scene.camera=cam
    aim=Vector((0,0,height*.48))
    if close: aim.z={'20':65,'12':17,'13':23}[number]
    if aim_height is not None: aim.z=aim_height
    cam.location=aim+Vector((25 if close else 0,200,16))
    cam.rotation_euler=(aim-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=32 if close else max(width+8,height+9)
    if scale is not None: cam.data.ortho_scale=scale
    cam.data.clip_end=2000
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24; scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED'; scene.render.threads=14
    scene.render.resolution_x=1200; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(OUTPUT/(label+'-'+number+('-night' if night else '-day')+('-close' if close else '')+'.png'))
    bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--baseline',action='store_true')
    parser.add_argument('--review-saved',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    parser.add_argument('--night',action='store_true')
    parser.add_argument('--close',action='store_true')
    parser.add_argument('--suite',action='store_true',help='Render all three buildings in daylight and at night')
    parser.add_argument('--focus',choices=list(IDS),default='12')
    parser.add_argument('--label',default='candidate')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.apply and (args.baseline or args.review_saved): parser.error('Review cannot save')
    scene=bpy.context.scene; source=ROOT/'design/space/scenes/shanghai.blend'
    if Path(bpy.data.filepath).resolve()!=source or scene.get('space_asset')!='shanghai' or scene.get('space_contract')!=2:
        raise RuntimeError('Open the repository contract-v2 Shanghai source')
    initial=source.stat(); OUTPUT.mkdir(parents=True,exist_ok=True)
    by_id={o.get('spaceId'):o for o in scene.objects if o.get('space_export')}
    roots={n:by_id[key] for n,key in IDS.items()}
    report={'revision':REVISION,'saved':False,'buildings':{}}
    if not (args.baseline or args.review_saved):
        if any(r.get('spaceBundHeroRevision') for r in roots.values()): raise RuntimeError('Already authored; preserve subsequent edits')
        before=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        archive=bpy.data.collections.new('ARCHIVE before Bund hero details 20260909 (not exported)')
        scene.collection.children.link(archive); archive.hide_render=archive.hide_viewport=True
        for number,author in [('12',hsbc),('13',customs),('20',peace)]:
            root=roots[number]
            detail=author(root,archive)
            masonry(by_id[root['spaceId']+'/0'],number,archive)
            root['spaceBundHeroRevision']=REVISION
            root['spaceBundHeroDetail']=detail|{'estimated':True,'fixtureLighting':'Existing runtime pool; preview lights are not surveyed'}
            root['spaceFacadeDetail']['stoneMeshes']=sum('bund-stone' in str(mat.get('spaceShaderKey','')) for o in previous.meshes(root) for mat in o.data.materials)
            report['buildings'][number]=detail
        bpy.context.view_layer.update()
        after=Counter(o.get('spaceId') for o in scene.objects if o.get('space_export'))
        if any(after[k]!=n for k,n in before.items()): raise RuntimeError('Original runtime ID lost')
        if any(n!=1 for k,n in after.items() if k is not None): raise RuntimeError('Duplicate runtime ID')
        for number,height in [('12',46.3),('13',79.2),('20',77)]:
            if abs(previous.bounds(roots[number])[1].z-height)>.025: raise RuntimeError('Roof envelope changed: '+number)
        if any(not o.data.polygons for root in roots.values() for o in previous.meshes(root)): raise RuntimeError('Empty runtime geometry')
        report.update(preservedIds=sum(k is not None for k in before),newMeshes=sum(after.values())-sum(before.values()))
        if args.apply:
            latest=source.stat()
            if (latest.st_mtime_ns,latest.st_size)!=(initial.st_mtime_ns,initial.st_size): raise RuntimeError('Source changed in another editor')
            bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
            bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
            report['saved']=True
    (OUTPUT/(args.label+'-'+args.focus+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('BUND_HERO_REVIEW '+json.dumps(report),flush=True)
    if not args.no_render:
        if args.suite:
            for number in IDS:
                for night in (False,True):
                    review(roots[number],number,args.label,night,args.close)
        else:
            review(roots[args.focus],args.focus,args.label,args.night,args.close)


if __name__=='__main__': main()
