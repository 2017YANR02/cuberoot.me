'use client';
// Sum-of-Ranks「最优项目组合」单 type 渲染体 — 排名页(/wca/all-results 名次和)与选手页共用.
// 只渲染内容(名次行 + 组合列表 + 展开/加载更多 + 脚注 / 无成绩提示),不含外框 .sor-pb 与选手头像;
// 由调用方决定外层包裹.自带「加载更多组合」懒分页状态(player-combos 端点,offset=16).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon';
import { apiUrl } from '@/lib/api-base';
import { tr } from '@/i18n/tr';
import './best-combos.css';

export interface ComboBest { rank: number; combos?: string[][]; events?: string[]; comboCount?: number; }
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
  const { i18n } = useTranslation();
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
    const typeZh = type === 'average' ? '平均' : '单次';
    const other = type === 'average' ? 'single' : 'average';
    const hasOther = mentionOtherType && !!pb.best[other];
    return (
      <div className="sor-tool-hint">
        {i18n.language === 'zh-Hant'
          ? `該選手在全部 21 個項目裡都沒有有效${type === 'average' ? '平均' : '單次'}成績(${type === 'average' ? '比如只打過多盲等無平均的項目,或平均全 DNF' : '單次記錄缺失'})${hasOther ? `;但有${other === 'average' ? '平均' : '單次'}最優組合,切上方“型別”檢視` : ''}`
          : isZh
            ? `该选手在全部 21 个项目里都没有有效${typeZh}成绩(${type === 'average' ? '比如只打过多盲等无平均的项目,或平均全 DNF' : '单次记录缺失'})${hasOther ? `;但有${other === 'average' ? '平均' : '单次'}最优组合,切上方“类型”查看` : ''}`
            : `No valid ${type} result in any of the 21 events${hasOther ? ` — but a ${other} combo exists, switch "Type" above` : ''}`}
      </div>
    );
  }

  const typeLabel = type === 'single' ? tr({ zh: '单次', en: 'Single', zhHant: '單次' }) : tr({ zh: '平均', en: 'Average' });
  const combos = b.combos ?? (b.events ? [b.events] : []);
  const comboCount = b.comboCount ?? combos.length;

  return (
    <>
      <div className="sor-pb-rank-line">
        <span className="sor-pb-type">{typeLabel}</span>
        <span className="sor-pb-rank">{isZh ? `世界第 ${b.rank}` : `World #${b.rank}`}</span>
        {comboCount > 1 && <span className="sor-pb-count">{i18n.language === 'zh-Hant' ? `${comboCount} 種組合並列` : isZh ? `${comboCount} 种组合并列` : `${comboCount} tied combos`}</span>}
      </div>
      <ul className="sor-pb-combos">
        {combos.map((evs, i) => (
          <li key={i} className="sor-pb-combo">
            <AppLink prefetch={false} href={hrefFor(evs)} className="sor-pb-combo-link" title={tr({ zh: '在排名页查看该组合', en: 'View this combo in rankings', zhHant: '在排名頁檢視該組合' })}>
              <span className="sor-pb-events">{evs.map(ev => <EventIcon key={ev} event={ev} />)}</span>
            </AppLink>
          </li>
        ))}
        {expanded && more.map((evs, i) => (
          <li key={`m${i}`} className="sor-pb-combo">
            <AppLink prefetch={false} href={hrefFor(evs)} className="sor-pb-combo-link" title={tr({ zh: '在排名页查看该组合', en: 'View this combo in rankings', zhHant: '在排名頁檢視該組合' })}>
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
              {i18n.language === 'zh-Hant' ? `展開全部 ${comboCount.toLocaleString()} 種` : isZh ? `展开全部 ${comboCount.toLocaleString()} 种` : `Show all ${comboCount.toLocaleString()}`}
            </button>
          );
        }
        return (
          <div className="sor-pb-expand-row">
            {loaded < comboCount ? (
              <button type="button" className="sor-pb-expand" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? tr({ zh: '加载中…', en: 'Loading…', zhHant: '載入中…' }) : (i18n.language === 'zh-Hant' ? `載入更多 (${loaded.toLocaleString()}/${comboCount.toLocaleString()})` : isZh ? `加载更多 (${loaded.toLocaleString()}/${comboCount.toLocaleString()})` : `Load more (${loaded.toLocaleString()}/${comboCount.toLocaleString()})`)}
              </button>
            ) : (
              <span className="sor-pb-note">{i18n.language === 'zh-Hant' ? `已全部展開 ${comboCount.toLocaleString()} 種` : isZh ? `已全部展开 ${comboCount.toLocaleString()} 种` : `All ${comboCount.toLocaleString()} shown`}</span>
            )}
            <button type="button" className="sor-pb-collapse" onClick={() => { setExpanded(false); setMore([]); }}>{tr({ zh: '收起', en: 'Collapse', zhHant: '收起' })}</button>
          </div>
        );
      })()}
      <div className="sor-pb-note">{i18n.language === 'zh-Hant' ? `上面每個組合都能讓 TA 的名次和排到該名次(世界口徑,${includeCancelled ? '含廢止項' : '僅活躍項'})` : isZh ? `上面每个组合都能让 TA 的名次和排到该名次(世界口径,${includeCancelled ? '含废止项' : '仅活跃项'})` : `Each combination ties them at that sum-of-ranks position (world, ${includeCancelled ? 'incl. cancelled' : 'active only'})`}</div>
    </>
  );
}
