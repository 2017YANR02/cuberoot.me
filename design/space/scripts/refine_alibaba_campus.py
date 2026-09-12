"""Photo-referenced Alibaba Xuhui Y campus, incremental Blender authoring.

Run against scenes/shanghai.blend with --threads 14. Preview is the default;
--apply backs up and saves the source after geometry checks. References and
estimated dimensions are recorded in ../references/alibaba-xuhui.md.
"""
import argparse
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
from refine_jin_mao import Mesh, linear
from refine_bund_entrances import box, cylinder, archive_and_filter

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'design/space/scenes/shanghai.blend'
REVISION = 'alibaba-xuhui-y-20260912'
CENTER = (-3980.2, -9594.0, .12)
YAW = math.atan2(15.7, 105.8)
DX, DY = 13.5, 10.5
LEVELS = [0, 5.5, 11] + [11 + 4.5 * i for i in range(1, 10)]


def material(name, rgb, metal=.0, rough=.5, light=0):
    mat = bpy.data.materials.new('Alibaba ' + name)
    mat.use_nodes = True
    color = tuple(linear(c / 255) for c in rgb) + (1,)
    mat.diffuse_color = color
    mat.metallic, mat.roughness = metal, rough
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = color
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    mat['spaceMaterialId'] = REVISION + '/' + name
    mat['spaceShaderKey'] = 'shanghai-illumination-uniform-v1'
    mat['spaceIllumination'] = light
    return mat


def occupied(i, j, k):
    if not (0 <= i < 8 and 0 <= j < 8 and 0 <= k < 11):
        return False
    # Two longitudinal wings and an open-air spine, with offset connecting
    # bridges. The central slots stay genuinely open through the roof.
    if i in (3, 4):
        if j in (2, 5): return False
        if j in (3, 4): return k >= 3
        return k in (2, 3, 8, 9)
    # River facade stepped terraces: remove two bays of office depth.
    if i >= 6 and 2 <= j <= 5 and 4 <= k <= 7: return False
    if i >= 6 and j in (1, 6) and k in (4, 5): return False
    # South facade's deep sky garden intersects the central courtyard.
    if j <= 1 and 2 <= i <= 5 and 4 <= k <= 7: return False
    if j <= 1 and i in (1, 6) and k == 5: return False
    # Upper river-side roof terrace has a lower pavilion and open pergola.
    if i >= 5 and j >= 3 and k == 10: return False
    # Double-height ground-level passage into the public atrium.
    if i >= 6 and j in (3, 4) and k <= 1: return False
    return True


def author(collection):
    root = bpy.data.objects.new('Alibaba Xuhui Y campus', None)
    collection.objects.link(root)
    root.location = CENTER
    root.rotation_euler.z = YAW
    root['space_export'] = True
    root['spaceId'] = 'authored/alibaba-xuhui-y'
    root['spaceName'] = 'Alibaba Xuhui Y campus'
    root['spaceVisible'] = True
    root['spaceAlibabaRevision'] = REVISION
    root['spaceAlibabaReference'] = 'OSM way/792384120; Foster + Partners; Fangfang Tian 2024 photographs'
    root['spaceAlibabaEstimated'] = True
    mats = {
        'silver': material('silver cladding', (192, 196, 194), .56, .31),
        'frame': material('chamfered frame', (218, 220, 215), .4, .3),
        'dark': material('recessed mullions', (64, 72, 72), .5, .34),
        'glass': material('grey green glazing', (104, 126, 126), .55, .2, .04),
        'glass-lit': material('occupied office glazing', (190, 185, 162), .28, .25, .22),
        'glass-dim': material('unoccupied office glazing', (88, 106, 108), .5, .24, .035),
        'rail-glass': material('transparent terrace balustrade', (190, 209, 204), .05, .18),
        'soffit': material('ribbed soffit', (177, 180, 174), .42, .4, .07),
        'light': material('warm white linear luminaires', (255, 240, 212), .12, .3, 3.2),
        'orange': material('Alibaba orange lettering', (240, 130, 68), .28, .34, .65),
        'paving': material('grey granite paving', (140, 145, 142), .02, .8),
        'joint': material('paving joints', (101, 109, 106), .0, .85),
        'deck': material('terrace decking', (129, 101, 80), .0, .82),
        'planter': material('light stone planters', (184, 189, 176), .05, .72),
        'trunk': material('tree trunks', (91, 79, 62), .0, .93),
        'foliage': material('terrace planting', (67, 96, 53), .0, .91),
        'leaf-light': material('young leaves', (99, 124, 64), .0, .88),
    }
    rail_mat=mats['rail-glass']
    rail_mat.diffuse_color=(*rail_mat.diffuse_color[:3],.24)
    next(n for n in rail_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Alpha'].default_value=.24
    rail_mat.surface_render_method='DITHERED'
    parts = {name: Mesh() for name in mats}
    def cube(name, center, size): box(parts[name], center, size)
    rng = random.Random(792384120)

    def planting(x, y, z, large=False):
        radius = 1.65 if large else .7
        height = 5.4 if large else 3.2
        cube('planter', (x, y, z + .35), (radius * 2.7, radius * 2.7, .7))
        cylinder(parts['trunk'], x, y, z + .5, z + height, .14 if large else .11, .065, 8)
        for n in range(5):
            cx, cy = x + rng.uniform(-.6, .6), y + rng.uniform(-.6, .6)
            cz = z + height-.6 + rng.uniform(-.3, 1.3)
            mesh = parts['foliage' if n % 2 else 'leaf-light']
            # Irregular triangulated crowns, deterministic and batched.
            rings = []
            for a in range(7):
                phi = math.pi * a / 6
                rings.append([(cx + radius * math.sin(phi) * math.cos(b*math.tau/10) * rng.uniform(.86, 1.12),
                               cy + radius * math.sin(phi) * math.sin(b*math.tau/10) * rng.uniform(.86, 1.12),
                               cz + radius * 1.15 * math.cos(phi)) for b in range(10)])
            for a in range(6):
                for b in range(10):
                    c = (b + 1) % 10
                    mesh.face([rings[a][b], rings[a+1][b], rings[a+1][c]])
                    mesh.face([rings[a][b], rings[a+1][c], rings[a][c]])

    def rail(a, b, z):
        a, b = Vector((*a, z)), Vector((*b, z))
        length = (b-a).length
        for h in (.12, 1.12): parts['dark'].beam(a + Vector((0,0,h)), b + Vector((0,0,h)), .06)
        for n in range(math.ceil(length/1.5)+1):
            p = a.lerp(b, n/math.ceil(length/1.5))
            parts['dark'].beam(p, p + Vector((0,0,1.12)), .035)
        # Glass balustrades are shallow tinted panes, not an opaque stone wall.
        parts['rail-glass'].face([a+Vector((0,0,.15)), b+Vector((0,0,.15)), b+Vector((0,0,1.04)), a+Vector((0,0,1.04))])

    # The shared cell faces are omitted; every visible bay has real depth,
    # thin mullions and four projecting horizontal solar-control fins.
    exposed, terraces = 0, []
    for k in range(11):
        z0, z1 = LEVELS[k:k+2]
        h = z1-z0
        for i in range(8):
            for j in range(8):
                if not occupied(i,j,k): continue
                x, y = (i-3.5)*DX, (j-3.5)*DY
                cube('silver', (x,y,z0+.18), (DX,DY,.36))
                if not occupied(i,j,k+1):
                    cube('paving' if z1>=47 else 'deck', (x,y,z1-.05), (DX-.2,DY-.2,.26))
                    terraces.append((i,j,z1))
                if k > 0 and not occupied(i,j,k-1):
                    cube('soffit', (x,y,z0-.03), (DX,DY,.12))
                    for s in range(12):
                        xx=x-DX/2+.5+s*(DX-1)/11
                        cube('silver', (xx,y,z0-.18), (.055,DY,.25))
                        if s%2 == 0: cube('light', (xx+.1,y,z0-.195), (.07,DY-.7,.03))
                for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
                    if occupied(i+di,j+dj,k): continue
                    exposed += 1
                    width = DY if di else DX
                    # u follows the facade; v is outward. Return boxes and
                    # glazing sit behind the outer structural frame.
                    normal = Vector((di,dj,0))
                    along = Vector((-dj,di,0))
                    origin = Vector((x+di*DX/2,y+dj*DY/2,0))
                    def fc(name,u,v,z,w,d,hh):
                        p=origin+along*u+normal*v+Vector((0,0,z))
                        cube(name,p,(d,w,hh) if di else (w,d,hh))
                    fc('glass',0,-.52,(z0+z1)/2,width-.45,.07,h-.48)
                    for edge in (-1,1): fc('frame',edge*(width/2-.16),0,(z0+z1)/2,.32,.64,h)
                    for z in (z0+.19,z1-.14): fc('frame',0,0,z,width,.7,.32)
                    # Visible panel seams on the deep silver frame returns.
                    for z in (z0+h*.33,z0+h*.66):
                        for edge in (-1,1): fc('dark',edge*(width/2-.16),.325,z,.315,.012,.015)
                    panes=6
                    for q in range(panes):
                        u=-width/2+(q+.5)*width/panes
                        # Offices light in contiguous floor/wing zones; a
                        # per-pane modulus made the facade a checkerboard.
                        lit = k in (0,1,2,3,5,6,8,9) and not (i<2 and j>5 and k>5)
                        fc('glass-dim',u,-.47,(z0+z1)/2,width/panes-.07,.03,h-.65)
                        if lit:
                            fc('glass-lit',u,-.445,z0+h*.63,width/panes-.07,.012,h*.57)
                        # Light baffles behind the glazing create horizontal
                        # office depth without lighting every whole elevation.
                        if lit: fc('light',u,-.42,z1-.58,width/panes-.3,.025,.045)
                    for q in range(1,panes): fc('dark',-width/2+q*width/panes,-.35,(z0+z1)/2,.048,.12,h-.35)
                    for f in range(1,5): fc('silver',0,-.09,z0+h*f/5,width-.38,.43,.09)
                    if k == 0:
                        # Door frame and pull handles on selected entry bays.
                        for u in (-.75,0,.75): fc('dark',u,-.2,z0+1.65,.045,.1,3.3)
                        fc('silver',0,-.2,z0+3.3,1.55,.12,.06)
                        for u in (-.12,.12): fc('silver',u,-.12,z0+1.2,.032,.12,.65)

    # Terrace edges, planted strips and a fine open roof trellis. No solid cap
    # spans the two central roof slots shown in the aerial reference.
    terrace_set={(i,j):z for i,j,z in terraces}
    for i,j,z in terraces:
        x,y=(i-3.5)*DX,(j-3.5)*DY
        for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
            if terrace_set.get((i+di,j+dj)) == z: continue
            if di: rail((x+di*(DX/2-.25),y-DY/2+.3),(x+di*(DX/2-.25),y+DY/2-.3),z)
            else: rail((x-DX/2+.3,y+dj*(DY/2-.25)),(x+DX/2-.3,y+dj*(DY/2-.25)),z)
        if (i+j)%3 == 0: planting(x-2,y+2,z)
        if z >= 47:
            for xx in (-DX/2,DX/2): cube('frame',(x+xx,y,z+1.75),(.12,DY,.12))
            for yy in (-DY/2,DY/2): cube('frame',(x,y+yy,z+1.75),(DX,.12,.12))
            for q in range(1,4): cube('silver',(x-DX/2+DX*q/4,y,z+1.75),(.07,DY,.09))
            for xx in (-DX/2,DX/2): cube('frame',(x+xx,y-DY/2,z+.85),(.11,.11,1.8))

    # Dark screened MEP cores on the two wings, with vents and roof ladders.
    for x,y,z,sx,sy in [(-35,18,51.5,17,24),(-35,-25,51.5,17,13),(32,20,47,17,12)]:
        cube('dark',(x,y,z+1.55),(sx,sy,3.1))
        for yy in (-sy/2,sy/2):
            for n in range(11): cube('silver',(x,y+yy,z+.2+n*.27),(sx,.1,.055))
        for dx in (-sx/2,sx/2): cube('frame',(x+dx,y,z+1.6),(.22,sy+.3,3.2))
        for q in range(3):
            cylinder(parts['silver'],x+(q-1)*4.5,y,z+3.1,z+3.28,1.6,steps=20)
            cylinder(parts['dark'],x+(q-1)*4.5,y,z+3.28,z+3.31,1.25,steps=20)

    cube('paving',(0,0,-.12),(116,92,.24))
    for xx in range(-57,58,3): cube('joint',(xx,0,.012),(.018,91,.008))
    for yy in range(-45,46,3): cube('joint',(0,yy,.014),(115,.018,.008))
    # Public court planting and low benches leave a clear central path.
    for x,y in [(-7,-20),(7,22),(-7,30),(7,-30)]:
        planting(x,y,.08,True)
        cube('deck',(x+3,y,.48),(2.3,1,.18))
        for dx in (-.8,.8): cube('dark',(x+3+dx,y,.25),(.08,.8,.5))
    for y in (-35,-21,-7,7,21,35): planting(56,y,.08,True)
    for x in (-46,-28,-10,10,28,46): planting(x,-44,.08,True)

    generated=[]
    for name,mesh in parts.items():
        if not mesh.faces: continue
        obj=mesh.object('Alibaba '+name,mats[name],root,collection)
        obj['spaceId']=root['spaceId']+'/'+name
        if name in ('foliage','leaf-light'):
            bm=bmesh.new(); bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.001)
            bm.to_mesh(obj.data); bm.free()
            for polygon in obj.data.polygons: polygon.use_smooth=True
        # UVs follow metres on the dominant plane, ready for later surveyed
        # texture work; no downloaded photograph is used as a runtime map.
        for p in obj.data.polygons:
            axes=[n for n in range(3) if n != max(range(3),key=lambda a:abs(p.normal[a]))]
            for li in p.loop_indices:
                v=obj.data.vertices[obj.data.loops[li].vertex_index].co
                obj.data.uv_layers.active.data[li].uv=(v[axes[0]],v[axes[1]])
        generated.append(obj)
    # Small chamfers catch glancing light on the outer aluminum frame.
    frame=next(o for o in generated if o.name=='Alibaba frame')
    bpy.context.view_layer.objects.active=frame
    bevel=frame.modifiers.new('Photo visible softened metal edges','BEVEL')
    bevel.width=.045; bevel.segments=2
    bpy.ops.object.modifier_apply(modifier=bevel.name)

    def text(body, name, location, rotation, size, width, mat):
        data=bpy.data.curves.new(name,'FONT'); data.body=body
        data.size=size; data.align_x='CENTER'; data.extrude=.055; data.bevel_depth=.012; data.bevel_resolution=2
        font=Path('C:/Windows/Fonts/arialbd.ttf')
        if font.exists(): data.font=bpy.data.fonts.load(str(font),check_existing=True)
        obj=bpy.data.objects.new(name,data); collection.objects.link(obj); obj.parent=root
        obj.location=location; obj.rotation_euler=rotation; data.materials.append(mat)
        bpy.context.view_layer.update()
        if width: obj.scale.x=width/obj.dimensions.x
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
        bpy.context.view_layer.objects.active=obj; bpy.ops.object.convert(target='MESH')
        obj['space_export']=True; obj['spaceId']=root['spaceId']+'/'+name.replace(' ','-').lower()
        obj['spaceVisible']=True; obj['spaceCastShadow']=True; obj['spaceReceiveShadow']=True
        generated.append(obj)
    # The photo shows Latin Alibaba lettering, not invented Chinese roof text.
    text('Alibaba','Alibaba roof sign',(54.4,26,47.7),(math.pi/2,0,math.pi/2),2.9,19,mats['orange'])
    text('D3','Alibaba D3 entrance',(13.7,-23,3.6),(math.pi/2,0,math.pi/2),.65,0,mats['frame'])
    text('D4','Alibaba D4 entrance',(26,-42.35,3.6),(math.pi/2,0,0),.65,0,mats['frame'])
    bpy.context.view_layer.update()
    return root,generated,{'exposedFacadeBays':exposed,'terraceCells':len(terraces),'storeys':11,'estimatedPlanMetres':[108,84]}


def camera(collection,name,root,position,target):
    data=bpy.data.cameras.new(name); data.lens=44; data.clip_start=.1; data.clip_end=100000
    obj=bpy.data.objects.new(name,data); collection.objects.link(obj)
    obj.location=root.matrix_world @ Vector(position)
    aim=root.matrix_world @ Vector(target)
    obj.rotation_euler=(aim-obj.location).to_track_quat('-Z','Y').to_euler()
    obj['space_export']=False
    return obj


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--output',default=str(ROOT/'.tmp/png/space-alibaba-20260912/candidate01'))
    parser.add_argument('--render',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if Path(bpy.data.filepath).resolve()!=SOURCE.resolve(): raise RuntimeError('Open canonical shanghai.blend')
    before=(SOURCE.stat().st_size,SOURCE.stat().st_mtime_ns)
    output=Path(args.output).resolve()
    if not output.is_relative_to(ROOT/'.tmp/png'): raise RuntimeError('Review artifacts must stay in .tmp/png')
    output.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene
    if any(o.get('spaceId')=='authored/alibaba-xuhui-y' for o in scene.objects):
        raise RuntimeError('Campus already authored; inspect artist changes before a new revision')
    original_ids={o.get('spaceId') for o in scene.objects if o.get('space_export')}
    baseline=next(o for o in scene.objects if o.get('spaceId')=='root/62')
    archive=bpy.data.collections.new('ARCHIVE Alibaba Y simplified footprint (not exported)')
    scene.collection.children.link(archive)
    footprint = [(-4037.9,-9559.5),(-3932.1,-9543.8),(-3931.7,-9549.5),
                 (-3924,-9548.9),(-3917.7,-9623),(-3924.9,-9628.7),
                 (-4025.4,-9643.6),(-4032.1,-9638.7),(-4042.7,-9567)]
    def campus_face(points):
        # Match the actual OSM vertices, including the buried bottom cap.
        return all(any(abs(p.x-x)<.02 and abs(p.y-y)<.02 for x,y in footprint)
                   and (abs(p.z+.65)<.02 or abs(p.z-11.35)<.02) for p in points)
    removed=archive_and_filter(baseline,campus_face,archive)
    if removed != 32: raise RuntimeError(f'Expected 7 top + 7 bottom + 18 wall triangles, got {removed}')
    archive.hide_viewport=True; archive.hide_render=True
    collection=bpy.data.collections.new('AUTHORING Alibaba Xuhui Y campus')
    scene.collection.children.link(collection)
    root,objects,report=author(collection)
    if not original_ids.issubset({o.get('spaceId') for o in scene.objects if o.get('space_export')}):
        raise RuntimeError('Existing city identity removed')
    if any(not math.isfinite(c) for o in objects for v in o.data.vertices for c in v.co):
        raise RuntimeError('Nonfinite campus geometry')
    # Ray checks distinguish open sky gardens from a painted dark facade.
    verts=[]; faces=[]
    for obj in objects:
        transform=root.matrix_world.inverted() @ obj.matrix_world
        offset=len(verts); verts.extend(transform@v.co for v in obj.data.vertices)
        faces.extend([offset+i for i in p.vertices] for p in obj.data.polygons)
    bvh=BVHTree.FromPolygons(verts,faces)
    rays=[]
    for name,origin,direction,distance,expected in [
        ('river sky garden',(60,0,33),(-1,0,0),22,False),
        ('south sky garden',(0,-48,33),(0,1,0),22,False),
        ('north roof slot',(0,15.75,60),(0,0,-1),55,False),
        ('south roof slot',(0,-15.75,60),(0,0,-1),55,False),
        ('river occupied wing',(60,-36,20),(-1,0,0),12,True),
        ('western office wing',(-60,0,20),(1,0,0),12,True),
    ]:
        hit=bvh.ray_cast(Vector(origin),Vector(direction),distance)[0] is not None
        rays.append({'name':name,'hit':hit,'expected':expected,'pass':hit==expected})
    if not all(r['pass'] for r in rays): raise RuntimeError('Opening checks failed: '+json.dumps(rays))
    preview=bpy.data.collections.new('PREVIEW Alibaba cameras (not exported)')
    scene.collection.children.link(preview)
    cam=camera(preview,'Alibaba campus',root,(155,-148,101),(0,0,26))
    court=camera(preview,'Alibaba courtyard',root,(6,-61,4),(0,4,13))
    court.data.lens=32
    report.update(revision=REVISION,removedFallbackFaces=removed,meshes=len(objects),
                  vertices=sum(len(o.data.vertices) for o in objects),polygons=sum(len(o.data.polygons) for o in objects),
                  rayChecks=rays,sourceFingerprint=before,applied=False)
    def assert_unchanged():
        if (SOURCE.stat().st_size,SOURCE.stat().st_mtime_ns)!=before: raise RuntimeError('Source changed during authoring; refusing overwrite')
    assert_unchanged()
    if args.apply:
        backup=output/'shanghai-before-alibaba.blend'
        if backup.exists(): raise RuntimeError('Backup path already exists')
        shutil.copy2(SOURCE,backup)
        assert_unchanged()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report['applied']=True
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*objects]: obj.hide_set(False); obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(output/'alibaba-campus.glb'),export_format='GLB',use_selection=True,
                              export_extras=True,export_attributes=True,export_yup=True,export_animations=False)
    report['candidateBytes']=(output/'alibaba-campus.glb').stat().st_size
    (output/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('ALIBABA_RESULT '+json.dumps(report),flush=True)
    if args.render:
        # Isolated asset review; stage/light changes never save into authoring.
        keep={o.name for o in [root,*objects,cam]}
        for obj in scene.objects:
            if obj.name not in keep: obj.hide_render=True
        scene.camera=cam
        scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=20
        scene.cycles.use_denoising=True
        scene.render.threads_mode='FIXED'; scene.render.threads=14
        scene.render.resolution_x=1400; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
        scene.world=bpy.data.worlds.new('Alibaba temporary daylight'); scene.world.use_nodes=True
        background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
        background.inputs[0].default_value=(.55,.65,.8,1)
        background.inputs[1].default_value=.65
        sun=bpy.data.lights.new('Alibaba review sun','SUN'); sun.energy=2.2; sun.angle=.08
        obj=bpy.data.objects.new(sun.name,sun); scene.collection.objects.link(obj)
        obj.rotation_euler=(.45,-.5,-.5)
        scene.render.filepath=str(output/'day.png'); bpy.ops.render.render(write_still=True)
        # Same mesh and material energy as the runtime night channels; this
        # Cycles stage is only a geometry review, not proof of web lighting.
        background.inputs[0].default_value=(.12,.17,.26,1)
        background.inputs[1].default_value=.24
        sun.energy=.12
        for mat in {m for o in objects for m in o.data.materials}:
            node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            node.inputs['Emission Color'].default_value=mat.diffuse_color
            node.inputs['Emission Strength'].default_value=float(mat.get('spaceIllumination',0))
        scene.render.filepath=str(output/'night.png'); bpy.ops.render.render(write_still=True)
        scene.camera=bpy.data.objects['Alibaba courtyard']
        scene.render.filepath=str(output/'courtyard-night.png'); bpy.ops.render.render(write_still=True)


if __name__=='__main__': main()
