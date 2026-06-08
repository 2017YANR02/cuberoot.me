'use client';

// Per-event scramble move-length distribution. Reads the histogram-per-event
// JSON produced by stats-build/bin/build_scramble_lengths.ts. Many events are
// fixed-length (4x4–7x7 / megaminx / clock) so their chart is a single bar;
// the spread lives in 333-family / 222 / pyram / skewb / sq1.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { statsUrl } from '@/lib/stats-base';

interface EventLen {
  unit: 'moves' | 'twists';
  samples: number;
  counts: Record<string, number>;
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

  // Keep the selection on an event that actually has data.
  useEffect(() => {
    if (data && !data.events[event]) {
      const first = ALL_EVENT_IDS.find((id) => data.events[id]);
      if (first) setEvent(first);
    }
  }, [data, event]);

  // Switching event clears the selected length bin (examples no longer apply).
  useEffect(() => { setSelectedBin(null); }, [event]);

  const cur = data?.events[event] ?? null;
  const stats = useMemo(() => (cur ? summarize(cur.counts) : null), [cur]);
  const series = useMemo<HistSeries[]>(
    () => (cur ? [{ name: eventName(event, isZh), fillColors: [BAR], counts: cur.counts }] : []),
    [cur, event, isZh],
  );
  const clickableBins = useMemo(
    () => (cur ? Object.keys(cur.counts).map(Number) : []),
    [cur],
  );
  const curExamples = (selectedBin !== null && examples)
    ? (examples.events[event]?.[String(selectedBin)] ?? null)
    : null;

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
          availableEvents={available}
          selectedEvent={event}
          onSelect={setEvent}
          isZh={isZh}
        />
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

          {stats && (
            <div className="scramble-stats-panel">
              <div className="scramble-stats-panel-title">
                {eventName(event, isZh)} · {isZh ? '摘要统计' : 'Summary stats'}
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
                {curExamples.map((ex, i) => {
                  const [compId, round, group, num, text, extra] = ex;
                  const comp = examples?.comps[compId];
                  const iso2 = compFlagIso2(compId);
                  const linkable = ANALYZER_EVENTS.has(event);
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
                              <EventIcon event={event} className="scramble-stats-examples-evt" title={eventName(event, isZh)} />
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
