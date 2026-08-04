'use client';

/**
 * DailyStatsPanel —— 一天练下来是什么样,和上一次练比怎么样。
 *
 *     ◀  2026-08-04  ▶        [日 | 总]
 *     统计项        统计数据      较上次
 *     平均成绩      16.582      ▼ 0.861
 *     最佳成绩      13.229      ▲ 3.374
 *     练习次数      50          ▲ 12
 *     平均步数      55.4        ▼ 2.0
 *     平均 TPS      4.60        ▲ 0.12
 *     平均流畅      87%         ▼ 3%
 *
 * 和「时间段」那张表(今日/本周/本月/今年)的分工:那张回答「最近怎么样」,只有时间;
 * 这张回答「**那一天**怎么样」,可以往回翻,而且带上了智能魔方才有的三个手感数字。
 *
 * 两条刻意的选择:
 *
 * 1. **只列有成绩的天**。按日历往回翻会翻出一串空表 —— 而「上一次练是三天前」这件事
 *    本身就是要看的信息,让箭头直接跳到那天比翻三次空表说得更清楚。「较上次」比的
 *    也是这个「上一次练的那天」,不是昨天。
 * 2. **步数 / TPS / 流畅只算有动作流的把**。手动计时的成绩对这三个数没有发言权,进了
 *    分母只会把平均往下拽;所以它们有自己的样本数,和「练习次数」分开显示。
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';

import { averageSolveMetrics } from '../_lib/solve_metrics';
import { bestSingle, formatEventMs, meanOfAll } from '../_lib/stats';
import { dayKeyOf, solveDayKeys } from '../_lib/stats_buckets';
import type { EventId, Solve } from '../_lib/types';

interface Props {
  solves: Solve[];
  event: EventId;
}

/** 一行:值、怎么写、以及「小是好」还是「大是好」(决定箭头的颜色)。 */
interface Row {
  key: string;
  label: string;
  value: number | null;
  prev: number | null;
  format: (v: number) => string;
  formatDelta: (v: number) => string;
  lowerIsBetter: boolean;
  /** 这一行实际由几把算出来的,和「练习次数」不同时才写出来。 */
  note?: string;
}

/** 差值只写绝对值 —— 方向交给箭头,好坏交给颜色。三样各说一遍反而要读者对着想。 */
const absFixed = (digits: number) => (v: number) => Math.abs(v).toFixed(digits);

export default function DailyStatsPanel({ solves, event }: Props) {
  const [wholeDay, setWholeDay] = useState(true);
  /** 从最近那天往回数第几天。0 = 最近。存偏移不存日期 —— 又练一把之后「最近」会变,
   *  存日期会把用户钉在昨天。 */
  const [back, setBack] = useState(0);

  const days = useMemo(() => solveDayKeys(solves), [solves]);
  const dayIdx = days.length === 0 ? -1 : Math.max(0, days.length - 1 - back);
  const dayKey = dayIdx >= 0 ? days[dayIdx] : null;

  const byDay = useMemo(() => {
    const map = new Map<string, Solve[]>();
    for (const s of solves) {
      const k = dayKeyOf(s.ts);
      const list = map.get(k);
      if (list) list.push(s);
      else map.set(k, [s]);
    }
    return map;
  }, [solves]);

  const rows = useMemo<Row[]>(() => {
    // 「总」那一档要横扫全部历史算步数/TPS/流畅,所以只在真的切过去时才算。
    const cur = wholeDay ? (dayKey ? byDay.get(dayKey) ?? [] : []) : solves;
    const prev = wholeDay && dayIdx > 0 ? byDay.get(days[dayIdx - 1]) ?? [] : null;

    const stat = (list: Solve[]) => ({
      mean: meanOfAll(list),
      best: bestSingle(list, event),
      count: list.length,
      metrics: averageSolveMetrics(list),
    });
    const c = stat(cur);
    const p = prev ? stat(prev) : null;

    const ms = (v: number) => formatEventMs(event, v);
    const msDelta = (v: number) => formatEventMs(event, Math.abs(v));

    const smartNote = c.metrics.n > 0 && c.metrics.n !== c.count
      ? tr({ zh: `${c.metrics.n} 把有动作流`, en: `${c.metrics.n} with a move log` })
      : undefined;

    return [
      {
        key: 'mean', label: tr({ zh: '平均成绩', en: 'Mean' }),
        value: c.mean, prev: p?.mean ?? null,
        format: ms, formatDelta: msDelta, lowerIsBetter: true,
      },
      {
        key: 'best', label: tr({ zh: '最佳成绩', en: 'Best' }),
        value: c.best, prev: p?.best ?? null,
        format: ms, formatDelta: msDelta, lowerIsBetter: true,
      },
      {
        key: 'count', label: tr({ zh: '练习次数', en: 'Solves' }),
        value: c.count, prev: p?.count ?? null,
        format: v => String(v), formatDelta: absFixed(0), lowerIsBetter: false,
      },
      {
        key: 'stm', label: tr({ zh: '平均步数', en: 'Mean STM' }),
        value: c.metrics.stm, prev: p?.metrics.stm ?? null,
        format: v => v.toFixed(1), formatDelta: absFixed(1), lowerIsBetter: true,
        note: smartNote,
      },
      {
        key: 'tps', label: tr({ zh: '平均 TPS', en: 'Mean TPS' }),
        value: c.metrics.tps, prev: p?.metrics.tps ?? null,
        format: v => v.toFixed(2), formatDelta: absFixed(2), lowerIsBetter: false,
      },
      {
        key: 'fluency', label: tr({ zh: '平均流畅', en: 'Mean fluency' }),
        value: c.metrics.fluency, prev: p?.metrics.fluency ?? null,
        format: v => `${v.toFixed(0)}%`, formatDelta: v => `${Math.abs(v).toFixed(0)}%`, lowerIsBetter: false,
      },
    ];
  }, [wholeDay, dayKey, dayIdx, days, byDay, solves, event]);

  if (days.length === 0) return null;

  return (
    <div className="dsp">
      <div className="dsp-head">
        {wholeDay && (
          <>
            <button
              type="button"
              className="dsp-nav"
              onClick={() => setBack(b => b + 1)}
              disabled={dayIdx <= 0}
              aria-label={tr({ zh: '上一次练的那天', en: 'Previous day with solves' })}
              title={tr({ zh: '上一次练的那天', en: 'Previous day with solves' })}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="dsp-day">{dayKey}</span>
            <button
              type="button"
              className="dsp-nav"
              onClick={() => setBack(b => Math.max(0, b - 1))}
              disabled={back <= 0}
              aria-label={tr({ zh: '下一次练的那天', en: 'Next day with solves' })}
              title={tr({ zh: '下一次练的那天', en: 'Next day with solves' })}
            >
              <ChevronRight size={15} />
            </button>
          </>
        )}
        {!wholeDay && (
          <span className="dsp-day">
            {tr({ zh: `全部 ${days.length} 天`, en: `All ${days.length} days` })}
          </span>
        )}
        <PillToggle
          value={wholeDay}
          onChange={setWholeDay}
          onLabel={tr({ zh: '日', en: 'Day' })}
          offLabel={tr({ zh: '总', en: 'All' })}
          ariaLabel={tr({ zh: '按天看还是看全部', en: 'Per day or all-time' })}
        />
      </div>

      {/* 「总」那一档没有「上一次」可比,第三列整个不发 —— 留一列空的在那儿只是
          在窄屏上白占宽度。 */}
      <div className={`dsp-table${wholeDay ? '' : ' is-total'}`}>
        <div className="dsp-row dsp-row-head">
          <span>{tr({ zh: '统计项', en: 'Stat' })}</span>
          <span>{tr({ zh: '统计数据', en: 'Value' })}</span>
          {wholeDay && <span>{tr({ zh: '较上次', en: 'vs last' })}</span>}
        </div>
        {rows.map(r => {
          const has = r.value !== null && Number.isFinite(r.value);
          const diff = has && r.prev !== null && Number.isFinite(r.prev) ? r.value! - r.prev : null;
          const better = diff === null || diff === 0 ? null : (diff < 0) === r.lowerIsBetter;
          return (
            <div className="dsp-row" key={r.key}>
              <span className="dsp-lbl">
                {r.label}
                {r.note && <span className="dsp-note">{r.note}</span>}
              </span>
              <span className={`dsp-val${has ? '' : ' is-empty'}`}>{has ? r.format(r.value!) : '—'}</span>
              {wholeDay && (
                <span className="dsp-delta" data-better={better === null ? undefined : String(better)}>
                  {diff === null || diff === 0 ? '' : `${diff > 0 ? '▲' : '▼'} ${r.formatDelta(diff)}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
