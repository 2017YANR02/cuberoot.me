'use client';
import './timer-data-settings.css';
import { useEffect, useRef, useState } from 'react';
import { MAX_TIMER_BACKUP_BYTES, TIMER_EVENT_PICKER_GROUPS, eventInfo, type EventId } from '@cuberoot/shared/timer';
import { planTimerImport, type TimerImportSession, type TimerImportPlan } from '@cuberoot/shared/timer/import-timer';
import { parseCstimerExport } from '@cuberoot/shared/timer/import-cstimer';
import { TimerPuzzlePicker } from './TimerPuzzlePicker';

export interface TimerImportSettingsProps {
  language: 'en' | 'zh';
  disabled?: boolean;
  importBackup(text: string, canCommit: () => boolean): Promise<boolean>;
  importSessions(sessions: TimerImportPlan['sessions'], canCommit: () => boolean): Promise<void>;
}

export function TimerImportSettings({ language, disabled = false, importBackup, importSessions }: TimerImportSettingsProps) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const assertActive = () => { if (!alive.current) throw new Error('Import cancelled'); };
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<TimerImportSession[] | null>(null);
  const [targets, setTargets] = useState<Record<string, EventId>>({});
  const [message, setMessage] = useState('');
  const plan = planTimerImport(sessions ?? [], targets);
  const append = async (items: TimerImportSession[], mapping: Record<string, EventId>) => {
    const next = planTimerImport(items, mapping);
    if (next.unresolvedSessionIds.length) { setSessions(items); return; }
    assertActive();
    await importSessions(next.sessions, () => alive.current);
    setSessions(null);
    setMessage(tr({ en: `Imported ${next.sessions.length} groups and ${next.solveCount} solves.`, zh: `已导入 ${next.sessions.length} 个分组、${next.solveCount} 条成绩。` }));
  };
  const run = async (operation: () => Promise<void>) => {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setMessage('');
    try { await operation(); }
    catch { setMessage(tr({ en: 'Import failed. Check the file and try again.', zh: '导入失败，请检查文件后重试。' })); }
    finally { pending.current = false; setBusy(false); }
  };
  const read = async (file: File) => {
    setSessions(null); setTargets({});
    if (file.size > MAX_TIMER_BACKUP_BYTES) throw new Error('File too large');
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertActive();
    const sqlite = new TextDecoder().decode(bytes.subarray(0,16)) === 'SQLite format 3\0';
    if (sqlite) {
      const { parseDctimerExport } = await import('@cuberoot/shared/timer/import-dctimer');
      assertActive();
      const parsed = await parseDctimerExport(bytes);
      assertActive();
      if (!parsed.length) throw new Error('Invalid dcTimer file');
      await append(parsed, {}); return;
    }
    const text = new TextDecoder().decode(bytes);
    const parsed = parseCstimerExport(text);
    if (parsed.length) { await append(parsed, {}); return; }
    assertActive();
    if (await importBackup(text, () => alive.current)) setMessage(tr({ en: 'Import complete', zh: '导入完成' }));
  };
  return <>
    <div className="settings-row"><span className="settings-row-label">{tr({ en: 'Import', zh: '导入' })}</span><span className="settings-row-control">
      <input ref={input} hidden type="file" accept=".json,.txt,.db,.sqlite,application/json,application/vnd.sqlite3,application/x-sqlite3" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(() => read(file));
      }} />
      <button type="button" className="hint-btn" data-setting-id="settings.data.import-file" disabled={disabled || busy} aria-busy={busy} onClick={() => input.current?.click()}>
        {busy ? tr({ en: 'Importing…', zh: '正在导入…' }) : tr({ en: 'One-click import', zh: '一键导入' })}
      </button><span className="hint">{tr({ en: 'csTimer and dcTimer groups are added as new sessions. CubeRoot backups ask before replacing data.', zh: 'csTimer 和 dcTimer 按原分组新增会话；CubeRoot 备份覆盖前会确认。' })}</span>
    </span></div>
    {sessions && <>
      <div className="cstimer-import-list">{sessions.map(session => <div className="cstimer-import-row" key={session.sessionId}>
        <span>{session.name}</span>
        {session.matched ? <span>{tr({ en: eventInfo(session.event).nameEn, zh: eventInfo(session.event).nameZh })}</span> : session.solves.length > 0 &&
          <div className="cstimer-target-picker" data-setting-id="settings.data.import-session-mapping"><TimerPuzzlePicker selectedEvent={targets[session.sessionId] ?? ''}
            puzzleLabel={tr({ en: 'Choose event', zh: '选择项目' })} dataNoTimer onSelect={id => setTargets(current => ({ ...current, [session.sessionId]: id as EventId }))}
            groups={TIMER_EVENT_PICKER_GROUPS.map(group => ({ id: group.id, label: tr({ en: group.nameEn, zh: group.nameZh }), items: group.items.map(item => ({ id: item.id, label: tr({ en: item.nameEn, zh: item.nameZh }), iconClass: item.iconClass, textLabel: item.textLabel })) }))} /></div>}
      </div>)}</div>
      <button type="button" className="hint-btn" data-setting-id="settings.data.import-complete" disabled={disabled || busy || plan.unresolvedSessionIds.length > 0} onClick={() => void run(() => append(sessions, targets))}>{tr({ en: 'Finish import', zh: '完成导入' })}</button>
    </>}
    {message && <p role="status">{message}</p>}
  </>;
}

export const TIMER_IMPORT_SETTING_FIELD_IDS = [
  "settings.data.import-file",
  "settings.data.import-session-mapping",
  "settings.data.import-complete"
] as const;
