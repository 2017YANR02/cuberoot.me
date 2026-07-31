// /quiz 题库的数据形状。题目按分类拆成同目录下的 8 个文件,index.ts 汇总。
//
// 只有两种题型:
//   choice — 单选,options 里恰好一个正确,answer 是它的下标。
//   open   — 问答,answer 是参考答案,accept 是判对用的关键词(见 _lib/grade.ts)。
// 两种题都可以带 why(解析),答完才显示。

export interface Msg { zh: string; en: string }

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

interface QuestionBase {
  /** 全局唯一,分类前缀 + 序号(如 hist-01);URL / localStorage 里都用它,别改已有的。 */
  id: string;
  cat: QuizCat;
  q: Msg;
  /** 答完显示的解析。事实类题目尽量都写,写不出可靠出处就别编。 */
  why?: Msg;
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
