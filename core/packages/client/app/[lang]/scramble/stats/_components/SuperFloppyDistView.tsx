'use client';

// Super Floppy(超薄花型)整解最优步数分布 —— 理论全空间(全 3,041,280 态,精确枚举,非抽样)。
// 数据 = lib/superfloppy-solver 的 SUPERFLOPPY_LENGTH_DISTRIBUTION(与求解器页同一份),示例由
// superFloppyExamplesByLength 枚举每个步数档的真实状态、反推最短打乱生成(Super Floppy 不是 WCA
// 项目,没有比赛语料,但全状态空间可枚举)。态数 ~3M(>2M),故「下载全部」CSV 先 confirm + 流式生成
// (逐状态枚举 → 分块 Blob,峰值内存有界,不一次性拼 80MB 字符串);单步数 txt 也走流式(§0.5 下载策略)。
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import {
  SUPERFLOPPY_LENGTH_DISTRIBUTION, SUPERFLOPPY_GODS_NUMBER, SUPERFLOPPY_TOTAL_STATES,
  superFloppyExamplesByLength, streamSuperFloppyScrambles, superFloppyScramblesForLength,
} from '@/lib/superfloppy-solver';
import { tr } from '@/i18n/tr';

const SUPERFLOPPY_COLOR = '#3a86ff'; // 长方体蓝(数据色,非 UI 灰阶)

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Build a Blob from an iterable of lines without ever holding the whole text in one string. We batch
// lines into chunks of ~64k and push each chunk as a separate Blob part, so peak memory stays bounded
// even at ~3M lines (~80MB) — the browser concatenates the parts lazily inside the Blob.
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

export default function SuperFloppyDistView({ isZh }: { isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [dlBusy, setDlBusy] = useState(false);

  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    SUPERFLOPPY_LENGTH_DISTRIBUTION.forEach((n, d) => { c[String(d)] = n; });
    return c;
  }, []);

  const examples = useMemo(() => superFloppyExamplesByLength(12), []);
  const exampleBins = useMemo(
    () => Object.keys(examples).map(Number).sort((a, b) => a - b),
    [examples],
  );

  const st = useMemo(() => stats(counts), [counts]);

  // 默认选众数档。
  const effectiveBin = selectedBin ?? (st && exampleBins.includes(st.mode) ? st.mode : exampleBins[0] ?? null);

  const series = useMemo<HistSeries[]>(() => [{
    name: tr({ zh: 'Super Floppy', en: 'Super Floppy' }),
    fillColors: [SUPERFLOPPY_COLOR],
    counts,
  }], [counts]);

  const shown = effectiveBin !== null ? (examples[effectiveBin] ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: 'sfl', scramble: scr })}`;

  // 下载全部状态:CSV,按最优步数分类(含还原态一行 0,)。~3M 行 ~80MB:态数 >2M,默认不鼓励整包下,
  // 点击先 confirm,再流式生成(逐状态枚举 → 分块 Blob,峰值内存有界,绝不一次性拼 80MB 大字符串)。
  const downloadAll = () => {
    if (dlBusy) return;
    const ok = window.confirm(tr({
      zh: '将生成全部 3,041,280 个状态的 CSV(约 80MB,3M+ 行)。文件很大,生成期间页面可能短暂卡顿。继续?',
      en: 'This builds a CSV of all 3,041,280 states (~80MB, 3M+ rows). It is a large file and the page may briefly pause while building. Continue?',
    }));
    if (!ok) return;
    setDlBusy(true);
    // 让按钮态先刷新再做重活。
    setTimeout(() => {
      try {
        function* csvLines(): Generator<string> {
          yield 'optimal_length,scramble';
          for (const { depth, scramble } of streamSuperFloppyScrambles()) yield `${depth},${scramble}`;
        }
        downloadBlob('superfloppy_sfl_all_states.csv', blobFromLines(csvLines()));
      } finally {
        setDlBusy(false);
      }
    }, 30);
  };
  // 下载某步数全部:txt,每行一条打乱。大档(如 9/10 步各 ~1M 条)也走流式,不构建全 3M 记录。
  const downloadBin = (d: number) => {
    downloadBlob(`superfloppy_sfl_${d}-move.txt`, blobFromLines(superFloppyScramblesForLength(d)));
  };
  const binCount = effectiveBin !== null ? (SUPERFLOPPY_LENGTH_DISTRIBUTION[effectiveBin] ?? 0) : 0;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr({ zh: `全 ${SUPERFLOPPY_TOTAL_STATES.toLocaleString()} 态(精确枚举)`, en: `All ${SUPERFLOPPY_TOTAL_STATES.toLocaleString()} states (exact enumeration)` })}</span>
          <span className="scramble-stats-puzzle-metric">{tr({ zh: '一次转动 = 1 步(R/L/U/D 90°/180°/270°)', en: 'one turn = 1 move (R/L/U/D 90°/180°/270°)' })}</span>
        </div>
        <button
          type="button"
          className="ivy-dl-all"
          onClick={downloadAll}
          disabled={dlBusy}
          title={tr({ zh: '下载全部 ~3,041,279 条(约 80MB,生成需几秒)', en: 'Download all ~3,041,279 scrambles (~80MB, takes a few seconds to build)' })}
        >
          <Download size={14} aria-hidden />
          {dlBusy
            ? tr({ zh: '生成中…', en: 'Building…' })
            : tr({ zh: '下载全部状态 (CSV, ~80MB)', en: 'Download all states (CSV, ~80MB)' })}
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
                    <ScramblePreview2D event="sfl" scramble={scr} size={26} />
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
            <Cell label={tr({ zh: '上帝之数', en: "God's number" })} value={String(SUPERFLOPPY_GODS_NUMBER)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({
            zh: '理论全空间分布:Super Floppy 有 3,041,280 个状态(4 角在 12 位置的排列 11,880 × 4 个边各 4 朝向 256),整张图可一次性 BFS,这里是真值(非抽样)。它不是 WCA 项目,故无比赛打乱语料,示例由枚举状态反推最短打乱生成。',
            en: 'Theoretical full-space distribution: the Super Floppy has 3,041,280 states (11,880 placements of 4 corners over 12 positions × 256 edge orientations), so the whole graph is BFS-ed and this is exact (not sampled). It is not a WCA event, so examples are generated by enumerating states and inverting their shortest solution.',
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
