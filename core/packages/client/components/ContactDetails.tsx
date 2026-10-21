'use client';

import { useId, type ReactNode } from 'react';
import {
  CONTACT_DIRECT_DETAILS,
  CONTACT_SOCIAL_PLATFORMS,
  CONTACT_WEBSITE,
  CONTACT_WECHAT_QR_PATH,
  type ContactDirectDetailId,
  type ContactPlatformId,
} from '@cuberoot/shared/contact';
import { SITE_CREATOR_PROFILE } from '@cuberoot/shared/site-directory';
import { Mail, PanelsTopLeft, QrCode, Users, User } from '@app-foundation/icons/lucide';
import { BrandIcon } from '@app-foundation/icons';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';
import AppLink from '@/components/AppLink';
import './ContactDetails.css';

const ICON_SIZE = 16;
const PLATFORM_ICONS: Record<ContactPlatformId, ReactNode> = {
  youtube: <BrandIcon name="youtube" size={ICON_SIZE} />,
  tiktok: <BrandIcon name="tiktok" size={ICON_SIZE} />,
  instagram: <BrandIcon name="instagram" size={ICON_SIZE} />,
  bilibili: <BrandIcon name="bilibili" size={ICON_SIZE} />,
  douyin: <BrandIcon name="douyin" size={ICON_SIZE} />,
  xiaohongshu: <BrandIcon name="xiaohongshu" size={ICON_SIZE} />,
  kuaishou: <BrandIcon name="kuaishou" size={ICON_SIZE} />,
  'wechat-official': <BrandIcon name="wechat" size={ICON_SIZE} />,
};
const DIRECT_DETAIL_ICONS: Record<ContactDirectDetailId, ReactNode> = {
  author: <User size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" />,
  wechat: <BrandIcon name="wechat" size={ICON_SIZE} />,
  qq: <BrandIcon name="qq" size={ICON_SIZE} />,
  email: <Mail size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" />,
  discord: <BrandIcon name="discord" size={ICON_SIZE} />,
};
const SOCIAL_QR_PATHS: Partial<Record<ContactPlatformId, string>> = {
  tiktok: '/contact/tiktok-qr.jpg',
  xiaohongshu: '/contact/xiaohongshu-qr.jpg',
  kuaishou: '/contact/kuaishou-qr.jpg',
  douyin: '/contact/douyin-qr.jpg',
  'wechat-official': '/contact/wechat-official-qr.jpg',
};
const COMING_SOON = { zh: '即将上线', en: 'Coming soon' } as const;
const APP_PLATFORMS = [
  { label: { zh: '网站', en: 'Website' }, value: { zh: CONTACT_WEBSITE, en: CONTACT_WEBSITE }, href: '/', qr: '/contact/website-qr.png' },
  { label: { zh: '微信小程序', en: 'WeChat Mini Program' }, value: { zh: '魔方根', en: 'CubeRoot' }, href: null, qr: '/contact/wechat-miniprogram-qr.jpg' },
  { label: { zh: '抖音小程序', en: 'Douyin Mini Program' }, value: COMING_SOON, href: null },
  { label: { zh: 'iOS App', en: 'iOS app' }, value: COMING_SOON, href: null },
  { label: { zh: 'Apple Watch', en: 'Apple Watch' }, value: COMING_SOON, href: null },
  { label: { zh: '安卓 App', en: 'Android app' }, value: COMING_SOON, href: null },
  { label: { zh: '鸿蒙 App', en: 'HarmonyOS app' }, value: COMING_SOON, href: null },
  { label: { zh: 'Windows 客户端', en: 'Windows client' }, value: COMING_SOON, href: null },
] as const;

function ContactQr({ id, src, label, alt, href, children }: { id: string; src: string; label: string; alt: string; href?: string; children: ReactNode }) {
  const popoverId = useId() + id;
  return (
    <>
      <button
        type="button"
        className="contact-qr-trigger"
        popoverTarget={popoverId}
        title={label}
        aria-label={label}
      >
        {children}
      </button>
      <div id={popoverId} className="contact-qr-popover" popover="auto">
        <img
          className="contact-qr"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
        {href && (
          <a className="contact-qr-link" href={href} target="_blank" rel="noopener noreferrer">
            {tr({ zh: '打开主页 ↗', en: 'Open profile ↗' })}
          </a>
        )}
      </div>
    </>
  );
}

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
      <section>
          <h2 className="contact-column-heading">
            <span className="contact-details-icon"><PanelsTopLeft size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>{tr({ zh: '应用平台', en: 'App platforms' })}</span>
          </h2>
          <div className="contact-app-platform-list">
            {APP_PLATFORMS.map((platform) => (
              <span className="contact-app-platform-row" key={platform.label.en}>
                <span className="contact-app-platform-label">
                  <span className="contact-qr-slot">
                  {platform.href && (
                    <ContactQr id="website-qr" src={platform.qr}
                      label={tr({ zh: '网站二维码', en: 'Website QR code' })}
                      alt={tr({ zh: '魔方根网站二维码', en: 'CubeRoot website QR code' })}
                    ><QrCode size={ICON_SIZE} color="var(--toggle-on)" strokeWidth={2} aria-hidden="true" /></ContactQr>
                  )}
                  </span>
                  {platform.href ? (
                    <AppLink href={platform.href}>{tr(platform.label)}</AppLink>
                  ) : 'qr' in platform ? (
                    <ContactQr
                      id={platform.href ? 'website-qr' : 'wechat-miniprogram-qr'}
                      src={platform.qr}
                      label={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                      alt={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                    >{tr(platform.label)}</ContactQr>
                  ) : tr(platform.label)}

                </span>
                <span className="contact-app-platform-value">{'qr' in platform ? null : tr(platform.value)}</span>
              </span>
            ))}
          </div>
      </section>

      <section>
        <h2 className="contact-column-heading"><Users size={ICON_SIZE} aria-hidden="true" />{tr({ zh: '社交平台', en: 'Social platforms' })}</h2>
      <dl className="contact-details contact-social-details">
        {platforms.map((platform) => (
          <div key={platform.id} className="contact-details-row contact-details-link-row">
            <dt>
              <span className="contact-qr-slot">
                {platform.href && SOCIAL_QR_PATHS[platform.id] && (
                  <ContactQr id={platform.id + '-qr'} src={SOCIAL_QR_PATHS[platform.id]!}
                    href={platform.href}
                    label={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                    alt={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                  ><QrCode size={ICON_SIZE} color="var(--toggle-on)" strokeWidth={2} aria-hidden="true" /></ContactQr>
                )}
              </span>
              {platform.href ? (
                <a href={platform.href} target="_blank" rel="noopener noreferrer">
                  <span className="contact-details-icon">{PLATFORM_ICONS[platform.id]}</span>
                  <span>{tr(platform.label)}</span>
                </a>
              ) : SOCIAL_QR_PATHS[platform.id] ? (
                <ContactQr
                  id={platform.id + '-qr'}
                  src={SOCIAL_QR_PATHS[platform.id]!}
                  href={platform.id === 'tiktok' ? platform.href ?? undefined : undefined}
                  label={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                  alt={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                >
                  <span className="contact-details-icon">{PLATFORM_ICONS[platform.id]}</span>
                  <span>{tr(platform.label)}</span>
                </ContactQr>

              ) : (
                <>
                  <span className="contact-details-icon">{PLATFORM_ICONS[platform.id]}</span>
                  <span>{tr(platform.label)}</span>
                </>
              )}

            </dt>
            <dd>
              <span className="contact-secondary-actions">
                {platform.count && <span className="contact-platform-count">{tr(platform.count)}</span>}

              </span>
            </dd>
          </div>
        ))}
      </dl>

      </section>
      <section>
        <h2 className="contact-column-heading"><Mail size={ICON_SIZE} aria-hidden="true" />{tr({ zh: '联系方式', en: 'Contact details' })}</h2>
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
                ) : detail.id === 'qq' ? (
                  <ContactQr
                    id="qq-qr"
                    src="/contact/qq-qr.jpg"
                    label={tr({ zh: '查看 QQ 二维码', en: 'View QQ QR code' })}
                    alt={tr({ zh: '魔方根 QQ 二维码', en: 'CubeRoot QQ QR code' })}
                  >{label}</ContactQr>
                ) : detail.showQr ? (
                  <ContactQr
                    id="wechat-qr"
                    src={CONTACT_WECHAT_QR_PATH}
                    label={tr({ zh: '查看微信二维码', en: 'View WeChat QR code' })}
                    alt={tr({ zh: '魔方根微信二维码', en: 'WeChat QR code for Ruimin Yan' })}
                  >{label}</ContactQr>
                ) : label}
              </dt>
              <dd>
                {detail.showQr || detail.id === 'qq' || authorHref ? null : detail.action === 'copy' ? (
                  <CopyValueButton copyKey={detail.id} value={value} />
                ) : value}

              </dd>
            </div>
          );
        })}
      </dl>
      </section>
    </div>
  );
}
