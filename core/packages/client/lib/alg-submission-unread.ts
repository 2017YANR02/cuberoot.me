'use client';

/**
 * 管理员「新公式投稿」未读计数 —— 桌宠身上的 admin 角标用。
 * 模块级单值 + useSyncExternalStore 订阅(同 feedback-unread.ts 范式),只对 admin 有意义。
 * 刷新点:桌宠定时/可见性轮询;打开下拉列表标记已读后置 0。
 */
import { useSyncExternalStore } from 'react';
import { useAuthStore, ADMIN_WCA_IDS } from './auth-store';
import { fetchAdminUnreadSubmissions } from './alg_api';

let count = 0;
const listeners = new Set<() => void>();

function set(n: number) {
  if (n === count) return;
  count = n;
  listeners.forEach((l) => l());
}

/** 立即把未读置某值(打开下拉标记已读后调,数字回落)。 */
export function setAlgSubmissionUnread(n: number): void {
  set(n);
}

/** 拉一次最新未读数(非 admin 归零)。best-effort,失败保留旧值。 */
export async function refreshAlgSubmissionUnread(): Promise<number> {
  const u = useAuthStore.getState().user;
  if (!u || !ADMIN_WCA_IDS.includes(u.wcaId)) { set(0); return 0; }
  try {
    const n = await fetchAdminUnreadSubmissions();
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

/** 当前未读投稿数(响应式)。 */
export function useAlgSubmissionUnread(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}
