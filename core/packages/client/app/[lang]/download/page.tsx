'use client';

/** @module Official app downloads and platform availability. */
import { Download, Laptop, PackageCheck, Smartphone } from '@app-foundation/icons/lucide';
import { FaWindows } from 'react-icons/fa';
import { SiAndroid } from 'react-icons/si';
import { useEffect, useState } from 'react';
import { fetchAndroidRelease, fetchWindowsRelease, type AndroidRelease, type WindowsRelease } from '@cuberoot/shared/android-release';
import { detectClientEnvironment, type ClientOS } from '@/lib/bluetooth/env';
import MoreToggle from '@/components/MoreToggle';
import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import { Tooltip } from '@/components/Tooltip';
import { tr, useLang } from '@/i18n/tr';
import { ANDROID_APK_URL, APP_STORE_URL, GOOGLE_PLAY_URL, MAC_APP_STORE_NATIVE_URL, MAC_APP_STORE_WEB_URL, trackDownload } from '@/lib/app-downloads';
import { useIsAdmin } from '@/lib/auth-store';
import './download.css';

export default function DownloadPage() {
  const language = useLang();
  const isAdmin = useIsAdmin();
  const [deviceOS, setDeviceOS] = useState<ClientOS>('unknown');
  useEffect(() => { setDeviceOS(detectClientEnvironment().os); }, []);
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [windows, setWindows] = useState<WindowsRelease | null>(null);
  const [windowsFailed, setWindowsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setWindowsFailed(false);
    void Promise.allSettled([
      fetchAndroidRelease(controller.signal).then(value => { if (active) setRelease(value); }),
      fetchWindowsRelease(controller.signal).then(value => { if (active) setWindows(value); })
        .catch(() => { if (active) setWindowsFailed(true); }),
    ]).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [attempt]);
  const apkUrl = release?.url ?? ANDROID_APK_URL;
  const platforms = [
    ...([
      { id: 'ios', name: 'iOS', devices: 'iPhone · iPad · Apple Watch', version: '1.0.1', Icon: Smartphone, href: `${APP_STORE_URL}?platform=iphone`, badge: 'app-store', store: 'App Store' },
      { id: 'macos', name: 'macOS', devices: 'Mac', version: '0.1.1', Icon: Laptop, href: deviceOS === 'macos' ? MAC_APP_STORE_NATIVE_URL : MAC_APP_STORE_WEB_URL, badge: 'mac-app-store', store: 'Mac App Store' },
    ] as const).map(({ id, name, devices, version, Icon, href, badge, store }) => (
      <section key={id} className="download-platform-section" data-site-surface="panel" aria-labelledby={`download-${id}-title`}>
        <header className="download-platform-header">
          <Icon className="download-platform-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h2 id={`download-${id}-title`}>{name}</h2>
            <p className="download-requirement">{devices}</p>
          </div>
        </header>
        <div className="download-primary-action">
          <a className="download-apple-badge" href={href}>
            <img src={`/badges/${badge}-${language === 'zh' ? 'zh-cn' : 'en-us'}.svg`}
              alt={tr({ zh: `在 ${store} 下载`, en: `Download on the ${store}` })} />
          </a>
        </div>
        <div className="download-alternative">
          {id === 'macos' && deviceOS === 'macos' && <a className="download-text-link" href={MAC_APP_STORE_WEB_URL}>
            {tr({ zh: '查看网页版', en: 'View on the web' })}
          </a>}
          <span className="download-version">{tr({ zh: '版本', en: 'Version' })} {version}</span>
        </div>
      </section>
    )),
    <section key="android" className="download-platform-section" data-site-surface="panel" aria-labelledby="download-android-title">
      <header className="download-platform-header">
        <SiAndroid className="download-platform-icon" size={28} aria-hidden="true" />
        <div>
          <h2 id="download-android-title">Android</h2>
          <p className="download-requirement">{tr({ zh: 'Android 8.0 及以上', en: 'Android 8.0 or later' })}</p>
        </div>
      </header>
      <div className="download-primary-action">
        <a className="download-play-badge" lang={language} href={GOOGLE_PLAY_URL} onClick={() => trackDownload('play', language)}>
          <img src={tr({ zh: '/badges/google-play-zh-cn.png', en: '/badges/google-play-en.png' })}
            alt={tr({ zh: '在 Google Play 下载', en: 'Get it on Google Play' })} width={646} height={250} />
        </a>
      </div>
      <div className="download-alternative">
        {apkUrl && <a className="download-text-link" href={apkUrl} onClick={() => trackDownload('apk', language)}>
          <Download size={16} aria-hidden="true" />{tr({ zh: '下载 APK', en: 'Download APK' })}
        </a>}
        {release && <span className="download-version">{tr({ zh: 'APK 版本', en: 'APK version' })} {release.versionName}</span>}
      </div>
    </section>,
    <section key="windows" className="download-platform-section" data-site-surface="panel" aria-labelledby="download-windows-title">
      <header className="download-platform-header">
        <FaWindows className="download-platform-icon" size={28} aria-hidden="true" />
        <div>
          <h2 id="download-windows-title">Windows</h2>
          <p className="download-requirement">{tr({ zh: '64 位（x64）', en: '64-bit (x64)' })}</p>
        </div>
      </header>
      <div className="download-primary-action">
        {windows ? <a className="download-button download-button-primary" href={windows.files.installer.url} onClick={() => trackDownload('windows-installer', language)}>
          <Download size={18} aria-hidden="true" />{tr({ zh: '下载 Windows 版', en: 'Download for Windows' })}
        </a> : <button className="download-button download-button-primary" type="button" disabled>
          {tr({ zh: '下载 Windows 版', en: 'Download for Windows' })}
        </button>}
      </div>
      <div className="download-alternative" aria-live="polite">
        {windows ? <>
          <a className="download-text-link" href={windows.files.portable.url} onClick={() => trackDownload('windows-portable', language)}>
            <Download size={16} aria-hidden="true" />{tr({ zh: '下载免安装版', en: 'Download standalone EXE' })}
          </a>
          <span className="download-version">{tr({ zh: '版本', en: 'Version' })} {windows.versionName}</span>
        </> : windowsFailed ? <>
          <span className="download-version">{tr({ zh: '暂时无法获取下载信息', en: 'Download information is unavailable' })}</span>
          <button className="download-text-link" type="button" onClick={() => setAttempt(value => value + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button>
        </> : <span className="download-version">{tr({ zh: '正在获取版本信息…', en: 'Loading release information…' })}</span>}
      </div>
    </section>,
  ];
  const preferred = platforms.find(card => card.key === deviceOS);
  return (
    <main className="download-page">
      <div className="download-nav">
        <BackHome />
        {isAdmin && <Tooltip content={tr({ zh: '版本管理', en: 'Release management' })}>{tip => (
          <AppLink {...tip} className="theme-toggle-inline download-settings" href="/admin/releases" prefetch={false}
            aria-label={tr({ zh: '版本管理', en: 'Release management' })}>
            <PackageCheck size={22} aria-hidden="true" />
          </AppLink>
        )}</Tooltip>}
      </div>
      <header className="download-app">
        <img className="download-app-icon" src="/icons/icon-512.png" alt="" width={72} height={72} />
        <div>
          <h1>{tr({ zh: '下载 CubeRoot', en: 'Download CubeRoot' })}</h1>
          <p className="download-app-description">{tr({ zh: '计时、训练，记录每一次进步。', en: 'Time your solves. Train. Track your progress.' })}</p>
        </div>
      </header>
      <div className={preferred ? "download-device-first" : "download-platforms"}>
        {preferred ? <>
          {preferred}
          <details className="download-other">
            <MoreToggle as="summary">{tr({ zh: '其他平台下载', en: 'Downloads for other platforms' })}</MoreToggle>
            <div className="download-platforms">{platforms.filter(card => card.key !== deviceOS)}</div>
          </details>
        </> : platforms}
      </div>
      <section className="download-upcoming" aria-labelledby="download-upcoming-title">
        <h2 id="download-upcoming-title">{tr({ zh: '更多平台', en: 'More platforms' })}</h2>
        <p><span className="download-upcoming-platforms"><span>HarmonyOS NEXT</span></span><span className="download-version">{tr({ zh: '暂未发布', en: 'Not yet available' })}</span></p>
      </section>
    </main>
  );
}
