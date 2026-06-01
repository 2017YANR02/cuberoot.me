'use client';

/**
 * RankBadge — "WR / CR / NR" 排名徽章.
 *
 * 给定一个有效成绩(厘秒),问服务器「这成绩放进 WCA 历史能排第几」(按选手个人最佳
 * 去重的排名),渲染成一排 accent-soft 药丸:WR(世界)始终显示,传了用户国家时再加
 * CR(大洲)/ NR(国家).点任意药丸展开一行说明.
 *
 * 契约(Solo / Battle 共用):
 *   <RankBadge eventId={EventId} centis={有效成绩厘秒 | null} type='single'|'average'
 *              country?='US' isZh? className? />
 *   - centis 为 null / DNF -> 不渲染.
 *   - eventId 无 WCA 对应(relay/training/custom)-> 不渲染.
 *   - fetch 失败 / 离线 -> 不渲染.绝不抛错、绝不挡渲染.
 *   - country 缺省 / 服务端未部署 NR/CR -> 只显 WR.
 *
 * Token-only:背景 var(--accent-soft);顶尖名次用 var(--signal-success) + Trophy,
 * 其它用 var(--accent) + 地域图标.
 */
import { useEffect, useState } from 'react';
import { Globe, Map as MapIcon, MapPin, Trophy } from 'lucide-react';
import { fetchRankFor, type RankResult, type RegionRank } from '@/lib/rank-client';
import { toWcaEventForRank, eventDisplayName } from '@/app/[lang]/timer/_shared/event-bridge';
import type { EventId } from '@/app/[lang]/timer/_lib/types';

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
}

type Scope = 'WR' | 'CR' | 'NR';
// 顶尖阈值(各档不同):到这个名次内换金杯 + 绿色
const TOP_TIER: Record<Scope, number> = { WR: 100, CR: 20, NR: 3 };

export default function RankBadge({
  eventId,
  centis,
  type,
  country,
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
    fetchRankFor(eventId, centis as number, type, country || undefined)
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
  }, [valid, eventId, centis, type, country]);

  if (!valid || state === 'none') return null;

  // loading:低调占位药丸,不闪
  if (state === 'loading' || !result) {
    return (
      <span className={`rank-badge-row${className ? ` ${className}` : ''}`} aria-busy="true">
        <span className="rank-pill rank-pill--loading">
          <Globe size="1em" aria-hidden />
          {isZh ? 'WR …' : 'WR …'}
        </span>
      </span>
    );
  }

  const eventName = eventDisplayName(wcaEvent, isZh);
  const typeWord = isZh
    ? type === 'average' ? '平均' : '单次'
    : type === 'average' ? 'average' : 'single';

  const ICON: Record<Scope, typeof Globe> = { WR: Globe, CR: MapIcon, NR: MapPin };
  const SCOPE_ZH: Record<Scope, string> = { WR: '世界', CR: '大洲', NR: '全国' };
  const SCOPE_EN: Record<Scope, string> = { WR: 'World', CR: 'Continent', NR: 'National' };

  const pills: { scope: Scope; data: RegionRank }[] = [{ scope: 'WR', data: result.world }];
  if (result.continental) pills.push({ scope: 'CR', data: result.continental });
  if (result.national) pills.push({ scope: 'NR', data: result.national });

  // 展开说明:把各档名次摊开 + 免责声明(对比历史比赛成绩,非实时官方排名).
  const parts = pills.map(({ scope, data }) => {
    const n = data.rank.toLocaleString('en-US');
    return isZh ? `${SCOPE_ZH[scope]} #${n}` : `${SCOPE_EN[scope]} #${n}`;
  });
  const detail = isZh
    ? `${parts.join(' · ')}（WCA ${eventName}${typeWord},对比历史比赛成绩,非实时官方排名）`
    : `${parts.join(' · ')} (WCA ${eventName} ${typeWord}, vs historical competition results — not a live official rank)`;

  return (
    <span className={`rank-badge-row${className ? ` ${className}` : ''}`}>
      <span className="rank-pills">
        {pills.map(({ scope, data }) => {
          const top = data.rank <= TOP_TIER[scope];
          const Icon = top ? Trophy : ICON[scope];
          return (
            <button
              key={scope}
              type="button"
              className={`rank-pill${top ? ' rank-pill--top' : ''}`}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              title={detail}
            >
              <Icon size="1em" aria-hidden />
              {scope}
              {data.rank.toLocaleString('en-US')}
            </button>
          );
        })}
      </span>
      {expanded && <span className="rank-detail">{detail}</span>}
    </span>
  );
}
