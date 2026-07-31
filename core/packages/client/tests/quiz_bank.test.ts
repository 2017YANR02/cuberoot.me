import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS, BY_CAT, CATEGORIES, CAT_IDS } from '@/app/[lang]/quiz/_data';
import { buildDeck, gradeChoice, gradeOpen, normalizeAnswer, rebuildDeck, MIXED_ROUND_SIZE } from '@/app/[lang]/quiz/_lib/deck';

// 确定性 rng,让抽题相关的断言可复现。
const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

describe('quiz 题库', () => {
  it('题量不少于 100 道', () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThanOrEqual(100);
  });

  it('id 全局唯一', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每道题的 cat 都是已登记的分类,且落在对应的分类桶里', () => {
    for (const cat of CAT_IDS) {
      for (const q of BY_CAT[cat]) expect(q.cat).toBe(cat);
    }
    for (const q of ALL_QUESTIONS) expect(CAT_IDS).toContain(q.cat);
  });

  it('每个分类都有题,且分类表与题库桶一一对应', () => {
    expect(CATEGORIES.map((c) => c.id).sort()).toEqual([...CAT_IDS].sort());
    for (const cat of CAT_IDS) expect(BY_CAT[cat].length).toBeGreaterThan(0);
  });

  it('选择题:至少 3 个选项、answer 下标合法、选项文案不重复', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'choice') continue;
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.id).toBeLessThan(q.options.length);
      expect(new Set(q.options.map((o) => o.zh)).size, q.id).toBe(q.options.length);
      expect(new Set(q.options.map((o) => o.en)).size, q.id).toBe(q.options.length);
    }
  });

  it('问答题:accept 非空,且参考答案本身能被判对', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'open') continue;
      expect(q.accept.length, q.id).toBeGreaterThan(0);
      // 参考答案判不对 = accept 关键词写歪了,这是最容易犯的错。
      expect(gradeOpen(q.answer.zh, q.accept), `${q.id} zh`).toBe(true);
      expect(gradeOpen(q.answer.en, q.accept), `${q.id} en`).toBe(true);
    }
  });

  it('双语文案都不为空', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.q.zh.trim(), q.id).not.toBe('');
      expect(q.q.en.trim(), q.id).not.toBe('');
    }
  });
});

describe('quiz 出题', () => {
  it('指定分类时该分类全部题目上场', () => {
    const deck = buildDeck('history', seeded(1));
    expect(deck.length).toBe(BY_CAT.history.length);
    expect(new Set(deck.map((d) => d.q.id)).size).toBe(deck.length);
  });

  it('混合模式抽固定题数,且不重复', () => {
    const deck = buildDeck(null, seeded(7));
    expect(deck.length).toBe(MIXED_ROUND_SIZE);
    expect(new Set(deck.map((d) => d.q.id)).size).toBe(MIXED_ROUND_SIZE);
  });

  it('选项显示顺序是原下标的一个排列', () => {
    for (const d of buildDeck(null, seeded(3))) {
      if (d.q.type !== 'choice') { expect(d.order).toEqual([]); continue; }
      expect([...d.order].sort((a, b) => a - b)).toEqual(d.q.options.map((_, i) => i));
    }
  });

  it('正确答案不总在第一个位置(洗过牌)', () => {
    const decks = [1, 2, 3, 4, 5].flatMap((s) => buildDeck(null, seeded(s)));
    const choices = decks.filter((d) => d.q.type === 'choice');
    const firstIsAnswer = choices.filter((d) => d.q.type === 'choice' && d.order[0] === d.q.answer);
    expect(choices.length).toBeGreaterThan(20);
    expect(firstIsAnswer.length).toBeLessThan(choices.length);
  });

  it('gradeChoice 按显示位置换算回原下标', () => {
    const deck = buildDeck('rules', seeded(11));
    for (const d of deck) {
      if (d.q.type !== 'choice') continue;
      const rightDisplay = d.order.indexOf(d.q.answer);
      expect(gradeChoice(d, rightDisplay)).toBe(true);
      for (let i = 0; i < d.order.length; i++) {
        if (i !== rightDisplay) expect(gradeChoice(d, i)).toBe(false);
      }
    }
  });

  it('rebuildDeck 只出给定的题', () => {
    const picked = BY_CAT.math.slice(0, 3);
    const deck = rebuildDeck(picked, seeded(5));
    expect(deck.map((d) => d.q.id).sort()).toEqual(picked.map((q) => q.id).sort());
  });
});

describe('quiz 判问答题', () => {
  it('归一化抹掉大小写、空白与标点', () => {
    expect(normalizeAnswer('Ernő  Rubik!')).toBe(normalizeAnswer('ernőrubik'));
    expect(normalizeAnswer('鲁比克(Rubik)')).toBe('鲁比克rubik');
    expect(normalizeAnswer('World Cube Association.')).toBe('worldcubeassociation');
  });

  it('命中任意关键词即算对', () => {
    expect(gradeOpen('好像是鲁比克吧', ['鲁比克', 'rubik'])).toBe(true);
    expect(gradeOpen('Erno RUBIK', ['鲁比克', 'rubik'])).toBe(true);
    expect(gradeOpen('不知道', ['鲁比克', 'rubik'])).toBe(false);
  });

  it('空作答一律算错', () => {
    expect(gradeOpen('', ['rubik'])).toBe(false);
    expect(gradeOpen('   ', ['rubik'])).toBe(false);
  });
});
