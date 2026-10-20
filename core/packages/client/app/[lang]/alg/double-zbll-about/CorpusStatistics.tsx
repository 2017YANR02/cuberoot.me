'use client';

import { useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { orientDoubleZbllScramble } from '@/lib/double-zbll';
import statistics from './statistics.json';

const number = (value: number) => value.toLocaleString('en-US');
const percent = (part: number, total: number) => part / total * 100;
type Example = typeof statistics.groups.pure.shortest[number];

function ExtremeScramble({ example }: { example: Example }) {
  const t = useT();
  // The exact training pipeline owns both the orientation and the layer swap.
  const oriented = orientDoubleZbllScramble(example.scramble);
  const top = oriented.swapped ? example.bottom : example.top;
  const bottom = oriented.swapped ? example.top : example.bottom;
  return <article className="dz-stats-example" data-site-surface="panel">
    <div className="dz-stats-pair"><span>{t('顶层', 'Top')} <strong>{top}</strong></span><span>{t('底层', 'Bottom')} <strong>{bottom}</strong></span></div>
    <p className="dz-about-muted">{example.htm} HTM · {example.qtm} QTM · {example.generators} {t('个转动面', 'distinct faces')}</p>
    <code className="dz-stats-scramble">{oriented.scramble}</code>
    {oriented.swapped && <p className="dz-about-muted">{t('为方便打乱已交换顶底；原配对：', 'Layers exchanged for the chosen grip; original pair: ')}{example.top} × {example.bottom}</p>}
    <AppLink className="dz-about-start" prefetch={false} href={`/sim?puzzle=3&img_dist=6&alg=${encodeURIComponent(oriented.scramble)}`}>{t('在模拟器中查看', 'View in simulator')} →</AppLink>
  </article>;
}

export default function CorpusStatistics({ pll }: { pll: boolean }) {
  const t = useT();
  const [distribution, setDistribution] = useState('htm');
  const group = statistics.groups[pll ? 'all' : 'pure'];
  const pure = statistics.groups.pure;
  const mean = group.totalHtm / group.count;
  const saved = statistics.baseline.meanHtm - pure.totalHtm / pure.count;
  const hist = distribution === 'htm' || distribution === 'stm' ? group.histogram : distribution === 'qtm' || distribution === 'sqtm' ? group.qtmHistogram : group.generators;
  const max = Math.max(...hist);
  const minutes = Math.round(statistics.compute.seconds / 60);
  return <section className="dz-statistics" aria-labelledby="dz-results">
    <div className="dz-about-section-head">
      <h2 id="dz-results">{t('完整题库 · 计算结果', 'Complete corpus · Results')}</h2>
    </div>
    <p className="dz-about-muted">{t('开关同步切换分布、极端情况和下方理论数量，不改变训练设置。每个顶底有序配对等权，不按实际抽题概率加权。', 'This switch updates distributions, extremes and theoretical counts below without changing training settings. Each ordered pair has equal weight, independently of training probabilities.')}</p>
    <div className="dz-about-counts">
      <article data-site-surface="panel"><span>{t('顶底配对', 'Ordered pairs')}</span><strong>{number(group.count)}</strong><code>{pll ? 493 : 472} × {pll ? 493 : 472} {t('个 case', 'cases')}</code></article>
      <article className="dz-about-result" data-site-surface="panel"><span>{t('平均 HTM', 'Mean HTM')}</span><strong>{mean.toFixed(3)}</strong><code>{t('范围', 'Range')} {group.shortest[0].htm}–{group.longest[0].htm} · {t('半转算一步', 'Half turn = 1 move')}</code></article>
      <article data-site-surface="panel"><span>{t('平均 QTM', 'Mean QTM')}</span><strong>{(group.totalQtm / group.count).toFixed(3)}</strong><code>{t('半转算两步', 'Half turn = 2 moves')}</code></article>
    </div>
    <p className="dz-stats-improvement">{t('纯 ZBLL 前后对比', 'ZBLL-only comparison')}：<strong>{statistics.baseline.meanHtm.toFixed(3)} → {(pure.totalHtm / pure.count).toFixed(3)} HTM</strong> · {t('平均减少', 'Mean reduction')} <strong>{saved.toFixed(3)}</strong> ({percent(saved, statistics.baseline.meanHtm).toFixed(2)}%)</p>
    <p className="dz-about-muted">{number(statistics.baseline.improvedPairs)} / {number(pure.count)} {t('对变短', 'pairs improved')} ({percent(statistics.baseline.improvedPairs, pure.count).toFixed(2)}%) · {t('最多减少', 'Largest reduction')} {statistics.baseline.maxSaved} HTM。{t('含 PLL 的配对没有旧题库基线，不混入改善幅度。', 'Pairs involving PLL have no previous-corpus baseline and are excluded from the improvement comparison.')}</p>

    <div className="dz-about-section-head dz-stats-subhead">
      <h3>{t('双底打乱分布', 'Double ZBLL scramble distribution')}</h3>
      <select className="dz-about-symmetry-select" aria-label={t('双底统计指标', 'Double ZBLL counting metric')} value={distribution} onChange={event => setDistribution(event.target.value)}>
        <option value="htm">HTM</option><option value="stm">STM</option><option value="sqtm">SQTM</option><option value="qtm">QTM</option><option value="generators">{t('转动面数量', 'Distinct faces')}</option>
      </select>
    </div>
    <table className="dz-stats-distribution">
      <thead><tr><th scope="col">{distribution === 'generators' ? t('面数', 'Faces') : t('步数', 'Moves')}</th><th scope="col">{t('配对数量', 'Pairs')}</th><th scope="col">{t('占比', 'Share')}</th><th scope="col"><span className="sr-only">{t('相对数量', 'Relative count')}</span></th></tr></thead>
      <tbody>{hist.map((count, value) => count ? <tr key={value}>
        <th scope="row">{value}</th><td>{number(count)}</td><td>{percent(count, group.count) < .1 ? '<0.1' : percent(count, group.count).toFixed(1)}%</td>
        <td><progress aria-label={`${value}: ${number(count)}`} value={count} max={max} /></td>
      </tr> : null)}</tbody>
    </table>
    <p className="dz-about-muted">{t('这是每对选出的最终打乱分布，不是全部 AUF 状态解法的分布。转动面数量只计不同面，例如 RU 为 2、RUF 为 3。', 'This distribution describes the final selected scramble per pair, not all AUF state solutions. Distinct faces count only the faces used: RU = 2, RUF = 3.')}</p>

    <h3>{t('极端情况 · 全部列出', 'Extreme cases · Complete list')}</h3>
    <p className="dz-about-muted">{t('以下公式已应用训练页同一套八朝向规则，显示、模拟器链接和顶底标记保持一致。互换顶底的两个有序配对分别保留；这里列出每对选中的打乱，不是所有同长解法。', 'Every scramble below uses the same eight-orientation rule as training, with matching simulator links and layer labels. Reversed ordered pairs are retained separately. These are the selected scrambles, not all solutions of equal length.')}</p>
    {(['shortest', 'longest'] as const).map(kind => <div key={kind}>
      <h4>{kind === 'shortest' ? t('最短', 'Shortest') : t('最长', 'Longest')} · {group[kind][0].htm} HTM · {group[kind].length} {t('对', 'pairs')}</h4>
      <div className="dz-stats-extremes">{group[kind].map(example => <ExtremeScramble key={`${example.top}|${example.bottom}`} example={example} />)}</div>
    </div>)}

    <h3>{t('计算规模与用时', 'Computation and time')}</h3>
    <dl className="dz-stats-compute">
      <div><dt>{t('已完成并验证的代表状态', 'Solved and verified representatives')}</dt><dd>{number(statistics.sourceStates)} / {number(statistics.sourceStates)}</dd></div>
      <div><dt>{t('运行记录累计用时', 'Recorded cumulative runtime')}</dt><dd>{Math.floor(minutes / 60)} {t('小时', 'h')} {minutes % 60} {t('分钟', 'min')}</dd></div>
      <div><dt>{t('最终求解引擎', 'Final solver engine')}</dt><dd>Rust Opt10 coset</dd></div>
    </dl>
    <p className="dz-about-muted">{t('用时来自可续算任务的累计运行记录，不包含停止期间；任务期间更换过引擎、线程数，并导入过旧结果，因此不是单一配置从零求解的基准。统计按完整题库生成，训练页只选取和转换已有打乱，不重新求解。', 'Time comes from the resumable job’s cumulative runtime, excluding stopped periods. The job changed engines and thread counts and imported earlier results; this is not a from-scratch benchmark of one configuration. Training selects and transforms existing scrambles without running the solver again.')}</p>
    <p className="dz-about-muted">{t('题库版本', 'Corpus version')} <code>{statistics.version}</code> · {t('数据生成时间（UTC）', 'Data generated (UTC)')} <time dateTime={statistics.generatedAt}>{statistics.generatedAt.replace('T', ' ').slice(0, 16)}</time></p>
  </section>;
}
