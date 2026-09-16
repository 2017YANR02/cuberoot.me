import { Hono } from 'hono';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { diskCapacity, diskScanner, resolveDiskPath } from '../observability/disk.js';

export const adminDiskRoutes = new Hono();

adminDiskRoutes.get('/admin/disk', async c => {
  c.header('Cache-Control', 'no-store');
  await requireAdminOrApiKey(c);
  const path = c.req.query('path') ?? '/';
  const refresh = c.req.query('refresh');
  if (refresh !== undefined && refresh !== '1') return c.json({ error: 'Invalid refresh' }, 400);
  try { await resolveDiskPath(path); }
  catch { return c.json({ error: 'Directory unavailable' }, 400); }
  try {
    return c.json({ capacity: await diskCapacity(), ...diskScanner.read(path, refresh === '1') });
  } catch {
    return c.json({ error: 'Disk information unavailable' }, 503);
  }
});
