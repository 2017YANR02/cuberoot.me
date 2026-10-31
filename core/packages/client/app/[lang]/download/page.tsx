'use client';

/** @module Official app downloads and platform availability. */
import { ChevronDown, Download, Monitor, PackageCheck, Smartphone } from '@app-foundation/icons/lucide';
import { useEffect, useState } from 'react';
import { fetchAndroidRelease, fetchWindowsRelease, type AndroidRelease, type WindowsRelease } from '@cuberoot/shared/android-release';
import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import { Tooltip } from '@/components/Tooltip';
import { tr, useLang } from '@/i18n/tr';
import { ANDROID_APK_URL, GOOGLE_PLAY_URL, trackDownload } from '@/lib/app-downloads';
import { useIsAdmin } from '@/lib/auth-store';
import './download.css';

export default function DownloadPage() {
  const language = useLang();
  const isAdmin = useIsAdmin();
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
      <div className="download-platforms">
        <section className="download-platform-section" aria-labelledby="download-android-title">
          <Smartphone className="download-platform-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="download-android-title">Android</h2>
          <p className="download-requirement">{tr({ zh: 'Android 8.0 及以上', en: 'Android 8.0 or later' })}</p>
          <div className="download-primary-action">
            <a className="download-play-badge" href={GOOGLE_PLAY_URL} onClick={() => trackDownload('play', language)}>
              <img src={tr({ zh: '/badges/google-play-zh-cn.png', en: '/badges/google-play-en.png' })}
                alt={tr({ zh: '在 Google Play 下载', en: 'Get it on Google Play' })} width={646} height={250} />
            </a>
          </div>
          <div className="download-alternative">
            {apkUrl && <a className="download-text-link" href={apkUrl} onClick={() => trackDownload('apk', language)}>
              <Download size={16} aria-hidden="true" />{tr({ zh: '直接下载 APK', en: 'Download APK directly' })}
            </a>}
            {release && <span className="download-version">{tr({ zh: '官网版', en: 'Direct download' })} {release.versionName}</span>}
          </div>
          <p className="download-note">{tr({ zh: 'Google Play 用户请继续通过 Play 更新。', en: 'For Google Play installations, update through Play.' })}</p>
          <details className="download-details">
            <summary><ChevronDown className="download-details-icon" size={16} aria-hidden="true" />{tr({ zh: '安装与更新说明', en: 'Installation & updates' })}</summary>
            <p>{tr({ zh: '官网 APK 与 Google Play 使用不同签名，不能互相覆盖安装。不要为切换渠道卸载应用，以免丢失本地记录。', en: 'The website APK and Google Play use different signing certificates and cannot update each other. Uninstalling to switch channels can erase local records.' })}</p>
            {release && <p>{tr({ zh: 'APK 构建号', en: 'APK build' })}: {release.versionCode}</p>}
          </details>
        </section>
        <section className="download-platform-section" aria-labelledby="download-windows-title">
          <Monitor className="download-platform-icon" size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="download-windows-title">Windows</h2>
          <p className="download-requirement">{tr({ zh: '64 位（x64）', en: '64-bit (x64)' })}</p>
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
          <p className="download-note">{tr({ zh: '当前版本未签名，Windows 可能显示安全提示。', en: 'This release is unsigned. Windows may show a security warning.' })}</p>
          <details className="download-details">
            <summary><ChevronDown className="download-details-icon" size={16} aria-hidden="true" />{tr({ zh: '安装版与免安装版', en: 'Installer or standalone EXE?' })}</summary>
            <p>{tr({ zh: '推荐使用安装版。免安装版无需安装应用，但需要电脑已安装 Microsoft Edge WebView2。', en: 'The installer is recommended. The standalone EXE runs without installing the app, but requires Microsoft Edge WebView2 on your PC.' })}</p>
          </details>
        </section>
      </div>
      <section className="download-upcoming" aria-labelledby="download-upcoming-title">
        <h2 id="download-upcoming-title">{tr({ zh: '更多平台', en: 'More platforms' })}</h2>
        <p><span>iOS · macOS · HarmonyOS NEXT</span><span className="download-version">{tr({ zh: '暂未发布', en: 'Not yet available' })}</span></p>
      </section>
    </main>
  );
}
