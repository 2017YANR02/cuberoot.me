'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, CircleAlert, Download, HardDrive, Loader2 } from '@app-foundation/icons/lucide';
import MoreToggle from '@/components/MoreToggle';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { tr } from '@/i18n/tr';
import {
  buildVaultBackup, VAULT_BACKUP_FILENAME, vaultBackupLabels,
  type VaultBackupLocale, type VaultBackupSource,
} from '@/lib/vault-backup';
import {
  canAutoBackupVault, canLocateVaultBackup, disableVaultDeviceBackup, enableVaultDeviceBackup,
  locateVaultBackup, pickVaultBackupDirectory, reconnectVaultDeviceBackup, requestVaultBackupPermission,
  syncVaultDeviceBackup, type VaultBackupResult,
} from '@/lib/vault-backup-device';

function backupLocale(): VaultBackupLocale {
  return {
    lang: tr({ zh: 'zh-Hans', en: 'en' }),
    labels: Object.fromEntries(Object.entries(vaultBackupLabels).map(([key, label]) => [key, tr(label)])) as VaultBackupLocale['labels'],
  };
}

const BACKUP_CHECK_INTERVAL_MS = 60_000;

export default function VaultBackup({ userId, revision, checkRevision, load }: {
  userId: number;
  revision: string;
  checkRevision: (signal: AbortSignal) => Promise<string | null>;
  load: (signal: AbortSignal) => Promise<VaultBackupSource>;
}) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const supported = canAutoBackupVault();
  const session = useRef<AbortController | null>(null);
  const [result, setResult] = useState<VaultBackupResult>();
  const config = result && 'config' in result ? result.config : undefined;
  const [expanded, setExpanded] = useState(false);
  const panelOpen = Boolean(config) && expanded;
  const [operation, setOperation] = useState<'permission' | 'picker' | 'locate' | 'backup' | 'stop' | null>(null);
  const working = operation !== null;
  const [authorizationIssue, setAuthorizationIssue] = useState<'timeout' | 'denied' | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [error, setError] = useState('');

  usePanelClamp(panelOpen, panel, trigger);
  usePopoverDismiss(panelOpen, () => setExpanded(false), panel, trigger);

  const sync = useCallback(async (signal: AbortSignal, showProgress = true) => {
    if (showProgress) setPendingSyncs((count) => count + 1);
    try {
      const next = await syncVaultDeviceBackup(userId, load, backupLocale(), signal, checkRevision);
      if (!signal.aborted) {
        setResult(next);
        if (next.status !== 'permission') setAuthorizationIssue(null);
        if (!('config' in next)) setExpanded(false);
      }
      return next;
    } catch {
      if (!signal.aborted) setError(tr({ zh: '无法读取本机的备份设置。', en: 'Could not read the backup settings on this device.' }));
    } finally {
      if (showProgress) setPendingSyncs((count) => count - 1);
    }
  }, [checkRevision, load, userId]);

  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    return () => { controller.abort(); };
  }, []);

  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    const refresh = () => { if (document.visibilityState === 'visible') void sync(controller.signal); };
    void sync(controller.signal);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [revision, supported, sync]);

  const shouldCheckUpdates = supported && Boolean(config);
  useEffect(() => {
    if (!shouldCheckUpdates) return;
    const controller = new AbortController();
    let checking = false;
    const timer = window.setInterval(() => {
      if (checking || !navigator.onLine || document.visibilityState !== 'visible') return;
      checking = true;
      void sync(controller.signal, false).finally(() => { checking = false; });
    }, BACKUP_CHECK_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [shouldCheckUpdates, sync]);

  const last = config?.last;
  const setup = async (automatic: boolean) => {
    const signal = session.current?.signal;
    if (!signal || working) return;
    setOperation(automatic ? 'picker' : 'backup');
    setError('');
    try {
      // Open the picker before any await that could consume the click's permission.
      const directory = automatic ? await pickVaultBackupDirectory() : null;
      signal.throwIfAborted();
      setOperation('backup');
      if (directory) {
        const written = await enableVaultDeviceBackup(userId, directory, load, backupLocale(), signal);
        if (!signal.aborted) setResult({ status: 'ready', config: written });
      } else {
        const source = await load(signal);
        const items = await source.readItems();
        const [{ saveBlob }, backup] = await Promise.all([
          import('@/lib/document-export'),
          buildVaultBackup(crypto.randomUUID(), items, new Date().toISOString(), backupLocale()),
        ]);
        signal.throwIfAborted();
        saveBlob(backup, VAULT_BACKUP_FILENAME);
      }
    } catch (cause) {
      const code = cause instanceof DOMException ? cause.name : '';
      if (!signal.aborted && code !== 'AbortError') {
        setError(code === 'TimeoutError'
          ? tr({ zh: '浏览器没有返回文件夹选择结果，请重试。', en: 'The folder picker did not respond. Try again.' })
          : automatic && (code === 'NotAllowedError' || code === 'SecurityError')
          ? tr({ zh: '浏览器无法写入此文件夹。请在「文稿」或「下载」中选择一个子文件夹。', en: 'The browser cannot write to this folder. Choose a subfolder in Documents or Downloads.' })
          : code === 'InvalidModificationError'
          ? tr({ zh: '无法在这个文件夹创建新的备份。请选择其他文件夹。', en: 'Could not create a new backup in this folder. Choose a different folder.' })
          : tr({ zh: '未能生成备份。请检查网络和文件权限后重试。', en: 'Could not create the backup. Check your connection and file permissions, then retry.' }));
      }
    } finally { if (!signal.aborted) setOperation(null); }
  };

  const authorizeFile = async () => {
    const signal = session.current?.signal;
    if (!signal || !config || working) return;
    setOperation('permission');
    setAuthorizationIssue(null);
    setError('');
    try {
      const permission = await requestVaultBackupPermission(config);
      if (signal.aborted) return;
      if (permission === 'granted') {
        setOperation('backup');
        if ((await sync(signal))?.status === 'permission' && !signal.aborted) setAuthorizationIssue('denied');
      } else setAuthorizationIssue('denied');
    } catch (cause) {
      if (!signal.aborted) setAuthorizationIssue(cause instanceof DOMException && cause.name === 'TimeoutError' ? 'timeout' : 'denied');
    } finally { if (!signal.aborted) setOperation(null); }
  };

  const reconnect = async () => {
    const signal = session.current?.signal;
    if (!signal || !config || working) return;
    setOperation('picker');
    setError('');
    try {
      const directory = await pickVaultBackupDirectory();
      signal.throwIfAborted();
      setOperation('backup');
      const written = await reconnectVaultDeviceBackup(userId, config.id, directory, load, backupLocale(), signal);
      if (!signal.aborted) {
        setResult({ status: 'ready', config: written });
        setAuthorizationIssue(null);
      }
    } catch (cause) {
      if (!signal.aborted && !(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError(cause instanceof DOMException && ['NotFoundError', 'InvalidModificationError'].includes(cause.name)
          ? tr({ zh: '所选文件夹没有这份备份。请选择原备份文件所在的文件夹。', en: 'This folder does not contain the backup. Choose the folder with the original backup file.' })
          : tr({ zh: '无法重新连接本机备份。请重试或下载备份。', en: 'Could not reconnect the local backup. Try again or download a backup.' }));
      }
    } finally { if (!signal.aborted) setOperation(null); }
  };

  const disable = async () => {
    const signal = session.current?.signal;
    if (!signal || working) return;
    setOperation('stop');
    setError('');
    try {
      await disableVaultDeviceBackup(userId);
      if (!signal.aborted) {
        setResult({ status: 'off' });
        setExpanded(false);
      }
    } catch {
      if (!signal.aborted) setError(tr({ zh: '无法关闭自动备份，请重试。', en: 'Could not turn off automatic backup. Try again.' }));
    } finally { if (!signal.aborted) setOperation(null); }
  };

  const locate = async () => {
    const signal = session.current?.signal;
    if (!signal || !config || working) return;
    setOperation('locate');
    setError('');
    try {
      await locateVaultBackup(config.file);
    } catch (cause) {
      if (!signal.aborted && !(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError(tr({ zh: '无法打开系统文件选择器，请重试。', en: 'Could not open the system file picker. Try again.' }));
      }
    } finally { if (!signal.aborted) setOperation(null); }
  };

  const needsPermission = result?.status === 'permission';
  const showAuthorizationError = needsPermission && authorizationIssue !== null;
  const canChooseFolder = needsPermission && supported;
  const preferFolder = showAuthorizationError && canChooseFolder;
  const failed = result?.status === 'failed';
  const showDownload = failed || (needsPermission && (showAuthorizationError || Boolean(error)));
  const progress = operation && tr({
    permission: { zh: '等待浏览器授权…', en: 'Waiting for browser permission…' },
    picker: { zh: '等待选择备份位置…', en: 'Waiting for the backup location…' },
    locate: { zh: '正在打开文件选择器…', en: 'Opening the file picker…' },
    backup: { zh: '正在更新备份…', en: 'Updating the backup…' },
    stop: { zh: '正在停止自动备份…', en: 'Turning off automatic backups…' },
  }[operation]);
  const busyLabel = progress || (pendingSyncs > 0 && tr(config
    ? { zh: '正在同步…', en: 'Syncing…' }
    : { zh: '正在检查备份设置…', en: 'Checking backup settings…' }));
  const status = busyLabel ? 'busy' : result?.status ?? 'off';
  const statusLabel = busyLabel || (status === 'off' || status === 'legacy' ? undefined : tr({
    busy: { zh: '正在同步…', en: 'Syncing…' },
    ready: { zh: '自动备份已开启', en: 'Automatic backup is on' },
    permission: { zh: '需要重新授权', en: 'Permission needed' },
    failed: { zh: '备份未更新', en: 'Backup not updated' },
  }[status]));
  const StatusIcon = status === 'busy' ? Loader2 : status === 'ready' ? Check : CircleAlert;
  const backupLabel = tr({ zh: '本机备份', en: 'Local backup' });
  const backupFileLabel = tr({ zh: '备份文件', en: 'Backup file' });
  const authorizeLabel = tr({ zh: '重新授权', en: 'Grant access again' });
  const chooseFolderLabel = tr({ zh: '选择原备份文件夹', en: 'Choose the original backup folder' });
  const problem = error || (showAuthorizationError && tr(authorizationIssue === 'timeout'
    ? { zh: '浏览器没有返回授权结果。', en: 'The browser did not return a permission decision.' }
    : { zh: '浏览器未授予写入权限。', en: 'The browser did not grant write access.' }));

  if (!config) {
    const SetupIcon = busyLabel ? Loader2 : supported ? HardDrive : Download;
    return <div className="vault-backup" data-status={status}>
      <button type="button" className="vault-button" disabled={working || pendingSyncs > 0}
        aria-busy={Boolean(busyLabel)} aria-description={busyLabel || tr(supported
          ? { zh: '选择备份文件夹', en: 'Choose backup folder' }
          : { zh: '下载明文备份', en: 'Download plaintext backup' })}
        onClick={() => void setup(supported)}>
        <SetupIcon className={busyLabel ? 'vault-spin' : undefined} aria-hidden="true" />{backupLabel}
      </button>
      {error && <p className="vault-error vault-backup-feedback" role="alert">{error}</p>}
    </div>;
  }

  return <div className="vault-backup" data-status={status}>
    <MoreToggle ref={trigger} className="vault-button" expanded={panelOpen} aria-controls={panelOpen ? panelId : undefined}
      aria-description={statusLabel} onToggle={() => setExpanded((open) => !open)}>
      <HardDrive aria-hidden="true" />{backupLabel}
      <span className="vault-backup-indicator" aria-hidden="true" />
    </MoreToggle>
    {panelOpen && <div ref={panel} id={panelId} className="vault-backup-panel" data-site-surface="popover" role="region" aria-label={backupLabel}>
      {statusLabel && <div className="vault-backup-status" role="status">
        <StatusIcon className={status === 'busy' ? 'vault-spin' : undefined} aria-hidden="true" />
        <strong>{statusLabel}</strong>
      </div>}
      <div className="vault-backup-details">
        {last && <dl className="vault-backup-detail">
          <dt>{tr({ zh: '上次备份', en: 'Last backup' })}</dt>
          <dd><time dateTime={last.savedAt}>{new Date(last.savedAt).toLocaleString(tr({ zh: 'zh-Hans', en: 'en' }), {
            dateStyle: 'medium', timeStyle: 'short',
          })}</time></dd>
        </dl>}
        {canLocateVaultBackup() ? <button className="vault-backup-detail vault-backup-file-row" type="button"
          aria-description={tr({ zh: '在系统文件选择器中定位', en: 'Locate in the system file picker' })}
          disabled={working} onClick={() => void locate()}>
          <span>{backupFileLabel}</span>
          <span>{config.file.name}</span>
        </button> : <dl className="vault-backup-detail">
          <dt>{backupFileLabel}</dt>
          <dd>{config.file.name}</dd>
        </dl>}
      </div>
      {problem && <p className="vault-error" role="alert">{problem}</p>}
      {(needsPermission || showDownload) && <div className="vault-backup-actions">
        {needsPermission && <button className="vault-button is-primary"
          type="button" disabled={working} onClick={() => void (preferFolder ? reconnect() : authorizeFile())}>
          {preferFolder ? chooseFolderLabel : authorizeLabel}
        </button>}
        {canChooseFolder && <button className="vault-backup-action"
          type="button" disabled={working} onClick={() => void (preferFolder ? authorizeFile() : reconnect())}>
          {preferFolder ? authorizeLabel : chooseFolderLabel}
        </button>}
        {showDownload && <button className="vault-backup-action" type="button" disabled={working} onClick={() => void setup(false)}>
          <Download aria-hidden="true" />{tr({ zh: '下载明文备份', en: 'Download plaintext backup' })}
        </button>}
      </div>}
      <div className="vault-backup-footer">
        <button className="vault-backup-action" type="button" disabled={working} onClick={() => void disable()}>
          {tr({ zh: '停止自动备份', en: 'Stop automatic backups' })}
        </button>
      </div>
    </div>}
  </div>;
}
