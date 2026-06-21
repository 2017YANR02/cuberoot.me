'use client';

// 3×3×4(334)解步数分布 —— **采样 / 近最优**(非全空间精确曲线):3×3×4 状态空间 ≈ 165,181,768,335,360,000
//(facelet 群阶 2,642,908,293,365,760,000,Schreier-Sims 实算),太大无法整图枚举。求解器走**两阶段约简**
//(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的**近最优**解(很浅的态另给
// 可证最优解)。这里现场生成 N 个 cstimer 同款随机打乱(SCRAMBLE_LEN 步),逐条求解,把**返回解的步数**分桶 ——
// 即随机态的返回解长度分布(主要为近最优,浅态为最优),不是全空间最优分布。下载提供「下载样本」CSV
//(length,scramble,optimal),不提供「下载全部状态」(1.65×10¹⁷ 态不可枚举)。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomCuboid334Scramble, solveCuboid334, CUBOID334_STATE_COUNT_STR, CUBOID334_GROUP_ORDER_STR } from '@/lib/cuboid334-solver';
import { tr } from '@/i18n/tr';

const C334_COLOR = '#0ea5e9';   // 数据天蓝(非 UI 灰阶)
const DEFAULT_SAMPLE = 120;     // 默认采样个数(两阶段每条数十至数百 ms)
const SCRAMBLE_LEN = 40;        // cstimer 同款随机打乱长度(近均匀随机态)
const BATCH = 6;                // 每个宏任务解多少条(让出主线程)

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
          const out = solveCuboid334(scramble); // two-phase: every state returns a bounded solution
          collected.push({ scramble, length: out.length, optimal: out.optimal });
          const ex = examples.get(out.length) ?? [];
          if (ex.length < 12 && scramble) { ex.push(scramble); examples.set(out.length, ex); }
        } catch {
          // a real scramble never fails to solve; ignore any unexpected parse error
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
    name: tr({ zh: '3×3×4(采样,近最优,非全空间)', en: '3×3×4 (sampled, near-optimal, not full-space)' }),
    fillColors: [C334_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['length,scramble,optimal'];
    for (const s of samples) lines.push(`${s.length},${s.scramble},${s.optimal ? 1 : 0}`);
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
              zh: `采样 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个随机打乱(两阶段近最优,非全空间)`,
              en: `Sampled ${done.toLocaleString()} / ${sampleN.toLocaleString()} random scrambles (two-phase near-optimal, not full-space)`,
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
            zh: `求解 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个随机打乱…(两阶段约简,近最优)`,
            en: `Solving ${done.toLocaleString()} / ${sampleN.toLocaleString()} random scrambles… (two-phase reduction, near-optimal)`,
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
              <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(随机态样本,两阶段近最优)', en: 'Summary stats (random-state sample, two-phase near-optimal)' })}</div>
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
            zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×4 有 ${CUBOID334_STATE_COUNT_STR} 个状态(facelet 群阶 ${CUBOID334_GROUP_ORDER_STR},均为 Schreier-Sims 实算),太大无法整图枚举。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。所以这里对 ${sampleN.toLocaleString()} 个 cstimer 同款随机打乱求解,把返回解的步数分桶 —— 主要是近最优、浅态为最优。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布在浏览器里算不出来。`,
            en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×4 has ${CUBOID334_STATE_COUNT_STR} states (facelet group order ${CUBOID334_GROUP_ORDER_STR}, both computed by Schreier-Sims), far too many to enumerate. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). So ${sampleN.toLocaleString()} cstimer-style random scrambles are solved and their returned lengths bucketed — mostly near-optimal, optimal for shallow states. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed in-browser.`,
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
