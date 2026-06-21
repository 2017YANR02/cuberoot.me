'use client';

// 2×3×3 多米诺(233)整解【最优】步数分布 —— **采样**(非全空间精确曲线)。
// 状态空间 = 1,422,489,600(8!·8!·7/8),太大无法整图枚举,所以这里在浏览器里现场生成 N 个随机打乱
// (cstimer 真生成器),再用本站 IDA* 求解器逐条求 **可证最优** 解,把解的步数分桶。每条解都是真正最短
// (IDA* + max(角距离, 棱距离) 可采纳启发式),但整条曲线是抽样估计、不是全空间精确分布。求解同步且快
// (随机态毫秒级),为防深态/首条建库阻塞,分批跑、显示进度、可取消;下载提供「下载样本」CSV
// (optimal_length,scramble),不提供「下载全部状态」(14 亿态不可枚举)。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCuboid233, CUBOID233_STATE_COUNT_STR } from '@/lib/cuboid233-solver';
import { tr } from '@/i18n/tr';

const C233_COLOR = '#0ea5e9';   // 数据天蓝(非 UI 灰阶)
const DEFAULT_SAMPLE = 300;     // 默认采样个数(随机态,异步分批,可重采/取消)
const BATCH = 8;                // 每个宏任务解多少条(同步求解很快,分批只为让出主线程)

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface Sample { scramble: string; length: number; }

export default function Cuboid233DistView({ isZh }: { isZh: boolean }) {
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

    // Generate cstimer scrambles + solve them in small batches per async step, so the UI stays
    // responsive and can be cancelled between batches.
    const step = async () => {
      if (cancelRef.current) { setRunning(false); return; }
      for (let i = 0; i < BATCH && collected.length < sampleN; i++) {
        try {
          const scramble = (await cstimerScramble('233')).trim();
          if (cancelRef.current) { setRunning(false); return; }
          const out = solveCuboid233(scramble);
          collected.push({ scramble, length: out.length });
          const ex = examples.get(out.length) ?? [];
          if (ex.length < 12 && scramble) { ex.push(scramble); examples.set(out.length, ex); }
        } catch {
          // skip a failed sample (keep going toward sampleN)
        }
      }
      if (cancelRef.current) { setRunning(false); return; }
      setDone(collected.length);
      if (collected.length < sampleN) {
        void step();
      } else {
        examplesRef.current = examples;
        setSamples(collected.slice());
        setRunning(false);
      }
    };
    void step();
  }, [sampleN]);

  // 进页自动跑一次默认样本。
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
    let sum = 0, max = 0, min = Infinity;
    const byLen = new Map<number, number>();
    for (const s of samples) {
      sum += s.length;
      if (s.length > max) max = s.length;
      if (s.length < min) min = s.length;
      byLen.set(s.length, (byLen.get(s.length) ?? 0) + 1);
    }
    let mode = min, modeN = 0;
    for (const [len, n] of byLen) if (n > modeN) { modeN = n; mode = len; }
    const sorted = samples.map((s) => s.length).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { mean: sum / samples.length, median, mode, max, min };
  }, [samples]);

  const exampleBins = useMemo(
    () => [...examplesRef.current.keys()].sort((a, b) => a - b),
    [samples], // recompute when a sample run completes
  );

  const effectiveBin = selectedBin
    ?? (stats && examplesRef.current.has(stats.mode) ? stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin !== null ? (examplesRef.current.get(effectiveBin) ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: '233', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '2×3×3 多米诺(采样,最优)', en: '2×3×3 Domino (sampled, optimal)' }),
    fillColors: [C233_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['optimal_length,scramble'];
    for (const s of samples) lines.push(`${s.length},${s.scramble}`);
    downloadText('233_domino_sample.csv', lines.join('\n'));
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
              zh: `采样 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个随机态(最优,非全空间)`,
              en: `Sampled ${done.toLocaleString()} / ${sampleN.toLocaleString()} random states (optimal, not full-space)`,
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一个 token = 1 步(IDA* 最优)', en: 'one token = 1 move (IDA* optimal)' })}</span>
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
            zh: `求解 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个随机态…(每个用本站 IDA* 求可证最优解)`,
            en: `Solving ${done.toLocaleString()} / ${sampleN.toLocaleString()} random states… (each solved to a provable optimum by IDA*)`,
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
                      <ScramblePreview2D event="233" scramble={scr} size={26} />
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
              <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(样本,最优)', en: 'Summary stats (sample, optimal)' })}</div>
              <div className="scramble-stats-stat-grid">
                <Cell label={tr({ zh: '样本均值', en: 'sample mean' })} value={stats.mean.toFixed(2)} />
                <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(stats.median)} />
                <Cell label={tr({ zh: '众数', en: 'mode' })} value={String(stats.mode)} />
                <Cell label={tr({ zh: '最大', en: 'max' })} value={String(stats.max)} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是采样估计的【最优】解长度分布:每条解都是可证最短(IDA* + max(角距离, 棱距离) 可采纳启发式),但整条曲线是抽样的、不是全空间精确分布 —— 2×3×3 多米诺有 ${CUBOID233_STATE_COUNT_STR} 个状态(8 角 × 8 棱,棱角奇偶耦合),太大无法整图枚举,所以这里现场生成并解了 ${sampleN.toLocaleString()} 个随机态,把解的步数分桶(样本量越大分布越稳)。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
            en: `This is a SAMPLED estimate of the OPTIMAL solution-length distribution: every solution is a provable shortest path (IDA* with the admissible max(corner-distance, edge-distance) heuristic), but the whole curve is sampled, not the exact full-space distribution — the 2×3×3 Domino has ${CUBOID233_STATE_COUNT_STR} states (8 corners × 8 edges under a coupled parity), far too many to enumerate, so ${sampleN.toLocaleString()} random states were generated and solved on the fly, then bucketed (a larger sample stabilizes the curve). It is not a WCA event; the examples are the actual sampled random scrambles.`,
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
