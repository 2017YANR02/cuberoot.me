'use client';

// Canonical link to a WCA person profile (/wca/persons/:id). Centralizes the
// route + prefetch policy that was inlined across ~20 files.
//   - AppLink handles the /zh lang prefix, so we pass the bare path (any hard-
//     coded /en|/zh a caller used to prepend is redundant — AppLink normalizes
//     it away anyway).
//   - prefetch defaults OFF: person tables render hundreds of these; prefetching
//     each would be a prefetch storm.
//   - display defaults to displayCuberName(name, isZh); pass `children` to
//     override (e.g. nameByMode, or a Flag + name composition inside the link).

import type { ReactNode } from 'react';
import AppLink from '@/components/AppLink';
import { displayCuberName } from '@/lib/cuber-name-display';

/** Bare profile path (no lang prefix — AppLink adds it). Use for non-AppLink
 *  href builders too (they prepend their own prefix). */
export function personHref(wcaId: string): string {
  return `/wca/persons/${encodeURIComponent(wcaId)}`;
}

interface Props {
  wcaId: string;
  /** When no children: rendered as displayCuberName(name, isZh). */
  name?: string;
  isZh?: boolean;
  className?: string;
  prefetch?: boolean;
  title?: string;
  children?: ReactNode;
}

export default function PersonLink({
  wcaId, name, isZh = false, className, prefetch = false, title, children,
}: Props) {
  return (
    <AppLink href={personHref(wcaId)} prefetch={prefetch} className={className} title={title}>
      {children ?? (name != null ? displayCuberName(name, isZh) : wcaId)}
    </AppLink>
  );
}
