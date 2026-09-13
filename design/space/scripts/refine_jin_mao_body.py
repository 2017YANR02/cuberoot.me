"""Photo-guided Jin Mao facade candidate; preserve the already authored crown.

SOM's museum section/plan diagram and the facade contractor's photographs are
references, not surveys. Section widths/heights stay at the existing estimates.
Default creates an isolated GLB and CPU previews; --apply requires the exact
reviewed candidate and an unchanged source. No GUI interaction is used.
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import refine_jin_mao as jm
import refine_jin_mao_crown as crown
import refine_swfc_top as exchange
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

OUTPUT = jm.ROOT / '.tmp/png/space-jinmao-body-20260913'
REVISION = 'jin-mao-body-20260913'
PROPERTY = 'spaceJinMaoBodyRevision'
KEYS = ('glass', 'steel', 'piers', 'recess')
FLARE = 1.65


def plan(half):
    """Deeper central recess and chamfered shoulders visible in the aerial view."""
    points = []
    for side in range(4):
        c, s = round(math.cos(side*math.pi/2)), round(math.sin(side*math.pi/2))
        for x, y in [(half*.73, half), (half*.32+.9, half),
                     (half*.32, half-1.8), (-half*.32, half-1.8),
                     (-half*.32-.9, half), (-half*.73, half)]:
            points.append(Vector((x*c-y*s, x*s+y*c)))
    return points


def rail(part, a, b, width, depth, depth_axis=None):
    # Mesh.beam's four sides are at 45 degrees; compensate to get the specified
    # physical width/depth instead of making every rectangular member too thin.
    if depth_axis is None:
        part.beam(a, b, width*math.sqrt(2), depth*math.sqrt(2))
        return
    # Vertical members must turn with each facade, including the chamfers.
    # A fixed world-axis cross section incorrectly lays fins flat on two sides.
    a, b = Vector(a), Vector(b)
    direction = (b-a).normalized()
    v = Vector(depth_axis)
    v = (v-direction*v.dot(direction)).normalized()
    u = v.cross(direction)*width*.5
    v *= depth*.5
    rings = [[p-u-v,p+u-v,p+u+v,p-u+v] for p in (a,b)]
    part.face(list(reversed(rings[0])))
    part.face(rings[1])
    for i in range(4):
        j = (i+1)%4
        part.face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]])


def fastener(parts, center, outward):
    """Visible washer face and raised hex head; omit their occluded rear faces."""
    axis = Vector((*outward,0))
    across = axis.cross(Vector((0,0,1))).normalized()
    vertical = axis.cross(across)
    def ring(projection, radius, sides):
        return [center+axis*projection
                +across*(radius*math.cos(2*math.pi*i/sides+math.pi/4))
                +vertical*(radius*math.sin(2*math.pi*i/sides+math.pi/4))
                for i in range(sides)]
    # The washer is 14 mm thick in round-02. Its edge is subpixel in both
    # facade review cameras; the visible front face retains its diameter/depth.
    parts['recess'].face(ring(.790,.060,8))
    back,front=ring(.790,.035,6),ring(.830,.035,6)
    parts['steel'].face(front)
    for i in range(6):
        j=(i+1)%6
        parts['steel'].face([back[i],back[j],front[j],front[i]])


def body_geometry():
    result = {}
    bottom = 0.
    for section, floors in enumerate(jm.FLOORS):
        top = bottom+floors*4.04
        half = 29.3-section*.8
        lower, upper = plan(half), plan(half+FLARE)
        parts = {k: jm.Mesh() for k in KEYS}
        parts['glass'].loft(lower, upper, bottom, top)
        # Ground levels have a different stick system; keep their glazing open.
        # The repeating unitized fins and spandrels start at the fourth level.
        detail_bottom = max(bottom, 3*4.04)
        for i, a in enumerate(lower):
            j = (i+1) % len(lower)
            b, c, d = lower[j], upper[i], upper[j]
            outward = Vector((b.y-a.y, a.x-b.x)).normalized()
            tangent = (b-a).normalized()
            normal = Vector((*outward,0))
            def face_rail(part, start, end, width, depth):
                rail(part,start,end,width,depth,normal)
            def point(t, z, projection=0):
                f = (z-bottom)/(top-bottom)
                p = a.lerp(b, t).lerp(c.lerp(d, t), f)+outward*projection
                return Vector((*p, z))
            count = max(1, round((b-a).length/1.4))
            for column in range(count):
                t = column/count
                # Dark mullion backing, paired projecting flat aluminum fins.
                face_rail(parts['recess'], point(t,bottom,.07), point(t,top,.07), .24, .16)
                for shift in [-.10, .10]:
                    delta = Vector((* (tangent*shift), 0))
                    face_rail(parts['steel'], point(t,detail_bottom,.35)+delta,
                         point(t,top+.55,.35)+delta, .065, .56)
                if section >= 4:
                    face_rail(parts['steel'], point(t,top+.55,.35),
                         point(t,top+1.1,.35), .065, .10)
            for floor in range(1, floors+1):
                z = bottom+floor*4.04
                if z <= 3*4.04:
                    continue
                # Opaque metal spandrel, actual depth, lower shadow reveal.
                face = [point(0,z-.74,.11),point(1,z-.74,.11),
                        point(1,z-.08,.11),point(0,z-.08,.11)]
                exchange.thin_panel(parts['steel'],face,Vector((*(-outward*.09),0)))
                face_rail(parts['recess'],point(0,z-.79,.08),point(1,z-.79,.08),.13,.12)
                # Folded upper/lower edges give the metal band a shadow channel.
                for level in [z-.68,z-.18]:
                    face_rail(parts['steel'],point(0,level,.205),point(1,level,.205),.035,.09)
                for level in [z-1.15,z-1.57,z-1.99]:
                    face_rail(parts['steel'],point(0,level,.65),point(1,level,.65),.075,.13)
                face_rail(parts['steel'],point(0,z-.02,.17),point(1,z-.02,.17),.11,.25)
                for column in range(count):
                    t = column/count
                    # Brackets tie the rail assembly back to the curtain wall.
                    rail(parts['recess'],point(t,z-1.58,.20),point(t,z-1.58,.64),.09,.09)
                    face_rail(parts['steel'],point(t,z-2.16,.75),point(t,z-.99,.75),.24,.045)
                    for level in [z-1.13,z-2.01]:
                        fastener(parts,point(t,level),outward)
                    # Spandrel panel joint; no invented signage or window decals.
                    face_rail(parts['recess'],point(t,z-.70,.115),point(t,z-.12,.115),.027,.025)
        for side in range(4):
            angle = side*math.pi/2
            c, s = round(math.cos(angle)), round(math.sin(angle))
            for sign in [-1,1]:
                def p(h,z):
                    x,y=sign*(h*.32+.48),h+.24
                    return (x*c-y*s,x*s+y*c,z)
                rail(parts['piers'],p(half,bottom),p(half+FLARE,top+.45),.72,.65,(-s,c,0))
        # Roof soffit and aluminum-covered terrace: stronger, separated lip.
        parts['recess'].loft(plan(half+FLARE+.12),plan(half+FLARE+.12),top-.46,top-.20)
        parts['steel'].loft(plan(half+FLARE+.28),plan(half+FLARE+.28),top-.20,top,cap=True)
        for a,b in zip(upper,upper[1:]+upper[:1]):
            rail(parts['steel'],(*a,top+.12),(*b,top+.12),.16,.34)
        # Sheet joints on exposed terraces; spacing is estimated from photos.
        outside = plan(half+FLARE+.22)
        inside = plan(half-.81 if section<len(jm.FLOORS)-1 else crown.BOTTOM_HALF)
        for i,a in enumerate(outside):
            j=(i+1)%len(outside)
            count=max(1,round((outside[j]-a).length/1.4))
            for panel in range(count):
                t=panel/count
                start=inside[i].lerp(inside[j],t)
                end=a.lerp(outside[j],t)
                rail(parts['recess'],(*start,top+.006),(*end,top+.006),.035,.016)
        for key,part in parts.items():
            result[f'Jin Mao tier {section+1:02d} {key}']=part
        bottom=top
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label',required=True)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or len(args.label)>64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a short lowercase filename label')
    scene=bpy.context.scene
    root=next(o for o in scene.objects if o.get('spaceId')==crown.ROOT_ID)
    if (Path(bpy.data.filepath).resolve()!=SOURCE.resolve() or scene.get('space_contract')!=2
            or root.get(crown.PROPERTY)!=crown.REVISION or root.get(PROPERTY) or scene.get(PROPERTY)):
        raise RuntimeError('Expected canonical source with reviewed crown and no prior body edit')
    parts=body_geometry()
    targets={name:next(o for o in root.children if o.name==name) for name in parts}
    if len(targets)!=48 or any(o.matrix_basis!=Matrix.Identity(4)
            or o.matrix_parent_inverse!=Matrix.Identity(4) or o.modifiers
            or o.data.shape_keys or len(o.data.materials)!=1 for o in targets.values()):
        raise RuntimeError('Body has artist transforms/modifiers/materials; inspect first')
    token=source_fingerprint()
    hashes={p.name:crown.sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory=OUTPUT/args.label
    candidate=json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate:
        if candidate['sourceBefore']!=list(token) or candidate['scripts']!=hashes or crown.sha(directory/'body.glb')!=candidate['candidateSha256']:
            raise RuntimeError('Reviewed candidate, source or scripts changed')
    else:
        directory.mkdir(parents=True,exist_ok=False)
    original=list(scene.objects)
    untouched=[o for o in original if o not in targets.values()]
    digest=geometry_digest(untouched)
    rigs,ids=export_snapshot(scene),exchange.runtime_id_snapshot(scene)
    transforms={o:o.matrix_world.copy() for o in original}
    assignments={o:tuple(o.data.materials) for o in original if o.type=='MESH'}
    # Reuse the validated vertex/UV/material replacement from the crown pass.
    crown.replace_geometry(targets,parts,revision=REVISION)
    bpy.context.view_layer.update()
    if (geometry_digest(untouched)!=digest or export_snapshot(scene)!=rigs
            or exchange.runtime_id_snapshot(scene)!=ids
            or any(o.matrix_world!=m for o,m in transforms.items())
            or any(tuple(o.data.materials)!=m for o,m in assignments.items())):
        raise RuntimeError('Other geometry, IDs, transforms, materials or rigs changed')
    report={'revision':REVISION,'sourceBefore':list(token),'scripts':hashes,'saved':False,
            'preservedOtherGeometry':digest,'preservedRigs':list(rigs),
            'geometry':geometry_digest(targets.values()),
            'parts':{name:{'vertices':len(o.data.vertices),'faces':len(o.data.polygons),'id':o['spaceId']} for name,o in targets.items()},
            'estimated':['plan recess depth','terrace flare','member and spandrel dimensions','fastener sizes and counts','terrace sheet joint spacing'],
            'retained':['crown','section floor counts and heights','site transforms','materials and lighting','runtime IDs']}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt body differs from the reviewed candidate')
        backup=directory/'shanghai-before-jinmao-body.blend'
        if backup.exists():
            raise RuntimeError('Backup already exists')
        shutil.copy2(SOURCE,backup)
        assert_source_unchanged(token)
        root[PROPERTY]=scene[PROPERTY]=REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report.update(saved=True,sourceAfter=list(source_fingerprint()))
    else:
        objects=[root]+[o for o in root.children if o.get('space_export')]
        expected=exchange.export_geometry_snapshot(root,objects)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.hide_set(False)
            obj.select_set(True)
        path=directory/'body.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False,export_gpu_instances=True)
        raw=path.read_bytes()
        size,kind=struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('GLB JSON chunk missing')
        exchange.ROOT_ID=crown.ROOT_ID
        report['exportGeometry']=exchange.validate_export_geometry(json.loads(raw[20:20+size]),raw,expected)
        report['candidateSha256']=crown.sha(path)
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),(json.dumps(report,indent=2)+'\n').encode())
    print('JIN_MAO_BODY_RESULT '+json.dumps({k:v for k,v in report.items() if k not in {'scripts','parts'}}),flush=True)
    if not args.apply and not args.no_render:
        jm.OUTPUT=directory
        objects=[o for o in root.children if o.type=='MESH' and o.get('space_export')]
        cams={'full':jm.camera(root,'Body full',(170,-300,270),(0,0,211),470),
              'upper':jm.camera(root,'Body upper',(115,-150,410),(0,0,304),155),
              'facade':jm.camera(root,'Body facade',(17,-94,199),(4,-26,183),24),
              'side':jm.camera(root,'Body side',(100,14,199),(25,4,183),24)}
        jm.render(root,objects,cams,'day')


if __name__=='__main__':
    main()
