'use client';

/**
 * 共享的「我收到的管理员回复」未读计数 —— 桌宠身上的角标 + 桌宠搜索面板反馈按钮红点共用。
 * 模块级单值 + useSyncExternalStore 订阅,避免多组件各自轮询。只对登录用户有意义。
 * 刷新点:桌宠定时/可见性轮询(抓管理员新回复)、读完对话(FeedbackConversation 标记已读后调一次,数字回落)。
 */
import { useSyncExternalStore } from 'react';
import { useAuthStore } from './auth-store';
import { fetchMyFeedbackUnread } from './feedback-api';

let count = 0;
const listeners = new Set<() => void>();

function set(n: number) {
  if (n === count) return;
  count = n;
  listeners.forEach((l) => l());
}

/** 拉一次最新未读数(未登录归零)。best-effort,失败保留旧值。 */
export async function refreshFeedbackUnread(): Promise<number> {
  if (!useAuthStore.getState().user) { set(0); return 0; }
  try {
    const n = await fetchMyFeedbackUnread();
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

/** 当前未读线程数(响应式)。 */
export function useFeedbackUnread(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}
