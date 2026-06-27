'use client';
// NOTE: 播放控制组件 — 播放/暂停 + 进度条 + 速度 + 同步模式
// 1:1 映射 viz/index.html L164-190 的 DOM 结构 + viz.js setupControls() 的交互逻辑

import { useCallback, useEffect } from 'react';
import { useVizStore } from '../_stores/viz_store';
import { tr } from '@/i18n/tr';

export default function PlayControls() {
  const isPlaying = useVizStore(s => s.isPlaying);
  const playSpeed = useVizStore(s => s.playSpeed);
  const currentFrame = useVizStore(s => s.currentFrame);
  const maxFrame = useVizStore(s => s.maxFrame);
  const syncMode = useVizStore(s => s.syncMode);
  const players = useVizStore(s => s.players);

  const setPlaying = useVizStore(s => s.setPlaying);
  const setPlaySpeed = useVizStore(s => s.setPlaySpeed);
  const setFrame = useVizStore(s => s.setFrame);
  const setSyncMode = useVizStore(s => s.setSyncMode);

  const togglePlay = useCallback(() => {
    const s = useVizStore.getState();
    if (s.isPlaying) {
      setPlaying(false);
    } else {
      // 如果已到末尾，从头开始
      if (s.currentFrame >= s.maxFrame) setFrame(0);
      setPlaying(true);
    }
  }, [setPlaying, setFrame]);

  const stepForward = useCallback((n: number) => {
    const s = useVizStore.getState();
    setFrame(Math.min(s.currentFrame + n, s.maxFrame));
  }, [setFrame]);

  const stepBackward = useCallback((n: number) => {
    const s = useVizStore.getState();
    setFrame(Math.max(s.currentFrame - n, 0));
  }, [setFrame]);

  // NOTE: 键盘快捷键（Space / 方向键）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForward(e.shiftKey ? 20 : 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepBackward(e.shiftKey ? 20 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, stepForward, stepBackward]);

  const pct = maxFrame > 0 ? (currentFrame / maxFrame) * 100 : 0;

  return (
    <div className="controls">
      {/* 播放/暂停按钮 */}
      <button className="ctrl-btn" id="playBtn" title={tr({ zh: '播放/暂停 (Space)', en: 'Play/Pause (Space)'
    })} onClick={togglePlay}>
        {isPlaying ? (
          <svg className="icon-pause" viewBox="0 0 24 24">
            <rect x="5" y="3" width="4" height="18" />
            <rect x="15" y="3" width="4" height="18" />
          </svg>
        ) : (
          <svg className="icon-play" viewBox="0 0 24 24">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </button>

      {/* 进度条 */}
      <div className="progress-wrapper">
        <input
          type="range"
          id="progress"
          min={0}
          max={maxFrame}
          value={currentFrame}
          step={1}
          onChange={e => setFrame(parseInt(e.target.value))}
        />
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>

      {/* 速度按钮 */}
      <div className="speed-group">
        {[1, 3, 10].map(spd => (
          <button
            key={spd}
            className={`speed-btn${playSpeed === spd ? ' active' : ''}`}
            onClick={() => setPlaySpeed(spd)}
          >
            {spd}×
          </button>
        ))}
      </div>

      {/* 同步模式（多选手时显示） */}
      {players.length > 1 && (
        <div className="sync-group" title={tr({ zh: '多选手同步模式', en: 'Multi-cuber sync mode'
        })}>
          {(['solve', 'date'] as const).map(mode => (
            <button
              key={mode}
              className={`sync-btn${syncMode === mode ? ' active' : ''}`}
              onClick={() => setSyncMode(mode)}
            >
              {mode === 'solve'
                ? tr({ zh: '把数', en: 'Solves'
                                      })
                : tr({ zh: '日期', en: 'Date' })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
