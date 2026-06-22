'use client';
// 选手页「最优项目组合」— 该选手在所有项目子集里名次和最低(世界排名最高)的组合.
// 选手固定(无 picker),自动加载;同时给出单次 + 平均两块.复用排名页同款渲染体 BestComboBody.
// 「应用到榜单」跳排名页 /wca/results 并选中该组合.数据源 /v1/wca/sum-of-ranks/player-best.
// 自选组合计算器在 PR 表(PersonPRTable 行多选 → Σ 块「自选」行),不在本卡.

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-base';
import { BestComboBody, type PlayerBest } from '@/components/wca-stats/BestComboBody';
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
    `/wca/results?events=${encodeURIComponent(events.join(','))}&type=${type}`;

  return (
    <section className="wp-card wp-combos-card">
      <div className="wp-combos-head">
        <h2 className="wp-combos-title">{tr({ zh: '最优项目组合', en: 'Best event combination' })}</h2>
      </div>
      <p className="wp-combos-sub">{tr({
        zh: `在所有项目子集里,使 TA 名次和最低(世界排名最高,${includeCancelled ? '含废止项' : '仅活跃项'})的组合;缺项以该项目「参赛人数+1」计入。`,
        en: `The event subset that minimizes their sum of ranks (best world placement, ${includeCancelled ? 'incl. cancelled' : 'active only'}); missing events count as "participants+1".`
      })}</p>
      <div className="wp-combos-bodies">
        <div className="sor-pb">
          <BestComboBody wcaId={wcaId} pb={pb} type="single" includeCancelled={includeCancelled} isZh={isZh} hrefFor={evs => hrefFor(evs, 'single')} mentionOtherType={false} />
        </div>
        <div className="sor-pb">
          <BestComboBody wcaId={wcaId} pb={pb} type="average" includeCancelled={includeCancelled} isZh={isZh} hrefFor={evs => hrefFor(evs, 'average')} mentionOtherType={false} />
        </div>
      </div>
    </section>
  );
}
