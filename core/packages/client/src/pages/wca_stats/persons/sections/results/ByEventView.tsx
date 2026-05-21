// 按项目:单项目详情.四块:
//   1. 最佳成绩 折线 (single + average,X = comp index)
//   2. 单次成绩分布 直方图
//   3. 历史成绩排名曲线 (年度 NR / WR × single / avg)
//   4. 全部成绩 (按比赛倒序的轮次表,attempts 列)

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { InfoTooltip } from '../../../../../components/InfoTooltip/InfoTooltip';
import { formatWcaResult } from '../../../../../utils/wca_format_result';
import { localizeCompName } from '../../../../../utils/comp_localize';
import { formatDateRangeIso } from '../../../../../utils/date_range';
import { CompCell } from '../../../../../components/CompCell/CompCell';
import { compLinkProps } from '../../../../../utils/comp_link';
import { RecordBadge } from '../../../../../components/RecordBadge';
import { computePrRank } from '../../logic/progress';
import { fetchPersonRankHistory, type PersonRankHistoryResponse, type WcaPersonProfile, type WcaResultRow, type WcaCompetition } from '../../wca_api';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  eventId: string;
  isZh: boolean;
}

type SubSub = 'best' | 'dist';

export default function ByEventView({ profile, results, comps, eventId, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [view, setView] = useState<SubSub>('best');
  const [hist, setHist] = useState<PersonRankHistoryResponse | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    setHist(null);
    setHistLoading(true);
    fetchPersonRankHistory(profile.person.wca_id, eventId)
      .then((j) => setHist(j))
      .catch(() => { /* server endpoint may not exist yet — chart will simply hide */ })
      .finally(() => setHistLoading(false));
  }, [profile.person.wca_id, eventId]);

  if (!results || !comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  const compById = new Map(comps.map((c) => [c.id, c]));
  const eventResults = results
    .filter((r) => r.event_id === eventId)
    .slice()
    .sort((a, b) => {
      const da = compById.get(a.competition_id)?.start_date ?? '';
      const db = compById.get(b.competition_id)?.start_date ?? '';
      return da.localeCompare(db) || a.id - b.id;
    });

  return (
    <div className="wp-byevent">
      <div className="wp-subsubtab-bar">
        <button
          className={`wp-subsubtab-btn ${view === 'best' ? 'is-active' : ''}`}
          onClick={() => setView('best')}
        >{t('最佳成绩', 'Best Times')}</button>
        <button
          className={`wp-subsubtab-btn ${view === 'dist' ? 'is-active' : ''}`}
          onClick={() => setView('dist')}
        >{t('单次成绩分布', 'Single Distribution')}</button>
      </div>

      {view === 'best' && (
        <BestChart
          eventId={eventId}
          rows={eventResults}
          compById={compById}
          isZh={isZh}
        />
      )}
      {view === 'dist' && (
        <DistChart eventId={eventId} rows={eventResults} isZh={isZh} />
      )}

      <h3 className="wp-section-h">{t('历史成绩排名曲线', 'Historical Rank History')}</h3>
      {histLoading && <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}
      {!histLoading && hist && hist.rows.length > 0 && (
        <RankChart hist={hist} isZh={isZh} />
      )}
      {!histLoading && hist && hist.rows.length === 0 && (
        <div className="wp-empty">{t('暂无年度排名数据', 'No yearly rank data')}</div>
      )}
      {!histLoading && !hist && (
        <div className="wp-empty wp-text-mute">{t('排名数据暂未生成(服务端 stats-build 数据未就绪)', 'Rank history not yet built on server')}</div>
      )}

      <h3 className="wp-section-h">{t('全部成绩', 'All Results')}</h3>
      <EventRoundsList
        rows={eventResults}
        compById={compById}
        results={results}
        comps={comps}
        eventId={eventId}
        isZh={isZh}
      />
    </div>
  );
}

// ─── 全部成绩 (按比赛倒序的轮次表) ───────────────────────────────────────
const ROUND_ORDER: Record<string, number> = {
  'f': 0, 'c': 1, 'b': 2,
  '3': 3,
  '2': 4, 'g': 4,
  '1': 5, 'd': 5,
  'h': 6,
};
// 表头 round 列 tooltip 文本 (中英),解释 R1/R2/R3/Fi/C-*/h 等缩写
const ROUND_HINT_ZH = `轮次缩写:
R1 / R2 / R3 — 初赛 / 复赛 / 半决赛 (打满 5 把)
Fi — 决赛
C- 前缀 (组合赛制) — 带 cutoff,前几把过线才能继续打完整 Ao5
h — head-to-head 1v1 淘汰 (非 WCA 项目)`;
const ROUND_HINT_EN = `Round abbreviations:
R1 / R2 / R3 — First / Second / Third Round (full attempts)
Fi — Final
C- prefix (Combined) — cutoff format; must beat cutoff in first attempts to continue full Ao5
h — Head-to-head (1v1 elimination, non-WCA)`;

function roundLabel(rt: string, _isZh: boolean): string {
  // 用 Fi / R3 / R2 / R1 缩写,中英文一致
  const map: Record<string, string> = {
    'f': 'Fi', 'c': 'C-Fi', 'b': 'B-Fi',
    '3': 'R3',
    '2': 'R2', 'g': 'C-R2',
    '1': 'R1', 'd': 'C-R1',
    'h': 'R1',
  };
  return map[rt] ?? rt;
}
function roundClass(rt: string): string {
  if (rt === 'f' || rt === 'c' || rt === 'b') return 'wp-round-final';
  if (rt === '3') return 'wp-round-semi';
  if (rt === '2' || rt === 'g') return 'wp-round-quarter';
  return 'wp-round-first';
}
function isBracketed(att: number[], idx: number): boolean {
  if (att.length !== 5) return false;
  const valid = att.map((v, i) => ({ v, i })).filter(({ v }) => v > 0);
  if (valid.length === 0) return false;
  const fail = att.findIndex((v) => v === -1 || v === -2);
  let worstIdx: number;
  if (fail >= 0) worstIdx = fail;
  else worstIdx = att.indexOf(Math.max(...valid.map((x) => x.v)));
  const bestIdx = att.indexOf(Math.min(...valid.map((x) => x.v)));
  return idx === worstIdx || idx === bestIdx;
}

// 把 attempts 渲染为可折行的 inline 列表(支持 H2H 等 5+ 次的格式).
function AttemptsList({ attempts, best, eventId }: { attempts: number[]; best: number; eventId: string }) {
  if (attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const validNums = attempts.filter((x) => x > 0);
  const minValid = validNums.length > 0 ? Math.min(...validNums) : 0;
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const formatted = formatWcaResult(a, eventId, 'single');
        const isBest = validNums.length > 0 && a > 0 && a === minValid && a === best;
        return (
          <span key={i} className={`wp-att ${isBest ? 'wp-att-best' : ''} ${isBracketed(attempts, i) ? 'wp-att-trimmed' : ''}`}>
            {formatted}
          </span>
        );
      })}
    </span>
  );
}

function EventRoundsList({
  rows, compById, results, comps, eventId, isZh,
}: {
  rows: WcaResultRow[];
  compById: Map<string, WcaCompetition>;
  results: WcaResultRow[];
  comps: WcaCompetition[];
  eventId: string;
  isZh: boolean;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const prRank = useMemo(() => computePrRank(results, comps), [results, comps]);

  // 按比赛日期倒序,组内按 round_type 顺序(决赛在上).
  const sorted = useMemo(() => {
    return rows.slice().sort((a, b) => {
      const ca = compById.get(a.competition_id);
      const cb = compById.get(b.competition_id);
      const da = ca?.start_date ?? '';
      const db = cb?.start_date ?? '';
      if (da !== db) return db.localeCompare(da);
      if (a.competition_id !== b.competition_id) return a.competition_id.localeCompare(b.competition_id);
      return (ROUND_ORDER[a.round_type_id] ?? 99) - (ROUND_ORDER[b.round_type_id] ?? 99);
    });
  }, [rows, compById]);

  if (sorted.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>;

  // 同一比赛只在首行展示比赛名 + 日期(stacked).
  let lastCompId = '';

  return (
    <div className="wp-table-scroll">
      <table className="wp-bycomp-table">
        <thead>
          <tr>
            <th>{t('比赛', 'Competition')}</th>
            <th>
              <span className="wp-th-info">
                {t('轮次', 'Round')}
                <InfoTooltip content={t(ROUND_HINT_ZH, ROUND_HINT_EN)} />
              </span>
            </th>
            <th className="wp-th-narrow">{t('排名', 'Pos')}</th>
            <th>{t('单次', 'Single')}</th>
            <th>{t('平均', 'Avg')}</th>
            <th>{t('详细成绩', 'Attempts')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const cmp = compById.get(r.competition_id);
            const rank = prRank.get(r.id);
            const singleRank = rank?.singleRank ?? null;
            const averageRank = rank?.averageRank ?? null;
            const showComp = r.competition_id !== lastCompId;
            lastCompId = r.competition_id;
            return (
              <tr key={r.id} className={showComp ? 'wp-row-comp-first' : ''}>
                <td className="wp-cell-comp">
                  {showComp && cmp && (
                    <>
                      <Link
                        {...compLinkProps(cmp.id, { event: eventId, round: r.round_type_id })}
                        className="wp-bycomp-name"
                      ><CompCell compId={cmp.id} compName={cmp.name} isZh={isZh} /></Link>
                      <div className="wp-cell-comp-date">{formatDateRangeIso(cmp.start_date, cmp.end_date)}</div>
                    </>
                  )}
                  {showComp && !cmp && r.competition_id}
                </td>
                <td>
                  <span className={`wp-round-tag ${roundClass(r.round_type_id)}`}>
                    {roundLabel(r.round_type_id, isZh)}
                  </span>
                </td>
                <td className={`wp-cell-pos ${r.pos === 1 ? 'wp-pos-first' : ''}`}>
                  {r.pos > 0 ? r.pos : '—'}
                </td>
                <td className="wp-cell-result">
                  <span className="record-num-cell">
                    {formatWcaResult(r.best, eventId, 'single')}
                    {r.regional_single_record
                      ? <RecordBadge record={r.regional_single_record} variant="inline" />
                      : singleRank
                        ? <RecordBadge record={singleRank === 1 ? 'PR' : `PR${singleRank}`} variant="inline" />
                        : null}
                  </span>
                </td>
                <td className="wp-cell-result">
                  <span className="record-num-cell">
                    {formatWcaResult(r.average, eventId, 'average')}
                    {r.regional_average_record
                      ? <RecordBadge record={r.regional_average_record} variant="inline" />
                      : averageRank
                        ? <RecordBadge record={averageRank === 1 ? 'PR' : `PR${averageRank}`} variant="inline" />
                        : null}
                  </span>
                </td>
                <td className="wp-cell-attempts">
                  <AttemptsList attempts={r.attempts} best={r.best} eventId={eventId} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 最佳成绩 折线图 ─────────────────────────────────────────────────
function BestChart({
  eventId, rows, compById, isZh,
}: {
  eventId: string;
  rows: WcaResultRow[];
  compById: Map<string, WcaCompetition>;
  isZh: boolean;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const isMbld = eventId === '333mbf';
  const isFmc  = eventId === '333fm';

  // PR 检测 + axis 值映射(toAxisValue 把 FMC moves / MBLD score 转成统一刻度)
  let bestSingle = Infinity;
  let bestAvg = Infinity;
  const points = rows.map((r) => {
    const sAxis = r.best > 0 ? toAxisValue(r.best, eventId, 'single') : null;
    const aAxis = r.average > 0 ? toAxisValue(r.average, eventId, 'average') : null;
    let prS = false, prA = false;
    if (sAxis !== null && sAxis < bestSingle) { prS = true; bestSingle = sAxis; }
    if (aAxis !== null && aAxis < bestAvg)    { prA = true; bestAvg = aAxis; }
    return { r, sAxis, aAxis, prS, prA };
  }).filter((p) => p.sAxis !== null || p.aAxis !== null);

  if (points.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No data')}</div>;

  const xData = points.map((_, i) => String(i + 1));
  const interval = points.length > 12 ? Math.ceil(points.length / 10) : 0;
  const singleLabel = t('单次', 'Single');
  const avgLabel    = t('平均', 'Avg');

  const PR_RED = '#ef4444';
  const SINGLE_COLOR = '#3b82f6';
  const AVG_COLOR    = '#22c55e';
  // 用 markPoint 单独叠加 PR 红 dot — echarts 在 data 多时自动隐藏 line symbol
  const mkPRMarks = (key: 'sAxis' | 'aAxis', prKey: 'prS' | 'prA') =>
    points.flatMap((p, i) => {
      const v = p[key];
      return p[prKey] && v !== null ? [{ coord: [i, v] }] : [];
    });

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ dataIndex: number }>) => {
        if (!params || params.length === 0) return '';
        const p = points[params[0]!.dataIndex];
        if (!p) return '';
        const cmp = compById.get(p.r.competition_id);
        let tip = cmp ? `<strong>${localizeCompName(cmp.id, cmp.name, isZh)}</strong><br/>` : '';
        if (p.sAxis !== null) {
          const pr = p.prS ? ` <span style="color:${PR_RED}">PR</span>` : '';
          tip += `<span style="display:inline-block;width:10px;height:10px;background:${SINGLE_COLOR};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${singleLabel}: ${formatWcaResult(p.r.best, eventId, 'single')}${pr}<br/>`;
        }
        if (p.aAxis !== null) {
          const pr = p.prA ? ` <span style="color:${PR_RED}">PR</span>` : '';
          tip += `<span style="display:inline-block;width:10px;height:10px;background:${AVG_COLOR};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${avgLabel}: ${formatWcaResult(p.r.average, eventId, 'average')}${pr}<br/>`;
        }
        return tip;
      },
    },
    legend: { data: [singleLabel, avgLabel], top: 0 },
    grid: { left: '3%', right: '4%', bottom: 70, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { interval, show: false }, // 比赛序号意义不大
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (val: number) => {
          if (isFmc || isMbld) return String(val.toFixed(0));
          return formatTime(val);
        },
      },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      { type: 'slider', xAxisIndex: 0, height: 20, bottom: 20, start: 0, end: 100 },
    ],
    series: [
      {
        name: singleLabel,
        type: 'line', smooth: true,
        showSymbol: false,
        itemStyle: { color: SINGLE_COLOR },
        lineStyle: { color: SINGLE_COLOR },
        data: points.map((p) => p.sAxis),
        connectNulls: false,
        // single PR: 实心红圆
        markPoint: {
          symbol: 'circle', symbolSize: 9,
          itemStyle: { color: PR_RED, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: false },
          data: mkPRMarks('sAxis', 'prS'),
        },
      },
      {
        name: avgLabel,
        type: 'line', smooth: true,
        showSymbol: false,
        itemStyle: { color: AVG_COLOR },
        lineStyle: { color: AVG_COLOR },
        data: points.map((p) => p.aAxis),
        connectNulls: false,
        // avg PR: 红色钻石,跟 single 圆形区分,即使位置重叠也认得出
        markPoint: {
          symbol: 'diamond', symbolSize: 11,
          itemStyle: { color: PR_RED, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: false },
          data: mkPRMarks('aAxis', 'prA'),
        },
      },
    ],
  };

  return (
    <div style={{ height: 400 }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}

// 把 raw 值映射到 chart Y 轴(秒为主).
// FMC single = 步数;FMC avg = moves×100 → 步数;MBLD = points (越高越好,反向).
function toAxisValue(v: number, eventId: string, kind: 'single' | 'average'): number {
  if (eventId === '333fm') {
    if (kind === 'single') return v;
    return v / 100;
  }
  if (eventId === '333mbf') {
    // 0DDTTTTTMM: diff = 99 - DD, score = solved - missed = diff
    const s = String(v).padStart(10, '0');
    const dd = parseInt(s.slice(1, 3), 10);
    const diff = 99 - dd;
    // chart Y 轴用"被减分"作为时间替代:轴反向时不爽 — 直接 100 - score 让"越往下越好"
    return 100 - diff;
  }
  return v / 100; // centiseconds → seconds
}

function formatTime(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }
  return sec.toFixed(2);
}

// ─── 单次成绩分布 直方图 ──────────────────────────────────────────────
function DistChart({ eventId, rows, isZh }: { eventId: string; rows: WcaResultRow[]; isZh: boolean }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const W = 760, H = 220, P = { l: 36, r: 12, t: 12, b: 28 };

  const samples: number[] = [];
  for (const r of rows) {
    for (const a of r.attempts) {
      if (a > 0) samples.push(toAxisValue(a, eventId, 'single'));
    }
  }
  if (samples.length === 0) return <div className="wp-empty">{t('暂无样本', 'No samples')}</div>;

  const min = Math.min(...samples), max = Math.max(...samples);
  const nBins = Math.min(20, Math.max(6, Math.round(Math.sqrt(samples.length))));
  const bw = (max - min) / nBins || 1;
  const bins = Array.from({ length: nBins }, () => 0);
  for (const v of samples) {
    let i = Math.floor((v - min) / bw);
    if (i >= nBins) i = nBins - 1;
    if (i < 0) i = 0;
    bins[i]!++;
  }
  const peak = Math.max(...bins);
  const xScale = (i: number) => P.l + (i / nBins) * (W - P.l - P.r);
  const yScale = (n: number) => P.t + (1 - n / peak) * (H - P.t - P.b);

  return (
    <div className="wp-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="wp-chart-svg">
        <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} className="wp-chart-grid" />
        {bins.map((n, i) => {
          const x = xScale(i);
          const x2 = xScale(i + 1);
          const y = yScale(n);
          return n > 0 ? (
            <g key={i}>
              <rect x={x + 1} y={y} width={Math.max(1, x2 - x - 2)} height={(H - P.b) - y} className="wp-dist-bar" />
              {peak <= 30 && <text x={(x + x2) / 2} y={y - 3} className="wp-chart-axis" textAnchor="middle">{n}</text>}
            </g>
          ) : null;
        })}
        {/* x ticks: 5 labels */}
        {[0, 1, 2, 3, 4].map((k) => {
          const v = min + (max - min) * (k / 4);
          return (
            <text key={k} x={xScale((nBins * k) / 4)} y={H - P.b + 14} className="wp-chart-axis" textAnchor="middle">
              {eventId === '333fm' || eventId === '333mbf' ? v.toFixed(0) : formatTime(v)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 历史成绩排名 折线图 ──────────────────────────────────────────────
// echarts 版,直接 fork 自 cubing.pro `ResultWIthEventRankingTimers.tsx` (GPL-3.0)
// 6 条 series (NR/CR/WR × single/avg) + dataZoom slider + 触摸 + tooltip
function RankChart({ hist, isZh }: { hist: PersonRankHistoryResponse; isZh: boolean }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const rows = hist.rows.slice().sort(
    (a, b) => (a.year * 12 + (a.month ?? 0)) - (b.year * 12 + (b.month ?? 0))
  );
  if (rows.length === 0) return null;

  const xData = rows.map((r) =>
    r.month !== undefined ? `${r.year}-${String(r.month).padStart(2, '0')}` : String(r.year)
  );

  const series = [
    { key: 'singleCountryRank',   label: t('单次-NR', 'Single-NR'), color: '#1f3f78' },
    { key: 'singleContinentRank', label: t('单次-CR', 'Single-CR'), color: '#6ab15a' },
    { key: 'singleWorldRank',     label: t('单次-WR', 'Single-WR'), color: '#c39316' },
    { key: 'avgCountryRank',      label: t('平均-NR', 'Avg-NR'),    color: '#b71234' },
    { key: 'avgContinentRank',    label: t('平均-CR', 'Avg-CR'),    color: '#5fa3c7' },
    { key: 'avgWorldRank',        label: t('平均-WR', 'Avg-WR'),    color: '#2c7a4b' },
  ] as const;
  type RankKey = typeof series[number]['key'];

  const seriesData = (key: RankKey) =>
    rows.map((r) => {
      const v = r[key];
      return v !== null && v > 0 ? v : null;
    });

  const interval = rows.length > 12 ? Math.ceil(rows.length / 10) : 0;

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ dataIndex: number; name: string }>) => {
        if (!params || params.length === 0) return '';
        const idx = params[0]!.dataIndex;
        const getPrev = (key: RankKey, currIdx: number): number | null => {
          for (let i = currIdx - 1; i >= 0; i--) {
            const v = rows[i]![key];
            if (v !== null && v > 0) return v;
          }
          return null;
        };
        let tip = `<strong>${params[0]!.name}</strong><br/>`;
        for (const s of series) {
          const v = rows[idx]![s.key];
          if (v === null || v <= 0) continue;
          const prev = getPrev(s.key, idx);
          let change = '';
          if (prev !== null) {
            const diff = prev - v;
            if (diff > 0)      change = ` <span style="color:#22c55e">↑${diff}</span>`;
            else if (diff < 0) change = ` <span style="color:#ef4444">↓${-diff}</span>`;
          }
          tip += `<span style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${s.label}: ${v}${change}<br/>`;
        }
        return tip;
      },
    },
    legend: {
      data: series.map((s) => s.label),
      top: 0,
      type: 'scroll',
    },
    grid: { left: '3%', right: '4%', bottom: 70, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: -45, interval },
    },
    yAxis: {
      type: 'value',
      name: t('排名', 'Rank'),
      inverse: false, // 0 在底,大数在顶 — 同 cubing.pro
      min: 0,
      max: (val: { max: number }) => Math.ceil(val.max * 1.1),
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      { type: 'slider', xAxisIndex: 0, height: 20, bottom: 20, start: 0, end: 100 },
    ],
    series: series.map((s) => ({
      name: s.label,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      itemStyle: { color: s.color },
      lineStyle: { color: s.color },
      data: seriesData(s.key),
      connectNulls: false,
    })),
  };

  return (
    <div style={{ height: 400 }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}
