'use client';

// 3×3×4(334)最优解步数分布 —— **采样**(非全空间精确曲线):3×3×4 状态空间 ≈ 165,181,768,335,360,000
//(facelet 群阶 2,642,908,293,365,760,000,Schreier-Sims 实算),太大无法整图枚举;且浏览器可现场构建的
// 可采纳启发表最深只有 13,而上帝之数 ~18-20,全空间深态无法在交互时间内求最优。所以这里现场生成 N 个**短随机打乱**
//(本站 cstimer 同款生成器,固定 SCRAMBLE_LEN 步),用 IDA* + max(轨道距离)逐条求**可证最优**解,把最优步数分桶 ——
// 即「SCRAMBLE_LEN 步随机打乱的最优解长度分布」,不是全空间最优分布(全空间深态解不出来,见说明)。下载提供
//「下载样本」CSV(optimal_length,scramble),不提供「下载全部状态」(1.65×10¹⁷ 态不可枚举)。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomCuboid334Scramble, solveCuboid334, CUBOID334_STATE_COUNT_STR, CUBOID334_GROUP_ORDER_STR } from '@/lib/cuboid334-solver';
import { tr } from '@/i18n/tr';

const C334_COLOR = '#0ea5e9';   // 数据天蓝(非 UI 灰阶)
const DEFAULT_SAMPLE = 400;     // 默认采样个数(短态解极快,可多采)
const SCRAMBLE_LEN = 8;         // 短随机打乱长度(保持在快速可证最优区间)
const BATCH = 24;               // 每个宏任务解多少条(让出主线程)

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface Sample { scramble: string; length: number; optimal: boolean; }

export default function Cuboid334DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const sampleN = DEFAULT_SAMPLE;
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const examplesRef = useRef<Map<number, string[]>>(new Map());
  const cancelRef = useRef(false);

  const run = useCallback(() => {
    cancelRef.current = false;
    setRunning(true);
    setDone(0);
    setSamples([]);
    setSelectedBin(null);
    examplesRef.current = new Map();
    const collected: Sample[] = [];
    const examples = new Map<number, string[]>();

    const step = () => {
      if (cancelRef.current) { setRunning(false); return; }
      for (let i = 0; i < BATCH && collected.length < sampleN; i++) {
        try {
          const scramble = randomCuboid334Scramble(SCRAMBLE_LEN);
          const out = solveCuboid334(scramble); // short scrambles always solve optimally
          collected.push({ scramble, length: out.length, optimal: out.optimal });
          const ex = examples.get(out.length) ?? [];
          if (ex.length < 12 && scramble) { ex.push(scramble); examples.set(out.length, ex); }
        } catch {
          // skip a too-deep sample (should not happen at this short length)
        }
      }
      setDone(collected.length);
      if (collected.length < sampleN) {
        setTimeout(step, 0); // yield to the main thread between batches
      } else {
        examplesRef.current = examples;
        setSamples(collected.slice());
        setRunning(false);
      }
    };
    step();
  }, [sampleN]);

  useEffect(() => {
    run();
    return () => { cancelRef.current = true; };
  }, [run]);

  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    for (const s of samples) c[String(s.length)] = (c[String(s.length)] ?? 0) + 1;
    return c;
  }, [samples]);

  const stats = useMemo(() => {
    if (samples.length === 0) return null;
    let sum = 0, max = 0, min = Infinity, optN = 0;
    const byLen = new Map<number, number>();
    for (const s of samples) {
      sum += s.length;
      if (s.length > max) max = s.length;
      if (s.length < min) min = s.length;
      if (s.optimal) optN++;
      byLen.set(s.length, (byLen.get(s.length) ?? 0) + 1);
    }
    let mode = min, modeN = 0;
    for (const [len, n] of byLen) if (n > modeN) { modeN = n; mode = len; }
    const sorted = samples.map((s) => s.length).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { mean: sum / samples.length, median, mode, max, min, optPct: (100 * optN) / samples.length };
  }, [samples]);

  const exampleBins = useMemo(
    () => [...examplesRef.current.keys()].sort((a, b) => a - b),
    [samples],
  );

  const effectiveBin = selectedBin
    ?? (stats && examplesRef.current.has(stats.mode) ? stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin !== null ? (examplesRef.current.get(effectiveBin) ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: '334', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: `3×3×4(采样,${SCRAMBLE_LEN} 步打乱的最优解)`, en: `3×3×4 (sampled, optimal for ${SCRAMBLE_LEN}-move scrambles)` }),
    fillColors: [C334_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['optimal_length,scramble'];
    for (const s of samples) lines.push(`${s.length},${s.scramble}`);
    downloadText('334_sample.csv', lines.join('\n'));
  };

  const reSample = () => {
    if (running) { cancelRef.current = true; setRunning(false); return; }
    setRound((r) => r + 1);
    run();
  };

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>
            {tr({
              zh: `采样 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个 ${SCRAMBLE_LEN} 步随机打乱(可证最优,非全空间)`,
              en: `Sampled ${done.toLocaleString()} / ${sampleN.toLocaleString()} ${SCRAMBLE_LEN}-move random scrambles (provably optimal, not full-space)`,
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一个 token = 1 步', en: 'one token = 1 move' })}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ivy-dl-all" onClick={reSample} data-round={round}>
            {running
              ? <><Loader2 size={14} aria-hidden />{tr({ zh: '采样中(点击停止)', en: 'Sampling (click to stop)' })}</>
              : <><RotateCw size={14} aria-hidden />{tr({ zh: '重新采样', en: 'Re-sample' })}</>}
          </button>
          <button type="button" className="ivy-dl-all" onClick={downloadSample} disabled={samples.length === 0}>
            <Download size={14} aria-hidden />
            {tr({ zh: '下载样本 (CSV)', en: 'Download sample (CSV)' })}
          </button>
        </div>
      </div>

      {samples.length === 0 ? (
        <div className="scramble-stats-loading">
          {tr({
            zh: `求解 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个 ${SCRAMBLE_LEN} 步随机打乱…(IDA* 可证最优)`,
            en: `Solving ${done.toLocaleString()} / ${sampleN.toLocaleString()} ${SCRAMBLE_LEN}-move random scrambles… (IDA*, provably optimal)`,
          })}
        </div>
      ) : (
        <>
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

          {effectiveBin !== null && shown.length > 0 && (
            <div className="scramble-stats-panel scramble-stats-examples-panel">
              <div className="scramble-stats-examples-header">
                <div className="scramble-stats-panel-title">
                  {tr({ zh: '{n} 步示例', en: '{n}-move examples' }).replace('{n}', String(effectiveBin))}
                </div>
              </div>
              <ul className="scramble-stats-examples-list">
                {shown.map((scr, i) => (
                  <li key={i}>
                    <Link
                      className="scramble-stats-examples-cube"
                      href={solverHref(scr)}
                      prefetch={false}
                      aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
                    >
                      <ScramblePreview2D event="334" scramble={scr} size={26} />
                    </Link>
                    <div className="scramble-stats-examples-body">
                      <Link className="scramble-stats-examples-scramble" href={solverHref(scr)} prefetch={false}>
                        {scr}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats && (
            <div className="scramble-stats-panel">
              <div className="scramble-stats-panel-title">{tr({ zh: `摘要统计(${SCRAMBLE_LEN} 步打乱样本,可证最优)`, en: `Summary stats (${SCRAMBLE_LEN}-move scramble sample, provably optimal)` })}</div>
              <div className="scramble-stats-stat-grid">
                <Cell label={tr({ zh: '样本均值', en: 'sample mean' })} value={stats.mean.toFixed(1)} />
                <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(stats.median)} />
                <Cell label={tr({ zh: '最小', en: 'min' })} value={String(stats.min)} />
                <Cell label={tr({ zh: '最大', en: 'max' })} value={String(stats.max)} />
                <Cell label={tr({ zh: '可证最优占比', en: 'proven-optimal %' })} value={`${stats.optPct.toFixed(0)}%`} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是【${SCRAMBLE_LEN} 步随机打乱的最优解长度】采样分布,不是全空间最优分布:3×3×4 有 ${CUBOID334_STATE_COUNT_STR} 个状态(facelet 群阶 ${CUBOID334_GROUP_ORDER_STR},均为 Schreier-Sims 实算),太大无法整图枚举;浏览器可现场构建的可采纳启发表最深只有 13,而上帝之数约 18-20,全空间深态无法在交互时间内求最优。所以这里只对 ${sampleN.toLocaleString()} 个 ${SCRAMBLE_LEN} 步短打乱求**可证最优**解(IDA* + max(轨道距离)),把最优步数分桶。它不是 WCA 项目,示例即采样到的真实随机打乱;深度更大的随机态最优分布在浏览器里算不出来。`,
            en: `This is a SAMPLED distribution of the OPTIMAL length of ${SCRAMBLE_LEN}-move random scrambles — not the full-space optimal distribution: the 3×3×4 has ${CUBOID334_STATE_COUNT_STR} states (facelet group order ${CUBOID334_GROUP_ORDER_STR}, both computed by Schreier-Sims), far too many to enumerate; the strongest admissible heuristic buildable in the browser caps at depth 13 while God's number is ~18-20, so deep states can't be solved optimally in interactive time. So only ${sampleN.toLocaleString()} short ${SCRAMBLE_LEN}-move scrambles are solved to a PROVABLE optimum (IDA* + max orbit distance) and bucketed. It is not a WCA event; the examples are the actual sampled random scrambles — the optimal distribution of deeper random states can't be computed in-browser.`,
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
