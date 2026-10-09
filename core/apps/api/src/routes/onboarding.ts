import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAppUserId } from '../utils/app_user_auth.js';

export const onboardingRoutes = new Hono();

onboardingRoutes.get('/auth/onboarding', async (c) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireAppUserId(c);
  const [row] = await query<{ home_onboarding_seen: boolean }>(
    'SELECT home_onboarding_seen FROM app_users WHERE id = ?', [uid],
  );
  if (!row) return c.json({ error: 'account not found' }, 404);
  return c.json({ seen: row.home_onboarding_seen });
});

// Monotonic and idempotent: replaying the tour never resets account progress.
onboardingRoutes.put('/auth/onboarding', async (c) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireAppUserId(c);
  const rows = await query<{ id: number }>(
    'UPDATE app_users SET home_onboarding_seen = TRUE WHERE id = ? RETURNING id', [uid],
  );
  if (!rows.length) return c.json({ error: 'account not found' }, 404);
  return c.json({ seen: true });
});
