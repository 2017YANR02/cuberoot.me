'use client';

/**
 * MaskCatalogGrid — the stage-mask cheat sheet (~147 cards), driven by
 * STAGE_SECTIONS in lib/puzzle-image/masks.ts.
 *
 * `hrefFor` is the caller's business: what a card opens, and in whose query-key
 * vocabulary. The href it returns must be lang-prefixed (avoids the proxy.ts
 * bare-path 308 on click); prefetch is off here — Next's viewport prefetch would
 * otherwise fire ~147 RSC requests per page view.
 */

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
  /** Where a card goes. Must be lang-prefixed — see the file header. */
  hrefFor: (cubeSize: number, mask: string) => string;
  className?: string;
}

export default function MaskCatalogGrid({ hrefFor, className }: MaskCatalogGridProps) {
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
                href={hrefFor(section.cubeSize, item.mask)}
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
