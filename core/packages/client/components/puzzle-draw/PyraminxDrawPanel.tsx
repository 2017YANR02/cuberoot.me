'use client';

import DrawCanvas from './DrawCanvas';
import { PYRAMINX_STICKER_PALETTE } from './palettes';
import { PYRAMINX_DRAW_ELEMENTS } from './PyraminxDrawPanel-data';
import type { DrawExport } from './types';

export interface PyraminxDrawPanelProps {
  onDocumentChange?: (doc: DrawExport) => void;
}

/** 18-sticker Pyraminx painter ported from the authorized cubing.pro tool. */
export function PyraminxDrawPanel({ onDocumentChange }: PyraminxDrawPanelProps) {
  return (
    <DrawCanvas
      elements={PYRAMINX_DRAW_ELEMENTS}
      viewBox="0 0 471.31 604.31"
      width={400}
      height={400}
      filenameBase="pyraminx"
      presetColors={PYRAMINX_STICKER_PALETTE}
      historyStorageKey="sim.draw.pyraminx"
      strokeWidthScale={10}
      onDocumentChange={onDocumentChange}
    />
  );
}

export default PyraminxDrawPanel;
