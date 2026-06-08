'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DiscreteHistogram, { type HistSeries } from './_components/DiscreteHistogram';
import ScrambleLengthView from './_components/ScrambleLengthView';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import {
  SubsetColorPicker, useSubsetSelection, fillColorsForSubset,
  COLOR_HEX, type ColorLetter,
} from '@/components/SubsetColorPicker/SubsetColorPicker';
import './scramble_stats.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface HistEntry {
  min: number;
  max: number;
  counts: Record<string, number>;
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

type ExampleSample = [string, string, string];        // [id, scramble, bottomColor]
type ExampleCompMeta = [string, string, number, string, string, (0 | 1)?]; // [compId, eventId, scrambleNum, roundType, group, isExtra?]
interface ExamplesSet {
  variants: Record<string, Record<string, Record<string, Record<string, ExampleSample[]>>>>;
  comps?: Record<string, [string, string]>;           // compId → [比赛名, 日期串]
  idMeta?: Record<string, ExampleCompMeta>;            // 全 id → [compId, 项目, 打乱序号]
}
interface ExamplesJson {
  meta: { generated_at: string };
  sets: Record<string, ExamplesSet>;
}

const EVENT_LABEL: Record<string, { zh: string; en: string
        zhHant?: string;
 }> = {
  '333': { zh: '3x3', en: '3x3' },
  '333oh': { zh: '3x3 单手', en: '3x3 OH',
      zhHant: "3x3 單手"
},
  '333bf': { zh: '3x3 盲拧', en: '3x3 BLD',
      zhHant: "3x3 盲擰"
},
  '333ft': { zh: '3x3 脚拧', en: '3x3 FT',
      zhHant: "3x3 腳擰"
},
  '333mbf': { zh: '3x3 多盲', en: '3x3 MBLD' },
};
function eventLabel(e: string, isZh: boolean): string {
  const m = EVENT_LABEL[e];
  return m ? ((i18n.language === 'zh-Hant' ? (m.zhHant ?? m.zh) : (i18n.language.startsWith('zh') ? m.zh : m.en))) : e;
}

type VariantKey = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo';
type YMode = 'percent' | 'count';
type ChartMode = 'pdf' | 'cdf';

const VARIANT_LABEL: Record<VariantKey, { en: string; zh: string
        zhHant?: string;
 }> = {
  std: { en: 'Standard', zh: '标准',
      zhHant: "標準"
},
  eo: { en: 'EO', zh: 'EO' },
  pair: { en: 'Pair', zh: '基态',
      zhHant: "基態"
},
  pseudo: { en: 'Pseudo', zh: '伪',
      zhHant: "偽"
},
  pseudo_pair: { en: 'Pseudo Pair', zh: '伪基态',
      zhHant: "偽基態"
},
  f2leo: { en: 'F2LEO', zh: 'F2LEO' },
  pseudo_f2leo: { en: 'Pseudo F2LEO', zh: '伪 F2LEO',
      zhHant: "偽 F2LEO"
},
};

const STAGE_LABEL: Record<string, { en: string; zh: string
        zhHant?: string;
 }> = {
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
  f2leo_cross: { en: 'Cross', zh: '十字' },
  pseudo_f2leo_cross: { en: 'Cross', zh: '十字' },
  f2leo_xcross: { en: 'XCross', zh: 'XCross' },
  pseudo_f2leo_xcross: { en: 'XCross', zh: 'XCross' },
  f2leo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  pseudo_f2leo_xxcross: { en: 'XXCross', zh: 'XXCross' },
  f2leo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  pseudo_f2leo_xxxcross: { en: 'XXXCross', zh: 'XXXCross' },
  f2l: { en: 'XXXXCross', zh: 'XXXXCross' },
  xxxxcross: { en: 'XXXXCross', zh: 'XXXXCross' },
  eo_xxxxcross: { en: 'XXXXCross', zh: 'XXXXCross' },
};

const labelStage = (s: string, isZh: boolean) => STAGE_LABEL[s] ? STAGE_LABEL[s][isZh ? 'zh' : 'en'] : s;

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
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('打乱分布', 'Scramble Stats', "打亂分佈");

  const [tab, setTab] = useState<'difficulty' | 'length'>('difficulty');
  const [data, setData] = useState<DistributionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrambleSet, setScrambleSet] = useState<string>('wca');
  const [variant, setVariant] = useState<VariantKey>('std');
  const [stage, setStage] = useState<string>('cross');
  const sel = useSubsetSelection('cn');
  const [yMode, setYMode] = useState<YMode>('percent');
  const [chartMode, setChartMode] = useState<ChartMode>('pdf');
  const [examples, setExamples] = useState<ExamplesJson | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  // 异步加载 comp→country 索引,完成后 bump version 触发重渲染拿示例卡片的比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(statsUrl('/stats/scramble/distribution.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

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

  const subsetKey = sel.subsetKey;
  const selectedColors = sel.selectedColors;
  const modeLabel = i18n.language === 'zh-Hant' ? ({ cn: '六色底', quad: '四色底', dual: '雙色底', single: '單色底' }[sel.colorMode]) : (isZh
      ? { cn: '六色底', quad: '四色底', dual: '双色底', single: '单色底' }[sel.colorMode]
      : { cn: 'CN', quad: 'Quad', dual: 'Dual', single: 'Single' }[sel.colorMode]);

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
    fetch(statsUrl('/stats/scramble/examples.json'), { cache: 'no-store' })
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
    }];
  }, [currentSet, variant, stage, subsetKey, selectedColors, modeLabel]);

  const extendedStats = useMemo(() => {
    if (series.length !== 1) return null;
    return computeStats(series[0].counts);
  }, [series]);

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

  const pageTitle = tab === 'length'
    ? (tr({ zh: '打乱统计', en: 'Scramble Stats',
        zhHant: "打亂統計"
    }))
    : (tr({ zh: '打乱难度分布', en: 'Scramble Distribution',
        zhHant: "打亂難度分佈"
    }));
  const tabsBar = (
    <div className="scramble-stats-tabs" role="tablist">
      <button
        type="button" role="tab" aria-selected={tab === 'difficulty'}
        className={`scramble-stats-tab${tab === 'difficulty' ? ' active' : ''}`}
        onClick={() => setTab('difficulty')}
      >{tr({ zh: '十字难度', en: 'Cross difficulty',
          zhHant: "十字難度"
    })}</button>
      <button
        type="button" role="tab" aria-selected={tab === 'length'}
        className={`scramble-stats-tab${tab === 'length' ? ' active' : ''}`}
        onClick={() => setTab('length')}
      >{tr({ zh: '打乱长度', en: 'Scramble length',
          zhHant: "打亂長度"
    })}</button>
    </div>
  );

  if (tab === 'length') {
    return (
      <div className="scramble-stats-page">
        <div className="scramble-stats-header">
          <h1>{pageTitle}</h1>
          {tabsBar}
        </div>
        <ScrambleLengthView isZh={isZh} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="scramble-stats-page">
        <div className="scramble-stats-header">
          <h1>{pageTitle}</h1>
          {tabsBar}
        </div>
        <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed',
            zhHant: "載入失敗"
        })}: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="scramble-stats-page">
        <div className="scramble-stats-header">
          <h1>{pageTitle}</h1>
          {tabsBar}
        </div>
        <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>
      </div>
    );
  }

  const vData = currentSet?.variants[variant];

  const sourceText = (() => {
    if (scrambleSet === 'wca') {
      const n = currentSet?.sample_count.toLocaleString() ?? '?';
      return i18n.language === 'zh-Hant' ? (`來源: WCA 歷史 ${n} 條三階打亂,覆蓋三階速擰 / 單手 / 盲擰 / 多盲 / 最少步 / 腳擰 6 個項目;每條按 6 種底色方向(黃 / 紅 / 白 / 橙 / 藍 / 綠)求階段最優步數的分佈。`) : (isZh
              ? `来源: WCA 历史 ${n} 条三阶打乱,覆盖三阶速拧 / 单手 / 盲拧 / 多盲 / 最少步 / 脚拧 6 个项目;每条按 6 种底色方向(黄 / 红 / 白 / 橙 / 蓝 / 绿)求阶段最优步数的分布。`
              : `Source: ${n} WCA historical 3×3 scrambles from 6 events (3×3, OH, BLD, Multi-BLD, FMC, Feet); each analyzed across 6 bottom-color orientations (Y/R/W/O/B/G). Distribution of stage-optimal move counts.`);
    }
    if (!currentSet) return '';
    const labelDisp = (isZh && currentSet.label_zh) ? currentSet.label_zh : currentSet.label;
    const n = currentSet.sample_count.toLocaleString();
    return i18n.language === 'zh-Hant' ? (`來源: ${labelDisp},共 ${n} 條樣本;每條按 6 種底色方向求階段最優步數的分佈。`) : (isZh
          ? `来源: ${labelDisp},共 ${n} 条样本;每条按 6 种底色方向求阶段最优步数的分布。`
          : `Source: ${labelDisp} (${n} samples); each analyzed across 6 bottom-color orientations.`);
  })();

  const setOptions = Object.entries(data.sets).map(([key, s]) => ({
    value: key,
    label: `${(isZh && s.label_zh) ? s.label_zh : s.label} (${s.sample_count.toLocaleString()})`,
  }));

  return (
    <div className="scramble-stats-page">
      <div className="scramble-stats-header">
        <h1>{pageTitle}</h1>
        {tabsBar}
        <p className="scramble-stats-note">{sourceText}</p>
      </div>

      <div className="scramble-stats-controls">
        <div className="scramble-stats-color-control">
          <SubsetColorPicker sel={sel} isZh={isZh} />
        </div>
        <label>
          <select value={variant} onChange={(e) => setVariant(e.target.value as VariantKey)} aria-label={tr({ zh: '变体', en: 'Variant',
              zhHant: "變體"
        })}>
            {currentSet && (Object.keys(currentSet.variants) as VariantKey[]).map((v) => (
              <option key={v} value={v}>{VARIANT_LABEL[v][(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
            ))}
          </select>
        </label>
        <label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label={tr({ zh: '阶段', en: 'Stage',
              zhHant: "階段"
        })}>
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
          clickableBins={previewBins}
          selectedBin={selectedBin}
          onBarClick={handleBarClick}
          hideLegendColors
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          yModeLabel={yMode === 'percent' ? (tr({ zh: '百分比', en: '%' })) : (tr({ zh: '数量', en: 'count',
              zhHant: "數量"
        }))}
          setOptions={setOptions}
          activeSet={scrambleSet}
          onSetChange={setScrambleSet}
        />
      </div>

      {extendedStats && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计', en: 'Summary stats',
              zhHant: "摘要統計"
        })}</div>
          <div className="scramble-stats-stat-grid">
            <StatCell label={tr({ zh: '均值', en: 'mean' })} value={extendedStats.mean.toFixed(2)} />
            <StatCell label={tr({ zh: '中位数', en: 'median',
                zhHant: "中位數"
            })} value={String(extendedStats.median)} />
            <StatCell label="p10" value={String(extendedStats.p10)} />
            <StatCell label="p90" value={String(extendedStats.p90)} />
            <StatCell label="p99" value={String(extendedStats.p99)} />
          </div>
        </div>
      )}

      <ExamplesPanel
        isZh={isZh}
        lang={(i18n.language.startsWith('zh') ? 'zh' : 'en')}
        scrambleSet={scrambleSet}
        variant={variant}
        stage={stage}
        subsetKey={subsetKey}
        downloadBins={downloadBins}
        selectedBin={selectedBin}
        loading={examplesLoading}
        errorText={examplesError}
        samples={currentSamples}
        comps={examples?.sets[scrambleSet]?.comps}
        idMeta={examples?.sets[scrambleSet]?.idMeta}
      />

      {cnBenefit && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '颜色中立收益（本阶段均值）', en: 'Color-neutrality gain (stage mean)',
              zhHant: "顏色中立收益（本階段均值）"
        })}</div>
          <div className="scramble-stats-cn-grid">
            <CnCell label={tr({ zh: '黄底', en: 'Yellow',
                zhHant: "黃底"
            })} value={cnBenefit.yellowMean.toFixed(3)} />
            <CnCell label={tr({ zh: '白底', en: 'White' })} value={cnBenefit.whiteMean.toFixed(3)} />
            <CnCell label={tr({ zh: '白黄双色底', en: 'Dual',
                zhHant: "白黃雙色底"
            })} value={cnBenefit.wyMean.toFixed(3)} diff={cnBenefit.wyMean - cnBenefit.whiteMean} />
            <CnCell label={tr({ zh: '六色底', en: 'CN' })} value={cnBenefit.all6Mean.toFixed(3)} diff={cnBenefit.all6Mean - cnBenefit.whiteMean} />
          </div>
          <div className="scramble-stats-cn-note">
            {i18n.language === 'zh-Hant' ? (`相對白底基線：雙色底省 ${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)} 步，六色底省 ${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)} 步`) : (isZh
                                    ? `相对白底基线：双色底省 ${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)} 步，六色底省 ${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)} 步`
                                    : `Savings vs white: dual −${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)}, cn −${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)}`)}
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({ zh: '本变体样本', en: 'Variant samples',
              zhHant: "本變體樣本"
        })}: {(vData?.sample_count ?? 0).toLocaleString()}
        </span>
        <span>
          {tr({ zh: '生成时间', en: 'Generated',
              zhHant: "生成時間"
        })}: {new Date(data.meta.generated_at).toLocaleString()}
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

function ExamplesPanel({
  isZh,
  lang,
  scrambleSet,
  variant,
  stage,
  subsetKey,
  downloadBins,
  selectedBin,
  loading,
  errorText,
  samples,
  comps,
  idMeta,
}: {
  isZh: boolean;
  lang: 'zh' | 'en';
  scrambleSet: string;
  variant: string;
  stage: string;
  subsetKey: string;
  downloadBins: number[];
  selectedBin: number | null;
  loading: boolean;
  errorText: string | null;
  samples: ExampleSample[] | null;
  comps?: Record<string, [string, string]>;
  idMeta?: Record<string, ExampleCompMeta>;
}) {
  const selectedDownloadable = selectedBin !== null && downloadBins.includes(selectedBin);
  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {selectedBin !== null
            ? (isZh ? `${selectedBin} 步示例` : `${selectedBin}-move examples`)
            : (tr({ zh: '示例', en: 'Examples' }))}
        </div>
        {selectedDownloadable && (
          <a
            className="scramble-stats-download-btn"
            href={`/stats/scramble/downloads/${scrambleSet}/${variant}/${stage}/${subsetKey}_${selectedBin}.txt`}
            download={`${scrambleSet}_${variant}_${stage}_${subsetKey}_${selectedBin}.txt`}
            title={i18n.language === 'zh-Hant' ? (`下載 ${selectedBin} 步完整 txt`) : (isZh ? `下载 ${selectedBin} 步完整 txt` : `Download full txt for ${selectedBin} moves`)}
            aria-label={i18n.language === 'zh-Hant' ? (`下載 ${selectedBin} 步完整 txt`) : (isZh ? `下载 ${selectedBin} 步完整 txt` : `Download full txt for ${selectedBin} moves`)}
          >
            <DownloadIcon />
          </a>
        )}
      </div>
      {selectedBin !== null && loading && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>
      )}
      {selectedBin !== null && errorText && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载失败', en: 'Load failed',
            zhHant: "載入失敗"
        })}: {errorText}</div>
      )}
      {selectedBin !== null && !loading && !errorText && samples && samples.length > 0 && (
        <ul className="scramble-stats-examples-list">
          {samples.map(([id, scr, color], i) => {
            const m = idMeta?.[id];
            const comp = m ? comps?.[m[0]] : undefined;
            return (
              <li key={i}>
                <span
                  className="scramble-stats-examples-chip"
                  style={{ background: COLOR_HEX[color as ColorLetter] ?? '#888' }}
                  title={tr({ zh: '朝下的底色', en: 'Bottom color' })}
                />
                <div className="scramble-stats-examples-body">
                  <Link
                    className="scramble-stats-examples-scramble"
                    href={`/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: scr.trim().replace(/ /g, '_') })}`}
                    prefetch={false}
                  >
                    {scr}
                  </Link>
                  {comp && m && (() => {
                    const iso2 = compFlagIso2(m[0]);
                    return (
                      <Link
                        className="scramble-stats-examples-comp"
                        href={`/${lang}/scramble/gen?comp=${encodeURIComponent(m[0])}`}
                        prefetch={false}
                        title={comp[0]}
                      >
                        {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                        <span className="scramble-stats-examples-comp-name">{localizeCompName(m[0], comp[0], isZh)}</span>
                        <span className="scramble-stats-examples-comp-meta">
                          <EventIcon event={m[1]} className="scramble-stats-examples-evt" title={eventLabel(m[1], isZh)} />
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
      )}
      {selectedBin !== null && !loading && !errorText && samples && samples.length === 0 && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '此 bin 无示例', en: 'No examples for this bin',
            zhHant: "此 bin 無示例"
        })}</div>
      )}
    </div>
  );
}
