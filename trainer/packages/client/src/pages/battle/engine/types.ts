/**
 * Battle 模块类型定义
 * 1:1 翻译自 battle.js state 对象和 createPlayer()（行 99~171）
 */

import type { PenaltyType } from './constants';

// NOTE: 成绩历史条目
export interface SolveEntry {
  time: number;            // 解题时间（ms）
  penalty: string;         // 'ok' | '+2' | 'dnf'
  scramble: string;        // 打乱字符串
  date: string;            // ISO 8601 日期字符串
  // NOTE: 多阶段分段时间（可选）
  phases?: number[];
  // NOTE: 旧版 BLD 格式兼容（memo 时间）
  memo?: number;
}

// NOTE: 玩家状态（对应 createPlayer() 返回的对象）
export interface PlayerState {
  id: number;
  isReady: boolean;
  canStart: boolean;
  isTiming: boolean;
  hasFinished: boolean;
  // NOTE: WCA 观察状态（Solo 模式）
  isInspecting: boolean;
  inspectionStart: number;
  inspectionTimer: ReturnType<typeof setInterval> | null;
  inspectionPenalty: string | null; // null, '+2', 'dnf'
  penalty: PenaltyType;
  // NOTE: 以 ms 为单位的解题时间
  time: number;
  // performance.now() 时间戳（单调时钟，更精确）
  startTime: number;
  // NOTE: 多阶段计时 — phaseSplits 存储每次分段的时间戳
  phaseSplits: number[];
  // 累积比分（刷新即清零）
  points: number;
  // 此玩家绑定的 pointerId（多点触控隔离）
  pointerId: number | null;
  // requestAnimationFrame ID
  rafId: number | null;
  // NOTE: 成绩历史 — 对象数组
  solveHistory: SolveEntry[];
}

// NOTE: Session 类型
export interface Session {
  id: string;
  name: string;
}

// NOTE: 赢家标识
// -2=未决 -1=平局 0=下方 1=上方
export type WinnerValue = -2 | -1 | 0 | 1;

// NOTE: 模式类型
export type BattleMode = 'solo' | '1v1';

// NOTE: Tab 名称
export type TabName = 'timer' | 'results' | 'settings';
