import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { checkRateLimit, requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { getIp } from '../utils/analytics_helpers.js';
import { invalidateBenefitTranslations, validateMembershipBenefits, type MembershipBenefits } from '@cuberoot/shared/membership-benefits';

/** Public copy is kept separate from orders, prices and access enforcement. */
export const membershipBenefitsRoutes = new Hono();

membershipBenefitsRoutes.get('/membership/benefits', async (c) => {
  c.header('Cache-Control', 'no-store');
  const [row] = await query<MembershipBenefits>('SELECT revision, items FROM membership_benefits WHERE id = 1');
  if (!row) return c.json({ error: 'Membership benefits are not initialized' }, 503);
  return c.json(row);
});

membershipBenefitsRoutes.put('/membership/admin/benefits', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdminOrApiKey(c);
  checkRateLimit(getIp(c));
  const body = await c.req.json().catch(() => null);
  const items = validateMembershipBenefits(body?.items);
  if (!items || !Number.isSafeInteger(body?.revision) || body.revision < 1) {
    return c.json({ error: 'Invalid benefits: Chinese is required; English is optional' }, 400);
  }
  const [previous] = await query<MembershipBenefits>('SELECT revision, items FROM membership_benefits WHERE id = 1');
  if (!previous) return c.json({ error: 'Membership benefits are not initialized' }, 503);
  if (previous.revision !== body.revision) return c.json({ error: 'Benefits changed; reload before saving' }, 409);
  const normalized = invalidateBenefitTranslations(items, previous.items);
  const [saved] = await query<MembershipBenefits>(
    'UPDATE membership_benefits SET items = ?::jsonb, revision = revision + 1, updated_at = now() WHERE id = 1 AND revision = ? RETURNING revision, items',
    [normalized, body.revision],
  );
  if (!saved) return c.json({ error: 'Benefits changed; reload before saving' }, 409);
  return c.json(saved);
});
