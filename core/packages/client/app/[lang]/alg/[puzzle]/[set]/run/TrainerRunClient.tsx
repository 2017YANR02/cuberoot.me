'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerRunPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Flag, RefreshCw } from 'lucide-react';
import { getAlgSetMeta, loadAlg } from '@cuberoot/shared';
import { useTrainerStore, TimerState } from '@/lib/trainer-store';
import { useSpaceHoldTimer } from '@/hooks/useSpaceHoldTimer';
import { useGestureWheel } from '@/hooks/useGestureWheel';
import { shouldIgnoreTimerTarget } from '@/lib/timer-ignore-target';
import GestureWheel from '@/components/GestureWheel';
import { findCaseByKey } from '@/lib/trainer-case-key';
import { availableKinds, SCRAMBLE_KINDS, type ScrambleKind } from '@/lib/trainer-scramble';
import {
  TimerDisplay, ScrambleHeader, SolveCard, StatsList,
} from '@/app/[lang]/alg/_trainer/trainer-components';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/app/[lang]/alg/_trainer/trainer.css';
import { tr } from '@/i18n/tr';

const TIMER_DELAY_MS = 0;

export default function TrainerRunClient() {
  const params = useParams<{ puzzle: string; set: string }>();
  const puzzleParam = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '';
  const setSlug = (Array.isArray(params?.set) ? params.set[0] : params?.set) ?? '';
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  useDocumentTitle('训练中', 'Training');

  const puzzle = resolveAlgPuzzle(puzzleParam);   // 接受 event code(333)或 legacy puzzle 名(3x3)
  const meta = puzzle ? getAlgSetMeta(puzzle, setSlug) : undefined;

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const solves = useTrainerStore(s => s.solves);
  const currentName = useTrainerStore(s => s.currentName);
  const currentScramble = useTrainerStore(s => s.currentScramble);
  const timerState = useTrainerStore(s => s.timerState);
  const timerStarted = useTrainerStore(s => s.timerStarted);
  const observingIdx = useTrainerStore(s => s.observingIdx);
  const scrambleKind = useTrainerStore(s => s.scrambleKind);
  const setScrambleKind = useTrainerStore(s => s.setScrambleKind);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);
  const loadSession = useTrainerStore(s => s.loadSession);
  const pickRandomCase = useTrainerStore(s => s.pickRandomCase);
  const getTimerReady = useTrainerStore(s => s.getTimerReady);
  const startTimer = useTrainerStore(s => s.startTimer);
  const stopTimer = useTrainerStore(s => s.stopTimer);
  const setTimerState = useTrainerStore(s => s.setTimerState);
  const setObservingIdx = useTrainerStore(s => s.setObservingIdx);
  const setSolvePenalty = useTrainerStore(s => s.setSolvePenalty);
  const deleteSolve = useTrainerStore(s => s.deleteSolve);
  const clearSolves = useTrainerStore(s => s.clearSolves);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (timerState !== TimerState.RUNNING) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timerState]);

  useEffect(() => {
    if (!puzzle || !meta) return;
    if (storePuzzle === puzzle && storeSet === setSlug && cases.length > 0) return;
    loadAlg(puzzle, setSlug)
      .then(d => loadSession(puzzle, setSlug, d.cases))
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzle, setSlug, meta, storePuzzle, storeSet, cases.length, loadSession]);

  useEffect(() => {
    if (cases.length > 0 && selected.length > 0 && currentName === null) {
      pickRandomCase();
    }
  }, [cases.length, selected.length, currentName, pickRandomCase]);

  // Space-bar timing (keyboard). Touch/mouse press-to-time is handled by the
  // gesture-wheel hook below so a press can also drive the radial dial.
  useSpaceHoldTimer({
    state: timerState,
    delayMs: TIMER_DELAY_MS,
    getTimerReady,
    startTimer,
    stopTimer,
    setNotRunning: () => setTimerState(TimerState.NOT_RUNNING),
  });

  // ── Radial gesture wheel (shared with /timer) ───────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const stageMounted = !!(puzzle && meta) && !(selected.length === 0 && cases.length > 0);

  // index: 0 new · 1 OK · 2 +2 · 3 DNF · 4 prev-solve · 5 next-solve · 6 del · 7 copy
  const wheelLabels = [
    tr({ zh: '换一个', en: 'New' }),
    'OK', '+2', 'DNF',
    tr({ zh: '看上次', en: 'Prev' }),
    tr({ zh: '看下次', en: 'Next' }),
    tr({ zh: '删除', en: 'Del' }),
    tr({ zh: '复制', en: 'Copy' }),
  ];

  const { wheelRef } = useGestureWheel({
    surfaceRef: stageRef,
    active: stageMounted,
    // 「换一个」等按钮在计时面板内 — 按它们不应触发按压计时(否则点了直接开始计时)。
    ignoreTarget: shouldIgnoreTimerTarget,
    canGesture: () => {
      const st = useTrainerStore.getState().timerState;
      return st === TimerState.NOT_RUNNING || st === TimerState.STOPPING;
    },
    enabledFor: () => {
      const st = useTrainerStore.getState();
      const hasLast = st.solves.length > 0;
      return [
        st.timerState === TimerState.NOT_RUNNING,
        hasLast, hasLast, hasLast,
        st.observingIdx > 0,
        st.observingIdx < st.solves.length - 1,
        hasLast,
        !!st.currentScramble,
      ];
    },
    fireAction: (i) => {
      const st = useTrainerStore.getState();
      const lastIdx = st.solves.length - 1;
      const last = st.solves[lastIdx];
      const obs = st.observingIdx;
      switch (i) {
        case 0: if (st.timerState === TimerState.NOT_RUNNING) pickRandomCase(); break;
        case 1: if (last) setSolvePenalty(lastIdx, 'ok'); break;
        case 2: if (last) setSolvePenalty(lastIdx, last.penalty === '+2' ? 'ok' : '+2'); break;
        case 3: if (last) setSolvePenalty(lastIdx, last.penalty === 'DNF' ? 'ok' : 'DNF'); break;
        case 4: if (obs > 0) setObservingIdx(obs - 1); break;
        case 5: if (obs < st.solves.length - 1) setObservingIdx(obs + 1); break;
        case 6: if (last) deleteSolve(lastIdx); break;
        case 7: {
          const scr = st.currentScramble;
          if (scr && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(scr).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }).catch(() => {});
          }
          break;
        }
      }
    },
    onPressDown: () => {
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.RUNNING) stopTimer();
      else if (st === TimerState.NOT_RUNNING) getTimerReady(TIMER_DELAY_MS);
    },
    onPressUp: () => {
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY) startTimer();
      else if (st === TimerState.AWAITING_READY || st === TimerState.STOPPING) setTimerState(TimerState.NOT_RUNNING);
    },
    onArmCancel: () => {
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY || st === TimerState.AWAITING_READY) setTimerState(TimerState.NOT_RUNNING);
    },
  });

  if (!puzzle || !meta) {
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {tr({ zh: '未知公式集', en: 'Unknown set' })}: {puzzleParam}/{setSlug}
        </div>
      </div>
    );
  }

  if (selected.length === 0 && cases.length > 0) {
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {tr({ zh: '尚未选 case', en: 'No cases selected'
        })}
          <div style={{ marginTop: 16 }}>
            <Link href={`/${lang}/alg/${puzzleParam}/${setSlug}/select`} className="trainer-start-btn">
              <Flag size={14} /> {tr({ zh: '去选择', en: 'Pick cases'
            })}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ms =
    timerState === TimerState.RUNNING ? now - timerStarted :
    timerState === TimerState.READY || timerState === TimerState.AWAITING_READY ? 0 :
    solves.length > 0 ? solves[solves.length - 1].ms : 0;

  const observingSolve = solves[observingIdx] ?? null;
  const observingCase = observingSolve
    ? findCaseByKey(cases, observingSolve.caseKey) ?? null
    : null;

  const onNewCase = () => {
    if (timerState === TimerState.NOT_RUNNING) pickRandomCase();
  };

  /**
   * 选中的这批 case 一共支持哪几种打乱(并集)。只有一种(全是 `inv`)就不渲染选择器。
   * 不是每个 case 都有全套 —— 表里验不过轨道判据的打乱没入库,generateScramble 会退回 `inv`。
   */
  const kinds = useMemo(() => {
    const seen = new Set<ScrambleKind>();
    for (const k of selected) {
      const c = findCaseByKey(cases, k);
      if (c) for (const kind of availableKinds(c)) seen.add(kind);
    }
    return SCRAMBLE_KINDS.filter(k => seen.has(k.id));
  }, [selected, cases]);

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link href={`/${lang}/alg/${puzzleParam}/${setSlug}/select`} className="trainer-back">
          <ArrowLeft size={14} /> {tr({ zh: '选 case', en: 'Select Algs'
        })}
        </Link>
        <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>
          {puzzle} · {tr(meta)}
        </span>
      </div>

      <div className="trainer-run">
        <div className="trainer-stage" ref={stageRef}>
          <ScrambleHeader
            scramble={currentScramble || ''}
            label={copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '打乱:', en: 'Scramble:'
            })}
          />
          <div className="trainer-stage-actions">
            <button
              className="trainer-stage-btn"
              onClick={onNewCase}
              disabled={timerState !== TimerState.NOT_RUNNING}
            >
              <RefreshCw size={12} /> {tr({ zh: '换一个', en: 'New Case'
            })}
            </button>
            {kinds.length > 1 && (
              <select
                className="trainer-scramble-kind"
                value={scrambleKind}
                onChange={e => setScrambleKind(e.target.value as ScrambleKind)}
                disabled={timerState !== TimerState.NOT_RUNNING}
                aria-label={tr({ zh: '打乱类型', en: 'Scramble type' })}
              >
                {kinds.map(k => <option key={k.id} value={k.id}>{k.label()}</option>)}
              </select>
            )}
          </div>

          <TimerDisplay state={timerState} ms={ms} penalty={solves.length > 0 ? solves[solves.length - 1].penalty : undefined} />

          <div className="trainer-help">
            {tr({ zh: '空格开始/停止，按住拖动标记成绩', en: 'Space to start/stop, drag to mark'
            })}
          </div>
        </div>

        <aside className="trainer-sidebar">
          <SolveCard
            puzzle={puzzle}
            set={setSlug}
            solve={observingSolve}
            c={observingCase}
            isZh={isZh}
            onDelete={observingSolve ? () => {
              if (confirm(tr({ zh: '删除此成绩?', en: 'Delete this solve?'
            })))
                deleteSolve(observingIdx);
            } : undefined}
            header={observingSolve
              ? (isZh ? `第 ${observingSolve.i + 1} 次` : `Solve #${observingSolve.i + 1}`)
              : tr({ zh: '当前', en: 'Current'
                            })}
          />
          <StatsList
            solves={solves}
            observingIdx={observingIdx}
            isZh={isZh}
            onPick={(i) => setObservingIdx(i)}
            onClear={() => {
              if (confirm(tr({ zh: '清空所有成绩?', en: 'Clear all solves?'
            })))
                clearSolves();
            }}
          />
        </aside>
      </div>

      <GestureWheel ref={wheelRef} isZh={isZh} labels={wheelLabels} />
    </div>
  );
}
