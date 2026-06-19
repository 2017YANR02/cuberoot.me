'use client';

// 非 3x3 puzzle 整解最优步数分布展示(EPIC 3 新管线的消费 UI)。
// 由难度 tab 的共享 WCA 项目选择器驱动:选中二阶/金字塔/斜转 → 传入对应 puzzleKey。
// 数据 = stats/scramble/puzzle_distribution.json(pocket / pyraminx / skewb;sq1 待 P5d)。
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { formatScrambleForEvent } from '@/app/[lang]/scramble/gen/_svg/sq1_svg';
import PillToggle from '@/components/PillToggle/PillToggle';
import { VariantSelect } from '@/components/VariantSelect';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2 } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import {
  fetchPuzzleDistribution, type PuzzleDistributionJson, type PuzzleHistEntry,
} from '@/lib/puzzle-distribution';
import {
  fetchPuzzleExamples, type PuzzleExamplesEntry,
} from '@/lib/puzzle-examples';
import { tr } from '@/i18n/tr';

// puzzle key → 在线求解器路由名(sq1 无求解器页 → 不在表里 → 示例卡不可点)。
const PUZZLE_ROUTE: Record<string, string> = { pocket: 'pocket', pyraminx: 'pyraminx', skewb: 'skewb' };
// 2D 预览用的 WCA event_id。
const PUZZLE_EVENT: Record<string, string> = { pocket: '222', pyraminx: 'pyram', skewb: 'skewb', sq1: 'sq1' };

// 每个 puzzle 一个数据色(图表填充,非 UI 灰阶);沿用魔方色系。
const PUZZLE_COLOR: Record<string, string> = {
  pocket: '#f04f4f',   // 红
  pyraminx: '#2ec27e', // 绿
  skewb: '#3d7bf0',    // 蓝
  sq1: '#9b6ef0',      // 紫
};

// sq1 2×2 之「解法目标」下拉选项(对齐主页「方法/阶段」下拉的渲染)。
const SQ1_METRIC_OPTIONS = ['wca', 'slash'] as const;
function sq1MetricLabel(key: string): string {
  if (key === 'slash') return tr({ zh: 'slash 最优解', en: 'slash-optimal' });
  return tr({ zh: 'WCA 最优解', en: 'WCA-optimal' });
}

// sq1 2×2 当前格(解法目标 target × 计步单位 unit)的口径说明。
function sq1CellNote(target: 'wca' | 'slash', unit: 'wca' | 'slash', provisional: boolean): { zh: string; en: string } {
  if (unit === 'wca') {
    if (target === 'slash') {
      return {
        zh: 'slash 最优解的 WCA 12c4 步数 ≡ WCA 最优步数(省算定理:slash 最优解总能取到 WCA 最优)',
        en: 'WCA-12c4 length of the slash-optimal solution ≡ WCA-optimal length',
      };
    }
    return { zh: 'WCA 12c4 最优解步数((X,Y) 计 1、/ 计 1)', en: 'WCA-12c4-optimal length ((X,Y)=1, /=1)' };
  }
  if (target === 'slash') {
    return provisional
      ? {
          zh: 'slash 最优解的 / 数(twist 口径,God 13);最深约 4.3% 的态真最优计算中,当前取紧上界',
          en: 'slashes in the slash-optimal solution (twist, God 13); deepest ~4.3% still being solved, tight upper bound shown',
        }
      : {
          zh: 'slash 最优解的 / 数(twist 口径,God 13,可证最优)',
          en: 'slashes in the slash-optimal solution (twist metric, God 13, provably optimal)',
        };
  }
  return { zh: 'WCA 最优解里的 / 数(WCA 最优前提下的 slash 含量,≥ slash 最优)', en: 'slashes inside the WCA-optimal solution (≥ slash-optimal)' };
}

// 度量说明(顶点等口径)。sq1 = 可证 WCA 12c4 最优(近最优档已退役);按选中口径 wca / slash 给说明。
function metricNote(key: string, metric: string): { zh: string; en: string; } {
  if (key === 'pyraminx') {
    return { zh: 'HTM,含顶点(tips)', en: 'HTM, tips included' };
  }
  if (key === 'sq1') {
    if (metric === 'slash') {
      // slash = slash 最优(twist 口径,只数 /;God 13)。4.29% 歧义态(W=2s-1)真最优计算中,当前取紧上界。
      return { zh: 'slash 最优:只数 /(twist 口径,God 13);约 4.3% 最深态真最优计算中,当前紧上界', en: "slash-optimal: fewest slashes (twist, God 13); deepest ~4.3% still being solved (upper bound)" };
    }
    return { zh: 'WCA 12c4 计步((X,Y) 计 1、/ 计 1)', en: 'WCA 12c4 ((X,Y) = 1, / = 1)' };
  }
  return { zh: 'HTM', en: 'HTM' };
}

function stats(counts: Record<string, number>) {
  const entries = Object.entries(counts)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  let total = 0, sum = 0, mode = entries[0][0], modeN = 0;
  for (const [x, v] of entries) {
    total += v;
    sum += x * v;
    if (v > modeN) { modeN = v; mode = x; }
  }
  const pct = (p: number) => {
    const target = total * p;
    let cum = 0;
    for (const [x, v] of entries) { cum += v; if (cum >= target) return x; }
    return entries[entries.length - 1][0];
  };
  return {
    mean: total > 0 ? sum / total : 0,
    median: pct(0.5),
    mode,
    min: entries[0][0],
    max: entries[entries.length - 1][0],
    p90: pct(0.9),
  };
}

export default function PuzzleDistView({ isZh, puzzleKey }: { isZh: boolean; puzzleKey: string }) {
  const [json, setJson] = useState<PuzzleDistributionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [examples, setExamples] = useState<Record<string, PuzzleExamplesEntry> | null>(null);
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  // sq1 双口径:'wca'(WCA 12c4,主)/ 'slash'(jaapsch twist)。仅 sq1 有 alt。
  const [sq1Metric, setSq1Metric] = useState<'wca' | 'slash'>('wca'); // 解法目标(下拉)
  const [sq1Unit, setSq1Unit] = useState<'wca' | 'slash'>('wca');     // 计步单位(toggle)
  // 示例:原始比赛打乱 vs 最优(最短)等价打乱(同状态)。仅当样例带最优数据时露切换。
  const [exView, setExView] = useState<'orig' | 'opt'>('orig');

  useEffect(() => {
    let alive = true;
    fetchPuzzleDistribution()
      .then((d) => { if (alive) setJson(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    fetchPuzzleExamples()
      .then((d) => { if (alive) setExamples(d.puzzles); })
      .catch(() => { /* 示例缺失不阻塞直方图 */ });
    return () => { alive = false; };
  }, []);

  const entry = json?.puzzles[puzzleKey];
  const exEntry = examples?.[puzzleKey];

  const hasAlt = !!entry?.alt;
  const slashProvisional = entry?.alt?.provisional ?? true;
  // sq1 2×2:target(解法目标)× unit(计步单位)。四格:
  //  unit=wca            → dist(W);两 target 同(省算定理:slash 最优解的 WCA 步数 ≡ WCA 最优步数)
  //  unit=slash,target=slash → alt.dist(t,真 slash 最优)
  //  unit=slash,target=wca   → wcaOptSlash(s,WCA 最优解的 slash 含量,≥ t)
  const target = sq1Metric;
  const unit = sq1Unit;
  const activeDist: PuzzleHistEntry | undefined =
    unit === 'wca' ? entry?.dist
      : target === 'slash' ? entry?.alt?.dist
        : (entry?.wcaOptSlash ?? entry?.alt?.dist);
  const activeMetricKey: string = unit === 'wca' ? (entry?.metric ?? 'wca') : (entry?.alt?.metric ?? 'slash');
  // 示例分桶:W→bins;t→binsAlt;s(格3)暂无专属示例分桶 → 不显示例。
  const activeBins: PuzzleExamplesEntry['bins'] | undefined =
    unit === 'wca' ? exEntry?.bins
      : target === 'slash' ? exEntry?.binsAlt
        : undefined;

  const series = useMemo<HistSeries[]>(() => {
    if (!entry || !activeDist) return [];
    const label = (isZh && entry.label_zh) ? entry.label_zh : entry.label;
    return [{ name: label, fillColors: [PUZZLE_COLOR[puzzleKey] ?? '#888888'], counts: activeDist.counts }];
  }, [entry, activeDist, puzzleKey, isZh]);

  const st = useMemo(() => (activeDist ? stats(activeDist.counts) : null), [activeDist]);

  // 有示例的 bin(可点击);默认选中众数 bin(无则取第一个有示例 bin)。
  const exampleBins = useMemo(
    () => (activeBins ? Object.keys(activeBins).map(Number).sort((a, b) => a - b) : []),
    [activeBins],
  );
  useEffect(() => {
    setSelectedBin(null); // 切 puzzle / 口径时清空,等下个 effect 按新数据重选
  }, [puzzleKey, sq1Metric, sq1Unit]);
  useEffect(() => {
    if (exampleBins.length === 0) return;
    setSelectedBin((prev) => {
      if (prev !== null && exampleBins.includes(prev)) return prev;
      if (st && exampleBins.includes(st.mode)) return st.mode;
      return exampleBins[0];
    });
  }, [exampleBins, st]);

  if (error) {
    return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {error}</div>;
  }
  if (!json) {
    return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;
  }
  if (!entry) {
    return (
      <div className="scramble-stats-loading">
        {tr({ zh: '该项目难度数据生成中,稍后再来', en: 'Difficulty data for this puzzle is being generated, check back soon' })}
      </div>
    );
  }

  const note = (puzzleKey === 'sq1' && hasAlt)
    ? sq1CellNote(target, unit, slashProvisional)
    : metricNote(puzzleKey, activeMetricKey);
  const total = entry.sample_count;
  const sampleLine = tr({ zh: '{n} 条样本', en: '{n} samples' }).replace('{n}', total.toLocaleString());

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{sampleLine}</span>
          <span className="scramble-stats-puzzle-metric">{tr(note)}</span>
        </div>
        {hasAlt && (
          <>
            <label>
              <VariantSelect
                value={sq1Metric}
                options={SQ1_METRIC_OPTIONS}
                onChange={(v) => setSq1Metric(v as 'wca' | 'slash')}
                isZh={isZh}
                label={sq1MetricLabel}
                ariaLabel={tr({ zh: 'SQ1 解法目标:WCA 最优解或 slash 最优解', en: 'SQ1 solution target: WCA-optimal or slash-optimal' })}
              />
            </label>
            <div className="scramble-stats-puzzle-toggle">
              <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '计步', en: 'Count' })}</span>
              <PillToggle
                value={sq1Unit === 'slash'}
                onChange={(v) => setSq1Unit(v ? 'slash' : 'wca')}
                offLabel={tr({ zh: 'WCA 步', en: 'WCA' })}
                onLabel={tr({ zh: 'slash', en: 'slash' })}
                ariaLabel={tr({ zh: 'SQ1 计步单位:WCA 12c4 步数或 slash 数', en: 'SQ1 count unit: WCA-12c4 moves or slashes' })}
              />
            </div>
          </>
        )}
      </div>

      {puzzleKey === 'sq1' && hasAlt && unit === 'slash' && target === 'slash' && slashProvisional && (
        <p className="scramble-stats-provisional">
          {tr({
            zh: 'slash 数当前为紧上界:最深约 4.3% 的态(s=11、12)真 slash 最优正在精确求解,已验证的全部 = 此上界、暂无更优解。',
            en: 'Slashes shown are a tight upper bound: the deepest ~4.3% of states (s=11,12) are still being solved exactly; everything verified so far equals this bound.',
          })}
        </p>
      )}

      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={series}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          clickableBins={exampleBins}
          selectedBin={selectedBin}
          onBarClick={(b) => setSelectedBin(b)}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          yModeLabel={yMode === 'percent' ? tr({ zh: '百分比', en: '%' }) : tr({ zh: '数量', en: 'count' })}
        />
      </div>

      {exEntry && activeBins && selectedBin !== null && (
        <PuzzleExamplesPanel
          isZh={isZh}
          puzzleKey={puzzleKey}
          selectedBin={selectedBin}
          bins={activeBins}
          comps={exEntry.comps}
          idMeta={exEntry.idMeta}
          exView={exView}
          onExView={setExView}
        />
      )}

      {st && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计', en: 'Summary stats' })}</div>
          <div className="scramble-stats-stat-grid">
            <Cell label={tr({ zh: '均值', en: 'mean' })} value={st.mean.toFixed(2)} />
            <Cell label={tr({ zh: '中位数', en: 'median' })} value={String(st.median)} />
            <Cell label={tr({ zh: '众数', en: 'mode' })} value={String(st.mode)} />
            <Cell label={tr({ zh: '最优', en: 'min' })} value={String(st.min)} />
            <Cell label={tr({ zh: '最难', en: 'max' })} value={String(st.max)} />
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({ zh: '生成时间', en: 'Generated' })}: {json.meta.generated_at}
        </span>
        <span>
          {puzzleKey === 'sq1' && hasAlt
            ? tr(slashProvisional ? {
              zh: '两维口径:解法目标(WCA 最优解 / slash 最优解)× 计步单位(WCA 12c4 步数 / slash 数)。注:slash 最优解的 WCA 步数恒等于 WCA 最优步数(省算定理),故「slash 最优解 × WCA 步」与「WCA 最优解 × WCA 步」同图。slash 数中 95.71% 由省算定理免搜索证明,余 4.29% 最深态真最优计算中(当前取紧上界)。',
              en: 'Two axes: solution target (WCA- / slash-optimal) × count unit (WCA-12c4 moves / slashes). Note: a slash-optimal solution always attains the WCA-optimal length, so "slash-optimal × WCA moves" equals "WCA-optimal × WCA moves". 95.71% of slash counts are proven search-free; the deepest 4.29% are still being solved exactly (upper bound for now).',
            } : {
              zh: '两维口径:解法目标(WCA 最优解 / slash 最优解)× 计步单位(WCA 12c4 步数 / slash 数)。注:slash 最优解的 WCA 步数恒等于 WCA 最优步数(省算定理),故「slash 最优解 × WCA 步」与「WCA 最优解 × WCA 步」同图。slash 数全部可证最优(95.71% 省算定理免搜索 + 4.29% 最深态精确求解)。',
              en: 'Two axes: solution target (WCA- / slash-optimal) × count unit (WCA-12c4 moves / slashes). Note: a slash-optimal solution always attains the WCA-optimal length, so "slash-optimal × WCA moves" equals "WCA-optimal × WCA moves". All slash counts are provably optimal (95.71% search-free + deepest 4.29% solved exactly).',
            })
            : tr({ zh: '口径:整个打乱的最优解步数', en: 'Metric: optimal solution length per scramble' })}
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

// 点某步数后展示该 bin 的真实比赛打乱示例(对等 3x3 难度 tab 的 ExamplesPanel,去掉底色 chip)。
// 点打乱图/打乱文字 → 跳该 puzzle 的在线求解器并带入打乱。
function PuzzleExamplesPanel({
  isZh,
  puzzleKey,
  selectedBin,
  bins,
  comps,
  idMeta,
  exView,
  onExView,
}: {
  isZh: boolean;
  puzzleKey: string;
  selectedBin: number;
  bins: NonNullable<PuzzleExamplesEntry['bins']>;
  comps: PuzzleExamplesEntry['comps'];
  idMeta: PuzzleExamplesEntry['idMeta'];
  exView: 'orig' | 'opt';
  onExView: (v: 'orig' | 'opt') => void;
}) {
  const route = PUZZLE_ROUTE[puzzleKey];
  const hasSolver = !!route; // sq1 无在线求解器页 → 示例卡不可点,纯展示
  const previewEvent = PUZZLE_EVENT[puzzleKey] ?? '333';
  const rawSamples = bins[String(selectedBin)] ?? [];
  // 该 bin 样例确有最优等价打乱时才露切换(sq1 等无解列的 puzzle 自动隐藏)。
  const hasOpt = rawSamples.some((s) => !!s[2]);
  // 按比赛时间倒序(最新在前):有 comp 日期串按它,无则退回打乱 id(≈ 入库时间序),都取倒序。
  const dateOf = (id: string) => comps[idMeta[id]?.[0] ?? '']?.[1] ?? '';
  const samples = [...rawSamples].sort((a, b) => {
    const d = dateOf(b[0]).localeCompare(dateOf(a[0]));
    return d !== 0 ? d : (Number(b[0]) - Number(a[0]));
  });
  const solverHref = (scr: string) =>
    `/scramble/${route}?${new URLSearchParams({ scramble: scr.trim() })}`;

  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {tr({ zh: '{n} 步示例', en: '{n}-move examples' }).replace('{n}', String(selectedBin))}
        </div>
        {hasOpt && (
          <PillToggle
            value={exView === 'opt'}
            onChange={(v) => onExView(v ? 'opt' : 'orig')}
            offLabel={tr({ zh: '原始', en: 'Original' })}
            onLabel={tr({ zh: '最优', en: 'Optimal'
            })}
            ariaLabel={tr({ zh: '原始打乱或最优等价打乱', en: 'Original scramble or optimal equivalent'
            })}
          />
        )}
      </div>
      {samples.length > 0 ? (
        <ul className="scramble-stats-examples-list">
          {samples.map(([id, scr, opt], i) => {
            const m = idMeta[id];
            const comp = m ? comps[m[0]] : undefined;
            // 最优视图:用最短等价打乱(同状态),无数据回退原始。预览/跳转都跟当前视图。
            const shown = (exView === 'opt' && opt ? opt : scr).trim();
            const preview = <ScramblePreview2D event={previewEvent} scramble={shown} size={26} />;
            // sq1 显示用简写记号(0 2/4 -5/...),其它 event 原样;SVG 预览仍喂原始串。
            const display = formatScrambleForEvent(previewEvent, shown);
            return (
              <li key={i}>
                {hasSolver ? (
                  <Link
                    className="scramble-stats-examples-cube"
                    href={solverHref(shown)}
                    prefetch={false}
                    aria-label={tr({ zh: '打乱图', en: 'Scramble image' })}
                  >
                    {preview}
                  </Link>
                ) : (
                  <span className="scramble-stats-examples-cube">{preview}</span>
                )}
                <div className="scramble-stats-examples-body">
                  {hasSolver ? (
                    <Link
                      className="scramble-stats-examples-scramble"
                      href={solverHref(shown)}
                      prefetch={false}
                    >
                      {display}
                    </Link>
                  ) : (
                    <span className="scramble-stats-examples-scramble">{display}</span>
                  )}
                  {comp && m && (() => {
                    const iso2 = compFlagIso2(m[0]);
                    return (
                      <Link
                        className="scramble-stats-examples-comp"
                        href={`/scramble/gen?comp=${encodeURIComponent(m[0])}`}
                        prefetch={false}
                        title={comp[0]}
                      >
                        {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                        <span className="scramble-stats-examples-comp-name">{localizeCompName(m[0], comp[0], isZh)}</span>
                        <span className="scramble-stats-examples-comp-meta">
                          <span>{compSourceLine(m[3], m[4], m[2], isZh, !!m[5])}</span>
                        </span>
                      </Link>
                    );
                  })()}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="scramble-stats-examples-hint">
          {tr({ zh: '此步数无示例', en: 'No examples for this length' })}
        </div>
      )}
    </div>
  );
}
