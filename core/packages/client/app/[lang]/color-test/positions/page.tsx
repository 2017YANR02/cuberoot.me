'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import HeaderToggles from '@/components/HeaderToggles';
import {
  SubsetColorPicker,
  SubsetSwatch,
  useSubsetSelection,
  type ColorLetter,
} from '@/components/SubsetColorPicker/SubsetColorPicker';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { T, tr, useLang } from '@/i18n/tr';
import {
  CUBE_COLOR_LETTER_FOR_FACE,
  CUBE_COLOR_NAMES,
  CUBE_FACE_FOR_COLOR_LETTER,
  CUBE_FILL,
  type CubeFace,
} from '@/lib/cube-colors';
import ColorSwatch from '../_components/ColorSwatch';
import {
  ALL_POSITION_QUESTIONS,
  buildPositionRound,
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

function Result({ score, topFace, showColorNames, onRestart }: {
  score: number;
  topFace: CubeFace;
  showColorNames: boolean;
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

      <button type="button" className="color-quiz-primary-button" onClick={onRestart}>
        <RotateCcw size={16} aria-hidden="true" />
        {tr({ zh: '再来一轮', en: 'Try another round' })}
      </button>
    </section>
  );
}

export default function ColorPositionsPage() {
  const isZh = useLang() === 'zh';
  const topSelection = useSubsetSelection('single', 'W');
  const [topFace, setTopFace] = useState<CubeFace>('U');
  const [round, setRound] = useState<PositionQuestion[]>(() => buildPositionRound('U', () => 0.42));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<SideFace | null>(null);
  const [score, setScore] = useState(0);
  const [showColorNames, setShowColorNames] = useState(true);
  const question = round[index];

  const startRound = useCallback((nextTop: CubeFace) => {
    setTopFace(nextTop);
    setRound(buildPositionRound(nextTop));
    setIndex(0);
    setSelected(null);
    setScore(0);
  }, []);

  const restart = () => startRound(randomTopFace(topSelection.selectedColors));

  useEffect(() => {
    startRound(randomTopFace(topSelection.selectedColors));
  }, [startRound, topSelection.selectedColors]);

  const answer = (face: SideFace) => {
    if (!question || selected) return;
    setSelected(face);
    if (face === question.answer) setScore((value) => value + 1);
  };

  const next = () => {
    if (!selected) return;
    setIndex((value) => value + 1);
    setSelected(null);
  };

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

          <h2 id="position-question">
            {question.direction === 'opposite'
              ? tr({
                zh: `${CUBE_COLOR_NAMES[question.reference].zh}色的对面是什么颜色?`,
                en: `Which colour is opposite ${CUBE_COLOR_NAMES[question.reference].en}?`,
              })
              : <T
                  zh={<>
                    {CUBE_COLOR_NAMES[topFace].zh}色
                    <span className="subset-swatch is-static position-question-color" aria-hidden="true">
                      <SubsetSwatch colors={[CUBE_COLOR_LETTER_FOR_FACE[topFace]]} />
                    </span>
                    朝上时,{CUBE_COLOR_NAMES[question.reference].zh}色的{question.direction === 'right' ? '右边' : '左边'}是什么颜色?
                  </>}
                  en={<>
                    With {CUBE_COLOR_NAMES[topFace].en}
                    <span className="subset-swatch is-static position-question-color" aria-hidden="true">
                      <SubsetSwatch colors={[CUBE_COLOR_LETTER_FOR_FACE[topFace]]} />
                    </span>
                    on top, which colour is to the {question.direction} of {CUBE_COLOR_NAMES[question.reference].en}?
                  </>}
                />}
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
              <button type="button" className="color-quiz-next" onClick={next} autoFocus>
                {index === round.length - 1
                  ? tr({ zh: '查看成绩', en: 'See results' })
                  : tr({ zh: '下一题', en: 'Next question' })}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      ) : (
        <Result score={score} topFace={topFace} showColorNames={showColorNames} onRestart={restart} />
      )}
    </main>
  );
}
