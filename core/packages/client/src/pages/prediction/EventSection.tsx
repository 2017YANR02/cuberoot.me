// 单个项目的分析章节: 标题 + 概述文字 + WR 历史图 + Top-N 图 + 拟合表 + 预测表 + Sub-X 增长图
import { LineChart, type Series } from './charts';
import { formatVal, milestonePredictions, toDisplay, toDisplayAvg, type EventMeta } from './events';
import { fitExpFloor, fitExp, fitPower, type DataPoint } from './models';
import { THEORETICAL_LIMITS } from './theoretical_limits';
import TheoreticalLimitView from './TheoreticalLimitView';

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
  top10000: '#5a6370',
  alt: '#7eb8c4',
};

const SUB_COLOR = ['#5a6370', '#8c5ad1', '#0a8a6b', '#2f6fd8', '#c2410c', '#b3248a', '#d13636', '#e8b97a', '#0891b2'];

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
}

export default function EventSection({ event, data, isZh }: Props) {
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
      name: isZh ? 'WR 单次' : 'WR Single',
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
      name: isZh ? '单次拟合' : 'Single fit',
      color: COLORS.single,
      dashed: true,
      width: 1.5,
      data: futureYears.map((y) => ({ x: y, y: fitSingle.predict(y) })),
    });
  }
  if (fitAvg) {
    series.push({
      name: isZh ? `${event.avgFormat} 拟合` : `${event.avgFormat} fit`,
      color: COLORS.avg,
      dashed: true,
      width: 1.5,
      data: futureYears.map((y) => ({ x: y, y: fitAvg.predict(y) })),
    });
  }

  // Top-N 图
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
            <span className="pred-event-title-zh">{isZh ? event.name_zh : event.name_en}</span>
            <span className="pred-event-title-id">{event.id}</span>
          </h2>
          <div className="pred-event-summary-meta">
            <span>{isZh ? 'WR 单次' : 'WR Single'} <strong>{dispVal(lastWR?.value ?? null)}</strong></span>
            {lastWR && <span>· {stripParen(lastWR.person_name)} ({lastWR.country_id})</span>}
            {fitSingle && <span>· L = <strong>{formatVal(fitSingle.L, event.scale)}</strong></span>}
            <span className="pred-event-summary-hint">{isZh ? '点击展开' : 'click to expand'}</span>
          </div>
        </summary>

      {/* 基本盘 */}
      <div className="pred-event-cards">
        <div className="pred-card">
          <div className="pred-card-label">{isZh ? '当前 WR 单次' : 'Current WR single'}</div>
          <div className="pred-card-value">{dispVal(lastWR?.value ?? null)}</div>
          <div className="pred-card-sub">
            {lastWR ? `${stripParen(lastWR.person_name)} · ${lastWR.country_id} · ${lastWR.date}` : '–'}
          </div>
        </div>
        <div className="pred-card">
          <div className="pred-card-label">{isZh ? '历史改写次数' : 'WR drops'}</div>
          <div className="pred-card-value">{data.wr_single_progression.length}</div>
          <div className="pred-card-sub">{isZh ? '次主纪录被刷新' : 'distinct improvements'}</div>
        </div>
        <div className="pred-card">
          <div className="pred-card-label">{isZh ? '累计 cuber' : 'Cumulative cubers'}</div>
          <div className="pred-card-value">{totalCubers}</div>
          <div className="pred-card-sub">{isZh ? `${peakYear} 年峰值 ${peakCubers.toLocaleString()}` : `peak ${peakCubers.toLocaleString()} (${peakYear})`}</div>
        </div>
        {fitSingle && (
          <div className="pred-card">
            <div className="pred-card-label" title={isZh ? '历史轨迹曲线拟合的渐近线,不是物理极限。详见下方"方法 + 硬件演进 + 物理极限"' : 'Curve-fit asymptote of historical trend, NOT a physical floor. See "Method + Hardware Evolution & Physical Floor" below'}>
              {isZh ? '拟合 L *' : 'Fit L *'}
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
              <div className="pred-card-label" title={isZh ? '步数法物理下界 = M / TPS + R, 详见下方分解' : 'Step-count physical floor = M / TPS + R, see decomposition below'}>
                {isZh ? '物理下界 T_phys (单)' : 'T_phys (single)'}
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
              <div className="pred-card-label">{isZh ? `当前 WR ${event.avgFormat}` : `Current WR ${event.avgFormat}`}</div>
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
              <div className="pred-card-label" title={isZh ? '步数法 + 执行噪声残差' : 'Step-count + execution noise residual'}>
                {isZh ? `物理下界 T_phys (${event.avgFormat})` : `T_phys (${event.avgFormat})`}
              </div>
              <div className="pred-card-value pred-card-accent">{formatVal(lim.t_phys_avg, event, 'average')}</div>
              <div className="pred-card-sub">{ratio !== null ? `T_phys/WR = ${Math.round(ratio * 100)}%` : ''}</div>
            </div>
          );
        })()}
      </div>

      <p>
        {isZh ? (
          <>
            从 {data.wr_by_year[0]?.year} 至 {data.wr_by_year.at(-1)?.year}, {event.name_zh} 的 WR 单次从 <strong>{dispVal(wrMin ?? null)}</strong> 演化到 <strong>{dispVal(wrLast ?? null)}</strong>{ratio ? `, 即 ${ratio.toFixed(1)} 倍压缩` : ''}.
            数据涵盖 {yearsCovered} 个年份, {totalCubers} 累计 cuber-年.
          </>
        ) : (
          <>
            From {data.wr_by_year[0]?.year} to {data.wr_by_year.at(-1)?.year}, the {event.name_en} WR single has evolved from <strong>{dispVal(wrMin ?? null)}</strong> to <strong>{dispVal(wrLast ?? null)}</strong>{ratio ? ` — a ${ratio.toFixed(1)}× compression` : ''}.
            Coverage: {yearsCovered} years, {totalCubers} cumulative cuber-years.
          </>
        )}
      </p>

      {/* 主图: WR */}
      <h3>{isZh ? 'WR 走势 + 模型外推' : 'WR Trend + Model Extrapolation'}</h3>
      <LineChart series={series} yLabel={event.scale === 'moves' ? (isZh ? '步数' : 'Moves') : (isZh ? '时间 (秒)' : 'Time (s)')} />

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
          <h3>{isZh ? '最近 5 次 WR 单次' : 'Last 5 WR Singles'}</h3>
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
          <h3>{isZh ? '模型拟合对比' : 'Model Fit Comparison'}</h3>
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
                <td>{isZh ? '指数+下限' : 'Exp+floor'}</td>
                <td>{formatVal(fitSingle.L, event.scale)}</td>
                <td>{fitSingle.A.toFixed(2)}</td>
                <td>{fitSingle.k.toFixed(3)}</td>
                <td>{fitSingle.halfLife.toFixed(1)} y</td>
                <td>{fitSingle.r2.toFixed(3)}</td>
                <td>{fitSingle.rmse.toFixed(2)}</td>
              </tr>
              {fitSingleExp && (
                <tr>
                  <td>{isZh ? '纯指数' : 'Pure exp'}</td>
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
                  <td>{isZh ? '幂律' : 'Power law'}</td>
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
          <h3>{isZh ? 'Sub-X 里程碑预测 (基于指数+下限模型)' : 'Sub-X Milestones (exp+floor model)'}</h3>
          <table className="pred-forecast">
            <thead>
              <tr>
                <th>{isZh ? '目标' : 'Target'}</th>
                <th>{isZh ? '预计达成年份' : 'Predicted year'}</th>
                <th>{isZh ? '当前是否已达成' : 'Already achieved?'}</th>
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
                        ? <span className="pred-achieved">{isZh ? '已达成' : 'achieved'}</span>
                        : (m.year === null ? <span className="pred-never">{isZh ? '永不(L 大于此)' : 'never (L exceeds)'}</span> : Math.round(m.year))}
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
      <h3>{isZh ? 'Top-N PB 走势' : 'Top-N PB Trend'}</h3>
      <LineChart series={topSeries} yLabel={event.scale === 'moves' ? (isZh ? '步数' : 'Moves') : (isZh ? '单次 (秒)' : 'Single (s)')} />
      <p className="pred-note">
        {isZh ? (
          <>
            <strong>注:</strong> Top-N 是 "<em>该年内</em>排名 N 的最好成绩",每年独立采样,<strong>不是单调下降的</strong>。
            2020-2021 中段 (Top 100 / 1000) 普遍抬头,是因为 COVID 比赛大量取消,排名 1000 这种深度位置的样本池缩水,中位水平被拖慢;Top 1 抖动小是因为顶尖选手没受影响。
            Top 10000 在 2023 才出现,因为之前年度活跃人数不足。
          </>
        ) : (
          <>
            <strong>Note:</strong> Top-N is the rank-N best result <em>achieved within that year</em>, sampled independently per year — <strong>not monotonically decreasing</strong>.
            The 2020-2021 hump (Top 100 / 1000) reflects COVID competition cancellations: the rank-1000 sample pool shrank, dragging down median quality. Top 1 stays stable because elite cubers kept practicing.
            Top 10000 only appears from 2023 because prior years had fewer than 10k active competitors.
          </>
        )}
      </p>

      {/* Sub-X 增长 */}
      <h3>{isZh ? 'Sub-X 累计达成人数 (log)' : 'Sub-X Cumulative Cubers (log)'}</h3>
      <LineChart
        series={subSeries}
        yLog
        yLabel={isZh ? '累计人数' : 'Cumulative cubers'}
        yFormat={(v) => v >= 1 ? Math.round(v).toLocaleString() : v.toFixed(0)}
      />
      </details>
    </section>
  );
}
