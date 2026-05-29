'use client';

import { useEffect, useRef, useState } from 'react';

// scramble -> [30 ints] = cross/xc/xxc/xxxc/xxxxc 五阶段 × 6 底色(BADGE_ORDER W Y R O B G)。
export interface CompStepsState {
  map: Map<string, number[]> | null; // null + ready: 该比赛未收录 → 调用方走实时兜底
  ready: boolean;
}

const EMPTY: CompStepsState = { map: null, ready: false };

/** 规范化打乱串:trim + 多空格压成单空格,对齐 comp_steps key(去宽层产出单空格)。 */
export function normScramble(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * 取某比赛的预计算十字步数表(`/stats/scramble/comp_steps/<id>.json`)。
 * 历史比赛 → 命中 → 前端零解算秒出;未收录(全新比赛)→ map=null,调用方退回实时 WASM。
 */
export function useCompSteps(compId: string | null): CompStepsState {
  const [state, setState] = useState<CompStepsState>(EMPTY);
  const cache = useRef<Map<string, Map<string, number[]> | null>>(new Map());

  useEffect(() => {
    if (!compId) { setState(EMPTY); return; }
    if (cache.current.has(compId)) {
      setState({ map: cache.current.get(compId) ?? null, ready: true });
      return;
    }
    let cancelled = false;
    setState(EMPTY);
    fetch(`/stats/scramble/comp_steps/${encodeURIComponent(compId)}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((obj: Record<string, number[]> | null) => {
        if (cancelled) return;
        let m: Map<string, number[]> | null = null;
        if (obj && typeof obj === 'object') {
          m = new Map<string, number[]>();
          for (const k in obj) m.set(normScramble(k), obj[k]);
        }
        cache.current.set(compId, m);
        setState({ map: m, ready: true });
      })
      .catch(() => { if (!cancelled) { cache.current.set(compId, null); setState({ map: null, ready: true }); } });
    return () => { cancelled = true; };
  }, [compId]);

  return state;
}
