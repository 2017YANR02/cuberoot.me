'use client';

import { useModalDismiss } from '@/hooks/useModalDismiss';
import { Info } from 'lucide-react';
import AppLink from '@/components/AppLink';
import './donate-modal.css';

interface Props {
  lang: 'zh' | 'en';
  onClose: () => void;
}

const ICON_SIZE = 14;

export default function DonateModal({ lang, onClose }: Props) {
  useModalDismiss(onClose);

  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  return (
    <div className="donate-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="donate-modal" onClick={(e) => e.stopPropagation()}>
        <button className="donate-close" onClick={onClose} aria-label={t('关闭', 'Close')}>✕</button>
        <h2 className="donate-title">{t('谢谢你的支持 ♡', 'Thanks for your support ♡')}</h2>

        <div className="donate-qr-row">
          <figure className="donate-qr">
            <img src="/donate/alipay.webp" alt="Alipay QR" width={600} height={899}
              loading="eager" decoding="async" fetchPriority="high" />
          </figure>
          <figure className="donate-qr">
            <img src="/donate/wechat.webp" alt="WeChat Pay QR" width={600} height={814}
              loading="eager" decoding="async" fetchPriority="high" />
          </figure>
        </div>

        <div className="donate-qr-note">
          <Info size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" />
          <span>{t('支付时备注名字', 'Add your name in the payment note')}</span>
        </div>

        <div className="donate-credits">
          <AppLink href="/contact" onClick={onClose}>{t('联系我 →', 'Contact me →')}</AppLink>
        </div>
      </div>
    </div>
  );
}
