'use client';

import DrawCanvas from './DrawCanvas';
import { FTO_STICKER_PALETTE } from './palettes';
import { FTO_DRAW_ELEMENTS } from '@/lib/fto-draw-elements';
import type { DrawExport } from './types';

export interface FtoDrawPanelProps {
  onDocumentChange?: (doc: DrawExport) => void;
}

/** 72-sticker FTO painter. The body element remains permanently black and unpaintable. */
export function FtoDrawPanel({ onDocumentChange }: FtoDrawPanelProps) {
  return (
    <DrawCanvas
      elements={FTO_DRAW_ELEMENTS}
      viewBox="0 0 279.92 301.94"
      width={400}
      height={432}
      filenameBase="fto"
      presetColors={FTO_STICKER_PALETTE}
      historyStorageKey="sim.draw.fto"
      strokeWidthScale={2}
      onDocumentChange={onDocumentChange}
    />
  );
}

export default FtoDrawPanel;
