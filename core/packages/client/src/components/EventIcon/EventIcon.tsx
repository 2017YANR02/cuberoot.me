/**
 * WCA 项目图标——用 cubing-icons 字体（已在 index.html 全局 import）
 * 接受任何短名（'3x3' / '3' / '333oh' / 'oh'）；内部归一化到 WCA 标准 id。
 */
import { toWcaEventId } from '../../utils/wca_events';

interface EventIconProps {
  event: string;
  className?: string;
  title?: string;
}

export function EventIcon({ event, className, title }: EventIconProps) {
  const id = toWcaEventId(event);
  // 高阶 NxN(`nxn8`..`nxn50`)字体里没图标,统一退回 7x7 视觉。
  const iconId = /^nxn\d+$/.test(id) ? '777' : id;
  const cls = `cubing-icon event-${iconId}${className ? ` ${className}` : ''}`;
  return <span className={cls} title={title} aria-label={id} />;
}
