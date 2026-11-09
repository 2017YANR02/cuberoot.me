// Forum formatting shared by the forum route family and landing-page feed preview.

import { toIsoDate } from '@/lib/wca-date';
import type { Lang } from '@/i18n/tr';

/** Relative elapsed time; long durations use approximate 30-day months and 365-day years. */
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
  if (days < 365) {
    const months = Math.floor(days / 30);
    return zh ? `${months} 个月前` : `${months}mo ago`;
  }
  const years = Math.floor(days / 365);
  return zh ? `${years} 年前` : `${years}y ago`;
}

/** Recent posts use elapsed time; older posts show a local calendar date. */
export function formatPostTime(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  if (Date.now() - date.getTime() < 7 * 86_400_000) return formatRelativeTime(iso, lang);
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date(Date.now()).getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(date);
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

/** joinedAt ISO → local calendar date, e.g. "2026-05-01". */
export function formatJoinedDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return toIsoDate(d);
}
