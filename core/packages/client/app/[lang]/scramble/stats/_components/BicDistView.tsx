'use client';

// Bicube(联体魔方)整解最优步数分布 —— 理论全空间(全 1,108,800 态,精确枚举,非抽样)。
// 分布数据 = lib/bicube-solver 的 BIC_DIST_HISTOGRAM(与求解器页同一份精确直方图,由整图 BFS 锁定;
// 这是烘焙常量,进页即画,不触发任何 BFS / 表加载)。
// 示例 / 下载用 TIER B 离线精确距离表:进页后 loadBicTable() 一次(fetch ~1.8MB opt_bic.bin.gz + inflate
// → 常驻 ~10MB 类型化数组),再从表枚举每档真实状态、梯度下降反推最短打乱(Bicube 不是 WCA 项目,无比赛
// 语料,但全状态空间可枚举)。God 数 28、均值 ≈ 18.80,出处 jaapsch.net。无浏览器现场 BFS。
// 态数 ~1.1M(<2M),「下载全部」CSV 先 confirm + 流式生成(分块 Blob,峰值内存有界)。
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  BIC_DIST_HISTOGRAM, BIC_GODS_NUMBER, BIC_STATE_COUNT,
  loadBicTable, bicExamplesByLengthFromTable, streamBicScramblesFromTable, bicScramblesForLengthFromTable,
  type BicTable,
} from '@/lib/bicube-solver';
import { tr } from '@/i18n/tr';

const BIC_COLOR = '#8338ec'; // 联体异形紫(数据色,非 UI 灰阶)

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 把行迭代器分块拼成 Blob,不一次性持有整串文本(~1.1M 行)。
function blobFromLines(lines: Iterable<string>): Blob {
  const parts: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    buf.push(line);
    if (buf.length >= 65536) { parts.push(buf.join('\n') + '\n'); buf = []; }
  }
  if (buf.length) parts.push(buf.join('\n'));
  return new Blob(parts, { type: 'text/plain;charset=utf-8' });
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

export default function BicDistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  // 直方图来自烘焙常量、进页即画;示例 / 下载需要 TIER B 精确距离表 → 进页后异步 loadBicTable() 一次。
  const [table, setTable] = useState<BicTable | null>(null);
  const [tableError, setTableError] = useState(false);
  const [examples, setExamples] = useState<Record<number, string[]> | null>(null);

  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    BIC_DIST_HISTOGRAM.forEach((n, d) => { c[String(d)] = n; });
    return c;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBicTable().then(
      (t) => {
        if (cancelled) return;
        setTable(t);
        setExamples(bicExamplesByLengthFromTable(t, 12)); // table-driven (no in-browser BFS)
      },
      () => { if (!cancelled) setTableError(true); },
    );
    return () => { cancelled = true; };
  }, []);

  const exampleBins = useMemo(
    () => (examples ? Object.keys(examples).map(Number).sort((a, b) => a - b) : []),
    [examples],
  );

  const st = useMemo(() => stats(counts), [counts]);

  // 默认选众数档(示例就绪后);未就绪时无可点档。
  const effectiveBin = selectedBin ?? (st && exampleBins.includes(st.mode) ? st.mode : exampleBins[0] ?? null);

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: 'Bicube', en: 'Bicube' }),
    fillColors: [BIC_COLOR],
    counts,
  }], [counts]);

  const shown = effectiveBin !== null && examples ? (examples[effectiveBin] ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'bic', scramble: scr })}`;

  // 下载全部状态:CSV,按最优步数分类(含还原态一行 0,)。~1.1M 行:从已加载的精确距离表流式生成
  // (逐状态 → 分块 Blob,峰值内存有界,不一次性拼大字符串)。点击先 confirm(表已加载,不再现场 BFS)。
  const downloadAll = () => {
    if (dlBusy || !table) return;
    const t = table; // capture non-null for the deferred generator closure
    const ok = window.confirm(tr({
      zh: '将生成全部 1,108,800 个状态的 CSV(约 1.1M 行)。从已加载的距离表逐状态流式生成,生成期间页面可能短暂卡顿。继续?',
      en: 'This builds a CSV of all 1,108,800 states (~1.1M rows), streamed from the loaded distance table. The page may briefly pause while generating. Continue?',
    }));
    if (!ok) return;
    setDlBusy(true);
    setTimeout(() => {
      try {
        function* csvLines(): Generator<string> {
          yield 'optimal_length,scramble';
          for (const { depth, scramble } of streamBicScramblesFromTable(t)) yield `${depth},${scramble}`;
        }
        downloadBlob('bicube_bic_all_states.csv', blobFromLines(csvLines()));
      } finally {
        setDlBusy(false);
      }
    }, 30);
  };
  // 下载某步数全部:txt,每行一条打乱(流式,从已加载的表)。
  const downloadBin = (d: number) => {
    if (!table) return;
    downloadBlob(`bicube_bic_${d}-move.txt`, blobFromLines(bicScramblesForLengthFromTable(table, d)));
  };
  const binCount = effectiveBin !== null ? (BIC_DIST_HISTOGRAM[effectiveBin] ?? 0) : 0;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: `全 ${BIC_STATE_COUNT.toLocaleString()} 态(精确枚举)`, en: `All ${BIC_STATE_COUNT.toLocaleString()} states (exact enumeration)` })}</span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一次转动 = 1 步(U/F/L/R 90°/180°/270°)', en: 'one turn = 1 move (U/F/L/R 90°/180°/270°)' })}</span>
        </div>
        <button
          type="button"
          className="ivy-dl-all"
          onClick={downloadAll}
          disabled={dlBusy || !table}
          title={tr({ zh: '下载全部 1,108,799 条(约 1.1M 行,生成需几秒)', en: 'Download all 1,108,799 scrambles (~1.1M rows, takes a few seconds to build)' })}
        >
          <Download size={14} aria-hidden />
          {dlBusy
            ? tr({ zh: '生成中…', en: 'Building…' })
            : tr({ zh: '下载全部状态 (CSV)', en: 'Download all states (CSV)' })}
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

      {tableError ? (
        <div className="scramble-stats-examples-hint">
          {tr({ zh: '距离表加载失败,示例与下载暂不可用(直方图不受影响)。', en: 'Failed to load the distance table — examples and downloads are unavailable (the histogram is unaffected).' })}
        </div>
      ) : examples === null ? (
        <div className="scramble-stats-examples-hint">
          {tr({ zh: '正在加载精确距离表并生成示例…', en: 'Loading the exact-distance table and generating examples…' })}
        </div>
      ) : effectiveBin !== null && (
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
                    <ScramblePreview2D event="bic" scramble={scr} size={26} />
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
            <Cell label={tr({ zh: '上帝之数', en: "God's number" })} value={String(BIC_GODS_NUMBER)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: '理论全空间分布:Bicube(联体魔方,Uwe Meffert 受限 3×3×3)的可达状态恰为 1,108,800 个,这里是精确枚举的真值(非抽样)。每态的精确最优距离已离线算好成距离表;每条打乱给出可证最短解,上帝之数 28(面转计步;出处 jaapsch.net),均值约 18.80。它不是 WCA 项目,故无比赛打乱语料,示例由枚举状态反推最短打乱生成。记号 U F L R 与 cstimer 一致。',
            en: 'Theoretical full-space distribution: the Bicube (the original bandaged 3×3×3 by Uwe Meffert) has exactly 1,108,800 reachable states; this is the exact enumeration (not sampled). The exact optimal distance of every state is precomputed offline into a distance table; every solution is a provably shortest path. God\'s number is 28 (face-turn metric; figure from jaapsch.net), mean ≈ 18.80. It is not a WCA event, so examples are generated by enumerating states and inverting their shortest solution. Notation U F L R matches cstimer.',
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
