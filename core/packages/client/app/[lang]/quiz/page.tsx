'use client';

/**
 * /quiz —— 魔方知识问答。
 *
 * 无 ?cat= 时是选题页(八个分类 + 随机混合);带 ?cat= 就进入一局问答。
 * 分类入口都是真链接(中键/新标签页可用),cat 走 nuqs 记在 URL 里,history: push
 * 所以浏览器返回键能从答题回到选题页。
 *
 * ?level=easy|hard 选难度档:两档是两套独立题目(见 _data/index.ts 的 BANK),
 * 简单档问常识,进阶档问规则条款、公式集规模、上帝之数现状那类。难度是筛选项,
 * 所以 history 用默认的 replace,不往浏览历史里塞记录。
 */

import { Suspense } from 'react';
import { useQueryState, parseAsStringLiteral } from 'nuqs';
import { Shuffle } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import PillToggle from '@/components/PillToggle/PillToggle';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { BANK, CATEGORIES, CAT_IDS, findCategory, LEVELS } from './_data';
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
  const [level, setLevel] = useQueryState(
    'level',
    parseAsStringLiteral(LEVELS).withDefault('easy'),
  );

  const category = findCategory(mode);
  const running = mode !== null && (category !== undefined || mode === 'mixed');
  const suffix = level === 'easy' ? '' : `&level=${level}`;

  return (
    <div className="quiz-page">
      <div className="quiz-head">
        <BackHome />
        <HeaderToggles />
      </div>

      {running ? (
        <QuizRunner level={level} cat={category ? category.id : null} category={category} />
      ) : (
        <div className="quiz-hub">
          <h1>{tr({ zh: '魔方知识问答', en: 'Cubing quiz' })}</h1>
          <p className="quiz-intro">
            {tr({
              zh: '选择题和问答题各占一部分,答完立刻给对错和解析。挑一类开始,或者直接来一局随机的。',
              en: 'Multiple choice and short answers, marked as you go with a note on each one. Pick a topic, or just take a mixed round.',
            })}
          </p>

          <div className="quiz-level">
            <PillToggle
              value={level === 'hard'}
              onChange={(on) => void setLevel(on ? 'hard' : 'easy')}
              offLabel={tr({ zh: '简单', en: 'Easy' })}
              onLabel={tr({ zh: '进阶', en: 'Advanced' })}
              ariaLabel={tr({ zh: '难度', en: 'Difficulty' })}
            />
            <span className="quiz-level-hint">
              {level === 'hard'
                ? tr({
                  zh: '进阶档:WCA 规则条款、公式集规模、各项目上帝之数的现状。',
                  en: 'Advanced: WCA regulations by clause, algorithm-set sizes, and where each puzzle\'s God\'s number stands.',
                })
                : tr({
                  zh: '简单档:常识题,拧过魔方就能答上大半。',
                  en: 'Easy: general knowledge — if you cube at all, most of it should land.',
                })}
            </span>
          </div>

          <Link href={`/quiz?cat=mixed${suffix}`} className="quiz-mixed">
            <Shuffle size={20} strokeWidth={1.6} aria-hidden />
            <span className="quiz-mixed-text">
              <strong>{tr({ zh: '随机混合', en: 'Mixed round' })}</strong>
              <em>{tr({
                zh: `从这一档的全部题库里随机抽 ${MIXED_ROUND_SIZE} 道`,
                en: `${MIXED_ROUND_SIZE} questions drawn from every topic at this level`,
              })}</em>
            </span>
          </Link>

          <ul className="quiz-cats">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link href={`/quiz?cat=${c.id}${suffix}`} className="quiz-cat">
                  <c.Icon size={20} strokeWidth={1.6} aria-hidden />
                  <span className="quiz-cat-text">
                    <strong>{tr(c.name)}</strong>
                    <em>{tr(c.blurb[level])}</em>
                  </span>
                  <span className="quiz-cat-n">
                    {tr({ zh: `${BANK[level][c.id].length} 题`, en: `${BANK[level][c.id].length}` })}
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
