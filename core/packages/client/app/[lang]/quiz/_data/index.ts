import { BookOpen, Scale, Boxes, Trophy, Type, Route, Sigma, Wrench, type LucideIcon } from 'lucide-react';
import type { Msg, Question, QuizCat } from './types';
import { HISTORY } from './history';
import { RULES } from './rules';
import { EVENTS } from './events';
import { RECORDS } from './records';
import { NOTATION } from './notation';
import { METHODS } from './methods';
import { MATH } from './math';
import { GEAR } from './gear';

export type { Msg, Question, QuizCat, ChoiceQuestion, OpenQuestion } from './types';

export interface QuizCategory {
  id: QuizCat;
  name: Msg;
  /** 一行说明,分类卡上显示。 */
  blurb: Msg;
  Icon: LucideIcon;
}

/** 顺序即页面上的排列顺序:先常识,后规则,再术语/技术。 */
export const CATEGORIES: QuizCategory[] = [
  {
    id: 'history', Icon: BookOpen,
    name: { zh: '历史与人物', en: 'History & people' },
    blurb: { zh: '魔方从哪来,谁发明的,速拧是怎么办成比赛的', en: 'Where the cube came from, who made it, how speedcubing became a sport' },
  },
  {
    id: 'rules', Icon: Scale,
    name: { zh: '规则与判罚', en: 'Rules & penalties' },
    blurb: { zh: '观察 15 秒、+2、DNF —— 上赛场前该知道的那些', en: 'Inspection, +2, DNF — what to know before your first competition' },
  },
  {
    id: 'events', Icon: Boxes,
    name: { zh: '项目与赛制', en: 'Events & formats' },
    blurb: { zh: '十七个官方项目各是什么,成绩怎么算', en: 'The seventeen official events and how each is scored' },
  },
  {
    id: 'records', Icon: Trophy,
    name: { zh: '纪录与赛事', en: 'Records & competitions' },
    blurb: { zh: '纪录分几级,一场比赛是怎么办起来的', en: 'Record levels, and how a competition is actually run' },
  },
  {
    id: 'notation', Icon: Type,
    name: { zh: '记号与术语', en: 'Notation & jargon' },
    blurb: { zh: 'R U F 怎么读,PB、sub-20、parity 是什么', en: 'Reading R U F, plus PB, sub-20, parity and friends' },
  },
  {
    id: 'methods', Icon: Route,
    name: { zh: '解法与公式', en: 'Methods & algorithms' },
    blurb: { zh: 'CFOP、Roux、ZZ、盲拧,各自怎么走', en: 'CFOP, Roux, ZZ and blindfolded methods' },
  },
  {
    id: 'math', Icon: Sigma,
    name: { zh: '数学与组合', en: 'Maths & counting' },
    blurb: { zh: '4.3×10¹⁹ 种状态、上帝之数,还有为什么有些状态拧不回来', en: '4.3×10¹⁹ states, God\'s number, and why some states are impossible' },
  },
  {
    id: 'gear', Icon: Wrench,
    name: { zh: '装备与配色', en: 'Gear & colours' },
    blurb: { zh: '六面怎么配色,魔方怎么调,赛场用什么设备', en: 'The colour scheme, tuning a cube, and the kit used at competitions' },
  },
];

/** 分类 id → 该分类的题目。顺序保持文件里写的顺序(抽题时才打乱)。 */
export const BY_CAT: Record<QuizCat, Question[]> = {
  history: HISTORY,
  rules: RULES,
  events: EVENTS,
  records: RECORDS,
  notation: NOTATION,
  methods: METHODS,
  math: MATH,
  gear: GEAR,
};

/** 全部题目,按 CATEGORIES 的顺序拼接。 */
export const ALL_QUESTIONS: Question[] = CATEGORIES.flatMap((c) => BY_CAT[c.id]);

export const CAT_IDS = CATEGORIES.map((c) => c.id);

export const findCategory = (id: string | null): QuizCategory | undefined =>
  CATEGORIES.find((c) => c.id === id);
