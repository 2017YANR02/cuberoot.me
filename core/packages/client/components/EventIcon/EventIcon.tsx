/**
 * WCA / cubing 项目图标 — 内联 SVG. Ported from packages/client-vite/src/components/EventIcon.
 * The shared renderer and vendored SVG sources live in @cuberoot/event-icon so
 * the website and native App consume the same project artwork.
 */
import { CubingIcon } from '@cuberoot/event-icon';
import { TIMER_EVENT_PICKER_ITEMS } from '@cuberoot/shared/timer/event-catalog';
import { isWcaEvent, toWcaEventId } from '@/lib/wca-events';
import { TWIZZLE_NONWCA_APPEND } from '@/lib/non-wca-events';
import { CSTIMER_NONWCA_APPEND } from '@/lib/cstimer-scramble';
import { SHAPE_MOD_APPEND } from '@/lib/shape-mod-scramble';
import { NATIVE_SCRAMBLE_APPEND } from '@/lib/native-scramble';

export { CubingIcon } from '@cuberoot/event-icon';

// Reuse picker metadata so result headers cannot drift back to text-only or
// unrelated glyphs. These catalogs do not start workers or build geometry.
const PROJECT_ICON_CLASS: Record<string, string> = Object.fromEntries(
  [
    ...TWIZZLE_NONWCA_APPEND,
    ...CSTIMER_NONWCA_APPEND,
    ...SHAPE_MOD_APPEND,
    ...NATIVE_SCRAMBLE_APPEND,
    ...TIMER_EVENT_PICKER_ITEMS,
    { id: 'mirror', iconClass: 'unofficial-333_mirror_blocks' },
    { id: 'mirror2', iconClass: 'unofficial-222_mirror_blocks' },
    { id: 'ghost', iconClass: 'unofficial-ghost' },
  ].flatMap(({ id, iconClass }) => iconClass ? [[id, iconClass]] : []),
);

interface EventIconProps {
  event: string;
  className?: string;
  title?: string;
}

/** Resolve a WCA or supported non-WCA event id to a real cubing icon key. */
export function eventIconClass(event: string): string | undefined {
  const id = toWcaEventId(event);
  const catalogKey = PROJECT_ICON_CLASS[id];
  if (catalogKey) return catalogKey;
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
