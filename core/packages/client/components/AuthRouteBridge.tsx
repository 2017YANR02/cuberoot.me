'use client';

/**
 * 把 App Router 的 router.push 借给 auth store。store 是普通模块、不在 React 树里,拿不到
 * router;没有这座桥,`login()` 只能整页 location.assign(能用,但丢 SPA 状态和滚动位置)。
 * 挂 app/layout.tsx 一次即可,不渲染任何东西。
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthNavigate } from '@/lib/auth-store';

export default function AuthRouteBridge() {
  const router = useRouter();
  useEffect(() => {
    setAuthNavigate((href) => router.push(href));
    return () => setAuthNavigate(null);
  }, [router]);
  return null;
}
