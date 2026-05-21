/**
 * WCA 项目图标 — 内联 SVG(SVG 源在 ./svg/{event,unofficial,penalty}/,来自 cubing/icons)。
 * - `<EventIcon event="3x3" />` 接受任何短名,归一化到 WCA id 后查 event-/unofficial- SVG。
 * - `<CubingIcon icon="event-333" />` 接收已知的 cubing-icons class key,直接渲染 SVG。
 *   给 WcaEventSelector / CalendarPage 等已经手算好 class key 的调用点用。
 * 渲染策略:span.cubing-icon 包 raw svg;CSS `.cubing-icon` 控 size(em)/color
 * (svg fill: currentColor),`font-size` / `color` 等老规则零改动继续生效。
 */
import { toWcaEventId } from '../../utils/wca_events';
import { TWIZZLE_NONWCA_APPEND } from '../../utils/cubingScramble';
import './EventIcon.css';

const UNOFFICIAL_ICON_CLASS: Record<string, string> = Object.fromEntries(
  TWIZZLE_NONWCA_APPEND.map(({ id, iconClass }) => [id, iconClass]),
);

const RAW_SVGS = import.meta.glob('./svg/{event,unofficial,penalty}/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SVG_BY_KEY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [path, raw] of Object.entries(RAW_SVGS)) {
    const m = path.match(/\/svg\/(event|unofficial|penalty)\/(.+)\.svg$/);
    if (!m) continue;
    out[`${m[1]}-${m[2]}`] = raw;
  }
  return out;
})();

interface CubingIconProps {
  /** cubing-icons class key,例如 'event-333' / 'unofficial-fto' / 'penalty-A6c' */
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
