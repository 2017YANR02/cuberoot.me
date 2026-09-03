import type { CSSProperties } from 'react';
import { tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES, CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';

export default function ColorSwatch({ face, compact = false, showLabel = true }: {
  face: CubeFace;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const style = {
    '--color-fill': CUBE_FILL[face],
    '--color-on-fill': CUBE_ON_FILL[face],
  } as CSSProperties;

  return (
    <span className={`color-quiz-swatch${compact ? ' is-compact' : ''}`} style={style}>
      {showLabel && tr(CUBE_COLOR_NAMES[face])}
    </span>
  );
}
