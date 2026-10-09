import { describe, expect, it, vi } from 'vitest';
import { GanCubeConnection } from './gan-cube';
import { GanV4CubeConnection } from './gan-v4-cube';
import { Moyu32CubeConnection } from './moyu32-cube';
import type { BleTransport } from './transport';
import { resolveCubeMac } from './mac';

describe('installed cube MAC identity', () => {
  it.each(['gan', 'moyu32'] as const)('preserves the Windows real address for %s', async (family) => {
    const prompt = vi.fn();
    expect(await resolveCubeMac({ id: 'AB:CD:EF:01:23:45', name: 'cube' }, family, prompt))
      .toEqual(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
    expect(prompt).not.toHaveBeenCalled();
  });
  it.each([['gan', 'GAN16ui_C2AF'], ['moyu32', 'WCU_MY32_5C3A']] as const)(
    'requests the actual MAC for Apple %s instead of guessing from the suffix', async (family, name) => {
      const prompt = vi.fn(async () => 'AB:CD:EF:01:23:45');
      expect(await resolveCubeMac({ id: 'Apple-UUID', name }, family, prompt))
        .toEqual(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
      expect(prompt).toHaveBeenCalledWith(name);
    });
  it('uses GAN manufacturer data when Apple provides it', async () => {
    const prompt = vi.fn();
    expect(await resolveCubeMac({ id: 'Apple-UUID', name: 'GAN16ui_C2AF',
      manufacturerData: new Map([[1, Uint8Array.of(0, 0, 0, 0x45, 0x23, 1, 0xef, 0xcd, 0xab)]]) }, 'gan', prompt))
      .toEqual(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
    expect(prompt).not.toHaveBeenCalled();
  });
  it('fails closed when address entry is cancelled', async () => {
    await expect(resolveCubeMac({ id: 'Apple-UUID', name: 'WCU_MY32_5C3A' }, 'moyu32', async () => null))
      .rejects.toThrow('Cube MAC address required');
  });
});

it.each([
  [GanCubeConnection, 'GAN16ui_C2AF'],
  [GanV4CubeConnection, 'GAN16ui_C2AF'],
  [Moyu32CubeConnection, 'WCU_MY32_5C3A'],
] as const)('does not open GATT after cancelling address resolution (%s)', async (Connection, name) => {
  const connect = vi.fn();
  const transport = { connect } as unknown as BleTransport;
  const connection = new Connection(transport, {
    onDisconnect: vi.fn(), onMove: vi.fn(), onProtocolError: vi.fn(),
  });
  const pending = connection.connect({ id: 'AB:CD:EF:01:23:45', name }).catch((error: unknown) => error);
  await connection.disconnect();
  expect((await pending as Error).message).toBe('smart cube connection closed');
  expect(connect).not.toHaveBeenCalled();
});

it.each(['gan', 'moyu32'] as const)('uses native macAddress without changing the Apple UUID for %s', async (family) => {
  const device = { id: '11111111-2222-3333-4444-555555555555', name: 'cube', macAddress: 'AB:CD:EF:01:23:45' };
  const prompt = vi.fn();
  expect(await resolveCubeMac(device, family, prompt)).toEqual(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  expect(device.id).toBe('11111111-2222-3333-4444-555555555555');
  expect(prompt).not.toHaveBeenCalled();
});
