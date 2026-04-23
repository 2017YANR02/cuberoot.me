import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import './scramble_stats.css';

interface HistEntry {
  min: number;
  max: number;
  counts: Record<string, number>;
}

interface VariantData {
  sample_count: number;
  stages: string[];
  data: Record<string, Record<string, HistEntry>>;
}

interface DistributionJson {
  meta: { sample_count: number; source: string; generated_at: string; subset_keys: string[] };
  variants: Record<string, VariantData>;
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
  crossp: { en: 'Cross', zh: '十字' },
  pseudo_cross: { en: 'Cross', zh: '十字' },
  pseudo_cross_pseudo_pair: { en: 'Cross', zh: '十字' },
  xcross: { en: 'XCross', zh: 'XCross' },
  eo_xcross: { en: 'XCross', zh: 'XCross' },
  xcp: { en: 'XCross', zh: 'XCross' },
  pseudo_xcross: { en: 'XCross', zh: 'XCross' },
  pseudo_xcross_pseudo_pair: { en: 'XCross', zh: 'XCross' },
  xxcross: { en: 'XXCross', zh: 'XXCross' },
  eo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  xxcp: { en: 'XXCross', zh: 'XXCross' },
  pseudo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  pseudo_xxcross_pseudo_pair: { en: 'XXCross', zh: 'XXCross' },
  xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  eo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  xxxcp: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_xxxcross_pseudo_pair: { en: 'XXXCross', zh: 'XXXCross' },
  f2l: { en: 'F2L', zh: 'F2L' },
  eo_xxxxcross: { en: 'F2L', zh: 'F2L' },
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

  useEffect(() => {
    fetch('/stats/data/scramble/distribution.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const currentStages = useMemo(() => {
    if (!data) return [] as string[];
    return data.variants[variant]?.stages ?? [];
  }, [data, variant]);

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

  const series = useMemo<HistSeries[]>(() => {
    if (!data) return [];
    const v = data.variants[variant];
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
  }, [data, variant, stage, subsetKey, selectedColors, modeLabel, cyclable, isZh,
      colorMode, singleColor, dualPairKey, quadExcludedPairKey]);

  const extendedStats = useMemo(() => {
    if (series.length !== 1) return null;
    return computeStats(series[0].counts);
  }, [series]);

  // NOTE: CN benefit — 黄/白单色 vs 双色底(黄白) vs 六色底，相对白底基线
  const cnBenefit = useMemo(() => {
    if (!data) return null;
    const v = data.variants[variant];
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
  }, [data, variant, stage]);

  if (error) {
    return (
      <div className="scramble-stats-page">
        <div className="scramble-stats-header">
          <div className="scramble-stats-header-nav">
            <Link to="/" className="scramble-stats-back">← {isZh ? '返回' : 'Back'}</Link>
            <LangToggle />
          </div>
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
          <div className="scramble-stats-header-nav">
            <Link to="/" className="scramble-stats-back">← {isZh ? '返回' : 'Back'}</Link>
            <LangToggle />
          </div>
          <h1>{isZh ? '打乱难度分布' : 'Scramble Distribution'}</h1>
        </div>
        <div className="scramble-stats-loading">{isZh ? '加载中…' : 'Loading…'}</div>
      </div>
    );
  }

  const vData = data.variants[variant];

  return (
    <div className="scramble-stats-page">
      <div className="scramble-stats-header">
        <div className="scramble-stats-header-nav">
          <Link to="/" className="scramble-stats-back">← {isZh ? '返回' : 'Back'}</Link>
          <LangToggle />
        </div>
        <h1>{isZh ? '打乱难度分布' : 'Scramble Distribution'}</h1>
        <p className="scramble-stats-note">
          {isZh
            ? `来源: WCA 历史 ${data.meta.sample_count.toLocaleString()} 条三阶打乱，覆盖三阶速拧 / 单手 / 盲拧 / 多盲 / 最少步 / 脚拧 6 个项目；每条按 6 种底色方向（黄 / 红 / 白 / 橙 / 蓝 / 绿）求阶段最优步数的分布。`
            : `Source: ${data.meta.sample_count.toLocaleString()} WCA historical 3×3 scrambles from 6 events (3×3, OH, BLD, Multi-BLD, FMC, Feet); each analyzed across 6 bottom-color orientations (Y/R/W/O/B/G). Distribution of stage-optimal move counts.`}
        </p>
      </div>

      <div className="scramble-stats-controls">
        <label>
          <span>{isZh ? '打乱集' : 'Scramble set'}</span>
          <select value={scrambleSet} onChange={(e) => setScrambleSet(e.target.value)}>
            <option value="wca">
              {isZh
                ? `WCA 打乱 (${data.meta.sample_count.toLocaleString()})`
                : `WCA Scramble (${data.meta.sample_count.toLocaleString()})`}
            </option>
          </select>
        </label>
        <label>
          <span>{isZh ? '变体' : 'Variant'}</span>
          <select value={variant} onChange={(e) => setVariant(e.target.value as VariantKey)}>
            {(Object.keys(data.variants) as VariantKey[]).map((v) => (
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
        <div className="scramble-stats-toggle-group">
          <span>{isZh ? '模式' : 'Mode'}</span>
          <button className={chartMode === 'pdf' ? 'active' : ''} onClick={() => setChartMode('pdf')}>PDF</button>
          <button className={chartMode === 'cdf' ? 'active' : ''} onClick={() => setChartMode('cdf')}>CDF</button>
        </div>
        <div className="scramble-stats-toggle-group">
          <span>Y</span>
          <button className={yMode === 'percent' ? 'active' : ''} onClick={() => setYMode('percent')}>
            {isZh ? '百分比' : '%'}
          </button>
          <button className={yMode === 'count' ? 'active' : ''} onClick={() => setYMode('count')}>
            {isZh ? '数量' : 'count'}
          </button>
        </div>
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
          {isZh ? '本变体样本' : 'Variant samples'}: {vData.sample_count.toLocaleString()}
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
