'use client';
// 管理员自定义遮罩行的共享缓存:/sim 里有两个消费方(播放条的下拉 + 页面的遮罩函数),
// 各自 fetch 一次是浪费,所以 module 级缓存 + 订阅,任一处保存后 reload 两边同时更新。
//
// 首屏一定是空数组(fetch 只在 effect 里发),SSG 的 hydration 输出与服务端一致 ——
// 拉到之后再重渲染,拉不到就当没有覆盖,按代码默认清单跑。
import { useEffect, useState } from 'react';
import { listSimMasks, type SimMaskRow } from '@/lib/sim-masks-api';

let cache: SimMaskRow[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** 重新拉一次并通知所有订阅者(保存 / 删除 / 重排后调)。 */
export function refreshSimMasks(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        cache = await listSimMasks();
      } catch {
        // 后端没起 / 表还没迁移:当作没有覆盖,清单照代码默认渲染
      }
      loaded = true;
      inflight = null;
      for (const l of listeners) l();
    })();
  }
  return inflight;
}

export function useSimMasks(): { rows: SimMaskRow[]; reload: () => Promise<void> } {
  const [rows, setRows] = useState<SimMaskRow[]>(cache);
  useEffect(() => {
    const onChange = () => setRows(cache);
    listeners.add(onChange);
    if (loaded) setRows(cache);
    else void refreshSimMasks();
    return () => { listeners.delete(onChange); };
  }, []);
  return { rows, reload: refreshSimMasks };
}
