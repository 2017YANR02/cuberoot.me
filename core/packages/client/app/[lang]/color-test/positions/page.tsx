'use client';

import { useTrainingStats } from '@/hooks/useTrainingStats';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { RotateCcw } from 'lucide-react';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import HeaderToggles from '@/components/HeaderToggles';
import {
  SubsetColorPicker,
  useSubsetSelection,
  type ColorLetter,
} from '@/components/SubsetColorPicker/SubsetColorPicker';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import TrainingNavButton from '@/components/TrainingNavButton';
import TrainingSettings, { useTrainingAutoAdvance } from '@/components/TrainingSettings';
import '@/components/training-stats.css';
import { useSpaceShortcut } from '@/hooks/useSpaceShortcut';
import { tr, useLang } from '@/i18n/tr';
import {
  CUBE_COLOR_NAMES,
  CUBE_FACE_FOR_COLOR_LETTER,
  CUBE_FILL,
  type CubeFace,
} from '@/lib/cube-colors';
import ColorSwatch from '../_components/ColorSwatch';
import {
  ALL_POSITION_QUESTIONS,
  buildPositionRound,
  positionQuestionsForTop,
  sideOrderForTop,
  type PositionQuestion,
  type SideFace,
} from '../_lib/positions';
import '../_components/color-quiz.css';

function colorName(face: SideFace): string {
  return tr(CUBE_COLOR_NAMES[face]);
}

function randomTopFace(colors: readonly ColorLetter[]): CubeFace {
  return CUBE_FACE_FOR_COLOR_LETTER[colors[Math.floor(Math.random() * colors.length)] ?? 'W'];
}

function Result({ score, topFace, showColorNames, onPrevious, onRestart }: {
  score: number;
  topFace: CubeFace;
  showColorNames: boolean;
  onPrevious: () => void;
  onRestart: () => void;
}) {
  const summary = score === ALL_POSITION_QUESTIONS.length
    ? { zh: '全部答对,颜色位置关系已经很稳了。', en: 'Perfect. You have the colour positions down.' }
    : score >= 9
      ? { zh: '已经很稳,再来一轮补齐容易混淆的位置。', en: 'Nearly there. One more round should settle the positions that still blur together.' }
      : { zh: '先记住三组对色和四个侧面的循环顺序。', en: 'Start with the three opposite pairs and the four-colour side cycle.' };

  return (
    <section className="color-quiz-result" aria-live="polite">
      <p className="color-quiz-result-kicker">{tr({ zh: '本轮成绩', en: 'ROUND COMPLETE' })}</p>
      <div className="color-quiz-result-score">
        <strong>{score}</strong>
        <span>/ {ALL_POSITION_QUESTIONS.length}</span>
      </div>
      <p>{tr(summary)}</p>

      <div className="color-quiz-memory">
        <h2>{tr({
          zh: `${CUBE_COLOR_NAMES[topFace].zh}色朝上时的侧面顺序`,
          en: `Side order with ${CUBE_COLOR_NAMES[topFace].en} on top`,
        })}</h2>
        <div className="position-order">
          {sideOrderForTop(topFace).map((face) => (
            <span className="color-quiz-memory-pair" key={face}>
              <ColorSwatch face={face} compact showLabel={showColorNames} />
              <i>→</i>
            </span>
          ))}
          <ColorSwatch face={sideOrderForTop(topFace)[0]} compact showLabel={showColorNames} />
        </div>
      </div>

      <div className="color-quiz-result-actions">
        <TrainingNavButton direction="previous" onClick={onPrevious}>
          {tr({ zh: '上一题', en: 'Previous question' })}
        </TrainingNavButton>
        <button type="button" className="color-quiz-primary-button" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden="true" />
          {tr({ zh: '再来一轮', en: 'Try another round' })}
        </button>
      </div>
    </section>
  );
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

function ColorStatsRow({ face }: { face: CubeFace }) {
  const { stats, reset } = useTrainingStats(`color:positions:${face}`);
  const [confirmReset, setConfirmReset] = useState(false);
  const graded = stats.correct + stats.wrong;
  return (
    <>
      <tr>
        <td>
          <span className="color-stats-face">
            <i style={{ '--color-fill': CUBE_FILL[face] } as CSSProperties} />
            <span>{tr(CUBE_COLOR_NAMES[face])}</span>
          </span>
        </td>
        <td>{stats.total}</td>
        <td>{stats.correct} / {stats.wrong}</td>
        <td>{graded ? `${Math.round(stats.correct / graded * 100)}%` : '—'}</td>
        <td>{stats.timed ? seconds(stats.totalMs / stats.timed) : '—'}</td>
        <td>{stats.bestMs === null ? '—' : seconds(stats.bestMs)}</td>
        <td>
          {confirmReset ? (
            <span className="color-stats-confirm">
              <button className="color-stats-reset" type="button" onClick={() => { reset(); setConfirmReset(false); }}>
                {tr({ zh: '确认', en: 'Confirm' })}
              </button>
              <button className="color-stats-cancel" type="button" onClick={() => setConfirmReset(false)}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
            </span>
          ) : (
            stats.total > 0 && (
              <button className="color-stats-reset" type="button" onClick={() => setConfirmReset(true)}>
                {tr({ zh: '重置', en: 'Reset' })}
              </button>
            )
          )}
        </td>
      </tr>
      {stats.recent.length > 0 && (
        <tr className="color-stats-history-row">
          <td colSpan={7}>
            <details className="color-stats-details">
              <summary>{tr({ zh: '最近记录', en: 'Recent attempts' })}</summary>
              <ol className="color-stats-history">{[...stats.recent].reverse().map(attempt => (
                <li key={attempt.id}>
                  <time dateTime={new Date(attempt.at).toISOString()}>{new Date(attempt.at).toLocaleString()}</time>
                  <span>{attempt.correct === null ? tr({ zh: '已完成', en: 'Completed' }) : attempt.correct ? tr({ zh: '正确', en: 'Correct' }) : tr({ zh: '错误', en: 'Wrong' })}</span>
                  <span>{attempt.durationMs === undefined ? '—' : seconds(attempt.durationMs)}</span>
                </li>
              ))}</ol>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}

function ColorStatsTable({ colors }: { colors: readonly ColorLetter[] }) {
  const faces = colors.map(letter => CUBE_FACE_FOR_COLOR_LETTER[letter]);
  return (
    <section className="training-stats" data-site-surface="panel" aria-label={tr({ zh: '训练统计', en: 'Training statistics' })}>
      <div className="training-stats-heading">
        <strong>{tr({ zh: '训练统计', en: 'Training statistics' })}</strong>
      </div>
      <div className="color-stats-table-wrap">
        <table className="color-stats-table">
          <thead>
            <tr>
              <th>{tr({ zh: '顶色', en: 'Top' })}</th>
              <th>{tr({ zh: '累计完成', en: 'Completed' })}</th>
              <th>{tr({ zh: '正确 / 错误', en: 'Correct / Wrong' })}</th>
              <th>{tr({ zh: '正确率', en: 'Accuracy' })}</th>
              <th>{tr({ zh: '平均用时', en: 'Mean time' })}</th>
              <th>{tr({ zh: '最快用时', en: 'Best time' })}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {faces.map(face => <ColorStatsRow key={face} face={face} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ColorPositionsPage() {
  const isZh = useLang() === 'zh';
  const topSelection = useSubsetSelection('single', 'Y');
  const [topFace, setTopFace] = useState<CubeFace>('D');
  const [round, setRound] = useState<PositionQuestion[]>(() => buildPositionRound('D', () => 0.42));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<SideFace | null>>([]);
  const [showColorNames, setShowColorNames] = useState(true);
  const [shuffleTopPerQuestion, setShuffleTopPerQuestion] = useState(false);
  const topFacePerIndex = useRef(new Map<number, CubeFace>());
  const autoAdvance = useTrainingAutoAdvance();
  const question = round[index];
  const statsGroup = `color:positions:${topFace}`;
  const { record } = useTrainingStats(statsGroup);
  const startedAt = useRef(0);
  const recorded = useRef(new Set<number>());
  useEffect(() => { startedAt.current = Date.now(); }, [round, index]);
  const selected = answers[index] ?? null;
  const score = answers.reduce((total, answer, answerIndex) => (
    total + (answer === round[answerIndex]?.answer ? 1 : 0)
  ), 0);

  const startRound = useCallback((nextTop: CubeFace) => {
    setTopFace(nextTop);
    setRound(buildPositionRound(nextTop));
    setIndex(0);
    setAnswers([]);
    recorded.current.clear();
    topFacePerIndex.current = new Map([[0, nextTop]]);
    autoAdvance.cancel();
  }, [autoAdvance.cancel]);

  const restart = () => startRound(randomTopFace(topSelection.selectedColors));

  useEffect(() => {
    startRound(randomTopFace(topSelection.selectedColors));
  }, [startRound, topSelection.selectedColors]);

  const toggleShuffle = useCallback((value: boolean) => {
    setShuffleTopPerQuestion(value);
    startRound(randomTopFace(topSelection.selectedColors));
  }, [topSelection.selectedColors, startRound]);

  const shuffleForIndex = useCallback((newIndex: number) => {
    if (!shuffleTopPerQuestion || newIndex >= round.length) return;
    if (recorded.current.has(newIndex)) {
      const savedTop = topFacePerIndex.current.get(newIndex);
      if (savedTop !== undefined) setTopFace(savedTop);
    } else {
      const newTop = randomTopFace(topSelection.selectedColors);
      const pool = positionQuestionsForTop(newTop);
      const newQuestion = pool[Math.floor(Math.random() * pool.length)]!;
      topFacePerIndex.current.set(newIndex, newTop);
      setTopFace(newTop);
      setRound(prev => {
        const arr = [...prev];
        arr[newIndex] = newQuestion;
        return arr;
      });
    }
  }, [shuffleTopPerQuestion, topSelection.selectedColors, round.length]);

  const answer = (face: SideFace) => {
    if (!question || selected) return;
    if (recorded.current.has(index)) return;
    recorded.current.add(index);
    record(face === question.answer, Date.now() - startedAt.current);
    setAnswers((current) => {
      const next = [...current];
      next[index] = face;
      return next;
    });
    if (face === question.answer) autoAdvance.schedule(() => { shuffleForIndex(index + 1); setIndex(index + 1); });
  };

  const next = useCallback(() => {
    if (!selected) return;
    autoAdvance.cancel();
    shuffleForIndex(index + 1);
    setIndex(index + 1);
  }, [autoAdvance.cancel, selected, index, shuffleForIndex]);

  const previous = useCallback(() => {
    autoAdvance.cancel();
    const newIndex = Math.max(0, index - 1);
    if (shuffleTopPerQuestion) {
      const savedTop = topFacePerIndex.current.get(newIndex);
      if (savedTop !== undefined) setTopFace(savedTop);
    }
    setIndex(newIndex);
  }, [autoAdvance.cancel, index, shuffleTopPerQuestion]);

  useSpaceShortcut(next, selected !== null);

  return (
    <main className="color-quiz-page">
      <div className="color-quiz-topbar">
        <BackHome />
        <HeaderToggles />
      </div>

      <header className="color-quiz-header">
        <p className="color-quiz-eyebrow">{tr({ zh: '颜色测试 02', en: 'COLOUR TEST 02' })}</p>
        <h1>{tr({ zh: '颜色位置关系', en: 'Colour positions' })}</h1>
        <div className="position-top-control">
          <span>{tr({ zh: '顶面', en: 'Top face' })}</span>
          <SubsetColorPicker
            sel={topSelection}
            isZh={isZh}
            ariaLabel={tr({ zh: '顶面', en: 'Top face' })}
          />
          <BoolToggle
            value={showColorNames}
            onChange={setShowColorNames}
            label={tr({ zh: '颜色文字', en: 'Colour names' })}
          />
          <TrainingSettings value={autoAdvance.enabled} onChange={autoAdvance.setEnabled}>
            <BoolToggle
              value={shuffleTopPerQuestion}
              onChange={toggleShuffle}
              label={tr({ zh: '每题换顶色', en: 'Shuffle top per question' })}
            />
          </TrainingSettings>
        </div>
      </header>

      {question ? (
        <section className="color-quiz-body" aria-labelledby="position-question">
          <div className="color-quiz-progress-row">
            <span>{tr({ zh: `第 ${index + 1} / ${round.length} 题`, en: `Question ${index + 1} / ${round.length}` })}</span>
            <span>{tr({ zh: `答对 ${score}`, en: `${score} correct` })}</span>
          </div>
          <div className="color-quiz-progress" aria-hidden="true">
            <i style={{ width: `${((index + (selected ? 1 : 0)) / round.length) * 100}%` }} />
          </div>

          <div className="position-top-indicator">
            <span>{tr({ zh: '顶面', en: 'Top face' })}</span>
            <ColorSwatch face={topFace} compact showLabel={showColorNames} />
          </div>

          <h2 id="position-question">
            {question.direction === 'opposite'
              ? tr({
                zh: `${CUBE_COLOR_NAMES[question.reference].zh}色的对面是什么颜色?`,
                en: `Which colour is opposite ${CUBE_COLOR_NAMES[question.reference].en}?`,
              })
              : tr({
                  zh: `${CUBE_COLOR_NAMES[question.reference].zh}色的${question.direction === 'right' ? '右边' : '左边'}是什么颜色?`,
                  en: `Which colour is to the ${question.direction} of ${CUBE_COLOR_NAMES[question.reference].en}?`,
                })}
          </h2>
          <div className="position-prompt" aria-hidden="true">
            {question.direction === 'left' && <span className="position-prompt-mark">? ←</span>}
            <div className="position-prompt-target">
              <ColorSwatch face={question.reference} showLabel={showColorNames} />
            </div>
            {question.direction === 'right' && <span className="position-prompt-mark">→ ?</span>}
            {question.direction === 'opposite' && <span className="position-prompt-mark">↔ ?</span>}
          </div>

          <div className="color-quiz-choices position-choices">
            {sideOrderForTop(topFace).filter((face) => face !== question.reference).map((face) => {
              const isCorrect = selected !== null && face === question.answer;
              const isWrong = selected === face && face !== question.answer;
              return (
                <button
                  key={face}
                  type="button"
                  className={`color-quiz-choice${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                  aria-pressed={selected === face}
                  aria-label={colorName(face)}
                  disabled={selected !== null}
                  onClick={() => answer(face)}
                >
                  <i
                    className="position-choice-swatch"
                    style={{ '--color-fill': CUBE_FILL[face] } as CSSProperties}
                    aria-hidden="true"
                  />
                  {showColorNames && <strong>{colorName(face)}</strong>}
                  <TrainingFeedbackOverlay
                    kind={isCorrect ? 'correct' : isWrong ? 'wrong' : null}
                    correctLabel={tr({ zh: '答对了', en: 'Correct' })}
                    wrongLabel={tr({ zh: '答错了', en: 'Wrong' })}
                  />
                </button>
              );
            })}
          </div>

          {selected && (
            <div className={`color-quiz-feedback ${selected === question.answer ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
              <strong>{tr(selected === question.answer ? { zh: '答对了', en: 'Correct' } : { zh: '再记一下', en: 'Not quite' })}</strong>
              <span>{question.direction === 'opposite'
                ? tr({
                    zh: `${CUBE_COLOR_NAMES[question.reference].zh}色的对面是${CUBE_COLOR_NAMES[question.answer].zh}色。`,
                    en: `${CUBE_COLOR_NAMES[question.answer].en} is opposite ${CUBE_COLOR_NAMES[question.reference].en}.`,
                  })
                : tr({
                    zh: `${CUBE_COLOR_NAMES[topFace].zh}色朝上时,${CUBE_COLOR_NAMES[question.reference].zh}色的${question.direction === 'right' ? '右边' : '左边'}是${CUBE_COLOR_NAMES[question.answer].zh}色。`,
                    en: `With ${CUBE_COLOR_NAMES[topFace].en} on top, ${CUBE_COLOR_NAMES[question.answer].en} is to the ${question.direction} of ${CUBE_COLOR_NAMES[question.reference].en}.`,
                  })}</span>
              <span className="color-quiz-feedback-actions">
                {index > 0 && (
                  <TrainingNavButton direction="previous" onClick={previous}>
                    {tr({ zh: '上一题', en: 'Previous' })}
                  </TrainingNavButton>
                )}
                <TrainingNavButton direction="next" onClick={next} autoFocus>
                  {index === round.length - 1
                    ? tr({ zh: '查看成绩', en: 'See results' })
                    : tr({ zh: '下一题', en: 'Next question' })}
                </TrainingNavButton>
              </span>
            </div>
          )}
          {!selected && index > 0 && (
            <div className="color-quiz-question-nav">
              <TrainingNavButton direction="previous" onClick={previous}>
                {tr({ zh: '上一题', en: 'Previous question' })}
              </TrainingNavButton>
            </div>
          )}
        </section>
      ) : (
        <Result
          score={score}
          topFace={topFace}
          showColorNames={showColorNames}
          onPrevious={previous}
          onRestart={restart}
        />
      )}
      <ColorStatsTable colors={topSelection.selectedColors} />
    </main>
  );
}
