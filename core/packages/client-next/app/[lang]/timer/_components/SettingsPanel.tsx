'use client';

/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CloudDownload, CloudUpload, Download, FileSpreadsheet, LogIn, RefreshCw, Target } from 'lucide-react';
import { formatTargetTime, parseDailySolveGoal, parseTargetTime, resetSettings, updateSettings, useSettings } from '../_lib/settings';
import { warmupSound, play } from '../_lib/sound';
import { isVoiceAvailable } from '../_lib/sound/voice';
import { getSeedCounter, resetSeedCounter } from '../_lib/scramble';
import { appendSolves, listBackups, pushBackup, replaceSolves, restoreBackup } from '../_lib/storage/db';
import { parseCstimerExport, type CstimerSessionParsed } from '../_lib/storage/import_cstimer';
import { exportCstimerJson } from '../_lib/storage/export_cstimer';
import { exportSolvesCsv } from '../_lib/storage/export_csv';
import { uploadBackup, restoreFromCloud, fetchBackupMeta, formatSyncTime, type CloudBackupMeta } from '../_lib/storage/cloud';
import { useAuthStore } from '@/lib/auth-store';
import { reanalyzeAll } from '../_lib/storage/reanalyze';
import { eventInfo, type EventId } from '../_lib/types';
import { WCA_COLORS } from '../_lib/cube/colors';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CountryInput } from '@/components/CountryInput';

interface Props {
  isZh: boolean;
  onClose: () => void;
  /** Current event — target-time setting applies to this event. */
  event: EventId;
  /** Called after the local DB is wholesale-replaced (cloud restore) so the host can refresh. */
  onDataReplaced?: () => void;
}

interface AccordionSectionProps {
  id: string;
  title: string;
  defaultExpanded: boolean;
  useMobile: boolean;
  expanded: Set<string>;
  setExpanded: (next: Set<string>) => void;
  children: React.ReactNode;
}

function AccordionSection({ id, title, defaultExpanded, useMobile, expanded, setExpanded, children }: AccordionSectionProps) {
  // Initialize expansion state on mount.
  useEffect(() => {
    if (defaultExpanded && !expanded.has(id)) {
      const next = new Set(expanded);
      next.add(id);
      setExpanded(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!useMobile) {
    return (
      <div className="modal-section">
        <h3 className="settings-h3">{title}</h3>
        {children}
      </div>
    );
  }

  const isOpen = expanded.has(id);
  const toggle = () => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="modal-section">
      <button
        type="button"
        className="settings-accordion-header"
        aria-expanded={isOpen}
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          minHeight: 44,
          padding: '10px 4px',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {isOpen
          ? <ChevronDown size={16} aria-hidden />
          : <ChevronRight size={16} aria-hidden />}
        <span className="settings-h3" style={{ margin: 0 }}>{title}</span>
      </button>
      {isOpen && <div style={{ paddingTop: 8 }}>{children}</div>}
    </div>
  );
}

export default function SettingsPanel({ isZh, onClose, event, onDataReplaced }: Props) {
  const s = useSettings();
  const isMobile = useIsMobile();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(['timing']));
  const [seedTick, setSeedTick] = useState(0);
  const [seedDraft, setSeedDraft] = useState<string>(() => s.syncSeed ?? '');
  // Keep draft in sync when the active seed changes externally (e.g. settings reset).
  useEffect(() => { setSeedDraft(s.syncSeed ?? ''); }, [s.syncSeed]);
  const [aoInput, setAoInput] = useState<string>(() => s.customAoWindows.join(','));

  // Target-time input is a free-form string while editing; commit on blur /
  // Enter. Empty / invalid / non-positive → clear the per-event target.
  const currentTargetMs: number | null = (() => {
    const v = s.targetMsByEvent[event];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  })();
  const [targetInput, setTargetInput] = useState<string>(() => formatTargetTime(currentTargetMs));
  // Keep input in sync when user changes event while modal is open.
  useEffect(() => {
    setTargetInput(formatTargetTime(currentTargetMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  function commitTargetInput(raw: string): void {
    const parsed = parseTargetTime(raw);
    const next = { ...s.targetMsByEvent };
    if (parsed === null) {
      delete next[event];
    } else {
      next[event] = parsed;
    }
    updateSettings({ targetMsByEvent: next });
    setTargetInput(formatTargetTime(parsed));
  }

  // Daily solve-count goal — free-form string while editing, commit on
  // blur / Enter. Empty / 0 / non-positive → null (disable the pill).
  const currentDailyGoal: number | null =
    typeof s.dailySolveGoal === 'number' && Number.isFinite(s.dailySolveGoal) && s.dailySolveGoal > 0
      ? Math.floor(s.dailySolveGoal)
      : null;
  const [goalInput, setGoalInput] = useState<string>(() =>
    currentDailyGoal === null ? '' : String(currentDailyGoal),
  );
  function commitGoalInput(raw: string): void {
    const parsed = parseDailySolveGoal(raw);
    updateSettings({ dailySolveGoal: parsed });
    setGoalInput(parsed === null ? '' : String(parsed));
  }

  // Tap-to-BPM: rolling window of timestamps; reset after 3s of inactivity.
  const tapTimesRef = useRef<number[]>([]);
  const tapResetTimerRef = useRef<number | null>(null);
  const [tapBpmHint, setTapBpmHint] = useState<number | null>(null);

  function tapBpm(): void {
    const now = performance.now();
    const arr = tapTimesRef.current;
    arr.push(now);
    // Keep at most 4 taps for the rolling window.
    if (arr.length > 4) arr.shift();
    if (arr.length >= 2) {
      const span = arr[arr.length - 1] - arr[0];
      const avgIntervalMs = span / (arr.length - 1);
      if (avgIntervalMs > 0) {
        const bpm = Math.round(60000 / avgIntervalMs);
        const clamped = Math.max(30, Math.min(300, bpm));
        updateSettings({ metronomeBpm: clamped });
        setTapBpmHint(clamped);
      }
    }
    if (tapResetTimerRef.current !== null) {
      window.clearTimeout(tapResetTimerRef.current);
    }
    tapResetTimerRef.current = window.setTimeout(() => {
      tapTimesRef.current = [];
      tapResetTimerRef.current = null;
      setTapBpmHint(null);
    }, 3000);
  }

  useEffect(() => {
    return () => {
      if (tapResetTimerRef.current !== null) window.clearTimeout(tapResetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commitAoInput(raw: string): void {
    const parts = raw.split(/[,，\s]+/).map(p => p.trim()).filter(Boolean);
    const out: number[] = [];
    for (const p of parts) {
      const n = Math.floor(Number(p));
      if (Number.isFinite(n) && n >= 3 && n <= 1000 && !out.includes(n)) out.push(n);
    }
    updateSettings({ customAoWindows: out });
    setAoInput(out.join(','));
  }

  // ── csTimer import state ──
  const cstimerFileRef = useRef<HTMLInputElement | null>(null);
  const [cstimerSessions, setCstimerSessions] = useState<CstimerSessionParsed[] | null>(null);
  // Per-session "imported" flag so the UI dims/disables the buttons after action.
  const [cstimerImported, setCstimerImported] = useState<Record<string, 'append' | 'replace'>>({});

  // ── csTimer export state ──
  const [cstimerExportMsg, setCstimerExportMsg] = useState<string | null>(null);
  const cstimerExportTimerRef = useRef<number | null>(null);

  // ── CSV export state ──
  const [csvExportMsg, setCsvExportMsg] = useState<string | null>(null);
  const csvExportTimerRef = useRef<number | null>(null);

  // ── Cloud backup state ──
  const user = useAuthStore((st) => st.user);
  const login = useAuthStore((st) => st.login);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const cloudMsgTimerRef = useRef<number | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMeta, setCloudMeta] = useState<CloudBackupMeta | null>(null);

  // Read the cloud snapshot metadata once when logged in (lightweight, no blob).
  useEffect(() => {
    if (!user) { setCloudMeta(null); return; }
    let alive = true;
    fetchBackupMeta()
      .then((m) => { if (alive) setCloudMeta(m); })
      .catch(() => { if (alive) setCloudMeta({ exists: false }); });
    return () => { alive = false; };
  }, [user]);

  function flashCloudMsg(msg: string): void {
    setCloudMsg(msg);
    if (cloudMsgTimerRef.current !== null) window.clearTimeout(cloudMsgTimerRef.current);
    cloudMsgTimerRef.current = window.setTimeout(() => {
      setCloudMsg(null);
      cloudMsgTimerRef.current = null;
    }, 2500);
  }

  async function onCloudUpload(): Promise<void> {
    setCloudBusy(true);
    try {
      const { updatedAt, solveCount, byteSize } = await uploadBackup();
      setCloudMeta({ exists: true, solveCount, updatedAt, byteSize });
      flashCloudMsg(isZh ? `已上传 ${solveCount} 条到云端` : `Uploaded ${solveCount} solves`);
    } catch {
      flashCloudMsg(isZh ? '上传失败,请重试' : 'Upload failed, try again');
    } finally {
      setCloudBusy(false);
    }
  }

  async function onCloudRestore(): Promise<void> {
    const ok = window.confirm(isZh
      ? '将用云端备份覆盖本地全部成绩,本地未上传的成绩会丢失。确定继续?'
      : 'This replaces ALL local solves with the cloud backup. Unsynced local solves will be lost. Continue?');
    if (!ok) return;
    setCloudBusy(true);
    try {
      const result = await restoreFromCloud();
      if (result === 'ok') {
        onDataReplaced?.();
        flashCloudMsg(isZh ? '已从云端恢复' : 'Restored from cloud');
      } else if (result === 'invalid') {
        flashCloudMsg(isZh ? '云端备份损坏,无法恢复' : 'Cloud backup is corrupt');
      } else {
        flashCloudMsg(isZh ? '云端暂无备份' : 'No cloud backup yet');
      }
    } catch {
      flashCloudMsg(isZh ? '恢复失败,请重试' : 'Restore failed, try again');
    } finally {
      setCloudBusy(false);
    }
  }

  // ── Reanalyze stage data state ──
  const [reanalyzeBusy, setReanalyzeBusy] = useState(false);
  const [reanalyzeProgress, setReanalyzeProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [reanalyzeMsg, setReanalyzeMsg] = useState<string | null>(null);
  const reanalyzeMsgTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cstimerExportTimerRef.current !== null) window.clearTimeout(cstimerExportTimerRef.current);
      if (csvExportTimerRef.current !== null) window.clearTimeout(csvExportTimerRef.current);
      if (reanalyzeMsgTimerRef.current !== null) window.clearTimeout(reanalyzeMsgTimerRef.current);
      if (cloudMsgTimerRef.current !== null) window.clearTimeout(cloudMsgTimerRef.current);
    };
  }, []);

  async function onReanalyze(): Promise<void> {
    if (reanalyzeBusy) return;
    setReanalyzeBusy(true);
    setReanalyzeMsg(null);
    setReanalyzeProgress({ scanned: 0, total: 0 });
    try {
      const result = await reanalyzeAll(p => {
        setReanalyzeProgress({ scanned: p.scanned, total: p.total });
      });
      const msg = isZh
        ? `已更新 ${result.updated} 条成绩，涉及 ${result.eventsTouched.length} 个项目`
        : `Updated ${result.updated} solves across ${result.eventsTouched.length} events`;
      setReanalyzeMsg(msg);
      if (reanalyzeMsgTimerRef.current !== null) window.clearTimeout(reanalyzeMsgTimerRef.current);
      reanalyzeMsgTimerRef.current = window.setTimeout(() => {
        setReanalyzeMsg(null);
        reanalyzeMsgTimerRef.current = null;
      }, 2000);
    } catch {
      setReanalyzeMsg(isZh ? '重算失败' : 'Reanalyze failed');
    } finally {
      setReanalyzeBusy(false);
      setReanalyzeProgress(null);
    }
  }

  async function onCstimerExport(): Promise<void> {
    try {
      const { json, solveCount, sessionCount } = await exportCstimerJson();
      if (solveCount === 0) {
        alert(isZh ? '当前没有可导出的成绩。' : 'No solves to export.');
        return;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const a = document.createElement('a');
      a.href = url;
      a.download = `cuberoot-export-${yyyy}-${mm}-${dd}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const msg = isZh
        ? `已导出 ${solveCount} 条成绩（${sessionCount} 个会话）`
        : `Exported ${solveCount} solves across ${sessionCount} sessions`;
      setCstimerExportMsg(msg);
      if (cstimerExportTimerRef.current !== null) window.clearTimeout(cstimerExportTimerRef.current);
      cstimerExportTimerRef.current = window.setTimeout(() => {
        setCstimerExportMsg(null);
        cstimerExportTimerRef.current = null;
      }, 1500);
    } catch {
      alert(isZh ? '导出失败。' : 'Export failed.');
    }
  }

  function onCsvExport(): void {
    try {
      const { csv, solveCount } = exportSolvesCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const a = document.createElement('a');
      a.href = url;
      a.download = `cuberoot-solves-${yyyy}-${mm}-${dd}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const msg = isZh
        ? `已导出 ${solveCount} 条成绩`
        : `Exported ${solveCount} solves`;
      setCsvExportMsg(msg);
      if (csvExportTimerRef.current !== null) window.clearTimeout(csvExportTimerRef.current);
      csvExportTimerRef.current = window.setTimeout(() => {
        setCsvExportMsg(null);
        csvExportTimerRef.current = null;
      }, 1500);
    } catch {
      alert(isZh ? '导出失败。' : 'Export failed.');
    }
  }

  function onCstimerFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const sessions = parseCstimerExport(text);
      if (sessions.length === 0) {
        alert(isZh ? '未识别为 csTimer 导出文件。' : 'Not a recognized csTimer export.');
        return;
      }
      setCstimerSessions(sessions);
      setCstimerImported({});
    };
    reader.onerror = () => {
      alert(isZh ? '读取文件失败。' : 'Failed to read file.');
    };
    reader.readAsText(file);
  }

  function importCstimerSession(sess: CstimerSessionParsed, mode: 'append' | 'replace'): void {
    if (sess.solves.length === 0) {
      alert(isZh ? '该会话没有可导入的成绩。' : 'This session has no solves.');
      return;
    }
    if (mode === 'replace') {
      const confirmMsg = isZh
        ? `确认用 ${sess.solves.length} 条记录替换 ${eventInfo(sess.event).nameZh} 的全部成绩？`
        : `Replace all ${eventInfo(sess.event).nameEn} solves with ${sess.solves.length} from "${sess.name}"?`;
      if (!confirm(confirmMsg)) return;
      replaceSolves(sess.event, sess.solves);
    } else {
      appendSolves(sess.event, sess.solves);
    }
    setCstimerImported(prev => ({ ...prev, [sess.sessionId]: mode }));
    alert(isZh
      ? '已导入。请刷新页面以查看更新后的成绩。'
      : 'Imported. Please reload the page to see the updated solves.');
  }

  function showBackupPicker(): void {
    const list = listBackups();
    if (list.length === 0) {
      alert(isZh ? '尚无自动备份。' : 'No auto-backups yet.');
      return;
    }
    const lines = list.map((e, i) => {
      const d = new Date(e.ts);
      const stamp = d.toISOString().replace('T', ' ').slice(0, 19);
      const kb = (e.size / 1024).toFixed(1);
      return `${i + 1}. ${stamp}  (${kb} KB)`;
    }).join('\n');
    const prompt1 = isZh
      ? `备份列表（输入序号恢复，留空取消）：\n\n${lines}`
      : `Auto-backups (enter index to restore, blank to cancel):\n\n${lines}`;
    const ans = window.prompt(prompt1, '');
    if (!ans) return;
    const idx = parseInt(ans, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      alert(isZh ? '无效序号。' : 'Invalid index.');
      return;
    }
    const target = list[idx]!;
    if (!confirm(isZh
      ? `确认用 ${new Date(target.ts).toLocaleString()} 的备份覆盖当前数据？`
      : `Restore backup from ${new Date(target.ts).toLocaleString()} (overwrites current data)?`)) return;
    const ok = restoreBackup(target.key);
    alert(ok
      ? (isZh ? '已恢复。请刷新页面。' : 'Restored. Please reload the page.')
      : (isZh ? '恢复失败。' : 'Restore failed.'));
  }

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-modal-title">{isZh ? '设置' : 'Settings'}</h2>

        <AccordionSection
          id="timing"
          title={isZh ? '计时' : 'Timing'}
          defaultExpanded={true}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '观察时间（秒）' : 'Inspection (sec)'}>
            <input
              type="number" min={0} max={60}
              value={s.inspection}
              onChange={(e) => updateSettings({ inspection: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            />
            <span className="hint">{s.inspection === 0 ? (isZh ? '关闭' : 'off') : (isZh ? `${s.inspection} 秒（>${s.inspection}s = +2，>${s.inspection + 2}s = DNF）` : `${s.inspection}s (>${s.inspection}s = +2, >${s.inspection + 2}s = DNF)`)}</span>
          </Row>
          <Row label={isZh ? '按住阈值（毫秒）' : 'Hold threshold (ms)'}>
            <input
              type="number" min={100} max={2000} step={50}
              value={s.holdMs}
              onChange={(e) => updateSettings({ holdMs: Math.max(100, Math.min(2000, Number(e.target.value) || 550)) })}
            />
          </Row>
          <Row label={isZh ? '观察启动方式' : 'Inspection trigger'}>
            <select
              value={s.inspectionTrigger}
              onChange={(e) => updateSettings({ inspectionTrigger: e.target.value as 'down' | 'up' })}
            >
              <option value="down">{isZh ? '按下' : 'Press down'}</option>
              <option value="up">{isZh ? '松开' : 'Release'}</option>
            </select>
            <span className="hint">{isZh
              ? '按下：立即进入观察；松开：松开空格后才进入（Stackmat 习惯）'
              : 'down: enter on press; up: enter on release (stackmat-style)'}</span>
          </Row>
          <Row label={isZh ? '蓝牙自动 ready' : 'Bluetooth auto-ready'}>
            <select
              value={s.bluetoothAutoReady}
              onChange={(e) => updateSettings({ bluetoothAutoReady: e.target.value as 'off' | 'still' | 'double-flick' })}
            >
              <option value="off">{isZh ? '关闭' : 'Off'}</option>
              <option value="still">{isZh ? '静止 2 秒' : 'Still 2s'}</option>
              <option value="double-flick">{isZh ? "双反扭 (U U')²" : "Double-flick (U U')²"}</option>
            </select>
            <span className="hint">{isZh
              ? "still = 解完后保持 2 秒不动；double-flick = 解完后做 U U' U U' 确认"
              : "still = solved + 2s no move; double-flick = perform U U' U U' to confirm"}</span>
          </Row>
          <Row label={isZh ? '隐藏运行中的时间' : 'Hide time while running'}>
            <input
              type="checkbox"
              checked={s.hideTime}
              onChange={(e) => updateSettings({ hideTime: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? 'CFOP 分阶段计时' : 'CFOP stage splits'}>
            <input
              type="checkbox"
              checked={s.multiStage}
              onChange={(e) => updateSettings({ multiStage: e.target.checked })}
            />
            <span className="hint">{isZh
              ? '按 1=Cross 完成，2=F2L，3=OLL；蓝牙连接时自动检测'
              : 'Press 1=Cross, 2=F2L, 3=OLL; auto-detected when bluetooth connected'}</span>
          </Row>
          <Row label={isZh ? '盲拧记忆 / 执行分段' : 'BLD memo split'}>
            <input
              type="checkbox"
              checked={s.bldMemo}
              onChange={(e) => updateSettings({ bldMemo: e.target.checked })}
            />
            <span className="hint">{isZh
              ? '盲拧项目运行中按 Enter 标记记忆完成'
              : 'On BLD events, press Enter while running to mark memo done'}</span>
          </Row>
          <Row label={isZh ? '目标时间' : 'Target time'}>
            <input
              type="text"
              value={targetInput}
              placeholder={isZh ? '例：0:10.50（留空关闭）' : 'e.g. 0:10.50 (blank = off)'}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={(e) => commitTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTargetInput((e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
            <span className="hint">
              <Target size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {currentTargetMs === null
                ? (isZh ? `当前 ${eventInfo(event).nameZh}：关闭` : `${eventInfo(event).nameEn}: off`)
                : (isZh ? `当前 ${eventInfo(event).nameZh}：${formatTargetTime(currentTargetMs)}` : `${eventInfo(event).nameEn}: ${formatTargetTime(currentTargetMs)}`)}
            </span>
          </Row>
          <Row label={isZh ? '每日目标次数' : 'Daily solve goal'}>
            <input
              type="number"
              min={0}
              step={1}
              value={goalInput}
              placeholder={isZh ? '例：50（留空 / 0 关闭）' : 'e.g. 50 (blank / 0 = off)'}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={(e) => commitGoalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitGoalInput((e.target as HTMLInputElement).value); }}
            />
            <span className="hint">{currentDailyGoal === null
              ? (isZh ? '关闭' : 'off')
              : (isZh ? `每天 ${currentDailyGoal} 次（全部项目合计）` : `${currentDailyGoal} solves/day (all events)`)}</span>
          </Row>
          <Row label={isZh ? '精度' : 'Precision'}>
            <select
              value={s.precision}
              onChange={(e) => updateSettings({ precision: Number(e.target.value) as 2 | 3 })}
            >
              <option value={2}>{isZh ? '0.01 秒' : '0.01s'}</option>
              <option value={3}>{isZh ? '0.001 秒' : '0.001s'}</option>
            </select>
          </Row>
          <Row label={isZh ? '颜色中立' : 'Color neutral'}>
            <select
              value={s.cnMode}
              onChange={(e) => updateSettings({ cnMode: e.target.value as 'none' | 'single' | 'dual' | 'six' })}
            >
              <option value="none">{isZh ? '固定白底' : 'None (white)'}</option>
              <option value="single">{isZh ? '单面随机' : 'Single (random)'}</option>
              <option value="dual">{isZh ? '双面（白黄）' : 'Dual (white/yellow)'}</option>
              <option value="six">{isZh ? '六面' : 'Six-sided'}</option>
            </select>
            <span className="hint">{isZh ? '仅 3x3 类项目生效' : '3x3 events only'}</span>
          </Row>
          <Row label={isZh ? '自定义平均' : 'Custom averages'}>
            <input
              type="text"
              value={aoInput}
              placeholder={isZh ? '例：7,25（逗号分隔）' : 'e.g. 7,25 (comma-separated)'}
              onChange={(e) => setAoInput(e.target.value)}
              onBlur={(e) => commitAoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitAoInput((e.target as HTMLInputElement).value); }}
            />
            <span className="hint">{isZh
              ? `每个 3..1000；当前 ${s.customAoWindows.length === 0 ? '无' : s.customAoWindows.map(n => 'ao' + n).join(' / ')}`
              : `each 3..1000; current ${s.customAoWindows.length === 0 ? 'none' : s.customAoWindows.map(n => 'ao' + n).join(' / ')}`}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="sound"
          title={isZh ? '声音' : 'Sound'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '提示音' : 'Sounds'}>
            <input
              type="checkbox"
              checked={s.soundsEnabled}
              onChange={(e) => {
                updateSettings({ soundsEnabled: e.target.checked });
                if (e.target.checked) warmupSound();
              }}
            />
          </Row>
          <Row label={isZh ? '音量' : 'Volume'}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={s.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            />
            <button
              className="hint-btn"
              onClick={() => play('start')}
              title={isZh ? '试听' : 'Test'}
            >
              ♪
            </button>
          </Row>
          <Row label={isZh ? '语音观察' : 'Voice inspection'}>
            <select
              value={s.voiceInspection}
              onChange={(e) => {
                updateSettings({ voiceInspection: e.target.value as 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female' });
                warmupSound();
              }}
              disabled={!isVoiceAvailable()}
            >
              <option value="none">{isZh ? '关闭（用提示音）' : 'Off (beeps)'}</option>
              <option value="en-male">{isZh ? '英文 男声' : 'English (male)'}</option>
              <option value="en-female">{isZh ? '英文 女声' : 'English (female)'}</option>
              <option value="zh-male">{isZh ? '中文 男声' : 'Chinese (male)'}</option>
              <option value="zh-female">{isZh ? '中文 女声' : 'Chinese (female)'}</option>
            </select>
            <span className="hint">{isVoiceAvailable()
              ? (isZh ? '念 8 秒 / 12 秒 / 开始（依系统可用音色）' : 'reads 8s / 12s / go (depends on system voices)')
              : (isZh ? '浏览器不支持' : 'unsupported by browser')}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="metronome"
          title={isZh ? '节拍器' : 'Metronome'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '开启' : 'Enabled'}>
            <input
              type="checkbox"
              checked={s.metronomeOn}
              onChange={(e) => {
                updateSettings({ metronomeOn: e.target.checked });
                if (e.target.checked) warmupSound();
              }}
            />
            <span className="hint">{isZh ? '观察 / 计时阶段播放' : 'ticks during inspection / solve'}</span>
          </Row>
          <Row label={isZh ? '速度（BPM）' : 'Tempo (BPM)'}>
            <input
              type="range" min={30} max={300} step={1}
              value={s.metronomeBpm}
              onChange={(e) => updateSettings({ metronomeBpm: Math.max(30, Math.min(300, Number(e.target.value) || 120)) })}
            />
            <span className="hint" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '3ch', display: 'inline-block' }}>{s.metronomeBpm}</span>
            <button
              className="hint-btn"
              onClick={tapBpm}
              title={isZh ? '连续敲击设定速度' : 'Tap repeatedly to set tempo'}
            >
              {isZh ? '敲击' : 'Tap'}
            </button>
            {tapBpmHint !== null && (
              <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>→ {tapBpmHint}</span>
            )}
            <span className="hint">{isZh ? '离开本页时自动停止' : 'auto-stops on page leave'}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="sync-seed"
          title={isZh ? '同步种子' : 'Sync seed'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '种子' : 'Seed'}>
            <input
              type="text"
              value={seedDraft}
              placeholder={isZh ? '任意字符串' : 'any string'}
              onChange={(e) => setSeedDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value;
                  if (v !== '') {
                    updateSettings({ syncSeed: v, syncSeedCounter: 0 });
                    setSeedTick((t) => t + 1);
                  }
                }
              }}
            />
            <button
              className="hint-btn"
              onClick={() => {
                if (seedDraft === '') return;
                updateSettings({ syncSeed: seedDraft, syncSeedCounter: 0 });
                setSeedTick((t) => t + 1);
              }}
              disabled={seedDraft === '' || seedDraft === s.syncSeed}
            >
              {isZh ? '应用' : 'Apply'}
            </button>
            <button
              className="hint-btn"
              onClick={() => {
                updateSettings({ syncSeed: null, syncSeedCounter: 0 });
                setSeedDraft('');
                setSeedTick((t) => t + 1);
              }}
              disabled={s.syncSeed === null}
            >
              {isZh ? '清除' : 'Clear'}
            </button>
          </Row>
          <Row label={isZh ? '当前' : 'Current'}>
            <span className="hint" title={String(seedTick)}>
              {s.syncSeed === null
                ? (isZh ? '未启用' : 'off')
                : (isZh
                    ? `seed=${s.syncSeed}，第 ${getSeedCounter()} 个打乱`
                    : `seed=${s.syncSeed}, scramble #${getSeedCounter()}`)}
            </span>
            <button
              className="hint-btn"
              onClick={() => { resetSeedCounter(); setSeedTick((t) => t + 1); }}
              disabled={s.syncSeed === null}
            >
              {isZh ? '重置计数' : 'Reset counter'}
            </button>
          </Row>
          <Row label="">
            <span className="hint">{isZh
              ? '相同种子在不同设备打出相同序列；计数会跨刷新保留'
              : 'same seed → same sequence across devices; counter persists across reloads'}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="auto-backup"
          title={isZh ? '自动备份' : 'Auto-backup'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '每 N 次写入触发' : 'Every N saves'}>
            <input
              type="number" min={0} max={30} step={1}
              value={s.autoBackupEvery}
              onChange={(e) => updateSettings({ autoBackupEvery: Math.max(0, Math.min(30, Number(e.target.value) | 0)) })}
            />
            <span className="hint">{s.autoBackupEvery === 0
              ? (isZh ? '已禁用' : 'disabled')
              : (isZh ? '保留最近 10 份' : 'keeps last 10')}</span>
          </Row>
          <Row label={isZh ? '操作' : 'Actions'}>
            <button className="hint-btn" onClick={() => { pushBackup(); alert(isZh ? '已写入备份。' : 'Backup written.'); }}>
              {isZh ? '立即备份' : 'Back up now'}
            </button>
            <button className="hint-btn" onClick={showBackupPicker}>
              {isZh ? '查看备份' : 'View backups'}
            </button>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="cloud"
          title={isZh ? '云备份' : 'Cloud backup'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          {!user ? (
            <Row label={isZh ? '登录' : 'Sign in'}>
              <button className="hint-btn" onClick={() => login()}>
                <LogIn size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {isZh ? '登录后备份到云端' : 'Sign in to back up'}
              </button>
              <span className="hint">{isZh
                ? '用 WCA 账号登录,即可把全部成绩存到云端,在其它设备恢复'
                : 'Sign in with WCA to store all solves in the cloud and restore them on other devices'}</span>
            </Row>
          ) : (
            <>
              <Row label={isZh ? '操作' : 'Actions'}>
                <button
                  className="hint-btn"
                  disabled={cloudBusy}
                  onClick={() => { void onCloudUpload(); }}
                  title={isZh ? '把本地全部成绩上传到云端(覆盖云端旧备份)' : 'Upload all local solves to the cloud (replaces the cloud copy)'}
                >
                  <CloudUpload size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {isZh ? '上传到云端' : 'Upload to cloud'}
                </button>
                <button
                  className="hint-btn"
                  disabled={cloudBusy}
                  onClick={() => { void onCloudRestore(); }}
                  title={isZh ? '用云端备份覆盖本地全部成绩' : 'Replace all local solves with the cloud backup'}
                >
                  <CloudDownload size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {isZh ? '从云端恢复' : 'Restore from cloud'}
                </button>
              </Row>
              <Row label="">
                <span className="hint">{
                  cloudMsg !== null
                    ? cloudMsg
                    : cloudMeta === null
                      ? (isZh ? '正在读取云端状态…' : 'Checking cloud…')
                      : cloudMeta.exists
                        ? (isZh
                            ? `云端 ${cloudMeta.solveCount ?? 0} 条,上次同步 ${formatSyncTime(cloudMeta.updatedAt ?? 0, true)}`
                            : `Cloud: ${cloudMeta.solveCount ?? 0} solves, synced ${formatSyncTime(cloudMeta.updatedAt ?? 0, false)}`)
                        : (isZh ? '云端暂无备份' : 'No cloud backup yet')
                }</span>
              </Row>
              <Row label="">
                <span className="hint">{isZh
                  ? '恢复会用云端整库覆盖本地(含所有会话);计时器设置项不在备份内。'
                  : 'Restore replaces ALL local sessions with the cloud copy; timer settings are not included.'}</span>
              </Row>
            </>
          )}
        </AccordionSection>

        <AccordionSection
          id="cstimer-io"
          title={isZh ? '从 csTimer 导入 / 导出' : 'csTimer import / export'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '选择 JSON 文件' : 'Choose JSON file'}>
            <input
              ref={cstimerFileRef}
              type="file"
              accept=".json,.txt,application/json"
              style={{ display: 'none' }}
              onChange={onCstimerFile}
            />
            <button
              className="hint-btn"
              onClick={() => cstimerFileRef.current?.click()}
            >
              {isZh ? '选择文件…' : 'Choose file…'}
            </button>
            <span className="hint">{isZh
              ? '导出来源：csTimer → Local backup → Export'
              : 'From csTimer → Local backup → Export'}</span>
          </Row>
          <Row label={isZh ? '导出所有成绩' : 'Export all solves'}>
            <button
              className="hint-btn"
              onClick={() => { void onCstimerExport(); }}
              title={isZh ? '下载所有成绩为 csTimer 兼容的 JSON' : 'Download all solves as a csTimer-compatible JSON'}
            >
              <Download size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {isZh ? 'csTimer JSON' : 'csTimer JSON'}
            </button>
            <button
              className="hint-btn"
              onClick={onCsvExport}
              title={isZh ? '每条成绩一行的 CSV，便于 Excel / Python 分析' : 'One row per solve, for spreadsheets / Python'}
            >
              <FileSpreadsheet size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {isZh ? 'CSV' : 'CSV'}
            </button>
            {cstimerExportMsg !== null && (
              <span className="hint">{cstimerExportMsg}</span>
            )}
            {csvExportMsg !== null && (
              <span className="hint">{csvExportMsg}</span>
            )}
          </Row>
          {cstimerSessions && cstimerSessions.length > 0 && (
            <div className="cstimer-import-list">
              {cstimerSessions.map(sess => {
                const ev = eventInfo(sess.event);
                const evLabel = isZh ? ev.nameZh : ev.nameEn;
                const done = cstimerImported[sess.sessionId];
                const disabled = sess.solves.length === 0;
                return (
                  <div key={sess.sessionId} className="cstimer-import-row">
                    <div className="cstimer-import-info">
                      <span className="cstimer-import-name">{sess.name}</span>
                      <span className="hint">
                        {isZh
                          ? `${sess.solves.length} 条 → ${evLabel}${sess.matched ? '' : '（默认）'}`
                          : `${sess.solves.length} solves → ${evLabel}${sess.matched ? '' : ' (fallback)'}`}
                      </span>
                    </div>
                    <div className="cstimer-import-actions">
                      <button
                        className="hint-btn"
                        disabled={disabled || done === 'append'}
                        onClick={() => importCstimerSession(sess, 'append')}
                        title={isZh ? '追加到现有成绩' : 'Append to existing solves'}
                      >
                        {done === 'append' ? (isZh ? '已追加' : 'Appended') : (isZh ? '追加' : 'Append')}
                      </button>
                      <button
                        className="hint-btn"
                        disabled={disabled || done === 'replace'}
                        onClick={() => importCstimerSession(sess, 'replace')}
                        title={isZh ? '清空该项目并以此覆盖' : 'Clear this event and replace'}
                      >
                        {done === 'replace' ? (isZh ? '已替换' : 'Replaced') : (isZh ? '替换' : 'Replace')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Row label={isZh ? '重算分阶段数据' : 'Reanalyze stage data'}>
            <button
              className="hint-btn"
              onClick={() => { void onReanalyze(); }}
              disabled={reanalyzeBusy}
              title={isZh
                ? '基于当前精确识别器，重新计算所有有移动记录的成绩的分阶段拆分'
                : 'Rerun the current exact recognizer over every solve that has recorded moves'}
            >
              <RefreshCw size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {reanalyzeBusy
                ? (reanalyzeProgress && reanalyzeProgress.total > 0
                    ? (isZh
                        ? `处理中… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}`
                        : `Working… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}`)
                    : (isZh ? '处理中…' : 'Working…'))
                : (isZh ? '重新分析' : 'Reanalyze')}
            </button>
            {reanalyzeMsg !== null && (
              <span className="hint">{reanalyzeMsg}</span>
            )}
          </Row>
        </AccordionSection>

        <AccordionSection
          id="appearance"
          title={isZh ? '外观' : 'Appearance'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={isZh ? '主题' : 'Theme'}>
            <select
              value={s.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' | 'auto' })}
            >
              <option value="dark">{isZh ? '深色' : 'Dark'}</option>
              <option value="light">{isZh ? '浅色' : 'Light'}</option>
              <option value="auto">{isZh ? '跟随系统' : 'Auto'}</option>
            </select>
          </Row>
          <Row label={isZh ? '计时器字号' : 'Timer font scale'}>
            <input
              type="range" min={0.5} max={2} step={0.05}
              value={s.timerFontScale}
              onChange={(e) => updateSettings({ timerFontScale: Number(e.target.value) })}
            />
            <span className="hint">{s.timerFontScale.toFixed(2)}×</span>
          </Row>
          <Row label={isZh ? '紧凑打乱' : 'Compact scramble'}>
            <input
              type="checkbox"
              checked={s.compactScramble}
              onChange={(e) => updateSettings({ compactScramble: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '显示魔方预览' : 'Show cube preview'}>
            <input
              type="checkbox"
              checked={s.showCubePreview}
              onChange={(e) => updateSettings({ showCubePreview: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '3D 立方体' : '3D cube'}>
            <input
              type="checkbox"
              checked={s.prefer3D}
              onChange={(e) => updateSettings({ prefer3D: e.target.checked })}
            />
            <span className="hint">{isZh ? '可拖动旋转；关闭则展开 2D 平面' : 'drag to rotate; off = 2D net'}</span>
          </Row>
          <Row label={isZh ? '显示图表' : 'Show charts'}>
            <input
              type="checkbox"
              checked={s.showCharts}
              onChange={(e) => updateSettings({ showCharts: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '显示练习日历' : 'Show practice heatmap'}>
            <input
              type="checkbox"
              checked={s.showHeatmap}
              onChange={(e) => updateSettings({ showHeatmap: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '点击打乱条' : 'Scramble click action'}>
            <select
              value={s.scrambleClickAction}
              onChange={(e) => updateSettings({ scrambleClickAction: e.target.value as 'none' | 'next' | 'copy' })}
            >
              <option value="none">{isZh ? '无操作' : 'Nothing'}</option>
              <option value="next">{isZh ? '换下一个' : 'Next scramble'}</option>
              <option value="copy">{isZh ? '复制到剪贴板' : 'Copy to clipboard'}</option>
            </select>
          </Row>
          <Row label={isZh ? '运行中隐藏全部 UI' : 'Hide all UI while running'}>
            <input
              type="checkbox"
              checked={s.hideAllUiWhileRunning}
              onChange={(e) => updateSettings({ hideAllUiWhileRunning: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? 'PB 庆祝弹窗' : 'PB celebration toast'}>
            <input
              type="checkbox"
              checked={s.pbToast}
              onChange={(e) => updateSettings({ pbToast: e.target.checked })}
            />
            <span className="hint">{isZh
              ? '刷新单次/Ao5/Ao12 最佳时显示 3 秒'
              : 'shows for 3s when single/ao5/ao12 PB is broken'}</span>
          </Row>
          <Row label={isZh ? '排名地区' : 'Ranking region'}>
            <CountryInput
              value={(s.rankCountry ?? '').toLowerCase()}
              onChange={(iso2) => updateSettings({ rankCountry: iso2.toUpperCase() })}
              placeholder={isZh ? '国家(留空只显 WR)' : 'Country (blank = WR only)'}
            />
            <span className="hint">{isZh
              ? '设国家后停表额外显示 CR(大洲)/ NR(全国)排名;登录 WCA 自动带入'
              : 'adds CR (continent) / NR (national) ranks; auto-filled when signed in'}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="cube-colors"
          title={isZh ? '配色（魔方面）' : 'Cube colors'}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <div className="color-grid">
            {(['U', 'D', 'F', 'B', 'L', 'R'] as const).map(face => {
              const cur = s.colors[face] ?? WCA_COLORS[face];
              return (
                <label key={face} className="color-cell">
                  <span>{face}</span>
                  <input
                    type="color"
                    value={cur}
                    onChange={(e) => updateSettings({
                      colors: { ...s.colors, [face]: e.target.value },
                    })}
                  />
                </label>
              );
            })}
          </div>
          <button
            className="reset-btn"
            onClick={() => updateSettings({ colors: {} })}
          >
            {isZh ? '恢复 WCA 配色' : 'Reset to WCA colors'}
          </button>
        </AccordionSection>

        <div className="modal-actions">
          <button className="danger" onClick={() => {
            if (confirm(isZh ? '把所有设置恢复为默认值？' : 'Reset all settings to defaults?')) {
              resetSettings();
            }
          }}>
            {isZh ? '全部重置' : 'Reset all'}
          </button>
          <button className="primary" onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>

      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">{children}</span>
    </div>
  );
}
