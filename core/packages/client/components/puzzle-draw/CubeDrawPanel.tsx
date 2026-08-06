'use client';

import { useMemo } from 'react';
import {
  NET_FACE_ORDER,
  NET_GAP,
  netFaceOffsets,
  type NetFaceLetter,
} from '@/lib/cube-net-svg';
import DrawCanvas from './DrawCanvas';
import {
  CUBE_FACE_COLORS,
  DRAW_NEUTRAL_STICKER,
  DRAW_TRANSPARENT,
} from './palettes';
import type { DrawElement, DrawExport } from './types';

const FACE_COLORS: Record<NetFaceLetter, string> = {
  U: CUBE_FACE_COLORS.white,
  R: CUBE_FACE_COLORS.red,
  F: CUBE_FACE_COLORS.green,
  D: CUBE_FACE_COLORS.yellow,
  L: CUBE_FACE_COLORS.orange,
  B: CUBE_FACE_COLORS.blue,
};

const PALETTE = [
  DRAW_TRANSPARENT,
  CUBE_FACE_COLORS.white,
  CUBE_FACE_COLORS.yellow,
  CUBE_FACE_COLORS.red,
  CUBE_FACE_COLORS.orange,
  CUBE_FACE_COLORS.blue,
  CUBE_FACE_COLORS.green,
  DRAW_NEUTRAL_STICKER,
] as const;

export interface CubeDrawPanelProps {
  order: number;
  onDocumentChange?: (doc: DrawExport) => void;
}

/** Free-colour NxN net. It deliberately does not enforce solver legality. */
export default function CubeDrawPanel({ order, onDocumentChange }: CubeDrawPanelProps) {
  const n = Math.max(2, Math.min(20, Math.round(order)));
  const viewWidth = 4 * n + 5 * NET_GAP;
  const viewHeight = 3 * n + 4 * NET_GAP;
  const pixelWidth = 512;
  const pixelHeight = Math.round(pixelWidth * viewHeight / viewWidth);
  const elements = useMemo<DrawElement[]>(() => {
    const out: DrawElement[] = [];
    const offsets = netFaceOffsets(n);
    for (const face of NET_FACE_ORDER) {
      const [faceX, faceY] = offsets[face];
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const x = faceX + col;
          const y = faceY + row;
          out.push({
            key: `${face}${row * n + col}`,
            d: `M${x} ${y}h1v1h-1Z`,
            defaultFill: FACE_COLORS[face],
          });
        }
      }
    }
    return out;
  }, [n]);

  return (
    <DrawCanvas
      key={n}
      elements={elements}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width={pixelWidth}
      height={pixelHeight}
      filenameBase={`cube-${n}x${n}`}
      presetColors={PALETTE}
      historyStorageKey="sim.draw.cube.colors"
      strokeWidthScale={0.04}
      onDocumentChange={onDocumentChange}
    />
  );
}
