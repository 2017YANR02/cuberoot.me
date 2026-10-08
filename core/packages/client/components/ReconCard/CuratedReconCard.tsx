'use client';

import type { ComponentProps } from 'react';
import { Pin, PinOff, Star } from 'lucide-react';
import { ReconCard } from './ReconCard';
import { tr } from '@/i18n/tr';

interface CurationAction {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/** Card links and admin controls are siblings so pinning never opens the solve. */
export function CuratedReconCard({ pin, featured, ...card }: ComponentProps<typeof ReconCard> & {
  pin?: CurationAction;
  featured?: CurationAction;
}) {
  const pinLabel = pin?.active ? tr({ zh: '取消置顶', en: 'Unpin from homepage' }) : tr({ zh: '置顶到主页', en: 'Pin to homepage' });
  const featuredLabel = featured?.active ? tr({ zh: '取消精选', en: 'Remove from featured solves' }) : tr({ zh: '加入精选', en: 'Add to featured solves' });
  if (!pin && !featured) return <ReconCard {...card} />;
  return (
    <div className="recon-curated-card">
      <ReconCard {...card} />
      <div className="recon-curation-actions">
        {pin && <button type="button" className="recon-curation-button" title={pinLabel} aria-label={pinLabel}
          aria-pressed={pin.active} disabled={pin.disabled} onClick={pin.onToggle}>
          {pin.active ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
        </button>}
        {featured && <button type="button" className="recon-curation-button" title={featuredLabel} aria-label={featuredLabel}
          aria-pressed={featured.active} disabled={featured.disabled} onClick={featured.onToggle}>
          <Star size={16} fill={featured.active ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>}
      </div>
    </div>
  );
}
