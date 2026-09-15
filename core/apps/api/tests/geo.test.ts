import { beforeEach, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/ip_geolocation.js', () => ({ resolveIpCountry: lookup }));
import { geoRoutes } from '../src/routes/geo.js';

beforeEach(() => lookup.mockReset().mockResolvedValue('cn'));

it('returns only the visitor country using the trusted proxy header without public caching', async () => {
  const response = await geoRoutes.request('/geo/country?ip=192.0.2.99', {
    headers: { 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '192.0.2.2' },
  });
  expect(lookup).toHaveBeenCalledWith('192.0.2.1');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ country: 'cn' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('does not accept forwarded or query IPs when the trusted header is absent', async () => {
  lookup.mockResolvedValue(null);
  const response = await geoRoutes.request('/geo/country?ip=192.0.2.99', {
    headers: { 'x-forwarded-for': '192.0.2.2' },
  });
  expect(lookup).toHaveBeenCalledWith('0.0.0.0');
  expect(await response.json()).toEqual({ country: null });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
