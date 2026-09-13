"""Photo-guided podium and entrance increment; preview before guarded --apply.

OSM supplies the footprint. SOM exterior photography and AS+GG's six-storey
description inform the elevation; heights, subdivisions and canopy structure
are estimates. See references/jin-mao.md. No reference photo becomes a texture.
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
import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

sys.path.insert(0, str(Path(__file__).parent))
import refine_jin_mao as jm
import refine_swfc_top as exchange
from refine_alibaba_districts import geometry_digest
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from facade_rig import export_snapshot
from pack_gltf import atomic_write

REVISION = 'jin-mao-podium-20260913'
PROPERTY = 'spaceJinMaoPodiumRevision'
ROOT_ID = 'root/132/0'
OUTPUT = jm.ROOT / '.tmp/png/space-jinmao-podium-20260913'
DATA = jm.ROOT / 'core/packages/client/public/assets/space/shanghai-v1/huangpu.json'
PODIUM = 'way/167061959'
CANOPIES = {'west': 'way/524263611', 'east': 'way/167061956',
            'south': 'way/167061957', 'north': 'way/167061961'}
ATRIUM_CENTRE, ATRIUM_HALF, ATRIUM_SPRING, ATRIUM_RISE = 7., 15., 23.2, 8.


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def site_plan(building):
    pts = [(x-218, 1796-y) for x, y in building['points']]
    if pts[0] == pts[-1]:
        pts.pop()
    if sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(pts, pts[1:]+pts[:1])) < 0:
        pts.reverse()
    return pts


def roof_height(y):
    return 27.8 + 5.2*((y-7)/74)**2


def upper_point(p, z):
    # The photographed sail ends lean out above the main cornice.
    amount = (z-23.15)/(roof_height(p.y)-23.15)
    return (p.x, p.y+(p.y-7)*.05*amount, z)


def cap(mesh, polygon, height):
    points = [Vector((x, y, height(y) if callable(height) else height)) for x, y in polygon]
    for indices in tessellate_polygon([points]):
        tri = [points[i] for i in indices]
        mesh.face(tri, [(p.x, p.y) for p in tri])


def clip_y(polygon, bound, above):
    result = []
    for a, b in zip(polygon, polygon[1:]+polygon[:1]):
        inside_a, inside_b = (a[1] >= bound) == above, (b[1] >= bound) == above
        if inside_a:
            result.append(a)
        if inside_a != inside_b:
            u = (bound-a[1])/(b[1]-a[1])
            result.append((a[0]+u*(b[0]-a[0]), bound))
    return result


def panel(mesh, a, b, low, high):
    length = math.dist(a, b)
    mesh.face([(*a, low), (*b, low), (*b, high), (*a, high)],
              [(0, low), (length, low), (length, high), (0, high)])


def wall_x(polygon, y, east=True):
    cuts = [a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1])
            for a,b in zip(polygon,polygon[1:]+polygon[:1])
            if a[1] != b[1] and min(a[1],b[1]) <= y <= max(a[1],b[1])]
    if len(cuts) < 2:
        raise ValueError('Atrium or entrance lies outside the podium footprint')
    return max(cuts) if east else min(cuts)


def wing_edges(polygon):
    low, high = ATRIUM_CENTRE-ATRIUM_HALF, ATRIUM_CENTRE+ATRIUM_HALF
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        ts = [0.,1.]
        if a[1] != b[1]:
            ts += [(y-a[1])/(b[1]-a[1]) for y in (low,high) if min(a[1],b[1]) < y < max(a[1],b[1])]
        ts.sort()
        for t,u in zip(ts,ts[1:]):
            p = tuple(a[j]+(b[j]-a[j])*t for j in (0,1))
            q = tuple(a[j]+(b[j]-a[j])*u for j in (0,1))
            if not low < (p[1]+q[1])/2 < high:
                yield p,q


def podium(parts, polygon):
    glass, metal, stone, dark = [parts[k] for k in ('glass', 'silver', 'stone', 'black')]
    cap(dark, polygon, .3)
    low, high = ATRIUM_CENTRE-ATRIUM_HALF, ATRIUM_CENTRE+ATRIUM_HALF
    # The site plan places a transverse, open atrium between the two wings.
    # Do not cover its interior with the old full-width roof slab.
    for bound, above in ((low,False),(high,True)):
        cap(dark, clip_y(polygon,bound,above), 23)
    count = 0
    for a, b in wing_edges(polygon):
        av, bv = Vector(a), Vector(b)
        tangent = (bv-av).normalized()
        normal = Vector((tangent.y, -tangent.x))
        bays = max(1, round((bv-av).length/3.3))
        for i in range(bays):
            p, q = av.lerp(bv, i/bays), av.lerp(bv, (i+1)/bays)
            panel(dark, p, q, 0, .55)
            panel(glass, p-normal*.18, q-normal*.18, .55, 5.7)
            panel(stone, p, q, 5.7, 8.4)
            panel(glass, p-normal*.18, q-normal*.18, 8.4, 23)
            metal.beam((*p, .55), (*p, 23), .16, .23)
            # Ground piers, stone joints and glazing rails remain real geometry.
            edge = p+tangent*.48
            panel(stone, p, edge, .55, 5.7)
            for z in (1.4, 2.3, 3.2, 4.1, 5., 6.6, 7.5):
                end = edge if z < 5.7 else q
                dark.beam((*(p+normal*.012), z), (*(end+normal*.012), z), .018)
            for z in (2.5, 4.6):
                metal.beam((*p, z), (*q, z), .09)
            lo, hi = roof_height(p.y), roof_height(q.y)
            parts['clerestory'].face([(*p,23.15),(*q,23.15),upper_point(q,hi),upper_point(p,lo)],
                [(0,23.15),((q-p).length,23.15),((q-p).length,hi),(0,lo)])
            metal.beam((*p,23.15),upper_point(p,lo),.13)
            metal.beam(upper_point(p,lo),upper_point(q,hi),.2)
            for z in (24.4,26.,27.6,29.2,30.8,32.4):
                if z < min(lo,hi):
                    metal.beam(upper_point(p,z),upper_point(q,z),.09)
            count += 1
        for j in range(18):
            z = 8.5+j*.85
            p, q = av+normal*.42, bv+normal*.42
            metal.beam((*p,z),(*q,z),.28,.15)
            # Sloped sill underside and shadow slot behind each horizontal band.
            parts['silver'].face([(*(av+normal*.10),z-.19),(*(bv+normal*.10),z-.19),
                                   (*q,z-.07),(*p,z-.07)])
        for z in (5.7,8.4,11.8,15.2,18.6,22.,23.1):
            metal.beam((*a,z),(*b,z),.38,.25)
    # Slice the footprint so the roof follows the concave longitudinal profile.
    roof_plan = [(x,7+(y-7)*1.05) for x,y in polygon]
    def height(y):
        return roof_height(7+(y-7)/1.05)
    for ystart,yend in ((min(y for x,y in roof_plan),low),(high,max(y for x,y in roof_plan))):
        n = math.ceil((yend-ystart)/2)
        for i in range(n):
            y0, y1 = ystart+(yend-ystart)*i/n, ystart+(yend-ystart)*(i+1)/n
            cut = clip_y(clip_y(roof_plan,y0,True),y1,False)
            if len(cut) >= 3:
                cap(parts['clerestory'],cut,height)
                xs = [x for x,y in cut if abs(y-y0)<.001]
                if len(xs) >= 2:
                    metal.beam((min(xs),y0,height(y0)),(max(xs),y0,height(y0)),.14)
    # Close the wing roof returns facing the central vault. These are visible
    # from the west and above; leaving the sail skin open exposes a black gap.
    for y in (low, high):
        west,east = wall_x(polygon,y,False),wall_x(polygon,y)
        roof_west,roof_east = wall_x(roof_plan,y,False),wall_x(roof_plan,y)
        parts['clerestory'].face([(west,y,23.),(east,y,23.),
            (roof_east,y,height(y)),(roof_west,y,height(y))])
        bays = max(1,round((east-west)/3.3))
        for i in range(bays+1):
            t = i/bays
            metal.beam((west+(east-west)*t,y,23.),
                       (roof_west+(roof_east-roof_west)*t,y,height(y)),.13)
        for z in (24.4,26.,27.6):
            if z < height(y):
                t = (z-23.)/(height(y)-23.)
                metal.beam((west+(roof_west-west)*t,y,z),
                           (east+(roof_east-east)*t,y,z),.09)
    return count


def atrium(parts, polygon):
    # AR January 2000, printed pp. 85/87: barrel vault, glazed west end and
    # a circular window at the far end seen through the vault from the west.
    # The east-end placement is inferred from that depth, not a surveyed plan.
    low, high = ATRIUM_CENTRE-ATRIUM_HALF, ATRIUM_CENTRE+ATRIUM_HALF
    metal,glass,stone = parts['silver'],parts['clear'],parts['stone']
    radius = (ATRIUM_HALF**2+ATRIUM_RISE**2)/(2*ATRIUM_RISE)
    def height(y):
        return ATRIUM_SPRING+ATRIUM_RISE-radius+math.sqrt(radius**2-(y-ATRIUM_CENTRE)**2)
    def p(t,y,z):
        west,east = wall_x(polygon,y,False),wall_x(polygon,y)
        return (west+(east-west)*t,y,z)
    longitudinal, transverse = 12,40
    for i in range(longitudinal+1):
        t = i/longitudinal
        for j in range(transverse):
            y,z = low+(high-low)*j/transverse,low+(high-low)*(j+1)/transverse
            primary = i%2==0
            metal.beam(p(t,y,height(y)),p(t,z,height(z)),.52 if primary else .12,sides=12)
            if primary:
                # The interior photo shows a broad tubular arch, lower chord
                # and small connecting webs rather than a single thin line.
                metal.beam(p(t,y,height(y)-.9),p(t,z,height(z)-.9),.14,sides=12)
                if j%4==0:
                    metal.beam(p(t,y,height(y)-.9),p(t,y,height(y)),.09)
            if i < longitudinal:
                glass.face([p(t,y,height(y)),p((i+1)/longitudinal,y,height(y)),
                            p((i+1)/longitudinal,z,height(z)),p(t,z,height(z))],
                           [(t*44,y),((i+1)/longitudinal*44,y),((i+1)/longitudinal*44,z),(t*44,z)])
        if i%2==0:
            for y in (low+.6,high-.6):
                metal.beam(p(t,y,.55),p(t,y,ATRIUM_SPRING),.55,sides=16)
                for level in (4.,8.,12.,16.,20.,23.15):
                    metal.beam(p(t,y,level-.1),p(t,y,level+.1),.64,sides=16)
                for offset in (-.65,.65):
                    metal.beam(p(t,y,19.3),p(t,y+offset,height(y+offset)),.23,sides=12)
    for j in range(transverse+1):
        y = low+(high-low)*j/transverse
        metal.beam(p(0,y,height(y)),p(1,y,height(y)),.10)
    for t in (0.,1.):
        # A glazed end follows the actual arch; wing cladding stops at its sides.
        divisions = 40
        for j in range(divisions):
            y,z = low+(high-low)*j/divisions,low+(high-low)*(j+1)/divisions
            glass.face([p(t,y,.55),p(t,z,.55),p(t,z,height(z)),p(t,y,height(y))],
                       [(y,.55),(z,.55),(z,height(z)),(y,height(y))])
            metal.beam(p(t,y,.55),p(t,y,height(y)),.11 if j%4==0 else .055)
        metal.beam(p(t,high,.55),p(t,high,height(high)),.11)
        # Closely spaced rails follow the arch, including the curved head.
        # Counts and spacing are estimates from the historical interior photo.
        for row in range(1,41):
            level = row*.76
            half = ATRIUM_HALF if level <= ATRIUM_SPRING else math.sqrt(
                max(0.,radius**2-(level-ATRIUM_SPRING-ATRIUM_RISE+radius)**2))
            metal.beam(p(t,ATRIUM_CENTRE-half,level),p(t,ATRIUM_CENTRE+half,level),
                       .12 if row%5==0 else .055)
        for offset in (0.,.65):
            for j in range(transverse):
                y,z = low+(high-low)*j/transverse,low+(high-low)*(j+1)/transverse
                metal.beam(p(t,y,height(y)+offset),p(t,z,height(z)+offset),.36,.5)
    # The round frame is behind the full depth of the barrel vault. Placing it
    # on the west front glass flattens the photographed interior into a facade.
    for r in (4.6,4.95):
        for j in range(80):
            a,b = j*math.tau/80,(j+1)*math.tau/80
            pa,pb = p(1,ATRIUM_CENTRE+r*math.cos(a),9.3+r*math.sin(a)),p(1,ATRIUM_CENTRE+r*math.cos(b),9.3+r*math.sin(b))
            metal.beam((pa[0]-.14,*pa[1:]),(pb[0]-.14,*pb[1:]),.18,sides=12)
    for y,above in ((low,False),(high,True)):
        # Open central void with floor edges and glazed rails along each wing.
        west,east = wall_x(polygon,y,False),wall_x(polygon,y)
        panel(parts['glass'],(west,y),(east,y),.55,23)
        inward = .5 if above else -.5
        for z in (4.,8.,12.,16.,20.):
            stone.beam((west,y,z),(east,y,z),1.1,.32)
            panel(glass,(west,y-inward),(east,y-inward),z+.18,z+1.25)
            metal.beam((west,y-inward,z+1.25),(east,y-inward,z+1.25),.07,sides=8)
    return {'centreY':ATRIUM_CENTRE,'width':2*ATRIUM_HALF,'springHeight':ATRIUM_SPRING,
            'rise':ATRIUM_RISE,'archAxis':'Y','barrelAxis':'X','circularWindowEnd':'east',
            'circularWindowPlacementInferred':True,'primaryRibDiameter':.52,
            'endGlazingColumns':40,'endGlazingRailSpacing':.76,
            'dimensionsEstimated':True,'interiorComplete':False}


def connector(parts, polygon):
    # The west object is a low, flat connector, not a fourth porte cochere.
    stone,metal = parts['stone'],parts['silver']
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        panel(parts['glass'],a,b,.3,3.3)
        panel(stone,a,b,3.3,6.7)
        length = math.dist(a,b)
        bays = max(1,round(length/1.5))
        for i in range(bays+1):
            p = tuple(a[j]+(b[j]-a[j])*i/bays for j in (0,1))
            metal.beam((*p,6.7),(*p,7.85),.055,sides=8)
            parts['black'].beam((*p,3.3),(*p,6.7),.015)
        for z in (4.4,5.55):
            parts['black'].beam((*a,z),(*b,z),.018)
        for z in (7.,7.35,7.8):
            metal.beam((*a,z),(*b,z),.065,sides=8)
        stone.beam((*a,6.7),(*b,6.7),.4,.22)
    cap(stone,polygon,6.6)
    return {'type':'flat-west-connector','plan':[list(p) for p in polygon],
            'parapetTop':6.7,'guardrailTop':7.85,'dimensionsEstimated':True}


def canopy(parts, polygon, name):
    # Both photographed north/south drive-through entries arch east-west.
    # The east entrance orientation is inferred from the published site plan.
    across_x = name=='east'
    coords = [(x,y) if across_x else (y,-x) for x,y in polygon]
    u0,u1 = min(p[0] for p in coords),max(p[0] for p in coords)
    v0,v1 = min(p[1] for p in coords),max(p[1] for p in coords)
    def p(u,v,z):
        return (u,v,z) if across_x else (-v,u,z)
    def z(v):
        return 8.6+2.2*math.sin(math.pi*(v-v0)/(v1-v0))
    metal,stone,black,glass = [parts[k] for k in ('silver','stone','black','clear')]
    bays, steps = 13,32
    for i in range(bays+1):
        u=u0+(u1-u0)*i/bays
        for j in range(steps):
            v,w=v0+(v1-v0)*j/steps,v0+(v1-v0)*(j+1)/steps
            metal.beam(p(u,v,z(v)),p(u,w,z(w)),.18,.25)
            metal.beam(p(u,v,z(v)-.38),p(u,w,z(w)-.38),.10,.12)
            if j%2==0:
                metal.beam(p(u,v,z(v)-.38),p(u,v,z(v)),.045)
            if i < bays:
                un=u0+(u1-u0)*(i+1)/bays
                points=[p(u,v,z(v)),p(un,v,z(v)),p(un,w,z(w)),p(u,w,z(w))]
                glass.face(points,[(u,v),(un,v),(un,w),(u,w)])
        for v in (v0,v1):
            metal.beam(p(u,v,7.65),p(u,v,8.6),.09)
    for j in range(0,steps+1,3):
        v=v0+(v1-v0)*j/steps
        metal.beam(p(u0,v,z(v)),p(u1,v,z(v)),.08)
    for v in (v0,v1):
        # Deep stone perimeter beam, with a thinner projecting top ledge.
        metal.beam(p(u0,v,8.62),p(u1,v,8.62),.22)
        stone.beam(p(u0-.45,v,7.12),p(u1+.45,v,7.12),1.05,1.0)
        stone.beam(p(u0-.65,v,7.65),p(u1+.65,v,7.65),1.2,.2)
        for i in range(1,bays):
            u = u0+(u1-u0)*i/bays
            outer = -.38 if v==v0 else .38
            black.beam(p(u,v+outer,6.78),p(u,v+outer,7.46),.012)
    for u in (u0+1.,u1-1.):
        for v in (v0+.8,v1-.8):
            stone.beam(p(u,v,.65),p(u,v,7),1.2,sides=4)
            black.beam(p(u,v,.05),p(u,v,.72),1.26,sides=4)
            for h in (2.9,5.2,6.95):
                metal.beam(p(u,v,h),p(u,v,h+.14),1.65,sides=4)
            for h in (1.4,2.2,3.8,4.6,6.1):
                black.beam(p(u,v,h),p(u,v,h+.012),1.205,sides=4)
    if name in ('north','south'):
        # SOM south and AR north photographs show two staggered hung shades.
        for v,h,inset in ((v0+4.,4.9,3.2),(v0+9.,4.25,4.3)):
            for offset in (-.65,.65):
                metal.beam(p(u0+1,v+offset,h+.2),p(u1-1,v+offset,h+.2),.16,sides=12)
            pts=[p(u0+inset,v-1.3,h+.1),p(u1-inset,v-1.3,h+.1),
                 p(u1-inset,v+1.3,h-.35),p(u0+inset,v+1.3,h-.35)]
            parts['bronze'].face(pts,[(0,0),(u1-u0-2*inset,0),(u1-u0-2*inset,2.6),(0,2.6)])
            for a,b in zip(pts,pts[1:]+pts[:1]):
                parts['bronze'].beam(a,b,.08)
            for u in (u0+inset+.2,u1-inset-.2):
                metal.beam(p(u,v,h+.1),p(u,v,7.5),.045,sides=8)
    return {'ribCount':bays+1,'plan':[list(p) for p in polygon],'eave':8.6,'rise':2.2,
            'structureEstimated':True,'orientationObserved':name in ('north','south'),
            'hungShades':2 if name in ('north','south') else 0,
            'ribArchAxis':'Y' if across_x else 'X'}


def podium_entry(parts, polygon, centre):
    # The photographed low wave canopy belongs to the podium's east facade.
    # Locate it on the OSM wall; photo-derived spans/heights are not surveyed.
    metal,glass=parts['silver'],parts['clear']
    low,high=centre-15.,centre+15.
    def p(y,depth):
        return (wall_x(polygon,y)+depth,y,3.7+.48*math.cos((y-low)/(high-low)*math.tau*3))
    divisions=96
    for i in range(divisions):
        a,b=low+(high-low)*i/divisions,low+(high-low)*(i+1)/divisions
        for d in (0.2,1.4,2.6):
            metal.beam(p(a,d),p(b,d),.08)
        glass.face([p(a,.2),p(b,.2),p(b,2.6),p(a,2.6)],[(a,0),(b,0),(b,2.4),(a,2.4)])
        if i%4==0:
            metal.beam(p(a,.2),p(a,2.6),.1)
    metal.beam(p(high,.2),p(high,2.6),.1)
    # Metal door leaves and pull handles sit on the existing glazed facade.
    for door in (centre-10.,centre,centre+10.):
        for y in (door-1.8,door,door+1.8):
            metal.beam((wall_x(polygon,y)+.05,y,.12),(wall_x(polygon,y)+.05,y,2.8),.11)
        for z in (.12,2.8):
            metal.beam((wall_x(polygon,door-1.8)+.05,door-1.8,z),
                       (wall_x(polygon,door+1.8)+.05,door+1.8,z),.11)
        for y in (door-.18,door+.18):
            metal.beam((wall_x(polygon,y)+.18,y,1.),(wall_x(polygon,y)+.18,y,1.7),.04,sides=8)
    return {'facade':'east','centreY':centre,'span':30,'projection':2.6,'waveCount':3,
            'doorPairs':3,'dimensionsAndDoorCountEstimated':True}


def face_records(mesh, skip=()):
    uv=mesh.uv_layers.active
    return Counter((tuple(tuple(v) for v in (mesh.vertices[i].co for i in p.vertices)),
                    tuple(tuple(uv.data[i].uv) for i in p.loop_indices) if uv else (),
                    p.material_index,p.use_smooth)
                   for p in mesh.polygons if p.index not in skip)


def remove_placeholder(root, batch, polygon):
    # Imported batch transformed into the site's unrotated east/north axes.
    points=[Vector((x+218,y-1796,z-.65)) for x,y in polygon for z in (0,16)]
    selected=[]
    for face in batch.data.polygons:
        if all(any((batch.matrix_world@batch.data.vertices[i].co-q).length<.012 for q in points)
               for i in face.vertices):
            selected.append(face.index)
    if len(selected)!=32 or len(batch.data.polygons)!=4944 or batch.data.users!=1:
        raise RuntimeError('Expected exactly 32 podium faces in the unchanged city batch')
    before=face_records(batch.data,set(selected))
    old=batch.data
    old.use_fake_user=True
    batch.data=old.copy()
    bm=bmesh.new()
    bm.from_mesh(batch.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.faces[i] for i in selected],context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(batch.data)
    bm.free()
    batch.data.update()
    # BMesh may cycle a polygon's starting vertex; preserve its oriented loop.
    def canonical(records):
        out=Counter()
        for (positions,uv,mat,smooth),count in records.items():
            loops=list(zip(positions,uv)) if uv else [(p,()) for p in positions]
            rotations=[tuple(loops[i:]+loops[:i]) for i in range(len(loops))]
            out[(min(rotations),mat,smooth)]+=count
        return out
    if canonical(before)!=canonical(face_records(batch.data)):
        raise RuntimeError('Unrelated batch faces, UVs or shading changed')
    batch[PROPERTY]=REVISION
    return {'removedFaces':32,'preservedFaces':sum(before.values()),'batchId':batch['spaceId']}


def author(root,batch):
    data=json.loads(DATA.read_text())
    buildings={b['id']:b for b in data['polygons']}
    polygon=site_plan(buildings[PODIUM])
    removed=remove_placeholder(root,batch,polygon)
    roles={'stone':((180,180,171),.08,.52,.05), 'silver':((193,199,192),.78,.29,.06),
           'glass':((72,91,92),.32,.20,.005), 'black':((24,29,29),.25,.25,0),
           'clerestory':((117,142,139),.33,.22,0), 'clear':((167,190,185),.10,.15,0),
           'bronze':((129,119,95),.78,.32,0)}
    source=next(m for o in root.children if o.type=='MESH' for m in o.data.materials)
    materials={}
    for key,(rgb,metal,rough,wash) in roles.items():
        mat=jm.make_material(source,'podium '+key,rgb,wash,metal,rough)
        mat['spaceMaterialId']=REVISION+'/'+key
        mat[PROPERTY]=REVISION
        if key=='clear':
            mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.42
            mat.diffuse_color=(*mat.diffuse_color[:3],.42)
            mat.surface_render_method='DITHERED'
        materials[key]=mat
    parts={key:jm.Mesh() for key in roles}
    bays=podium(parts,polygon)
    canopies={name:(connector(parts,site_plan(buildings[sid])) if name=='west' else
                    canopy(parts,site_plan(buildings[sid]),name)) for name,sid in CANOPIES.items()}
    entries=[podium_entry(parts,polygon,centre) for centre in (-41.,38.)]
    hall=atrium(parts,polygon)
    objects=[]
    inv=root.matrix_world.inverted()
    for name,mesh in parts.items():
        mesh.vertices=[inv@Vector((x+218,y-1796,z-.65)) for x,y,z in mesh.vertices]
        obj=mesh.object('Jin Mao podium '+name,materials[name],root,root.users_collection[0])
        obj['spaceId']='authored/jin-mao/podium/'+name
        obj[PROPERTY]=REVISION
        obj['spaceDimensionsEstimated']=True
        objects.append(obj)
    bpy.context.view_layer.update()
    return objects,{'batch':removed,'footprint':PODIUM,'bays':bays,'canopies':canopies,
                    'podiumEntries':entries,'atrium':hall,
                    'bodyHeight':23,'roofHeightRange':[27.8,33.4],'sailLongitudinalFlare':1.05,
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
    if len(roots)!=1 or Path(bpy.data.filepath).resolve()!=SOURCE.resolve() or scene.get('space_contract')!=2 or scene.get(PROPERTY):
        raise RuntimeError('Expected canonical contract-v2 source before this one-time revision')
    root=roots[0]
    if root.get('spaceJinMaoFinishRevision')!='jin-mao-finish-20260913':
        raise RuntimeError('Expected the reviewed Jin Mao finish')
    batch=next(o for o in scene.objects if o.get('spaceId')=='root/33')
    token=source_fingerprint()
    scripts={p.name:sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))}
    directory=OUTPUT/args.label
    candidate=json.loads((directory/'candidate.json').read_text()) if args.apply else None
    if candidate:
        if candidate['sourceBefore']!=list(token) or candidate['scripts']!=scripts or candidate['osmSha256']!=sha(DATA) or sha(directory/'podium.glb')!=candidate['candidateSha256']:
            raise RuntimeError('Reviewed source, dependency or candidate changed')
        if sha(directory/'batch.glb')!=candidate['batchSha256']:
            raise RuntimeError('Reviewed surrounding batch changed')
    else:
        directory.mkdir(parents=True,exist_ok=False)
    original=[o for o in scene.objects if o!=batch]
    digest,rigs,ids=geometry_digest(original),export_snapshot(scene),exchange.runtime_id_snapshot(scene)
    other={o:(o.data,tuple(o.data.materials)) for o in original if o.type=='MESH'}
    added,detail=author(root,batch)
    if geometry_digest(original)!=digest or export_snapshot(scene)!=rigs or any(o.data!=data or tuple(o.data.materials)!=mats for o,(data,mats) in other.items()):
        raise RuntimeError('Unrelated scene geometry, materials or facade lights changed')
    if exchange.runtime_id_snapshot(scene)!=ids+Counter(o['spaceId'] for o in added):
        raise RuntimeError('Runtime identities changed beyond the new podium meshes')
    report={'revision':REVISION,'saved':False,'sourceBefore':list(token),'scripts':scripts,'osmSha256':sha(DATA),
            'unrelatedGeometry':digest,'preservedRigs':list(rigs),'detail':detail}
    assert_source_unchanged(token)
    if args.apply:
        if any(candidate[k]!=v for k,v in report.items()):
            raise RuntimeError('Rebuilt podium differs from reviewed candidate')
        backup=directory/'shanghai-before-jinmao-podium.blend'
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
        path=directory/'podium.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,
            export_attributes=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
        raw=path.read_bytes()
        size,kind=struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:
            raise RuntimeError('Missing candidate GLB JSON')
        exchange.ROOT_ID=ROOT_ID
        report['exportGeometry']=exchange.validate_export_geometry(json.loads(raw[20:20+size]),raw,expected)
        report['candidateSha256']=sha(path)
        # The podium placeholder shared a mesh with unrelated buildings. Keep a
        # separate candidate for exact formal-export comparison of that batch.
        bpy.ops.object.select_all(action='DESELECT')
        batch.hide_set(False)
        batch.select_set(True)
        path=directory/'batch.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,
            export_attributes=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
        report['batchSha256']=sha(path)
    atomic_write(directory/('saved.json' if args.apply else 'candidate.json'),(json.dumps(report,indent=2)+'\n').encode())
    print('JIN_MAO_PODIUM_RESULT '+json.dumps({k:v for k,v in report.items() if k!='scripts'}),flush=True)


if __name__=='__main__':
    main()
