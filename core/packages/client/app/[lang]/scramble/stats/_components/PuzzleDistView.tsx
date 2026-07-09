'use client';

// 非 3x3 puzzle 整解最优步数分布展示(EPIC 3 新管线的消费 UI)。
// 由难度 tab 的共享 WCA 项目选择器驱动:选中二阶/金字塔/斜转 → 传入对应 puzzleKey。
// 数据 = stats/scramble/puzzle_distribution.json(222 / pyraminx / skewb;sq1 待 P5d)。
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { formatScrambleForEvent } from '@/app/[lang]/scramble/gen/_svg/sq1_svg';
import PillToggle from '@/components/PillToggle/PillToggle';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import CountryShareBar from '@/components/CountryShareBar/CountryShareBar';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2, compCountryId, countryToIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { compSourceLine } from '@/lib/comp-schedule';
import {
  fetchPuzzleDistribution, type PuzzleDistributionJson, type PuzzleHistEntry,
} from '@/lib/puzzle-distribution';
import {
  fetchPuzzleExamples, type PuzzleExamplesEntry,
} from '@/lib/puzzle-examples';
import { tr } from '@/i18n/tr';

// puzzle key → 在线求解器路由名(sq1 无求解器页 → 不在表里 → 示例卡不可点)。
const PUZZLE_ROUTE: Record<string, string> = { '222': '222', pyraminx: 'pyraminx', skewb: 'skewb' };
// 2D 预览用的 WCA event_id。
const PUZZLE_EVENT: Record<string, string> = { '222': '222', pyraminx: 'pyram', skewb: 'skewb', sq1: 'sq1' };

// 每个 puzzle 一个数据色(图表填充,非 UI 灰阶);沿用魔方色系。
const PUZZLE_COLOR: Record<string, string> = {
  '222': '#f04f4f',   // 红
  pyraminx: '#2ec27e', // 绿
  skewb: '#3d7bf0',    // 蓝
  sq1: '#9b6ef0',      // 紫
};

// sq1 口径说明(单 toggle:WCA 12c4 步数 / slash 最优 / 数)。
function sq1Note(unit: 'wca' | 'slash', provisional: boolean, residual: number): { zh: string; en: string } {
  if (unit === 'wca') {
    return { zh: 'WCA 12c4 最优解步数((X,Y) 计 1、/ 计 1)', en: 'WCA-12c4-optimal length ((X,Y)=1, /=1)' };
  }
  return provisional
    ? {
        zh: `slash 最优解的 / 数(twist 度量,God 13);最深 ${residual} 条穷尽证明不可行、取紧上界,其余全部可证最优`,
        en: `slashes of the slash-optimal solution (twist, God 13); the deepest ${residual} states are infeasible to prove exhaustively (tight upper bound), all others provably optimal`,
      }
    : {
        zh: 'slash 最优解的 / 数(twist 度量,God 13);t = s,WCA 最优解同时也是 slash 最优解',
        en: 'slashes of the slash-optimal solution (twist, God 13); t = s — the WCA-optimal solution is also slash-optimal',
      };
}

// sq1 复形(cubeshape)口径说明:把顶底两层还原成正方形(立方体形状)的最少 slash 数,中层不计。
function cubeshapeNote(): { zh: string; en: string } {
  return {
    zh: '复形:把顶底两层还原成正方形(立方体形状)所需的最少 slash(/)数,不含中层;slash 之间转层免费、不计步(God 7)',
    en: 'Cube shape: fewest slashes (/) to make both layers square (cube shape), equator ignored; top/bottom turns between slashes are free (God\'s number 7)',
  };
}

// 度量说明(顶点等口径)。sq1 = 可证 WCA 12c4 最优(近最优档已退役);按选中口径 wca / slash 给说明。
function metricNote(key: string, metric: string): { zh: string; en: string; } {
  if (key === 'pyraminx') {
    return { zh: 'HTM,含顶点(tips)', en: 'HTM, tips included' };
  }
  if (key === 'sq1') {
    if (metric === 'slash') {
      // slash = slash 最优(twist 度量,只数 /;God 13)。4.29% 歧义态(W=2s-1)绝大多数已证 t=s,极少数最深态穷尽证明不可行 → 紧上界。
      return { zh: 'slash 最优:只数 /(twist 度量,God 13);极少数最深态穷尽证明不可行,取紧上界', en: "slash-optimal: fewest slashes (twist, God 13); a few deepest states are infeasible to prove exhaustively (upper bound)" };
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
  // sq1 求解目标(下拉):'full'(完整魔方,= 现有 WCA/slash 整解口径)/ 'cubeshape'(复形,到 cube
  // shape 最少 slash 数)。仅 sq1 且有 cubeshape 数据时露出下拉。
  const [target, setTarget] = useState<'full' | 'cubeshape'>('full');
  // sq1 双口径(单 toggle):'wca'(WCA 12c4,官方计步)/ 'slash'(twist,God 13)。仅 sq1 + 完整魔方有 alt。
  const [sq1Unit, setSq1Unit] = useState<'wca' | 'slash'>('wca');
  // 示例:原始比赛打乱 vs 最优(最短)等价打乱(同状态)。仅当样例带最优数据时露切换。
  const [exView, setExView] = useState<'orig' | 'opt'>('orig');
  // 国家占比条:点某国段 → 只看该国该步数的示例(country_id,null=不筛)。
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  // flag 数据(compId→国家)异步加载后重渲,示例筛选用 compFlagIso2 才准。
  const [, setFlagVer] = useState(flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => setFlagVer((prev) => (v !== prev ? v : prev)));
  }, []);

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
  const hasCubeshape = puzzleKey === 'sq1' && !!entry?.cubeshape; // 复形下拉门控(数据在才露)
  const isCube = hasCubeshape && target === 'cubeshape';
  const slashProvisional = entry?.alt?.provisional ?? true;
  const slashResidual = entry?.alt?.residual ?? 0;
  const slashResolved = entry?.alt?.resolved ?? 0;
  const slashAmbiguous = entry?.alt?.ambiguous ?? 0;
  // 目标 = 复形 → cubeshape.dist;否则 sq1 双口径:unit=wca → dist(W,WCA 12c4 最优);unit=slash → alt.dist(t,真 slash 最优,God 13)。
  const unit = sq1Unit;
  const activeDist: PuzzleHistEntry | undefined = isCube
    ? entry?.cubeshape?.dist
    : unit === 'wca' ? entry?.dist : entry?.alt?.dist;
  const activeMetricKey: string = isCube ? 'slash' : unit === 'wca' ? (entry?.metric ?? 'wca') : (entry?.alt?.metric ?? 'slash');
  // 示例分桶:复形→binsCubeshape;W→bins;t→binsAlt。
  const activeBins: PuzzleExamplesEntry['bins'] | undefined = isCube
    ? exEntry?.binsCubeshape
    : unit === 'wca' ? exEntry?.bins : exEntry?.binsAlt;
  // 国家占比分桶(与示例分桶同 key);选中步数的国家计数表。
  const activeCountryBins = isCube
    ? exEntry?.countryDist?.binsCubeshape
    : unit === 'wca' ? exEntry?.countryDist?.bins : exEntry?.countryDist?.binsAlt;
  const binCountry = (selectedBin !== null && activeCountryBins) ? activeCountryBins[String(selectedBin)] : undefined;
  const binTotal = (selectedBin !== null && activeDist) ? (activeDist.counts[String(selectedBin)] ?? 0) : 0;

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
    setSelectedBin(null); // 切 puzzle / 口径 / 目标时清空,等下个 effect 按新数据重选
  }, [puzzleKey, sq1Unit, target]);
  // 换步数 / 口径 / 目标 / puzzle 都清掉国家筛选(避免筛着一个国家切走后空列表)。
  useEffect(() => { setFilterCountry(null); }, [selectedBin, sq1Unit, target, puzzleKey]);
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

  const note = isCube
    ? cubeshapeNote()
    : (puzzleKey === 'sq1' && hasAlt)
      ? sq1Note(unit, slashProvisional, slashResidual)
      : metricNote(puzzleKey, activeMetricKey);
  const total = isCube ? (entry.cubeshape?.sample_count ?? entry.sample_count) : entry.sample_count;
  const sampleLine = tr({ zh: '{n} 条样本', en: '{n} samples' }).replace('{n}', total.toLocaleString());

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{sampleLine}</span>
          <span className="scramble-stats-puzzle-metric">{tr(note)}</span>
        </div>
        {hasCubeshape && (
          <label className="scramble-stats-puzzle-target">
            <span>{tr({ zh: '目标', en: 'Goal' })}</span>
            <select className="scramble-stats-select" value={target} onChange={(e) => setTarget(e.target.value as 'full' | 'cubeshape')}>
              <option value="full">{tr({ zh: '完整魔方', en: 'Full cube' })}</option>
              <option value="cubeshape">{tr({ zh: '复形', en: 'Cube shape' })}</option>
            </select>
          </label>
        )}
        {hasAlt && !isCube && (
          <div className="scramble-stats-puzzle-toggle">
            <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '度量', en: 'Metric' })}</span>
            <PillToggle
              value={sq1Unit === 'slash'}
              onChange={(v) => setSq1Unit(v ? 'slash' : 'wca')}
              offLabel={tr({ zh: 'WCA 12c4', en: 'WCA 12c4' })}
              onLabel={tr({ zh: 'slash', en: 'slash' })}
              ariaLabel={tr({ zh: 'SQ1 度量:WCA 12c4 步数或 slash 最优 / 数', en: 'SQ1 metric: WCA-12c4 moves or slash-optimal slashes' })}
            />
          </div>
        )}
      </div>

      {puzzleKey === 'sq1' && hasAlt && !isCube && unit === 'slash' && slashProvisional && (
        <p className="scramble-stats-provisional">
          {tr({
            zh: `slash 数为紧上界:已穷尽判定的 ${slashResolved.toLocaleString()} 条最深歧义态(W=2s-1)全部等于此上界、没有一条能再省刀;仅余 ${slashResidual} 条(占全部 ${((slashResidual / total) * 100).toFixed(3)}%,最深 s=12–13)在现求解器下穷尽证明超时不可行,暂取上界。`,
            en: `Slashes shown are a tight upper bound: all ${slashResolved.toLocaleString()} deepest ambiguous states (W=2s-1) resolved so far equal this bound — not one saves a slash; only ${slashResidual} remain (${((slashResidual / total) * 100).toFixed(3)}% of all, deepest s=12–13) that the current solver cannot prove exhaustively in feasible time.`,
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
          countryCounts={binCountry}
          binTotal={binTotal}
          filterCountry={filterCountry}
          onFilterCountry={setFilterCountry}
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
          {isCube
            ? tr({
              zh: '复形(cubeshape)= 把顶底两层各自还原成正方形(即立方体形状),不管中层(equator)的朝向。度量 = 最少 slash(/)数;两刀之间任意转动顶层 / 底层都免费、不计步。任意打乱最多 7 刀复形(Jaap Scherphuis 给出的 cube-shape God\'s number;全 170 个双层 shape 查表即得)。这是 SQ1 解法的第一步。',
              en: 'Cube shape (cubeshape) = make both the top and bottom layers square (i.e. restore the cube shape), ignoring the middle (equator) orientation. Metric = fewest slashes (/); any top/bottom turns between slashes are free. Any scramble reaches cube shape in at most 7 slashes (the cube-shape God\'s number per Jaap Scherphuis; a lookup over all 170 two-layer shapes). This is the first step of solving a Square-1.',
            })
            : puzzleKey === 'sq1' && hasAlt
            ? tr(slashProvisional ? {
              zh: `两种度量:WCA 12c4 步数((X,Y) 计 1、/ 计 1,官方计步)与 slash 最优解的 / 数(twist 度量,God 13)。为什么不分「WCA 最优解 / slash 最优解」:SQ1 的 WCA 最优解恰好也用最少刀(t = s,即同一个解同时是 WCA 最优与 slash 最优,两个目标从不冲突)。其中 95.71% 由省算定理(W=2s 或 2s+1 ⇒ t=s)免搜索证明;余 4.29%(${slashAmbiguous.toLocaleString()} 条)歧义态(W=2s−1)精确判定,${slashResolved.toLocaleString()} 条证得 t=s、${slashResidual} 条最深态(s=12–13)穷尽证明不可行而取紧上界。`,
              en: `Two metrics: WCA 12c4 length ((X,Y)=1, /=1, official) and the slash count of the slash-optimal solution (twist, God's number 13). Why there's no "WCA-optimal vs slash-optimal" choice: an SQ1 WCA-optimal solution already uses the fewest slashes (t = s — the very same solution is both WCA- and slash-optimal, so the two objectives never conflict). 95.71% follow from the parity theorem (W=2s or 2s+1 ⇒ t=s); of the remaining 4.29% (${slashAmbiguous.toLocaleString()}) ambiguous states (W=2s−1), ${slashResolved.toLocaleString()} are proven t=s and ${slashResidual} deepest states (s=12–13) take the tight upper bound.`,
            } : {
              zh: `两种度量:WCA 12c4 步数((X,Y) 计 1、/ 计 1,官方计步)与 slash 最优解的 / 数(twist 度量,God 13)。为什么不分「WCA 最优解 / slash 最优解」:SQ1 的 WCA 最优解恰好也用最少刀(t = s,全 125,605 真题已证、无一条能再省刀),两个目标从不冲突 —— 同一个解同时是 WCA 最优与 slash 最优。可证依据:95.71% 由省算定理(W=2s 或 2s+1 ⇒ t=s)免搜索直接证明,余 4.29%(${slashAmbiguous.toLocaleString()} 条)歧义态(W=2s−1)精确求解判定。`,
              en: `Two metrics: WCA 12c4 length ((X,Y)=1, /=1, official) and the slash count of the slash-optimal solution (twist, God's number 13). Why there's no "WCA-optimal vs slash-optimal" choice: an SQ1 WCA-optimal solution already uses the fewest slashes (t = s, proven for all 125,605 scrambles — not one can save a slash), so the two objectives never conflict: a single solution is simultaneously WCA- and slash-optimal. Proof: 95.71% from the parity theorem (W=2s or 2s+1 ⇒ t=s), the remaining 4.29% (${slashAmbiguous.toLocaleString()}) ambiguous (W=2s−1) decided by exact solving.`,
            })
            : tr({ zh: '度量:整个打乱的最优解步数', en: 'Metric: optimal solution length per scramble' })}
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
// 顶部叠一条各国占比(countryDist),点某国 → 只列该国该步数打乱;稀有步数已存全量,能完整浏览。
// 点打乱图/打乱文字 → 跳该 puzzle 的在线求解器并带入打乱。
const EXAMPLES_MAX_SHOWN = 40; // DOM 上限:稀有 bin 存了全量,不筛时截断展示
function PuzzleExamplesPanel({
  isZh,
  puzzleKey,
  selectedBin,
  bins,
  comps,
  idMeta,
  exView,
  onExView,
  countryCounts,
  binTotal,
  filterCountry,
  onFilterCountry,
}: {
  isZh: boolean;
  puzzleKey: string;
  selectedBin: number;
  bins: NonNullable<PuzzleExamplesEntry['bins']>;
  comps: PuzzleExamplesEntry['comps'];
  idMeta: PuzzleExamplesEntry['idMeta'];
  exView: 'orig' | 'opt';
  onExView: (v: 'orig' | 'opt') => void;
  countryCounts?: Record<string, number>;
  binTotal: number;
  filterCountry: string | null;   // 选中的 country_id
  onFilterCountry: (countryId: string | null) => void;
}) {
  const route = PUZZLE_ROUTE[puzzleKey];
  const hasSolver = !!route; // sq1 无在线求解器页 → 示例卡不可点,纯展示
  const previewEvent = PUZZLE_EVENT[puzzleKey] ?? '333';
  const rawSamples = bins[String(selectedBin)] ?? [];
  // 该 bin 样例确有最优等价打乱时才露切换(sq1 等无解列的 puzzle 自动隐藏)。
  const hasOpt = rawSamples.some((s) => !!s[2]);
  // 按比赛时间倒序(最新在前):有 comp 日期串按它,无则退回打乱 id(≈ 入库时间序),都取倒序。
  const dateOf = (id: string) => comps[idMeta[id]?.[0] ?? '']?.[1] ?? '';
  const sorted = [...rawSamples].sort((a, b) => {
    const d = dateOf(b[0]).localeCompare(dateOf(a[0]));
    return d !== 0 ? d : (Number(b[0]) - Number(a[0]));
  });
  // 按国筛选:样例的国家 = 其比赛所属国(compCountryId,原始 country_id),与占比条同一份 comp_countries 源。
  const filtered = filterCountry
    ? sorted.filter(([id]) => compCountryId(idMeta[id]?.[0] ?? '') === filterCountry)
    : sorted;
  const samples = filtered.slice(0, EXAMPLES_MAX_SHOWN);
  const moreCount = filtered.length - samples.length;
  const hasCountryBar = !!countryCounts && Object.keys(countryCounts).length > 0;
  const filterIso2 = filterCountry ? countryToIso2(filterCountry) : '';
  const filterName = filterIso2 ? countryName(filterIso2, isZh) : filterCountry ?? '';
  const solverHref = (scr: string) =>
    `/scramble/${route}?${new URLSearchParams({ scramble: scr.trim() })}`;

  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {tr({ zh: '{n} 步示例', en: '{n}-move examples' }).replace('{n}', String(selectedBin))}
        </div>
        {filterCountry && (
          <span className="pdv-cbar-chip">
            {filterIso2 && <Flag iso2={filterIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
            <span>{filterName}</span>
            <ClearButton
              onClick={() => onFilterCountry(null)}
              ariaLabel={tr({ zh: '清除国家筛选', en: 'Clear country filter' })}
            />
          </span>
        )}
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
      {hasCountryBar && (
        <div className="pdv-cbar-wrap">
          <CountryShareBar
            counts={countryCounts!}
            total={binTotal}
            selected={filterCountry}
            onSelect={onFilterCountry}
            isZh={isZh}
          />
        </div>
      )}
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
          {filterCountry
            ? tr({ zh: '该国此步数无示例(示例为采样,占比条为全量)', en: 'No sampled examples from this country at this length (bar reflects the full population)' })
            : tr({ zh: '此步数无示例', en: 'No examples for this length' })}
        </div>
      )}
      {moreCount > 0 && (
        <div className="scramble-stats-examples-more">
          {tr({ zh: '另有 {n} 条未显示', en: '{n} more not shown' }).replace('{n}', moreCount.toLocaleString())}
        </div>
      )}
    </div>
  );
}
