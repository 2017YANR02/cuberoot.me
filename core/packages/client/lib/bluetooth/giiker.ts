import { startLegacyWebCube } from './legacy_session';
import {
  GIIKER_DATA_SERVICE_UUID,
  GIIKER_RW_SERVICE_UUID,
  matchesGiikerName,
} from '@cuberoot/shared/smart-cube/giiker';
import {
  type CubeDriver,
} from './driver';
import type { CubeBrand } from './types';

export const giikerDriver: CubeDriver = {
  brand: 'giiker' satisfies CubeBrand,
  service: GIIKER_DATA_SERVICE_UUID,
  namePrefixes: ['Gi', 'Mi Smart Magic Cube', 'Hi-'],
  optionalServices: [GIIKER_RW_SERVICE_UUID],

  matches(device: BluetoothDevice): boolean {
    return matchesGiikerName(device.name);
  },

  start(server, onMove, context) {
    return startLegacyWebCube('giiker', server, onMove, context);
  },
};
