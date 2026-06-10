'use client';
// 选手页「最优项目组合」— 该选手在所有项目子集里名次和最低(世界排名最高)的组合.
// 选手固定(无 picker),自动加载;同时给出单次 + 平均两块.复用排名页同款渲染体 BestComboBody.
// 「应用到榜单」跳排名页 /wca/all-results 并选中该组合.数据源 /v1/wca/sum-of-ranks/player-best.

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-base';
import { BestComboBody, type PlayerBest } from '@/components/wca-stats/BestComboBody';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { tr } from '@/i18n/tr';

// 「废止项」口径受控:唯一开关在 PR 表工具栏(PersonPRTable),状态在 PersonDetailClient,本卡只跟随
export default function PersonBestCombos({ wcaId, isZh, inclCancelled }: {
  wcaId: string; isZh: boolean; inclCancelled: boolean;
}) {
  const includeCancelled = inclCancelled;
  const [pb, setPb] = useState<PlayerBest | null>(null);

  useEffect(() => {
    if (!wcaId) return;
    let done = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    // v=5: 2026-06-10 响应加 eventCounts/listedCount(剖析行),bump 甩掉浏览器 HTTP 缓存里的旧 shape
    const qs = new URLSearchParams({ wcaId, v: '5' });
    if (includeCancelled) qs.set('cancelled', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks/player-best?${qs.toString()}`), { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!done && d) setPb(d); })       // 失败 / 无数据:保留旧值(切废止项时不闪),首加载无数据则整块不渲染
      .catch(() => { /* 静默 */ })
      .finally(() => { clearTimeout(timer); });
    return () => { done = true; clearTimeout(timer); ctrl.abort(); };
  }, [wcaId, includeCancelled]);

  // 该选手不在 sor_player_best(极新选手 / 无有效成绩):整块隐藏,不破坏页面
  if (!pb) return null;

  // 免 lang 前缀(AppLink 自动补);返回真 href → 中键/Ctrl 原生新标签页
  const hrefFor = (events: string[], type: 'single' | 'average') =>
    `/wca/all-results?events=${encodeURIComponent(events.join(','))}&type=${type}`;

  return (
    <section className="wp-card wp-combos-card">
      <div className="wp-combos-head">
        <h2 className="wp-combos-title">{tr({ zh: '最优项目组合', en: 'Best event combination', zhHant: '最優項目組合' })}</h2>
      </div>
      <p className="wp-combos-sub">{tr({
        zh: '在所有项目子集里,使 TA 名次和最低(世界排名最高)的组合;缺项以该项目「参赛人数+1」计入。',
        en: 'The event subset that minimizes their sum of ranks (best world placement); missing events count as "participants+1".',
        zhHant: '在所有項目子集裡,使 TA 名次和最低(世界排名最高)的組合;缺項以該項目「參賽人數+1」計入。',
      })}</p>
      <div className="wp-combos-bodies">
        <div className="sor-pb">
          <BestComboBody wcaId={wcaId} pb={pb} type="single" includeCancelled={includeCancelled} isZh={isZh} hrefFor={evs => hrefFor(evs, 'single')} mentionOtherType={false} />
        </div>
        <div className="sor-pb">
          <BestComboBody wcaId={wcaId} pb={pb} type="average" includeCancelled={includeCancelled} isZh={isZh} hrefFor={evs => hrefFor(evs, 'average')} mentionOtherType={false} />
        </div>
        <ComboLab wcaId={wcaId} isZh={isZh} pb={pb} />
      </div>
    </section>
  );
}

const ALL_EVENTS_SET = new Set(ALL_EVENT_IDS);

// 自选组合计算器:勾任意项目子集,现查该选手在该组合下的名次和 + 世界第几.
// 数据走 /v1/wca/sum-of-ranks/person-subset(全表两遍扫 ~0.5-1.5s 冷,nginx 24h 按 URL 缓存),
// 勾选后防抖 450ms 再发;全 21 项可选(废止项折叠在选择器三角后),不依赖页面「废止项」开关.
function ComboLab({ wcaId, isZh, pb }: { wcaId: string; isZh: boolean; pb: PlayerBest }) {
  const [open, setOpen] = useState(false);
  const [isAvg, setIsAvg] = useState(false);
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [res, setRes] = useState<{ total: number | null; rank: number | null; eventsDone: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const seed = (avg: boolean) => new Set(pb.best[avg ? 'average' : 'single']?.combos?.[0] ?? []);
  useEffect(() => { setOpen(false); setRes(null); }, [wcaId]);

  useEffect(() => {
    if (!open || sel.size === 0) { setRes(null); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    // 防抖:停止勾选 450ms 后才发;按 RANK_EVENTS 顺序拼 events,同一组合 URL 唯一 → nginx 缓存命中
    const debounce = setTimeout(() => {
      const events = ALL_EVENT_IDS.filter(ev => sel.has(ev)).join(',');
      const timer = setTimeout(() => ctrl.abort(), 20000);
      fetch(apiUrl(`/v1/wca/sum-of-ranks/person-subset?wcaId=${encodeURIComponent(wcaId)}&isAvg=${isAvg ? '1' : '0'}&events=${encodeURIComponent(events)}`), { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) { setRes(d); setLoading(false); } })
        .catch(() => { /* 中断/失败:保持计算中态被下一次覆盖 */ })
        .finally(() => clearTimeout(timer));
    }, 450);
    return () => { clearTimeout(debounce); ctrl.abort(); };
  }, [open, sel, isAvg, wcaId]);

  if (!open) {
    return (
      <button type="button" className="sor-pb-expand sor-pb-lab-open" onClick={() => { setSel(seed(isAvg)); setOpen(true); }}>
        {tr({ zh: '自选组合,试试名次', en: 'Try a custom combo',
            zhHant: "自選組合,試試名次"
        })}
      </button>
    );
  }

  const missing = res && res.rank != null ? sel.size - res.eventsDone : 0;
  return (
    <div className="sor-pb">
      <div className="sor-pb-lab-head">
        <span className="sor-pb-type">{tr({ zh: '自选组合', en: 'Custom combo',
            zhHant: "自選組合"
        })}</span>
        <PillToggle
          value={isAvg}
          onChange={v => { setIsAvg(v); setSel(seed(v)); setRes(null); }}
          onLabel={tr({ zh: '平均', en: 'Average' })}
          offLabel={tr({ zh: '单次', en: 'Single',
              zhHant: "單次"
        })}
          ariaLabel={tr({ zh: '单次 / 平均', en: 'Single / Average',
              zhHant: "單次 / 平均"
        })}
        />
        <button type="button" className="sor-pb-collapse" onClick={() => setOpen(false)}>{tr({ zh: '收起', en: 'Collapse' })}</button>
      </div>
      <WcaEventSelector
        availableEvents={ALL_EVENTS_SET}
        isZh={isZh}
        selectedEvents={sel}
        onToggle={ev => setSel(prev => {
          const next = new Set(prev);
          if (next.has(ev)) next.delete(ev); else next.add(ev);
          return next;
        })}
      />
      <div className="sor-pb-lab-result">
        {sel.size === 0 ? (
          <span className="sor-pb-lab-pending">{tr({ zh: '至少选一个项目', en: 'Pick at least one event',
              zhHant: "至少選一個項目"
        })}</span>
        ) : loading || !res ? (
          <span className="sor-pb-lab-pending">{tr({ zh: '计算中…', en: 'Computing…',
              zhHant: "計算中…"
        })}</span>
        ) : res.rank == null ? (
          <span className="sor-pb-lab-pending">{tr({ zh: '该类型下无任何排名', en: 'No ranks of this type',
              zhHant: "該型別下無任何排名"
        })}</span>
        ) : (
          <>
            <span className="sor-pb-lab-rank">{isZh ? `世界第 ${res.rank.toLocaleString()}` : `World #${res.rank.toLocaleString()}`}</span>
            <span className="sor-pb-lab-total">{tr({ zh: `名次和 ${res.total!.toLocaleString()}`, en: `Sum of ranks ${res.total!.toLocaleString()}` })}</span>
            {missing > 0 && (
              <span className="sor-pb-lab-penalty">{tr({ zh: `含 ${missing} 个缺项罚分`, en: `incl. ${missing} missing-event penalt${missing > 1 ? 'ies' : 'y'}` })}</span>
            )}
          </>
        )}
      </div>
      <div className="sor-pb-note">{tr({
        zh: '名次 = 全体选手按该组合名次和重排后的位置;缺项以该项目「参赛人数+1」计入。',
        en: 'Rank = position after re-ranking everyone by this subset; missing events count as "participants+1".',
          zhHant: "名次 = 全體選手按該組合名次和重排後的位置;缺項以該項目「參賽人數+1」計入。"
    })}</div>
    </div>
  );
}
