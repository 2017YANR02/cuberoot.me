/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Target } from 'lucide-react';
import { formatTargetTime, parseTargetTime, resetSettings, updateSettings, useSettings } from '../settings';
import { warmupSound, play } from '../sound';
import { getMetronome } from '../sound/metronome';
import { isVoiceAvailable } from '../sound/voice';
import { getSeedCounter, resetSeedCounter } from '../scramble';
import { appendSolves, listBackups, pushBackup, replaceSolves, restoreBackup } from '../storage/db';
import { parseCstimerExport, type CstimerSessionParsed } from '../storage/import_cstimer';
import { exportCstimerJson } from '../storage/export_cstimer';
import { reanalyzeAll } from '../storage/reanalyze';
import { eventInfo, type EventId } from '../types';

interface Props {
  isZh: boolean;
  onClose: () => void;
  /** Current event — target-time setting applies to this event. */
  event: EventId;
}

export default function SettingsPanel({ isZh, onClose, event }: Props) {
  const s = useSettings();
  const [seedTick, setSeedTick] = useState(0);
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
        const clamped = Math.max(30, Math.min(240, bpm));
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

  // Drive the metronome from settings.
  useEffect(() => {
    const m = getMetronome();
    if (s.metronomeEnabled) {
      if (!m.isRunning()) m.start(s.metronomeBpm);
      else m.setBpm(s.metronomeBpm);
    } else if (m.isRunning()) {
      m.stop();
    }
  }, [s.metronomeEnabled, s.metronomeBpm]);

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

  // ── Reanalyze stage data state ──
  const [reanalyzeBusy, setReanalyzeBusy] = useState(false);
  const [reanalyzeProgress, setReanalyzeProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [reanalyzeMsg, setReanalyzeMsg] = useState<string | null>(null);
  const reanalyzeMsgTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cstimerExportTimerRef.current !== null) window.clearTimeout(cstimerExportTimerRef.current);
      if (reanalyzeMsgTimerRef.current !== null) window.clearTimeout(reanalyzeMsgTimerRef.current);
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

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '计时' : 'Timing'}</h3>
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
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '声音' : 'Sound'}</h3>
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
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '节拍器' : 'Metronome'}</h3>
          <Row label={isZh ? '开启' : 'Enabled'}>
            <input
              type="checkbox"
              checked={s.metronomeEnabled}
              onChange={(e) => {
                updateSettings({ metronomeEnabled: e.target.checked });
                if (e.target.checked) warmupSound();
              }}
            />
          </Row>
          <Row label={isZh ? '速度（BPM）' : 'Tempo (BPM)'}>
            <input
              type="number" min={30} max={240} step={1}
              value={s.metronomeBpm}
              onChange={(e) => updateSettings({ metronomeBpm: Math.max(30, Math.min(240, Number(e.target.value) || 60)) })}
            />
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
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '同步种子' : 'Sync seed'}</h3>
          <Row label={isZh ? '种子' : 'Seed'}>
            <input
              type="text"
              value={s.syncSeed ?? ''}
              placeholder={isZh ? '留空 = 关闭' : 'blank = off'}
              onChange={(e) => {
                const v = e.target.value;
                updateSettings({ syncSeed: v === '' ? null : v });
                resetSeedCounter();
                setSeedTick((t) => t + 1);
              }}
            />
          </Row>
          <Row label={isZh ? '已生成' : 'Generated'}>
            <span className="hint">{isZh ? `${getSeedCounter()} 次` : `${getSeedCounter()} scrambles`}</span>
            <button
              className="hint-btn"
              onClick={() => { resetSeedCounter(); setSeedTick((t) => t + 1); }}
              title={String(seedTick)}
            >
              {isZh ? '重置计数' : 'Reset counter'}
            </button>
            <span className="hint">{isZh ? '相同种子在不同设备打出相同序列' : 'same seed → same sequence across devices'}</span>
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '自动备份' : 'Auto-backup'}</h3>
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
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '从 csTimer 导入 / 导出' : 'csTimer import / export'}</h3>
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
          <Row label={isZh ? '导出为 csTimer JSON' : 'Export as csTimer JSON'}>
            <button
              className="hint-btn"
              onClick={() => { void onCstimerExport(); }}
              title={isZh ? '下载所有成绩为 csTimer 兼容的 JSON' : 'Download all solves as a csTimer-compatible JSON'}
            >
              <Download size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {isZh ? '下载' : 'Download'}
            </button>
            {cstimerExportMsg !== null && (
              <span className="hint">{cstimerExportMsg}</span>
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
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '外观' : 'Appearance'}</h3>
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
          <Row label={isZh ? '使用 3D 立方体' : 'Use 3D cube'}>
            <input
              type="checkbox"
              checked={s.use3D}
              onChange={(e) => updateSettings({ use3D: e.target.checked })}
            />
            <span className="hint">{isZh ? '可拖动旋转' : 'drag to rotate'}</span>
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
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '配色（魔方面）' : 'Cube colors'}</h3>
          <div className="color-grid">
            {(['U', 'D', 'F', 'B', 'L', 'R'] as const).map(face => {
              const wcaDefault: Record<typeof face, string> = {
                U: '#FFFFFF', D: '#FFD500', F: '#009B48', B: '#0046AD', L: '#FF5800', R: '#B71234',
              } as const;
              const cur = s.colors[face] ?? wcaDefault[face];
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
        </div>

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
