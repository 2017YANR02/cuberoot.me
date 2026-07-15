'use client';

// 枫叶魔方(Ivy)整解最优步数分布 —— 理论全空间(全 29,160 态,精确枚举,非抽样)。
// 数据 = lib/ivy-solver 的 IVY_LENGTH_DISTRIBUTION(与求解器页同一份),示例由 ivyExamplesByLength
// 枚举每个步数档的真实状态、反推最短打乱生成(Ivy 不是 WCA 项目,没有比赛语料,但全状态空间可枚举)。
import { useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  IVY_LENGTH_DISTRIBUTION, IVY_GODS_NUMBER, ivyExamplesByLength, ivyAllScramblesByLength,
} from '@/lib/ivy-solver';
import { tr } from '@/i18n/tr';

const IVY_COLOR = '#2ea84e'; // 枫叶绿(数据色,非 UI 灰阶)

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
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

export default function IvyDistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    IVY_LENGTH_DISTRIBUTION.forEach((n, d) => { c[String(d)] = n; });
    return c;
  }, []);

  const examples = useMemo(() => ivyExamplesByLength(12), []);
  const exampleBins = useMemo(
    () => Object.keys(examples).map(Number).sort((a, b) => a - b),
    [examples],
  );

  const st = useMemo(() => stats(counts), [counts]);

  // 默认选众数档(6 步)。
  const effectiveBin = selectedBin ?? (st && exampleBins.includes(st.mode) ? st.mode : exampleBins[0] ?? null);

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '枫叶魔方', en: 'Ivy Cube' }),
    fillColors: [IVY_COLOR],
    counts,
  }], [counts]);

  const shown = effectiveBin !== null ? (examples[effectiveBin] ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'ivy', scramble: scr })}`;

  // 全量穷举(所有 29,159 个非平凡状态的最短打乱)按需懒算一次,供下载。
  const allRef = useRef<Record<number, string[]> | null>(null);
  const getAll = () => (allRef.current ??= ivyAllScramblesByLength());

  // 下载全部状态:CSV,按最优步数分类(含还原态一行 0,)。
  const downloadAll = () => {
    const all = getAll();
    const lines = ['optimal_length,scramble', '0,'];
    for (let d = 1; d <= IVY_GODS_NUMBER; d++) for (const s of all[d] ?? []) lines.push(`${d},${s}`);
    downloadText('ivy_all_states.csv', lines.join('\n'));
  };
  // 下载某步数全部:txt,每行一条打乱。
  const downloadBin = (d: number) => {
    downloadText(`ivy_${d}-move.txt`, (getAll()[d] ?? []).join('\n'));
  };
  const binCount = effectiveBin !== null ? (IVY_LENGTH_DISTRIBUTION[effectiveBin] ?? 0) : 0;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: '全空间精确枚举(非抽样)', en: 'Full state space, exactly enumerated (not sampled)' })}</span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '每转一个角 = 1 步', en: 'one corner twist = 1 move' })}</span>
        </div>
        <button type="button" className="ivy-dl-all" onClick={downloadAll}>
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
          meanValue={st?.mean}
          medianValue={st?.median}
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
                    <ScramblePreview2D event="ivy" scramble={scr} size={26} />
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

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: '理论全空间分布:枫叶魔方只有 29,160 个状态,整张图可一次性 BFS,这里是真值(非抽样)。它不是 WCA 项目,故无比赛打乱语料,示例由枚举状态反推最短打乱生成。',
            en: 'Theoretical full-space distribution: the Ivy Cube has only 29,160 states, so the whole graph is BFS-ed and this is exact (not sampled). It is not a WCA event, so examples are generated by enumerating states and inverting their shortest solution.',
          })}
        </span>
      </div>
    </>
  );
}
