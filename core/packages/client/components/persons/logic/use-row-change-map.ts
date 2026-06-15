'use client';
// 拉取「成绩变更」并按行键索引成变更链,供成绩表逐行内联展示旧成绩。
// 选手页按人(rowChangeKey),comp 直播页按人+轮(personRoundChangeKey)。
// 无变更 / 端点未上线时返回空表,表格照常渲染。refresh() 供管理员编辑后即时刷新(no-store)。

import { useCallback, useEffect, useState } from 'react';
import {
  fetchResultChanges,
  fetchResultChangesByComp,
  buildRowChangeListMap,
  buildPersonRoundChangeListMap,
  type ResultChange,
} from '@/lib/result-watch-api';

const EMPTY: Map<string, ResultChange[]> = new Map();

export interface RowChangeMap {
  map: Map<string, ResultChange[]>;
  refresh: () => void;
  loading: boolean;
}

/** 选手页:按 (comp|event|轮) 索引该选手全部变更链。 */
export function useRowChangeMap(wcaId: string | null | undefined): RowChangeMap {
  const [map, setMap] = useState<Map<string, ResultChange[]>>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!wcaId) { setMap(EMPTY); return; }
    let done = false;
    const ac = new AbortController();
    setLoading(true);
    fetchResultChanges(wcaId, 300, ac.signal, tick > 0)
      .then((c) => { if (!done) setMap(buildRowChangeListMap(c)); })
      .catch(() => { /* 端点未上线 / 无数据:视同无变更 */ })
      .finally(() => { if (!done) setLoading(false); });
    return () => { done = true; ac.abort(); };
  }, [wcaId, tick]);

  return { map, refresh, loading };
}

/** comp 直播页:按 (wcaId|event|轮) 索引整场比赛变更链。 */
export function useCompRowChangeMap(compId: string | null | undefined): RowChangeMap {
  const [map, setMap] = useState<Map<string, ResultChange[]>>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!compId) { setMap(EMPTY); return; }
    let done = false;
    const ac = new AbortController();
    setLoading(true);
    fetchResultChangesByComp(compId, 500, ac.signal, tick > 0)
      .then((c) => { if (!done) setMap(buildPersonRoundChangeListMap(c)); })
      .catch(() => { /* 端点未上线 / 无数据:视同无变更 */ })
      .finally(() => { if (!done) setLoading(false); });
    return () => { done = true; ac.abort(); };
  }, [compId, tick]);

  return { map, refresh, loading };
}
