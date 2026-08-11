'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { VisualCube } from '@/components/VisualCube';
import { Spinner } from '@/components/Spinner/Spinner';
import { SubsetColorPicker, COLOR_NAME, useSubsetSelection, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
import type { BluetoothCubeHandle } from '../_lib/bluetooth';
import { applyScramble, facesEqual, isSolvedFaces, toFaceletString, type CubeFaces } from '../_lib/cube/state';
import { countHtm } from '../_lib/reconstruct/htm';
import { generateStageQuestion } from '../_lib/stage-training-engine';
import {
  STAGE_FIXED_LENGTH,
  STAGE_ORDER,
  effectiveStageSlot,
  isStageTrainingSolved,
  stageSlotCombos,
  stageSlotLabel,
  type SmartTrainingMode,
  type StageQuestion,
  type StageScrambleStyle,
  type StageSlot,
  type StageTrainingConfig,
  type StageTrainingMode,
  type StageTrainingStage,
} from '../_lib/stage-training';
import './stage-training.css';

interface Props {
  isZh: boolean;
  cube: BluetoothCubeHandle;
  onMoveSubscriber: (cb: (move: string, timestamp: number) => void) => () => void;
  onClose: () => void;
}

interface TrainingResult {
  correct: boolean;
  moves?: number;
}

interface StatLine {
  total: number;
  correct: number;
  wrong: number;
}

type StatsStore = Record<string, StatLine>;
type SmartPhase = 'disconnected' | 'needs-solved' | 'scrambling' | 'solving' | 'result';

const STATS_KEY = 'cuberoot-timer.stage-training.stats.v1';
const EMPTY_STATS: StatLine = { total: 0, correct: 0, wrong: 0 };
const SOLVER_FACE_COLOR: ColorLetter[] = ['Y', 'W', 'O', 'R', 'G', 'B'];

const stageName = (stage: StageTrainingStage) => ({
  cross: 'Cross',
  xcross: 'XCross',
  xxcross: 'XXCross',
  xxxcross: 'XXXCross',
})[stage];

const modeLabel = (mode: StageTrainingMode) => ({
  plan: tr({ zh: '规划最优解', en: 'Plan an optimal solution' }),
  guess: tr({ zh: '猜最优步数', en: 'Guess optimal length' }),
  smart: tr({ zh: '智能魔方实拧', en: 'Smart cube execution' }),
})[mode];

const styleLabel = (style: StageScrambleStyle) => ({
  current: tr({ zh: '现有长打乱', en: 'Current long scramble' }),
  optimal: tr({ zh: '长度 = 最优 n', en: 'Length = optimal n' }),
  'plus-one': tr({ zh: '长度 = n + 1', en: 'Length = n + 1' }),
  fixed: tr({ zh: '阶段固定长度', en: 'Stage fixed length' }),
})[style];

function loadStats(): StatsStore {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}') as StatsStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStats(stats: StatsStore): void {
  persistItem(STATS_KEY, JSON.stringify(stats));
}

export default function StageTrainingModal({ isZh, cube, onMoveSubscriber, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const colors = useSubsetSelection('single', 'Y');
  const [stage, setStage] = useState<StageTrainingStage>('cross');
  const [slot, setSlot] = useState<StageSlot>('best');
  const [mode, setMode] = useState<StageTrainingMode>('plan');
  const [style, setStyle] = useState<StageScrambleStyle>('current');
  const [smartMode, setSmartMode] = useState<SmartTrainingMode>('virtual');
  const [question, setQuestion] = useState<StageQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [stats, setStats] = useState<StatsStore>(loadStats);
  const [smartPhase, setSmartPhase] = useState<SmartPhase>('disconnected');
  const [smartMoveCount, setSmartMoveCount] = useState(0);
  const [connectError, setConnectError] = useState('');
  const requestRef = useRef(0);
  const cubeRef = useRef(cube);
  cubeRef.current = cube;
  const phaseRef = useRef<SmartPhase>('disconnected');
  const movesRef = useRef<Array<{ m: string; ts: number }>>([]);
  const answeredRef = useRef(false);

  const config = useMemo<StageTrainingConfig>(() => ({
    stage,
    colors: colors.subsetKey,
    slot,
  }), [stage, colors.subsetKey, slot]);
  const resolvedSlot = effectiveStageSlot(config);
  const activeStyle: StageScrambleStyle = mode === 'guess' ? 'fixed' : style;
  const slotOptions = stageSlotCombos(stage);
  const showSlot = stage !== 'cross' && colors.selectedColors.length === 1;
  const statKey = `${mode === 'smart' ? `smart-${smartMode}` : mode}:${stage}`;
  const currentStats = stats[statKey] ?? EMPTY_STATS;
  const target = useMemo<CubeFaces | null>(() => {
    if (!question) return null;
    try {
      return applyScramble(3, question.scramble);
    } catch {
      return null;
    }
  }, [question]);

  const setPhase = useCallback((next: SmartPhase) => {
    phaseRef.current = next;
    setSmartPhase(next);
  }, []);

  const recordResult = useCallback((correct: boolean) => {
    setStats((previous) => {
      const current = previous[statKey] ?? EMPTY_STATS;
      const next = {
        ...previous,
        [statKey]: {
          total: current.total + 1,
          correct: current.correct + (correct ? 1 : 0),
          wrong: current.wrong + (correct ? 0 : 1),
        },
      };
      saveStats(next);
      return next;
    });
  }, [statKey]);

  const newQuestion = useCallback(() => {
    const request = ++requestRef.current;
    cubeRef.current.clearHijack();
    setQuestion(null);
    setLoading(true);
    setError('');
    setRevealed(false);
    setResult(null);
    setSmartMoveCount(0);
    answeredRef.current = false;
    movesRef.current = [];
    void generateStageQuestion(config, activeStyle)
      .then((next) => {
        if (requestRef.current !== request) return;
        setQuestion(next);
        setLoading(false);
      })
      .catch(() => {
        if (requestRef.current !== request) return;
        setError(tr({
          zh: '这组条件暂时没构造出题目，请重试或换一种打乱长度。',
          en: 'Could not construct a question for these settings. Retry or choose another scramble length.',
        }));
        setLoading(false);
      });
  }, [activeStyle, config]);

  useEffect(() => {
    newQuestion();
    return () => { requestRef.current++; };
  }, [newQuestion]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => cubeRef.current.clearHijack(), []);

  // Arm the chosen smart-cube flow whenever a fresh question or connection arrives.
  useEffect(() => {
    movesRef.current = [];
    answeredRef.current = false;
    setSmartMoveCount(0);
    if (mode !== 'smart' || !question || !target) {
      cubeRef.current.clearHijack();
      return;
    }
    if (!cube.status.connected) {
      cubeRef.current.clearHijack();
      setPhase('disconnected');
      return;
    }
    if (smartMode === 'virtual') {
      if (cubeRef.current.hijackTo(target)) setPhase('solving');
      else setPhase('disconnected');
      return;
    }
    cubeRef.current.clearHijack();
    const physical = cubeRef.current.getFaces();
    setPhase(physical && isSolvedFaces(physical) ? 'scrambling' : 'needs-solved');
  }, [cube.status.connected, mode, question, smartMode, target, setPhase]);

  useEffect(() => onMoveSubscriber((move, timestamp) => {
    if (mode !== 'smart' || !question || !target || answeredRef.current) return;
    const faces = cubeRef.current.getFaces();
    if (!faces) return;

    if (smartMode === 'physical') {
      if (phaseRef.current === 'needs-solved') {
        if (isSolvedFaces(faces)) setPhase('scrambling');
        return;
      }
      if (phaseRef.current === 'scrambling') {
        if (facesEqual(faces, target)) {
          movesRef.current = [];
          setSmartMoveCount(0);
          setPhase('solving');
        }
        return;
      }
    }

    if (phaseRef.current !== 'solving') return;
    movesRef.current.push({ m: move, ts: timestamp });
    const moveCount = countHtm(movesRef.current);
    setSmartMoveCount(moveCount);
    if (!isStageTrainingSolved(toFaceletString(faces), config)) return;

    answeredRef.current = true;
    const correct = moveCount === question.optimal;
    setResult({ correct, moves: moveCount });
    recordResult(correct);
    setPhase('result');
  }), [config, mode, onMoveSubscriber, question, recordResult, setPhase, smartMode, target]);

  const answerGuess = (answer: number) => {
    if (!question || result) return;
    const correct = answer === question.optimal;
    setResult({ correct });
    setRevealed(true);
    recordResult(correct);
  };

  const resetStats = () => {
    setStats((previous) => {
      const next = { ...previous, [statKey]: { ...EMPTY_STATS } };
      saveStats(next);
      return next;
    });
  };

  const connect = () => {
    setConnectError('');
    void cubeRef.current.connect().catch(() => setConnectError(tr({
      zh: '连接失败，请确认浏览器支持蓝牙并重试。',
      en: 'Connection failed. Check browser Bluetooth support and try again.',
    })));
  };

  const frameText = question ? [
    tr(COLOR_NAME[SOLVER_FACE_COLOR[question.face] ?? 'Y']),
    question.combo.replace(/\s+/g, '+'),
  ].filter(Boolean).join(' ') : '';
  const accuracy = currentStats.total ? Math.round(currentStats.correct / currentStats.total * 100) : 0;

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal stage-training-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="stage-training-head">
          <h2 id={titleId}>{tr({ zh: '阶段最优训练', en: 'Optimal stage training' })}</h2>
          <button ref={closeRef} type="button" className="stage-training-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
            <X size={18} />
          </button>
        </div>

        <div className="stage-training-controls" data-no-timer>
          <label>
            <span>{tr({ zh: '练习方式', en: 'Training mode' })}</span>
            <select className="stage-training-select" value={mode} onChange={(event) => setMode(event.target.value as StageTrainingMode)}>
              {(['plan', 'guess', 'smart'] as StageTrainingMode[]).map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}
            </select>
          </label>
          <label>
            <span>{tr({ zh: '阶段', en: 'Stage' })}</span>
            <select className="stage-training-select" value={stage} onChange={(event) => { setStage(event.target.value as StageTrainingStage); setSlot('best'); }}>
              {STAGE_ORDER.map((value) => <option key={value} value={value}>{stageName(value)}</option>)}
            </select>
          </label>
          <SubsetColorPicker sel={colors} isZh={isZh} />
          {showSlot && (
            <label>
              <span>{tr({ zh: '槽位', en: 'Slot' })}</span>
              <select className="stage-training-select" value={resolvedSlot} onChange={(event) => setSlot(event.target.value === 'best' ? 'best' : Number(event.target.value))}>
                <option value="best">{tr({ zh: '最优槽组合', en: 'Best slot combination' })}</option>
                {slotOptions.map((_combo, index) => <option key={index} value={index}>{stageSlotLabel(stage, index)}</option>)}
              </select>
            </label>
          )}
          {mode === 'smart' && (
            <label>
              <span>{tr({ zh: '智能魔方流程', en: 'Smart cube flow' })}</span>
              <select className="stage-training-select" value={smartMode} onChange={(event) => setSmartMode(event.target.value as SmartTrainingMode)}>
                <option value="virtual">{tr({ zh: '免打乱，直接还原', en: 'Virtual setup, solve directly' })}</option>
                <option value="physical">{tr({ zh: '先打乱，再还原', en: 'Scramble physically, then solve' })}</option>
              </select>
            </label>
          )}
          {mode !== 'guess' && (
            <label>
              <span>{tr({ zh: '打乱长度', en: 'Scramble length' })}</span>
              <select className="stage-training-select" value={style} onChange={(event) => setStyle(event.target.value as StageScrambleStyle)}>
                {(['current', 'optimal', 'plus-one', 'fixed'] as StageScrambleStyle[]).map((value) => <option key={value} value={value}>{styleLabel(value)}</option>)}
              </select>
            </label>
          )}
        </div>

        {mode === 'guess' && (
          <p className="stage-training-note">
            {tr({
              zh: `${stageName(stage)} 猜步数题固定使用 ${STAGE_FIXED_LENGTH[stage]} 步打乱。`,
              en: `${stageName(stage)} length-guess questions use a fixed ${STAGE_FIXED_LENGTH[stage]}-move scramble.`,
            })}
          </p>
        )}

        {mode !== 'plan' && (
          <div className="stage-training-stats" aria-label={tr({ zh: '答题统计', en: 'Answer statistics' })}>
            <span>{tr({ zh: `共 ${currentStats.total} 题`, en: `${currentStats.total} total` })}</span>
            <span className="is-correct">{tr({ zh: `对 ${currentStats.correct}`, en: `${currentStats.correct} correct` })}</span>
            <span className="is-wrong">{tr({ zh: `错 ${currentStats.wrong}`, en: `${currentStats.wrong} wrong` })}</span>
            <span>{accuracy}%</span>
            <button type="button" className="stage-training-button stage-training-stats-reset" onClick={resetStats}>{tr({ zh: '重置本组', en: 'Reset group' })}</button>
          </div>
        )}

        {loading && <div className="stage-training-loading"><Spinner size={18} />{tr({ zh: '正在计算 HTM 最优题目…', en: 'Computing an HTM-optimal question…' })}</div>}
        {!loading && error && (
          <div className="stage-training-error" role="alert">
            <span>{error}</span>
            <button type="button" className="stage-training-button" onClick={newQuestion}>{tr({ zh: '重试', en: 'Retry' })}</button>
          </div>
        )}

        {!loading && question && (
          <>
            <div className="stage-training-question">
              <VisualCube setup={question.scramble} view="iso" size={190} local alt={tr({ zh: `${stageName(stage)} 训练题`, en: `${stageName(stage)} training case` })} />
              <div className="stage-training-prompt">
                <div className="stage-training-scramble">{question.scramble}</div>
                <div className="stage-training-meta">
                  <span>{tr({ zh: `打乱 ${question.scrambleLength} HTM`, en: `${question.scrambleLength} HTM scramble` })}</span>
                  {mode === 'plan' && <span>{styleLabel(activeStyle)}</span>}
                </div>
              </div>
            </div>

            {mode === 'plan' && (
              <div className="stage-training-answer-area">
                {!revealed ? (
                  <button type="button" className="stage-training-primary" onClick={() => setRevealed(true)}>{tr({ zh: '显示最优答案', en: 'Reveal optimal answer' })}</button>
                ) : (
                  <div className="stage-training-answer">
                    <strong>{question.optimal} HTM</strong>
                    <span>{frameText}</span>
                    <code>{question.solution || tr({ zh: '已完成', en: 'Already solved' })}</code>
                  </div>
                )}
              </div>
            )}

            {mode === 'guess' && (
              <div className="stage-training-answer-area">
                <div className="stage-training-number-grid" aria-label={tr({ zh: '选择最优步数', en: 'Choose the optimal length' })}>
                  {Array.from({ length: STAGE_FIXED_LENGTH[stage] }, (_, index) => index + 1).map((answer) => (
                    <button key={answer} type="button" className="stage-training-number-button" disabled={!!result} onClick={() => answerGuess(answer)}>{answer}</button>
                  ))}
                </div>
                {result && (
                  <div className={`stage-training-feedback ${result.correct ? 'is-correct' : 'is-wrong'}`} role="status">
                    <strong>{result.correct ? tr({ zh: '回答正确', en: 'Correct' }) : tr({ zh: '回答错误', en: 'Incorrect' })}</strong>
                    <span>{tr({ zh: `最优是 ${question.optimal} HTM`, en: `Optimal is ${question.optimal} HTM` })}</span>
                    <code>{question.solution}</code>
                  </div>
                )}
              </div>
            )}

            {mode === 'smart' && (
              <div className="stage-training-smart">
                {smartPhase === 'disconnected' && (
                  <div className="stage-training-connect">
                    <span>{tr({ zh: '连接智能魔方后即可开始。', en: 'Connect a smart cube to begin.' })}</span>
                    <button type="button" className="stage-training-primary" onClick={connect}>{tr({ zh: '连接智能魔方', en: 'Connect smart cube' })}</button>
                    {connectError && <span className="stage-training-error-text">{connectError}</span>}
                  </div>
                )}
                {smartPhase === 'needs-solved' && <p>{tr({ zh: '请先把智能魔方完整还原，再按题目打乱。', en: 'Solve the smart cube fully before applying the scramble.' })}</p>}
                {smartPhase === 'scrambling' && <p>{tr({ zh: '请在智能魔方上完成上方打乱；匹配后自动开始记录解法。', en: 'Apply the scramble on the smart cube. Recording starts automatically when it matches.' })}</p>}
                {smartPhase === 'solving' && (
                  <p>{smartMode === 'virtual'
                    ? tr({ zh: `虚拟题面已就绪，直接还原 ${stageName(stage)}。当前 ${smartMoveCount} HTM。`, en: `Virtual setup ready. Solve ${stageName(stage)} directly. ${smartMoveCount} HTM so far.` })
                    : tr({ zh: `打乱已匹配，开始还原 ${stageName(stage)}。当前 ${smartMoveCount} HTM。`, en: `Scramble matched. Solve ${stageName(stage)}. ${smartMoveCount} HTM so far.` })}</p>
                )}
                {smartPhase === 'result' && result && (
                  <div className={`stage-training-feedback ${result.correct ? 'is-correct' : 'is-wrong'}`} role="status">
                    <strong>{result.correct ? tr({ zh: '最优，回答正确', en: 'Optimal — correct' }) : tr({ zh: '已完成，但不是最优', en: 'Completed, but not optimal' })}</strong>
                    <span>{tr({ zh: `你的解法 ${result.moves} HTM；最优 ${question.optimal} HTM`, en: `Your solution: ${result.moves} HTM; optimal: ${question.optimal} HTM` })}</span>
                    <code>{question.solution}</code>
                  </div>
                )}
              </div>
            )}

            <div className="stage-training-actions">
              {(mode === 'plan' ? revealed : !!result) && <button type="button" className="stage-training-primary" onClick={newQuestion}>{tr({ zh: '下一题', en: 'Next question' })}</button>}
              <button type="button" className="stage-training-button" onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
