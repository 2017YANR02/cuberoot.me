// 页面通知条的图标 / 配色单一源 —— 顶部横幅(components/PageNoticeBar.tsx)与个人页的
// 全站总览(components/PageNoticesAdmin.tsx)共用,别在任一侧再抄一份。
// key 列表与 server 校验白名单(routes/page_notices.ts)保持一致。
import {
  Info, AlertTriangle, Wrench, Hammer, Bug, RefreshCw, FlaskConical, Eye,
  Sparkles, Rocket, Megaphone, Gift, Bell, Zap, Archive,
} from 'lucide-react';
import type { NoticeLevel } from './page-notices-api';

export const LEVEL_ICON: Record<NoticeLevel, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  maintenance: Wrench,
};

/** 可选图标库(存 key 到 notice.icon;'' = 按 level 回退)。 */
export const ICONS: Record<string, typeof Info> = {
  info: Info, warning: AlertTriangle, wrench: Wrench, hammer: Hammer, bug: Bug,
  refresh: RefreshCw, flask: FlaskConical, eye: Eye, sparkles: Sparkles, rocket: Rocket,
  megaphone: Megaphone, gift: Gift, bell: Bell, zap: Zap, archive: Archive,
};
export const ICON_KEYS = Object.keys(ICONS);

/** 可选横幅调色板(存 key 到 notice.color;'' = 按 level 回退)。每个 key 对应 CSS 变量
 *  --pn-c-<key>(定义在 PageNoticeBar.css 的 :root,theme-aware)。 */
export const COLOR_KEYS = ['blue', 'green', 'amber', 'red', 'terracotta', 'purple', 'cyan', 'pink'];
export const isColorKey = (c: string | undefined): c is string => !!c && COLOR_KEYS.includes(c);
export const colorVar = (key: string) => `var(--pn-c-${key})`;

/** 一条通知的级别默认色(没显式选色时横幅用的颜色)。 */
export const LEVEL_COLOR: Record<NoticeLevel, string> = {
  info: 'var(--signal-info)',
  warning: 'var(--signal-warning)',
  maintenance: 'var(--destructive)',
};

/** 渲染用图标:优先 notice 自带 icon,无效 / 未设则回退到 level 默认图标。 */
export function iconFor(n: { icon?: string; level: NoticeLevel }): typeof Info {
  return (n.icon && ICONS[n.icon]) || LEVEL_ICON[n.level];
}

/** 渲染用颜色:优先 notice 自带 color,未设 / 非法则回退到 level 默认色。 */
export function colorFor(n: { color?: string; level: NoticeLevel }): string {
  return isColorKey(n.color) ? colorVar(n.color) : LEVEL_COLOR[n.level];
}
