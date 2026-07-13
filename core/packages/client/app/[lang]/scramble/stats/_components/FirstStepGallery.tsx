'use client';

// 首步案例画廊 —— 展示某一步(2×2 首面 / 金字塔 V)的全部本质不同情况,无关块变灰。
// 数据由 scripts/build_*_firstface / _v 预生成的静态 JSON 提供(整体重定向去重后的代表打乱 +
// 该步步数 metric + 镜像组 mgid)。渲染走 ScramblePreview2D 的 mask(灰阶随块跟随打乱)。
// 2×2 与金字塔共用本组件,差异走 props。
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';
import './_essential-shared.css';
import './_gallery.css';

type Bilingual = { zh: string; en: string };
export type GalleryRow = [scramble: string, metric: number, mgid: number];

interface Props {
  event: '222' | 'pyram';
  mask: string;
  rows: GalleryRow[];
  /** total before mirror fold / after mirror fold — shown in the summary. */
  totalReorient: number;
  totalMirror: number;
  /** metric symbol + full name, e.g. { sym:'F', name:{…} }. */
  metric: { sym: string; name: Bilingual };
  /** i18n note under the gallery. */
  note: Bilingual;
}

export default function FirstStepGallery({
  event, mask, rows, totalReorient, totalMirror, metric, note,
}: Props) {
  const [foldMirror, setFoldMirror] = useState(false);

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

  const size = 42;

  return (
    <div className="scramble-stats-panel">
      <div className="scramble-stats-panel-title">
        {tr({ zh: '案例画廊(无关块变灰)', en: 'Case gallery (irrelevant pieces grayed)' })}
      </div>

      <div className="ess-stat-controls">
        <div className="scramble-stats-puzzle-toggle">
          <span className="scramble-stats-puzzle-toggle-label">
            {tr({ zh: '镜像合并', en: 'Fold mirrors' })}
          </span>
          <PillToggle
            value={foldMirror}
            onChange={setFoldMirror}
            onLabel={tr({ zh: '合并', en: 'On' })}
            offLabel={tr({ zh: '全部', en: 'Off' })}
            ariaLabel={tr({ zh: '是否合并镜像情况', en: 'Fold mirror-image cases' })}
          />
        </div>
        <span className="scramble-stats-puzzle-metric">
          {tr({ zh: '共 {n} 个本质情况', en: '{n} essential cases' })
            .replace('{n}', String(foldMirror ? totalMirror : totalReorient))}
          {' · '}
          {foldMirror
            ? tr({ zh: '已合并镜像', en: 'mirrors folded' })
            : tr({ zh: '{a} → 合并镜像 {b}', en: '{a} → {b} folded' })
                .replace('{a}', String(totalReorient)).replace('{b}', String(totalMirror))}
        </span>
      </div>

      {sections.map(([m, list]) => (
        <div key={m} className="gal-section">
          <div className="gal-section-head">
            <span className="gal-section-metric">{metric.sym} = {m}</span>
            <span className="gal-section-count">{list.length}</span>
          </div>
          <div className="gal-grid">
            {list.map((r, i) => (
              <Link
                key={`${m}-${i}-${r[0]}`}
                className="gal-cell"
                href={`/scramble/${event}?scramble=${encodeURIComponent(r[0])}`}
                prefetch={false}
                title={r[0]}
                aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
              >
                <ScramblePreview2D event={event} scramble={r[0]} mask={mask} size={size} />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="ess-note">
        {tr(note)}
        {' '}
        {tr({
          zh: `${metric.sym} = ${tr(metric.name)};灰块 = 该步无关的块(灰阶随块跟随打乱)。点缩略图在求解器中打开。`,
          en: `${metric.sym} = ${tr(metric.name)}; gray pieces are irrelevant to this step (the gray follows each piece through the scramble). Click a thumbnail to open it in the solver.`,
        })}
      </div>
    </div>
  );
}
