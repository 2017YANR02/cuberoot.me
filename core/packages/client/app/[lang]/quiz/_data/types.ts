// /quiz 题库的数据形状。题目按分类拆成同目录下的 8 个文件,index.ts 汇总。
//
// 只有两种题型:
//   choice — 单选,options 里恰好一个正确,answer 是它的下标。
//   open   — 问答,answer 是参考答案,accept 是判对用的关键词(见 _lib/grade.ts)。
// 两种题都可以带 why(解析),答完才显示。

export interface Msg { zh: string; en: string }

/**
 * 难度档。easy = 常识题(_data/*.ts),hard = 进阶题(_data/hard/*.ts)。
 * 两档是两套独立题目,不是同一批题标不同难度。
 */
export const LEVELS = ['easy', 'hard'] as const;
export type Level = typeof LEVELS[number];

/** 分类 id。新增分类要同时在 index.ts 的 CATEGORIES 里登记,否则 tests/quiz_bank 会红。 */
export type QuizCat =
  | 'history'
  | 'rules'
  | 'events'
  | 'records'
  | 'notation'
  | 'methods'
  | 'math'
  | 'gear';

/**
 * 社区题的附加信息(内置题没有这一段)。
 * 社区题由登录用户出,直接上线,可被举报 —— 见 _lib/community.ts 与 server/routes/quiz.ts。
 */
export interface Contributed {
  /** quiz_questions.id。举报 / 编辑 / 删除都用它。 */
  dbId: number;
  authorName: string;
  /**
   * 作者只写了这一种语言,另一侧是原文回落 —— 答题页据此标注「仅中文 / English only」。
   * 双语齐全(或管理员补译过)则为 null。
   */
  onlyLang: 'zh' | 'en' | null;
}

interface QuestionBase {
  /** 全局唯一,分类前缀 + 序号(如 hist-01);社区题是 `c-<dbId>`。URL / localStorage 里都用它,别改已有的。 */
  id: string;
  cat: QuizCat;
  q: Msg;
  /** 答完显示的解析。事实类题目尽量都写,写不出可靠出处就别编。 */
  why?: Msg;
  /** 有这一段就是社区题;内置题一律没有。 */
  by?: Contributed;
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice';
  options: Msg[];
  /** 正确选项在 options 里的下标。 */
  answer: number;
}

export interface OpenQuestion extends QuestionBase {
  type: 'open';
  /** 参考答案,原样展示给用户。 */
  answer: Msg;
  /**
   * 判对用的关键词,小写。作答经归一化后只要命中任意一个就算对 —— 宁松不紧,
   * 判错了用户还能手动改判(页面上有「其实我答对了」)。
   */
  accept: string[];
}

export type Question = ChoiceQuestion | OpenQuestion;
