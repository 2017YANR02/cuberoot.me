"""Incremental Peace riverfront central arch, temporary candidate exports only.

Run --audit-only first, then --audit <that report> in a fresh source session.
No apply/save/render path exists. All output stays under .tmp/png. The 2025
photograph proves the three arches, recessed central entrance and shallow crest;
every metric dimension and the simplified ornament below remains an estimate.
"""
import argparse
from array import array
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).parent))
import facade_rig
import refine_bund_frontages as frontages
import refine_bund_galleries as galleries
import refine_bund_hero_details as hero
import refine_bund_windows as windows
import refine_peace_crown as source_guard
import refine_shanghai_landmarks as previous
from refine_bund_entrances import archive_mesh, arc, box, extrude
from refine_jin_mao import Mesh

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'design/space/scenes/shanghai.blend'
OUTPUT = ROOT / '.tmp/png/space-peace-central-arch-20260910'
ROOT_ID = hero.IDS['20']
REVISION = 'peace-central-arch-candidate-20260910'
PROPERTY = 'spacePeaceCentralArchRevision'
REFERENCE = 'https://commons.wikimedia.org/wiki/File:Peace_Hotel_20250503.jpg'
# Facade coordinates in geographic Blender metres: u = -1367 - Y, v = X + 1328.
# These reproduce the existing authoring frame, not a surveyed site datum.
WORLD_FROM_FACADE = Matrix(((0, 1, 0, -1328), (-1, 0, 0, -1367),
                            (0, 0, 1, 0), (0, 0, 0, 1)))
BOTTOM, SPRING, RADIUS, FRONT = .12, 5.8, 2.4, 16.5
TOP = SPRING + RADIUS
GLASS_FRONT = 15.60
# The existing 8.83 m band is 0.18 m high: its lower face is at 8.74 m.
PATCH = ((-3.0, 14.80, -.02), (3.0, 17.16, 8.73))
FIXTURES = ((-5.61, 15.00, -.02), (5.61, 19.50, 6.70))
# Candidate02 GLB identifies two remnants of the old horizontal trim. These
# boxes follow that mesh, not surveyed building dimensions; only /1 may use them.
TRIM_RESIDUE_BOXES = (
    ((-4.792, 15.879, 4.866), (-2.998, 16.584, 5.534)),
    ((2.998, 16.037, 4.866), (4.792, 16.741, 5.534)),
)
SIGN_PREFIX = ROOT_ID + '/6/'
REUSE = {'glass': SIGN_PREFIX+'2', 'handles': SIGN_PREFIX+'3'}
PROTECTED_PROBES = (
    ('left-arch', -7.4, 7), ('right-arch', 7.4, 7),
    ('left-frieze', -6, 8.48), ('right-frieze', 6, 8.48),
    ('upper-cornice', 0, 8.90), ('blade', 16.2, 12),
    ('left-inner-jamb', -4.95, 5.2), ('right-inner-jamb', 4.95, 5.2),
    ('left-sill', -7.4, .64), ('right-sill', 7.4, .64),
    ('left-arch-top', -7.4, 8.26), ('right-arch-top', 7.4, 8.26),
)


def properties(value):
    def plain(item):
        if hasattr(item, 'to_dict'): return item.to_dict()
        if hasattr(item, 'to_list'): return item.to_list()
        raise TypeError(type(item).__name__)
    return json.loads(json.dumps(dict(value), default=plain, sort_keys=True))


def digest_mesh(mesh):
    """Hash geometry, UVs and stored attributes, including custom export data."""
    digest = hashlib.sha256()
    for values, field, count, kind in ((mesh.vertices, 'co', 3, 'f'),
            (mesh.loops, 'vertex_index', 1, 'i'), (mesh.polygons, 'loop_total', 1, 'i'),
            (mesh.polygons, 'material_index', 1, 'i'), (mesh.polygons, 'use_smooth', 1, 'b')):
        buffer = ([False] * len(values) if kind == 'b'
                  else array(kind, [0]) * (len(values)*count))
        values.foreach_get(field, buffer)
        digest.update(array(kind, buffer).tobytes())
    for layer in mesh.uv_layers:
        buffer = array('f', [0]) * (len(layer.data)*2)
        layer.data.foreach_get('uv', buffer)
        digest.update(layer.name.encode()); digest.update(buffer.tobytes())
    for attribute in mesh.attributes:
        if attribute.name in {'position', '.corner_vert', '.corner_edge', '.edge_verts'}:
            continue  # Positions and face loops above already identify the surface.
        digest.update(str((attribute.name, attribute.domain, attribute.data_type)).encode())
        if not len(attribute.data): continue
        sample = attribute.data[0]
        field = next((name for name in ('vector', 'color', 'value') if hasattr(sample, name)), None)
        if field is None: raise RuntimeError('Unsupported stored mesh attribute: '+attribute.name)
        value = getattr(sample, field)
        size = len(value) if hasattr(value, '__len__') and not isinstance(value, str) else 1
        scalar = value[0] if hasattr(value, '__len__') and not isinstance(value, str) else value
        if isinstance(scalar, str):
            digest.update(json.dumps([getattr(item, field) for item in attribute.data]).encode())
        else:
            kind = 'b' if isinstance(scalar, bool) else 'i' if isinstance(scalar, int) else 'f'
            # Python sequences support Blender's short-int and boolean layers
            # without assuming their RNA buffer storage width.
            buffer = [False if kind == 'b' else 0] * (len(attribute.data)*size)
            attribute.data.foreach_get(field, buffer)
            digest.update(array(kind, buffer).tobytes())
    digest.update(json.dumps(properties(mesh), sort_keys=True).encode())
    return digest.hexdigest()


def facade_matrix(obj):
    return WORLD_FROM_FACADE.inverted() @ obj.matrix_world


def bounds(points):
    return [[min(p[a] for p in points), max(p[a] for p in points)] for a in range(3)] if points else None


def intersects(points, volume, epsilon=1e-6):
    lo, hi = volume
    return bool(points) and all(max(p[a] for p in points) > lo[a]+epsilon and
                               min(p[a] for p in points) < hi[a]-epsilon for a in range(3))


def volumes_for(obj):
    sid = str(obj.get('spaceId', ''))
    if sid.startswith(SIGN_PREFIX): return (FIXTURES,)
    return (PATCH,) + (TRIM_RESIDUE_BOXES if sid == ROOT_ID+'/1' else ())


def face_record(mesh, face):
    # Cyclic vertex order is deliberately normalized; winding is retained.
    corners = []
    for index in face.loop_indices:
        loop = mesh.loops[index]
        corners.append((tuple(mesh.vertices[loop.vertex_index].co),
                        tuple(tuple(layer.data[index].uv) for layer in mesh.uv_layers),
                        tuple(round(value, 5) for value in mesh.corner_normals[index].vector)))
    if corners:
        start = min(range(len(corners)), key=lambda i: corners[i])
        corners = corners[start:] + corners[:start]
    return str((face.material_index, face.use_smooth, corners))


def exterior_faces(obj, volumes):
    matrix = facade_matrix(obj)
    return Counter(face_record(obj.data, face) for face in obj.data.polygons
                   if not any(intersects([matrix @ obj.data.vertices[i].co for i in face.vertices], volume)
                              for volume in volumes))


def inventory(root):
    records = []
    for obj in previous.meshes(root):
        matrix = facade_matrix(obj)
        points = [matrix @ vertex.co for vertex in obj.data.vertices]
        volumes = volumes_for(obj)
        hits = [face for face in obj.data.polygons
                if any(intersects([points[i] for i in face.vertices], volume) for volume in volumes)]
        records.append({'spaceId': obj['spaceId'], 'name': obj.name,
            'matrix_world': [list(row) for row in obj.matrix_world],
            'matrix_basis': [list(row) for row in obj.matrix_basis],
            'properties': properties(obj), 'meshDigest': digest_mesh(obj.data),
            'boundsFacade': bounds(points), 'vertices': len(points), 'faces': len(obj.data.polygons),
            'intersectingFaces': len(hits), 'cutVolumeFacade': volumes[0], 'cutVolumesFacade': volumes,
            'materials': [{'name': mat.name, 'properties': properties(mat)} for mat in obj.data.materials],
            'uvLayers': [layer.name for layer in obj.data.uv_layers],
            'attributes': [(att.name, att.domain, att.data_type) for att in obj.data.attributes]})
    return {'rootId': ROOT_ID, 'rootProperties': properties(root),
            'rootMatrix': [list(row) for row in root.matrix_world], 'meshes': records}


def bounded_cut(obj, volumes, archive):
    """Bisect only faces meeting the allowed boxes, never the entire facade.

    The existing galleries.cut_volume bisects the entire mesh. This local form
    retains its BMesh interpolation of UV/custom layers while preserving original
    non-intersecting face/UV records and corner normals quantized to 1e-5.
    All mutations use a new mesh copy.
    """
    protected = exterior_faces(obj, volumes)
    matrix = facade_matrix(obj)
    inverse = matrix.inverted()
    archive_mesh(obj, archive)
    obj.data = obj.data.copy()
    bm = bmesh.new(); bm.from_mesh(obj.data)
    before_faces = len(bm.faces)
    cuts = []
    for volume in volumes:
        lo, hi = volume
        initial = {face for face in bm.faces if intersects([matrix @ v.co for v in face.verts], volume)}
        boundary = [edge for edge in bm.edges if any(f in initial for f in edge.link_faces)
                    and any(f not in initial for f in edge.link_faces)]
        # A plane must not insert a vertex into a protected neighbouring face.
        if boundary: bmesh.ops.split_edges(bm, edges=boundary)
        for axis in range(3):
            for value in (lo[axis], hi[axis]):
                candidates = [face for face in bm.faces if intersects([matrix @ v.co for v in face.verts], volume)]
                edges = {edge for face in candidates for edge in face.edges}
                vertices = {vertex for face in candidates for vertex in face.verts}
                point, normal = Vector(), Vector()
                point[axis], normal[axis] = value, 1
                bmesh.ops.bisect_plane(bm, geom=list(vertices)+list(edges)+candidates, dist=1e-6,
                    plane_co=inverse @ point, plane_no=matrix.to_3x3().transposed() @ normal)
        selected = [face for face in bm.faces if all(all(lo[a]-2e-5 <= (matrix @ vertex.co)[a] <= hi[a]+2e-5
                        for a in range(3)) for vertex in face.verts)]
        cuts.append({'volumeFacade': volume, 'removedAfterBisect': len(selected)})
        bmesh.ops.delete(bm, geom=selected, context='FACES_ONLY')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    remaining = exterior_faces(obj, volumes)
    missing = protected - remaining
    if missing:
        raise RuntimeError(f'Cut changed {sum(missing.values())} protected face/UV/normal records: '+obj['spaceId'])
    return {'spaceId': obj['spaceId'], 'volumeFacade': volumes[0], 'volumesFacade': volumes,
            'cutsByVolume': cuts, 'facesBefore': before_faces,
            'removedAfterBisect': sum(cut['removedAfterBisect'] for cut in cuts), 'facesAfter': len(obj.data.polygons),
            'protectedFaces': sum(protected.values()), 'protectedFacesAndUVUnchanged': True,
            'protectedCornerNormalsUnchangedAtFiveDecimals': True}


def closed_extrude(part, profile, back, front):
    # The shared helper's two caps face correctly, but its side faces wind
    # inward. Correct only this candidate, retaining the canonical profile math.
    start = len(part.faces)
    extrude(part, profile, back, front)
    for i in range(start+2, len(part.faces)):
        part.faces[i] = tuple(reversed(part.faces[i]))


def closed_arc(part, *args, **kwargs):
    start = len(part.faces)
    arc(part, *args, **kwargs)
    for i in range(start, len(part.faces)):
        if (i-start) % 6 >= 2: part.faces[i] = tuple(reversed(part.faces[i]))


def build_parts():
    parts = frontages.parts()
    parts.update(ornament=Mesh(), handles=Mesh())
    template = frontages.parts()
    windows.arch_window(template, 0, BOTTOM, RADIUS*2, TOP-BOTTOM, 0)
    # Reuse the existing arch profile and curved masonry spandrels. The central
    # portal has broader stone mouldings and deeper glass than the side windows.
    parts['glass'] = template['glass']
    for i in range(2, len(parts['glass'].faces)):
        parts['glass'].faces[i] = tuple(reversed(parts['glass'].faces[i]))
    for i, (u, v, z) in enumerate(parts['glass'].vertices):
        parts['glass'].vertices[i] = (u, v + GLASS_FRONT + .60, z)
    outside = RADIUS+.26
    spandrel = frontages.parts()
    windows.arch_window(spandrel, 0, BOTTOM, outside*2, SPRING+outside-BOTTOM, 0)
    for index, face in enumerate(spandrel['stone'].faces):
        if index % 6 >= 2: face = tuple(reversed(face))
        parts['stone'].face([(spandrel['stone'].vertices[i][0],
            spandrel['stone'].vertices[i][1]+FRONT, spandrel['stone'].vertices[i][2]) for i in face])
    galleries.wall(parts, PATCH[0][0], PATCH[1][0], PATCH[0][2], PATCH[1][2], FRONT,
                   [(-outside, outside, PATCH[0][2], SPRING+outside)])
    for side in (-1, 1):
        box(parts['trim'], (side*(RADIUS+.13), 16.38, (BOTTOM+SPRING)/2),
                          (.26, .46, SPRING-BOTTOM))
        # The inner return reaches the recessed glass instead of leaving a slit.
        box(parts['stone'], (side*(RADIUS+.13), 15.775, (BOTTOM+SPRING)/2),
                           (.26, .75, SPRING-BOTTOM))
    # Match the reused 32-segment arch profile exactly; differing segment grids
    # leave small gaps/overlaps between the stone and moulding boundaries.
    closed_arc(parts['trim'], 0, SPRING, RADIUS, outside, 16.15, 16.61, steps=32)
    closed_arc(parts['stone'], 0, SPRING, RADIUS, outside, 15.40, 16.15, steps=32)
    box(parts['trim'], (0, 16.05, .05), (RADIUS*2+.52, 1.15, .14))
    # A closed, recessed glass portal, not an invented walkable lobby. Sparse
    # rails are estimates; the source does not resolve its full hardware layout.
    for u in (-2.34, -1.18, 0, 1.18, 2.34):
        top = TOP-.06 if u == 0 else SPRING
        box(parts['metal'], (u, GLASS_FRONT+.035, (BOTTOM+top)/2), (.055, .07, top-BOTTOM))
    for z in (3.28, SPRING):
        box(parts['metal'], (0, GLASS_FRONT+.035, z), (4.68, .07, .07))
    closed_arc(parts['metal'], 0, SPRING, 2.32, 2.37, GLASS_FRONT, GLASS_FRONT+.07, steps=32)
    hero.rectangular_frame(parts['metal'], 0, GLASS_FRONT+.04, 1.70, 2.36, 3.16, .055, .075)
    for u in (-.15, .15):
        box(parts['handles'], (u, GLASS_FRONT+.13, 1.72), (.04, .08, .62))
    # The visible shield silhouette and paired shallow foliage are confirmed;
    # leaf count, heraldry, exact contours and all relief depths are unknown.
    shield = [(0, 8.26), (.22, 8.40), (.26, 8.67), (.18, 8.72),
              (-.18, 8.72), (-.26, 8.67), (-.22, 8.40)]
    closed_extrude(parts['ornament'], shield, 16.49, 16.67)
    for side in (-1, 1):
        for i in range(4):
            u, z = side*(.50+i*.30), 8.35 + .055*i
            leaf = [(u-side*.15,z-.025),(u+side*.08,z-.06),
                    (u+side*.25,z+.22),(u+side*.03,z+.15)]
            if side < 0: leaf.reverse()
            closed_extrude(parts['ornament'], leaf, 16.49, 16.58)
    return parts


def install_part(obj, part, material):
    """New geometry uses the retained object transform and metre-based UVs."""
    data = bpy.data.meshes.new(obj.name+' '+REVISION)
    inverse = obj.matrix_world.inverted() @ WORLD_FROM_FACADE
    # The reused spandrel helper repeats the apex coordinate in two wedges.
    # Collapse only consecutive duplicate corners, never weld separate solids.
    faces = []
    for face in part.faces:
        indices = []
        for index in face:
            if not indices or (Vector(part.vertices[index])-Vector(part.vertices[indices[-1]])).length > 1e-9:
                indices.append(index)
        if len(indices) > 1 and (Vector(part.vertices[indices[0]])-Vector(part.vertices[indices[-1]])).length <= 1e-9:
            indices.pop()
        if len(indices) >= 3: faces.append(indices)
    data.from_pydata([inverse @ Vector(point) for point in part.vertices], [], faces)
    data.materials.append(material); data.update()
    obj.data = data
    galleries.uv_metric(obj)
    if 'bund-stone' in str(material.get('spaceShaderKey', '')):
        for uv in data.uv_layers.active.data: uv.uv.x *= .5
    # Report degenerate source-helper faces instead of silently exporting them.
    bm = bmesh.new(); bm.from_mesh(data)
    degenerate = [face for face in bm.faces if face.calc_area() < 1e-10]
    if degenerate: bmesh.ops.delete(bm, geom=degenerate, context='FACES_ONLY')
    loose = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(data); bm.free(); data.update()
    return {'vertices': len(data.vertices), 'faces': len(data.polygons),
            'removedShortHelperFaces': len(part.faces)-len(faces),
            'removedZeroAreaHelperFaces': len(degenerate)}


def audit_geometry_digest(mesh):
    """Compatible with the independent source-audit.py before this candidate."""
    digest = hashlib.sha256()
    for vertex in mesh.vertices: digest.update(struct.pack('<3d', *vertex.co))
    for face in mesh.polygons: digest.update(struct.pack('<'+'I'*len(face.vertices), *face.vertices))
    return digest.hexdigest()


def check_source(root, audit):
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != SOURCE or scene.get('space_contract') != 2
            or scene.get('space_asset') != 'shanghai' or scene.unit_settings.scale_length != 1):
        raise RuntimeError('Open the current canonical contract-v2 Shanghai source in metres')
    if root.get(PROPERTY) or root.get('spacePeaceRiverfrontRevision') != 'peace-riverfront-20260909':
        raise RuntimeError('Expected the prior Peace riverfront; never overwrite later artist edits')
    if audit['source_stat'] != list(source_guard.source_fingerprint()) or not audit['source_stat_unchanged']:
        raise RuntimeError('Source changed since the read-only audit; inspect a fresh audit first')
    old = audit.get('audit')
    root_props = old['rootProperties'] if old else audit['root']['properties']
    root_matrix = old['rootMatrix'] if old else audit['root']['matrix_world']
    if properties(root) != root_props or [list(row) for row in root.matrix_world] != root_matrix:
        raise RuntimeError('Peace root metadata or transform differs from the audit')
    records = {record['spaceId']: record for record in (old['meshes'] if old else audit['meshes'])}
    objects = {obj['spaceId']: obj for obj in previous.meshes(root)}
    if len(objects) != len(previous.meshes(root)) or set(objects) != set(records):
        raise RuntimeError('Peace mesh identities changed or duplicate an existing identity')
    for sid, obj in objects.items():
        record = records[sid]
        digest = digest_mesh(obj.data) if old else audit_geometry_digest(obj.data)
        expected = record['meshDigest'] if old else record['sha256_geometry']
        if (obj.modifiers or obj.data.shape_keys or digest != expected or
                properties(obj) != record['properties'] or
                [list(row) for row in obj.matrix_world] != record['matrix_world']):
            raise RuntimeError('Audited source mesh/metadata/transform drifted: '+sid)
        materials = [{'name': mat.name, 'properties': properties(mat)} for mat in obj.data.materials]
        if materials != record['materials']:
            raise RuntimeError('Audited material contract drifted: '+sid)
    if any(sid not in objects for sid in REUSE.values()):
        raise RuntimeError('Expected the isolated old door glass and handle identities')
    return objects


def appearance_snapshot():
    def socket_value(socket):
        value = socket.default_value
        if isinstance(value, (str, int, float, bool)) or value is None: return value
        if hasattr(value, '__iter__'): return tuple(value)
        return getattr(value, 'name_full', str(value))
    materials = {}
    for mat in bpy.data.materials:
        nodes, links = [], []
        if mat.node_tree:
            nodes = [(node.name, node.type, properties(node), getattr(getattr(node, 'image', None), 'name', None),
                      [(socket.identifier, socket_value(socket)) for socket in node.inputs
                       if hasattr(socket, 'default_value')]) for node in mat.node_tree.nodes]
            links = [(link.from_node.name, link.from_socket.identifier, link.to_node.name,
                      link.to_socket.identifier) for link in mat.node_tree.links]
        materials[mat.name] = (properties(mat), tuple(mat.diffuse_color), mat.metallic, mat.roughness, nodes, links)
    images = {image.name: (image.filepath, image.colorspace_settings.name,
              hashlib.sha256(bytes(image.packed_file.data)).hexdigest() if image.packed_file else None)
              for image in bpy.data.images}
    return materials, images


def ray_snapshot(root, probes):
    vertices, faces, owners = [], [], []
    for obj in previous.meshes(root):
        matrix = facade_matrix(obj)
        offset = len(vertices)
        vertices.extend(matrix @ vertex.co for vertex in obj.data.vertices)
        for face in obj.data.polygons:
            faces.append(tuple(offset+i for i in face.vertices)); owners.append(obj['spaceId'])
    tree = BVHTree.FromPolygons(vertices, faces, all_triangles=False)
    result = []
    for name, u, z in probes:
        position, normal, index, distance = tree.ray_cast(Vector((u, 22, z)), Vector((0, -1, 0)), 30)
        result.append({'probe': name, 'u': u, 'z': z,
            'position': list(position) if position is not None else None,
            'normal': list(normal) if normal is not None else None,
            'spaceId': owners[index] if index is not None else None})
    return result


def geometry_check(root, before):
    # Independent surface checks: the former canopy and blocked fanlight must
    # now yield the recessed entrance. Sparse off-frame samples avoid mullions.
    probes = [(f'clear-{u}-{z}', u, z) for u in (-.65, .65) for z in (2.3, 4.92, 5.60, 6.70, 7.65)]
    hits = ray_snapshot(root, probes)
    for hit in hits:
        if (hit['position'] is None or abs(hit['position'][1]-GLASS_FRONT) > .025
                or hit['normal'][1] < .99 or hit['spaceId'] != REUSE['glass']):
            raise RuntimeError('Central arch has an obstruction or wrong-facing glazing: '+json.dumps(hit))
    # Independent candidate02 measurements of the retained wall behind the
    # remnants. Do not derive the expected first hit from the clipping boxes.
    wall_v = {-4.5: 16.219111416, -3.4: 16.241315453,
               3.4: 16.378801734, 4.5: 16.401005771}
    clearance = ray_snapshot(root, [(f'trim-clear-{u}-{z}', u, z)
                                   for u in wall_v for z in (4.95, 5.25)])
    for hit in clearance:
        if (hit['position'] is None or hit['spaceId'] != ROOT_ID+'/0'
                or abs(hit['position'][1]-wall_v[hit['u']]) > .025 or hit['normal'][1] < .99):
            raise RuntimeError('Old horizontal trim remains or its backing wall changed: '+json.dumps(hit))
    after = ray_snapshot(root, PROTECTED_PROBES)
    if len(before) != len(PROTECTED_PROBES) or len(after) != len(PROTECTED_PROBES):
        raise RuntimeError('Protected facade probe set is incomplete')
    for old, new in zip(before, after):
        if old['position'] is None or old != new:
            raise RuntimeError('Protected facade first surface changed: '+json.dumps({'before': old, 'after': new}))
    return {'centralRecessRays': hits, 'residueClearanceRays': clearance, 'protectedFacadeRays': after,
            'topologyScope': 'Existing meshes retain outside face/UV records and corner normals quantized to 1e-5. New parts use separate unwelded closed primitives; no watertight whole-building claim.'}


def author(root, audit):
    objects = check_source(root, audit)
    scene = bpy.context.scene
    parts = build_parts()
    before = inventory(root)
    targets = {record['spaceId']: objects[record['spaceId']] for record in before['meshes'] if record['intersectingFaces']}
    if not set(REUSE.values()).issubset(targets): raise RuntimeError('Old entrance scope is incomplete')
    for sid in REUSE.values():
        if exterior_faces(objects[sid], (FIXTURES,)):
            raise RuntimeError('Door glass/handle mesh contains protected geometry; do not repurpose '+sid)
    before_objects = {obj: (obj.parent, obj.matrix_world.copy(), obj.data, properties(obj)) for obj in scene.objects}
    # Copies, including shared users in other buildings, must remain byte-identical.
    old_meshes = {obj.data: digest_mesh(obj.data) for obj in targets.values()}
    old_ids = Counter(obj.get('spaceId') for obj in scene.objects if obj.get('space_export'))
    if any(sid is not None and (not sid or count != 1) for sid, count in old_ids.items()):
        raise RuntimeError('Existing named runtime identity is empty or duplicated')
    appearance = appearance_snapshot()
    rigs = facade_rig.export_snapshot(scene)
    old_scene = properties(scene)
    protected = ray_snapshot(root, PROTECTED_PROBES)
    archive = bpy.data.collections.new('ARCHIVE before '+REVISION+' (not exported)')
    scene.collection.children.link(archive)
    archive.hide_render = archive.hide_viewport = True
    cuts = [bounded_cut(obj, volumes_for(obj), archive) for obj in targets.values()]
    material_sources = {'stone': objects[ROOT_ID+'/0'].data.materials[0],
                        'trim': objects[ROOT_ID+'/1'].data.materials[0],
                        'metal': objects['peace-riverfront-20260909/'+ROOT_ID+'/metal'].data.materials[0]}
    material_sources['ornament'] = material_sources['trim']
    installed, additions = {}, []
    for role, part in parts.items():
        if role in REUSE:
            obj = objects[REUSE[role]]
            if obj.data.polygons: raise RuntimeError('Old fixture was not completely removed: '+obj['spaceId'])
            material = obj.data.materials[0]
        else:
            material = material_sources[role]
            obj = bpy.data.objects.new('Peace central arch '+role, bpy.data.meshes.new('Peace arch staging '+role))
            root.users_collection[0].objects.link(obj); obj.parent = root
            obj['spaceId'] = REVISION+'/'+ROOT_ID+'/'+role
            obj['space_export'] = True
            for key in ('spaceVisible', 'spaceCastShadow', 'spaceReceiveShadow'): obj[key] = True
            additions.append(obj)
        installed[role] = {'spaceId': obj['spaceId'], **install_part(obj, part, material)}
    bpy.context.view_layer.update()
    for obj, (parent, matrix, data, metadata) in before_objects.items():
        if obj.parent != parent or obj.matrix_world != matrix or properties(obj) != metadata:
            raise RuntimeError('Original object transform/metadata changed: '+obj.name)
        if obj not in targets.values() and obj.data != data:
            raise RuntimeError('Unrelated object data pointer changed: '+obj.name)
    if any(digest_mesh(data) != digest for data, digest in old_meshes.items()):
        raise RuntimeError('An original mesh datablock changed, risking archived/shared users')
    expected_ids = old_ids + Counter(obj['spaceId'] for obj in additions)
    if expected_ids != Counter(obj.get('spaceId') for obj in scene.objects if obj.get('space_export')):
        raise RuntimeError('Export identity counts changed beyond the four new arch detail meshes')
    if (len(archive.objects) != len(targets) or any(obj.get('spaceId') or obj.get('space_export') for obj in archive.objects)):
        raise RuntimeError('Archive identity/export boundary failed')
    if properties(scene) != old_scene or appearance_snapshot() != appearance or facade_rig.export_snapshot(scene) != rigs:
        raise RuntimeError('Scene metadata, material, packed texture, or facade lighting changed')
    geometry = geometry_check(root, protected)
    # Change candidate statistics only after proving every original property is
    # intact. verify.ts counts each provenance-bearing bund-stone material use.
    old_stone_count = root['spaceFacadeDetail']['stoneMeshes']
    stone_count = sum(1 for obj in previous.meshes(root) for mat in obj.data.materials
        if mat and mat.get('spaceSurfaceProvenance') and 'bund-stone' in str(mat.get('spaceShaderKey', '')))
    root['spaceFacadeDetail']['stoneMeshes'] = stone_count
    detail = {'revision': REVISION, 'candidateOnly': True, 'reference': REFERENCE,
        'confirmed': ['Three tall riverfront arches', 'Recessed central portal', 'Stone arch surround and crest with shallow paired relief'],
        'estimated': {'allMetricDimensions': True, 'openingWidth': RADIUS*2, 'bottom': BOTTOM,
            'spring': SPRING, 'top': TOP, 'front': FRONT, 'glassFront': GLASS_FRONT,
            'stoneSurroundWidth': .26, 'crestAndFoliageShapes': 'Simplified silhouettes; no reconstructed heraldry'},
        'coordinates': 'u=-1367-worldY; v=worldX+1328; z=worldZ; +v outward',
        'reusedRuntimeIds': REUSE, 'parts': installed, 'cuts': cuts,
        'stoneSurfaceCount': {'before': old_stone_count, 'after': stone_count},
        'preservation': {'originalObjects': len(before_objects), 'originalMeshCopies': len(old_meshes),
            'originalMaterialAndImageState': True, 'rigsUnchanged': len(rigs),
            'originalRuntimeIdCountsIncludingAnonymousInstances': True,
            'originalObjectsParentWorldTransformAndProperties': True,
            'nonTargetObjectPropertiesAfterCandidateMetadata': True,
            'protectedFacesAndUV': True, 'protectedCornerNormalsAtFiveDecimals': True,
            'unrelatedObjectDataPointers': True},
        'remaining': ['Survey dimensions', 'Exact crest contours and heraldry', 'Inner door hardware and glazing optics',
                      'Day/night/oblique webpage comparison against the dated original'], **geometry}
    root[PROPERTY] = REVISION
    root['spacePeaceCentralArchCandidate'] = json.dumps(detail, separators=(',', ':'))
    for obj, (_, _, _, metadata) in before_objects.items():
        if obj != root and properties(obj) != metadata:
            raise RuntimeError('Non-target object metadata changed after candidate statistics: '+obj.name)
    return detail


def export_candidate(root, directory):
    # Reuse the normal exporter flags, but limit selection to this building and
    # omit all lights/archives. Parent can swap this root in the temporary page.
    targets = [root]+[obj for obj in root.children_recursive if obj.get('space_export')]
    selected = list(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    hidden = {obj: obj.hide_get() for obj in targets}
    original_lighting = properties(root).get('facadeLighting')
    target = directory/'peace-candidate.glb'
    try:
        root['facadeLighting'] = facade_rig.export_snapshot(bpy.context.scene)[ROOT_ID]
        bpy.ops.object.select_all(action='DESELECT')
        for obj in targets: obj.hide_set(False); obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
            export_extras=True, export_attributes=True, export_yup=True, export_animations=False,
            export_cameras=False, export_lights=False, export_gpu_instances=True, export_image_format='AUTO')
    finally:
        root['facadeLighting'] = original_lighting
        bpy.ops.object.select_all(action='DESELECT')
        for obj in selected: obj.select_set(True)
        bpy.context.view_layer.objects.active = active
        for obj, value in hidden.items(): obj.hide_set(value)
    raw = target.read_bytes()
    if len(raw) < 28 or struct.unpack_from('<III', raw) != (0x46546C67, 2, len(raw)):
        raise RuntimeError('Exporter returned an invalid GLB')
    length, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4E4F534A: raise RuntimeError('Missing GLB JSON chunk')
    doc = json.loads(raw[20:20+length]); nodes = doc.get('nodes', [])
    ids = Counter(node.get('extras', {}).get('spaceId') for node in nodes)
    if ids != Counter(obj.get('spaceId') for obj in targets):
        raise RuntimeError('Candidate GLB lost an identity or leaked a different scene object')
    if any(node.get('extras', {}).get('archivedSpaceId') for node in nodes):
        raise RuntimeError('Candidate GLB contains archives')
    return {'path': str(target), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'nodes': len(nodes), 'meshes': len(doc.get('meshes', [])),
            'scope': 'Replace existing Peace root only in temporary webpage; source transform retained'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-only', action='store_true', help='Read source; only write temporary JSON, no geometry mutations or GLB')
    parser.add_argument('--audit', type=Path, default=OUTPUT/'source-audit.json')
    parser.add_argument('--label', required=True, help='New single filename label; existing outputs are not replaced')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in args.label):
        parser.error('Label must be a single alphanumeric filename')
    directory = OUTPUT/args.label
    if directory.exists(): parser.error('Output label exists; choose a new label')
    if not directory.resolve().is_relative_to((ROOT/'.tmp/png').resolve()): parser.error('Output must remain under .tmp/png')
    if (Path(bpy.data.filepath).resolve() != SOURCE or bpy.context.scene.get('space_contract') != 2
            or bpy.context.scene.get('space_asset') != 'shanghai'):
        raise RuntimeError('Open the canonical Shanghai source')
    token = source_guard.source_fingerprint()
    roots = [obj for obj in bpy.context.scene.objects if obj.get('space_export') and obj.get('spaceId') == ROOT_ID]
    if len(roots) != 1: raise RuntimeError('Expected exactly one Peace root')
    root = roots[0]
    directory.mkdir(parents=True, exist_ok=False)
    report = {'saved': False, 'officialAssetsWritten': False, 'revision': REVISION, 'source_stat': list(token),
              'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    if args.audit_only:
        report['audit'] = inventory(root)
    else:
        audit = json.loads(args.audit.read_text(encoding='utf8'))
        report['candidate'] = author(root, audit)
        source_guard.assert_source_unchanged(token)
        report['export'] = export_candidate(root, directory)
    source_guard.assert_source_unchanged(token)
    report['source_stat_unchanged'] = True
    filename = 'source-audit.json' if args.audit_only else 'candidate-report.json'
    (directory/filename).write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    print('PEACE_CENTRAL_ARCH '+json.dumps({'report': str(directory/filename), 'saved': False,
        'officialAssetsWritten': False, 'auditOnly': args.audit_only}), flush=True)


if __name__ == '__main__':
    main()
