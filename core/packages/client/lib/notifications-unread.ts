'use client';

/**
 * 站内通知未读计数(recon 另解 / 评论 / 回复)—— 桌宠角标 + 通知页共用。
 * 模块级单值 + useSyncExternalStore,同 feedback-unread.ts 范式。
 * 刷新点:桌宠定时/可见性轮询、通知页标记已读后(数字回落)。
 */
import { useSyncExternalStore } from 'react';
import { useAuthStore } from './auth-store';
import { fetchUnreadNotifications } from './notifications-api';

let count = 0;
const listeners = new Set<() => void>();

function set(n: number) {
  if (n === count) return;
  count = n;
  listeners.forEach((l) => l());
}

/** 拉一次最新未读数(未登录归零)。best-effort,失败保留旧值。 */
export async function refreshNotificationsUnread(): Promise<number> {
  if (!useAuthStore.getState().user) { set(0); return 0; }
  try {
    const n = await fetchUnreadNotifications();
    set(n);
    return n;
  } catch {
    return count;
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** 当前未读通知数(响应式)。 */
export function useNotificationsUnread(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}
