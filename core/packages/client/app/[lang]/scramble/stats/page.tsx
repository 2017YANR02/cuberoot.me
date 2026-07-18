'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum, parseAsBoolean } from 'nuqs';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DiscreteHistogram, { type HistSeries } from './_components/DiscreteHistogram';
import PuzzleDistView from './_components/PuzzleDistView';
import EnumeratedDistView from './_components/EnumeratedDistView';
import { ENUM_SPECS } from './_components/enumerated-specs';
import Slide15DistView from './_components/Slide15DistView';
import SuperFloppyDistView from './_components/SuperFloppyDistView';
import BicDistView from './_components/BicDistView';
import Essential2x2View from './_components/Essential2x2View';
import { ESS_STAT_DATASETS, ESS_STAT_SLUGS, type EssStatSlug } from '@/lib/essential-2x2';
import PyraminxEssentialView from './_components/PyraminxEssentialView';
import ScrambleLengthView, {
  type EventLengthsJson, type EventLengthsAvgJson, MERGE_GROUPS, MERGED_HIDDEN, resolveEventLen, lengthAltMeta,
} from './_components/ScrambleLengthView';
import FirstAppearanceTimeline, { type TimelineEntry } from './_components/FirstAppearanceTimeline';
import FullScrambleList, { FullScrambleFilterBar } from './_components/FullScrambleList';
import AvgExamplesPanel, { type AvgGroupCase } from './_components/AvgExamplesPanel';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { CSTIMER_SOLVABLE_IDS } from '@/lib/cstimer-scramble';
import PillToggle from '@/components/PillToggle/PillToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { HelpCircle } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { Flag } from '@/components/Flag';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2, compCountryId, countryToIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { fetchByDifficultyCountries, type ByDifficultyCountry } from '@/lib/scramble-by-difficulty';
import { statsUrl } from '@/lib/stats-base';
import {
  stageLabel, isBlockVariant, VARIANT_ORDER, VARIANT_STAGES, BLOCK_DATA_VARIANTS, BLOCK_STAGE_VARIANT,
  EO_DATA_VARIANTS, EO_STAGE_VARIANT, EO_UI_STAGES, isEoVariant,
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

// 组平均分布(build_group_avg.ts):sets → variants → data → stage → subset → {ne,we}。
// 键 = round(组平均 × avg_denom) 的整数;显示时 ÷ avg_denom。ne = 不含备打,we = 含备打。
interface AvgHistEntry { min: number; max: number; counts: Record<string, number>; }
interface AvgSubHist { ne: AvgHistEntry; we: AvgHistEntry; }
interface AvgVariantData { stages: string[]; data: Record<string, Record<string, AvgSubHist>>; }
interface AvgSetData { label: string; label_zh: string | null; event?: string; sample_count: number; variants: Record<string, AvgVariantData>; }
interface DistributionAvgJson { meta: { generated_at: string; avg_denom: number; subset_keys: string[] }; sets: Record<string, AvgSetData>; }

// 组平均「示例组」(build_group_avg_examples.ts):按 (variant,stage) 分片,点柱只加载当前视图那片。
// 每片自包含:骨架 + comp meta + 每成员该 stage 的 6 色步数([B,G,O,R,W,Y] 序,-1=缺)。
// 覆盖策略 = 头尾极端 bin 完整 + 中间 bin 抽样(见 builder),故稀有柱子点开必有真实完整的组。
// 成员 = [scramble, num, extra, B,G,O,R,W,Y]。客户端按所选 subset 取 min 重算组平均。
type AvgExMember = [string, number, 0 | 1, number, number, number, number, number, number];
interface AvgExShard {
  meta: { generated_at: string; avg_denom: number; min_group: number; color_order: string; variant: string; stage: string };
  comps: Record<string, [string, string]>;
  groups: Array<{ c: string; e: string; r: string; g: string; m: AvgExMember[] }>;
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

// 「首次出现」JSON(build_first_appearance.ts):每 (variant,stage,subset,bin) 最早一条 [id,scr,color]。
type FaSample = [string, string, string];
interface FaSet {
  label: string; label_zh: string | null; event?: string | null;
  variants: Record<string, { stages: string[]; data: Record<string, Record<string, Record<string, FaSample>>> }>;
}
interface FaDifficultyJson {
  meta: { generated_at: string };
  sets: Record<string, FaSet>;
  comps: Record<string, [string, string]>;
  idMeta: Record<string, ExampleCompMeta>;
}
interface FaDifficultyShard {
  meta: { generated_at: string };
  set: FaSet;
  comps: Record<string, [string, string]>;
  idMeta: Record<string, ExampleCompMeta>;
}
// 长度「首次出现」(build_scramble_lengths.ts):event → metric → len → [compId,round,group,num,text,isExtra]。
type FaLenEx = [string, string, string, number, string, (0 | 1)?];
interface FaLengthJson {
  meta: { generated_at: string };
  comps: Record<string, [string, string]>;
  events: Record<string, { htm: Record<string, FaLenEx>; qtm?: Record<string, FaLenEx> }>;
}
// 非 3x3 puzzle 整解步数「首次出现」(build_puzzle_first_appearance.ts):每 (puzzle,len) 最早一条。
// 条目同 FaLenEx 形;binsAlt 仅 sq1(slash 口径)。
interface FaPuzzleJson {
  meta: { generated_at: string };
  comps: Record<string, [string, string]>;
  puzzles: Record<string, { event: string; bins: Record<string, FaLenEx>; binsAlt?: Record<string, FaLenEx> }>;
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
// i18next 语言码 → 路由 lang 段('zh' / 'en'),供 AppLink/href 前缀用。
function uiLangOf(l: string): 'zh' | 'en' {
  return l.startsWith('zh') ? 'zh' : 'en';
}

// 难度 tab 目前只有三阶有数据 —— 这 6 个 WCA 项目全是三阶魔方、全用 TNoodle 三阶随机态打乱,
// 故它们的阶段难度分布完全相同,共用同一份 distribution 数据。其余项目(4x4/金字塔/SQ1 等)
// 暂无难度数据,选中显示占位(用户后续会逐个加入)。
const DIFFICULTY_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf', '333mbo']);

// 长度 tab「合并/分开」只对属于某 MERGE_GROUP 的项目有意义(333↔单手、三盲↔多盲);
// 其余项目(4x4/5x5/魔表 等)无可合并对象,不显示该钮。
const LENGTH_MERGE_EVENTS = new Set(MERGE_GROUPS.flatMap((g) => g.members));

// 非 3x3 puzzle:WCA event_id → puzzle_distribution.json 的 key。选中这些项目时,
// 难度 tab 显示该 puzzle 的整解步数分布(数据来自独立 native solver 管线)。
// sq1 是近最优(双阶段上界),其余三个是精确最优 —— 口径差异在 PuzzleDistView 里标注。
const PUZZLE_EVENT_MAP: Record<string, string> = { '222': '222', pyram: 'pyraminx', skewb: 'skewb', sq1: 'sq1' };

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

// 2×2 / 金字塔的难度数据源。一个下拉装下全部 9 档(原先「数据源 3 档 + 面板内数据集 6 档」
// 两个菜单已合并 —— 它们本就不是正交的两个轴,每一档其实都是一组(总体, 统计量)):
//   整解 3 档:'wca'(WCA 真题采样)/ 'all'(全部 3,674,160 个状态)/ 'ess'(去重后 77,801 个本质状态)
//   局部目标 6 档:ESS_STAT_SLUGS(底面 / 底层 / 两角块;分母是商或子集,各档自报口径)
// 用 <optgroup> 分成两组,免得读者把 9 项读成并列的数据源。仅 2×2 有局部目标档(金字塔只有 3 档)。
type EssSrc = 'wca' | 'all' | 'ess' | EssStatSlug;

// 仅在独立 /scramble/stats 页接管浏览器标题。嵌入求解页时不渲染本组件 ——
// 否则它的 useDocumentTitle 会和求解器的标题互相覆盖(且 cleanup 把标题重置成品牌名)。
function StatsDocTitle() {
  useDocumentTitle(PAGE_TITLE.zh, PAGE_TITLE.en);
  return null;
}

export default function ScrambleStatsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  // 嵌入求解页(求解在上、分布在下同滚动页)时,本组件的 URL 状态键全部加 `d` 前缀,避开与
  // 求解器 / analyzer 共用同名键(scramble/variant/stage/colors/tool…)互相覆盖;唯独 `event`
  // 不前缀 —— 它是顶部项目选择器(SolveTabs)的共享键,分布要跟着求解区一起切项目。
  // 独立访问 /scramble/stats 时 embedded=false,键名不变,旧深链照常。
  const k = (key: string) => (embedded ? `d${key}` : key);

  // 难度/长度 大视图切换进 URL(?tab),push 进历史(后退能返回)。
  const [tab, setTab] = useQueryState(
    k('tab'),
    parseAsStringEnum<'difficulty' | 'length'>(['difficulty', 'length']).withDefault('difficulty').withOptions({ history: 'push' }),
  );
  const [data, setData] = useState<DistributionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shared WCA-event selector (above the tabs) — drives both the length tab and
  // the difficulty tab. event_lengths.json is tiny (~2KB), fetched once here.
  // merged 双语义:长度 tab = 折叠共打乱组(333+oh / bf+mbf);难度 tab = 全部六个
  // 三阶项目并成一个池(wca 合并 set)。
  // event 进 URL(nuqs):统一「求解」中心的项目行(?event=222 等)切分布时要响应式;
  // 也让分享/后退准确。filter 性质 → replace,不堆历史。
  const [event, setEvent] = useQueryState(
    'event', // 共享键:不前缀,跟随顶部项目选择器(SolveTabs)切项目。
    parseAsString.withDefault('333').withOptions({ history: 'replace' }),
  );
  // 合并同打乱项目(?merge):filter 性质 → replace,不堆历史。
  const [merged, setMerged] = useQueryState(k('merge'), parseAsBoolean.withDefault(true));
  const [lengthsData, setLengthsData] = useState<EventLengthsJson | null>(null);
  const [lengthsError, setLengthsError] = useState<string | null>(null);
  // Difficulty data source (top-level set: wca / xcross_2_col_10f). The actually
  // displayed set additionally routes through the event selector: wca + 333oh →
  // per-event set 'wca_333oh'; non-wca datasets are synthetic (no event split).
  // 数据集 / 方法(变体) / 阶段 全进 URL(?set / ?variant / ?stage),filter 性质 → replace。
  const [dataset, setDataset] = useQueryState(k('set'), parseAsString.withDefault('wca'));
  const [variantRaw, setVariantRaw] = useQueryState(k('variant'), parseAsString.withDefault('std'));
  const variant = variantRaw as VariantKey;
  const setVariant = setVariantRaw as unknown as (v: VariantKey) => void;
  const [stage, setStage] = useQueryState(k('stage'), parseAsString.withDefault('cross'));
  // 底色子集进 URL(?colors):首次挂载从 URL 还原,之后 subsetKey 变化写回(filter → replace)。
  const [colorsParam, setColorsParam] = useQueryState(k('colors'), parseAsString);
  const sel = useSubsetSelection('cn', colorsParam ?? undefined);
  // 图表显示口径也进 URL:y 轴(百分比/数量,?y)、曲线(pdf/cdf,?chart)。
  const [yMode, setYMode] = useQueryState(k('y'), parseAsStringEnum<YMode>(['percent', 'count']).withDefault('percent'));
  const [chartMode, setChartMode] = useQueryState(k('chart'), parseAsStringEnum<ChartMode>(['pdf', 'cdf']).withDefault('pdf'));
  // 2×2 难度数据源:WCA 真题采样(默认)/ 所有本质状态(全 3,674,160 态精确统计)。仅 event=222 有意义。
  // 数据源(9 档,见 EssSrc 注释)。旧深链 ?dsrc=all / ?dsrc=wca 语义不变。
  const [essSrc, setEssSrc] = useQueryState(
    k('src'),
    parseAsStringEnum<EssSrc>(['wca', 'all', 'ess', ...ESS_STAT_SLUGS]).withDefault('wca'),
  );
  // 组平均(?avg):观测单位 = 一组打乱的平均(某场某轮某组);备打开关(?avgx)仅 avg 时露。
  // filter 性质 → replace。数据懒加载(默认页不拉,省流量)。
  const [avgMode, setAvgMode] = useQueryState(k('avg'), parseAsBoolean.withDefault(false));
  const [avgExtras, setAvgExtras] = useQueryState(k('avgx'), parseAsBoolean.withDefault(false));
  const [avgData, setAvgData] = useState<DistributionAvgJson | null>(null);
  const [avgLen, setAvgLen] = useState<EventLengthsAvgJson | null>(null);
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
  // 选中某国(country_id)→ 客户端筛预览 + 服务端筛全量真题;各国计数由示例面板按 bin 拉 facet。
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  // 组平均示例:按 (variant#stage) 分片缓存,点柱后按需加载 + 重算匹配组。
  const [avgShards, setAvgShards] = useState<Record<string, AvgExShard | null>>({});
  const [avgExLoading, setAvgExLoading] = useState(false);
  const [avgExError, setAvgExError] = useState<string | null>(null);
  // 整解(333)示例:原始 WCA 打乱 vs 最优(最短)等价打乱(同状态)。
  const [exView, setExView] = useState<'orig' | 'opt'>('orig');
  // 「下载全部」可用阶段(std 变体全量语料 gz);manifest 缺失则不显示按钮。
  const [bundleStages, setBundleStages] = useState<string[] | null>(null);
  // 视图:图表(默认)/ 首次出现时间线。难度 + 长度两 tab 共用;进 URL(?view),push 历史。
  const [viewMode, setViewMode] = useQueryState(
    k('view'),
    parseAsStringEnum<'chart' | 'timeline'>(['chart', 'timeline']).withDefault('chart').withOptions({ history: 'push' }),
  );
  const [faDiff, setFaDiff] = useState<FaDifficultyJson | null>(null);     // 难度首次出现(顶层合并池)
  const [faShards, setFaShards] = useState<Record<string, FaDifficultyShard | null>>({}); // per-event 分片缓存
  const [faLen, setFaLen] = useState<FaLengthJson | null>(null);           // 长度首次出现
  const [faPuzzle, setFaPuzzle] = useState<FaPuzzleJson | null>(null);     // 非 3x3 puzzle 整解首次出现

  // 异步加载 comp→country 索引,完成后 bump version 触发重渲染拿示例卡片的比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 底色子集 → 写回 ?colors(六色默认省略);URL 只在首次挂载用于还原(filter → replace)。
  useEffect(() => {
    void setColorsParam(sel.subsetKey === 'BGORWY' ? null : sel.subsetKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.subsetKey]);

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

  // 「首次出现」数据:难度顶层合并池 + 长度全项目,各一份小文件,挂载即拉(缺失静默)。
  useEffect(() => {
    fetch(statsUrl('/stats/scramble/difficulty_first_appearance.json'))
      .then((r) => (r.ok ? r.json() : null)).then(setFaDiff).catch(() => setFaDiff(null));
  }, []);
  useEffect(() => {
    fetch(statsUrl('/stats/scramble/event_length_first_appearance.json'))
      .then((r) => (r.ok ? r.json() : null)).then(setFaLen).catch(() => setFaLen(null));
  }, []);
  useEffect(() => {
    fetch(statsUrl('/stats/scramble/puzzle_first_appearance.json'))
      .then((r) => (r.ok ? r.json() : null)).then(setFaPuzzle).catch(() => setFaPuzzle(null));
  }, []);

  // 组平均数据懒加载:仅首次切到「组平均」时拉(默认页不加载,省流量;缺失静默)。
  useEffect(() => {
    if (!avgMode || avgData) return;
    fetch(statsUrl('/stats/scramble/distribution_avg.json') + '?v=20260701avg')
      .then((r) => (r.ok ? r.json() : null)).then(setAvgData).catch(() => setAvgData(null));
  }, [avgMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!avgMode || avgLen) return;
    fetch(statsUrl('/stats/scramble/event_lengths_avg.json') + '?v=20260701avg')
      .then((r) => (r.ok ? r.json() : null)).then(setAvgLen).catch(() => setAvgLen(null));
  }, [avgMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // 非 WCA 求解项目(ivy 等)不进 WCA 图标行;走 PuzzlePicker 分组下拉。
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
  // difficulty tab's merged-family pseudo-event, always valid there). Non-WCA
  // solvable puzzles (ivy 等)走全空间分布 / 无长度数据,跳过此回退。
  useEffect(() => {
    if (lengthsData && event !== '' && !CSTIMER_SOLVABLE_IDS.has(event) && !lengthsData.events[event]) {
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
  // 组平均可用性:难度族(限 wca 数据集、非整解 333 变体)或有分组元数据的长度项目;
  // 其余(非 WCA puzzle / 合成集 / 整解)隐藏钮并退回单条。avgOn = 已开且当前选择支持。
  const avgAvailable = tab === 'difficulty'
    ? (dataset === 'wca' && DIFFICULTY_EVENTS.has(event) && !is333)
    : !!lengthsData?.events[event];
  const avgOn = avgMode && avgAvailable;
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

  // 组平均示例:点柱时按需拉当前 (variant,stage) 分片(每片一次)。
  const ensureAvgExamplesLoaded = (v: string, st: string) => {
    const key = `${v}#${st}`;
    setAvgShards((m) => {
      if (key in m) return m; // 已请求 / 已加载
      setAvgExLoading(true); setAvgExError(null);
      fetch(statsUrl(`/stats/scramble/examples_avg/${v}__${st}.json?v=20260710avg`), { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j) => setAvgShards((mm) => ({ ...mm, [key]: j })))
        .then(() => setAvgExLoading(false))
        .catch((e) => { setAvgExError(String(e)); setAvgExLoading(false); setAvgShards((mm) => { const n = { ...mm }; delete n[key]; return n; }); });
      return { ...m, [key]: null };
    });
  };
  const handleAvgBarClick = (bin: number) => {
    setSelectedBin(bin);
    ensureAvgExamplesLoaded(variant, stage);
  };

  useEffect(() => {
    // 组平均模式:重置选中(单条 bin 值在平均空间无意义),等用户点柱触发按需加载。
    if (avgOn) { setSelectedBin(null); return; }
    if (previewBins.length > 0) {
      setSelectedBin(previewBins[0]);
      ensureExamplesLoaded();
    } else {
      setSelectedBin(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrambleSet, variant, stage, effectiveSubset, optMetric, previewBins.length, avgOn]);

  // 当前示例来源:per-event 选择 → 该项目的分片;否则 examples.json 的顶级 set。
  const exSet = isPerEvent ? (evExamples[scrambleSet] ?? null) : (examples?.sets[dataset] ?? null);
  const currentSamples = useMemo<ExampleSample[] | null>(() => {
    if (selectedBin === null || !exSet) return null;
    return exSet.variants[variant]?.[stage]?.[effectiveSubset]?.[String(selectedBin)] ?? null;
  }, [exSet, variant, stage, effectiveSubset, selectedBin]);

  // 各国占比条(仅合并 WCA 池:scrambleSet==='wca';per-event/xcross 无 country 数据 → undefined → 不画)。
  // 换 set/变体/阶段/底色/步数/度量 → 清国家筛选(避免筛着一个国家切走后列表空/口径错位)。
  useEffect(() => { setFilterCountry(null); }, [scrambleSet, variant, stage, effectiveSubset, selectedBin, optMetric]);

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

  // 组平均(难度 tab):从 avgData 取当前 (set,variant,stage,subset) 的 ne/we 直方图。
  // 键为 round(平均 × avg_denom),故摘要统计需 ÷ avgDenom 还原成步数。
  const avgDenom = avgData?.meta.avg_denom ?? 5;
  const avgActiveCounts = useMemo<Record<string, number>>(() => {
    if (!avgOn || tab !== 'difficulty' || !avgData) return {};
    const sh = avgData.sets[scrambleSet]?.variants[variant]?.data[stage]?.[effectiveSubset];
    if (!sh) return {};
    return (avgExtras ? sh.we : sh.ne).counts;
  }, [avgOn, tab, avgData, scrambleSet, variant, stage, effectiveSubset, avgExtras]);
  const avgSeries = useMemo<HistSeries[]>(() => {
    if (Object.keys(avgActiveCounts).length === 0) return [];
    return [{ name: modeLabel, fillColors: fillColorsForSubset(selectedColors), counts: avgActiveCounts }];
  }, [avgActiveCounts, modeLabel, selectedColors]);
  const avgStats = useMemo(() => computeStats(avgActiveCounts), [avgActiveCounts]);
  const avgPreviewBins = useMemo<number[]>(
    () => Object.keys(avgActiveCounts).map(Number).sort((a, b) => a - b),
    [avgActiveCounts],
  );

  // 点柱后的「示例组」:遍历当前 (variant,stage) 分片,按当前 (subset,备打) 从成员步数重算平均,
  // 命中所选 bin 且(per-event 时)项目匹配者全收(头尾极端 bin 分片里是完整的,面板再决定展示多少)。
  const avgMatchingGroups = useMemo<AvgGroupCase[] | null>(() => {
    if (!avgOn || tab !== 'difficulty' || selectedBin === null) return null;
    const shard = avgShards[`${variant}#${stage}`];
    if (!shard) return null; // 尚未加载完成
    const order = shard.meta.color_order;
    const letters = [...effectiveSubset] as ColorLetter[];
    const colorIdxs = letters.map((c) => order.indexOf(c));
    if (colorIdxs.some((i) => i < 0)) return [];
    const denom = shard.meta.avg_denom;
    const wantEvent = isPerEvent ? event : null;
    const out: AvgGroupCase[] = [];
    for (const g of shard.groups) {
      if (wantEvent && g.e !== wantEvent) continue;
      let sum = 0, cnt = 0;
      const members: AvgGroupCase['members'] = [];
      for (const m of g.m) {
        const extra = m[2];
        if (!avgExtras && extra === 1) continue;
        let mn = Infinity;
        let bc: ColorLetter = letters[0];
        for (let k = 0; k < colorIdxs.length; k++) {
          const val = m[3 + colorIdxs[k]] as number; // 索引 3..8 = 6 色步数(number)
          if (val >= 0 && val < mn) { mn = val; bc = letters[k]; }
        }
        if (mn === Infinity) continue;
        sum += mn; cnt++;
        members.push({ scr: m[0], num: m[1], extra: extra === 1, val: mn, bottomColor: bc });
      }
      if (cnt < 2) continue;
      const mean = sum / cnt;
      if (Math.round(mean * denom) !== selectedBin) continue;
      out.push({ comp: g.c, event: g.e, round: g.r, group: g.g, mean, cnt, members });
    }
    // 稳定排序:先按组平均、再按成员数,展示时确定。
    out.sort((a, b) => a.mean - b.mean || b.cnt - a.cnt);
    return out;
  }, [avgOn, tab, selectedBin, avgShards, variant, stage, effectiveSubset, avgExtras, isPerEvent, event]);

  // 非 3x3 puzzle 项目:难度 tab 显示 puzzle 整解分布,3x3 专属的合并/数据集开关无意义,隐藏。
  const isPuzzleEvent = tab === 'difficulty' && !!PUZZLE_EVENT_MAP[event];
  // 2×2 / 金字塔的精确枚举视图激活:难度 tab + 数据源切到 all(所有状态)或 ess(所有本质状态)。
  const isEssential = tab === 'difficulty' && (event === '222' || event === 'pyram') && essSrc !== 'wca';

  // 长度 tab 第二计步口径钮(顶栏右侧):仅当所选项目带 counts_qtm 时出现。
  const lenCur = useMemo(() => resolveEventLen(lengthsData, event, merged), [lengthsData, event, merged]);
  const lenHasQtm = tab === 'length' && !!lenCur?.counts_qtm;
  const lenAlt = lengthAltMeta(event);
  // 打乱总数不在顶栏展示 —— DiscreteHistogram 在图内自报(共 N)。

  // lang 走索引(避开 i18n.language 三元 ratchet);isZh 已是 startsWith('zh')。
  const lang: 'zh' | 'en' = (['en', 'zh'] as const)[Number(isZh)];

  // per-event 难度首次出现走分片;timeline 视图下按需懒加载。
  useEffect(() => {
    if (viewMode !== 'timeline' || tab !== 'difficulty' || !isPerEvent) return;
    if (scrambleSet in faShards) return;
    setFaShards((m) => ({ ...m, [scrambleSet]: null }));
    fetch(statsUrl(`/stats/scramble/difficulty_first_appearance_${scrambleSet}.json`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setFaShards((m) => ({ ...m, [scrambleSet]: j })))
      .catch(() => setFaShards((m) => ({ ...m, [scrambleSet]: null })));
  }, [viewMode, tab, isPerEvent, scrambleSet]); // eslint-disable-line react-hooks/exhaustive-deps

  // 难度首次出现:顶层合并池取 faDiff.sets[dataset];per-event 取分片。
  const faDiffSet = isPerEvent ? (faShards[scrambleSet]?.set ?? null) : (faDiff?.sets[dataset] ?? null);
  const faDiffComps = isPerEvent ? faShards[scrambleSet]?.comps : faDiff?.comps;
  const faDiffIdMeta = isPerEvent ? faShards[scrambleSet]?.idMeta : faDiff?.idMeta;
  const difficultyTimeline = useMemo<TimelineEntry[]>(() => {
    if (tab !== 'difficulty') return [];
    if (is333 && optMetric === 'qtm') return []; // 333 QTM 首现未生成(同图表 counts_qtm 占位)
    if (!faDiffSet || !faDiffComps || !faDiffIdMeta) return [];
    const binMap = faDiffSet.variants[variant]?.data[stage]?.[effectiveSubset];
    if (!binMap) return [];
    const out: TimelineEntry[] = [];
    for (const [binStr, s] of Object.entries(binMap)) {
      const m = faDiffIdMeta[s[0]];
      if (!m) continue;
      const comp = faDiffComps[m[0]];
      out.push({
        bin: Number(binStr), scramble: s[1], color: s[2],
        previewEvent: '333', usageEvent: m[1],
        compId: m[0], compName: comp?.[0] ?? m[0], date: comp?.[1] ?? '',
        round: m[3], group: m[4], num: m[2], isExtra: !!m[5],
      });
    }
    return out;
  }, [tab, is333, optMetric, faDiffSet, faDiffComps, faDiffIdMeta, variant, stage, effectiveSubset]);

  // 长度首次出现:合并态跨成员项目取最早;单项目直接取。
  const lengthTimeline = useMemo<TimelineEntry[]>(() => {
    if (tab !== 'length' || !faLen) return [];
    const metric = lenMetric === 'qtm' ? 'qtm' : 'htm';
    const members = merged ? (MERGE_GROUPS.find((g) => g.rep === event)?.members ?? [event]) : [event];
    const best = new Map<number, { ex: FaLenEx; ev: string; dateInt: number }>();
    for (const ev of members) {
      const byLen = faLen.events[ev]?.[metric];
      if (!byLen) continue;
      for (const [lenStr, ex] of Object.entries(byLen)) {
        const len = Number(lenStr);
        const date = faLen.comps[ex[0]]?.[1] ?? '';
        const dateInt = date ? Number(date.replaceAll('-', '')) : Infinity;
        const cur = best.get(len);
        if (!cur || dateInt < cur.dateInt
          || (dateInt === cur.dateInt && (ex[0] < cur.ex[0] || (ex[0] === cur.ex[0] && ex[3] < cur.ex[3])))) {
          best.set(len, { ex, ev, dateInt });
        }
      }
    }
    const out: TimelineEntry[] = [];
    for (const [len, picked] of best) {
      const comp = faLen.comps[picked.ex[0]];
      out.push({
        bin: len, scramble: picked.ex[4], previewEvent: picked.ev, usageEvent: picked.ev,
        compId: picked.ex[0], compName: comp?.[0] ?? picked.ex[0], date: comp?.[1] ?? '',
        round: picked.ex[1], group: picked.ex[2], num: picked.ex[3], isExtra: !!picked.ex[5],
      });
    }
    return out;
  }, [tab, faLen, lenMetric, merged, event]);

  // 非 3x3 puzzle 整解步数首次出现(难度 tab 选中 222/pyram/skewb/sq1):主口径 bins。
  // sq1 双口径暂只展主口径(WCA 12c4);slash 数据已在 binsAlt 备用。
  const puzzleTimeline = useMemo<TimelineEntry[]>(() => {
    if (tab !== 'difficulty' || !isPuzzleEvent || !faPuzzle) return [];
    const p = faPuzzle.puzzles[PUZZLE_EVENT_MAP[event]];
    if (!p) return [];
    const out: TimelineEntry[] = [];
    for (const [lenStr, ex] of Object.entries(p.bins)) {
      const comp = faPuzzle.comps[ex[0]];
      out.push({
        bin: Number(lenStr), scramble: ex[4], previewEvent: p.event, usageEvent: p.event,
        compId: ex[0], compName: comp?.[0] ?? ex[0], date: comp?.[1] ?? '',
        round: ex[1], group: ex[2], num: ex[3], isExtra: !!ex[5],
      });
    }
    return out;
  }, [tab, isPuzzleEvent, faPuzzle, event]);

  // 时间线视图可用性:长度 tab 该项目有数据;难度 tab 三阶族 或 有首现数据的 puzzle。
  const canTimeline = tab === 'length'
    ? !!faLen?.events[event]
    : isPuzzleEvent
      ? !!faPuzzle?.puzzles[PUZZLE_EVENT_MAP[event]]
      : DIFFICULTY_EVENTS.has(event);
  const timelineActive = viewMode === 'timeline' && canTimeline && !avgOn;
  const timelineEntries = tab === 'length'
    ? lengthTimeline
    : isPuzzleEvent ? puzzleTimeline : difficultyTimeline;
  // 时间线加载/待生成提示:相关 FA 根还是 null = 加载中;否则该组合数据待生成。
  const timelineLoading = tab === 'length'
    ? faLen === null
    : isPuzzleEvent
      ? faPuzzle === null
      : (isPerEvent ? !(scrambleSet in faShards) || faShards[scrambleSet] === null : faDiff === null);
  // 333 整解 QTM:首现数据未生成(同图表 counts_qtm 占位),时间线给「QTM 即将加入」而非「生成中」。
  const timeline333Qtm = tab === 'difficulty' && is333 && optMetric === 'qtm';

  // 图表 / 时间线视图开关(难度 + 长度共用);仅当当前选择支持时间线时出现。组平均模式下时间线不适用,隐藏。
  // 2×2「所有本质状态」是理论全空间统计,无「首次出现」时间线概念,隐藏该开关。
  const viewToggle = canTimeline && !avgOn && !isEssential ? (
    <div className="scramble-stats-view-toggle">
      <PillToggle
        value={viewMode === 'timeline'}
        onChange={(v) => setViewMode(v ? 'timeline' : 'chart')}
        offLabel={tr({ zh: '图表', en: 'Chart' })}
        onLabel={tr({ zh: '时间线', en: 'Timeline' })}
        ariaLabel={tr({ zh: '图表或首次出现时间线', en: 'Chart or first-appearance timeline' })}
      />
    </div>
  ) : null;

  // 单个 / 组平均 切换(+ 备打子开关):仅当前选择有比赛分组时出现(难度族 / 有分组的长度项目)。
  const avgToggle = avgAvailable ? (
    <div className="scramble-stats-avg-toggle">
      <PillToggle
        value={avgMode}
        onChange={setAvgMode}
        offLabel={tr({ zh: '单次', en: 'Single' })}
        onLabel={tr({ zh: '平均', en: 'Average' })}
        ariaLabel={tr({ zh: '单个打乱或按比赛组求平均', en: 'Per single scramble or per competition-group average' })}
      />
      {avgMode && (
        <PillToggle
          value={avgExtras}
          onChange={setAvgExtras}
          offLabel={tr({ zh: '不含备打', en: 'No extras' })}
          onLabel={tr({ zh: '含备打', en: 'With extras' })}
          ariaLabel={tr({ zh: '组平均是否包含备用打乱', en: 'Include extra scrambles in the group average' })}
        />
      )}
    </div>
  ) : null;

  // 时间线区块(两 tab 共用):无数据时给「加载中 / 待生成」提示。
  const timelineBlock = (
    <div className="scramble-stats-panel scramble-timeline-panel">
      <div className="scramble-stats-panel-title">{tr({ zh: '首次出现时间线', en: 'First-appearance timeline' })}</div>
      {timelineEntries.length > 0 ? (
        <FirstAppearanceTimeline
          entries={timelineEntries}
          isZh={isZh}
          lang={lang}
          unit={tab === 'length' && lenCur?.unit === 'twists'
            ? { zh: '扭', en: ' twists' }
            : { zh: '步', en: ' moves' }}
        />
      ) : (
        <div className="scramble-stats-examples-hint">
          {timeline333Qtm
            ? tr({ zh: 'QTM 首次出现即将加入', en: 'QTM first-appearance coming soon' })
            : timelineLoading
              ? tr({ zh: '加载中…', en: 'Loading…' })
              : tr({ zh: '该组合的首次出现数据生成中,稍后再来', en: 'First-appearance data for this selection is being generated, check back soon' })}
        </div>
      )}
    </div>
  );

  const tabsBar = (
    <VariantSelect
      className="scramble-stats-select"
      value={tab}
      options={['difficulty', 'length']}
      onChange={(v) => setTab(v as 'difficulty' | 'length')}
      isZh={isZh}
      label={(v) => tr(v === 'difficulty' ? { zh: '难度', en: 'Difficulty' } : { zh: '打乱长度', en: 'Scramble length' })}
      ariaLabel={tr({ zh: '难度或打乱长度', en: 'Difficulty or scramble length' })}
    />
  );

  // Dataset toggle (difficulty tab only): the two top-level sets (WCA / xcross)
  // become a PillToggle sitting just left of the merge toggle. Rendered only when
  // exactly two top-level datasets exist. xcross(双色底 10f)是纯三阶概念,只在三阶族项目
  // (DIFFICULTY_EVENTS)出现 —— 4x4/5x5/魔表/各盲 等非三阶项目难度 tab 只是占位,不给这个切换。
  const topSets = data ? Object.entries(data.sets).filter(([, s]) => !s.event) : [];
  const datasetToggle = (tab === 'difficulty' && DIFFICULTY_EVENTS.has(event) && topSets.length === 2) ? (() => {
    const lab = (s: SetData) => (isZh && s.label_zh) ? s.label_zh : s.label;
    const labelByKey = Object.fromEntries(topSets.map(([k, s]) => [k, lab(s)]));
    return (
      <VariantSelect
        className="scramble-stats-select"
        value={dataset}
        options={topSets.map(([k]) => k)}
        onChange={setDataset}
        isZh={isZh}
        label={(v) => labelByKey[v] ?? v}
        ariaLabel={tr({ zh: '数据集', en: 'Dataset' })}
      />
    );
  })() : null;

  // 合并/分开 钮只在「合并」真正有对象处出现:难度 tab = 三阶族(六个三阶项目共池,且限 wca 数据集);
  // 长度 tab = 属于某 MERGE_GROUP 的项目(333↔单手、三盲↔多盲)。4x4/5x5/魔表/各盲(非 mbf)等无可合并对象,隐藏。
  const showMergeToggle = tab === 'length'
    ? LENGTH_MERGE_EVENTS.has(event)
    : (DIFFICULTY_EVENTS.has(event) && dataset === 'wca');

  // 工具栏三个切换钮(合并/分开、单次/平均、图表/时间线)共用一个说明气泡,而非各自一个「?」;
  // 按当前哪些钮实际渲染,只拼对应那几段说明。
  const canShowTimelineToggle = canTimeline && !avgOn && !isEssential;
  const toggleInfoBits: string[] = [];
  if (showMergeToggle) {
    toggleInfoBits.push(tab === 'difficulty'
      ? tr({ zh: '合并 / 分开:三阶速拧 / 单手 / 盲拧 / 多盲 / 最少步 / 脚拧打乱相同,合并为一个池', en: 'Merged / Split: all six 3×3 events share scrambles; merged into one pool' })
      : tr({ zh: '合并 / 分开:三阶速拧与单手、三盲与多盲打乱相同', en: 'Merged / Split: 3×3 speed + OH, and 3BLD + MBLD share scrambles' }));
  }
  if (avgAvailable) {
    toggleInfoBits.push(tr({
      zh: '单次 / 平均:组平均把每场比赛每轮每组的一组打乱(三阶 5 条、多盲一组几十条)各项统计取平均(不去尾),再看这些组平均的分布',
      en: 'Single / Average: group average takes each competition round-group (5 scrambles for 3×3, dozens for MBLD) and averages the stat over the group (no trim), then shows the distribution of those group means',
    }));
  }
  if (canShowTimelineToggle) {
    toggleInfoBits.push(tr({
      zh: '图表 / 时间线:时间线显示每个步数 / 长度第一次出现在哪场比赛(按比赛日期升序)',
      en: 'Chart / Timeline: which competition each step-count / length first appeared at (earliest by date)',
    }));
  }
  const toggleInfoTooltip = toggleInfoBits.length > 0
    ? <InfoTooltip icon={HelpCircle} content={toggleInfoBits.join('\n\n')} variant="modal" />
    : null;

  // 统一「求解」中心:项目行高亮按当前 event 推(3x3 族都算 3×3)。
  const distPuzzle: SolvePuzzle | null =
    DIFFICULTY_EVENTS.has(event) ? '3x3'
      : event === '222' ? '2x2x2'
        : event === 'pyram' ? 'pyraminx'
          : event === 'skewb' ? 'skewb'
            : event === 'sq1' ? 'sq1'
              : event === 'ivy' ? 'ivy'
                : event === '133' ? '133'
                  : event === '223' ? '223'
                    : event === '233' ? '233'
                    : event === '334' ? '334'
                    : event === '335' ? '335'
                    : event === '336' ? '336'
                    : event === '337' ? '337'
                    : event === '8p' ? '8p'
                      : event === '15p' ? '15p'
                        : event === 'sfl' ? 'sfl'
                        : event === 'ufo' ? 'ufo'
                          : event === 'cm2' ? 'cm2'
                          : event === 'cm3' ? 'cm3'
                          : event === 'heli' ? 'heli'
                          : event === 'helicv' ? 'helicv'
                          : event === 'ctico' ? 'ctico'
                            : event === 'dmd' ? 'dmd'
                              : event === 'gear' ? 'gear'
                                : event === 'mpyrso' ? 'mpyrso'
                                  : event === 'dino' ? 'dino'
                                  : event === 'crz3a' ? 'crz3a'
                                  : event === 'sq2' ? 'sq2'
                                  : event === 'ssq1' ? 'ssq1'
                                  : event === 'bsq' ? 'bsq'
                                  : event === 'bic' ? 'bic'
                                  : event === 'sia123' ? 'sia123'
                                  : null;

  // 2×2 / 金字塔:数据源下拉。与「难度/打乱长度」tab 同一行(和 tabsBar 语义/视觉上是同一组控件)。
  // 页面唯一的数据源选择器:整解 3 档 + (仅 2×2)局部目标 6 档,optgroup 分组。每一档只渲染归属
  // 自己那一档的面板 —— 别再把不同总体的图上下堆在同一屏(用户读不出两张几乎重合的直方图差在哪)。
  const hasEssential = tab === 'difficulty' && (event === '222' || event === 'pyram');
  const has222Stats = event === '222';
  const ESS_SRC_LABEL: Record<string, { zh: string; en: string }> = {
    wca: { zh: 'WCA 真题', en: 'WCA' },
    all: { zh: '所有状态', en: 'All states' },
    ess: { zh: '所有本质状态', en: 'Essential states' },
    ...Object.fromEntries(ESS_STAT_DATASETS.map((d) => [d.slug, d.label])),
  };
  const srcToggle = hasEssential ? (
    <VariantSelect
      className="scramble-stats-select"
      value={essSrc}
      groups={has222Stats
        ? [
          { label: tr({ zh: '完整', en: 'Full solve' }), options: ['wca', 'all', 'ess'] },
          { label: tr({ zh: '子集', en: 'Sub-goals (first face / layer)' }), options: ESS_STAT_SLUGS },
        ]
        : [{ label: tr({ zh: '完整', en: 'Full solve' }), options: ['wca', 'all', 'ess'] }]}
      onChange={(v) => setEssSrc(v as EssSrc)}
      isZh={isZh}
      label={(v) => tr(ESS_SRC_LABEL[v])}
      ariaLabel={tr({ zh: '数据源', en: 'Data source' })}
    />
  ) : null;

  // Shared header:项目选择器与「难度 / 打乱长度」标签同一行,驱动两个 tab。
  //
  // 嵌入求解页时(embedded):求解区上方的 SolveTabs 已是页面唯一的项目选择器并驱动 ?event,
  // 这里就不再渲染本组件自带的项目选择器 + SolveTabs(否则一页两个项目选择器),只露一个
  // 「分布」小标题点明下半区,其余分布内部控件(难度/长度、合并、度量…)全保留。
  const header = (
    <div className="scramble-stats-header">
      {!embedded && <StatsDocTitle />}
      {embedded && (
        <div className="scramble-stats-embed-title">{tr({ zh: '分布', en: 'Distribution' })}</div>
      )}
      <div className="scramble-stats-event-bar">
        <div className="scramble-stats-tabrow">
          {/* 项目选择器与「难度 / 打乱长度」同一行。独立分布页:单个 PuzzlePicker 下拉
              (WCA 组 + 非 WCA 家族组同一菜单)是页面唯一的项目选择器;嵌入求解页时
              顶部 SolveTabs 已是那个选择器,这里不再出第二个。 */}
          {!embedded && (
            <PuzzlePicker
              isZh={isZh}
              wcaEvents={availableEvents}
              availableEvents={CSTIMER_SOLVABLE_IDS}
              selectedEvent={event}
              onSelect={setEvent}
            />
          )}
          {tabsBar}
          {datasetToggle}
          {srcToggle}
        {showMergeToggle && (
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
        {avgToggle}
        {viewToggle}
        {toggleInfoTooltip}
        </div>
      </div>
      {/* SolveTabs 在 dist 模式下只剩 3×3 子标签(最优解 / 阶段 / CFOP / DR);项目行由上面那个
          PuzzlePicker 承担,不重复渲染,故非 3×3 时它是空的 —— 直接不挂。 */}
      {!embedded && distPuzzle === '3x3' && <SolveTabs puzzle={distPuzzle} mode="dist" />}
    </div>
  );

  // Ivy(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 29,160 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。一处统一处理两 tab。
  if (event === 'ivy') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '枫叶魔方无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Ivy Cube (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.ivy} isZh={isZh} />
        )}
      </div>
    );
  }

  // 1×3×3 花型(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 192 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === '133') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '1×3×3 花型无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the 1×3×3 Floppy Cube (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['133']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 2×2×3(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 241,920 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === '223') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '2×2×3 无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the 2×2×3 Tower (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['223']} isZh={isZh} />
        )}
      </div>
    );
  }

  if (event === '233') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '2×3×3 多米诺无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布(采样)见「难度」',
              en: 'No scramble-length distribution for the 2×3×3 Domino (cstimer generates fixed-form scrambles); see "Difficulty" for the (sampled) optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['233']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 3×3×4(非 WCA 项目,TIER D):状态空间 ≈ 1.65×10¹⁷(群阶 2.64×10¹⁸)无法整图枚举,且无浏览器可建的强启发,
  // 难度 = 整解步数的**采样**分布(现场解 N 条随机态:浅态可证最优、深态贪心兜底有效有界);无打乱长度数据。
  if (event === '334') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '3×3×4 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the 3×3×4 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['334']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 3×3×5(非 WCA 项目,TIER D):可达状态 156,067,430,400(≈1.56×10¹¹,Schreier-Sims)无法整图枚举,
  // 难度 = 整解步数的**采样**分布(现场解 N 条随机态:浅态可证最优、深态两阶段近最优);无打乱长度数据。
  if (event === '335') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '3×3×5 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the 3×3×5 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['335']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 3×3×6(非 WCA 项目,TIER D):可达状态 8,391,762,413,094,961,152,000,000(≈8.39×10²⁴,Schreier-Sims)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本解 N 条随机态后落静态 JSON:浅态可证最优、深态两阶段近最优);无打乱长度数据。
  if (event === '336') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '3×3×6 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the 3×3×6 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['336']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 3×3×7(非 WCA 项目,TIER D):可达状态 126,859,598,081,556,480,000(≈1.27×10²⁰,Schreier-Sims)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本解 N 条随机态后落静态 JSON:浅态可证最优、深态两阶段近最优);无打乱长度数据。
  if (event === '337') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '3×3×7 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the 3×3×7 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['337']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 八数码(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 181,440 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === '8p') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '八数码无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the 8-Puzzle (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS['8p']} isZh={isZh} />
        )}
      </div>
    );
  }

  // 数字华容道(非 WCA 项目,TIER C):状态空间 ≈ 1.05×10¹³ 无法整图枚举,难度 = 整解最优步数的**采样**分布
  //(现场 IDA*+Walking-Distance 解 N 条随机态后分桶,非全空间精确曲线);无打乱长度数据,长度 tab 给说明。
  if (event === '15p') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '数字华容道无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数采样分布见「难度」',
              en: 'No scramble-length distribution for the 15-Puzzle (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled optimal-length distribution',
            })}
          </div>
        ) : (
          <Slide15DistView isZh={isZh} />
        )}
      </div>
    );
  }

  // Super Floppy(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 3,041,280 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === 'sfl') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Super Floppy 无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Super Floppy (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <SuperFloppyDistView isZh={isZh} />
        )}
      </div>
    );
  }

  // UFO(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 60,480 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === 'ufo') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'UFO 无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the UFO (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.ufo} isZh={isZh} />
        )}
      </div>
    );
  }

  // Cmetrick Mini(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 165,888 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === 'cm2') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Cmetrick Mini 无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Cmetrick Mini (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.cm2} isZh={isZh} />
        )}
      </div>
    );
  }

  // Bicube(联体魔方,非 WCA 项目,TIER A):可达状态恰 1,108,800,整图可一次性 BFS(~7s,异步),
  // 难度 = 整解最优步数的理论全空间精确直方图(每条可证最短,God 28,出处 jaapsch.net);无打乱长度数据。
  if (event === 'bic') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Bicube 无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Bicube (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <BicDistView isZh={isZh} />
        )}
      </div>
    );
  }

  // Siamese 1×2×3(联体 1×2×3,非 WCA 项目,TIER B 两阶段):单 cube 全空间 ~10⁸–10⁹ 无法整图枚举,
  // 难度 = 两阶段(棱→H 陪集表 + in-H)求解器返回解步数的**离线采样**分布(有界非全空间最优);无打乱长度数据。
  if (event === 'sia123') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '联体 1×2×3 无打乱长度分布(打乱由 cstimer 定长生成);解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Siamese 1×2×3 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.sia123} isZh={isZh} />
        )}
      </div>
    );
  }

  // Siamese 2×2×2(联体 2×2×2,非 WCA 项目,TIER B 直积 per-half 最优):整空间 ≈2.9×10²⁸ 无法整图枚举,
  // 难度 = 按 z2 y 拆半 + 各半 IDA*(角+双 6 棱 PDB)最优解步数的**离线采样**分布(per-half 最优拼接=全局最优);无打乱长度数据。
  if (event === 'sia222') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '联体 2×2×2 无打乱长度分布(打乱由 cstimer 定长生成);最优解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Siamese 2×2×2 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled optimal-solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.sia222} isZh={isZh} />
        )}
      </div>
    );
  }

  // Cmetrick(非 WCA 项目,TIER D):可达状态 165,112,971,264(= 24⁹/24 ≈ 1.65×10¹¹,jaapsch.net)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本用从零构造式约简求解器解 N 条随机态后落静态 JSON,有界非最优);无打乱长度数据。
  if (event === 'cm3') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Cmetrick 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Cmetrick (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.cm3} isZh={isZh} />
        )}
      </div>
    );
  }

  // Helicopter Cube(非 WCA 项目,TIER D):可达状态 ≈ 1.18×10¹⁹(= 8!·3⁷·(6!)⁴/2,Schreier-Sims)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本用从零对易子约简求解器解 N 条随机态后落静态 JSON,有界非最优);无打乱长度数据。
  if (event === 'heli') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '直升机魔方无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Helicopter Cube (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.heli} isZh={isZh} />
        )}
      </div>
    );
  }

  // Curvy Copter(非 WCA 项目,TIER D):可达状态 ≈ 3.03×10²¹(= 8!·3⁷·(6!)⁴·2¹²/2⁵,Schreier-Sims,直升机的 256 倍)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本用从零对易子约简求解器解 N 条随机态后落静态 JSON,有界非最优);无打乱长度数据。
  if (event === 'helicv') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '弧面直升机魔方无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Curvy Copter (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.helicv} isZh={isZh} />
        )}
      </div>
    );
  }

  // Icosamate(非 WCA 项目,TIER D):可达状态 ≈ 3.556×10³³(= 12!·5¹²·20!/80,Schreier-Sims)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本用从零对易子约简求解器解 N 条随机态后落静态 JSON,有界非最优);无打乱长度数据。
  if (event === 'ctico') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '二十面体魔方无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Icosamate (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.ctico} isZh={isZh} />
        )}
      </div>
    );
  }

  // Diamond(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 138,240 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === 'dmd') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '钻石无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Diamond (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.dmd} isZh={isZh} />
        )}
      </div>
    );
  }

  // Gear Cube(非 WCA 项目):难度 = 整解最优步数的理论全空间分布(全 41,472 态,精确;示例本地枚举);
  // 无打乱长度数据(cstimer 定长生成),长度 tab 给说明。
  if (event === 'gear') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '齿轮魔方无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Gear Cube (cstimer generates fixed-form scrambles); see "Difficulty" for the optimal-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.gear} isZh={isZh} />
        )}
      </div>
    );
  }

  // Master Pyraminx(随态,非 WCA 项目):状态空间 ~4.6×10¹¹ 太大无法全枚举 → 难度 = **采样**整解步数分布
  //(浏览器现场用 cstimer 自带两阶段 solver 解 N 个随机打乱,近最优、非可证最优);无打乱长度数据。
  if (event === 'mpyrso') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '大金字塔无打乱长度分布(打乱由 cstimer 随态生成);整解近最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Master Pyraminx (cstimer generates random-state scrambles); see "Difficulty" for the near-optimal solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.mpyrso} isZh={isZh} />
        )}
      </div>
    );
  }

  // Dino Cube(随态,非 WCA 项目):状态空间 A12 = 12!/2 = 239,500,800(只有棱)超 TIER A/B 上限 →
  // 难度 = **采样**整解步数分布(浏览器现场用 cstimer 自带 solver 解 N 个随机打乱,近最优、非可证最优);
  // 无打乱长度数据。
  if (event === 'dino') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '恐龙魔方无打乱长度分布(打乱由 cstimer 随态生成);整解近最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Dino Cube (cstimer generates random-state scrambles); see "Difficulty" for the near-optimal solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.dino} isZh={isZh} />
        )}
      </div>
    );
  }

  // 疯狂 3×3(crz3a,非 WCA 项目):机械上是普通三阶魔方,状态空间 ~4.3×10¹⁹ 太大无法全枚举 → 难度 =
  // **采样**整解步数分布(浏览器现场用站内 kociemba 两阶段 solver 解 N 个随机打乱,近最优、非可证最优);
  // 无打乱长度数据。
  if (event === 'crz3a') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: '疯狂 3×3 无打乱长度分布(打乱由 cstimer 生成,记号即标准三阶);整解近最优步数分布见「难度」',
              en: 'No scramble-length distribution for the Crazy 3×3 (cstimer generates standard 3×3 scrambles); see "Difficulty" for the near-optimal solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.crz3a} isZh={isZh} />
        )}
      </div>
    );
  }

  // Square-2(非 WCA,TIER D):在 (u,d)/ 记号下可达状态 76,828,484,468,736,000(= 12·18!,Schreier-Sims)无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本解 N 条随机态后落静态 JSON,约简近最优);无打乱长度数据。
  if (event === 'sq2') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Square-2 无打乱长度分布(打乱由 cstimer 定长生成);整解近最优步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Square-2 (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled near-optimal solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.sq2} isZh={isZh} />
        )}
      </div>
    );
  }

  // Super Square-1(非 WCA,TIER D):两个耦合的 Square-1,可达状态 ≈1.15×10²⁵,无法整图枚举,
  // 难度 = 整解步数的**离线采样**分布(build 脚本解 N 条随机态后落静态 JSON,两阶段约简有效有界);无打乱长度数据。
  if (event === 'ssq1') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Super Square-1 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Super Square-1 (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.ssq1} isZh={isZh} />
        )}
      </div>
    );
  }

  // Bandaged Square-1(非 WCA,TIER D):受限 </,(1,0)> 移动集(顶层 + 切片,底层从不直接转),
  // 可达态是 Square-1 群的一个大子群,无法整图枚举,难度 = 整解步数的**离线采样**分布
  //(build 脚本解 N 条随机态后落静态 JSON,三阶段约简有效有界);无打乱长度数据。
  if (event === 'bsq') {
    return (
      <div className="scramble-stats-page">
        {header}
        {tab === 'length' ? (
          <div className="scramble-stats-loading">
            {tr({
              zh: 'Bandaged Square-1 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
              en: 'No scramble-length distribution for the Bandaged Square-1 (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
            })}
          </div>
        ) : (
          <EnumeratedDistView spec={ENUM_SPECS.bsq} isZh={isZh} />
        )}
      </div>
    );
  }

  if (tab === 'length') {
    return (
      <div className="scramble-stats-page">
        {header}
        {lengthsError
          ? <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed'
        })}: {lengthsError}</div>
          : timelineActive
            ? timelineBlock
            : <ScrambleLengthView isZh={isZh} data={lengthsData} event={event} merged={merged} metric={lenMetric} avgData={avgLen} avgMode={avgOn} avgExtras={avgExtras} />}
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
          {isEssential
            ? (event === 'pyram'
              // 局部目标 6 档只有 2×2 有;金字塔若从 URL 拿到这些 slug,退回「所有状态」而不是白屏。
              ? <PyraminxEssentialView isZh={isZh} pop={essSrc === 'ess' ? 'ess' : 'all'} />
              : <Essential2x2View isZh={isZh} view={essSrc} />)
            : timelineActive
              ? timelineBlock
              : <PuzzleDistView isZh={isZh} puzzleKey={puzzleKey} />}
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

  // 样本量由图内自报(DiscreteHistogram 对 series 求和 = 打乱条数 / 组数),这里不再另算一份。

  // 方法下拉:数据层块变体(123/123x2/222/223)聚合显示为「砖」,EOLine 变体并入「EO」;
  // 阶段下拉列细分(块形状 / EO·EOLine),选中时经 *_STAGE_VARIANT 落回底层变体,
  // 数据/示例/下载全走原 variant+stage 键。顺序走共享 VARIANT_ORDER(与首页 RecentScrambles 一致)。
  const methodOptions = VARIANT_ORDER.filter((v) =>
    v === 'block'
      ? BLOCK_DATA_VARIANTS.some((b) => !!currentSet.variants[b])
      : v === 'eo'
        ? EO_DATA_VARIANTS.some((b) => !!currentSet.variants[b])
        : !!currentSet.variants[v],
  ) as VariantKey[];
  const blockStages = VARIANT_STAGES.block.filter((s) =>
    currentSet.variants[BLOCK_STAGE_VARIANT[s]]?.stages.includes(s));
  const eoStages = EO_UI_STAGES.filter((s) =>
    currentSet.variants[EO_STAGE_VARIANT[s]]?.stages.includes(s));
  const isBlockUi = isBlockVariant(variant);
  const isEoUi = isEoVariant(variant);

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
            className="scramble-stats-select"
            value={isBlockUi ? 'block' : isEoUi ? 'eo' : variant}
            options={methodOptions}
            onChange={(val) => {
              const v = val as VariantKey;
              if (v === 'block') {
                const s = blockStages[0];
                if (s) { setVariant(BLOCK_STAGE_VARIANT[s] as VariantKey); setStage(s); }
              } else if (v === 'eo') {
                const s = eoStages[0];
                if (s) { setVariant(EO_STAGE_VARIANT[s] as VariantKey); setStage(s); }
              } else setVariant(v);
            }}
            isZh={i18n.language.startsWith('zh')}
            ariaLabel={tr({ zh: '变体', en: 'Variant'
        })}
          />
        </label>
        <label>
          <VariantSelect
            className="scramble-stats-select"
            value={stage}
            options={isBlockUi ? blockStages : isEoUi ? eoStages : currentStages}
            onChange={(s) => {
              if (isBlockUi && BLOCK_STAGE_VARIANT[s]) setVariant(BLOCK_STAGE_VARIANT[s] as VariantKey);
              else if (isEoUi && EO_STAGE_VARIANT[s]) setVariant(EO_STAGE_VARIANT[s] as VariantKey);
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
            <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '度量', en: 'Metric' })}</span>
            <PillToggle
              value={optMetric === 'qtm'}
              onChange={(v) => setOptMetric(v ? 'qtm' : 'htm')}
              offLabel="HTM"
              onLabel="QTM"
              ariaLabel={tr({ zh: '度量:HTM(半圈计 1)或 QTM(半圈计 2)', en: 'Move metric: HTM (half turn = 1) or QTM (half turn = 2)' })}
            />
            <span className="scramble-stats-puzzle-toggle-hint">
              {optMetric === 'qtm'
                ? tr({ zh: 'QTM 计步即将加入', en: 'QTM coming soon' })
                : tr({ zh: '整解最优步数(HTM)', en: 'Optimal solution length (HTM)' })}
            </span>
          </div>
        )}
        {/* 均值 / 中位数不再在这里另起一行 —— 复用 DiscreteHistogram 的图内标注(竖虚线 + 底部文字),见下方图表调用。 */}
        {/* 样本量不在这里报 —— DiscreteHistogram 在图内自报总数(单次 = 打乱条数,组平均 = 组数)。 */}
        {/* 下载全部:该阶段全量语料(每条打乱 + 比赛信息 + 各底色十字步数)gz CSV;仅 std 变体有。组平均模式无对应下载。 */}
        {!avgOn && dataset === 'wca' && variant === 'std' && bundleStages?.includes(stage) && (
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

      {timelineActive ? timelineBlock : avgOn ? (
      <>
      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={avgSeries}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          clickableBins={avgPreviewBins}
          selectedBin={selectedBin}
          onBarClick={handleAvgBarClick}
          hideLegendColors
          gapAware
          showBarLabels={false}
          formatBin={(v) => (v / avgDenom).toFixed(1)}
          meanValue={avgStats?.mean}
          medianValue={avgStats?.median}
          meanLabel={avgStats ? `${tr({ zh: '平均', en: 'mean' })} ${(avgStats.mean / avgDenom).toFixed(2)}` : undefined}
          medianLabel={avgStats ? `${tr({ zh: '中位数', en: 'median' })} ${(avgStats.median / avgDenom).toFixed(1)}` : undefined}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
        />
      </div>
      <AvgExamplesPanel
        cases={avgMatchingGroups}
        comps={avgShards[`${variant}#${stage}`]?.comps}
        lang={uiLangOf(i18n.language)}
        isZh={isZh}
        selectedBin={selectedBin}
        fullCount={selectedBin !== null ? (avgActiveCounts[String(selectedBin)] ?? 0) : 0}
        loading={avgExLoading}
        errorText={avgExError}
        eventLabel={eventLabel}
      />
      </>
      ) : (
      <>
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
          meanValue={extendedStats?.mean}
          medianValue={extendedStats?.median}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
        />
      </div>

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
        wcaEvent={event}
        merged={merged}
        dataset={dataset}
        filterCountry={filterCountry}
        onFilterCountry={setFilterCountry}
      />

      </>
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
  wcaEvent,
  merged,
  dataset,
  filterCountry,
  onFilterCountry,
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
  wcaEvent: string;
  merged: boolean;
  dataset: string;
  filterCountry: string | null;            // 选中的 country_id(null=不筛)
  onFilterCountry: (countryId: string | null) => void;
}) {
  // 「查看全部」展开态提到面板这一层:筛选栏(搜索 + 日期)常驻,展开后用全量列表**替换**
  // 示例预览(不再两个列表叠着),全量条数经 onTotal 收上来折进面板标题。
  const [showAll, setShowAll] = useState(false);
  const [fullTotal, setFullTotal] = useState<number | null>(null);
  // 收起时清掉国家筛选(与国家条选中态、chip 同步);展开由点柱/点某国触发。
  const onExpanded = (v: boolean) => { setShowAll(v); if (!v) { setFullTotal(null); onFilterCountry(null); } };
  const canFullList = dataset === 'wca' && !is333 && selectedBin !== null;
  // 点某国 → 预览太薄(每 bin 5 条),自动展开服务端全量列表按该国筛。
  useEffect(() => {
    if (filterCountry && canFullList && !showAll) setShowAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCountry]);
  // 各国计数:服务端 facet(与「查看全部」列表同源、永远对得上);仅 std/步骤(canFullList)有全量库。
  const [facetCountries, setFacetCountries] = useState<ByDifficultyCountry[] | null>(null);
  useEffect(() => {
    if (!canFullList || selectedBin === null) { setFacetCountries(null); return; }
    let alive = true;
    void fetchByDifficultyCountries({
      variant, stage, colors: subsetKey, bin: selectedBin, event: merged ? undefined : wcaEvent,
    }).then((cs) => { if (alive) setFacetCountries(cs); });
    return () => { alive = false; };
  }, [canFullList, selectedBin, variant, stage, subsetKey, merged, wcaEvent]);
  // 下拉选项(country_id→计数,按次数降序;label 后带计数 hint)。
  // std/步骤:用 facet(与列表同源);整解(333)只有预览、无全量库 → 从当前样例算,计数=可见条数。
  const countryItems: ListSelectItem[] = (() => {
    const m: Record<string, number> = {};
    if (canFullList && facetCountries && facetCountries.length) {
      for (const { id, n } of facetCountries) m[id] = n;
    } else {
      for (const s of (samples ?? [])) {
        const cid = compCountryId(idMeta?.[s[0]]?.[0] ?? '');
        if (cid) m[cid] = (m[cid] ?? 0) + 1;
      }
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id, cnt]) => {
        const iso2 = countryToIso2(id);
        const en = iso2 ? countryName(iso2, false) : id;
        const zh = iso2 ? countryName(iso2, true) : id;
        return { value: id, label: isZh ? zh : en, hint: String(cnt), country: iso2 || undefined, searchTerms: `${en} ${zh} ${id}` };
      });
  })();
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
  // 收起态预览按国筛(客户端;仅 5 条/bin,薄 → 选国会自动展开走服务端全量)。
  const previewSamples = (sortedSamples && filterCountry)
    ? sortedSamples.filter(([id]) => compCountryId(idMeta?.[id]?.[0] ?? '') === filterCountry)
    : sortedSamples;
  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {selectedBin !== null
            ? (isZh ? `${selectedBin} 步示例` : `${selectedBin}-move examples`)
            : tr({ zh: '示例', en: 'Examples' })}
          {showAll && fullTotal !== null && (
            <span className="scramble-stats-examples-allcount">
              {tr({ zh: '共 {n} 条', en: '{n} total' }).replace('{n}', fullTotal.toLocaleString())}
            </span>
          )}
        </div>
        {countryItems.length > 1 && (
          <ListSelect
            className="pdv-country-select"
            items={countryItems}
            value={filterCountry ?? ''}
            onChange={(v) => onFilterCountry(v || null)}
            allLabel={tr({ zh: '全部国家', en: 'All countries' })}
            searchable={countryItems.length > 8}
          />
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
        {canFullList && (
          <FullScrambleFilterBar
            expanded={showAll}
            onExpandedChange={onExpanded}
            isZh={isZh}
          />
        )}
        {selectedDownloadable && (
          <a
            className="scramble-stats-download-btn"
            href={`/stats/scramble/downloads/${scrambleSet}/${variant}/${stage}/${subsetKey}_${selectedBin}.txt`}
            download={`${scrambleSet}_${variant}_${stage}_${subsetKey}_${selectedBin}.txt`}
            title={tr({ zh: `下载 ${selectedBin} 步完整 txt`, en: `Download full txt for ${selectedBin} moves` })}
            aria-label={tr({ zh: `下载 ${selectedBin} 步完整 txt`, en: `Download full txt for ${selectedBin} moves` })}
          >
            <DownloadIcon />
          </a>
        )}
      </div>
      {/* 查看全部:筛选栏(搜索 + 日期)在标题行内跟国家/下载并排;展开后用全量列表替换下方的示例预览
          (仅 WCA 数据集、非整解、已选 bin)。合并池 → 不传 event;分开 → 传当前项目。 */}
      {canFullList && (
        <FullScrambleList
          apiEvent={merged ? undefined : wcaEvent}
          variant={variant}
          stage={stage}
          colors={subsetKey}
          bin={selectedBin}
          country={filterCountry ?? undefined}
          lang={lang}
          isZh={isZh}
          exView={exView}
          expanded={showAll}
          onExpandedChange={onExpanded}
          onTotal={setFullTotal}
        />
      )}
      {!showAll && selectedBin !== null && loading && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载中…', en: 'Loading…'
        })}</div>
      )}
      {!showAll && selectedBin !== null && errorText && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载失败', en: 'Load failed'
        })}: {errorText}</div>
      )}
      {!showAll && selectedBin !== null && !loading && !errorText && previewSamples && previewSamples.length > 0 && (
        <ul className="scramble-stats-examples-list">
          {previewSamples.map(([id, scr, color, opt], i) => {
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
      {!showAll && selectedBin !== null && !loading && !errorText && samples && previewSamples && previewSamples.length === 0 && (
        <div className="scramble-stats-examples-hint">
          {filterCountry
            ? tr({ zh: '该国此步数预览无示例,点「查看全部」看全量', en: 'No preview examples from this country; click “View all” for the full list' })
            : tr({ zh: '此 bin 无示例', en: 'No examples for this bin' })}
        </div>
      )}
    </div>
  );
}
