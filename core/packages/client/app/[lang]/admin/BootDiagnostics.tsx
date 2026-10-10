'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

interface BootEvent {
  eventId: string;
  code: string;
  path: string;
  online: boolean | null;
  errorName: string;
  errorMessage: string;
  evidence: { source: string; name: string; message: string; url?: string }[];
  device: { browser: string; browserMajor: number | null; os: string; osMajor: number | null };
  receivedAt: string;
}

export default function BootDiagnostics() {
  const t = useT();
  const [events, setEvents] = useState<BootEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void fetch(apiUrl('/v1/app/boot-diagnostics?limit=50&v=2'), {
      headers: authHeaders(false), signal: controller.signal, cache: 'no-store',
    }).then(handleApi<{ events: BootEvent[] }>).then(result => {
      if (!controller.signal.aborted) setEvents(result.events);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [revision]);

  const browserNames: Record<string, string> = { wechat: t('微信', 'WeChat'), chrome: 'Chrome', edge: 'Edge', safari: 'Safari', firefox: 'Firefox', webview: 'WebView', other: t('其他浏览器', 'Other browser') };
  const osNames: Record<string, string> = { ios: 'iOS', android: 'Android', macos: 'macOS', windows: 'Windows', linux: 'Linux', other: t('其他系统', 'Other OS') };

  return (
    <section className="admin-boot" aria-labelledby="admin-boot-title">
      <div className="admin-boot__heading">
        <h2 id="admin-boot-title">{t('最近启动错误', 'Recent startup errors')}</h2>
        <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRevision(value => value + 1)}>
          {t('刷新', 'Refresh')}
        </button>
      </div>
      <p className="admin-hub__status">{t('自动收集的最近 50 条记录，保留 90 天。无需用户复制发送；同一编号可能对应多次错误，不代表某一位用户。', 'The latest 50 automatic reports, retained for 90 days. Users do not need to copy and send them. A code can match multiple errors and does not identify a user.')}</p>
      {loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
      {failed && <p role="alert">{t('错误记录加载失败，请刷新重试。', 'Could not load error reports. Refresh to retry.')}</p>}
      {!loading && !failed && events.length === 0 && <p>{t('暂无错误记录。', 'No error reports yet.')}</p>}
      {!loading && !failed && events.map(event => (
        <details key={event.eventId} className="admin-boot__event">
          <summary>
            <strong>{event.path}</strong>
            <span>{browserNames[event.device.browser] ?? event.device.browser} {event.device.browserMajor} · {osNames[event.device.os] ?? event.device.os} {event.device.osMajor}</span>
            <time dateTime={event.receivedAt}>{new Date(event.receivedAt).toLocaleString()}</time>
            <span>{event.errorName}: {event.errorMessage}</span>
          </summary>
          <p>{t('诊断编号', 'Diagnostic code')}: <code>{event.code}</code></p>
          <p>{t('网络状态', 'Network status')}: {event.online === null ? t('未知', 'Unknown') : event.online ? t('在线', 'Online') : t('离线', 'Offline')}</p>
          {event.evidence.map((item, index) => (
            <div key={index}>
              <p>{item.name}: {item.message}</p>
              {item.url && <p><code>{item.url}</code></p>}
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}
