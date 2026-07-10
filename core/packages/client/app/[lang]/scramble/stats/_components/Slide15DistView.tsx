'use client';

// 数字华容道(15-Puzzle)整解最优步数分布 —— **采样**(不是全空间精确直方图)。
// 15 数码状态空间 ≈ 1.05×10¹³(16!/2),无法像 8 数码那样整图枚举,所以这里在浏览器里现场解 N 个
// 均匀随机(可复现,seeded)的合法(可解)状态,把 IDA* 求出的最优步数分桶。**这是抽样估计**:峰值/均值
// 会逼近文献已知的真值(上帝之数 80,随机态均值 ≈ 52.6),但**不是**像 TIER A/B 那样的精确全空间曲线。
// 单条深态求解可能要一两秒(个别更久),所以采样异步分批跑、显示进度、可取消;下载提供「下载样本」CSV
//(optimal_length,scramble),不提供「下载全部状态」(10¹³ 态不可枚举)。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  solveSlide15Grid, SLIDE15_GODS_NUMBER, SLIDE15_MEAN_OPTIMAL, SLIDE15_STATE_COUNT_APPROX,
} from '@/lib/slide15-solver';
import { tr } from '@/i18n/tr';

const SLIDE15_COLOR = '#3a86ff'; // 数据蓝(非 UI 灰阶)
const DEFAULT_SAMPLE = 400;      // 默认采样个数(均匀随机态,异步分批,可重采/取消)
const BATCH = 1;                 // 每个 macrotask 只解 1 个:均匀深态单条可能很慢,逐个让出主线程保响应

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 可复现 PRNG(seeded):同一 seed → 同一组采样,样本可下载、可复算。
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 一个均匀随机的【合法(可解)】15 数码状态:对 0..15 做 Fisher-Yates 洗牌,只接受满足 15 数码可解判据
//(棋盘内逆序数 + 空格所在行(自底数)同奇偶)的排列 —— 与 cstimer rndPerm 同口径,故采样逼近真·均匀分布。
function inversions(seq: number[]): number {
  let inv = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) inv++;
  return inv;
}
function randomSolvableGrid(rnd: () => number): number[] {
  for (;;) {
    const g = Array.from({ length: 16 }, (_, i) => i);
    for (let i = 15; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    const blank = g.indexOf(15);
    const blankRowFromBottom = 4 - Math.floor(blank / 4);
    const tiles = g.filter((x) => x !== 15);
    if ((inversions(tiles) + blankRowFromBottom) % 2 === 0) return g;
  }
}

// 把一个状态变成一条「从还原态出发的打乱字符串」:解出它的最优解,再把该解整体取逆即得 —— 应用这条打乱
// 后正好得到该状态(scramble ∘ 该状态的解 = solved 由求解器保证),供示例点进求解器复现。
const INV_TOK: Record<string, string> = { U: 'D', D: 'U', L: 'R', R: 'L' };
function solutionToScramble(solution: string): string {
  if (!solution) return '';
  return solution.split(/\s+/).filter(Boolean).reverse().map((t) => INV_TOK[t]).join(' ');
}

interface Sample { scramble: string; length: number; }

export default function Slide15DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const sampleN = DEFAULT_SAMPLE;
  const [seed, setSeed] = useState(0xC0FFEE);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const examplesRef = useRef<Map<number, string[]>>(new Map());
  const cancelRef = useRef(false);

  const run = useCallback((useSeed: number) => {
    cancelRef.current = false;
    setRunning(true);
    setDone(0);
    setSamples([]);
    setSelectedBin(null);
    examplesRef.current = new Map();
    const rnd = mulberry32(useSeed);
    const collected: Sample[] = [];
    const examples = new Map<number, string[]>();

    const step = () => {
      if (cancelRef.current) { setRunning(false); return; }
      const end = Math.min(collected.length + BATCH, sampleN);
      for (let i = collected.length; i < end; i++) {
        const grid = randomSolvableGrid(rnd);
        let out;
        try {
          out = solveSlide15Grid(grid);
        } catch {
          continue;
        }
        const scramble = solutionToScramble(out.solution);
        collected.push({ scramble, length: out.length });
        const ex = examples.get(out.length) ?? [];
        if (ex.length < 12 && scramble) { ex.push(scramble); examples.set(out.length, ex); }
      }
      setDone(collected.length);
      if (collected.length < sampleN) {
        window.setTimeout(step, 0);
      } else {
        examplesRef.current = examples;
        setSamples(collected.slice());
        setRunning(false);
      }
    };
    window.setTimeout(step, 0);
  }, [sampleN]);

  // 进页自动跑一次默认样本。
  useEffect(() => {
    run(0xC0FFEE);
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
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: '15p', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '数字华容道(采样)', en: '15-Puzzle (sampled)' }),
    fillColors: [SLIDE15_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['optimal_length,scramble'];
    for (const s of samples) lines.push(`${s.length},${s.scramble}`);
    downloadText('slide15_15p_sample.csv', lines.join('\n'));
  };

  const reSample = () => {
    if (running) { cancelRef.current = true; setRunning(false); return; }
    const ns = (seed + 0x9E3779B1) | 0;
    setSeed(ns);
    run(ns);
  };

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>
            {tr({
              zh: `采样 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个均匀随机状态(非全空间)`,
              en: `Sampled ${done.toLocaleString()} / ${sampleN.toLocaleString()} uniform-random states (not full-space)`,
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一次滑动 = 1 步(U/D/L/R)', en: 'one slide = 1 move (U/D/L/R)' })}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ivy-dl-all" onClick={reSample}>
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
            zh: `求解 ${done.toLocaleString()} / ${sampleN.toLocaleString()} 个均匀随机状态…(每个用 IDA* 现场求最优解,深态稍慢)`,
            en: `Solving ${done.toLocaleString()} / ${sampleN.toLocaleString()} uniform-random states… (each solved on demand by IDA*; deep states are slower)`,
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
                      <ScramblePreview2D event="15p" scramble={scr} size={26} />
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
              <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(样本)', en: 'Summary stats (sample)' })}</div>
              <div className="scramble-stats-stat-grid">
                <Cell label={tr({ zh: '样本均值', en: 'sample mean' })} value={stats.mean.toFixed(2)} />
                <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(stats.median)} />
                <Cell label={tr({ zh: '上帝之数', en: "God's number" })} value={String(SLIDE15_GODS_NUMBER)} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是采样估计,不是全空间精确分布:15 数码有约 ${SLIDE15_STATE_COUNT_APPROX.toLocaleString()} 个状态(16! 的一半),不可能像 8 数码那样整图枚举,所以这里现场解了 ${sampleN.toLocaleString()} 个均匀随机状态再分桶(样本量越大越逼近真值)。已知事实:上帝之数 = 80,随机态最优步数均值 ≈ ${SLIDE15_MEAN_OPTIMAL}(Korf & Schultze, 2005)。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
            en: `This is a SAMPLED estimate, not the exact full-space distribution: the 15-puzzle has ≈ ${SLIDE15_STATE_COUNT_APPROX.toLocaleString()} states (half of all 16! permutations), far too many to enumerate like the 8-puzzle, so ${sampleN.toLocaleString()} uniform-random states were solved on the fly and bucketed (a larger sample converges to the truth). Known facts: God's number = 80; the mean optimal length over random states is ≈ ${SLIDE15_MEAN_OPTIMAL} (Korf & Schultze, 2005). It is not a WCA event; the examples are the actual sampled random scrambles.`,
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
