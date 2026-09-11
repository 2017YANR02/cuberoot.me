'use client';

import { useState } from 'react';
import { Bell, CalendarClock, ShieldCheck } from 'lucide-react';
import { SiWechat } from 'react-icons/si';
import { ClearButton } from '@/components/ClearButton';
import AppLink from '@/components/AppLink';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';

interface Props {
  price: string;
  period: 'month' | 'year';
  onClose: () => void;
}

export default function AutoRenewModal({ price, period, onClose }: Props) {
  const [agreed, setAgreed] = useState(false);
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
          {tr({ zh: '自动续费尚未开放，当前不能签约或扣款。以下说明用于了解服务，勾选协议不会开通自动续费。', en: 'Auto-renewal is not available yet. No authorization or charge can be made. Checking the agreement below does not activate a subscription.' })}
        </p>

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

        <button className="mem-autorenew-sign" disabled aria-describedby="mem-autorenew-availability">
          <SiWechat size={18} aria-hidden="true" />
          {tr({ zh: '微信签约暂未开放', en: 'WeChat authorization unavailable' })}
        </button>
        <p className="mem-autorenew-caption">
          <AppLink href="/membership/subscription" prefetch={false}>{tr({ zh: '管理自动续费与取消说明', en: 'Manage auto-renewal and cancellation' })}</AppLink>
        </p>
      </section>
    </div>
  );
}
