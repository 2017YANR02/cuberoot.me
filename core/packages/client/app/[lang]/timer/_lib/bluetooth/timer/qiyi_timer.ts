export * from '@cuberoot/shared/timer/external/qiyi';
import { QIYI_TIMER_SERVICE, QIYI_TIMER_WRITE_CHAR, QIYI_TIMER_READ_CHAR, QIYI_TIMER_NAME_PREFIXES } from '@cuberoot/shared/timer/external/qiyi';
import type { BluetoothTimerDriver, BluetoothTimerStartResult } from './driver';
import { writeGattValue } from '../driver';
import { startQiyiTimer } from '@cuberoot/shared/timer/external/session';
import { QIYI_CIC_LIST } from '../mac';
function toUuid128(uuid: string): string {
  return (/^[0-9a-f]{4}$/i.test(uuid) ? `0000${uuid}-0000-1000-8000-00805f9b34fb` : uuid)
    .toLowerCase();
}

async function findCharacteristic(
  service: BluetoothRemoteGATTService,
  uuid: string,
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  const want = toUuid128(uuid);
  try {
    const all = await service.getCharacteristics();
    const hit = all.find((c) => toUuid128(c.uuid) === want);
    if (hit) return hit;
  } catch {
    // Some browsers refuse bulk enumeration; fall through to a direct get.
  }
  try {
    return await service.getCharacteristic(uuid);
  } catch {
    return null;
  }
}

export const qiyiTimerDriver: BluetoothTimerDriver = {
  kind: 'qiyi-timer',
  service: QIYI_TIMER_SERVICE,
  namePrefixes: QIYI_TIMER_NAME_PREFIXES,
  manufacturerDataCics: QIYI_CIC_LIST,
  needsMac: true,

  matches(device: BluetoothDevice): boolean {
    return /^QY-(Timer|Adapter)/i.test((device.name ?? '').trim());
  },

  async start(server, emit, ctx): Promise<BluetoothTimerStartResult> {
    const service = await server.getPrimaryService(QIYI_TIMER_SERVICE);
    const writeChar = await findCharacteristic(service, QIYI_TIMER_WRITE_CHAR);
    const readChar = await findCharacteristic(service, QIYI_TIMER_READ_CHAR);
    if (!writeChar || !readChar) {
      throw new Error('QiYi timer: required characteristics not found');
    }

    return startQiyiTimer({
      subscribe: async listener => {
        const onValue = (event: Event) => { const value = (event.target as BluetoothRemoteGATTCharacteristic).value; if(value) listener(value); };
        readChar.addEventListener('characteristicvaluechanged', onValue);
        try { await readChar.startNotifications(); } catch(error) { readChar.removeEventListener('characteristicvaluechanged', onValue); throw error; }
        return async () => { readChar.removeEventListener('characteristicvaluechanged', onValue); await readChar.stopNotifications().catch(() => {}); };
      },
      write: async value => { await writeGattValue(writeChar, Uint8Array.from(value).buffer); },
    }, emit, ctx);
  },
};
