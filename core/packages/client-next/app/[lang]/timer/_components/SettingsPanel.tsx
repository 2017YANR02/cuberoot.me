'use client';

/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CloudDownload, CloudUpload, Download, FileSpreadsheet, LogIn, RefreshCw, Target } from 'lucide-react';
import { formatTargetTime, parseDailySolveGoal, parseTargetTime, resetSettings, updateSettings, useSettings } from '../_lib/settings';
import { warmupSound, play, playInspectionBeep } from '../_lib/sound';
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
import PillToggle from '@/components/PillToggle/PillToggle';
import WcaSourceConfig from './WcaSourceConfig';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

/** 布尔设置统一用 PillToggle 无文字 iOS 风开关,替代裸 checkbox。 */
function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <PillToggle value={value} onChange={onChange} />;
}

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

  const [beepAtInput, setBeepAtInput] = useState<string>(() => (s.inspectionBeepAt ?? []).join(','));
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
      flashCloudMsg(i18n.language === 'zh-Hant' ? (`已上傳 ${solveCount} 條到雲端`) : (isZh ? `已上传 ${solveCount} 条到云端` : `Uploaded ${solveCount} solves`));
    } catch {
      flashCloudMsg(tr({ zh: '上传失败,请重试', en: 'Upload failed, try again',
          zhHant: "上傳失敗,請重試"
    }));
    } finally {
      setCloudBusy(false);
    }
  }

  async function onCloudRestore(): Promise<void> {
    const ok = window.confirm(tr({ zh: '将用云端备份覆盖本地全部成绩,本地未上传的成绩会丢失。确定继续?', en: 'This replaces ALL local solves with the cloud backup. Unsynced local solves will be lost. Continue?',
        zhHant: "將用雲端備份覆蓋本地全部成績,本地未上傳的成績會丟失。確定繼續?"
    }));
    if (!ok) return;
    setCloudBusy(true);
    try {
      const result = await restoreFromCloud();
      if (result === 'ok') {
        onDataReplaced?.();
        flashCloudMsg(tr({ zh: '已从云端恢复', en: 'Restored from cloud',
            zhHant: "已從雲端恢復"
        }));
      } else if (result === 'invalid') {
        flashCloudMsg(tr({ zh: '云端备份损坏,无法恢复', en: 'Cloud backup is corrupt',
            zhHant: "雲端備份損壞,無法恢復"
        }));
      } else {
        flashCloudMsg(tr({ zh: '云端暂无备份', en: 'No cloud backup yet',
            zhHant: "雲端暫無備份"
        }));
      }
    } catch {
      flashCloudMsg(tr({ zh: '恢复失败,请重试', en: 'Restore failed, try again',
          zhHant: "恢復失敗,請重試"
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
      const msg = i18n.language === 'zh-Hant' ? (`已更新 ${result.updated} 條成績，涉及 ${result.eventsTouched.length} 個項目`) : (isZh
              ? `已更新 ${result.updated} 条成绩，涉及 ${result.eventsTouched.length} 个项目`
              : `Updated ${result.updated} solves across ${result.eventsTouched.length} events`);
      setReanalyzeMsg(msg);
      if (reanalyzeMsgTimerRef.current !== null) window.clearTimeout(reanalyzeMsgTimerRef.current);
      reanalyzeMsgTimerRef.current = window.setTimeout(() => {
        setReanalyzeMsg(null);
        reanalyzeMsgTimerRef.current = null;
      }, 2000);
    } catch {
      setReanalyzeMsg(tr({ zh: '重算失败', en: 'Reanalyze failed',
          zhHant: "重算失敗"
    }));
    } finally {
      setReanalyzeBusy(false);
      setReanalyzeProgress(null);
    }
  }

  async function onCstimerExport(): Promise<void> {
    try {
      const { json, solveCount, sessionCount } = await exportCstimerJson();
      if (solveCount === 0) {
        alert(tr({ zh: '当前没有可导出的成绩。', en: 'No solves to export.',
            zhHant: "當前沒有可匯出的成績。"
        }));
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
      const msg = i18n.language === 'zh-Hant' ? (`已匯出 ${solveCount} 條成績（${sessionCount} 個會話）`) : (isZh
              ? `已导出 ${solveCount} 条成绩（${sessionCount} 个会话）`
              : `Exported ${solveCount} solves across ${sessionCount} sessions`);
      setCstimerExportMsg(msg);
      if (cstimerExportTimerRef.current !== null) window.clearTimeout(cstimerExportTimerRef.current);
      cstimerExportTimerRef.current = window.setTimeout(() => {
        setCstimerExportMsg(null);
        cstimerExportTimerRef.current = null;
      }, 1500);
    } catch {
      alert(tr({ zh: '导出失败。', en: 'Export failed.',
          zhHant: "匯出失敗。"
    }));
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
      const msg = i18n.language === 'zh-Hant' ? (`已匯出 ${solveCount} 條成績`) : (isZh
              ? `已导出 ${solveCount} 条成绩`
              : `Exported ${solveCount} solves`);
      setCsvExportMsg(msg);
      if (csvExportTimerRef.current !== null) window.clearTimeout(csvExportTimerRef.current);
      csvExportTimerRef.current = window.setTimeout(() => {
        setCsvExportMsg(null);
        csvExportTimerRef.current = null;
      }, 1500);
    } catch {
      alert(tr({ zh: '导出失败。', en: 'Export failed.',
          zhHant: "匯出失敗。"
    }));
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
        alert(tr({ zh: '未识别为 csTimer 导出文件。', en: 'Not a recognized csTimer export.',
            zhHant: "未識別為 csTimer 匯出檔案。"
        }));
        return;
      }
      setCstimerSessions(sessions);
      setCstimerImported({});
    };
    reader.onerror = () => {
      alert(tr({ zh: '读取文件失败。', en: 'Failed to read file.',
          zhHant: "讀取檔案失敗。"
    }));
    };
    reader.readAsText(file);
  }

  function importCstimerSession(sess: CstimerSessionParsed, mode: 'append' | 'replace'): void {
    if (sess.solves.length === 0) {
      alert(tr({ zh: '该会话没有可导入的成绩。', en: 'This session has no solves.',
          zhHant: "該會話沒有可匯入的成績。"
    }));
      return;
    }
    if (mode === 'replace') {
      const confirmMsg = i18n.language === 'zh-Hant' ? (`確認用 ${sess.solves.length} 條記錄替換 ${eventInfo(sess.event).nameZh} 的全部成績？`) : (isZh
              ? `确认用 ${sess.solves.length} 条记录替换 ${eventInfo(sess.event).nameZh} 的全部成绩？`
              : `Replace all ${eventInfo(sess.event).nameEn} solves with ${sess.solves.length} from "${sess.name}"?`);
      if (!confirm(confirmMsg)) return;
      replaceSolves(sess.event, sess.solves);
    } else {
      appendSolves(sess.event, sess.solves);
    }
    setCstimerImported(prev => ({ ...prev, [sess.sessionId]: mode }));
    alert(tr({ zh: '已导入。请刷新页面以查看更新后的成绩。', en: 'Imported. Please reload the page to see the updated solves.',
        zhHant: "已匯入。請重新整理頁面以檢視更新後的成績。"
    }));
  }

  function showBackupPicker(): void {
    const list = listBackups();
    if (list.length === 0) {
      alert(tr({ zh: '尚无自动备份。', en: 'No auto-backups yet.',
          zhHant: "尚無自動備份。"
    }));
      return;
    }
    const lines = list.map((e, i) => {
      const d = new Date(e.ts);
      const stamp = d.toISOString().replace('T', ' ').slice(0, 19);
      const kb = (e.size / 1024).toFixed(1);
      return `${i + 1}. ${stamp}  (${kb} KB)`;
    }).join('\n');
    const prompt1 = i18n.language === 'zh-Hant' ? (`備份列表（輸入序號恢復，留空取消）：\n\n${lines}`) : (isZh
          ? `备份列表（输入序号恢复，留空取消）：\n\n${lines}`
          : `Auto-backups (enter index to restore, blank to cancel):\n\n${lines}`);
    const ans = window.prompt(prompt1, '');
    if (!ans) return;
    const idx = parseInt(ans, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      alert(tr({ zh: '无效序号。', en: 'Invalid index.',
          zhHant: "無效序號。"
    }));
      return;
    }
    const target = list[idx]!;
    if (!confirm(i18n.language === 'zh-Hant' ? (`確認用 ${new Date(target.ts).toLocaleString()} 的備份覆蓋當前資料？`) : (isZh
              ? `确认用 ${new Date(target.ts).toLocaleString()} 的备份覆盖当前数据？`
              : `Restore backup from ${new Date(target.ts).toLocaleString()} (overwrites current data)?`))) return;
    const ok = restoreBackup(target.key);
    alert(ok
      ? (tr({ zh: '已恢复。请刷新页面。', en: 'Restored. Please reload the page.',
          zhHant: "已恢復。請重新整理頁面。"
    }))
      : (tr({ zh: '恢复失败。', en: 'Restore failed.',
          zhHant: "恢復失敗。"
    })));
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
        <h2 id="settings-modal-title">{tr({ zh: '设置', en: 'Settings',
            zhHant: "設定"
        })}</h2>

        <p className="settings-gesture-hint">
          {tr({ zh: '按住并拖动呼出轮盘', en: 'Press & drag to open the wheel',
              zhHant: "按住並拖動撥出輪盤"
        })}
        </p>

        <AccordionSection
          id="scramble-source"
          title={tr({ zh: '打乱来源', en: 'Scramble source',
              zhHant: "打亂來源"
        })}
          defaultExpanded={true}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '来源', en: 'Source',
              zhHant: "來源"
        })}>
            <select
              value={s.scrambleSource}
              onChange={(e) => updateSettings({ scrambleSource: e.target.value as 'random' | 'wca' })}
            >
              <option value="wca">{tr({ zh: 'WCA 真实比赛打乱', en: 'Real WCA comp scrambles',
                  zhHant: "WCA 真實比賽打亂"
            })}</option>
              <option value="random">{tr({ zh: '随机生成', en: 'Random',
                  zhHant: "隨機生成"
            })}</option>
            </select>
          </Row>
          {s.scrambleSource === 'wca' && (
            <WcaSourceConfig isZh={isZh} event={event} settings={s} updateSettings={updateSettings} />
          )}
        </AccordionSection>

        <AccordionSection
          id="timing"
          title={tr({ zh: '计时', en: 'Timing',
              zhHant: "計時"
        })}
          defaultExpanded={true}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '观察时间（秒）', en: 'Inspection (sec)',
              zhHant: "觀察時間（秒）"
        })}>
            <input
              type="number" min={0} max={60}
              value={s.inspection}
              onChange={(e) => updateSettings({ inspection: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            />
            <span className="hint">{s.inspection === 0 ? (tr({ zh: '关闭', en: 'off',
                zhHant: "關閉"
            })) : (isZh ? `${s.inspection} 秒（>${s.inspection}s = +2，>${s.inspection + 2}s = DNF）` : `${s.inspection}s (>${s.inspection}s = +2, >${s.inspection + 2}s = DNF)`)}</span>
          </Row>
          <Row label={tr({ zh: '按住阈值（毫秒）', en: 'Hold threshold (ms)',
              zhHant: "按住閾值（毫秒）"
        })}>
            <input
              type="number" min={100} max={2000} step={50}
              value={s.holdMs}
              onChange={(e) => updateSettings({ holdMs: Math.max(100, Math.min(2000, Number(e.target.value) || 550)) })}
            />
          </Row>
          <Row label={tr({ zh: '观察启动方式', en: 'Inspection trigger',
              zhHant: "觀察啟動方式"
        })}>
            <select
              value={s.inspectionTrigger}
              onChange={(e) => updateSettings({ inspectionTrigger: e.target.value as 'down' | 'up' })}
            >
              <option value="down">{tr({ zh: '按下', en: 'Press down' })}</option>
              <option value="up">{tr({ zh: '松开', en: 'Release',
                  zhHant: "鬆開"
            })}</option>
            </select>
            <span className="hint">{tr({ zh: '按下：立即进入观察；松开：松开空格后才进入（Stackmat 习惯）', en: 'down: enter on press; up: enter on release (stackmat-style)',
                zhHant: "按下：立即進入觀察；鬆開：鬆開空格後才進入（Stackmat 習慣）"
            })}</span>
          </Row>
          <Row label={tr({ zh: '蓝牙自动 ready', en: 'Bluetooth auto-ready',
              zhHant: "藍芽自動 ready"
        })}>
            <select
              value={s.bluetoothAutoReady}
              onChange={(e) => updateSettings({ bluetoothAutoReady: e.target.value as 'off' | 'still' | 'double-flick' })}
            >
              <option value="off">{tr({ zh: '关闭', en: 'Off',
                  zhHant: "關閉"
            })}</option>
              <option value="still">{tr({ zh: '静止 2 秒', en: 'Still 2s',
                  zhHant: "靜止 2 秒"
            })}</option>
              <option value="double-flick">{tr({ zh: "双反扭 (U U')²", en: "Double-flick (U U')²",
                  zhHant: "雙反扭 (U U')²"
            })}</option>
            </select>
            <span className="hint">{tr({ zh: "still = 解完后保持 2 秒不动；double-flick = 解完后做 U U' U U' 确认", en: "still = solved + 2s no move; double-flick = perform U U' U U' to confirm",
                zhHant: "still = 解完後保持 2 秒不動；double-flick = 解完後做 U U' U U' 確認"
            })}</span>
          </Row>
          <Row label={tr({ zh: '隐藏运行中的时间', en: 'Hide time while running',
              zhHant: "隱藏執行中的時間"
        })}>
            <BoolToggle value={s.hideTime} onChange={(v) => updateSettings({ hideTime: v })} />
          </Row>
          <Row label={tr({ zh: 'CFOP 分阶段计时', en: 'CFOP stage splits',
              zhHant: "CFOP 分階段計時"
        })}>
            <BoolToggle value={s.multiStage} onChange={(v) => updateSettings({ multiStage: v })} />
            <span className="hint">{tr({ zh: '按 1=Cross 完成，2=F2L，3=OLL；蓝牙连接时自动检测', en: 'Press 1=Cross, 2=F2L, 3=OLL; auto-detected when bluetooth connected',
                zhHant: "按 1=Cross 完成，2=F2L，3=OLL；藍芽連線時自動檢測"
            })}</span>
          </Row>
          <Row label={tr({ zh: '盲拧记忆 / 执行分段', en: 'BLD memo split',
              zhHant: "盲擰記憶 / 執行分段"
        })}>
            <BoolToggle value={s.bldMemo} onChange={(v) => updateSettings({ bldMemo: v })} />
            <span className="hint">{tr({ zh: '盲拧项目运行中按 Enter 标记记忆完成', en: 'On BLD events, press Enter while running to mark memo done',
                zhHant: "盲擰項目執行中按 Enter 標記記憶完成"
            })}</span>
          </Row>
          <Row label={tr({ zh: '目标时间', en: 'Target time',
              zhHant: "目標時間"
        })}>
            <input
              type="text"
              value={targetInput}
              placeholder={tr({ zh: '例：0:10.50（留空关闭）', en: 'e.g. 0:10.50 (blank = off)',
                  zhHant: "例：0:10.50（留空關閉）"
            })}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={(e) => commitTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTargetInput((e.target as HTMLInputElement).value); }}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
            <span className="hint">
              <Target size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {currentTargetMs === null
                ? (i18n.language === 'zh-Hant' ? (`當前 ${eventInfo(event).nameZh}：關閉`) : (isZh ? `当前 ${eventInfo(event).nameZh}：关闭` : `${eventInfo(event).nameEn}: off`))
                : (i18n.language === 'zh-Hant' ? (`當前 ${eventInfo(event).nameZh}：${formatTargetTime(currentTargetMs)}`) : (isZh ? `当前 ${eventInfo(event).nameZh}：${formatTargetTime(currentTargetMs)}` : `${eventInfo(event).nameEn}: ${formatTargetTime(currentTargetMs)}`))}
            </span>
          </Row>
          <Row label={tr({ zh: '每日目标次数', en: 'Daily solve goal',
              zhHant: "每日目標次數"
        })}>
            <input
              type="number"
              min={0}
              step={1}
              value={goalInput}
              placeholder={tr({ zh: '例：50（留空 / 0 关闭）', en: 'e.g. 50 (blank / 0 = off)',
                  zhHant: "例：50（留空 / 0 關閉）"
            })}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={(e) => commitGoalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitGoalInput((e.target as HTMLInputElement).value); }}
            />
            <span className="hint">{currentDailyGoal === null
              ? (tr({ zh: '关闭', en: 'off',
                  zhHant: "關閉"
            }))
              : (i18n.language === 'zh-Hant' ? (`每天 ${currentDailyGoal} 次（全部項目合計）`) : (isZh ? `每天 ${currentDailyGoal} 次（全部项目合计）` : `${currentDailyGoal} solves/day (all events)`))}</span>
          </Row>
          <Row label={tr({ zh: '计时途中精度', en: 'Live precision',
              zhHant: "計時途中精度"
        })}>
            <select
              value={s.runningPrecision}
              onChange={(e) => updateSettings({ runningPrecision: Number(e.target.value) as 0 | 1 | 2 | 3 })}
            >
              <option value={0}>{tr({ zh: '整数秒 (x)', en: 'whole sec (x)',
                  zhHant: "整數秒 (x)"
            })}</option>
              <option value={1}>{tr({ zh: '0.1 秒 (x.x)', en: '0.1s (x.x)' })}</option>
              <option value={2}>{tr({ zh: '0.01 秒 (x.xx)', en: '0.01s (x.xx)' })}</option>
              <option value={3}>{tr({ zh: '0.001 秒 (x.xxx)', en: '0.001s (x.xxx)' })}</option>
            </select>
          </Row>
          <Row label={tr({ zh: '最终成绩精度', en: 'Final precision',
              zhHant: "最終成績精度"
        })}>
            <select
              value={s.precision}
              onChange={(e) => updateSettings({ precision: Number(e.target.value) as 2 | 3 })}
            >
              <option value={2}>{tr({ zh: '0.01 秒 (x.xx)', en: '0.01s (x.xx)' })}</option>
              <option value={3}>{tr({ zh: '0.001 秒 (x.xxx)', en: '0.001s (x.xxx)' })}</option>
            </select>
          </Row>
          <Row label={tr({ zh: '颜色中立', en: 'Color neutral',
              zhHant: "顏色中立"
        })}>
            <select
              value={s.cnMode}
              onChange={(e) => updateSettings({ cnMode: e.target.value as 'none' | 'single' | 'dual' | 'six' })}
            >
              <option value="none">{tr({ zh: '固定白底', en: 'None (white)' })}</option>
              <option value="single">{tr({ zh: '单面随机', en: 'Single (random)',
                  zhHant: "單面隨機"
            })}</option>
              <option value="dual">{tr({ zh: '双面（白黄）', en: 'Dual (white/yellow)',
                  zhHant: "雙面（白黃）"
            })}</option>
              <option value="six">{tr({ zh: '六面', en: 'Six-sided' })}</option>
            </select>
            <span className="hint">{tr({ zh: '仅 3x3 类项目生效', en: '3x3 events only',
                zhHant: "僅 3x3 類項目生效"
            })}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="sound"
          title={tr({ zh: '声音', en: 'Sound',
              zhHant: "聲音"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '提示音', en: 'Sounds' })}>
            <BoolToggle value={s.soundsEnabled} onChange={(v) => { updateSettings({ soundsEnabled: v }); if (v) warmupSound(); }} />
          </Row>
          <Row label={tr({ zh: '音量', en: 'Volume' })}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={s.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            />
            <button
              className="hint-btn"
              onClick={() => play('start')}
              title={tr({ zh: '试听', en: 'Test',
                  zhHant: "試聽"
            })}
            >
              ♪
            </button>
          </Row>
          <Row label={tr({ zh: '语音观察', en: 'Voice inspection',
              zhHant: "語音觀察"
        })}>
            <select
              value={s.voiceInspection}
              onChange={(e) => {
                updateSettings({ voiceInspection: e.target.value as 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female' });
                warmupSound();
              }}
              disabled={!isVoiceAvailable()}
            >
              <option value="none">{tr({ zh: '关闭（用提示音）', en: 'Off (beeps)',
                  zhHant: "關閉（用提示音）"
            })}</option>
              <option value="en-male">{tr({ zh: '英文 男声', en: 'English (male)',
                  zhHant: "英文 男聲"
            })}</option>
              <option value="en-female">{tr({ zh: '英文 女声', en: 'English (female)',
                  zhHant: "英文 女聲"
            })}</option>
              <option value="zh-male">{tr({ zh: '中文 男声', en: 'Chinese (male)',
                  zhHant: "中文 男聲"
            })}</option>
              <option value="zh-female">{tr({ zh: '中文 女声', en: 'Chinese (female)',
                  zhHant: "中文 女聲"
            })}</option>
            </select>
            <span className="hint">{isVoiceAvailable()
              ? (tr({ zh: '念 8 秒 / 12 秒 / 开始（依系统可用音色）', en: 'reads 8s / 12s / go (depends on system voices)',
                  zhHant: "念 8 秒 / 12 秒 / 開始（依系統可用音色）"
            }))
              : (tr({ zh: '浏览器不支持', en: 'unsupported by browser',
                  zhHant: "瀏覽器不支援"
            }))}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="metronome"
          title={tr({ zh: '节拍器', en: 'Metronome',
              zhHant: "節拍器"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '开启', en: 'Enabled',
              zhHant: "開啟"
        })}>
            <BoolToggle value={s.metronomeOn} onChange={(v) => { updateSettings({ metronomeOn: v }); if (v) warmupSound(); }} />
            <span className="hint">{tr({ zh: '观察 / 计时阶段播放', en: 'ticks during inspection / solve',
                zhHant: "觀察 / 計時階段播放"
            })}</span>
          </Row>
          <Row label={tr({ zh: '速度（BPM）', en: 'Tempo (BPM)' })}>
            <input
              type="range" min={30} max={300} step={1}
              value={s.metronomeBpm}
              onChange={(e) => updateSettings({ metronomeBpm: Math.max(30, Math.min(300, Number(e.target.value) || 120)) })}
            />
            <span className="hint" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '3ch', display: 'inline-block' }}>{s.metronomeBpm}</span>
            <button
              className="hint-btn"
              onClick={tapBpm}
              title={tr({ zh: '连续敲击设定速度', en: 'Tap repeatedly to set tempo',
                  zhHant: "連續敲擊設定速度"
            })}
            >
              {tr({ zh: '敲击', en: 'Tap',
                  zhHant: "敲擊"
            })}
            </button>
            {tapBpmHint !== null && (
              <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>→ {tapBpmHint}</span>
            )}
            <span className="hint">{tr({ zh: '离开本页时自动停止', en: 'auto-stops on page leave',
                zhHant: "離開本頁時自動停止"
            })}</span>
          </Row>
          <Row label={tr({ zh: '观察提示音（秒）', en: 'Beep at (sec)',
              zhHant: "觀察提示音（秒）"
        })}>
            <input
              type="text"
              value={beepAtInput}
              placeholder={tr({ zh: '例：5,10,15（逗号分隔）', en: 'e.g. 5,10,15 (comma-separated)',
                  zhHant: "例：5,10,15（逗號分隔）"
            })}
              onChange={(e) => setBeepAtInput(e.target.value)}
              onBlur={(e) => commitBeepAtInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitBeepAtInput((e.target as HTMLInputElement).value); }}
            />
            <button className="hint-btn" onClick={() => { warmupSound(); playInspectionBeep(); }} title={tr({ zh: '试听', en: 'Test',
                zhHant: "試聽"
            })}>
              {tr({ zh: '试听', en: 'Test',
                  zhHant: "試聽"
            })}
            </button>
            <span className="hint">{i18n.language === 'zh-Hant' ? (`觀察到這些秒數各響一聲（1..60，獨立於 8/12 秒）；當前 ${(s.inspectionBeepAt ?? []).length ? s.inspectionBeepAt.join(' / ') + ' 秒' : '關閉'}`) : (isZh
                                    ? `观察到这些秒数各响一声（1..60，独立于 8/12 秒）；当前 ${(s.inspectionBeepAt ?? []).length ? s.inspectionBeepAt.join(' / ') + ' 秒' : '关闭'}`
                                    : `one beep at each inspection second (1..60, separate from 8/12s); current ${(s.inspectionBeepAt ?? []).length ? s.inspectionBeepAt.join(' / ') + 's' : 'off'}`)}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="sync-seed"
          title={tr({ zh: '同步种子', en: 'Sync seed',
              zhHant: "同步種子"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '种子', en: 'Seed',
              zhHant: "種子"
        })}>
            <input
              type="text"
              value={seedDraft}
              placeholder={tr({ zh: '任意字符串', en: 'any string',
                  zhHant: "任意字串"
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
              {tr({ zh: '应用', en: 'Apply',
                  zhHant: "應用"
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
          <Row label={tr({ zh: '当前', en: 'Current',
              zhHant: "當前"
        })}>
            <span className="hint" title={String(seedTick)}>
              {s.syncSeed === null
                ? (tr({ zh: '未启用', en: 'off',
                    zhHant: "未啟用"
                }))
                : (i18n.language === 'zh-Hant' ? (`seed=${s.syncSeed}，第 ${getSeedCounter()} 個打亂`) : (isZh
                                                  ? `seed=${s.syncSeed}，第 ${getSeedCounter()} 个打乱`
                                                  : `seed=${s.syncSeed}, scramble #${getSeedCounter()}`))}
            </span>
            <button
              className="hint-btn"
              onClick={() => { resetSeedCounter(); setSeedTick((t) => t + 1); }}
              disabled={s.syncSeed === null}
            >
              {tr({ zh: '重置计数', en: 'Reset counter',
                  zhHant: "重置計數"
            })}
            </button>
          </Row>
          <Row label="">
            <span className="hint">{tr({ zh: '相同种子在不同设备打出相同序列；计数会跨刷新保留', en: 'same seed → same sequence across devices; counter persists across reloads',
                zhHant: "相同種子在不同裝置打出相同序列；計數會跨重新整理保留"
            })}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="auto-backup"
          title={tr({ zh: '自动备份', en: 'Auto-backup',
              zhHant: "自動備份"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '每 N 次写入触发', en: 'Every N saves',
              zhHant: "每 N 次寫入觸發"
        })}>
            <input
              type="number" min={0} max={30} step={1}
              value={s.autoBackupEvery}
              onChange={(e) => updateSettings({ autoBackupEvery: Math.max(0, Math.min(30, Number(e.target.value) | 0)) })}
            />
            <span className="hint">{s.autoBackupEvery === 0
              ? (tr({ zh: '已禁用', en: 'disabled' }))
              : (tr({ zh: '保留最近 10 份', en: 'keeps last 10' }))}</span>
          </Row>
          <Row label={tr({ zh: '操作', en: 'Actions' })}>
            <button className="hint-btn" onClick={() => { pushBackup(); alert(tr({ zh: '已写入备份。', en: 'Backup written.',
                zhHant: "已寫入備份。"
            })); }}>
              {tr({ zh: '立即备份', en: 'Back up now',
                  zhHant: "立即備份"
            })}
            </button>
            <button className="hint-btn" onClick={showBackupPicker}>
              {tr({ zh: '查看备份', en: 'View backups',
                  zhHant: "檢視備份"
            })}
            </button>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="cloud"
          title={tr({ zh: '云备份', en: 'Cloud backup',
              zhHant: "雲備份"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          {!user ? (
            <Row label={tr({ zh: '登录', en: 'Sign in',
                zhHant: "登入"
            })}>
              <button className="hint-btn" onClick={() => login()}>
                <LogIn size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {tr({ zh: '登录后备份到云端', en: 'Sign in to back up',
                    zhHant: "登入後備份到雲端"
                })}
              </button>
              <span className="hint">{tr({ zh: '用 WCA 账号登录,即可把全部成绩存到云端,在其它设备恢复', en: 'Sign in with WCA to store all solves in the cloud and restore them on other devices',
                  zhHant: "用 WCA 賬號登入,即可把全部成績存到雲端,在其它裝置恢復"
            })}</span>
            </Row>
          ) : (
            <>
              <Row label={tr({ zh: '操作', en: 'Actions' })}>
                <button
                  className="hint-btn"
                  disabled={cloudBusy}
                  onClick={() => { void onCloudUpload(); }}
                  title={tr({ zh: '把本地全部成绩上传到云端(覆盖云端旧备份)', en: 'Upload all local solves to the cloud (replaces the cloud copy)',
                      zhHant: "把本地全部成績上傳到雲端(覆蓋雲端舊備份)"
                })}
                >
                  <CloudUpload size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {tr({ zh: '上传到云端', en: 'Upload to cloud',
                      zhHant: "上傳到雲端"
                })}
                </button>
                <button
                  className="hint-btn"
                  disabled={cloudBusy}
                  onClick={() => { void onCloudRestore(); }}
                  title={tr({ zh: '用云端备份覆盖本地全部成绩', en: 'Replace all local solves with the cloud backup',
                      zhHant: "用雲端備份覆蓋本地全部成績"
                })}
                >
                  <CloudDownload size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {tr({ zh: '从云端恢复', en: 'Restore from cloud',
                      zhHant: "從雲端恢復"
                })}
                </button>
              </Row>
              <Row label="">
                <span className="hint">{
                  cloudMsg !== null
                    ? cloudMsg
                    : cloudMeta === null
                      ? (tr({ zh: '正在读取云端状态…', en: 'Checking cloud…',
                          zhHant: "正在讀取雲端狀態…"
                    }))
                      : cloudMeta.exists
                        ? (i18n.language === 'zh-Hant' ? (`雲端 ${cloudMeta.solveCount ?? 0} 條,上次同步 ${formatSyncTime(cloudMeta.updatedAt ?? 0, true)}`) : (isZh
                                                                              ? `云端 ${cloudMeta.solveCount ?? 0} 条,上次同步 ${formatSyncTime(cloudMeta.updatedAt ?? 0, true)}`
                                                                              : `Cloud: ${cloudMeta.solveCount ?? 0} solves, synced ${formatSyncTime(cloudMeta.updatedAt ?? 0, false)}`))
                        : (tr({ zh: '云端暂无备份', en: 'No cloud backup yet',
                            zhHant: "雲端暫無備份"
                        }))
                }</span>
              </Row>
              <Row label="">
                <span className="hint">{tr({ zh: '恢复会用云端整库覆盖本地(含所有会话);计时器设置项不在备份内。', en: 'Restore replaces ALL local sessions with the cloud copy; timer settings are not included.',
                    zhHant: "恢復會用雲端整庫覆蓋本地(含所有會話);計時器設定項不在備份內。"
                })}</span>
              </Row>
            </>
          )}
        </AccordionSection>

        <AccordionSection
          id="cstimer-io"
          title={tr({ zh: '从 csTimer 导入 / 导出', en: 'csTimer import / export',
              zhHant: "從 csTimer 匯入 / 匯出"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '选择 JSON 文件', en: 'Choose JSON file',
              zhHant: "選擇 JSON 檔案"
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
              {tr({ zh: '选择文件…', en: 'Choose file…',
                  zhHant: "選擇檔案…"
            })}
            </button>
            <span className="hint">{tr({ zh: '导出来源：csTimer → Local backup → Export', en: 'From csTimer → Local backup → Export',
                zhHant: "匯出來源：csTimer → Local backup → Export"
            })}</span>
          </Row>
          <Row label={tr({ zh: '导出所有成绩', en: 'Export all solves',
              zhHant: "匯出所有成績"
        })}>
            <button
              className="hint-btn"
              onClick={() => { void onCstimerExport(); }}
              title={tr({ zh: '下载所有成绩为 csTimer 兼容的 JSON', en: 'Download all solves as a csTimer-compatible JSON',
                  zhHant: "下載所有成績為 csTimer 相容的 JSON"
            })}
            >
              <Download size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {isZh ? 'csTimer JSON' : 'csTimer JSON'}
            </button>
            <button
              className="hint-btn"
              onClick={onCsvExport}
              title={tr({ zh: '每条成绩一行的 CSV，便于 Excel / Python 分析', en: 'One row per solve, for spreadsheets / Python',
                  zhHant: "每條成績一行的 CSV，便於 Excel / Python 分析"
            })}
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
                const evLabel = i18n.language === 'zh-Hant' ? (ev.nameZhHant ?? ev.nameZh) : (isZh ? ev.nameZh : ev.nameEn);
                const done = cstimerImported[sess.sessionId];
                const disabled = sess.solves.length === 0;
                return (
                  <div key={sess.sessionId} className="cstimer-import-row">
                    <div className="cstimer-import-info">
                      <span className="cstimer-import-name">{sess.name}</span>
                      <span className="hint">
                        {i18n.language === 'zh-Hant' ? (`${sess.solves.length} 條 → ${evLabel}${sess.matched ? '' : '（預設）'}`) : (isZh
                                                          ? `${sess.solves.length} 条 → ${evLabel}${sess.matched ? '' : '（默认）'}`
                                                          : `${sess.solves.length} solves → ${evLabel}${sess.matched ? '' : ' (fallback)'}`)}
                      </span>
                    </div>
                    <div className="cstimer-import-actions">
                      <button
                        className="hint-btn"
                        disabled={disabled || done === 'append'}
                        onClick={() => importCstimerSession(sess, 'append')}
                        title={tr({ zh: '追加到现有成绩', en: 'Append to existing solves',
                            zhHant: "追加到現有成績"
                        })}
                      >
                        {done === 'append' ? (tr({ zh: '已追加', en: 'Appended' })) : (tr({ zh: '追加', en: 'Append' }))}
                      </button>
                      <button
                        className="hint-btn"
                        disabled={disabled || done === 'replace'}
                        onClick={() => importCstimerSession(sess, 'replace')}
                        title={tr({ zh: '清空该项目并以此覆盖', en: 'Clear this event and replace',
                            zhHant: "清空該項目並以此覆蓋"
                        })}
                      >
                        {done === 'replace' ? (tr({ zh: '已替换', en: 'Replaced',
                            zhHant: "已替換"
                        })) : (tr({ zh: '替换', en: 'Replace',
                            zhHant: "替換"
                        }))}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Row label={tr({ zh: '重算分阶段数据', en: 'Reanalyze stage data',
              zhHant: "重算分階段資料"
        })}>
            <button
              className="hint-btn"
              onClick={() => { void onReanalyze(); }}
              disabled={reanalyzeBusy}
              title={tr({ zh: '基于当前精确识别器，重新计算所有有移动记录的成绩的分阶段拆分', en: 'Rerun the current exact recognizer over every solve that has recorded moves',
                  zhHant: "基於當前精確識別器，重新計算所有有移動記錄的成績的分階段拆分"
            })}
            >
              <RefreshCw size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {reanalyzeBusy
                ? (reanalyzeProgress && reanalyzeProgress.total > 0
                    ? (i18n.language === 'zh-Hant' ? (`處理中… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}`) : (isZh
                                                          ? `处理中… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}`
                                                          : `Working… ${reanalyzeProgress.scanned}/${reanalyzeProgress.total}`))
                    : (tr({ zh: '处理中…', en: 'Working…',
                        zhHant: "處理中…"
                    })))
                : (tr({ zh: '重新分析', en: 'Reanalyze' }))}
            </button>
            {reanalyzeMsg !== null && (
              <span className="hint">{reanalyzeMsg}</span>
            )}
          </Row>
        </AccordionSection>

        <AccordionSection
          id="appearance"
          title={tr({ zh: '外观', en: 'Appearance',
              zhHant: "外觀"
        })}
          defaultExpanded={false}
          useMobile={isMobile}
          expanded={expandedSections}
          setExpanded={setExpandedSections}
        >
          <Row label={tr({ zh: '主题', en: 'Theme',
              zhHant: "主題"
        })}>
            <select
              value={s.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' | 'auto' })}
            >
              <option value="dark">{tr({ zh: '深色', en: 'Dark' })}</option>
              <option value="light">{tr({ zh: '浅色', en: 'Light',
                  zhHant: "淺色"
            })}</option>
              <option value="auto">{tr({ zh: '跟随系统', en: 'Auto',
                  zhHant: "跟隨系統"
            })}</option>
            </select>
          </Row>
          <Row label={tr({ zh: '计时器字号', en: 'Timer font scale',
              zhHant: "計時器字號"
        })}>
            <input
              type="range" min={0.5} max={2} step={0.05}
              value={s.timerFontScale}
              onChange={(e) => updateSettings({ timerFontScale: Number(e.target.value) })}
            />
            <span className="hint">{s.timerFontScale.toFixed(2)}×</span>
          </Row>
          <Row label={tr({ zh: '打乱字号', en: 'Scramble font scale',
              zhHant: "打亂字號"
        })}>
            <input
              type="range" min={0.6} max={2.5} step={0.05}
              value={s.scrambleFontScale}
              onChange={(e) => updateSettings({ scrambleFontScale: Number(e.target.value) })}
            />
            <span className="hint">{s.scrambleFontScale.toFixed(2)}×</span>
          </Row>
          <Row label={tr({ zh: '紧凑打乱', en: 'Compact scramble',
              zhHant: "緊湊打亂"
        })}>
            <BoolToggle value={s.compactScramble} onChange={(v) => updateSettings({ compactScramble: v })} />
          </Row>
          <Row label={tr({ zh: '打乱图', en: 'Scramble image',
              zhHant: "打亂圖"
        })}>
            <BoolToggle value={s.showCubePreview} onChange={(v) => updateSettings({ showCubePreview: v })} />
          </Row>
          <Row label={tr({ zh: '3D 立方体', en: '3D cube',
              zhHant: "3D 立方體"
        })}>
            <BoolToggle value={s.prefer3D} onChange={(v) => updateSettings({ prefer3D: v })} />
            <span className="hint">{tr({ zh: '可拖动旋转；关闭则展开 2D 平面', en: 'drag to rotate; off = 2D net',
                zhHant: "可拖動旋轉；關閉則展開 2D 平面"
            })}</span>
          </Row>
          <Row label={tr({ zh: '显示图表', en: 'Show charts',
              zhHant: "顯示圖表"
        })}>
            <BoolToggle value={s.showCharts} onChange={(v) => updateSettings({ showCharts: v })} />
          </Row>
          <Row label={tr({ zh: '显示练习日历', en: 'Show practice heatmap',
              zhHant: "顯示練習日曆"
        })}>
            <BoolToggle value={s.showHeatmap} onChange={(v) => updateSettings({ showHeatmap: v })} />
          </Row>
          <Row label={tr({ zh: '点击打乱条', en: 'Scramble click action',
              zhHant: "點選打亂條"
        })}>
            <select
              value={s.scrambleClickAction}
              onChange={(e) => updateSettings({ scrambleClickAction: e.target.value as 'none' | 'next' | 'copy' })}
            >
              <option value="none">{tr({ zh: '无操作', en: 'Nothing',
                  zhHant: "無操作"
            })}</option>
              <option value="next">{tr({ zh: '换下一个', en: 'Next scramble',
                  zhHant: "換下一個"
            })}</option>
              <option value="copy">{tr({ zh: '复制到剪贴板', en: 'Copy to clipboard',
                  zhHant: "複製到剪貼簿"
            })}</option>
            </select>
          </Row>
          <Row label={tr({ zh: '运行中隐藏全部 UI', en: 'Hide all UI while running',
              zhHant: "執行中隱藏全部 UI"
        })}>
            <BoolToggle value={s.hideAllUiWhileRunning} onChange={(v) => updateSettings({ hideAllUiWhileRunning: v })} />
          </Row>
          <Row label={tr({ zh: '排名地区', en: 'Ranking region',
              zhHant: "排名地區"
        })}>
            <CountryInput
              value={(s.rankCountry ?? '').toLowerCase()}
              onChange={(iso2) => updateSettings({ rankCountry: iso2.toUpperCase() })}
              placeholder={tr({ zh: '国家(留空只显 WR)', en: 'Country (blank = WR only)',
                  zhHant: "國家(留空只顯 WR)"
            })}
            />
            <span className="hint">{tr({ zh: '设国家后停表额外显示 CR(大洲)/ NR(全国)排名;登录 WCA 自动带入', en: 'adds CR (continent) / NR (national) ranks; auto-filled when signed in',
                zhHant: "設國家後停表額外顯示 CR(大洲)/ NR(全國)排名;登入 WCA 自動帶入"
            })}</span>
          </Row>
        </AccordionSection>

        <AccordionSection
          id="cube-colors"
          title={tr({ zh: '配色（魔方面）', en: 'Cube colors' })}
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
            {tr({ zh: '恢复 WCA 配色', en: 'Reset to WCA colors',
                zhHant: "恢復 WCA 配色"
            })}
          </button>
        </AccordionSection>

        <div className="modal-actions">
          <button className="danger" onClick={() => {
            if (confirm(tr({ zh: '把所有设置恢复为默认值？', en: 'Reset all settings to defaults?',
                zhHant: "把所有設定恢復為預設值？"
            }))) {
              resetSettings();
            }
          }}>
            {tr({ zh: '全部重置', en: 'Reset all' })}
          </button>
          <button className="primary" onClick={onClose}>{tr({ zh: '关闭', en: 'Close',
              zhHant: "關閉"
        })}</button>
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
