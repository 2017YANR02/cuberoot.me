/**
 * WCA 项目图标——用 cubing-icons 字体（已在 index.html 全局 import）
 * 接受任何短名（'3x3' / '3' / '333oh' / 'oh'）；内部归一化到 WCA 标准 id。
 * 非 WCA(cubing.js twizzleEvents)走 `unofficial-*` class,对照表来自
 * cubingScramble.ts 的 TWIZZLE_NONWCA_APPEND(WcaEventSelector 也读这份)。
 */
import { toWcaEventId } from '../../utils/wca_events';
import { TWIZZLE_NONWCA_APPEND } from '../../utils/cubingScramble';

interface EventIconProps {
  event: string;
  className?: string;
  title?: string;
}

const UNOFFICIAL_ICON_CLASS: Record<string, string> = Object.fromEntries(
  TWIZZLE_NONWCA_APPEND.map(({ id, iconClass }) => [id, iconClass]),
);

export function EventIcon({ event, className, title }: EventIconProps) {
  const id = toWcaEventId(event);
  if (UNOFFICIAL_ICON_CLASS[id]) {
    const cls = `cubing-icon ${UNOFFICIAL_ICON_CLASS[id]}${className ? ` ${className}` : ''}`;
    return <span className={cls} title={title} aria-label={id} />;
  }
  // 高阶 NxN(`nxn8`..`nxn300`)字体里没图标,统一退回 7x7 视觉。
  const iconId = /^nxn\d+$/.test(id) ? '777' : id;
  const cls = `cubing-icon event-${iconId}${className ? ` ${className}` : ''}`;
  return <span className={cls} title={title} aria-label={id} />;
}
