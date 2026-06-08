'use client';

import { useEffect, useRef, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';

// scramble -> [N ints] = 各阶段 × 6 底色(BADGE_ORDER W Y R O B G)。
//   std = 5 阶段(cross/xc/xxc/xxxc/xxxxc)= 30;f2leo 系 = 4 阶段(无 xxxxc)= 24。
export interface CompStepsState {
  map: Map<string, number[]> | null; // null + ready: 该比赛未收录 → 调用方走实时兜底
  ready: boolean;
}

const EMPTY: CompStepsState = { map: null, ready: false };

// 变体 → 静态目录。std 用历史路径 comp_steps/;f2leo 系各自子目录。
export type CompStepsVariant =
  | 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo';
const DIR: Record<CompStepsVariant, string> = {
  std: 'comp_steps',
  eo: 'comp_steps_eo',
  pair: 'comp_steps_pair',
  pseudo: 'comp_steps_pseudo',
  pseudo_pair: 'comp_steps_pseudo_pair',
  f2leo: 'comp_steps_f2leo',
  pseudo_f2leo: 'comp_steps_pseudo_f2leo',
};

/** 规范化打乱串:trim + 多空格压成单空格,对齐 comp_steps key(去宽层产出单空格)。 */
export function normScramble(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * 取某比赛某变体的预计算步数表(`/stats/scramble/<dir>/<id>.json`)。
 * 历史比赛 → 命中 → 前端零解算秒出;未收录(全新比赛 / 该变体尚未 backfill)→ map=null,
 * 调用方退回实时 WASM(std 的 cross-step / f2leo 系的 useF2leoStepMap)。
 */
export function useCompSteps(compId: string | null, variant: CompStepsVariant = 'std'): CompStepsState {
  const [state, setState] = useState<CompStepsState>(EMPTY);
  const cache = useRef<Map<string, Map<string, number[]> | null>>(new Map());

  useEffect(() => {
    // 无 compId(生成模式 / 未加载真比赛):没有预计算数据,直接 ready 让调用方走
    // 客户端实时引擎(useCrossMap / useF2leoStepMap / useVariantStepMap 现场建表),
    // 不要永远卡在「加载预计算数据中」。
    if (!compId) { setState({ map: null, ready: true }); return; }
    const ck = `${variant}:${compId}`;
    if (cache.current.has(ck)) {
      setState({ map: cache.current.get(ck) ?? null, ready: true });
      return;
    }
    let cancelled = false;
    setState(EMPTY);
    fetch(statsUrl(`/stats/scramble/${DIR[variant]}/${encodeURIComponent(compId)}.json`))
      .then((r) => (r.ok ? r.json() : null))
      .then((obj: Record<string, number[]> | null) => {
        if (cancelled) return;
        let m: Map<string, number[]> | null = null;
        if (obj && typeof obj === 'object') {
          m = new Map<string, number[]>();
          for (const k in obj) m.set(normScramble(k), obj[k]);
        }
        cache.current.set(ck, m);
        setState({ map: m, ready: true });
      })
      .catch(() => { if (!cancelled) { cache.current.set(ck, null); setState({ map: null, ready: true }); } });
    return () => { cancelled = true; };
  }, [compId, variant]);

  return state;
}
