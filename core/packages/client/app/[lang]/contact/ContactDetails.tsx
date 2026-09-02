'use client';

import type { ReactNode } from 'react';
import {
  CONTACT_DIRECT_DETAILS,
  CONTACT_SOCIAL_PLATFORMS,
  CONTACT_WECHAT_QR_PATH,
  type ContactDirectDetailId,
  type ContactPlatformId,
} from '@cuberoot/shared/contact';
import { Mail, QrCode, User } from 'lucide-react';
import {
  SiBilibili,
  SiDiscord,
  SiInstagram,
  SiKuaishou,
  SiQq,
  SiTiktok,
  SiWechat,
  SiXiaohongshu,
  SiYoutube,
} from 'react-icons/si';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';

const ICON_SIZE = 16;
const PLATFORM_ICONS: Record<ContactPlatformId, ReactNode> = {
  youtube: <SiYoutube size={ICON_SIZE} color="#FF0000" aria-hidden="true" />,
  tiktok: <SiTiktok size={ICON_SIZE} color="#25F4EE" aria-hidden="true" />,
  instagram: <SiInstagram size={ICON_SIZE} color="#FF0069" aria-hidden="true" />,
  bilibili: <SiBilibili size={ICON_SIZE} color="#00A1D6" aria-hidden="true" />,
  douyin: <SiTiktok size={ICON_SIZE} color="#FE2C55" aria-hidden="true" />,
  xiaohongshu: <SiXiaohongshu size={ICON_SIZE} color="#FF2442" aria-hidden="true" />,
  kuaishou: <SiKuaishou size={ICON_SIZE} color="#FF4906" aria-hidden="true" />,
  'wechat-official': <SiWechat size={ICON_SIZE} color="#07C160" aria-hidden="true" />,
};
const DIRECT_DETAIL_ICONS: Record<ContactDirectDetailId, ReactNode> = {
  author: <User size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" />,
  wechat: <SiWechat size={ICON_SIZE} color="#07C160" aria-hidden="true" />,
  qq: <SiQq size={ICON_SIZE} color="#1EBAFC" aria-hidden="true" />,
  email: <Mail size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" />,
  discord: <SiDiscord size={ICON_SIZE} color="#5865F2" aria-hidden="true" />,
};

function CopyValueButton({ copyKey, value }: { copyKey: string; value: string }) {
  const { copiedKey, copy } = useCopy(1500);
  const copied = copiedKey === copyKey;
  const label = copied
    ? tr({ zh: '已复制', en: 'Copied' })
    : tr({ zh: '复制', en: 'Copy' });

  return (
    <button
      type="button"
      className="contact-copy-value"
      onClick={() => copy(value, copyKey)}
      title={label}
      aria-label={label}
    >
      {copied ? label : value}
    </button>
  );
}

export default function ContactDetails() {
  const lang = useLang();
  const platforms = [...CONTACT_SOCIAL_PLATFORMS]
    .sort((a, b) => Number(b.language === lang) - Number(a.language === lang));

  return (
    <div className="contact-details-columns">
      <dl className="contact-details">
        {platforms.map((platform) => (
          <div key={platform.id} className="contact-details-row contact-details-link-row">
            <dt>
              {platform.href ? (
                <a href={platform.href} target="_blank" rel="noopener noreferrer">
                  <span className="contact-details-icon">{PLATFORM_ICONS[platform.id]}</span>
                  <span>{tr(platform.label)}</span>
                </a>
              ) : (
                <>
                  <span className="contact-details-icon">{PLATFORM_ICONS[platform.id]}</span>
                  <span>{tr(platform.label)}</span>
                </>
              )}
            </dt>
            <dd>
              <span className="contact-platform-account">{platform.account}</span>
              {platform.count && <span className="contact-platform-count">{tr(platform.count)}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="contact-details">
        {CONTACT_DIRECT_DETAILS.map((detail) => {
          const value = detail.value ? tr(detail.value) : '';
          const label = (
            <>
              <span className="contact-details-icon">{DIRECT_DETAIL_ICONS[detail.id]}</span>
              <span>{tr(detail.label)}</span>
            </>
          );
          return (
            <div
              key={detail.id}
              className={`contact-details-row${detail.action === 'link' ? ' contact-details-link-row' : ''}`}
            >
              <dt>
                {detail.action === 'link' && detail.href ? (
                  <a href={detail.href} target="_blank" rel="noopener noreferrer">{label}</a>
                ) : label}
              </dt>
              <dd>
                {detail.action === 'copy' ? (
                  <CopyValueButton copyKey={detail.id} value={value} />
                ) : value}
                {detail.showQr && (
                  <>
                    <button
                      type="button"
                      className="contact-qr-trigger"
                      popoverTarget="wechat-qr"
                      title={tr({ zh: '查看微信二维码', en: 'View WeChat QR code' })}
                      aria-label={tr({ zh: '查看微信二维码', en: 'View WeChat QR code' })}
                    >
                      <QrCode size={ICON_SIZE} color="#07C160" strokeWidth={2} aria-hidden="true" />
                    </button>
                    <div id="wechat-qr" className="contact-qr-popover" popover="auto">
                      <img
                        className="contact-qr"
                        src={CONTACT_WECHAT_QR_PATH}
                        alt={tr({ zh: '魔方根微信二维码', en: 'WeChat QR code for Ruimin Yan' })}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
