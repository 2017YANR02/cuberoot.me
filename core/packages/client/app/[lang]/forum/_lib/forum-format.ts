// Forum-local formatting helpers (relative time, compact counts).
// Kept inside app/[lang]/forum/ on purpose — forum-only, not a site-wide util.

import { toIsoDate } from '@/lib/wca-date';
import type { Lang } from '@/i18n/tr';

/** "刚刚 / 5 分钟前 / 3 小时前 / 6 天前 / 2026-05-01" — XenForo-style relative stamps. */
export function formatRelativeTime(iso: string, lang: Lang): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const zh = lang === 'zh';
  if (diff < 60_000) return zh ? '刚刚' : 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return zh ? `${mins} 分钟前` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return zh ? `${days} 天前` : `${days}d ago`;
  return toIsoDate(new Date(t));
}

/** 1234 → 1.2k (en) / 1234 (zh keeps digits below 10k, 万 above). */
export function formatCount(n: number, lang: Lang): string {
  if (lang === 'zh') {
    if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}万`;
    return String(n);
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(n);
}

/** joinedAt ISO → "2026-05" (member-since granularity). */
export function formatJoinedMonth(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
