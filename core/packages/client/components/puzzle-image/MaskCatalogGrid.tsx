'use client';

/**
 * MaskCatalogGrid — the stage-mask cheat sheet (~147 cards), driven by
 * STAGE_SECTIONS in lib/puzzle-image/masks.ts.
 *
 * `basePath` is the editor a card opens: '/visualcube' today, '/sim' once the
 * image panel lands there. The href is lang-prefixed (avoids the proxy.ts
 * bare-path 308 on click) and prefetch is off — Next's viewport prefetch would
 * otherwise fire ~147 RSC requests per page view.
 */

import { useParams } from 'next/navigation';
import Link from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { STAGE_SECTIONS } from '@/lib/puzzle-image/masks';
import { tr } from '@/i18n/tr';
import './mask-catalog.css';

const THUMB_SIZE = 110;

function StageCard({
  href, cubeSize, label, mask,
}: { href: string; cubeSize: number; label: string; mask: string }) {
  return (
    <Link className="vcs-card" href={href} title={`mask=${mask}`} prefetch={false}>
      <div className="vcs-thumb">
        <VisualCube
          algorithm=""
          view="trans"
          mask={mask}
          size={THUMB_SIZE}
          puzzleSize={cubeSize}
          alt={label}
        />
      </div>
      <div className="vcs-label">{label}</div>
    </Link>
  );
}

export interface MaskCatalogGridProps {
  /** Editor route a card opens, e.g. '/visualcube'. */
  basePath: string;
  className?: string;
}

export default function MaskCatalogGrid({ basePath, className }: MaskCatalogGridProps) {
  const params = useParams();
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';

  return (
    <div className={className}>
      {STAGE_SECTIONS.map((section) => (
        <section className="vcs-section" key={section.title.en}>
          <h2 className="vcs-section-title">
            {tr(section.title)}
            <span className="vcs-count">({section.items.length})</span>
          </h2>
          <div className="vcs-grid">
            {section.items.map((item) => (
              <StageCard
                key={`${section.title.en}-${item.label}`}
                href={`/${lang}${basePath}?pzl=${section.cubeSize}&stage=${encodeURIComponent(item.mask)}&view=trans`}
                cubeSize={section.cubeSize}
                label={item.label}
                mask={item.mask}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
