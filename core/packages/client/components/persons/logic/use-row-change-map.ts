'use client';
// 拉取该选手的「往期成绩变更」并按行键索引,供全部成绩表逐行内联展示旧成绩。
// 数据源同 PersonResultChanges 面板(/v1/wca/result-watch/changes),无变更 / 端点未上线时返回空表,表格照常渲染。

import { useEffect, useState } from 'react';
import { fetchResultChanges, buildRowChangeMap, type ResultChange } from '@/lib/result-watch-api';

const EMPTY: Map<string, ResultChange> = new Map();

export function useRowChangeMap(wcaId: string | null | undefined): Map<string, ResultChange> {
  const [map, setMap] = useState<Map<string, ResultChange>>(EMPTY);
  useEffect(() => {
    if (!wcaId) { setMap(EMPTY); return; }
    let done = false;
    const ac = new AbortController();
    fetchResultChanges(wcaId, 200, ac.signal)
      .then((c) => { if (!done) setMap(buildRowChangeMap(c)); })
      .catch(() => { /* 端点未上线 / 无数据:视同无变更 */ });
    return () => { done = true; ac.abort(); };
  }, [wcaId]);
  return map;
}
