'use client';

import { useEffect } from 'react';
import { ArrowRight, ExternalLink, QrCode } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { resolvePlatformQrLanding, type PlatformQrLink } from '@/lib/platform-qr-landing';
import type { PlatformEntity } from '@/lib/platform-types';
import styles from './PlatformQrLanding.module.css';

function QrLandingLink({ item, primary }: { item: PlatformQrLink; primary: boolean }) {
  const content = (
    <>
      <span>
        <strong>{item.label}</strong>
        {item.note ? <small>{item.note}</small> : null}
      </span>
      {item.href.startsWith('/') ? <ArrowRight aria-hidden /> : <ExternalLink aria-hidden />}
    </>
  );
  const className = primary ? styles.primaryLink : styles.link;
  return item.href.startsWith('/')
    ? <AppLink className={className} href={item.href} prefetch={false}>{content}</AppLink>
    : <a className={className} href={item.href} target="_blank" rel="noreferrer">{content}</a>;
}

export function PlatformQrLanding({ entity, previewRedirect = false }: {
  entity: PlatformEntity;
  previewRedirect?: boolean;
}) {
  const t = useT();
  const data = entity.data ?? {};
  const code = typeof data.code === 'string' ? data.code.trim() : entity.id;
  const defaultLinks = [
    { label: t('立即体验', 'Start exploring'), href: '/' },
    { label: t('进入社群', 'Join the community'), href: '/community' },
  ];
  const landing = resolvePlatformQrLanding(data, {
    english: t('zh', 'en') === 'en',
    defaultTitle: t('欢迎来到 CubeRoot', 'Welcome to CubeRoot'),
    defaultIntro: t('这里汇集了与这枚二维码相关的内容和下一步入口。', 'Find the content and next steps connected to this QR code.'),
    defaultLinks,
  });

  useEffect(() => {
    if (landing.mode === 'redirect' && !previewRedirect && landing.target) {
      window.location.replace(landing.target);
    }
  }, [landing.mode, landing.target, previewRedirect]);

  if (landing.mode === 'disabled') {
    return (
      <section className={styles.root} aria-labelledby="platform-qr-disabled-title">
        <QrCode className={styles.mark} aria-hidden />
        <p className={styles.eyebrow}>{t('二维码已停用', 'QR code disabled')}</p>
        <h2 id="platform-qr-disabled-title">{t('这个入口暂时不可用', 'This destination is temporarily unavailable')}</h2>
        <p>{t('二维码本身有效，但管理员已经暂停了它。你仍可返回 CubeRoot 继续浏览。', 'The code is valid, but its owner has paused it. You can still return to CubeRoot.')}</p>
        <AppLink className={styles.homeLink} href="/" prefetch={false}>{t('返回首页', 'Go to the homepage')}<ArrowRight aria-hidden /></AppLink>
      </section>
    );
  }

  if (landing.mode === 'redirect' && !previewRedirect) {
    return <p className={styles.redirecting} role="status">{t('正在打开二维码目标…', 'Opening the QR destination…')}</p>;
  }

  const links = landing.mode === 'redirect' && previewRedirect && landing.target
    ? [{ label: t('打开实际目标', 'Open actual destination'), href: landing.target }, ...landing.links]
    : landing.links;

  return (
    <section className={styles.root} aria-labelledby="platform-qr-landing-title">
      <div className={styles.heading}>
        <QrCode className={styles.mark} aria-hidden />
        <div>
          <p className={styles.eyebrow}>{previewRedirect && landing.mode === 'redirect' ? t('跳转页预览', 'Redirect preview') : t('二维码入口', 'QR destination')}</p>
          <h2 id="platform-qr-landing-title">{landing.title}</h2>
        </div>
      </div>
      <p className={styles.intro}>{landing.intro}</p>
      {landing.term ? <p className={styles.term}>{landing.term}</p> : null}
      <nav className={styles.links} aria-label={t('相关入口', 'Related destinations')}>
        {links.map((item, index) => <QrLandingLink key={`${item.href}-${index}`} item={item} primary={index === 0} />)}
      </nav>
      <p className={styles.code}>code: {code}</p>
    </section>
  );
}
