/**
 * /prediction — WCA 全项目速拧极限预测综合报告
 *
 * 数据源: 本地 wca_developer_database MySQL → stats/prediction/all_events.json
 * 建模:  Ensemble (exp+floor / Gompertz / 幂律 / 纯指数) × 物理下界 T_phys × GEV 极值理论
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
import { EVENTS, formatVal, toDisplay, toDisplayAvg } from './events';
import { THEORETICAL_LIMITS } from './theoretical_limits';
import EventSection from './EventSection';
import ThemeToggle from '../../components/ThemeToggle';
import { HeadlineBar } from './components/HeadlineBar';
import { MicroBar } from './components/MicroBar';
import { TheoryDeepDive } from './components/TheoryDeepDive';
import { MethodCompareSection } from './components/MethodCompare';
import { CrossSportSection } from './components/CrossSport';
import { MilestoneTableSection } from './components/MilestoneTable';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './prediction.css';

/** 取最后一行 (物理下界单次) 的 T 值 — 优先用显式 t_phys_single, 其次 decomp 末行计算 */
function physicalFloorSingle(eventId: string): number | null {
  const lim = THEORETICAL_LIMITS[eventId];
  if (!lim) return null;
  if (lim.t_phys_single !== undefined) return lim.t_phys_single;
  if (lim.decomp.length === 0) return null;
  const last = lim.decomp[lim.decomp.length - 1];
  return last.T ?? last.M / last.TPS + last.R;
}
function physicalFloorAvg(eventId: string): number | null {
  return THEORETICAL_LIMITS[eventId]?.t_phys_avg ?? null;
}

interface AllEvents {
  generated_at: string;
  notes: string;
  events: Record<string, any>;
}

const SECTIONS = [
  { id: 'tldr',          labelZh: '一句话结论',  labelEn: 'Top Line' },
  { id: 'headline',      labelZh: '撞墙排行',    labelEn: 'Closest to Wall' },
  { id: 'overview',      labelZh: '跨项目总览',  labelEn: 'Cross-Event Grid' },
  { id: 'theory-deep',   labelZh: '数学硬墙',    labelEn: 'Math Walls' },
  { id: 'methods-compare', labelZh: '方法对比',  labelEn: 'Method Comparison' },
  { id: 'scaling',       labelZh: '阶数尺度律',  labelEn: 'Cube-Size Scaling' },
  { id: 'theory',        labelZh: '生物力学极限', labelEn: 'Biomech Floor' },
  { id: 'cross-sport',   labelZh: '跨运动锚定',  labelEn: 'Cross-Sport' },
  { id: 'milestones',    labelZh: '里程碑预测',  labelEn: 'Forecasts 2030/40/50' },
  { id: 'regional',      labelZh: '区域格局',    labelEn: 'Regional' },
  { id: 'methods',       labelZh: '方法论',      labelEn: 'Methodology' },
  { id: 'caveats',       labelZh: '局限与陷阱',  labelEn: 'Caveats' },
];

export default function PredictionPage() {
  const { i18n } = useTranslation();
  const lang: 'en' | 'zh' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const isZh = lang === 'zh';
  useDocumentTitle('预测', 'Prediction');

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

  useEffect(() => {
    if (!data) return;
    const openByHash = () => {
      const id = window.location.hash.replace(/^#/, '');
      if (!id.startsWith('event-')) return;
      const el = document.getElementById(id);
      const det = el?.querySelector('details.pred-event-details') as HTMLDetailsElement | null;
      if (det && !det.open) {
        det.open = true;
        requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    };
    openByHash();
    window.addEventListener('hashchange', openByHash);
    return () => window.removeEventListener('hashchange', openByHash);
  }, [data]);

  if (err) return <div className="pred-loading">Failed to load: {err}</div>;
  if (!data) return <div className="pred-loading">Loading {isZh ? '加载中…' : '…'}</div>;

  const toggleLang = () => {
    const n = isZh ? 'en' : 'zh';
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  };

  const currentYear = new Date().getFullYear();
  const eventSummaries = EVENTS.map((ev) => {
    const ed = data.events[ev.id];
    if (!ed) return null;
    const eligible = ed.wr_by_year.filter((d: any) => d.year >= 2003 && d.year < currentYear && d.wr_single !== null);
    let cur: number | null = null;
    const fitData: DataPoint[] = eligible.map((d: any) => {
      const v = toDisplay(d.wr_single, ev.scale)!;
      if (cur === null || v < cur) cur = v;
      return { year: d.year, time: cur! };
    });
    const Lmax = ev.scale === 'moves' ? 50 : 1000;
    const Lstep = ev.scale === 'moves' ? 0.5 : 0.1;
    const fit = fitExpFloor(fitData, 0, Lmax, Lstep);
    const lastWR = ed.wr_single_progression.at(-1);
    const lim = THEORETICAL_LIMITS[ev.id];
    // 优先使用 theoretical_limits 里 current_wr_single_value 覆盖, 否则用 dump 末尾
    const lastWRval = lim?.current_wr_single_value
      ?? (lastWR ? toDisplay(lastWR.value, ev.scale) : null);
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
  // TL;DR Compute key headline numbers
  // ─────────────────────────────────────────────
  const closenessPcts = eventSummaries
    .map((s) => {
      const tPhys = physicalFloorSingle(s.ev.id);
      if (tPhys === null || s.lastWRval === null) return null;
      // 物理 floor 估计偶尔会高于当前 WR (估计偏保守) — 视为已撞墙, cap 100%
      const raw = tPhys / s.lastWRval * 100;
      return { id: s.ev.id, name: isZh ? s.ev.name_zh : s.ev.name_en, pct: Math.min(100, raw), pctRaw: raw };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const closestCount = closenessPcts.filter((p) => p.pct >= 80).length;
  const totalEvents = closenessPcts.length;
  const farFromWall = [...closenessPcts].sort((a, b) => a.pct - b.pct).slice(0, 3);
  const closeToWall = [...closenessPcts].sort((a, b) => b.pct - a.pct).slice(0, 3);

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
          {isZh ? 'EN' : '中文'}
        </button>
        <ThemeToggle />
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
            <div className="pred-toc-group-title">{isZh ? '子页面' : 'Sub-pages'}</div>
            <Link
              to="/wca/prediction/333"
              className="pred-toc-item pred-toc-subpage"
              onClick={() => setTocOpen(false)}
            >
              {isZh ? '三阶深度章节' : '3x3 Deep Dive'}
            </Link>
            <Link
              to="/wca/prediction/lucky"
              className="pred-toc-item pred-toc-subpage"
              onClick={() => setTocOpen(false)}
            >
              {isZh ? '运气预测 (累积概率)' : 'Luck Forecast (cumulative P)'}
            </Link>
          </div>

          <div className="pred-toc-group">
            <div className="pred-toc-group-title">{isZh ? '全局分析' : 'Global Analysis'}</div>
            {SECTIONS.slice(1, 10).map((s) => (
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
            {EVENTS.map((ev, i) => {
              const pctRaw = closenessPcts.find((p) => p.id === ev.id)?.pctRaw ?? null;
              const pct = pctRaw === null ? null : Math.min(100, pctRaw);
              const lvl = pct === null ? '' : pct >= 95 ? 'hot' : pct >= 80 ? 'warm' : pct >= 60 ? 'mid' : 'cool';
              return (
                <a
                  key={ev.id}
                  href={`#event-${ev.id}`}
                  className={`pred-toc-item pred-toc-event${activeId === `event-${ev.id}` ? ' is-active' : ''}`}
                  onClick={() => setTocOpen(false)}
                >
                  <span className="pred-toc-event-num">{(i + 1).toString().padStart(2, '0')}</span>
                  <span className="pred-toc-event-name">{isZh ? ev.name_zh : ev.name_en}</span>
                  {pct !== null && (
                    <span className={`pred-toc-event-pill pred-pill-${lvl}`}>{Math.round(pct)}%</span>
                  )}
                </a>
              );
            })}
          </div>

          <div className="pred-toc-group">
            {SECTIONS.slice(10).map((s) => (
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
              ? `数据 ${data.generated_at.slice(0, 10)}  1982-2050  16 项  拟合 / 物理 / 极值理论三轨预测`
              : `Data ${data.generated_at.slice(0, 10)} · 1982-2050 · 16 events · curve / physics / extreme-value tri-track forecasts`}
          </p>

          {/* TL;DR — finding-first */}
          <section className="pred-tldr" id="tldr">
            <h2>{isZh ? '一句话结论' : 'Top Line'}</h2>
            <p className="pred-tldr-lede">
              {isZh ? (
                <>
                  速拧正在撞墙。<strong>16 个 WCA 项目里有 {closestCount} 个</strong> 当前 WR 已经压到物理下界 (M/TPS+R 步数法) 的 80% 以内 — 余地不到 1.25 倍。
                  3x3 单次 WR 在 2026 年首次跌破 3 秒 (Zajder 2.76),物理下界估计落在 <strong>~1.5 秒 (百年可达) 到 ~0.8 秒 (God's number 数学硬墙)</strong> 之间,还有 1.8 到 3.5 倍空间。
                </>
              ) : (
                <>
                  Speedcubing is hitting the wall. <strong>{closestCount} of 16 WCA events</strong> sit within 80 % of their physical floor (M/TPS+R first-principles) — about 1.25× compression remains for those.
                  Meanwhile the 3x3 single broke 3 s in 2026 (Zajder 2.76) and the physical floor estimate is <strong>~1.5 s (100-year reachable) to ~0.8 s (God's-number math wall)</strong> — still 1.8 to 3.5× of room.
                </>
              )}
            </p>
            <div className="pred-tldr-grid">
              <div className="pred-tldr-block">
                <div className="pred-tldr-label">{isZh ? '最贴近物理墙' : 'Closest to wall'}</div>
                <ol className="pred-tldr-list">
                  {closeToWall.map((p) => (
                    <li key={p.id}>
                      <a href={`#event-${p.id}`}>{p.name}</a>
                      <span className={`pred-tldr-pct ${p.pct >= 95 ? 'is-hot' : 'is-warm'}`}>{Math.round(p.pct)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pred-tldr-block">
                <div className="pred-tldr-label">{isZh ? '最远离物理墙' : 'Most headroom'}</div>
                <ol className="pred-tldr-list">
                  {farFromWall.map((p) => (
                    <li key={p.id}>
                      <a href={`#event-${p.id}`}>{p.name}</a>
                      <span className="pred-tldr-pct is-cool">{Math.round(p.pct)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pred-tldr-block">
                <div className="pred-tldr-label">{isZh ? '今天的「撞墙」快报' : "Today's headline drops"}</div>
                <ul className="pred-tldr-list">
                  <li><span>3x3 Single</span> <strong>2.76 s</strong></li>
                  <li><span>3x3 Ao5 ({isZh ? 'ZB' : 'ZB'})</span> <strong>3.71 s</strong></li>
                  <li><span>{isZh ? '马拉松首次 sub-2' : 'Marathon first sub-2'}</span> <strong>1:59:30</strong></li>
                </ul>
              </div>
            </div>
            <p className="pred-tldr-note">
              {isZh
                ? `${eventSummaries.reduce((s, x) => s + x.progressionCount, 0)} 次 WR 改写  /  ${totalEvents} 项独立建模  /  拟合, 物理, GEV 三层并列互相校验`
                : `${eventSummaries.reduce((s, x) => s + x.progressionCount, 0)} WR drops · ${totalEvents} events modeled independently · curve / physics / GEV tracks cross-checked.`}
            </p>
          </section>

          {/* Pointer to 3x3 deep-dive */}
          <Link to="/wca/prediction/333" className="pred-333-deepdive-cta">
            <div className="pred-333-cta-left">
              <div className="pred-333-cta-eyebrow">{isZh ? '深度章节' : 'Deep Dive'}</div>
              <div className="pred-333-cta-title">{isZh ? '三阶魔方: 终极极限预测' : '3x3: The Ultimate Limits Forecast'}</div>
              <div className="pred-333-cta-sub">
                {isZh
                  ? '24 节,涵盖历史, 方法, 数学, 生物力学, 顶级选手, 训练, 统计, 综合预测。'
                  : '24 sections — history, methods, math, biomech, top cubers, training, stats, ensemble forecast.'}
              </div>
            </div>
            <div className="pred-333-cta-arrow">→</div>
          </Link>

          {/* Pointer to lucky-scramble forecast */}
          <Link to="/wca/prediction/lucky" className="pred-333-deepdive-cta pred-lucky-cta">
            <div className="pred-333-cta-left">
              <div className="pred-333-cta-eyebrow">{isZh ? '运气预测  累积概率' : 'Luck Forecast · Cumulative Probability'}</div>
              <div className="pred-333-cta-title">{isZh ? '撞上最幸运打乱的概率: 何时高?' : 'When Does Cumulative P of Hitting the Luckiest Scramble Become High?'}</div>
              <div className="pred-333-cta-sub">
                {isZh
                  ? '三阶 4.3×10¹⁹ 个状态里只有 262 个能用 ≤2 步解开。单次概率 6×10⁻¹⁸ ≈ 零,但累积概率 P = 1−(1−p)^N 随 N 上涨。要 N₅₀ ≈ 1.2×10¹⁷ 次打乱才有 50% 命中,折算回去三阶 0.27 秒是 ~10¹⁴ 年级别的渐近线。'
                  : '3x3 has only 262 of 4.3×10^19 states solvable in ≤2 moves. Per-scramble p ≈ 6×10^-18, but cumulative P = 1−(1−p)^N grows with N. N₅₀ ≈ 1.2×10^17 → the 3x3 0.27 s asymptote is ~10^14 yr out.'}
              </div>
            </div>
            <div className="pred-333-cta-arrow">→</div>
          </Link>

          {/* Headline bar chart */}
          <section className="pred-section" id="headline">
            <h2>{isZh ? '撞墙排行: 一张图看完 16 项' : 'Wall-Closeness Ranking: All 16 Events at a Glance'}</h2>
            <p>
              {isZh
                ? '横轴 = 物理下界 / 当前 WR (%)。越靠右 = 剩余空间越小。这个指标比「WR 是多少」更能反映「项目成熟度」: ratio 99% 的项目即使数字看上去吓人 (比如 0.30 秒),也几乎不会再有大幅改写;ratio 50% 的项目即使数字慢 (Wang 3.08 → Zajder 2.76 → 还能 ~1.5),突破才刚开始。'
                : 'X-axis = physical floor / current WR (%). Further right = less headroom. This ratio captures "event maturity" better than the raw WR: a 99% event will see very few more WRs even if its absolute number looks impressive; a 50% event still has the steepest part of its curve ahead.'}
            </p>
            <HeadlineBar eventSummaries={eventSummaries} isZh={isZh} />
          </section>

          {/* 跨项目总览 */}
          <section className="pred-section" id="overview">
            <h2>{isZh ? '跨项目总览' : 'Cross-Event Overview'}</h2>
            <p>
              {isZh
                ? '每张卡片三行: 单次  /  平均  /  微型对比条。微型条横轴是「物理下界 → 当前 WR」的区间,三点分别是 T_phys (绿), 拟合 L (橙), 当前 WR (红)。红点离绿点越近,离物理墙就越近。'
                : 'Each card has three rows: single, average, microbar. The bar runs from T_phys (green, physical floor) through L (orange, curve-fit trajectory floor) to WR (red, current). Red close to green = wall is closing in.'}
            </p>
            <div className="pred-legend-strip">
              <span className="pred-leg-chip pred-leg-phys">{isZh ? '物理下界 T_phys' : 'Physical floor T_phys'}</span>
              <span className="pred-leg-chip pred-leg-fit">{isZh ? '拟合 L' : 'Curve-fit L'}</span>
              <span className="pred-leg-chip pred-leg-wr">{isZh ? '当前 WR' : 'Current WR'}</span>
            </div>
            <div className="pred-overview-grid">
              {eventSummaries.map((s) => {
                const tPhysSingle = physicalFloorSingle(s.ev.id);
                const tPhysAvg = physicalFloorAvg(s.ev.id);
                const lim = THEORETICAL_LIMITS[s.ev.id];
                let curAvg: number | null = lim?.current_wr_avg_value ?? null;
                if (curAvg === null) {
                  let cur: number | null = null;
                  for (const d of s.ed.wr_by_year as Array<{ year: number; wr_avg: number | null }>) {
                    if (d.wr_avg !== null && (cur === null || d.wr_avg < cur)) cur = d.wr_avg;
                  }
                  if (cur !== null) curAvg = toDisplayAvg(cur, s.ev);
                }
                const pct = (tPhysSingle !== null && s.lastWRval) ? tPhysSingle / s.lastWRval * 100 : null;
                const lvl = pct === null ? '' : pct >= 95 ? 'hot' : pct >= 80 ? 'warm' : pct >= 60 ? 'mid' : 'cool';
                return (
                  <a key={s.ev.id} href={`#event-${s.ev.id}`} className="pred-overview-card">
                    <div className="pred-ov-header">
                      <span className="pred-ov-name">{isZh ? s.ev.name_zh : s.ev.name_en}</span>
                      <span className="pred-ov-id">{s.ev.id}</span>
                      {pct !== null && (
                        <span className={`pred-ov-headpct pred-pill-${lvl}`}>{Math.round(pct)}%</span>
                      )}
                    </div>
                    <div className="pred-ov-line">
                      <div className="pred-ov-line-label">{isZh ? '单次' : 'Single'}</div>
                      <div className="pred-ov-line-nums">
                        <span className="pred-ov-wr">{s.lastWRval !== null ? formatVal(s.lastWRval, s.ev.scale) : '–'}</span>
                        <span className="pred-ov-pair">
                          <span className="pred-ov-fit">L {s.fit ? formatVal(s.fit.L, s.ev.scale) : '–'}</span>
                          <span className="pred-ov-phys">{tPhysSingle !== null ? formatVal(tPhysSingle, s.ev.scale) : '–'}</span>
                        </span>
                      </div>
                      <MicroBar tPhys={tPhysSingle} fitL={s.fit?.L ?? null} wr={s.lastWRval} event={s.ev} kind="single" />
                    </div>
                    {s.ev.avgFormat !== 'none' && (
                      <div className="pred-ov-line">
                        <div className="pred-ov-line-label">{s.ev.avgFormat}</div>
                        <div className="pred-ov-line-nums">
                          <span className="pred-ov-wr">{curAvg !== null ? formatVal(curAvg, s.ev, 'average') : '–'}</span>
                          <span className="pred-ov-pair">
                            <span className="pred-ov-phys">{tPhysAvg !== null ? formatVal(tPhysAvg, s.ev, 'average') : '–'}</span>
                          </span>
                        </div>
                        {tPhysAvg !== null && curAvg !== null && (
                          <MicroBar tPhys={tPhysAvg} fitL={null} wr={curAvg} event={s.ev} kind="average" />
                        )}
                      </div>
                    )}
                    <div className="pred-ov-foot">
                      <span>{s.progressionCount} WR{isZh ? ' 改写' : ' drops'}</span>
                      <span className="pred-ov-foot-sep"> </span>
                      <span>{s.cumCubers.toLocaleString()} {isZh ? '人' : 'cubers'}</span>
                      {lim?.current_wr_avg_holder && (
                        <>
                          <span className="pred-ov-foot-sep"> </span>
                          <span className="pred-ov-foot-holder">{lim.current_wr_avg_holder.split('—')[0].trim()}</span>
                        </>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* 数学硬墙 deep dive */}
          <TheoryDeepDive isZh={isZh} />

          {/* 方法对比 */}
          <MethodCompareSection isZh={isZh} />

          {/* 阶数尺度律 (旧 ScalingSection, 给 cube-family) */}
          <ScalingSection eventSummaries={eventSummaries} isZh={isZh} />

          {/* 生物力学极限 */}
          <TheoreticalSection isZh={isZh} />

          {/* 跨运动 */}
          <CrossSportSection isZh={isZh} />

          {/* 里程碑预测 */}
          <MilestoneTableSection isZh={isZh} />

          {/* 区域格局 */}
          <RegionalSection eventSummaries={eventSummaries} isZh={isZh} />

          {/* 分项目章节 */}
          {EVENTS.map((ev, i) => {
            const ed = data.events[ev.id];
            if (!ed) return null;
            return <EventSection key={ev.id} event={ev} data={ed} isZh={isZh} chapterNum={i + 1} chapterTotal={EVENTS.length} />;
          })}

          {/* 方法论 */}
          <section className="pred-section pred-method" id="methods">
            <h2>{isZh ? '方法论' : 'Methodology'}</h2>
            <ol>
              <li>
                <strong>{isZh ? '数据源' : 'Source'}{isZh ? '。' : '.'}</strong>{' '}
                {isZh
                  ? `WCA 全量 results dump,装在本机 MySQL 8 (wca_developer_database 库)。涵盖 1982 至 ${new Date().getFullYear()},全部 16 个项目,共 170 万+ 条 3x3 单次成绩 (其他项目数据规模见各章)。`
                  : `Full WCA results dump in local MySQL 8 (wca_developer_database db). Covers 1982 to ${new Date().getFullYear()}, all 16 events analyzed, 1.7M+ 333 solves (others vary).`}
              </li>
              <li>
                <strong>{isZh ? '过滤' : 'Filter'}{isZh ? '。' : '.'}</strong>{' '}
                <code>best &gt; 0</code> {isZh ? '排除 DNF (-1) 与 DNS (-2)' : 'excludes DNF (-1) and DNS (-2)'}; <code>average &gt; 0</code> {isZh ? '同上' : 'same'}{isZh ? '。' : '.'} 333mbf {isZh ? '编码值无法直接比较,单独处理。' : 'uses encoded value, treated separately.'}
              </li>
              <li>
                <strong>{isZh ? '年化' : 'Yearly bucketing'}{isZh ? '。' : '.'}</strong>{' '}
                {isZh
                  ? '按 competitions.start_date 的年份归类。当前不完整年份会从拟合数据中自动剔除。'
                  : 'Grouped by competitions.start_date year. Current year (incomplete) excluded from fits.'}
              </li>
              <li>
                <strong>{isZh ? '集成模型' : 'Ensemble'}{isZh ? '。' : '.'}</strong>{' '}
                {isZh
                  ? '四个模型并行拟合: 主模型是「指数+下限」T(t)=L+A·exp(-k(t-t₀)),用 Gompertz, 幂律, 纯指数三个作对比。按 R² 加权集成,给出 5/25/50 年外推。L 用网格搜索 (步长 0.05 秒 / 0.5 步),每个候选 L 用 log(T-L) 上的 OLS 解析解出 (A, k);物理约束 L < 所有观测值。'
                  : 'Four models fit in parallel: exp+floor T(t)=L+A·exp(-k(t-t₀)) primary, Gompertz / power / pure-exp as comparison. R²-weighted ensemble drives 5/25/50-year forecasts. L grid-search (step 0.05 s / 0.5 moves); per candidate L: analytic OLS on log(T-L) for (A, k). Physical constraint: L < all observed.'}
              </li>
              <li>
                <strong>{isZh ? '物理下界 T_phys' : 'Physical floor T_phys'}{isZh ? '。' : '.'}</strong>{' '}
                {isZh
                  ? '步数法 T = M/TPS + R,其中 M 是有公开复盘的平均 STM,TPS 是顶级选手的持续敲击率,R 是识别 + 切换的余量。每个项目独立填表,见各章节「已验证复盘」。'
                  : 'Step-count T = M/TPS + R, with M = verified reconstruction average STM, TPS = top-cuber sustained rate, R = recognition + switching residual. Filled per event, see each chapter\'s "Verified reconstructions".'}
              </li>
              <li>
                <strong>{isZh ? '极值理论 GEV' : 'Extreme-value GEV'}{isZh ? '。' : '.'}</strong>{' '}
                {isZh
                  ? '把 WR 单次视为 N 次独立尝试的样本最小值,用 Gumbel 反算 E[min] ≈ μ − σ·√(2 ln N − ln ln N − ln 4π)。这条结果跟拟合, 物理下界三方互校,不依赖单一来源。'
                  : 'WR single treated as N-sample minimum, Gumbel back-solve E[min] ≈ μ − σ·√(2 ln N − ln ln N − ln 4π). Cross-checked against fit and physical floor — no single-source answer.'}
              </li>
              <li>
                <strong>{isZh ? '复现' : 'Reproduce'}{isZh ? '。' : '.'}</strong>{' '}
                <code>node .tmp/extract_all_events.mjs</code> → <code>stats/prediction/all_events.json</code>
              </li>
            </ol>
          </section>

          {/* Caveats */}
          <CaveatsSection isZh={isZh} />

          <footer className="pred-footer">
            <div>
              {isZh ? `数据生成: ${data.generated_at}  复现见方法论 §7 末尾`
                    : `Data: ${data.generated_at} · Reproduce: see Methodology §7`}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 阶数尺度律 (cube family time-vs-N, 旧版保留)
// ─────────────────────────────────────────────
function ScalingSection({ eventSummaries, isZh }: { eventSummaries: any[]; isZh: boolean }) {
  const NCUBE = ['222', '333', '444', '555', '666', '777'];
  const points = NCUBE.map((id, i) => {
    const s = eventSummaries.find((x) => x.ev.id === id);
    return { N: i + 2, time: s?.lastWRval ?? null, L: s?.fit?.L ?? null, ev: s?.ev };
  }).filter((p) => p.time !== null);

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
      name: isZh ? '当前 WR (实测时间)' : 'Current WR (time)',
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
      <h2>{isZh ? 'NxN 阶数尺度律: 时间随 N' : 'NxN Scaling: Time vs Cube Size'}</h2>
      <p>
        {isZh ? (
          <>
            前一节「数学硬墙」已经把「步数 ~ N^1.8」(Demaine 渐近) 和「时间 ~ N^2.5」分开。这里聚焦时间这一侧 — 实测 222 → 777 当前 WR 走出的曲线。
            {scalingFit && <> 时间这一维 b ≈ <strong>{scalingFit.b.toFixed(2)}</strong>,R² = {scalingFit.r2.toFixed(3)}。也就是 N 翻一倍,时间增到约 <strong>{(2 ** scalingFit.b).toFixed(1)} 倍</strong>。</>}
            步数侧 (n^1.8) 和时间侧 (n^{scalingFit?.b.toFixed(2) ?? '?'}) 之间的差距,就是「大魔方 TPS 明显下降」的代价。
          </>
        ) : (
          <>
            The previous "Math Walls" section separated step-count scaling (~N^1.8, Demaine asymptotic) from time scaling. Here we focus on the time side — empirical curve from 222→777 current WRs.
            {scalingFit && <> Time exponent b ≈ <strong>{scalingFit.b.toFixed(2)}</strong>, R² = {scalingFit.r2.toFixed(3)}. Doubling N gives <strong>{(2 ** scalingFit.b).toFixed(1)}×</strong> the time.</>}
            The gap between the move-count exponent (~1.8) and the time exponent ({scalingFit?.b.toFixed(2) ?? '?'}) is the "big cubes have lower sustained TPS" cost.
          </>
        )}
      </p>
      <LineChart
        series={wrSeries}
        yLabel={isZh ? '时间 (秒)' : 'Time (s)'}
        xLabel="N"
        xFormat={(v) => v.toString()}
      />
    </section>
  );
}

// ─────────────────────────────────────────────
// 生物力学极限 (3x3 核心)
// ─────────────────────────────────────────────
function TheoreticalSection({ isZh }: { isZh: boolean }) {
  return (
    <section className="pred-section" id="theory">
      <h2>{isZh ? '生物力学极限 (TPS + 识别 + 切换)' : 'Biomech Floor (TPS + Recognition + Switching)'}</h2>
      <p>
        {isZh
          ? '「解长度 × TPS + 识别」的第一性原理分解,给出速拧时间下界。三大输入分别有不同来源 — 解长度受 God\'s number 约束,TPS 受手指 / 击鼓生物力学约束,识别 + 切换是高阶认知噪声。'
          : 'First-principles "STM × TPS + recognition" decomposition gives the time floor. Three inputs from different sources — STM bounded by God\'s number, TPS bounded by finger/drum biomech, recognition+switching is higher-order cognitive noise.'}
      </p>
      <table className="pred-limits">
        <thead>
          <tr>
            <th>{isZh ? '约束' : 'Constraint'}</th>
            <th>{isZh ? '乐观' : 'Optimistic'}</th>
            <th>{isZh ? '现实' : 'Realistic'}</th>
            <th>{isZh ? '保守' : 'Conservative'}</th>
            <th>{isZh ? '依据' : 'Source'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{isZh ? '解长度 (3x3, STM)' : 'Solution length (3x3, STM)'}</td>
            <td>24</td><td>49</td><td>55</td>
            <td>{isZh ? '24 = ZB+lucky / 49 = Geng 平均 / 55 = vanilla CFOP' : '24 = ZB+lucky / 49 = Geng avg / 55 = vanilla CFOP'}</td>
          </tr>
          <tr>
            <td>{isZh ? '持续 TPS (单选手, ≥3 s)' : 'Sustained TPS (single cuber, ≥3 s)'}</td>
            <td>17</td><td>14</td><td>11</td>
            <td>{isZh ? '14.6 = Wang 3.08 实测, 17 = 100 年外推上界' : 'Wang 3.08 verified 14.6; 17 = 100-year extrapolation'}</td>
          </tr>
          <tr>
            <td>{isZh ? '识别 + 切换损耗' : 'Recog + switching latency'}</td>
            <td>0.05 s</td><td>0.1 s</td><td>0.3 s</td>
            <td>{isZh ? '已含 StackMat 触发反应 (~50 ms)' : 'incl. StackMat trigger reaction (~50 ms)'}</td>
          </tr>
          <tr className="pred-limits-result">
            <td><strong>{isZh ? '推导极限' : 'Derived limit'}</strong></td>
            <td><strong>1.5 s</strong></td>
            <td><strong>3.6 s</strong></td>
            <td><strong>5.3 s</strong></td>
            <td>{isZh ? 'M/TPS + R' : 'M/TPS + R'}</td>
          </tr>
        </tbody>
      </table>
      <p>
        {isZh ? (
          <>
            <strong>「现实」3.6 秒已经被 Zajder 2.76 击穿</strong>,因为 Zajder 用 ZB 跑了 29 步,比「现实」列的 49 步省了 20 步。
            乐观 1.5 秒需要同时: 24 STM (近 God's STM 下界,极少打乱) + 17 TPS 持续 (王艺衡当前 14.6 的延展) + 0.05 秒识别 (接近物理反应时间)。
            <strong>数学硬墙 (God's number 18 HTM ≈ 16 STM + 22 Hz 双手击鼓 + StackMat 50 ms) 在 ~0.78 秒</strong>,这个数字 100 年内出现的概率接近零。
          </>
        ) : (
          <>
            <strong>The "realistic" 3.6 s has already been broken</strong> — Zajder 2.76 used ZB at 29 STM, saving 20 STM vs the realistic column's 49.
            Optimistic 1.5 s needs simultaneously: 24 STM (near God's-STM, vanishingly rare scramble) + 17 TPS sustained (an extension of Wang's verified 14.6) + 0.05 s recognition (physical reaction time).
            <strong>The math wall (God's number 18 HTM ≈ 16 STM + 22 Hz dual-hand drum + StackMat 50 ms) sits near 0.78 s</strong> — probability ≈ 0 within 100 years.
          </>
        )}
      </p>
      <p>
        {isZh ? (
          <>
            <strong>跨项目类比。</strong> STM × TPS × 切换 这个公式在每个项目都成立,但三个输入随魔方阶数, 单手, 盲拧任务显著不同:
          </>
        ) : (
          <>
            <strong>Cross-event analog.</strong> STM × TPS × latency extends to every event, but the three inputs vary by puzzle / mode:
          </>
        )}
      </p>
      <ul>
        <li>{isZh ? 'OH 单手: TPS 减半到 ~7-8,解法同 49 STM → 6.5 秒下界。当前 WR 5.66,已经贴到墙上。' : 'OH: TPS halves to ~7-8, same 49 STM → 6.5 s floor. Current WR 5.66 — at the wall.'}</li>
        <li>{isZh ? '4x4: ~80 STM (含 reduce + 3x3 + parity) × TPS 9 = 8.9 秒 + 1 秒切换 = 9.9 秒。当前 WR 15.18,还有 5 秒优化空间。' : '4x4: ~80 STM (reduce + 3x3 + parity) × TPS 9 = 8.9 s + 1 s switching = 9.9 s. Current WR 15.18 — 5 s headroom.'}</li>
        <li>{isZh ? 'BLD: 不受 TPS 限制,瓶颈在记忆速度。当前 3BLD WR ~11.67 秒 (Eggins 2026),极限可能 ~5 秒 (类比 Speed Cards 13 秒)。' : '3BLD: not TPS-limited, memo-limited. Current WR 11.67 s (Eggins 2026); plausible floor ~5 s (Speed Cards 13 s analog).'}</li>
        <li>{isZh ? "FMC: 信息论极限 = God's number 20 HTM (Rokicki 2010);现 WR 16 单次。67% 的打乱需要 18 HTM,仅 2.6% 是 16 — sub-15 几乎只能靠抽中 ≤ 15 HTM 那 0.5% 的稀有打乱。" : "FMC: info-theoretic floor = God's number 20 HTM (Rokicki 2010); current WR 16. 67% of scrambles need 18 HTM and only 2.6% are 16-HTM — sub-15 essentially needs landing on the ≤15-HTM 0.5%."}</li>
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────
// 区域格局
// ─────────────────────────────────────────────
function RegionalSection({ eventSummaries, isZh }: { eventSummaries: any[]; isZh: boolean }) {
  const countries: Record<string, string[]> = {};
  for (const s of eventSummaries) {
    const w = s.lastWR;
    if (!w) continue;
    const c = w.country_id;
    if (!countries[c]) countries[c] = [];
    countries[c].push(s.ev.id);
  }
  const sortedCountries = Object.entries(countries).sort((a, b) => b[1].length - a[1].length);

  const main333 = eventSummaries.find((s) => s.ev.id === '333');
  const recent333WR = main333?.ed.wr_single_progression.slice(-15) ?? [];

  return (
    <section className="pred-section" id="regional">
      <h2>{isZh ? '区域格局: 谁在改写纪录' : 'Regional Landscape: Who Sets Records'}</h2>
      <p>
        {isZh ? '当前 16 项 WR 单次持有者的国籍分布:' : 'National breakdown of current WR-single holders across 16 events:'}
      </p>
      <div className="pred-method-table-wrap">
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
                <td className="pred-num">{evs.length}</td>
                <td className="pred-event-list">{evs.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {isZh ? (
          <>
            <strong>解读。</strong> WR 持有者的集中度反映两层: (a) 训练资源 (顶级选手数量, 教练池, 智能魔方普及),(b) 比赛机会密度。
            中, 美两国占近 5 年全球比赛数的 ~45%,也占走了绝大多数 WR 出场机会。但「WR 频率 ≠ 国家平均水平」。
          </>
        ) : (
          <>
            <strong>Interpretation.</strong> WR concentration reflects two layers: (a) training resources, (b) comp opportunity density.
            China and USA combined account for ~45% of global comps in recent years and most WR attempts. "WR frequency ≠ national average level."
          </>
        )}
      </p>
      {recent333WR.length > 0 && (
        <>
          <h3>{isZh ? '3x3 单次 WR 最近 15 次改写' : '3x3 Single WR — Last 15 Drops'}</h3>
          <div className="pred-method-table-wrap">
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
                    <td className="pred-num"><strong>{(w.value / 100).toFixed(2)} s</strong></td>
                    <td>{w.person_name.replace(/\s*\(.*?\)\s*$/, '')}</td>
                    <td>{w.country_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <strong>{isZh ? '极值统计 ≠ 中心趋势。' : 'Extreme value ≠ central tendency.'}</strong>{' '}
          {isZh
            ? 'WR 是样本最小值,服从广义极值 (GEV) 分布,不是高斯。样本量从年 100 升到年 26 万 (2000 倍),期望最小值大致下移 σ·√(2 ln N),这部分跟「真实水平在不在涨」没关系。'
            : 'WR is a sample minimum, GEV-distributed not Gaussian. As N goes from 100/year to 260k/year (2000×), expected min shifts by σ·√(2 ln N) regardless of actual skill change.'}
        </li>
        <li>
          <strong>{isZh ? '幸运打乱 (lucky scramble)。' : 'Lucky scramble.'}</strong>{' '}
          {isZh
            ? '一次 sub-3 单次往往要靠 X-cross + OLL/PLL 跳过。这种复合事件在大样本里是「罕见但可期」的双指数尾;单次 WR 跟「真实 ELO」之间有相当一部分脱钩。'
            : 'A sub-3 single often relies on X-cross + skip OLL/PLL. Compound rare events have double-exponential tails. Single WRs partially decouple from "true skill ELO."'}
        </li>
        <li>
          <strong>{isZh ? '硬件 / 方法革命的离散性。' : 'Discrete hardware / method revolutions.'}</strong>{' '}
          {isZh
            ? '指数衰减把「创新」拍平成一个 k 值。但磁力魔方 (2017), UV 涂层 (2019), GAN 14/15/16 (2022+), 智能魔方训练 (2021+) 都是离散事件,各自给出 2-5% 的阶跃。长期外推会系统性低估「下一次革命」。'
            : 'Exp decay smears innovation into a single k. But magnets (2017), UV coatings (2019), GAN flagships (2022+), smart-cube training (2021+) are discrete events with 2-5% step changes. Long-horizon forecasts undercount future revolutions.'}
        </li>
        <li>
          <strong>{isZh ? '执行噪声下限。' : 'Execution noise floor.'}</strong>{' '}
          {isZh
            ? '同一选手 × 同一打乱,顶级选手的单次 SD ≈ 0.6-0.9 秒 (社区复盘数据,没有同行评审论文)。Ao5 在 N=5 下 SD 缩 √5 倍,仍有 ~0.3 秒。WR 平均始终大于 WR 单次,二者差距的下界由执行噪声决定,不由极限 L 决定。'
            : 'Same cuber × same scramble: top-cuber single SD ≈ 0.6–0.9 s (community-derived reconstruction logs; no peer-reviewed paper). Averaging 5 shrinks by √5 to ~0.3 s. WR average > WR single always; the gap floor is execution-noise-bound, not L-bound.'}
        </li>
        <li>
          <strong>{isZh ? '生存者 + 选择偏差。' : 'Survivorship + selection bias.'}</strong>{' '}
          {isZh
            ? 'WCA 数据库只统计「愿意 + 有机会参赛」的人。大量「训练水平很高但没去参赛」的人不在册。顶级选手的「训练 PB」通常比 WCA 上的 PB 快 5-10%,所以模型 L 对未来真实极限是一个保守的上界。'
            : 'WCA captures only "those who choose to compete." Many high-skill cubers never enter comps. Elite training-PBs typically beat WCA-PBs by 5-10%, so fitted L is a conservative upper bound on the true future limit.'}
        </li>
        <li>
          <strong>{isZh ? '区域不均衡 ≠ 能力差异。' : 'Regional imbalance ≠ ability gap.'}</strong>{' '}
          {isZh
            ? '近 5 年的 WR 单次集中在中, 美, 菲, 波兰。不是民族能力差异,是赛事密度: 中国年比赛 ~25%,美国 ~20%;在某地能「上场刷 WR」的次数 ∝ 该地年度比赛数。'
            : 'Recent WR singles concentrate in CN/US/PH/PL. Not innate ability — it\'s comp density: CN ~25% of global, US ~20%. WR opportunities ∝ local annual comps.'}
        </li>
        <li>
          <strong>{isZh ? 'WCA 计时规则演化。' : 'WCA timing rule evolution.'}</strong>{' '}
          {isZh
            ? '本报告默认规则不变。但 WCA 实际上从 2025-01-01 起引入了 11f1 帧分析规则 (针对 2024 王艺衡 0.78 Ao5 事件),之后所有 sub-1 二阶单次和 sub-0.9 平均都要走逐帧复核。未来若规则进一步收紧 (例如电子手压传感器),现有 2x2 WR 可能「软退坡」。'
            : 'Report assumes rules unchanged. In fact WCA enacted Regulation 11f1 on 2025-01-01 (frame-by-frame timer-pad review for WR-class results, responding to the 2024 Yiheng Wang 0.78 ao5 incident). Future tightening (electronic pad-pressure sensors) could "soft-rollback" current 2x2 WRs.'}
        </li>
        <li>
          <strong>{isZh ? '「未验证」引用风险。' : "Unverified citations."}</strong>{' '}
          {isZh
            ? '本报告里凡是引用了具体作者 + 年份的物理 / 心理学论文 (Aoki 2001 piano, Rokicki 2010 cube20, Demaine 2011 NxN, Hattori 2024 drum roll Guinness, Joyner 1991 marathon),都逐条联网校验过。任何未列入引用的「知识」以社区复盘为准。'
            : 'All cited specific-author papers (Aoki 2001 piano, Rokicki 2010 cube20, Demaine 2011 NxN, Hattori 2024 drum roll Guinness, Joyner 1991 marathon) are web-verified. Anything uncited is community reconstruction.'}
        </li>
      </ol>
    </section>
  );
}
