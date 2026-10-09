import { createLegacyCubeSession, type LegacyCubeModel } from '@cuberoot/shared/smart-cube/legacy-session';
import { writeGattValue, type CubeDriverContext, type CubeDriverStartResult } from './driver';

/** Browser GATT access only; protocol lifecycle is shared with installed hosts. */
export async function startLegacyWebCube(model: LegacyCubeModel, server: BluetoothRemoteGATTServer, onMove: (move: string) => void, context?: CubeDriverContext): Promise<CubeDriverStartResult> {
  const characteristics = new Map<string, Promise<BluetoothRemoteGATTCharacteristic>>();
  const get = (service: string, characteristic: string) => {
    const key = `${service}/${characteristic}`;
    let pending = characteristics.get(key);
    if (!pending) {
      pending = server.getPrimaryService(service).then(value => value.getCharacteristic(characteristic));
      characteristics.set(key, pending);
    }
    return pending;
  };
  const session = createLegacyCubeSession(model, {
    read: async (service, characteristic) => (await get(service, characteristic)).readValue(),
    write: async (service, characteristic, bytes) => writeGattValue(await get(service, characteristic), Uint8Array.from(bytes).buffer),
    subscribe: async (service, characteristic, receive) => {
      const target = await get(service, characteristic);
      const listener = () => { if (target.value) receive(target.value); };
      target.addEventListener('characteristicvaluechanged', listener);
      try { await target.startNotifications(); }
      catch (error) { target.removeEventListener('characteristicvaluechanged', listener); throw error; }
      return async () => {
        target.removeEventListener('characteristicvaluechanged', listener);
        await target.stopNotifications().catch(() => undefined);
      };
    },
  }, { onMove, onState: context?.onState, onGyro: context?.onGyro });
  await session.start();
  return { battery: session.battery, cleanup: () => { void session.dispose(); } };
}
