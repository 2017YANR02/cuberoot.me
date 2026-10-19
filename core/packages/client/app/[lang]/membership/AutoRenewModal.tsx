'use client';

import { useEffect, useRef, useState } from 'react';
import { renewalAvailability, enrollMembershipSubscription, createMembershipMiniLink } from '@/lib/membership-api';
import { Bell, CalendarClock, ShieldCheck } from 'lucide-react';
import { SiWechat } from 'react-icons/si';
import { ClearButton } from '@/components/ClearButton';
import AppLink from '@/components/AppLink';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';

interface Props {
  price: string;
  period: 'month' | 'year';
  planSlug?: string;
  priceCents?: number;
  onClose: () => void;
}

export default function AutoRenewModal({ price, period, planSlug, priceCents, onClose }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof renewalAvailability>> | null>(null);
  const [miniLink, setMiniLink] = useState<Awaited<ReturnType<typeof createMembershipMiniLink>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const available = Boolean(availability?.available && planSlug && priceCents);
  useEffect(() => {
    let cancelled = false;
    if (planSlug) void renewalAvailability().then(value => { if (!cancelled) setAvailability(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [planSlug]);
  async function sign() {
    if (!available || !agreed || busy || !planSlug || !priceCents || !availability) return;
    setBusy(true);
    setFailed(false);
    try {
      if (availability.channel === 'miniprogram') {
        const link = await createMembershipMiniLink(planSlug);
        if (mounted.current) { setMiniLink(link); setBusy(false); }
        return;
      }
      const result = await enrollMembershipSubscription(planSlug, priceCents, availability.termsVersion);
      if (!mounted.current) return;
      const url = new URL(result.redirectUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'payapp.weixin.qq.com' || url.username || url.password || url.port) throw new Error('invalid redirect');
      window.location.assign(url.href);
    } catch { setFailed(true); setBusy(false); }
  }
  const copy = period === 'year'
    ? {
        title: { zh: '开通连续包年', en: 'Start annual auto-renewal' },
        unit: { zh: '年', en: 'year' },
        firstCharge: { zh: '首期及以后每年均为 {price}，支付成功后开通相应服务期', en: 'The first and each subsequent year cost {price}. Membership starts after successful payment.' },
      }
    : {
        title: { zh: '开通连续包月', en: 'Start monthly auto-renewal' },
        unit: { zh: '月', en: 'month' },
        firstCharge: { zh: '首期及以后每月均为 {price}，支付成功后开通相应服务期', en: 'The first and each subsequent month cost {price}. Membership starts after successful payment.' },
      };

  const backdropProps = useModalDismiss(onClose);

  return (
    <div className="mem-pay-backdrop" {...backdropProps}>
      <section className="mem-pay mem-autorenew-modal" role="dialog" aria-modal="true" aria-labelledby="mem-autorenew-title" aria-describedby="mem-autorenew-availability">
        <ClearButton
          variant="standalone"
          className="mem-pay-close"
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
          onClick={onClose}
        />

        <SiWechat className="mem-autorenew-wechat" size={28} aria-hidden="true" />
        <h2 id="mem-autorenew-title" className="mem-pay-title">{tr(copy.title)}</h2>
        <div className="mem-pay-price">{price}<span className="mem-autorenew-price-unit">/{tr(copy.unit)}</span></div>

        <ul className="mem-autorenew-rules">
          <li><CalendarClock size={16} /><span>{tr(copy.firstCharge).replace('{price}', price)}</span></li>
          <li><Bell size={16} /><span>{tr({ zh: '每次续费扣款前将发送通知', en: 'You will be notified before every renewal charge' })}</span></li>
          <li><ShieldCheck size={16} /><span>{tr({ zh: '可随时取消，取消后不再产生续费扣款', en: 'Cancel anytime to stop future renewal charges' })}</span></li>
        </ul>
        <p id="mem-autorenew-availability" className="mem-autorenew-caption" role="status">
          {available && !availability?.pilot
            ? tr({ zh: '将在微信中确认授权。签约后申请首期扣款，支付成功后开通会员；后续在到期前 24 小时申请续费，由微信通知并延迟扣款。', en: 'Confirm authorization in WeChat. The first charge is requested after signing and membership starts after payment. Renewal requests are sent 24 hours before expiry, followed by WeChat’s notice and delayed debit.' })
            : availability?.pilot ? null : tr({ zh: '自动续费暂不可用，请稍后重试。勾选协议不会建立扣款授权。', en: 'Auto-renewal is temporarily unavailable. Please try again later. Checking the agreement does not authorize any charges.' })}
        </p>

        {availability?.pilot && <p role="status" className="mem-autorenew-caption">{availability.pilotPayment
          ? tr({ zh: '仅限指定账号验收：签约将申请真实首期扣款，不是模拟支付。验收期间不会申请第二期扣款。', en: 'Private account acceptance: authorization requests a real first payment, not a simulation. No second-period debit is requested during acceptance.' })
          : tr({ zh: '仅限指定账号验收：当前只验证签约与取消，扣款关闭，不会因签约发放会员。', en: 'Private account acceptance: authorization and cancellation only. Debits are disabled; signing does not grant membership.' })}</p>}
        <div className="mem-autorenew-consent">
          {/* allow-checkbox: explicit legal consent must be actively selected by the user */}
          <input
            className="mem-autorenew-consent-input"
            type="checkbox"
            id="mem-autorenew-consent"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>
            <label htmlFor="mem-autorenew-consent">{tr({ zh: '我已阅读并同意', en: 'I have read and agree to ' })}</label>
            <AppLink href="/membership/renewal-terms" target="_blank" rel="noopener" prefetch={false}>{tr({ zh: '《自动续费服务协议》', en: 'the Auto-renewal Agreement' })}</AppLink>
          </span>
        </div>

        {failed && <p role="alert">{tr({ zh: '暂时无法发起签约，请确认已登录，或到“管理自动续费”检查已有签约后重试。', en: 'Unable to start authorization. Sign in, or check existing authorizations in Manage auto-renewal before retrying.' })}</p>}
        {miniLink && <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- API-generated QR data URL */}
          {!availability?.pilot && <img src={miniLink.qrCodeDataUrl} width={256} height={256} alt={tr({ zh: '微信扫码签约', en: 'Scan with WeChat to authorize' })} />}
          <p>{availability?.pilot ? tr({ zh: '请在手机系统浏览器打开下方链接，进入已上传的开发版；需要开发者权限。小程序须登录与网站相同的账号，链接 10 分钟内有效。', en: 'Open the link in your phone’s system browser to access the uploaded development version. Developer access is required. Use the same account; the link expires in 10 minutes.' }) : tr({ zh: '请用微信扫码，或在手机点击下方链接。小程序须登录与网站相同的 CubeRoot 账号；链接 10 分钟内有效。', en: 'Scan with WeChat or open the link on your phone. Sign in to the same CubeRoot account in the Mini Program. This link expires in 10 minutes.' })}</p>
          <a href={miniLink.urlLink} target="_blank" rel="noopener noreferrer">{tr({ zh: '打开微信签约', en: 'Open authorization in WeChat' })}</a>
        </div>}
        <button className="mem-autorenew-sign" disabled={!available || !agreed || busy} onClick={sign} aria-describedby="mem-autorenew-availability">
          <SiWechat size={18} aria-hidden="true" />
          {available ? tr({ zh: '前往微信签约', en: 'Authorize in WeChat' }) : tr({ zh: '微信签约暂不可用', en: 'WeChat authorization unavailable' })}
        </button>
        <p className="mem-autorenew-caption">
          {tr({ zh: '退订：会员 → 管理自动续费 → 对应签约记录 → 取消自动续费 → 确认取消，以微信确认结果为准。已付权益保留到期，取消不会自动退款。', en: 'To cancel: Membership → Manage auto-renewal → Select the authorization → Cancel auto-renewal → Confirm cancellation. WeChat must confirm the result. Paid benefits remain until expiry; cancellation does not automatically issue a refund.' })}
        </p>
        <p className="mem-autorenew-caption">
          <AppLink href="/membership/subscription" prefetch={false}>{tr({ zh: '管理自动续费 / 退订', en: 'Manage / cancel auto-renewal' })}</AppLink>
        </p>
      </section>
    </div>
  );
}
