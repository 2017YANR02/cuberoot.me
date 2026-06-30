'use client';

// CompCard + 每个项目图标下的轮次数。
//
// 轮次来源分两路:
//  1) roundsSeed —— 静态 JSON 已带的轮次(all_past_comps / all_upcoming_comps 的 rounds 字段,
//     覆盖 ~90% 比赛)。用 wcaRoundsSeed() 把前端短码('3')转成 WCA id('333')后传入,即时显示。
//  2) fetchIfMissing —— 无静态轮次时才走 WCIF public 懒拉(24h localStorage 缓存 + inflight 去重)。
//     仅「公示」tab 用(数据源只给 event_ids、且 48h 窗口比赛少);报名 / 卡片视图 / 当日弹窗
//     比赛基数大(几百场),禁开此项,否则批量打 WCA WCIF 会被 429 限流。无种子又不拉时,
//     eventRounds 传 null → CompCard 退化为纯项目图标(不显示数字、也不显示「·」占位)。
import { useEffect, useState, type ComponentProps } from 'react';
import { CompCard } from '@/components/CompCard';
import { fetchCompRounds } from '@/lib/comp-wcif';
import { toWcaEventId } from '@/lib/wca-events';

/** Competition.rounds 用前端短码('3'),CompCard.eventRounds 要 WCA id('333');转 key。空 → undefined。 */
export function wcaRoundsSeed(rounds?: Record<string, number> | null): Record<string, number> | undefined {
  if (!rounds || Object.keys(rounds).length === 0) return undefined;
  const out: Record<string, number> = {};
  for (const [shortEid, n] of Object.entries(rounds)) out[toWcaEventId(shortEid)] = n;
  return out;
}

type CompCardProps = ComponentProps<typeof CompCard>;

export function CompCardWithRounds({
  roundsSeed,
  fetchIfMissing = false,
  ...props
}: Omit<CompCardProps, 'eventRounds'> & {
  roundsSeed?: Record<string, number> | null;
  /** 无静态轮次时是否懒拉 WCIF。仅小数据集(公示)开;大列表禁开避免 429。 */
  fetchIfMissing?: boolean;
}) {
  const compId = props.comp.id;
  const hasSeed = !!roundsSeed && Object.keys(roundsSeed).length > 0;
  // 有种子 → 即时数字;无种子但要拉 → {} 先占位「·」;无种子又不拉 → null 纯图标。
  const [rounds, setRounds] = useState<Record<string, number> | null>(
    () => roundsSeed ?? (fetchIfMissing ? {} : null),
  );

  useEffect(() => {
    if (hasSeed || !fetchIfMissing) return;
    let cancelled = false;
    fetchCompRounds(compId)
      .then((wcifRounds) => {
        if (cancelled) return;
        const mapped: Record<string, number> = {};
        for (const [eid, formats] of Object.entries(wcifRounds)) mapped[toWcaEventId(eid)] = formats.length;
        if (Object.keys(mapped).length > 0) setRounds(mapped);
      })
      .catch(() => { /* WCIF 缺失 → 保留占位,降级为纯图标体验 */ });
    return () => { cancelled = true; };
  }, [compId, hasSeed, fetchIfMissing]);

  return <CompCard {...props} eventRounds={rounds} />;
}
