'use client';

// Per-event scramble move-length distribution. Reads the histogram-per-event
// JSON produced by stats-build/bin/build_scramble_lengths.ts. Many events are
// fixed-length (4x4–7x7 / megaminx / clock) so their chart is a single bar;
// the spread lives in 333-family / 222 / pyram / skewb / sq1.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import PillToggle from '@/components/PillToggle/PillToggle';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { statsUrl } from '@/lib/stats-base';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { tr } from '@/i18n/tr';

interface GluedScramble { ci: string; cn: string; r: string; g: string; n: number; tok: string }
interface ScrambleAnomaly { ci: string; cn: string; lens: number[]; n: number }
interface EventLen {
  unit: 'moves' | 'twists';
  samples: number;
  counts: Record<string, number>;
  counts_qtm?: Record<string, number>; // 3x3-family:QTM 计步直方图(HTM/QTM 可切)
  glued?: GluedScramble[]; // megaminx scrambles with a missing-space move (e.g. R--D--)
  anomalies?: ScrambleAnomaly[]; // fixed-length events: comps whose scrambles deviate (non-standard scrambler)
}
export interface EventLengthsJson {
  meta: { generated_at: string; total_scrambles: number; total_samples: number };
  events: Record<string, EventLen>;
}

// 组平均长度分布(build_scramble_lengths.ts 追加产出):每项目 ne(不含备打)/ we(含备打),
// 各带 counts(HTM / 长度)与可选 counts_qtm。键 = round(组平均 × avg_denom);显示时 ÷ avg_denom。
export interface EventLenAvgSide { counts: Record<string, number>; counts_qtm?: Record<string, number>; }
export interface EventLengthsAvgJson {
  meta: { generated_at: string; avg_denom: number };
  events: Record<string, { unit: 'moves' | 'twists'; groups: number; ne: EventLenAvgSide; we: EventLenAvgSide }>;
}

type LenExample = [string, string, string, number, string, (0 | 1)?]; // [compId, round, group, num, text, isExtra?]
interface ExamplesJson {
  meta: { generated_at: string; per_bin: number };
  comps: Record<string, [string, string]>;
  events: Record<string, Record<string, LenExample[]>>;
  events_qtm?: Record<string, Record<string, LenExample[]>>; // 3x3-family:QTM 长度分桶
}

const BAR = '#8B7D72'; // neutral warm — no color dimension here
// Events whose example scramble is a plain 3x3 state the cross analyzer accepts.
const ANALYZER_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf', '333mbo']);

// Events that share the exact same TNoodle scrambler, so their length
// distributions are statistically identical — offered merged by default to
// declutter the selector. 333ft is deliberately NOT in the speed group: same
// generator, but retired in 2019 so its sample sits on older TNoodle versions
// and skews ~1 move longer (see the per-event note below).
interface MergeGroup {
  rep: string;        // representative id shown in the selector
  members: string[];  // events summed when merged (rep first)
  zh: string; en: string;
  subZh: string; subEn: string;
}
export const MERGE_GROUPS: MergeGroup[] = [
  { rep: '333', members: ['333', '333oh'], zh: '三阶速拧', en: '3×3 (speed)', subZh: '含单手', subEn: 'incl. OH'
},
  { rep: '333bf', members: ['333bf', '333mbf'], zh: '三阶盲拧', en: '3×3 (blind)', subZh: '含多盲', subEn: 'incl. MBLD'
},
];
const groupForRep = (id: string) => MERGE_GROUPS.find((g) => g.rep === id);
// Non-representative members hidden from the selector while merged.
export const MERGED_HIDDEN = new Set(MERGE_GROUPS.flatMap((g) => g.members.filter((m) => m !== g.rep)));

// Resolve the displayed distribution for an event: when merging, sum the merge
// group's member counts; otherwise the raw event. Shared by the view (chart) and
// the parent page (to decide whether the HTM/QTM • WCA/slash toggle applies).
export function resolveEventLen(data: EventLengthsJson | null, event: string, merged: boolean): EventLen | null {
  if (!data) return null;
  const group = merged ? groupForRep(event) : undefined;
  if (group) {
    const counts: Record<string, number> = {};
    const countsQtm: Record<string, number> = {};
    let samples = 0;
    for (const m of group.members) {
      const ev = data.events[m];
      if (!ev) continue;
      for (const [k, v] of Object.entries(ev.counts)) { counts[k] = (counts[k] ?? 0) + v; samples += v; }
      if (ev.counts_qtm) for (const [k, v] of Object.entries(ev.counts_qtm)) countsQtm[k] = (countsQtm[k] ?? 0) + v;
    }
    return { unit: 'moves', samples, counts, ...(Object.keys(countsQtm).length ? { counts_qtm: countsQtm } : {}) };
  }
  return data.events[event] ?? null;
}

// 组平均:合并态跨成员项目 sum 各自的组平均直方图;选备打 → we,否则 ne;metric qtm → counts_qtm。
export function resolveEventLenAvg(
  data: EventLengthsAvgJson | null, event: string, merged: boolean, extras: boolean, metric: 'htm' | 'qtm',
): { counts: Record<string, number>; groups: number; unit: string } | null {
  if (!data) return null;
  const members = merged ? (groupForRep(event)?.members ?? [event]) : [event];
  const counts: Record<string, number> = {};
  let groups = 0, unit = 'moves', any = false;
  for (const m of members) {
    const ev = data.events[m];
    if (!ev) continue;
    any = true; unit = ev.unit; groups += ev.groups;
    const side = extras ? ev.we : ev.ne;
    const src = metric === 'qtm' && side.counts_qtm ? side.counts_qtm : side.counts;
    for (const [k, v] of Object.entries(src)) counts[k] = (counts[k] ?? 0) + v;
  }
  return any ? { counts, groups, unit } : null;
}

// Second move-metric toggle metadata (shown when an event carries counts_qtm):
// sq1 → WCA 12c4 / slash; 3x3-family → HTM / QTM. Labels/hints shared with the
// difficulty tab's SQ1 toggle.
export function lengthAltMeta(event: string) {
  return event === 'sq1'
    ? {
      off: 'WCA', on: 'slash',
      aria: tr({ zh: '度量:WCA 12c4 或 slash', en: 'Metric: WCA 12c4 or slash'
    }),
      offHint: tr({ zh: 'WCA 12c4:(X,Y) 计 1、/ 计 1', en: 'WCA 12c4: (X,Y) = 1, / = 1'
    }),
      onHint: tr({ zh: 'slash:只计 /(jaapsch)', en: 'slash: count / only (jaapsch)'
    }),
    }
    : {
      off: 'HTM', on: 'QTM',
      aria: tr({ zh: '度量:HTM(半圈计 1)或 QTM(半圈计 2)', en: 'Move metric: HTM (half turn = 1) or QTM (half turn = 2)'
    }),
      offHint: tr({ zh: 'HTM:每 move 计 1 步', en: 'HTM: each move = 1'
    }),
      onHint: tr({ zh: 'QTM:180° 计 2 步', en: 'QTM: 180° counts as 2'
    }),
    };
}

function summarize(counts: Record<string, number>) {
  const entries = Object.entries(counts)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  let total = 0, sum = 0, mode = entries[0][0], modeN = 0;
  for (const [x, v] of entries) {
    total += v;
    sum += x * v;
    if (v > modeN) { modeN = v; mode = x; }
  }
  const pct = (p: number) => {
    const target = total * p;
    let cum = 0;
    for (const [x, v] of entries) { cum += v; if (cum >= target) return x; }
    return entries[entries.length - 1][0];
  };
  return {
    total,
    mean: sum / total,
    mode,
    median: pct(0.5),
    min: entries[0][0],
    max: entries[entries.length - 1][0],
  };
}

const eventName = (id: string, isZh: boolean) => (isZh ? EVENT_ZH[id] : EVENT_EN[id]) || id;
const unitLabel = (unit: string, _isZh: boolean) =>
  unit === 'twists' ? tr({ zh: '拧次', en: 'twists'
    }) : tr({ zh: '步', en: 'moves' });

export default function ScrambleLengthView({ isZh, data, event, merged, metric, avgData, avgMode, avgExtras }: {
  isZh: boolean;
  data: EventLengthsJson | null;
  event: string;
  merged: boolean;
  // 度量(由父级控制,钮提到顶栏):3x3-family HTM/QTM、sq1 WCA/slash。
  metric: 'htm' | 'qtm';
  // 组平均模式(父级 ?avg / ?avgx):开时整段换成组平均直方图,懒加载的 avgData。
  avgData?: EventLengthsAvgJson | null;
  avgMode?: boolean;
  avgExtras?: boolean;
}) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [examples, setExamples] = useState<ExamplesJson | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(false);
  // 「最优等价打乱」overlay(text → 最优打乱);本地管线产,缺失/旧数据时自动只显原始。
  const [optMap, setOptMap] = useState<Record<string, string> | null>(null);
  const [exView, setExView] = useState<'orig' | 'opt'>('orig');

  // Flag index for example comp cards (bump version to re-render once loaded).
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureExamples = () => {
    if (examples || examplesLoading) return;
    setExamplesLoading(true);
    fetch(statsUrl('/stats/scramble/event_length_examples.json'))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j) => { setExamples(j); setExamplesLoading(false); })
      .catch(() => setExamplesLoading(false));
    // 最优 overlay 并行拉(best-effort;缺失不影响原始示例)。
    if (optMap === null) {
      fetch(statsUrl('/stats/scramble/event_length_examples_opt.json') + '?v=20260614opt')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setOptMap(j?.byText ?? {}))
        .catch(() => setOptMap({}));
    }
  };
  const handleBarClick = (bin: number) => { setSelectedBin(bin); ensureExamples(); };

  // Switching event clears the selected length bin (examples no longer apply).
  useEffect(() => { setSelectedBin(null); }, [event]);

  // Active merge group (only when its rep is selected and merging is on).
  const activeGroup = useMemo(
    () => (merged ? groupForRep(event) : undefined),
    [merged, event],
  );
  const curName = activeGroup ? tr(activeGroup) : eventName(event, isZh);

  // Synthesize the merged distribution (sum member counts) or use the raw event.
  const cur = useMemo<EventLen | null>(() => resolveEventLen(data, event, merged), [data, event, merged]);

  const hasQtm = !!cur?.counts_qtm;
  const useQtm = metric === 'qtm' && hasQtm;
  const activeCounts = useQtm ? cur!.counts_qtm! : (cur?.counts ?? null);
  // 切口径时清空选中 bin(两口径长度不同,旧 bin 不再适用)。
  useEffect(() => { setSelectedBin(null); }, [metric]);

  // sq1 两口径都按「步」计(WCA 12c4 / slash 都是动作计数),不再显示「拧次」。
  const curUnit = event === 'sq1' ? tr({ zh: '步', en: 'moves' }) : unitLabel(cur?.unit ?? 'moves', isZh);

  const stats = useMemo(() => (activeCounts ? summarize(activeCounts) : null), [activeCounts]);
  const series = useMemo<HistSeries[]>(
    () => (activeCounts ? [{ name: curName, fillColors: [BAR], counts: activeCounts }] : []),
    [activeCounts, curName],
  );
  const clickableBins = useMemo(
    () => (activeCounts ? Object.keys(activeCounts).map(Number) : []),
    [activeCounts],
  );
  // When merged, pool the bin's examples across members round-robin (so both
  // events show up, not just the larger one) — each tagged with its source
  // event for the icon / analyzer link, capped at the per-bin count.
  const curExamples = useMemo<{ ex: LenExample; ev: string }[] | null>(() => {
    if (selectedBin === null || !examples) return null;
    const bin = String(selectedBin);
    const members = activeGroup ? activeGroup.members : [event];
    const src = useQtm ? (examples.events_qtm ?? {}) : examples.events;
    const lists = members.map((m) => ({ ev: m, arr: src[m]?.[bin] ?? [] }));
    const cap = examples.meta.per_bin;
    const out: { ex: LenExample; ev: string }[] = [];
    for (let i = 0, added = true; added && out.length < cap; i++) {
      added = false;
      for (const { ev, arr } of lists) {
        if (i >= arr.length) continue;
        out.push({ ex: arr[i], ev });
        added = true;
        if (out.length >= cap) break;
      }
    }
    // 按比赛时间倒序(最新在前);comps 日期串 ISO 前缀,字典序即时间序。无日期排末尾。
    out.sort((a, b) => (examples.comps[b.ex[0]]?.[1] ?? '').localeCompare(examples.comps[a.ex[0]]?.[1] ?? ''));
    return out.length ? out : null;
  }, [selectedBin, examples, activeGroup, event, useQtm]);

  if (!data) {
    return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…'
    })}</div>;
  }

  // 组平均模式:整段用「组平均」直方图替换(无示例交互 / 无脚注),度量沿用父级 metric。
  if (avgMode) {
    const a = resolveEventLenAvg(avgData ?? null, event, merged, !!avgExtras, metric);
    const denom = avgData?.meta.avg_denom ?? 5;
    if (!a) {
      return <div className="scramble-stats-loading">{tr({ zh: '组平均数据生成中,稍后再来', en: 'Group-average data is being generated, check back soon' })}</div>;
    }
    const avgStats = summarize(a.counts);
    const avgSeries: HistSeries[] = [{ name: curName, fillColors: [BAR], counts: a.counts }];
    return (
      <>
        <div className="scramble-stats-chart-wrapper">
          <DiscreteHistogram
            series={avgSeries}
            isZh={isZh}
            yMode={yMode}
            chartMode={chartMode}
            hideLegendColors
            gapAware
            showBarLabels={false}
            formatBin={(v) => (v / denom).toFixed(1)}
            onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
            onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
            meanValue={avgStats?.mean}
            meanLabel={avgStats ? `${tr({ zh: '平均', en: 'mean' })} ${(avgStats.mean / denom).toFixed(2)}` : undefined}
            medianValue={avgStats?.median}
            medianLabel={avgStats ? `${tr({ zh: '中位数', en: 'median' })} ${(avgStats.median / denom).toFixed(1)}` : undefined}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {cur && (
        <>
          <div className="scramble-stats-chart-wrapper">
            <DiscreteHistogram
              series={series}
              isZh={isZh}
              yMode={yMode}
              chartMode={chartMode}
              clickableBins={clickableBins}
              selectedBin={selectedBin}
              onBarClick={handleBarClick}
              hideLegendColors
              onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
              onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
              meanValue={stats?.mean}
              medianValue={stats?.median}
            />
          </div>

          {event === 'minx' && cur.glued && cur.glued.length > 0 && (
            <div className="scramble-len-footnote">
              <span>
                {tr({ zh: '注：极个别五魔打乱原文漏了空格，本页按 move 字母表计数而非空格，故全部记为 77 步。漏空格的打乱：', en: 'Note: a handful of megaminx scrambles have a missing space in the raw WCA data; counted by move rather than whitespace, so all read 77. Affected scramble(s): '
                })}
              </span>
              {cur.glued.map((gl, i) => {
                const iso2 = compFlagIso2(gl.ci);
                const fixed = gl.tok.match(/R\+\+|R--|D\+\+|D--|U'|U/g)?.join(' ') ?? gl.tok;
                return (
                  <span key={i} className="scramble-len-glued-item">
                    {i > 0 && '；'}
                    <Link href={`/scramble/gen?comp=${encodeURIComponent(gl.ci)}`} prefetch={false} title={gl.cn} className="scramble-len-glued-comp">
                      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                      {localizeCompName(gl.ci, gl.cn, isZh)}
                    </Link>
                    {' '}{compSourceLine(gl.r, gl.g, gl.n, isZh)}（<code>{gl.tok}</code> {tr({ zh: '应为', en: '→'
                    })} <code>{fixed}</code>）
                  </span>
                );
              })}
            </div>
          )}

          {cur.anomalies && cur.anomalies.length > 0 && stats && (
            <div className="scramble-len-footnote">
              <span>
                {(isZh
                                                ? `注：${eventName(event, isZh)}打乱由官方 TNoodle 固定生成 ${stats.mode} 步,下面这些比赛的打乱却不是 ${stats.mode} 步(应是用了非标准打乱器)：`
                                                : `Note: ${eventName(event, isZh)} scrambles are a fixed ${stats.mode} moves from official TNoodle; the ones below aren't ${stats.mode} moves (most likely from a non-standard scrambler): `)}
              </span>
              {cur.anomalies.map((a, i) => {
                const iso2 = compFlagIso2(a.ci);
                return (
                  <span key={i} className="scramble-len-glued-item">
                    {i > 0 && '；'}
                    <Link href={`/scramble/gen?comp=${encodeURIComponent(a.ci)}`} prefetch={false} title={a.cn} className="scramble-len-glued-comp">
                      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                      {localizeCompName(a.ci, a.cn, isZh)}
                    </Link>
                    {(isZh ? `(${a.lens.join('/')} 步,${a.n} 条)` : ` (${a.lens.join('/')} moves, ${a.n})`)}
                  </span>
                );
              })}
            </div>
          )}

          {event === '333ft' && (
            <div className="scramble-len-footnote">
              {tr({ zh: '注：脚拧与三阶 / 单手用的是同一套打乱程序(TNoodle 三阶随机状态),但脚拧 2019 年已被 WCA 废止,样本集中在较早的 TNoodle 版本,分布略偏长(众数 20 步,三阶 / 单手为 19),故未并入「三阶(速拧)」,单独列出。', en: 'Note: With-Feet uses the same scramble program as 3×3 / One-Handed (TNoodle 3×3 random state), but it was retired by the WCA in 2019, so its sample sits on older TNoodle versions and skews ~1 move longer (mode 20 vs 19). It is therefore kept separate from the merged 3×3 (speed) group.'
            })}
            </div>
          )}

          <div className="scramble-stats-panel scramble-stats-examples-panel">
            <div className="scramble-stats-examples-header">
            <div className="scramble-stats-panel-title">
              {selectedBin !== null
                ? ((isZh ? `${selectedBin} ${curUnit}打乱样例` : `${selectedBin}-${curUnit} examples`))
                : tr({ zh: '极端打乱样例', en: 'Extreme scrambles'
                                                  })}
            </div>
              {selectedBin !== null && curExamples?.some(({ ex }) => !!optMap?.[ex[4]]) && (
                <PillToggle
                  value={exView === 'opt'}
                  onChange={(v) => setExView(v ? 'opt' : 'orig')}
                  offLabel={tr({ zh: '原始', en: 'Original' })}
                  onLabel={tr({ zh: '最优', en: 'Optimal'
                })}
                  ariaLabel={tr({ zh: '原始打乱或最优等价打乱', en: 'Original scramble or optimal equivalent'
                })}
                />
              )}
            </div>
            {selectedBin === null && (
              <div className="scramble-stats-examples-hint">
                {tr({ zh: '点击直方图的柱子查看该长度的真实比赛打乱(含极长 / 极短)。', en: 'Click a bar to see real competition scrambles of that length (including the extreme long / short ones).'
                })}
              </div>
            )}
            {selectedBin !== null && examplesLoading && (
              <div className="scramble-stats-examples-hint">{tr({ zh: '加载中…', en: 'Loading…'
            })}</div>
            )}
            {selectedBin !== null && !examplesLoading && curExamples && curExamples.length > 0 && (
              <ul className="scramble-stats-examples-list">
                {curExamples.map(({ ex, ev }, i) => {
                  const [compId, round, group, num, text, extra] = ex;
                  const comp = examples?.comps[compId];
                  const iso2 = compFlagIso2(compId);
                  const linkable = ANALYZER_EVENTS.has(ev);
                  // 最优视图:有最优等价打乱(同状态)则用它,否则回退原始。
                  const opt = optMap?.[text];
                  const shownText = exView === 'opt' && opt ? opt : text;
                  // SQ1 shows compact notation site-wide (4/-36/...); other events unchanged.
                  const displayText = formatScrambleForEvent(ev, shownText);
                  return (
                    <li key={i}>
                      <div className="scramble-stats-examples-body">
                        {linkable ? (
                          <Link
                            className="scramble-stats-examples-scramble"
                            href={`/scramble/analyzer?${new URLSearchParams({ scramble: displayText.trim().replace(/ /g, '_') })}`}
                            prefetch={false}
                          >{displayText}</Link>
                        ) : (
                          <span className="scramble-stats-examples-scramble">{displayText}</span>
                        )}
                        {comp && (
                          <Link
                            className="scramble-stats-examples-comp"
                            href={`/scramble/gen?comp=${encodeURIComponent(compId)}`}
                            prefetch={false}
                            title={comp[0]}
                          >
                            {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                            <span className="scramble-stats-examples-comp-name">{localizeCompName(compId, comp[0], isZh)}</span>
                            <span className="scramble-stats-examples-comp-meta">
                              <EventIcon event={ev} className="scramble-stats-examples-evt" title={eventName(ev, isZh)} />
                              <span>{compSourceLine(round, group, num, isZh, !!extra)}</span>
                            </span>
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedBin !== null && !examplesLoading && (!curExamples || curExamples.length === 0) && (
              <div className="scramble-stats-examples-hint">{tr({ zh: '此长度无样例', en: 'No examples for this length'
            })}</div>
            )}
          </div>
        </>
      )}
    </>
  );
}

