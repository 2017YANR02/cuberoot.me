'use client';

import { useState } from 'react';
import { Bell, CalendarClock, ShieldCheck } from 'lucide-react';
import { SiWechat } from 'react-icons/si';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';

interface Props {
  price: string;
  period: 'month' | 'year';
  onClose: () => void;
}

export default function AutoRenewModal({ price, period, onClose }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const copy = period === 'year'
    ? {
        title: { zh: '开通连续包年', en: 'Start annual auto-renewal' },
        unit: { zh: '年', en: 'year' },
        firstCharge: { zh: '开通时支付首年费用，之后每年自动续费', en: 'Pay for the first year now, then renew automatically each year' },
      }
    : {
        title: { zh: '开通连续包月', en: 'Start monthly auto-renewal' },
        unit: { zh: '月', en: 'month' },
        firstCharge: { zh: '开通时支付首月费用，之后每月自动续费', en: 'Pay for the first month now, then renew automatically each month' },
      };

  useModalDismiss(onClose);

  return (
    <div className="mem-pay-backdrop" onClick={onClose}>
      <div className="mem-pay mem-autorenew-modal" onClick={(event) => event.stopPropagation()}>
        <ClearButton
          variant="standalone"
          className="mem-pay-close"
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
          onClick={onClose}
        />

        <SiWechat className="mem-autorenew-wechat" size={28} aria-hidden="true" />
        <h2 className="mem-pay-title">{tr(copy.title)}</h2>
        <div className="mem-pay-price">{price}<span className="mem-autorenew-price-unit">/{tr(copy.unit)}</span></div>

        <ul className="mem-autorenew-rules">
          <li><CalendarClock size={16} /><span>{tr(copy.firstCharge)}</span></li>
          <li><Bell size={16} /><span>{tr({ zh: '每次续费扣款前将发送通知', en: 'You will be notified before every renewal charge' })}</span></li>
          <li><ShieldCheck size={16} /><span>{tr({ zh: '可随时取消，取消后不再产生续费扣款', en: 'Cancel anytime to stop future renewal charges' })}</span></li>
        </ul>

        <label className="mem-autorenew-consent">
          {/* allow-checkbox: explicit legal consent must be actively selected by the user */}
          <input
            className="mem-autorenew-consent-input"
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>{tr({ zh: '我已阅读并同意《自动续费服务协议》', en: 'I have read and agree to the Auto-renewal Agreement' })}</span>
        </label>

        <button className="mem-autorenew-sign" disabled={!agreed} onClick={() => setUnavailable(true)}>
          <SiWechat size={18} aria-hidden="true" />
          {tr({ zh: '进入微信签约', en: 'Continue to WeChat authorization' })}
        </button>
        <p className="mem-autorenew-caption">
          {unavailable
            ? tr({ zh: '微信自动续费正在开通，暂时无法发起签约。', en: 'WeChat auto-renewal is being activated and authorization is not available yet.' })
            : tr({ zh: '将在微信支付页面确认签约及扣款方式', en: 'Confirm the agreement and payment method in WeChat Pay' })}
        </p>
      </div>
    </div>
  );
}
