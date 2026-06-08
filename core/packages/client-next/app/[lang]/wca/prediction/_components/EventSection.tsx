// 单个项目的分析章节: 标题 + 概述文字 + WR 历史图 + Top-N 图 + 拟合表 + 预测表 + Sub-X 增长图
import { LineChart, type Series } from './charts';
import { formatVal, milestonePredictions, toDisplay, toDisplayAvg, type EventMeta } from './events';
import { fitExpFloor, fitExp, fitPower, type DataPoint } from './models';
import { THEORETICAL_LIMITS } from './theoretical_limits';
import TheoreticalLimitView from './TheoreticalLimitView';
import Link from '@/components/AppLink';
import { ArrowRight } from 'lucide-react';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface EventData {
  wr_by_year: Array<{ year: number; wr_single: number | null; wr_avg: number | null; solves: number }>;
  topN_single: Array<{ year: number; top1: number | null; top10: number | null; top100: number | null; top1000: number | null; top10000: number | null; active_cubers: number }>;
  topN_avg: Array<{ year: number; top1: number | null; top10: number | null; top100: number | null; top1000: number | null; top10000: number | null }>;
  subX_single: Array<Record<string, number>>;
  activity: Array<{ year: number; cubers: number; solves: number }>;
  wr_single_progression: Array<{ date: string; value: number; person_id: string; person_name: string; country_id: string }>;
  country_share: Array<{ year: number; country_id: string; cubers: number }>;
}

const COLORS = {
  single: '#c2410c',
  avg: '#2f6fd8',
  top10: '#0a8a6b',
  top100: '#8c5ad1',
  top1000: '#b3248a',
  top10000: 'var(--muted-foreground)',
  alt: '#7eb8c4',
};

const SUB_COLOR = ['var(--muted-foreground)', '#8c5ad1', '#0a8a6b', '#2f6fd8', '#c2410c', '#b3248a', '#d13636', '#e8b97a', '#0891b2'];

function stripParen(name: string): string {
  return name.replace(/\s*\(.*?\)\s*$/, '').trim();
}

/** 把 "每年最佳" 转成 "每年累积 WR (running min)" — WR 按定义只能不增 */
function runningMin(arr: Array<number | null>): Array<number | null> {
  const out: Array<number | null> = [];
  let cur: number | null = null;
  for (const v of arr) {
    if (v !== null && (cur === null || v < cur)) cur = v;
    out.push(cur);
  }
  return out;
}

interface Props {
  event: EventMeta;
  data: EventData;
  isZh: boolean;
  chapterNum?: number;
  chapterTotal?: number;
}

export default function EventSection({ event, data, isZh, chapterNum, chapterTotal }: Props) {
  const currentYear = new Date().getFullYear();
  const rawSingle = data.wr_by_year.map((d) => toDisplay(d.wr_single, event.scale));
  const rawAvg = data.wr_by_year.map((d) => toDisplayAvg(d.wr_avg, event));
  const cumSingle = runningMin(rawSingle);
  const cumAvg = runningMin(rawAvg);
  const wrYears = data.wr_by_year.map((d, i) => ({
    year: d.year,
    wr_single: cumSingle[i],
    wr_avg: cumAvg[i],
  }));
  const fitData: DataPoint[] = wrYears
    .filter((d) => d.year >= 2003 && d.year < currentYear && d.wr_single !== null)
    .map((d) => ({ year: d.year, time: d.wr_single! }));
  const fitDataAvg: DataPoint[] = wrYears
    .filter((d) => d.year >= 2003 && d.year < currentYear && d.wr_avg !== null)
    .map((d) => ({ year: d.year, time: d.wr_avg! }));

  // 用接近底端的 Lmin 网格 — moves 项目 L 范围更小
  // Lmax 给到 1000 (fitExpFloor 内部按 observedMin 自动 cap)
  const Lmax = event.scale === 'moves' ? 50 : 1000;
  const Lstep = event.scale === 'moves' ? 0.5 : 0.1;
  const fitSingle = fitExpFloor(fitData, 0, Lmax, Lstep);
  const fitAvg = fitDataAvg.length >= 4 ? fitExpFloor(fitDataAvg, 0, Lmax, Lstep) : null;
  const fitSingleExp = fitExp(fitData);
  const fitSinglePower = fitPower(fitData);

  // 主图: WR 单次/平均 + 拟合
  const futureYears = Array.from({ length: 2050 - 2003 + 1 }, (_, i) => 2003 + i);
  const series: Series[] = [
    {
      name: tr({ zh: 'WR 单次', en: 'WR Single',
          zhHant: "WR 單次"
    }),
      color: COLORS.single,
      data: wrYears.map((d) => ({ x: d.year, y: d.wr_single })),
    },
  ];
  if (event.avgFormat !== 'none') {
    series.push({
      name: isZh ? `WR ${event.avgFormat}` : `WR ${event.avgFormat}`,
      color: COLORS.avg,
      data: wrYears.map((d) => ({ x: d.year, y: d.wr_avg })),
    });
  }
  if (fitSingle) {
    series.push({
      name: tr({ zh: '单次拟合', en: 'Single fit',
          zhHant: "單次擬合"
    }),
      color: COLORS.single,
      dashed: true,
      width: 1.5,
      data: futureYears.map((y) => ({ x: y, y: fitSingle.predict(y) })),
    });
  }
  if (fitAvg) {
    series.push({
      name: i18n.language === 'zh-Hant' ? (`${event.avgFormat} 擬合`) : (isZh ? `${event.avgFormat} 拟合` : `${event.avgFormat} fit`),
      color: COLORS.avg,
      dashed: true,
      width: 1.5,
      data: futureYears.map((y) => ({ x: y, y: fitAvg.predict(y) })),
    });
  }

  // Top-N 图.
  const topN = data.topN_single.filter((d) => d.year >= 2003 && d.year < currentYear);
  const topSeries: Series[] = [
    { name: 'Top 1',     color: COLORS.single,   data: topN.map((d) => ({ x: d.year, y: toDisplay(d.top1, event.scale) })) },
    { name: 'Top 10',    color: COLORS.top10,    data: topN.map((d) => ({ x: d.year, y: toDisplay(d.top10, event.scale) })) },
    { name: 'Top 100',   color: COLORS.top100,   data: topN.map((d) => ({ x: d.year, y: toDisplay(d.top100, event.scale) })) },
    { name: 'Top 1000',  color: COLORS.top1000,  data: topN.map((d) => ({ x: d.year, y: toDisplay(d.top1000, event.scale) })) },
    { name: 'Top 10000', color: COLORS.top10000, data: topN.map((d) => ({ x: d.year, y: toDisplay(d.top10000, event.scale) })) },
  ];

  // Sub-X 累计人数
  const subSeries: Series[] = event.subThresholds.slice(0, 7).map((t, i) => ({
    name: event.subLabel(t),
    color: SUB_COLOR[i % SUB_COLOR.length],
    data: data.subX_single
      .filter((d) => (d.year as number) >= 2003 && (d.year as number) <= currentYear)
      .map((d) => {
        const v = (d as any)[`sub_${t}`];
        return { x: d.year as number, y: typeof v === 'number' && v > 0 ? v : null };
      }),
  }));

  // 当前最佳 + 持有者
  const lastWR = data.wr_single_progression.at(-1);
  const last5WR = data.wr_single_progression.slice(-5);

  // 预测里程碑
  const milestones = milestonePredictions(fitSingle, event.subThresholds, event.scale);

  // 文本生成
  const dispVal = (raw: number | null) => raw === null ? '–' : formatVal(toDisplay(raw, event.scale)!, event.scale);
  const yearsCovered = wrYears.length;
  const totalCubers = data.activity.reduce((s, d) => s + d.cubers, 0).toLocaleString();
  const peakCubers = Math.max(...data.activity.map((d) => d.cubers));
  const peakYear = data.activity.find((d) => d.cubers === peakCubers)?.year;

  const wrMin = data.wr_by_year[0]?.wr_single;
  const wrLast = lastWR?.value ?? null;
  const ratio = wrMin && wrLast ? wrMin / wrLast : null;

  return (
    <section className="pred-section pred-event-section" id={`event-${event.id}`}>
      <details className="pred-event-details" open={event.id === '333'}>
        <summary className="pred-event-summary">
          <h2>
            {chapterNum && (
              <span className="pred-event-chapter-num">
                {chapterNum.toString().padStart(2, '0')}{chapterTotal ? ` / ${chapterTotal}` : ''}
              </span>
            )}
            <span className="pred-event-title-zh">{isZh ? event.name_zh : event.name_en}</span>
            <span className="pred-event-title-id">{event.id}</span>
          </h2>
          <div className="pred-event-summary-meta">
            <span>{tr({ zh: 'WR 单次', en: 'WR Single',
                zhHant: "WR 單次"
            })} <strong>{dispVal(lastWR?.value ?? null)}</strong></span>
            {lastWR && <span>· {stripParen(lastWR.person_name)} ({lastWR.country_id})</span>}
            {fitSingle && <span>· L = <strong>{formatVal(fitSingle.L, event.scale)}</strong></span>}
            <span className="pred-event-summary-hint">{tr({ zh: '展开详情', en: 'click to expand',
                zhHant: "展開詳情"
            })}</span>
          </div>
        </summary>

      {event.id === '333' && (
        <Link href="/wca/prediction/333" className="pred-333-inline-cta">
          <div className="pred-333-inline-cta-text">
            <div className="pred-333-inline-cta-eyebrow">{tr({ zh: '深度阅读', en: 'Deep Dive',
                zhHant: "深度閱讀"
            })}</div>
            <div className="pred-333-inline-cta-title">
              {tr({ zh: '3x3 极限预测 — 25 章节, 24 万字英文长文', en: '3x3 Ultimate Limits — 25 sections, ~240k English words',
                  zhHant: "3x3 極限預測 — 25 章節, 24 萬字英文長文"
            })}
            </div>
            <div className="pred-333-inline-cta-desc">
              {tr({ zh: '历史, 方法, 数学, 硬件, 生物力学, 训练, 顶级选手, 统计建模 — 独立路由阅读', en: 'History · methods · math · hardware · biomech · training · top cubers · stats — dedicated route',
                  zhHant: "歷史, 方法, 數學, 硬體, 生物力學, 訓練, 頂級選手, 統計建模 — 獨立路由閱讀"
            })}
            </div>
          </div>
          <ArrowRight size={20} />
        </Link>
      )}

      {/* 基本盘 */}
      <div className="pred-event-cards">
        <div className="pred-card">
          <div className="pred-card-label">{tr({ zh: '当前 WR 单次', en: 'Current WR single',
              zhHant: "當前 WR 單次"
        })}</div>
          <div className="pred-card-value">{dispVal(lastWR?.value ?? null)}</div>
          <div className="pred-card-sub">
            {lastWR ? `${stripParen(lastWR.person_name)} · ${lastWR.country_id} · ${lastWR.date}` : '–'}
          </div>
        </div>
        <div className="pred-card">
          <div className="pred-card-label">{tr({ zh: '历史改写次数', en: 'WR drops',
              zhHant: "歷史改寫次數"
        })}</div>
          <div className="pred-card-value">{data.wr_single_progression.length}</div>
          <div className="pred-card-sub">{tr({ zh: '次主纪录被刷新', en: 'distinct improvements',
              zhHant: "次主紀錄被重新整理"
        })}</div>
        </div>
        <div className="pred-card">
          <div className="pred-card-label">{tr({ zh: '累计选手', en: 'Cumulative cubers',
              zhHant: "累計選手"
        })}</div>
          <div className="pred-card-value">{totalCubers}</div>
          <div className="pred-card-sub">{isZh ? `${peakYear} 年峰值 ${peakCubers.toLocaleString()}` : `peak ${peakCubers.toLocaleString()} (${peakYear})`}</div>
        </div>
        {fitSingle && (
          <div className="pred-card">
            <div className="pred-card-label" title={tr({ zh: '历史轨迹曲线拟合的渐近线,不是物理极限。详见下方"方法 + 硬件演进 + 物理极限"', en: 'Curve-fit asymptote of historical trend, NOT a physical floor. See "Method + Hardware Evolution & Physical Floor" below',
                zhHant: "歷史軌跡曲線擬合的漸近線,不是物理極限。詳見下方\"方法 + 硬體演進 + 物理極限\""
            })}>
              {tr({ zh: '拟合 L *', en: 'Fit L *',
                  zhHant: "擬合 L *"
            })}
            </div>
            <div className="pred-card-value">
              {formatVal(fitSingle.L, event.scale)}
            </div>
            <div className="pred-card-sub">R² = {fitSingle.r2.toFixed(3)} · t½ = {fitSingle.halfLife.toFixed(1)} y</div>
          </div>
        )}
        {(() => {
          const lim = THEORETICAL_LIMITS[event.id];
          if (!lim || lim.decomp.length === 0) return null;
          const last = lim.decomp[lim.decomp.length - 1];
          const tPhys = lim.t_phys_single ?? (last.T ?? last.M / last.TPS + last.R);
          return (
            <div className="pred-card">
              <div className="pred-card-label" title={tr({ zh: '步数法物理下界 = M / TPS + R, 详见下方分解', en: 'Step-count physical floor = M / TPS + R, see decomposition below',
                  zhHant: "步數法物理下界 = M / TPS + R, 詳見下方分解"
            })}>
                {tr({ zh: '物理下界 T_phys (单)', en: 'T_phys (single)',
                    zhHant: "物理下界 T_phys (單)"
                })}
              </div>
              <div className="pred-card-value pred-card-accent">
                {formatVal(tPhys, event.scale)}
              </div>
              <div className="pred-card-sub">M={last.M} · TPS={last.TPS.toFixed(1)} · R={last.R.toFixed(2)}s</div>
            </div>
          );
        })()}
        {event.avgFormat !== 'none' && (() => {
          const lim = THEORETICAL_LIMITS[event.id];
          const curAvg = lim?.current_wr_avg_value ?? (wrYears.length > 0 ? wrYears[wrYears.length - 1].wr_avg : null);
          return (
            <div className="pred-card">
              <div className="pred-card-label">{i18n.language === 'zh-Hant' ? (`當前 WR ${event.avgFormat}`) : (isZh ? `当前 WR ${event.avgFormat}` : `Current WR ${event.avgFormat}`)}</div>
              <div className="pred-card-value">{curAvg !== null ? formatVal(curAvg, event, 'average') : '–'}</div>
              <div className="pred-card-sub">{lim?.current_wr_avg_holder ?? ''}</div>
            </div>
          );
        })()}
        {event.avgFormat !== 'none' && (() => {
          const lim = THEORETICAL_LIMITS[event.id];
          if (!lim?.t_phys_avg) return null;
          const curAvg = lim.current_wr_avg_value ?? (wrYears.length > 0 ? wrYears[wrYears.length - 1].wr_avg : null);
          const ratio = curAvg ? lim.t_phys_avg / curAvg : null;
          return (
            <div className="pred-card">
              <div className="pred-card-label" title={tr({ zh: '步数法 + 执行噪声残差', en: 'Step-count + execution noise residual',
                  zhHant: "步數法 + 執行噪聲殘差"
            })}>
                {isZh ? `物理下界 T_phys (${event.avgFormat})` : `T_phys (${event.avgFormat})`}
              </div>
              <div className="pred-card-value pred-card-accent">{formatVal(lim.t_phys_avg, event, 'average')}</div>
              <div className="pred-card-sub">{ratio !== null ? `T_phys/WR = ${Math.round(ratio * 100)}%` : ''}</div>
            </div>
          );
        })()}
      </div>

      <p>
        {i18n.language === 'zh-Hant' ? ((
                            <>
                              從 {data.wr_by_year[0]?.year} 到 {data.wr_by_year.at(-1)?.year},{event.name_zh} 的 WR 單次從 <strong>{dispVal(wrMin ?? null)}</strong> 演化到 <strong>{dispVal(wrLast ?? null)}</strong>{ratio ? `,共縮了 ${ratio.toFixed(1)} 倍` : ''}。
                              資料覆蓋 {yearsCovered} 年,累計 {totalCubers} 選手-年。
                            </>
                          )) : (isZh ? (
                            <>
                              从 {data.wr_by_year[0]?.year} 到 {data.wr_by_year.at(-1)?.year},{event.name_zh} 的 WR 单次从 <strong>{dispVal(wrMin ?? null)}</strong> 演化到 <strong>{dispVal(wrLast ?? null)}</strong>{ratio ? `,共缩了 ${ratio.toFixed(1)} 倍` : ''}。
                              数据覆盖 {yearsCovered} 年,累计 {totalCubers} 选手-年。
                            </>
                          ) : (
                            <>
                              From {data.wr_by_year[0]?.year} to {data.wr_by_year.at(-1)?.year}, the {event.name_en} WR single has evolved from <strong>{dispVal(wrMin ?? null)}</strong> to <strong>{dispVal(wrLast ?? null)}</strong>{ratio ? ` — a ${ratio.toFixed(1)}× compression` : ''}.
                              Coverage: {yearsCovered} years, {totalCubers} cumulative cuber-years.
                            </>
                          ))}
      </p>

      {/* 主图: WR */}
      <h3>{tr({ zh: 'WR 走势 + 模型外推', en: 'WR Trend + Model Extrapolation',
          zhHant: "WR 走勢 + 模型外推"
    })}</h3>
      <LineChart series={series} yLabel={event.scale === 'moves' ? (tr({ zh: '步数', en: 'Moves',
          zhHant: "步數"
    })) : (tr({ zh: '时间 (秒)', en: 'Time (s)',
        zhHant: "時間 (秒)"
    }))} />

      {/* 方法 + 硬件演进 + 物理极限 */}
      {THEORETICAL_LIMITS[event.id] && (
        <TheoreticalLimitView
          event={event}
          limit={THEORETICAL_LIMITS[event.id]}
          fittedL={fitSingle?.L ?? null}
          isZh={isZh}
        />
      )}

      {/* 最近 5 次 WR */}
      {last5WR.length > 0 && (
        <>
          <h3>{tr({ zh: '最近 5 次 WR 单次', en: 'Last 5 WR Singles',
              zhHant: "最近 5 次 WR 單次"
        })}</h3>
          <table className="pred-forecast">
            <thead>
              <tr>
                <th>{tr({ zh: '日期', en: 'Date' })}</th>
                <th>{tr({ zh: '成绩', en: 'Result',
                    zhHant: "成績"
                })}</th>
                <th>{tr({ zh: '选手', en: 'Person',
                    zhHant: "選手"
                })}</th>
                <th>{tr({ zh: '国籍', en: 'Country',
                    zhHant: "國籍"
                })}</th>
              </tr>
            </thead>
            <tbody>
              {last5WR.map((w) => (
                <tr key={w.date + w.value}>
                  <td>{w.date}</td>
                  <td><strong>{formatVal(toDisplay(w.value, event.scale)!, event.scale)}</strong></td>
                  <td>{stripParen(w.person_name)}</td>
                  <td>{w.country_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* 拟合表 */}
      {fitSingle && (
        <>
          <h3>{tr({ zh: '模型拟合对比', en: 'Model Fit Comparison',
              zhHant: "模型擬合對比"
        })}</h3>
          <table className="pred-fit-table">
            <thead>
              <tr>
                <th></th>
                <th>L</th>
                <th>A</th>
                <th>k</th>
                <th>t½</th>
                <th>R²</th>
                <th>RMSE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{tr({ zh: '指数+下限', en: 'Exp+floor',
                    zhHant: "指數+下限"
                })}</td>
                <td>{formatVal(fitSingle.L, event.scale)}</td>
                <td>{fitSingle.A.toFixed(2)}</td>
                <td>{fitSingle.k.toFixed(3)}</td>
                <td>{fitSingle.halfLife.toFixed(1)} y</td>
                <td>{fitSingle.r2.toFixed(3)}</td>
                <td>{fitSingle.rmse.toFixed(2)}</td>
              </tr>
              {fitSingleExp && (
                <tr>
                  <td>{tr({ zh: '纯指数', en: 'Pure exp',
                      zhHant: "純指數"
                })}</td>
                  <td>0</td>
                  <td>{fitSingleExp.a.toFixed(2)}</td>
                  <td>{fitSingleExp.k.toFixed(3)}</td>
                  <td>{(Math.log(2) / fitSingleExp.k).toFixed(1)} y</td>
                  <td>{fitSingleExp.r2.toFixed(3)}</td>
                  <td>{fitSingleExp.rmse.toFixed(2)}</td>
                </tr>
              )}
              {fitSinglePower && (
                <tr>
                  <td>{tr({ zh: '幂律', en: 'Power law',
                      zhHant: "冪律"
                })}</td>
                  <td>—</td>
                  <td>{fitSinglePower.a.toFixed(2)}</td>
                  <td>b={fitSinglePower.b.toFixed(2)}</td>
                  <td>—</td>
                  <td>{fitSinglePower.r2.toFixed(3)}</td>
                  <td>{fitSinglePower.rmse.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* 预测里程碑 */}
      {fitSingle && (
        <>
          <h3>{tr({ zh: 'Sub-X 里程碑预测 (基于指数+下限模型)', en: 'Sub-X Milestones (exp+floor model)',
              zhHant: "Sub-X 里程碑預測 (基於指數+下限模型)"
        })}</h3>
          <table className="pred-forecast">
            <thead>
              <tr>
                <th>{tr({ zh: '目标', en: 'Target',
                    zhHant: "目標"
                })}</th>
                <th>{tr({ zh: '预计达成年份', en: 'Predicted year',
                    zhHant: "預計達成年份"
                })}</th>
                <th>{tr({ zh: '当前是否已达成', en: 'Already achieved?',
                    zhHant: "當前是否已達成"
                })}</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const achieved = (lastWR?.value ?? Infinity) <= m.target;
                return (
                  <tr key={m.target}>
                    <td>{event.subLabel(m.target)}</td>
                    <td>
                      {achieved
                        ? <span className="pred-achieved">{tr({ zh: '已达成', en: 'achieved',
                            zhHant: "已達成"
                        })}</span>
                        : (m.year === null ? <span className="pred-never">{tr({ zh: '永不(L 大于此)', en: 'never (L exceeds)',
                            zhHant: "永不(L 大於此)"
                        })}</span> : Math.round(m.year))}
                    </td>
                    <td>{achieved ? '✓' : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Top-N */}
      <h3>{tr({ zh: 'Top-N PB 走势', en: 'Top-N PB Trend',
          zhHant: "Top-N PB 走勢"
    })}</h3>
      <LineChart series={topSeries} yLabel={event.scale === 'moves' ? (tr({ zh: '步数', en: 'Moves',
          zhHant: "步數"
    })) : (tr({ zh: '单次 (秒)', en: 'Single (s)',
        zhHant: "單次 (秒)"
    }))} />
      <p className="pred-note">
        {i18n.language === 'zh-Hant' ? ((
                            <>
                              <strong>注:</strong> Top-N 是「<em>該年內</em>排名 N 的最好成績」,每年獨立取樣,<strong>不是單調下降的</strong>。
                              2020-2021 抬頭是 COVID 比賽大量取消所致 — 排名越深 (Top 1000 / 10000) 抬得越明顯,因為這個位置是當年還在比的最末尾,由出賽次數少, 沒機會刷低 PB 的新人佔據;Top 1 / Top 10 抖動小,是因為頂尖選手基本沒受影響。
                            </>
                          )) : (isZh ? (
                            <>
                              <strong>注:</strong> Top-N 是「<em>该年内</em>排名 N 的最好成绩」,每年独立采样,<strong>不是单调下降的</strong>。
                              2020-2021 抬头是 COVID 比赛大量取消所致 — 排名越深 (Top 1000 / 10000) 抬得越明显,因为这个位置是当年还在比的最末尾,由出赛次数少, 没机会刷低 PB 的新人占据;Top 1 / Top 10 抖动小,是因为顶尖选手基本没受影响。
                            </>
                          ) : (
                            <>
                              <strong>Note:</strong> Top-N is the rank-N best result <em>achieved within that year</em>, sampled independently per year — <strong>not monotonically decreasing</strong>.
                              The 2020-2021 hump reflects COVID competition cancellations — the deeper the rank, the bigger the hump, because the rank-1000 / rank-10000 spot that year was held by infrequent competitors with few attempts to lower their PB. Top 1 / Top 10 stay stable since elite cubers kept practicing regardless.
                            </>
                          ))}
      </p>

      {/* Sub-X 增长 */}
      <h3>{tr({ zh: 'Sub-X 累计达成人数 (log)', en: 'Sub-X Cumulative Cubers (log)',
          zhHant: "Sub-X 累計達成人數 (log)"
    })}</h3>
      <LineChart
        series={subSeries}
        yLog
        yLabel={tr({ zh: '累计人数', en: 'Cumulative cubers',
            zhHant: "累計人數"
        })}
        yFormat={(v) => v >= 1 ? Math.round(v).toLocaleString() : v.toFixed(0)}
      />
      </details>

    </section>
  );
}
