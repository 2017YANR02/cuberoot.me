'use client';

/**
 * PlaybackPanel — step-through 3D playback of a recorded solve.
 *
 * Recomputes the scramble string on each idx change as
 * `original_scramble + first idx moves` and feeds it to CubePreview, which
 * applies the resulting scramble fresh every render — correct intermediate
 * states without per-move animation.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import type { EventId } from '../_lib/types';
import CubePreview from '../_lib/cube/CubePreview';
import { tr } from '@/i18n/tr';

interface SolveMoveLite { m: string; ts: number }

interface Props {
  event: EventId;
  scramble: string;
  moves: SolveMoveLite[];
  totalMs: number;
  isZh: boolean;
}

const MIN_TIMEOUT_MS = 16;
const SPEEDS: Array<{ key: string; label: string; mult: number }> = [
  { key: '0.5x', label: '0.5x', mult: 0.5 },
  { key: '1x',   label: '1x',   mult: 1 },
  { key: '2x',   label: '2x',   mult: 2 },
];

function formatSec(ms: number, digits = 3): string {
  return (ms / 1000).toFixed(digits) + 's';
}

export default function PlaybackPanel({ event, scramble, moves, totalMs, isZh }: Props) {
  const total = moves.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (idx > total) setIdx(total);
  }, [total, idx]);

  const composed = idx > 0
    ? `${scramble} ${moves.slice(0, idx).map(m => m.m).join(' ')}`
    : scramble;

  const elapsedMs = idx === 0 ? 0 : (moves[idx - 1]?.ts ?? 0);

  useEffect(() => {
    if (!playing) return;
    if (idx >= total) {
      setPlaying(false);
      return;
    }
    const currentTs = idx === 0 ? 0 : moves[idx - 1].ts;
    const nextTs = moves[idx].ts;
    const rawGap = Math.max(0, nextTs - currentTs);
    const scaled = rawGap / speedMult;
    const delay = Math.max(MIN_TIMEOUT_MS, scaled);
    timerRef.current = setTimeout(() => {
      setIdx(i => Math.min(total, i + 1));
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, idx, total, moves, speedMult]);

  useEffect(() => {
    if (idx >= total && playing) setPlaying(false);
  }, [idx, total, playing]);

  const handleStepBack = () => {
    setPlaying(false);
    setIdx(i => Math.max(0, i - 1));
  };
  const handleStepForward = () => {
    setPlaying(false);
    setIdx(i => Math.min(total, i + 1));
  };
  const handleTogglePlay = () => {
    if (idx >= total) {
      setIdx(0);
      setPlaying(true);
      return;
    }
    setPlaying(p => !p);
  };
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (Number.isFinite(v)) {
      setPlaying(false);
      setIdx(Math.max(0, Math.min(total, v)));
    }
  };

  const playLabel = playing
    ? (tr({ zh: '暂停', en: 'Pause',
        zhHant: "暫停"
    }))
    : (idx >= total ? (tr({ zh: '重播', en: 'Replay' })) : (tr({ zh: '播放', en: 'Play' })));

  return (
    <div className="reconstruct-playback">
      <div className="reconstruct-playback-cube">
        <CubePreview event={event} scramble={composed} size={20} />
      </div>

      <div className="reconstruct-playback-controls">
        <div className="reconstruct-playback-buttons">
          <button
            type="button"
            onClick={handleStepBack}
            disabled={idx === 0}
            title={tr({ zh: '上一步', en: 'Step back' })}
            aria-label={tr({ zh: '上一步', en: 'Step back' })}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={total === 0}
            title={playLabel}
            aria-label={playLabel}
          >
            {playing
              ? <Pause size={16} />
              : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={handleStepForward}
            disabled={idx >= total}
            title={tr({ zh: '下一步', en: 'Step forward' })}
            aria-label={tr({ zh: '下一步', en: 'Step forward' })}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <input
          type="range"
          className="reconstruct-playback-slider"
          min={0}
          max={total}
          step={1}
          value={idx}
          onChange={handleScrub}
          disabled={total === 0}
          aria-label={tr({ zh: '进度', en: 'Scrub',
              zhHant: "進度"
        })}
        />

        <div className="reconstruct-playback-meta">
          <span className="reconstruct-playback-counter">
            {idx} / {total} · {formatSec(elapsedMs)}
            {idx === total && total > 0 ? ` / ${formatSec(totalMs)}` : ''}
          </span>
          <span className="reconstruct-playback-speed">
            {SPEEDS.map(s => (
              <button
                key={s.key}
                type="button"
                className={`reconstruct-playback-speed-btn ${speedMult === s.mult ? 'active' : ''}`}
                onClick={() => setSpeedMult(s.mult)}
                title={`${tr({ zh: '速度', en: 'Speed' })} ${s.label}`}
              >
                {s.label}
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
