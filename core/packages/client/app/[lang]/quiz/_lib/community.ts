// 社区题:API 行 → 与内置题同形的 Question。
//
// 关键在语言回落。投稿只要求写一种语言(见 shared/quiz.ts 的 filledLangs),缺的那一侧
// 在库里是空串;而 Msg 的 zh/en 都是必填,答题页的 tr() 也没有「空了就换一种」的概念。
// 所以在这里就把缺口补上:空的一侧填上已有那侧的原文,同时记下 onlyLang,让 UI 能诚实地
// 标一句「仅中文 / English only」—— 而不是假装这道题是双语的。

import type { CommunityQuestionRow } from '@/lib/quiz-api';
import { QUIZ_CATS, QUIZ_LEVELS, QUIZ_TYPES } from '@cuberoot/shared/quiz';
import type { Contributed, Level, Msg, Question, QuizCat } from '../_data/types';

/** 两侧都空 → null;只有一侧 → 两边都用它。 */
function msg(zh: string, en: string): Msg | null {
  const z = zh.trim();
  const e = en.trim();
  if (!z && !e) return null;
  return { zh: z || e, en: e || z };
}

/** 作者只写了哪一种语言(题面为准);双语齐全返回 null。 */
function onlyLangOf(row: CommunityQuestionRow): Contributed['onlyLang'] {
  const z = row.qZh.trim();
  const e = row.qEn.trim();
  if (z && !e) return 'zh';
  if (e && !z) return 'en';
  return null;
}

/**
 * 一行 → 一道题。形状不合法(分类不认识、选项不够、答案下标越界……)返回 null 而不是
 * 抛错:一条脏数据不该让整局答题白屏。服务端已经用同一套规则挡过一遍,这里是纵深。
 */
export function toQuestion(row: CommunityQuestionRow): Question | null {
  if (!(QUIZ_CATS as readonly string[]).includes(row.cat)) return null;
  if (!(QUIZ_LEVELS as readonly string[]).includes(row.level)) return null;
  if (!(QUIZ_TYPES as readonly string[]).includes(row.type)) return null;

  const q = msg(row.qZh, row.qEn);
  if (!q) return null;

  const by: Contributed = {
    dbId: row.id,
    authorName: row.authorName,
    authorUserId: row.authorUserId,
    onlyLang: onlyLangOf(row),
  };
  const base = {
    id: `c-${row.id}`,
    cat: row.cat as QuizCat,
    q,
    why: msg(row.whyZh, row.whyEn) ?? undefined,
    by,
  };

  if (row.type === 'choice') {
    const options = row.options.map((o) => msg(o.zh, o.en));
    if (options.length < 2 || options.some((o) => o === null)) return null;
    if (!Number.isInteger(row.answerIdx) || row.answerIdx < 0 || row.answerIdx >= options.length) return null;
    return { ...base, type: 'choice', options: options as Msg[], answer: row.answerIdx };
  }

  const answer = msg(row.answerZh, row.answerEn);
  if (!answer || row.accept.length === 0) return null;
  return { ...base, type: 'open', answer, accept: row.accept };
}

/** 一批行 → 题目,丢掉脏的。 */
export function toQuestions(rows: readonly CommunityQuestionRow[]): Question[] {
  return rows.map(toQuestion).filter((q): q is Question => q !== null);
}

/** 只留该档的题(API 已按 level 过滤,这里是纵深 —— 混档会串味)。 */
export function forLevel(rows: readonly CommunityQuestionRow[], level: Level): Question[] {
  return toQuestions(rows.filter((r) => r.level === level));
}

/** 按分类分桶(选题页要显示每类多少题)。 */
export function countByCat(questions: readonly Question[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of questions) out[q.cat] = (out[q.cat] ?? 0) + 1;
  return out;
}
