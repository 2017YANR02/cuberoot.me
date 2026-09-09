"""Read the same room camera positions used by the website; convert Y-up to Z-up."""
import json
from pathlib import Path

from mathutils import Vector

CAMERAS = Path(__file__).resolve().parents[3] / 'core/packages/client/app/[lang]/space/space-room-cameras.json'
NAMES = {'interior': 'Living room', 'study': 'Study', 'bedroom': 'Bedroom', 'bathroom': 'Bathroom',
         'courtyard': 'Courtyard', 'garage': 'Garage', 'cinema': 'Cinema', 'gym': 'Gym'}


def room_cameras(key):
    if key == 'shanghai':
        return {}
    group = 'company' if key.startswith('company-') else 'villa'
    return {NAMES[name]: tuple((x, -z, y) for x, y, z in pair)
            for name, pair in json.loads(CAMERAS.read_text(encoding='utf-8'))[group].items()}


def aim(camera, position, target):
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
