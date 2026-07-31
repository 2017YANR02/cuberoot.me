// 抽题 + 判卷,全是纯函数(tests/quiz_deck.test.ts 锁行为)。
//
// 为什么选项要在这里洗牌:题库里正确选项一律写在 options[0](写题时好核对),
// 直接渲染的话「答案永远是第一项」。所以出题时给每道题生成一个显示顺序 order,
// order[i] 是显示在第 i 位的原始选项下标。

import type { Level, Question, QuizCat } from '../_data/types';
import { allQuestions, BANK } from '../_data';

/** 混合模式(不选分类)一局出多少题。 */
export const MIXED_ROUND_SIZE = 20;

export interface DeckItem {
  q: Question;
  /** choice 题:显示顺序 → 原始 options 下标。open 题为空数组。 */
  order: number[];
}

type Rng = () => number;

/** Fisher-Yates,不改原数组。 */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 出一局的题。cat 为 null = 混合模式,从该难度档的全部题库里随机抽
 * MIXED_ROUND_SIZE 道;指定分类则该分类全部题目上场(顺序打乱)。
 */
export function buildDeck(level: Level, cat: QuizCat | null, rng: Rng = Math.random): DeckItem[] {
  const pool = cat ? BANK[level][cat] : allQuestions(level);
  const picked = cat ? shuffle(pool, rng) : shuffle(pool, rng).slice(0, MIXED_ROUND_SIZE);
  return picked.map((q) => ({
    q,
    order: q.type === 'choice' ? shuffle(q.options.map((_, i) => i), rng) : [],
  }));
}

/** 只重出给定的几道题(错题重做),顺序和选项都重新洗。 */
export function rebuildDeck(questions: readonly Question[], rng: Rng = Math.random): DeckItem[] {
  return shuffle(questions, rng).map((q) => ({
    q,
    order: q.type === 'choice' ? shuffle(q.options.map((_, i) => i), rng) : [],
  }));
}

/**
 * 判卷用的归一化:大小写、全角/半角、空白、标点全部抹掉,只留下「字」。
 * 「Ernő Rubik!」「erno rubik」「鲁比克(Rubik)」归一化后都能命中同一批关键词。
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    // 常见分隔与标点(中英文都算),连空白一起去掉
    .replace(/[\s.,;:!?'"`~^*_\-—–/\\|()[\]{}<>·、,。;:!?「」『』()《》【】]/gu, '');
}

/**
 * open 题判对:作答里包含任意一个 accept 关键词就算对。宁松不紧 —— 判错了
 * 用户还能在结果里手动改判。
 */
export function gradeOpen(input: string, accept: readonly string[]): boolean {
  const said = normalizeAnswer(input);
  if (!said) return false;
  return accept.some((k) => {
    const key = normalizeAnswer(k);
    return key.length > 0 && said.includes(key);
  });
}

/** 判 choice 题:传入的是显示位置,换算回原始下标再比。 */
export function gradeChoice(item: DeckItem, pickedDisplayIndex: number): boolean {
  if (item.q.type !== 'choice') return false;
  return item.order[pickedDisplayIndex] === item.q.answer;
}
