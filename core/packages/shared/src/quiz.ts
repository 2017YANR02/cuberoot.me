/**
 * /quiz 社区题的形状、判卷与校验 —— 服务端(写入把关)和客户端(提交前预检、
 * 答题判卷)共用同一份实现。
 *
 * 为什么要共用:内置题库的红线由 tests/quiz_bank.test.ts 守着(选项不重复、
 * 参考答案自己能被 accept 判对……)。社区题绕过了那套测试,如果校验只写在表单里,
 * 直接打 API 就能塞进一道「参考答案判不对」的死题;如果只写在服务端,用户要提交
 * 一次才知道哪错了。两边引同一个函数是唯一不会漂移的写法。
 *
 * 语言:允许只写一种语言(见 filledLangs)。缺的那一侧存空串,渲染时回落到已有
 * 那一侧并在题面上标注,管理员之后可以补译。
 */

export const QUIZ_CATS = [
  'history', 'rules', 'events', 'records', 'notation', 'methods', 'math', 'gear',
] as const;
export type QuizCatId = typeof QUIZ_CATS[number];

export const QUIZ_LEVELS = ['easy', 'hard'] as const;
export type QuizLevelId = typeof QUIZ_LEVELS[number];

export const QUIZ_TYPES = ['choice', 'open'] as const;
export type QuizTypeId = typeof QUIZ_TYPES[number];

export type QuizLang = 'zh' | 'en';

/** 长度与数量上限。服务端按这些值拒收,客户端按同样的值提示。 */
export const QUIZ_LIMITS = {
  question: 300,
  option: 160,
  answer: 300,
  why: 800,
  acceptWord: 60,
  minOptions: 3,
  maxOptions: 6,
  maxAccept: 12,
} as const;

/** 一道待提交/待保存的社区题。两种题型共用一个形状,用不到的字段留空。 */
export interface QuizDraft {
  cat: string;
  level: string;
  type: string;
  qZh: string;
  qEn: string;
  whyZh: string;
  whyEn: string;
  /** choice 专用。每项两语,可只填一侧。 */
  options: { zh: string; en: string }[];
  /** choice 专用:正确项在 options 里的下标。 */
  answerIdx: number;
  /** open 专用:参考答案。 */
  answerZh: string;
  answerEn: string;
  /** open 专用:判对关键词。 */
  accept: string[];
}

export type QuizDraftError =
  | 'cat' | 'level' | 'type'
  | 'question' | 'question_long' | 'why_long'
  | 'options_count' | 'option_dup' | 'option_long' | 'answer_idx'
  | 'answer_long'
  | 'accept_empty' | 'accept_long' | 'accept_unmatched';

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

/** 去掉首尾空白;undefined/null 当空串。 */
function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * 这道题在哪几种语言下是「完整」的 —— 题面 + 该题型的答案部分都写了。
 * 至少要有一种,否则整道题没法出。
 */
export function filledLangs(d: QuizDraft): QuizLang[] {
  const ok = (lang: QuizLang): boolean => {
    const q = lang === 'zh' ? s(d.qZh) : s(d.qEn);
    if (!q) return false;
    if (d.type === 'choice') {
      const opts = d.options ?? [];
      return opts.length > 0 && opts.every((o) => s(lang === 'zh' ? o?.zh : o?.en) !== '');
    }
    return s(lang === 'zh' ? d.answerZh : d.answerEn) !== '';
  };
  return (['zh', 'en'] as QuizLang[]).filter(ok);
}

/**
 * 全量校验。返回第一个错误码,没错返回 null。
 * 错误码由调用方翻成人话(客户端双语提示,服务端原样回给 API 调用者)。
 */
export function validateQuizDraft(d: QuizDraft): QuizDraftError | null {
  if (!(QUIZ_CATS as readonly string[]).includes(d.cat)) return 'cat';
  if (!(QUIZ_LEVELS as readonly string[]).includes(d.level)) return 'level';
  if (!(QUIZ_TYPES as readonly string[]).includes(d.type)) return 'type';

  const langs = filledLangs(d);
  if (langs.length === 0) return 'question';

  if (s(d.qZh).length > QUIZ_LIMITS.question || s(d.qEn).length > QUIZ_LIMITS.question) return 'question_long';
  if (s(d.whyZh).length > QUIZ_LIMITS.why || s(d.whyEn).length > QUIZ_LIMITS.why) return 'why_long';

  if (d.type === 'choice') {
    const opts = d.options ?? [];
    if (opts.length < QUIZ_LIMITS.minOptions || opts.length > QUIZ_LIMITS.maxOptions) return 'options_count';
    if (!Number.isInteger(d.answerIdx) || d.answerIdx < 0 || d.answerIdx >= opts.length) return 'answer_idx';
    for (const o of opts) {
      if (s(o?.zh).length > QUIZ_LIMITS.option || s(o?.en).length > QUIZ_LIMITS.option) return 'option_long';
    }
    // 选项重复只在「写全了的语言」里查 —— 另一侧整列空白不算重复。
    for (const lang of langs) {
      const texts = opts.map((o) => s(lang === 'zh' ? o?.zh : o?.en));
      if (new Set(texts).size !== texts.length) return 'option_dup';
    }
    return null;
  }

  if (s(d.answerZh).length > QUIZ_LIMITS.answer || s(d.answerEn).length > QUIZ_LIMITS.answer) return 'answer_long';
  const accept = (d.accept ?? []).map(s).filter(Boolean);
  if (accept.length === 0 || accept.length > QUIZ_LIMITS.maxAccept) return 'accept_empty';
  if (accept.some((k) => k.length > QUIZ_LIMITS.acceptWord)) return 'accept_long';
  // 内置题库同款红线:参考答案自己判不对 = 关键词写歪了。写了哪种语言就查哪种。
  for (const lang of langs) {
    const ref = lang === 'zh' ? s(d.answerZh) : s(d.answerEn);
    if (!gradeOpen(ref, accept)) return 'accept_unmatched';
  }
  return null;
}

/** 规范化成入库形状:全部 trim,用不到的字段清空,accept 去重去空。 */
export function normalizeQuizDraft(d: QuizDraft): QuizDraft {
  const choice = d.type === 'choice';
  return {
    cat: d.cat,
    level: d.level,
    type: d.type,
    qZh: s(d.qZh),
    qEn: s(d.qEn),
    whyZh: s(d.whyZh),
    whyEn: s(d.whyEn),
    options: choice ? (d.options ?? []).map((o) => ({ zh: s(o?.zh), en: s(o?.en) })) : [],
    answerIdx: choice ? d.answerIdx : 0,
    answerZh: choice ? '' : s(d.answerZh),
    answerEn: choice ? '' : s(d.answerEn),
    accept: choice ? [] : [...new Set((d.accept ?? []).map(s).filter(Boolean))],
  };
}
