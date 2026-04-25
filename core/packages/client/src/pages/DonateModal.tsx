import { useEffect } from 'react';
import './donate-modal.css';

interface Props {
  lang: 'zh' | 'en';
  onClose: () => void;
}

export default function DonateModal({ lang, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const base = import.meta.env.BASE_URL;
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  return (
    <div className="donate-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="donate-modal" onClick={(e) => e.stopPropagation()}>
        <button className="donate-close" onClick={onClose} aria-label={t('关闭', 'Close')}>✕</button>
        <h2 className="donate-title">{t('支持 CubeRoot', 'Support CubeRoot')}</h2>

        <div className="donate-qr-row">
          <figure className="donate-qr">
            <img src={`${base}donate/alipay.jpg`} alt="Alipay QR" />
            <figcaption>{t('支付宝', 'Alipay')}</figcaption>
          </figure>
          <figure className="donate-qr">
            <img src={`${base}donate/wechat.jpg`} alt="WeChat Pay QR" />
            <figcaption>{t('微信支付', 'WeChat Pay')}</figcaption>
          </figure>
        </div>

        <div className="donate-thanks">{t('谢谢你的支持 ♡', 'Thanks for your support ♡')}</div>
      </div>
    </div>
  );
}
