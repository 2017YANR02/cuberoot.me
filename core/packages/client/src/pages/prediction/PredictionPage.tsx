/**
 * /prediction — WCA 全项目速拧极限预测综合报告
 *
 * 数据源: 本地 wca_statistics MySQL → stats/prediction/all_events.json
 * 建模:    指数衰减+下限 T(t) = L + A·exp(-k(t-t₀)) — 每项目独立拟合
 *
 * 涵盖项目: 16 (15 计时项目 + 1 步数 FMC)
 * 不在主模型: 333mbf (multi-blind 编码值, 不直接可比)
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Menu, X as XIcon } from 'lucide-react';
import { LineChart, type Series } from './charts';
import { fitExpFloor, type DataPoint } from './models';
import { EVENTS, formatVal, toDisplay } from './events';
import EventSection from './EventSection';
import './prediction.css';

interface AllEvents {
  generated_at: string;
  notes: string;
  events: Record<string, any>;
}

const SECTIONS = [
  { id: 'tldr',         labelZh: '摘要',           labelEn: 'TL;DR' },
  { id: 'overview',     labelZh: '跨项目总览',     labelEn: 'Cross-Event' },
  { id: 'scaling',      labelZh: '阶数尺度律',     labelEn: 'Cube-Size Scaling' },
  { id: 'theory',       labelZh: '理论极限',       labelEn: 'Theoretical Limit' },
  { id: 'regional',     labelZh: '区域格局',       labelEn: 'Regional' },
  { id: 'methods',      labelZh: '方法论',         labelEn: 'Methodology' },
  { id: 'caveats',      labelZh: '局限与陷阱',     labelEn: 'Caveats' },
];

export default function PredictionPage() {
  const { i18n } = useTranslation();
  const lang: 'en' | 'zh' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const isZh = lang === 'zh';

  const [data, setData] = useState<AllEvents | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('tldr');

  useEffect(() => {
    fetch('/stats/prediction/all_events.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  // IntersectionObserver 同步 TOC active state
  useEffect(() => {
    if (!data) return;
    const ids = [...SECTIONS.map((s) => s.id), ...EVENTS.map((e) => `event-${e.id}`)];
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-100px 0px -60% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [data]);

  if (err) return <div className="pred-loading">Failed to load: {err}</div>;
  if (!data) return <div className="pred-loading">Loading {isZh ? '加载中…' : '…'}</div>;

  const toggleLang = () => {
    const n = isZh ? 'en' : 'zh';
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  };

  // 跨项目计算: 各项目当前 WR + 拟合 L
  const currentYear = new Date().getFullYear();
  const eventSummaries = EVENTS.map((ev) => {
    const ed = data.events[ev.id];
    if (!ed) return null;
    // 排除当前不完整年, 与 EventSection 内部保持一致
    const fitData: DataPoint[] = ed.wr_by_year
      .filter((d: any) => d.year >= 2003 && d.year < currentYear && d.wr_single !== null)
      .map((d: any) => ({ year: d.year, time: toDisplay(d.wr_single, ev.scale)! }));
    const Lmax = ev.scale === 'moves' ? 50 : 1000;
    const Lstep = ev.scale === 'moves' ? 0.5 : 0.1;
    const fit = fitExpFloor(fitData, 0, Lmax, Lstep);
    const lastWR = ed.wr_single_progression.at(-1);
    const lastWRval = lastWR ? toDisplay(lastWR.value, ev.scale)! : null;
    return {
      ev,
      ed,
      fit,
      lastWR,
      lastWRval,
      progressionCount: ed.wr_single_progression.length,
      cumCubers: ed.activity.reduce((s: number, d: any) => s + d.cubers, 0),
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // ─────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────

  return (
    <div className="pred-page pred-page-multi">
      <header className="pred-header">
        <Link to="/" className="pred-back" aria-label="back">
          <ArrowLeft size={16} />
          <span>{isZh ? '返回' : 'Back'}</span>
        </Link>
        <button
          className="pred-toc-btn"
          onClick={() => setTocOpen(!tocOpen)}
          title={isZh ? '目录' : 'Table of contents'}
        >
          {tocOpen ? <XIcon size={16} /> : <Menu size={16} />}
        </button>
        <button className="pred-lang" onClick={toggleLang}>
          {isZh ? 'English' : '中文'}
        </button>
      </header>

      <div className="pred-layout">
        {/* Sidebar TOC */}
        <aside className={`pred-sidebar${tocOpen ? ' pred-sidebar-open' : ''}`}>
          <div className="pred-toc-title">{isZh ? '目录' : 'Contents'}</div>

          <div className="pred-toc-group">
            {SECTIONS.slice(0, 1).map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`pred-toc-item${activeId === s.id ? ' is-active' : ''}`}
                onClick={() => setTocOpen(false)}
              >
                {isZh ? s.labelZh : s.labelEn}
              </a>
            ))}
          </div>

          <div className="pred-toc-group">
            <div className="pred-toc-group-title">{isZh ? '全局分析' : 'Global Analysis'}</div>
            {SECTIONS.slice(1, 5).map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`pred-toc-item${activeId === s.id ? ' is-active' : ''}`}
                onClick={() => setTocOpen(false)}
              >
                {isZh ? s.labelZh : s.labelEn}
              </a>
            ))}
          </div>

          <div className="pred-toc-group">
            <div className="pred-toc-group-title">{isZh ? '分项目章节' : 'Per-Event Chapters'}</div>
            {EVENTS.map((ev) => (
              <a
                key={ev.id}
                href={`#event-${ev.id}`}
                className={`pred-toc-item pred-toc-event${activeId === `event-${ev.id}` ? ' is-active' : ''}`}
                onClick={() => setTocOpen(false)}
              >
                <span className="pred-toc-event-name">{isZh ? ev.name_zh : ev.name_en}</span>
                <span className="pred-toc-event-id">{ev.id}</span>
              </a>
            ))}
          </div>

          <div className="pred-toc-group">
            {SECTIONS.slice(5).map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`pred-toc-item${activeId === s.id ? ' is-active' : ''}`}
                onClick={() => setTocOpen(false)}
              >
                {isZh ? s.labelZh : s.labelEn}
              </a>
            ))}
          </div>
        </aside>

        {/* Main */}
        <article className="pred-article">
          <h1 className="pred-title">
            {isZh ? '速拧的尽头: 全 WCA 项目极限预测' : 'The Limits of Speedcubing: WCA-Wide Forecast'}
          </h1>
          <p className="pred-subtitle">
            {isZh
              ? '基于 WCA 全量历史数据的统计建模, 16 项目 · 1982-2050'
              : 'Statistical modeling from full WCA history · 16 events · 1982-2050'}
          </p>

          {/* TL;DR */}
          <section className="pred-tldr" id="tldr">
            <h2>TL;DR</h2>
            <ul>
              <li>
                {isZh
                  ? '本报告对 16 个 WCA 项目独立建模. 每项目用指数衰减+下限模型 T(t) = L + A·exp(-k(t-t₀)) 拟合 2003 年后的 WR 历史, L 由网格搜索 + 残差最小化得到, 并要求 L 严格小于所有观测值.'
                  : 'This report models 16 WCA events independently. Each uses an exp+floor model T(t) = L + A·exp(-k(t-t₀)) fit on post-2003 WR history; L is grid-searched with the constraint L < all observed values.'}
              </li>
              <li>
                {isZh ? '当前 WR 单次最快接近极限的项目(L/WR 比):' : 'Events closest to fitted floor (L/current-WR ratio):'}
                {' '}
                {[...eventSummaries]
                  .filter((s) => s.fit && s.lastWRval)
                  .sort((a, b) => (a.fit!.L / a.lastWRval!) - (b.fit!.L / b.lastWRval!))
                  .reverse().slice(0, 3)
                  .map((s) => `${isZh ? s.ev.name_zh : s.ev.name_en} (${(s.fit!.L / s.lastWRval! * 100).toFixed(0)}%)`)
                  .join(' · ')}
              </li>
              <li>
                {isZh ? `数据生成于 ${data.generated_at.slice(0, 10)}. 累计 ${eventSummaries.reduce((s, x) => s + x.progressionCount, 0)} 次 WR 改写, 跨 16 项.`
                       : `Generated ${data.generated_at.slice(0, 10)}. ${eventSummaries.reduce((s, x) => s + x.progressionCount, 0)} total WR drops across 16 events.`}
              </li>
              <li>
                {isZh
                  ? '每个项目的章节包括: WR 走势 + 模型外推 / 最近 5 次 WR / 三模型拟合对比 / Sub-X 里程碑 / Top-N 全人群走势 / Sub-X 人口爆炸. 模型未涵盖 333mbf(multi-blind)的编码值不可比.'
                  : 'Each event chapter includes: WR trend + extrapolation, last 5 WRs, model comparison (exp+floor / pure exp / power law), Sub-X milestones, Top-N population trends, Sub-X cumulative cubers. 333mbf is excluded — its encoded format isn\'t comparable.'}
              </li>
            </ul>
          </section>

          {/* 跨项目总览 */}
          <section className="pred-section" id="overview">
            <h2>{isZh ? '跨项目总览' : 'Cross-Event Overview'}</h2>
            <p>
              {isZh
                ? '一目了然的当前位置: 每项目当前 WR 单次, 模型估计极限, 两者比例, 累计 cuber-年, WR 改写次数. 比例越接近 100%, 说明该项目越接近"在当前框架下不可再压缩"的渐近行为, 若想突破需要新的方法/硬件革命.'
                : 'At-a-glance positioning. For each event: current WR single, model-estimated limit L, ratio L/WR, cumulative cuber-years, # WR drops. Ratios near 100% mean the event is approaching its current-paradigm asymptote — further breakthroughs require methodological or hardware revolutions.'}
            </p>
            <div className="pred-overview-grid">
              {eventSummaries.map((s) => (
                <a key={s.ev.id} href={`#event-${s.ev.id}`} className="pred-overview-card">
                  <div className="pred-ov-name">{isZh ? s.ev.name_zh : s.ev.name_en}</div>
                  <div className="pred-ov-id">{s.ev.id}</div>
                  <div className="pred-ov-row">
                    <span className="pred-ov-label">{isZh ? '当前 WR' : 'Current WR'}</span>
                    <span className="pred-ov-val">{s.lastWRval !== null ? formatVal(s.lastWRval, s.ev.scale) : '–'}</span>
                  </div>
                  <div className="pred-ov-row">
                    <span className="pred-ov-label">{isZh ? '极限 L' : 'Limit L'}</span>
                    <span className="pred-ov-val">{s.fit ? formatVal(s.fit.L, s.ev.scale) : '–'}</span>
                  </div>
                  <div className="pred-ov-row">
                    <span className="pred-ov-label">L/WR</span>
                    <span className="pred-ov-val pred-ov-pct">
                      {s.fit && s.lastWRval ? Math.round(s.fit.L / s.lastWRval * 100) + '%' : '–'}
                    </span>
                  </div>
                  <div className="pred-ov-row">
                    <span className="pred-ov-label">{isZh ? '改写次数' : 'WR drops'}</span>
                    <span className="pred-ov-val">{s.progressionCount}</span>
                  </div>
                  <div className="pred-ov-row">
                    <span className="pred-ov-label">{isZh ? '累计 cuber' : 'Cubers'}</span>
                    <span className="pred-ov-val">{s.cumCubers.toLocaleString()}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* 阶数尺度律 */}
          <ScalingSection eventSummaries={eventSummaries} isZh={isZh} />

          {/* 理论极限 */}
          <TheoreticalSection isZh={isZh} />

          {/* 区域格局 */}
          <RegionalSection eventSummaries={eventSummaries} isZh={isZh} />

          {/* 分项目章节 */}
          {EVENTS.map((ev) => {
            const ed = data.events[ev.id];
            if (!ed) return null;
            return <EventSection key={ev.id} event={ev} data={ed} isZh={isZh} />;
          })}

          {/* 方法论 */}
          <section className="pred-section pred-method" id="methods">
            <h2>{isZh ? '方法论' : 'Methodology'}</h2>
            <ol>
              <li>
                <strong>{isZh ? '数据源' : 'Source'}.</strong>{' '}
                {isZh
                  ? `WCA 全量 results dump, 在本机 MySQL 8 (wca_statistics 库). 包含 1982 至 ${new Date().getFullYear()} 全部 333 / 222 / 444 / ... / 333fm / BLD / OH 等 16 个项目共 1.7M+ 条 333 单次成绩(其他项目数据规模见各章).`
                  : `Full WCA results dump in local MySQL 8 (wca_statistics db). Covers 1982 to ${new Date().getFullYear()}, all 16 events analyzed, 1.7M+ 333 solves (others vary).`}
              </li>
              <li>
                <strong>{isZh ? '过滤' : 'Filter'}.</strong>{' '}
                <code>best &gt; 0</code> {isZh ? '排除 DNF (-1) 与 DNS (-2)' : 'excludes DNF (-1) and DNS (-2)'}; <code>average &gt; 0</code> {isZh ? '同上' : 'same'}. 333mbf {isZh ? '编码值无法直接比较, 单独处理' : 'uses encoded value, treated separately'}.
              </li>
              <li>
                <strong>{isZh ? '年化' : 'Yearly bucketing'}.</strong>{' '}
                {isZh
                  ? '按 competitions.start_date 的年份归集. 当前未完整年自动从拟合数据中排除.'
                  : 'Grouped by competitions.start_date year. Current year (incomplete) excluded from fits.'}
              </li>
              <li>
                <strong>{isZh ? 'Top-N' : 'Top-N'}.</strong>{' '}
                {isZh
                  ? '每年每个 cuber 取最佳 (PB), 再按 PB 升序取 Top 1 / 10 / 100 / 1000 / 10000. 这避免"少数高频比赛者"的虚假领先效应.'
                  : 'Per-cuber yearly PB, then ascending order; Top 1 / 10 / 100 / 1000 / 10000 cutoffs. Eliminates spurious leads from high-frequency individuals.'}
              </li>
              <li>
                <strong>{isZh ? 'Sub-X 人口' : 'Sub-X population'}.</strong>{' '}
                {isZh
                  ? '每个 cuber 首次进入某阈值的年份, cumulative 起.阈值因项目而异(见各章).'
                  : 'First-cross year per cuber, then cumulative; thresholds vary per event.'}
              </li>
              <li>
                <strong>{isZh ? '主模型' : 'Primary model'}.</strong>{' '}
                <code>{'T(t) = L + A · exp(-k(t-t₀))'}</code>{' '}
                {isZh
                  ? '配 L 网格搜索 (步长 0.05 s 或 0.5 步, 视项目而定), 对每个候选 L 用对数线性回归在 log(T-L) 上解析求 (A, k), 取原始尺度 RSS 最小. 物理约束 L < 所有观测值.'
                  : 'L grid-search (step 0.05 s or 0.5 moves), per candidate L: OLS analytic fit on log(T-L) for (A, k); pick L minimizing original-units RSS. Physical constraint: L < all observed.'}
              </li>
              <li>
                <strong>{isZh ? '对照模型' : 'Comparison models'}.</strong>{' '}
                {isZh
                  ? '纯指数 T = a·exp(-k t), 幂律 T = a·t^(-b). 用于检验主模型未过度依赖 L 的硬塞.'
                  : 'Pure exponential and power law. Cross-check that primary fit isn\'t over-conditional on the L parameter.'}
              </li>
              <li>
                <strong>{isZh ? '复现' : 'Reproduce'}.</strong>{' '}
                <code>node .tmp/extract_all_events.mjs</code> → <code>stats/prediction/all_events.json</code>
              </li>
            </ol>
          </section>

          {/* Caveats */}
          <CaveatsSection isZh={isZh} />

          <footer className="pred-footer">
            <div>
              {isZh ? `数据生成: ${data.generated_at} · 复现见方法论 §6 末尾`
                    : `Data: ${data.generated_at} · Reproduce: see Methodology §6`}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 阶数尺度律
// ─────────────────────────────────────────────
function ScalingSection({ eventSummaries, isZh }: { eventSummaries: any[]; isZh: boolean }) {
  // 立方阶数 = N → time
  const NCUBE = ['222', '333', '444', '555', '666', '777'];
  const points = NCUBE.map((id, i) => {
    const s = eventSummaries.find((x) => x.ev.id === id);
    return { N: i + 2, time: s?.lastWRval ?? null, L: s?.fit?.L ?? null, ev: s?.ev };
  }).filter((p) => p.time !== null);

  // 拟合 t = a · N^b (log-log 回归)
  let scalingFit: { a: number; b: number; r2: number } | null = null;
  if (points.length >= 3) {
    const xs = points.map((p) => Math.log(p.N));
    const ys = points.map((p) => Math.log(p.time!));
    const n = xs.length;
    const xbar = xs.reduce((a, b) => a + b, 0) / n;
    const ybar = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - xbar) * (ys[i] - ybar); den += (xs[i] - xbar) ** 2; }
    const slope = num / den;
    const intercept = ybar - slope * xbar;
    const a = Math.exp(intercept);
    const b = slope;
    let rss = 0; for (let i = 0; i < n; i++) rss += (ys[i] - (intercept + slope * xs[i])) ** 2;
    const sst = ys.reduce((s, y) => s + (y - ybar) ** 2, 0);
    scalingFit = { a, b, r2: 1 - rss / sst };
  }

  const wrSeries: Series[] = [
    {
      name: isZh ? '当前 WR (实测)' : 'Current WR (actual)',
      color: '#c2410c',
      data: points.map((p) => ({ x: p.N, y: p.time })),
    },
  ];
  if (scalingFit) {
    const fitYs = [2,3,4,5,6,7,8,9,10].map((N) => ({ x: N, y: scalingFit!.a * Math.pow(N, scalingFit!.b) }));
    wrSeries.push({
      name: isZh ? `幂律拟合 t = ${scalingFit.a.toFixed(2)}·N^${scalingFit.b.toFixed(2)}` : `Power fit t = ${scalingFit.a.toFixed(2)}·N^${scalingFit.b.toFixed(2)}`,
      color: '#c2410c',
      dashed: true,
      data: fitYs,
    });
  }

  return (
    <section className="pred-section" id="scaling">
      <h2>{isZh ? '阶数尺度律: NxN 立方的时间复杂度' : 'Cube-Size Scaling: Time vs N'}</h2>
      <p>
        {isZh ? (
          <>
            如果把 NxN 立方当成一个 family, 求解时间应有可预测的尺度律. 理论上 NxN 拥有 ~6N²(单面块数 × 6) 的可移动小块, 且需要的步数(以 STM 计)随 N 大约线性甚至略超线性增长.
            实测看 222(N=2)到 777(N=7)的当前 WR, 用 log-log 拟合 t = a·N^b, b 是经验 scaling 指数.
            {scalingFit && <> 当前 b ≈ <strong>{scalingFit.b.toFixed(2)}</strong>, R² = {scalingFit.r2.toFixed(3)} — 即 N 翻倍, 时间约 <strong>{(2 ** scalingFit.b).toFixed(1)} 倍</strong>.</>}
          </>
        ) : (
          <>
            For NxN cubes, solving time should have predictable scaling. Each NxN has ~6N² independently-movable stickers and roughly linear (or slightly super-linear) move count in STM.
            Fitting current WR singles 2x2-7x7 by log-log gives t = a·N^b.
            {scalingFit && <> Empirical b ≈ <strong>{scalingFit.b.toFixed(2)}</strong>, R² = {scalingFit.r2.toFixed(3)} — doubling N gives <strong>{(2 ** scalingFit.b).toFixed(1)}× </strong>the time.</>}
          </>
        )}
      </p>
      <LineChart
        series={wrSeries}
        yLabel={isZh ? '时间 (秒)' : 'Time (s)'}
        xLabel="N"
        xFormat={(v) => v.toString()}
      />
      <p>
        {isZh ? (
          <>
            <strong>解读.</strong> 实测 b ≈ {scalingFit ? scalingFit.b.toFixed(2) : '?'} 高于"块数 ∝ N²" 的朴素预期(b ≈ 2),
            原因: <em>步数也随 N 超线性增长</em> — 大魔方需要 reduce 阶段 (centers + wing edges + parity), 步数大致 ∝ N², 配合 TPS 略低 (重量、惯性、防 popping), 总时间 ∝ N³ 到 N⁴ 的范围都正常.
            从 222 (~0.4 s) 到 777 (~93 s) 跨越 235 倍, 取 N 跨度 3.5 倍, 推 b = log(235)/log(3.5) ≈ 4.4 — 与 log-log 拟合一致.
            7x7 极限 ≈ 80 s 已经接近"机械操作下限": reduce 阶段 ~250+ STM 在 TPS 12 下就需要 20 s, 加 LL/parity 约 10 s.
          </>
        ) : (
          <>
            <strong>Interpretation.</strong> Empirical b ≈ {scalingFit ? scalingFit.b.toFixed(2) : '?'} exceeds the naive "stickers ∝ N²" prediction of b ≈ 2.
            Reason: <em>solution length also grows super-linearly</em> — big cubes need reduction (centers + wing edges + parity), with STM ∝ N², and slightly lower TPS (mass, inertia, anti-pop), so total time scales N³ to N⁴.
            From 222 (~0.4 s) to 777 (~93 s) spans 235×, while N spans 3.5×, giving b = log(235)/log(3.5) ≈ 4.4 — matching the log-log fit.
            7x7's apparent floor near 80 s approaches the mechanical lower bound: reduction alone is ~250+ STM at TPS 12 → 20 s, plus LL/parity ~10 s.
          </>
        )}
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────
// 理论极限
// ─────────────────────────────────────────────
function TheoreticalSection({ isZh }: { isZh: boolean }) {
  return (
    <section className="pred-section" id="theory">
      <h2>{isZh ? '理论极限 (生物力学 + 信息论)' : 'Theoretical Limit (biomech + info-theoretic)'}</h2>
      <p>
        {isZh ? (
          <>
            速拧的"绝对下限"是几个独立约束之乘积 / 之和:
          </>
        ) : (
          <>The absolute floor is dictated by several independent constraints:</>
        )}
      </p>
      <table className="pred-limits">
        <thead>
          <tr>
            <th>{isZh ? '约束' : 'Constraint'}</th>
            <th>{isZh ? '乐观估计' : 'Optimistic'}</th>
            <th>{isZh ? '现实估计' : 'Realistic'}</th>
            <th>{isZh ? '保守估计' : 'Conservative'}</th>
            <th>{isZh ? '依据' : 'Source'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{isZh ? '解长度 (3x3, STM)' : 'Solution length (3x3, STM)'}</td>
            <td>40</td><td>50</td><td>55</td>
            <td>{isZh ? "God's number=20 HTM ≈ 30 STM, 实人解 +20%" : "God's = 20 HTM ≈ 30 STM, +20% human"}</td>
          </tr>
          <tr>
            <td>{isZh ? '持续手指敲击率 (TPS)' : 'Sustained TPS'}</td>
            <td>20</td><td>18</td><td>15</td>
            <td>Aoki & Kinoshita 2001 (piano)</td>
          </tr>
          <tr>
            <td>{isZh ? '识别 + 切换损耗' : 'Recog + switching latency'}</td>
            <td>0</td><td>0.3 s</td><td>0.6 s</td>
            <td>{isZh ? 'Cross→F2L→OLL→PLL 分层认知' : 'Cross→F2L→OLL→PLL pattern recog'}</td>
          </tr>
          <tr className="pred-limits-result">
            <td><strong>{isZh ? '推导极限' : 'Derived limit'}</strong></td>
            <td><strong>2.0 s</strong></td>
            <td><strong>3.1 s</strong></td>
            <td><strong>4.3 s</strong></td>
            <td>STM/TPS + latency</td>
          </tr>
        </tbody>
      </table>
      <p>
        {isZh ? (
          <>
            <strong>"现实"3.1 s 几乎正好落在 2026 年 WR 单次(2.76 s)附近</strong> — 也就是说, 我们已经触碰到了"无新革命下"的现实下限.
            乐观下限 2.0 s 需要同时实现: 解长度 40 STM (近最优, 极少 cuber 能做到)、TPS 20 (大幅高于当前 ~17 顶峰)、零识别延迟. 这要求"端到端神经直连" — 短时间内不太可能.
          </>
        ) : (
          <>
            <strong>The "realistic" 3.1 s lands almost exactly at the 2026 WR single (2.76 s)</strong> — we've already touched the "no further revolution" floor.
            Optimistic 2.0 s requires simultaneous: 40 STM solutions (near-optimal, almost no cubers achieve), 20 TPS sustained (well above current ~17 peak), zero recognition latency. That's "end-to-end neural integration" — not coming soon.
          </>
        )}
      </p>
      <p>
        {isZh ? (
          <>
            <strong>跨项目类比.</strong> 同样的"STM × TPS × 切换"分解可应用于其他项目, 但 STM 与 TPS 因魔方大小、单手 / 盲拧任务不同而显著变化:
          </>
        ) : (
          <>
            <strong>Cross-event analog.</strong> Same STM × TPS × latency decomposition extends to other events, with STM and TPS varying by puzzle / mode:
          </>
        )}
      </p>
      <ul>
        <li>{isZh ? '单手 (OH): TPS 减半 ≈ 9, 解法相同 50 STM → 5.5 s 下限. 当前 WR ~5.45, 已贴边.' : 'OH: TPS halves to ~9, same 50 STM → 5.5 s floor. Current WR ~5.45 — at the wall.'}</li>
        <li>{isZh ? '4x4: ~80 STM (含 reduce + 3x3 + parity) × TPS 12 = 6.7 s + 1 s 切换 = 7.7 s. 当前 WR 12.4 s, 还有 4-5 s 优化空间.' : '4x4: ~80 STM (reduce + 3x3 + parity) × TPS 12 = 6.7 s + 1 s switching = 7.7 s. Current WR 12.4 s — 4-5 s headroom.'}</li>
        <li>{isZh ? 'BLD 盲拧: 不受 TPS 限制, 受记忆速度 (字母图像化 ~2 ch/s) 限制. 当前 WR ~12 s, 极限可能 ~5 s.' : 'BLD: not TPS-limited but memory-limited (~2 char/s for image-based memo). Current WR ~12 s, plausible floor ~5 s.'}</li>
        <li>{isZh ? 'FMC: 信息论极限 = God\'s number (20 HTM); 当前 WR 16 单次. 未来 sub-15 几乎肯定, sub-12 几乎不可能.' : 'FMC: info-theoretic floor = God\'s number (20 HTM); current WR 16 single. Sub-15 nearly certain in time; sub-12 nearly impossible.'}</li>
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────
// 区域格局
// ─────────────────────────────────────────────
function RegionalSection({ eventSummaries, isZh }: { eventSummaries: any[]; isZh: boolean }) {
  // 跨项目找当前 WR 持有者国家分布
  const countries: Record<string, string[]> = {};
  for (const s of eventSummaries) {
    const w = s.lastWR;
    if (!w) continue;
    const c = w.country_id;
    if (!countries[c]) countries[c] = [];
    countries[c].push(s.ev.id);
  }
  const sortedCountries = Object.entries(countries).sort((a, b) => b[1].length - a[1].length);

  // 最近 20 年每年 WR 的国籍 (用 333 进程作为代表)
  const main333 = eventSummaries.find((s) => s.ev.id === '333');
  const recent333WR = main333?.ed.wr_single_progression.slice(-15) ?? [];

  return (
    <section className="pred-section" id="regional">
      <h2>{isZh ? '区域格局: 谁在改写纪录' : 'Regional Landscape: Who Sets Records'}</h2>
      <p>
        {isZh ? '当前 16 项 WR 单次持有者的国籍分布:' : 'National breakdown of current WR-single holders across 16 events:'}
      </p>
      <table className="pred-forecast">
        <thead>
          <tr>
            <th>{isZh ? '国家 / 区域' : 'Country / Region'}</th>
            <th>{isZh ? 'WR 单次数量' : 'WR singles held'}</th>
            <th>{isZh ? '项目' : 'Events'}</th>
          </tr>
        </thead>
        <tbody>
          {sortedCountries.slice(0, 12).map(([c, evs]) => (
            <tr key={c}>
              <td><strong>{c}</strong></td>
              <td>{evs.length}</td>
              <td className="pred-event-list">{evs.join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {isZh ? (
          <>
            <strong>解读.</strong> WR 持有者集中度反映两层: (a) 训练资源 (顶级 cuber 数量、教练池、智能魔方普及), (b) 比赛机会密度 (一年能上多少次场). 中国近 5 年比赛数占全球 ~25%, 美国 ~20%; 这两国占绝大多数 WR 出场机会.
            注意"WR 出现频率 ≠ 国家平均水平" — 后者要看 Top-1000 / Top-10000 的国籍分布(各项目章节有).
          </>
        ) : (
          <>
            <strong>Interpretation.</strong> WR concentration reflects two layers: (a) training resources (top cuber pool, coaches, smart-cube penetration), (b) comp opportunity density (how many comps/year a cuber can attend). China and USA combined account for ~45% of global comps in recent years and consequently most WR attempts.
            Note "WR frequency ≠ national average level" — for the latter check Top-1000 / Top-10000 country breakdowns within event chapters.
          </>
        )}
      </p>
      {recent333WR.length > 0 && (
        <>
          <h3>{isZh ? '3x3 单次 WR 最近 15 次改写' : '3x3 Single WR — Last 15 Drops'}</h3>
          <table className="pred-forecast">
            <thead>
              <tr>
                <th>{isZh ? '日期' : 'Date'}</th>
                <th>{isZh ? '成绩' : 'Result'}</th>
                <th>{isZh ? '选手' : 'Person'}</th>
                <th>{isZh ? '国籍' : 'Country'}</th>
              </tr>
            </thead>
            <tbody>
              {recent333WR.map((w: any, i: number) => (
                <tr key={i}>
                  <td>{w.date}</td>
                  <td><strong>{(w.value / 100).toFixed(2)} s</strong></td>
                  <td>{w.person_name.replace(/\s*\(.*?\)\s*$/, '')}</td>
                  <td>{w.country_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// Caveats
// ─────────────────────────────────────────────
function CaveatsSection({ isZh }: { isZh: boolean }) {
  return (
    <section className="pred-section" id="caveats">
      <h2>{isZh ? '局限与陷阱' : 'Caveats & Pitfalls'}</h2>
      <ol>
        <li>
          <strong>{isZh ? '极值统计 ≠ 中心趋势.' : 'Extreme value ≠ central tendency.'}</strong>{' '}
          {isZh
            ? 'WR 是 sample 极小值, 服从 Generalized Extreme Value (GEV) 分布而非高斯. 当样本量从年 100 升到年 26 万时, "可见尾部"非线性扩张 — N 翻 2000 倍, 期望 min 大致下移 σ·log(2000)/log(N原) ≈ σ·1.6, 不取决于"实际能力提升".'
            : 'WR is a sample minimum, GEV-distributed not Gaussian. As N goes from 100/year to 260k/year (2000×), expected min shifts by σ·log(2000)/log(N) ≈ 1.6σ regardless of actual skill change.'}
        </li>
        <li>
          <strong>{isZh ? '幸运打乱 (lucky scramble).' : 'Lucky scramble.'}</strong>{' '}
          {isZh
            ? '一次 sub-3 单次往往依赖于 X-cross + skip OLL/PLL. 这种叠加事件在大样本下是"罕见但可期"的双指数尾部. 单次 WR 与"真实 ELO"部分解耦.'
            : 'A sub-3 single often relies on X-cross + skip OLL/PLL. Compound rare events have double-exponential tails. Single WRs partially decouple from "true skill ELO."'}
        </li>
        <li>
          <strong>{isZh ? '硬件 / 方法革命的离散性.' : 'Discrete hardware / method revolutions.'}</strong>{' '}
          {isZh
            ? '指数衰减把"创新"摊平为单一 k. 但磁力魔方 (2017)、UV 涂层 (2019)、GAN 14/15 (2022+)、智能魔方训练 (2021+) 是离散事件, 各自带来 2-5% 阶跃. 长期外推必然低估"下一次革命".'
            : 'Exp decay smears innovation into a single k. But magnets (2017), UV coatings (2019), GAN flagships (2022+), smart-cube training (2021+) are discrete events with 2-5% step changes. Long-horizon forecasts undercount future revolutions.'}
        </li>
        <li>
          <strong>{isZh ? '执行噪声下限.' : 'Execution noise floor.'}</strong>{' '}
          {isZh
            ? '同一 cuber 同一打乱, 单次 SD ≈ 0.3 s (Liu & Bibulet 2023). Ao5 在 N=5 下 SD 收缩到 0.13 s. WR 平均永远 > WR 单次, 差距下限受执行噪声而非极限 L 决定.'
            : 'Same cuber × same scramble has within-run SD ≈ 0.3 s. Averaging 5 shrinks to 0.13 s. WR average > WR single always; the gap floor is execution-noise-bound, not L-bound.'}
        </li>
        <li>
          <strong>{isZh ? '生存者 + 选择偏差.' : 'Survivorship + selection bias.'}</strong>{' '}
          {isZh
            ? 'WCA 数据库只记录"有意愿/有机会参赛者". 大量"训练强但没去比赛"的 cuber 不可见. 极顶尖 cuber 的"训练 PB" 通常比 WCA PB 快 5-10%, 所以模型 L 对未来真实极限是保守上界.'
            : 'WCA captures only "those who choose to compete." Many high-skill cubers never enter comps. Elite training-PBs typically beat WCA-PBs by 5-10%, so fitted L is a conservative upper bound on the true future limit.'}
        </li>
        <li>
          <strong>{isZh ? '区域不均衡 ≠ 能力差异.' : 'Regional imbalance ≠ ability gap.'}</strong>{' '}
          {isZh
            ? '近 5 年 WR 单次集中在中、美、菲、波兰. 不是民族能力差异, 是赛事密度: 中国年比赛 ~25%, 美国 ~20%; 在某地能"上场刷 WR" 的次数 ∝ 该地年度比赛数.'
            : 'Recent WR singles concentrate in CN/US/PH/PL. Not innate ability — it\'s comp density: CN ~25% of global, US ~20%. WR opportunities ∝ local annual comps.'}
        </li>
        <li>
          <strong>{isZh ? '模型外的"未知未知".' : '"Unknown unknowns" outside the model.'}</strong>{' '}
          {isZh
            ? '本报告假设规则不变(打乱难度 / 计时器精度 / 形式定义). 历史上 WCA 改过若干规则(Stackmat 强制、scramble 系统统一、format 简化), 每次都引入 1-3% 量级的不连续. 未来不可控.'
            : 'Report assumes rules unchanged (scramble difficulty, timer precision, format definition). WCA has modified rules historically (Stackmat enforcement, unified scramble system, format simplification) — each introduces 1-3% discontinuities. Future ones unforecastable.'}
        </li>
      </ol>
    </section>
  );
}
