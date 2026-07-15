'use client';

// 2×2×2 全空间精确枚举视图(与 WCA 真题采样相对)。数据来自 scripts/build_2x2_essential.mjs
// 生成的静态 JSON。视图由顶部**唯一**的数据源下拉(page.tsx 的 essSrc)选,本组件按 view 只渲染
// 归属该档的面板 —— 不同总体的直方图形状几乎重合,并排堆着读者只会以为自己看重了:
//   view='all'(所有状态,3,674,160)  → 主 HTM/QTM 分布 + 联合 HTM×QTM 表
//   view='ess'(所有本质状态,77,801)→ 本质状态聚合(F/H/Q)+ 全量状态表(懒加载)
//   view=<slug>(局部目标 6 档)      → 该数据集单张分布图(原先面板内的「数据集」下拉已提到顶层);
//                                       其中 fixff(固定底面)额外挂底面状态图库 —— 图库与该分布是
//                                       同一底面子问题的两个对称档位(945 固定朝向 vs 258 去重 / 140 折镜像)
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import PillToggle from '@/components/PillToggle/PillToggle';
import BoolToggle from '@/components/BoolToggle';
import {
  fetchEssential2x2, fetchEssential2x2Cases, ESS_STAT_BY_SLUG,
  type Essential2x2Json, type EssCaseRow,
} from '@/lib/essential-2x2';
import { tr } from '@/i18n/tr';
import FirstStepGallery, { type GalleryRow } from './FirstStepGallery';
import firstFace2x2 from '../_data/firstface_2x2.json';
import './_essential-shared.css';

const Essential2x2CaseTable = dynamic(() => import('./Essential2x2CaseTable'), {
  ssr: false,
  loading: () => <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>,
});

const RED = '#f04f4f';   // 主分布(与 WCA 222 图同色,魔方红)
const BLUE = '#3d7bf0';  // 首面/首层子分布
const GREEN = '#2ec27e'; // 本质状态聚合

// 大数紧凑显示(热力表 / 标签):841500 → 842k,1.9e6 → 1.9M。
function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

// 「底面 / 首层」6 个数据集的**分母口径**。它们并不都在全空间上统计,分母有四种,光印一个
// 「共 378」会被读成 378 个魔方状态 —— 故每个数据集自报它数的是什么、以及与全空间的确切关系:
//   quotient 三档是全空间到子问题的等变商(只追踪几个角块)。纤维恒定已对全部 3,674,160 个状态
//     逐个投影实证(`node scripts/verify_2x2_fibers.mjs`,改数据后重跑):纤维大小 min==max,且
//     子直方图 × 纤维逐格等于全空间直方图。故分母虽小,各步数占比与在全空间上统计**逐格相同**
//     —— 不是抽样、不是近似。整除性只是必要条件,不足以下这个结论,别拿它替代实证。
//     纤维大小 = 3,674,160 / 子状态数(两角块 9,720、底面 3,888、底层 648),由数据现算,不硬编码。
//   full  两档:全空间逐个状态计算,底色取六色中最优。
//   subset 一档:无连色是全空间的**子集**(非商),故分母不同是本质的 —— 它是条件分布。
type PopKind = 'quotient' | 'full' | 'subset';
const STAT_POP: Record<string, { kind: PopKind; unit: { zh: string; en: string }; tracked?: { zh: string; en: string } }> = {
  'Fixed V': {
    kind: 'quotient',
    unit: { zh: '个两角块子状态', en: 'two-corner sub-states' },
    tracked: {
      zh: 'UFL、ULB 两个角块的位置与朝向(DBL 恒定,故解出这两块 = L 面 4 个角块中的 3 个归位)',
      en: 'the position + orientation of corners UFL and ULB (DBL is fixed, so solving these two leaves 3 of the L face\'s 4 corners home)',
    },
  },
  'Fixed FF': {
    kind: 'quotient',
    unit: { zh: '个底面子状态', en: 'first-face sub-states' },
    tracked: {
      zh: 'D 层 3 个自由角块(DFR/DLF/DRB)的位置与朝向,不区分它们彼此的次序(底面一色即可)',
      en: 'the position + orientation of the 3 free D-layer corners (DFR/DLF/DRB), ignoring their order among themselves (a solid face suffices)',
    },
  },
  'Fixed FL': {
    kind: 'quotient',
    unit: { zh: '个底层子状态', en: 'first-layer sub-states' },
    tracked: {
      zh: 'D 层 3 个自由角块(DFR/DLF/DRB)的位置与朝向,且区分次序(整层复原)',
      en: 'the position + orientation of the 3 free D-layer corners (DFR/DLF/DRB), order included (a fully solved layer)',
    },
  },
  'CN FF': { kind: 'full', unit: { zh: '个状态', en: 'states' } },
  'CN FL': { kind: 'full', unit: { zh: '个状态', en: 'states' } },
  '(No Bar) CN FF': { kind: 'subset', unit: { zh: '个无连色状态', en: 'no-bar states' } },
};

function statOf(counts: Record<string, number>) {
  const e = Object.entries(counts).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0]);
  if (!e.length) return null;
  let total = 0, sum = 0, mode = e[0][0], modeN = 0;
  for (const [x, v] of e) { total += v; sum += x * v; if (v > modeN) { modeN = v; mode = x; } }
  const pct = (p: number) => { const t = total * p; let c = 0; for (const [x, v] of e) { c += v; if (c >= t) return x; } return e[e.length - 1][0]; };
  return { mean: total ? sum / total : 0, median: pct(0.5), mode, min: e[0][0], max: e[e.length - 1][0], total };
}

export default function Essential2x2View({ isZh, view }: { isZh: boolean; view: string }) {
  const [data, setData] = useState<Essential2x2Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'htm' | 'qtm'>('htm');
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [statY, setStatY] = useState<'percent' | 'count'>('percent');
  // 当前选的是哪个「局部目标」数据集(顶层下拉的 slug → JSON 里的 key);非局部目标档为 null。
  const statKey = ESS_STAT_BY_SLUG[view]?.key ?? null;
  const [caseMetric, setCaseMetric] = useState<'F' | 'H' | 'Q' | 'QH'>('H');
  const [caseY, setCaseY] = useState<'percent' | 'count'>('percent');
  const [jointExact, setJointExact] = useState(false);
  // 状态大文件(~5 MB)懒加载:仅当用户点「浏览全部状态」才拉。
  const [cases, setCases] = useState<EssCaseRow[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchEssential2x2().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);

  const loadCases = () => {
    if (cases || casesLoading) return;
    setCasesLoading(true);
    fetchEssential2x2Cases()
      .then((d) => setCases(d.rows))
      .catch((e) => setCasesError(String(e)))
      .finally(() => setCasesLoading(false));
  };

  const mainCounts = metric === 'htm' ? data?.htm.counts : data?.qtm.counts;
  const mainSeries = useMemo<HistSeries[]>(() => {
    if (!mainCounts) return [];
    return [{ name: metric.toUpperCase(), fillColors: [RED], counts: mainCounts }];
  }, [mainCounts, metric]);
  const mainStat = useMemo(() => (mainCounts ? statOf(mainCounts) : null), [mainCounts]);

  const statGroup = useMemo(() => data?.stat.groups.find((g) => g.key === statKey) ?? null, [data, statKey]);
  const statCounts = useMemo(() => {
    if (!statGroup) return null;
    const counts: Record<string, number> = {};
    for (const r of statGroup.rows) counts[String(r.m)] = r.cases;
    return counts;
  }, [statGroup]);
  const statSeries = useMemo<HistSeries[]>(() => {
    if (!statGroup || !statCounts) return [];
    return [{ name: statGroup.label.en, fillColors: [BLUE], counts: statCounts }];
  }, [statGroup, statCounts]);
  const statStat = useMemo(() => (statCounts ? statOf(statCounts) : null), [statCounts]);

  const caseCounts = data?.case_agg[caseMetric];
  const caseSeries = useMemo<HistSeries[]>(() => {
    if (!caseCounts) return [];
    return [{ name: caseMetric, fillColors: [GREEN], counts: caseCounts }];
  }, [caseCounts, caseMetric]);
  const caseStat = useMemo(() => (caseCounts ? statOf(caseCounts) : null), [caseCounts]);

  const jointMax = useMemo(() => {
    if (!data) return 1;
    let m = 1;
    for (const row of data.joint.grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [data]);

  if (error) return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {error}</div>;
  if (!data) return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;

  const { meta } = data;

  // 联合表列合计
  const colTotals = data.joint.htm.map((_, hi) => data.joint.grid.reduce((s, row) => s + (row[hi] ?? 0), 0));

  // 当前「局部目标」数据集的分母口径。所有数字都从数据现算(纤维 = 全空间 / 子状态数;
  // 子集占比 = 子集 / 全空间),不硬编码 —— 换了数据也不会说谎。
  const statPop = statKey ? STAT_POP[statKey] : undefined;
  const NFULL = meta.total_positions;
  const nfull = NFULL.toLocaleString();
  const statPopNote = (() => {
    if (!statGroup || !statPop) return null;
    // total 类型上可空:退回按行求和(与柱子同源)。仍拿不到就不出这行 —— 宁可不说,不可说错。
    const nsub = statGroup.total ?? statStat?.total ?? null;
    if (nsub == null || nsub <= 0) return null;
    if (statPop.kind === 'quotient') {
      const fiber = NFULL / nsub; // 已实证为整数且纤维恒定
      // fixff 的口径改用下方的商链示意图(.ff-chain),这里返回 null 免得重复出文字。
      if (view === 'fixff') return null;
      return tr({
        zh: `子问题投影:只追踪 ${statPop.tracked!.zh} → ${nsub.toLocaleString()} 个子状态。每个子状态恰好对应全空间 ${fiber.toLocaleString()} 个状态(纤维恒定),故各步数占比与在全部 ${nfull} 个状态上统计逐格相同 —— 分母虽小,分布不打折。`,
        en: `Sub-puzzle projection: tracks only ${statPop.tracked!.en} → ${nsub.toLocaleString()} sub-states. Each sub-state corresponds to exactly ${fiber.toLocaleString()} full states (the fibres are all the same size), so every bar's share is identical to counting over all ${nfull} states — a smaller denominator, not a weaker distribution.`,
      });
    }
    if (statPop.kind === 'full') {
      return tr({
        zh: `全空间统计:全部 ${nfull} 个状态逐个计算,底色取六色中最优。`,
        en: `Counted over the full space: all ${nfull} states, each taking the best of the 6 colours.`,
      });
    }
    // subset:分母不同是本质的,不是口径 bug
    const pct = ((nsub / NFULL) * 100).toFixed(2);
    return tr({
      zh: `全空间的子集(不是商):无连色 = 整个魔方上没有任何两个相邻同色贴纸,共 ${nsub.toLocaleString()} 个,占全空间 ${pct}%。故这是条件分布 P(CN底面步数 | 无连色),分母与其它数据集不同是本质的。`,
      en: `A subset of the full space (not a quotient): "no bar" means no two adjacent stickers anywhere share a colour — ${nsub.toLocaleString()} states, ${pct}% of the space. So this is the conditional distribution P(CN first-face moves | no bar); its denominator differs from the others by nature.`,
    });
  })();

  const credits = (
    <div className="scramble-stats-meta ess-credits">
      <span>
        {tr({ zh: '参考', en: 'ref.' })} <a href={meta.credits.source_url} target="_blank" rel="noopener noreferrer">Jaap Scherphuis</a>
      </span>
    </div>
  );

  // ── 局部目标 6 档(底面 / 底层 / 两角块):单张分布图 + 分母口径 + 记号图例 ──────────────────
  // 数据集本身由顶层数据源下拉选,故这里不再出面板内的「数据集」下拉(一页两个选择器 = 上一版的乱)。
  if (statKey) {
    if (!statGroup) {
      // JSON 里没这个 key(数据换了 / slug 飘了)—— 明说,别静默画一张空图。
      return (
        <div className="scramble-stats-error">
          {tr({ zh: '数据集不存在', en: 'Dataset not found' })}: {statKey}
        </div>
      );
    }
    // fixff 专属商链示意图的数字(其它档不渲染,便宜不算)。nsub = 945 取自数据,fiber = 全空间 / nsub;
    // reorient/mirror 取自 firstface_2x2.json,全部现算,换了数据不会说谎。
    const ffChain = view === 'fixff'
      ? (() => {
          const nsub = statGroup.total ?? statStat?.total ?? 0;
          return {
            nfull,
            nsub: nsub.toLocaleString(),
            fiber: (nsub > 0 ? NFULL / nsub : 0).toLocaleString(),
            reorient: firstFace2x2.meta.total_reorient,
            mirror: firstFace2x2.meta.total_mirror_folded,
          };
        })()
      : null;
    return (
      <div className="ess-view">
        <div className="scramble-stats-chart-wrapper">
          <DiscreteHistogram
            series={statSeries}
            isZh={isZh}
            yMode={statY}
            chartMode="pdf"
            hideLegendColors
            totalUnit={statPop?.unit}
            meanValue={statStat?.mean}
            medianValue={statStat?.median}
            onYModeToggle={() => setStatY(statY === 'percent' ? 'count' : 'percent')}
          />
        </div>
        {/* 分母口径:6 档分母有四种(商 / 全空间 / 子集),必须逐个讲清它数的是什么。
            fixff 的口径改用下方商链示意图(statPopNote 对它返回 null,故此处不出文字)。*/}
        {statPopNote && <div className="ess-note">{statPopNote}</div>}
        {ffChain && (
          <figure
            className="ff-chain"
            aria-label={tr({
              zh: `底面子问题的商链:全空间 ${ffChain.nfull} → 固定朝向 ${ffChain.nsub} → 去整体旋转 ${ffChain.reorient} → 去镜像 ${ffChain.mirror}`,
              en: `First-face quotient chain: full space ${ffChain.nfull} → fixed frame ${ffChain.nsub} → rotations folded ${ffChain.reorient} → mirror folded ${ffChain.mirror}`,
            })}
          >
            <div className="ff-flow">
              <div className="ff-node">
                <span className="ff-n">{ffChain.nfull}</span>
                <span className="ff-cap">{tr({ zh: '全空间', en: 'full space' })}</span>
              </div>
              {/* 首箭头 = 纤维恒定的精确投影(保分布),染品牌色以别于后两步的对称折叠 */}
              <div className="ff-arr ff-arr-exact">
                <span className="ff-op">{tr({ zh: '商映射', en: 'quotient map' })}</span>
                <span className="ff-glyph" aria-hidden="true" />
                <span className="ff-det">÷ {ffChain.fiber}</span>
              </div>
              <div className="ff-node ff-node-key">
                <span className="ff-n">{ffChain.nsub}</span>
                <span className="ff-cap">{tr({ zh: '底面子状态 · 固定朝向', en: 'sub-states · fixed frame' })}</span>
              </div>
              <div className="ff-arr">
                <span className="ff-op">{tr({ zh: '并整体旋转', en: 'fold rotations' })}</span>
                <span className="ff-glyph" aria-hidden="true" />
                <span className="ff-det">{tr({ zh: '24 朝向 · Burnside', en: '24 frames · Burnside' })}</span>
              </div>
              <div className="ff-node">
                <span className="ff-n">{ffChain.reorient}</span>
                <span className="ff-cap">{tr({ zh: '本质状态', en: 'essential states' })}</span>
              </div>
              <div className="ff-arr">
                <span className="ff-op">{tr({ zh: '并镜像', en: 'fold mirror' })}</span>
                <span className="ff-glyph" aria-hidden="true" />
                <span className="ff-det">{tr({ zh: '+反射 · Burnside', en: '+reflection · Burnside' })}</span>
              </div>
              <div className="ff-node">
                <span className="ff-n">{ffChain.mirror}</span>
                <span className="ff-cap">{tr({ zh: '折镜像后', en: 'mirror-folded' })}</span>
              </div>
            </div>
            <figcaption className="ff-foot">
              {tr({
                zh: `纤维 ${ffChain.fiber} = 3!·4!·3³ —— 被追踪的 3 个底角互不分次序(3!)× 其余 4 角块的排列(4!)× 这 4 块的朝向(3³ = 3⁴/3,总扭转 mod 3 守恒)。纤维恒定,故 ${ffChain.nsub} 个子状态上的等权计步与全空间 ${ffChain.nfull} 态逐格相同、分布不打折;后两步是对称群轨道计数(Burnside 引理),非整除。`,
                en: `Fibre ${ffChain.fiber} = 3!·4!·3³ — the 3 tracked bottom corners are unordered (3!) × the other 4 corners' permutation (4!) × those 4 corners' orientation (3³ = 3⁴/3, total twist conserved mod 3). The fibre is constant, so equal-weight move counts over the ${ffChain.nsub} sub-states match the full ${ffChain.nfull}-state distribution bar-for-bar; the last two steps are symmetry-group orbit counts (Burnside's lemma), not plain division.`,
              })}
            </figcaption>
          </figure>
        )}
        {/* FF/FL/Fixed/CN 记号图例:fixff 已由上方商链示意图讲清「底面/固定朝向」,不再重复;
            其余数据集仍需它区分 FF/FL 与 Fixed/CN。*/}
        {view !== 'fixff' && (
          <div className="ess-note">
            {tr({
              zh: 'FF = 底面;FL = 底层(整层复原);Fixed = 单色底;CN = 六色底。',
              en: 'FF = first face; FL = first layer (a fully solved layer); Fixed = fixed reference color; CN = color-neutral (best over all 6 colors).',
            })}
            {data.stat.note ? ` · ${data.stat.note}` : ''}
          </div>
        )}
        {/* fixff 专属:配套底面状态图库(258 去旋转 / 140 去镜像)。它与上面分布是同一子问题,
            945→258→140 的关系由上方 .ff-chain 商链示意图讲清,这里不再另起说明。*/}
        {view === 'fixff' && (
          <FirstStepGallery
            event="222"
            mask={firstFace2x2.meta.mask}
            rows={firstFace2x2.rows as unknown as GalleryRow[]}
            totalReorient={firstFace2x2.meta.total_reorient}
            totalMirror={firstFace2x2.meta.total_mirror_folded}
            metricLabel={{ zh: '难度', en: 'Difficulty' }}
          />
        )}
        {credits}
      </div>
    );
  }

  // ── 所有本质状态(77,801 去重):本质状态聚合 + 全量表 ──────────────────────
  if (view === 'ess') {
    return (
      <div className="ess-view">
        {/* 本质状态聚合(F/H/Q)*/}
        <div className="scramble-stats-panel">
          <div className="scramble-stats-panel-title">{tr({ zh: '本质状态库(去重后 {n} 个)', en: 'Essential-state database ({n} unique)' }).replace('{n}', data.case_agg.total.toLocaleString())}</div>
          <div className="ess-stat-controls">
            <label className="ess-filter">
              <span>{tr({ zh: '度量', en: 'Metric' })}</span>
              <select className="scramble-stats-select" value={caseMetric} onChange={(e) => setCaseMetric(e.target.value as 'F' | 'H' | 'Q' | 'QH')}>
                <option value="F">{tr({ zh: 'F(面转)', en: 'F (face)' })}</option>
                <option value="H">{tr({ zh: 'H(HTM)', en: 'H (HTM)' })}</option>
                <option value="Q">{tr({ zh: 'Q(QTM)', en: 'Q (QTM)' })}</option>
                <option value="QH">{tr({ zh: 'Q|H', en: 'Q|H' })}</option>
              </select>
            </label>
          </div>
          <div className="scramble-stats-chart-wrapper">
            <DiscreteHistogram
              series={caseSeries}
              isZh={isZh}
              yMode={caseY}
              chartMode="pdf"
              hideLegendColors
              totalUnit={{ zh: '个本质状态', en: 'essential states' }}
              meanValue={caseStat?.mean}
              medianValue={caseStat?.median}
              onYModeToggle={() => setCaseY(caseY === 'percent' ? 'count' : 'percent')}
            />
          </div>
          {/* 本质状态 ≠ 全空间状态:分母是去重后的本质状态数,和「所有状态」那档不是一个总体 */}
          <div className="ess-note">
            {tr({
              zh: `全部 ${nfull} 个状态按对称(24 个 CN 旋转 × 镜像)+ 逆序去重后的 ${data.case_agg.total.toLocaleString()} 个本质状态,每个计 1 次 —— 分母是本质状态数而非全空间状态数,故各步数占比与「所有状态」那档并不相同。`,
              en: `The ${nfull} states deduped by symmetry (24 colour-neutral rotations × mirror) and inversion into ${data.case_agg.total.toLocaleString()} essential states, each counted once — the denominator is essential states, not the full state space, so the shares differ from the "All states" view.`,
            })}
          </div>
          {/* 全量状态表:懒加载 */}
          {cases ? (
            <Essential2x2CaseTable isZh={isZh} rows={cases} />
          ) : (
            <div className="ess-load">
              <button type="button" className="ess-load-btn" onClick={loadCases} disabled={casesLoading}>
                {casesLoading
                  ? tr({ zh: '加载中…', en: 'Loading…' })
                  : tr({ zh: '浏览全部 {n} 个状态(约 5 MB)', en: 'Browse all {n} states (~5 MB)' }).replace('{n}', data.case_agg.total.toLocaleString())}
              </button>
              {casesError && <span className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {casesError}</span>}
            </div>
          )}
        </div>

        {credits}
      </div>
    );
  }

  // ── 所有状态(3,674,160 全空间):主分布 + 联合表 + 首面/首层子分布 ─────────────────────
  return (
    <div className="ess-view">
      {/* 主分布:HTM / QTM 切换 */}
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">{tr({ zh: '度量', en: 'Metric' })}</span>
          <PillToggle
            value={metric === 'htm'}
            onChange={(v) => setMetric(v ? 'htm' : 'qtm')}
            onLabel="HTM"
            offLabel="QTM"
            ariaLabel={tr({ zh: '度量:HTM 或 QTM', en: 'Metric: HTM or QTM' })}
          />
        </div>
      </div>
      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={mainSeries}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          totalUnit={{ zh: '个状态', en: 'states' }}
          meanValue={mainStat?.mean}
          medianValue={mainStat?.median}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
        />
      </div>

      {/* 联合 HTM×QTM 表 —— 全空间 BFS 精确计数(非采样),默认紧凑显示,可切精确值 */}
      <div className="scramble-stats-panel">
        <div className="scramble-stats-examples-header">
          <div className="scramble-stats-panel-title">{tr({ zh: '联合分布(HTM × QTM)', en: 'Joint distribution (HTM × QTM)' })}</div>
          <BoolToggle
            value={jointExact}
            onChange={setJointExact}
            label={tr({ zh: '精确值', en: 'Exact values' })}
          />
        </div>
        <div className="ess-joint-scroll">
          <table className="ess-joint">
            <thead>
              <tr>
                <th className="ess-joint-corner">Q\H</th>
                {data.joint.htm.map((h) => <th key={h}>{h}</th>)}
                <th className="ess-joint-total">Σ</th>
              </tr>
            </thead>
            <tbody>
              {data.joint.qtm.map((q, qi) => {
                const row = data.joint.grid[qi];
                const rowTotal = row.reduce((s, v) => s + (v ?? 0), 0);
                return (
                  <tr key={q}>
                    <th className="ess-joint-qhead">{q}</th>
                    {data.joint.htm.map((_, hi) => {
                      const v = row[hi] ?? 0;
                      const pct = v > 0 ? Math.round((Math.log(v) / Math.log(jointMax)) * 80) : 0;
                      return (
                        <td key={hi} style={v > 0 ? { background: `color-mix(in srgb, ${RED} ${pct}%, transparent)` } : undefined}>
                          {v > 0 ? (jointExact ? v.toLocaleString() : compact(v)) : ''}
                        </td>
                      );
                    })}
                    <td className="ess-joint-total">{jointExact ? rowTotal.toLocaleString() : compact(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="ess-joint-totalrow">
                <th className="ess-joint-qhead">Σ</th>
                {colTotals.map((t, i) => <td key={i} className="ess-joint-total">{jointExact ? t.toLocaleString() : compact(t)}</td>)}
                <td className="ess-joint-total">{jointExact ? meta.total_positions.toLocaleString() : compact(meta.total_positions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {credits}
    </div>
  );
}
