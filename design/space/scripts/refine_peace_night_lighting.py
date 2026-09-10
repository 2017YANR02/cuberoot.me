"""Incrementally edit six existing Peace Hotel lights and its distant roof wash.

Default validates a disposable candidate; --apply requires that exact candidate
and source fingerprint, makes a backup, then saves the canonical source.
Photo provenance and estimate boundaries: ../references/peace-crown.md.
"""
import json
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import facade_rig
import refine_peace_crown as guard

OUTPUT = guard.ROOT / '.tmp/png/space-night-20260910'
REVISION = 'peace-night-roof-20260910'
PROPERTY = 'spacePeaceNightRevision'
ROOF_KEY = 'shanghai-illumination-0.001-bund-roof-shadowed-1.7-64'
ROOF_WASH = {'bottom': 60., 'top': 73.6, 'color': [.18, 1., .28]}


def lamps():
    green = {'color': [.18, 1., .28], 'intensity': 50., 'angle': 1.05,
             'penumbra': .85, 'distance': 27.}
    crown = {'color': [1., .72, .4], 'intensity': 24., 'angle': 1.02,
             'penumbra': .8, 'distance': 5.}
    return [
        dict(green, position=[-1314.8, 60.6, 1362.], target=[-1318.6, 63., 1362.]),
        dict(green, position=[-1314.8, 60.6, 1372.], target=[-1318.6, 63., 1372.]),
        dict(crown, position=[-1325.6, 74.2, 1367.], target=[-1327., 75.3, 1367.]),
        dict(crown, position=[-1328., 74.2, 1369.4], target=[-1328., 75.3, 1368.]),
        dict(green, position=[-1333., 60.6, 1380.2], target=[-1333., 63., 1376.4]),
        dict(green, position=[-1323., 60.6, 1380.2], target=[-1323., 63., 1376.4]),
    ]


def edit_wash(_root):
    materials = [bpy.data.materials.get(name) for name in ('20 patinated standing seams', '20 weathered copper roof')]
    if any(m is None or m.get('spaceShaderKey') != ROOF_KEY or 'spaceRoofWash' in m for m in materials):
        raise RuntimeError('Copper material provenance changed; review before editing')
    for mat in materials:
        mat['spaceRoofWash'] = ROOF_WASH
        mat['spaceShaderKey'] = ROOF_KEY.replace('-1.7-64', '-0.85-64')
    return {'roofWash': ROOF_WASH, 'roofStrength': .85}


def main():
    report = facade_rig.run_lighting_increment(
        root_id='root/147/4', config=lamps(), output=OUTPUT, revision=REVISION,
        property_name=PROPERTY, edit_wash=edit_wash,
        backup_name='shanghai-before-night-roof.blend')
    print('PEACE_NIGHT '+json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
