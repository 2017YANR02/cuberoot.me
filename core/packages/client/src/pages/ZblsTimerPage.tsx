/**
 * ZBLS 计时训练页
 * 完整复刻上游 trainer.html + trainer-screen.js
 * 功能: 5 状态计时器 + 结果卡片 + 统计列表 + Recap + Again
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useZblsSessionStore,
  TimerState,
  type ZblsResult,
} from '../stores/zbls_session_store';
import { useZblsSelectedStore } from '../stores/zbls_selected_store';
import {
  msToDisplay,
  getZblsImg,
  zblsData,
} from '../utils/zbls_helpers';
import '../zbls.css';

// ===== 结果卡片 =====
function ResultCard() {
  const { t } = useTranslation();
  const session = useZblsSessionStore();
  const stats = session.data.stats;
  const idx = session.observingResult;
  const isValid = stats.length > idx;
  const result: ZblsResult = isValid
    ? stats[idx]
    : { i: 0, key: '', scramble: '', ms: 0 };

  // 获取 case 信息
  const entry = result.key ? zblsData[result.key] : null;

  return (
    <div className="zbls-result-card">
      <div className="zbls-result-header">
        <span>
          {t('zbls.result.title', { n: result.i + 1 })}&nbsp;
          <span className="zbls-badge">{msToDisplay(result.ms)}</span>
        </span>
        <button
          className="zbls-btn-danger-sm"
          onClick={() => {
            if (isValid && confirm(t('zbls.result.deleteConfirm'))) {
              session.deleteResult(idx);
            }
          }}
          disabled={session.timerState !== TimerState.NOT_RUNNING}
        >
          🗑
        </button>
      </div>
      <hr />
      <p>
        {t('zbls.result.case')} F2L {result.key}
      </p>
      {result.key && (
        <img
          className="zbls-result-img"
          src={getZblsImg(result.key)}
          alt={`F2L ${result.key}`}
        />
      )}
      {entry && entry.algs.length > 0 && (
        <div>
          <div>{t('zbls.result.algs')}</div>
          <ul className="zbls-alg-list">
            {entry.algs.map((alg, i) => (
              <li key={alg} className={i === 0 ? 'zbls-alg-bold' : ''}>
                · {alg}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="zbls-result-scramble">
        {t('zbls.result.scramble')} {result.scramble}
      </p>
    </div>
  );
}

// ===== 统计卡片 =====
function StatsCard() {
  const { t } = useTranslation();
  const session = useZblsSessionStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const stats = session.data.stats;

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [stats.length]);

  const onClear = () => {
    if (confirm(t('zbls.stats.clearConfirm'))) session.clearSession();
  };

  return (
    <div className="zbls-stats-card">
      <div className="zbls-stats-header">
        <span>{t('zbls.stats.title', { count: stats.length })}</span>
        {stats.length > 0 && (
          <button className="zbls-btn-danger-sm" onClick={onClear}>
            {t('zbls.stats.clear')}
          </button>
        )}
      </div>
      <hr />
      <div className="zbls-stats-container" ref={containerRef}>
        {stats.length === 0 &&
          session.timerState !== TimerState.RUNNING && (
            <div>{t('zbls.stats.holdSpace')}</div>
          )}
        {stats.map((stat, index) => (
          <span key={index}>
            <span
              className={`zbls-stat-time ${
                session.observingResult === stat.i ? 'zbls-stat-active' : ''
              }`}
              onClick={() => session.setObservingResult(stat.i)}
            >
              {msToDisplay(stat.ms)}
            </span>
            {stat.i < stats.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

// ===== 主页面 =====
export function ZblsTimerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useZblsSessionStore();
  const selected = useZblsSelectedStore();

  const [currentTime, setCurrentTime] = useState(Date.now());

  // 计时器刷新
  useEffect(() => {
    if (session.timerState === TimerState.RUNNING) {
      const interval = setInterval(() => setCurrentTime(Date.now()), 10);
      return () => clearInterval(interval);
    }
  }, [session.timerState]);

  // 确保 session 有正确的选中 keys
  useEffect(() => {
    if (selected.keys.length > 0 && session.data.keys.length === 0) {
      session.setSelectedKeys(selected.keys);
    }
  }, []);

  // 计时器显示文本
  const timerLabel = (() => {
    const { timerState, data } = session;
    if (
      timerState === TimerState.READY ||
      timerState === TimerState.AWAITING_READY
    ) {
      return msToDisplay(0);
    }
    if (
      timerState === TimerState.NOT_RUNNING ||
      timerState === TimerState.STOPPING
    ) {
      const n = data.stats.length;
      const ms = n === 0 ? 0 : data.stats[n - 1].ms;
      return msToDisplay(ms);
    }
    // RUNNING
    return msToDisplay(currentTime - session.timerStarted);
  })();

  // 计时器状态 CSS class
  const timerClass = (() => {
    switch (session.timerState) {
      case TimerState.AWAITING_READY:
        return 'zbls-timer-awaiting';
      case TimerState.READY:
        return 'zbls-timer-ready';
      case TimerState.RUNNING:
        return 'zbls-timer-running';
      case TimerState.STOPPING:
        return 'zbls-timer-stopping';
      default:
        return 'zbls-timer-idle';
    }
  })();

  // NOTE: 上游使用 0ms 延迟（没有 delay）
  const TIMER_DELAY = 0;

  // 键盘事件处理
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Space 键 — 计时器启停
      if (e.code === 'Space') {
        e.preventDefault();
        const ts = session.timerState;
        if (ts === TimerState.NOT_RUNNING) {
          session.getTimerReady(TIMER_DELAY);
        }
        return;
      }

      // Backspace — Again（recap 模式下）
      if (e.code === 'Backspace') {
        e.preventDefault();
        session.recapCaseAgain();
        return;
      }

      // Delete 键
      if (e.key === 'Delete') {
        e.preventDefault();
        if (e.shiftKey) {
          if (confirm(t('zbls.stats.clearConfirm'))) session.clearSession();
        } else {
          const stats = session.data.stats;
          if (stats.length > 0 && confirm(t('zbls.result.deleteConfirm'))) {
            session.deleteResult(session.observingResult);
          }
        }
        return;
      }

      // 箭头导航
      const stats = session.data.stats;
      if (e.key === 'ArrowLeft')
        session.setObservingResult(Math.max(0, session.observingResult - 1));
      if (e.key === 'ArrowRight')
        session.setObservingResult(
          Math.min(stats.length - 1, session.observingResult + 1)
        );
    },
    [session, t]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        const ts = session.timerState;
        if (ts === TimerState.READY) {
          session.startTimer();
        } else if (ts === TimerState.AWAITING_READY) {
          session.setTimerState(TimerState.NOT_RUNNING);
        } else if (ts === TimerState.RUNNING) {
          session.stopTimer();
        } else if (ts === TimerState.STOPPING) {
          session.setTimerState(TimerState.NOT_RUNNING);
        }
      }
    },
    [session]
  );

  // 触摸事件（移动端）
  const handleTouchStart = useCallback(
    (_e: React.TouchEvent) => {
      const ts = session.timerState;
      if (ts === TimerState.RUNNING) {
        session.stopTimer();
      } else if (ts === TimerState.NOT_RUNNING) {
        session.getTimerReady(TIMER_DELAY);
      }
    },
    [session]
  );

  const handleTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      const ts = session.timerState;
      if (ts === TimerState.READY) {
        session.startTimer();
      } else if (ts === TimerState.AWAITING_READY) {
        session.setTimerState(TimerState.NOT_RUNNING);
      } else if (ts === TimerState.STOPPING) {
        session.setTimerState(TimerState.NOT_RUNNING);
      }
    },
    [session]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // 打乱显示
  const scramble = session.data.currentScramble ?? t('zbls.timer.noScramble');

  // Recap 信息
  const recapInfo = session.data.recapMode
    ? `(${t('zbls.nav.nToRecap', { count: session.casesWithZeroCount().length })})`
    : '';

  // Again 按钮可见性：recap 模式 + 计时器停止 + 未使用 again
  const showAgain =
    session.data.recapMode &&
    session.timerState === TimerState.NOT_RUNNING &&
    session.lastCaseKey &&
    !session.againUsed &&
    session.data.stats.length > 0;

  return (
    <div
      className="zbls-timer-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 导航栏 */}
      <div className="zbls-timer-nav">
        <div className="zbls-timer-nav-left">
          <button
            className="zbls-btn zbls-btn-primary"
            onClick={() => navigate('/select/zbls')}
          >
            {t('zbls.nav.selectBtn')} ({selected.totalSelected()})
          </button>
          {recapInfo && (
            <span className="zbls-recap-info">{recapInfo}</span>
          )}
        </div>
        <div className="zbls-timer-nav-right">
          {showAgain && (
            <button
              className="zbls-btn zbls-btn-warning"
              onClick={() => session.recapCaseAgain()}
            >
              {t('zbls.timer.again')}
            </button>
          )}
        </div>
      </div>

      {/* 打乱 */}
      <div className="zbls-scramble">
        <span className="zbls-scramble-label">
          {t('zbls.timer.scramble')}&nbsp;
        </span>
        <span>{scramble}</span>
      </div>

      {/* 计时器 */}
      <div className={`zbls-timer-display ${timerClass}`}>{timerLabel}</div>

      {/* 结果 + 统计 */}
      <div className="zbls-timer-bottom">
        <div className="zbls-timer-result-col">
          <ResultCard />
        </div>
        <div className="zbls-timer-stats-col">
          <StatsCard />
        </div>
      </div>
    </div>
  );
}
