"""Photo-referenced 100F fixtures on the current SWFC, never a city rebuild.

Black ceiling channel, warm recessed lamps and tubular handrails reference
Nawate and Huber photographs; dimensions and six pooled lights are estimates.
Candidate first, then --apply with identical source, scripts and reviewed GLB.
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
import refine_swfc_skywalk as hall
from facade_rig import export_snapshot
from refine_alibaba_districts import geometry_digest
from refine_jin_mao import Mesh, linear
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from pack_gltf import atomic_write

top = hall.top
REVISION = 'swfc-hall-lighting-20260913'
PROPERTY = 'spaceSwfcHallLightingRevision'
OUTPUT = top.ROOT / '.tmp/png/space-swfc-lighting-20260913'
IDS = {r: REVISION+'/'+r for r in ('channel', 'lamp-trim', 'lamp-lens', 'handrails')}


def material(role, rgb, metal, roughness):
    mat = top.make_top_material('top_glass')
    mat.name = 'SWFC 100F '+role
    mat['spaceMaterialId'] = REVISION+'/'+role+'/material'
    mat['spaceSwfcTopMaterialRole'] = role
    color = tuple(linear(v) for v in rgb)+(1.,)
    mat.diffuse_color, mat.metallic, mat.roughness = color, metal, roughness
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for key, value in {'Base Color':color, 'Metallic':metal, 'Roughness':roughness,
                       'Transmission Weight':0., 'Emission Strength':0.}.items():
        next(s for s in node.inputs if s.identifier == key).default_value = value
    if role == 'lamp-lens':
        mat['spaceShaderKey'] = 'shanghai-illumination-uniform-v1'
        mat['spaceIllumination'] = 4.
    return mat


def author(root, power):
    parts = {role: Mesh() for role in IDS}
    # The channel sits just below the existing flat central ceiling strip.
    # Split around each circular aperture; no black face covers the lens.
    for i in range(20):
        u = -23.75+i*2.5
        radius = .065
        for lo, hi in ((u-1.25,u-radius),(u+radius,u+1.25)):
            top.box(parts['channel'],(lo,-.15,477.835),(hi,.15,477.85))
        for side in (-1,1):
            lo, hi = sorted((side*radius,side*.15))
            top.box(parts['channel'],(u-radius,lo,477.835),(u+radius,hi,477.85))
        # Four corner patches keep the aperture round rather than square.
        for j in range(32):
            a, b = j*math.tau/32, (j+1)*math.tau/32
            circle = lambda t,r,z: (u+math.cos(t)*r,math.sin(t)*r,z)
            square = lambda t: (u+math.cos(t)*radius/max(abs(math.cos(t)),abs(math.sin(t))),
                                math.sin(t)*radius/max(abs(math.cos(t)),abs(math.sin(t))),477.835)
            parts['channel'].face([circle(b,radius,477.835),circle(a,radius,477.835),square(a),square(b)])
            parts['lamp-trim'].face([circle(b,radius,477.833),circle(a,radius,477.833),
                                     circle(a,.049,477.84),circle(b,.049,477.84)])
            parts['lamp-lens'].face([(u,0,477.845),circle(b,.049,477.845),circle(a,.049,477.845)])
    # Window rail and small return brackets, clear of the walking surface.
    for side in (-1,1):
        for bay in range(10):
            lo = -25+bay*5+.36
            hi = lo+4.28
            parts['handrails'].beam((lo,side*3.65,475.06),(hi,side*3.65,475.06),.042,sides=16)
            for u in (lo+.3,hi-.3):
                parts['handrails'].beam((u,side*3.65,475.06),(u,side*3.86,475.06),.02,sides=12)
                top.box(parts['handrails'],(u-.035,min(side*3.85,side*3.88),475.015),
                        (u+.035,max(side*3.85,side*3.88),475.105))
    mats = {'channel':material('channel',(.035,.04,.042),.2,.45),
            'lamp-trim':material('lamp-trim',(.35,.36,.36),1.,.22),
            'lamp-lens':material('lamp-lens',(1.,.89,.7),0.,.22),
            'handrails':material('handrails',(.75,.77,.77),1.,.18)}
    for role, part in parts.items():
        obj = bpy.data.objects.new('SWFC 100F '+role,top.candidate_mesh(part,role,hall.ANGLE))
        root.users_collection[0].objects.link(obj)
        obj.parent = root
        obj.data.materials.append(mats[role])
        for key,value in {'spaceId':IDS[role],'space_export':True,'spaceVisible':True,
                          'spaceName':obj.name,'spaceCastShadow':True,'spaceReceiveShadow':True,
                          PROPERTY:REVISION,'spaceDimensionsEstimated':True}.items():
            obj[key] = value
    frame = next(o for o in root.children if o.get('spaceId')==hall.NEW_IDS['interior-frame'])
    frame.data.materials[0] = material('pier-cladding',(.78,.80,.80),1.,.2)
    collection = bpy.data.collections.new('AUTHORING | SWFC hall light proxies')
    bpy.context.scene.collection.children.link(collection)
    root['facadeLighting'] = {'width':50.,'height':3.85,'centre':[0.,475.5,0.],'washTop':0.,
                             'interiorBounds':{'min':[-5.5,474.,-25.5],'max':[5.5,477.85,25.5]}}
    root['spaceFacadeRig'] = REVISION
    for slot in range(6):
        u = -20.833333+slot*8.333333
        data = bpy.data.lights.new('SWFC hall pooled lamp '+str(slot+1),'SPOT')
        obj = bpy.data.objects.new(data.name,data)
        collection.objects.link(obj)
        obj.parent = root
        obj.location = top.xyz((u,0,477.75),hall.ANGLE)
        data.color = (1.,.78,.50)
        data.energy = power*.05
        data.spot_size, data.spot_blend = 2.1,.85
        data.use_custom_distance, data.cutoff_distance = True,12.
        data.shadow_soft_size = .08
        obj['spaceFacadeSlot'], obj['spaceCandela'] = slot,float(power)
        obj['spaceLightingEstimate'] = 'Six pooled proxies for photographed downlights; not measured photometry'
    bpy.context.view_layer.update()
    return {'downlights':20,'handrailRuns':20,'railBrackets':40,'runtimePool':6,
            'estimatedLampPitchMetres':2.5,'estimatedRailHeightMetres':1.06,
            'estimatedProxyCandela':power,'pierMetalness':1.,'pierRoughness':.2}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label',required=True)
    parser.add_argument('--power',type=float,default=120.)
    parser.add_argument('--apply',action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.label):
        parser.error('Use a lowercase filename label')
    if not math.isfinite(args.power) or not 0<args.power<=1000:
        parser.error('Proxy candela must be finite and within (0,1000]')
    scene = bpy.context.scene
    if Path(bpy.data.filepath).resolve()!=SOURCE.resolve() or scene.get(hall.PROPERTY)!=hall.REVISION or scene.get(PROPERTY):
        raise RuntimeError('Expected the current canonical skywalk without this one-time lighting revision')
    token = source_fingerprint()
    hashes = {str(p.relative_to(top.ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory = OUTPUT/args.label
    if directory.exists() and not args.apply:
        raise RuntimeError('Use a new candidate label')
    candidate = json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate and (candidate['sourceBefore']!=list(token) or candidate['scriptHashes']!=hashes or
            hashlib.sha256((directory/'hall.glb').read_bytes()).hexdigest()!=candidate['glbSha256']):
        raise RuntimeError('Source, scripts or reviewed GLB changed')
    original = list(scene.objects)
    root = next(o for o in original if o.get('spaceId')==top.ROOT_ID)
    if root.get('spaceFacadeRig'):
        raise RuntimeError('SWFC already has an authored rig')
    digest, rigs, ids = geometry_digest(original),export_snapshot(scene),top.runtime_id_snapshot(scene)
    # Material assignment changes on only one original mesh; all other material
    # links and every original mesh/transform must remain identical.
    assignments = {o:tuple(o.data.materials) for o in original if o.type=='MESH' and o.get('spaceId')!=hall.NEW_IDS['interior-frame']}
    detail = author(root,args.power)
    after = export_snapshot(scene)
    if geometry_digest(original)!=digest or any(after[k]!=v for k,v in rigs.items()) or len(after)!=len(rigs)+1:
        raise RuntimeError('Original geometry or other building lights changed')
    if any(tuple(o.data.materials)!=m for o,m in assignments.items()) or top.runtime_id_snapshot(scene)!=ids+Counter(IDS.values()):
        raise RuntimeError('Unrelated materials or runtime identities changed')
    checks = hall.validate(root)
    report = {'revision':REVISION,'saved':False,'sourceBefore':list(token),'scriptHashes':hashes,
              'detail':detail,'checks':checks,'preservedGeometry':digest,'preservedRigs':list(rigs),
              'rig':after[top.ROOT_ID]}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt candidate differs from reviewed result')
        backup = directory/'shanghai-before-hall-lighting.blend'
        if backup.exists():
            raise RuntimeError('Refusing to overwrite backup')
        shutil.copy2(SOURCE,backup)
        assert_source_unchanged(token)
        scene[PROPERTY] = root[PROPERTY] = REVISION
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        report.update(saved=True,sourceAfter=list(source_fingerprint()))
    else:
        directory.mkdir(parents=True)
        root['facadeLighting'] = after[top.ROOT_ID]
        bpy.ops.object.select_all(action='DESELECT')
        targets = [root]+[o for o in root.children_recursive if o.get('space_export')]
        expected = top.export_geometry_snapshot(root,targets)
        for obj in targets:
            obj.hide_set(False);obj.select_set(True)
        path = directory/'hall.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_extras=True,export_attributes=True,export_yup=True,export_animations=False,
            export_cameras=False,export_lights=False,export_gpu_instances=True)
        raw = path.read_bytes()
        size,kind = struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('Missing GLB JSON')
        report['exportGeometry'] = top.validate_export_geometry(json.loads(raw[20:20+size]),raw,expected)
        report.update(glbBytes=len(raw),glbSha256=hashlib.sha256(raw).hexdigest())
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),(json.dumps(report,indent=2)+'\n').encode())
    print('HALL_LIGHTING_RESULT '+json.dumps({k:report[k] for k in ('saved','detail','checks')}),flush=True)


if __name__ == '__main__':
    main()
