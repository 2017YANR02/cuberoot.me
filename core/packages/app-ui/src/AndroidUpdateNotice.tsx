import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAndroidRelease, GOOGLE_PLAY_APP_URL, type AndroidRelease } from '@cuberoot/shared/android-release';
import type { InstalledAppHost } from './platform';

const messages = {
  zh: { title: '应用更新', check: '检查更新', checking: '正在检查…', current: '当前已是最新版本', failed: '暂时无法检查更新，请稍后重试。', download: '下载新版 APK', play: '前往 Google Play 更新', available: '发现新版本', help: '下载完成后打开 APK，按系统提示允许浏览器安装应用，再确认更新。请勿卸载旧版，以保留本地成绩。', openFailed: '无法打开下载，请稍后重试。' },
  en: { title: 'App updates', check: 'Check for updates', checking: 'Checking…', current: 'You are up to date', failed: 'Unable to check for updates. Please try again later.', download: 'Download new APK', play: 'Update on Google Play', available: 'Update available', help: 'Open the downloaded APK, allow installation from your browser if prompted, then confirm the update. Keep the existing app installed to preserve local solves.', openFailed: 'Unable to open the download. Please try again.' },
};

/** Native update controls beside the canonical account surface, without another account UI. */
export function AndroidUpdateNotice({ host, language }: { host: InstalledAppHost; language: 'zh' | 'en' }) {
  const copy = messages[language];
  const [info, setInfo] = useState<Awaited<ReturnType<NonNullable<InstalledAppHost['getAndroidUpdateInfo']>>> | null>(null);
  const [release, setRelease] = useState<AndroidRelease | null>(null);
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
        host.getAndroidUpdateInfo!(),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Update check timed out')), { once: true })),
      ]);
      if (pending.current !== controller) return;
      if (controller.signal.aborted) throw new Error('Update check timed out');
      setInfo(native);
      if (native.channel === 'play') { setRelease(null); setStatus('idle'); return; }
      const latest = await fetchAndroidRelease(controller.signal);
      if (pending.current !== controller) return;
      setRelease(latest.versionCode > native.versionCode ? latest : null);
      setStatus(latest.versionCode > native.versionCode ? 'idle' : 'current');
    } catch {
      if (pending.current === controller) { setRelease(null); setStatus('failed'); }
    } finally { clearTimeout(timeout); }
  }, [host]);
  useEffect(() => {
    if (host.getAndroidUpdateInfo) void check();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [check, host]);
  if (!host.getAndroidUpdateInfo) return null;
  const open = (url: string) => { void host.openExternal(url).catch(() => setStatus('openFailed')); };
  return <aside className="android-update-notice" aria-label={copy.title}>
    <div className="action-row">
      <span>{copy.title}{info ? ` · ${info.versionName} (${info.versionCode})` : ''}</span>
      {info?.channel === 'play'
        ? <button type="button" className="secondary-action" onClick={() => open(GOOGLE_PLAY_APP_URL)}>{copy.play}</button>
        : <button type="button" className="secondary-action" disabled={status === 'checking'} onClick={() => void check()}>{status === 'checking' ? copy.checking : copy.check}</button>}
    </div>
    <div role="status">
      {status === 'current' || status === 'failed' || status === 'openFailed' ? <p>{copy[status]}</p> : null}
      {release && info?.channel === 'direct' ? <>
        <p>{copy.available}: {release.versionName} ({release.versionCode})</p>
        <button type="button" className="primary-action" onClick={() => open(release.url)}>{copy.download}</button>
        <p>{copy.help}</p>
      </> : null}
    </div>
  </aside>;
}
