import { randomBytes } from 'node:crypto';
import { createWechatPayClient, type WechatSignatureHeaders, type WechatTransferExpected } from '@app-foundation/payments/wechat';
import { platformDb, platformQuery, platformTransaction, enqueuePlatformEvent, type PlatformDb } from './db.js';
import { decryptPlatformPrivateData } from './data_encryption.js';
import { conflict, PlatformApiError } from './errors.js';

type Payout = Record<string, unknown> & { id: string; status: string; currency: string; amount_minor: number | string; payout_profile_snapshot_encrypted: Buffer; payout_key_version: number; user_id: number };
export type WechatPayoutProfile = { method: 'wechat'; appId: string; merchantId: string; openId: string; unionId: string; accountName: string; userId: number };
function unavailable(): never { throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, '微信提现配置未完成'); }
export function wechatPayoutRuntime() {
  const env = process.env;
  const required = (key: string) => env[key]?.trim() || unavailable();
  const appId = required('WECHAT_PAYOUT_APPID'), merchantId = required('WECHAT_MCHID');
  if (appId !== required('WECHAT_MINI_APP_ID') || merchantId !== required('WECHAT_PAYOUT_MCHID')) unavailable();
  const client = createWechatPayClient({ appId, merchantId,
    apiV3Key: required('WECHAT_API_V3_KEY'), certificateSerial: required('WECHAT_CERT_SERIAL'), privateKey: required('WECHAT_PRIVATE_KEY'),
    platformPublicKeyId: required('WECHAT_PLATFORM_PUBKEY_ID'), platformPublicKey: required('WECHAT_PLATFORM_PUBKEY'),
  });
  return { client, appId, merchantId };
}
export function payoutLimits() {
  const minimumFen = Number(process.env.WECHAT_PAYOUT_MIN_FEN), maximumFen = Number(process.env.WECHAT_PAYOUT_MAX_FEN);
  if (process.env.WECHAT_PAYOUT_ENABLED !== 'true' || !Number.isSafeInteger(minimumFen) || minimumFen < 10 || !Number.isSafeInteger(maximumFen) || maximumFen < minimumFen) unavailable();
  return { minimumFen, maximumFen };
}
export function payoutProfile(row: { payout_profile_snapshot_encrypted: Buffer | null; payout_key_version: number | null }) {
  // Historical, completed payouts may have been scrubbed by account closure.
  if (row.payout_profile_snapshot_encrypted === null && row.payout_key_version === null) return { method: 'unavailable' };
  if (!row.payout_profile_snapshot_encrypted || row.payout_key_version === null) conflict('收款资料待核对');
  return decryptPlatformPrivateData(Buffer.from(row.payout_profile_snapshot_encrypted), row.payout_key_version);
}
function wechatProfile(row: Payout): WechatPayoutProfile {
  const p = payoutProfile(row);
  if (p.method !== 'wechat' || typeof p.appId !== 'string' || typeof p.merchantId !== 'string'
    || typeof p.openId !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/.test(p.openId) || typeof p.unionId !== 'string'
    || typeof p.accountName !== 'string' || !p.accountName.trim() || p.userId !== Number(row.user_id)) conflict('收款身份待核对');
  return p as WechatPayoutProfile;
}
export async function validateWechatPayout(db: PlatformDb, row: Payout, amountMinor: number) {
  if (payoutProfile(row).method !== 'wechat') return false;
  const config = wechatPayoutRuntime(), limits = payoutLimits(), profile = wechatProfile(row);
  if (row.currency !== 'CNY' || !Number.isSafeInteger(amountMinor) || amountMinor < limits.minimumFen || amountMinor > limits.maximumFen) conflict('金额超出微信单笔额度，请调整商户额度或改用银行卡；系统不会拆单');
  if (profile.appId !== config.appId || profile.merchantId !== config.merchantId) conflict('提现商户配置已变化');
  const identity = await platformQuery(db, `SELECT user_id FROM auth_identities WHERE provider='wechat' AND provider_uid=$1 AND user_id=$2 FOR SHARE`, [profile.unionId, profile.userId]);
  const active = await platformQuery(db, `SELECT id FROM platform_instructors WHERE user_id=$1 AND status='active' FOR SHARE`, [profile.userId]);
  if (identity.length !== 1 || active.length !== 1) conflict('微信关联或讲师身份已变化');
  return true;
}
export async function rejectManualWechatPayout(db: PlatformDb, id: string) {
  const [row] = await platformQuery<Payout>(db, `SELECT * FROM platform_instructor_payouts WHERE id=$1::uuid`, [id]);
  if (row && payoutProfile(row).method === 'wechat') conflict('微信提现必须核对微信结果，不能人工登记到账或释放余额');
}
async function load(db: PlatformDb, id: string, lock = false) {
  const [row] = await platformQuery<Payout>(db, `SELECT p.*, i.user_id FROM platform_instructor_payouts p JOIN platform_instructors i ON i.id=p.instructor_id WHERE p.id=$1::uuid ${lock ? 'FOR UPDATE OF p' : ''}`, [id]);
  if (!row) conflict('提现记录不存在');
  return row;
}
async function reconcile(id: string, runtime = wechatPayoutRuntime()) {
  const row = await load(platformDb(), id);
  const profile = wechatProfile(row);
  if (profile.appId !== runtime.appId || profile.merchantId !== runtime.merchantId) conflict('原提现商户配置不匹配');
  const [transfer] = await platformQuery<{ out_bill_no: string; state: string }>(platformDb(), `SELECT out_bill_no,state FROM platform_wechat_payout_transfers WHERE payout_id=$1::uuid`, [id]);
  if (!transfer) return { id, status: row.status, state: 'NOT_SENT' };
  if (['SUCCESS','FAIL','CANCELLED'].includes(transfer.state)) return { id, status: row.status, state: transfer.state };
  const expected: WechatTransferExpected = { appId: profile.appId, openId: profile.openId, amountMinor: Number(row.amount_minor), outBillNo: transfer.out_bill_no };
  const result = await runtime.client.queryTransfer(expected);
  return platformTransaction(async db => {
    const current = await load(db, id, true);
    const [saved] = await platformQuery<{ state: string; transfer_bill_no: string | null }>(db, `SELECT state,transfer_bill_no FROM platform_wechat_payout_transfers WHERE payout_id=$1::uuid FOR UPDATE`, [id]);
    if (saved.transfer_bill_no && saved.transfer_bill_no !== result.transferBillNo) conflict('转账凭证不匹配');
    if (['SUCCESS','FAIL','CANCELLED'].includes(saved.state)) {
      if (['SUCCESS','FAIL','CANCELLED'].includes(result.state) && saved.state !== result.state) conflict('微信终态冲突');
      return { id, status: current.status, state: saved.state };
    }
    if (!(current.status === 'processing' || current.status === 'failed' && current.failure_code === 'refund_after_processing')) conflict('提现状态待核对');
    await platformQuery(db, `UPDATE platform_wechat_payout_transfers SET state=$2,transfer_bill_no=$3,package_info=CASE WHEN $2='WAIT_USER_CONFIRM' THEN COALESCE($4,package_info) ELSE NULL END,updated_at=NOW() WHERE payout_id=$1::uuid`, [id, result.state, result.transferBillNo, result.state === 'WAIT_USER_CONFIRM' ? result.packageInfo : null]);
    let status = current.status;
    if (result.state === 'SUCCESS') {
      await platformQuery(db, `UPDATE platform_instructor_payouts SET status='paid',failure_code=NULL,provider_reference=$2,paid_by_actor_key='wechat-verified-query',paid_at=NOW() WHERE id=$1::uuid`, [id, result.transferBillNo]);
      status = 'paid';
    } else if (['FAIL','CANCELLED'].includes(result.state)) {
      await platformQuery(db, `UPDATE platform_instructor_payouts SET status='failed',failure_code='wechat_transfer_failed' WHERE id=$1::uuid`, [id]);
      await platformQuery(db, `UPDATE platform_instructor_payout_items SET released_at=NOW() WHERE payout_id=$1::uuid AND released_at IS NULL`, [id]);
      status = 'failed';
    }
    await platformQuery(db, `INSERT INTO platform_audit_events(actor_key,action,resource_type,resource_id,outcome,metadata) VALUES('wechat-verified-query','commerce.payout.wechat_result','platform_instructor_payout',$1,'allowed',$2::jsonb)`, [id,{state:result.state}]);
    await enqueuePlatformEvent(db,'platform.instructor_payout.updated','platform_instructor_payout',id,`payout:${id}:wechat:${result.state}`,{payoutId:id,status,state:result.state});
    return { id, status, state: result.state };
  });
}
async function sendOriginal(row: Payout, outBillNo: string, runtime = wechatPayoutRuntime()) {
  const profile=wechatProfile(row), amountMinor=Number(row.amount_minor);
  await runtime.client.createTransfer({appId:profile.appId,openId:profile.openId,outBillNo,amountMinor,sceneId:'1005',remark:'魔方课程佣金提现',
    sceneInfo:[{type:'岗位类型',content:'魔方讲师'},{type:'报酬说明',content:'课程佣金收益'}],recipientName:amountMinor>=30?profile.accountName:undefined,
    notifyUrl:`${process.env.PUBLIC_API_ORIGIN || 'https://api.cuberoot.me'}/v1/platform/payouts/wechat/notify`});
}
export async function dispatchWechatPayout(id: string) {
  const claim = await platformTransaction(async db => {
    const row = await load(db,id,true);
    if (payoutProfile(row).method !== 'wechat') return null;
    const [prior] = await platformQuery(db,`SELECT payout_id FROM platform_wechat_payout_transfers WHERE payout_id=$1::uuid`,[id]);
    if (prior) return { send:false, row, outBillNo:'' };
    if (row.status !== 'approved') conflict('提现未获财务审核');
    await validateWechatPayout(db,row,Number(row.amount_minor));
    const outBillNo = `CR${randomBytes(15).toString('hex')}`;
    await platformQuery(db,`INSERT INTO platform_wechat_payout_transfers(payout_id,out_bill_no,state) VALUES($1::uuid,$2,'PREPARED')`,[id,outBillNo]);
    await platformQuery(db,`UPDATE platform_instructor_payouts SET status='processing' WHERE id=$1::uuid`,[id]);
    return {send:true,row,outBillNo};
  });
  if (!claim) return null;
  try {
    const runtime = wechatPayoutRuntime();
    if (claim.send) await sendOriginal(claim.row,claim.outBillNo,runtime);
    else if (claim.row.status === 'processing') {
      const [transfer]=await platformQuery<{out_bill_no:string}>(platformDb(),`SELECT out_bill_no FROM platform_wechat_payout_transfers WHERE payout_id=$1::uuid`,[id]);
      const profile=wechatProfile(claim.row);
      const observed=await runtime.client.findTransfer({appId:profile.appId,openId:profile.openId,outBillNo:transfer.out_bill_no,amountMinor:Number(claim.row.amount_minor)});
      if (!observed || observed.state==='ACCEPTED') {
        // Lease only the original attempt, inside its recent query window. Never change recipient or amount.
        const retry=await platformTransaction(async db=>{
          const row=await load(db,id,true);
          if(row.status!=='processing')return false;
          await validateWechatPayout(db,row,Number(row.amount_minor));
          const claimed=await platformQuery(db,`UPDATE platform_wechat_payout_transfers SET last_sent_at=NOW(),updated_at=NOW() WHERE payout_id=$1::uuid AND state NOT IN ('SUCCESS','FAIL','CANCELLED') AND created_at>NOW()-INTERVAL '1 day' AND last_sent_at<NOW()-INTERVAL '1 minute' AND (transfer_bill_no IS NULL OR state='ACCEPTED') RETURNING payout_id`,[id]);
          return claimed.length===1;
        });
        if(retry) await sendOriginal(claim.row,transfer.out_bill_no,runtime);
      }
    }
    return await reconcile(id,runtime);
  } catch { return {id,status:'processing',state:'VERIFYING',message:'微信结果待核对，预留余额保留'}; }
}
export async function refreshWechatPayout(id:string) {
  try { return await reconcile(id); }
  catch { throw new PlatformApiError('SERVICE_UNAVAILABLE',503,'微信结果暂未确认，余额继续预留，请稍后核对原申请'); }
}
export async function notifyWechatPayout(body:string,headers:WechatSignatureHeaders) {
  const runtime=wechatPayoutRuntime();
  const {outBillNo}=runtime.client.parseTransferNotification(body,headers);
  const [row]=await platformQuery<{payout_id:string}>(platformDb(),`SELECT payout_id::text FROM platform_wechat_payout_transfers WHERE out_bill_no=$1`,[outBillNo]);
  if(!row) conflict('提现记录不存在');
  await reconcile(row.payout_id,runtime);
}

let recoveryStarted=false, recoveryRunning=false;
let recoveryCursor: string | null = null;
export function startWechatPayoutRecovery() {
  if(recoveryStarted || process.env.WECHAT_PAYOUT_RECOVERY_ENABLED!=='true')return;
  recoveryStarted=true;
  const tick=async()=>{
    if(recoveryRunning || process.env.WECHAT_PAYOUT_RECOVERY_ENABLED!=='true')return;
    recoveryRunning=true;
    try {
      const rows=await platformQuery<{payout_id:string}>(platformDb(),`SELECT p.id::text AS payout_id FROM platform_instructor_payouts p LEFT JOIN platform_wechat_payout_transfers t ON t.payout_id=p.id WHERE (p.status='approved' OR t.state NOT IN ('SUCCESS','FAIL','CANCELLED')) AND ($1::uuid IS NULL OR p.id>$1::uuid) ORDER BY p.id LIMIT 25`, [recoveryCursor]);
      recoveryCursor=rows.length===25?rows[24].payout_id:null;
      for(const row of rows) { try {await dispatchWechatPayout(row.payout_id);} catch {/* Keep original reservation until verified. */} }
    } catch {console.warn('[wechat-payout] reconciliation deferred');}
    finally {recoveryRunning=false;}
  };
  void tick();setInterval(()=>void tick(),60000).unref();
}
