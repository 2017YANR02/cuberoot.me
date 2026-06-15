/**
 * WCA / cubing 项目图标 — 内联 SVG. Ported from packages/client-vite/src/components/EventIcon.
 * SVGs sources still in ./svg/{event,unofficial,penalty}/ (cubing/icons LICENSE
 * preserved). Vite's `import.meta.glob('./svg/...*.svg', { eager, ?raw })` is
 * replaced by the explicit map in ./svg-map.ts produced by gen-svg-map.mjs.
 */
import { toWcaEventId } from '@/lib/wca-events';
import { TWIZZLE_NONWCA_APPEND } from '@/lib/non-wca-events';
import { SVG_BY_KEY } from './svg-map';
import './EventIcon.css';

const UNOFFICIAL_ICON_CLASS: Record<string, string> = Object.fromEntries(
  TWIZZLE_NONWCA_APPEND.map(({ id, iconClass }) => [id, iconClass]),
);

interface CubingIconProps {
  /** cubing-icons class key, e.g. 'event-333' / 'unofficial-fto' / 'penalty-A6c' */
  icon: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function CubingIcon({ icon, className, title, ariaLabel }: CubingIconProps) {
  const svg = SVG_BY_KEY[icon];
  const cls = `cubing-icon ${icon}${className ? ` ${className}` : ''}`;
  return (
    <span
      className={cls}
      title={title}
      aria-label={ariaLabel ?? icon}
      {...(svg ? { dangerouslySetInnerHTML: { __html: svg } } : {})}
    />
  );
}

interface EventIconProps {
  event: string;
  className?: string;
  title?: string;
}

export function EventIcon({ event, className, title }: EventIconProps) {
  const id = toWcaEventId(event);
  const unofficialKey = UNOFFICIAL_ICON_CLASS[id];
  // 高阶 NxN('nxn8'..'nxn300')无专属图标,统一退回 7x7 视觉
  const eventKey = /^nxn\d+$/.test(id) ? 'event-777' : `event-${id}`;
  const icon = unofficialKey ?? eventKey;
  return <CubingIcon icon={icon} className={className} title={title} ariaLabel={id} />;
}
