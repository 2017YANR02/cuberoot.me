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
  angles: string[];
  data: Record<string, Record<string, HistEntry>>;
}

interface DistributionJson {
  meta: { sample_count: number; source: string; generated_at: string };
  variants: Record<string, VariantData>;
}

type VariantKey = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';
type AngleMode = 'min' | 'min_wy' | 'all';
type YMode = 'percent' | 'count';
type ChartMode = 'pdf' | 'cdf';

// NOTE: Variant 名称 = 求解目标族。eo = ZZ 起手 EO+十字；pair = 十字+自由对（位置不限）；pseudo = 伪十字
const VARIANT_LABEL: Record<VariantKey, { en: string; zh: string }> = {
  std: { en: 'Standard', zh: '标准' },
  eo: { en: 'EOCross', zh: 'EO十字' },
  pair: { en: 'Cross + Pair', zh: '十字+对' },
  pseudo: { en: 'Pseudo', zh: '伪十字' },
  pseudo_pair: { en: 'Pseudo + Pair', zh: '伪十字+对' },
};

// NOTE: stage 在 variant 内的进度位（cross / XCross / XXCross / XXXCross / F2L）
// 多个 variant 的不同 stage key 映射到同一个显示名，避免在 UI 里重复 variant 前缀
const STAGE_LABEL: Record<string, { en: string; zh: string }> = {
  // Cross 位
  cross: { en: 'Cross', zh: '十字' },
  eo_cross: { en: 'Cross', zh: '十字' },
  crossp: { en: 'Cross', zh: '十字' },
  pseudo_cross: { en: 'Cross', zh: '十字' },
  pseudo_cross_pseudo_pair: { en: 'Cross', zh: '十字' },
  // XCross 位
  xcross: { en: 'XCross', zh: 'XCross' },
  eo_xcross: { en: 'XCross', zh: 'XCross' },
  xcp: { en: 'XCross', zh: 'XCross' },
  pseudo_xcross: { en: 'XCross', zh: 'XCross' },
  pseudo_xcross_pseudo_pair: { en: 'XCross', zh: 'XCross' },
  // XXCross 位
  xxcross: { en: 'XXCross', zh: 'XXCross' },
  eo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  xxcp: { en: 'XXCross', zh: 'XXCross' },
  pseudo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  pseudo_xxcross_pseudo_pair: { en: 'XXCross', zh: 'XXCross' },
  // XXXCross 位
  xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  eo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  xxxcp: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_xxxcross_pseudo_pair: { en: 'XXXCross', zh: 'XXXCross' },
  // F2L 位（eo variant 的最末尾是 xxxxcross = EO 保持下的 F2L 完成）
  f2l: { en: 'F2L', zh: 'F2L' },
  eo_xxxxcross: { en: 'F2L', zh: 'F2L' },
};

// NOTE: 朝向 → 底色。std/eo/pseudo/pseudo_pair 用 z0..x3 键，pair 用 rotation 记号
// 色值取自 WCA Regulations (Article 3h1) 官方配色
const ANGLE_FACE: Record<string, { color: string; stroke?: string; zh: string; en: string }> = {
  z0:   { color: '#FEFE00', zh: '黄', en: 'Yellow' },
  z1:   { color: '#EE0000', zh: '红', en: 'Red' },
  z2:   { color: '#FFFFFF', stroke: '#181716', zh: '白', en: 'White' },  // 白在 cream 底要加深边框
  z3:   { color: '#FFA100', zh: '橙', en: 'Orange' },
  x1:   { color: '#0000F2', zh: '蓝', en: 'Blue' },
  x3:   { color: '#00D800', zh: '绿', en: 'Green' },
  '':   { color: '#FEFE00', zh: '黄', en: 'Yellow' },
  z:    { color: '#EE0000', zh: '红', en: 'Red' },
  "z'": { color: '#FFA100', zh: '橙', en: 'Orange' },
  x:    { color: '#0000F2', zh: '蓝', en: 'Blue' },
  "x'": { color: '#00D800', zh: '绿', en: 'Green' },
};
const MIN_COLOR = '#D97757';     // NOTE: min 6色 用 Claude 珊瑚
const MIN_WY_COLOR = '#B8935C';  // NOTE: min 白黄双色 用暖棕（区别于 6色 min）

const labelStage = (s: string, isZh: boolean) => STAGE_LABEL[s] ? STAGE_LABEL[s][isZh ? 'zh' : 'en'] : s;
const labelAngle = (a: string, isZh: boolean) => ANGLE_FACE[a]?.[isZh ? 'zh' : 'en'] ?? a;
const colorForAngle = (a: string) => ANGLE_FACE[a]?.color ?? '#8B7D72';

// NOTE: 从 counts 算统计量
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
  const [angleMode, setAngleMode] = useState<AngleMode>('min');
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

  const series = useMemo<HistSeries[]>(() => {
    if (!data) return [];
    const v = data.variants[variant];
    if (!v) return [];
    const stageData = v.data[stage];
    if (!stageData) return [];
    if (angleMode === 'min') {
      return [{
        name: isZh ? '六色底' : 'CN',
        color: MIN_COLOR,
        counts: stageData.min_across.counts,
      }];
    }
    if (angleMode === 'min_wy') {
      return [{
        name: isZh ? '双色底' : 'Dual',
        color: MIN_WY_COLOR,
        counts: stageData.min_wy?.counts ?? {},
      }];
    }
    return v.angles.map((a) => ({
      name: labelAngle(a, isZh),
      color: colorForAngle(a),
      stroke: ANGLE_FACE[a]?.stroke,
      counts: stageData[a]?.counts ?? {},
    }));
  }, [data, variant, stage, angleMode, isZh]);

  // NOTE: 拓展统计 — 只在 single-series 时展示
  const extendedStats = useMemo(() => {
    if (series.length !== 1) return null;
    return computeStats(series[0].counts);
  }, [series]);

  // NOTE: CN benefit — 拿纯白(z2)均值做基线，与 min_wy / min_across 对比
  const cnBenefit = useMemo(() => {
    if (!data) return null;
    const v = data.variants[variant];
    if (!v) return null;
    const sd = v.data[stage];
    if (!sd) return null;
    const white = computeStats(sd.z2?.counts ?? {});
    const yellow = computeStats(sd[v.angles[0] === '' ? '' : 'z0']?.counts ?? {});
    const wy = computeStats(sd.min_wy?.counts ?? {});
    const all6 = computeStats(sd.min_across?.counts ?? {});
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
          <span>{isZh ? '颜色中立' : 'CN'}</span>
          <button className={angleMode === 'min' ? 'active' : ''} onClick={() => setAngleMode('min')}>
            {isZh ? '六色底' : 'cn'}
          </button>
          <button className={angleMode === 'min_wy' ? 'active' : ''} onClick={() => setAngleMode('min_wy')}>
            {isZh ? '双色底' : 'dual'}
          </button>
          <button className={angleMode === 'all' ? 'active' : ''} onClick={() => setAngleMode('all')}>
            {isZh ? '单色底' : 'single'}
          </button>
        </div>
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
        <DiscreteHistogram series={series} isZh={isZh} yMode={yMode} chartMode={chartMode} />
      </div>

      {extendedStats && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{isZh ? '摘要统计' : 'Summary stats'}</div>
          <div className="scramble-stats-stat-grid">
            <StatCell label={isZh ? '均值' : 'mean'} value={extendedStats.mean.toFixed(2)} />
            <StatCell label={isZh ? '中位数' : 'median'} value={String(extendedStats.median)} />
            <StatCell label={isZh ? '众数' : 'mode'} value={String(extendedStats.mode)} />
            <StatCell label="p10" value={String(extendedStats.p10)} />
            <StatCell label="p90" value={String(extendedStats.p90)} />
            <StatCell label="p99" value={String(extendedStats.p99)} />
            <StatCell label="min" value={String(extendedStats.min)} />
            <StatCell label="max" value={String(extendedStats.max)} />
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
