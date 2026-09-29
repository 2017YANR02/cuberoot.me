export * from '@cuberoot/shared/timer/external/gan';
import { GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHAR, GAN_TIMER_NAME_PREFIXES, parseGanTimerFrame } from '@cuberoot/shared/timer/external/gan';
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

    const onChar = (ev: Event): void => {
      const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!dv) return;
      const parsed = parseGanTimerFrame(dv);
      // Drop, don't process — see the header note on csTimer's fall-through.
      if (!parsed) return;
      emit(parsed);
    };

    stateChar.addEventListener('characteristicvaluechanged', onChar);
    await stateChar.startNotifications();

    let cleaned = false;
    return {
      cleanup(): void {
        if (cleaned) return;
        cleaned = true;
        stateChar.removeEventListener('characteristicvaluechanged', onChar);
        void stateChar.stopNotifications().catch(() => {});
      },
    };
  },
};
