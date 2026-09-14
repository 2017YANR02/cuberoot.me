"""Photo-guided stone base, perforated screens and circular entrance.

SKYDB/Nephilim and SOM photographs are references, never runtime textures.
Dimensions and the east entrance placement are estimates, not surveyed data.
Creates an isolated candidate by default; --apply requires its exact sources.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_jin_mao as jm
import refine_jin_mao_body as body
import refine_swfc_top as exchange
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

REVISION = 'jin-mao-base-20260913'
PROPERTY = 'spaceJinMaoBaseRevision'
ROOT_ID = 'root/132/0'
OUTPUT = jm.ROOT / '.tmp/png/space-jinmao-base-20260913'
HEIGHT = 12.12


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def surface(index):
    lower, upper = body.plan(29.3, 3.809), body.plan(30.95, 3.809)
    a, b = lower[index], lower[(index+1) % 24]
    c, d = upper[index], upper[(index+1) % 24]
    edge = b-a
    outward = Vector((edge.y, -edge.x, 0)).normalized()

    def point(t, z, projection=0):
        xy = a.lerp(b, t).lerp(c.lerp(d, t), z/64.64)
        return Vector((*xy, z)) + outward*projection
    return point, edge.length, outward


def patch(mesh, point, t0, t1, z0, z1, projection, thickness=.025):
    pts = [point(t0,z0,projection), point(t1,z0,projection),
           point(t1,z1,projection), point(t0,z1,projection)]
    normal = (point(t0,z0,projection)-point(t0,z0,projection-thickness))
    exchange.thin_panel(mesh, pts, -normal)


def round_hole_strip(mesh, point, t0, t1, z, length):
    """Through holes with a closed rectangular border around each cell."""
    count = max(1, round((t1-t0)*length/.20))
    for cell in range(count):
        left = t0+(t1-t0)*cell/count
        right = t0+(t1-t0)*(cell+1)/count
        half = (right-left)*length*.5
        center = (left+right)*.5
        front, back, hole, rear = [], [], [], []
        corners = [math.atan2(y, x) % math.tau
                   for x in (-half, half) for y in (-.105, .105)]
        angles = sorted({round(a, 12) for a in
                         [math.tau*k/12 + math.pi/12 for k in range(12)] + corners})
        for angle in angles:
            x, y = math.cos(angle), math.sin(angle)
            extent = min(half/abs(x), .105/abs(y))
            front.append(point(center+x*extent/length, z+y*extent, .64))
            back.append(point(center+x*extent/length, z+y*extent, .625))
            hole.append(point(center+x*.060/length, z+y*.060, .64))
            rear.append(point(center+x*.060/length, z+y*.060, .625))
        for k in range(len(angles)):
            j = (k+1) % len(angles)
            mesh.face([front[k],front[j],hole[j],hole[k]])
            mesh.face([back[j],back[k],rear[k],rear[j]])
            mesh.face([hole[k],hole[j],rear[j],rear[k]])
        # Cells share their outer edges. Only the exposed top/bottom edges
        # require closure; the adjacent facade frame closes both end edges.
        for zz in (z-.105,z+.105):
            mesh.face([point(left,zz,.625),point(right,zz,.625),
                       point(right,zz,.64),point(left,zz,.64)])


def grille(mesh, point, t0, t1, z0, z1, length):
    nx, nz = max(2,round((t1-t0)*length/.038)), max(2,round((z1-z0)/.038))
    for i in range(nx+1):
        t = t0+(t1-t0)*i/nx
        patch(mesh,point,t-.004/length,t+.004/length,z0,z1,.345,.018)
    for i in range(nz+1):
        z = z0+(z1-z0)*i/nz
        patch(mesh,point,t0,t1,z-.004,z+.004,.347,.018)


def cladding(parts):
    count = 0
    for face in range(24):
        point, length, normal = surface(face)
        if face % 6 == 2:
            # The photographed entrance surround is jointed stone, not the
            # inherited full-height blue glass and widely spaced mullions.
            # Matching surrounds on the other recesses remain an estimate.
            bays = max(1,round(length/1.5))
            for bay in range(bays):
                t0,t1=(bay+.008)/bays,(bay+.992)/bays
                patch(parts['black'],point,t0,t1,.04,.55,.36,.11)
                for course in range(14):
                    low=.58+course*.82
                    high=min(HEIGHT,low+.805)
                    patch(parts['stone'],point,t0,t1,low,high,.29,.085)
            continue
        bays = max(1,round(length/1.5))
        for bay in range(bays):
            t0, t1 = (bay+.065)/bays, (bay+.935)/bays
            patch(parts['black'],point,t0,t1,.04,.55,.36,.11)
            patch(parts['stone'],point,t0,t1,.58,2.08,.29,.085)
            for course in range(6):
                low, high = 2.12+course*1.64, min(HEIGHT-.08,2.12+(course+1)*1.64-.035)
                # A recessed opening in the stone exposes a dark backing
                # behind a real square grille, rather than a painted pattern.
                center=(t0+t1)*.5
                half_opening=min(.51, (t1-t0)*length*.39)
                h0,h1=center-half_opening/length,center+half_opening/length
                z0,z1=low+.25,low+1.25
                for a,b,c,d in ((t0,h0,low,high),(h1,t1,low,high),
                                (h0,h1,low,z0),(h0,h1,z1,high)):
                    patch(parts['stone'],point,a,b,c,d,.29,.085)
                patch(parts['black'],point,h0,h1,z0,z1,.24,.025)
                grille(parts['silver'],point,h0,h1,z0,z1,length)
                round_hole_strip(parts['silver'],point,t0,t1,high-.10,length)
                exchange.thin_panel(parts['silver'],
                    [point(t0,high+.005,.64),point(t1,high+.005,.64),
                     point(t1,high+.055,.31),point(t0,high+.055,.31)],
                    Vector((0,0,-.022)))
                for t in (t0,t1):
                    body.rail(parts['silver'],point(t,high-.28,.30),
                              point(t,high,.62),.025,.025)
                count+=1
            for t in (bay/bays,(bay+1)/bays):
                # Avoid doubled coincident members along interior bays.
                if t == bay/bays and bay:
                    continue
                for shift in (-.075,.075):
                    body.rail(parts['silver'],point(t+shift/length,.58,.43),
                              point(t+shift/length,HEIGHT,.43),.055,.36,normal)
        patch(parts['silver'],point,0,1,HEIGHT-.07,HEIGHT,.39,.18)
    return count


def entrance(parts):
    point,length,normal=surface(20)
    # The east OSM canopy meets the recessed facade near local Y=3 m.
    center = (3.-point(0,0).y)/(point(1,0).y-point(0,0).y)
    cz,radius,door_top=4.30,2.80,2.80
    lower_angle=math.asin((door_top-cz)/radius)
    angles=[lower_angle+(math.pi-2*lower_angle)*i/96 for i in range(97)]
    for a,b in zip(angles,angles[1:]):
        # A solid annular surround, not two disconnected decorative rails.
        exchange.thin_panel(parts['silver'],
            [point(center+math.cos(theta)*r/length,cz+math.sin(theta)*r,.70)
             for theta,r in ((a,radius+.12),(b,radius+.12),
                             (b,radius-.12),(a,radius-.12))], -normal*.16)
    extent=math.sqrt(radius*radius-(door_top-cz)**2)
    for sign in (-1,1):
        t=center+sign*extent/length
        body.rail(parts['silver'],point(t,.12,.7),point(t,door_top,.7),.24,.20,normal)
    # A flush inset sits ahead of the old deep mullions. The inherited opaque
    # glass material represents a dark vestibule, not a reconstructed interior.
    exchange.thin_panel(parts['glass'],
        [point(center+math.cos(a)*radius/length,cz+math.sin(a)*radius,.43)
         for a in angles], -normal*.025)
    patch(parts['glass'],point,center-extent/length,center+extent/length,
          .12,door_top,.43,.025)
    for x in [i*.5 for i in range(-5,6)]:
        high=cz+math.sqrt(radius*radius-x*x)
        low=max(door_top,cz-math.sqrt(radius*radius-x*x))
        body.rail(parts['silver'],point(center+x/length,low,.73),
                  point(center+x/length,high,.73),.026,.034,normal)
    for z in [door_top+i*.5 for i in range(9) if door_top+i*.5<cz+radius]:
        half=math.sqrt(radius*radius-(z-cz)**2)
        body.rail(parts['silver'],point(center-half/length,z,.73),
                  point(center+half/length,z,.73),.034,.026,normal)
    for x in (-extent,-1.1,0,1.1,extent):
        body.rail(parts['silver'],point(center+x/length,.12,.73),
                  point(center+x/length,door_top,.73),.065,.09,normal)
    for z in (.12,door_top):
        body.rail(parts['silver'],point(center-extent/length,z,.73),
                  point(center+extent/length,z,.73),.10,.07,normal)
    for x in (-.15,.15):
        parts['silver'].beam(point(center+x/length,.95,.87),
                             point(center+x/length,1.65,.87),.032,sides=8)
    return {'face':20,'centerY':3.,'centerZ':cz,'radius':radius,
            'doorTop':door_top,'placementAndDimensionsEstimated':True}


def author(root):
    parts={k:jm.Mesh() for k in ('stone','silver','black','glass')}
    courses=cladding(parts)
    entry=entrance(parts)
    objects=[]
    for key,mesh in parts.items():
        material=next(m for m in bpy.data.materials
                      if m.get('spaceMaterialId')=='jin-mao-podium-20260913/'+key)
        obj=mesh.object('Jin Mao base '+key,material,root,root.users_collection[0])
        obj['spaceId']='authored/jin-mao/base/'+key
        obj[PROPERTY]=REVISION
        obj['spaceDimensionsEstimated']=True
        if obj.data.validate(verbose=True) or any(p.area<1e-10 for p in obj.data.polygons):
            raise RuntimeError('Invalid base geometry: '+key)
        objects.append(obj)
    bpy.context.view_layer.update()
    return objects,{'height':HEIGHT,'screenPanels':courses,'entry':entry,
                    'faces':{o['spaceId']:len(o.data.polygons) for o in objects}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label',required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or len(args.label)>64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a short lowercase filename label')
    scene=bpy.context.scene
    roots=[o for o in scene.objects if o.get('spaceId')==ROOT_ID]
    if (len(roots)!=1 or Path(bpy.data.filepath).resolve()!=SOURCE.resolve()
            or scene.get('space_contract')!=2 or scene.get(PROPERTY)):
        raise RuntimeError('Expected canonical contract-v2 source before this revision')
    root=roots[0]
    if root.get('spaceJinMaoPodiumRevision')!='jin-mao-podium-20260913':
        raise RuntimeError('Expected the reviewed podium')
    token=source_fingerprint()
    scripts={p.name:sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory=OUTPUT/args.label
    candidate=json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate:
        if (candidate['sourceBefore']!=list(token) or candidate['scripts']!=scripts
                or sha(directory/'base.glb')!=candidate['candidateSha256']):
            raise RuntimeError('Reviewed source, dependency or candidate changed')
    else:
        directory.mkdir(parents=True,exist_ok=False)
    original=list(scene.objects)
    digest,rigs,ids=geometry_digest(original),export_snapshot(scene),exchange.runtime_id_snapshot(scene)
    materials={o:tuple(o.data.materials) for o in original if o.type=='MESH'}
    added,detail=author(root)
    if (geometry_digest(original)!=digest or export_snapshot(scene)!=rigs
            or any(tuple(o.data.materials)!=mats for o,mats in materials.items())
            or exchange.runtime_id_snapshot(scene)!=ids+Counter(o['spaceId'] for o in added)):
        raise RuntimeError('Original geometry, materials, lights or runtime identities changed')
    report={'revision':REVISION,'saved':False,'sourceBefore':list(token),'scripts':scripts,
            'preservedGeometry':digest,'preservedRigs':list(rigs),'detail':detail}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt base differs from reviewed candidate')
        backup=directory/'shanghai-before-jinmao-base.blend'
        if backup.exists():
            raise RuntimeError('Refusing to replace an existing backup')
        shutil.copy2(SOURCE,backup)
        assert_source_unchanged(token)
        scene[PROPERTY]=root[PROPERTY]=REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report.update(saved=True,sourceAfter=list(source_fingerprint()))
    else:
        targets=[root,*added]
        expected=exchange.export_geometry_snapshot(root,targets)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in targets:
            obj.hide_set(False)
            obj.select_set(True)
        path=directory/'base.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False)
        raw=path.read_bytes()
        size,kind=struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('Missing GLB JSON')
        exchange.ROOT_ID=ROOT_ID
        report['exportGeometry']=exchange.validate_export_geometry(json.loads(raw[20:20+size]),raw,expected)
        report['candidateSha256']=sha(path)
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),
                 (json.dumps(report,indent=2)+'\n').encode())
    print('JIN_MAO_BASE_RESULT '+json.dumps({k:v for k,v in report.items() if k!='scripts'}),flush=True)


if __name__=='__main__':
    main()
