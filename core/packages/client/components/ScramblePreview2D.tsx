'use client';

/**
 * Static 2D unfolded WCA scramble preview — pure custom SVG renderers ported
 * from tnoodle-lib (clock/sq1/mega/pyra/skewb/unfolded-cube) plus a cstimer
 * port for Mirror Blocks.
 *
 * Ported from packages/client-vite/src/components/ScramblePreview2D.tsx, but with
 * the TwistyPlayer fallback removed — all currently supported events have a
 * synchronous custom SVG renderer, so no need to pull in cubing/twisty (which
 * triggers the search worker code path that conflicts with Turbopack prerender).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { renderScramblePreviewSvg } from '@/components/scramble-preview-svg';
// mask-core, NOT puzzle-mask: this component only parses a mask string, it never
// expands pieces — so it must not pull the derived tables (lib/puzzle-image/data)
// into the chunk of every page that shows a scramble preview.
import { toRenderMask, type MaskRenderOptions } from '@/lib/puzzle-image/mask-core';

// Minimal shape-mod helpers inline — full table lives in client/utils/shapeModScramble.ts
// (not yet ported). Only mirror_333 needs special-case handling here.
export { eventHasScramblePreview } from '@/components/scramble-preview-svg';

interface Props {
  event: string;
  scramble: string;
  size?: number;
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
  megaColors?: Record<string, string>;
  /** Wrap the preview in an <a> that opens this very SVG full-size in a new tab.
   *  Keeps the popup pixel-identical to the thumbnail (same SVG string) instead
   *  of a different server-rendered net. */
  fullSizeLink?: boolean;
  /** Tooltip for the full-size link (caller passes the i18n'd string). */
  linkTitle?: string;
  /** Gray out stickers — canonical id DSL, e.g. `U:0,2;F:3-5`. Applied in the
   *  solved frame, so the gray travels with the piece through the scramble.
   *  Only the piece-model renderers honour it (NxN net, pyraminx, skewb, megaminx). */
  mask?: string;
}

export function ScramblePreview2D({
  event,
  scramble,
  size = 60,
  clockColors,
  sq1Colors,
  megaColors,
  fullSizeLink,
  linkTitle,
  mask,
}: Props) {
  const customSvg = useMemo(() => {
    const renderMask: MaskRenderOptions | undefined = (() => {
      const rm = toRenderMask(mask);
      return rm ? { mask: rm } : undefined;
    })();
    return renderScramblePreviewSvg({
      event,
      scramble,
      clockColors,
      sq1Colors,
      megaColors,
      mask: renderMask,
    });
  }, [event, scramble, clockColors, sq1Colors, megaColors, mask]);

  // Object URL of the exact same SVG, for the "open full-size" link. Create AND
  // revoke inside one effect so React StrictMode's mount→unmount→remount (dev)
  // can't leave a revoked URL in the DOM. Browser-only — never runs on SSR.
  const [fullSizeHref, setFullSizeHref] = useState<string | null>(null);
  useEffect(() => {
    if (!fullSizeLink || !customSvg) {
      setFullSizeHref(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([customSvg], { type: 'image/svg+xml' }));
    setFullSizeHref(url);
    return () => URL.revokeObjectURL(url);
  }, [fullSizeLink, customSvg]);

  const isPortrait = event === 'sq1';
  const hostStyle: CSSProperties = {
    width: isPortrait ? size : size * 2,
    height: isPortrait ? size * 2 : size * 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    margin: '0 auto',
  };

  if (!customSvg) return null;
  const inner = (
    <div
      className="puzzle-art"
      style={hostStyle}
      dangerouslySetInnerHTML={{ __html: customSvg }}
    />
  );
  if (fullSizeLink && fullSizeHref) {
    return (
      <a
        href={fullSizeHref}
        target="_blank"
        rel="noopener noreferrer"
        // stopPropagation: parent row has click-to-copy
        onClick={(e) => e.stopPropagation()}
        title={linkTitle}
        style={{ display: 'inline-flex' }}
      >
        {inner}
      </a>
    );
  }
  return inner;
}
