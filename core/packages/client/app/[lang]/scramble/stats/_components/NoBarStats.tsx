'use client';

import { useEffect, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';
import { eventDisplayName } from '@/lib/wca-events';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';

interface Example {
  id: string; scramble: string; competition: string; event: string;
  round: string; group: string; number: number; extra: boolean; cube: number;
}
interface Counts { total: number; matches: number; examples: Example[] }
interface NoBarData {
  meta: { exportDate: string; twoExampleLimit: number };
  three: { total: number; matches: number };
  events: Record<string, Counts>;
}

/** Page-specific report; classification is performed only by the offline pipeline. */
export default function NoBarStats({ event, isZh }: { event: string; isZh: boolean }) {
  const [data, setData] = useState<NoBarData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(statsUrl('/stats/scramble/no_bar.json') + '?v=1', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then(setData)
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  const selected = data?.events[event];
  const family = event !== '222';
  const counts = family ? data?.three : selected;
  const examples = data ? (family ? Object.entries(data.events).filter(([id]) => id !== '222').flatMap(([, value]) => value.examples) : selected?.examples ?? []) : [];
  return (
    <details className="scramble-stats-examples">
      <summary>
        {tr({ zh: '无连色', en: 'No Bar' })}
        {counts && ` · ${counts.matches.toLocaleString()} / ${counts.total.toLocaleString()}`}
      </summary>
      <p>{tr({
        zh: '六个面内所有共边相邻色块均不同色，三阶包含中心块；对角相邻不计。',
        en: 'Every pair of edge-adjacent stickers on each of the six faces differs in colour, including centres on 3×3. Diagonals do not count.',
      })}</p>
      {!data && <p>{failed ? tr({ zh: '数据加载失败，请刷新重试。', en: 'Could not load data. Please refresh to retry.' }) : tr({ zh: '加载中…', en: 'Loading…' })}</p>}
      {data && counts && <>
        <p>{tr({
          zh: `WCA 导出 ${data.meta.exportDate}。${family ? '合计三阶、单手、三盲、多盲、最少步及脚拧，多盲每颗魔方单独计数。' : ''}包含备打，相同打乱在不同记录中重复计数。`,
          en: `WCA export ${data.meta.exportDate}. ${family ? 'Includes 3×3, one-handed, blindfolded, multi-blind, fewest moves and with feet; each multi-blind cube counts separately. ' : ''}Includes extra scrambles. Repeated sequences count as separate occurrences.`,
        })}</p>
        <p>{tr({
          zh: `实测频率 ${(100 * counts.matches / counts.total).toFixed(5)}%${counts.matches ? `，约 ${(counts.total / counts.matches).toFixed(1)} 分之一` : ''}。这是导出样本的频率，不是理论概率。`,
          en: `Observed frequency: ${(100 * counts.matches / counts.total).toFixed(5)}%${counts.matches ? `, about 1 in ${(counts.total / counts.matches).toFixed(1)}` : ''}. This is the export's empirical frequency, not a theoretical probability.`,
        })}</p>
        {family && <ul>{Object.entries(data.events).filter(([id, value]) => id !== '222' && value.total > 0).map(([id, value]) => (
          <li key={id}>{eventDisplayName(id, isZh)}: {value.matches.toLocaleString()} / {value.total.toLocaleString()}</li>
        ))}</ul>}
        <p>{family ? tr({ zh: '以下列出全部三阶类命中打乱。', en: 'All matching 3×3-family scrambles are listed below.' }) : tr({ zh: `以下展示前 ${data.meta.twoExampleLimit} 条二阶样例。`, en: `The first ${data.meta.twoExampleLimit} matching 2×2 examples are shown below.` })}</p>
        <ul className="scramble-stats-examples-list">{examples.map(example => (
          <li key={example.id}>
            <ScramblePreview2D event={family ? '333' : '222'} scramble={example.scramble} size={26} />
            <div>
              <a href={`https://www.worldcubeassociation.org/competitions/${example.competition}`} target="_blank" rel="noopener noreferrer">{example.competition}</a>
              {' · '}{eventDisplayName(example.event, isZh)}{' · '}
              {tr({ zh: `轮次 ${example.round} · 组 ${example.group} · 第 ${example.number} 条`, en: `Round ${example.round} · Group ${example.group} · Scramble ${example.number}` })}
              {(example.event === '333mbf' || example.event === '333mbo') && ` · ${tr({ zh: `第 ${example.cube} 颗`, en: `Cube ${example.cube}` })}`}
              {example.extra && ` · ${tr({ zh: '备打', en: 'Extra' })}`}
              <p><code>{example.scramble}</code></p>
            </div>
          </li>
        ))}</ul>
      </>}
    </details>
  );
}
