'use client';

import { useEffect } from 'react';
import { ensureFreshToken } from '@/lib/auth-store';

/**
 * 无 UI:启动时静默续签临近过期的 cuberoot_jwt(滑动过期)。
 * 挂在 root layout,任意页面加载都会跑一次。
 */
export default function AuthTokenRefresher() {
  useEffect(() => {
    void ensureFreshToken();
  }, []);
  return null;
}
