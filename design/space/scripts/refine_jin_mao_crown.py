"""Incremental crown study against Permasteelisa's close and aerial photographs.

Only the three existing crown mesh data blocks change. Dimensions below are
photo estimates, not measured elevations. The body, site placement, materials
and runtime identities remain authored in the current canonical Shanghai file.
Default: isolated candidate and CPU previews. --apply requires that exact
reviewed candidate and unchanged source/scripts, then saves before any preview.
"""
import argparse
import hashlib
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
import refine_swfc_top as exchange
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-jinmao-crown-20260913'
ROOT_ID = 'root/132/0'
REVISION = 'jin-mao-crown-20260913'
PROPERTY = 'spaceJinMaoCrownRevision'
PARTS = ('glazing', 'metalwork', 'tie rods')
BASE, STEP, COURSES = 355.52, 1.14, 14
BOTTOM_HALF, TOP_HALF = 11.8, 8.2


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def lamp(metal, dark, radial, point, size=.32):
    """Round housings and recessed lenses; no invented emissive/spot lights."""
    point = Vector(point)
    stem = point + radial * .32
    dark.beam(point, stem, .09, sides=6)
    metal.beam(stem, stem + radial * .16, size, sides=10)
    dark.beam(stem + radial * .165, stem + radial * .18, size * .72, sides=10)


def crown_geometry():
    glass, metal, dark = jm.Mesh(), jm.Mesh(), jm.Mesh()
    # Closely spaced horizontal setbacks replace the four broad imported drums.
    for course in range(COURSES):
        z = BASE + course * STEP
        half = BOTTOM_HALF + (TOP_HALF - BOTTOM_HALF) * course / (COURSES - 1)
        outline = jm.octagon(half)
        glass.loft(outline, outline, z, z + STEP)
        metal.ring(jm.octagon(half + .18), z + STEP - .08, .16, .40)
        metal.loft(jm.octagon(half + .14), jm.octagon(half + .14),
                   z + STEP - .06, z + STEP, cap=True)
        for a, b in zip(outline, outline[1:] + outline[:1]):
            a, b = Vector(a), Vector(b)
            outward = Vector((b.y-a.y, a.x-b.x)).normalized()
            count = max(1, round((b-a).length/1.25))
            for k in range(count):
                p = a.lerp(b, k/count) + outward*.10
                metal.beam((*p, z), (*p, z+STEP), .12, .25)
        # Stepped silver V-shaped plates sit in front of the dark shroud grid.
        if course >= 7:
            width = .55 + (course-7)*.76
            for side in range(4):
                angle = side*math.pi/2
                radial = Vector((math.cos(angle), math.sin(angle), 0))
                tangent = Vector((-radial.y, radial.x, 0))
                pts = [radial*(half+.23) + tangent*x + Vector((0, 0, height))
                       for x,height in [(-width,z+.04),(width,z+.04),
                                        (width,z+STEP-.04),(-width,z+STEP-.04)]]
                exchange.thin_panel(metal, pts, -radial*.12)
                # Visible joints break the wide V plate into metal cladding.
                middle = radial*(half+.235)
                dark.beam(middle+Vector((0,0,z+.05)),
                          middle+Vector((0,0,z+STEP-.05)),.035,sides=4)

    # Broad trapezoidal metal sails with panel joints and actual thickness.
    # Four radial sails in each stage leave open views around the central core.
    for base, top, lower_r, upper_r in [(370.7, 383.6, 9.5, 12.6),
                                        (381.8, 394.2, 6.5, 9.5)]:
        for side in range(4):
            angle = math.pi/4 + side*math.pi/2
            radial = Vector((math.cos(angle), math.sin(angle), 0))
            tangent = Vector((-radial.y, radial.x, 0))
            inner_bottom = radial*1.25 + Vector((0,0,base))
            outer_bottom = radial*lower_r + Vector((0,0,base))
            outer_top = radial*upper_r + Vector((0,0,top))
            inner_top = radial*1.15 + Vector((0,0,top-2.4))
            for course in range(10):
                lo, hi = course/10+.0015, (course+1)/10-.0015
                pts = [inner_bottom.lerp(inner_top,lo), outer_bottom.lerp(outer_top,lo),
                       outer_bottom.lerp(outer_top,hi), inner_bottom.lerp(inner_top,hi)]
                # This winding faces -tangent; extrude toward +tangent.
                exchange.thin_panel(metal, [p-tangent*.275 for p in pts], tangent*.55)
            metal.beam(outer_bottom, outer_top, .32, sides=8)
            metal.beam(inner_bottom, inner_top, .60, sides=8)
            dark.beam(inner_top, outer_top, .40, sides=8)
            for course in range(11):
                t = course/10
                edge = outer_bottom.lerp(outer_top,t)
                lamp(metal,dark,radial,edge,.60 if course == 10 else .35)
                inner = inner_bottom.lerp(inner_top,t)
                dark.beam(inner-tangent*.32, edge-tangent*.32, .055, sides=6)
            metal.beam(outer_top,outer_top+Vector((0,0,.65)),.075,sides=8)

    # Clad, tapered mast and visible central support, rather than three wires.
    for bottom, top, low, high in [(370.0, 393.0, 1.25, .88),
                                  (393.0, jm.HEIGHT-.22, .88, .22)]:
        metal.loft(jm.octagon(low), jm.octagon(high), bottom, top, cap=True)
        for k in range(math.ceil(top-bottom)):
            z = bottom+k
            radius = low+(high-low)*(z-bottom)/(top-bottom)
            metal.ring(jm.octagon(radius+.055),z,.07,.12)
            for side in range(4):
                angle = side*math.pi/2
                radial = Vector((math.cos(angle),math.sin(angle),0))
                lamp(metal,dark,radial,radial*(radius+.07)+Vector((0,0,z)),.32)
        for side in range(8):
            a, b = jm.octagon(low+.035)[side], jm.octagon(high+.035)[side]
            dark.beam((*a,bottom),(*b,top),.06,sides=6)
    metal.beam((0,0,jm.HEIGHT-.3),(0,0,jm.HEIGHT),.07,sides=8)
    return dict(zip(PARTS,(glass,metal,dark),strict=True))


def replace_geometry(targets):
    parts = crown_geometry()
    for key, obj in targets.items():
        part = parts[key]
        old = obj.data
        data = bpy.data.meshes.new(REVISION+'/'+key)
        data.from_pydata(part.vertices,[],part.faces)
        if data.validate(verbose=True):
            raise RuntimeError('Invalid candidate geometry: '+key)
        data.update()
        if any(not math.isfinite(v) for vertex in data.vertices for v in vertex.co):
            raise RuntimeError('Nonfinite crown vertex')
        if any(poly.area < 1e-9 for poly in data.polygons):
            raise RuntimeError('Zero-area crown face')
        uv = data.uv_layers.new(name='UVMap')
        for loop in data.loops:
            uv.data[loop.index].uv = part.uv[loop.vertex_index]
        for material in old.materials:
            data.materials.append(material)
        old.use_fake_user = True
        obj.data = data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label',required=True)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--no-render',action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or len(args.label)>64 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a short lowercase filename label')
    scene = bpy.context.scene
    root = next(o for o in scene.objects if o.get('spaceId') == ROOT_ID)
    if (Path(bpy.data.filepath).resolve() != SOURCE.resolve() or scene.get('space_contract') != 2
            or scene.get('space_asset') != 'shanghai' or root.get('spaceAuthoringRevision') != jm.REVISION
            or root.get(PROPERTY) or scene.get(PROPERTY)):
        raise RuntimeError('Expected current canonical Jin Mao source before this one-time crown edit')
    targets = {key:next(o for o in root.children if o.name == 'Jin Mao crown '+key) for key in PARTS}
    if any(o.matrix_basis != Matrix.Identity(4) or o.matrix_parent_inverse != Matrix.Identity(4)
           or o.modifiers or o.data.shape_keys or len(o.data.materials)!=1 for o in targets.values()):
        raise RuntimeError('Crown has additional artist transforms, modifiers or materials; inspect first')
    token = source_fingerprint()
    hashes = {p.name:sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT/args.label
    candidate = json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate:
        if (candidate['sourceBefore'] != list(token) or candidate['scripts'] != hashes
                or sha(directory/'crown.glb') != candidate['candidateSha256']):
            raise RuntimeError('Reviewed candidate, source or scripts changed')
    else:
        directory.mkdir(parents=True,exist_ok=False)
    original = list(scene.objects)
    untouched = [o for o in original if o not in targets.values()]
    geometry, ids, rigs = geometry_digest(untouched), exchange.runtime_id_snapshot(scene), export_snapshot(scene)
    assignments = {o:tuple(o.data.materials) for o in original if o.type=='MESH'}
    transforms = {o:o.matrix_world.copy() for o in original}
    replace_geometry(targets)
    bpy.context.view_layer.update()
    if (geometry_digest(untouched)!=geometry or exchange.runtime_id_snapshot(scene)!=ids
            or export_snapshot(scene)!=rigs or any(o.matrix_world!=m for o,m in transforms.items())
            or any(tuple(o.data.materials)!=m for o,m in assignments.items())):
        raise RuntimeError('Other geometry, transforms, IDs, materials or light rigs changed')
    points = [v.co for o in targets.values() for v in o.data.vertices]
    lo,hi = min(v.z for v in points),max(v.z for v in points)
    if abs(lo-BASE)>.0001 or abs(hi-jm.HEIGHT)>.0001:
        raise RuntimeError('Crown fails body junction or 420.5 m tip check')
    report = {'revision':REVISION,'sourceBefore':list(token),'scripts':hashes,'saved':False,
              'preservedOtherGeometry':geometry,'preservedRigs':list(rigs),
              'geometry':geometry_digest(targets.values()),'zRange':[lo,hi],
              'parts':{key:{'vertices':len(o.data.vertices),'faces':len(o.data.polygons),
                            'id':o['spaceId']} for key,o in targets.items()},
              'estimated':['crown elevations and widths','metal panel joints','lamp sizes and count'],
              'retained':['body geometry','geographic transforms','material slots and shaders','runtime IDs','six facade rigs']}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt candidate differs from reviewed result')
        backup = directory/'shanghai-before-jinmao-crown.blend'
        if backup.exists():
            raise RuntimeError('Backup already exists; do not overwrite')
        shutil.copy2(SOURCE,backup)
        assert_source_unchanged(token)
        root[PROPERTY] = scene[PROPERTY] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report.update(saved=True,sourceAfter=list(source_fingerprint()))
    else:
        objects = [root]+[o for o in root.children if o.get('space_export')]
        expected = exchange.export_geometry_snapshot(root,objects)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.hide_set(False)
            obj.select_set(True)
        path = directory/'crown.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False,export_gpu_instances=True)
        raw = path.read_bytes()
        size,kind = struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('GLB JSON chunk missing')
        # The existing strict isolated-tower verifier takes its root from this
        # module constant. Retarget only this disposable background process.
        exchange.ROOT_ID = ROOT_ID
        report['exportGeometry'] = exchange.validate_export_geometry(json.loads(raw[20:20+size]),raw,expected)
        report['candidateSha256'] = sha(path)
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),
                 (json.dumps(report,indent=2)+'\n').encode())
    print('JIN_MAO_CROWN_RESULT '+json.dumps({k:v for k,v in report.items() if k!='scripts'}),flush=True)
    if not args.apply and not args.no_render:
        jm.OUTPUT = directory
        objects = [o for o in root.children if o.type=='MESH' and o.get('space_export')]
        cams = {'crown':jm.camera(root,'Crown review',(30,-160,388),(0,0,384),83),
                'oblique':jm.camera(root,'Crown reverse review',(-110,160,417),(0,0,380),86),
                'aerial':jm.camera(root,'Crown aerial review',(105,-115,442),(0,0,383),86),
                'full':jm.camera(root,'Jin Mao full review',(170,-300,270),(0,0,211),470)}
        jm.render(root,objects,cams,'day')
        jm.render(root,objects,{'crown':cams['crown']},'night',night=True)


if __name__ == '__main__':
    main()
