'use client';

import { useEffect, useRef, useState } from 'react';
import { renewalAvailability, enrollMembershipSubscription, createMembershipMiniLink } from '@/lib/membership-api';
import { SiWechat } from 'react-icons/si';
import { ClearButton } from '@/components/ClearButton';
import AppLink from '@/components/AppLink';
import { MEMBERSHIP_COPY } from '@/lib/membership-copy';
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
  const available = Boolean(availability?.available && planSlug && priceCents && (planSlug.startsWith('enterprise_') ? availability.plans?.[planSlug] === true : availability.plans?.[planSlug] !== false));
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
        title: planSlug?.startsWith('enterprise_') ? MEMBERSHIP_COPY.enterpriseAnnual : MEMBERSHIP_COPY.annual,
        unit: { zh: '年', en: 'year' },
      }
    : {
        title: planSlug?.startsWith('enterprise_') ? MEMBERSHIP_COPY.enterpriseMonthly : MEMBERSHIP_COPY.monthly,
        unit: { zh: '月', en: 'month' },
      };

  const backdropProps = useModalDismiss(onClose);

  return (
    <div className="mem-pay-backdrop" {...backdropProps}>
      <section className="mem-pay mem-autorenew-modal" role="dialog" aria-modal="true" aria-labelledby="mem-autorenew-title">
        <ClearButton
          variant="standalone"
          className="mem-pay-close"
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
          onClick={onClose}
        />

        <h2 id="mem-autorenew-title" className="mem-pay-title">{tr(copy.title)} · {tr(MEMBERSHIP_COPY.renewal)}</h2>
        <div className="mem-pay-price">{price}<span className="mem-autorenew-price-unit">/{tr(copy.unit)}</span></div>

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
            <AppLink href="/membership/renewal-terms" target="_blank" rel="noopener" prefetch={false}>{tr(MEMBERSHIP_COPY.agreement)}</AppLink>
          </span>
        </div>

        {failed && <p role="alert">{tr({ zh: '暂时无法发起签约，请确认已登录，或到“管理自动续费”检查已有签约后重试。', en: 'Unable to start authorization. Sign in, or check existing authorizations in Manage auto-renewal before retrying.' })}</p>}
        {miniLink && <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- API-generated QR data URL */}
          {!availability?.pilot && <img src={miniLink.qrCodeDataUrl} width={256} height={256} alt={tr({ zh: '微信扫码签约', en: 'Scan with WeChat to authorize' })} />}
          <p>{availability?.pilot ? tr({ zh: '请在手机系统浏览器打开下方链接，进入已上传的开发版；需要开发者权限。小程序须登录与网站相同的账号，链接 10 分钟内有效。', en: 'Open the link in your phone’s system browser to access the uploaded development version. Developer access is required. Use the same account; the link expires in 10 minutes.' }) : tr({ zh: '请用微信扫码，或在手机点击下方链接。小程序须登录与网站相同的 CubeRoot 账号；链接 10 分钟内有效。', en: 'Scan with WeChat or open the link on your phone. Sign in to the same CubeRoot account in the Mini Program. This link expires in 10 minutes.' })}</p>
          <a href={miniLink.urlLink} target="_blank" rel="noopener noreferrer">{tr({ zh: '打开微信签约', en: 'Open authorization in WeChat' })}</a>
        </div>}
        <button data-corner-shape="native" className="mem-autorenew-sign" disabled={!available || !agreed || busy} onClick={sign}>
          <SiWechat size={18} aria-hidden="true" />
          {busy ? tr({ zh: '正在打开…', en: 'Opening…' }) : available ? tr({ zh: '前往微信签约', en: 'Authorize in WeChat' }) : tr({ zh: '微信签约暂不可用', en: 'WeChat authorization unavailable' })}
        </button>
        <p className="mem-autorenew-caption">
          <AppLink href="/membership/subscription" prefetch={false}>{tr(MEMBERSHIP_COPY.manage)}</AppLink>
        </p>
      </section>
    </div>
  );
}
