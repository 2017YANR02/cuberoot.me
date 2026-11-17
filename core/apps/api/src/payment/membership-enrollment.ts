import { randomBytes } from 'node:crypto';
import { canPurchaseEnterpriseMembership } from '../utils/enterprise_membership.js';
import { withTransaction, type QueryRunner } from '../db/connection.js';
import { createPapayEnrollment, createPapayMiniEnrollment, papayConfig, PapayUnavailable } from './wechat-papay.js';
import { RENEWAL_TEMPLATES, RENEWAL_TERMS_VERSION, renewalChannel, renewalEnrollmentAllowed, renewalPlanConfigured, type RenewalSlug } from './membership-renewal-policy.js';
import type { MembershipContractRow } from './membership-contracts.js';

/** Reserve ownership and immutable consent before handing off to WeChat. Retry reuses the reservation. */
export function validateMembershipConsent(input: unknown) {
  const body = input as Record<string, unknown> | null;
  if (!body || typeof body.planSlug !== 'string' || !Object.hasOwn(RENEWAL_TEMPLATES, body.planSlug)
    || body.agreed !== true || body.termsVersion !== RENEWAL_TERMS_VERSION) throw new Error('invalid renewal consent');
  const slug = body.planSlug as RenewalSlug;
  if (!renewalPlanConfigured(slug)) throw new PapayUnavailable();
  const template = RENEWAL_TEMPLATES[slug];
  if (body.priceCents !== template.cents) throw new Error('renewal price changed');
  return { slug, template };
}

export async function reserveMembershipContract(tx: QueryRunner, owner: string, input: unknown, method: 'pure' | 'payment') {
  if (!renewalEnrollmentAllowed(owner)) throw new PapayUnavailable();
  const { slug, template } = validateMembershipConsent(input);
  const { appid, mchId } = papayConfig();
  await tx("SET LOCAL lock_timeout = '1000ms'");
  const [account] = await tx(`SELECT id FROM app_users WHERE (wca_id = ? OR 'u' || id::text = ?)
    AND merged_into_user_id IS NULL FOR UPDATE`, [owner, owner]);
  if (!account) throw new Error('account unavailable');
  if (slug.startsWith('enterprise_') && !await canPurchaseEnterpriseMembership(owner, tx)) {
    throw new Error('verified enterprise management access required');
  }
  const [existing] = await tx<MembershipContractRow & { enrollment_serial: string; signing_method: string; terms_version: string; debit_cycle: number }>(
    `SELECT * FROM membership_contracts WHERE wca_id = ? AND state <> 'terminated' FOR UPDATE`, [owner]);
  if (existing) {
    if (existing.state !== 'pending' || existing.cancellation_requested_at || existing.plan_slug !== slug
      || !existing.enrollment_serial || existing.appid !== appid || existing.mch_id !== mchId
      || existing.plan_id !== template.id || existing.price_cents !== template.cents
      || existing.terms_version !== RENEWAL_TERMS_VERSION) throw new Error('existing subscription requires management');
    if (existing.signing_method !== method) {
      if (method !== 'payment' || existing.signing_method !== 'pure' || existing.contract_id || existing.debit_cycle !== 0) {
        throw new Error('existing subscription requires management');
      }
      const attempts = await tx('SELECT out_trade_no FROM membership_renewal_debits WHERE contract_id = ? LIMIT 1', [existing.id]);
      if (attempts.length) throw new Error('existing subscription requires management');
      // Continue the SAME authorization, never infer cancellation from an absent/unsigned
      // provider reply. The caller saves cycle zero in this transaction, so a late mini
      // signing notification cannot cause the worker to charge the first period as well.
      const [continued] = await tx<MembershipContractRow & { enrollment_serial: string }>(
        "UPDATE membership_contracts SET signing_method = 'payment', consented_at = now(), updated_at = now() WHERE id = ? RETURNING *", [existing.id]);
      return continued;
    }
    if (method === 'payment') return existing;
    const [retried] = await tx<MembershipContractRow & { enrollment_serial: string }>(
      "UPDATE membership_contracts SET enrollment_serial = nextval('membership_enrollment_serial') WHERE id = ? RETURNING *", [existing.id]);
    return retried;
  }
  const [plan] = await tx<{ price_cents: number; period: string; period_count: number; currency: string }>(
    'SELECT price_cents, period, period_count, currency FROM membership_plans WHERE slug = ? FOR SHARE', [slug]);
  if (!plan || plan.price_cents !== template.cents || plan.period !== template.period
    || plan.period_count !== 1 || plan.currency !== 'CNY') throw new Error('renewal plan mismatch');
  const [saved] = await tx<MembershipContractRow & { enrollment_serial: string }>(`
    INSERT INTO membership_contracts (wca_id, plan_slug, appid, mch_id, plan_id, contract_code,
      price_cents, currency, period, period_count, terms_version, enrollment_serial, consented_at, signing_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'CNY', ?, 1, ?, nextval('membership_enrollment_serial'), now(), ?) RETURNING *`,
    [owner, slug, appid, mchId, template.id, randomBytes(24).toString('hex'), template.cents, template.period, RENEWAL_TERMS_VERSION, method]);
  return saved;
}

export async function enrollMembership(owner: string, input: unknown, ip: string) {
  if (renewalChannel() === 'payment') throw new PapayUnavailable();
  const contract = await withTransaction(tx => reserveMembershipContract(tx, owner, input, 'pure'));
  if (renewalChannel() === 'miniprogram') return { subscriptionId: contract.id,
    miniProgram: createPapayMiniEnrollment(contract, String(contract.enrollment_serial), `CubeRoot ${owner}`) };
  return { subscriptionId: contract.id,
    redirectUrl: await createPapayEnrollment(contract, String(contract.enrollment_serial), ip) };
}
