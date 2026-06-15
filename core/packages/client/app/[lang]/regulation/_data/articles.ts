// Single source of truth for the WCA Regulations chapter set.
//
// The hub (page.tsx), the per-article shell (RegArticleLayout) and the
// prev/next navigation all read from here. Each chapter lives at
// /regulation/<slug> as its own static route. Order in REG_ARTICLES is the
// canonical reading order (drives prev/next).
//
// Numbering follows the official WCA Regulations: core articles 1,2,3,4,5,7,9,
// 10,11,12 (6 and 8 don't exist in the current revision) plus event-specific
// appendices A,B,C,E,H,I.
//
// i18n: title/tagline are { zh, en } and render via tr().
// Render through useRegText() in _components/reg-text.

import type { LucideIcon } from 'lucide-react';
import {
  Gavel, Users, Box, Shuffle, Wrench, Building2, ListChecks,
  CircleCheckBig, TriangleAlert, RotateCw,
  Timer, EyeOff, Hand, PencilRuler, Layers, Swords,
} from 'lucide-react';

export type RegGroup = 'core' | 'event';

export interface Msg { zh: string; en: string; }

export interface RegArticle {
  /** URL segment: /regulation/<slug> */
  slug: string;
  /** Article number / appendix letter as printed in the regs ('4', '12', 'A'). */
  num: string;
  group: RegGroup;
  title: Msg;
  /** One-line hook shown on the hub card and as the page subtitle. */
  tagline: Msg;
  Icon: LucideIcon;
}

export const REG_ARTICLES: RegArticle[] = [
  {
    slug: 'officials', num: '1', group: 'core', Icon: Gavel,
    title: { zh: '工作人员', en: 'Officials' },
    tagline: { zh: '代表、裁判、录入员、打乱员各管什么', en: 'What Delegates, judges, scramblers and score takers each do' },
  },
  {
    slug: 'competitors', num: '2', group: 'core', Icon: Users,
    title: { zh: '选手', en: 'Competitors' },
    tagline: { zh: '谁能参赛、报名、签到与基本义务', en: 'Who may compete, registration, and a competitor’s duties' },
  },
  {
    slug: 'puzzles', num: '3', group: 'core', Icon: Box,
    title: { zh: '魔方', en: 'Puzzles' },
    tagline: { zh: '什么样的魔方能上场:配色、Logo、改装', en: 'What puzzle you may use: colours, logos, modifications' },
  },
  {
    slug: 'scrambling', num: '4', group: 'core', Icon: Shuffle,
    title: { zh: '打乱', en: 'Scrambling' },
    tagline: { zh: '随机状态打乱、打乱程序、同轮一致', en: 'Random-state scrambles, the scrambling program, fairness' },
  },
  {
    slug: 'defects', num: '5', group: 'core', Icon: Wrench,
    title: { zh: '魔方故障', en: 'Puzzle Defects' },
    tagline: { zh: '掉块、解体、错位 —— 怎么判,11 个真实案例', en: 'Pops, breakage, misalignment — judged through 11 real cases' },
  },
  {
    slug: 'environment', num: '7', group: 'core', Icon: Building2,
    title: { zh: '比赛环境', en: 'Environment' },
    tagline: { zh: '场地、计时设备、打乱区的隔离与保密', en: 'Venue, timing equipment, and isolating and securing the scrambling area' },
  },
  {
    slug: 'events', num: '9', group: 'core', Icon: ListChecks,
    title: { zh: '项目', en: 'Events' },
    tagline: { zh: '全部 WCA 项目、赛制、晋级线与时间上限', en: 'Every WCA event, formats, cutoffs and time limits' },
  },
  {
    slug: 'solved-state', num: '10', group: 'core', Icon: CircleCheckBig,
    title: { zh: '完成状态', en: 'Solved State' },
    tagline: { zh: '什么叫还原:错位限度、+2 与 DNF 的界线', en: 'What counts as solved: misalignment limits, +2 vs DNF' },
  },
  {
    slug: 'incidents', num: '11', group: 'core', Icon: TriangleAlert,
    title: { zh: '意外事件', en: 'Incidents' },
    tagline: { zh: '干扰、设备故障与额外机会的处理', en: 'Interruptions, equipment failures and extra attempts' },
  },
  {
    slug: 'notation', num: '12', group: 'core', Icon: RotateCw,
    title: { zh: '转动表示方法', en: 'Notation' },
    tagline: { zh: '每种魔方怎么记一步转动 —— 全部 3D 动画演示', en: 'How a move is written for every puzzle — all in 3D' },
  },
  {
    slug: 'speed-solving', num: 'A', group: 'event', Icon: Timer,
    title: { zh: '速拧', en: 'Speed Solving' },
    tagline: { zh: '15 秒检查、开始/停止计时、罚时规程', en: 'The 15-second inspection, start/stop, penalty procedure' },
  },
  {
    slug: 'blindfolded', num: 'B', group: 'event', Icon: EyeOff,
    title: { zh: '盲拧', en: 'Blindfolded Solving' },
    tagline: { zh: '记忆 + 蒙眼还原,睁眼即 DNF', en: 'Memorize then solve blindfolded; peeking is a DNF' },
  },
  {
    slug: 'one-handed', num: 'C', group: 'event', Icon: Hand,
    title: { zh: '单手还原', en: 'One-Handed Solving' },
    tagline: { zh: '只用一只手,另一只手不得碰魔方', en: 'One hand only — the other may not touch the puzzle' },
  },
  {
    slug: 'fewest-moves', num: 'E', group: 'event', Icon: PencilRuler,
    title: { zh: '最少步还原', en: 'Fewest Moves Solving' },
    tagline: { zh: '60 分钟纸笔写解法,最多 80 步', en: '60 minutes, pen & paper, a solution of at most 80 moves' },
  },
  {
    slug: 'multi-blind', num: 'H', group: 'event', Icon: Layers,
    title: { zh: '多盲', en: 'Multi-Blind Solving' },
    tagline: { zh: '一次记忆并蒙眼还原多个三阶,1 小时上限', en: 'Memorize and solve many 3×3s blindfolded, 1-hour cap' },
  },
  {
    slug: 'head-to-head', num: 'I', group: 'event', Icon: Swords,
    title: { zh: '“一对一”复原', en: 'Head to Head Solving' },
    tagline: { zh: '两名选手并排同时还原,胜者晋级', en: 'Two competitors solve side by side; the winner advances' },
  },
];

export const CORE_ARTICLES = REG_ARTICLES.filter((a) => a.group === 'core');
export const EVENT_ARTICLES = REG_ARTICLES.filter((a) => a.group === 'event');

export function articleBySlug(slug: string): RegArticle | undefined {
  return REG_ARTICLES.find((a) => a.slug === slug);
}

/** Previous / next chapter in canonical reading order (for the article footer nav). */
export function regNav(slug: string): { prev?: RegArticle; next?: RegArticle } {
  const i = REG_ARTICLES.findIndex((a) => a.slug === slug);
  if (i < 0) return {};
  return {
    prev: i > 0 ? REG_ARTICLES[i - 1] : undefined,
    next: i < REG_ARTICLES.length - 1 ? REG_ARTICLES[i + 1] : undefined,
  };
}
