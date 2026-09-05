'use client';

/**
 * 停表排名：PR 比较当前分组单次，NR/CR/WR 比较 WCA 历史个人最佳。
 * 只显示用户选择且有数据的范围；离线时 PR 仍可用，缺国家时不查 NR/CR。
 * 输入为时间厘秒，FMC/多盲不能按计时时长排名。
 */
import { useEffect, useMemo, useState } from 'react';
import { effectiveMs, TIMER_RANK_SCOPES, type Solve, type TimerRankScope } from '@cuberoot/shared/timer';
import { tr } from '@/i18n/tr';
import { fetchRankFor, type RankResult, type RegionRank } from '@/lib/rank-client';
import { toWcaEventForRank, eventDisplayName } from '@/app/[lang]/timer/_shared/event-bridge';
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import { ISO2_TO_CONTINENT, CONTINENT_RECORD_ABBR } from '@/lib/continent';
import { RecordBadge } from '@/components/RecordBadge';

export interface RankBadgeProps {
  /** 计时器内部 EventId */
  eventId: string;
  /** 有效成绩,单位厘秒;null 或 DNF -> 不渲染 */
  centis: number | null;
  type: 'single' | 'average';
  /** 用户国家 iso2(如 'US' / 'CN');传了才查 NR/CR */
  country?: string;
  isZh?: boolean;
  className?: string;
  scopes?: readonly TimerRankScope[];
  solves?: readonly Solve[];
}

const NO_SOLVES: readonly Solve[] = [];

export default function RankBadge({
  eventId,
  centis,
  type,
  country,
  isZh = false,
  className,
  scopes = TIMER_RANK_SCOPES,
  solves = NO_SOLVES,
}: RankBadgeProps) {
  const wcaEvent = toWcaEventForRank(eventId as EventId);
  const valid = eventId !== '333fm' && eventId !== '333mbld'
    && centis != null && Number.isFinite(centis) && centis > 0;
  const queryCountry = scopes.includes('NR') || scopes.includes('CR') ? country : undefined;
  const queryWca = valid && wcaEvent != null && (scopes.includes('WR') || !!queryCountry);
  const personal = useMemo(() => {
    if (!valid || type !== 'single' || !scopes.includes('PR')) return null;
    const times = solves.filter((solve) => solve.event === eventId).map(effectiveMs)
      .filter((ms) => Number.isFinite(ms) && ms > 0);
    return times.length ? { rank: 1 + times.filter((ms) => Math.round(ms / 10) < centis!).length, total: times.length } : null;
  }, [valid, type, scopes, solves, eventId, centis]);

  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'none'>('idle');
  const [result, setResult] = useState<RankResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!queryWca) {
      setState('none');
      setResult(null);
      return;
    }
    let alive = true;
    setState('loading');
    setExpanded(false);
    fetchRankFor(eventId, centis as number, type, queryCountry || undefined)
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
  }, [queryWca, eventId, centis, type, queryCountry]);

  if (!valid || scopes.length === 0) return null;

  const eventName = wcaEvent ? eventDisplayName(wcaEvent, isZh) : eventId;
  const typeWord = type === 'average' ? tr({ zh: '平均', en: 'average' }) : tr({ zh: '单次', en: 'single' });
  const scopeNames = {
    PR: tr({ zh: '当前分组个人', en: 'Personal, current session' }),
    NR: tr({ zh: '全国', en: 'National' }),
    CR: tr({ zh: '大洲', en: 'Continent' }),
    WR: tr({ zh: '世界', en: 'World' }),
  };

  // CR 按登录用户的国家映射到大洲记录缩写(AsR / ER / NAR / OcR / SAR / AfR);
  // 无国家或映射缺失时退回通用 'CR'.
  const crLabel = (() => {
    const cc = country ? ISO2_TO_CONTINENT[country.toUpperCase()] : undefined;
    return (cc && CONTINENT_RECORD_ABBR[cc]) || 'CR';
  })();

  // label 同时作为「名次前缀」和「纪录代码」:WR / AsR / NR(RecordBadge 认这些).
  const pills: { scope: TimerRankScope; label: string; data: RegionRank }[] = [];
  if (queryWca && state === 'done' && result) {
    if (scopes.includes('WR') && result.world) pills.push({ scope: 'WR', label: 'WR', data: result.world });
    if (scopes.includes('CR') && result.continental) pills.push({ scope: 'CR', label: crLabel, data: result.continental });
    if (scopes.includes('NR') && result.national) pills.push({ scope: 'NR', label: 'NR', data: result.national });
  }
  if (personal) pills.push({ scope: 'PR', label: 'PR', data: personal });
  if (pills.length === 0) return null;

  // 展开说明:把各档名次摊开 + 免责声明(对比历史比赛成绩,非实时官方排名).
  const parts = pills.map(({ scope, data }) => {
    const n = data.rank.toLocaleString('en-US');
    return `${scopeNames[scope]} #${n}`;
  });
  const detail = parts.join(' / ') + (pills.some((pill) => pill.scope !== 'PR') ? tr({
    zh: `（WCA ${eventName}${typeWord}，对比历史比赛成绩，非实时官方排名）`,
    en: ` (WCA ${eventName} ${typeWord}, vs historical competition results, not a live official rank)`,
  }) : '');

  return (
    <span className={`rank-badge-row${className ? ` ${className}` : ''}`}>
      <span className="rank-pills">
        <button
          type="button"
          className="rank-pill"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title={detail}
        >
          {/* 单 chip:WR12/AsR9/NR9;名次为 1 即该档纪录,改用 RecordBadge(WR/AsR/NR) */}
          <span className="rank-chip-inner">
            {pills.map(({ scope, label, data }, i) => (
              <span key={scope}>
                {i > 0 && <span className="rank-chip-sep">/</span>}
                {data.rank === 1
                  ? <RecordBadge record={label} variant="standalone" />
                  : `${label}${data.rank.toLocaleString('en-US')}`}
              </span>
            ))}
          </span>
        </button>
      </span>
      {expanded && <span className="rank-detail">{detail}</span>}
    </span>
  );
}
