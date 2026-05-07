/**
 * 共享的"是否移动端宽度"hook。默认 768px 断点(>=768 = 桌面)。
 * 之前散落 N 处复制 — 见 reference_mobile_pattern memory。
 */
import { useEffect, useState } from 'react';

export function useIsMobile(maxWidth = 768): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return isMobile;
}
