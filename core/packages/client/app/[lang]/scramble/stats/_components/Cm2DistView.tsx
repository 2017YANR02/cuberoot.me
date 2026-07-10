'use client';

// Cmetrick Mini(Cmetrick Mini)整解最优步数分布 —— 理论全空间(全 165,888 态,精确枚举,非抽样)。
// 数据 = lib/cm2-solver 的 CM2_LENGTH_DISTRIBUTION(与求解器页同一份),示例由 cm2ExamplesByLength
// 枚举每个步数档的真实状态、反推最短打乱生成(Cmetrick Mini 不是 WCA 项目,没有比赛语料,但全状态空间可枚举)。
// 态数 165,888(< 2M),「下载全部」CSV 直接 Blob(无需 confirm / 流式)。
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  CM2_LENGTH_DISTRIBUTION, CM2_GODS_NUMBER, CM2_TOTAL_STATES,
  cm2ExamplesByLength, cm2AllStates, cm2AllScramblesByLength,
} from '@/lib/cm2-solver';
import { tr } from '@/i18n/tr';

const CM2_COLOR = '#8338ec'; // 异形扭转紫(数据色,非 UI 灰阶)

function downloadBlob(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function stats(counts: Record<string, number>) {
  const entries = Object.entries(counts)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  let total = 0, sum = 0, mode = entries[0][0], modeN = 0;
  for (const [x, v] of entries) { total += v; sum += x * v; if (v > modeN) { modeN = v; mode = x; } }
  const pct = (p: number) => {
    const t = total * p; let c = 0;
    for (const [x, v] of entries) { c += v; if (c >= t) return x; }
    return entries[entries.length - 1][0];
  };
  return { mean: total > 0 ? sum / total : 0, median: pct(0.5), mode, max: entries[entries.length - 1][0] };
}

export default function Cm2DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    CM2_LENGTH_DISTRIBUTION.forEach((n, d) => { c[String(d)] = n; });
    return c;
  }, []);

  const examples = useMemo(() => cm2ExamplesByLength(12), []);
  const exampleBins = useMemo(
    () => Object.keys(examples).map(Number).sort((a, b) => a - b),
    [examples],
  );

  const st = useMemo(() => stats(counts), [counts]);

  // 默认选众数档。
  const effectiveBin = selectedBin ?? (st && exampleBins.includes(st.mode) ? st.mode : exampleBins[0] ?? null);

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: 'Cmetrick Mini', en: 'Cmetrick Mini' }),
    fillColors: [CM2_COLOR],
    counts,
  }], [counts]);

  const shown = effectiveBin !== null ? (examples[effectiveBin] ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'cm2', scramble: scr })}`;

  // 下载全部状态:CSV,按最优步数分类(含还原态一行 0,)。165,888 行 < 2M,直接 Blob。
  const downloadAll = () => {
    const lines = ['optimal_length,scramble'];
    for (const { depth, scramble } of cm2AllStates()) lines.push(`${depth},${scramble}`);
    downloadBlob('cm2_all_states.csv', lines.join('\n'));
  };
  // 下载某步数全部:txt,每行一条打乱。
  const downloadBin = (d: number) => {
    const all = cm2AllScramblesByLength();
    downloadBlob(`cm2_${d}-move.txt`, (all[d] ?? []).join('\n'));
  };
  const binCount = effectiveBin !== null ? (CM2_LENGTH_DISTRIBUTION[effectiveBin] ?? 0) : 0;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: `全 ${CM2_TOTAL_STATES.toLocaleString()} 态(精确枚举)`, en: `All ${CM2_TOTAL_STATES.toLocaleString()} states (exact enumeration)` })}</span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一次转动 = 1 步(行/列 90° 或 180°)', en: 'one turn = 1 move (row/column 90° or 180°)' })}</span>
        </div>
        <button
          type="button"
          className="ivy-dl-all"
          onClick={downloadAll}
          title={tr({ zh: '下载全部 165,887 条(CSV)', en: 'Download all 165,887 scrambles (CSV)' })}
        >
          <Download size={14} aria-hidden />
          {tr({ zh: '下载全部状态 (CSV)', en: 'Download all states (CSV)' })}
        </button>
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
          onBarClick={(b) => setSelectedBin(b)}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          yModeLabel={yMode === 'percent' ? tr({ zh: '百分比', en: '%' }) : tr({ zh: '数量', en: 'count' })}
        />
      </div>

      {effectiveBin !== null && (
        <div className="scramble-stats-panel scramble-stats-examples-panel">
          <div className="scramble-stats-examples-header">
            <div className="scramble-stats-panel-title">
              {tr({ zh: '{n} 步示例', en: '{n}-move examples' }).replace('{n}', String(effectiveBin))}
            </div>
            <button
              type="button"
              className="scramble-stats-download-btn"
              onClick={() => downloadBin(effectiveBin)}
              title={tr({ zh: '下载该步数全部 {n} 条打乱 (txt)', en: 'Download all {n} scrambles of this length (txt)' }).replace('{n}', binCount.toLocaleString())}
              aria-label={tr({ zh: '下载该步数全部打乱', en: 'Download all scrambles of this length' })}
            >
              <Download size={14} aria-hidden />
            </button>
          </div>
          {shown.length > 0 ? (
            <ul className="scramble-stats-examples-list">
              {shown.map((scr, i) => (
                <li key={i}>
                  <Link
                    className="scramble-stats-examples-cube"
                    href={solverHref(scr)}
                    prefetch={false}
                    aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
                  >
                    <ScramblePreview2D event="cm2" scramble={scr} size={26} />
                  </Link>
                  <div className="scramble-stats-examples-body">
                    <Link className="scramble-stats-examples-scramble" href={solverHref(scr)} prefetch={false}>
                      {scr}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="scramble-stats-examples-hint">{tr({ zh: '此步数无示例', en: 'No examples for this length' })}</div>
          )}
        </div>
      )}

      {st && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计', en: 'Summary stats' })}</div>
          <div className="scramble-stats-stat-grid">
            <Cell label={tr({ zh: '均值', en: 'mean' })} value={st.mean.toFixed(2)} />
            <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(st.median)} />
            <Cell label={tr({ zh: '上帝之数', en: "God's number" })} value={String(CM2_GODS_NUMBER)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: '理论全空间分布:Cmetrick Mini 有 165,888 个状态(4 个球各 24 种朝向,齿轮联动的奇偶限制把 24⁴ 砍半 = 24⁴/2),整张图可一次性 BFS,这里是真值(非抽样)。它不是 WCA 项目,故无比赛打乱语料,示例由枚举状态反推最短打乱生成。',
            en: 'Theoretical full-space distribution: the Cmetrick Mini has 165,888 states (4 balls of 24 orientations each, with the gears’ parity restriction halving 24⁴ = 24⁴/2), so the whole graph is BFS-ed and this is exact (not sampled). It is not a WCA event, so examples are generated by enumerating states and inverting their shortest solution.',
          })}
        </span>
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
