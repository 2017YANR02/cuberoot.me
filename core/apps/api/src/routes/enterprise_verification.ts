import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import type postgres from 'postgres';
import type { EnterpriseBankRecipient, EnterpriseVerificationApplication, EnterpriseVerificationReviewDetails } from '@cuberoot/shared/teaching';
import { sql } from '../db/connection.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { requireAdmin, checkRateLimit } from '../utils/recon_helpers.js';
import { encryptPrivateData, decryptPrivateData, parsePrivateDataKey } from '../utils/private_data_encryption.js';
import { assertReceiptMatches, digest, invalid, parseDraft, parseReceipt, parseRecipient, requiredText } from '../utils/enterprise_verification.js';

type Tx = postgres.TransactionSql;
type Row = Record<string, any>;
const routes = new Hono();
const root = '/enterprise-verification';
const uuid = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid('Invalid application ID');
  return value;
};
function key(): Buffer {
  try { return parsePrivateDataKey(process.env.ENTERPRISE_VERIFICATION_KEY ?? ''); }
  catch { throw new HTTPException(503, { message: 'Enterprise verification is not configured' }); }
}
function ready(): boolean { try { key(); return true; } catch { return false; } }
const seal = (id: string, value: object) => encryptPrivateData(value as Record<string, unknown>, key(), Buffer.from(`enterprise-verification:${id}`));
const unseal = (id: string, value: Buffer) => decryptPrivateData(value, key(), Buffer.from(`enterprise-verification:${id}`));
const iso = (value: Date | string) => new Date(value).toISOString();
const fail = (status: 403 | 404 | 409 | 503, message: string): never => { throw new HTTPException(status, { message }); };
async function body(c: Context): Promise<Record<string, unknown>> {
  const value = await c.req.json().catch(() => null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Invalid request');
  return value;
}
async function admin(c: Context): Promise<number> {
  await requireAdmin(c); // Deliberately requires an accountable session, not an anonymous admin API key.
  return requireAppUserId(c);
}
async function access(tx: Tx, slug: string, userId: number) {
  const rows = await tx`SELECT o.id, o.slug, o.status, m.role FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id
    WHERE o.slug = ${slug} AND m.user_id = ${userId} AND m.status = 'active'
    AND m.role IN ('owner','admin') FOR UPDATE OF o FOR SHARE OF m`;
  if (!rows.length || rows[0].status !== 'active') fail(403, 'Organization management access required');
  return rows[0];
}
async function event(tx: Tx, application: string | null, actor: number, action: string) {
  await tx`INSERT INTO enterprise_verification_events(application_id, actor_id, action) VALUES (${application},${actor},${action})`;
}
async function expire(tx: Tx, orgId: string) {
  // Submitted applications remain reviewable: the bank receipt must still predate the deadline.
  await tx`UPDATE enterprise_verification_applications SET status = 'expired'
    WHERE organization_id = ${orgId} AND status = 'awaiting_transfer' AND expires_at <= NOW()`;
}
function view(row: Row, withRecipient = false): EnterpriseVerificationApplication {
  const status = row.status === 'awaiting_transfer' && new Date(row.expires_at).getTime() <= Date.now() ? 'expired' : row.status;
  return {
    id: row.id, organizationId: row.organization_id, organizationSlug: row.slug,
    legalName: row.legal_name, creditCode: row.credit_code, status,
    amountMinor: row.amount_minor, transferReference: row.transfer_reference,
    expiresAt: iso(row.expires_at), createdAt: iso(row.created_at), reviewNote: row.review_note,
    refundedAt: row.refunded_at ? iso(row.refunded_at) : null, receivedAt: row.received_at ? iso(row.received_at) : null,
    ...(withRecipient ? { recipient: unseal(row.id, row.encrypted_details).recipient as EnterpriseBankRecipient } : {}),
  };
}
routes.use(`${root}/*`, async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
routes.use(`${root}/*`, bodyLimit({ maxSize: 3 * 1024 * 1024 }));
routes.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  if (error.message.includes('Authentication required')) return c.json({ error: 'Authentication required' }, 401);
  if (error.message.includes('Admin access required')) return c.json({ error: 'Admin access required' }, 403);
  if (error.message.includes('Rate limit')) return c.json({ error: 'Rate limit exceeded' }, 429);
  if ('code' in error && error.code === '23505') return c.json({ error: 'Application, credit code or bank transaction already in use' }, 409);
  // Do not emit SQL parameters, documents, accounts, or decrypted material to logs / responses.
  console.error('[enterprise-verification] request failed', error.name);
  return c.json({ error: 'Enterprise verification unavailable' }, 500);
});

routes.get(`${root}/organizations/:slug`, async c => {
  const actor = await requireAppUserId(c);
  const result = await sql.begin(async tx => {
    const org = await access(tx, c.req.param('slug'), actor);
    const rows = await tx`SELECT a.*, ${org.slug}::text AS slug FROM enterprise_verification_applications a
      WHERE organization_id = ${org.id} ORDER BY created_at DESC LIMIT 1`;
    const settings = ready() ? await tx`SELECT encrypted_details FROM enterprise_verification_settings WHERE singleton` : [];
    const available = settings.length > 0 && unseal('settings', settings[0].encrypted_details).enabled === true;
    return { available, application: rows.length ? view(rows[0], ready()) : null };
  });
  return c.json(result);
});
routes.post(`${root}/organizations/:slug`, async c => {
  const actor = await requireAppUserId(c);
  checkRateLimit(String(actor), { bucket: 'enterprise-application', max: 5 });
  const draft = parseDraft(await body(c));
  const idempotencyKey = requiredText(c.req.header('Idempotency-Key'), 100);
  const hash = digest(JSON.stringify(draft));
  const result = await sql.begin(async tx => {
    const org = await access(tx, c.req.param('slug'), actor);
    const old = await tx`SELECT a.*, ${org.slug}::text AS slug FROM enterprise_verification_applications a
      WHERE organization_id = ${org.id} AND idempotency_key = ${idempotencyKey}`;
    if (old.length) {
      if (old[0].payload_hash !== hash) fail(409, 'Idempotency key reused with different details');
      return view(old[0], true);
    }
    const settings = await tx`SELECT encrypted_details FROM enterprise_verification_settings WHERE singleton FOR SHARE`;
    if (!settings.length) fail(503, 'Enterprise verification is not configured');
    const recipient = unseal('settings', settings[0].encrypted_details) as unknown as EnterpriseBankRecipient;
    if (!recipient.enabled) fail(503, 'Enterprise verification is not accepting applications');
    await expire(tx, org.id);
    const existing = await tx`SELECT id FROM enterprise_verification_applications WHERE organization_id = ${org.id}
      AND status IN ('awaiting_transfer','pending_review','verified')`;
    if (existing.length) fail(409, 'An active verification application already exists');
    const duplicate = await tx`SELECT id FROM enterprise_verification_applications WHERE credit_code = ${draft.creditCode} AND status = 'verified'`;
    if (duplicate.length) fail(409, 'Enterprise already verified; contact support to claim the existing organization');
    const id = randomUUID();
    const reference = 'CR' + randomBytes(8).toString('hex').toUpperCase();
    const rows = await tx`INSERT INTO enterprise_verification_applications
      (id,organization_id,applicant_id,idempotency_key,payload_hash,legal_name,credit_code,amount_minor,transfer_reference,encrypted_details,expires_at)
      VALUES (${id},${org.id},${actor},${idempotencyKey},${hash},${draft.legalName},${draft.creditCode},${randomInt(1,100)},${reference},
        ${seal(id, { ...draft, recipient })}, NOW() + INTERVAL '7 days') RETURNING *`;
    await event(tx, id, actor, 'application.created');
    return view({ ...rows[0], slug: org.slug }, true);
  });
  return c.json({ application: result }, 201);
});
routes.post(`${root}/organizations/:slug/:id/submit`, async c => {
  const actor = await requireAppUserId(c);
  const id = uuid(c.req.param('id'));
  await sql.begin(async tx => {
    const org = await access(tx, c.req.param('slug'), actor);
    const rows = await tx`SELECT * FROM enterprise_verification_applications WHERE id = ${id} AND organization_id = ${org.id} FOR UPDATE`;
    if (!rows.length) fail(404, 'Application not found');
    if (rows[0].status === 'pending_review') return;
    if (rows[0].status !== 'awaiting_transfer' || new Date(rows[0].expires_at).getTime() <= Date.now()) fail(409, 'Application cannot be submitted');
    await tx`UPDATE enterprise_verification_applications SET status = 'pending_review', submitted_at = NOW() WHERE id = ${id}`;
    await event(tx, id, actor, 'transfer.declared');
  });
  return c.json({ ok: true });
});
routes.get(`${root}/admin/settings`, async c => {
  await admin(c);
  const rows = ready() ? await sql`SELECT encrypted_details FROM enterprise_verification_settings WHERE singleton` : [];
  return c.json({ keyReady: ready(), settings: rows.length ? unseal('settings', rows[0].encrypted_details) : null });
});
routes.put(`${root}/admin/settings`, async c => {
  const actor = await admin(c);
  const settings = parseRecipient(await body(c));
  await sql.begin(async tx => {
    await tx`INSERT INTO enterprise_verification_settings(singleton, encrypted_details, updated_by)
      VALUES (TRUE,${seal('settings', settings)},${actor}) ON CONFLICT (singleton)
      DO UPDATE SET encrypted_details = EXCLUDED.encrypted_details, updated_by = EXCLUDED.updated_by, updated_at = NOW()`;
    await event(tx, null, actor, 'settings.updated');
  });
  return c.json({ ok: true });
});
routes.get(`${root}/admin/applications`, async c => {
  await admin(c);
  const offset = Number(c.req.query('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) invalid('Invalid offset');
  const rows = await sql`SELECT a.id, a.organization_id, a.legal_name, a.credit_code, a.status,
    a.amount_minor, a.transfer_reference, a.expires_at, a.created_at, a.review_note,
    a.refunded_at, a.received_at, o.slug FROM enterprise_verification_applications a
    JOIN organizations o ON o.id = a.organization_id ORDER BY a.created_at DESC, a.id LIMIT 51 OFFSET ${offset}`;
  return c.json({ applications: rows.slice(0,50).map(row => view(row)), hasMore: rows.length > 50 });
});
routes.get(`${root}/admin/applications/:id`, async c => {
  const actor = await admin(c);
  const id = uuid(c.req.param('id'));
  const result = await sql.begin(async tx => {
    const rows = await tx`SELECT a.*, o.slug FROM enterprise_verification_applications a JOIN organizations o ON o.id = a.organization_id WHERE a.id = ${id}`;
    if (!rows.length) fail(404, 'Application not found');
    const details = unseal(id, rows[0].encrypted_details);
    await event(tx, id, actor, 'materials.viewed');
    return { application: view(rows[0]), details };
  });
  return c.json(result);
});
routes.post(`${root}/admin/applications/:id/review`, async c => {
  const actor = await admin(c);
  const id = uuid(c.req.param('id'));
  const input = await body(c);
  if (!['verify','reject'].includes(String(input.decision))) invalid('Invalid decision');
  const note = requiredText(input.note, 1000);
  await sql.begin(async tx => {
    const rows = await tx`SELECT a.*, o.status AS organization_status FROM enterprise_verification_applications a
      JOIN organizations o ON o.id = a.organization_id WHERE a.id = ${id} FOR UPDATE OF a, o`;
    if (!rows.length) fail(404, 'Application not found');
    const row = rows[0];
    const membership = await tx`SELECT 1 FROM organization_members WHERE organization_id = ${row.organization_id} AND user_id = ${actor} AND status = 'active'`;
    if (membership.length || Number(row.applicant_id) === actor) fail(403, 'A different platform administrator must review this application');
    if (!['awaiting_transfer','pending_review'].includes(row.status)) fail(409, 'Application already closed');
    if (row.organization_status !== 'active') fail(409, 'Organization is not active');
    const details = unseal(id, row.encrypted_details) as unknown as EnterpriseVerificationReviewDetails;
    let transactionHash: string | null = row.bank_transaction_hash;
    let receivedAt: string | null = row.received_at ? iso(row.received_at) : null;
    if (input.receipt) {
      const receipt = parseReceipt(input.receipt as Record<string, unknown>);
      if (transactionHash) fail(409, 'Bank receipt already recorded');
      if (Date.parse(receipt.receivedAt) > Date.now()) invalid('Receipt cannot be future dated');
      details.receipt = receipt;
      transactionHash = digest(`${details.recipient.accountNumber}:${receipt.transactionId}`);
      receivedAt = receipt.receivedAt;
    }
    if (input.decision === 'verify') {
      if (details.receipt) assertReceiptMatches(details.receipt, { legalName: row.legal_name, payerAccount: details.payerAccount,
        amountMinor: row.amount_minor, reference: row.transfer_reference, createdAt: iso(row.created_at), expiresAt: iso(row.expires_at) });
      if (row.status !== 'pending_review') fail(409, 'Applicant must submit the transfer first');
      if (input.registryChecked !== true || input.licenseChecked !== true || input.authorizationChecked !== true || !transactionHash) invalid('Registry, license, authorization and bank receipt checks are required');
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${row.credit_code}, 0))`;
      const duplicate = await tx`SELECT id FROM enterprise_verification_applications WHERE credit_code = ${row.credit_code} AND status = 'verified' AND id <> ${id}`;
      if (duplicate.length) fail(409, 'Enterprise already verified');
    }
    details.reviewEvidence = { decision: String(input.decision), note, registryChecked: input.registryChecked === true, licenseChecked: input.licenseChecked === true, authorizationChecked: input.authorizationChecked === true };
    await tx`UPDATE enterprise_verification_applications SET status = ${input.decision === 'verify' ? 'verified' : 'rejected'},
      reviewed_by = ${actor}, reviewed_at = NOW(), review_note = ${note}, bank_transaction_hash = ${transactionHash},
      received_at = ${receivedAt}, encrypted_details = ${seal(id, details)} WHERE id = ${id}`;
    await event(tx, id, actor, input.decision === 'verify' ? 'application.verified' : 'application.rejected');
  });
  return c.json({ ok: true });
});
routes.post(`${root}/admin/applications/:id/receipt`, async c => {
  const actor = await admin(c);
  const id = uuid(c.req.param('id'));
  const receipt = parseReceipt(await body(c));
  if (Date.parse(receipt.receivedAt) > Date.now()) invalid('Receipt cannot be future dated');
  await sql.begin(async tx => {
    const rows = await tx`SELECT * FROM enterprise_verification_applications WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) fail(404, 'Application not found');
    const row = rows[0];
    const details = unseal(id, row.encrypted_details) as unknown as EnterpriseVerificationReviewDetails;
    if (row.bank_transaction_hash) {
      if (JSON.stringify(details.receipt) !== JSON.stringify(receipt)) fail(409, 'Bank receipt already recorded');
      return;
    }
    // Record actual unmatched/late funds for return; this endpoint never grants certification.
    await tx`UPDATE enterprise_verification_applications SET bank_transaction_hash = ${digest(details.recipient.accountNumber + ':' + receipt.transactionId)},
      received_at = ${receipt.receivedAt}, encrypted_details = ${seal(id, { ...details, receipt })} WHERE id = ${id}`;
    await event(tx, id, actor, 'receipt.recorded');
  });
  return c.json({ ok: true });
});
routes.post(`${root}/admin/applications/:id/refund`, async c => {
  const actor = await admin(c);
  const id = uuid(c.req.param('id'));
  const input = await body(c);
  const reference = requiredText(input.reference, 160);
  if (input.returnedToOriginalAccount !== true) invalid('Refund must be returned to the original payer account');
  await sql.begin(async tx => {
    const rows = await tx`SELECT * FROM enterprise_verification_applications WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) fail(404, 'Application not found');
    const row = rows[0];
    if (!row.bank_transaction_hash) fail(409, 'Confirm the original bank receipt before recording a refund');
    const details = unseal(id, row.encrypted_details);
    if (row.refunded_at) {
      if (details.refundReference !== reference) fail(409, 'Refund already recorded');
      return;
    }
    await tx`UPDATE enterprise_verification_applications SET refunded_at = NOW(), refund_transaction_hash = ${digest(String((details.recipient as EnterpriseBankRecipient).accountNumber) + ':' + reference)}, encrypted_details = ${seal(id, { ...details, refundReference: reference })} WHERE id = ${id}`;
    await event(tx, id, actor, 'refund.recorded');
  });
  return c.json({ ok: true });
});
routes.post(`${root}/admin/applications/:id/revoke`, async c => {
  const actor = await admin(c);
  const id = uuid(c.req.param('id'));
  const note = requiredText((await body(c)).note, 1000);
  await sql.begin(async tx => {
    const rows = await tx`UPDATE enterprise_verification_applications SET status = 'revoked', review_note = ${note}, reviewed_by = ${actor}, reviewed_at = NOW()
      WHERE id = ${id} AND status = 'verified' RETURNING id`;
    if (!rows.length) fail(409, 'No active certification to revoke');
    await event(tx, id, actor, 'application.revoked');
  });
  return c.json({ ok: true });
});
export const enterpriseVerificationRoutes = routes;
