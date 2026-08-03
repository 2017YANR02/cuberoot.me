'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 「复制 → 打勾 → 复位」。全站好几处各写各的 `navigator.clipboard + setTimeout`,
 * 都漏了同一件事:组件在 1.2s 内卸载,那个 setTimeout 还会 setState(React 警告 + 泄漏)。
 *
 * 一屏有多个复制按钮时(如 /timezone 的 9 种 Discord 样式),`copy(text, key)` 带上 key,
 * 读 `copiedKey` 就知道该给哪一个打勾 —— 否则一个布尔会让九个按钮一起打勾。
 */
export function useCopy(resetMs = 1200) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback((text: string, key = '') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedKey(null), resetMs);
    }).catch(() => { /* 剪贴板被拒(无 https / 无权限)—— 不打勾就是了 */ });
  }, [resetMs]);

  return { copied: copiedKey !== null, copiedKey, copy };
}
