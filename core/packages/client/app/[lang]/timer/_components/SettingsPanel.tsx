'use client';

/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Bluetooth,
  CloudDownload,
  CloudUpload,
  Database,
  Dices,
  Download,
  FileSpreadsheet,
  FileText,
  Keyboard,
  LogIn,
  Palette,
  RefreshCw,
  Target,
  Timer as TimerIcon,
  Trophy,
  Volume2,
} from 'lucide-react';
import { formatTargetTime, parseDailySolveGoal, parseTargetTime, resetSettings, updateSettings, useSettings } from '../_lib/settings';
import TimerFontPicker from '@/components/TimerFontPicker';
import { warmupSound, play, playInspectionBeep } from '../_lib/sound';
import { isVoiceAvailable } from '../_lib/sound/voice';
import { getSeedCounter, resetSeedCounter } from '../_lib/scramble';
import {
  appendSolves, exportJson, exportSpeedstacks, importJson, inspectImportJson, listBackups,
  loadAll, pushBackup, replaceSolves, restoreBackup,
  type BackupEntry,
} from '../_lib/storage/db';
import { parseCstimerExport, type CstimerSessionParsed } from '../_lib/storage/import_cstimer';
import { exportCstimerJson } from '../_lib/storage/export_cstimer';
import { exportSolvesCsv } from '../_lib/storage/export_csv';
import { uploadBackup, restoreFromCloud, fetchBackupMeta, formatSyncTime, type CloudBackupMeta } from '../_lib/storage/cloud';
import { useAuthStore } from '@/lib/auth-store';
import { reanalyzeAll } from '../_lib/storage/reanalyze';
import { EVENTS, eventInfo, isBldEvent, type EventId } from '../_lib/types';
import { wcaEventId, WCA_OPTIMAL_EVENTS } from '../_lib/scramble/wca_pool';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import { useMetronome, setMetronome, tapTempo, bpmToTps, BPM_MIN, BPM_MAX } from '@/lib/metronome';
import { CountryInput } from '@/components/CountryInput';
import PillToggle from '@/components/PillToggle/PillToggle';
import SharedBoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import ResetDefaultsButton from '@/components/ResetDefaultsButton';
import { tr } from '@/i18n/tr';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { cutoffPhase, roundAttempts, type RoundFormat } from '../_lib/round';
import {
  RESERVED_BINDINGS,
  TIMER_ACTIONS,
  bindingForEvent,
  bindingsForAction,
  formatBinding,
  resolveKeymap,
  type TimerActionId,
} from '../_lib/keymap';
// .settings-row* 原语来自 wca-source.css(现已提取到共享 components/)—— 以前靠
// WcaSourceConfig 顺带 import 进来,「打乱来源」那节移出后这里得自己 import,否则每个 Row 掉样式。
import '@/components/wca-source.css';

interface Props {
  onClose: () => void;
  /** Current event — target-time setting applies to this event. */
  event: EventId;
  /** Called after the local DB is wholesale-replaced (cloud restore) so the host can refresh. */
  onDataReplaced?: () => void;
}

type SettingsCategory = 'timer' | 'smart-cube' | 'scramble' | 'training' | 'appearance' | 'sound' | 'data' | 'advanced';

interface SettingsSectionProps {
  category: SettingsCategory;
  activeCategory: SettingsCategory;
  title?: string;
  children: React.ReactNode;
  headerControl?: React.ReactNode;
}

function SettingsSection({ category, activeCategory, title, children, headerControl }: SettingsSectionProps) {
  if (category !== activeCategory) return null;
  return (
    <section className="settings-section">
      {(title || headerControl) && (
        <div className="settings-section-head">
          {title && <h4>{title}</h4>}
          {headerControl}
        </div>
      )}
      {children}
    </section>
  );
}

export default function SettingsPanel({ onClose, event, onDataReplaced }: Props) {
  const s = useSettings();
  const metro = useMetronome();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('timer');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const categories = [
    {
      id: 'timer' as const,
      label: tr({ zh: '计时', en: 'Timing' }),
      description: tr({ zh: '启动、观察和成绩精度', en: 'Start, inspection, and precision' }),
      icon: TimerIcon,
    },
    {
      id: 'smart-cube' as const,
      label: tr({ zh: '智能魔方', en: 'Smart cube' }),
      description: tr({ zh: '起表、实况显示和姿态记录', en: 'Start behavior, live view, and orientation' }),
      icon: Bluetooth,
    },
    {
      id: 'scramble' as const,
      label: tr({ zh: '打乱', en: 'Scrambles' }),
      description: tr({ zh: '生成规则、朝向和同步种子', en: 'Rules, orientation, and sync seed' }),
      icon: Dices,
    },
    {
      id: 'training' as const,
      label: tr({ zh: '训练', en: 'Training' }),
      description: tr({ zh: '目标、分段和轮次模拟', en: 'Goals, splits, and round simulation' }),
      icon: Trophy,
    },
    {
      id: 'appearance' as const,
      label: tr({ zh: '外观', en: 'Appearance' }),
      description: tr({ zh: '字体、打乱显示和排名', en: 'Fonts, scramble display, and ranks' }),
      icon: Palette,
    },
    {
      id: 'sound' as const,
      label: tr({ zh: '声音与节奏', en: 'Sound & rhythm' }),
      description: tr({ zh: '提示音、语音和节拍器', en: 'Sounds, voice, and metronome' }),
      icon: Volume2,
    },
    {
      id: 'data' as const,
      label: tr({ zh: '数据', en: 'Data' }),
      description: tr({ zh: '备份、导入和导出', en: 'Backup, import, and export' }),
      icon: Database,
    },
    {
      id: 'advanced' as const,
      label: tr({ zh: '高级', en: 'Advanced' }),
      description: tr({ zh: '快捷键、同步种子和恢复默认', en: 'Shortcuts, sync seed, and reset' }),
      icon: Keyboard,
    },
  ];
  const activeCategoryMeta = categories.find((category) => category.id === activeCategory)!;
  useModalDismiss(onClose);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeCategory]);
  const [seedTick, setSeedTick] = useState(0);
  const [seedDraft, setSeedDraft] = useState<string>(() => s.syncSeed ?? '');
  // Keep draft in sync when the active seed changes externally (e.g. settings reset).
  useEffect(() => { setSeedDraft(s.syncSeed ?? ''); }, [s.syncSeed]);

  // 「最优打乱」只对同态项目(WCA_OPTIMAL_EVENTS)有意义,判据同 WcaSourceConfig。
  const wev = wcaEventId(event);
  const hasOptimal = !!wev && WCA_OPTIMAL_EVENTS.has(wev);
  const supportsStageSplits = ['222', '333', '444', '555', '666', '777', '333oh', '333fm'].includes(event);
  const supportsColorNeutral = ['333', '333oh', '333fm', '333bld', '333ni', '333mbld'].includes(event);

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
  }, [event, currentTargetMs]);

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
  useEffect(() => {
    setGoalInput(currentDailyGoal === null ? '' : String(currentDailyGoal));
  }, [currentDailyGoal]);
  function commitGoalInput(raw: string): void {
    const parsed = parseDailySolveGoal(raw);
    updateSettings({ dailySolveGoal: parsed });
    setGoalInput(parsed === null ? '' : String(parsed));
  }

  // Round-simulation cutoff / time limit. Free-form while editing, committed on
  // blur or Enter, exactly like the target-time field above — and parsed by the
  // same `parseTargetTime`, so `1:00`, `60`, `10.50` all mean what they look like.
  const [roundCutoffInput, setRoundCutoffInput] = useState<string>(() => formatTargetTime(s.round.cutoffMs));
  const [roundLimitInput, setRoundLimitInput] = useState<string>(() => formatTargetTime(s.round.limitMs));
  useEffect(() => {
    setRoundCutoffInput(formatTargetTime(s.round.cutoffMs));
    setRoundLimitInput(formatTargetTime(s.round.limitMs));
  }, [s.round.cutoffMs, s.round.limitMs]);
  // 0 until a cutoff is actually typed in, which would make the hint read
  // "the first 0 attempts" — fall back to the clamped configured length so the
  // sentence still describes what will happen once a value lands.
  const roundAttemptCount = roundAttempts(s.round.format);
  const roundCutoffPhase = cutoffPhase(s.round, roundAttemptCount)
    || Math.max(1, Math.min(s.round.cutoffAttempts, roundAttemptCount - 1));
  function commitRoundLimitField(field: 'cutoffMs' | 'limitMs', raw: string): void {
    const parsed = parseTargetTime(raw);
    updateSettings({ round: { ...s.round, [field]: parsed } });
    (field === 'cutoffMs' ? setRoundCutoffInput : setRoundLimitInput)(formatTargetTime(parsed));
  }

  const [beepAtInput, setBeepAtInput] = useState<string>(() => (s.inspectionBeepAt ?? []).join(','));
  useEffect(() => {
    setBeepAtInput((s.inspectionBeepAt ?? []).join(','));
  }, [s.inspectionBeepAt]);
  function commitBeepAtInput(raw: string): void {
    const out: number[] = [];
    for (const p of raw.split(/[,，\s]+/).map(x => x.trim()).filter(Boolean)) {
      const n = Math.floor(Number(p));
      if (Number.isFinite(n) && n >= 1 && n <= 60 && !out.includes(n)) out.push(n);
    }
    out.sort((a, b) => a - b);
    updateSettings({ inspectionBeepAt: out });
    setBeepAtInput(out.join(','));
  }

  // Tap-to-tempo — the rolling-window math lives in lib/metronome so this row
  // and the floating panel stay one implementation.
  const tapResetTimerRef = useRef<number | null>(null);
  const [tapBpmHint, setTapBpmHint] = useState<number | null>(null);

  function tapBpm(): void {
    const bpm = tapTempo();
    if (bpm != null) {
      setMetronome({ bpm });
      setTapBpmHint(bpm);
    }
    if (tapResetTimerRef.current !== null) {
      window.clearTimeout(tapResetTimerRef.current);
    }
    tapResetTimerRef.current = window.setTimeout(() => {
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
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onClose]);

  // ── csTimer import state ──
  const cstimerFileRef = useRef<HTMLInputElement | null>(null);
  const [cstimerSessions, setCstimerSessions] = useState<CstimerSessionParsed[] | null>(null);
  // Per-session "imported" flag so the UI dims/disables the buttons after action.
  const [cstimerImported, setCstimerImported] = useState<Record<string, 'append' | 'replace'>>({});
  const [cstimerTargets, setCstimerTargets] = useState<Record<string, EventId>>({});

  // ── Import / export status ──
  const [ioMsg, setIoMsg] = useState<string | null>(null);
  const ioMsgTimerRef = useRef<number | null>(null);
  const [backupEntries, setBackupEntries] = useState<BackupEntry[] | null>(null);

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
      flashCloudMsg(tr({ zh: `已上传 ${solveCount} 条到云端`, en: `Uploaded ${solveCount} solves` }));
    } catch {
      flashCloudMsg(tr({ zh: '上传失败,请重试', en: 'Upload failed, try again'
    }));
    } finally {
      setCloudBusy(false);
    }
  }

  async function onCloudRestore(): Promise<void> {
    const ok = window.confirm(tr({ zh: '将用云端备份覆盖本地全部成绩,本地未上传的成绩会丢失。确定继续?', en: 'This replaces ALL local solves with the cloud backup. Unsynced local solves will be lost. Continue?'
    }));
    if (!ok) return;
    setCloudBusy(true);
    try {
      const result = await restoreFromCloud();
      if (result === 'ok') {
        onDataReplaced?.();
        flashCloudMsg(tr({ zh: '已从云端恢复', en: 'Restored from cloud'
        }));
      } else if (result === 'invalid') {
        flashCloudMsg(tr({ zh: '云端备份损坏,无法恢复', en: 'Cloud backup is corrupt'
        }));
      } else {
        flashCloudMsg(tr({ zh: '云端暂无备份', en: 'No cloud backup yet'
        }));
      }
    } catch {
      flashCloudMsg(tr({ zh: '恢复失败,请重试', en: 'Restore failed, try again'
    }));
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
      if (ioMsgTimerRef.current !== null) window.clearTimeout(ioMsgTimerRef.current);
      if (reanalyzeMsgTimerRef.current !== null) window.clearTimeout(reanalyzeMsgTimerRef.current);
      if (cloudMsgTimerRef.current !== null) window.clearTimeout(cloudMsgTimerRef.current);
    };
  }, []);

  function flashIoMsg(msg: string): void {
    setIoMsg(msg);
    if (ioMsgTimerRef.current !== null) window.clearTimeout(ioMsgTimerRef.current);
    ioMsgTimerRef.current = window.setTimeout(() => {
      setIoMsg(null);
      ioMsgTimerRef.current = null;
    }, 2000);
  }

  async function onReanalyze(): Promise<void> {
    if (reanalyzeBusy) return;
    setReanalyzeBusy(true);
    setReanalyzeMsg(null);
    setReanalyzeProgress({ scanned: 0, total: 0 });
    try {
      const result = await reanalyzeAll(p => {
        setReanalyzeProgress({ scanned: p.scanned, total: p.total });
      });
      const msg = tr({
        zh: `已更新 ${result.updated} 条成绩，涉及 ${result.eventsTouched.length} 个项目`,
        en: `Updated ${result.updated} solves across ${result.eventsTouched.length} events`,
      });
      setReanalyzeMsg(msg);
      if (reanalyzeMsgTimerRef.current !== null) window.clearTimeout(reanalyzeMsgTimerRef.current);
      reanalyzeMsgTimerRef.current = window.setTimeout(() => {
        setReanalyzeMsg(null);
        reanalyzeMsgTimerRef.current = null;
      }, 2000);
    } catch {
      setReanalyzeMsg(tr({ zh: '重算失败', en: 'Reanalyze failed'
    }));
    } finally {
      setReanalyzeBusy(false);
      setReanalyzeProgress(null);
    }
  }

  function downloadText(contents: string, mime: string, fileName: string): void {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onCubeRootExport(): void {
    const date = new Date().toISOString().slice(0, 10);
    downloadText(exportJson(), 'application/json', `cuberoot-timer-${date}.json`);
    flashIoMsg(tr({ zh: 'CubeRoot 备份已导出', en: 'CubeRoot backup exported' }));
  }

  async function onCstimerExport(): Promise<void> {
    try {
      const { json, solveCount, sessionCount } = await exportCstimerJson();
      if (solveCount === 0) {
        alert(tr({ zh: '当前没有可导出的成绩。', en: 'No solves to export.'
        }));
        return;
      }
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      downloadText(json, 'application/json', `cuberoot-export-${yyyy}-${mm}-${dd}.json`);
      flashIoMsg(tr({
        zh: `已导出 ${solveCount} 条成绩（${sessionCount} 个会话）`,
        en: `Exported ${solveCount} solves across ${sessionCount} sessions`,
      }));
    } catch {
      alert(tr({ zh: '导出失败。', en: 'Export failed.'
    }));
    }
  }

  function onCsvExport(): void {
    try {
      const { csv, solveCount } = exportSolvesCsv();
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      downloadText(csv, 'text/csv;charset=utf-8', `cuberoot-solves-${yyyy}-${mm}-${dd}.csv`);
      flashIoMsg(tr({
        zh: `已导出 ${solveCount} 条成绩`,
        en: `Exported ${solveCount} solves`,
      }));
    } catch {
      alert(tr({ zh: '导出失败。', en: 'Export failed.'
    }));
    }
  }

  function onSpeedstacksExport(): void {
    const solves = loadAll()[event] ?? [];
    if (solves.length === 0) {
      alert(tr({ zh: '当前项目没有可导出的成绩。', en: 'No solves to export for this event.' }));
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      exportSpeedstacks(solves),
      'text/plain;charset=utf-8',
      `cuberoot-timer-${event}-${date}.ss.txt`,
    );
    flashIoMsg(tr({
      zh: `已导出当前项目的 ${solves.length} 条成绩`,
      en: `Exported ${solves.length} solves from this event`,
    }));
  }

  function onCstimerFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const nativePreview = inspectImportJson(text);
      if (nativePreview) {
        const shouldReplace = confirm(tr({
          zh: `这个备份包含 ${nativePreview.sessionCount} 个会话、${nativePreview.solveCount} 条成绩。导入会覆盖当前全部成绩，是否继续？`,
          en: `This backup contains ${nativePreview.sessionCount} sessions and ${nativePreview.solveCount} solves. Importing replaces all current solves. Continue?`,
        }));
        if (!shouldReplace) return;
        if (!importJson(text)) {
          alert(tr({ zh: '导入失败，请重试。', en: 'Import failed. Try again.' }));
          return;
        }
        setCstimerSessions(null);
        setCstimerImported({});
        setCstimerTargets({});
        onDataReplaced?.();
        flashIoMsg(tr({ zh: 'CubeRoot 备份已导入', en: 'CubeRoot backup imported' }));
        return;
      }
      const sessions = parseCstimerExport(text);
      if (sessions.length === 0) {
        alert(tr({ zh: '未识别为 CubeRoot 备份或 csTimer 导出文件。', en: 'Not a recognized CubeRoot backup or csTimer export.'
        }));
        return;
      }
      setCstimerSessions(sessions);
      setCstimerImported({});
      setCstimerTargets({});
    };
    reader.onerror = () => {
      alert(tr({ zh: '读取文件失败。', en: 'Failed to read file.'
    }));
    };
    reader.readAsText(file);
  }

  function importCstimerSession(sess: CstimerSessionParsed, mode: 'append' | 'replace'): void {
    if (sess.solves.length === 0) {
      alert(tr({ zh: '该会话没有可导入的成绩。', en: 'This session has no solves.'
    }));
      return;
    }
    if (mode === 'replace') {
      const confirmMsg = tr({
        zh: `确认用 ${sess.solves.length} 条记录替换 ${eventInfo(sess.event).nameZh} 的全部成绩？`,
        en: `Replace all ${eventInfo(sess.event).nameEn} solves with ${sess.solves.length} from "${sess.name}"?`,
      });
      if (!confirm(confirmMsg)) return;
      replaceSolves(sess.event, sess.solves);
    } else {
      appendSolves(sess.event, sess.solves);
    }
    setCstimerImported(prev => ({ ...prev, [sess.sessionId]: mode }));
    onDataReplaced?.();
    flashIoMsg(tr({ zh: `已导入 ${sess.solves.length} 条成绩`, en: `Imported ${sess.solves.length} solves` }));
  }

  async function showBackupPicker(): Promise<void> {
    if (backupEntries !== null) {
      setBackupEntries(null);
      return;
    }
    setBackupEntries(await listBackups());
  }

  async function restoreLocalBackup(target: BackupEntry): Promise<void> {
    if (!confirm(tr({
      zh: `确认用 ${new Date(target.ts).toLocaleString()} 的备份覆盖当前数据？`,
      en: `Restore backup from ${new Date(target.ts).toLocaleString()} (overwrites current data)?`,
    }))) return;
    const ok = await restoreBackup(target.key);
    if (ok) onDataReplaced?.();
    flashIoMsg(ok ? tr({ zh: '已恢复本机备份', en: 'Local backup restored' }) : tr({ zh: '恢复失败', en: 'Restore failed' }));
    if (ok) setBackupEntries(null);
  }

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="timer-modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        aria-describedby="settings-modal-description"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-modal-head">
          <div>
            <h2 id="settings-modal-title">{tr({ zh: '设置', en: 'Settings' })}</h2>
            <p id="settings-modal-description">
              {tr({ zh: '更改会立即保存', en: 'Changes are saved automatically' })}
            </p>
          </div>
          <ClearButton
            variant="standalone"
            className="settings-modal-close"
            onClick={onClose}
            ariaLabel={tr({ zh: '关闭设置', en: 'Close settings' })}
          />
        </header>

        <div className="settings-layout">
          <aside className="settings-category-rail" aria-label={tr({ zh: '设置分类', en: 'Settings categories' })}>
            <nav className="settings-category-nav">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className="settings-category-button"
                    data-active={activeCategory === category.id ? 'true' : undefined}
                    aria-current={activeCategory === category.id ? 'page' : undefined}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    <Icon size={16} aria-hidden />
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </nav>
            <label className="settings-category-picker">
              <span>{tr({ zh: '分类', en: 'Category' })}</span>
              <select
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value as SettingsCategory)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>
          </aside>

          <main ref={mainRef} className="settings-main">
            <div className="settings-category-intro">
              <h3>{activeCategoryMeta.label}</h3>
              <p>{activeCategoryMeta.description}</p>
            </div>

            {activeCategory === 'appearance' && (
              <div
                className="settings-appearance-preview"
                style={{
                  '--settings-time-scale': s.timerFontScale,
                  '--settings-scramble-scale': s.scrambleFontScale,
                } as React.CSSProperties}
                aria-label={tr({ zh: '外观预览', en: 'Appearance preview' })}
              >
                <span className="settings-preview-label">{tr({ zh: '预览', en: 'Preview' })}</span>
                <strong className={`tf-${s.timerFont}`}>12.34</strong>
                <span className={`sf-${s.scrambleFont}`}>R U R&apos; U&apos; F2</span>
              </div>
            )}

        <SettingsSection
          category="timer"
          activeCategory={activeCategory}
          title={tr({ zh: '基础计时', en: 'Basic timing' })}
          headerControl={
            <PillToggle
              value={s.timingEnabled}
              onChange={(v) => updateSettings({ timingEnabled: v })}
              onLabel={tr({ zh: '计时', en: 'Timer' })}
              offLabel={tr({ zh: '只练习', en: 'Practice only' })}
              ariaLabel={tr({ zh: '计时模式', en: 'Timing mode' })}
            />
          }
        >
          <Row label={tr({ zh: '观察时间（秒）', en: 'Inspection (sec)'
        })}>
            <input
              type="number" min={0} max={60}
              value={s.inspection}
              onChange={(e) => updateSettings({ inspection: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            />
            <span className="hint">{s.inspection === 0 ? tr({ zh: '关闭', en: 'off'
                                  }) : tr({ zh: `${s.inspection} 秒（>${s.inspection}s = +2，>${s.inspection + 2}s = DNF）`, en: `${s.inspection}s (>${s.inspection}s = +2, >${s.inspection + 2}s = DNF)` })}</span>
          </Row>
          <Row label={tr({ zh: '按住阈值（毫秒）', en: 'Hold threshold (ms)'
        })}>
            <input
              type="number" min={100} max={2000} step={50}
              value={s.holdMs}
              onChange={(e) => updateSettings({ holdMs: Math.max(100, Math.min(2000, Number(e.target.value) || 550)) })}
            />
          </Row>
          <Row label={tr({ zh: '观察启动方式', en: 'Inspection trigger'
        })}>
            <select
              className="settings-row-control-select"
              value={s.inspectionTrigger}
              onChange={(e) => updateSettings({ inspectionTrigger: e.target.value as 'down' | 'up' })}
            >
              <option value="down">{tr({ zh: '按下空格时', en: 'When Space is pressed' })}</option>
              <option value="up">{tr({ zh: '松开空格时', en: 'When Space is released'
            })}</option>
            </select>
            <span className="hint">{tr({ zh: '按下：立即进入观察；松开：松开空格后才进入（Stackmat 习惯）', en: 'down: enter on press; up: enter on release (stackmat-style)'
            })}</span>
          </Row>
        </SettingsSection>

        <SettingsSection
          category="smart-cube"
          activeCategory={activeCategory}
          title={tr({ zh: '连接后的行为', en: 'Connected cube behavior' })}
        >
          <Row label={tr({ zh: '智能魔方自动预备', en: 'Smart-cube auto-ready'
        })}>
            <select
              className="settings-row-control-select"
              value={s.bluetoothAutoReady}
              onChange={(e) => updateSettings({ bluetoothAutoReady: e.target.value as 'off' | 'still' | 'double-flick' | 'scrambled' })}
            >
              <option value="scrambled">{tr({ zh: '打乱正确即预备', en: 'When scrambled' })}</option>
              <option value="off">{tr({ zh: '关闭', en: 'Off'
            })}</option>
              <option value="still">{tr({ zh: '静止 2 秒', en: 'Still 2s'
            })}</option>
              <option value="double-flick">{tr({ zh: "双反扭 (U U')²", en: "Double-flick (U U')²"
            })}</option>
            </select>
            <span className="hint">{tr({
              zh: '进入预备后，第一下转动立即起表，无需按空格',
              en: 'Once ready, the first turn starts the timer without pressing Space',
            })}</span>
          </Row>
          <Row label={tr({ zh: '实况魔方', en: 'Live cube'
        })}>
            <select
              className="settings-row-control-select"
              value={s.liveCubeView}
              onChange={(e) => updateSettings({ liveCubeView: e.target.value as '2d' | 'net' | '3d' | 'q2look' })}
              aria-label={tr({ zh: '实况魔方渲染方式', en: 'Live cube rendering' })}
            >
              <option value="3d">{tr({ zh: '三维', en: '3D' })}</option>
              <option value="q2look">q2Look</option>
              <option value="net">{tr({ zh: '展开图', en: 'Net' })}</option>
              <option value="2d">{tr({ zh: '立体图', en: 'Isometric' })}</option>
            </select>
            <span className="hint">{tr({
              zh: '连接后在时间下方同步显示；三维模式可跟随陀螺仪',
              en: 'Mirrors the cube below the timer; 3D mode can follow the gyroscope',
            })}</span>
          </Row>
          <BooleanRow
            label={tr({ zh: '录姿态用于回放', en: 'Record orientation for replay' })}
            value={s.recordGyro}
            onChange={(v) => updateSettings({ recordGyro: v })}
          >
            <span className="hint">{tr({
              zh: '提高转体和中层动作识别准确度，会略微增加耗电',
              en: 'Improves rotation and slice recognition with slightly higher battery use',
            })}</span>
          </BooleanRow>
          <BooleanRow
            label={tr({ zh: '拧完后打开复盘', en: 'Open reconstruction after each solve' })}
            value={s.autoRecap !== false}
            onChange={(v) => updateSettings({ autoRecap: v })}
          />
        </SettingsSection>

        <SettingsSection
          category="timer"
          activeCategory={activeCategory}
          title={tr({ zh: '计时显示', en: 'Timing display' })}
        >
          <BooleanRow
            label={tr({ zh: '隐藏运行中的时间', en: 'Hide time while running' })}
            value={s.hideTime}
            onChange={(v) => updateSettings({ hideTime: v })}
          />
        </SettingsSection>

        <SettingsSection
          category="training"
          activeCategory={activeCategory}
          title={tr({ zh: '目标与分段', en: 'Goals and splits' })}
        >
          {supportsStageSplits && (
            <BooleanRow
              label={tr({ zh: 'CFOP 分阶段计时', en: 'CFOP stage splits' })}
              value={s.multiStage}
              onChange={(v) => updateSettings({ multiStage: v })}
            >
              <span className="hint">{tr({ zh: '按 1=Cross 完成，2=F2L，3=OLL；智能魔方连接时自动检测', en: 'Press 1=Cross, 2=F2L, 3=OLL; auto-detected with a smart cube' })}</span>
            </BooleanRow>
          )}
          {isBldEvent(event) && (
            <BooleanRow
              label={tr({ zh: '盲拧记忆 / 执行分段', en: 'BLD memo split' })}
              value={s.bldMemo}
              onChange={(v) => updateSettings({ bldMemo: v })}
            >
              <span className="hint">{tr({ zh: '运行中按 Enter 标记记忆完成', en: 'Press Enter while running to mark memo complete' })}</span>
            </BooleanRow>
          )}
          <Row label={tr({ zh: '目标时间', en: 'Target time'
        })}>
            <input
              type="text"
              value={targetInput}
              placeholder={tr({ zh: '例：0:10.50（留空关闭）', en: 'e.g. 0:10.50 (blank = off)'
            })}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={(e) => commitTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTargetInput((e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
            <span className="hint">
              <Target size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {currentTargetMs === null
                ? tr({ zh: `当前 ${eventInfo(event).nameZh}：关闭`, en: `${eventInfo(event).nameEn}: off` })
                : tr({ zh: `当前 ${eventInfo(event).nameZh}：${formatTargetTime(currentTargetMs)}`, en: `${eventInfo(event).nameEn}: ${formatTargetTime(currentTargetMs)}` })}
            </span>
          </Row>
          <Row label={tr({ zh: '每日目标次数', en: 'Daily solve goal'
        })}>
            <input
              type="number"
              min={0}
              step={1}
              value={goalInput}
              placeholder={tr({ zh: '例：50（留空 / 0 关闭）', en: 'e.g. 50 (blank / 0 = off)'
            })}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={(e) => commitGoalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitGoalInput((e.target as HTMLInputElement).value); }}
            />
            <span className="hint">{currentDailyGoal === null
              ? tr({ zh: '关闭', en: 'off'
                                      })
              : tr({ zh: `每天 ${currentDailyGoal} 次（全部项目合计）`, en: `${currentDailyGoal} solves/day (all events)` })}</span>
          </Row>
        </SettingsSection>

        <SettingsSection
          category="scramble"
          activeCategory={activeCategory}
          title={tr({ zh: '规则与朝向', en: 'Rules and orientation' })}
        >
          {/* 2x2 的「最优」已挪到打乱条上的口径 picker(Scramble222ModePicker,随机状态与真题统一),
              这里只保留其余同态项目(斜转/金字塔/3x3 族)。 */}
          {hasOptimal && event !== '222' && (
            <BooleanRow
              label={tr({ zh: '最优打乱', en: 'Optimal scramble' })}
              value={s.wcaUseOptimal}
              onChange={(v) => updateSettings({ wcaUseOptimal: v })}
            />
          )}
          {s.scrambleSource === 'wca' && (
            <BooleanRow
              label={tr({ zh: '完成真题后自动打卡', en: 'Auto-mark completed real scrambles' })}
              value={s.autoMarkWcaScramble}
              onChange={(v) => updateSettings({ autoMarkWcaScramble: v })}
            >
              <span className="hint">{tr({ zh: '把成绩记录到该打乱的公开打卡', en: 'Records the result on that scramble’s public marks' })}</span>
            </BooleanRow>
          )}
        </SettingsSection>

        <SettingsSection
          category="timer"
          activeCategory={activeCategory}
          title={tr({ zh: '成绩精度', en: 'Result precision' })}
        >
          <Row label={tr({ zh: '计时中精度', en: 'Running precision'
        })}>
            <select
              className="settings-row-control-select"
              value={s.runningPrecision}
              onChange={(e) => updateSettings({ runningPrecision: Number(e.target.value) as 0 | 1 | 2 | 3 })}
            >
              <option value={0}>x</option>
              <option value={1}>x.x</option>
              <option value={2}>x.xx</option>
              <option value={3}>x.xxx</option>
            </select>
          </Row>
          <Row label={tr({ zh: '成绩精度', en: 'Result precision'
        })}>
            <select
              className="settings-row-control-select"
              value={s.precision}
              onChange={(e) => updateSettings({ precision: Number(e.target.value) as 2 | 3 })}
            >
              <option value={2}>x.xx</option>
              <option value={3}>x.xxx</option>
            </select>
          </Row>
        </SettingsSection>

        <SettingsSection category="scramble" activeCategory={activeCategory}>
          <Row label={tr({ zh: '预打乱朝向', en: 'Pre-scramble'
        })}>
            <CubeOrientationSelect
              className="settings-row-control-select"
              value={s.preScr}
              onChange={(v) => updateSettings({ preScr: v })}
            />
          </Row>
          <Row label={tr({ zh: '训练预打乱朝向', en: 'Training pre-scramble'
        })}>
            <CubeOrientationSelect
              className="settings-row-control-select"
              value={s.preScrT}
              onChange={(v) => updateSettings({ preScrT: v })}
            />
          </Row>
          {supportsColorNeutral && (
            <Row label={tr({ zh: '颜色中立', en: 'Color neutral' })}>
              <select
                className="settings-row-control-select"
                value={s.cnMode}
                onChange={(e) => updateSettings({ cnMode: e.target.value as 'none' | 'single' | 'dual' | 'six' })}
              >
                <option value="none">{tr({ zh: '固定白底', en: 'None (white)' })}</option>
                <option value="single">{tr({ zh: '单面随机', en: 'Single (random)' })}</option>
                <option value="dual">{tr({ zh: '双面（白黄）', en: 'Dual (white/yellow)' })}</option>
                <option value="six">{tr({ zh: '六面', en: 'Six-sided' })}</option>
              </select>
            </Row>
          )}
        </SettingsSection>

        <SettingsSection
          category="sound"
          activeCategory={activeCategory}
          title={tr({ zh: '声音', en: 'Sound'
        })}
        >
          <BooleanRow
            label={tr({ zh: '提示音', en: 'Sounds' })}
            value={s.soundsEnabled}
            onChange={(v) => { updateSettings({ soundsEnabled: v }); if (v) warmupSound(); }}
          />
          <Row label={tr({ zh: '音量', en: 'Volume' })}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={s.volume}
              disabled={!s.soundsEnabled}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            />
            <button
              className="hint-btn"
              disabled={!s.soundsEnabled}
              onClick={() => play('start')}
              title={tr({ zh: '试听', en: 'Test'
            })}
            >
              ♪
            </button>
          </Row>
          <Row label={tr({ zh: '语音观察', en: 'Voice inspection'
        })}>
            <select
              className="settings-row-control-select"
              value={s.voiceInspection}
              onChange={(e) => {
                updateSettings({ voiceInspection: e.target.value as 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female' });
                warmupSound();
              }}
              disabled={!s.soundsEnabled || !isVoiceAvailable()}
            >
              <option value="none">{tr({ zh: '关闭（用提示音）', en: 'Off (beeps)'
            })}</option>
              <option value="en-male">{tr({ zh: '英文 男声', en: 'English (male)'
            })}</option>
              <option value="en-female">{tr({ zh: '英文 女声', en: 'English (female)'
            })}</option>
              <option value="zh-male">{tr({ zh: '中文 男声', en: 'Chinese (male)'
            })}</option>
              <option value="zh-female">{tr({ zh: '中文 女声', en: 'Chinese (female)'
            })}</option>
            </select>
            <span className="hint">{isVoiceAvailable()
              ? tr({ zh: '念 8 秒 / 12 秒 / 开始（依系统可用音色）', en: 'reads 8s / 12s / go (depends on system voices)'
                                      })
              : tr({ zh: '浏览器不支持', en: 'unsupported by browser'
                                      })}</span>
          </Row>
        </SettingsSection>

        <SettingsSection
          category="sound"
          activeCategory={activeCategory}
          title={tr({ zh: '节拍器', en: 'Metronome'
        })}
        >
          <BooleanRow
            label={tr({ zh: '开启节拍器', en: 'Enable metronome' })}
            value={s.metronomeOn}
            onChange={(v) => { updateSettings({ metronomeOn: v }); if (v) warmupSound(); }}
          >
            <span className="hint">{tr({ zh: '观察 / 计时阶段播放', en: 'ticks during inspection / solve'
            })}</span>
          </BooleanRow>
          <Row label={tr({ zh: '速度', en: 'Tempo' })}>
            <input
              type="range" min={BPM_MIN} max={BPM_MAX} step={1}
              value={metro.bpm}
              disabled={!s.metronomeOn}
              onChange={(e) => setMetronome({ bpm: Number(e.target.value) })}
            />
            <span className="hint" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '9ch', display: 'inline-block' }}>
              {bpmToTps(metro.bpm).toFixed(2)} TPS
            </span>
            <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>{metro.bpm} BPM</span>
            <button
              className="hint-btn"
              disabled={!s.metronomeOn}
              onClick={tapBpm}
              title={tr({ zh: '连续敲击设定速度', en: 'Tap repeatedly to set tempo'
            })}
            >
              {tr({ zh: '敲击', en: 'Tap'
            })}
            </button>
            {tapBpmHint !== null && (
              <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>→ {tapBpmHint}</span>
            )}
            <span className="hint">{tr({ zh: '与桌宠里的悬浮节拍器共用一档速度', en: 'shared with the floating metronome in the desk pet'
            })}</span>
          </Row>
          <Row label={tr({ zh: '观察提示音（秒）', en: 'Beep at (sec)'
        })}>
            <input
              type="text"
              value={beepAtInput}
              disabled={!s.metronomeOn}
              placeholder={tr({ zh: '例：5,10,15（逗号分隔）', en: 'e.g. 5,10,15 (comma-separated)'
            })}
              onChange={(e) => setBeepAtInput(e.target.value)}
              onBlur={(e) => commitBeepAtInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitBeepAtInput((e.target as HTMLInputElement).value); }}
            />
            <button className="hint-btn" disabled={!s.metronomeOn} onClick={() => { warmupSound(); playInspectionBeep(); }} title={tr({ zh: '试听', en: 'Test'
            })}>
              {tr({ zh: '试听', en: 'Test'
            })}
            </button>
            <span className="hint">{tr({
              zh: `观察到这些秒数各响一声（1..60，独立于 8/12 秒）；当前 ${(s.inspectionBeepAt ?? []).length ? s.inspectionBeepAt.join(' / ') + ' 秒' : '关闭'}`,
              en: `one beep at each inspection second (1..60, separate from 8/12s); current ${(s.inspectionBeepAt ?? []).length ? s.inspectionBeepAt.join(' / ') + 's' : 'off'}`,
            })}</span>
          </Row>
        </SettingsSection>

        <SettingsSection
          category="advanced"
          activeCategory={activeCategory}
          title={tr({ zh: '同步种子', en: 'Sync seed'
        })}
        >
          <Row label={tr({ zh: '种子', en: 'Seed'
        })}>
            <input
              type="text"
              value={seedDraft}
              placeholder={tr({ zh: '任意字符串', en: 'any string'
            })}
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
              {tr({ zh: '应用', en: 'Apply'
            })}
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
              {tr({ zh: '清除', en: 'Clear' })}
            </button>
          </Row>
          <Row label={tr({ zh: '当前', en: 'Current'
        })}>
            <span className="hint" title={String(seedTick)}>
              {s.syncSeed === null
                ? tr({ zh: '未启用', en: 'off'
                                              })
                : tr({ zh: `seed=${s.syncSeed}，第 ${getSeedCounter()} 个打乱`, en: `seed=${s.syncSeed}, scramble #${getSeedCounter()}` })}
            </span>
            <button
              className="hint-btn"
              onClick={() => { resetSeedCounter(); setSeedTick((t) => t + 1); }}
              disabled={s.syncSeed === null}
            >
              {tr({ zh: '重置计数', en: 'Reset counter'
            })}
            </button>
          </Row>
          <Row label="">
            <span className="hint">{tr({ zh: '相同种子在不同设备打出相同序列；计数会跨刷新保留', en: 'same seed → same sequence across devices; counter persists across reloads'
            })}</span>
          </Row>
        </SettingsSection>

        <SettingsSection
          category="data"
          activeCategory={activeCategory}
          title={tr({ zh: '本机自动备份', en: 'Local auto-backup'
        })}
        >
          <Row label={tr({ zh: '每完成 N 次自动备份', en: 'Back up every N solves'
        })}>
            <input
              type="number" min={0} max={30} step={1}
              value={s.autoBackupEvery}
              onChange={(e) => updateSettings({ autoBackupEvery: Math.max(0, Math.min(30, Number(e.target.value) | 0)) })}
            />
            <span className="hint">{s.autoBackupEvery === 0
              ? tr({ zh: '已禁用', en: 'disabled' })
              : tr({ zh: '保留最近 10 份', en: 'keeps last 10' })}</span>
          </Row>
          <Row label={tr({ zh: '操作', en: 'Actions' })}>
            <button className="hint-btn" onClick={() => { void pushBackup().then(async () => {
              flashIoMsg(tr({ zh: '已写入本机备份', en: 'Local backup created' }));
              if (backupEntries !== null) setBackupEntries(await listBackups());
            }); }}>
              {tr({ zh: '立即备份', en: 'Back up now'
            })}
            </button>
            <button className="hint-btn" onClick={() => { void showBackupPicker(); }}>
              {backupEntries === null
                ? tr({ zh: '查看备份', en: 'View backups' })
                : tr({ zh: '收起备份', en: 'Hide backups' })}
            </button>
          </Row>
          {backupEntries !== null && (
            <div className="settings-backup-list">
              {backupEntries.length === 0 ? (
                <p>{tr({ zh: '还没有本机备份', en: 'No local backups yet' })}</p>
              ) : backupEntries.map((entry) => (
                <div key={entry.key} className="settings-backup-row">
                  <span>
                    <strong>{new Date(entry.ts).toLocaleString()}</strong>
                    <small>{(entry.size / 1024).toFixed(1)} KB</small>
                  </span>
                  <button type="button" className="hint-btn" onClick={() => { void restoreLocalBackup(entry); }}>
                    {tr({ zh: '恢复', en: 'Restore' })}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          category="data"
          activeCategory={activeCategory}
          title={tr({ zh: '云备份', en: 'Cloud backup'
        })}
        >
          {!user ? (
            <Row label={tr({ zh: '登录', en: 'Sign in'
            })}>
              <button className="hint-btn" onClick={() => login()}>
                <LogIn size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {tr({ zh: '登录后备份到云端', en: 'Sign in to back up'
                })}
              </button>
              <span className="hint">{tr({ zh: '用 WCA 账号登录,即可把全部成绩存到云端,在其它设备恢复', en: 'Sign in with WCA to store all solves in the cloud and restore them on other devices'
            })}</span>
            </Row>
          ) : (
            <>
              <Row label={tr({ zh: '操作', en: 'Actions' })}>
                <button
                  className="hint-btn"
                  disabled={cloudBusy}
                  onClick={() => { void onCloudUpload(); }}
                  title={tr({ zh: '把本地全部成绩上传到云端(覆盖云端旧备份)', en: 'Upload all local solves to the cloud (replaces the cloud copy)'
                })}
                >
                  <CloudUpload size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {tr({ zh: '上传到云端', en: 'Upload to cloud'
                })}
                </button>
                <button
                  className="hint-btn"
                  disabled={cloudBusy}
                  onClick={() => { void onCloudRestore(); }}
                  title={tr({ zh: '用云端备份覆盖本地全部成绩', en: 'Replace all local solves with the cloud backup'
                })}
                >
                  <CloudDownload size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {tr({ zh: '从云端恢复', en: 'Restore from cloud'
                })}
                </button>
              </Row>
              <Row label="">
                <span className="hint" role="status" aria-live="polite">{
                  cloudMsg !== null
                    ? cloudMsg
                    : cloudMeta === null
                      ? tr({ zh: '正在读取云端状态…', en: 'Checking cloud…'
                                                                  })
                      : cloudMeta.exists
                        ? tr({
                            zh: `云端 ${cloudMeta.solveCount ?? 0} 条，上次同步 ${formatSyncTime(cloudMeta.updatedAt ?? 0, true)}`,
                            en: `Cloud: ${cloudMeta.solveCount ?? 0} solves, synced ${formatSyncTime(cloudMeta.updatedAt ?? 0, false)}`,
                          })
                        : tr({ zh: '云端暂无备份', en: 'No cloud backup yet'
                                                                          })
                }</span>
              </Row>
              <Row label="">
                <span className="hint">{tr({ zh: '恢复会用云端整库覆盖本地(含所有会话);计时器设置项不在备份内。', en: 'Restore replaces ALL local sessions with the cloud copy; timer settings are not included.'
                })}</span>
              </Row>
            </>
          )}
        </SettingsSection>

        <SettingsSection
          category="data"
          activeCategory={activeCategory}
          title={tr({ zh: '导入与导出', en: 'Import and export'
        })}
        >
          <Row label={tr({ zh: '导入', en: 'Import'
        })}>
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
              {tr({ zh: '选择文件…', en: 'Choose file…'
            })}
            </button>
            <span className="hint">{tr({ zh: '支持 CubeRoot 备份与 csTimer 导出文件', en: 'Accepts CubeRoot backups and csTimer exports'
            })}</span>
          </Row>
          <Row label={tr({ zh: '导出', en: 'Export'
        })}>
            <button
              className="hint-btn"
              onClick={onCubeRootExport}
              title={tr({ zh: '完整备份全部成绩，可重新导入 CubeRoot', en: 'Back up all solves for later re-import into CubeRoot' })}
            >
              <Download size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              CubeRoot JSON
            </button>
            <button
              className="hint-btn"
              onClick={() => { void onCstimerExport(); }}
              title={tr({ zh: '下载所有成绩为 csTimer 兼容的 JSON', en: 'Download all solves as a csTimer-compatible JSON'
            })}
            >
              <Download size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              csTimer JSON
            </button>
            <button
              className="hint-btn"
              onClick={onCsvExport}
              title={tr({ zh: '每条成绩一行的 CSV，便于 Excel / Python 分析', en: 'One row per solve, for spreadsheets / Python'
            })}
            >
              <FileSpreadsheet size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              CSV
            </button>
            <button
              className="hint-btn"
              onClick={onSpeedstacksExport}
              title={tr({ zh: '导出当前项目为 Speedstacks 文本', en: 'Export the current event as Speedstacks text' })}
            >
              <FileText size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Speedstacks
            </button>
          </Row>
          {ioMsg !== null && (
            <Row label=""><span className="hint" role="status" aria-live="polite">{ioMsg}</span></Row>
          )}
          {cstimerSessions && cstimerSessions.length > 0 && (
            <div className="cstimer-import-list">
              {cstimerSessions.map(sess => {
                const ev = eventInfo(sess.event);
                const evLabel = tr({ zh: ev.nameZh, en: ev.nameEn });
                const done = cstimerImported[sess.sessionId];
                const selectedTarget = cstimerTargets[sess.sessionId];
                const disabled = sess.solves.length === 0 || (!sess.matched && !selectedTarget);
                const importSession = selectedTarget ? { ...sess, event: selectedTarget } : sess;
                return (
                  <div key={sess.sessionId} className="cstimer-import-row">
                    <div className="cstimer-import-info">
                      <span className="cstimer-import-name">{sess.name}</span>
                      {sess.matched ? (
                        <span className="hint">{tr({ zh: `${sess.solves.length} 条 → ${evLabel}`, en: `${sess.solves.length} solves → ${evLabel}` })}</span>
                      ) : (
                        <label className="cstimer-target-picker">
                          <span>{tr({ zh: `${sess.solves.length} 条，选择项目`, en: `${sess.solves.length} solves, choose event` })}</span>
                          <select
                            value={selectedTarget ?? ''}
                            onChange={(event) => setCstimerTargets((current) => ({ ...current, [sess.sessionId]: event.target.value as EventId }))}
                          >
                            <option value="" disabled>{tr({ zh: '选择项目', en: 'Choose event' })}</option>
                            {EVENTS.map((item) => (
                              <option key={item.id} value={item.id}>{tr({ zh: item.nameZh, en: item.nameEn })}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="cstimer-import-actions">
                      <button
                        className="hint-btn"
                        disabled={disabled || done === 'append'}
                        onClick={() => importCstimerSession(importSession, 'append')}
                        title={tr({ zh: '追加到现有成绩', en: 'Append to existing solves'
                        })}
                      >
                        {done === 'append' ? tr({ zh: '已追加', en: 'Appended' }) : tr({ zh: '追加', en: 'Append' })}
                      </button>
                      <button
                        className="hint-btn"
                        disabled={disabled || done === 'replace'}
                        onClick={() => importCstimerSession(importSession, 'replace')}
                        title={tr({ zh: '清空该项目并以此覆盖', en: 'Clear this event and replace'
                        })}
                      >
                        {done === 'replace' ? tr({ zh: '已替换', en: 'Replaced'
                                                        }) : tr({ zh: '替换', en: 'Replace'
                                                            })}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Row label={tr({ zh: '重算分阶段数据', en: 'Reanalyze stage data'
        })}>
            <button
              className="hint-btn"
              onClick={() => { void onReanalyze(); }}
              disabled={reanalyzeBusy}
              title={tr({ zh: '给旧成绩补上分阶段拆分。新拧的会自动带上，这里用当前识别器重算所有有动作记录的成绩', en: 'Backfill stage splits for older solves. New solves carry them automatically; this reruns the current recognizer over every solve that has recorded moves'
            })}
            >
              <RefreshCw size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {reanalyzeBusy
                ? (reanalyzeProgress && reanalyzeProgress.total > 0
                    ? tr({ zh: `处理中… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}`, en: `Working… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}` })
                    : tr({ zh: '处理中…', en: 'Working…'
                                                      }))
                : tr({ zh: '重新分析', en: 'Reanalyze' })}
            </button>
            {reanalyzeMsg !== null && (
              <span className="hint" role="status" aria-live="polite">{reanalyzeMsg}</span>
            )}
          </Row>
        </SettingsSection>

        <SettingsSection
          category="appearance"
          activeCategory={activeCategory}
          title={tr({ zh: '外观', en: 'Appearance'
        })}
        >
          <Row label={tr({ zh: '计时器字体', en: 'Timer font'
        })}>
            <TimerFontPicker
              value={s.timerFont}
              onChange={(id) => updateSettings({ timerFont: id })}
            />
          </Row>
          <Row label={tr({ zh: '计时器字号', en: 'Timer font scale'
        })}>
            <input
              type="range" min={0.5} max={2} step={0.05}
              value={s.timerFontScale}
              onChange={(e) => updateSettings({ timerFontScale: Number(e.target.value) })}
            />
            <span className="hint">{s.timerFontScale.toFixed(2)}×</span>
          </Row>
          <Row label={tr({ zh: '打乱字体', en: 'Scramble font'
        })}>
            <TimerFontPicker
              value={s.scrambleFont}
              onChange={(id) => updateSettings({ scrambleFont: id })}
              ariaLabel={tr({ zh: '打乱字体', en: 'Scramble font' })}
              preview="R U R' F2"
              options={['liberation', 'mono', 'sans']}
              previewWeight={400}
            />
          </Row>
          <Row label={tr({ zh: '打乱字号', en: 'Scramble font scale'
        })}>
            <input
              type="range" min={0.6} max={2.5} step={0.05}
              value={s.scrambleFontScale}
              onChange={(e) => updateSettings({ scrambleFontScale: Number(e.target.value) })}
            />
            <span className="hint">{s.scrambleFontScale.toFixed(2)}×</span>
          </Row>
          <BooleanRow
            label={tr({ zh: '紧凑打乱', en: 'Compact scramble' })}
            value={s.compactScramble}
            onChange={(v) => updateSettings({ compactScramble: v })}
          />
          <BooleanRow
            label={tr({ zh: '打乱图', en: 'Scramble image' })}
            value={s.showCubePreview}
            onChange={(v) => updateSettings({ showCubePreview: v })}
          />
          <BooleanRow
            label={tr({ zh: '3D 立方体', en: '3D cube' })}
            value={s.prefer3D}
            onChange={(v) => updateSettings({ prefer3D: v })}
            disabled={!s.showCubePreview}
          >
            <span className="hint">{tr({ zh: '可拖动旋转；关闭则展开 2D 平面', en: 'drag to rotate; off = 2D net'
            })}</span>
          </BooleanRow>
          <Row label={tr({ zh: '点击打乱条', en: 'Scramble click action'
        })}>
            <select
              className="settings-row-control-select"
              value={s.scrambleClickAction}
              onChange={(e) => updateSettings({ scrambleClickAction: e.target.value as 'none' | 'next' | 'copy' })}
            >
              <option value="none">{tr({ zh: '无操作', en: 'Nothing'
            })}</option>
              <option value="next">{tr({ zh: '换下一个', en: 'Next scramble'
            })}</option>
              <option value="copy">{tr({ zh: '复制到剪贴板', en: 'Copy to clipboard'
            })}</option>
            </select>
          </Row>
          <BooleanRow
            label={tr({ zh: '运行中隐藏全部 UI', en: 'Hide all UI while running' })}
            value={s.hideAllUiWhileRunning}
            onChange={(v) => updateSettings({ hideAllUiWhileRunning: v })}
          />
          <BooleanRow
            label={tr({ zh: '显示排名', en: 'Show ranks' })}
            value={s.showRankBadge !== false}
            onChange={(v) => updateSettings({ showRankBadge: v })}
          />
          {/* 登录后账号国家就是权威来源(见 useRankCountry),不再让用户手选 —— 只有未登录时
              才需要这一行来手填,顺带给个登录入口。 */}
          {s.showRankBadge !== false && !user && (
            <Row label={tr({ zh: '地区排名', en: 'Ranking region'
          })}>
              {/* placeholder 显式给空:组件默认会兜底成「搜国家名」,这里靠左侧 Row 标签说明即可。 */}
              <CountryInput
                value={(s.rankCountry ?? '').toLowerCase()}
                onChange={(iso2) => updateSettings({ rankCountry: iso2.toUpperCase() })}
                placeholder=""
              />
              <button
                className="hint-btn"
                onClick={() => login()}
                title={tr({ zh: '登录 WCA 自动带入账号国家', en: 'Sign in with WCA to auto-fill your country' })}
              >
                <LogIn size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {tr({ zh: '登录', en: 'Sign in' })}
              </button>
            </Row>
          )}
        </SettingsSection>

        <SettingsSection
          category="training"
          activeCategory={activeCategory}
          title={tr({ zh: '轮次模拟', en: 'Round simulation' })}
          headerControl={
            <PillToggle
              value={s.round.on}
              onChange={(v) => updateSettings({ round: { ...s.round, on: v } })}
              onLabel={tr({ zh: '开启', en: 'On' })}
              offLabel={tr({ zh: '关闭', en: 'Off' })}
              ariaLabel={tr({ zh: '轮次模拟', en: 'Round simulation' })}
            />
          }
        >
          {s.round.on && (
            <>
          <Row label={tr({ zh: '赛制', en: 'Format' })}>
            <select
              className="settings-row-control-select"
              value={s.round.format}
              onChange={(e) => updateSettings({ round: { ...s.round, format: e.target.value as RoundFormat } })}
            >
              <option value="ao5">{tr({ zh: '五次去头尾平均 (ao5)', en: 'Average of 5' })}</option>
              <option value="mo3">{tr({ zh: '三次均值 (mo3)', en: 'Mean of 3' })}</option>
              <option value="bo3">{tr({ zh: '三次取最好 (bo3)', en: 'Best of 3' })}</option>
              <option value="bo1">{tr({ zh: '一次 (bo1)', en: 'Best of 1' })}</option>
            </select>
            <span className="hint">{tr({
              zh: '按真实比赛轮次练习。成绩照常记录，轮次只跟踪最近这一组，不额外存东西',
              en: 'Practise under real round conditions. Solves are recorded as usual — the round is just the most recent group of them',
            })}</span>
          </Row>
          <Row label={tr({ zh: '过关线', en: 'Cutoff' })}>
            <input
              type="text"
              value={roundCutoffInput}
              placeholder={tr({ zh: '留空 = 无', en: 'blank = none' })}
              onChange={(e) => setRoundCutoffInput(e.target.value)}
              onBlur={(e) => commitRoundLimitField('cutoffMs', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRoundLimitField('cutoffMs', (e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
            <span className="hint">{tr({
              zh: `前 ${roundCutoffPhase} 把里至少一把严格快过它，才能继续后面的把数（WCA 9g）`,
              en: `at least one of the first ${roundCutoffPhase} attempts must be strictly faster to continue (WCA 9g)`,
            })}</span>
          </Row>
          <Row label={tr({ zh: '时限', en: 'Time limit' })}>
            <input
              type="text"
              value={roundLimitInput}
              placeholder={tr({ zh: '留空 = 无', en: 'blank = none' })}
              onChange={(e) => setRoundLimitInput(e.target.value)}
              onBlur={(e) => commitRoundLimitField('limitMs', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRoundLimitField('limitMs', (e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
            <PillToggle
              value={s.round.cumulative}
              onChange={(v) => updateSettings({ round: { ...s.round, cumulative: v } })}
              onLabel={tr({ zh: '累计', en: 'cumulative' })}
              offLabel={tr({ zh: '每把', en: 'per attempt' })}
              ariaLabel={tr({ zh: '时限口径', en: 'Time-limit basis' })}
            />
            <span className="hint">{tr({
              zh: '每把 = 单把时限（WCA A1a1）；累计 = 整轮共用一份额度（A1a2），用完后剩余把数记 DNS',
              en: 'per attempt = a limit on each solve (WCA A1a1); cumulative = one budget for the whole round (A1a2) — attempts left once it runs out are DNS',
            })}</span>
          </Row>
            </>
          )}
        </SettingsSection>

        <SettingsSection
          category="advanced"
          activeCategory={activeCategory}
          title={tr({ zh: '快捷键与手势', en: 'Shortcuts and gestures' })}
        >
          <p className="settings-section-note">
            {tr({ zh: '在计时区按住并拖动，可呼出操作轮盘', en: 'Press and drag on the timer to open the action wheel' })}
          </p>
          <KeymapEditor />
            <div className="settings-reset-row">
              <ResetDefaultsButton
                onReset={() => {
                  if (confirm(tr({ zh: '把所有设置恢复为默认值？', en: 'Reset all settings to defaults?' }))) {
                    resetSettings();
                  }
                }}
                title={tr({ zh: '恢复全部计时器设置，不会删除成绩', en: 'Reset all timer settings without deleting solves' })}
              />
            </div>
        </SettingsSection>
          </main>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const labelId = useId();
  return (
    <div className="settings-row">
      <span id={label ? labelId : undefined} className="settings-row-label">{label}</span>
      <span
        className="settings-row-control"
        role={label ? 'group' : undefined}
        aria-labelledby={label ? labelId : undefined}
      >
        {children}
      </span>
    </div>
  );
}

function BooleanRow({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="settings-row settings-row-boolean">
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">
        <SharedBoolToggle value={value} onChange={onChange} label={label} disabled={disabled} />
        {children}
      </span>
    </div>
  );
}

/**
 * Keyboard-binding editor for the rebindable timer actions.
 *
 * Capture-on-press rather than an on-screen keyboard grid: /sim's keymap UI
 * uses a grid because its bindings are one key → one move, but the timer needs
 * `Shift+` combinations, which a flat grid cannot express. `keyLabel` (the part
 * that IS shared) is reused via `formatBinding`.
 *
 * Only Shift is offered as a modifier — Ctrl/Meta belong to the browser and the
 * OS, and shadowing Ctrl+D or Cmd+F would be hostile.
 */
function KeymapEditor() {
  const s = useSettings();
  const keymap = useMemo(() => resolveKeymap(s.keymap), [s.keymap]);
  const [capturing, setCapturing] = useState<TimerActionId | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') { setCapturing(null); setRejected(null); return; }
      // Shift alone isn't a binding — the user is still mid-chord.
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return;
      const binding = bindingForEvent(e);
      if (!binding) {
        setRejected(tr({ zh: 'Ctrl / Cmd / Alt 组合键留给浏览器，不能占用', en: 'Ctrl / Cmd / Alt combinations belong to the browser' }));
        return;
      }
      if (RESERVED_BINDINGS.has(binding)) {
        setRejected(tr({
          zh: `${formatBinding(binding)} 是计时器自己的按键（开始 / 停止 / 取消），不能改绑`,
          en: `${formatBinding(binding)} is the timer's own key (start / stop / cancel) and can't be rebound`,
        }));
        return;
      }
      // Rebinding a key that already has an owner moves it; the old action is
      // left unbound rather than silently firing two things on one press.
      const next: Record<string, TimerActionId | null> = { ...s.keymap };
      for (const [b, a] of Object.entries(keymap)) {
        if (a === capturing) next[b] = null;      // clear this action's old keys
      }
      next[binding] = capturing;
      updateSettings({ keymap: next });
      setCapturing(null);
      setRejected(null);
    };
    // Capture phase: the timer's own window listener must not see these.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, keymap, s.keymap]);

  return (
    <>
      {TIMER_ACTIONS.map(action => {
        const bindings = bindingsForAction(keymap, action.id);
        const active = capturing === action.id;
        return (
          <Row key={action.id} label={tr(action)}>
            <button
              type="button"
              className="keymap-bind-btn"
              data-capturing={active ? 'true' : undefined}
              onClick={() => { setCapturing(active ? null : action.id); setRejected(null); }}
            >
              {active
                ? tr({ zh: '按下新按键…（Esc 取消）', en: 'Press a key… (Esc to cancel)' })
                : bindings.length > 0
                  ? bindings.map(formatBinding).join(' / ')
                  : tr({ zh: '未绑定', en: 'Unbound' })}
            </button>
            {bindings.length > 0 && !active && (
              <button
                type="button"
                className="hint-btn"
                onClick={() => {
                  const next: Record<string, TimerActionId | null> = { ...s.keymap };
                  for (const b of bindings) next[b] = null;
                  updateSettings({ keymap: next });
                }}
              >
                {tr({ zh: '解除', en: 'Unbind' })}
              </button>
            )}
          </Row>
        );
      })}
      {rejected && <div className="keymap-reject">{rejected}</div>}
      <div className="keymap-actions">
        <button
          type="button"
          className="hint-btn"
          onClick={() => updateSettings({ keymap: {} })}
        >
          {tr({ zh: '恢复默认快捷键', en: 'Reset shortcuts to defaults' })}
        </button>
      </div>
    </>
  );
}
