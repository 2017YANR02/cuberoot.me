import { startGanTimer } from '@cuberoot/shared/timer/external/session';
export * from '@cuberoot/shared/timer/external/gan';
import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR, GAN_TIMER_NAME_PREFIXES } from '@cuberoot/shared/timer/external/gan';
import type { BluetoothTimerDriver, BluetoothTimerStartResult } from './driver';
export const ganTimerDriver: BluetoothTimerDriver = {
  kind: 'gan-timer',
  service: GAN_TIMER_SERVICE,
  namePrefixes: GAN_TIMER_NAME_PREFIXES,

  matches(device: BluetoothDevice): boolean {
    return /^gan/i.test((device.name ?? '').trim());
  },

  async start(server, emit): Promise<BluetoothTimerStartResult> {
    const service = await server.getPrimaryService(GAN_TIMER_SERVICE);
    const stateChar = await service.getCharacteristic(GAN_TIMER_STATE_CHAR);

    return startGanTimer({
      subscribe: async listener => {
        const onValue = (event: Event) => { const value = (event.target as BluetoothRemoteGATTCharacteristic).value; if(value) listener(value); };
        stateChar.addEventListener('characteristicvaluechanged', onValue);
        try { await stateChar.startNotifications(); } catch(error) { stateChar.removeEventListener('characteristicvaluechanged', onValue); throw error; }
        return async () => { stateChar.removeEventListener('characteristicvaluechanged', onValue); await stateChar.stopNotifications().catch(() => {}); };
      },
      write: async () => {},
    }, emit);
  },
};
