'use client';

// 大金字塔(Master Pyraminx,随态)整解【近最优】步数分布 —— **采样**,非全空间精确、非可证最优。
// 状态空间约 4.6×10¹¹,无法整图枚举,所以这里在浏览器里现场生成 N 个随机打乱(cstimer 随态生成器),
// 再用 cstimer 自带的两阶段求解器(worker)逐条求近最优解,把解的步数分桶。**这是抽样估计的近最优长度**:
// 既不是全空间精确曲线(TIER A/B),也不是可证最优(TIER C)—— 是 cstimer 两阶段解的长度分布。
// 求解走 worker 异步,故采样分批跑、显示进度、可取消;下载提供「下载样本」CSV(near_optimal_length,scramble),
// 不提供「下载全部状态」(4.6×10¹¹ 态不可枚举)。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveMpyr } from '@/lib/mpyr-solver';
import { tr } from '@/i18n/tr';

const MPYR_COLOR = '#16a34a';   // 数据绿(非 UI 灰阶)
const DEFAULT_SAMPLE = 200;     // 默认采样个数(随机态,异步分批,可重采/取消)
const STATE_COUNT_APPROX = 461078666256; // ~4.6×10¹¹(6 棱 ori × 12 翼 × 4 角 ori),数量级用

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface Sample { scramble: string; length: number; }

export default function MpyrDistView({ isZh }: { isZh: boolean }) {
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

    // Generate + solve one scramble per async step (worker round-trips), so the
    // UI stays responsive and can be cancelled between samples.
    const step = async () => {
      if (cancelRef.current) { setRunning(false); return; }
      try {
        const scramble = (await cstimerScramble('mpyrso')).trim();
        if (cancelRef.current) { setRunning(false); return; }
        const out = await solveMpyr(scramble);
        collected.push({ scramble, length: out.length });
        const ex = examples.get(out.length) ?? [];
        if (ex.length < 12 && scramble) { ex.push(scramble); examples.set(out.length, ex); }
      } catch {
        // skip a failed sample (keep going toward sampleN)
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
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'mpyrso', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '大金字塔(采样,近最优)', en: 'Master Pyraminx (sampled, near-optimal)' }),
    fillColors: [MPYR_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['near_optimal_length,scramble'];
    for (const s of samples) lines.push(`${s.length},${s.scramble}`);
    downloadText('mpyr_mpyrso_sample.csv', lines.join('\n'));
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
              zh: `采样 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个随机态(近最优,非全空间)`,
              en: `Sampled ${done.toLocaleString()} / ${sampleN.toLocaleString()} random states (near-optimal, not full-space)`,
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一个 token = 1 步(cstimer 两阶段解)', en: 'one token = 1 move (cstimer two-phase solution)' })}</span>
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
            zh: `求解 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个随机态…(每个用 cstimer 自带两阶段求解器现场求近最优解,首个会构建剪枝表)`,
            en: `Solving ${done.toLocaleString()} / ${sampleN.toLocaleString()} random states… (each solved on the fly by cstimer's own two-phase solver; the first call builds prune tables)`,
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
                      <ScramblePreview2D event="mpyrso" scramble={scr} size={26} />
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
              <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(样本,近最优)', en: 'Summary stats (sample, near-optimal)' })}</div>
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
            zh: `这是采样估计的【近最优】长度分布,既不是全空间精确分布,也不是可证最优:大金字塔约有 ${STATE_COUNT_APPROX.toLocaleString()} 个状态(数量级 4.6×10¹¹),无法整图枚举,所以这里现场生成并用 cstimer 自带两阶段求解器解了 ${sampleN.toLocaleString()} 个随机态,把解的步数分桶。两阶段解长度接近最优但不保证最短(样本量越大分布越稳)。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
            en: `This is a SAMPLED estimate of the NEAR-OPTIMAL solution-length distribution — neither the exact full-space curve nor a provably-optimal one: the Master Pyraminx has ≈ ${STATE_COUNT_APPROX.toLocaleString()} states (order 4.6×10¹¹), far too many to enumerate, so ${sampleN.toLocaleString()} random states were generated and solved on the fly with cstimer's own two-phase solver, then bucketed. Two-phase solutions are near-optimal but not guaranteed shortest (a larger sample stabilizes the curve). It is not a WCA event; the examples are the actual sampled random scrambles.`,
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
