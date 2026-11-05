'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, LockKeyhole } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { isMiniProgramCommerceRestricted, openMiniProgramOrderPayment } from '@/lib/miniprogram-bridge';
import { isInWeChat } from '@/lib/wechat-share';
import { copyPageLink } from '@/lib/page-share';
import { commerceMoney } from '@/lib/platform-commerce-format';
import { isPlatformPaymentAttemptResult, type PlatformActionId, type PlatformActionResult, type PlatformEntity, type PlatformPaymentAttemptResult } from '@/lib/platform-types';
import './platform-order-payment.css';

type Provider = 'wechat' | 'alipay';

export function PlatformOrderPayment({ entity, busy, runAction, message }: {
  entity: PlatformEntity;
  busy: string | null;
  runAction: (action: PlatformActionId, id?: string, payload?: Record<string, unknown>) => Promise<PlatformActionResult | undefined>;
  message?: string | null;
}) {
  const t = useT();
  const lang = useLang();
  const [environment, setEnvironment] = useState<{ embedded: boolean; mobile: boolean; wechat: boolean } | null>(null);
  const [selected, setSelected] = useState<Provider>('wechat');
  const [attempt, setAttempt] = useState<PlatformPaymentAttemptResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void isMiniProgramCommerceRestricted().then(embedded => {
      if (!cancelled) setEnvironment({ embedded, mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent), wechat: isInWeChat() });
    });
    return () => { cancelled = true; };
  }, []);
  const data = entity.data ?? {};
  const channels = data.paymentChannels as Record<string, boolean> | undefined;
  const ticketOnly = Array.isArray(data.items) && data.items.length > 0
    && data.items.every(item => item && typeof item === 'object' && item.sellableType === 'event_ticket'
      && item.snapshot && typeof item.snapshot === 'object' && 'competition' in item.snapshot);
  const saved = data.activePayment as PlatformActionResult | null | undefined;
  const active = attempt ?? (saved && isPlatformPaymentAttemptResult(saved) ? saved : null);
  const providers: Provider[] = !environment ? [] : environment.embedded
    ? ticketOnly && channels?.wechatMiniProgram === true ? ['wechat'] : []
    : [channels?.[environment.mobile ? 'wechatH5' : 'wechatNative'] === true ? 'wechat' : null,
      channels?.alipay === true ? 'alipay' : null].filter((value): value is Provider => value !== null);
  const provider = active?.provider ?? (providers.includes(selected) ? selected : providers[0]);
  const externalBrowser = !!environment?.mobile && environment.wechat && !environment.embedded;
  const amount = commerceMoney(data.totalAmountMinor, data.currency);
  const pending = (data.status ?? entity.status) === 'pending_payment' && Number(data.totalAmountMinor) > 0;

  async function start() {
    if (!pending || !provider || !environment || busy || inFlight.current) return;
    if (externalBrowser) {
      const url = new URL(`${lang === 'zh' ? '/zh' : ''}/platform/orders/${encodeURIComponent(entity.id)}`, window.location.origin);
      const ok = await copyPageLink(url.href);
      setCopied(ok);
      setError(ok ? '' : t('复制失败，请使用右上角菜单在浏览器中打开。', 'Could not copy the link. Open this page in your browser from the top-right menu.'));
      return;
    }
    inFlight.current = true;
    setStarting(true); setError('');
    try {
      if (environment.embedded) {
        if (!await openMiniProgramOrderPayment(entity.id)) setError(t('无法打开小程序支付，请在浏览器打开此订单。', 'Native checkout is unavailable. Open this order in your browser.'));
        return;
      }
      const clientType = active?.clientType === 'pc' || active?.clientType === 'wap'
        ? active.clientType : environment.mobile ? 'wap' : 'pc';
      const response = await runAction('start-payment', entity.id, { provider, clientType, lang });
      if (!response || !isPlatformPaymentAttemptResult(response)) return;
      setAttempt(response);
      if (response.checkoutUrl) window.location.assign(response.checkoutUrl);
    } catch {
      setError(t('暂时无法打开支付，请重试。', 'Could not open checkout. Please try again.'));
    } finally { inFlight.current = false; setStarting(false); }
  }

  if (!pending) return null;
  return <section className="platform-order-payment" data-site-surface="panel" aria-label={t('订单付款', 'Order payment')}>
    <div className="platform-pay-total"><h2>{t('应付金额', 'Amount due')}</h2><strong>{amount}</strong></div>
    <div className="platform-pay-controls">
      {providers.length > 0 && <fieldset className="platform-pay-methods" disabled={starting || !!busy}>
        <legend>{t('支付方式', 'Payment method')}</legend>
        {providers.map(value => <label key={value} data-selected={value === provider}>
          <input className="platform-pay-method-input" type="radio" name="order-payment-provider" value={value} checked={value === provider}
            disabled={!!active && active.provider !== value} onChange={() => { setSelected(value); setError(''); }} />
          {value === 'wechat' ? t('微信支付', 'WeChat Pay') : t('支付宝', 'Alipay')}
        </label>)}
      </fieldset>}
      {!environment ? <p role="status">{t('正在加载支付方式…', 'Loading payment methods…')}</p>
        : !providers.length ? <p role="status">{environment.embedded && !ticketOnly
          ? t('请在浏览器打开此订单付款。', 'Open this order in your browser to pay.')
          : t('此订单暂时没有可用的支付方式，请稍后重试或联系我们。', 'Payment is currently unavailable for this order. Please try again later or contact us.')}</p> : null}
      {externalBrowser && providers.length > 0 && <p role="status">{t('请点微信右上角菜单，在浏览器打开后付款。', 'Use the top-right WeChat menu to open this page in your browser and pay.')}</p>}
      {providers.length > 0 && <button type="button" className="platform-pay-submit" disabled={starting || !!busy} onClick={() => { void start(); }}>
        {starting ? t('正在打开支付…', 'Opening checkout…') : externalBrowser
          ? copied ? t('链接已复制', 'Link copied') : t('复制订单链接', 'Copy order link')
          : active ? t(`继续支付 ${amount}`, `Continue payment ${amount}`) : t(`去支付 ${amount}`, `Pay ${amount}`)}
        <ArrowRight size={22} aria-hidden />
      </button>}
      {!externalBrowser && providers.length > 0 && <p className="platform-pay-security"><LockKeyhole size={14} aria-hidden />{t('由支付宝或微信安全收款', 'Secure checkout with Alipay or WeChat Pay')}</p>}
      {active && <p className="platform-pay-note">{t('继续原支付不会重复创建付款。', 'Continuing resumes the same payment.')}</p>}
      {active?.qrCodeDataUrl && <div className="platform-pay-qr" role="status"><img src={active.qrCodeDataUrl} alt={t('微信支付二维码', 'WeChat payment QR code')} width={240} height={240} /><p>{t('微信扫一扫付款，支付后订单会自动更新。', 'Scan with WeChat to pay. Your order will update automatically.')}</p></div>}
      {error && <p className="platform-pay-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  </section>;
}
