'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DiscreteHistogram, { type HistSeries } from './_components/DiscreteHistogram';
import ScrambleLengthView, {
  type EventLengthsJson, MERGE_GROUPS, MERGED_HIDDEN,
} from './_components/ScrambleLengthView';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import { variantLabel, type ScrambleVariant } from '@/lib/scramble-variants';
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
  event?: string;            // per-event 子集(wca_333oh 等)带;顶级数据集无
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
  '333fm': { zh: '3x3 最少步', en: '3x3 FMC' },
};
function eventLabel(e: string, isZh: boolean): string {
  const m = EVENT_LABEL[e];
  return m ? ((i18n.language === 'zh-Hant' ? (m.zhHant ?? m.zh) : (i18n.language.startsWith('zh') ? m.zh : m.en))) : e;
}

// 难度 tab 目前只有三阶有数据 —— 这 6 个 WCA 项目全是三阶魔方、全用 TNoodle 三阶随机态打乱,
// 故它们的阶段难度分布完全相同,共用同一份 distribution 数据。其余项目(4x4/金字塔/SQ1 等)
// 暂无难度数据,选中显示占位(用户后续会逐个加入)。
const DIFFICULTY_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf', '333mbo']);

// 页面标题单一来源:h1 与 document.title(浏览器标签页)都从这里取,改标题只改这一处。
const PAGE_TITLE = { zh: '打乱统计', en: 'Scramble Stats', zhHant: "打亂統計" };

// 下拉顺序 = distribution JSON 键枚举:数字键(123/222/223)永远最前,字符串键按
// build.ts VARIANTS 插入序 —— 123x2/eoline/dr 落尾部。标签走共享 lib/scramble-variants。
type VariantKey = ScrambleVariant;
type YMode = 'percent' | 'count';
type ChartMode = 'pdf' | 'cdf';

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
  block222: { en: '2x2x2', zh: '2x2x2' },
  fbsquare: { en: '1x2x2', zh: '1x2x2' },
  rouxs1: { en: '1x2x3', zh: '1x2x3' },
  block223: { en: '2x2x3', zh: '2x2x3' },
  f2b: { en: '1x2x3 x2', zh: '1x2x3 x2' },
  eo: { en: 'EO', zh: 'EO' },
  eoline: { en: 'EOLine', zh: 'EOLine' },
  dr: { en: 'DR', zh: 'DR' },
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
  useDocumentTitle(PAGE_TITLE.zh, PAGE_TITLE.en, PAGE_TITLE.zhHant);

  const [tab, setTab] = useState<'difficulty' | 'length'>('difficulty');
  const [data, setData] = useState<DistributionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shared WCA-event selector (above the tabs) — drives both the length tab and
  // the difficulty tab. event_lengths.json is tiny (~2KB), fetched once here.
  // merged 双语义:长度 tab = 折叠共打乱组(333+oh / bf+mbf);难度 tab = 全部六个
  // 三阶项目并成一个池(wca 合并 set)。
  const [event, setEvent] = useState<string>('333');
  const [merged, setMerged] = useState(true);
  const [lengthsData, setLengthsData] = useState<EventLengthsJson | null>(null);
  const [lengthsError, setLengthsError] = useState<string | null>(null);
  // Difficulty data source (top-level set: wca / xcross_2_col_10f). The actually
  // displayed set additionally routes through the event selector: wca + 333oh →
  // per-event set 'wca_333oh'; non-wca datasets are synthetic (no event split).
  const [dataset, setDataset] = useState<string>('wca');
  const [variant, setVariant] = useState<VariantKey>('std');
  const [stage, setStage] = useState<string>('cross');
  const sel = useSubsetSelection('cn');
  const [yMode, setYMode] = useState<YMode>('percent');
  const [chartMode, setChartMode] = useState<ChartMode>('pdf');
  const [examples, setExamples] = useState<ExamplesJson | null>(null);
  // per-event 示例分片缓存:setKey(wca_333oh 等)→ 该项目自己的 reservoir 示例
  const [evExamples, setEvExamples] = useState<Record<string, ExamplesSet | null>>({});
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  // 异步加载 comp→country 索引,完成后 bump version 触发重渲染拿示例卡片的比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // v= bump:2026-06-10 加 per-event sets(shape 变更,防缓存旧 JSON)
    fetch(statsUrl('/stats/scramble/distribution.json') + '?v=20260610pe')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    fetch(statsUrl('/stats/scramble/event_lengths.json'))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setLengthsData)
      .catch((e) => setLengthsError(String(e)));
  }, []);

  // Events offered in the shared selector — those with length data.
  // Difficulty tab: merged(默认)把 6 个三阶项目折叠成一个 333 入口(= wca 合并池);
  // 分开时三阶族逐项可选(per-event sets)。synthetic 数据集(xcross)无项目拆分,恒折叠。
  // Length tab: hide the merged-away members (333oh / 333mbf) while merging is on.
  const availableEvents = useMemo(() => {
    const all = new Set(lengthsData ? Object.keys(lengthsData.events) : []);
    if (tab === 'difficulty') {
      if (merged || dataset !== 'wca') for (const id of DIFFICULTY_EVENTS) if (id !== '333') all.delete(id);
    } else if (merged) {
      for (const id of MERGED_HIDDEN) all.delete(id);
    }
    return all;
  }, [lengthsData, merged, tab, dataset]);

  // Length tab merging hides member events — fold any merged member onto its rep.
  useEffect(() => {
    if (tab !== 'length' || !merged) return;
    const g = MERGE_GROUPS.find((g) => g.rep !== event && g.members.includes(event));
    if (g) setEvent(g.rep);
  }, [tab, merged, event]);

  // Difficulty tab merged(或 synthetic 数据集)折叠三阶族 — fold onto 333.
  useEffect(() => {
    if (tab === 'difficulty' && (merged || dataset !== 'wca') && event !== '333' && DIFFICULTY_EVENTS.has(event)) {
      setEvent('333');
    }
  }, [tab, dataset, merged, event]);

  // Effective distribution set: top-level dataset, routed through the event
  // selector for the WCA source (merged → 合并池; split → per-event set).
  const scrambleSet = useMemo(() => {
    if (dataset !== 'wca') return dataset;
    if (merged) return 'wca';
    return DIFFICULTY_EVENTS.has(event) ? `wca_${event}` : 'wca';
  }, [dataset, merged, event]);

  // Keep the selection on an event that actually has length data ('' = the
  // difficulty tab's merged-family pseudo-event, always valid there).
  useEffect(() => {
    if (lengthsData && event !== '' && !lengthsData.events[event]) {
      const first = Object.keys(lengthsData.events)[0];
      if (first) setEvent(first);
    }
  }, [lengthsData, event]);

  useEffect(() => {
    if (data && !data.sets[dataset]) {
      const first = Object.keys(data.sets).find((k) => !data.sets[k].event);
      if (first) setDataset(first);
    }
  }, [data, dataset]);

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

  // per-event 选择时示例走独立分片(该项目自己的 reservoir);合并池/xcross 走 examples.json
  const isPerEvent = dataset === 'wca' && scrambleSet !== 'wca';
  const ensureExamplesLoaded = () => {
    if (isPerEvent) {
      if (scrambleSet in evExamples) return;
      setEvExamples((m) => ({ ...m, [scrambleSet]: null }));
      setExamplesLoading(true);
      fetch(statsUrl(`/stats/scramble/examples_${scrambleSet}.json`), { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((j) => { setEvExamples((m) => ({ ...m, [scrambleSet]: j })); setExamplesLoading(false); })
        .catch((e) => { setExamplesError(String(e)); setExamplesLoading(false); });
      return;
    }
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

  // 当前示例来源:per-event 选择 → 该项目的分片;否则 examples.json 的顶级 set。
  const exSet = isPerEvent ? (evExamples[scrambleSet] ?? null) : (examples?.sets[dataset] ?? null);
  const currentSamples = useMemo<ExampleSample[] | null>(() => {
    if (selectedBin === null || !exSet) return null;
    return exSet.variants[variant]?.[stage]?.[subsetKey]?.[String(selectedBin)] ?? null;
  }, [exSet, variant, stage, subsetKey, selectedBin]);

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

  // Single stable title — shared with document.title via PAGE_TITLE.
  const pageTitle = tr(PAGE_TITLE);
  const tabsBar = (
    <div className="scramble-stats-tabs" role="tablist">
      <button
        type="button" role="tab" aria-selected={tab === 'difficulty'}
        className={`scramble-stats-tab${tab === 'difficulty' ? ' active' : ''}`}
        onClick={() => setTab('difficulty')}
      >{tr({ zh: '难度', en: 'Difficulty',
          zhHant: "難度"
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

  // Dataset toggle (difficulty tab only): the two top-level sets (WCA / xcross)
  // become a PillToggle sitting just left of the merge toggle. Rendered only when
  // exactly two top-level datasets exist.
  const topSets = data ? Object.entries(data.sets).filter(([, s]) => !s.event) : [];
  const datasetToggle = (tab === 'difficulty' && topSets.length === 2) ? (() => {
    const [k0, s0] = topSets[0];
    const [k1, s1] = topSets[1];
    const lab = (s: SetData) => (isZh && s.label_zh) ? s.label_zh : s.label;
    return (
      <PillToggle
        value={dataset === k0}
        onChange={(v) => setDataset(v ? k0 : k1)}
        onLabel={lab(s0)}
        offLabel={lab(s1)}
        ariaLabel={tr({ zh: '数据集', en: 'Dataset',
            zhHant: "資料集"
        })}
      />
    );
  })() : null;

  // Shared header: WCA-event selector sits ABOVE the tab bar so it drives both
  // the difficulty tab and the length tab.
  const header = (
    <div className="scramble-stats-header">
      <h1>{pageTitle}</h1>
      <div className="scramble-stats-event-bar">
        <div className="scramble-stats-tabrow">
          {tabsBar}
          {datasetToggle}
        {(tab === 'length' || dataset === 'wca') && (
          <div className="scramble-len-merge">
            <PillToggle
              value={merged}
              onChange={setMerged}
              onLabel={tr({ zh: '合并', en: 'Merged',
                  zhHant: "合併"
            })}
              offLabel={tr({ zh: '分开', en: 'Split',
                  zhHant: "分開"
            })}
              ariaLabel={tr({ zh: '合并打乱相同的项目', en: 'Merge events that share scrambles',
                  zhHant: "合併打亂相同的項目"
            })}
            />
            <span className="scramble-len-merge-hint">
              {tab === 'difficulty'
                ? (tr({ zh: '三阶速拧 / 单手 / 盲拧 / 多盲 / 最少步 / 脚拧打乱相同,合并为一个池', en: 'All six 3×3 events share scrambles; merged into one pool',
                    zhHant: "三階速擰 / 單手 / 盲擰 / 多盲 / 最少步 / 腳擰打亂相同,合併為一個池"
                }))
                : (tr({ zh: '三阶速拧与单手、三盲与多盲打乱相同', en: '3×3 speed + OH, and 3BLD + MBLD share scrambles',
                    zhHant: "三階速擰與單手、三盲與多盲打亂相同"
                }))}
            </span>
          </div>
        )}
        </div>
        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={event}
          onSelect={setEvent}
          isZh={isZh}
          onlyAvailable
        />
      </div>
    </div>
  );

  if (tab === 'length') {
    return (
      <div className="scramble-stats-page">
        {header}
        {lengthsError
          ? <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed',
              zhHant: "載入失敗"
        })}: {lengthsError}</div>
          : <ScrambleLengthView isZh={isZh} data={lengthsData} event={event} merged={merged} />}
      </div>
    );
  }

  // Difficulty tab — only 3×3-family events have stage-difficulty data for now.
  if (!DIFFICULTY_EVENTS.has(event)) {
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-loading">
          {tr({ zh: '该项目暂无难度数据,即将加入', en: 'Difficulty data for this puzzle is coming soon',
              zhHant: "該項目暫無難度資料,即將加入"
        })}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed',
            zhHant: "載入失敗"
        })}: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>
      </div>
    );
  }

  // Per-event set missing from the JSON (e.g. stats not yet regenerated for
  // this deploy) — show a placeholder rather than an empty chart.
  if (!currentSet) {
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-loading">
          {tr({ zh: '该项目难度数据生成中,稍后再来', en: 'Per-event difficulty data is being generated, check back soon',
              zhHant: "該項目難度資料生成中,稍後再來"
        })}
        </div>
      </div>
    );
  }

  const vData = currentSet.variants[variant];

  const sampleCount = tr({ zh: '{n} 条样本', en: '{n} samples',
      zhHant: "{n} 條樣本"
}).replace('{n}', currentSet.sample_count.toLocaleString());

  return (
    <div className="scramble-stats-page">
      {header}

      <div className="scramble-stats-controls">
        <div className="scramble-stats-color-control">
          <SubsetColorPicker sel={sel} isZh={isZh} />
        </div>
        <label>
          <select value={variant} onChange={(e) => setVariant(e.target.value as VariantKey)} aria-label={tr({ zh: '变体', en: 'Variant',
              zhHant: "變體"
        })}>
            {currentSet && (Object.keys(currentSet.variants) as VariantKey[]).map((v) => (
              <option key={v} value={v}>{variantLabel(v, i18n.language.startsWith('zh'))}</option>
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
        <span className="scramble-stats-count">{sampleCount}</span>
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
        comps={exSet?.comps}
        idMeta={exSet?.idMeta}
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
