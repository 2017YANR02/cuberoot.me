'use client';
import './timer-data-settings.css';
import { useEffect, useRef, useState } from 'react';
import { normalizeTimerAutoBackupEvery, type TimerLocalBackupEntry, type TimerCloudBackupMeta } from '@cuberoot/shared/timer/backup-client';

export interface TimerBackupSettingsProps {
  language: 'en' | 'zh';
  every: number;
  onEveryChange(value: number): void;
  local: { create(): Promise<void>; list(): Promise<TimerLocalBackupEntry[]>; restore(key: string, canCommit: () => boolean): Promise<void> };
  /** Changes on every authenticated identity/session change. */
  owner: string | null;
  login(): void;
  cloud: { meta(): Promise<TimerCloudBackupMeta>; upload(): Promise<unknown>; restore(canCommit: () => boolean): Promise<boolean> };
  disabled?: boolean;
}
export function TimerBackupSettings({ language, every, onEveryChange, local, owner, login, cloud, disabled = false }: TimerBackupSettingsProps) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const [entries, setEntries] = useState<TimerLocalBackupEntry[] | null>(null);
  const [meta, setMeta] = useState<TimerCloudBackupMeta | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  const ownerRef = useRef(owner);
  if (ownerRef.current !== owner) { ownerRef.current = owner; generation.current++; }
  const cloudRef = useRef(cloud); cloudRef.current = cloud;
  useEffect(() => {
    let live = true; const current = generation.current;
    setMeta(null); setMessage('');
    if (owner) void cloudRef.current.meta().then(value => { if (live && current === generation.current) setMeta(value); }).catch(() => { if (live && current === generation.current) setMessage(tr({ en: 'Unable to read cloud backup.', zh: '无法读取云备份。' })); });
    return () => { live = false; };
  }, [owner]);
  const pending = useRef(false);
  const run = async (operation: (canCommit: () => boolean) => Promise<string>) => {
    if (pending.current || disabled) return;
    const current = generation.current;
    pending.current = true; setBusy(true); setMessage('');
    try { const result = await operation(() => alive.current && current === generation.current); if (current === generation.current) setMessage(result); }
    catch { if (current === generation.current) setMessage(tr({ en: 'Backup operation failed. Your current data has been kept.', zh: '备份操作失败，已保留当前数据。' })); }
    finally { pending.current = false; setBusy(false); }
  };
  const blocked = busy || disabled;
  return <>
    <section className="settings-section"><h3>{tr({ en: 'Local auto-backup', zh: '本机自动备份' })}</h3>
      <label className="settings-row" data-setting-id="settings.data.auto-backup-frequency"><span className="settings-row-label">{tr({ en: 'Back up every N solves', zh: '每完成 N 次自动备份' })}</span><span className="settings-row-control"><input className="settings-row-control-input" type="number" min={0} max={30} step={1} value={every} disabled={blocked} onChange={event => onEveryChange(normalizeTimerAutoBackupEvery(Number(event.target.value)))} /><span className="hint">{tr({ en: '0 disables; keeps last 10', zh: '0 为禁用；保留最近 10 份' })}</span></span></label>
      <div className="modal-actions"><button type="button" className="hint-btn" data-setting-id="settings.data.local-backup-create" disabled={blocked} onClick={() => void run(async () => { await local.create(); if (entries) setEntries(await local.list()); return tr({ en: 'Local backup created', zh: '已写入本机备份' }); })}>{tr({ en: 'Back up now', zh: '立即备份' })}</button>
      <button type="button" className="hint-btn" data-setting-id="settings.data.local-backup-list" disabled={blocked} onClick={() => void run(async () => { setEntries(entries ? null : await local.list()); return ''; })}>{entries ? tr({ en: 'Hide backups', zh: '收起备份' }) : tr({ en: 'View backups', zh: '查看备份' })}</button></div>
      {entries && <div className="settings-backup-list">{!entries.length && <p>{tr({ en: 'No local backups yet', zh: '还没有本机备份' })}</p>}{entries.map(entry => <div className="settings-backup-row" key={entry.key}><span>{new Date(entry.ts).toLocaleString()} · {(entry.size / 1024).toFixed(1)} KB</span><button type="button" className="hint-btn" data-setting-id="settings.data.local-backup-restore" disabled={blocked} onClick={() => {
        if (!window.confirm(tr({ en: 'Restore this backup and replace all current solves?', zh: '确认用此备份覆盖当前全部成绩？' }))) return;
        void run(async canCommit => { await local.restore(entry.key, canCommit); setEntries(null); return tr({ en: 'Local backup restored', zh: '已恢复本机备份' }); });
      }}>{tr({ en: 'Restore', zh: '恢复' })}</button></div>)}</div>}
    </section>
    <section className="settings-section"><h3>{tr({ en: 'Cloud backup', zh: '云备份' })}</h3>
      {!owner ? <button type="button" className="hint-btn" data-setting-id="settings.data.cloud-sign-in" onClick={login}>{tr({ en: 'Sign in to back up', zh: '登录后备份到云端' })}</button> : <>
        <div className="modal-actions"><button type="button" className="hint-btn" data-setting-id="settings.data.cloud-upload" disabled={blocked} onClick={() => void run(async () => { const current = generation.current; await cloud.upload(); const next = await cloud.meta(); if (current === generation.current) setMeta(next); return tr({ en: 'Uploaded to cloud', zh: '已上传到云端' }); })}>{tr({ en: 'Upload to cloud', zh: '上传到云端' })}</button>
        <button type="button" className="hint-btn" data-setting-id="settings.data.cloud-restore" disabled={blocked} onClick={() => {
          if (!window.confirm(tr({ en: 'Replace all local solves with the cloud backup?', zh: '确认用云备份覆盖当前全部成绩？' }))) return;
          void run(async canCommit => await cloud.restore(canCommit) ? tr({ en: 'Restored from cloud', zh: '已从云端恢复' }) : tr({ en: 'No cloud backup yet', zh: '云端暂无备份' }));
        }}>{tr({ en: 'Restore from cloud', zh: '从云端恢复' })}</button></div>
        <p className="hint">{meta?.exists ? tr({ en: `Cloud: ${meta.solveCount ?? 0} solves`, zh: `云端 ${meta.solveCount ?? 0} 条成绩` }) : tr({ en: 'No cloud backup loaded', zh: '尚未读取到云备份' })}</p>
        <p className="hint">{meta?.updatedAt ? new Date(meta.updatedAt * 1000).toLocaleString() : null}</p>
        <p className="hint">{tr({ en: 'Restore replaces all local sessions. Timer settings are not included.', zh: '恢复会覆盖本地所有分组，计时器设置不在云备份内。' })}</p>
      </>}
    </section>
    {message && <p role="status">{message}</p>}
  </>;
}

export const TIMER_BACKUP_SETTING_FIELD_IDS = [
  "settings.data.auto-backup-frequency",
  "settings.data.local-backup-create",
  "settings.data.local-backup-list",
  "settings.data.local-backup-restore",
  "settings.data.cloud-sign-in",
  "settings.data.cloud-upload",
  "settings.data.cloud-restore"
] as const;
