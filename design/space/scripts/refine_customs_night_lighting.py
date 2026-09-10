"""Apply the reviewed Customs House six-light candidate to the current source.

Default writes a disposable candidate report; --apply requires the same source
and report, creates a backup, and saves only the existing lights and washTop.
The six lights are runtime proxies, not measured one-to-one fixture positions.
Photo and estimate boundaries: ../references/customs-junctions.md.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
import facade_rig
import refine_peace_crown as guard

OUTPUT = guard.ROOT / '.tmp/png/space-customs-night-20260910'
REVISION = 'customs-night-lighting-20260910'
PROPERTY = 'spaceCustomsNightRevision'
WASH_TOP = 43.


def lamps():
    # Positions/targets are Customs root-local Y-up metres; colors are linear.
    low = {'color': [1., .55, .24], 'intensity': 500., 'angle': 1.05,
           'penumbra': .85, 'distance': 66.}
    upper = {'color': [1., .55, .24], 'intensity': 90., 'angle': 1.12,
             'penumbra': .95, 'distance': 32.}
    return [dict(low, position=[x, 1.2, -8.], target=[x, 13., .5]) for x in (
        -13.661712646484375, -4.553924560546875, 4.5539703369140625, 13.661758422851562
    )] + [dict(upper, position=[x, 35.95, -7.5], target=[-1.36, 45., 3.]) for x in (-7., 4.3)]


def edit_wash(root):
    if root['facadeLighting'].get('washTop') != 34.5:
        raise RuntimeError('Customs washTop changed; review the current frontage before editing')
    root['facadeLighting']['washTop'] = WASH_TOP
    return {'washTop': WASH_TOP}


def main():
    report = facade_rig.run_lighting_increment(
        root_id='root/147/5', config=lamps(), output=OUTPUT, revision=REVISION,
        property_name=PROPERTY, edit_wash=edit_wash,
        backup_name='shanghai-before-customs-night.blend',
        required_revisions=(('spacePeaceNightRevision', 'peace-night-roof-20260910'),))
    print('CUSTOMS_NIGHT ' + json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
