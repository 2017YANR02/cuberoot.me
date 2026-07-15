'use client';

// 首步状态图示 —— 展示某一步(2×2 首面 / 金字塔 V)的全部本质不同状态,无关块变灰。
// 数据由 scripts/build_*_firstface 预生成的静态 JSON 提供(代表打乱 + 该步步数 metric +
// 镜像组 mgid + 该打乱的一条最优解 sol,|sol| == metric)。渲染走 ScramblePreview2D 的 mask
// (灰阶随块跟随打乱)。2×2 与金字塔共用本组件,差异走 props。
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';
import './_essential-shared.css';
import './_gallery.css';

export type GalleryRow = [scramble: string, metric: number, mgid: number, sol?: string];

interface Props {
  event: '222' | 'pyram';
  mask: string;
  rows: GalleryRow[];
  /** total before mirror fold / after mirror fold — shown in the summary. */
  totalReorient: number;
  totalMirror: number;
  /** 步数下拉的标签,如「底面 / Face」(2×2 首面)、「V」(金字塔 V 首步)。 */
  metricLabel: { zh: string; en: string };
}

export default function FirstStepGallery({
  event, mask, rows, totalReorient, totalMirror, metricLabel,
}: Props) {
  const [foldMirror, setFoldMirror] = useState(true);
  const [pick, setPick] = useState<number | null>(null);

  // mirror fold: keep one representative per mgid (rows already sorted hardest-first).
  const shown = useMemo(() => {
    if (!foldMirror) return rows;
    const seen = new Set<number>();
    const out: GalleryRow[] = [];
    for (const r of rows) { if (seen.has(r[2])) continue; seen.add(r[2]); out.push(r); }
    return out;
  }, [rows, foldMirror]);

  // group into sections by metric value (descending — hardest first).
  const sections = useMemo(() => {
    const by = new Map<number, GalleryRow[]>();
    for (const r of shown) { const arr = by.get(r[1]) ?? []; arr.push(r); by.set(r[1], arr); }
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
  }, [shown]);

  // default to the first (hardest) section; re-pin if the fold toggle changes what's available.
  const active = pick != null && sections.some(([m]) => m === pick) ? pick : (sections[0]?.[0] ?? null);
  const picked = sections.filter(([m]) => m === active);
  const pickedCount = picked.reduce((s, [, list]) => s + list.length, 0);
  const size = 42;

  return (
    <div className="scramble-stats-panel">
      <div className="ess-stat-controls">
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">
            {tr({ zh: '镜像合并', en: 'Fold mirrors' })}
          </span>
          <PillToggle
            value={foldMirror}
            onChange={setFoldMirror}
            ariaLabel={tr({ zh: '是否合并镜像情况', en: 'Fold mirror-image cases' })}
          />
        </div>
        <label className="ess-filter">
          <span>{tr(metricLabel)}</span>
          <select
            className="scramble-stats-select"
            value={String(active)}
            onChange={(e) => setPick(Number(e.target.value))}
          >
            {sections.map(([m]) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <span className="scramble-stats-puzzle-metric">
          {tr({ zh: '共 {a}/{b} 个', en: '{a}/{b} cases' })
            .replace('{a}', String(pickedCount))
            .replace('{b}', String(foldMirror ? totalMirror : totalReorient))}
        </span>
        <span className="scramble-stats-puzzle-metric">
          {tr({ zh: '首行为打乱', en: 'First line = scramble' })}
        </span>
      </div>

      {picked.map(([m, list]) => (
        <div key={m} className="gal-section">
          <div className="gal-grid">
            {list.map((r, i) => (
              <Link
                key={`${m}-${i}-${r[0]}`}
                className="gal-cell"
                href={`/scramble/solver?event=${event}&scramble=${encodeURIComponent(r[0])}`}
                prefetch={false}
                aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
              >
                <ScramblePreview2D event={event} scramble={r[0]} mask={mask} size={size} />
                <span className="gal-alg gal-scramble" title={tr({ zh: '打乱', en: 'Scramble' })}>
                  {r[0]}
                </span>
                {r[3] && (
                  <span className="gal-alg gal-solution" title={tr({ zh: '解法', en: 'Solution' })}>
                    {r[3]}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
