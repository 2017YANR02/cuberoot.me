"""Export six editable Blender spotlights into the fixed Three.js facade pool."""
import math
from mathutils import Vector


def export_facade_rigs(scene):
    count = 0
    for root in scene.objects:
        if not root.get('spaceFacadeRig'):
            continue
        lamps = sorted((o for o in root.children if 'spaceFacadeSlot' in o),
                       key=lambda o: o['spaceFacadeSlot'])
        if [o['spaceFacadeSlot'] for o in lamps] != list(range(6)):
            raise RuntimeError(f'{root.name}: expected facade light slots 0 through 5')
        if not root.get('space_export') or not root.get('facadeLighting'):
            raise RuntimeError(f'{root.name}: facade rig needs an exportable frontage')
        result = []
        for obj in lamps:
            if obj.type != 'LIGHT' or obj.data.type != 'SPOT' or obj.get('space_export'):
                raise RuntimeError(f'{obj.name}: facade helpers must be non-exported SPOT lights')
            local = root.matrix_world.inverted() @ obj.matrix_world
            position = local.translation
            direction = local.to_3x3() @ Vector((0, 0, -1))
            if direction.length < .00001:
                raise RuntimeError(f'{obj.name}: invalid light direction')
            target = position + direction.normalized() * 10
            data = obj.data
            intensity = obj.get('spaceCandela')
            if not isinstance(intensity, (float, int)) or not math.isfinite(intensity) or intensity < 0:
                raise RuntimeError(f'{obj.name}: spaceCandela must be finite and non-negative')
            if not data.use_custom_distance or data.cutoff_distance <= .3:
                raise RuntimeError(f'{obj.name}: set Custom Distance above 0.3 m')
            if not 0 < data.spot_size <= math.pi or not 0 <= data.spot_blend <= 1:
                raise RuntimeError(f'{obj.name}: invalid spot cone')
            color = list(data.color)
            if not all(math.isfinite(v) and 0 <= v <= 1 for v in color):
                raise RuntimeError(f'{obj.name}: invalid linear light color')
            # glTF rotates geometry from Blender Z-up to Three.js Y-up, but extras
            # are plain JSON and need that same basis conversion explicitly.
            yup = lambda v: [float(v.x), float(v.z), float(-v.y)]
            record = {'position': yup(position), 'target': yup(target), 'color': color,
                      'intensity': intensity, 'angle': float(data.spot_size / 2),
                      'penumbra': float(data.spot_blend), 'distance': float(data.cutoff_distance)}
            if not all(math.isfinite(v) for v in record['position'] + record['target']):
                raise RuntimeError(f'{obj.name}: non-finite transform')
            result.append(record)
        # Export only: never save derived metadata back over the artist's source.
        root['facadeLighting']['lamps'] = result
        count += 1
    return count
