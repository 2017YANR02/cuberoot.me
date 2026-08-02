'use client';

// 视口宽度探针。原是 useState 惰性初值直接读 matchMedia,SSG 出的页面上有个硬伤:
// 服务端没有 window → 渲染成桌面档,客户端 hydration 那一次却已经是手机档,两边对不上。
// React 对 hydration 的属性不一致只记一条 error、**不修**("This won't be patched up"),
// 之后 props 不再变化也就不会有第二次 diff —— DOM 永远停在服务端那份桌面尺寸上
// (issue #66:/alg/3x3 手机端 LSLL 缩略图外框停在 96px,里面的图是 60px,于是左对齐顶穿卡片)。
//
// 改用 useSyncExternalStore,三段快照各归其位:
//   getServerSnapshot  服务端 + hydration 那一次 → false,和 HTML 一致,不产生 mismatch;
//   getSnapshot        hydration 完成后立刻重渲一次拿真实视口,DOM 被正常 patch;
//                      hydration 之后才挂载的子树(等 fetch 的列表等)第一次渲染就是真实值,不闪。
//   subscribe          视口变化照旧实时跟。
// 判据见 tests/use_is_mobile_hydration.test.ts(直接 hydrate 一份服务端 HTML 再验 DOM)。

import { useCallback, useSyncExternalStore } from 'react';

export function useIsMobile(maxWidth = 768): boolean {
  const query = `(max-width: ${maxWidth}px)`;

  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
