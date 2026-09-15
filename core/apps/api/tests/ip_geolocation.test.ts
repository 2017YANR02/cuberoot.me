import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const exec = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({
  execFile: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: exec }),
}));
beforeEach(() => { vi.resetModules(); exec.mockReset(); });
afterEach(() => vi.useRealTimers());

it('reads normalized ISO codes and deduplicates concurrent and cached lookups', async () => {
  exec.mockResolvedValue({ stdout: '\n  "US" <utf8_string>\n' });
  const { resolveIpCountry } = await import('../src/utils/ip_geolocation.js');
  expect(await Promise.all([resolveIpCountry('192.0.2.1'), resolveIpCountry('192.0.2.1')])).toEqual(['us', 'us']);
  expect(await resolveIpCountry('192.0.2.1')).toBe('us');
  expect(exec).toHaveBeenCalledOnce();
  expect(exec.mock.calls[0][1].slice(-4)).toEqual(['--ip', '192.0.2.1', 'country', 'iso_code']);
  expect(exec.mock.calls[0][2]).toMatchObject({ timeout: 2_000, windowsHide: true });
});

it('rejects invalid inputs and degrades to null for missing databases or invalid ISO codes', async () => {
  const { resolveIpCountry } = await import('../src/utils/ip_geolocation.js');
  for (const ip of ['', 'unknown', '0.0.0.0', '::', '192.0.2.1 --help']) {
    expect(await resolveIpCountry(ip)).toBeNull();
  }
  expect(exec).not.toHaveBeenCalled();
  exec.mockRejectedValueOnce(new Error('database missing'));
  expect(await resolveIpCountry('192.0.2.1')).toBeNull();
  exec.mockResolvedValueOnce({ stdout: '"United States" <utf8_string>' });
  expect(await resolveIpCountry('2001:db8::1')).toBeNull();
  exec.mockResolvedValueOnce({ stdout: '"AU" <utf8_string>' });
  expect(await resolveIpCountry('2001:db8::2')).toBe('au');
});

it('expires country cache after one day', async () => {
  vi.useFakeTimers();
  exec.mockResolvedValue({ stdout: '"CN" <utf8_string>' });
  const { resolveIpCountry } = await import('../src/utils/ip_geolocation.js');
  expect(await resolveIpCountry('192.0.2.1')).toBe('cn');
  vi.advanceTimersByTime(24 * 60 * 60 * 1_000);
  exec.mockResolvedValue({ stdout: '"AU" <utf8_string>' });
  expect(await resolveIpCountry('192.0.2.1')).toBe('au');
  expect(exec).toHaveBeenCalledTimes(2);
});

it('keeps localized presence lookup behavior and shares the two-command limit', async () => {
  let active = 0;
  let maximum = 0;
  exec.mockImplementation(async (_executable, args: string[]) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active -= 1;
    const value = args.includes('iso_code') ? 'US' : args.includes('city') ? 'Boston' : 'United States';
    return { stdout: `${JSON.stringify(value)} <utf8_string>` };
  });
  const { resolveIpCountry, resolveIpLocation } = await import('../src/utils/ip_geolocation.js');
  const [location, country] = await Promise.all([resolveIpLocation('192.0.2.1'), resolveIpCountry('192.0.2.2')]);
  expect(location).toEqual({ en: 'United States Boston', zh: 'United States Boston', precision: 'city' });
  expect(country).toBe('us');
  expect(maximum).toBe(2);
  expect(await resolveIpLocation('192.0.2.1')).toEqual(location);
  expect(exec).toHaveBeenCalledTimes(5);
});
