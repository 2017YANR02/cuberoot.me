import {
  GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_SERVICE_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
  createGanV4BatteryCommand,
  createGanV4Cipher,
  createGanV4FaceletsCommand,
  createGanV4HardwareInfoCommand,
} from '@cuberoot/shared/smart-cube/gan-v4';
import { describe, expect, it, vi } from 'vitest';

import type { BleTransport } from './transport';
import { GanV4CubeConnection } from './gan-v4-cube';

function fakeTransport() {
  const writes: Uint8Array[] = [];
  let notification: ((value: DataView) => void) | null = null;
  const transport: BleTransport = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    getMtu: vi.fn(async () => 517),
    initialize: vi.fn(async () => undefined),
    read: vi.fn(async () => new DataView(new ArrayBuffer(0))),
    requestDevice: vi.fn(async () => ({ id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' })),
    subscribe: vi.fn(async (_deviceId, service, characteristic, onValue) => {
      expect(service).toBe(GAN_V4_SERVICE_UUID);
      expect(characteristic).toBe(GAN_V4_NOTIFY_CHARACTERISTIC_UUID);
      notification = onValue;
      return vi.fn(async () => undefined);
    }),
    write: vi.fn(async (_deviceId, service, characteristic, value) => {
      expect(service).toBe(GAN_V4_SERVICE_UUID);
      expect(characteristic).toBe(GAN_V4_WRITE_CHARACTERISTIC_UUID);
      writes.push(value);
    }),
  };
  return { notification: () => notification, transport, writes };
}

describe('GanV4CubeConnection', () => {
  it('reuses the shared GAN v4 cipher and sends the canonical handshake over the transport', async () => {
    const fake = fakeTransport();
    const callbacks = {
      onDisconnect: vi.fn(),
      onMove: vi.fn(),
      onProtocolError: vi.fn(),
    };
    const connection = new GanV4CubeConnection(fake.transport, callbacks);
    await connection.connect({ id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' });

    expect(fake.notification()).not.toBeNull();
    expect(fake.writes).toHaveLength(3);
    const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 0x01, 0x23, 0x45));
    expect([...cipher.decrypt(fake.writes[0])]).toEqual([...createGanV4HardwareInfoCommand()]);
    expect([...cipher.decrypt(fake.writes[1])]).toEqual([...createGanV4FaceletsCommand()]);
    expect([...cipher.decrypt(fake.writes[2])]).toEqual([...createGanV4BatteryCommand()]);

    await connection.disconnect();
    expect(fake.transport.disconnect).toHaveBeenCalledWith('AB:CD:EF:01:23:45');
  });

  it('rejects a different GAN generation before opening GATT', async () => {
    const fake = fakeTransport();
    const connection = new GanV4CubeConnection(fake.transport, {
      onDisconnect: vi.fn(),
      onMove: vi.fn(),
      onProtocolError: vi.fn(),
    });
    await expect(connection.connect({
      id: 'AB:CD:EF:01:23:45',
      name: 'GAN356i',
    })).rejects.toThrow('unsupported GAN protocol');
    expect(fake.transport.connect).not.toHaveBeenCalled();
  });

  it('derives the cipher from iOS advertisement manufacturer data', async () => {
    const fake = fakeTransport();
    const connection = new GanV4CubeConnection(fake.transport, {
      onDisconnect: vi.fn(),
      onMove: vi.fn(),
      onProtocolError: vi.fn(),
    });
    const payload = Uint8Array.of(0xa3, 0xb4, 0xc5, 0x45, 0x23, 0x01, 0xef, 0xcd, 0xab);

    await connection.connect({
      id: '93F18F53-A6E8-4A6A-91B4-836AB85BC247',
      manufacturerData: new Map([[0xa501, payload]]),
      name: 'GAN16ui',
    });

    const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 0x01, 0x23, 0x45));
    expect([...cipher.decrypt(fake.writes[0]!)]).toEqual([...createGanV4HardwareInfoCommand()]);
  });
});
