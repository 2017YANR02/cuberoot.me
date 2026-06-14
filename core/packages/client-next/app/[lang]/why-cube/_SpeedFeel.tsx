'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, RotateCcw } from 'lucide-react';
import { useT } from '../../../hooks/useT';
import './_SpeedFeel.css';

const SINGLE_WR = 2.76;
const AVERAGE_WR = 3.71;
const BLINK = 0.3;

type Phase = 'idle' | 'running' | 'done';

export default function SpeedFeel() {
  useTranslation();
  const t = useT();

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setElapsed((performance.now() - startRef.current) / 1000);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handlePress = useCallback(() => {
    setPhase((p) => {
      if (p === 'idle' || p === 'done') {
        startRef.current = performance.now();
        setElapsed(0);
        stopLoop();
        rafRef.current = requestAnimationFrame(tick);
        return 'running';
      }
      // running -> stop
      stopLoop();
      setElapsed((performance.now() - startRef.current) / 1000);
      return 'done';
    });
  }, [stopLoop, tick]);

  const reset = useCallback(() => {
    stopLoop();
    setElapsed(0);
    setPhase('idle');
  }, [stopLoop]);

  // spacebar on desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      handlePress();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePress]);

  // cleanup rAF on unmount
  useEffect(() => () => stopLoop(), [stopLoop]);

  const mine = elapsed;
  const maxVal = Math.max(mine, AVERAGE_WR, SINGLE_WR, BLINK) * 1.08;

  const rows = [
    { key: 'mine', label: t('你的时间', 'Your time', "你的時間"), value: mine, note: '', mine: true },
    {
      key: 'single',
      label: t('三阶单次世界纪录', '3×3 single WR', "三階單次世界紀錄"),
      value: SINGLE_WR,
      note: t('Teodor Zajder,2026,首个 sub-3', 'Teodor Zajder, 2026 — first sub-3', "Teodor Zajder,2026,首個 sub-3"),
      mine: false,
    },
    {
      key: 'average',
      label: t('三阶平均世界纪录', '3×3 average WR', "三階平均世界紀錄"),
      value: AVERAGE_WR,
      note: t('耿暄一', 'Xuanyi Geng'),
      mine: false,
    },
    {
      key: 'blink',
      label: t('一次眨眼', 'A blink'),
      value: BLINK,
      note: t('约 0.1–0.4 秒,仅供感受', 'approx. 0.1–0.4 s, just for fun', "約 0.1–0.4 秒,僅供感受"),
      mine: false,
    },
  ];

  const solves = mine > 0 ? Math.floor(mine / SINGLE_WR) : 0;

  return (
    <div className="speedfeel">
      <button
        type="button"
        className="speedfeel__pad"
        data-phase={phase}
        onClick={handlePress}
      >
        <span className="speedfeel__padlabel" aria-live="polite">
          {phase === 'idle' && (
            <>
              <Timer size={20} aria-hidden />
              {t('点一下开始计时', 'Tap to start the timer', "點一下開始計時")}
              <span className="speedfeel__kbd">{t('或按空格键', 'or press Space', "或按空格鍵")}</span>
            </>
          )}
          {phase === 'running' && t('再点一下停止', 'Tap again to stop', "再點一下停止")}
          {phase === 'done' && t('点一下重新计时', 'Tap to time again', "點一下重新計時")}
        </span>
        <span className="speedfeel__time">{mine.toFixed(2)}</span>
        <span className="speedfeel__unit">{t('秒', 'seconds')}</span>
      </button>

      {phase === 'done' && (
        <div className="speedfeel__result">
          <div className="speedfeel__bars">
            {rows.map((r) => (
              <div className="speedfeel__row" key={r.key} data-mine={r.mine || undefined}>
                <div className="speedfeel__rowhead">
                  <span className="speedfeel__rowlabel">{r.label}</span>
                  <span className="speedfeel__rowval">{r.value.toFixed(2)}s</span>
                </div>
                <div className="speedfeel__track">
                  <div
                    className="speedfeel__fill"
                    style={{ width: `${Math.max(2, (r.value / maxVal) * 100)}%` }}
                  />
                </div>
                {r.note && <div className="speedfeel__note">{r.note}</div>}
              </div>
            ))}
          </div>

          <p className="speedfeel__takeaway">
            {solves >= 1
              ? t(
                  `在你用掉的 ${mine.toFixed(2)} 秒里,世界纪录选手能还原 ${solves} 次魔方。`,
                  `In the ${mine.toFixed(2)} seconds you took, a world-record solver could finish a cube ${solves} time${solves === 1 ? '' : 's'}.`, `在你用掉的 ${mine.toFixed(2)} 秒裡,世界紀錄選手能還原 ${solves} 次魔方。`
                )
              : t(
                  `世界纪录是 ${SINGLE_WR} 秒还原一次,再试试看你能多快!`,
                  `The world record is one solve in ${SINGLE_WR} seconds — see how fast you can go!`, `世界紀錄是 ${SINGLE_WR} 秒還原一次,再試試看你能多快!`
                )}
          </p>

          <button type="button" className="speedfeel__again" onClick={reset}>
            <RotateCcw size={16} aria-hidden />
            {t('再来一次', 'Try again', "再來一次")}
          </button>
        </div>
      )}
    </div>
  );
}
