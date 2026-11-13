import { findUserByIdentity } from '../../utils/account.js';
import { exchangeWechatMiniProgramCode } from '../../utils/wechat_miniprogram.js';
import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../data_encryption.js';
import {
  requireInstructor,
  platformDb,
  platformQuery,
  withIdempotency,
  sendMutation,
  enqueuePlatformEvent,
} from '../db.js';
import { notFound, PlatformApiError, conflict, badRequest } from '../errors.js';
import { privateNoStore } from '../http.js';
import { createInstructorPayout } from '../instructor_payout.js';
import { readJsonObject, enumField, stringField, resourceId, pagination, integerField } from '../validation.js';
import {
  payoutProfile,
  validateWechatPayout,
  dispatchWechatPayout,
  rejectManualWechatPayout,
  wechatPayoutRuntime,
  payoutLimits,
  refreshWechatPayout,
  notifyWechatPayout,
} from '../wechat_payout.js';
import { safeSignedMoney } from './amounts.js';
import { hashReference } from './references.js';
import { type Hono } from 'hono';

async function payoutWechatIdentity(code: string) {
  try { return await exchangeWechatMiniProgramCode(code); }
  catch { throw new PlatformApiError('SERVICE_UNAVAILABLE', 503, '微信身份核对失败，请重新尝试'); }
}

export function registerPayoutRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.get('/instructor/payout-profile', async (c) => {
    const actor = await requirePlatformActor(c);
    const instructorId = await requireInstructor(platformDb(), actor);
    const rows = await platformQuery<{
      configured: boolean; payout_key_version: number | null; payout_profile_encrypted: Buffer | null; updated_at: string;
    }>(platformDb(), `
      SELECT payout_profile_encrypted IS NOT NULL AS configured,
             payout_key_version, payout_profile_encrypted, updated_at
      FROM platform_instructors WHERE id = $1::uuid
    `, [instructorId]);
    privateNoStore(c);
    return c.json({
      instructorId,
      configured: rows[0]?.configured ?? false,
      method: rows[0]?.payout_profile_encrypted && rows[0].payout_key_version != null ? decryptPlatformPrivateData(rows[0].payout_profile_encrypted,rows[0].payout_key_version).method : null,
      keyVersion: rows[0]?.payout_key_version ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  });

  platformCommerceRoutes.put('/instructor/payout-profile', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const method = enumField(body, 'method', ['bank_transfer', 'paypal', 'other'] as const, { required: true })!;
    const accountName = stringField(body, 'accountName', { required: true, max: 200 })!;
    const accountIdentifier = stringField(body, 'accountIdentifier', { required: true, max: 320 })!;
    const routingCode = stringField(body, 'routingCode', { max: 120 }) ?? null;
    const countryCode = stringField(body, 'countryCode', { max: 2, pattern: /^[A-Za-z]{2}$/ })?.toUpperCase() ?? null;
    const profile = { method, accountName, accountIdentifier, routingCode, countryCode };
    const result = await withIdempotency(c, actor, 'commerce.instructor.payout-profile', profile, async (db) => {
      const instructorId = await requireInstructor(db, actor);
      const encrypted = encryptPlatformPrivateData(profile);
      const rows = await platformQuery(db, `
        UPDATE platform_instructors
        SET payout_profile_encrypted = $2, payout_key_version = $3
        WHERE id = $1::uuid AND status = 'active'
        RETURNING id::text, updated_at AS "updatedAt"
      `, [instructorId, encrypted.payload, encrypted.keyVersion]);
      if (!rows[0]) notFound('Instructor');
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
        ) VALUES ($1, $2, 'commerce.payout_profile.update', 'platform_instructor', $3, 'allowed', $4::jsonb)
      `, [actor.userId, actor.ownerKey, instructorId, { method, countryCode }]);
      return {
        status: 200,
        body: { instructorId, configured: true, keyVersion: encrypted.keyVersion, updatedAt: rows[0]!.updatedAt },
        resourceType: 'platform_instructor',
        resourceId: instructorId,
      };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.post('/admin/instructor-payouts/generate', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const body = await readJsonObject(c);
    const instructorId = resourceId(stringField(body, 'instructorId', { required: true, max: 128 })!, 'instructorId');
    const currency = stringField(body, 'currency', { required: true, max: 3, pattern: /^[A-Za-z]{3}$/ })!.toUpperCase();
    const result = await withIdempotency(c, actor, `commerce.payout.generate:${instructorId}:${currency}`, body, async (db) => {
      return createInstructorPayout(db, actor, instructorId, currency);
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.get('/admin/instructor-payouts', async (c) => {
    await requirePlatformAdmin(c);
    const { page, pageSize, offset } = pagination(c);
    const q=c.req.query('q')?.trim().slice(0,200)??'';
    const rows = await platformQuery(platformDb(), `SELECT p.id::text, p.payout_number AS "payoutNumber", p.instructor_id::text AS "instructorId", p.status, p.payout_profile_snapshot_encrypted, p.payout_key_version, (SELECT t.state FROM platform_wechat_payout_transfers t WHERE t.payout_id=p.id) AS "transferState", p.amount_minor AS "amountMinor", p.currency, p.provider_reference AS "providerReference", p.failure_code AS "failureCode", p.created_at AS "createdAt" FROM platform_instructor_payouts p WHERE ($3='' OR p.payout_number ILIKE '%'||$3||'%') ORDER BY p.created_at DESC, p.id DESC LIMIT $1 OFFSET $2`, [pageSize, offset,q]);
    for (const row of rows) { row.payoutMode = payoutProfile(row as { payout_profile_snapshot_encrypted: Buffer; payout_key_version: number }).method; delete row.payout_profile_snapshot_encrypted; delete row.payout_key_version; }
    privateNoStore(c);
    const counts=await platformQuery<{total:number}>(platformDb(),`SELECT COUNT(*)::int AS total FROM platform_instructor_payouts WHERE TRUE AND ($1='' OR payout_number ILIKE '%'||$1||'%')`,[q]);
    return c.json({ items: rows, page, pageSize,total:counts[0]?.total??0 });
  });

  platformCommerceRoutes.post('/admin/instructor-payouts/:id/approve', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const result = await withIdempotency(c, actor, `commerce.payout.approve:${id}`, body, async (db) => {
      const rows = await platformQuery<{ id: string; status: string; currency: string; amount_minor: number; payout_profile_snapshot_encrypted: Buffer; payout_key_version: number; user_id: number }>(db, `
        SELECT p.*, i.user_id FROM platform_instructor_payouts p JOIN platform_instructors i ON i.id=p.instructor_id WHERE p.id = $1::uuid FOR UPDATE OF p
      `, [id]);
      if (!rows[0]) notFound('Payout');
      if (rows[0].status !== 'draft') throw new PlatformApiError('INVALID_STATE', 409, 'Only draft payouts can be approved');
      await platformQuery(db, `
        SELECT revenue.id FROM platform_instructor_payout_items item
        JOIN platform_instructor_revenue_ledger revenue ON revenue.id = item.revenue_ledger_id
        WHERE item.payout_id = $1::uuid AND item.released_at IS NULL FOR UPDATE OF revenue
      `, [id]);
      const lateReversals = await platformQuery<{ id: string; delta_amount_minor: number | string }>(db, `
        SELECT reversal.id::text, reversal.delta_amount_minor
        FROM platform_instructor_payout_items source_item
        JOIN platform_instructor_revenue_ledger reversal
          ON reversal.reversal_of_ledger_id = source_item.revenue_ledger_id
        WHERE source_item.payout_id = $1::uuid AND source_item.released_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM platform_instructor_payout_items existing
            WHERE existing.revenue_ledger_id = reversal.id AND existing.released_at IS NULL
          )
        FOR UPDATE OF reversal
      `, [id]);
      for (const reversal of lateReversals) {
        await platformQuery(db, `
          INSERT INTO platform_instructor_payout_items (payout_id, revenue_ledger_id, amount_minor, currency)
          VALUES ($1::uuid, $2::uuid, $3, $4)
        `, [id, reversal.id, safeSignedMoney(reversal.delta_amount_minor, 'reversal amount'), rows[0].currency]);
      }
      const totals = await platformQuery<{ amount_minor: number | string }>(db, `
        SELECT COALESCE(SUM(item.amount_minor), 0) AS amount_minor
        FROM platform_instructor_payout_items item
        WHERE item.payout_id = $1::uuid AND item.released_at IS NULL
      `, [id]);
      const amountMinor = safeSignedMoney(totals[0]?.amount_minor ?? 0, 'payout amount');
      if (amountMinor <= 0) conflict('Payout balance is no longer positive after refunds');
      await validateWechatPayout(db, rows[0], amountMinor);
      await platformQuery(db, `
        UPDATE platform_instructor_payouts
        SET status = 'approved', amount_minor = $2, approved_by_user_id = $3, approved_by_actor_key = $4, approved_at = NOW()
        WHERE id = $1::uuid
      `, [id, amountMinor, actor.userId, actor.ownerKey]);
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
        ) VALUES ($1, $2, 'commerce.payout.approve', 'platform_instructor_payout', $3, 'allowed', '{}'::jsonb)
      `, [actor.userId, actor.ownerKey, id]);
      await enqueuePlatformEvent(db, 'platform.instructor_payout.approved', 'platform_instructor_payout', id,
        `payout:${id}:approved`, { payoutId: id });
      return { status: 200, body: { id, status: 'approved' }, resourceType: 'platform_instructor_payout', resourceId: id };
    });
    const transfer = await dispatchWechatPayout(id);
    return transfer ? c.json(transfer) : sendMutation(c, result);
  });

  platformCommerceRoutes.post('/admin/instructor-payouts/:id/paid', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const providerReference = stringField(body, 'providerReference', { required: true, max: 240 })!;
    const result = await withIdempotency(c, actor, `commerce.payout.paid:${id}`, body, async (db) => {
      await rejectManualWechatPayout(db, id);
      const rows = await platformQuery<{ id: string; status: string }>(db, `SELECT id::text, status FROM platform_instructor_payouts WHERE id = $1::uuid FOR UPDATE`, [id]);
      if (!rows[0]) notFound('Payout');
      if (!['approved', 'processing'].includes(rows[0].status)) throw new PlatformApiError('INVALID_STATE', 409, 'Payout must be approved or processing');
      await platformQuery(db, `UPDATE platform_instructor_payouts SET status = 'paid', provider_reference = $2, paid_by_user_id = $3, paid_by_actor_key = $4, paid_at = NOW() WHERE id = $1::uuid`, [id, providerReference, actor.userId, actor.ownerKey]);
      const providerReferenceHash = hashReference(providerReference);
      await platformQuery(db, `INSERT INTO platform_audit_events (actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata) VALUES ($1, $2, 'commerce.payout.mark_paid', 'platform_instructor_payout', $3, 'allowed', $4::jsonb)`, [actor.userId, actor.ownerKey, id, { providerReferenceHash }]);
      return { status: 200, body: { id, status: 'paid' }, resourceType: 'platform_instructor_payout', resourceId: id };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.post('/admin/instructor-payouts/:id/reconcile-processing-refund', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const outcome = enumField(body, 'outcome', ['sent', 'not_sent'] as const, { required: true })!;
    const evidenceReference = stringField(body, 'evidenceReference', { required: true, max: 1000 })!;
    const providerReference = stringField(body, 'providerReference', { max: 240 });
    if (outcome === 'sent' && !providerReference) badRequest('providerReference is required when the payout was sent');
    const evidenceReferenceHash = hashReference(evidenceReference);
    const providerReferenceHash = providerReference ? hashReference(providerReference) : null;
    const result = await withIdempotency(c, actor, `commerce.payout.reconcile-processing-refund:${id}`, body, async (db) => {
      await rejectManualWechatPayout(db, id);
      const rows = await platformQuery<{ id: string; status: string; failure_code: string | null }>(db, `
        SELECT id::text, status, failure_code
        FROM platform_instructor_payouts WHERE id = $1::uuid FOR UPDATE
      `, [id]);
      if (!rows[0]) notFound('Payout');
      if (rows[0].status !== 'failed' || rows[0].failure_code !== 'refund_after_processing') {
        throw new PlatformApiError('INVALID_STATE', 409, 'Only an unresolved processing-refund payout can be reconciled');
      }
      if (outcome === 'not_sent') {
        await platformQuery(db, `
          UPDATE platform_instructor_payout_items SET released_at = NOW()
          WHERE payout_id = $1::uuid AND released_at IS NULL
        `, [id]);
      }
      const failureCode = outcome === 'sent' ? null : 'refund_after_processing_not_sent';
      if (outcome === 'sent') {
        await platformQuery(db, `
          UPDATE platform_instructor_payouts
          SET status = 'paid', failure_code = NULL, provider_reference = $2,
              paid_by_user_id = $3, paid_by_actor_key = $4, paid_at = NOW()
          WHERE id = $1::uuid
        `, [id, providerReference, actor.userId, actor.ownerKey]);
      } else {
        await platformQuery(db, `
          UPDATE platform_instructor_payouts SET failure_code = $2
          WHERE id = $1::uuid
        `, [id, failureCode]);
      }
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, reason_code, metadata
        ) VALUES ($1, $2, 'commerce.payout.reconcile_processing_refund',
          'platform_instructor_payout', $3, 'allowed', $4, $5::jsonb)
      `, [actor.userId, actor.ownerKey, id, `refund_after_processing_${outcome}`,
        { outcome, evidenceReferenceHash, providerReferenceHash }]);
      await enqueuePlatformEvent(db, 'platform.instructor_payout.processing_refund_reconciled',
        'platform_instructor_payout', id, `payout:${id}:processing-refund:${outcome}`, {
          payoutId: id, outcome,
        });
      return {
        status: 200,
        body: { id, status: outcome === 'sent' ? 'paid' : 'failed', reconciliationOutcome: outcome,
          itemsReleased: outcome === 'not_sent' },
        resourceType: 'platform_instructor_payout',
        resourceId: id,
      };
    });
    return sendMutation(c, result);
  });

  // Binding uses a fresh code from the receiving Mini Program and the existing account identity.
  platformCommerceRoutes.post('/instructor/payout-profile/wechat', async c => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const code = stringField(body,'code',{required:true,max:512})!;
    const accountName = stringField(body,'accountName',{required:true,max:60})!;
    if (body.agreed !== true) badRequest('请确认本人微信收款');
    const runtime = wechatPayoutRuntime(); payoutLimits();
    const identity = await payoutWechatIdentity(code);
    const account = identity.unionid ? await findUserByIdentity('wechat',identity.unionid) : null;
    if (!account || account.id !== actor.userId) throw new PlatformApiError('FORBIDDEN',403,'当前微信与登录账号不一致');
    const profile = {method:'wechat',appId:runtime.appId,merchantId:runtime.merchantId,openId:identity.openid,unionId:identity.unionid,userId:actor.userId,accountName};
    const result = await withIdempotency(c,actor,'commerce.payout-profile.wechat',{method:'wechat',accountName,agreed:true},async db => {
      const instructorId = await requireInstructor(db,actor);
      const linked = await platformQuery(db, `SELECT user_id FROM auth_identities WHERE provider='wechat' AND provider_uid=$1 AND user_id=$2 FOR SHARE`, [identity.unionid, actor.userId]);
      if (linked.length !== 1) conflict('微信关联已变化，请重新登录');
      const encrypted = encryptPlatformPrivateData(profile);
      await platformQuery(db,`UPDATE platform_instructors SET payout_profile_encrypted=$2,payout_key_version=$3 WHERE id=$1::uuid`,[instructorId,encrypted.payload,encrypted.keyVersion]);
      await platformQuery(db,`INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome) VALUES($1,$2,'commerce.payout_profile.wechat','platform_instructor',$3,'allowed')`,[actor.userId,actor.ownerKey,instructorId]);
      return {status:200,body:{configured:true,method:'wechat'}};
    });
    return sendMutation(c,result);
  });

  platformCommerceRoutes.post('/admin/instructor-payouts/:id/refresh-wechat',async c => {
    await requirePlatformAdmin(c); privateNoStore(c);
    return c.json(await dispatchWechatPayout(resourceId(c.req.param('id'))));
  });

  platformCommerceRoutes.post('/instructor/payouts', async c => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    if (body.agreed !== true) badRequest('请确认申请提现');
    const amountMinor = integerField(body, 'amountMinor', { required: true, min: 1 })!;
    const method = enumField(body, 'method', ['wechat', 'bank_transfer'] as const, { required: true })!;
    const result = await withIdempotency(c, actor, 'commerce.payout.request', { amountMinor, method, agreed: true }, async db => {
      const instructorId = await requireInstructor(db, actor);
      return createInstructorPayout(db, actor, instructorId, 'CNY', { amountMinor, method });
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.get('/instructor/payouts',async c => {
    const actor=await requirePlatformActor(c), instructorId=await requireInstructor(platformDb(),actor);
    privateNoStore(c);
    const rows=await platformQuery(platformDb(),`SELECT p.id::text,p.payout_number AS "payoutNumber",p.amount_minor::text AS "amountMinor",p.currency,p.status,t.state AS "transferState" FROM platform_instructor_payouts p LEFT JOIN platform_wechat_payout_transfers t ON t.payout_id=p.id WHERE p.instructor_id=$1::uuid ORDER BY p.created_at DESC LIMIT 100`,[instructorId]);
    const [balance] = await platformQuery<{ amount: string }>(platformDb(), `SELECT COALESCE(SUM(r.delta_amount_minor),0)::text AS amount FROM platform_instructor_revenue_ledger r WHERE r.instructor_id=$1::uuid AND r.currency='CNY' AND NOT EXISTS (SELECT 1 FROM platform_instructor_payout_items i WHERE i.revenue_ledger_id=r.id AND i.released_at IS NULL)`, [instructorId]);
    const availableMinor = Math.max(0, safeSignedMoney(balance.amount));
    return c.json({payouts:rows, availableMinor});
  });

  platformCommerceRoutes.post('/instructor/payouts/:id/receipt',async c => {
    const actor=await requirePlatformActor(c), instructorId=await requireInstructor(platformDb(),actor),id=resourceId(c.req.param('id'));
    const body=await readJsonObject(c),code=stringField(body,'code',{required:true,max:512})!;
    const [row]=await platformQuery(platformDb(),`SELECT p.* FROM platform_instructor_payouts p WHERE p.id=$1::uuid AND p.instructor_id=$2::uuid`,[id,instructorId]);
    if(!row) notFound('Payout');
    const profile=payoutProfile(row as {payout_profile_snapshot_encrypted:Buffer;payout_key_version:number});
    const identity=await payoutWechatIdentity(code);
    const account=identity.unionid?await findUserByIdentity('wechat',identity.unionid):null;
    if(profile.method!=='wechat'||!account||account.id!==actor.userId||profile.openId!==identity.openid||profile.unionId!==identity.unionid) throw new PlatformApiError('FORBIDDEN',403,'当前微信与原提现收款账号不一致');
    await refreshWechatPayout(id);
    const [transfer]=await platformQuery(platformDb(),`SELECT state,package_info FROM platform_wechat_payout_transfers WHERE payout_id=$1::uuid`,[id]);
    privateNoStore(c);
    return c.json(transfer?.state==='WAIT_USER_CONFIRM' ? {state:transfer.state,appId:profile.appId,mchId:profile.merchantId,package:transfer.package_info} : {state:transfer?.state||'NOT_SENT'});
  });

  platformCommerceRoutes.post('/payouts/wechat/notify', async c => {
    try {
      const {readWechatNotification}=await import('../wechat_notification.js');
      const {body,headers}=await readWechatNotification(c.req.raw);
      await notifyWechatPayout(body,headers);
      return c.body(null,204);
    } catch { return c.json({code:'FAIL',message:'Notification not accepted'},503); }
  });
}
