import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useStatsStore } from '../stores/statsStore';
import { useKeyboard } from '../hooks/useKeyboard';
import pllData from '../../../shared/data/pll.json';
import type { AlgCase } from '@cuberoot/shared';

function getAlgSet(id: string) {
  if (id === '3x3-pll') return pllData;
  return null;
}

/** 毫秒 → "1.23" 格式 */
function formatTime(ms: number): string {
  const s = ms / 1000;
  return s.toFixed(2);
}

export function TrainingPage() {
  const { algSetId } = useParams<{ algSetId: string }>();
  const navigate = useNavigate();
  const algSet = getAlgSet(algSetId ?? '');
  const selectedCases = useSettingsStore((s) => s.selectedCases);
  const recordTime = useStatsStore((s) => s.recordTime);
  const {
    state, queue, currentIndex, results,
    startSession, startTimer, stopTimer, nextCase, resetSession,
  } = useSessionStore();

  const [displayTime, setDisplayTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);

  // 初始化训练
  useEffect(() => {
    if (!algSet) return;
    const cases = algSet.cases.filter((c) =>
      selectedCases.includes(c.id),
    ) as AlgCase[];
    if (cases.length > 0) {
      startSession(cases);
    }
  }, [algSet, selectedCases, startSession]);

  const currentCase = queue[currentIndex] as AlgCase | undefined;

  // 计时器显示更新
  useEffect(() => {
    if (state === 'timing') {
      const start = performance.now();
      const id = window.setInterval(() => {
        setDisplayTime(Math.round(performance.now() - start));
      }, 10);
      setTimerInterval(id);
      return () => clearInterval(id);
    } else if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [state]);

  // 停止时记录最终时间
  useEffect(() => {
    if (state === 'stopped' && results.length > 0) {
      const last = results[results.length - 1];
      setDisplayTime(last.timeMs);
      // 保存到统计
      if (algSetId) {
        recordTime(algSetId, last.caseId, last.timeMs);
      }
    }
  }, [state, results, algSetId, recordTime]);

  // 键盘处理
  const handleSpace = useCallback(() => {
    if (state === 'caseShown') {
      startTimer();
    } else if (state === 'timing') {
      stopTimer();
    } else if (state === 'stopped') {
      nextCase();
    }
  }, [state, startTimer, stopTimer, nextCase]);

  useKeyboard({
    onKeyDown: (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleSpace();
      }
      if (e.code === 'Escape') {
        resetSession();
        navigate(`/select/${algSetId}`);
      }
    },
  });

  if (!algSet) {
    return <div className="error-page">公式集未找到</div>;
  }

  if (state === 'complete') {
    return (
      <div className="training-page">
        <div className="complete-screen">
          <h2>🎉 训练完成！</h2>
          <p>{results.length} 个 case，平均 {formatTime(
            results.reduce((a, r) => a + r.timeMs, 0) / results.length,
          )}s</p>
          <div className="complete-actions">
            <button onClick={() => navigate(`/stats/${algSetId}`)}>
              查看统计
            </button>
            <button onClick={() => navigate(`/select/${algSetId}`)}>
              返回选择
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="training-page">
      <header className="training-header">
        <span className="progress">
          {currentIndex + 1} / {queue.length}
        </span>
        <button className="back-btn" onClick={() => {
          resetSession();
          navigate(`/select/${algSetId}`);
        }}>
          ✕ 退出
        </button>
      </header>

      <div className="training-content">
        {/* 魔方图占位——阶段 5 集成 cubing.js */}
        <div className="cube-placeholder">
          <div className="case-label">{currentCase?.name ?? '?'}</div>
        </div>

        {/* 计时器 */}
        <div className={`timer ${state === 'timing' ? 'running' : ''} ${state === 'stopped' ? 'stopped' : ''}`}>
          {formatTime(displayTime)}
        </div>

        {/* 提示文字 */}
        <div className="hint-text">
          {state === 'caseShown' && '按 空格 开始计时'}
          {state === 'timing' && '按 空格 停止'}
          {state === 'stopped' && '按 空格 下一个'}
        </div>
      </div>

      {/* 最近结果 */}
      {results.length > 0 && (
        <div className="recent-results">
          {results.slice(-5).reverse().map((r, i) => (
            <span key={i} className="result-item">
              {r.caseId}: {formatTime(r.timeMs)}s
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
