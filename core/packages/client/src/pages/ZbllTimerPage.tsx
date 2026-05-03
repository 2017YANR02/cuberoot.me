/**
 * ZBLL 计时训练页
 * 完整复刻自上游 TimerView.vue
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useZbllSessionStore, TimerState, type ZbllResult } from '../stores/zbllSessionStore';
import { useZbllSelectedStore } from '../stores/zbllSelectedStore';
import { useZbllSettingsStore, FONTS_LIST } from '../stores/zbllSettingsStore';
import { useZbllPresetStore, STARRED_NAME } from '../stores/zbllPresetStore';
import { useZbllNotesStore } from '../stores/zbllNotesStore';
import { msToHumanReadable, formatZbllKey, inverseScramble } from '../utils/zbllHelpers';
import zbllMap from '@cuberoot/shared/data/zbll.json';
import type { ZbllEntry } from '../utils/zbllHelpers';
import { VisualCube } from '../components/VisualCube';
import '../zbll.css';

const typedZbllMap = zbllMap as Record<string, ZbllEntry>;

// ===== ZBLL 设置面板 =====
function ZbllSettings({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { settings, updateSetting, resetDefaults } = useZbllSettingsStore();

  return (
    <div className="zbll-settings-panel">
      <div className="zbll-settings-header">
        <h3>{t('zbll.settings.title')}</h3>
        <div>
          <button className="zbll-btn zbll-btn-warning" onClick={() => { if (confirm(t('zbll.settings.resetConfirm'))) { resetDefaults(); onClose(); } }}>
            {t('zbll.settings.reset')}
          </button>
          <button className="zbll-btn zbll-btn-primary" onClick={onClose}>{t('zbll.settings.done')}</button>
        </div>
      </div>
      <hr />
      <div className="zbll-settings-form">
        <label>
          {t('zbll.settings.scrambleSize')}
          <input type="number" min={1} max={999} value={settings.scrambleFontSize}
            onChange={(e) => updateSetting('scrambleFontSize', Number(e.target.value))} />
        </label>
        <label>
          {t('zbll.settings.timerSize')}
          <input type="number" min={1} max={999} value={settings.timerFontSize}
            onChange={(e) => updateSetting('timerFontSize', Number(e.target.value))} />
        </label>
        <label>
          {t('zbll.settings.timerFont')}
          <select value={settings.timerFont} onChange={(e) => updateSetting('timerFont', e.target.value)}>
            {FONTS_LIST.map((f) => <option key={f} value={f} style={{ fontFamily: f, fontWeight: 700 }}>{f}</option>)}
          </select>
        </label>
        <label>
          {t('zbll.settings.pictureView')}
          <select value={settings.pictureView} onChange={(e) => updateSetting('pictureView', e.target.value as 'top' | '3D')}>
            <option value="top">{t('zbll.settings.pictureTop')}</option>
            <option value="3D">{t('zbll.settings.pictureSide')}</option>
          </select>
        </label>
        <label>
          {t('zbll.settings.timerUpdate')}
          <select value={settings.timerUpdate} onChange={(e) => updateSetting('timerUpdate', e.target.value as 'on' | 'seconds' | 'off')}>
            <option value="on">{t('zbll.settings.timerUpdateOn')}</option>
            <option value="seconds">{t('zbll.settings.timerUpdateSeconds')}</option>
            <option value="off">{t('zbll.settings.timerUpdateOff')}</option>
          </select>
        </label>
        <label>
          {t('zbll.settings.timerPrecision')}
          <select value={settings.timerPrecision} onChange={(e) => updateSetting('timerPrecision', Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>1/10</option>
            <option value={2}>1/100</option>
            <option value={3}>1/1000</option>
          </select>
        </label>
        <label>
          {t('zbll.settings.timerStartDelay')}
          <select value={settings.timerStartDelayMs} onChange={(e) => updateSetting('timerStartDelayMs', Number(e.target.value))}>
            {[0, 100, 300, 500, 1000].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          {t('zbll.settings.scrambleAppendix')}
          <select value={settings.scrambleAppendix} onChange={(e) => updateSetting('scrambleAppendix', e.target.value)}>
            {["None", "R U' R'", "R U R'", "L U L'", "L U' L'"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

// ===== ZbllNote（计时页内联版） =====
function ZbllNote({ zbllKey }: { zbllKey: string }) {
  const { t } = useTranslation();
  const { notes, setNote } = useZbllNotesStore();
  const [editing, setEditing] = useState(false);
  const note = notes[zbllKey] || '';

  if (editing) {
    return (
      <input className="zbll-note-input" maxLength={200} value={note} autoFocus
        placeholder='e.g. "odd regrip"'
        onChange={(e) => setNote(zbllKey, e.target.value.trim())}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
      />
    );
  }

  return (
    <span className="zbll-note-display">
      <span className={note ? '' : 'zbll-note-placeholder'}>{note || t('zbll.result.addNote')}</span>
      <button className="zbll-note-edit-btn" onClick={() => setEditing(true)}>✏️</button>
    </span>
  );
}

// ===== SetupAndAlgs =====
function SetupAndAlgs({ zbllKey, maxAmount }: { zbllKey: string; maxAmount: number }) {
  const { t } = useTranslation();
  const entry = (zbllMap as Record<string, ZbllEntry>)[zbllKey];
  if (!entry?.algs?.length) return null;
  return (
    <div>
      <div>{t('zbll.result.setup')} <strong>{inverseScramble(entry.algs[0])}</strong></div>
      <div>{t('zbll.result.algs')}</div>
      <ul className="zbll-alg-list">
        {entry.algs.slice(0, maxAmount).map((alg, i) => (
          <li key={alg} className={i === 0 ? 'zbll-alg-bold' : ''}>· {alg}</li>
        ))}
      </ul>
    </div>
  );
}

// ===== ResultCard =====
function ResultCard() {
  const { t } = useTranslation();
  const session = useZbllSessionStore();
  const selected = useZbllSelectedStore();
  const { settings } = useZbllSettingsStore();
  const presets = useZbllPresetStore();

  const stats = session.data.stats;
  const idx = session.observingResult;
  const isValid = stats.length > idx;
  const result: ZbllResult = isValid ? stats[idx] : { i: 0, key: '', scramble: '', ms: 0 };

  const isKeySelected = selected.isSelected(result.key);
  const isBookmarked = presets.hasCase(STARRED_NAME, result.key);

  const onDelete = () => {
    if (isValid && confirm(t('zbll.result.deleteConfirm'))) {
      session.deleteResult(idx);
    }
  };

  const toggleSelected = () => {
    if (!isValid) return;
    if (isKeySelected) selected.removeZbll(result.key);
    else selected.addZbll(result.key);
  };

  const toggleStar = () => {
    if (!isValid || session.timerState !== TimerState.NOT_RUNNING) return;
    presets.toggleAddRemove(STARRED_NAME, result.key);
  };

  return (
    <div className="zbll-result-card">
      <div className="zbll-result-header">
        <span>{t('zbll.result.title', { n: result.i + 1 })}&nbsp;
          <span className="zbll-badge">{msToHumanReadable(result.ms, settings.timerPrecision)}</span>
        </span>
        <button className="zbll-btn-danger-sm" onClick={onDelete}
          disabled={session.timerState !== TimerState.NOT_RUNNING}>🗑</button>
      </div>
      <hr />
      <p>
        {t('zbll.result.case')} {formatZbllKey(result.key)}
        <span className={`zbll-star ${isBookmarked ? 'zbll-star-filled' : ''}`}
          onClick={toggleStar} title={t('zbll.result.addToStarred')}>
          {isBookmarked ? '★' : '☆'}
        </span>
      </p>
      <ZbllNote zbllKey={result.key} />
      <label className="zbll-checkbox-label">
        <input type="checkbox" checked={isKeySelected} onChange={toggleSelected}
          disabled={session.timerState !== TimerState.NOT_RUNNING} />
        {t('zbll.result.selected')}
      </label>
      {result.key && (
        <VisualCube
          algorithm={typedZbllMap[result.key]?.algs[0] || ''}
          view={settings.pictureView === '3D' ? 'pll-iso' : 'pll'}
          size={120}
          alt={result.key}
        />
      )}
      <SetupAndAlgs zbllKey={result.key} maxAmount={3} />
      <p className="zbll-result-scramble">{t('zbll.result.scramble')} {result.scramble}</p>
    </div>
  );
}

// ===== StatsCard =====
function StatsCard() {
  const { t } = useTranslation();
  const session = useZbllSessionStore();
  const { settings } = useZbllSettingsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const stats = session.data.stats;

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [stats.length]);

  const onClear = () => {
    if (confirm(t('zbll.stats.clearConfirm'))) session.clearSession();
  };

  return (
    <div className="zbll-stats-card">
      <div className="zbll-stats-header">
        <span>{t('zbll.stats.title', { count: stats.length })}</span>
        {stats.length > 0 && (
          <button className="zbll-btn-danger-sm" onClick={onClear} title="Shift+Delete">{t('zbll.stats.clear')}</button>
        )}
      </div>
      <hr />
      <div className="zbll-stats-container" ref={containerRef}>
        {stats.length === 0 && session.timerState !== TimerState.RUNNING && (
          <div>{t('zbll.stats.holdSpace')}</div>
        )}
        {stats.map((stat, index) => (
          <span key={index}>
            <span
              className={`zbll-stat-time ${session.observingResult === stat.i ? 'zbll-stat-active' : ''}`}
              onClick={() => session.setObservingResult(stat.i)}
            >
              {msToHumanReadable(stat.ms, settings.timerPrecision)}
            </span>
            {stat.i < stats.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

// ===== 主页面 =====
export function ZbllTimerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useZbllSessionStore();
  const selected = useZbllSelectedStore();
  const { settings } = useZbllSettingsStore();
  const presets = useZbllPresetStore();

  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 计时器更新
  useEffect(() => {
    if (session.timerState === TimerState.RUNNING) {
      const interval = setInterval(() => setCurrentTime(Date.now()), 10);
      return () => clearInterval(interval);
    }
  }, [session.timerState]);

  // 确保 session 有正确的选中 keys
  useEffect(() => {
    if (selected.keys.length > 0 && session.data.keys.length === 0) {
      session.setSelectedKeys(selected.keys, selected.commonScrambleLength());
    }
  }, []);

  // 计算 timer 显示文本
  const timerLabel = (() => {
    const { timerState, data } = session;
    if (timerState === TimerState.READY || timerState === TimerState.AWAITING_READY) {
      return msToHumanReadable(0, settings.timerPrecision, true);
    }
    if (timerState === TimerState.NOT_RUNNING || timerState === TimerState.STOPPING) {
      const n = data.stats.length;
      const ms = n === 0 ? 0 : data.stats[n - 1].ms;
      return msToHumanReadable(ms, settings.timerPrecision, true);
    }
    if (settings.timerUpdate === 'off') return '⏱️';
    const showMs = settings.timerUpdate === 'on';
    return msToHumanReadable(currentTime - session.timerStarted, settings.timerPrecision, showMs);
  })();

  // 计时器状态 CSS class
  const timerClass = (() => {
    switch (session.timerState) {
      case TimerState.AWAITING_READY: return 'zbll-timer-awaiting';
      case TimerState.READY: return 'zbll-timer-ready';
      case TimerState.RUNNING: return 'zbll-timer-running';
      case TimerState.STOPPING: return 'zbll-timer-stopping';
      default: return 'zbll-timer-idle';
    }
  })();

  // 键盘事件处理 — 核心计时器控制逻辑
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showSettings) return;

    // Space 键 — 计时器启停
    if (e.code === 'Space') {
      e.preventDefault();
      const ts = session.timerState;
      if (ts === TimerState.NOT_RUNNING) {
        session.getTimerReady(settings.timerStartDelayMs);
      }
      // RUNNING → STOPPING 在 keyUp 处理
      return;
    }

    // Alt 快捷键
    if (e.altKey) {
      e.preventDefault();
      switch (e.key) {
        case 't': navigate('/select/zbll'); break;
        case 'r': session.startRecap(); break;
        case 'd': if (confirm(t('zbll.stats.clearConfirm'))) session.clearSession(); break;
        case 'z': {
          const stats = session.data.stats;
          if (stats.length > 0 && confirm(t('zbll.result.deleteConfirm'))) {
            session.deleteResult(session.observingResult);
          }
          break;
        }
        case 's': {
          const key = session.data.stats[session.observingResult]?.key;
          if (key) {
            if (selected.isSelected(key)) selected.removeZbll(key);
            else selected.addZbll(key);
          }
          break;
        }
        case 'a': {
          const key = session.data.stats[session.observingResult]?.key;
          if (key) presets.toggleAddRemove(STARRED_NAME, key);
          break;
        }
      }
      return;
    }

    // Delete 键
    if (e.key === 'Delete') {
      e.preventDefault();
      if (e.shiftKey) {
        if (confirm(t('zbll.stats.clearConfirm'))) session.clearSession();
      } else {
        const stats = session.data.stats;
        if (stats.length > 0 && confirm(t('zbll.result.deleteConfirm'))) {
          session.deleteResult(session.observingResult);
        }
      }
      return;
    }

    // 箭头导航
    const stats = session.data.stats;
    if (e.key === 'ArrowLeft') session.setObservingResult(Math.max(0, session.observingResult - 1));
    if (e.key === 'ArrowRight') session.setObservingResult(Math.min(stats.length - 1, session.observingResult + 1));
    if (e.key === 'Home') session.setObservingResult(0);
    if (e.key === 'End') session.setObservingResult(Math.max(0, stats.length - 1));
  }, [session, selected, settings, showSettings, navigate, presets, t]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      const ts = session.timerState;
      if (ts === TimerState.READY) {
        session.startTimer();
      } else if (ts === TimerState.AWAITING_READY) {
        // NOTE: 取消 — 用户没有按够延迟时间
        session.setTimerState(TimerState.NOT_RUNNING);
      } else if (ts === TimerState.RUNNING) {
        session.stopTimer();
      } else if (ts === TimerState.STOPPING) {
        session.setTimerState(TimerState.NOT_RUNNING);
      }
    }
  }, [session]);

  // 触摸事件（移动端）
  const handleTouchStart = useCallback((_e: React.TouchEvent) => {
    if (showSettings) return;
    const ts = session.timerState;
    if (ts === TimerState.RUNNING) {
      session.stopTimer();
    } else if (ts === TimerState.NOT_RUNNING) {
      session.getTimerReady(settings.timerStartDelayMs);
    }
  }, [session, settings, showSettings]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    const ts = session.timerState;
    if (ts === TimerState.READY) {
      session.startTimer();
    } else if (ts === TimerState.AWAITING_READY) {
      session.setTimerState(TimerState.NOT_RUNNING);
    } else if (ts === TimerState.STOPPING) {
      session.setTimerState(TimerState.NOT_RUNNING);
    }
  }, [session]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // 打乱显示
  const scramble = session.data.currentScramble ?? t('zbll.timer.noScramble');
  const appendix = settings.scrambleAppendix === 'None' ? '' : ' ' + settings.scrambleAppendix;

  const recapInfo = session.data.recapMode
    ? `(${t('zbll.nav.nToRecap', { count: session.casesWithZeroCount().length })})`
    : '';

  return (
    <div className="zbll-timer-page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* 导航栏 */}
      <div className="zbll-timer-nav">
        <div className="zbll-timer-nav-left">
          <button className="zbll-btn zbll-btn-primary" onClick={() => navigate('/select/zbll')}>
            {t('zbll.nav.selectBtn')} ({selected.totalSelected()})
          </button>
          {recapInfo && <span className="zbll-recap-info">{recapInfo}</span>}
        </div>
        <div className="zbll-timer-nav-right">
          <button className={`zbll-settings-toggle ${showSettings ? 'zbll-settings-active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}>⚙️</button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && <ZbllSettings onClose={() => setShowSettings(false)} />}

      {/* 打乱 */}
      <div className="zbll-scramble" style={{ fontSize: settings.scrambleFontSize }}>
        <span className="zbll-scramble-label">{t('zbll.timer.scramble')}&nbsp;</span>
        <span>{scramble}<span className="zbll-scramble-appendix">{appendix}</span></span>
      </div>

      {/* 计时器 */}
      <div className={`zbll-timer-display ${timerClass}`}
        style={{ fontSize: settings.timerFontSize, fontFamily: `${settings.timerFont}, monospace` }}>
        {timerLabel}
      </div>

      {/* 结果 + 统计 */}
      <div className="zbll-timer-bottom">
        <div className="zbll-timer-result-col">
          <ResultCard />
        </div>
        <div className="zbll-timer-stats-col">
          <StatsCard />
        </div>
      </div>
    </div>
  );
}
