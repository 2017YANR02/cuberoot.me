"""Disposable SWFC diagonal-envelope candidate; never saves a Blender source.

Run in the current canonical Shanghai file. --bridge-angle-deg is required:
it is the bridge long-axis angle in root-local Blender XY, measured from +X
towards +Y. Square base edges lie 45 degrees either side of this axis. This
changes mesh-local orientation while preserving the existing root transform.
All profile widths, aperture widths, soffit depth and crown subdivisions below
are review estimates. 439 / 474 / 492 m are documented above-ground anchors;
the owner's 477.96 m altitude is not the 100F above-ground height.

The CLI exports only this tower to .tmp/png, preserving its world transform and
the original six runtime mesh identities plus two independent detail materials.
A coordinator may call author() for
an in-memory full-scene preview. There is intentionally no --apply option.
References: ../references/swfc-top.md and the audit passed with --audit.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).parent))
from refine_bund_entrances import archive_mesh
from refine_jin_mao import Mesh, linear
from refine_peace_crown import SOURCE, source_fingerprint, assert_source_unchanged
from pack_gltf import atomic_write
from facade_rig import export_snapshot

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.tmp/png/space-swfc-top-20260910'
AUDIT = OUTPUT / 'audit/swfc-current-mesh-audit.json'
ROOT_ID = 'root/132/1'
REVISION = 'swfc-top-candidate-20260910'
PROPERTY = 'spaceSwfcTopRevision'
IDS = {key: ROOT_ID + '/' + str(i)
       for i, key in enumerate(('glass', 'frame', 'light', 'mechanical'))}
IDS.update(rails='shanghai-landmarks-20260908/' + ROOT_ID + '/SWFC curtain wall mullions and floor rails',
           soffit='shanghai-landmarks-20260908/' + ROOT_ID + '/SWFC aperture soffit battens')
EXTRA_IDS = {'top_glass': 'swfc-top-20260910/' + ROOT_ID + '/SWFC top glass',
             'soffit_panels': 'swfc-top-20260910/' + ROOT_ID + '/SWFC soffit panels'}
OUTPUT_IDS = {**IDS, **EXTRA_IDS}
EXTRA_MATERIAL_IDS = {key: 'swfc-top-20260910/material/' + key for key in EXTRA_IDS}
HALF = 29.0  # Existing square footprint, not a measured rooftop dimension.
DIAMOND = HALF * math.sqrt(2)
HEIGHT, FLOOR_97, FLOOR_100 = 492.0, 439.0, 474.0
CANOPY, SOFFIT, ROOM_TOP, EQUIPMENT_TOP = 444.0, 471.6, 478.5, 487.0
PROFILE = ((0., DIAMOND), (80., 40.8), (154., 38.5), (231., 33.6),
           (308., 26.4), (385., 17.2), (423., 12.2), (439., 10.),
           (460., 6.6), (471.6, 4.9), (474., 4.6), (478.5, 3.9),
           (487., 2.), (492., .8))
# Photo-supported relationships, with unmeasured dimensions explicitly estimated.
# IMA4 / KPF P3: raised shallow gable, I-section transverse frames, two round
# longitudinal supports and side glazing. HISTAR p34: a recessed crown trough.
CANOPY_HALF_LENGTH, CANOPY_HALF_WIDTH = 25.5, 6.8
CANOPY_EAVE, CANOPY_RISE, CANOPY_BAY = 443.30, .60, 3.0
CANOPY_TERRACE, CANOPY_TUBE_Z, CANOPY_TUBE_V = 441.30, 442.75, 6.2
CANOPY_TUBE_DIAMETER = .50
CANOPY_CUT_HALF_LENGTH = 24.
CROWN_SLOT_HALF_LENGTH, CROWN_SLOT_HALF_WIDTH, CROWN_SLOT_FLOOR = 34., .45, 490.60
GLASS_THICKNESS, SOFFIT_PANEL_THICKNESS, SOFFIT_DARK_HALF_WIDTH = .012, .04, .60


def box(part, lower, upper):
    """Closed, axis-aligned detail block; all dimensions stay in diagonal axes."""
    if any(a >= b for a, b in zip(lower, upper, strict=True)):
        raise ValueError('Detail box dimensions must be positive')
    u0, v0, z0 = lower
    u1, v1, z1 = upper
    polygon = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    horizontal(part, polygon, z0, False)
    horizontal(part, polygon, z1)
    loft(part, polygon, polygon, z0, z1)


def thin_panel(part, points, offset, uv=None):
    """Closed slab, first face outward and offset strictly into the solid."""
    if len(points) < 3:
        return
    normal = (Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0]))
    if sum(a*b for a, b in zip(normal, offset)) >= -1e-10:
        raise ValueError('Panel extrusion must point behind the outward surface')
    back = [tuple(a+b for a, b in zip(p, offset)) for p in points]
    coordinates = uv or [(p[0], p[1]) for p in points]
    clean_face(part, points, coordinates)
    clean_face(part, list(reversed(back)), list(reversed(coordinates)))
    for i, a in enumerate(points):
        j = (i+1) % len(points)
        clean_face(part, [a, back[i], back[j], points[j]])


def half_depth(z):
    """Monotone C1 interpolation of estimated diagonal clipping planes."""
    if not math.isfinite(z) or not 0 <= z <= HEIGHT:
        raise ValueError('Profile height must be finite and within 0..492 m')
    slopes = [(b[1]-a[1])/(b[0]-a[0]) for a, b in zip(PROFILE, PROFILE[1:])]
    tangents = [slopes[0]] + [2*a*b/(a+b) for a, b in zip(slopes, slopes[1:])] + [slopes[-1]]
    for i, ((lo, a), (hi, b)) in enumerate(zip(PROFILE, PROFILE[1:])):
        if z <= hi:
            t, dz = (z-lo)/(hi-lo), hi-lo
            return ((2*t**3-3*t**2+1)*a + (t**3-2*t**2+t)*dz*tangents[i]
                    + (-2*t**3+3*t**2)*b + (t**3-t**2)*dz*tangents[i+1])
    raise AssertionError('Profile interval not found')


def plan(z):
    """CCW intersection of a fixed square and two parallel diagonal cuts.

    Work in a right-handed (u,v,Z) frame. The two u tips remain on the old
    square's diagonal; their 82.02 m separation is a candidate envelope, not
    evidence that the as-built crown or aperture has that width.
    """
    c, a = half_depth(z), DIAMOND
    return [(-a, 0.), (-a+c, -c), (a-c, -c), (a, 0.), (a-c, c), (-a+c, c)]


def xyz(p, bridge_angle_deg):
    if not math.isfinite(bridge_angle_deg) or not -180 <= bridge_angle_deg <= 180:
        raise ValueError('Bridge angle must be a finite root-local angle within -180..180 degrees')
    u, v, z = p
    angle = math.radians(bridge_angle_deg)
    c, s = math.cos(angle), math.sin(angle)
    return (u*c-v*s, u*s+v*c, z)


def clip(poly, axis, bound, keep_greater):
    """Clip convex coordinates, interpolating any trailing surface/UV values."""
    if not poly:
        return []
    out = []
    for a, b in zip(poly, poly[1:]+poly[:1]):
        da, db = a[axis]-bound, b[axis]-bound
        inside_a = da >= -1e-9 if keep_greater else da <= 1e-9
        inside_b = db >= -1e-9 if keep_greater else db <= 1e-9
        if inside_a:
            out.append(a)
        if inside_a != inside_b:
            t = da/(da-db)
            out.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(len(a))))
    return out


def trim_canopy_facade(part):
    """Remove only the central outer skin above the 97F side terraces.

    Clip the existing triangles, including their UV, instead of introducing a
    new Hermite knot that would alter all six faces at this height. End piers,
    square faces, the lower facade and the upper bridge stay byte-identical.
    """
    result = Mesh()
    for face in part.faces:
        points = [tuple(part.vertices[i]) for i in face]
        uv = [part.uv[i] for i in face]
        normal = (Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0]))
        if (max(p[2] for p in points) <= CANOPY_TERRACE or min(p[2] for p in points) >= CANOPY
                or max(p[0] for p in points) <= -CANOPY_CUT_HALF_LENGTH
                or min(p[0] for p in points) >= CANOPY_CUT_HALF_LENGTH
                or abs(normal[0]) > 1e-7 or abs(normal[1]) < 1e-7):
            result.face(points, uv)
            continue
        inside = [(*p, *coord) for p, coord in zip(points, uv, strict=True)]
        # Emit each outside half-plane once; carry only its complement onward.
        for axis, bound, greater in ((0, -CANOPY_CUT_HALF_LENGTH, False),
                                     (0, CANOPY_CUT_HALF_LENGTH, True),
                                     (2, CANOPY_TERRACE, False), (2, CANOPY, True)):
            outside = clip(inside, axis, bound, greater)
            clean_face(result, [p[:3] for p in outside], [p[3:] for p in outside])
            inside = clip(inside, axis, bound, not greater)
            if not inside:
                break
    return result


def skin_depth(z, levels):
    """Depth on the actual piecewise-linear facade, including between knots."""
    for lo, hi in zip(levels, levels[1:]):
        if lo <= z <= hi:
            return half_depth(lo)+(half_depth(hi)-half_depth(lo))*(z-lo)/(hi-lo)
    raise AssertionError('Height is outside the facade loft')


def aperture(z):
    return 24.0 + 6.0*(z-CANOPY)/(SOFFIT-CANOPY)


def clean_face(part, points, uv=None):
    """Avoid zero-area triangles where the bottom hexagon becomes a square."""
    pairs = []
    for p, coord in zip(points, uv or [(p[0], p[2]) for p in points], strict=True):
        if not pairs or math.dist(p, pairs[-1][0]) > 1e-8:
            pairs.append((p, coord))
    if len(pairs) > 1 and math.dist(pairs[0][0], pairs[-1][0]) < 1e-8:
        pairs.pop()
    if len(pairs) < 3:
        return
    # Explicit triangles keep the mildly curved, estimated loft deterministic.
    for i in range(1, len(pairs)-1):
        tri = [pairs[0], pairs[i], pairs[i+1]]
        a, b, c = [Vector(p) for p, _ in tri]
        if (b-a).cross(c-a).length > 1e-8:
            part.face([p for p, _ in tri], [coord for _, coord in tri])


def loft(part, lower, upper, bottom, top, fixed_facade_uv=False):
    if len(lower) != len(upper):
        raise RuntimeError('Cross-section topology changed within one loft interval')
    along = 0.
    for i, a in enumerate(lower):
        j = (i+1) % len(lower)
        b, c, d = lower[j], upper[i], upper[j]
        length = math.dist(a, b)
        uv = [(along, bottom), (along+length, bottom), (along+length, top), (along, top)]
        if fixed_facade_uv:
            # Use each supporting plane's fixed metre coordinate, matching the
            # physical mullions. Recomputed per-level perimeter makes the shader
            # window grid jump even when adjacent geometric vertices coincide.
            # The first diagonal cut is a point at ground level: classify using
            # its non-degenerate upper edge, never a clipped polygon's index.
            start, end = (a, b) if length > 1e-8 else (c, d)
            du, dv = end[0]-start[0], end[1]-start[1]
            if abs(dv) < 1e-8:
                axis, scale = 0, 1.  # Broad diagonal cut: fixed bridge-axis u.
            elif abs(du) < 1e-8:
                axis, scale = 1, 1.  # Aperture jamb: fixed v.
            elif abs(abs(du)-abs(dv)) < 1e-8:
                axis, scale = 1, math.sqrt(2)  # Original square's four faces.
            else:
                raise RuntimeError('Unexpected SWFC supporting plane for facade UV')
            uv = [(p[axis]*scale, z) for p, z in ((a, bottom), (b, bottom), (d, top), (c, top))]
        clean_face(part, [(*a, bottom), (*b, bottom), (*d, top), (*c, top)],
                   uv)
        along += length


def horizontal(part, polygon, z, upward=True):
    if len(polygon) < 3:
        return
    points = [(*p, z) for p in polygon]
    if not upward:
        points.reverse()
    clean_face(part, points, [(p[0], p[1]) for p in points])


def section(z, pier=None):
    polygon = plan(z)
    return polygon if pier is None else clip(polygon, 0, pier*aperture(z), pier > 0)


def boundary_beam(part, a, b, z, width, depth):
    if math.dist(a, b) > .001:
        part.beam((*a, z), (*b, z), width, depth)


def simplify_mullion(points):
    """Merge straight runs; stay within 15 mm of the existing loft at every knot."""
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    errors = []
    for p in points[1:-1]:
        t = (p[2]-a[2])/(b[2]-a[2])
        errors.append(math.hypot(p[0]-a[0]-t*(b[0]-a[0]), p[1]-a[1]-t*(b[1]-a[1])))
    error = max(errors)
    if error <= .015:
        return [a, b]
    split = errors.index(error)+1
    return simplify_mullion(points[:split+1])[:-1]+simplify_mullion(points[split:])


def curtain_mullion(part, points, normal, trim_top=None):
    """One joined rectangular strip, with stable facade orientation and end caps."""
    points = simplify_mullion(points)
    if trim_top is not None:
        # Clip the already-simplified baseline path. Resimplifying a shorter
        # curve changes distant segments as low as 104 m in this candidate.
        retained = []
        for a, b in zip(points, points[1:]):
            if a[2] >= trim_top:
                break
            retained.append(a)
            if b[2] >= trim_top:
                t = (trim_top-a[2])/(b[2]-a[2])
                retained.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(3)))
                break
        else:
            retained.append(points[-1])
        points = retained
        if len(points) < 2:
            return
    # Mesh.beam chooses a new cross-section basis at each segment. Keeping a
    # horizontal facade basis avoids its 0.99-direction threshold twisting rods.
    nx, ny = normal
    w, d = (ny*.0375, -nx*.0375), (nx*.065, ny*.065)
    rings = [[(p[0]+a*w[0]+b*d[0], p[1]+a*w[1]+b*d[1], p[2])
              for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))] for p in points]
    part.face(list(reversed(rings[0])))
    part.face(rings[-1])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(4):
            j = (i+1) % 4
            part.face([lower[i], lower[j], upper[j], upper[i]])


def facade_mullions(part, levels):
    """Fixed square-face coordinates and fixed-u cut-face grids, clipped at the hole."""
    depths = [half_depth(z) for z in levels]

    def height_at_depth(depth):
        # Intersect the actual piecewise-linear glass, not a different curve.
        if depth >= depths[0]:
            return 0.
        if depth <= depths[-1]:
            return HEIGHT
        for lo, hi, a, b in zip(levels, levels[1:], depths, depths[1:]):
            if b <= depth <= a:
                return lo+(hi-lo)*(a-depth)/(a-b)
        raise AssertionError('Depth is outside the loft')

    def emit(lo, hi, position, normal, trim_top=None):
        if hi-lo > .001:
            points = [position(z) for z in [lo]+[z for z in levels if lo < z < hi]+[hi]]
            curtain_mullion(part, points, normal, trim_top)

    # Four original square planes remain flat: each fixed-v rod is one straight
    # strip ending at the diagonal cut, rather than hundreds of 2 m capped bars.
    for su in (-1, 1):
        emit(0., HEIGHT, lambda z: (su*DIAMOND, 0., z), (su, 0.))
        for sv in (-1, 1):
            for k in range(1, math.ceil(DIAMOND*math.sqrt(2)/1.45)):
                v = k*1.45/math.sqrt(2)
                if v < DIAMOND:
                    emit(0., height_at_depth(v), lambda z: (su*(DIAMOND-v), sv*v, z),
                         (su/math.sqrt(2), sv/math.sqrt(2)))
    # The two curved cuts use fixed u, never k/count of the changing edge width.
    # Each path is interrupted exactly where the inclined opening consumes it.
    for side in (-1, 1):
        for k in range(-math.floor(DIAMOND/1.45), math.floor(DIAMOND/1.45)+1):
            u = k*1.45
            if DIAMOND-abs(u) <= depths[-1]:
                continue
            start = height_at_depth(DIAMOND-abs(u))
            opening_start = CANOPY if abs(u) <= 24. else CANOPY+(abs(u)-24.)*(SOFFIT-CANOPY)/6.
            intervals = [(start, HEIGHT)] if abs(u) >= 30. else [
                (start, min(SOFFIT, opening_start)), (max(start, SOFFIT), HEIGHT)]
            for lo, hi in intervals:
                trim_top = CANOPY_TERRACE if abs(u) < CANOPY_CUT_HALF_LENGTH and hi <= SOFFIT else None
                emit(lo, hi, lambda z: (u, side*skin_depth(z, levels), z), (0., side), trim_top)
    # The exposed aperture jambs are planar in u/Z; rods keep fixed v until the
    # narrowing outer skin clips them. Jamb boundary frames are authored below.
    for side in (-1, 1):
        for k in range(-math.floor(half_depth(CANOPY)/1.45), math.floor(half_depth(CANOPY)/1.45)+1):
            v = k*1.45
            emit(CANOPY, min(SOFFIT, height_at_depth(abs(v))),
                 lambda z: (side*aperture(z), v, z), (-side, 0.))


def canopy_frame(part, u):
    """One fixed, shallow double-pitch I-section; not a movable roof mechanism."""
    width, height, flange, web = .24, .36, .05, .05  # Estimated section dimensions.
    w, h, t = width*.5, height*.5, web*.5
    # CCW in u/Z faces -v. Concave end caps must remain polygons: a triangle
    # fan would incorrectly fill the visible recesses either side of the web.
    cross = [(-w, -h), (w, -h), (w, -h+flange), (t, -h+flange),
             (t, h-flange), (w, h-flange), (w, h), (-w, h),
             (-w, h-flange), (-t, h-flange), (-t, -h+flange), (-w, -h+flange)]
    # The upper flange meets the glazing plane; the former 40 mm air gap
    # floated the panels above their support. The round beams move with it.
    rings = [[(u+x, v, CANOPY_EAVE-h+rise+z) for x, z in cross]
             for v, rise in ((-CANOPY_HALF_WIDTH, 0.), (0., CANOPY_RISE),
                             (CANOPY_HALF_WIDTH, 0.))]
    part.face(rings[0])
    part.face(list(reversed(rings[-1])))
    for a, b in zip(rings, rings[1:]):
        for i in range(len(cross)):
            j = (i+1) % len(cross)
            part.face([a[i], b[i], b[j], a[j]])


def canopy_details(parts, levels):
    """Static glazing over the photographed fixed framework; opening unknown."""
    glass, frame = parts['top_glass'], parts['frame']
    length, width = CANOPY_HALF_LENGTH, CANOPY_HALF_WIDTH
    stations = [-length+i*CANOPY_BAY for i in range(round(2*length/CANOPY_BAY)+1)]

    def roof_z(v):
        return CANOPY_EAVE+CANOPY_RISE*(1-abs(v)/width)

    # Keep exposed strips beside the raised canopy, not a flat full-width lid.
    depth = skin_depth(CANOPY_TERRACE, levels)
    terrace = [(-length, -depth), (length, -depth), (length, depth), (-length, depth)]
    for side in (-1, 1):
        horizontal(frame, clip(terrace, 1, side*width, side > 0), CANOPY_TERRACE)
        horizontal(frame, clip(plan(CANOPY-.05), 0, side*length, side > 0), CANOPY-.05)
        frame.beam((-length, side*CANOPY_TUBE_V, CANOPY_TUBE_Z),
                   (length, side*CANOPY_TUBE_V, CANOPY_TUBE_Z),
                   CANOPY_TUBE_DIAMETER, sides=24)
        for z in (FLOOR_97+.18, 441.40, CANOPY_EAVE):
            frame.beam((-length, side*width, z), (length, side*width, z), .095, .12)
    for u in stations:
        canopy_frame(frame, u)
        for side in (-1, 1):
            frame.beam((u, side*width, FLOOR_97+.18), (u, side*width, CANOPY_EAVE), .12, .15)

    # Independent closed panes use ordinary PBR transmission, without the
    # full tower's opaque office-window shader or any invented opening rig.
    divisions = [-width, -width*.5, 0., width*.5, width]
    for v in divisions:
        # Rectangular glazing bars overlap the I-flange by 60 mm and enclose
        # panel edges; a diamond-section beam previously missed both surfaces.
        box(frame, (-length, v-.04, roof_z(v)-.06), (length, v+.04, roof_z(v)+.015))
    for u0, u1 in zip(stations, stations[1:]):
        a, b = u0+.12, u1-.12  # Meet the .24 m flange edge without an open seam.
        for v0, v1 in zip(divisions, divisions[1:]):
            c, d = v0+.03, v1-.03
            points = [(a, c, roof_z(c)), (b, c, roof_z(c)),
                      (b, d, roof_z(d)), (a, d, roof_z(d))]
            thin_panel(glass, points, (0., 0., -GLASS_THICKNESS), [(p[0], p[1]) for p in points])
        for side in (-1, 1):
            v = side*width
            # Pane edges enter the existing post/rail section, rather than
            # retaining the much wider roof-frame inset and leaving air gaps.
            for z0, z1 in ((FLOOR_97+.21, 441.37), (441.43, CANOPY_EAVE-.02)):
                points = [(u0+.035, v, z0), (u1-.035, v, z0),
                          (u1-.035, v, z1), (u0+.035, v, z1)]
                if side > 0:
                    points.reverse()
                thin_panel(glass, points, (0., -side*GLASS_THICKNESS, 0.), [(p[0], p[2]) for p in points])


def soffit_details(parts):
    """IMA4 / KPF P3: two pale fields, a narrow dark centre and panel seams.

    Bright appearance does not establish metal or self-illumination. These
    candidate widths, thickness and seam spacing are unmeasured estimates.
    """
    polygon = plan(SOFFIT)
    bands = ((-DIAMOND, -SOFFIT_DARK_HALF_WIDTH, 'soffit_panels'),
             (-SOFFIT_DARK_HALF_WIDTH, SOFFIT_DARK_HALF_WIDTH, 'mechanical'),
             (SOFFIT_DARK_HALF_WIDTH, DIAMOND, 'soffit_panels'))
    for start, end, role in bands:
        cell = clip(clip(polygon, 1, start, True), 1, end, False)
        points = [(*p, SOFFIT) for p in reversed(cell)]
        thin_panel(parts[role], points, (0., 0., SOFFIT_PANEL_THICKNESS))
    # Retain the prior transverse frames; long seams divide each pale field
    # and continuous edge frames meet the narrow upper side-window band.
    for v in (-SOFFIT_DARK_HALF_WIDTH, SOFFIT_DARK_HALF_WIDTH, -2.7, 2.7,
              -half_depth(SOFFIT)+.10, half_depth(SOFFIT)-.10):
        parts['soffit'].beam((-30., v, SOFFIT-.085), (30., v, SOFFIT-.085), .065, .14)


def crown_details(parts):
    """Photographed enclosed longitudinal trough; dimensions/equipment estimated."""
    frame, dark = parts['frame'], parts['mechanical']
    length, width, bottom = CROWN_SLOT_HALF_LENGTH, CROWN_SLOT_HALF_WIDTH, CROWN_SLOT_FLOOR
    if not (ROOM_TOP < bottom < HEIGHT and 0 < width < half_depth(HEIGHT)
            and 0 < length < DIAMOND-half_depth(HEIGHT)):
        raise RuntimeError('Crown recess must stay inside the retained upper envelope')
    # Remove only the rectangular inset from the 492 m cap, preserving the
    # candidate's narrow outer envelope and closing the slot within both tips.
    top = plan(HEIGHT)
    central = clip(clip(top, 0, -length, True), 0, length, False)
    for side in (-1, 1):
        horizontal(frame, clip(top, 0, side*length, side > 0), HEIGHT)
        horizontal(frame, clip(central, 1, side*width, side > 0), HEIGHT)
    floor = [(-length, -width), (length, -width), (length, width), (-length, width)]
    horizontal(dark, floor, bottom)
    # Reverse the usual exterior loft: the four visible walls face into the
    # recess. Its floor is sealed well above the observation-room ceiling.
    for a, b in zip(floor, floor[1:]+floor[:1]):
        clean_face(frame, [(*a, bottom), (*a, HEIGHT), (*b, HEIGHT), (*b, bottom)])
    # Unequal groups separated by a long dark central run, not an invented
    # catalogue of specific machines or a uniform full-length repeated array.
    for u0, u1, half_width, height in ((-28., -24., .28, .45), (-20., -18.3, .23, .28),
                                     (-14.5, -12.6, .29, .58), (10.5, 13.2, .25, .38),
                                     (17.4, 19., .27, .63), (25.2, 29.8, .24, .48)):
        box(frame, (u0, -half_width, bottom), (u1, half_width, bottom+height))
    for u in (-31., -8., 22.):
        box(frame, (u-.075, -width, bottom+.60), (u+.075, width, bottom+.72))


def build_parts():
    """Six preserved roles and two independent materials, in diagonal axes."""
    parts = {key: Mesh() for key in OUTPUT_IDS}
    # Include aperture boundaries exactly: no rod or glass face spans the void.
    levels = sorted(set([float(z) for z in range(0, 493, 2)] + [z for z, _ in PROFILE]
                        + [FLOOR_97, CANOPY, SOFFIT, FLOOR_100, ROOM_TOP, EQUIPMENT_TOP]))
    for bottom, top in zip(levels, levels[1:]):
        piers = (-1, 1) if CANOPY <= bottom < top <= SOFFIT else (None,)
        for pier in piers:
            lower, upper = section(bottom, pier), section(top, pier)
            loft(parts['glass'], lower, upper, bottom, top, fixed_facade_uv=True)
        # Six silhouette seams, restrained lighting inherited from the source.
        for a, b in zip(plan(bottom), plan(top), strict=True):
            parts['light'].beam((*a, bottom+.035), (*b, top-.035), .035, .065)
    parts['glass'] = trim_canopy_facade(parts['glass'])
    facade_mullions(parts['rails'], levels)
    horizontal(parts['frame'], plan(0), 0, False)
    crown_details(parts)
    for z in [i*4.4 for i in range(1, 112)] + [FLOOR_97, CANOPY, FLOOR_100, ROOM_TOP, EQUIPMENT_TOP, 491.8]:
        for pier in ((-1, 1) if CANOPY < z < SOFFIT else (None,)):
            polygon = section(z, pier)
            for a, b in zip(polygon, polygon[1:]+polygon[:1]):
                if z == CANOPY and abs(a[1]-b[1]) < 1e-8:
                    # The central 444 m rail belonged to the removed wall.
                    for side in (-1, 1):
                        segment = clip([a, b], 0, side*CANOPY_CUT_HALF_LENGTH, side > 0)
                        if len(segment) >= 2:
                            boundary_beam(parts['rails'], segment[0], segment[1], z, .095, .16)
                else:
                    boundary_beam(parts['rails'], a, b, z, .095, .16)
    # The six original mechanical-band levels remain recognizable. Upper crown
    # louver bands are visually separate from the estimated 100F room above 474.
    def band_plan(z):
        # Offset every supporting plane outwards by 40 mm. Coplanar glass and
        # mechanical lofts otherwise alternate with view angle/depth precision.
        c, a = half_depth(z)+.04, DIAMOND+.04*math.sqrt(2)
        return [(-a, 0.), (-a+c, -c), (a-c, -c), (a, 0.), (a-c, c), (-a+c, c)]
    for z in [77., 154., 231., 308., 385., 439., 479.0, 483.0, 487.0, 490.0]:
        loft(parts['mechanical'], band_plan(z-.22), band_plan(z+.22), z-.22, z+.22)
    for pier in (-1, 1):
        # Inclined jamb frame at both visible sides of the open aperture.
        for side in (-1, 1):
            parts['frame'].beam((pier*aperture(CANOPY), side*half_depth(CANOPY), CANOPY+.16),
                                (pier*aperture(SOFFIT), side*half_depth(SOFFIT), SOFFIT-.16), .24, .32)
    # Confirmed 97F floor; photographed fixed canopy structure is above it.
    horizontal(parts['frame'], plan(FLOOR_97), FLOOR_97)
    canopy_details(parts, levels)
    for z in (CANOPY_TERRACE, SOFFIT+.13):
        w = aperture(max(CANOPY, min(SOFFIT, z)))
        d = skin_depth(z, levels) if z == CANOPY_TERRACE else half_depth(z)
        for side in (-1, 1):
            parts['frame'].beam((-w, side*d, z), (w, side*d, z), .18, .25)
    # The 100F floor, lower structural soffit and room ceiling are distinct.
    # Three longitudinal glass bands fit within a 55 m corridor. Their panel
    # dimensions and structural build-up are estimates; old material IDs stay.
    soffit_details(parts)
    for z, upward in ((FLOOR_100, True),):
        polygon = plan(z)
        for u0, u1 in zip((-DIAMOND, -27.5, 27.5), (-27.5, 27.5, DIAMOND)):
            for v0, v1 in zip((-DIAMOND, -2.4, -1.6, -.4, .4, 1.6, 2.4),
                              (-2.4, -1.6, -.4, .4, 1.6, 2.4, DIAMOND)):
                cell = clip(clip(clip(clip(polygon, 0, u0, True), 0, u1, False), 1, v0, True), 1, v1, False)
                glass = u0 == -27.5 and (v0, v1) in ((-2.4, -1.6), (-.4, .4), (1.6, 2.4))
                horizontal(parts['glass' if glass else 'frame'], cell, z, upward)
    for z, upward in ((SOFFIT, False), (FLOOR_100, True)):
        # Beams lie below the bridge soffit and above the floor, not behind them.
        beam_z = z-.085 if not upward else z+.045
        for u in [i*2.5 for i in range(-12, 13)]:
            d = min(half_depth(z), DIAMOND-abs(u))-.18
            parts['soffit'].beam((u, -d, beam_z), (u, d, beam_z), .11, .14)
    horizontal(parts['frame'], plan(ROOM_TOP), ROOM_TOP, False)
    for z in (EQUIPMENT_TOP, 491.6):
        polygon = plan(z)
        for a, b in zip(polygon, polygon[1:]+polygon[:1]):
            boundary_beam(parts['frame'], a, b, z, .15, .19)
    return parts


def mesh_digest(mesh):
    """Matches the independent audit's little-endian coordinate/index digest."""
    digest = hashlib.sha256()
    for vertex in mesh.vertices:
        digest.update(struct.pack('<3d', *vertex.co))
    for face in mesh.polygons:
        digest.update(struct.pack('<'+'I'*len(face.vertices), *face.vertices))
    return digest.hexdigest()


def props(value):
    def plain(item):
        if hasattr(item, 'to_dict'):
            return {k: plain(v) for k, v in item.to_dict().items()}
        if hasattr(item, 'to_list'):
            return [plain(v) for v in item.to_list()]
        if isinstance(item, dict):
            return {k: plain(v) for k, v in item.items()}
        if isinstance(item, (list, tuple)):
            return [plain(v) for v in item]
        return item
    return {key: plain(value[key]) for key in value.keys()}


def close_matrix(actual, expected, tolerance=.0002):
    return all(abs(actual[i][j]-expected[i][j]) <= tolerance for i in range(4) for j in range(4))


def runtime_id_snapshot(scene):
    """Keep unique logical IDs and the importer's anonymous GPU instances.

    Blender's glTF imp/vnode.py::manage_gpu_instancing expands a logical node
    into children without extras; import_scene.py marks those children for
    export too. Their existing identified parent owns spaceInstanceCount.
    """
    exported = [o for o in scene.objects if o.get('space_export')]
    ids = Counter(o.get('spaceId') for o in exported)
    invalid = [(sid, count) for sid, count in ids.items()
               if sid is not None and (not isinstance(sid, str) or not sid or count != 1)]
    if invalid:
        raise RuntimeError('Missing or duplicated logical runtime IDs: '+repr(invalid[:8]))
    anonymous = Counter()
    for obj in exported:
        if obj.get('spaceId') is not None:
            continue
        parent = obj.parent
        if (obj.type != 'MESH' or parent is None or parent.type != 'EMPTY'
                or not parent.get('space_export') or not parent.get('spaceId')
                or not isinstance(parent.get('spaceInstanceCount'), int)
                or parent['spaceInstanceCount'] < 1):
            raise RuntimeError('Unidentified export object is not an imported GPU instance: '+obj.name)
        anonymous[parent] += 1
    for parent, count in anonymous.items():
        if count != parent['spaceInstanceCount']:
            raise RuntimeError('Imported instance count changed for '+parent.name+': '+str(count))
    return ids


def check_source(root, audit):
    scene = bpy.context.scene
    if (Path(bpy.data.filepath).resolve() != SOURCE or scene.get('space_asset') != 'shanghai'
            or scene.get('space_contract') != 2 or scene.unit_settings.scale_length != 1):
        raise RuntimeError('Open the current contract-v2 canonical Shanghai source, in metres')
    if (root.get('spaceId') != ROOT_ID or not root.get('space_export') or root.get(PROPERTY)
            or root.get('spaceAuthoringRevision') != 'shanghai-landmarks-20260908'):
        raise RuntimeError('Expected the audited SWFC revision; do not overwrite subsequent authoring')
    if (audit.get('source_stat_unchanged') is not True or audit['root']['spaceId'] != ROOT_ID
            or not close_matrix(root.matrix_world, audit['root']['matrix_world'])):
        raise RuntimeError('Invalid audit or changed root world transform')
    if props(root) != audit['root']['properties']:
        raise RuntimeError('SWFC metadata drifted from the independent audit; inspect first')
    records = {record['spaceId']: record for record in audit['meshes']}
    targets = {o.get('spaceId'): o for o in root.children_recursive if o.get('space_export')}
    if set(targets) != set(IDS.values()) or set(records) != set(IDS.values()):
        raise RuntimeError('Expected exactly the six audited SWFC runtime children')
    for key, expected in audit['scene_properties'].items():
        if key.endswith('Revision') and scene.get(key) != expected:
            raise RuntimeError('Prior scene revision changed since audit: '+key)
    for sid, obj in targets.items():
        record = records[sid]
        if (obj.type != 'MESH' or obj.parent != root or obj.modifiers or obj.data.shape_keys
                or not close_matrix(obj.matrix_basis, Matrix.Identity(4), 1e-7)
                or not close_matrix(obj.matrix_parent_inverse, Matrix.Identity(4), 1e-7)
                or len(obj.data.materials) != 1 or not obj.data.materials[0]
                or props(obj) != record['properties']
                or mesh_digest(obj.data) != record['mesh_fingerprint_vertices_and_polygon_indices_sha256']):
            raise RuntimeError('Audited mesh, identity or local transform changed: '+sid)
        expected = record['materials'][0]
        if props(obj.data.materials[0]) != expected['properties']:
            raise RuntimeError('Material runtime contract changed: '+sid)
    return targets


def make_top_material(role):
    """Fresh single-purpose PBR material; never inherit tower shader extras."""
    glass = role == 'top_glass'
    material = bpy.data.materials.new('SWFC top glass' if glass else 'SWFC soffit panels')
    material.use_nodes = True
    material.use_backface_culling = True  # Closed solids already have inner faces.
    rgb = (.965, .985, .99) if glass else (.82, .835, .83)
    color = tuple(linear(v) for v in rgb) + (1.,)
    material.diffuse_color = color
    material.metallic, material.roughness = 0., .12 if glass else .58
    # Display names may be translated or changed; RNA types/identifiers are stable.
    nodes = material.node_tree.nodes
    node = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if node is None:
        node = nodes.new('ShaderNodeBsdfPrincipled')
    output = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if output is None:
        output = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(next(s for s in node.outputs if s.identifier == 'BSDF'),
                                 next(s for s in output.inputs if s.identifier == 'Surface'))
    values = {'Base Color': color, 'Metallic': material.metallic, 'Roughness': material.roughness,
              'Alpha': 1., 'Emission Strength': 0., 'Transmission Weight': .9 if glass else 0., 'IOR': 1.45}
    for identifier, value in values.items():
        next(s for s in node.inputs if s.identifier == identifier).default_value = value
    material['spaceMaterialId'] = EXTRA_MATERIAL_IDS[role]
    material['spaceSwfcTopMaterialRole'] = role
    material['spaceOpticsEstimated'] = True
    return material


def candidate_mesh(part, name, bridge_angle_deg):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p, bridge_angle_deg) for p in part.vertices], [], part.faces)
    data.update()
    layer = data.uv_layers.new(name='UVMap')
    for loop in data.loops:
        layer.data[loop.index].uv = part.uv[loop.vertex_index]
    return data


def validate_canopy_junctions(tree):
    """First surfaces distinguish the terrace opening from the old outer wall."""
    count = 0
    for u in (-20., .75, 20.):
        for side in (-1, 1):
            for z in (441.5, 442.5, 443.8):
                if tree.ray_cast(Vector((u, side*12., z)), Vector((0., -side, 0.)), 5.05)[0] is not None:
                    raise RuntimeError('Old outer glass, mullion or edge beam still encloses the canopy terrace')
                count += 1
            for z in (441.8, 443.):
                hit, normal, _, _ = tree.ray_cast(Vector((u, side*12., z)), Vector((0., -side, 0.)), 6.)
                if hit is None or abs(hit[1]-side*CANOPY_HALF_WIDTH) > .01 or normal[1]*side < .99:
                    raise RuntimeError('First visible canopy side window is hidden, missing or inverted')
                count += 1
    for u in (-28., 28.):
        for side in (-1, 1):
            hit = tree.ray_cast(Vector((u, side*12., 442.5)), Vector((0., -side, 0.)), 5.)[0]
            if hit is None or abs(hit[1]) < 9.3:
                raise RuntimeError('Local canopy trim removed a retained end pier')
            count += 1
    # Either side of transverse and longitudinal glazing-frame joints must
    # have a roof surface; a first hit several metres lower is an open seam.
    for u, v in ((1.618, 1.3), (1.622, 1.3), (.75, 3.362), (.75, 3.358), (.75, 3.438), (.75, 3.442)):
        hit, normal, _, _ = tree.ray_cast(Vector((u, v, 444.5)), Vector((0., 0., -1.)), 2.)
        expected = CANOPY_EAVE+CANOPY_RISE*(1-abs(v)/CANOPY_HALF_WIDTH)
        if hit is None or abs(hit.z-expected) > .03 or normal.z < .99:
            raise RuntimeError('Canopy glazing has an open joint against its supporting frame')
        count += 1
    for u, z in ((1.46, 440.2), (1.54, 440.2), (.75, 441.36), (.75, 441.38), (.75, 441.42), (.75, 441.44)):
        hit = tree.ray_cast(Vector((u, 7.3, z)), Vector((0., -1., 0.)), 1.)[0]
        if hit is None or abs(hit[1]-CANOPY_HALF_WIDTH) > .08:
            raise RuntimeError('Canopy side glazing has an open post or rail joint')
        count += 1
    # Separate real meshes let these two rays see the mating surfaces, rather
    # than hiding an air gap behind an unrelated frame in the combined BVH.
    iframe, tube = Mesh(), Mesh()
    canopy_frame(iframe, 1.5)
    tube.beam((-CANOPY_HALF_LENGTH, CANOPY_TUBE_V, CANOPY_TUBE_Z),
              (CANOPY_HALF_LENGTH, CANOPY_TUBE_V, CANOPY_TUBE_Z), CANOPY_TUBE_DIAMETER, sides=24)
    frame_tree = BVHTree.FromPolygons(iframe.vertices, iframe.faces, all_triangles=False)
    tube_tree = BVHTree.FromPolygons(tube.vertices, tube.faces, all_triangles=False)
    lower = frame_tree.ray_cast(Vector((1.5, CANOPY_TUBE_V, 442.5)), Vector((0., 0., 1.)), 1.)[0]
    upper = tube_tree.ray_cast(Vector((1.5, CANOPY_TUBE_V, 443.2)), Vector((0., 0., -1.)), 1.)[0]
    if lower is None or upper is None or not 0 < upper.z-lower.z < .02:
        raise RuntimeError('Round longitudinal beam floats below or penetrates too far into the I frame')
    return {'surfaceProbes': count, 'roundBeamFrameOverlap': float(upper.z-lower.z),
            'outerTrimU': [-CANOPY_CUT_HALF_LENGTH, CANOPY_CUT_HALF_LENGTH],
            'outerTrimZ': [CANOPY_TERRACE, CANOPY]}


def validate_geometry(parts):
    all_points, all_faces = [], []
    for key, part in parts.items():
        if not part.vertices or not part.faces or len(part.uv) != len(part.vertices):
            raise RuntimeError('Missing geometry/UV role: '+key)
        if any(not math.isfinite(c) for p in part.vertices for c in p):
            raise RuntimeError('Non-finite candidate geometry: '+key)
        offset = len(all_points)
        all_points.extend(part.vertices)
        all_faces.extend([tuple(offset+i for i in face) for face in part.faces])
    if min(p[2] for p in all_points) < -.001 or max(p[2] for p in all_points) > HEIGHT+.001:
        raise RuntimeError('Geometry exceeds the preserved 0..492 m height contract')
    tree = BVHTree.FromPolygons(all_points, all_faces, all_triangles=False)
    # These are real rays against all eight candidate meshes, including detail.
    for z in (445., 450., 460., 470.):
        for u in (-10., 0., 10.):
            if tree.ray_cast(Vector((u, -60., z)), Vector((0., 1., 0.)), 120.)[0] is not None:
                raise RuntimeError('Mesh or decoration blocks the open aperture')
    floor_hits = []
    for u in [-27.5+i*.5 for i in range(111)]:
        for v in (-1., -.2, 0., .2, 1.):
            hit, normal, _, _ = tree.ray_cast(Vector((u, v, FLOOR_100+.25)), Vector((0., 0., -1.)), .5)
            if hit is None or abs(hit.z-FLOOR_100) > .13 or normal.z < .99:
                raise RuntimeError('100F lacks the continuous 55 m floor corridor')
            floor_hits.append(float(hit.z))
    floor97_hits, soffit_hits = [], []
    # Probe glass and metal, away from the 2.5 m cross beams. BVH normals are
    # original geometric winding, unlike Three intersection.normal which can
    # be flipped to face the ray. The first visible underside must face down.
    for u in (-26.75, -13.25, .75, 13.25, 26.75):
        for v in (-2., -1., 0., 1., 2.):
            hit, normal, _, _ = tree.ray_cast(Vector((u, v, FLOOR_97+.25)), Vector((0., 0., -1.)), .5)
            if hit is None or abs(hit.z-FLOOR_97) > .01 or normal.z < .99:
                raise RuntimeError('97F floor is missing or faces downward')
            floor97_hits.append(float(hit.z))
            hit, normal, _, _ = tree.ray_cast(Vector((u, v, SOFFIT-1.)), Vector((0., 0., 1.)), 1.5)
            if hit is None or abs(hit.z-SOFFIT) > .01 or normal.z > -.99 or hit.z >= FLOOR_100:
                raise RuntimeError('First visible bridge soffit must face down below 474 m')
            soffit_hits.append(float(hit.z))
    # A bridge must close the hole before 474 m, and its ceiling cannot fill
    # the room: separate rays verify the estimated room and equipment boundary.
    for z in (473., 476.):
        if tree.ray_cast(Vector((0., -60., z)), Vector((0., 1., 0.)), 120.)[0] is None:
            raise RuntimeError('Bridge or observation room side envelope missing')
    # Local first-hit checks catch a retained flat lid hiding the new raised
    # roof or trough. Points avoid cross frames, glass divisions and equipment.
    detail_hits = {}
    for name, u, v, expected in (
            ('canopySlope', 0., 1.30, CANOPY_EAVE+CANOPY_RISE*(1-1.30/CANOPY_HALF_WIDTH)),
            ('canopySideTerrace', 0., 7.80, CANOPY_TERRACE),
            ('crownTroughFloor', 0., 0., CROWN_SLOT_FLOOR),
            ('crownHighRim', 0., .65, HEIGHT),
            ('crownEquipment', -26., 0., CROWN_SLOT_FLOOR+.45)):
        origin_z = 444.50 if name.startswith('canopy') else HEIGHT+1.
        hit, normal, _, _ = tree.ray_cast(Vector((u, v, origin_z)), Vector((0., 0., -1.)), 5.)
        if hit is None or abs(hit.z-expected) > .015 or normal.z < .99:
            raise RuntimeError('Canopy/crown first surface is missing, hidden or inverted: '+name)
        detail_hits[name] = float(hit.z)
    return {'apertureRaysClear': 12, 'floorCorridorLength': 55., 'floorProbes': len(floor_hits),
            'floorHitMinMax': [min(floor_hits), max(floor_hits)],
            'floor97Probes': len(floor97_hits), 'floor97HitMinMax': [min(floor97_hits), max(floor97_hits)],
            'soffitProbes': len(soffit_hits), 'soffitHitMinMax': [min(soffit_hits), max(soffit_hits)],
            'floorNormalsUpAndSoffitNormalsDown': True,
            'canopyAndCrownFirstHitHeights': detail_hits,
            'canopyJunctions': validate_canopy_junctions(tree),
            'topMaterialGeometry': validate_top_material_geometry(parts),
            'totalVertices': sum(len(p.vertices) for p in parts.values()),
            'totalFaces': sum(len(p.faces) for p in parts.values()),
            'parts': {k: {'vertices': len(p.vertices), 'faces': len(p.faces)} for k, p in parts.items()}}


def validate_top_material_geometry(parts):
    """First hits on both sides reject single-sided panes and reversed winding."""
    trees = {key: BVHTree.FromPolygons(parts[key].vertices, parts[key].faces, all_triangles=False)
             for key in ('top_glass', 'soffit_panels', 'mechanical')}
    probes = 0
    for u in (-20., .75, 20.):
        for side in (-1, 1):
            v = side*1.3
            roof = CANOPY_EAVE+CANOPY_RISE*(1-abs(v)/CANOPY_HALF_WIDTH)
            for origin, direction, expected, sign in (
                    ((u, v, roof+.2), (0., 0., -1.), roof, 1),
                    ((u, v, roof-.2), (0., 0., 1.), roof-GLASS_THICKNESS, -1)):
                hit, normal, _, _ = trees['top_glass'].ray_cast(Vector(origin), Vector(direction), .3)
                if hit is None or abs(hit.z-expected) > .001 or normal.z*sign < .99:
                    raise RuntimeError('Top glass roof is not a closed outward-wound thin pane')
                probes += 1
            for origin_v, direction_v, expected, sign in (
                    (side*7., -side, side*CANOPY_HALF_WIDTH, side),
                    (side*6.6, side, side*(CANOPY_HALF_WIDTH-GLASS_THICKNESS), -side)):
                hit, normal, _, _ = trees['top_glass'].ray_cast(Vector((u, origin_v, 442.)), Vector((0., direction_v, 0.)), .3)
                if hit is None or abs(hit[1]-expected) > .001 or normal[1]*sign < .99:
                    raise RuntimeError('Top glass side window is not a closed outward-wound thin pane')
                probes += 1
        for v, key in ((-1., 'soffit_panels'), (0., 'mechanical'), (1., 'soffit_panels')):
            hit, normal, _, _ = trees[key].ray_cast(Vector((u, v, SOFFIT-.2)), Vector((0., 0., 1.)), .3)
            if hit is None or abs(hit.z-SOFFIT) > .001 or normal.z > -.99:
                raise RuntimeError('Soffit light/dark material zone is missing or reversed')
            probes += 1
    return {'surfaceProbes': probes, 'closedGlassThickness': GLASS_THICKNESS,
            'soffitPanelThickness': SOFFIT_PANEL_THICKNESS,
            'soffitDarkHalfWidth': SOFFIT_DARK_HALF_WIDTH}


def author(root, archive, bridge_angle_deg, audit_path=AUDIT):
    """Replace six data pointers in memory; coordinator owns any later save."""
    xyz((1., 0., 0.), bridge_angle_deg)  # Reject invalid direction before any edit.
    audit = json.loads(Path(audit_path).read_text(encoding='utf8'))
    targets = check_source(root, audit)
    parts = build_parts()
    geometry = validate_geometry(parts)
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    before_ids = runtime_id_snapshot(scene)
    if any(o.get('spaceId') in EXTRA_IDS.values() for o in bpy.data.objects):
        raise RuntimeError('New SWFC detail identity already exists; inspect the later revision')
    if any(m.get('spaceMaterialId') in EXTRA_MATERIAL_IDS.values() for m in bpy.data.materials):
        raise RuntimeError('New SWFC material identity already exists')
    before_lighting = export_snapshot(scene)
    before_objects = {o: (o.parent, o.matrix_world.copy(), o.data, props(o)) for o in scene.objects}
    old_meshes = {o.data: mesh_digest(o.data) for o in targets.values()}
    materials = {m: (props(m), tuple(m.diffuse_color), m.metallic, m.roughness)
                 for o in targets.values() for m in o.data.materials}
    images = {im: hashlib.sha256(bytes(im.packed_file.data)).hexdigest()
              for im in bpy.data.images if im.packed_file}
    before_scene = props(scene)
    old_root_properties = props(root)
    archive.hide_render = archive.hide_viewport = True
    if archive.objects:
        raise RuntimeError('Use an empty dedicated archive collection')
    for key, sid in IDS.items():
        obj, part = targets[sid], parts[key]
        archive_mesh(obj, archive)
        backup = next(o for o in archive.objects if o.get('archivedSpaceId') == sid)
        backup.name = 'Before '+REVISION+' '+obj.name
        backup['swfcOriginalObjectName'] = obj.name
        backup['swfcOriginalRootProperties'] = old_root_properties
        backup.hide_set(True)
        data = candidate_mesh(part, obj.data.name+' '+REVISION, bridge_angle_deg)
        for material in obj.data.materials:
            data.materials.append(material)
        for name, value in props(obj.data).items():
            data[name] = value
        # Never mutate the old mesh (including custom normals and other users).
        obj.data = data
    for key, sid in EXTRA_IDS.items():
        name = sid.rsplit('/', 1)[1]
        data = candidate_mesh(parts[key], name, bridge_angle_deg)
        data.materials.append(make_top_material(key))
        obj = bpy.data.objects.new(name, data)
        root.users_collection[0].objects.link(obj)
        obj.parent = root
        obj.matrix_basis = obj.matrix_parent_inverse = Matrix.Identity(4)
        for field, value in {'spaceId': sid, 'spaceName': name, 'space_export': True,
                             'spaceVisible': True, 'spaceCastShadow': key != 'top_glass',
                             'spaceReceiveShadow': True, 'spaceSwfcTopRole': key}.items():
            obj[field] = value
    bpy.context.view_layer.update()
    for obj, (parent, matrix, data, properties) in before_objects.items():
        if obj.parent != parent or not close_matrix(obj.matrix_world, matrix, 1e-7) or props(obj) != properties:
            raise RuntimeError('Original object state changed beyond mesh data: '+obj.name)
        if obj not in targets.values() and obj.data != data:
            raise RuntimeError('Non-SWFC object data changed: '+obj.name)
    if any(mesh_digest(data) != digest for data, digest in old_meshes.items()):
        raise RuntimeError('Original mesh data was mutated, including possible shared users')
    if before_ids + Counter(EXTRA_IDS.values()) != runtime_id_snapshot(scene):
        raise RuntimeError('Export identities changed')
    if len(archive.objects) != 6 or any(o.get('spaceId') or o.get('space_export') for o in archive.objects):
        raise RuntimeError('Archive duplicates runtime identity or remains exportable')
    if props(scene) != before_scene or any((props(m), tuple(m.diffuse_color), m.metallic, m.roughness) != state
                                          for m, state in materials.items()):
        raise RuntimeError('Scene metadata or an existing material changed')
    if any(hashlib.sha256(bytes(im.packed_file.data)).hexdigest() != digest for im, digest in images.items()):
        raise RuntimeError('Packed image changed')
    if export_snapshot(scene) != before_lighting:
        raise RuntimeError('Previously authored facade lighting changed')
    world_u = root.matrix_world.to_3x3() @ Vector(xyz((1., 0., 0.), bridge_angle_deg))
    world_v = root.matrix_world.to_3x3() @ Vector(xyz((0., 1., 0.), bridge_angle_deg))
    detail = {'revision': REVISION, 'candidateOnly': True, 'bridgeAngleLocalDegrees': bridge_angle_deg,
              'baseEdgeAngleLocalDegrees': bridge_angle_deg+45.,
              'baseFootprint': '58 m square retained in size and centre; mesh-local yaw is an explicit candidate',
              'worldLongAxisBlender': list(world_u), 'worldOpeningNormalBlender': list(world_v),
              'siteOrientationConfirmed': False,
              'orientationEvidence': {'longAxis': 'NE-SW supported by Quan et al. 2013, Fig. 2 and Fig. 5',
                  'doi': '10.1155/2013/902643', 'exactYawSurveyed': False,
                  'angleMeaning': 'Explicit root-local estimate; the literature diagonal does not establish this exact angle'},
              'heightBasis': 'root-local above-ground metres; world Z offset preserved',
              'floor97': FLOOR_97, 'floor100': FLOOR_100, 'height': HEIGHT,
              'estimated': {'profileHalfDepth': PROFILE, 'canopy': CANOPY, 'bridgeSoffit': SOFFIT,
                            'observationRoomTop': ROOM_TOP, 'equipmentTop': EQUIPMENT_TOP,
                            'apertureHalfWidthBottomTop': [24., 30.], 'topEnvelopeTipSpan': 2*DIAMOND,
                            'frameGridAndFloorGlassDimensions': True,
                            'canopyFixedStructure': {'halfLength': CANOPY_HALF_LENGTH, 'halfWidth': CANOPY_HALF_WIDTH,
                                'eave': CANOPY_EAVE, 'ridge': CANOPY_EAVE+CANOPY_RISE, 'baySpacing': CANOPY_BAY,
                                'terrace': CANOPY_TERRACE, 'longBeamDiameter': CANOPY_TUBE_DIAMETER,
                                'longBeamCentreHeight': CANOPY_TUBE_Z,
                                'outerSkinTrimHalfLength': CANOPY_CUT_HALF_LENGTH,
                                'iSectionWidthHeightFlangeWeb': [.24, .36, .05, .05],
                                'glazingState': 'Static closed panels; opening mechanism and stowage are unverified'},
                            'topGlass': {'thicknessVerticalOrInward': GLASS_THICKNESS,
                                'transmission': .9, 'roughness': .12, 'ior': 1.45,
                                'baseColorSRGB': [.965, .985, .99], 'metalness': 0,
                                'scope': '97F canopy and side panes only; existing 100F floor glass unchanged'},
                            'soffitPanels': {'darkHalfWidth': SOFFIT_DARK_HALF_WIDTH,
                                'thicknessAboveSoffit': SOFFIT_PANEL_THICKNESS,
                                'longSeamOffsets': [-2.7, 2.7], 'crossFrameSpacing': 2.5,
                                'paleBaseColorSRGB': [.82, .835, .83], 'roughness': .58,
                                'metalness': 0, 'emission': 0,
                                'materialMeaning': 'Pale observed appearance; physical composition unconfirmed'},
                            'crownTrough': {'halfLength': CROWN_SLOT_HALF_LENGTH, 'halfWidth': CROWN_SLOT_HALF_WIDTH,
                                'floor': CROWN_SLOT_FLOOR, 'rim': HEIGHT, 'equipmentGroups': 6,
                                'equipmentMeaning': 'Unidentified estimated simplified blocks; no machine type inferred'}},
              'preservedRuntimeIds': list(IDS.values()), 'archivedMeshes': len(archive.objects),
              'addedRuntimeIds': EXTRA_IDS, 'addedMaterialIds': EXTRA_MATERIAL_IDS,
              'addedObjectTransform': 'Direct SWFC root children; identity basis and parent inverse; vertices use the same explicit bridge angle as the six preserved meshes',
              'preservedPackedImages': len(images), 'sourceAudit': str(audit_path),
              'reference': 'design/space/references/swfc-top.md',
              'photoSupportedDetails': {'canopy': 'IMA4 / KPF P3: shallow pitched fixed frames, round long supports and side glazing',
                  'soffit': 'IMA4 / KPF P3: two broad pale fields around one narrow dark band, longitudinal and transverse seams; no proof of self-lighting or metal',
                  'crown': 'ArcelorMittal HISTAR p34: recessed long trough and unequal equipment groups'},
              'remaining': ['Surveyed site yaw, top curve and crown/bridge dimensions',
                            'As-built panel arrangement and canopy opening mechanism',
                            'Measured canopy optics and physical pale-panel composition',
                            '100F floor glass optics: inherited opaque material is unchanged'],
              **geometry}
    root[PROPERTY] = REVISION
    # JSON avoids mixed nested property arrays and keeps the earlier revision
    # and spaceFacadeDetail intact for source-history/runtime compatibility.
    root['spaceSwfcTopCandidate'] = json.dumps(detail, separators=(',', ':'))
    return detail


def export_geometry_snapshot(root, targets):
    """Use the installed exporter's TRS recipe, including float32 inverse error."""
    from io_scene_gltf2.blender.com import gltf2_blender_math as gltf_math

    result = {}
    for obj in targets:
        if obj != root and (obj.parent != root or obj.type != 'MESH' or obj.modifiers
                or obj.data.shape_keys or obj.matrix_basis != Matrix.Identity(4)
                or obj.matrix_parent_inverse != Matrix.Identity(4)):
            raise RuntimeError('Candidate source is not an identity-basis direct root mesh: '+obj.name)
        # io_scene_gltf2/blender/exp/nodes.py computes local TRS from world
        # matrices, not matrix_basis. At this site's translation the inverse
        # multiply can retain a sub-millimetre residual even for identity basis.
        local = root.matrix_world.inverted_safe() @ obj.matrix_world if obj != root else obj.matrix_world
        trans, rot, scale = local.decompose()
        rot.normalize()
        trans = gltf_math.swizzle_yup_location(trans)
        rot = gltf_math.swizzle_yup_rotation(rot)
        scale = gltf_math.swizzle_yup_scale(scale)
        rotation = [gltf_math.round_if_near(rot[i], 1.0 if i == 0 else 0.0) for i in range(4)]
        result[obj['spaceId']] = {
            'translation': [gltf_math.round_if_near(v, 0.0) for v in trans],
            'rotation': rotation[1:] + rotation[:1],
            'scale': [gltf_math.round_if_near(v, 1.0) for v in scale],
            'world': [list(row) for row in obj.matrix_world],
            'positions': {(v.co.x, v.co.z, -v.co.y) for v in obj.data.vertices} if obj != root else set(),
        }
    return result


def gltf_point(node, point):
    """Apply glTF TRS in double precision, as the browser's Matrix4 does."""
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    rotation = ((1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)),
                (2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)),
                (2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)))
    scale = node.get('scale', [1, 1, 1])
    translation = node.get('translation', [0, 0, 0])
    return tuple(sum(row[j]*point[j]*scale[j] for j in range(3))+translation[i]
                 for i, row in enumerate(rotation))


def validate_export_geometry(document, raw, expected):
    """Require exact emitted TRS and local positions, then bound world error."""
    nodes = document['nodes']
    root_index = next(i for i, n in enumerate(nodes) if n.get('extras', {}).get('spaceId') == ROOT_ID)
    root_node = nodes[root_index]
    child_indices = [i for i, n in enumerate(nodes) if n.get('extras', {}).get('spaceId') in OUTPUT_IDS.values()]
    if (Counter(root_node.get('children', [])) != Counter(child_indices)
            or len(document.get('scenes', [])) != 1 or document.get('scene', 0) != 0
            or document['scenes'][0].get('nodes') != [root_index]):
        raise RuntimeError('Candidate root or direct-child hierarchy did not round-trip')
    json_size = struct.unpack_from('<I', raw, 12)[0]
    bin_size, bin_kind = struct.unpack_from('<II', raw, 20+json_size)
    bin_start = 28+json_size
    if bin_kind != 0x004E4942 or bin_start+bin_size != len(raw):
        raise RuntimeError('Candidate GLB binary chunk missing or malformed')
    records = {}
    for node in nodes:
        sid = node['extras']['spaceId']
        source = expected[sid]
        if ('matrix' in node or (sid != ROOT_ID and node.get('children'))
                or any(node.get(key, default) != source[key] for key, default in (
                    ('translation', [0, 0, 0]), ('rotation', [0, 0, 0, 1]), ('scale', [1, 1, 1])))):
            raise RuntimeError('Candidate transform differs from the installed exporter recipe: '+sid)
        if sid == ROOT_ID:
            continue
        actual = set()
        for primitive in document['meshes'][node['mesh']]['primitives']:
            accessor = document['accessors'][primitive['attributes']['POSITION']]
            view = document['bufferViews'][accessor['bufferView']]
            if (accessor.get('componentType') != 5126 or accessor.get('type') != 'VEC3'
                    or accessor.get('sparse') or accessor.get('normalized', False)
                    or view.get('buffer', 0) != 0 or accessor['count'] < 1):
                raise RuntimeError('Unexpected candidate position encoding: '+sid)
            offset, stride = accessor.get('byteOffset', 0), view.get('byteStride', 12)
            start = view.get('byteOffset', 0)+offset
            if (stride < 12 or offset < 0 or start < 0
                    or offset+(accessor['count']-1)*stride+12 > view['byteLength']
                    or view.get('byteOffset', 0)+view['byteLength'] > bin_size):
                raise RuntimeError('Candidate position accessor exceeds its buffer: '+sid)
            actual.update(struct.unpack_from('<fff', raw, bin_start+start+i*stride)
                          for i in range(accessor['count']))
        if actual != source['positions']:
            raise RuntimeError('Candidate local positions changed during export: '+sid)
        # An affine error reaches its maximum on a box corner. Exact position
        # equality above makes these eight corners a bound for every vertex.
        bounds = [(min(p[i] for p in actual), max(p[i] for p in actual)) for i in range(3)]
        maximum = 0.0
        for mask in range(8):
            point = tuple(bounds[i][(mask >> i) & 1] for i in range(3))
            blender_point = (point[0], -point[2], point[1], 1.0)
            world = [sum(row[j]*blender_point[j] for j in range(4)) for row in source['world'][:3]]
            actual_world = gltf_point(root_node, gltf_point(node, point))
            maximum = max(maximum, math.dist(actual_world, (world[0], world[2], -world[1])))
        # Float32 matrix decomposition/inversion at this 1.9 km site has
        # sub-mm precision. This cap is additional to exact TRS/vertex checks,
        # not permission for arbitrary local translations or altered geometry.
        if not math.isfinite(maximum) or maximum > .0005:
            raise RuntimeError('Candidate world geometry exceeded the 0.5 mm round-trip bound: '+sid)
        records[sid] = {'uniquePositions': len(actual), 'worldErrorBoundMetres': maximum,
                        'emittedTranslation': node.get('translation', [0, 0, 0])}
    return {'sourceIdentityBasis': True, 'directRootChildren': len(child_indices),
            'exactExporterTransforms': True, 'exactLocalPositions': True, 'meshes': records}


def export_candidate(root, directory):
    """Mirror the official glTF flags, restricted to an isolated temp tower."""
    if not directory.resolve().is_relative_to(OUTPUT.resolve()):
        raise RuntimeError('Candidate export must stay inside the SWFC temporary output directory')
    directory.mkdir(parents=True, exist_ok=False)
    selected_before = list(bpy.context.selected_objects)
    active_before = bpy.context.view_layer.objects.active
    targets = [root] + [o for o in root.children_recursive if o.get('spaceId') in OUTPUT_IDS.values()]
    bpy.context.view_layer.update()
    geometry_snapshot = export_geometry_snapshot(root, targets)
    visible = {o: o.hide_get() for o in targets}
    target = directory / 'swfc-candidate.glb'
    try:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in targets:
            obj.hide_set(False)
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
            export_extras=True, export_attributes=True, export_yup=True,
            export_animations=False, export_cameras=False, export_lights=False,
            export_gpu_instances=True, export_image_format='AUTO')
    finally:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in selected_before:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = active_before
        for obj, hidden in visible.items():
            obj.hide_set(hidden)
    raw = target.read_bytes()
    if len(raw) < 28 or struct.unpack_from('<III', raw) != (0x46546C67, 2, len(raw)):
        raise RuntimeError('Candidate exporter did not produce a valid GLB')
    size, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4E4F534A:
        raise RuntimeError('Candidate GLB JSON chunk missing')
    document = json.loads(raw[20:20+size])
    nodes = document.get('nodes', [])
    exported = Counter(n.get('extras', {}).get('spaceId') for n in nodes if n.get('extras', {}).get('spaceId'))
    mesh_nodes = [n for n in nodes if 'mesh' in n]
    if (len(nodes) != 9 or exported != Counter([ROOT_ID, *OUTPUT_IDS.values()])
            or len(document.get('meshes', [])) != 8 or len(mesh_nodes) != 8
            or Counter(n['mesh'] for n in mesh_nodes) != Counter(range(8))
            or {n['extras']['spaceId'] for n in mesh_nodes} != set(OUTPUT_IDS.values())):
        raise RuntimeError('Candidate GLB lost, duplicated or leaked an identity')
    if any(n.get('extras', {}).get('archivedSpaceId') for n in nodes):
        raise RuntimeError('Candidate GLB contains archive objects')
    geometry_contract = validate_export_geometry(document, raw, geometry_snapshot)
    material_contracts = {}
    for role, sid in EXTRA_IDS.items():
        node = next(n for n in nodes if n.get('extras', {}).get('spaceId') == sid)
        primitives = document['meshes'][node['mesh']]['primitives']
        if len(primitives) != 1:
            raise RuntimeError('Detail material split would turn the runtime mesh into a Group')
        material = document['materials'][primitives[0]['material']]
        extras = material.get('extras', {})
        pbr = material.get('pbrMetallicRoughness', {})
        if (extras.get('spaceMaterialId') != EXTRA_MATERIAL_IDS[role] or extras.get('spaceShaderKey')
                or material.get('alphaMode', 'OPAQUE') != 'OPAQUE' or material.get('doubleSided', False)
                or pbr.get('metallicFactor', 1) != 0 or any(material.get('emissiveFactor', [0, 0, 0]))):
            raise RuntimeError('Independent detail PBR identity or non-emissive contract did not round-trip')
        if role == 'top_glass' and not math.isclose(material.get('extensions', {}).get(
                'KHR_materials_transmission', {}).get('transmissionFactor', 0), .9, abs_tol=1e-6):
            raise RuntimeError('Top glass lost native glTF transmission')
        material_contracts[role] = material
    return {'path': str(target), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'nodes': len(nodes), 'meshes': len(mesh_nodes), 'newMaterials': material_contracts,
            'geometryRoundTrip': geometry_contract,
            'scope': 'isolated tower; root transform retained; replace existing root, do not append over it'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bridge-angle-deg', type=float, required=True,
                        help='Root-local Blender XY bridge long-axis yaw from +X towards +Y; base edges are +/-45 degrees')
    parser.add_argument('--audit', type=Path, default=AUDIT)
    parser.add_argument('--label', required=True, help='New single filename label; existing output is never replaced')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in args.label):
        parser.error('Label must be a single alphanumeric filename')
    directory = OUTPUT / args.label
    if directory.exists():
        parser.error('Preview label already exists; use a new label')
    roots = [o for o in bpy.context.scene.objects if o.get('spaceId') == ROOT_ID]
    if len(roots) != 1:
        raise RuntimeError('Expected one SWFC root')
    token = source_fingerprint()
    archive = bpy.data.collections.new('ARCHIVE before '+REVISION+' (not exported)')
    bpy.context.scene.collection.children.link(archive)
    detail = author(roots[0], archive, args.bridge_angle_deg, args.audit)
    assert_source_unchanged(token)
    exported = export_candidate(roots[0], directory)
    assert_source_unchanged(token)
    report = {'saved': False, 'officialAssetsWritten': False, 'sourceFingerprint': list(token),
              'candidate': detail, 'export': exported}
    atomic_write(directory / 'candidate-report.json', (json.dumps(report, indent=2)+'\n').encode('utf8'))
    print('SWFC_TOP_CANDIDATE '+json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
