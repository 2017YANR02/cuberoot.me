import { createHash } from 'node:crypto';
import { requirePlatformActor, requirePlatformAdmin, type PlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, platformTransaction, withIdempotency, sendMutation, type PlatformDb } from '../platform/db.js';
import { conflict, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { readJsonObject, resourceId, stringField } from '../platform/validation.js';
import { assertRefundProvider, runProviderRefund, type RefundProviderInput } from '../platform/refund_provider.js';
import { completePlatformFullRefund } from './platform_commerce.js';

export const platformRefundRoutes = platformRouter();

function ownsOrder(buyer: string | number | null, actor: PlatformActor): boolean {
  const id=Number(buyer);
  return Number.isSafeInteger(id) && id>0 && id===actor.userId;
}
type RefundRow = Record<string, unknown> & {
  id: string; order_id: string; status: string; merchant_request_id: string | null;
  provider: string; provider_refund_id: string | null; approved_at: string | null;
  amount_minor: string | number; currency: string; reason_code: string;
  provider_status: string | null; failure_code: string | null; processing_until: string | null;
};

async function lockOrder(db: PlatformDb, orderId: string) {
  // The same competition -> order order is used by manual refunds and settlement.
  await platformQuery(db, `SELECT c.event_id FROM platform_competitions c WHERE EXISTS (
    SELECT 1 FROM platform_order_items i JOIN platform_event_ticket_types t ON t.id=i.event_ticket_type_id
    WHERE i.order_id=$1::uuid AND t.event_id=c.event_id) ORDER BY c.event_id FOR UPDATE OF c`, [orderId]);
  const [order] = await platformQuery<{ id: string; buyer_user_id: number | string; status: string; total_amount_minor: number | string; currency: string }>(db,
    `SELECT id::text,buyer_user_id,status,total_amount_minor,currency FROM platform_orders WHERE id=$1::uuid FOR UPDATE`, [orderId]);
  if (!order) notFound('Order');
  return order;
}

async function refund(db: PlatformDb, id: string, lock = false): Promise<RefundRow> {
  const [row] = await platformQuery<RefundRow>(db, `SELECT * FROM platform_refunds WHERE id=$1::uuid ${lock ? 'FOR UPDATE' : ''}`, [id]);
  if (!row) notFound('Refund');
  return row;
}

async function inputFor(db: PlatformDb, row: RefundRow): Promise<RefundProviderInput> {
  const [payment] = await platformQuery<{ provider_transaction_id: string; merchant_account: string; total_amount_minor: number | string }>(db,
    `SELECT p.provider_transaction_id,p.merchant_account,o.total_amount_minor FROM platform_payment_attempts p
     JOIN platform_orders o ON o.id=p.order_id WHERE p.id=$1::uuid`, [row.payment_attempt_id]);
  return { provider: row.provider, merchantAccount: payment?.merchant_account ?? '', transactionId: payment?.provider_transaction_id ?? '',
    requestId: row.merchant_request_id ?? '', refundId: row.provider_refund_id, amountMinor: Number(row.amount_minor),
    totalMinor: Number(payment?.total_amount_minor), currency: row.currency, reason: row.reason_code };
}

function view(row: RefundRow) {
  return { id: row.id, orderId: row.order_id, status: row.status, amountMinor: String(row.amount_minor), currency: row.currency,
    reasonCode: row.reason_code, rejectionReason: row.rejection_reason ?? null, provider: row.provider, providerStatus: row.provider_status, failureCode: row.failure_code,
    approvedAt: row.approved_at, succeededAt: row.succeeded_at, createdAt: row.created_at, lastCheckedAt: row.last_checked_at };
}

async function audit(db: PlatformDb, actor: PlatformActor, id: string, action: string, metadata: Record<string, unknown> = {}) {
  await platformQuery(db, `INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome,metadata)
    VALUES($1,$2,$3,'platform_refund',$4,'allowed',$5::jsonb)`, [actor.userId, actor.ownerKey, action, id, metadata]);
}

/** A persisted approval precedes external I/O. Timeout retries retain the same merchant refund number. */
export async function synchronizePlatformRefund(id: string, actor: PlatformActor, allowCreate: boolean) {
  const claimed = await platformTransaction(async db => {
    const initial = await refund(db, id); await lockOrder(db, initial.order_id);
    const row = await refund(db, id, true);
    if (!row.approved_at || !row.merchant_request_id) conflict('The refund has not been approved for automatic execution');
    if (row.status === 'succeeded' || (row.processing_until && Date.parse(row.processing_until) > Date.now())) return { row, input: null };
    const input = await inputFor(db, row); assertRefundProvider(input);
    await platformQuery(db, `UPDATE platform_refunds SET processing_until=NOW()+INTERVAL '3 minutes' WHERE id=$1::uuid`, [id]);
    return { row, input };
  });
  if (!claimed.input) return view(claimed.row);
  try {
    const result = await runProviderRefund(claimed.input, allowCreate);
    return await platformTransaction(async db => {
      await lockOrder(db, claimed.row.order_id); const row = await refund(db, id, true);
      if (row.status === 'succeeded') return view(row);
      const nextStatus = result?.status ?? 'pending';
      await platformQuery(db, `UPDATE platform_refunds SET status=$2::varchar,provider_refund_id=COALESCE($3,provider_refund_id),
        provider_status=$4,failure_code=$5,last_checked_at=NOW(),processing_until=NULL,
        succeeded_at=CASE WHEN $2::varchar='succeeded' THEN NOW() ELSE succeeded_at END WHERE id=$1::uuid`,
      [id,nextStatus,result?.id ?? null,result?.providerStatus ?? null,result ? (nextStatus==='failed' ? 'provider_failed' : null) : 'provider_not_found']);
      if (nextStatus === 'succeeded') {
        const evidence = createHash('sha256').update(`${claimed.input!.provider}:${result!.id}:${claimed.input!.requestId}`).digest('hex');
        await completePlatformFullRefund(db, actor, row.order_id, id, evidence);
      }
      await audit(db, actor, id, 'commerce.refund.provider_checked', { status: nextStatus, providerStatus: result?.providerStatus ?? null });
      return view(await refund(db,id));
    });
  } catch {
    // A failed HTTP request does not prove the money stayed put. Never create a fresh refund number.
    await platformQuery(platformDb(), `UPDATE platform_refunds SET failure_code='provider_check_required',
      last_checked_at=NOW(),processing_until=NULL WHERE id=$1::uuid AND status<>'succeeded'`, [id]);
    return view(await refund(platformDb(),id));
  }
}

export function startPlatformRefundReconciliation(): () => void {
  let running=false;
  const actor:PlatformActor={userId:null,ownerKey:'__refund_reconciler__',wcaId:null,displayName:'Refund reconciliation',isAdmin:false,viaApiKey:false};
  const timer=setInterval(async()=>{
    if(running)return;
    running=true;
    try {
      const pending=await platformQuery<{id:string}>(platformDb(),`SELECT id::text FROM platform_refunds
        WHERE status='pending' AND approved_at IS NOT NULL AND merchant_request_id IS NOT NULL
          AND (processing_until IS NULL OR processing_until<NOW())
          AND (last_checked_at IS NULL OR last_checked_at<NOW()-INTERVAL '1 minute')
        ORDER BY last_checked_at NULLS FIRST LIMIT 5`);
      for(const row of pending)await synchronizePlatformRefund(row.id,actor,true).catch(()=>undefined);
    } catch { /* A later tick retries unavailable configuration or database connections. */ }
    finally {running=false;}
  },60_000);
  timer.unref();return ()=>clearInterval(timer);
}

platformRefundRoutes.get('/platform/orders/:id/refunds', async c => {
  const actor=await requirePlatformActor(c), id=resourceId(c.req.param('id'));
  const [order]=await platformQuery<{buyer_user_id:number|string}>(platformDb(),`SELECT buyer_user_id FROM platform_orders WHERE id=$1::uuid`,[id]);
  if(!order || (!actor.isAdmin && !ownsOrder(order.buyer_user_id,actor)))notFound('Order');
  const rows=await platformQuery<RefundRow>(platformDb(),`SELECT * FROM platform_refunds WHERE order_id=$1::uuid ORDER BY created_at DESC`,[id]);
  privateNoStore(c);return c.json({items:rows.map(view)});
});

platformRefundRoutes.post('/platform/orders/:id/refund-requests', async c => {
  const actor=await requirePlatformActor(c), id=resourceId(c.req.param('id')), body=await readJsonObject(c);
  const reason=stringField(body,'reasonCode',{required:true,max:64})!;
  const result=await withIdempotency(c,actor,`commerce.refund.request:${id}`,body,async db=>{
    const order=await lockOrder(db,id);
    if(!actor.isAdmin && !ownsOrder(order.buyer_user_id,actor))notFound('Order');
    if(!['paid','partially_fulfilled','fulfilled'].includes(order.status) || Number(order.total_amount_minor)<=0)conflict('Only paid orders can be refunded');
    const [scope]=await platformQuery<{eligible:boolean}>(db,`SELECT COUNT(*)>0 AND BOOL_AND(c.event_id IS NOT NULL) AS eligible
      FROM platform_order_items i LEFT JOIN platform_event_ticket_types t ON t.id=i.event_ticket_type_id
      LEFT JOIN platform_competitions c ON c.event_id=t.event_id WHERE i.order_id=$1::uuid`,[id]);
    if(!scope?.eligible)conflict('Automatic refund requests currently support online competition orders');
    const [existing]=await platformQuery<RefundRow>(db,`SELECT * FROM platform_refunds WHERE order_id=$1::uuid
      AND (status IN ('requested','pending','succeeded','chargeback') OR approved_at IS NOT NULL) ORDER BY created_at DESC LIMIT 1`,[id]);
    if(existing)return {status:200,body:view(existing),resourceType:'platform_refund',resourceId:existing.id};
    const [payment]=await platformQuery<{id:string;provider:string}>(db,`SELECT id::text,provider FROM platform_payment_attempts
      WHERE order_id=$1::uuid AND status='succeeded' ORDER BY succeeded_at DESC LIMIT 1`,[id]);
    if(!payment)conflict('No succeeded payment exists');
    const [row]=await platformQuery<RefundRow>(db,`INSERT INTO platform_refunds(order_id,payment_attempt_id,refund_number,provider,
      merchant_request_id,status,reason_code,amount_minor,currency,requested_by_user_id)
      SELECT $1::uuid,$2::uuid,COALESCE(MAX(refund_number),0)+1,$3,REPLACE(gen_random_uuid()::text,'-',''),'requested',$4,$5,$6,$7
      FROM platform_refunds WHERE order_id=$1::uuid RETURNING *`,[id,payment.id,payment.provider,reason,order.total_amount_minor,order.currency,actor.userId]);
    await audit(db,actor,row.id,'commerce.refund.requested');
    return {status:201,body:view(row),resourceType:'platform_refund',resourceId:row.id};
  });return sendMutation(c,result);
});

platformRefundRoutes.post('/admin/refunds/:id/approve', async c => {
  const actor=await requirePlatformAdmin(c),id=resourceId(c.req.param('id')),body=await readJsonObject(c);
  const result=await withIdempotency(c,actor,`commerce.refund.approve:${id}`,body,async db=>{
    const initial=await refund(db,id);await lockOrder(db,initial.order_id);const row=await refund(db,id,true);
    if(row.status==='succeeded')return {status:200,body:view(row)};
    if(row.status==='cancelled' || (!row.approved_at && row.status!=='requested'))conflict('This refund cannot be approved');
    assertRefundProvider(await inputFor(db,row));
    await platformQuery(db,`UPDATE platform_refunds SET status='pending',approved_at=COALESCE(approved_at,NOW()),
      decided_by_user_id=$2,decided_by_actor_key=$3 WHERE id=$1::uuid`,[id,actor.userId,actor.ownerKey]);
    await audit(db,actor,id,'commerce.refund.approved');return {status:202,body:view(await refund(db,id))};
  });
  privateNoStore(c);c.header('Idempotency-Replayed',String(result.replayed));
  return c.json(await synchronizePlatformRefund(id,actor,true));
});

platformRefundRoutes.post('/admin/refunds/:id/refresh', async c => {
  const actor=await requirePlatformAdmin(c),id=resourceId(c.req.param('id'));
  privateNoStore(c);return c.json(await synchronizePlatformRefund(id,actor,false));
});

platformRefundRoutes.post('/admin/refunds/:id/reject', async c => {
  const actor=await requirePlatformAdmin(c),id=resourceId(c.req.param('id')),body=await readJsonObject(c);
  const reason=stringField(body,'reasonCode',{required:true,max:64})!;
  const result=await withIdempotency(c,actor,`commerce.refund.reject:${id}`,body,async db=>{
    const initial=await refund(db,id);await lockOrder(db,initial.order_id);const row=await refund(db,id,true);
    if(row.approved_at || row.status!=='requested')conflict('An approved refund must be reconciled with its provider');
    await platformQuery(db,`UPDATE platform_refunds SET status='cancelled',decided_by_user_id=$2,decided_by_actor_key=$3,rejection_reason=$4
      WHERE id=$1::uuid`,[id,actor.userId,actor.ownerKey,reason]);
    await audit(db,actor,id,'commerce.refund.rejected',{reason});return {status:200,body:view(await refund(db,id))};
  });return sendMutation(c,result);
});
