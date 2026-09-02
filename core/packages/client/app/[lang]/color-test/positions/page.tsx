'use client';

import { useState, type CSSProperties } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES, CUBE_FILL } from '@/lib/cube-colors';
import ColorSwatch from '../_components/ColorSwatch';
import {
  ALL_POSITION_QUESTIONS,
  WHITE_TOP_SIDE_ORDER,
  buildPositionRound,
  type PositionQuestion,
  type SideFace,
} from '../_lib/positions';
import '../_components/color-quiz.css';

function colorName(face: SideFace): string {
  return tr(CUBE_COLOR_NAMES[face]);
}

function Result({ score, onRestart }: { score: number; onRestart: () => void }) {
  const summary = score === ALL_POSITION_QUESTIONS.length
    ? { zh: '全部答对,侧面颜色顺序已经很稳了。', en: 'Perfect. You have the side-colour order down.' }
    : score >= 6
      ? { zh: '已经很稳,再来一轮就能补齐容易混淆的方向。', en: 'Nearly there. One more round should settle the directions that still blur together.' }
      : { zh: '先记住红、绿、橙、蓝的循环顺序,再分清左边和右边。', en: 'Start with the red, green, orange, blue cycle, then separate left from right.' };

  return (
    <section className="color-quiz-result" aria-live="polite">
      <p className="color-quiz-result-kicker">{tr({ zh: '本轮成绩', en: 'ROUND COMPLETE' })}</p>
      <div className="color-quiz-result-score">
        <strong>{score}</strong>
        <span>/ {ALL_POSITION_QUESTIONS.length}</span>
      </div>
      <p>{tr(summary)}</p>

      <div className="color-quiz-memory">
        <h2>{tr({ zh: '白色朝上时的侧面顺序', en: 'Side order with white on top' })}</h2>
        <div className="position-order">
          {WHITE_TOP_SIDE_ORDER.map((face) => (
            <span className="color-quiz-memory-pair" key={face}>
              <ColorSwatch face={face} compact />
              <i>→</i>
            </span>
          ))}
          <ColorSwatch face={WHITE_TOP_SIDE_ORDER[0]} compact />
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
  const [round, setRound] = useState<PositionQuestion[]>(() => buildPositionRound(() => 0.42));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<SideFace | null>(null);
  const [score, setScore] = useState(0);
  const question = round[index];

  const restart = () => {
    setRound(buildPositionRound());
    setIndex(0);
    setSelected(null);
    setScore(0);
  };

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
        <h1>{tr({ zh: '侧面颜色顺序', en: 'Side colour order' })}</h1>
        <p>{tr({
          zh: '保持白色朝上,判断红、绿、橙、蓝四个侧面的左右顺序。一轮会问完 8 种关系。',
          en: 'Keep white on top and recall the left-right order of the four side faces: red, green, orange and blue. One round covers all 8 relations.',
        })}</p>
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

          <h2 id="position-question">{tr({
            zh: `白色朝上时,${CUBE_COLOR_NAMES[question.reference].zh}色的${question.direction === 'right' ? '右边' : '左边'}是什么颜色?`,
            en: `With white on top, which colour is to the ${question.direction} of ${CUBE_COLOR_NAMES[question.reference].en}?`,
          })}</h2>
          <div className="position-prompt" aria-hidden="true">
            {question.direction === 'left' && <span className="position-prompt-mark">? ←</span>}
            <ColorSwatch face={question.reference} />
            {question.direction === 'right' && <span className="position-prompt-mark">→ ?</span>}
          </div>

          <div className="color-quiz-choices position-choices">
            {WHITE_TOP_SIDE_ORDER.filter((face) => face !== question.reference).map((face) => {
              const isCorrect = selected !== null && face === question.answer;
              const isWrong = selected === face && face !== question.answer;
              return (
                <button
                  key={face}
                  type="button"
                  className={`color-quiz-choice${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                  aria-pressed={selected === face}
                  disabled={selected !== null}
                  onClick={() => answer(face)}
                >
                  <i
                    className="position-choice-swatch"
                    style={{ '--color-fill': CUBE_FILL[face] } as CSSProperties}
                    aria-hidden="true"
                  />
                  <strong>{colorName(face)}</strong>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className={`color-quiz-feedback ${selected === question.answer ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
              <strong>{tr(selected === question.answer ? { zh: '答对了', en: 'Correct' } : { zh: '再记一下', en: 'Not quite' })}</strong>
              <span>{tr({
                zh: `白色朝上时,${CUBE_COLOR_NAMES[question.reference].zh}色的${question.direction === 'right' ? '右边' : '左边'}是${CUBE_COLOR_NAMES[question.answer].zh}色。`,
                en: `With white on top, ${CUBE_COLOR_NAMES[question.answer].en} is to the ${question.direction} of ${CUBE_COLOR_NAMES[question.reference].en}.`,
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
        <Result score={score} onRestart={restart} />
      )}
    </main>
  );
}
