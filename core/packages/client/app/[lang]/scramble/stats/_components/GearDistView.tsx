'use client';

// 齿轮魔方(Gear Cube)整解最优步数分布 —— 理论全空间(全 41,472 态,精确枚举,非抽样)。
// 数据 = lib/gear-solver 的 GEAR_LENGTH_DISTRIBUTION(与求解器页同一份),示例由 gearExamplesByLength
// 枚举每个步数档的真实状态、反推最短打乱生成(齿轮魔方不是 WCA 项目,没有比赛语料,但全状态空间可枚举)。
// 态数 41,472(< 2M),「下载全部」CSV 直接 Blob(无需 confirm / 流式)。
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  GEAR_LENGTH_DISTRIBUTION, GEAR_GODS_NUMBER, GEAR_TOTAL_STATES,
  gearExamplesByLength, gearAllStates, gearAllScramblesByLength,
} from '@/lib/gear-solver';
import { tr } from '@/i18n/tr';

const GEAR_COLOR = '#9333ea'; // 齿轮紫(数据色,非 UI 灰阶)

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

export default function GearDistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    GEAR_LENGTH_DISTRIBUTION.forEach((n, d) => { c[String(d)] = n; });
    return c;
  }, []);

  const examples = useMemo(() => gearExamplesByLength(12), []);
  const exampleBins = useMemo(
    () => Object.keys(examples).map(Number).sort((a, b) => a - b),
    [examples],
  );

  const st = useMemo(() => stats(counts), [counts]);

  // 默认选众数档。
  const effectiveBin = selectedBin ?? (st && exampleBins.includes(st.mode) ? st.mode : exampleBins[0] ?? null);

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '齿轮魔方', en: 'Gear Cube' }),
    fillColors: [GEAR_COLOR],
    counts,
  }], [counts]);

  const shown = effectiveBin !== null ? (examples[effectiveBin] ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'gear', scramble: scr })}`;

  // 下载全部状态:CSV,按最优步数分类(含还原态一行 0,)。41,472 行 < 2M,直接 Blob。
  const downloadAll = () => {
    const lines = ['optimal_length,scramble'];
    for (const { depth, scramble } of gearAllStates()) lines.push(`${depth},${scramble}`);
    downloadBlob('gear_all_states.csv', lines.join('\n'));
  };
  // 下载某步数全部:txt,每行一条打乱。
  const downloadBin = (d: number) => {
    const all = gearAllScramblesByLength();
    downloadBlob(`gear_${d}-move.txt`, (all[d] ?? []).join('\n'));
  };
  const binCount = effectiveBin !== null ? (GEAR_LENGTH_DISTRIBUTION[effectiveBin] ?? 0) : 0;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: `全 ${GEAR_TOTAL_STATES.toLocaleString()} 态(精确枚举)`, en: `All ${GEAR_TOTAL_STATES.toLocaleString()} states (exact enumeration)` })}</span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一次转动 = 1 步(齿轮棱随面转联动)', en: 'one turn = 1 move (gear edges rotate with the faces)' })}</span>
        </div>
        <button
          type="button"
          className="ivy-dl-all"
          onClick={downloadAll}
          title={tr({ zh: '下载全部 41,471 条(CSV)', en: 'Download all 41,471 scrambles (CSV)' })}
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
                    <ScramblePreview2D event="gear" scramble={scr} size={26} />
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
            <Cell label={tr({ zh: '众数', en: 'mode' })} value={String(st.mode)} />
            <Cell label={tr({ zh: '上帝之数', en: "God's number" })} value={String(GEAR_GODS_NUMBER)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: '理论全空间分布:齿轮魔方虽是 3×3 外形,但棱块是齿轮、随面转联动,可达状态坍缩到 4 角 + 3 个轴向齿轮棱坐标,共 41,472 个,整张图可一次性 BFS,这里是真值(非抽样)。它不是 WCA 项目,故无比赛打乱语料,示例由枚举状态反推最短打乱生成。上帝之数 6。',
            en: 'Theoretical full-space distribution: the Gear Cube has a 3×3 shell, but its edges are gears that rotate with the faces, so its reachable space collapses to 4 corners + 3 gear-edge coordinates = 41,472 states. The whole graph is BFS-ed and this is exact (not sampled). It is not a WCA event, so examples are generated by enumerating states and inverting their shortest solution. God\'s number is 6.',
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
