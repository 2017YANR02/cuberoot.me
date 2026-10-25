import { useCallback, useEffect, useRef, useState } from 'react';
import { compareReleaseVersions, fetchAndroidRelease, fetchWindowsRelease, GOOGLE_PLAY_APP_URL, type AndroidRelease, type WindowsRelease } from '@cuberoot/shared/android-release';
import type { InstalledAppHost } from './platform';

const messages = {
  zh: { title: '应用更新', check: '检查更新', checking: '正在检查…', current: '当前已是最新版本', failed: '暂时无法检查更新，请稍后重试。', download: '下载新版 APK', play: '前往 Google Play 更新', available: '发现新版本', help: '下载完成后打开 APK，按系统提示允许浏览器安装应用，再确认更新。请勿卸载旧版，以保留本地成绩。', openFailed: '无法打开下载，请稍后重试。' },
  en: { title: 'App updates', check: 'Check for updates', checking: 'Checking…', current: 'You are up to date', failed: 'Unable to check for updates. Please try again later.', download: 'Download new APK', play: 'Update on Google Play', available: 'Update available', help: 'Open the downloaded APK, allow installation from your browser if prompted, then confirm the update. Keep the existing app installed to preserve local solves.', openFailed: 'Unable to open the download. Please try again.' },
};

/** Native update controls beside the canonical account surface, without another account UI. */
export function InstalledUpdateNotice({ host, language }: { host: InstalledAppHost; language: 'zh' | 'en' }) {
  const copy = messages[language];
  const [info, setInfo] = useState<({ platform: 'android' } & Awaited<ReturnType<NonNullable<InstalledAppHost['getAndroidUpdateInfo']>>>) | { platform: 'windows'; versionName: string } | null>(null);
  const [release, setRelease] = useState<AndroidRelease | WindowsRelease | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'current' | 'failed' | 'openFailed'>('idle');
  const pending = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setStatus('checking');
    try {
      const native = await Promise.race([
        host.getAndroidUpdateInfo ? host.getAndroidUpdateInfo().then(value => ({ ...value, platform: 'android' as const }))
          : host.getWindowsUpdateInfo!().then(value => ({ ...value, platform: 'windows' as const })),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Update check timed out')), { once: true })),
      ]);
      if (pending.current !== controller) return;
      if (controller.signal.aborted) throw new Error('Update check timed out');
      setInfo(native);
      if (native.platform === 'android' && native.channel === 'play') { setRelease(null); setStatus('idle'); return; }
      const latest = native.platform === 'windows' ? await fetchWindowsRelease(controller.signal) : await fetchAndroidRelease(controller.signal);
      if (pending.current !== controller) return;
      const newer = native.platform === 'windows' ? compareReleaseVersions(latest.versionName, native.versionName) > 0 : latest.versionCode > native.versionCode;
      setRelease(newer ? latest : null);
      setStatus(newer ? 'idle' : 'current');
    } catch {
      if (pending.current === controller) { setRelease(null); setStatus('failed'); }
    } finally { clearTimeout(timeout); }
  }, [host]);
  useEffect(() => {
    if (host.getAndroidUpdateInfo || host.getWindowsUpdateInfo) void check();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [check, host]);
  if (!host.getAndroidUpdateInfo && !host.getWindowsUpdateInfo) return null;
  const open = (url: string) => { void host.openExternal(url).catch(() => setStatus('openFailed')); };
  return <aside className="android-update-notice" aria-label={copy.title}>
    <div className="action-row">
      <span>{copy.title}{info ? ` · ${info.versionName}${info.platform === 'android' ? ` (${info.versionCode})` : ''}` : ''}</span>
      {info?.platform === 'android' && info.channel === 'play'
        ? <button type="button" className="secondary-action" onClick={() => open(GOOGLE_PLAY_APP_URL)}>{copy.play}</button>
        : <button type="button" className="secondary-action" disabled={status === 'checking'} onClick={() => void check()}>{status === 'checking' ? copy.checking : copy.check}</button>}
    </div>
    <div role="status">
      {status === 'current' || status === 'failed' || status === 'openFailed' ? <p>{copy[status]}</p> : null}
      {release && 'channel' in release && info?.platform === 'android' && info.channel === 'direct' ? <>
        <p>{copy.available}: {release.versionName} ({release.versionCode})</p>
        <button type="button" className="primary-action" onClick={() => open(release.url)}>{copy.download}</button>
        <p>{copy.help}</p>
      </> : null}
      {release && 'files' in release && info?.platform === 'windows' ? <>
        <p>{copy.available}: {release.versionName}</p>
        <div className="action-row">
          <button type="button" className="primary-action" onClick={() => open(release.files.installer.url)}>{windowsCopy[language].installer}</button>
          <button type="button" className="secondary-action" onClick={() => open(release.files.portable.url)}>{windowsCopy[language].portable}</button>
        </div>
        <p>{windowsCopy[language].help}</p>
      </> : null}
    </div>
  </aside>;
}

const windowsCopy = {
  zh: { installer: '下载安装版', portable: '下载免安装版', help: '安装版运行新安装程序即可更新。免安装版请退出应用后替换 EXE；保留应用数据目录以保留本地成绩。' },
  en: { installer: 'Download installer', portable: 'Download standalone EXE', help: 'Run the new installer to update. For the standalone version, exit the app before replacing the EXE. Keep the app data folder to preserve local solves.' },
};
// Preserve the existing public component name for consumers and Android regression coverage.
export const AndroidUpdateNotice = InstalledUpdateNotice;
