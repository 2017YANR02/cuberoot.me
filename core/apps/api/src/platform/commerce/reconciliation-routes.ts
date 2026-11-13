import { requirePlatformAdmin } from '../auth.js';
import { withIdempotency, platformQuery, enqueuePlatformEvent, sendMutation, platformDb } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { privateNoStore } from '../http.js';
import { PLATFORM_PAYMENT_PROVIDERS } from '../payment.js';
import {
  readJsonObject,
  enumField,
  stringField,
  arrayField,
  isObject,
  integerField,
  pagination,
  resourceId,
} from '../validation.js';
import { safeMoney } from './amounts.js';
import { merchantAccount } from './payment-service.js';
import { type Hono } from 'hono';
import { createHash } from 'node:crypto';

export function registerReconciliationRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.post('/admin/reconciliation/runs', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const body = await readJsonObject(c);
    const provider = enumField(body, 'provider', PLATFORM_PAYMENT_PROVIDERS, { required: true })!;
    const suppliedMerchantAccount = stringField(body, 'merchantAccount', { max: 120 }) ?? merchantAccount(provider);
    if (suppliedMerchantAccount !== merchantAccount(provider)) badRequest('merchantAccount does not match the configured provider account');
    const statementDate = stringField(body, 'statementDate', { required: true, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ })!;
    const parsedDate = new Date(`${statementDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== statementDate) {
      badRequest('statementDate must be a valid calendar date');
    }
    const records = arrayField(body, 'records', { required: true, maxItems: 500 })!;
    if (!records.length) badRequest('records must contain at least one statement record');
    const normalized = records.map((raw, index) => {
      if (!isObject(raw)) badRequest(`records[${index}] must be an object`);
      const providerTransactionId = stringField(raw, 'providerTransactionId', { required: true, max: 200 })!;
      const amountMinor = integerField(raw, 'amountMinor', { required: true })!;
      const currency = stringField(raw, 'currency', { required: true, max: 3, pattern: /^[A-Za-z]{3}$/ })!.toUpperCase();
      return { providerTransactionId, amountMinor, currency };
    });
    if (new Set(normalized.map((record) => record.providerTransactionId)).size !== normalized.length) {
      badRequest('records contains duplicate providerTransactionId values');
    }
    const result = await withIdempotency(c, actor, `commerce.reconciliation.run:${provider}:${statementDate}`, body, async (db) => {
      const items: Array<Record<string, unknown>> = [];
      const counts = { matched: 0, missing_local: 0, amount_mismatch: 0, currency_mismatch: 0 };
      for (const record of normalized) {
        let paymentAttemptId: string | null = null;
        let refundId: string | null = null;
        let expectedAmountMinor: number | null = null;
        let expectedCurrency: string | null = null;
        if (record.amountMinor >= 0) {
          const matches = await platformQuery<{
            id: string; amount_minor: number | string; currency: string;
          }>(db, `
            SELECT id::text, amount_minor, currency FROM platform_payment_attempts
            WHERE provider = $1 AND merchant_account = $2 AND provider_transaction_id = $3
          `, [provider, suppliedMerchantAccount, record.providerTransactionId]);
          if (matches[0]) {
            paymentAttemptId = matches[0].id;
            expectedAmountMinor = safeMoney(matches[0].amount_minor, 'payment amount');
            expectedCurrency = matches[0].currency;
          }
        } else {
          const matches = await platformQuery<{
            id: string; amount_minor: number | string; currency: string;
          }>(db, `
            SELECT refund.id::text, refund.amount_minor, refund.currency
            FROM platform_refunds refund
            JOIN platform_payment_attempts attempt ON attempt.id = refund.payment_attempt_id
            WHERE refund.provider = $1 AND attempt.merchant_account = $2 AND refund.provider_refund_id = $3
          `, [provider, suppliedMerchantAccount, record.providerTransactionId]);
          if (matches[0]) {
            refundId = matches[0].id;
            expectedAmountMinor = -safeMoney(matches[0].amount_minor, 'refund amount');
            expectedCurrency = matches[0].currency;
          }
        }
        const status = expectedAmountMinor == null
          ? 'missing_local'
          : expectedCurrency !== record.currency
            ? 'currency_mismatch'
            : expectedAmountMinor !== record.amountMinor
              ? 'amount_mismatch'
              : 'matched';
        counts[status] += 1;
        const evidenceHash = createHash('sha256').update(JSON.stringify({
          provider,
          merchantAccount: suppliedMerchantAccount,
          statementDate,
          providerTransactionId: record.providerTransactionId,
          amountMinor: record.amountMinor,
          currency: record.currency,
        }), 'utf8').digest('hex');
        const inserted = await platformQuery<{ id: string; status: string }>(db, `
          INSERT INTO platform_reconciliation_records (
            provider, merchant_account, statement_date, provider_transaction_id,
            payment_attempt_id, refund_id, amount_minor, currency, status, evidence_hash
          ) VALUES ($1, $2, $3::date, $4, $5::uuid, $6::uuid, $7, $8, $9, decode($10, 'hex'))
          ON CONFLICT (provider, merchant_account, statement_date, provider_transaction_id) DO NOTHING
          RETURNING id::text, status
        `, [provider, suppliedMerchantAccount, statementDate, record.providerTransactionId,
          paymentAttemptId, refundId, record.amountMinor, record.currency, status, evidenceHash]);
        let row = inserted[0];
        if (!row) {
          const existing = await platformQuery<{ id: string; status: string; evidence_hash: string }>(db, `
            SELECT id::text, status, encode(evidence_hash, 'hex') AS evidence_hash
            FROM platform_reconciliation_records
            WHERE provider = $1 AND merchant_account = $2 AND statement_date = $3::date AND provider_transaction_id = $4
          `, [provider, suppliedMerchantAccount, statementDate, record.providerTransactionId]);
          if (!existing[0] || existing[0].evidence_hash !== evidenceHash) {
            conflict('A statement record was already imported with different evidence');
          }
          row = existing[0];
        }
        items.push({ id: row.id, providerTransactionId: record.providerTransactionId, amountMinor: record.amountMinor,
          currency: record.currency, status: row.status, paymentAttemptId, refundId });
      }
      const batchId = createHash('sha256').update(`${provider}:${suppliedMerchantAccount}:${statementDate}`, 'utf8').digest('hex');
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
        ) VALUES ($1, $2, 'commerce.reconciliation.import', 'platform_reconciliation_batch', $3, 'allowed', $4::jsonb)
      `, [actor.userId, actor.ownerKey, batchId, { provider, statementDate, recordCount: normalized.length, counts }]);
      await enqueuePlatformEvent(db, 'platform.reconciliation.imported', 'platform_reconciliation_batch', batchId,
        `reconciliation:${batchId}`, { provider, statementDate, recordCount: normalized.length, counts });
      return { status: 201, body: { provider, merchantAccount: suppliedMerchantAccount, statementDate, counts, items },
        resourceType: 'platform_reconciliation_batch', resourceId: batchId };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.get('/admin/reconciliation', async (c) => {
    await requirePlatformAdmin(c);
    const { page, pageSize, offset } = pagination(c);
    const q=c.req.query('q')?.trim().slice(0,200)??'';
    const rows = await platformQuery(platformDb(), `SELECT id::text, provider, merchant_account AS "merchantAccount", statement_date AS "statementDate", provider_transaction_id AS "providerTransactionId", payment_attempt_id::text AS "paymentAttemptId", refund_id::text AS "refundId", amount_minor AS "amountMinor", currency, status, resolution_note AS "resolutionNote", resolved_at AS "resolvedAt", created_at AS "createdAt" FROM platform_reconciliation_records WHERE ($3='' OR provider_transaction_id ILIKE '%'||$3||'%') ORDER BY statement_date DESC, id DESC LIMIT $1 OFFSET $2`, [pageSize, offset,q]);
    privateNoStore(c);
    const counts=await platformQuery<{total:number}>(platformDb(),`SELECT COUNT(*)::int AS total FROM platform_reconciliation_records WHERE TRUE AND ($1='' OR provider_transaction_id ILIKE '%'||$1||'%')`,[q]);
    return c.json({ items: rows, page, pageSize,total:counts[0]?.total??0 });
  });

  platformCommerceRoutes.post('/admin/reconciliation/:id/resolve', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const note = stringField(body, 'resolutionNote', { required: true, max: 4000 })!;
    const result = await withIdempotency(c, actor, `commerce.reconciliation.resolve:${id}`, body, async (db) => {
      const rows = await platformQuery<{ id: string; resolved_at: string | null }>(db, `SELECT id::text, resolved_at FROM platform_reconciliation_records WHERE id = $1::uuid FOR UPDATE`, [id]);
      if (!rows[0]) notFound('Reconciliation record');
      if (rows[0].resolved_at) conflict('Reconciliation record is already resolved');
      await platformQuery(db, `UPDATE platform_reconciliation_records SET resolved_by_user_id = $2, resolved_by_actor_key = $3, resolution_note = $4, resolved_at = NOW() WHERE id = $1::uuid`, [id, actor.userId, actor.ownerKey, note]);
      return { status: 200, body: { id, resolved: true }, resourceType: 'platform_reconciliation_record', resourceId: id };
    });
    return sendMutation(c, result);
  });
}
