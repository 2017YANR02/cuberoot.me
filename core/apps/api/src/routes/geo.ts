import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { resolveIpCountry } from '../utils/ip_geolocation.js';

export const geoRoutes = new Hono();

geoRoutes.get('/geo/country', async c => {
  // This response varies by visitor, including when the lookup is unavailable.
  c.header('Cache-Control', 'private, no-store');
  return c.json({ country: await resolveIpCountry(getIp(c)) });
});
