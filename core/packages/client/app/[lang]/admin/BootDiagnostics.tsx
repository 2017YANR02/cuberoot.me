'use client';

import MoreToggle from '@/components/MoreToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { HelpCircle } from '@app-foundation/icons/lucide';
import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { LoadingIndicator } from '@/components/LoadingIndicator';

interface BootEvent {
  eventId: string;
  kind: string;
  path: string;
  online: boolean | null;
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
    void sessionFetch(apiUrl('/v1/app/boot-diagnostics?limit=50&v=2'), {
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

  const kinds: Record<string, string> = {
    network: t('网络连接失败', 'Network connection failed'), chunk: t('页面资源加载失败', 'Page resources failed to load'),
    script: t('页面脚本出错', 'Page script failed'), promise: t('后台任务出错', 'Background task failed'),
    timeout: t('启动超时', 'Startup timed out'), runtime: t('页面运行出错', 'Page failed to run'),
  };
  const browserNames: Record<string, string> = { wechat: t('微信', 'WeChat'), chrome: 'Chrome', edge: 'Edge', safari: 'Safari', firefox: 'Firefox', webview: 'WebView', other: t('其他浏览器', 'Other browser') };
  const osNames: Record<string, string> = { ios: 'iOS', android: 'Android', macos: 'macOS', windows: 'Windows', linux: 'Linux', other: t('其他系统', 'Other OS') };

  return (
    <details className="admin-monitoring__disclosure admin-monitoring__boot">
      <MoreToggle as="summary">{t('最近启动错误', 'Recent startup errors')}</MoreToggle>
      <div className="admin-boot__heading">
        <InfoTooltip icon={HelpCircle} iconSize={16} ariaLabel={t('启动错误说明', 'About startup errors')} content={t('自动收集最近 50 条记录，保留 90 天。', 'The latest 50 automatic reports, retained for 90 days.')} />
        <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRevision(value => value + 1)}>
          {t('刷新', 'Refresh')}
        </button>
      </div>
      {loading && <p role="status"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p>}
      {failed && <p role="alert">{t('错误记录加载失败，请刷新重试。', 'Could not load error reports. Refresh to retry.')}</p>}
      {!loading && !failed && events.length === 0 && <p>{t('暂无错误记录。', 'No error reports yet.')}</p>}
      {!loading && !failed && events.map(event => (
        <details key={event.eventId} className="admin-boot__event">
          <MoreToggle as="summary">
            <strong>{event.path}</strong>
            <span>{browserNames[event.device.browser] ?? browserNames.other} {event.device.browserMajor} · {osNames[event.device.os] ?? osNames.other} {event.device.osMajor}</span>
            <time dateTime={event.receivedAt}>{new Date(event.receivedAt).toLocaleString()}</time>
            <span>{kinds[event.kind] ?? t('启动失败', 'Startup failed')}</span>
          </MoreToggle>
          <p>{t('网络状态', 'Network status')}: {event.online === null ? t('未知', 'Unknown') : event.online ? t('在线', 'Online') : t('离线', 'Offline')}</p>
        </details>
      ))}
    </details>
  );
}
