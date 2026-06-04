'use client';

import { useMemo } from 'react';
import { renderSkewbScrambleSvg, SKEWB_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';

interface SkewbImageProps {
  scramble: string;
  size?: number;
  show?: boolean;
  className?: string;
}

export default function SkewbImage({ scramble, size = 240, show = true, className }: SkewbImageProps) {
  const svg = useMemo(
    () => renderSkewbScrambleSvg(scramble || '', SKEWB_DEFAULT_COLORS),
    [scramble],
  );

  if (show === false) return null;

  return (
    <div
      className={className ? `sk-cube-img ${className}` : 'sk-cube-img'}
      style={{ width: size, maxWidth: '100%', aspectRatio: '1 / 1' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
