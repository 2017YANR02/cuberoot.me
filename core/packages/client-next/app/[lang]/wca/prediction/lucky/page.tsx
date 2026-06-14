/**
 * LuckyLimitPage — /wca/prediction/lucky
 *
 * 核心: 累积概率预测.
 *
 *   三阶 4.3×10^19 个状态. 其中只有 262 个 (1+18+243) 可在 ≤2 步解开.
 *   单次抽中这种 scramble 的概率: 6×10^-18 (一亿亿亿分之 6).
 *
 *   但 WCA 每年累积大量打乱 (含备用), 设第 Y 年的累积打乱总数为 N(Y).
 *   "至少撞上一次 d ≤ k 的状态" 的累积概率:
 *
 *       P(min ≤ k in N(Y)) = 1 - (1 - p_le_k)^N(Y)
 *
 *   - 单次 P 极小, 但 N 足够大时, P → 1.
 *   - 期望最幸运 d 随 N 单调下降 (E[min] = ∑ P(min > k)).
 *   - 抽中后 cuber 顶到 TPS_ceil 跑出的单次时间 = d / TPS_ceil + setup_s.
 *
 *   预测随年份的演化:
 *   - 2026 (N≈6.6M):  P(d≤2)≈4×10^-11, 几乎零; E[min]≈11.5 步.
 *   - 2100 (N≈590M):  P(d≤2)≈3.6×10^-9, 仍极低; E[min]≈9.5 步.
 *   - 10^15 yr (N≈3×10^34): P(d≤2)≈1; E[min]≈2 步 → 单次时间逼近 0.27 s.
 *
 *   关键洞察: "撞上最幸运 scramble 然后跑出超低单次" 不是某一年的事件,
 *   而是 *累积* N 大到足够撞上低 d 状态. 何时? 看这个页面.
 */
'use client';

import { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryState, parseAsInteger } from 'nuqs';
import { useTranslation } from 'react-i18next';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EVENTS, formatVal } from '../_components/events';
import {
  LUCKY_EVENTS,
  cumScrambles,
  expectedLuckyDepth,
  pHitLeqK,
  pSingleLeqK,
  nForProbability,
  sliderToYear,
  yearToSlider,
  formatYear,
  formatBigN,
  D_333,
} from '../_components/lucky_data';
import { LineChart, type Series } from '../_components/charts';
import '../_components/prediction.css';
import '../_components/lucky.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface Row {
  ev: typeof EVENTS[number];
  N: number;
  depth: number;
  depthClamped: number;
  timeCeil: number;
  timeNow: number;
  k_min_wca: number;
  tps_ceil: number;
  tps_now: number;
  setup_s: number;
  source: 'exact' | 'partial' | 'approx';
  notes_zh?: string;
  notes_en?: string;
}

/** 概率友好格式化 — 多区间不同精度 */
function formatProb(p: number, isZh: boolean): string {
  if (!isFinite(p) || p < 0) return '–';
  if (p >= 0.999) return isZh ? '~100%' : '~100%';
  if (p >= 0.01) return (p * 100).toFixed(p >= 0.1 ? 1 : 2) + '%';
  if (p === 0) return '0';
  if (p < 1e-15) {
    const exp = Math.floor(Math.log10(p));
    const mant = p / Math.pow(10, exp);
    return `${mant.toFixed(1)}×10^${exp}`;
  }
  if (p < 1e-3) {
    const exp = Math.floor(Math.log10(p));
    const mant = p / Math.pow(10, exp);
    return `${mant.toFixed(2)}×10^${exp}`;
  }
  return (p * 100).toFixed(3) + '%';
}

/** 友好年份显示 (用于 "需要 N=1.6e17 → 哪一年") */
function nToApproxYear(N: number): number {
  // 二分搜索 slider 值使 cumScrambles('333', sliderToYear(s)) ≈ N
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const y = sliderToYear(mid);
    const cum = cumScrambles('333', y);
    if (cum < N) lo = mid; else hi = mid;
  }
  return sliderToYear((lo + hi) / 2);
}

function LuckyLimitPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('幸运极限', 'Lucky Limit');

  // ?year= 走 nuqs(replace,不堆历史)。原 raw history.replaceState 已替换。
  const [yearParam, setYearParam] = useQueryState(
    'year',
    parseAsInteger.withOptions({ history: 'replace' }),
  );

  const initialYear = useMemo(() => {
    if (yearParam != null && yearParam >= 2003) return yearParam;
    return new Date().getFullYear();
    // 仅取首帧 URL 作种子(后续 URL 是 state 的派生视图)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sliderValue, setSliderValue] = useState<number>(() => yearToSlider(initialYear));
  const year = useMemo(() => sliderToYear(sliderValue), [sliderValue]);

  const setYearDirect = useCallback((y: number) => {
    setSliderValue(yearToSlider(y));
  }, []);

  useEffect(() => {
    void setYearParam(Math.round(year));
  }, [year, setYearParam]);

  const toggleLang = () => {
    const n = (i18n.language.startsWith('zh') ? 'en' : 'zh');
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  };

  // Per-event rows
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    for (const ev of EVENTS) {
      const lucky = LUCKY_EVENTS[ev.id];
      if (!lucky) continue;
      const N = cumScrambles(ev.id, year);
      const depth = expectedLuckyDepth(lucky.dist, N);
      const depthClamped = Math.max(depth, lucky.dist.k_min_wca);
      const timeCeil = depthClamped / lucky.tps_ceil + lucky.setup_s;
      const timeNow = depthClamped / lucky.tps_now + lucky.setup_s;
      list.push({
        ev, N, depth, depthClamped, timeCeil, timeNow,
        k_min_wca: lucky.dist.k_min_wca,
        tps_ceil: lucky.tps_ceil,
        tps_now: lucky.tps_now,
        setup_s: lucky.setup_s,
        source: lucky.dist.source,
        notes_zh: lucky.notes_zh,
        notes_en: lucky.notes_en
      });
    }
    return list;
  }, [year]);

  const row333 = rows.find((r) => r.ev.id === '333');

  // ─── 概率核心: 三阶在当前 N 下, P(撞上 d≤K) for K = {2, 5, 8, 10, 12, 15}
  const N333 = row333?.N ?? 0;
  const probTable_333 = useMemo(() => {
    const ks = [2, 5, 8, 10, 12, 15];
    return ks.map((k) => ({
      k,
      pSingle: pSingleLeqK(D_333, k),
      pCumulative: pHitLeqK(D_333, N333, k),
      nFor50: nForProbability(D_333, k, 0.5),
      yearFor50: nForProbability(D_333, k, 0.5) === Infinity
        ? Infinity
        : nToApproxYear(nForProbability(D_333, k, 0.5)),
    }));
  }, [N333]);

  // ─── P(撞上 d≤K) vs Year chart (多条线)
  const yearToLogX = (y: number) => Math.log10(Math.max(1, y - 2002));
  const logXToYear = (x: number) => 2002 + Math.pow(10, x);

  const probSeries: Series[] = useMemo(() => {
    const sampleS = Array.from({ length: 130 }, (_, i) => i / 129);
    const ks = [2, 5, 8, 10, 12, 15];
    const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#9333ea'];
    return ks.map((k, i): Series => {
      const data = sampleS.map((s) => {
        const y = sliderToYear(s);
        const N = cumScrambles('333', y);
        const p = pHitLeqK(D_333, N, k);
        return { x: yearToLogX(y), y: p };
      });
      return {
        name: `P(d ≤ ${k})`,
        color: colors[i],
        data,
      };
    });
  }, []);

  // ─── time vs year chart (跨项目)
  const timeSeries: Series[] = useMemo(() => {
    const sampleS = Array.from({ length: 130 }, (_, i) => i / 129);
    const eventIds = ['333', '222', '444', '555', 'pyram', 'skewb'];
    const colors: Record<string, string> = {
      '333': '#dc2626', '222': '#16a34a', '444': '#2563eb',
      '555': '#9333ea', 'pyram': '#ea580c', 'skewb': '#ca8a04',
    };
    return eventIds.map((id): Series => {
      const ev = EVENTS.find((e) => e.id === id);
      const lucky = LUCKY_EVENTS[id];
      if (!ev || !lucky) return { name: id, color: '#888', data: [] };
      const data = sampleS.map((s) => {
        const y = sliderToYear(s);
        const N = cumScrambles(id, y);
        const depth = Math.max(expectedLuckyDepth(lucky.dist, N), lucky.dist.k_min_wca);
        const time = depth / lucky.tps_ceil + lucky.setup_s;
        return { x: yearToLogX(y), y: time };
      });
      return {
        name: (isZh ? ev.name_zh : ev.name_en),
        color: colors[id] ?? '#888',
        data,
      };
    });
  }, [isZh]);

  return (
    <div className="pred-page">
      <header className="pred-header">
        <Link href="/wca/prediction" className="pred-back" aria-label="back">
          <ArrowLeft size={16} />
          <span>{tr({ zh: '极限预测', en: 'Prediction Hub'
        })}</span>
        </Link>
        <button className="pred-lang" onClick={toggleLang}>
          {(i18n.language.startsWith('zh') ? 'EN' : '中文')}
        </button>
      </header>

      <article className="pred-article" style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
        <h1 className="pred-title">
          {tr({ zh: '运气预测: 累积打乱越多, 撞上最幸运打乱的概率越高', en: 'Lucky-Scramble Forecast: Cumulative Probability of Hitting the Luckiest Scramble'
        })}
        </h1>
        <p className="pred-subtitle">
          {tr({ zh: '三阶 4.3×10¹⁹ 个状态,其中只有 262 个 (1+18+243) 能 ≤ 2 步解开。单次随机抽到这种打乱的概率 ≈ 6×10⁻¹⁸,几乎为零。但 WCA 每年积累大量打乱 (含备用),累积撞上一次的概率 P = 1−(1−p)^N 随 N 单调上升。拖年份 → 看 N(Y) → 看每个 d 阈值的累积概率 → 看期望最幸运成绩。', en: '3x3 has 4.3×10^19 states; only 262 (= 1+18+243) are solvable in ≤2 moves. A single random scramble has only ~6×10^-18 chance of landing there. But WCA accumulates many scrambles per year (incl. backups); cumulative-hit probability is P = 1 − (1 − p)^N, monotonically rising with N. Drag the year → see N(Y) → see cumulative probability per depth threshold → see the expected luckiest result.'
        })}
        </p>

        {/* Year slider */}
        <section className="lucky-slider-section">
          <div className="lucky-slider-row">
            <div className="lucky-year-display">
              <div className="lucky-year-label">{tr({ zh: '年份', en: 'Year' })}</div>
              <div className="lucky-year-value">{formatYear(year)}</div>
              <div className="lucky-year-N">
                {tr({ zh: '累积三阶打乱', en: 'Cumulative 3x3 scrambles'
                })}<br />
                N(Y) = <strong>{formatBigN(N333)}</strong> {tr({ zh: '个 (含备用)', en: '(incl. backups)'
                })}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              className="lucky-slider"
              aria-label={tr({ zh: '年份滑条', en: 'Year slider'
            })}
            />
          </div>
          <div className="lucky-slider-ticks">
            {[2003, 2026, 2050, 2100, 1e4, 1e7, 1e12, 1e15].map((y) => (
              <button
                key={y}
                className="lucky-slider-tick"
                onClick={() => setYearDirect(y)}
              >
                {formatYear(y)}
              </button>
            ))}
          </div>
          <p className="lucky-slider-note">
            {tr({ zh: '滑条左半段 (0-40%) 线性 2003-2100,右半段对数延伸到 10¹⁵ 年。', en: 'Left half (0–40%) is linear 2003–2100; right half is log up to 10^15 yr.'
            })}
          </p>
        </section>

        {/* 概率核心区 — 三阶 P(d ≤ K) 表 */}
        <section className="pred-section">
          <h2>{tr({ zh: '三阶: 当前累积概率', en: '3x3: Cumulative Hit Probability'
        })}</h2>
          <p>
            {(isZh ? (
                                    <>
                                      到 {formatYear(year)} 年,WCA 累积生成了 <strong>{formatBigN(N333)} 个三阶打乱</strong> (含备用)。
                                      「在这 N 个打乱里至少撞上一次 d ≤ K 状态」的累积概率 P = 1 − (1 − p)^N。
                                      K 越小 → 该状态在 4.3×10¹⁹ 中的占比 p 越小 → N 即使极大也需要继续累积。
                                    </>
                                  ) : (
                                    <>
                                      Through {formatYear(year)}, WCA has accumulated <strong>{formatBigN(N333)} 3x3 scrambles</strong> (incl. backups).
                                      Cumulative probability of at least one d ≤ K hit across these N is P = 1 − (1 − p)^N.
                                      Smaller K → smaller p in the 4.3×10^19 state space → need exponentially larger N.
                                    </>
                                  ))}
          </p>
          <div className="lucky-prob-table-wrap">
            <table className="lucky-prob-table">
              <thead>
                <tr>
                  <th>{tr({ zh: '深度 K (步)', en: 'Depth K (moves)' })}</th>
                  <th>{tr({ zh: '≤K 步可解状态数 (个)', en: '# states at d ≤ K'
                })}</th>
                  <th>{tr({ zh: '单次 p (无单位)', en: 'Single-scramble p'
                })}</th>
                  <th>{isZh ? `P(撞上 d≤K) @ N=${formatBigN(N333)}` : `P(d≤K hit) @ N=${formatBigN(N333)}`}</th>
                  <th>{tr({ zh: 'N₅₀ (个打乱)', en: 'N₅₀ (scrambles)'
                })}</th>
                  <th>{tr({ zh: 'N₅₀ 对应年份', en: 'Year reached'
                })}</th>
                  <th>{tr({ zh: '该 d 单次时间 (秒, TPS 17)', en: 'Time at d (s, TPS 17)'
                })}</th>
                </tr>
              </thead>
              <tbody>
                {probTable_333.map((r) => {
                  const numStates = Math.round(r.pSingle * D_333.total);
                  return (
                    <tr key={r.k}>
                      <td><strong>d ≤ {r.k}</strong></td>
                      <td>{formatBigN(numStates)}</td>
                      <td>{formatProb(r.pSingle, isZh)}</td>
                      <td className={r.pCumulative >= 0.5 ? 'lucky-prob-high' : r.pCumulative >= 0.01 ? 'lucky-prob-mid' : 'lucky-prob-low'}>
                        {formatProb(r.pCumulative, isZh)}
                      </td>
                      <td>{formatBigN(r.nFor50)}</td>
                      <td>{r.yearFor50 === Infinity ? '–' : formatYear(r.yearFor50)}</td>
                      <td>{(Math.max(r.k, D_333.k_min_wca) / 17 + 0.15).toFixed(2)} s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="lucky-prob-caption">
            {(isZh ? (
                                    <>
                                      <strong>怎么读:</strong> 比如表中 d ≤ 2 这一行 — 单次概率 6×10⁻¹⁸ (4.3×10¹⁹ 个状态里只有 262 个)。
                                      需要累积到 N₅₀ ≈ 1.2×10¹⁷ 次打乱才能有 50% 概率撞上一次,
                                      对应年份约 10¹⁴ 左右 (WCA 比赛累积 30000 场 / 年 × 250 个打乱 / 场 ≈ 7.5×10⁶ / 年)。
                                      所以「三阶 2 步运气解」不是某一年能见到的事件,而是「累积到无穷年」的渐近。
                                      现实里 2026 年的期望最幸运 d ≈ 11.5 步,分布集中在 d=11-12 (P 约 40%)。
                                    </>
                                  ) : (
                                    <>
                                      <strong>How to read:</strong> e.g. d ≤ 2 row — single-scramble prob 6×10^-18 (262 of 4.3×10^19).
                                      Need N₅₀ ≈ 1.2×10^17 to have 50% chance of one such hit; that's ~10^14 yr away at WCA's 7.5M scrambles/year cap.
                                      That is why "3x3 2-move lucky solve" is not a near-future event but an asymptotic limit.
                                      Today the expected luckiest scramble is d ≈ 11.5 with P(d≤12) ≈ 99.9%.
                                    </>
                                  ))}
          </p>
        </section>

        {/* Headline for 3x3 — 当前预测 */}
        {row333 && (
          <section className="lucky-headline">
            <div className="lucky-headline-left">
              <div className="lucky-headline-eyebrow">
                {(isZh ? `三阶 · ${formatYear(year)} 运气预测` : `3x3 · ${formatYear(year)} luck forecast`)}
              </div>
              <div className="lucky-headline-time">
                {formatVal(row333.timeCeil, row333.ev.scale)}
              </div>
              <div className="lucky-headline-sub">
                {isZh
                  ? `E[min] = ${row333.depthClamped.toFixed(2)} 步 / 17 TPS + 0.15 s`
                  : `E[min] = ${row333.depthClamped.toFixed(2)} moves / 17 TPS + 0.15 s`}
              </div>
            </div>
            <div className="lucky-headline-right">
              <Stat
                label={tr({ zh: '累积打乱数 (个)', en: 'Cumulative scrambles'
                })}
                value={formatBigN(row333.N)}
                hint={(isZh ? `2003-${Math.round(year)}, 含备用` : `2003–${Math.round(year)} · incl. backups`)}
              />
              <Stat
                label={tr({ zh: '期望最幸运 d', en: 'Expected min depth'
                })}
                value={row333.depthClamped.toFixed(2) + (tr({ zh: ' 步', en: ' moves' }))}
                hint={isZh ? `WCA 接受 ≥ ${row333.k_min_wca} 步` : `WCA accepts ≥${row333.k_min_wca} moves`}
              />
              <Stat
                label={tr({ zh: 'TPS 14.6 (现实选手)', en: 'TPS 14.6 (real cuber)'
                })}
                value={formatVal(row333.timeNow, row333.ev.scale)}
                hint={tr({ zh: 'TPS 顶到王艺衡持续值', en: 'TPS at Wang sustained level'
                })}
              />
            </div>
          </section>
        )}

        {/* 概率随年份演化 — chart */}
        <section className="pred-section">
          <h2>{tr({ zh: 'P(撞上 d ≤ K) 随年份', en: 'Cumulative Hit Probability vs Year'
        })}</h2>
          <p>
            {tr({ zh: '每条线对应一个 d 阈值。横轴是 log 年份 (覆盖 2003 → 10¹⁵ 年),纵轴 = P(撞上 ≤ K)。看不同 K「在何时」从 0 跨到 1。', en: 'Each line corresponds to one K threshold. X-axis: log year (2003 → 10^15 yr), Y-axis: P(hit ≤ K). Watch when each line crosses from 0 to 1.'
            })}
          </p>
          <LineChart
            series={probSeries}
            xLabel={tr({ zh: '年 (log)', en: 'Year (log)' })}
            yLabel={tr({ zh: '累积概率 P', en: 'Cumulative P'
            })}
            xFormat={(v) => formatYear(logXToYear(v))}
            yFormat={(v) => (v >= 0.01 ? (v * 100).toFixed(0) + '%' : v.toExponential(0))}
            yMin={0}
            yMax={1}
            height={340}
          />
        </section>

        {/* 期望最幸运时间 chart */}
        <section className="pred-section">
          <h2>{tr({ zh: '期望最幸运成绩随年份 (跨项目)', en: 'Expected Luckiest Time vs Year (Cross-Event)'
        })}</h2>
          <p>
            {tr({ zh: '横轴 log 年份,纵轴 log 秒。每条线 = 某项目 E[min depth] / TPS_ceil + setup_s。长期渐近到 k_min_wca / TPS_ceil + setup (各项目最快可能的单次)。', en: 'Log year vs log seconds. Each line = E[min depth] / TPS_ceil + setup_s per event. Asymptote = k_min_wca / TPS_ceil + setup (fastest physically possible single).'
            })}
          </p>
          <LineChart
            series={timeSeries}
            yLog
            xLabel={tr({ zh: '年 (log)', en: 'Year (log)' })}
            yLabel={tr({ zh: '期望最幸运 (秒)', en: 'Expected luckiest (s)'
            })}
            xFormat={(v) => formatYear(logXToYear(v))}
            yFormat={(v) => v < 1 ? v.toFixed(2) : v.toFixed(1)}
            yMin={0.05}
            height={340}
          />
        </section>

        {/* Per-event cards */}
        <section className="pred-section">
          <h2>{tr({ zh: '各项目当前年份运气预测', en: 'Per-Event Forecast at Selected Year'
        })}</h2>
          <p>
            {tr({ zh: '★ = 深度分布精确;◐ = 部分精确, 高深度估计;~ = 近似分布。时间 = E[min] / TPS_ceil + setup_s。', en: '★ = exact depth distribution; ◐ = partial (exact low / est. high); ~ = approximate. Time = E[min] / TPS_ceil + setup_s.'
            })}
          </p>
          <div className="lucky-grid">
            {rows.map((r) => (
              <EventCard key={r.ev.id} row={r} isZh={isZh} />
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section className="pred-section">
          <h2>{tr({ zh: '方法', en: 'Methodology' })}</h2>
          <ol>
            <li>
              <strong>{tr({ zh: '状态空间。', en: 'State space.'
            })}</strong>{' '}
              {tr({ zh: '三阶 4.3252×10¹⁹ 个状态,二阶 3,674,160,Pyraminx 933,120,Skewb 3,149,280。这四个项目的深度分布都已完全枚举 (counts[d] = 步数恰好为 d 的状态数)。', en: '3x3 = 4.3252 × 10^19 states; 2x2 = 3,674,160; Pyraminx = 933,120; Skewb = 3,149,280. Their full depth distributions are known.'
            })}
            </li>
            <li>
              <strong>{tr({ zh: '深度分布来源。', en: 'Distribution sources.'
            })}</strong>{' '}
              {tr({ zh: '三阶: cube20.org / Rokicki 2010 (d = 0-15 精确,d = 16-20 估计)。二阶: Korf / Pochmann。Pyraminx / Skewb: Jaap Scherphuis。大魔方 / Megaminx / Sq1 / Clock 分布不可枚举,用「峰值集中」近似。', en: '3x3: cube20.org / Rokicki 2010 (exact d=0..15, est. d=16..20). 2x2: Korf / Pochmann. Pyraminx / Skewb: Jaap Scherphuis. Larger cubes etc.: peak-concentrated approximation.'
            })}
            </li>
            <li>
              <strong>{tr({ zh: '累积打乱 N(Y)。', en: 'Accumulated scrambles N(Y).'
            })}</strong>{' '}
              {tr({ zh: '2003-2025 来自 WCA 真实数据 (≈ 28000 场),2026+ 用 5% 年复合增长外推,封顶 30000 场 / 年。单场 3x3 打乱数 (含备用) 线性插值: 2003 ~30,2026 ~250。其他项目按 scramble_share 折算 (4x4 ≈ 0.70 × 3x3)。', en: '2003–2025 from WCA dump (≈28k comps total), 2026+ extrapolated at 5% CAGR capped at 30k comps/year. Per-comp 3x3 scrambles (incl. backups) linearly interpolated 30 → 250 (2003 → 2026). Other events by share factor (4x4 ≈ 0.70 × 3x3).'
            })}
            </li>
            <li>
              <strong>{tr({ zh: '累积概率。', en: 'Cumulative probability.'
            })}</strong>{' '}
              {tr({ zh: 'P(在 N 次独立打乱中至少撞上一次 d ≤ K) = 1 − (1 − p_le_K)^N,其中 p_le_K = ∑_{i≤K} counts[i] / |S|。实现用 log1p(-p) 避免 underflow。', en: 'P(hit at least one d ≤ K in N draws) = 1 − (1 − p_le_K)^N, with p_le_K = ∑_{i≤K} counts[i] / |S|. Implemented via log1p(-p) for numerical stability when p is tiny.'
            })}
            </li>
            <li>
              <strong>{tr({ zh: '期望最幸运 E[min]。', en: 'Expected min E[min].'
            })}</strong>{' '}
              {tr({ zh: "E[min depth in N samples] = ∑_{k=0}^{G-1} (1 − P(min ≤ k)),然后被 WCA 接受规则 k_min_wca 截断 (三阶 ≥ 2,二阶 / Pyraminx / Skewb ≥ 1)。", en: "E[min depth] = ∑_{k=0}^{G-1} (1 − P(min ≤ k)), then clamped to WCA-acceptable minimum (3x3 ≥ 2; 2x2 / Pyraminx / Skewb ≥ 1)."
            })}
            </li>
            <li>
              <strong>{tr({ zh: '执行时间。', en: 'Execution time.'
            })}</strong>{' '}
              {tr({ zh: 'T = E[min] / TPS_ceil + setup_s。TPS_ceil 取生理上界 (3x3 = 17,来自双手击鼓 22 Hz × 50% 的叠加损耗),OH = 10,大魔方 8-12。setup_s 是收尾 + StackMat 触发噪声 0.10-2.00 秒。', en: 'T = E[min] / TPS_ceil + setup_s. TPS_ceil = physiological ceiling (3x3 = 17, dual-hand 22 Hz drum × 50% loss), OH = 10, big cubes 8–12. setup_s = trigger + tap-off 0.10–2.00 s.'
            })}
            </li>
            <li>
              <strong>{tr({ zh: '渐近 (N → ∞)。', en: 'Asymptote (N → ∞).'
            })}</strong>{' '}
              {tr({ zh: "三阶: 2 步 / 17 TPS + 0.15 秒 = 0.27 秒。二阶 / Pyraminx / Skewb: 1 步 / TPS_ceil + setup ≈ 0.16-0.20 秒。这些是「运气和手速都满足」时的下界 — 物理墙 (M/TPS+R) 还在 1.5+ 秒,普通比赛中的实际 WR 受物理墙约束。", en: "3x3: 2 moves / 17 TPS + 0.15 s = 0.27 s. 2x2 / Pyraminx / Skewb: 1 move / TPS_ceil + setup ≈ 0.16–0.20 s. These are reachable only when luck + TPS are both maxed; the physical floor (M/TPS+R) is still ~1.5 s and bounds real-comp WRs."
            })}
            </li>
          </ol>
        </section>

        <section className="pred-section">
          <h2>{tr({ zh: '局限', en: 'Caveats'
        })}</h2>
          <ul>
            <li>
              {tr({ zh: 'WCA 的打乱器是均匀采样,但 TNoodle 实际输出是 17-25 步长的动作序列 — 不会刻意挑出可短解的状态。累积命中是数学层面的事;真到比赛里,选手还得当场识别出「这是个 d=4 状态」并找到 4 步最优解 (没有教科书算法库覆盖低 d 状态)。', en: "WCA scrambler is uniform sampling, but TNoodle outputs 17–25 move sequences (not filtered for short-solve states). A cumulative hit is mathematical; in practice the cuber would also have to recognize \"this is a d=4 state\" mid-comp and find a 4-move optimal solution (no algorithm book covers low-d states)."
            })}
            </li>
            <li>
              {tr({ zh: '识别 + 切换 + 反应噪声 + 双手协调下界 (≥ 50 ms StackMat 触发) 实际让「d=2 + 17 TPS」的 0.27 秒也碰不到,物理底层墙 ≈ 1.5 秒。', en: 'Recognition + switching + reaction + dual-hand coordination floor (≥ 50 ms StackMat trigger) mean the "d=2 + 17 TPS" 0.27 s is unreachable; the physical floor is ~1.5 s.'
            })}
            </li>
            <li>
              {tr({ zh: '大魔方 (4x4+) / Megaminx / Sq1 / Clock 分布未枚举,用「峰值集中」近似。量级正确,个位精度不可靠。', en: 'Large cubes / Megaminx / Sq1 / Clock distributions not enumerated; peak-concentrated approximation. Order-of-magnitude reliable, not single-digit.'
            })}
            </li>
            <li>
              {tr({ zh: 'FMC / 盲拧本页不建模 (FMC 时间 = 步数本身;盲拧受记忆速度而非 TPS 约束)。', en: 'FMC / blind not modeled (FMC time = move count; blind is memo-bound, not TPS).'
            })}
            </li>
          </ul>
        </section>

        <footer className="pred-footer">
          <div>
            {tr({ zh: '深度分布: cube20.org / Rokicki / Korf / Pochmann / Scherphuis  比赛数: WCA results dump', en: 'Depth distributions: cube20.org / Rokicki / Korf / Pochmann / Scherphuis · Comp counts: WCA results dump'
            })}
          </div>
        </footer>
      </article>
    </div>
  );
}

// nuqs useQueryState 走 next/navigation useSearchParams,需 Suspense 边界。
export default function LuckyLimitPage() {
  return (
    <Suspense fallback={<div className="pred-page" />}>
      <LuckyLimitPageInner />
    </Suspense>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="lucky-stat">
      <div className="lucky-stat-label">{label}</div>
      <div className="lucky-stat-value">{value}</div>
      {hint && <div className="lucky-stat-hint">{hint}</div>}
    </div>
  );
}

function EventCard({ row, isZh }: { row: Row; isZh: boolean }) {
  const ev = row.ev;
  return (
    <div className="lucky-card">
      <div className="lucky-card-header">
        <span className="lucky-card-name">{(isZh ? ev.name_zh : ev.name_en)}</span>
        <span className="lucky-card-id">{ev.id}</span>
        {row.source === 'exact' && <span className="lucky-card-badge" title={tr({ zh: '精确分布', en: 'Exact'
        })}>★</span>}
        {row.source === 'partial' && <span className="lucky-card-badge" title={tr({ zh: '部分精确', en: 'Partial'
        })}>◐</span>}
        {row.source === 'approx' && <span className="lucky-card-badge lucky-card-badge-approx" title={tr({ zh: '近似', en: 'Approximate' })}>~</span>}
      </div>
      <div className="lucky-card-stats">
        <div>
          <div className="lucky-card-stat-label">{tr({ zh: '累积打乱 (个)', en: 'Cumulative scrambles'
        })}</div>
          <div className="lucky-card-stat-value">{formatBigN(row.N)}</div>
        </div>
        <div>
          <div className="lucky-card-stat-label">{tr({ zh: 'E[min] 步数', en: 'E[min] depth'
        })}</div>
          <div className="lucky-card-stat-value">{row.depthClamped.toFixed(2)}</div>
        </div>
        <div>
          <div className="lucky-card-stat-label">{tr({ zh: '期望最幸运', en: 'Expected luckiest'
        })}</div>
          <div className="lucky-card-stat-value lucky-card-stat-time">
            {formatVal(row.timeCeil, ev.scale)}
          </div>
          <div className="lucky-card-stat-hint">
            {isZh ? `${row.depthClamped.toFixed(1)} 步 / ${row.tps_ceil} TPS + ${row.setup_s} 秒` :
              `${row.depthClamped.toFixed(1)}m / ${row.tps_ceil} TPS + ${row.setup_s}s`}
          </div>
        </div>
      </div>
      {(row.notes_zh || row.notes_en) && (
        <div className="lucky-card-note">
          {(isZh ? (row.notes_zh ?? row.notes_en) : (row.notes_en ?? row.notes_zh))}
        </div>
      )}
    </div>
  );
}
