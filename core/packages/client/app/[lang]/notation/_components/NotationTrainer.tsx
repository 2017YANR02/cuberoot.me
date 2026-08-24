'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import type { AlgPlayerPuzzle } from '@/components/AlgPlayer/player-setup';
import type { MoveNotationOption } from '@/components/MoveNotationDemo/MoveNotationDemo';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useT } from '@/hooks/useT';
import { formatAlgNotation, formatCubeMoveDescription, type AlgNotationStyle } from '@/lib/alg-notation-display';

export const NOTATION_TRAINING_MODES = ['perform', 'identify'] as const;
export type NotationTrainingMode = (typeof NOTATION_TRAINING_MODES)[number];

interface NotationTrainerProps {
  puzzle: AlgPlayerPuzzle;
  puzzleOrder?: number;
  moves: readonly MoveNotationOption[];
  notationStyle: AlgNotationStyle;
  mode: NotationTrainingMode;
  onModeChange: (mode: NotationTrainingMode) => void;
}

type Feedback = 'idle' | 'correct' | 'wrong';

/**
 * A sticker drag emits one settled turn. Expand the displayed notation into that same
 * stream so U2 requires U + U, U2' requires U' + U', and R3 remains distinct from R'.
 * Puzzle-specific tokens that are already one physical gesture stay intact.
 */
function manualMoveSteps(move: string, puzzle: AlgPlayerPuzzle): string[] {
  const compact = move.replace(/\s+/g, '');
  if (puzzle === 'sq1' || puzzle === 'clock' || puzzle === 'megaminx') return [compact];

  const parsed = /^(.*?)(2'|3'|2|3|'|)$/.exec(compact);
  if (!parsed || !parsed[1]) return [compact];
  const root = parsed[1];
  const suffix = parsed[2];
  const count = suffix.startsWith('3') ? 3 : suffix.startsWith('2') ? 2 : 1;
  const step = `${root}${suffix.endsWith("'") ? "'" : ''}`;
  return Array.from({ length: count }, () => step);
}

function canPerformOnPuzzle(
  move: string,
  puzzle: AlgPlayerPuzzle,
  puzzleOrder?: number,
): boolean {
  if (puzzle === '3x3' || puzzle === '2x2' || puzzle === '4x4' || puzzle === '5x5') {
    const order = puzzleOrder ?? Number.parseInt(puzzle, 10);
    if (/^[xyz](?:2'?|')?$/.test(move)) return false;
    if (move.includes('w')) return false;
    if (order % 2 === 0 && /^[EMS](?:2'?|')?$/.test(move)) return false;
    return true;
  }
  if (puzzle === 'pyraminx') return !/^(?:y|Lv|Rv|Bv)'?$/.test(move);
  if (puzzle === 'skewb') return !/^[xyz](?:2|')?$/.test(move);
  if (puzzle === 'fto') return /^(?:U|F|R|L|D|Bl|Br|B)(?:2|')?$/.test(move);
  if (puzzle === 'sq1') {
    if (move === '/') return true;
    const match = /^\((-?\d+),(-?\d+)\)$/.exec(move.replace(/\s+/g, ''));
    return Boolean(match && (match[1] === '0' || match[2] === '0'));
  }
  if (puzzle === 'clock') return move !== 'y2';
  return true;
}

function questionChoices(
  moves: readonly MoveNotationOption[],
  targetIndex: number,
  round: number,
): MoveNotationOption[] {
  if (moves.length <= 4) return [...moves];
  const result = [moves[targetIndex]];
  const stride = Math.max(1, Math.floor(moves.length / 4));
  for (let offset = 1; result.length < 4 && offset < moves.length; offset += 1) {
    const option = moves[(targetIndex + offset * stride + round) % moves.length];
    if (!result.includes(option)) result.push(option);
  }
  const shift = round % result.length;
  return [...result.slice(shift), ...result.slice(0, shift)];
}

export default function NotationTrainer({
  puzzle,
  puzzleOrder,
  moves,
  notationStyle,
  mode,
  onModeChange,
}: NotationTrainerProps) {
  const t = useT();
  const performMoves = useMemo(
    () => moves.filter(option => canPerformOnPuzzle(option.move, puzzle, puzzleOrder)),
    [moves, puzzle, puzzleOrder],
  );
  const questionMoves = mode === 'perform' ? performMoves : moves;
  const [targetIndex, setTargetIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [selectedMove, setSelectedMove] = useState('');
  const [performedSteps, setPerformedSteps] = useState(0);
  const lockedRef = useRef(false);
  const performedStepsRef = useRef(0);
  const wrongTimerRef = useRef<number | null>(null);
  const safeTargetIndex = questionMoves.length === 0 ? 0 : targetIndex % questionMoves.length;
  const target = questionMoves[safeTargetIndex];
  const choices = useMemo(
    () => questionChoices(questionMoves, safeTargetIndex, round),
    [questionMoves, safeTargetIndex, round],
  );
  const expectedSteps = useMemo(
    () => target ? manualMoveSteps(target.move, puzzle) : [],
    [puzzle, target],
  );

  useEffect(() => () => {
    if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
  }, []);

  const labelFor = (option: MoveNotationOption): ReactNode => {
    if (notationStyle === 'standard') return <code>{option.move}</code>;
    if (notationStyle === 'zh-compact') {
      return <code>{option.symbol ?? formatAlgNotation(option.move, notationStyle)}</code>;
    }
    const caption = option.caption ?? t(
      formatCubeMoveDescription(option.move, 'zh'),
      formatCubeMoveDescription(option.move, 'en'),
    );
    return puzzle === 'fto'
      ? <><code>{option.move}</code><span>{caption}</span></>
      : <span>{caption}</span>;
  };

  const nextQuestion = useCallback(() => {
    if (wrongTimerRef.current !== null) {
      window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
    const length = questionMoves.length;
    setTargetIndex(current => {
      if (length <= 1) return 0;
      return (current + 1 + Math.floor(Math.random() * (length - 1))) % length;
    });
    setRound(current => current + 1);
    setAttempt(current => current + 1);
    setFeedback('idle');
    setSelectedMove('');
    setPerformedSteps(0);
    performedStepsRef.current = 0;
    lockedRef.current = false;
  }, [questionMoves.length]);

  const markWrong = useCallback(() => {
    setFeedback('wrong');
    if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
    wrongTimerRef.current = window.setTimeout(() => {
      setAttempt(current => current + 1);
      setFeedback('idle');
      setSelectedMove('');
      setPerformedSteps(0);
      performedStepsRef.current = 0;
      lockedRef.current = false;
      wrongTimerRef.current = null;
    }, 650);
  }, []);

  const judgeMove = useCallback((move: string) => {
    if (!target || lockedRef.current) return;
    const actualSteps = manualMoveSteps(move, puzzle);
    const offset = performedStepsRef.current;
    const matches = offset + actualSteps.length <= expectedSteps.length
      && actualSteps.every((step, index) => step === expectedSteps[offset + index]);
    if (!matches) {
      lockedRef.current = true;
      markWrong();
      return;
    }
    const next = offset + actualSteps.length;
    performedStepsRef.current = next;
    setPerformedSteps(next);
    if (next === expectedSteps.length) {
      lockedRef.current = true;
      setFeedback('correct');
    }
  }, [expectedSteps, markWrong, puzzle, target]);

  const chooseAnswer = (option: MoveNotationOption) => {
    if (!target || feedback === 'correct') return;
    setSelectedMove(option.move);
    if (option.move.replace(/\s+/g, '') === target.move.replace(/\s+/g, '')) {
      setFeedback('correct');
      return;
    }
    setFeedback('wrong');
  };

  if (!target) return null;

  return (
    <section className="notation-trainer" aria-labelledby="notation-trainer-title">
      <div className="notation-trainer-header">
        <h2 id="notation-trainer-title">{t('记号训练', 'Notation training')}</h2>
        <PillToggle
          value={mode === 'identify'}
          onChange={identify => onModeChange(identify ? 'identify' : 'perform')}
          offLabel={t('看记号手拧', 'Perform the move')}
          onLabel={t('看转动选记号', 'Name the move')}
          ariaLabel={t('选择记号训练方式', 'Choose a notation training mode')}
        />
      </div>

      <div className="notation-trainer-layout">
        <div className="notation-trainer-stage">
          <AlgPlayer
            key={`${puzzle}-${puzzleOrder ?? ''}-${mode}-${attempt}-${target.move}`}
            alg={mode === 'identify' ? target.move : ''}
            puzzle={puzzle}
            puzzleOrder={puzzleOrder}
            set=""
            startSolved
            autoPlay={mode === 'identify'}
            controlMode={mode === 'identify' ? 'replay' : 'none'}
            interactionMode={mode === 'perform' ? 'turn' : 'view'}
            onUserMove={mode === 'perform' ? judgeMove : undefined}
            size={300}
          />
        </div>

        <div className="notation-trainer-question">
          <p className="notation-trainer-kicker">
            {mode === 'perform'
              ? t('请在魔方上做出', 'Perform this move on the puzzle')
              : t('刚才做的是哪一步？', 'Which move did the puzzle perform?')}
          </p>

          {mode === 'perform' && (
            <div className="notation-trainer-prompt">{labelFor(target)}</div>
          )}

          {mode === 'identify' && (
            <div className="notation-trainer-choices">
              {choices.map(option => {
                const selected = selectedMove === option.move;
                const correct = feedback === 'correct'
                  && option.move.replace(/\s+/g, '') === target.move.replace(/\s+/g, '');
                return (
                  <button
                    key={option.move}
                    type="button"
                    className={`notation-trainer-choice${selected ? ' is-selected' : ''}${correct ? ' is-correct' : ''}`}
                    aria-pressed={selected}
                    onClick={() => chooseAnswer(option)}
                  >
                    {labelFor(option)}
                  </button>
                );
              })}
            </div>
          )}

          <p className="notation-trainer-hint">
            {mode === 'perform'
              ? t('拖动贴块完成转动；拖动空白处可调整视角。', 'Drag a sticker to turn a layer; drag empty space to adjust the view.')
              : t('可拖动魔方调整视角，也可以重播这一转。', 'Drag the puzzle to adjust the view, or replay the move.')}
          </p>

          {mode === 'perform' && expectedSteps.length > 1 && feedback === 'idle' && (
            <p className="notation-trainer-progress">
              {t(`已完成 ${performedSteps}/${expectedSteps.length}`, `${performedSteps}/${expectedSteps.length} turns completed`)}
            </p>
          )}

          <div className="notation-trainer-result" aria-live="polite">
            {feedback === 'correct' && <span>{t('正确', 'Correct')}</span>}
            {feedback === 'wrong' && <span>{t('不对，再试一次', 'Not quite. Try again.')}</span>}
          </div>

          <button type="button" className="notation-trainer-next" onClick={nextQuestion}>
            {t('下一题', 'Next question')}
          </button>
        </div>
      </div>
    </section>
  );
}
