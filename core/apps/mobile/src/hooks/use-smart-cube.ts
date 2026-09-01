import {
  useInstalledSmartCube,
  type InstalledAppSmartCube,
  type InstalledAppSmartCubeOptions,
} from '@cuberoot/app-ui';

import { NativeBleTransport } from '../bluetooth/native-ble-transport';

export function useSmartCube(options: InstalledAppSmartCubeOptions): InstalledAppSmartCube {
  return useInstalledSmartCube(() => new NativeBleTransport(), options);
}
