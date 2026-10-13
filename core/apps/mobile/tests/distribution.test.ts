import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ platform: 'android', get: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform }, registerPlugin: () => ({ get: mocks.get }) }));
import { initializeDistribution, usesDirectPayments, usesGooglePayments } from '../src/distribution';
beforeEach(() => { mocks.platform = 'android'; mocks.get.mockReset(); });
it('only enables web payments for the explicit native direct channel', async () => {
  mocks.get.mockResolvedValue({ channel: 'direct' }); await initializeDistribution();
  expect(usesDirectPayments()).toBe(true); expect(usesGooglePayments()).toBe(false);
  mocks.get.mockResolvedValue({ channel: 'play' }); await initializeDistribution();
  expect(usesDirectPayments()).toBe(false); expect(usesGooglePayments()).toBe(true);
});
it('fails closed on unknown configuration or bridge failure', async () => {
  mocks.get.mockResolvedValue({ channel: 'invalid' }); await initializeDistribution();
  expect(usesDirectPayments()).toBe(false);
  mocks.get.mockRejectedValue(new Error('missing')); await initializeDistribution();
  expect(usesDirectPayments()).toBe(false);
});
it('never enables Android payments on iOS or web', async () => {
  for (const platform of ['ios', 'web']) {
    mocks.platform = platform; await initializeDistribution();
    expect(usesDirectPayments()).toBe(false); expect(usesGooglePayments()).toBe(false);
  }
});
