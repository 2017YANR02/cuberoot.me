'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';

type Payout = { id: string; amountMinor: string; status: string; currency: string; transferState: string | null };
export function InstructorPayoutSettings() {
  const t = useT();
  const [channel, setChannel] = useState('wechat');
  const [configured, setConfigured] = useState(false);
  const [savedMethod, setSavedMethod] = useState<string | null>(null);
  const [availableMinor, setAvailableMinor] = useState(0);
  const payoutRequest = useRef<{ key: string; body: string } | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<{ key: string; body: string } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [profile, result] = await Promise.all([
      sessionFetch(apiUrl('/v1/platform/instructor/payout-profile'), { headers: authHeaders(false), cache: 'no-store', signal }).then(handleApi<{configured: boolean; method?: string}>),
      sessionFetch(apiUrl('/v1/platform/instructor/payouts'), { headers: authHeaders(false), cache: 'no-store', signal }).then(handleApi<{payouts:Payout[]; availableMinor:number}>),
    ]);
    if (!signal?.aborted) { setConfigured(profile.configured && profile.method === 'wechat'); setSavedMethod(profile.method ?? null); setPayouts(result.payouts); setAvailableMinor(result.availableMinor); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const update = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try { await refresh(controller.signal); }
      catch { if (!controller.signal.aborted) setError(t('提现资料暂不可用', 'Payout details unavailable')); }
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
  }, [refresh, t]);
  return <section className="platform-domain-actions">
    <h2>{t('收款方式', 'Payout method')}</h2>
    <label>{t('提现至', 'Receive via')}<select value={channel} disabled={busy || Boolean(payoutRequest.current)} onChange={e => { setChannel(e.target.value); setError(''); }}><option value="wechat">{t('微信（优先）', 'WeChat (preferred)')}</option><option value="bank_transfer">{t('银行卡', 'Bank transfer')}</option></select></label>
    {channel === 'wechat' ? <p>{configured ? t('已关联本人微信。需要确认收款时，请打开微信小程序 → 账号 → 佣金提现。', 'Your WeChat is linked. Confirm receipts in Mini Program → Account → Commission payouts.') : t('在微信小程序 → 账号 → 佣金提现中确认本人收款微信，财务审核后由系统转账。', 'Link your receiving WeChat in Mini Program → Account → Commission payouts. Transfers follow finance approval.')}</p> : <form onSubmit={async e => {
      e.preventDefault(); if(busy)return;
      const form=e.currentTarget, data=new FormData(form);
      if(data.get('agreed')!=='on'){setError(t('请确认本人收款信息','Confirm the receiving account'));return;}
      const body=JSON.stringify({method:'bank_transfer',accountName:String(data.get('accountName')||''),accountIdentifier:String(data.get('accountIdentifier')||''),routingCode:String(data.get('routingCode')||'')});
      if(!request.current||request.current.body!==body) request.current={key:crypto.randomUUID(),body};
      setBusy(true);setError('');
      try { await handleApi(await sessionFetch(apiUrl('/v1/platform/instructor/payout-profile'),{method:'PUT',headers:{...authHeaders(),'Idempotency-Key':request.current.key},body:request.current.body}));request.current=null;form.reset();await refresh(); }
      catch {setError(t('保存结果待核对，请重试或刷新','Save result unconfirmed. Retry or refresh.'));} finally{setBusy(false);}
    }}><fieldset disabled={busy || Boolean(payoutRequest.current)}><label>{t('本人姓名','Account holder')}<input name="accountName" required maxLength={60}/></label><label>{t('银行卡号','Bank account')}<input name="accountIdentifier" required inputMode="numeric" maxLength={32}/></label><label>{t('开户银行','Bank name')}<input name="routingCode" required maxLength={120}/></label>{/* allow-checkbox: explicit consent to saving a personal payout account */}<label><input type="checkbox" name="agreed" required/>{t('我确认以上为本人收款账户，同意保存用于佣金结算。','I confirm this is my account and agree to save it for commission payouts.')}</label><button type="submit">{t('保存银行卡','Save bank account')}</button></fieldset></form>}
    {savedMethod === channel && <div>
      <p>{t('可申请提现', 'Available to request')} ¥{(availableMinor / 100).toFixed(2)}</p>
      <button type="button" disabled={busy} onClick={async () => {
        if (busy) return;
        if (!payoutRequest.current && availableMinor <= 0) { setError(t('当前没有可提现佣金', 'No commission is available to withdraw')); return; }
        payoutRequest.current ??= { key: crypto.randomUUID(), body: JSON.stringify({ amountMinor: availableMinor, method: channel, agreed: true }) };
        setBusy(true); setError('');
        let rejected = false;
        try {
          const response = await sessionFetch(apiUrl('/v1/platform/instructor/payouts'), { method: 'POST', headers: { ...authHeaders(), 'Idempotency-Key': payoutRequest.current.key }, body: payoutRequest.current.body });
          rejected = [400, 403, 409, 422].includes(response.status);
          if (rejected) payoutRequest.current = null;
          await handleApi(response);
          payoutRequest.current = null;
          await refresh();
        } catch (error) { setError(rejected && error instanceof Error ? error.message : t('申请结果待核对，请重试原申请。', 'Request unconfirmed. Retry the original request.')); }
        finally { setBusy(false); }
      }}>{payoutRequest.current ? t('重试原申请', 'Retry original request') : t('申请提现', 'Request payout')}</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => { setBusy(true); void refresh().catch(() => setError(t('读取失败，请稍后刷新','Unable to refresh'))).finally(() => setBusy(false)); }}>{t('刷新提现进度','Refresh payouts')}</button>
    {payouts.map(p => <p key={p.id}>{`${p.currency} ${(Number(p.amountMinor)/100).toFixed(2)}`} · {p.transferState === 'WAIT_USER_CONFIRM' ? t('待微信确认收款','Confirm in WeChat') : p.status === 'paid' ? t('已到账','Paid') : p.status === 'draft' ? t('待审核','Awaiting approval') : p.status === 'cancelled' ? t('已取消','Cancelled') : p.status === 'failed' ? t('转账失败或待核对','Failed or needs reconciliation') : t('处理中','Processing')}</p>)}
  </section>;
}
