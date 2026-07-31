import { BookOpen, Scale, Boxes, Trophy, Type, Route, Sigma, Wrench, type LucideIcon } from 'lucide-react';
import type { Level, Msg, Question, QuizCat } from './types';
import { HISTORY } from './history';
import { RULES } from './rules';
import { EVENTS } from './events';
import { RECORDS } from './records';
import { NOTATION } from './notation';
import { METHODS } from './methods';
import { MATH } from './math';
import { GEAR } from './gear';
import { HISTORY_HARD } from './hard/history';
import { RULES_HARD } from './hard/rules';
import { EVENTS_HARD } from './hard/events';
import { RECORDS_HARD } from './hard/records';
import { NOTATION_HARD } from './hard/notation';
import { METHODS_HARD } from './hard/methods';
import { MATH_HARD } from './hard/math';
import { GEAR_HARD } from './hard/gear';

export type { Level, Msg, Question, QuizCat, ChoiceQuestion, OpenQuestion } from './types';
export { LEVELS } from './types';

export interface QuizCategory {
  id: QuizCat;
  name: Msg;
  /** 分类卡上的一行说明,两档各写一份 —— 同一分类下两档问的东西差得远。 */
  blurb: Record<Level, Msg>;
  Icon: LucideIcon;
}

/** 顺序即页面上的排列顺序:先常识,后规则,再术语/技术。 */
export const CATEGORIES: QuizCategory[] = [
  {
    id: 'history', Icon: BookOpen,
    name: { zh: '历史与人物', en: 'History & people' },
    blurb: {
      easy: { zh: '魔方从哪来,谁发明的,速拧是怎么办成比赛的', en: 'Where the cube came from, who made it, how speedcubing became a sport' },
      hard: { zh: '专利之争、上帝之数怎么证出来的、纪录史上的关键节点', en: "Patent fights, how God's number was actually proven, and the milestones of record history" },
    },
  },
  {
    id: 'rules', Icon: Scale,
    name: { zh: '规则与判罚', en: 'Rules & penalties' },
    blurb: {
      easy: { zh: '观察 15 秒、+2、DNF —— 上赛场前该知道的那些', en: 'Inspection, +2, DNF — what to know before your first competition' },
      hard: { zh: '打乱要求几步起、时限怎么算、逐帧录像什么时候能当证据', en: "Scramble depth requirements, time limits, and when video evidence may be slowed down" },
    },
  },
  {
    id: 'events', Icon: Boxes,
    name: { zh: '项目与赛制', en: 'Events & formats' },
    blurb: {
      easy: { zh: '十七个官方项目各是什么,成绩怎么算', en: 'The seventeen official events and how each is scored' },
      hard: { zh: '最少步和多盲的细则,双重轮与及格线轮次', en: "The fine print of fewest moves and multi-blind, plus dual and combined rounds" },
    },
  },
  {
    id: 'records', Icon: Trophy,
    name: { zh: '纪录与赛事', en: 'Records & competitions' },
    blurb: {
      easy: { zh: '纪录分几级,一场比赛是怎么办起来的', en: 'Record levels, and how a competition is actually run' },
      hard: { zh: '完整赛制、额外承认的平均排名、打乱出错怎么收场', en: "Full round formats, the extra average rankings, and how mis-scrambles are settled" },
    },
  },
  {
    id: 'notation', Icon: Type,
    name: { zh: '记号与术语', en: 'Notation & jargon' },
    blurb: {
      easy: { zh: 'R U F 怎么读,PB、sub-20、parity 是什么', en: 'Reading R U F, plus PB, sub-20, parity and friends' },
      hard: { zh: 'OBTM/ETM/QTM 怎么数步,SQ1、五魔方、金字塔的官方记号', en: "Counting moves in OBTM, ETM and QTM, plus official Square-1, Megaminx and Pyraminx notation" },
    },
  },
  {
    id: 'methods', Icon: Route,
    name: { zh: '解法与公式', en: 'Methods & algorithms' },
    blurb: {
      easy: { zh: 'CFOP、Roux、ZZ、盲拧,各自怎么走', en: 'CFOP, Roux, ZZ and blindfolded methods' },
      hard: { zh: 'ZBLL 493、COLL 42,Roux 分步命名,3-style 与 NISS', en: "ZBLL's 493 and COLL's 42, Roux step names, 3-style and NISS" },
    },
  },
  {
    id: 'math', Icon: Sigma,
    name: { zh: '数学与组合', en: 'Maths & counting' },
    blurb: {
      easy: { zh: '4.3×10¹⁹ 种状态、上帝之数,还有为什么有些状态拧不回来', en: '4.3×10¹⁹ states, God\'s number, and why some states are impossible' },
      hard: { zh: '群阶的质因数分解、距离分布,以及各项目上帝之数的现状', en: "The prime factorisation of the group order, distance distributions, and where each God's number stands" },
    },
  },
  {
    id: 'gear', Icon: Wrench,
    name: { zh: '装备与配色', en: 'Gear & colours' },
    blurb: {
      easy: { zh: '六面怎么配色,魔方怎么调,赛场用什么设备', en: 'The colour scheme, tuning a cube, and the kit used at competitions' },
      hard: { zh: '散架怎么合规地修、掉块算不算还原、各魔方的错位限度', en: "Legal repairs, whether a dropped piece still counts as solved, and per-puzzle misalignment limits" },
    },
  },
];

/**
 * 难度 × 分类 → 题目。
 *
 * 两档题库是两套独立文件(hard/ 子目录),不是给同一批题打标签:同一个分类下,
 * 简单档问「观察多少秒」,进阶档问「打乱要求至少几步、逐帧录像什么时候能用」。
 */
export const BANK: Record<Level, Record<QuizCat, Question[]>> = {
  easy: {
    history: HISTORY,
    rules: RULES,
    events: EVENTS,
    records: RECORDS,
    notation: NOTATION,
    methods: METHODS,
    math: MATH,
    gear: GEAR,
  },
  hard: {
    history: HISTORY_HARD,
    rules: RULES_HARD,
    events: EVENTS_HARD,
    records: RECORDS_HARD,
    notation: NOTATION_HARD,
    methods: METHODS_HARD,
    math: MATH_HARD,
    gear: GEAR_HARD,
  },
};

export const CAT_IDS = CATEGORIES.map((c) => c.id);

/** 某一档的全部题目,按 CATEGORIES 的顺序拼接。 */
export const allQuestions = (level: Level): Question[] =>
  CATEGORIES.flatMap((c) => BANK[level][c.id]);

export const findCategory = (id: string | null): QuizCategory | undefined =>
  CATEGORIES.find((c) => c.id === id);
