'use client';

import type { ReactNode } from 'react';
import {
  CONTACT_DIRECT_DETAILS,
  CONTACT_SOCIAL_PLATFORMS,
  CONTACT_WEBSITE,
  CONTACT_WECHAT_QR_PATH,
  type ContactDirectDetailId,
  type ContactPlatformId,
} from '@cuberoot/shared/contact';
import { SITE_CREATOR_PROFILE } from '@cuberoot/shared/site-directory';
import { Mail, PanelsTopLeft, QrCode, User } from 'lucide-react';
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
import AppLink from '@/components/AppLink';

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
const COMING_SOON = { zh: '即将上线', en: 'Coming soon' } as const;
const APP_PLATFORMS = [
  { label: { zh: '网站', en: 'Website' }, value: { zh: CONTACT_WEBSITE, en: CONTACT_WEBSITE }, href: '/' },
  { label: { zh: '微信小程序', en: 'WeChat Mini Program' }, value: { zh: '魔方根', en: 'CubeRoot' }, href: null },
  { label: { zh: '抖音小程序', en: 'Douyin Mini Program' }, value: COMING_SOON, href: null },
  { label: { zh: 'iOS App', en: 'iOS app' }, value: COMING_SOON, href: null },
  { label: { zh: '安卓 App', en: 'Android app' }, value: COMING_SOON, href: null },
  { label: { zh: '鸿蒙 App', en: 'HarmonyOS app' }, value: COMING_SOON, href: null },
  { label: { zh: 'Windows 客户端', en: 'Windows client' }, value: COMING_SOON, href: null },
] as const;

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
      <dl className="contact-details contact-social-details">
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
              <span className="contact-platform-account">
                <CopyValueButton copyKey={`platform-${platform.id}`} value={platform.account} />
              </span>
              {platform.count && <span className="contact-platform-count">{tr(platform.count)}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="contact-details">
        {CONTACT_DIRECT_DETAILS.map((detail) => {
          const value = detail.value ? tr(detail.value) : '';
          const authorHref = detail.id === 'author' ? SITE_CREATOR_PROFILE.href : null;
          const label = (
            <>
              <span className="contact-details-icon">{DIRECT_DETAIL_ICONS[detail.id]}</span>
              <span>{tr(detail.label)}</span>
            </>
          );
          return (
            <div
              key={detail.id}
              className={`contact-details-row${detail.action === 'link' || authorHref ? ' contact-details-link-row' : ''}`}
            >
              <dt>
                {authorHref ? (
                  <AppLink href={authorHref}>{label}</AppLink>
                ) : detail.action === 'link' && detail.href ? (
                  <a href={detail.href} target="_blank" rel="noopener noreferrer">{label}</a>
                ) : label}
              </dt>
              <dd>
                {authorHref ? (
                  <AppLink href={authorHref}>{value}</AppLink>
                ) : detail.action === 'copy' ? (
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

      <dl className="contact-details">
        <div className="contact-details-row">
          <dt>
            <span className="contact-details-icon"><PanelsTopLeft size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>{tr({ zh: '应用平台', en: 'App platforms' })}</span>
          </dt>
          <dd className="contact-app-platform-list">
            {APP_PLATFORMS.map((platform) => (
              <span className="contact-app-platform-row" key={platform.label.en}>
                <span>{tr(platform.label)}</span>
                {platform.href ? (
                  <AppLink href={platform.href} className="contact-site">{tr(platform.value)}</AppLink>
                ) : (
                  <span className="contact-app-platform-value">{tr(platform.value)}</span>
                )}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </div>
  );
}
