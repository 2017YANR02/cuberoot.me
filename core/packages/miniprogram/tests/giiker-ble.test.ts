import { describe, expect, it, vi } from 'vitest';

import {
  GIIKER_COMMAND_BATTERY,
  GIIKER_DATA_SERVICE_UUID,
  GIIKER_NOTIFY_CHARACTERISTIC_UUID,
  GIIKER_READ_CHARACTERISTIC_UUID,
  GIIKER_RW_SERVICE_UUID,
  GIIKER_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/giiker';
import { connectGiiker, type GiikerBleApi } from '../src/lib/smart-cube/giiker-ble';

type DeviceListener = Parameters<GiikerBleApi['onBluetoothDeviceFound']>[0];
type ValueListener = Parameters<GiikerBleApi['onBLECharacteristicValueChange']>[0];

function solvedFrame(): ArrayBuffer {
  const nibbles = new Array<number>(40).fill(0);
  for (let index = 0; index < 8; index++) nibbles[index] = index + 1;
  for (let index = 0; index < 12; index++) nibbles[index + 16] = index + 1;
  nibbles[32] = 5;
  nibbles[33] = 1;
  return Uint8Array.from({ length: 20 }, (_, index) =>
    (nibbles[index * 2] << 4) | nibbles[index * 2 + 1]).buffer;
}

function createBleRig() {
  let deviceListener: DeviceListener | undefined;
  let valueListener: ValueListener | undefined;
  const events: string[] = [];
  const api: GiikerBleApi = {
    openBluetoothAdapter(callbacks) { callbacks.success?.({}); },
    closeBluetoothAdapter(callbacks) { events.push('adapter:close'); callbacks.success?.({}); },
    startBluetoothDevicesDiscovery(callbacks) {
      expect(callbacks.services).toBeUndefined();
      callbacks.success?.({});
      void Promise.resolve().then(() => deviceListener?.({
        devices: [{ deviceId: 'giiker-1', name: 'Mi Smart Magic Cube' }],
      }));
    },
    stopBluetoothDevicesDiscovery(callbacks) { callbacks.success?.({}); },
    onBluetoothDeviceFound(listener) { deviceListener = listener; },
    offBluetoothDeviceFound(listener) {
      if (deviceListener === listener) deviceListener = undefined;
    },
    createBLEConnection(callbacks) { callbacks.success?.({}); },
    closeBLEConnection(callbacks) { events.push('connection:close'); callbacks.success?.({}); },
    getBLEDeviceServices(callbacks) {
      callbacks.success?.({
        services: [
          { uuid: GIIKER_DATA_SERVICE_UUID.toUpperCase() },
          { uuid: GIIKER_RW_SERVICE_UUID.toUpperCase() },
        ],
      });
    },
    getBLEDeviceCharacteristics(callbacks) {
      callbacks.success?.({
        characteristics: callbacks.serviceId.toLowerCase() === GIIKER_DATA_SERVICE_UUID
          ? [{
            uuid: GIIKER_NOTIFY_CHARACTERISTIC_UUID.toUpperCase(),
            properties: { notify: true },
          }]
          : [
            {
              uuid: GIIKER_READ_CHARACTERISTIC_UUID.toUpperCase(),
              properties: { notify: true },
            },
            {
              uuid: GIIKER_WRITE_CHARACTERISTIC_UUID.toUpperCase(),
              properties: { write: true },
            },
          ],
      });
    },
    notifyBLECharacteristicValueChange(callbacks) {
      events.push(`${callbacks.characteristicId}:${callbacks.state ? 'on' : 'off'}`);
      callbacks.success?.({});
    },
    readBLECharacteristicValue(callbacks) { events.push('data:read'); callbacks.success?.({}); },
    writeBLECharacteristicValue(callbacks) {
      expect([...new Uint8Array(callbacks.value)]).toEqual([GIIKER_COMMAND_BATTERY]);
      callbacks.success?.({});
      void Promise.resolve().then(() => valueListener?.({
        characteristicId: GIIKER_READ_CHARACTERISTIC_UUID,
        deviceId: 'giiker-1',
        serviceId: GIIKER_RW_SERVICE_UUID,
        value: Uint8Array.from([0, 73]).buffer,
      }));
    },
    onBLECharacteristicValueChange(listener) { valueListener = listener; },
    offBLECharacteristicValueChange(listener) {
      if (valueListener === listener) valueListener = undefined;
    },
  };
  return {
    api,
    emitData(value: ArrayBuffer): void {
      valueListener?.({
        characteristicId: GIIKER_NOTIFY_CHARACTERISTIC_UUID,
        deviceId: 'giiker-1',
        serviceId: GIIKER_DATA_SERVICE_UUID,
        value,
      });
    },
    events,
  };
}

describe('Giiker mini program BLE transport', () => {
  it('discovers by name and relays shared state, move and battery parsing', async () => {
    const rig = createBleRig();
    const moves: string[] = [];
    const states: string[] = [];
    const batteries: number[] = [];
    const connection = await connectGiiker({
      api: rig.api,
      onBattery: (level) => batteries.push(level),
      onMove: (move) => moves.push(move),
      onState: (facelets) => states.push(facelets),
    });

    rig.emitData(solvedFrame());
    expect(moves).toEqual(['R']);
    expect(states).toEqual(['U'.repeat(9) + 'R'.repeat(9) + 'F'.repeat(9)
      + 'D'.repeat(9) + 'L'.repeat(9) + 'B'.repeat(9)]);
    await expect(connection.requestBattery()).resolves.toBe(73);
    expect(batteries).toEqual([73]);
    expect(rig.events).toContain('data:read');

    await connection.disconnect();
    await connection.disconnect();
    expect(rig.events.filter((event) => event === 'connection:close')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'adapter:close')).toHaveLength(1);
  });

  it('rejects impossible scan timeouts before touching Bluetooth', async () => {
    const rig = createBleRig();
    const open = vi.spyOn(rig.api, 'openBluetoothAdapter');
    await expect(connectGiiker({ api: rig.api, scanTimeoutMs: 999 }))
      .rejects.toThrow('scanTimeoutMs must be between 1000 and 30000');
    expect(open).not.toHaveBeenCalled();
  });
});
