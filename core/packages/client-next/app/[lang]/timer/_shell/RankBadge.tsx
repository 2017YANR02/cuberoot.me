'use client';

/**
 * RankBadge — "世界 #N" 徽章.
 *
 * 给定一个有效成绩(厘秒),问服务器「这成绩放进 WCA 历史能排第几」(按选手个人最佳
 * 去重的世界排名),渲染成 accent-soft 药丸.点一下展开一行说明.
 *
 * 契约(Phase 0 锁定,Solo / Battle 共用):
 *   <RankBadge eventId={timer EventId} centis={有效成绩厘秒 | null} type='single'|'average' isZh? className? />
 *   - centis 为 null / DNF -> 不渲染.
 *   - eventId 无 WCA 对应(relay/training/custom)-> 不渲染.
 *   - fetch 失败 / 离线 -> 不渲染.绝不抛错、绝不挡渲染.
 *   - 点开展开一行:比 ~X% 的同项目同类型成绩更快(X 由 rank/total 算).
 *   - loading -> 低调占位(不闪).
 *
 * Token-only:背景 var(--accent-soft),文字 var(--accent);顶级(世界前 100)用
 * var(--signal-success) + Trophy 图标,其它用 Globe.
 */
import { useEffect, useState } from 'react';
import { Globe, Trophy } from 'lucide-react';
import { fetchRankFor, type RankResult } from '@/lib/rank-client';
import { toWcaEventForRank, eventDisplayName } from '@/app/[lang]/timer/_shared/event-bridge';
import type { EventId } from '@/app/[lang]/timer/_lib/types';

export interface RankBadgeProps {
  /** 计时器内部 EventId */
  eventId: string;
  /** 有效成绩,单位厘秒;null 或 DNF -> 不渲染 */
  centis: number | null;
  type: 'single' | 'average';
  isZh?: boolean;
  className?: string;
}

// 顶级阈值:世界前 100 视为顶尖,换金杯 + 绿色
const TOP_TIER = 100;

export default function RankBadge({
  eventId,
  centis,
  type,
  isZh = false,
  className,
}: RankBadgeProps) {
  const wcaEvent = toWcaEventForRank(eventId as EventId);
  const valid = wcaEvent != null && centis != null && Number.isFinite(centis) && centis > 0;

  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'none'>('idle');
  const [result, setResult] = useState<RankResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!valid) {
      setState('none');
      setResult(null);
      return;
    }
    let alive = true;
    setState('loading');
    setExpanded(false);
    fetchRankFor(eventId, centis as number, type)
      .then((r) => {
        if (!alive) return;
        if (r) {
          setResult(r);
          setState('done');
        } else {
          setResult(null);
          setState('none');
        }
      })
      .catch(() => {
        if (!alive) return;
        setResult(null);
        setState('none');
      });
    return () => {
      alive = false;
    };
  }, [valid, eventId, centis, type]);

  if (!valid || state === 'none') return null;

  // loading:低调占位药丸,不闪
  if (state === 'loading' || !result) {
    return (
      <span
        className={className}
        aria-busy="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35em',
          padding: '0.2em 0.6em',
          borderRadius: '999px',
          background: 'var(--accent-soft)',
          color: 'var(--muted-foreground)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82em',
          opacity: 0.6,
        }}
      >
        <Globe size="1em" aria-hidden />
        {isZh ? '世界 #…' : 'World #…'}
      </span>
    );
  }

  const { rank, total } = result;
  const topTier = rank <= TOP_TIER;
  const rankStr = rank.toLocaleString('en-US');
  const Icon = topTier ? Trophy : Globe;
  const color = topTier ? 'var(--signal-success)' : 'var(--accent)';
  const eventName = eventDisplayName(wcaEvent, isZh);
  const typeWord = isZh
    ? type === 'average'
      ? '平均'
      : '单次'
    : type === 'average'
      ? 'average'
      : 'single';

  // 百分位:比 X% 的上榜成绩更快 = (1 - rank/total).clamp 到 [0, 99.9],>99 时保留 1 位小数.
  let pct: number | null = null;
  if (total > 0) {
    const raw = (1 - rank / total) * 100;
    pct = Math.max(0, Math.min(99.9, raw));
  }
  const pctStr = pct == null ? '' : pct > 99 ? pct.toFixed(1) : String(Math.round(pct));

  const label = isZh ? `世界 #${rankStr}` : `World #${rankStr}`;

  // 展开说明:百分位 —— 「放进 WCA 比赛历史成绩里」更快过多少人,非实时官方排名.
  const detail = pct == null
    ? isZh
      ? `历史上排在 WCA ${eventName}${typeWord}第 ${rankStr} 名(对比 WCA 比赛成绩,非实时官方排名)`
      : `Ranks #${rankStr} among all WCA ${eventName} ${typeWord}s (vs WCA competition results, not a live official rank)`
    : isZh
      ? `比 ~${pctStr}% 的 WCA ${eventName}${typeWord}更快(对比历史比赛成绩,非实时官方排名)`
      : `faster than ~${pctStr}% of WCA ${eventName} ${typeWord}s (vs historical competition results, not a live official rank)`;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25em' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title={detail}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35em',
          padding: '0.2em 0.6em',
          borderRadius: '999px',
          border: 'none',
          background: 'var(--accent-soft)',
          color,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82em',
          fontWeight: 600,
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <Icon size="1em" aria-hidden />
        {label}
      </button>
      {expanded && (
        <span
          style={{
            color: 'var(--muted-foreground)',
            fontSize: '0.72em',
            lineHeight: 1.4,
            maxWidth: '22em',
          }}
        >
          {detail}
        </span>
      )}
    </span>
  );
}
