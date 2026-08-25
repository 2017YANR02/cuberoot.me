import { describe, expect, it, vi } from 'vitest';

import {
  MOYU_GYRO_CHARACTERISTIC_UUID,
  MOYU_READ_CHARACTERISTIC_UUID,
  MOYU_SERVICE_UUID,
  MOYU_TURN_CHARACTERISTIC_UUID,
  createMoyuDecodeState,
  parseMoyuTurnFrame,
} from '@cuberoot/shared/smart-cube/moyu';
import { connectMoyu, type MoyuBleApi } from '../src/lib/smart-cube/moyu-ble';

type DeviceListener = Parameters<MoyuBleApi['onBluetoothDeviceFound']>[0];
type ValueListener = Parameters<MoyuBleApi['onBLECharacteristicValueChange']>[0];

function turnFrame(face: number, rawDirection: number): ArrayBuffer {
  return Uint8Array.from([1, 0, 0, 0, 0, face, rawDirection]).buffer;
}

function createBleRig() {
  let deviceListener: DeviceListener | undefined;
  let valueListener: ValueListener | undefined;
  const events: string[] = [];
  const api: MoyuBleApi = {
    openBluetoothAdapter(callbacks) { callbacks.success?.({}); },
    closeBluetoothAdapter(callbacks) { events.push('adapter:close'); callbacks.success?.({}); },
    startBluetoothDevicesDiscovery(callbacks) {
      callbacks.success?.({});
      void Promise.resolve().then(() => deviceListener?.({
        devices: [{ deviceId: 'moyu-1', localName: 'MHC Cube' }],
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
      callbacks.success?.({ services: [{ uuid: MOYU_SERVICE_UUID.toUpperCase() }] });
    },
    getBLEDeviceCharacteristics(callbacks) {
      callbacks.success?.({
        characteristics: [
          {
            uuid: MOYU_TURN_CHARACTERISTIC_UUID.toUpperCase(),
            properties: { notify: true },
          },
          {
            uuid: MOYU_READ_CHARACTERISTIC_UUID.toUpperCase(),
            properties: { notify: true },
          },
          {
            uuid: MOYU_GYRO_CHARACTERISTIC_UUID.toUpperCase(),
            properties: { indicate: true },
          },
        ],
      });
    },
    notifyBLECharacteristicValueChange(callbacks) {
      events.push(`${callbacks.characteristicId}:${callbacks.state ? 'on' : 'off'}`);
      callbacks.success?.({});
    },
    readBLECharacteristicValue(callbacks) { callbacks.success?.({}); },
    writeBLECharacteristicValue(callbacks) { callbacks.success?.({}); },
    onBLECharacteristicValueChange(listener) { valueListener = listener; },
    offBLECharacteristicValueChange(listener) {
      if (valueListener === listener) valueListener = undefined;
    },
  };
  return {
    api,
    emitTurn(value: ArrayBuffer): void {
      valueListener?.({
        characteristicId: MOYU_TURN_CHARACTERISTIC_UUID,
        deviceId: 'moyu-1',
        serviceId: MOYU_SERVICE_UUID,
        value,
      });
    },
    events,
  };
}

describe('MoYu mini program BLE transport', () => {
  it('discovers MHC devices, relays turns and closes every resource once', async () => {
    const rig = createBleRig();
    const moves: string[] = [];
    const connection = await connectMoyu({
      api: rig.api,
      onMove: (move) => moves.push(move),
    });

    rig.emitTurn(turnFrame(3, 180));
    expect(moves).toEqual(['R']);
    await expect(connection.requestBattery()).resolves.toBeNull();
    expect(rig.events).toEqual(expect.arrayContaining([
      `${MOYU_TURN_CHARACTERISTIC_UUID.toUpperCase()}:on`,
      `${MOYU_READ_CHARACTERISTIC_UUID.toUpperCase()}:on`,
      `${MOYU_GYRO_CHARACTERISTIC_UUID.toUpperCase()}:on`,
    ]));

    await connection.disconnect();
    await connection.disconnect();
    expect(rig.events.filter((event) => event === 'connection:close')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'adapter:close')).toHaveLength(1);
  });

  it('keeps partial rotations but ignores malformed frames', () => {
    const state = createMoyuDecodeState();
    expect(parseMoyuTurnFrame(turnFrame(3, 72), state)).toEqual([]);
    expect(parseMoyuTurnFrame(turnFrame(3, 108), state)).toEqual(['R']);
    expect(parseMoyuTurnFrame(Uint8Array.from([1, 0]).buffer, state)).toEqual([]);
    expect(parseMoyuTurnFrame(turnFrame(9, 180), state)).toEqual([]);
  });

  it('rejects impossible scan timeouts before touching Bluetooth', async () => {
    const rig = createBleRig();
    const open = vi.spyOn(rig.api, 'openBluetoothAdapter');
    await expect(connectMoyu({ api: rig.api, scanTimeoutMs: 999 }))
      .rejects.toThrow('scanTimeoutMs must be between 1000 and 30000');
    expect(open).not.toHaveBeenCalled();
  });
});
