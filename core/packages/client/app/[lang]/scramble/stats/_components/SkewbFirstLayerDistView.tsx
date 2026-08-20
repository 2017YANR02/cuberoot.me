'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  SubsetColorPicker, fillColorsForSubset, type SubsetSelection,
} from '@/components/SubsetColorPicker/SubsetColorPicker';
import {
  skewbFacesForColors, skewbFirstLayerExamplesByLength, skewbFirstLayerStats,
} from '@/lib/skewb-solver';
import { computeStats } from '@/lib/scramble-dist/stats';
import { tr } from '@/i18n/tr';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';

/** 斜转底层的客户端精确穷举视图：目标与 csTimer 一致，为 1 个中心 + 4 个相邻角。 */
export default function SkewbFirstLayerDistView({
  isZh,
  sel,
}: {
  isZh: boolean;
  sel: SubsetSelection;
}) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const data = useMemo(() => {
    const faces = skewbFacesForColors(sel.selectedColors);
    const exact = skewbFirstLayerStats(faces);
    const counts = Object.fromEntries(exact.histogram.map((count, distance) => [String(distance), count]));
    return {
      exact,
      counts,
      stats: computeStats(counts),
      examples: skewbFirstLayerExamplesByLength(faces, 12),
    };
    // selectedColors is derived from this stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.subsetKey]);

  const exampleBins = useMemo(
    () => [...data.examples.keys()].sort((a, b) => a - b),
    [data.examples],
  );
  const effectiveBin = selectedBin !== null && data.examples.has(selectedBin)
    ? selectedBin
    : (data.stats && data.examples.has(data.stats.mode) ? data.stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin === null ? [] : (data.examples.get(effectiveBin) ?? []);

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '底层最优', en: 'Optimal first layer' }),
    fillColors: fillColorsForSubset(sel.selectedColors),
    counts: data.counts,
  }], [data.counts, sel.selectedColors]);

  const solverHref = (scramble: string) => `/scramble/solver?${new URLSearchParams({
    event: 'skewb',
    view: 'cube',
    goal: 'layer',
    colors: sel.subsetKey,
    scramble,
  })}`;

  return (
    <>
      <div className="scramble-stats-controls">
        <SubsetColorPicker sel={sel} isZh={isZh} className="scramble-stats-color-control" />
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: '全部 3,149,280 个状态', en: 'All 3,149,280 states' })}</span>
          <span className="scramble-stats-puzzle-metric">
            {tr({ zh: `最远 ${data.exact.godsNumber} 步`, en: `Maximum ${data.exact.godsNumber} moves` })}
          </span>
        </div>
      </div>

      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={series}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          clickableBins={exampleBins}
          selectedBin={effectiveBin}
          onBarClick={setSelectedBin}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          meanValue={data.stats?.mean}
          medianValue={data.stats?.median}
        />
      </div>

      {effectiveBin !== null && (
        <div className="scramble-stats-panel scramble-stats-examples-panel">
          <div className="scramble-stats-examples-header">
            <div className="scramble-stats-panel-title">
              {tr({ zh: '{n} 步代表状态', en: 'Representative {n}-move states' }).replace('{n}', String(effectiveBin))}
            </div>
          </div>
          <ul className="scramble-stats-examples-list">
            {shown.map((scramble, index) => (
              <li key={`${scramble}-${index}`}>
                <Link
                  className="scramble-stats-examples-cube"
                  href={solverHref(scramble)}
                  prefetch={false}
                  aria-label={tr({ zh: '在底层求解器中打开', en: 'Open in the first-layer solver' })}
                >
                  <ScramblePreview2D event="skewb" scramble={scramble} size={26} />
                </Link>
                <div className="scramble-stats-examples-body">
                  <Link className="scramble-stats-examples-scramble" href={solverHref(scramble)} prefetch={false}>
                    {scramble || tr({ zh: '还原态', en: 'Solved state' })}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>{tr({
          zh: `精确穷举全部 3,149,280 个状态。底层按 1 个中心和 4 个相邻角判定；所选底色取最短；每 120° 为一步。0 步目标状态 ${data.exact.goalStates} 个。`,
          en: `Exact enumeration of all 3,149,280 states. A layer consists of one centre and its four neighbouring corners; the shortest result among selected bottom colors is used; each 120° turn is one move. There are ${data.exact.goalStates} zero-move states.`,
        })}</span>
      </div>
    </>
  );
}
