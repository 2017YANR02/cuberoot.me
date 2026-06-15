'use client';

// 共享比赛关注「盯一下」:登录用户的关注集合(server PG comp_follows,跨设备同步)+
// 可复用的星标按钮。首页 OngoingComps 所有比赛标签(当前/公示/报名/未来/往期)共用一份
// 关注状态:在 OngoingComps 顶层调用一次 useCompFollows(),把 { loggedIn, follows, toggle }
// 下发给各 tab 的卡片 / chip,避免每个组件各自 fetch、各自乐观态打架。
import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { fetchFollows, addFollow, removeFollow } from '@/lib/comp-follows';
import { tr } from '@/i18n/tr';
import './comp_follow.css';

export interface CompFollowState {
  loggedIn: boolean;
  follows: Set<string>;
  toggle: (id: string) => void;
  /** 首次拉取是否已完成(未登录即视为已完成)。区分「还在加载」与「关注为空」。 */
  loaded: boolean;
}

/** 登录用户的关注集合(乐观更新 + server 同步)。未登录返回空集,toggle 无副作用调用方应先门控。 */
export function useCompFollows(): CompFollowState {
  const user = useAuthStore((s) => s.user);
  const [follows, setFollows] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setFollows(new Set()); setLoaded(true); return; }
    let on = true;
    setLoaded(false);
    fetchFollows()
      .then((ids) => { if (on) setFollows(new Set(ids)); })
      .catch(() => { /* best-effort */ })
      .finally(() => { if (on) setLoaded(true); });
    return () => { on = false; };
  }, [user]);

  const toggle = useCallback((id: string) => {
    setFollows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); removeFollow(id).catch(() => {}); }
      else { next.add(id); addFollow(id).catch(() => {}); }
      return next;
    });
  }, []);

  return { loggedIn: !!user, follows, toggle, loaded };
}

/** 关注星标按钮。corner=卡片右上角浮标;chip=密集列表行内尾部小星;inline=随文流的中号星(模态标题/详情页标题)。
 *  loggedIn 默认 true(首页只在登录时渲染本组件);传 false 时星仍显示,点击走 onRequireLogin 引导登录。 */
export function FollowStar({ compId, followed, onToggle, variant = 'corner', loggedIn = true, onRequireLogin }: {
  compId: string;
  followed: boolean;
  onToggle: (id: string) => void;
  variant?: 'corner' | 'chip' | 'inline';
  loggedIn?: boolean;
  onRequireLogin?: () => void;
}) {
  const iconSize = variant === 'chip' ? 13 : variant === 'inline' ? 16 : 15;
  const title = !loggedIn
    ? tr({ zh: '登录后关注', en: 'Sign in to follow' })
    : followed
      ? tr({ zh: '取消关注', en: 'Unfollow' })
      : tr({ zh: '盯一下', en: 'Follow' });
  return (
    <button
      type="button"
      className={`follow-star follow-star--${variant}${followed ? ' is-on' : ''}`}
      aria-pressed={loggedIn ? followed : undefined}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!loggedIn) { onRequireLogin?.(); return; }
        onToggle(compId);
      }}
    >
      <Star size={iconSize} fill={followed ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}
