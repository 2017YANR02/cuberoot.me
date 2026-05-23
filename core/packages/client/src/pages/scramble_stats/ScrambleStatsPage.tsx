import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderToggles from '../../components/HeaderToggles';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './scramble_stats.css';

interface HistEntry {
  min: number;
  max: number;
  counts: Record<string, number>;
  // NOTE: 稀有 bin (3 最小 + 1 最大) 的 bin 值，UI 把这些柱子标为可点击
  example_bins?: number[];
}

interface VariantData {
  sample_count: number;
  stages: string[];
  data: Record<string, Record<string, HistEntry>>;
}

interface SetData {
  label: string;
  label_zh: string | null;
  sample_count: number;
  variants: Record<string, VariantData>;
}

interface DistributionJson {
  meta: { generated_at: string; subset_keys: string[] };
  sets: Record<string, SetData>;
}

// NOTE: examples.json 懒加载；[id, scramble, bottomColorLetter]
// 路径:sets[setKey].variants[variant][stage][subsetKey][bin] = ExampleSample[]
type ExampleSample = [string, string, string];
interface ExamplesSet {
  variants: Record<string, Record<string, Record<string, Record<string, ExampleSample[]>>>>;
}
interface ExamplesJson {
  meta: { generated_at: string };
  sets: Record<string, ExamplesSet>;
}

type VariantKey = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';
type ColorMode = 'cn' | 'quad' | 'dual' | 'single';
type YMode = 'percent' | 'count';
type ChartMode = 'pdf' | 'cdf';

// NOTE: 6 种底色（颜色字母 = 字母序 B/G/O/R/W/Y）。WCA Regulations 3h1 官方色值
type ColorLetter = 'B' | 'G' | 'O' | 'R' | 'W' | 'Y';
const COLOR_LETTERS: ColorLetter[] = ['B', 'G', 'O', 'R', 'W', 'Y'];
const COLOR_HEX: Record<ColorLetter, string> = {
  Y: '#FEFE00',
  R: '#EE0000',
  W: '#FFFFFF',
  O: '#FFA100',
  B: '#0000F2',
  G: '#00D800',
};
// NOTE: 3 对相反色（U-D / F-B / R-L 轴），dual 模式里 3 选 1
const DUAL_PAIRS: { key: string; letters: [ColorLetter, ColorLetter] }[] = [
  { key: 'WY', letters: ['W', 'Y'] },
  { key: 'BG', letters: ['B', 'G'] },
  { key: 'OR', letters: ['O', 'R'] },
];
// NOTE: single 模式循环顺序（点击图例依次切换）。用字母序与色选面板顺序一致
const SINGLE_CYCLE: ColorLetter[] = ['B', 'G', 'O', 'R', 'W', 'Y'];
const DUAL_PAIR_KEYS: string[] = DUAL_PAIRS.map((p) => p.key);
// NOTE: 渐变色序按视觉自然顺序（浅→深）——跨多色混合时较均衡
const GRADIENT_ORDER: ColorLetter[] = ['W', 'Y', 'G', 'B', 'R', 'O'];

const VARIANT_LABEL: Record<VariantKey, { en: string; zh: string }> = {
  std: { en: 'Standard', zh: '标准' },
  eo: { en: 'EOCross', zh: 'EO十字' },
  pair: { en: 'Cross + Pair', zh: '十字+基态' },
  pseudo: { en: 'Pseudo', zh: '伪十字' },
  pseudo_pair: { en: 'Pseudo + Pair', zh: '伪十字+基态' },
};

const STAGE_LABEL: Record<string, { en: string; zh: string }> = {
  cross: { en: 'Cross', zh: '十字' },
  eo_cross: { en: 'Cross', zh: '十字' },
  cross_pair: { en: 'Cross', zh: '十字' },
  pseudo_cross: { en: 'Cross', zh: '十字' },
  pseudo_cross_pseudo_pair: { en: 'Cross', zh: '十字' },
  xcross: { en: 'XCross', zh: 'XCross' },
  eo_xcross: { en: 'XCross', zh: 'XCross' },
  xcross_pair: { en: 'XCross', zh: 'XCross' },
  pseudo_xcross: { en: 'XCross', zh: 'XCross' },
  pseudo_xcross_pseudo_pair: { en: 'XCross', zh: 'XCross' },
  xxcross: { en: 'XXCross', zh: 'XXCross' },
  eo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  xxcross_pair: { en: 'XXCross', zh: 'XXCross' },
  pseudo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  pseudo_xxcross_pseudo_pair: { en: 'XXCross', zh: 'XXCross' },
  xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  eo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  xxxcross_pair: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_xxxcross_pseudo_pair: { en: 'XXXCross', zh: 'XXXCross' },
  f2l: { en: 'XXXXCross', zh: 'XXXXCross' },
  xxxxcross: { en: 'XXXXCross', zh: 'XXXXCross' },
  eo_xxxxcross: { en: 'XXXXCross', zh: 'XXXXCross' },
};

const labelStage = (s: string, isZh: boolean) => STAGE_LABEL[s] ? STAGE_LABEL[s][isZh ? 'zh' : 'en'] : s;

// NOTE: subset key = sorted letter string (alphabet order B<G<O<R<W<Y)
function subsetKeyFromLetters(letters: ColorLetter[]): string {
  return [...letters].sort().join('');
}

function fillColorsForSubset(letters: ColorLetter[]): string[] {
  const set = new Set(letters);
  return GRADIENT_ORDER.filter((c) => set.has(c)).map((c) => COLOR_HEX[c]);
}

function computeStats(counts: Record<string, number>) {
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
  const mean = total > 0 ? sum / total : 0;
  const pct = (p: number) => {
    const target = total * p;
    let cum = 0;
    for (const [x, v] of entries) {
      cum += v;
      if (cum >= target) return x;
    }
    return entries[entries.length - 1][0];
  };
  return {
    mean,
    mode,
    min: entries[0][0],
    max: entries[entries.length - 1][0],
    p10: pct(0.1),
    median: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
    total,
  };
}

export default function ScrambleStatsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('打乱分布', 'Scramble Stats');

  const [data, setData] = useState<DistributionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrambleSet, setScrambleSet] = useState<string>('wca');
  const [variant, setVariant] = useState<VariantKey>('std');
  const [stage, setStage] = useState<string>('cross');
  const [colorMode, setColorMode] = useState<ColorMode>('cn');
  const [singleColor, setSingleColor] = useState<ColorLetter>('Y');
  const [dualPairKey, setDualPairKey] = useState<string>('WY');
  // NOTE: quad 只能排除一对相反色（WY / BG / OR），默认排除 BG → 保留黄白红橙（速拧常用）
  const [quadExcludedPairKey, setQuadExcludedPairKey] = useState<string>('BG');
  const [yMode, setYMode] = useState<YMode>('percent');
  const [chartMode, setChartMode] = useState<ChartMode>('pdf');
  // NOTE: examples 是懒加载的，首次点柱子才请求；selectedBin 是当前在示例面板里展示的 bin
  const [examples, setExamples] = useState<ExamplesJson | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  useEffect(() => {
    fetch('/stats/scramble/distribution.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // NOTE: 进 distribution.json 后,scrambleSet 还是初始 'wca';如果数据里有但当前不存在该 key,
  // 需要回退到第一个有效 key
  useEffect(() => {
    if (data && !data.sets[scrambleSet]) {
      const first = Object.keys(data.sets)[0];
      if (first) setScrambleSet(first);
    }
  }, [data, scrambleSet]);

  const currentSet = useMemo(() => data?.sets[scrambleSet] ?? null, [data, scrambleSet]);

  const currentStages = useMemo(() => {
    if (!currentSet) return [] as string[];
    return currentSet.variants[variant]?.stages ?? [];
  }, [currentSet, variant]);

  useEffect(() => {
    if (currentStages.length > 0 && !currentStages.includes(stage)) {
      setStage(currentStages[0]);
    }
  }, [currentStages, stage]);

  // NOTE: 当前选中的颜色子集 → subset key + 展示色序
  const { subsetKey, selectedColors, modeLabel } = useMemo(() => {
    let letters: ColorLetter[];
    let label: string;
    switch (colorMode) {
      case 'cn':
        letters = [...COLOR_LETTERS];
        label = isZh ? '六色底' : 'CN';
        break;
      case 'quad': {
        const pair = DUAL_PAIRS.find((p) => p.key === quadExcludedPairKey) ?? DUAL_PAIRS[0];
        const excl = new Set<ColorLetter>(pair.letters);
        letters = COLOR_LETTERS.filter((c) => !excl.has(c));
        label = isZh ? '四色底' : 'Quad';
        break;
      }
      case 'dual':
        letters = [...(DUAL_PAIRS.find((p) => p.key === dualPairKey) ?? DUAL_PAIRS[0]).letters];
        label = isZh ? '双色底' : 'Dual';
        break;
      case 'single':
        letters = [singleColor];
        label = isZh ? '单色底' : 'Single';
        break;
    }
    return {
      subsetKey: subsetKeyFromLetters(letters),
      selectedColors: letters,
      modeLabel: label,
    };
  }, [colorMode, singleColor, dualPairKey, quadExcludedPairKey, isZh]);

  // NOTE: 点击图例：依次切换当前 mode 下的选项。cn 模式无需切换
  const cycleSelection = () => {
    if (colorMode === 'single') {
      const idx = SINGLE_CYCLE.indexOf(singleColor);
      setSingleColor(SINGLE_CYCLE[(idx + 1) % SINGLE_CYCLE.length]);
    } else if (colorMode === 'dual') {
      const idx = DUAL_PAIR_KEYS.indexOf(dualPairKey);
      setDualPairKey(DUAL_PAIR_KEYS[(idx + 1) % DUAL_PAIR_KEYS.length]);
    } else if (colorMode === 'quad') {
      const idx = DUAL_PAIR_KEYS.indexOf(quadExcludedPairKey);
      setQuadExcludedPairKey(DUAL_PAIR_KEYS[(idx + 1) % DUAL_PAIR_KEYS.length]);
    }
  };
  const cyclable = colorMode === 'single' || colorMode === 'dual' || colorMode === 'quad';

  // NOTE: 当前 (variant, stage, subset) 的直方图全部 bin = 预览可点击；4 个 picked bin 额外提供 ⬇ 下载
  const previewBins = useMemo<number[]>(() => {
    if (!currentSet) return [];
    const counts = currentSet.variants[variant]?.data[stage]?.[subsetKey]?.counts ?? {};
    return Object.keys(counts).map(Number).sort((a, b) => a - b);
  }, [currentSet, variant, stage, subsetKey]);
  const downloadBins = useMemo<number[]>(() => {
    if (!currentSet) return [];
    return currentSet.variants[variant]?.data[stage]?.[subsetKey]?.example_bins ?? [];
  }, [currentSet, variant, stage, subsetKey]);

  const ensureExamplesLoaded = () => {
    if (examples || examplesLoading) return;
    setExamplesLoading(true);
    fetch('/stats/scramble/examples.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => { setExamples(j); setExamplesLoading(false); })
      .catch((e) => { setExamplesError(String(e)); setExamplesLoading(false); });
  };

  const handleBarClick = (bin: number) => {
    setSelectedBin(bin);
    ensureExamplesLoaded();
  };

  // NOTE: 页面打开 & 切 variant/stage/subset 时默认选中最小 bin(previewBins[0])并懒加载 examples
  // (downloadBins 现在只决定是否显示 ⬇ 下载链接,不影响 default 选中)
  useEffect(() => {
    if (previewBins.length > 0) {
      setSelectedBin(previewBins[0]);
      ensureExamplesLoaded();
    } else {
      setSelectedBin(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrambleSet, variant, stage, subsetKey, previewBins.length]);

  const currentSamples = useMemo<ExampleSample[] | null>(() => {
    if (selectedBin === null || !examples) return null;
    return examples.sets[scrambleSet]?.variants[variant]?.[stage]?.[subsetKey]?.[String(selectedBin)] ?? null;
  }, [examples, scrambleSet, variant, stage, subsetKey, selectedBin]);

  const series = useMemo<HistSeries[]>(() => {
    if (!currentSet) return [];
    const v = currentSet.variants[variant];
    if (!v) return [];
    const stageData = v.data[stage];
    if (!stageData) return [];
    const hist = stageData[subsetKey];
    if (!hist) return [];
    return [{
      name: modeLabel,
      fillColors: fillColorsForSubset(selectedColors),
      counts: hist.counts,
      onLegendClick: cyclable ? cycleSelection : undefined,
      legendHint: cyclable ? (isZh ? '点击切换' : 'Click to cycle') : undefined,
    }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSet, variant, stage, subsetKey, selectedColors, modeLabel, cyclable, isZh,
      colorMode, singleColor, dualPairKey, quadExcludedPairKey]);

  const extendedStats = useMemo(() => {
    if (series.length !== 1) return null;
    return computeStats(series[0].counts);
  }, [series]);

  // NOTE: CN benefit — 黄/白单色 vs 双色底(黄白) vs 六色底，相对白底基线
  const cnBenefit = useMemo(() => {
    if (!currentSet) return null;
    const v = currentSet.variants[variant];
    if (!v) return null;
    const sd = v.data[stage];
    if (!sd) return null;
    const white = computeStats(sd.W?.counts ?? {});
    const yellow = computeStats(sd.Y?.counts ?? {});
    const wy = computeStats(sd.WY?.counts ?? {});
    const all6 = computeStats(sd.BGORWY?.counts ?? {});
    if (!white || !yellow || !wy || !all6) return null;
    return {
      whiteMean: white.mean,
      yellowMean: yellow.mean,
      wyMean: wy.mean,
      all6Mean: all6.mean,
    };
  }, [currentSet, variant, stage]);

  if (error) {
    return (
      <div className="scramble-stats-page">
        <div className="scramble-stats-header">
          <HeaderToggles className="scramble-stats-header-nav" />
          <h1>{isZh ? '打乱难度分布' : 'Scramble Distribution'}</h1>
        </div>
        <div className="scramble-stats-error">{isZh ? '加载失败' : 'Load failed'}: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="scramble-stats-page">
        <div className="scramble-stats-header">
          <HeaderToggles className="scramble-stats-header-nav" />
          <h1>{isZh ? '打乱难度分布' : 'Scramble Distribution'}</h1>
        </div>
        <div className="scramble-stats-loading">{isZh ? '加载中…' : 'Loading…'}</div>
      </div>
    );
  }

  const vData = currentSet?.variants[variant];

  // NOTE: 来源描述句:wca 给固定文案;其他 set 用 set.label / label_zh + 样本数
  const sourceText = (() => {
    if (scrambleSet === 'wca') {
      const n = currentSet?.sample_count.toLocaleString() ?? '?';
      return isZh
        ? `来源: WCA 历史 ${n} 条三阶打乱,覆盖三阶速拧 / 单手 / 盲拧 / 多盲 / 最少步 / 脚拧 6 个项目;每条按 6 种底色方向(黄 / 红 / 白 / 橙 / 蓝 / 绿)求阶段最优步数的分布。`
        : `Source: ${n} WCA historical 3×3 scrambles from 6 events (3×3, OH, BLD, Multi-BLD, FMC, Feet); each analyzed across 6 bottom-color orientations (Y/R/W/O/B/G). Distribution of stage-optimal move counts.`;
    }
    if (!currentSet) return '';
    const labelDisp = (isZh && currentSet.label_zh) ? currentSet.label_zh : currentSet.label;
    const n = currentSet.sample_count.toLocaleString();
    return isZh
      ? `来源: ${labelDisp},共 ${n} 条样本;每条按 6 种底色方向求阶段最优步数的分布。`
      : `Source: ${labelDisp} (${n} samples); each analyzed across 6 bottom-color orientations.`;
  })();

  // dropdown 选项从 data.sets 派生
  const setOptions = Object.entries(data.sets).map(([key, s]) => ({
    value: key,
    label: `${(isZh && s.label_zh) ? s.label_zh : s.label} (${s.sample_count.toLocaleString()})`,
  }));

  return (
    <div className="scramble-stats-page">
      <div className="scramble-stats-header">
        <HeaderToggles className="scramble-stats-header-nav" />
        <h1>{isZh ? '打乱难度分布' : 'Scramble Distribution'}</h1>
        <p className="scramble-stats-note">{sourceText}</p>
      </div>

      <div className="scramble-stats-controls">
        <label>
          <span>{isZh ? '变体' : 'Variant'}</span>
          <select value={variant} onChange={(e) => setVariant(e.target.value as VariantKey)}>
            {currentSet && (Object.keys(currentSet.variants) as VariantKey[]).map((v) => (
              <option key={v} value={v}>{VARIANT_LABEL[v][isZh ? 'zh' : 'en']}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{isZh ? '阶段' : 'Stage'}</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {currentStages.map((s) => (
              <option key={s} value={s}>{labelStage(s, isZh)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={series}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          modes={[
            { key: 'cn', label: isZh ? '六色' : 'cn' },
            { key: 'quad', label: isZh ? '四色' : 'quad' },
            { key: 'dual', label: isZh ? '双色' : 'dual' },
            { key: 'single', label: isZh ? '单色' : 'single' },
          ]}
          activeMode={colorMode}
          onModeChange={(k) => setColorMode(k as ColorMode)}
          clickableBins={previewBins}
          selectedBin={selectedBin}
          onBarClick={handleBarClick}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          yModeLabel={yMode === 'percent' ? (isZh ? '百分比' : '%') : (isZh ? '数量' : 'count')}
          setOptions={setOptions}
          activeSet={scrambleSet}
          onSetChange={setScrambleSet}
        />
      </div>

      {extendedStats && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{isZh ? '摘要统计' : 'Summary stats'}</div>
          <div className="scramble-stats-stat-grid">
            <StatCell label={isZh ? '均值' : 'mean'} value={extendedStats.mean.toFixed(2)} />
            <StatCell label={isZh ? '中位数' : 'median'} value={String(extendedStats.median)} />
            <StatCell label="p10" value={String(extendedStats.p10)} />
            <StatCell label="p90" value={String(extendedStats.p90)} />
            <StatCell label="p99" value={String(extendedStats.p99)} />
          </div>
        </div>
      )}

      <ExamplesPanel
        isZh={isZh}
        scrambleSet={scrambleSet}
        variant={variant}
        stage={stage}
        subsetKey={subsetKey}
        downloadBins={downloadBins}
        selectedBin={selectedBin}
        loading={examplesLoading}
        errorText={examplesError}
        samples={currentSamples}
      />

      {cnBenefit && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{isZh ? '颜色中立收益（本阶段均值）' : 'Color-neutrality gain (stage mean)'}</div>
          <div className="scramble-stats-cn-grid">
            <CnCell label={isZh ? '黄底' : 'Yellow'} value={cnBenefit.yellowMean.toFixed(3)} />
            <CnCell label={isZh ? '白底' : 'White'} value={cnBenefit.whiteMean.toFixed(3)} />
            <CnCell label={isZh ? '白黄双色底' : 'Dual'} value={cnBenefit.wyMean.toFixed(3)} diff={cnBenefit.wyMean - cnBenefit.whiteMean} />
            <CnCell label={isZh ? '六色底' : 'CN'} value={cnBenefit.all6Mean.toFixed(3)} diff={cnBenefit.all6Mean - cnBenefit.whiteMean} />
          </div>
          <div className="scramble-stats-cn-note">
            {isZh
              ? `相对白底基线：双色底省 ${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)} 步，六色底省 ${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)} 步`
              : `Savings vs white: dual −${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)}, cn −${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)}`}
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {isZh ? '本变体样本' : 'Variant samples'}: {(vData?.sample_count ?? 0).toLocaleString()}
        </span>
        <span>
          {isZh ? '生成时间' : 'Generated'}: {new Date(data.meta.generated_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="scramble-stats-stat-cell">
      <div className="scramble-stats-stat-label">{label}</div>
      <div className="scramble-stats-stat-value">{value}</div>
    </div>
  );
}

function CnCell({ label, value, diff }: { label: string; value: string; diff?: number }) {
  return (
    <div className="scramble-stats-cn-cell">
      <div className="scramble-stats-stat-label">{label}</div>
      <div className="scramble-stats-stat-value">{value}</div>
      {diff !== undefined && (
        <div className={`scramble-stats-cn-diff ${diff < 0 ? 'good' : ''}`}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(3)}
        </div>
      )}
    </div>
  );
}

// NOTE: 下载图标（tray with down arrow），currentColor 让按钮 hover 时可换色
function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M8 1.5v7.5M4.5 6.5L8 10l3.5-3.5M2.5 12.5h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// NOTE: 打乱示例面板
// 所有 bin 都有 K_PREVIEW=5 条预览；bin 的切换通过点击图表柱子完成
// 下载按钮在标题下方一排，对应 min/2nd/3rd/max 4 个极端 bin
function ExamplesPanel({
  isZh,
  scrambleSet,
  variant,
  stage,
  subsetKey,
  downloadBins,
  selectedBin,
  loading,
  errorText,
  samples,
}: {
  isZh: boolean;
  scrambleSet: string;
  variant: string;
  stage: string;
  subsetKey: string;
  downloadBins: number[];
  selectedBin: number | null;
  loading: boolean;
  errorText: string | null;
  samples: ExampleSample[] | null;
}) {
  // NOTE: 单一下载按钮跟着 selectedBin 走；只有选中的 bin 落在 downloadBins（min/2nd/3rd/max）里时才显示
  const selectedDownloadable = selectedBin !== null && downloadBins.includes(selectedBin);
  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {selectedBin !== null
            ? (isZh ? `${selectedBin} 步示例` : `${selectedBin}-move examples`)
            : (isZh ? '示例' : 'Examples')}
        </div>
        {selectedDownloadable && (
          <a
            className="scramble-stats-download-btn"
            href={`/stats/scramble/downloads/${scrambleSet}/${variant}/${stage}/${subsetKey}_${selectedBin}.txt`}
            download={`${scrambleSet}_${variant}_${stage}_${subsetKey}_${selectedBin}.txt`}
            title={isZh ? `下载 ${selectedBin} 步完整 txt` : `Download full txt for ${selectedBin} moves`}
            aria-label={isZh ? `下载 ${selectedBin} 步完整 txt` : `Download full txt for ${selectedBin} moves`}
          >
            <DownloadIcon />
          </a>
        )}
      </div>
      {selectedBin !== null && loading && (
        <div className="scramble-stats-examples-hint">{isZh ? '加载中…' : 'Loading…'}</div>
      )}
      {selectedBin !== null && errorText && (
        <div className="scramble-stats-examples-hint">{isZh ? '加载失败' : 'Load failed'}: {errorText}</div>
      )}
      {selectedBin !== null && !loading && !errorText && samples && samples.length > 0 && (
        <ul className="scramble-stats-examples-list">
          {samples.map(([, scr, color], i) => (
            <li key={i}>
              <span
                className="scramble-stats-examples-chip"
                style={{ background: COLOR_HEX[color as ColorLetter] ?? '#888' }}
                title={isZh ? '朝下的底色' : 'Bottom color'}
              />
              <code className="scramble-stats-examples-scramble">{scr}</code>
            </li>
          ))}
        </ul>
      )}
      {selectedBin !== null && !loading && !errorText && samples && samples.length === 0 && (
        <div className="scramble-stats-examples-hint">{isZh ? '此 bin 无示例' : 'No examples for this bin'}</div>
      )}
    </div>
  );
}
