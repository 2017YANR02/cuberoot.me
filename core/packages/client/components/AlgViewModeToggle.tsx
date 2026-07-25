'use client';

/**
 * 「图 / 公式」列表视图开关 —— `/alg` 下**所有 case 列表页**共用这一份。
 *
 * 语义(从 AlgCategoryView 抽出来,原样保留):
 *   - `cards` = 只看图(密排画廊,点整卡进详情页看公式)——**默认**。列表是「认图 / 浏览」页,
 *     公式是详情页的事;顺带让首屏不挂一堆播放器 / 社区区,更轻。
 *   - `full`  = 公式内联(旧行为)。
 *
 * 偏好存 localStorage(`alg-list-view`):这是**跨页显示偏好**,不是页内可分享状态,
 * 所以不进 URL。想常看公式的人切一次,全站的 case 列表都生效。
 */
import { useCallback, useSyncExternalStore } from 'react';
import PillToggle from '@/components/PillToggle/PillToggle';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';

export type AlgViewMode = 'cards' | 'full';

/** localStorage key —— 全站唯一一处,换名字 = 丢掉所有现有用户的偏好。 */
const ALG_VIEW_MODE_KEY = 'alg-list-view';

/**
 * 模块级当前值 = 真源。落盘用 persistItem,但它在无痕模式下会返回 false ——
 * 若拿 localStorage 当真源,那种浏览器里开关点了不动。缓存还顺带让同一次
 * SPA 会话里翻页 / 换页面不必反复读盘。`null` = 还没从盘里读过。
 */
let current: AlgViewMode | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // 别的标签页改了偏好 → 丢缓存重读,本页跟着变。
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== ALG_VIEW_MODE_KEY) return;
    current = null;
    cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): AlgViewMode {
  if (current === null) {
    try {
      current = localStorage.getItem(ALG_VIEW_MODE_KEY) === 'full' ? 'full' : 'cards';
    } catch {
      current = 'cards';
    }
  }
  return current;
}

/** 服务端 / 注水那一帧一律给默认值 —— 预渲染的 HTML 里就是它。 */
function getServerSnapshot(): AlgViewMode {
  return 'cards';
}

/**
 * 读写那个 key 的 hook。返回 `[view, setView]`,setView 顺手落盘。
 *
 * 走 useSyncExternalStore 而不是「useState initializer 里同步读 localStorage」:
 * 后者在**同步就渲染出开关**的页面(如 /alg/lsll/[group],预渲染的静态页)会撞
 * 注水不一致 —— 服务端 HTML 写「图」,客户端首帧读出「公式」,React 报错并把整棵树
 * 重画。getServerSnapshot 把注水那一帧钉在默认值上,注水完再切到真实偏好。
 */
export function useAlgViewMode(): [AlgViewMode, (next: AlgViewMode) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const changeView = useCallback((next: AlgViewMode) => {
    current = next;
    persistItem(ALG_VIEW_MODE_KEY, next);
    emit();
  }, []);
  return [view, changeView];
}

export interface AlgViewModeToggleProps {
  value: AlgViewMode;
  onChange: (next: AlgViewMode) => void;
  /** 页面自己的定位 class(如 alg.css 的 `alg-view-toggle`);不传就纯裸开关。 */
  className?: string;
}

export default function AlgViewModeToggle({ value, onChange, className }: AlgViewModeToggleProps) {
  return (
    <PillToggle
      value={value === 'full'}
      onChange={(on) => onChange(on ? 'full' : 'cards')}
      onLabel={tr({ zh: '公式', en: 'Algs' })}
      offLabel={tr({ zh: '图', en: 'Images' })}
      ariaLabel={tr({ zh: '切换只看图 / 看公式', en: 'Toggle images-only / show algs' })}
      className={className}
    />
  );
}
