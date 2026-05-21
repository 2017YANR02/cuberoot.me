/**
 * /trainer/:puzzle/:set/run — actual timing.
 *
 * SCD-style: top bar with Select Algs link, scramble + big timer in center,
 * sidebar (Solve #N + Statistics). Space hold + touch via useSpaceHoldTimer.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Flag, RefreshCw } from 'lucide-react';
import {
  ALG_PUZZLES, getAlgSetMeta, loadAlg, type AlgPuzzle,
} from '@cuberoot/shared';
import { useTrainerStore, TimerState } from '../../stores/trainerStore';
import { useSpaceHoldTimer } from '../../hooks/useSpaceHoldTimer';
import { findCaseByKey } from '../../utils/trainerCaseKey';
import {
  TimerDisplay, ScrambleHeader, SolveCard, StatsList,
} from './components';
import LangToggle from '../../components/LangToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './trainer.css';

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

const TIMER_DELAY_MS = 0;

export default function TrainerRunPage() {
  const { puzzle: puzzleParam = '', set: setSlug = '' } = useParams<{ puzzle: string; set: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('训练中', 'Training');

  const validPuzzle = isPuzzle(puzzleParam);
  const meta = validPuzzle ? getAlgSetMeta(puzzleParam, setSlug) : undefined;

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const solves = useTrainerStore(s => s.solves);
  const currentName = useTrainerStore(s => s.currentName);
  const currentScramble = useTrainerStore(s => s.currentScramble);
  const timerState = useTrainerStore(s => s.timerState);
  const timerStarted = useTrainerStore(s => s.timerStarted);
  const observingIdx = useTrainerStore(s => s.observingIdx);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);
  const loadSession = useTrainerStore(s => s.loadSession);
  const pickRandomCase = useTrainerStore(s => s.pickRandomCase);
  const getTimerReady = useTrainerStore(s => s.getTimerReady);
  const startTimer = useTrainerStore(s => s.startTimer);
  const stopTimer = useTrainerStore(s => s.stopTimer);
  const setTimerState = useTrainerStore(s => s.setTimerState);
  const setObservingIdx = useTrainerStore(s => s.setObservingIdx);
  const deleteSolve = useTrainerStore(s => s.deleteSolve);
  const clearSolves = useTrainerStore(s => s.clearSolves);

  // Live ms tick for running timer。用 rAF 平摊到帧率 (~60fps),100Hz setInterval 多 3x 渲染。
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

  // Load session if needed
  useEffect(() => {
    if (!validPuzzle || !meta) return;
    if (storePuzzle === puzzleParam && storeSet === setSlug && cases.length > 0) return;
    loadAlg(puzzleParam, setSlug)
      .then(d => loadSession(puzzleParam, setSlug, d.cases))
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzleParam, setSlug, validPuzzle, meta, storePuzzle, storeSet, cases.length, loadSession]);

  // First scramble after loading
  useEffect(() => {
    if (cases.length > 0 && selected.length > 0 && currentName === null) {
      pickRandomCase();
    }
  }, [cases.length, selected.length, currentName, pickRandomCase]);

  const { onTouchStart, onTouchEnd } = useSpaceHoldTimer({
    state: timerState,
    delayMs: TIMER_DELAY_MS,
    getTimerReady,
    startTimer,
    stopTimer,
    setNotRunning: () => setTimerState(TimerState.NOT_RUNNING),
  });

  if (!validPuzzle || !meta) {
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {isZh ? '未知公式集' : 'Unknown set'}: {puzzleParam}/{setSlug}
        </div>
      </div>
    );
  }

  if (selected.length === 0 && cases.length > 0) {
    // Forgot to pick — bounce to selection
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {isZh ? '尚未选 case' : 'No cases selected'}
          <div style={{ marginTop: 16 }}>
            <Link to={`/trainer/${puzzleParam}/${setSlug}`} className="trainer-start-btn">
              <Flag size={14} /> {isZh ? '去选择' : 'Pick cases'}
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

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link to={`/trainer/${puzzleParam}/${setSlug}`} className="trainer-back">
          <ArrowLeft size={14} /> {isZh ? '选 case' : 'Select Algs'}
        </Link>
        <span style={{ fontSize: '1rem', color: '#aaa' }}>
          {puzzleParam} · {isZh ? meta.zh : meta.en}
        </span>
        <div className="trainer-spacer" />
        <LangToggle variant="inline" />
      </div>

      <div className="trainer-run">
        <div className="trainer-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <ScrambleHeader
            scramble={currentScramble || ''}
            label={isZh ? '打乱:' : 'Scramble:'}
          />
          <div className="trainer-stage-actions">
            <button
              className="trainer-stage-btn"
              onClick={onNewCase}
              disabled={timerState !== TimerState.NOT_RUNNING}
            >
              <RefreshCw size={12} /> {isZh ? '换一个' : 'New Case'}
            </button>
          </div>

          <TimerDisplay state={timerState} ms={ms} />

          <div className="trainer-help">
            {isZh ? '空格开始/停止' : 'Space to start/stop'}
          </div>
        </div>

        <aside className="trainer-sidebar">
          <SolveCard
            puzzle={puzzleParam}
            set={setSlug}
            solve={observingSolve}
            c={observingCase}
            isZh={isZh}
            onDelete={observingSolve ? () => {
              if (confirm(isZh ? '删除此成绩?' : 'Delete this solve?'))
                deleteSolve(observingIdx);
            } : undefined}
            header={observingSolve
              ? (isZh ? `第 ${observingSolve.i + 1} 次` : `Solve #${observingSolve.i + 1}`)
              : (isZh ? '当前' : 'Current')}
          />
          <StatsList
            solves={solves}
            observingIdx={observingIdx}
            isZh={isZh}
            onPick={(i) => setObservingIdx(i)}
            onClear={() => {
              if (confirm(isZh ? '清空所有成绩?' : 'Clear all solves?'))
                clearSolves();
            }}
          />
        </aside>
      </div>

    </div>
  );
}
