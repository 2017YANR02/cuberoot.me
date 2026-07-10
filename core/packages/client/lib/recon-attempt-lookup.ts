// (compId, wcaEventId, wcaRoundTypeId, attemptNum) → reconId lookup.
// Used by /recon (same-comp list) and /wca/persons (per-row attempt cell) navigation.

import type { ReconSolve } from '@cuberoot/shared';
import { matchRoundType } from './wca-results-api';
import { toWcaEventId, wcaToReconEvent } from './wca-events';

/** 逐把复盘的最小信息:id(跳详情页) + stm/tps(选手页详细成绩下方展示)。 */
export interface ReconAttemptInfo {
  id: number;
  stm?: number;
  tps?: number;
}

export function buildReconAttemptMap(recons: ReconSolve[]): Map<string, ReconAttemptInfo> {
  const m = new Map<string, ReconAttemptInfo>();
  for (const r of recons) {
    if (!r.compWcaId || !r.event || !r.round || r.solveNum == null) continue;
    const wcaEid = toWcaEventId(r.event);
    m.set(`${r.compWcaId}|${wcaEid}|${r.round}|${r.solveNum}`, { id: r.id, stm: r.stm, tps: r.tps });
  }
  return m;
}

export function findReconForAttempt(
  map: Map<string, ReconAttemptInfo> | null | undefined,
  compId: string,
  wcaEventId: string,
  wcaRoundTypeId: string,
  attemptNum: number,
): ReconAttemptInfo | undefined {
  if (!map) return undefined;
  for (const reconRound of ['1', '2', '3', 'f']) {
    if (matchRoundType(reconRound, wcaRoundTypeId)) {
      const info = map.get(`${compId}|${wcaEventId}|${reconRound}|${attemptNum}`);
      if (info) return info;
    }
  }
  return undefined;
}

/** 该轮任一把有复盘且带 stm/tps → 选手页在详细成绩下方展示 STM/TPS 两行。 */
export function rowHasReconStats(
  map: Map<string, ReconAttemptInfo> | null | undefined,
  compId: string,
  wcaEventId: string,
  wcaRoundTypeId: string,
  attemptCount: number,
): boolean {
  if (!map) return false;
  for (let i = 1; i <= attemptCount; i++) {
    const info = findReconForAttempt(map, compId, wcaEventId, wcaRoundTypeId, i);
    if (info && ((info.stm ?? 0) > 0 || (info.tps ?? 0) > 0)) return true;
  }
  return false;
}

// Person-aware variant: keyed by personId too, so a comp results table (many people
// sharing the same comp/event/round/solveNum) doesn't collide — each person's solve N
// maps to that person's own recon. The person-less map above is fine on /wca/persons
// (already scoped to one person) but WRONG for a whole-comp table.
export function buildReconPersonAttemptMap(recons: ReconSolve[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of recons) {
    if (!r.compWcaId || !r.personId || !r.event || !r.round || r.solveNum == null) continue;
    const wcaEid = toWcaEventId(r.event);
    m.set(`${r.compWcaId}|${r.personId}|${wcaEid}|${r.round}|${r.solveNum}`, r.id);
  }
  return m;
}

export function findReconForPersonAttempt(
  map: Map<string, number> | null | undefined,
  compId: string,
  personId: string,
  wcaEventId: string,
  wcaRoundTypeId: string,
  attemptNum: number,
): number | undefined {
  if (!map || !personId) return undefined;
  for (const reconRound of ['1', '2', '3', 'f']) {
    if (matchRoundType(reconRound, wcaRoundTypeId)) {
      const id = map.get(`${compId}|${personId}|${wcaEventId}|${reconRound}|${attemptNum}`);
      if (id) return id;
    }
  }
  return undefined;
}

/** WCA roundTypeId → recon 轮次('1'/'2'/'3'/'f');无法归类返回 undefined。 */
export function wcaRoundToReconRound(wcaRoundTypeId: string): string | undefined {
  for (const reconRound of ['1', '2', '3', 'f']) {
    if (matchRoundType(reconRound, wcaRoundTypeId)) return reconRound;
  }
  return undefined;
}

export interface ReconSubmitPrefill {
  wcaEventId: string;
  roundTypeId: string;
  solveNum: number;
  personId: string;
  personName: string;
  personCountry?: string;
  compId: string;
  compName: string;
  compCountry?: string;
  compDate?: string;
  /** 原始成绩(罚时前的 base,单位秒)。仅当该次有罚时才传——否则交给表单自动获取。 */
  rawTimeSec?: number;
  /** 单次纪录标记(选手页该把显示的角标,如 PR119 / WR / NR)。传了就预填「单次纪录」并锁住,免表单按「最佳把」重算。 */
  singleRecordTag?: string;
}

/**
 * 选手页「还没复盘」的成绩 → /recon/submit 预填链接。
 * 只带身份字段(选手/比赛/项目/轮次/第几把);单次/平均/纪录交给 submit 表单的
 * 「按 person+comp+event+round+solveNum 自动获取」逻辑(per-event 正确,免在此处理 FMC/MBLD 编码)。
 */
export function buildReconSubmitHref(p: ReconSubmitPrefill): string {
  const params = new URLSearchParams();
  params.set('event', wcaToReconEvent(p.wcaEventId));
  const round = wcaRoundToReconRound(p.roundTypeId);
  if (round) params.set('round', round);
  params.set('solveNum', String(p.solveNum));
  params.set('personId', p.personId);
  params.set('person', p.personName);
  if (p.personCountry) params.set('personCountry', p.personCountry);
  params.set('compWcaId', p.compId);
  params.set('comp', p.compName);
  if (p.compCountry) params.set('country', p.compCountry);
  if (p.compDate) params.set('date', p.compDate);
  if (p.rawTimeSec != null) params.set('rawTime', String(p.rawTimeSec));
  if (p.singleRecordTag) params.set('singleRecord', p.singleRecordTag);
  params.set('official', 'wca');
  return `/recon/submit?${params.toString()}`;
}
