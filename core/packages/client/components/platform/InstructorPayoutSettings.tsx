'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { CompactSelect } from '@/components/CompactSelect';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { commerceMoney } from '@/lib/platform-commerce-format';

type Payout = { id: string; amountMinor: string; status: string; currency: string; transferState?: string | null; payoutNumber?: string; paidAt?: string; providerReference?: string };
export function InstructorPayoutSettings({ history = [], active = true, onBalanceChange }: { history?: readonly Record<string, unknown>[]; active?: boolean; onBalanceChange?: (snapshot: { availableMinor: number; payouts: Payout[] }) => void } = {}) {
  const t = useT();
  const [channel, setChannel] = useState('wechat');
  const [configured, setConfigured] = useState(false);
  const [savedMethod, setSavedMethod] = useState<string | null>(null);
  const [availableMinor, setAvailableMinor] = useState(0);
  const payoutRequest = useRef<{ key: string; body: string } | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [notice, setNotice] = useState('');
  const initialMethod = useRef(true);
  const refreshSequence = useRef(0);
  const request = useRef<{ key: string; body: string } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const sequence=++refreshSequence.current;
    try { const [profile, result] = await Promise.all([
      sessionFetch(apiUrl('/v1/platform/instructor/payout-profile'), { headers: authHeaders(false), cache: 'no-store', signal }).then(handleApi<{configured: boolean; method?: string}>),
      sessionFetch(apiUrl('/v1/platform/instructor/payouts'), { headers: authHeaders(false), cache: 'no-store', signal }).then(handleApi<{payouts:Payout[]; availableMinor:number}>),
    ]);
    if (!signal?.aborted && sequence===refreshSequence.current) { if(initialMethod.current){initialMethod.current=false;if(profile.method==='bank_transfer')setChannel('bank_transfer');}setConfigured(profile.configured && profile.method === 'wechat'); setSavedMethod(profile.method ?? null); setPayouts(result.payouts); setAvailableMinor(result.availableMinor); setLoaded(true); setRefreshError(false); onBalanceChange?.(result); }
    } catch(reason) { if(!signal?.aborted && sequence===refreshSequence.current)throw reason; }
  }, [onBalanceChange]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let refreshing = false;
    const update = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try { await refresh(controller.signal); }
      catch { if (!controller.signal.aborted) setRefreshError(true); }
      finally { refreshing = false; }
    };
    void update();
    const timer = setInterval(() => { void update(); }, 30_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh, active]);
  // The dashboard contains the complete ledger history; payout polling supplies
  // newer statuses and newly requested transfers. Render each payout only once.
  const pastPayouts: Payout[] = history.map(entry => ({
    id: String(entry.id), amountMinor: String(entry.amountMinor ?? 0), status: String(entry.status ?? ''),
    currency: String(entry.currency ?? ''), payoutNumber: String(entry.payoutNumber ?? ''),
    paidAt: String(entry.paidAt ?? ''), providerReference: String(entry.providerReference ?? ''),
  }));
  const pastById = new Map(pastPayouts.map(item => [item.id, item]));
  const currentIds = new Set(payouts.map(item => item.id));
  const mergedPayouts = [...payouts.map(item => ({ ...pastById.get(item.id), ...item })), ...pastPayouts.filter(item => !currentIds.has(item.id))];
  return <section className="platform-instructor-section platform-instructor-payouts">
    <h2>{t('收款方式', 'Payout method')}</h2>
    {!loaded && !refreshError && <ContentSkeleton variant="text" rows={2} label={t('正在读取收款信息…','Loading payout details…')} />}
    {loaded && <>
    <div className="platform-instructor-payout-method"><span>{t('提现至', 'Receive via')}</span><CompactSelect value={channel} label={channel==='wechat'?t('微信', 'WeChat'):t('银行卡','Bank transfer')} ariaLabel={t('提现至','Receive via')} disabled={busy || Boolean(payoutRequest.current)} items={[{value:'wechat',label:t('微信（优先）','WeChat (preferred)')},{value:'bank_transfer',label:t('银行卡','Bank transfer')}]} onChange={value=>{setChannel(value);setError('');}} showArrow/></div>
    {channel === 'wechat' ? <p>{configured ? t('已关联本人微信。需要确认收款时，请打开微信小程序 → 账号 → 佣金提现。', 'Your WeChat is linked. Confirm receipts in Mini Program → Account → Commission payouts.') : t('在微信小程序 → 账号 → 佣金提现中确认本人收款微信，财务审核后由系统转账。', 'Link your receiving WeChat in Mini Program → Account → Commission payouts. Transfers follow finance approval.')}</p> : <form onSubmit={async e => {
      e.preventDefault(); if(busy)return;
      const form=e.currentTarget, data=new FormData(form);
      if(data.get('agreed')!=='on'){setError(t('请确认本人收款信息','Confirm the receiving account'));return;}
      const body=JSON.stringify({method:'bank_transfer',accountName:String(data.get('accountName')||''),accountIdentifier:String(data.get('accountIdentifier')||''),routingCode:String(data.get('routingCode')||'')});
      if(!request.current||request.current.body!==body) request.current={key:crypto.randomUUID(),body};
      setBusy(true);setError('');setNotice('');
      try { await handleApi(await sessionFetch(apiUrl('/v1/platform/instructor/payout-profile'),{method:'PUT',headers:{...authHeaders(),'Idempotency-Key':request.current.key},body:request.current.body}));request.current=null;form.reset();setNotice(t('银行卡已保存。','Bank account saved.'));setLoaded(false);await refresh().catch(()=>setRefreshError(true)); }
      catch {setError(t('保存结果待核对，请重试或刷新','Save result unconfirmed. Retry or refresh.'));} finally{setBusy(false);}
    }}><fieldset className="platform-instructor-bank-form" disabled={busy || Boolean(payoutRequest.current)}><div className="platform-form-grid"><label>{t('本人姓名','Account holder')}<input className="platform-field-control" name="accountName" required maxLength={60}/></label><label>{t('银行卡号','Bank account')}<input className="platform-field-control" name="accountIdentifier" required inputMode="numeric" maxLength={32}/></label><label>{t('开户银行','Bank name')}<input className="platform-field-control" name="routingCode" required maxLength={120}/></label></div>{/* allow-checkbox: explicit consent to saving a personal payout account */}<label><input type="checkbox" name="agreed" required/>{t('我确认以上为本人收款账户，同意保存用于佣金结算。','I confirm this is my account and agree to save it for commission payouts.')}</label><button className="platform-button" type="submit">{busy?t('保存中…','Saving…'):t('保存银行卡','Save bank account')}</button></fieldset></form>}
    {savedMethod === channel && <div>
      <p>{t('可申请提现', 'Available to request')} <strong>{commerceMoney(availableMinor,'CNY')}</strong></p>
      <button type="button" className="platform-button platform-button-primary" disabled={busy||(!payoutRequest.current&&(availableMinor<=0||refreshError))} onClick={async () => {
        if (busy) return;
        if (!payoutRequest.current && availableMinor <= 0) { setError(t('当前没有可提现佣金', 'No commission is available to withdraw')); return; }
        if(!payoutRequest.current&&!window.confirm(t(`确认申请提现 ${commerceMoney(availableMinor,'CNY')}？`,`Request a payout of ${commerceMoney(availableMinor,'CNY')}?`))) return;
        payoutRequest.current ??= { key: crypto.randomUUID(), body: JSON.stringify({ amountMinor: availableMinor, method: channel, agreed: true }) };
        setBusy(true); setError(''); setNotice('');
        let rejected = false;
        try {
          const response = await sessionFetch(apiUrl('/v1/platform/instructor/payouts'), { method: 'POST', headers: { ...authHeaders(), 'Idempotency-Key': payoutRequest.current.key }, body: payoutRequest.current.body });
          rejected = [400, 403, 409, 422].includes(response.status);
          if (rejected) payoutRequest.current = null;
          await handleApi(response);
          payoutRequest.current = null;
          setNotice(t('提现申请已提交，等待审核。','Payout request submitted for review.'));setLoaded(false);
          await refresh().catch(()=>setRefreshError(true));
        } catch (error) { setError(rejected && error instanceof Error ? error.message : t('申请结果待核对，请重试原申请。', 'Request unconfirmed. Retry the original request.')); }
        finally { setBusy(false); }
      }}>{busy?t('处理中…','Working…'):payoutRequest.current ? t('重试原申请', 'Retry original request') : t('申请提现', 'Request payout')}</button>
    </div>}</>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {refreshError&&<p role="alert">{t('收款信息暂时无法更新，请刷新提现进度。','Payout details could not be refreshed. Retry below.')}</p>}
    <div className="platform-instructor-activity-heading"><h2>{t('结算记录','Payouts')}</h2><button type="button" className="platform-button" disabled={busy} onClick={() => { setBusy(true); void refresh().catch(() => setRefreshError(true)).finally(() => setBusy(false)); }}>{t('刷新提现进度','Refresh payouts')}</button></div>
    {mergedPayouts.map(p => <article key={p.id} className="platform-instructor-payout-row"><div><strong>{commerceMoney(p.amountMinor,p.currency)}</strong><small>{p.payoutNumber}</small></div><span>{p.transferState === 'WAIT_USER_CONFIRM' ? t('待微信确认收款','Confirm in WeChat') : p.status === 'paid' ? t('已到账','Paid') : p.status === 'draft' ? t('待审核','Awaiting approval') : p.status === 'cancelled' ? t('已取消','Cancelled') : p.status === 'failed' ? t('转账失败或待核对','Failed or needs reconciliation') : t('处理中','Processing')}</span><small>{p.paidAt?.slice(0,10)} {p.providerReference}</small></article>)}
    {!mergedPayouts.length && loaded && <p>{t('暂无结算记录','No payouts yet')}</p>}
  </section>;
}
