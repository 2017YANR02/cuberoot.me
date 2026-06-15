'use client';

// NOTE: 进步幅度滑杆 — 控制 KDE 采样的 Target 锚定缩放
// 原版 index.html#106-120 + app.js#294-577

import { useState, useCallback } from 'react';
import { setProgress, getProgressInfo } from '../engine/sim_engine';

export function ProgressSliders() {
  // NOTE: 触发重渲染的本地状态
  const [valA, setValA] = useState(0);
  const [valB, setValB] = useState(0);

  const handleChange = useCallback((p: number, rawVal: string) => {
    const val = parseInt(rawVal) || 0;
    setProgress(p, val);
    if (p === 0) setValA(val);
    else setValB(val);
  }, []);

  const infoA = getProgressInfo(0);
  const infoB = getProgressInfo(1);

  return (
    <div className="progress-controls" id="progress-controls">
      <div className="progress-row progress-a">
        <span className="progress-label">A</span>
        <input
          type="range"
          className="progress-slider slider-a"
          min="-20"
          max="100"
          value={valA}
          step="1"
          onChange={(e) => handleChange(0, e.target.value)}
        />
        <span className="progress-info" style={{ color: infoA.color || undefined }}>
          {infoA.text}
        </span>
      </div>
      <div className="progress-row progress-b">
        <span className="progress-label">B</span>
        <input
          type="range"
          className="progress-slider slider-b"
          min="-20"
          max="100"
          value={valB}
          step="1"
          onChange={(e) => handleChange(1, e.target.value)}
        />
        <span className="progress-info" style={{ color: infoB.color || undefined }}>
          {infoB.text}
        </span>
      </div>
    </div>
  );
}

export default ProgressSliders;
