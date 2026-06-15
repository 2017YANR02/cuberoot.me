'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DiscreteHistogram, { type HistSeries } from './_components/DiscreteHistogram';
import PuzzleDistView from './_components/PuzzleDistView';
import ScrambleLengthView, {
  type EventLengthsJson, MERGE_GROUPS, MERGED_HIDDEN, resolveEventLen, lengthAltMeta,
} from './_components/ScrambleLengthView';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { HelpCircle } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import {
  stageLabel, isBlockVariant, VARIANT_ORDER, VARIANT_STAGES, BLOCK_DATA_VARIANTS, BLOCK_STAGE_VARIANT,
  type ScrambleVariant,
} from '@/lib/scramble-variants';
import { VariantSelect } from '@/components/VariantSelect';
import SolveTabs, { type SolvePuzzle } from '../_components/SolveTabs';
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
  counts_qtm?: Record<string, number>; // 333 整解阶段:QTM 计步直方图(HTM/QTM 可切)
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

type ExampleSample = [string, string, string, string?]; // [id, scramble, bottomColor, optScramble?]
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
 }> = {
  '333': { zh: '3x3', en: '3x3' },
  '333oh': { zh: '3x3 单手', en: '3x3 OH'
},
  '333bf': { zh: '3x3 盲拧', en: '3x3 BLD'
},
  '333ft': { zh: '3x3 脚拧', en: '3x3 FT'
},
  '333mbf': { zh: '3x3 多盲', en: '3x3 MBLD' },
  '333fm': { zh: '3x3 最少步', en: '3x3 FMC' },
};
function eventLabel(e: string): string {
  const m = EVENT_LABEL[e];
  return m ? tr(m) : e;
}

// 难度 tab 目前只有三阶有数据 —— 这 6 个 WCA 项目全是三阶魔方、全用 TNoodle 三阶随机态打乱,
// 故它们的阶段难度分布完全相同,共用同一份 distribution 数据。其余项目(4x4/金字塔/SQ1 等)
// 暂无难度数据,选中显示占位(用户后续会逐个加入)。
const DIFFICULTY_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf', '333mbo']);

// 非 3x3 puzzle:WCA event_id → puzzle_distribution.json 的 key。选中这些项目时,
// 难度 tab 显示该 puzzle 的整解步数分布(数据来自独立 native solver 管线)。
// sq1 是近最优(双阶段上界),其余三个是精确最优 —— 口径差异在 PuzzleDistView 里标注。
const PUZZLE_EVENT_MAP: Record<string, string> = { '222': 'pocket', pyram: 'pyraminx', skewb: 'skewb', sq1: 'sq1' };

// 页面标题单一来源:h1 与 document.title(浏览器标签页)都从这里取,改标题只改这一处。
const PAGE_TITLE = { zh: '打乱统计', en: 'Scramble Stats' };

// 下拉顺序 = distribution JSON 键枚举:数字键(123/222/223)永远最前,字符串键按
// build.ts VARIANTS 插入序 —— 123x2/eoline/dr 落尾部。标签走共享 lib/scramble-variants。
type VariantKey = ScrambleVariant;
type YMode = 'percent' | 'count';
type ChartMode = 'pdf' | 'cdf';

// 阶段显示名走全站单一真源 lib/scramble-variants 的 stageLabel(剥变体前缀/后缀)。

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
  useDocumentTitle(PAGE_TITLE.zh, PAGE_TITLE.en);

  const [tab, setTab] = useState<'difficulty' | 'length'>('difficulty');
  const [data, setData] = useState<DistributionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shared WCA-event selector (above the tabs) — drives both the length tab and
  // the difficulty tab. event_lengths.json is tiny (~2KB), fetched once here.
  // merged 双语义:长度 tab = 折叠共打乱组(333+oh / bf+mbf);难度 tab = 全部六个
  // 三阶项目并成一个池(wca 合并 set)。
  // event 进 URL(nuqs):统一「求解」中心的项目行(?event=222 等)切分布时要响应式;
  // 也让分享/后退准确。filter 性质 → replace,不堆历史。
  const [event, setEvent] = useQueryState(
    'event',
    parseAsString.withDefault('333').withOptions({ history: 'replace' }),
  );
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
  // 整解(stage '333')专属:HTM(默认,真实数据)/ QTM(占位,数据后续用 15G 表生成)。
  const [optMetric, setOptMetric] = useState<'htm' | 'qtm'>('htm');
  // 长度 tab 第二计步口径(钮在顶栏):3x3-family HTM/QTM、sq1 WCA/slash;sq1 默认 slash。
  const [lenMetric, setLenMetric] = useState<'htm' | 'qtm'>('htm');
  const [examples, setExamples] = useState<ExamplesJson | null>(null);
  // per-event 示例分片缓存:setKey(wca_333oh 等)→ 该项目自己的 reservoir 示例
  const [evExamples, setEvExamples] = useState<Record<string, ExamplesSet | null>>({});
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  // 整解(333)示例:原始 WCA 打乱 vs 最优(最短)等价打乱(同状态)。
  const [exView, setExView] = useState<'orig' | 'opt'>('orig');
  // 「下载全部」可用阶段(std 变体全量语料 gz);manifest 缺失则不显示按钮。
  const [bundleStages, setBundleStages] = useState<string[] | null>(null);

  // 异步加载 comp→country 索引,完成后 bump version 触发重渲染拿示例卡片的比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // v= bump:2026-06-14 333 整解最优注入真实产出(240 雏形 → 226,965 样本),防缓存旧 JSON
    fetch(statsUrl('/stats/scramble/distribution.json') + '?v=20260614opt')
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

  // 「下载全部」manifest(std 变体哪些阶段有全量语料 gz);缺失静默不显示按钮。
  useEffect(() => {
    fetch(statsUrl('/stats/scramble/bundles/manifest.json') + '?v=20260614')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setBundleStages(j?.sets?.wca?.std ?? []))
      .catch(() => setBundleStages([]));
  }, []);

  // 长度 tab 切项目:sq1 默认 slash,其余默认 HTM。
  useEffect(() => { setLenMetric(event === 'sq1' ? 'qtm' : 'htm'); }, [event]);

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

  // 切项目/数据集后当前方法可能不存在(如 '333' 只在合并池有)——回退到 std。
  useEffect(() => {
    if (currentSet && !currentSet.variants[variant] && !isBlockVariant(variant)) setVariant('std');
  }, [currentSet, variant]);

  const subsetKey = sel.subsetKey;
  const selectedColors = sel.selectedColors;
  const modeLabel = (isZh
      ? { cn: '六色底', quad: '四色底', dual: '双色底', single: '单色底' }[sel.colorMode]
      : { cn: 'CN', quad: 'Quad', dual: 'Dual', single: 'Single' }[sel.colorMode]);

  // 整解:作为独立「方法」(variant '333'),阶段仅有 '333' 自身;无配色维度,
  // 数据存在单一伪子集 'ALL',口径走 HTM/QTM 而非颜色选择器。
  const is333 = variant === '333';
  const effectiveSubset = is333 ? 'ALL' : subsetKey;
  // 当前直方图计数:整解 + QTM → counts_qtm(暂空);其余一律 counts。
  const activeCounts = useMemo<Record<string, number>>(() => {
    if (!currentSet) return {};
    const hist = currentSet.variants[variant]?.data[stage]?.[effectiveSubset];
    if (!hist) return {};
    return (is333 && optMetric === 'qtm') ? (hist.counts_qtm ?? {}) : hist.counts;
  }, [currentSet, variant, stage, effectiveSubset, is333, optMetric]);

  // 切换阶段时重置整解口径(离开/进入 333 都回到 HTM)。
  useEffect(() => { setOptMetric('htm'); }, [stage]);

  const previewBins = useMemo<number[]>(
    () => Object.keys(activeCounts).map(Number).sort((a, b) => a - b),
    [activeCounts],
  );
  const downloadBins = useMemo<number[]>(() => {
    if (!currentSet) return [];
    return currentSet.variants[variant]?.data[stage]?.[effectiveSubset]?.example_bins ?? [];
  }, [currentSet, variant, stage, effectiveSubset]);

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
  }, [scrambleSet, variant, stage, effectiveSubset, optMetric, previewBins.length]);

  // 当前示例来源:per-event 选择 → 该项目的分片;否则 examples.json 的顶级 set。
  const exSet = isPerEvent ? (evExamples[scrambleSet] ?? null) : (examples?.sets[dataset] ?? null);
  const currentSamples = useMemo<ExampleSample[] | null>(() => {
    if (selectedBin === null || !exSet) return null;
    return exSet.variants[variant]?.[stage]?.[effectiveSubset]?.[String(selectedBin)] ?? null;
  }, [exSet, variant, stage, effectiveSubset, selectedBin]);

  const series = useMemo<HistSeries[]>(() => {
    if (Object.keys(activeCounts).length === 0) return [];
    return [{
      // 整解:中性暖色单色;其余按所选配色子集渐变。
      name: is333 ? (optMetric === 'qtm' ? 'QTM' : 'HTM') : modeLabel,
      fillColors: is333 ? ['#8B7D72'] : fillColorsForSubset(selectedColors),
      counts: activeCounts,
    }];
  }, [activeCounts, is333, optMetric, selectedColors, modeLabel]);

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

  // 非 3x3 puzzle 项目:难度 tab 显示 puzzle 整解分布,3x3 专属的合并/数据集开关无意义,隐藏。
  const isPuzzleEvent = tab === 'difficulty' && !!PUZZLE_EVENT_MAP[event];

  // 长度 tab 第二计步口径钮(顶栏右侧):仅当所选项目带 counts_qtm 时出现。
  const lenCur = useMemo(() => resolveEventLen(lengthsData, event, merged), [lengthsData, event, merged]);
  const lenHasQtm = tab === 'length' && !!lenCur?.counts_qtm;
  const lenAlt = lengthAltMeta(event);
  // 该项目打乱总数(两口径同总数);顶栏右侧展示。
  const lenTotal = useMemo(
    () => (lenCur ? Object.values(lenCur.counts).reduce((a, b) => a + b, 0) : 0),
    [lenCur],
  );
  const tabsBar = (
    <div className="scramble-stats-tabs" role="tablist">
      <button
        type="button" role="tab" aria-selected={tab === 'difficulty'}
        className={`scramble-stats-tab${tab === 'difficulty' ? ' active' : ''}`}
        onClick={() => setTab('difficulty')}
      >{tr({ zh: '难度', en: 'Difficulty'
    })}</button>
      <button
        type="button" role="tab" aria-selected={tab === 'length'}
        className={`scramble-stats-tab${tab === 'length' ? ' active' : ''}`}
        onClick={() => setTab('length')}
      >{tr({ zh: '打乱长度', en: 'Scramble length'
    })}</button>
    </div>
  );

  // Dataset toggle (difficulty tab only): the two top-level sets (WCA / xcross)
  // become a PillToggle sitting just left of the merge toggle. Rendered only when
  // exactly two top-level datasets exist.
  const topSets = data ? Object.entries(data.sets).filter(([, s]) => !s.event) : [];
  const datasetToggle = (tab === 'difficulty' && !isPuzzleEvent && topSets.length === 2) ? (() => {
    const [k0, s0] = topSets[0];
    const [k1, s1] = topSets[1];
    const lab = (s: SetData) => (isZh && s.label_zh) ? s.label_zh : s.label;
    return (
      <PillToggle
        value={dataset === k0}
        onChange={(v) => setDataset(v ? k0 : k1)}
        onLabel={lab(s0)}
        offLabel={lab(s1)}
        ariaLabel={tr({ zh: '数据集', en: 'Dataset'
        })}
      />
    );
  })() : null;

  // 统一「求解」中心:项目行高亮按当前 event 推(3x3 族都算 3×3)。
  const distPuzzle: SolvePuzzle | null =
    DIFFICULTY_EVENTS.has(event) ? '3x3'
      : event === '222' ? '2x2x2'
        : event === 'pyram' ? 'pyraminx'
          : event === 'skewb' ? 'skewb'
            : null;

  // Shared header: WCA-event selector sits ABOVE the tab bar so it drives both
  // the difficulty tab and the length tab.
  const header = (
    <div className="scramble-stats-header">
      <SolveTabs puzzle={distPuzzle} mode="dist" />
      <div className="scramble-stats-event-bar">
        <div className="scramble-stats-tabrow">
          {tabsBar}
          {datasetToggle}
        {(tab === 'length' || (dataset === 'wca' && !isPuzzleEvent)) && (
          <div className="scramble-len-merge">
            <PillToggle
              value={merged}
              onChange={setMerged}
              onLabel={tr({ zh: '合并', en: 'Merged'
            })}
              offLabel={tr({ zh: '分开', en: 'Split'
            })}
              ariaLabel={tr({ zh: '合并打乱相同的项目', en: 'Merge events that share scrambles'
            })}
            />
            <InfoTooltip
              icon={HelpCircle}
              content={tab === 'difficulty'
                ? tr({ zh: '三阶速拧 / 单手 / 盲拧 / 多盲 / 最少步 / 脚拧打乱相同,合并为一个池', en: 'All six 3×3 events share scrambles; merged into one pool'
                                  })
                : tr({ zh: '三阶速拧与单手、三盲与多盲打乱相同', en: '3×3 speed + OH, and 3BLD + MBLD share scrambles'
                                  })}
            />
          </div>
        )}
        {lenHasQtm && (
          <div className="scramble-stats-puzzle-toggle scramble-len-metric-head">
            <PillToggle
              value={lenMetric === 'qtm'}
              onChange={(v) => setLenMetric(v ? 'qtm' : 'htm')}
              offLabel={lenAlt.off}
              onLabel={lenAlt.on}
              ariaLabel={lenAlt.aria}
            />
            <InfoTooltip icon={HelpCircle} content={lenMetric === 'qtm' ? lenAlt.onHint : lenAlt.offHint} />
          </div>
        )}
        {tab === 'length' && lenTotal > 0 && (
          <span className="scramble-stats-count">
            {tr({ zh: '共 {n} 条', en: '{n} scrambles'
            }).replace('{n}', lenTotal.toLocaleString())}
          </span>
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
          ? <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed'
        })}: {lengthsError}</div>
          : <ScrambleLengthView isZh={isZh} data={lengthsData} event={event} merged={merged} metric={lenMetric} />}
      </div>
    );
  }

  // Difficulty tab — 非 3x3 族:接 native solver 管线的 puzzle 整解最优步数分布。
  if (!DIFFICULTY_EVENTS.has(event)) {
    const puzzleKey = PUZZLE_EVENT_MAP[event];
    if (puzzleKey) {
      return (
        <div className="scramble-stats-page">
          {header}
          <PuzzleDistView isZh={isZh} puzzleKey={puzzleKey} />
        </div>
      );
    }
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-loading">
          {tr({ zh: '该项目暂无难度数据,即将加入', en: 'Difficulty data for this puzzle is coming soon'
        })}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed'
        })}: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="scramble-stats-page">
        {header}
        <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…'
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
          {tr({ zh: '该项目难度数据生成中,稍后再来', en: 'Per-event difficulty data is being generated, check back soon'
        })}
        </div>
      </div>
    );
  }

  const vData = currentSet.variants[variant];

  // 整解阶段样本量 = 该口径直方图总数(目前为抽样雏形);其余用数据集总样本。
  const sampleN = is333
    ? Object.values(activeCounts).reduce((a, b) => a + b, 0)
    : currentSet.sample_count;
  const sampleCount = tr({ zh: '{n} 条', en: '{n} scrambles'
}).replace('{n}', sampleN.toLocaleString());

  // 方法下拉:数据层块变体(123/123x2/222/223)聚合显示为「砖」;阶段下拉列块形状,
  // 选中时经 BLOCK_STAGE_VARIANT 落回底层变体,数据/示例/下载全走原 variant+stage 键。
  // 方法下拉顺序走共享 VARIANT_ORDER(与首页 RecentScrambles 一致);块族折叠为 'block'。
  const methodOptions = VARIANT_ORDER.filter((v) =>
    v === 'block'
      ? BLOCK_DATA_VARIANTS.some((b) => !!currentSet.variants[b])
      : !!currentSet.variants[v],
  ) as VariantKey[];
  const blockStages = VARIANT_STAGES.block.filter((s) =>
    currentSet.variants[BLOCK_STAGE_VARIANT[s]]?.stages.includes(s));
  const isBlockUi = isBlockVariant(variant);

  return (
    <div className="scramble-stats-page">
      {header}

      <div className="scramble-stats-controls">
        {/* 整解(333):无配色 / 方法维度,隐藏颜色选择器与方法下拉,改露 HTM/QTM 口径钮。 */}
        {!is333 && (
          <div className="scramble-stats-color-control">
            <SubsetColorPicker sel={sel} isZh={isZh} />
          </div>
        )}
        <label>
          <VariantSelect
            value={isBlockUi ? 'block' : variant}
            options={methodOptions}
            onChange={(val) => {
              const v = val as VariantKey;
              if (v === 'block') {
                const s = blockStages[0];
                if (s) { setVariant(BLOCK_STAGE_VARIANT[s] as VariantKey); setStage(s); }
              } else setVariant(v);
            }}
            isZh={i18n.language.startsWith('zh')}
            ariaLabel={tr({ zh: '变体', en: 'Variant'
        })}
          />
        </label>
        <label>
          <VariantSelect
            value={stage}
            options={isBlockUi ? blockStages : currentStages}
            onChange={(s) => {
              if (isBlockUi && BLOCK_STAGE_VARIANT[s]) setVariant(BLOCK_STAGE_VARIANT[s] as VariantKey);
              setStage(s);
            }}
            isZh={isZh}
            label={stageLabel}
            ariaLabel={tr({ zh: '阶段', en: 'Stage'
        })}
          />
        </label>
        {is333 && (
          <div className="scramble-stats-puzzle-toggle">
            <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '计步', en: 'Metric' })}</span>
            <PillToggle
              value={optMetric === 'qtm'}
              onChange={(v) => setOptMetric(v ? 'qtm' : 'htm')}
              offLabel="HTM"
              onLabel="QTM"
              ariaLabel={tr({ zh: '计步口径:HTM(半圈计 1)或 QTM(半圈计 2)', en: 'Move metric: HTM (half turn = 1) or QTM (half turn = 2)' })}
            />
            <span className="scramble-stats-puzzle-toggle-hint">
              {optMetric === 'qtm'
                ? tr({ zh: 'QTM 计步即将加入', en: 'QTM coming soon' })
                : tr({ zh: '整解最优步数(HTM)', en: 'Optimal solution length (HTM)' })}
            </span>
          </div>
        )}
        <span className="scramble-stats-count">{sampleCount}</span>
        {/* 下载全部:该阶段全量语料(每条打乱 + 比赛信息 + 各底色十字步数)gz CSV;仅 std 变体有。 */}
        {dataset === 'wca' && variant === 'std' && bundleStages?.includes(stage) && (
          <a
            className="scramble-stats-download-all"
            href={statsUrl(`/stats/scramble/bundles/wca/std/all_${stage}.csv.gz`)}
            download={`all_${stage}.csv.gz`}
            title={tr({ zh: '下载该阶段全部打乱(含比赛信息与各底色步数,gzip CSV)', en: 'Download every scramble for this stage (with competition info & per-color move counts, gzip CSV)'
            })}
          >
            <DownloadIcon />
          </a>
        )}
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
          yModeLabel={yMode === 'percent' ? tr({ zh: '百分比', en: '%' }) : tr({ zh: '数量', en: 'count'
                  })}
        />
      </div>

      {extendedStats && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '摘要统计', en: 'Summary stats'
        })}</div>
          <div className="scramble-stats-stat-grid">
            <StatCell label={tr({ zh: '均值', en: 'mean' })} value={extendedStats.mean.toFixed(2)} />
            <StatCell label={tr({ zh: '中位数', en: 'median'
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
        is333={is333}
        exView={exView}
        onExView={setExView}
      />

      {cnBenefit && (
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '颜色中立收益（本阶段均值）', en: 'Color-neutrality gain (stage mean)'
        })}</div>
          <div className="scramble-stats-cn-grid">
            <CnCell label={tr({ zh: '黄底', en: 'Yellow'
            })} value={cnBenefit.yellowMean.toFixed(3)} />
            <CnCell label={tr({ zh: '白底', en: 'White' })} value={cnBenefit.whiteMean.toFixed(3)} />
            <CnCell label={tr({ zh: '白黄双色底', en: 'Dual'
            })} value={cnBenefit.wyMean.toFixed(3)} diff={cnBenefit.wyMean - cnBenefit.whiteMean} />
            <CnCell label={tr({ zh: '六色底', en: 'CN' })} value={cnBenefit.all6Mean.toFixed(3)} diff={cnBenefit.all6Mean - cnBenefit.whiteMean} />
          </div>
          <div className="scramble-stats-cn-note">
            {(isZh
                                    ? `相对白底基线：双色底省 ${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)} 步，六色底省 ${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)} 步`
                                    : `Savings vs white: dual −${(cnBenefit.whiteMean - cnBenefit.wyMean).toFixed(3)}, cn −${(cnBenefit.whiteMean - cnBenefit.all6Mean).toFixed(3)}`)}
          </div>
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>
          {tr({ zh: '本变体样本', en: 'Variant samples'
        })}: {(vData?.sample_count ?? 0).toLocaleString()}
        </span>
        <span>
          {tr({ zh: '生成时间', en: 'Generated'
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
  is333,
  exView,
  onExView,
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
  is333: boolean;
  exView: 'orig' | 'opt';
  onExView: (v: 'orig' | 'opt') => void;
}) {
  const selectedDownloadable = selectedBin !== null && downloadBins.includes(selectedBin);
  // 整解 + 该 bin 示例确有最优打乱数据时才露切换(线上旧 JSON 无第 4 元 → 自动隐藏)。
  const hasOpt = is333 && !!samples?.some((s) => !!s[3]);
  // 示例按比赛时间倒序(最新在前):有 comp 日期串(ISO 前缀)按它,无则退回打乱 id
  //(WCA scramble id ≈ 入库时间序),都取倒序。
  const dateOf = (id: string) => comps?.[idMeta?.[id]?.[0] ?? '']?.[1] ?? '';
  const sortedSamples = samples ? [...samples].sort((a, b) => {
    const d = dateOf(b[0]).localeCompare(dateOf(a[0]));
    return d !== 0 ? d : (Number(b[0]) - Number(a[0]));
  }) : samples;
  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {selectedBin !== null
            ? (isZh ? `${selectedBin} 步示例` : `${selectedBin}-move examples`)
            : tr({ zh: '示例', en: 'Examples' })}
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
        {selectedDownloadable && (
          <a
            className="scramble-stats-download-btn"
            href={`/stats/scramble/downloads/${scrambleSet}/${variant}/${stage}/${subsetKey}_${selectedBin}.txt`}
            download={`${scrambleSet}_${variant}_${stage}_${subsetKey}_${selectedBin}.txt`}
            title={(isZh ? `下载 ${selectedBin} 步完整 txt` : `Download full txt for ${selectedBin} moves`)}
            aria-label={(isZh ? `下载 ${selectedBin} 步完整 txt` : `Download full txt for ${selectedBin} moves`)}
          >
            <DownloadIcon />
          </a>
        )}
      </div>
      {selectedBin !== null && loading && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载中…', en: 'Loading…'
        })}</div>
      )}
      {selectedBin !== null && errorText && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载失败', en: 'Load failed'
        })}: {errorText}</div>
      )}
      {selectedBin !== null && !loading && !errorText && sortedSamples && sortedSamples.length > 0 && (
        <ul className="scramble-stats-examples-list">
          {sortedSamples.map(([id, scr, color, opt], i) => {
            const m = idMeta?.[id];
            const comp = m ? comps?.[m[0]] : undefined;
            // 最优视图:用最短等价打乱(同状态),无数据则回退原始。预览与跳转都跟当前视图。
            const disp = (exView === 'opt' && opt ? opt : scr).trim();
            return (
              <li key={i}>
                {color && (
                  <span
                    className="scramble-stats-examples-chip"
                    style={{ background: COLOR_HEX[color as ColorLetter] ?? '#888' }}
                    title={tr({ zh: '朝下的底色', en: 'Bottom color' })}
                  />
                )}
                <Link
                  className="scramble-stats-examples-cube"
                  href={`/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: disp.replace(/ /g, '_') })}`}
                  prefetch={false}
                  aria-label={tr({ zh: '打乱图', en: 'Scramble image'
                })}
                >
                  <ScramblePreview2D event="333" scramble={disp} size={26} />
                </Link>
                <div className="scramble-stats-examples-body">
                  <Link
                    className="scramble-stats-examples-scramble"
                    href={`/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: disp.replace(/ /g, '_') })}`}
                    prefetch={false}
                  >
                    {disp}
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
                          <EventIcon event={m[1]} className="scramble-stats-examples-evt" title={eventLabel(m[1])} />
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
        <div className="scramble-stats-examples-hint">{tr({ zh: '此 bin 无示例', en: 'No examples for this bin'
        })}</div>
      )}
    </div>
  );
}
