'use client';

import { useMemo, useState } from 'react';
import type { Metric } from '@cuberoot/shared/alg-notation';
import { SCRAMBLE_KINDS } from '@/lib/trainer-scramble';
import { useT } from '@/hooks/useT';
import { histogramFor, singleModes, summarizeHistogram, type Mode, type StatisticsData } from './useStatisticsData';
import statistics from './statistics.json';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export default function StatisticsOverview({ pll, data, selected, onSelect }: {
  pll: boolean; data: StatisticsData; selected: Mode; onSelect: (mode: Mode) => void;
}) {
  const t = useT();
  const [metric, setMetric] = useState<Metric>('htm');
  const groups = useMemo(() => {
    const corpus = statistics.groups[pll ? 'all' : 'pure'];
    // The double corpus contains face turns only, so STM=HTM and SQTM=QTM.
    const doubleHistogram = metric === 'htm' || metric === 'stm' ? corpus.histogram : corpus.qtmHistogram;
    return [
      { mode: 'double-zbll' as const, histogram: doubleHistogram, fallback: 0, ready: true },
      ...singleModes.map(mode => ({
        mode, histogram: histogramFor(data.rows[mode], metric),
        fallback: data.rows[mode].filter(row => row.fallback).length,
        ready: data.cases.length > 0 && (mode !== 'cstimer' || !data.running),
      })),
    ].map(group => ({ ...group, ...summarizeHistogram(group.histogram) }));
  }, [pll, data.rows, data.cases.length, data.running, metric]);
  const label = (mode: Mode) => mode === 'double-zbll' ? t('双底 HTM', 'Double ZBLL HTM') : SCRAMBLE_KINDS.find(k => k.id === mode)!.label();
  const limit = Math.max(20, ...groups.map(group => group.max));
  const peak = Math.ceil(Math.max(.1, ...groups.flatMap(group => group.histogram.map(n => group.count ? n / group.count : 0))) * 10) / 10;
  const unit = metric.toUpperCase();
  return <section className="dz-overview" aria-labelledby="dz-overview-title">
    <div className="dz-about-section-head">
      <div><span className="dz-about-eyebrow">01 / {t('全模式总览', 'ALL MODES')}</span><h2 id="dz-overview-title">{t('八种打乱，放在一起看', 'Eight scramble modes, side by side')}</h2></div>
      <label>{t('统一计步标准', 'Shared counting metric')} <select aria-label={t('统一计步标准', 'Shared counting metric')} className="dz-about-symmetry-select" value={metric} onChange={e => setMetric(e.target.value as Metric)}>
        {(['htm', 'stm', 'sqtm', 'qtm'] as const).map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
      </select></label>
    </div>
    <p className="dz-about-muted">{t('下面八张图分别对应训练菜单的八种打乱方式。统一横轴为步数、纵轴为占比，方便比较形状；点击卡片查看该模式的明细与极端实例。', 'Each chart corresponds to one of the eight training modes. Shared axes show move count and percentage, making distribution shapes comparable. Select a card for details and extreme examples.')}</p>
    <p className="dz-about-muted">{t('双底每条打乱包含两个 case，按有序配对等权；其余每条一个 case，按单层 case 等权。这里比较打乱长度，不表示训练效率或还原难度。', 'Double ZBLL trains two cases per scramble and weights ordered pairs equally; other modes weight individual cases equally. These charts compare scramble lengths, not training efficiency or solving difficulty.')}</p>
    {data.error && <p role="alert">{t('单层题库加载失败，双底统计仍可查看。', 'Single-layer data failed to load; double ZBLL statistics remain available.')} <button onClick={data.retry}>{t('重试', 'Retry')}</button></p>}
    {data.running && <p role="status">{data.cases.length ? `${t('csTimer 样本生成中', 'Generating csTimer samples')}: ${data.progress} / ${data.cases.length}` : <LoadingIndicator>{t('正在加载单层题库…', 'Loading the single-layer corpus…')}</LoadingIndicator>}</p>}
    <div className="dz-chart-grid">
      {groups.map(group => <button type="button" className="dz-mode-chart" data-site-surface="panel" key={group.mode} aria-pressed={selected === group.mode} onClick={() => onSelect(group.mode)}>
        <span className="dz-mode-heading"><strong>{label(group.mode)}</strong><span>{group.mode === 'double-zbll' ? t('双层 · 完整题库', 'Two layers · full corpus') : group.mode === 'cstimer' ? t('单层 · 样本', 'Single layer · sample') : t('单层 · 题库', 'Single layer · corpus')}</span></span>
        {group.ready && group.count > 0 ? <>
          <span className="dz-mode-mean">{group.mean.toFixed(2)} <small>{unit} · {t('平均', 'mean')}</small></span>
          <svg viewBox="0 0 360 145" role="img" aria-label={`${label(group.mode)} ${t('分布', 'distribution')}: ${group.min}–${group.max} ${unit}`}>
            {[0, .5, 1].map(f => <g key={f}><line x1="34" x2="352" y1={112 - f * 94} y2={112 - f * 94} className="dz-chart-gridline" /><text x="29" y={116 - f * 94} textAnchor="end">{Math.round(peak * f * 100)}%</text></g>)}
            {group.histogram.map((n, moves) => n ? <rect key={moves} x={34 + moves / (limit + 1) * 318} y={112 - n / group.count / peak * 94} width={Math.max(2, 318 / (limit + 1) - 1)} height={n / group.count / peak * 94} rx="1"><title>{`${moves} ${unit}: ${n.toLocaleString('en-US')} (${(n / group.count * 100).toFixed(2)}%)`}</title></rect> : null)}
            {Array.from({ length: Math.floor(limit / 5) + 1 }, (_, i) => i * 5).map(n => <text key={n} x={34 + (n + .5) / (limit + 1) * 318} y="132" textAnchor="middle">{n}</text>)}
          </svg>
          <span className="dz-mode-facts"><span>{t('范围', 'Range')} <b>{group.min}–{group.max}</b></span><span>{t('中位数', 'Median')} <b>{group.median}</b></span><span>P90 <b>{group.p90}</b></span></span>
          <span className="dz-mode-note">{group.count.toLocaleString('en-US')} {group.mode === 'double-zbll' ? t('个配对', 'pairs') : t('个 case', 'cases')} · {t('回退', 'Fallback')}: {group.fallback}{group.mode === 'cstimer' ? ` · ${t('失败', 'Failed')}: ${data.failed}` : ''}</span>
        </> : <span className="dz-chart-placeholder">{data.error ? t('数据暂不可用', 'Data unavailable') : group.ready ? t('没有成功样本', 'No successful samples') : t('正在准备分布…', 'Preparing distribution…')}</span>}
        <span className="dz-mode-link">{t('查看明细与极端情况', 'Details and extremes')} ↓</span>
      </button>)}
    </div>
    <div className="dz-range-chart" data-site-surface="panel">
      <h3>{t('平均、范围与长尾', 'Mean, range and long tails')}</h3>
      <p className="dz-about-muted">{t('细线：最短到最长；圆点：平均；竖线：P90（至少 90% 的打乱不超过此步数）。所有行使用同一横轴。', 'Line: minimum to maximum. Dot: mean. Tick: P90 (at least 90% of scrambles are no longer than this). All rows share one scale.')}</p>
      {groups.map(group => <div className="dz-range-row" key={group.mode}>
        <span>{label(group.mode)}</span>
        <svg viewBox="0 0 500 32" role="img" aria-label={group.ready ? `${label(group.mode)}: ${group.min}–${group.max}, ${t('平均', 'mean')} ${group.mean.toFixed(2)}, P90 ${group.p90}` : t('数据准备中', 'Loading data')}>
          {Array.from({ length: Math.floor(limit / 5) + 1 }, (_, i) => i * 5).map(n => <line key={n} x1={12 + n / limit * 476} x2={12 + n / limit * 476} y1="0" y2="32" className="dz-chart-gridline" />)}
          {group.ready && group.count > 0 && <g><line x1={12 + group.min / limit * 476} x2={12 + group.max / limit * 476} y1="16" y2="16" className="dz-range-line" /><circle cx={12 + group.mean / limit * 476} cy="16" r="5" /><line x1={12 + group.p90 / limit * 476} x2={12 + group.p90 / limit * 476} y1="7" y2="25" className="dz-range-line" /></g>}
        </svg><strong>{group.ready && group.count ? group.mean.toFixed(2) : '—'}</strong>
      </div>)}
      <div className="dz-range-row"><span>{unit}</span><svg viewBox="0 0 500 25" aria-hidden>{Array.from({ length: Math.floor(limit / 5) + 1 }, (_, i) => i * 5).map(n => <text key={n} x={12 + n / limit * 476} y="17" textAnchor="middle">{n}</text>)}</svg><span /></div>
    </div>
    <p className="dz-about-muted">{t('口径：单层不额外添加 AUF；缺失模式数据按训练器规则回退逆 case，已计入分布并标明数量。csTimer 每个 case 生成一条样本，极值仅代表本次样本；失败不回填。双底只有外层转动，因此 STM＝HTM、SQTM＝QTM。', 'Scope: no extra AUF for single-layer scrambles. Missing mode data falls back to inverse case as in training and is included with its count disclosed. csTimer generates one sample per case; extremes are sample observations, with failures excluded. Double ZBLL uses only face turns, so STM=HTM and SQTM=QTM.')}</p>
  </section>;
}
