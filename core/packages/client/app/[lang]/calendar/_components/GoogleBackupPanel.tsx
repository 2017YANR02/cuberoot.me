'use client';

import { useEffect, useRef, useState } from 'react';
import BoolToggle from '@/components/BoolToggle';
import { fetchAuthProviders } from '@/lib/account-api';
import { loadGis, requestGoogleAccessToken } from '@/lib/google-auth';
import { exportGoogleCalendars, googleBackupFile, listGoogleCalendars, GOOGLE_CALENDAR_SCOPE,
  type GoogleCalendarEntry } from '@/lib/google-calendar-backup';
import { tr } from '@/i18n/tr';

export default function GoogleBackupPanel({ disabled, onFile }: { disabled: boolean; onFile: (file: File) => void }) {
  const [clientId, setClientId] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<GoogleCalendarEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const token = useRef('');
  const job = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    void fetchAuthProviders().then(async p => {
      if (!active) return;
      if (!p.googleClientId) { setError(tr({ zh: 'Google 导出尚未配置，请稍后重试。', en: 'Google export is not configured yet. Please try again later.' })); return; }
      setClientId(p.googleClientId);
      await loadGis();
      if (active) setReady(true);
    }).catch(() => { if (active) setError(tr({ zh: 'Google 连接加载失败，请重新打开设置重试。', en: 'Could not load Google. Reopen settings to retry.' })); });
    return () => { active = false; job.current?.abort(); token.current = ''; };
  }, []);

  const reportError = (e: unknown) => {
    if (e instanceof Error && e.name === 'AbortError') return;
    const code = e instanceof Error ? e.message : '';
    setError(code === 'calendar_permission_denied'
      ? tr({ zh: '需要勾选只读日历权限才能导出。', en: 'Grant read-only calendar access to export.' })
      : code === 'google_changed_during_export'
        ? tr({ zh: '导出期间日历发生了变化，请重试；尚未生成备份。', en: 'The calendar changed during export. Retry; no backup was created.' })
        : tr({ zh: '导出未完成，请重连 Google 后重试。请确认已允许只读访问，且当前网络可以访问 Google。', en: 'Export did not finish. Reconnect and retry with read-only access and a network that can reach Google.' }));
  };
  const connect = async () => {
    const controller = new AbortController(); job.current = controller;
    setBusy(true); setError(''); setFile(null); setEntries([]); setProgress(''); token.current = '';
    try {
      const accessToken = await requestGoogleAccessToken(clientId, GOOGLE_CALENDAR_SCOPE);
      if (controller.signal.aborted) return;
      token.current = accessToken;
      const calendars = await listGoogleCalendars(accessToken, controller.signal);
      setEntries(calendars);
      setSelected(calendars.filter(c => c.primary || c.accessRole === 'owner').map(c => c.id));
    } catch (e) { if (!controller.signal.aborted) reportError(e); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const download = (f: File) => {
    const url = URL.createObjectURL(f), a = document.createElement('a');
    a.href = url; a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const exportFile = async () => {
    const controller = new AbortController(); job.current = controller;
    setBusy(true); setError('');
    try {
      const backup = await exportGoogleCalendars(token.current, entries.filter(c => selected.includes(c.id)), controller.signal,
        (done, total) => setProgress(tr({ zh: `正在读取日历 ${done}/${total}…`, en: `Reading calendars ${done}/${total}…` })));
      if (controller.signal.aborted) return;
      const f = googleBackupFile(backup);
      setFile(f); download(f);
      setProgress(tr({ zh: '备份已生成，可以下载或导入本站。', en: 'Backup is ready to download or import.' }));
      token.current = ''; setEntries([]);
    } catch (e) { if (!controller.signal.aborted) reportError(e); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="cal-google-backup" aria-label={tr({ zh: 'Google 完整备份', en: 'Google backup' })}>
    <h4>{tr({ zh: 'Google 日历：带颜色导出', en: 'Google Calendar: export with colors' })}</h4>
    <p className="cal-pop-hint">{tr({ zh: '只读授权 → 选择日历 → 下载备份包。保留 Google 返回的原始日程、颜色和标签、重复规则、提醒、参与人、会议链接及附件信息。', en: 'Read-only permission → choose calendars → download a backup. Keeps original events, colors and labels, recurrence, reminders, attendees, conference links and attachment metadata returned by Google.' })}</p>
    <button type="button" className="cal-btn" disabled={!ready || busy || disabled} onClick={() => void connect()}>
      {tr({ zh: '连接 Google（只读）', en: 'Connect Google (read-only)' })}
    </button>
    {entries.length > 0 && <>
      <div className="cal-google-calendars">{entries.map(c => <BoolToggle key={c.id} value={selected.includes(c.id)}
        label={c.summaryOverride || c.summary || c.id} disabled={busy}
        onChange={on => setSelected(s => on ? [...s, c.id] : s.filter(id => id !== c.id))} />)}</div>
      <button type="button" className="cal-btn" disabled={busy || disabled || selected.length === 0} onClick={() => void exportFile()}>
        {tr({ zh: '下载带颜色备份', en: 'Download backup with colors' })}
      </button>
    </>}
    {busy && <button type="button" className="cal-btn" onClick={() => { job.current?.abort(); token.current = ''; setBusy(false); setEntries([]); setProgress(''); }}>
      {tr({ zh: '取消', en: 'Cancel' })}
    </button>}
    {progress && <p role="status" className="cal-pop-hint">{progress}</p>}
    {error && <p role="alert" className="cal-pop-hint">{error}</p>}
    {file && <div className="cal-pop-actions">
      <button type="button" className="cal-btn" onClick={() => download(file)}>{tr({ zh: '再次下载', en: 'Download again' })}</button>
      <button type="button" className="cal-btn" disabled={disabled} onClick={() => onFile(file)}>{tr({ zh: '预览并导入这个备份', en: 'Preview and import this backup' })}</button>
    </div>}
    <p className="cal-pop-hint">{tr({ zh: '附件仅保留信息和链接，不下载文件本体；不含 Google Tasks、共享权限、无权读取或已永久删除的数据。授权令牌仅临时保留在此页面，关闭后清除；不会上传到本站服务器。', en: 'Attachments include metadata and links, not file contents. Excludes Google Tasks, sharing permissions, inaccessible or permanently deleted data. The access token stays temporarily in this page, is cleared on close and is never sent to CubeRoot servers.' })}</p>
  </section>;
}
