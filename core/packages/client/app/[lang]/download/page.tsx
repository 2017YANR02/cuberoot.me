'use client';

/** @module Official app downloads and platform availability. */
import { ArrowLeft, Download } from '@app-foundation/icons/lucide';
import { useEffect, useState } from 'react';
import { fetchAndroidRelease, type AndroidRelease } from '@cuberoot/shared/android-release';
import HomeLink from '@/components/HomeLink';
import HeaderToggles from '@/components/HeaderToggles';
import { tr, useLang } from '@/i18n/tr';
import { ANDROID_APK_URL, GOOGLE_PLAY_URL, trackDownload } from '@/lib/app-downloads';
import './download.css';

export default function DownloadPage() {
  const language = useLang();
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    void fetchAndroidRelease(controller.signal).then(setRelease).catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);
  const apkUrl = release?.url ?? ANDROID_APK_URL;
  return (
    <main className="download-page">
      <div className="download-nav">
        <HomeLink className="download-home"><ArrowLeft size={16} aria-hidden="true" />CubeRoot</HomeLink>
        <HeaderToggles />
      </div>
      <h1>{tr({ zh: '下载', en: 'Download' })}</h1>
      <div className="download-app">
        <img className="download-app-icon" src="/icons/icon-512.png" alt={tr({ zh: 'CubeRoot 应用图标', en: 'CubeRoot app icon' })} width={80} height={80} />
        <div>
          <p className="download-app-name">CubeRoot</p>
          <p className="download-app-description">{tr({ zh: '随时计时、训练，回顾每一次进步。', en: 'Time your solves, train, and review your progress.' })}</p>
        </div>
      </div>
      <section className="download-android" aria-labelledby="download-android-title">
        <h2 id="download-android-title">Android</h2>
        <div className="download-actions">
          <a className="download-play-badge" href={GOOGLE_PLAY_URL}
            onClick={() => trackDownload('play', language)}>
            <img src={tr({ zh: '/badges/google-play-zh-cn.png', en: '/badges/google-play-en.png' })}
              alt={tr({ zh: '在 Google Play 下载', en: 'Get it on Google Play' })} width={646} height={250} />
          </a>
          {apkUrl ? (
            <a className="download-button" href={apkUrl}
              onClick={() => trackDownload('apk', language)}>
              <Download size={16} aria-hidden="true" />{tr({ zh: '下载 APK', en: 'Download APK' })}
            </a>
          ) : (
            <button type="button" className="download-button" disabled aria-describedby="download-apk-status">
              <Download size={16} aria-hidden="true" />{tr({ zh: '下载 APK', en: 'Download APK' })}
            </button>
          )}
        </div>
        {apkUrl && <p className="download-note">
          {release ? `${release.versionName} (${release.versionCode}) · ` : ''}
          {tr({ zh: 'Android 8.0 及以上。官网 APK 与 Google Play 签名不同；Play 用户请继续通过 Play 更新，请勿卸载以免丢失本地记录。', en: 'Android 8.0 or later. This APK uses a different signing certificate from Google Play. Play users should update through Play; uninstalling can erase local records.' })}
        </p>}
        {!apkUrl && <p className="download-note" id="download-apk-status">
          {tr({ zh: 'APK 下载准备中，可先通过 Google Play 安装。', en: 'APK download is being prepared. Install through Google Play for now.' })}
        </p>}
      </section>
      <section className="download-upcoming" aria-label={tr({ zh: '其他平台', en: 'Other platforms' })}>
        {['Windows', 'iOS', 'macOS', 'HarmonyOS NEXT'].map((platform) => (
          <div className="download-platform" key={platform}>
            <span>{platform}</span><span>{tr({ zh: '即将发布', en: 'Coming soon' })}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
