import { describe, expect, it, vi } from 'vitest';

import { NativeBleTransport, type NativeBleClientPort } from './native-ble-transport';

function fakeClient(): NativeBleClientPort {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    getMtu: vi.fn(async () => 517),
    getServices: vi.fn(async () => [{
      uuid: 'service',
      characteristics: [{
        uuid: 'notify',
        descriptors: [],
        properties: {
          authenticatedSignedWrites: false,
          broadcast: false,
          indicate: false,
          notify: true,
          read: true,
          write: false,
          writeWithoutResponse: true,
        },
      }],
    }]),
    initialize: vi.fn(async () => undefined),
    read: vi.fn(async () => new DataView(Uint8Array.of(1).buffer)),
    requestDevice: vi.fn(async () => ({ deviceId: 'AA:BB:CC:DD:EE:FF', name: 'GAN16ui' })),
    requestLEScan: vi.fn(async () => undefined),
    setDisplayStrings: vi.fn(async () => undefined),
    startNotifications: vi.fn(async () => undefined),
    stopNotifications: vi.fn(async () => undefined),
    stopLEScan: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    writeWithoutResponse: vi.fn(async () => undefined),
  };
}

describe('NativeBleTransport', () => {
  it('keeps permission, picker, GATT and notification details behind one adapter', async () => {
    const client = fakeClient();
    const transport = new NativeBleTransport(client);
    await transport.initialize();
    expect(client.initialize).toHaveBeenCalledWith({ androidNeverForLocation: true });

    const pickerLabels = {
      availableDevices: 'Available',
      cancel: 'Cancel',
      noDeviceFound: 'None',
      scanning: 'Scanning',
    };
    await expect(transport.requestDevice({
      namePrefix: 'GAN',
      optionalServices: ['service'],
      pickerLabels,
    })).resolves.toEqual({ id: 'AA:BB:CC:DD:EE:FF', name: 'GAN16ui' });
    expect(client.setDisplayStrings).toHaveBeenCalledWith(pickerLabels);
    expect(client.requestDevice).toHaveBeenCalledWith({
      namePrefix: 'GAN',
      optionalServices: ['service'],
    });

    const disconnected = vi.fn();
    await transport.connect('AA:BB:CC:DD:EE:FF', disconnected);
    await expect(transport.getServices?.('AA:BB:CC:DD:EE:FF')).resolves.toEqual([{
      uuid: 'service',
      characteristics: [{
        uuid: 'notify',
        properties: { notify: true, indicate: false, read: true, write: false, writeWithoutResponse: true },
      }],
    }]);
    await transport.write('AA:BB:CC:DD:EE:FF', 'service', 'notify', Uint8Array.of(1, 2));
    expect(client.writeWithoutResponse).toHaveBeenCalledOnce();
    expect(client.write).not.toHaveBeenCalled();

    const onValue = vi.fn();
    const unsubscribe = await transport.subscribe('AA:BB:CC:DD:EE:FF', 'service', 'notify', onValue);
    await unsubscribe();
    await unsubscribe();
    expect(client.startNotifications).toHaveBeenCalledOnce();
    expect(client.stopNotifications).toHaveBeenCalledOnce();
  });

  it('uses service filters when the native picker spans multiple name prefixes', async () => {
    const client = fakeClient();
    const transport = new NativeBleTransport(client);
    const pickerLabels = {
      availableDevices: 'Available',
      cancel: 'Cancel',
      noDeviceFound: 'None',
      scanning: 'Scanning',
    };

    await transport.requestDevice({
      namePrefix: 'GAN',
      namePrefixes: ['GAN', 'WCU_MY3'],
      services: ['gan-service', 'moyu32-service'],
      optionalServices: ['gan-service', 'moyu32-service'],
      pickerLabels,
    });

    expect(client.requestDevice).toHaveBeenCalledWith({
      services: ['gan-service', 'moyu32-service'],
      optionalServices: ['gan-service', 'moyu32-service'],
    });
    expect(vi.mocked(client.requestDevice).mock.calls[0]?.[0]).not.toHaveProperty('namePrefix');
  });

  it('captures manufacturer data for an iOS UUID after the native picker returns', async () => {
    const client = fakeClient();
    vi.mocked(client.requestDevice).mockResolvedValue({
      deviceId: '93F18F53-A6E8-4A6A-91B4-836AB85BC247',
      name: 'GAN16ui',
    });
    vi.mocked(client.requestLEScan).mockImplementation(async (_options, callback) => {
      const payload = Uint8Array.of(0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1);
      callback({
        device: {
          deviceId: '93F18F53-A6E8-4A6A-91B4-836AB85BC247',
          name: 'GAN16ui',
        },
        manufacturerData: { 42241: new DataView(payload.buffer) },
      });
    });

    const transport = new NativeBleTransport(client);
    const device = await transport.requestDevice({
      captureManufacturerData: true,
      namePrefix: 'GAN',
      pickerLabels: {
        availableDevices: 'Available',
        cancel: 'Cancel',
        noDeviceFound: 'None',
        scanning: 'Scanning',
      },
    });

    expect([...device.manufacturerData!.get(0xa501)!]).toEqual([
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
    ]);
    expect(client.stopLEScan).toHaveBeenCalledOnce();
  });

  it('keeps write capability discovery isolated between connected devices', async () => {
    const client = fakeClient();
    vi.mocked(client.getServices)
      .mockResolvedValueOnce([{
        uuid: 'service-a',
        characteristics: [{ uuid: 'write', descriptors: [], properties: {
          authenticatedSignedWrites: false, broadcast: false, indicate: false, notify: false,
          read: false, write: false, writeWithoutResponse: true,
        } }],
      }])
      .mockResolvedValueOnce([{
        uuid: 'service-b',
        characteristics: [{ uuid: 'write', descriptors: [], properties: {
          authenticatedSignedWrites: false, broadcast: false, indicate: false, notify: false,
          read: false, write: true, writeWithoutResponse: false,
        } }],
      }]);
    const transport = new NativeBleTransport(client);
    await transport.connect('device-a', vi.fn());
    await transport.connect('device-b', vi.fn());

    await transport.write('device-a', 'service-a', 'write', Uint8Array.of(1));
    await transport.write('device-b', 'service-b', 'write', Uint8Array.of(2));
    expect(client.writeWithoutResponse).toHaveBeenCalledOnce();
    expect(client.write).toHaveBeenCalledOnce();
  });
});
