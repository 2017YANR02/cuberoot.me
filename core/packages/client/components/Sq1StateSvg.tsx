import type { Sq1State } from '@cuberoot/shared/sq1-notation';
import { DEFAULT_SQ1_COLORS, renderSq1Svg } from '@/lib/sq1-svg';

export function Sq1StateSvg({
  state,
  label,
  className,
  layer = 'both',
}: {
  state: Sq1State;
  label: string;
  className?: string;
  layer?: 'both' | 'top';
}) {
  const art = (
    <div
      role="img"
      aria-label={label}
      style={layer === 'top'
        ? { width: '200%', height: '200%', transform: 'translateX(-25%)', lineHeight: 0 }
        : { width: '100%', height: '100%', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: renderSq1Svg(state, DEFAULT_SQ1_COLORS) }}
    />
  );

  if (layer === 'both') return <div className={className}>{art}</div>;
  return (
    <div className={className} style={{ overflow: 'hidden', lineHeight: 0 }}>
      {art}
    </div>
  );
}
