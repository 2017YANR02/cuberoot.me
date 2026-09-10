"""One-time creation of the reviewed Bund light rigs; never saves the source.

Call author(scene) once from a guarded integration process. Subsequently edit
the native SPOT lights and export normally; this bootstrap refuses to overwrite.
These six-light aggregate rigs are photo-informed estimates, not surveyed lamps.
"""
import math
import bpy
from mathutils import Vector

REVISION = 'bund-light-rigs-20260910'


def author(scene):
    ids = ['root/147/4', 'root/147/5', 'root/147/6']
    roots = [next(o for o in scene.objects if o.get('spaceId') == sid) for sid in ids]
    if any(o.get('spaceFacadeRig') for o in roots):
        raise RuntimeError('Bund light rigs already authored; edit the existing lights')
    collection = bpy.data.collections.new('AUTHORING | Bund light rigs (metadata export)')
    scene.collection.children.link(collection)

    def lamp(root, slot, position, target, color, intensity, angle, distance):
        name = f'{root.name} facade {slot + 1}'
        data = bpy.data.lights.new(name, 'SPOT')
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        obj.parent = root
        zup = lambda p: Vector((p[0], -p[2], p[1]))
        obj.location = zup(position)
        obj.rotation_euler = (zup(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        srgb = [(color >> shift & 255) / 255 for shift in (16, 8, 0)]
        data.color = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb]
        data.spot_size = 2 * math.pi * angle
        data.spot_blend = .8
        data.use_custom_distance = True
        data.cutoff_distance = distance
        # Blender watts and runtime candela are separate authoring controls.
        data.energy = intensity * .05
        data.shadow_soft_size = .15
        obj['spaceFacadeSlot'] = slot
        obj['spaceCandela'] = float(intensity)
        obj['spaceLightingEstimate'] = 'Aggregate visual proxy; not a surveyed physical fixture'

    peace, customs, hsbc = roots
    peace['facadeLighting'] = {'width': 28., 'height': 58., 'centre': [-1328., 36., 1367.], 'washTop': 0.}
    for i in range(4):
        z = 1356 + i * 7.3
        lamp(peace, i, (-1299, 5.5, z), (-1313, 28, z), 0xffd4a0, 210, .27, 85)
    lamp(peace, 4, (-1308, 65, 1365), (-1324, 69, 1367), 0xf1efd8, 1500, .2, 45)
    lamp(peace, 5, (-1328, 65, 1390), (-1328, 69, 1371), 0xf1efd8, 1500, .2, 45)

    customs['facadeLighting']['washTop'] = 34.5
    for i in range(4):
        x = 36.43130704247804 * ((i + .5) / 4 - .5)
        lamp(customs, i, (x, 5.5, -12), (x, 22.425, .5), 0xffd0a0, 430, .29, 76)
    for i, x in enumerate((-11.3616, 8.6384), 4):
        lamp(customs, i, (x, 40, -9), (-1.3616, 46, 5.23), 0xffd0a0, 250, .27, 55)

    hsbc['facadeLighting']['washTop'] = 29.4
    for i in range(4):
        x = hsbc['facadeLighting']['width'] * ((i + .5) / 4 - .5)
        lamp(hsbc, i, (x, 5.5, -12), (x, 29.4 * .65, .5), 0xffd4a0, 740, .29, 65)
    for i, x in enumerate((-12, 12), 4):
        lamp(hsbc, i, (x, 40.5, -7), (0, 40.7, 4.7), 0xffbd70, 360, .32, 44)
    for root in roots:
        root['spaceFacadeRig'] = REVISION
    bpy.context.view_layer.update()
    return {'revision': REVISION, 'buildings': ids, 'lights': 18, 'runtimePool': 6, 'estimated': True}
