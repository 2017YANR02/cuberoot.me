// 社区题(登录用户自己出的题)。三件事在这里锁死:
//   1. 校验规则 —— 服务端和出题表单共用 shared/quiz 的这一份,漏一条就等于 API 直接能塞脏题;
//   2. 语言回落 —— 只写一种语言是被允许的常态,回落写歪了会让另一语言的用户看到空题面;
//   3. 抽题 —— 社区题必须和内置题同池,且不能污染「只出内置题」那条老路径。
import { describe, expect, it } from 'vitest';
import {
  QUIZ_LIMITS, filledLangs, gradeOpen, normalizeQuizDraft, validateQuizDraft,
  type QuizDraft,
} from '@cuberoot/shared/quiz';
import { forLevel, countByCat, toQuestion } from '@/app/[lang]/quiz/_lib/community';
import { buildDeck } from '@/app/[lang]/quiz/_lib/deck';
import { BANK } from '@/app/[lang]/quiz/_data';
import type { CommunityQuestionRow } from '@/lib/quiz-api';

const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const choiceDraft = (over: Partial<QuizDraft> = {}): QuizDraft => ({
  cat: 'history', level: 'easy', type: 'choice',
  qZh: '魔方是谁发明的?', qEn: 'Who invented the cube?',
  whyZh: '', whyEn: '',
  options: [
    { zh: '鲁比克', en: 'Rubik' },
    { zh: '费根斯坦', en: 'Fridrich' },
    { zh: '罗克斯', en: 'Roux' },
  ],
  answerIdx: 0,
  answerZh: '', answerEn: '', accept: [],
  ...over,
});

const openDraft = (over: Partial<QuizDraft> = {}): QuizDraft => ({
  cat: 'rules', level: 'easy', type: 'open',
  qZh: '观察时间是多少秒?', qEn: 'How long is inspection?',
  whyZh: '', whyEn: '',
  options: [], answerIdx: 0,
  answerZh: '15 秒', answerEn: '15 seconds',
  accept: ['15'],
  ...over,
});

const row = (over: Partial<CommunityQuestionRow> = {}): CommunityQuestionRow => ({
  id: 1, cat: 'history', level: 'easy', type: 'choice',
  qZh: '题面', qEn: 'Question',
  whyZh: '', whyEn: '',
  options: [{ zh: '甲', en: 'A' }, { zh: '乙', en: 'B' }, { zh: '丙', en: 'C' }],
  answerIdx: 0,
  answerZh: '', answerEn: '', accept: [],
  authorName: '某人', status: 'published', hiddenNote: '', reportCount: 0,
  createdAt: '', updatedAt: '',
  ...over,
});

describe('社区题校验(与服务端同一份)', () => {
  it('双语齐全的选择题 / 问答题都放行', () => {
    expect(validateQuizDraft(choiceDraft())).toBeNull();
    expect(validateQuizDraft(openDraft())).toBeNull();
  });

  it('只写一种语言是允许的,filledLangs 认得出是哪种', () => {
    const zhOnly = choiceDraft({
      qEn: '',
      options: [{ zh: '鲁比克', en: '' }, { zh: '费根斯坦', en: '' }, { zh: '罗克斯', en: '' }],
    });
    expect(validateQuizDraft(zhOnly)).toBeNull();
    expect(filledLangs(zhOnly)).toEqual(['zh']);

    const enOnly = openDraft({ qZh: '', answerZh: '' });
    expect(validateQuizDraft(enOnly)).toBeNull();
    expect(filledLangs(enOnly)).toEqual(['en']);
  });

  it('两种语言都不完整就不给过', () => {
    // 中文有题面没选项,英文有选项没题面 —— 拼起来看着齐全,单看每一种都残
    expect(validateQuizDraft(choiceDraft({
      qEn: '',
      options: [{ zh: '', en: 'Rubik' }, { zh: '', en: 'Fridrich' }, { zh: '', en: 'Roux' }],
    }))).toBe('question');
    expect(validateQuizDraft(openDraft({ qZh: '', qEn: '', answerEn: '' }))).toBe('question');
  });

  it('分类 / 难度 / 题型必须是登记过的取值', () => {
    expect(validateQuizDraft(choiceDraft({ cat: 'gossip' }))).toBe('cat');
    expect(validateQuizDraft(choiceDraft({ level: 'insane' }))).toBe('level');
    expect(validateQuizDraft(choiceDraft({ type: 'essay' }))).toBe('type');
  });

  it('选择题:选项数受限、答案下标必须落在范围内、同语言下不能重复', () => {
    expect(validateQuizDraft(choiceDraft({ options: [{ zh: '甲', en: 'A' }, { zh: '乙', en: 'B' }] })))
      .toBe('options_count');
    expect(validateQuizDraft(choiceDraft({ answerIdx: 3 }))).toBe('answer_idx');
    expect(validateQuizDraft(choiceDraft({ answerIdx: -1 }))).toBe('answer_idx');
    expect(validateQuizDraft(choiceDraft({
      options: [{ zh: '鲁比克', en: 'Rubik' }, { zh: '鲁比克', en: 'Other' }, { zh: '罗克斯', en: 'Roux' }],
    }))).toBe('option_dup');
  });

  it('选项重复只按写全了的语言算 —— 另一侧整列空白不算重复', () => {
    expect(validateQuizDraft(choiceDraft({
      qEn: '',
      options: [{ zh: '鲁比克', en: '' }, { zh: '费根斯坦', en: '' }, { zh: '罗克斯', en: '' }],
    }))).toBeNull();
  });

  it('问答题:没有关键词不给过', () => {
    expect(validateQuizDraft(openDraft({ accept: [] }))).toBe('accept_empty');
    expect(validateQuizDraft(openDraft({ accept: ['   '] }))).toBe('accept_empty');
  });

  it('问答题:作者自己的参考答案判不对就是关键词写歪了(内置题库同款红线)', () => {
    expect(validateQuizDraft(openDraft({ accept: ['20'] }))).toBe('accept_unmatched');
    // 只查写全了的语言:英文那侧留空,中文答案能判对就行
    expect(validateQuizDraft(openDraft({ qEn: '', answerEn: '', accept: ['15 秒'] }))).toBeNull();
    // 补了英文答案,关键词就得同时管得住英文那句
    expect(validateQuizDraft(openDraft({ accept: ['15 秒'] }))).toBe('accept_unmatched');
  });

  it('超长文案按字段各自拦', () => {
    const long = 'x'.repeat(QUIZ_LIMITS.question + 1);
    expect(validateQuizDraft(choiceDraft({ qZh: long }))).toBe('question_long');
    expect(validateQuizDraft(openDraft({ whyEn: 'y'.repeat(QUIZ_LIMITS.why + 1) }))).toBe('why_long');
    expect(validateQuizDraft(openDraft({
      answerZh: '15 ' + 'z'.repeat(QUIZ_LIMITS.answer),
    }))).toBe('answer_long');
  });

  it('normalizeQuizDraft 清掉用不上的那半 —— 选择题不留 accept,问答题不留选项', () => {
    const c = normalizeQuizDraft(choiceDraft({ accept: ['多余'], answerZh: '多余' }));
    expect(c.accept).toEqual([]);
    expect(c.answerZh).toBe('');
    const o = normalizeQuizDraft(openDraft({ options: [{ zh: '多余', en: 'stray' }] }));
    expect(o.options).toEqual([]);
    // accept 去重去空
    expect(normalizeQuizDraft(openDraft({ accept: ['15', ' 15 ', ''] })).accept).toEqual(['15']);
  });
});

describe('社区题 → 题目(语言回落)', () => {
  it('双语齐全:原样带过,不标语言', () => {
    const q = toQuestion(row())!;
    expect(q.q).toEqual({ zh: '题面', en: 'Question' });
    expect(q.by?.onlyLang).toBeNull();
    expect(q.id).toBe('c-1');
  });

  it('只有中文:英文回落到中文原文,并标记 onlyLang', () => {
    const q = toQuestion(row({
      qEn: '',
      options: [{ zh: '甲', en: '' }, { zh: '乙', en: '' }, { zh: '丙', en: '' }],
    }))!;
    expect(q.q).toEqual({ zh: '题面', en: '题面' });
    expect(q.by?.onlyLang).toBe('zh');
    expect(q.type === 'choice' && q.options[0]).toEqual({ zh: '甲', en: '甲' });
  });

  it('只有英文:中文回落到英文原文', () => {
    const q = toQuestion(row({
      qZh: '',
      options: [{ zh: '', en: 'A' }, { zh: '', en: 'B' }, { zh: '', en: 'C' }],
    }))!;
    expect(q.q).toEqual({ zh: 'Question', en: 'Question' });
    expect(q.by?.onlyLang).toBe('en');
  });

  it('问答题带 accept,判卷照常', () => {
    const q = toQuestion(row({
      type: 'open', options: [], answerZh: '15 秒', answerEn: '15 seconds', accept: ['15'],
    }))!;
    expect(q.type).toBe('open');
    expect(q.type === 'open' && gradeOpen('十五?我猜 15 秒', q.accept)).toBe(true);
  });

  it('脏数据一律丢掉,不让一行坏数据毁掉整局', () => {
    expect(toQuestion(row({ cat: 'gossip' }))).toBeNull();
    expect(toQuestion(row({ level: 'insane' }))).toBeNull();
    expect(toQuestion(row({ qZh: '', qEn: '' }))).toBeNull();
    expect(toQuestion(row({ answerIdx: 9 }))).toBeNull();
    expect(toQuestion(row({ options: [{ zh: '甲', en: 'A' }, { zh: '', en: '' }] }))).toBeNull();
    expect(toQuestion(row({ type: 'open', options: [], answerZh: '有', answerEn: '', accept: [] }))).toBeNull();
  });

  it('forLevel 只放行该档的题', () => {
    const rows = [row({ id: 1, level: 'easy' }), row({ id: 2, level: 'hard' })];
    expect(forLevel(rows, 'easy').map((q) => q.id)).toEqual(['c-1']);
    expect(forLevel(rows, 'hard').map((q) => q.id)).toEqual(['c-2']);
  });

  it('countByCat 按分类计数(选题页的题数要把社区题算进去)', () => {
    const qs = forLevel([row({ id: 1 }), row({ id: 2 }), row({ id: 3, cat: 'rules' })], 'easy');
    expect(countByCat(qs)).toEqual({ history: 2, rules: 1 });
  });
});

describe('抽题把社区题和内置题同池混', () => {
  const extra = forLevel([
    row({ id: 1, cat: 'history' }),
    row({ id: 2, cat: 'history' }),
    row({ id: 3, cat: 'rules' }),
  ], 'easy');

  it('指定分类时,只有该分类的社区题上场', () => {
    const deck = buildDeck('easy', 'history', seeded(1), extra);
    expect(deck.length).toBe(BANK.easy.history.length + 2);
    const ids = deck.map((d) => d.q.id);
    expect(ids).toContain('c-1');
    expect(ids).toContain('c-2');
    expect(ids).not.toContain('c-3');
  });

  it('不传 extra 时行为和以前一模一样(内置题库那条老路径不受影响)', () => {
    const before = buildDeck('easy', 'history', seeded(4));
    const after = buildDeck('easy', 'history', seeded(4), []);
    expect(after.map((d) => d.q.id)).toEqual(before.map((d) => d.q.id));
  });

  it('社区题的选项一样会洗牌,答案下标跟着换算', () => {
    const deck = buildDeck('easy', 'history', seeded(2), extra);
    for (const d of deck) {
      if (d.q.type !== 'choice') continue;
      expect([...d.order].sort((a, b) => a - b)).toEqual(d.q.options.map((_, i) => i));
    }
  });

  it('混合模式抽到的题里可以有社区题', () => {
    const many = forLevel(
      Array.from({ length: 40 }, (_, i) => row({ id: i + 1, cat: 'history' })),
      'easy',
    );
    const deck = buildDeck('easy', null, seeded(6), many);
    expect(deck.some((d) => d.q.by !== undefined)).toBe(true);
  });
});
