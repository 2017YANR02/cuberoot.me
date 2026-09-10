'use client';
// 管理员自定义遮罩行的共享缓存:/sim 里有两个消费方(播放条的下拉 + 页面的遮罩函数),
// 各自 fetch 一次是浪费,所以 module 级缓存 + 订阅,任一处保存后 reload 两边同时更新。
//
// 首屏一定是空数组(fetch 只在 effect 里发),SSG 的 hydration 输出与服务端一致 ——
// 拉到之后再重渲染,拉不到就当没有覆盖,按代码默认清单跑。
import { useEffect, useState } from 'react';
import { listSimMasks, listSimMaskLayouts, type SimMaskRow, type SimMaskLayout } from '@/lib/sim-masks-api';

let cache: SimMaskRow[] = [];
let layouts: SimMaskLayout[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** 重新拉一次并通知所有订阅者(保存 / 删除 / 重排后调)。 */
export function refreshSimMasks(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const next = await Promise.all([listSimMasks(), listSimMaskLayouts()]);
        [cache, layouts] = next;
        loaded = true;
        for (const l of listeners) l();
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export function useSimMasks(): { rows: SimMaskRow[]; layouts: SimMaskLayout[]; reload: () => Promise<void> } {
  const [rows, setRows] = useState<SimMaskRow[]>(cache);
  const [savedLayouts, setLayouts] = useState(layouts);
  useEffect(() => {
    const onChange = () => { setRows(cache); setLayouts(layouts); };
    listeners.add(onChange);
    if (loaded) onChange();
    else void refreshSimMasks().catch(() => {});
    return () => { listeners.delete(onChange); };
  }, []);
  return { rows, layouts: savedLayouts, reload: refreshSimMasks };
}
