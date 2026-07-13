'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 「复制 → 打勾 → 复位」。全站好几处各写各的 `navigator.clipboard + setTimeout`,
 * 都漏了同一件事:组件在 1.2s 内卸载,那个 setTimeout 还会 setState(React 警告 + 泄漏)。
 */
export function useCopy(resetMs = 1200) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
    }).catch(() => { /* 剪贴板被拒(无 https / 无权限)—— 不打勾就是了 */ });
  }, [resetMs]);

  return { copied, copy };
}
