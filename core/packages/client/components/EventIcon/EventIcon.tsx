/**
 * WCA / cubing 项目图标 — 内联 SVG. Ported from packages/client-vite/src/components/EventIcon.
 * The shared renderer and vendored SVG sources live in @cuberoot/event-icon so
 * the website and native App consume the same project artwork.
 */
import { CubingIcon } from '@cuberoot/event-icon';
import { isWcaEvent, toWcaEventId } from '@/lib/wca-events';
import { TWIZZLE_NONWCA_APPEND } from '@/lib/non-wca-events';

export { CubingIcon } from '@cuberoot/event-icon';

const UNOFFICIAL_ICON_CLASS: Record<string, string> = Object.fromEntries(
  [
    ...TWIZZLE_NONWCA_APPEND,
    { id: 'gear', iconClass: 'unofficial-gear' },
    { id: 'mirror', iconClass: 'unofficial-333_mirror_blocks' },
    { id: 'mirror2', iconClass: 'unofficial-222_mirror_blocks' },
    { id: 'mirror_333', iconClass: 'unofficial-333_mirror_blocks' },
  ].map(({ id, iconClass }) => [id, iconClass]),
);

interface EventIconProps {
  event: string;
  className?: string;
  title?: string;
}

/** Resolve a WCA or supported non-WCA event id to a real cubing icon key. */
export function eventIconClass(event: string): string | undefined {
  const id = toWcaEventId(event);
  const unofficialKey = UNOFFICIAL_ICON_CLASS[id];
  if (unofficialKey) return unofficialKey;
  if (isWcaEvent(id) || /^nxn\d+$/.test(id)) {
    return /^nxn\d+$/.test(id) ? 'event-777' : `event-${id}`;
  }
  return undefined;
}

export function EventIcon({ event, className, title }: EventIconProps) {
  const id = toWcaEventId(event);
  // 高阶 NxN('nxn8'..'nxn300')无专属图标,统一退回 7x7 视觉
  const icon = eventIconClass(id) ?? `event-${id}`;
  return <CubingIcon icon={icon} className={className} title={title} ariaLabel={id} />;
}
