'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import TrainingNavButton from '@/components/TrainingNavButton';
import { tr } from '@/i18n/tr';
import {
  CUBE_COLOR_NAMES,
  type CubeFace,
} from '@/lib/cube-colors';
import ColorSwatch from '../_components/ColorSwatch';
import {
  ALL_COLOR_PAIRS,
  buildColorRound,
  type ColorPair,
  type ColorRelation,
} from '../_lib/relations';
import '../_components/color-quiz.css';

const RELATION_LABELS: Record<ColorRelation, { zh: string; en: string }> = {
  opposite: { zh: '对色', en: 'Opposite' },
  adjacent: { zh: '邻色', en: 'Adjacent' },
};

const OPPOSITE_PAIRS: readonly [CubeFace, CubeFace][] = [
  ['R', 'L'],
  ['F', 'B'],
  ['U', 'D'],
];

function Result({ score, onRestart }: { score: number; onRestart: () => void }) {
  const summary = score === ALL_COLOR_PAIRS.length
    ? { zh: '全部答对,六色关系已经很稳了。', en: 'Perfect. You have all six colour relationships down.' }
    : score >= 12
      ? { zh: '已经很稳,再来一轮就能把容易混的组合补齐。', en: 'Nearly there. One more round should settle the pairs that still blur together.' }
      : { zh: '记住三组对色,其他不同颜色的组合就都是邻色。', en: 'Remember the three opposite pairs; every other pair of different colours is adjacent.' };

  return (
    <section className="color-quiz-result" aria-live="polite">
      <p className="color-quiz-result-kicker">{tr({ zh: '本轮成绩', en: 'ROUND COMPLETE' })}</p>
      <div className="color-quiz-result-score">
        <strong>{score}</strong>
        <span>/ {ALL_COLOR_PAIRS.length}</span>
      </div>
      <p>{tr(summary)}</p>

      <div className="color-quiz-memory">
        <h2>{tr({ zh: '只需记住这三组对色', en: 'Only three opposite pairs to remember' })}</h2>
        <div>
          {OPPOSITE_PAIRS.map(([first, second]) => (
            <span className="color-quiz-memory-pair" key={first}>
              <ColorSwatch face={first} compact />
              <i>↔</i>
              <ColorSwatch face={second} compact />
            </span>
          ))}
        </div>
      </div>

      <button type="button" className="color-quiz-primary-button" onClick={onRestart}>
        <RotateCcw size={16} aria-hidden="true" />
        {tr({ zh: '再来一轮', en: 'Try another round' })}
      </button>
    </section>
  );
}

export default function ColorRelationsPage() {
  const [round, setRound] = useState<ColorPair[]>(() => buildColorRound(() => 0.42));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<ColorRelation | null>(null);
  const [score, setScore] = useState(0);
  const finished = index >= round.length;
  const pair = round[index];

  const restart = () => {
    setRound(buildColorRound());
    setIndex(0);
    setSelected(null);
    setScore(0);
  };

  const answer = (relation: ColorRelation) => {
    if (!pair || selected) return;
    setSelected(relation);
    if (relation === pair.relation) setScore((value) => value + 1);
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
        <p className="color-quiz-eyebrow">{tr({ zh: '颜色测试 01', en: 'COLOUR TEST 01' })}</p>
        <h1>{tr({ zh: '对色还是邻色?', en: 'Opposite or adjacent?' })}</h1>
        <p>{tr({
          zh: '每题有两种颜色。判断它们在标准三阶魔方上是面对面,还是相邻。一轮会遍历全部 15 种组合。',
          en: 'Each question shows two colours. Decide whether their faces sit opposite or next to each other on a standard 3×3. One round covers all 15 pairs.',
        })}</p>
      </header>

      {!finished && pair ? (
        <section className="color-quiz-body" aria-labelledby="relation-question">
          <div className="color-quiz-progress-row">
            <span>{tr({ zh: `第 ${index + 1} / ${round.length} 题`, en: `Question ${index + 1} / ${round.length}` })}</span>
            <span>{tr({ zh: `答对 ${score}`, en: `${score} correct` })}</span>
          </div>
          <div className="color-quiz-progress" aria-hidden="true">
            <i style={{ width: `${((index + (selected ? 1 : 0)) / round.length) * 100}%` }} />
          </div>

          <h2 id="relation-question">{tr({ zh: '这两种颜色是什么关系?', en: 'How are these colours related?' })}</h2>
          <div className="color-quiz-pair" aria-label={tr({
            zh: `${CUBE_COLOR_NAMES[pair.first].zh}色和${CUBE_COLOR_NAMES[pair.second].zh}色`,
            en: `${CUBE_COLOR_NAMES[pair.first].en} and ${CUBE_COLOR_NAMES[pair.second].en}`,
          })}>
            <ColorSwatch face={pair.first} />
            <span className="color-quiz-pair-mark" aria-hidden="true">?</span>
            <ColorSwatch face={pair.second} />
          </div>

          <div className="color-quiz-choices">
            {(['opposite', 'adjacent'] as const).map((relation) => {
              const isCorrect = selected !== null && relation === pair.relation;
              const isWrong = selected === relation && relation !== pair.relation;
              return (
                <button
                  key={relation}
                  type="button"
                  className={`color-quiz-choice${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                  aria-pressed={selected === relation}
                  disabled={selected !== null}
                  onClick={() => answer(relation)}
                >
                  <strong>{tr(RELATION_LABELS[relation])}</strong>
                  <span>{tr(relation === 'opposite'
                    ? { zh: '两个面不相交', en: 'the faces do not meet' }
                    : { zh: '两个面有公共棱', en: 'the faces share an edge' })}</span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className={`color-quiz-feedback ${selected === pair.relation ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
              <strong>{tr(selected === pair.relation
                ? { zh: '答对了', en: 'Correct' }
                : { zh: '这题是' + RELATION_LABELS[pair.relation].zh, en: `This pair is ${RELATION_LABELS[pair.relation].en.toLowerCase()}` })}</strong>
              <span>{tr(pair.relation === 'opposite'
                ? {
                    zh: `${CUBE_COLOR_NAMES[pair.first].zh}色和${CUBE_COLOR_NAMES[pair.second].zh}色在标准配色上相对。`,
                    en: `${CUBE_COLOR_NAMES[pair.first].en} and ${CUBE_COLOR_NAMES[pair.second].en} sit opposite each other in the standard scheme.`,
                  }
                : {
                    zh: `${CUBE_COLOR_NAMES[pair.first].zh}色和${CUBE_COLOR_NAMES[pair.second].zh}色不是三组对色之一,所以它们相邻。`,
                    en: `${CUBE_COLOR_NAMES[pair.first].en} and ${CUBE_COLOR_NAMES[pair.second].en} are not an opposite pair, so their faces are adjacent.`,
                  })}</span>
              <TrainingNavButton direction="next" onClick={next} autoFocus>
                {index === round.length - 1
                  ? tr({ zh: '查看成绩', en: 'See results' })
                  : tr({ zh: '下一题', en: 'Next pair' })}
              </TrainingNavButton>
            </div>
          )}
        </section>
      ) : (
        <Result score={score} onRestart={restart} />
      )}
    </main>
  );
}
