'use client';

/**
 * ReconPlayOverlay — 复盘预览(隐藏完整控制条时)的画面内播放/暂停浮层。
 * 成绩弹窗(AttemptPopover)里播放器传 hideControls,不再显示整条控制条,
 * 改由这一个浮层按钮驱动播放:暂停时居中大按钮(明显可点),播放时缩到左下角
 * 小按钮(让开魔方 + 可拖动旋转)。三种引擎(cuber NxN / sq1 / cubing.js)共用。
 */

import { Play, Pause } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './ReconPlayOverlay.css';

export default function ReconPlayOverlay({ playing, onToggle }: {
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="recon-play-overlay">
      <button
        type="button"
        className={`recon-play-overlay-btn${playing ? ' is-playing' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={playing ? tr({ zh: '暂停', en: 'Pause' }) : tr({ zh: '播放动画', en: 'Play' })}
      >
        {playing ? <Pause size={15} /> : <Play size={22} />}
      </button>
    </div>
  );
}
