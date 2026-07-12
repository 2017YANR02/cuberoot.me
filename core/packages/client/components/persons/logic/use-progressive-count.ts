'use client';
// 渐进渲染计数:先渲染 initial 行,之后每个 idle tick 追加 chunk 行,直到 total 全部就位。
// 用途:选手页顶级选手一张表可有 500+ 行、每行是较重的 React 子树(逐把成绩按钮 + 名次角标 + 变更链等),
// 一次性挂载 = 单个 100~350ms 长任务 → 打开页面「鼠标一顿一顿」。摊成若干 idle 小块后,首帧只挂
// initial 行,其余趁空闲补齐;最终仍渲染全部行 → 深链锚点 (#r-…) / Ctrl+F / 排序均不受影响,只是稍后到位。
//
// resetKey 变化(切项目 / 改排序 → displayRows 重排)时重置回 initial 重新渐进。
// ensureIndex(i):把某行(如深链目标)立即纳入渲染范围,不必等 idle 逐块追上。

import { useState, useEffect, useCallback } from 'react';

type IdleHandle = number;
const scheduleIdle: (cb: () => void) => IdleHandle =
  typeof requestIdleCallback !== 'undefined'
    ? (cb) => requestIdleCallback(cb, { timeout: 200 }) as unknown as IdleHandle
    : (cb) => setTimeout(cb, 32) as unknown as IdleHandle;
const cancelIdle: (h: IdleHandle) => void =
  typeof cancelIdleCallback !== 'undefined'
    ? (h) => cancelIdleCallback(h as unknown as number)
    : (h) => clearTimeout(h);

export function useProgressiveCount(
  total: number,
  resetKey: unknown,
  initial = 60,
  chunk = 120,
): { count: number; ensureIndex: (i: number) => void } {
  const [count, setCount] = useState(() => Math.min(initial, total));

  // 切项目 / 改排序 / 数据行数变化 → 回到 initial 重新渐进。
  useEffect(() => {
    setCount(Math.min(initial, total));
  }, [resetKey, total, initial]);

  // 每个 idle tick 追加一块,直到全部就位。
  useEffect(() => {
    if (count >= total) return;
    const h = scheduleIdle(() => setCount((c) => Math.min(total, c + chunk)));
    return () => cancelIdle(h);
  }, [count, total, chunk]);

  const ensureIndex = useCallback((i: number) => {
    setCount((c) => Math.max(c, Math.min(total, i + 1)));
  }, [total]);

  return { count, ensureIndex };
}
