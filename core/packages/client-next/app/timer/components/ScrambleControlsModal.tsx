'use client';

/**
 * ScrambleControlsModal — combined "lock current scramble" + "skip N scrambles"
 * controls. Lock holds the current scramble across solves; offset lets the user
 * jump ahead in the (RNG) sequence by N.
 */

import { useEffect, useState } from 'react';
import { Lock, LockOpen, SkipForward, X } from 'lucide-react';

interface Props {
  isZh: boolean;
  locked: boolean;
  onSetLocked: (v: boolean) => void;
  onSkip: (n: number) => void;
  onClose: () => void;
}

export default function ScrambleControlsModal({
  isZh, locked, onSetLocked, onSkip, onClose,
}: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [skipN, setSkipN] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tmr-modal-backdrop" onClick={onClose}>
      <div className="tmr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tmr-modal-head">
          <h3>{t('打乱控制', 'Scramble controls')}</h3>
          <button type="button" className="tmr-icon-btn" onClick={onClose} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 0' }}>
          <div>
            <button
              type="button"
              className="tmr-action-btn"
              aria-pressed={locked}
              onClick={() => onSetLocked(!locked)}
            >
              {locked ? <Lock size={14} /> : <LockOpen size={14} />}
              <span style={{ marginLeft: 6 }}>
                {locked ? t('已锁定:解锁', 'Locked: unlock') : t('锁定当前打乱', 'Lock current scramble')}
              </span>
            </button>
            <p style={{ fontSize: 12, opacity: 0.65, margin: '6px 0 0' }}>
              {t('锁定后每次计时复用当前打乱;再按这里解锁。', 'When locked, every solve reuses the current scramble. Unlock to resume rolling.')}
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13 }}>{t('跳过', 'Skip')}</span>
              <input
                type="number"
                min={1}
                max={100}
                value={skipN}
                onChange={(e) => setSkipN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                style={{ width: 64, padding: '4px 8px', font: 'inherit' }}
              />
              <button
                type="button"
                className="tmr-action-btn"
                onClick={() => onSkip(skipN)}
              >
                <SkipForward size={14} />
                <span style={{ marginLeft: 6 }}>{t('生成新打乱', 'Generate')}</span>
              </button>
            </div>
            <p style={{ fontSize: 12, opacity: 0.65, margin: '6px 0 0' }}>
              {t('一次生成 N 个新打乱,只保留最后一个。', 'Rolls N new scrambles, keeping the last one.')}
            </p>
          </div>
        </div>

        <div className="tmr-modal-foot">
          <button type="button" className="tmr-action-btn" onClick={onClose}>{t('完成', 'Done')}</button>
        </div>
      </div>
    </div>
  );
}
