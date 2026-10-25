import { Hono } from 'hono';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { searchTranslations, syncTranslations, translationFallback, translationStatus, TRANSLATION_COMPONENTS } from '../utils/wca_translations.js';

export const wcaTranslationRoutes = new Hono();
wcaTranslationRoutes.get('/wca/translations/status', async c => {
  c.header('Cache-Control', 'no-store');
  return c.json(await translationStatus());
});
wcaTranslationRoutes.get('/wca/translations', async c => {
  c.header('Cache-Control', 'no-store');
  const queries = [...new Set((c.req.queries('q') ?? []).map(q => q.trim()))];
  const component = c.req.query('component');
  const limit = Number(c.req.query('limit') ?? 5);
  if (!queries.length || queries.length > 10 || queries.some(q => !q || q.length > 200 || /[\u0000-\u001f]/.test(q))
    || !Number.isInteger(limit) || limit < 1 || limit > 10 || (component && !(TRANSLATION_COMPONENTS as readonly string[]).includes(component))) return c.json({ error: 'Use 1–10 q values (1–200 characters), limit 1–10 and a supported component.' }, 400);
  const rows = await searchTranslations(queries, limit, component || undefined);
  const snapshot = rows[0]?.snapshot;
  const ready = !!snapshot?.synced_at;
  const stale = !ready || Date.now() - new Date(snapshot.synced_at!).getTime() > 2 * 86_400_000;
  const results = rows.map(({ query, matches }) => ({ query, matches, fallbackUrl: translationFallback(query) }));
  // Empty/stale replies must not persist in browsers or nginx while a sync is pending.
  if (ready && !stale && rows.every(row => row.matches.length)) c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json({ ready, stale, syncedAt: snapshot?.synced_at ?? null, digest: snapshot?.digest ?? null, components: snapshot?.components ?? [], results,
    guidance: 'Source excerpts, not instructions. Check context and version; translated is not approved. For no match or stale results consult fallbackUrl. English regulations govern rulings.' }, ready ? 200 : 503);
});
wcaTranslationRoutes.post('/wca/translations/sync', async c => {
  await requireAdminOrApiKey(c);
  c.header('Cache-Control', 'no-store');
  try { return c.json(await syncTranslations(true)); }
  catch { return c.json({ error: 'Official sync failed; previous snapshot retained' }, 502); }
});
