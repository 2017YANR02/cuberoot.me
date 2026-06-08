'use client';

// Per-event scramble move-length distribution. Reads the histogram-per-event
// JSON produced by stats-build/bin/build_scramble_lengths.ts. Many events are
// fixed-length (4x4–7x7 / megaminx / clock) so their chart is a single bar;
// the spread lives in 333-family / 222 / pyram / skewb / sq1.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { statsUrl } from '@/lib/stats-base';

interface GluedScramble { ci: string; cn: string; r: string; g: string; n: number; tok: string }
interface EventLen {
  unit: 'moves' | 'twists';
  samples: number;
  counts: Record<string, number>;
  glued?: GluedScramble[]; // megaminx scrambles with a missing-space move (e.g. R--D--)
}
interface EventLengthsJson {
  meta: { generated_at: string; total_scrambles: number; total_samples: number };
  events: Record<string, EventLen>;
}

type LenExample = [string, string, string, number, string, (0 | 1)?]; // [compId, round, group, num, text, isExtra?]
interface ExamplesJson {
  meta: { generated_at: string; per_bin: number };
  comps: Record<string, [string, string]>;
  events: Record<string, Record<string, LenExample[]>>;
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
const MERGE_GROUPS: MergeGroup[] = [
  { rep: '333', members: ['333', '333oh'], zh: '三阶速拧', en: '3×3 (speed)', subZh: '含单手', subEn: 'incl. OH' },
  { rep: '333bf', members: ['333bf', '333mbf'], zh: '三阶盲拧', en: '3×3 (blind)', subZh: '含多盲', subEn: 'incl. MBLD' },
];
const groupForRep = (id: string) => MERGE_GROUPS.find((g) => g.rep === id);
// Non-representative members hidden from the selector while merged.
const MERGED_HIDDEN = new Set(MERGE_GROUPS.flatMap((g) => g.members.filter((m) => m !== g.rep)));

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
const unitLabel = (unit: string, isZh: boolean) =>
  unit === 'twists' ? (isZh ? '拧次' : 'twists') : (isZh ? '步' : 'moves');

export default function ScrambleLengthView({ isZh }: { isZh: boolean }) {
  const [data, setData] = useState<EventLengthsJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState('333');
  const [merged, setMerged] = useState(true);
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [examples, setExamples] = useState<ExamplesJson | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(false);

  useEffect(() => {
    fetch(statsUrl('/stats/scramble/event_lengths.json'))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

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
  };
  const handleBarClick = (bin: number) => { setSelectedBin(bin); ensureExamples(); };

  const available = useMemo(
    () => new Set(data ? Object.keys(data.events) : []),
    [data],
  );
  // While merged, hide the non-representative members (their distribution is
  // folded into the rep); 333ft stays visible as its own event.
  const selectorAvailable = useMemo(() => {
    if (!merged) return available;
    const s = new Set(available);
    for (const id of MERGED_HIDDEN) s.delete(id);
    return s;
  }, [available, merged]);

  // Keep the selection on an event that actually has data.
  useEffect(() => {
    if (data && !data.events[event]) {
      const first = ALL_EVENT_IDS.find((id) => data.events[id]);
      if (first) setEvent(first);
    }
  }, [data, event]);

  // Merging hides member events — fold any selected member onto its rep.
  useEffect(() => {
    if (!merged) return;
    const g = MERGE_GROUPS.find((g) => g.rep !== event && g.members.includes(event));
    if (g) setEvent(g.rep);
  }, [merged, event]);

  // Switching event clears the selected length bin (examples no longer apply).
  useEffect(() => { setSelectedBin(null); }, [event]);

  // Active merge group (only when its rep is selected and merging is on).
  const activeGroup = useMemo(
    () => (merged ? groupForRep(event) : undefined),
    [merged, event],
  );
  const curName = activeGroup ? (isZh ? activeGroup.zh : activeGroup.en) : eventName(event, isZh);
  const curSub = activeGroup ? (isZh ? activeGroup.subZh : activeGroup.subEn) : null;

  // Synthesize the merged distribution (sum member counts) or use the raw event.
  const cur = useMemo<EventLen | null>(() => {
    if (!data) return null;
    if (activeGroup) {
      const counts: Record<string, number> = {};
      let samples = 0;
      for (const m of activeGroup.members) {
        const ev = data.events[m];
        if (!ev) continue;
        for (const [k, v] of Object.entries(ev.counts)) { counts[k] = (counts[k] ?? 0) + v; samples += v; }
      }
      return { unit: 'moves', samples, counts };
    }
    return data.events[event] ?? null;
  }, [data, event, activeGroup]);

  const stats = useMemo(() => (cur ? summarize(cur.counts) : null), [cur]);
  const series = useMemo<HistSeries[]>(
    () => (cur ? [{ name: curName, fillColors: [BAR], counts: cur.counts }] : []),
    [cur, curName],
  );
  const clickableBins = useMemo(
    () => (cur ? Object.keys(cur.counts).map(Number) : []),
    [cur],
  );
  // When merged, pool the bin's examples across members round-robin (so both
  // events show up, not just the larger one) — each tagged with its source
  // event for the icon / analyzer link, capped at the per-bin count.
  const curExamples = useMemo<{ ex: LenExample; ev: string }[] | null>(() => {
    if (selectedBin === null || !examples) return null;
    const bin = String(selectedBin);
    const members = activeGroup ? activeGroup.members : [event];
    const lists = members.map((m) => ({ ev: m, arr: examples.events[m]?.[bin] ?? [] }));
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
    return out.length ? out : null;
  }, [selectedBin, examples, activeGroup, event]);

  if (error) {
    return <div className="scramble-stats-error">{isZh ? '加载失败' : 'Load failed'}: {error}</div>;
  }
  if (!data) {
    return <div className="scramble-stats-loading">{isZh ? '加载中…' : 'Loading…'}</div>;
  }

  const totalN = data.meta.total_scrambles.toLocaleString();
  const isBootstrap = !!(data.meta as { bootstrap?: boolean }).bootstrap;
  const unitNote = isZh ? '步数;SQ1 计拧次,多盲每方块单独计' : 'moves; Square-1 in twists, multi-blind counted per cube';
  const source = isBootstrap
    ? (isZh
      ? `示例样本 ${totalN} 条打乱(取自部分比赛,完整全时段数据每日刷新后生效);按项目统计打乱记号长度(${unitNote})。`
      : `Sample of ${totalN} scrambles (a few competitions; full all-time data lands on the next daily refresh); scramble notation length per event (${unitNote}).`)
    : (isZh
      ? `来源: WCA 历史比赛全部 ${totalN} 条打乱原文;按项目统计打乱记号长度(${unitNote})。`
      : `Source: all ${totalN} historical WCA competition scrambles; scramble notation length per event (${unitNote}).`);

  return (
    <>
      <p className="scramble-stats-note">{source}</p>

      <div className="scramble-len-events">
        <WcaEventSelector
          availableEvents={selectorAvailable}
          selectedEvent={event}
          onSelect={setEvent}
          isZh={isZh}
          onlyAvailable
        />
        <div className="scramble-len-merge">
          <PillToggle
            value={merged}
            onChange={setMerged}
            onLabel={isZh ? '已合并' : 'Merged'}
            offLabel={isZh ? '分开' : 'Split'}
            ariaLabel={isZh ? '合并打乱相同的项目' : 'Merge events that share scrambles'}
          />
          <span className="scramble-len-merge-hint">
            {isZh
              ? '三阶速拧与单手、三盲与多盲打乱相同'
              : '3×3 speed + OH, and 3BLD + MBLD share scrambles'}
          </span>
        </div>
      </div>

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
              yModeLabel={yMode === 'percent' ? (isZh ? '百分比' : '%') : (isZh ? '数量' : 'count')}
            />
          </div>

          {event === 'minx' && cur.glued && cur.glued.length > 0 && (
            <div className="scramble-len-footnote">
              <span>
                {isZh
                  ? '注：极个别五魔打乱原文漏了空格，本页按 move 字母表计数而非空格，故全部记为 77 步。漏空格的打乱：'
                  : 'Note: a handful of megaminx scrambles have a missing space in the raw WCA data; counted by move rather than whitespace, so all read 77. Affected scramble(s): '}
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
                    {' '}{compSourceLine(gl.r, gl.g, gl.n, isZh)}（<code>{gl.tok}</code> {isZh ? '应为' : '→'} <code>{fixed}</code>）
                  </span>
                );
              })}
            </div>
          )}

          {event === '333ft' && (
            <div className="scramble-len-footnote">
              {isZh
                ? '注：脚拧与三阶 / 单手用的是同一套打乱程序(TNoodle 三阶随机状态),但脚拧 2019 年已被 WCA 废止,样本集中在较早的 TNoodle 版本,分布略偏长(众数 20 步,三阶 / 单手为 19),故未并入「三阶(速拧)」,单独列出。'
                : 'Note: With-Feet uses the same scramble program as 3×3 / One-Handed (TNoodle 3×3 random state), but it was retired by the WCA in 2019, so its sample sits on older TNoodle versions and skews ~1 move longer (mode 20 vs 19). It is therefore kept separate from the merged 3×3 (speed) group.'}
            </div>
          )}

          {stats && (
            <div className="scramble-stats-panel">
              <div className="scramble-stats-panel-title">
                {curName}
                {curSub && <span className="scramble-len-sub">{curSub}</span>} {isZh ? '摘要统计' : 'Summary stats'}
                <span className="scramble-len-unit">({unitLabel(cur.unit, isZh)})</span>
              </div>
              <div className="scramble-stats-stat-grid">
                <Cell label={isZh ? '均值' : 'mean'} value={stats.mean.toFixed(2)} />
                <Cell label={isZh ? '中位数' : 'median'} value={String(stats.median)} />
                <Cell label={isZh ? '众数' : 'mode'} value={String(stats.mode)} />
                <Cell label={isZh ? '范围' : 'range'} value={`${stats.min}–${stats.max}`} />
                <Cell label={isZh ? '样本' : 'samples'} value={stats.total.toLocaleString()} />
              </div>
            </div>
          )}

          <div className="scramble-stats-panel scramble-stats-examples-panel">
            <div className="scramble-stats-panel-title">
              {selectedBin !== null
                ? (isZh ? `${selectedBin} ${unitLabel(cur.unit, isZh)}打乱样例` : `${selectedBin}-${cur.unit} examples`)
                : (isZh ? '极端打乱样例' : 'Extreme scrambles')}
            </div>
            {selectedBin === null && (
              <div className="scramble-stats-examples-hint">
                {isZh ? '点击直方图的柱子查看该长度的真实比赛打乱(含极长 / 极短)。' : 'Click a bar to see real competition scrambles of that length (including the extreme long / short ones).'}
              </div>
            )}
            {selectedBin !== null && examplesLoading && (
              <div className="scramble-stats-examples-hint">{isZh ? '加载中…' : 'Loading…'}</div>
            )}
            {selectedBin !== null && !examplesLoading && curExamples && curExamples.length > 0 && (
              <ul className="scramble-stats-examples-list">
                {curExamples.map(({ ex, ev }, i) => {
                  const [compId, round, group, num, text, extra] = ex;
                  const comp = examples?.comps[compId];
                  const iso2 = compFlagIso2(compId);
                  const linkable = ANALYZER_EVENTS.has(ev);
                  return (
                    <li key={i}>
                      <div className="scramble-stats-examples-body">
                        {linkable ? (
                          <Link
                            className="scramble-stats-examples-scramble"
                            href={`/scramble/analyzer?${new URLSearchParams({ scramble: text.trim().replace(/ /g, '_') })}`}
                            prefetch={false}
                          >{text}</Link>
                        ) : (
                          <span className="scramble-stats-examples-scramble">{text}</span>
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
              <div className="scramble-stats-examples-hint">{isZh ? '此长度无样例' : 'No examples for this length'}</div>
            )}
          </div>
        </>
      )}

      <div className="scramble-stats-meta">
        <span>{isZh ? '生成时间' : 'Generated'}: {new Date(data.meta.generated_at).toLocaleString()}</span>
      </div>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="scramble-stats-stat-cell">
      <div className="scramble-stats-stat-label">{label}</div>
      <div className="scramble-stats-stat-value">{value}</div>
    </div>
  );
}
