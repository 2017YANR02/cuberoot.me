'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  CONTACT_DIRECT_DETAILS,
  CONTACT_SOCIAL_PLATFORMS,
  CONTACT_WEBSITE,
  CONTACT_WECHAT_QR_PATH,
  type ContactDirectDetailId,
  type ContactPlatformId,
  type ContactPlatform,
} from '@cuberoot/shared/contact';
import { SITE_CREATOR_PROFILE } from '@cuberoot/shared/site-directory';
import { Globe, Mail, Monitor, PanelsTopLeft, Smartphone, Users, User, Watch } from '@app-foundation/icons/lucide';
import { BrandIcon } from '@app-foundation/icons';
import { SiAndroid, SiApple, SiHarmonyos, SiTiktok } from 'react-icons/si';
import { RiMiniProgramLine } from 'react-icons/ri';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { Tooltip } from '@/components/Tooltip';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
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
function PhonePlatformIcon({ children }: { children: ReactNode }) {
  return <span className="contact-device-icon" aria-hidden="true">
    <Smartphone size={24} />
    <span className="contact-device-brand">{children}</span>
  </span>;
}

const APP_PLATFORMS = [
  { icon: <Globe size={24} />, label: { zh: '网站', en: 'Website' }, value: { zh: CONTACT_WEBSITE, en: CONTACT_WEBSITE }, href: '/', qr: '/contact/website-qr.png' },
  { icon: <RiMiniProgramLine size={24} />, label: { zh: '微信小程序', en: 'WeChat Mini Program' }, value: { zh: '魔方根', en: 'CubeRoot' }, href: null, qr: '/contact/wechat-miniprogram-qr.jpg' },
  { icon: <span className="contact-mini-icon"><RiMiniProgramLine size={24} /><SiTiktok size={10} /></span>, label: { zh: '抖音小程序', en: 'Douyin Mini Program' }, value: COMING_SOON, href: null },
  { icon: <PhonePlatformIcon><SiApple size={10} /></PhonePlatformIcon>, label: { zh: 'iOS App', en: 'iOS app' }, value: COMING_SOON, href: null },
  { icon: <Watch size={24} />, label: { zh: 'Apple Watch', en: 'Apple Watch' }, value: COMING_SOON, href: null },
  { icon: <PhonePlatformIcon><SiAndroid size={10} /></PhonePlatformIcon>, label: { zh: '安卓 App', en: 'Android app' }, value: COMING_SOON, href: null },
  { icon: <PhonePlatformIcon><SiHarmonyos size={10} /></PhonePlatformIcon>, label: { zh: '鸿蒙 App', en: 'HarmonyOS app' }, value: COMING_SOON, href: null },
  { icon: <Monitor size={24} />, label: { zh: 'Windows 客户端', en: 'Windows client' }, value: COMING_SOON, href: null },
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

function ContactDetailDialog({ title, icon, count, children, onClose }: {
  title: string; icon: ReactNode; count?: string; children: ReactNode; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const backdropProps = useModalBackdrop(onClose);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} className="contact-social-dialog"
      aria-labelledby={titleId} onCancel={onClose} {...backdropProps}>
      <div className="contact-social-panel" data-site-surface="popover">
      <ClearButton variant="standalone" className="contact-social-close"
        ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />
      <div className="contact-social-heading">
        <h2 id={titleId}>{icon}{title}</h2>
        {count && <span className="contact-platform-count">{count}</span>}
      </div>
      {children}
      </div>
    </dialog>
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
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<ContactPlatform | null>(null);
  const platforms = [...CONTACT_SOCIAL_PLATFORMS]
    .sort((a, b) => Number(b.language === lang) - Number(a.language === lang));

  return (
    <div className="contact-details-columns">
      <section>
          <h2 className="contact-column-heading">
            <span className="contact-details-icon"><PanelsTopLeft size={ICON_SIZE} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>{tr({ zh: '应用', en: 'Apps' })}</span>
          </h2>
          <div className="contact-app-platform-list">
            {APP_PLATFORMS.map((platform) => (
              <span className="contact-app-platform-row" key={platform.label.en}>
                <span className="contact-app-platform-label">
                  {platform.href ? (
                    <button type="button" className="contact-qr-trigger contact-social-logo" aria-haspopup="dialog"
                      aria-label={tr(platform.label)} onClick={() => setWebsiteOpen(true)}>
                      {platform.icon}
                    </button>
                  ) : 'qr' in platform ? (
                    <ContactQr
                      id={platform.href ? 'website-qr' : 'wechat-miniprogram-qr'}
                      src={platform.qr}
                      label={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                      alt={tr(platform.label) + tr({ zh: '二维码', en: ' QR code' })}
                    >{platform.icon}</ContactQr>
                  ) : (
                    <Tooltip content={`${tr(platform.label)} · ${tr(COMING_SOON)}`} openOnClick>
                      {(tip) => <button {...tip} type="button" className="contact-qr-trigger contact-coming-soon" aria-disabled="true" aria-label={`${tr(platform.label)} · ${tr(COMING_SOON)}`}>
                        {platform.icon}
                      </button>}
                    </Tooltip>
                  )}

                </span>
              </span>
            ))}
          </div>
          {websiteOpen && <ContactDetailDialog title={tr(APP_PLATFORMS[0].label)}
            icon={<Globe size={ICON_SIZE} aria-hidden="true" />} onClose={() => setWebsiteOpen(false)}>
            <img className="contact-qr" src={APP_PLATFORMS[0].qr}
              alt={tr({ zh: '魔方根网站二维码', en: 'CubeRoot website QR code' })} />
            <AppLink href={APP_PLATFORMS[0].href} className="contact-qr-link" onClick={() => setWebsiteOpen(false)}>
              {CONTACT_WEBSITE}
            </AppLink>
          </ContactDetailDialog>}
      </section>

      <section>
        <h2 className="contact-column-heading"><Users size={ICON_SIZE} aria-hidden="true" />{tr({ zh: '社交', en: 'Social' })}</h2>
        <div className="contact-social-details">
          {platforms.map(platform => (
            <button key={platform.id} type="button" className="contact-qr-trigger contact-social-logo"
              aria-label={tr(platform.label)} aria-haspopup="dialog" onClick={() => setSelectedPlatform(platform)}>
              {PLATFORM_ICONS[platform.id]}
            </button>
          ))}
        </div>
        {selectedPlatform && <ContactDetailDialog title={tr(selectedPlatform.label)} icon={PLATFORM_ICONS[selectedPlatform.id]}
          count={selectedPlatform.count ? tr(selectedPlatform.count) : undefined} onClose={() => setSelectedPlatform(null)}>
          {SOCIAL_QR_PATHS[selectedPlatform.id] && <img className="contact-qr" src={SOCIAL_QR_PATHS[selectedPlatform.id]}
            alt={tr(selectedPlatform.label) + tr({ zh: '二维码', en: ' QR code' })} />}
          {selectedPlatform.href && <a className="contact-qr-link" href={selectedPlatform.href} target="_blank" rel="noopener noreferrer">
            {tr({ zh: '打开主页 ↗', en: 'Open profile ↗' })}
          </a>}
        </ContactDetailDialog>}

      </section>
      <section>
        <h2 className="contact-column-heading"><Mail size={ICON_SIZE} aria-hidden="true" />{tr({ zh: '联系', en: 'Contact' })}</h2>
      <dl className="contact-details contact-direct-details">
        {CONTACT_DIRECT_DETAILS.map((detail) => {
          const value = detail.value ? tr(detail.value) : '';
          const authorHref = detail.id === 'author' ? SITE_CREATOR_PROFILE.href : null;
          const label = (
            <span className="contact-details-icon">{DIRECT_DETAIL_ICONS[detail.id]}</span>
          );
          return (
            <div
              key={detail.id}
              className={`contact-details-row${detail.action === 'link' || authorHref ? ' contact-details-link-row' : ''}`}
            >
              <dt>
                {detail.id === 'email' ? (
                  <button type="button" className="contact-qr-trigger contact-social-logo" aria-haspopup="dialog"
                    aria-label={tr(detail.label)} onClick={() => setSelectedEmail(value)}>
                    {DIRECT_DETAIL_ICONS.email}
                  </button>
                ) : authorHref ? (
                  <AppLink href={authorHref} aria-label={tr(detail.label)}>{label}</AppLink>
                ) : detail.action === 'link' && detail.href ? (
                  <a href={detail.href} aria-label={tr(detail.label)} target="_blank" rel="noopener noreferrer">{label}</a>
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
                {detail.showQr || detail.id === 'qq' || detail.id === 'email' || authorHref ? null : detail.action === 'copy' ? (
                  <CopyValueButton copyKey={detail.id} value={value} />
                ) : value}

              </dd>
            </div>
          );
        })}
      </dl>
      {selectedEmail && <ContactDetailDialog title={tr({ zh: '邮箱', en: 'Email' })} icon={DIRECT_DETAIL_ICONS.email}
        onClose={() => setSelectedEmail(null)}>
        <CopyValueButton copyKey="email" value={selectedEmail} />
      </ContactDetailDialog>}
      </section>
    </div>
  );
}
