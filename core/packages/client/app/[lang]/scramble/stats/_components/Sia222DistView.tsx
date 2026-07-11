'use client';

// Siamese 2×2×2(联体 2×2×2)整解最优步数分布 —— **离线预计算的采样直方图**(非全空间精确曲线)。每半边是受限
// ⟨U,R,F⟩ 3×3×3(角轨道 3,674,160 + 棱轨道 92,897,280,半边群阶 170,659,735,142,400),联体直积后状态空间
// ≈2.9×10²⁸,无法整图枚举。分布由 build 脚本(scramble-stats-build/src/build_puzzle_sampled_dist.ts)**离线**采
// N 条 cstimer 同款随机打乱、逐条用按 z2 y 拆半 + 各半 IDA*(角+双 6 棱 PDB)**最优**求解、把解步数分桶,落静态
// stats/scramble/dist_sia222.json;本页**只 fetch + 渲染**,进页不做任何求解(铁律:TIER C/D 分布严禁现场采样)。
// 解是 per-half 最优拼接 = 全局最优,故质量桶 = 采样最优(sampled-optimal)。下载样本来自 JSON 内嵌 generatedSamples。
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';

const SIA222_COLOR = '#8338ec'; // 联体异形紫(数据色,非 UI 灰阶)
const V = '20260624';

interface DistJson {
  event: string;
  label: string;
  sampleCount: number;
  scrambleLen: number;
  quality: string;
  histogram: Record<string, number>;
  mean: number;
  median: number;
  min: number;
  max: number;
  maxBound?: number;
  optimalCount?: number;
  stateCountStr?: string;
  generatedSamples: { length: number; scramble: string; optimal: boolean }[];
  generated_at: string;
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Sia222DistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [json, setJson] = useState<DistJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(statsUrl('/stats/scramble/dist_sia222.json') + `?v=${V}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<DistJson>; })
      .then((d) => { if (alive) setJson(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);

  const counts = json?.histogram ?? {};
  const sampleCount = json?.sampleCount ?? 0;

  const examplesByLen = useMemo<Map<number, string[]>>(() => {
    const m = new Map<number, string[]>();
    for (const s of json?.generatedSamples ?? []) {
      const arr = m.get(s.length) ?? [];
      if (arr.length < 12) { arr.push(s.scramble); m.set(s.length, arr); }
    }
    return m;
  }, [json]);

  const stats = useMemo(() => {
    if (!json) return null;
    let mode = json.min, modeN = 0;
    for (const [len, n] of Object.entries(counts)) if (n > modeN) { modeN = n; mode = Number(len); }
    return { mean: json.mean, median: json.median, mode, min: json.min, max: json.max };
  }, [json, counts]);

  const exampleBins = useMemo(() => [...examplesByLen.keys()].sort((a, b) => a - b), [examplesByLen]);

  const effectiveBin = selectedBin
    ?? (stats && examplesByLen.has(stats.mode) ? stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin !== null ? (examplesByLen.get(effectiveBin) ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'sia222', scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: '联体 2×2×2(采样,最优)', en: 'Siamese 2×2×2 (sampled, optimal)' }),
    fillColors: [SIA222_COLOR],
    counts,
  }], [counts]);

  const downloadSample = () => {
    const lines = ['length,scramble,optimal'];
    for (const s of json?.generatedSamples ?? []) lines.push(`${s.length},${s.scramble},${s.optimal ? 1 : 0}`);
    downloadText('sia222_sample.csv', lines.join('\n'));
  };

  const stateCountStr = json?.stateCountStr ?? '29,124,745,198,874,117,548,277,760,000';

  if (error) {
    return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {error}</div>;
  }
  if (!json) {
    return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;
  }

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>
            {tr({
              zh: `${sampleCount.toLocaleString()} 条随机打乱样本(离线预计算,按 z2 y 拆半 + 各半 IDA* 最优,拼接=全局最优)`,
              en: `${sampleCount.toLocaleString()} random-scramble samples (precomputed offline, split at z2 y + per-half optimal IDA*, concatenation is globally optimal)`,
            })}
          </span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一个 token = 1 步', en: 'one token = 1 move' })}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ivy-dl-all" onClick={downloadSample} disabled={(json.generatedSamples?.length ?? 0) === 0}>
            <Download size={14} aria-hidden />
            {tr({ zh: '下载样本 (CSV)', en: 'Download sample (CSV)' })}
          </button>
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
          onBarClick={(b) => setSelectedBin(b)}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
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
                  <ScramblePreview2D event="sia222" scramble={scr} size={26} />
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
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计(随机态样本,per-half 最优)', en: 'Summary stats (random-state sample, per-half optimal)' })}</div>
          <div className="scramble-stats-stat-grid">
            <Cell label={tr({ zh: '样本均值', en: 'sample mean' })} value={stats.mean.toFixed(1)} />
            <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(stats.median)} />
            <Cell label={tr({ zh: '最小', en: 'min' })} value={String(stats.min)} />
            <Cell label={tr({ zh: '最大', en: 'max' })} value={String(stats.max)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: `这是【随机打乱的最优解长度】采样分布:联体 2×2×2 是两个 3×3×3 沿共享 2×2×2 块粘成的一体,实测整个群是直积 G = G_A × G_B(A/B 招式作用于互不相交的块且两两对易),共享块锁死每个立方各 3 个面 → 每半边都是受限 ⟨U,R,F⟩ 3×3×3。因此解法 = 把打乱按 z2 y 拆成 A、B 两块,各半边用 IDA*(角剪枝表 3,674,160 + 两张互补 6 棱剪枝表)独立求最优解,再拼接 —— 由直积结构,拼接长度 = 两半最优之和 = 全局最优。整体可达状态约 ${stateCountStr} 个,无法整图枚举,所以这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 条 cstimer 同款随机打乱求解后分桶,页面只读取预计算结果。剪枝表较大(~18.8MB 常驻),建议桌面端使用。`,
            en: `This is a SAMPLED distribution of the OPTIMAL solution length on random scrambles: the Siamese 2×2×2 is two 3×3×3 cubes glued at a shared 2×2×2 block. The whole group is a measured DIRECT PRODUCT G = G_A × G_B (cube-A and cube-B moves act on disjoint pieces and all commute); the shared block locks three faces of each cube, so EACH HALF is a restricted ⟨U,R,F⟩ 3×3×3. Solving therefore splits the scramble at z2 y into an A-block and a B-block, solves each half OPTIMALLY with IDA* (corner pattern database 3,674,160 + two complementary 6-edge databases), and concatenates — by the direct-product structure the concatenation's length is the sum of the two half-optima and is GLOBALLY OPTIMAL. The bonded puzzle has ~${stateCountStr} reachable states, far too many to enumerate, so this curve is precomputed offline by solving ${sampleCount.toLocaleString()} cstimer-style random scrambles; the page only reads the result. The databases are sizeable (~18.8MB resident) — desktop recommended.`,
          })}
        </span>
        <span>{tr({ zh: '生成时间', en: 'Generated' })}: {json.generated_at}</span>
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
