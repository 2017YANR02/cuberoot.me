'use client';

/**
 * /quiz —— 魔方知识问答。
 *
 * 无 ?cat= 时是选题页(八个分类 + 随机混合);带 ?cat= 就进入一局问答。
 * 分类入口都是真链接(中键/新标签页可用),cat 走 nuqs 记在 URL 里,history: push
 * 所以浏览器返回键能从答题回到选题页。题库在 _data/,判卷在 _lib/deck.ts。
 */

import { Suspense } from 'react';
import { useQueryState, parseAsStringLiteral } from 'nuqs';
import { Shuffle } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { CATEGORIES, CAT_IDS, BY_CAT, findCategory } from './_data';
import { MIXED_ROUND_SIZE } from './_lib/deck';
import QuizRunner from './_components/QuizRunner';
import './quiz.css';

// 'mixed' 不是分类,是「全题库随机抽 20 道」的模式标记。
const MODES = [...CAT_IDS, 'mixed'] as const;

function QuizPage() {
  const [mode] = useQueryState(
    'cat',
    parseAsStringLiteral(MODES).withOptions({ history: 'push' }),
  );

  const category = findCategory(mode);
  const running = mode !== null && (category !== undefined || mode === 'mixed');

  return (
    <div className="quiz-page">
      <div className="quiz-head">
        <BackHome />
        <HeaderToggles />
      </div>

      {running ? (
        <QuizRunner cat={category ? category.id : null} category={category} />
      ) : (
        <div className="quiz-hub">
          <h1>{tr({ zh: '魔方知识问答', en: 'Cubing quiz' })}</h1>
          <p className="quiz-intro">
            {tr({
              zh: '选择题和问答题各占一部分,答完立刻给对错和解析。挑一类开始,或者直接来一局随机的。',
              en: 'Multiple choice and short answers, marked as you go with a note on each one. Pick a topic, or just take a mixed round.',
            })}
          </p>

          <Link href="/quiz?cat=mixed" className="quiz-mixed">
            <Shuffle size={20} strokeWidth={1.6} aria-hidden />
            <span className="quiz-mixed-text">
              <strong>{tr({ zh: '随机混合', en: 'Mixed round' })}</strong>
              <em>{tr({
                zh: `从全部题库里随机抽 ${MIXED_ROUND_SIZE} 道`,
                en: `${MIXED_ROUND_SIZE} questions drawn from every topic`,
              })}</em>
            </span>
          </Link>

          <ul className="quiz-cats">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link href={`/quiz?cat=${c.id}`} className="quiz-cat">
                  <c.Icon size={20} strokeWidth={1.6} aria-hidden />
                  <span className="quiz-cat-text">
                    <strong>{tr(c.name)}</strong>
                    <em>{tr(c.blurb)}</em>
                  </span>
                  <span className="quiz-cat-n">
                    {tr({ zh: `${BY_CAT[c.id].length} 题`, en: `${BY_CAT[c.id].length}` })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  // useQueryState 要读 searchParams,SSG 下必须包 Suspense。
  return (
    <Suspense fallback={<div className="quiz-page" />}>
      <QuizPage />
    </Suspense>
  );
}
