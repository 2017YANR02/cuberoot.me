'use client';
// Sum-of-Ranks「最优项目组合」单 type 渲染体 — 排名页(/wca/all-results 名次和)与选手页共用.
// 只渲染内容(名次行 + 组合列表 + 展开/加载更多 + 脚注 / 无成绩提示),不含外框 .sor-pb 与选手头像;
// 由调用方决定外层包裹.自带「加载更多组合」懒分页状态(player-combos 端点,offset=16).

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { apiUrl } from '@/lib/api-base';
import { tr } from '@/i18n/tr';
import './best-combos.css';

export interface ComboBest {
  rank: number; combos?: string[][]; events?: string[]; comboCount?: number;
  /** 每个项目出现在多少个并列组合里(剖析行用);旧缓存响应可能缺位 → 不渲染剖析 */
  eventCounts?: Record<string, number>;
  listedCount?: number;
}
export interface PlayerBest {
  wcaId: string; name: string; countryId: string; iso2: string | null;
  best: { single?: ComboBest; average?: ComboBest };
}

const PB_PAGE = 100;

export function BestComboBody({
  wcaId, pb, type, includeCancelled, isZh, hrefFor, mentionOtherType = true,
}: {
  wcaId: string;
  pb: PlayerBest;
  type: 'single' | 'average';
  includeCancelled: boolean;
  isZh: boolean;
  /** 组合 → 排名页内部路径(免 lang 前缀,AppLink 自动补);真 <a href> 才支持中键/Ctrl 新标签页 */
  hrefFor: (events: string[]) => string;
  /** 单 type 视图(排名页):无成绩时提示「另一 type 有组合,切换查看」;两 type 同时展示(选手页)时关掉 */
  mentionOtherType?: boolean;
}) {
  const [more, setMore] = useState<string[][]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { setMore([]); setExpanded(false); }, [wcaId, type, includeCancelled]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const offset = 16 + more.length;
    const qs = new URLSearchParams({
      wcaId, isAvg: type === 'average' ? '1' : '0',
      offset: String(offset), limit: String(PB_PAGE),
    });
    if (includeCancelled) qs.set('cancelled', '1');
    try {
      const r = await fetch(apiUrl(`/v1/wca/sum-of-ranks/player-combos?${qs.toString()}`), { cache: 'no-store' }).then(res => res.ok ? res.json() : null);
      if (r?.combos?.length) setMore(prev => [...prev, ...r.combos]);
    } catch { /* 静默 */ } finally { setLoadingMore(false); }
  };

  const b = pb.best[type];
  if (!b) {
    const other = type === 'average' ? 'single' : 'average';
    const hasOther = mentionOtherType && !!pb.best[other];
    return (
      <div className="sor-tool-hint">
        {isZh
            ? `该选手在全部 21 个项目里都没有有效${type === 'average' ? '平均' : '单次'}成绩(${type === 'average' ? '比如只打过多盲等无平均的项目,或平均全 DNF' : '单次记录缺失'})${hasOther ? `;但有${other === 'average' ? '平均' : '单次'}最优组合,切上方“类型”查看` : ''}`
            : `No valid ${type} result in any of the 21 events${hasOther ? ` — but a ${other} combo exists, switch "Type" above` : ''}`}
      </div>
    );
  }

  const typeLabel = type === 'single' ? tr({ zh: '单次', en: 'Single' }) : tr({ zh: '平均', en: 'Average' });
  const combos = b.combos ?? (b.events ? [b.events] : []);
  const comboCount = b.comboCount ?? combos.length;

  return (
    <>
      <div className="sor-pb-rank-line">
        <span className="sor-pb-type">{typeLabel}</span>
        <span className="sor-pb-rank">{isZh ? `世界第 ${b.rank}` : `World #${b.rank}`}</span>
        {comboCount > 1 && <span className="sor-pb-count">{isZh ? `${comboCount} 种组合并列` : `${comboCount} tied combos`}</span>}
      </div>
      {comboCount > 1 && b.eventCounts && (() => {
        // 组合剖析:支柱(在所有并列组合里,必选)/ 毒药(不在任何组合里,必避)/ 自由项(出现比例).
        // 只在并列 >1 时有信息量;单组合时支柱=组合本身,与上面列表重复,不渲染.
        const counts = b.eventCounts;
        const denom = b.listedCount ?? comboCount;
        const universe = ALL_EVENT_IDS.filter(ev => includeCancelled || !CANCELLED_EVENT_IDS.has(ev));
        const pillars = universe.filter(ev => (counts[ev] ?? 0) >= denom);
        const poison = universe.filter(ev => !(counts[ev] ?? 0));
        const free = universe
          .map(ev => ({ ev, n: counts[ev] ?? 0 }))
          .filter(f => f.n > 0 && f.n < denom)
          .sort((a, z) => z.n - a.n);
        if (free.length === 0 && poison.length === 0) return null;
        return (
          <div className="sor-pb-anatomy">
            {pillars.length > 0 && (
              <div className="sor-pb-anat-row">
                <span className="sor-pb-anat-label sor-pb-anat-pillar" title={tr({ zh: `支柱:出现在全部 ${denom.toLocaleString()} 个最优组合里,少了就到不了这个名次`, en: `Pillars: in all ${denom.toLocaleString()} optimal combos — required for this rank` })}>{tr({ zh: '必选', en: 'Always'
                })}</span>
                <span className="sor-pb-anat-items">{pillars.map(ev => <EventIcon key={ev} event={ev} />)}</span>
              </div>
            )}
            {free.length > 0 && (
              <div className="sor-pb-anat-row">
                <span className="sor-pb-anat-label" title={tr({ zh: '自由项:只出现在部分最优组合里,怎么搭都行;数字 = 出现比例', en: 'Flexible: in some optimal combos; number = share of combos containing it'
                })}>{tr({ zh: '随意', en: 'Optional'
                })}</span>
                <span className="sor-pb-anat-items">
                  {free.map(f => {
                    const pct = Math.min(99, Math.max(1, Math.round((f.n / denom) * 100)));
                    return (
                      <span key={f.ev} className="sor-pb-anat-free" title={tr({ zh: `${pct}% 的最优组合包含它`, en: `In ${pct}% of optimal combos` })}>
                        <EventIcon event={f.ev} />
                        <span className="sor-pb-anat-pct">{pct}%</span>
                      </span>
                    );
                  })}
                </span>
              </div>
            )}
            {poison.length > 0 && (
              <div className="sor-pb-anat-row">
                <span className="sor-pb-anat-label sor-pb-anat-poison" title={tr({ zh: '毒药:不在任何最优组合里,加进来名次只会更差', en: 'Poison: in none of the optimal combos — adding it always hurts'
                })}>{tr({ zh: '必避', en: 'Never' })}</span>
                <span className="sor-pb-anat-items sor-pb-anat-dim">{poison.map(ev => <EventIcon key={ev} event={ev} />)}</span>
              </div>
            )}
          </div>
        );
      })()}
      <ul className="sor-pb-combos">
        {combos.map((evs, i) => (
          <li key={i} className="sor-pb-combo">
            <AppLink prefetch={false} href={hrefFor(evs)} className="sor-pb-combo-link" title={tr({ zh: '在排名页查看该组合', en: 'View this combo in rankings' })}>
              <span className="sor-pb-events">{evs.map(ev => <EventIcon key={ev} event={ev} />)}</span>
            </AppLink>
          </li>
        ))}
        {expanded && more.map((evs, i) => (
          <li key={`m${i}`} className="sor-pb-combo">
            <AppLink prefetch={false} href={hrefFor(evs)} className="sor-pb-combo-link" title={tr({ zh: '在排名页查看该组合', en: 'View this combo in rankings' })}>
              <span className="sor-pb-events">{evs.map((ev, k) => <EventIcon key={`${ev}${k}`} event={ev} />)}</span>
            </AppLink>
          </li>
        ))}
      </ul>
      {comboCount > combos.length && (() => {
        const loaded = combos.length + (expanded ? more.length : 0);
        if (!expanded) {
          return (
            <button type="button" className="sor-pb-expand" onClick={() => { setExpanded(true); loadMore(); }}>
              {isZh ? `展开全部 ${comboCount.toLocaleString()} 种` : `Show all ${comboCount.toLocaleString()}`}
            </button>
          );
        }
        return (
          <div className="sor-pb-expand-row">
            {loaded < comboCount ? (
              <button type="button" className="sor-pb-expand" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? tr({ zh: '加载中…', en: 'Loading…' }) : (isZh ? `加载更多 (${loaded.toLocaleString()}/${comboCount.toLocaleString()})` : `Load more (${loaded.toLocaleString()}/${comboCount.toLocaleString()})`)}
              </button>
            ) : (
              <span className="sor-pb-note">{isZh ? `已全部展开 ${comboCount.toLocaleString()} 种` : `All ${comboCount.toLocaleString()} shown`}</span>
            )}
            <button type="button" className="sor-pb-collapse" onClick={() => { setExpanded(false); setMore([]); }}>{tr({ zh: '收起', en: 'Collapse' })}</button>
          </div>
        );
      })()}
      <div className="sor-pb-note">{isZh ? `上面每个组合都能让 TA 的名次和排到该名次(世界口径,${includeCancelled ? '含废止项' : '仅活跃项'})` : `Each combination ties them at that sum-of-ranks position (world, ${includeCancelled ? 'incl. cancelled' : 'active only'})`}</div>
    </>
  );
}
