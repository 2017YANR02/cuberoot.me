'use client';

import { useEffect, useMemo, useState } from 'react';
import { countMoves, type Metric } from '@cuberoot/shared/alg-notation';
import type { StatisticsData } from './useStatisticsData';
import { SCRAMBLE_KINDS, type ScrambleKind } from '@/lib/trainer-scramble';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const metrics: Metric[] = ['htm', 'stm', 'sqtm', 'qtm'];
export default function SingleStatistics({ kind, data }: { kind: ScrambleKind; data: StatisticsData }) {
  const t = useT();
  const { cases, error, running, progress, failed, retry } = data;
  const [metric, setMetric] = useState<Metric>('htm');
  useEffect(() => {
    setMetric(metrics.includes(kind as Metric) ? kind as Metric : 'htm');
  }, [kind]);
  const rows = useMemo(() => (data.rows[kind] ?? []).map(row => ({ ...row, length: countMoves(row.scramble, metric) })), [data.rows, kind, metric]);
  const histogram = new Map<number, number>();
  for (const row of rows) histogram.set(row.length, (histogram.get(row.length) ?? 0) + 1);
  const lengths = [...histogram.keys()].sort((a, b) => a - b);
  const min = lengths[0], max = lengths[lengths.length - 1];
  const fallback = rows.filter(row => row.fallback).length;
  const label = SCRAMBLE_KINDS.find(item => item.id === kind)?.label();
  return <section aria-label={label}>
    <h2>{label}</h2>
    <p>{kind === 'inv' ? t('使用题库 setup；缺少 setup 时取首条公式的逆。通常接近熟悉公式的倒序，不保证最短。', 'Uses the stored setup, or the inverse of the first algorithm if no setup exists. It is not guaranteed shortest.') : kind === 'coep' ? t('COEP 使用题库中角朝向与棱排列组合构造的打乱，便于观察结构，不保证任何一种度量全局最短。', 'COEP uses the stored corner-orientation / edge-permutation construction. It exposes structure but does not guarantee a global minimum in any metric.') : kind === 'cstimer' ? t('用本站训练页同一两阶段求解器，为每个 case 的固定状态生成一条等价纯面转打乱。这是 csTimer 风格，不是调用 csTimer 网站，也不保证最短。', 'The training page’s two-phase solver generates one equivalent face-turn scramble for each fixed case state. This is csTimer-style generation, not a call to the csTimer website, and does not guarantee optimality.') : t('使用题库中对应度量的最优打乱。最优只针对指定度量；换一个计步标准，长度和排名可能变化。', 'Uses the corpus scramble optimized for the selected metric. Optimality applies to that metric; lengths and rankings can differ under another metric.')}</p>
    <p className="dz-about-muted">{t('单层 case 等权；统计完整可训练题库，不跟随个人勾选范围或抽题权重。使用基础打乱，不额外添加起手／收尾 AUF；训练时随机 AUF 及相邻步合并可能改变长度。双底按有序配对统计，不能直接比较总数。', 'Single-layer cases have equal weight across the full trainable corpus, independent of personal selections or draw weights. Base scrambles exclude additional pre/post AUF; random AUF and adjacent-move merging in training can change lengths. Double ZBLL counts ordered pairs, so totals are not directly comparable.')}</p>
    {error ? <p role="alert">{t('题库加载失败。', 'Could not load the corpus.')} <button onClick={retry}>{t('重试', 'Retry')}</button></p> : !cases.length ? <p role="status"><LoadingIndicator>{t('正在加载题库…', 'Loading corpus…')}</LoadingIndicator></p> : kind === 'cstimer' && running ? <p role="status">{t('正在生成样本', 'Generating samples')} {progress} / {cases.length}</p> : <>
      {kind === 'cstimer' && <p className="dz-about-muted">{t('每个 case 一条样本；以下最短／最长只是本次样本极值，不是理论边界。重新加载题库可能得到不同结果。失败的样本不使用逆 case 冒充。', 'One sample per case. Extremes below are observed sample extremes, not theoretical bounds. Reloading the corpus may produce different results. Failed samples are excluded, never replaced with inverse-case scrambles.')} {t('失败', 'Failed')}: {failed}</p>}
      <p className="dz-about-muted">{t('覆盖', 'Coverage')}: {rows.length} / {cases.length} · {t('缺少该模式打乱，按训练规则回退逆 case', 'Missing mode data; falls back to inverse case as in training')}: {fallback}</p>
      <label>{t('计步标准', 'Counting metric')} <select aria-label={t('计步标准', 'Counting metric')} className="dz-about-symmetry-select" value={metric} onChange={e => setMetric(e.target.value as Metric)}>{metrics.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></label>
      {rows.length > 0 && <>
        <div className="dz-about-counts">
          <article data-site-surface="panel"><span>{t('平均步数', 'Mean length')}</span><strong>{(rows.reduce((sum, row) => sum + row.length, 0) / rows.length).toFixed(3)}</strong><code>{metric.toUpperCase()}</code></article>
          <article data-site-surface="panel"><span>{t('最短', 'Shortest')}</span><strong>{min}</strong><code>{histogram.get(min)} {t('个 case', 'cases')}</code></article>
          <article data-site-surface="panel"><span>{t('最长', 'Longest')}</span><strong>{max}</strong><code>{histogram.get(max!)} {t('个 case', 'cases')}</code></article>
        </div>
        <h3>{t('步数分布', 'Move-count distribution')}</h3>
        <table className="dz-stats-distribution"><thead><tr><th scope="col">{metric.toUpperCase()}</th><th scope="col">{t('数量', 'Count')}</th><th scope="col">{t('占比', 'Share')}</th><th scope="col">{t('分布', 'Distribution')}</th></tr></thead><tbody>{lengths.map(length => <tr key={length}><th scope="row">{length}</th><td>{histogram.get(length)}</td><td>{(100 * histogram.get(length)! / rows.length).toFixed(2)}%</td><td><progress aria-label={`${length} ${metric.toUpperCase()}`} value={histogram.get(length)} max={Math.max(...histogram.values())} /></td></tr>)}</tbody></table>
        <h3>{t('极端情况 · 全部并列 case', 'Extremes · All tied cases')}</h3>
        {[...new Set([min, max])].map(length => <details key={length}><summary>{length === min ? t('最短', 'Shortest') : t('最长', 'Longest')} · {length} {metric.toUpperCase()} · {histogram.get(length)} {t('个 case', 'cases')}</summary><div className="dz-stats-extremes">{rows.filter(row => row.length === length).map(row => <article className="dz-stats-example" data-site-surface="panel" key={row.name}><strong>{row.name}</strong>{row.fallback && <p>{t('逆 case 回退', 'Inverse-case fallback')}</p>}<p>{metrics.map(m => `${countMoves(row.scramble, m)} ${m.toUpperCase()}`).join(' · ')}</p><code className="dz-stats-scramble">{row.scramble}</code><AppLink className="dz-about-start" prefetch={false} href={`/sim?puzzle=3&alg=${encodeURIComponent(row.scramble)}`}>{t('在模拟器中查看', 'View in simulator')} →</AppLink></article>)}</div></details>)}
      </>}
    </>}
  </section>;
}
