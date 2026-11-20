import { isTimerOrdinaryEvent } from './event-catalog';
import type { EventId } from './types';

export const TIMER_BULK_SCRAMBLE_COUNTS = { initial: 12, min: 1, max: 100 } as const;

export const TIMER_BULK_SCRAMBLE_COPY = {
  event: { en: 'Event', zh: '项目' },
  count: { en: 'Count', zh: '数量' },
  generate: { en: 'Generate', zh: '生成' },
  generating: { en: 'Generating…', zh: '生成中…' },
  copy: { en: 'Copy all', zh: '全部复制' },
  copied: { en: 'Copied', zh: '已复制' },
  download: { en: 'Download .txt', zh: '下载 .txt' },
  exportFailed: { en: 'Action failed. Please try again.', zh: '操作失败，请重试。' },
};

export function isTimerBulkScrambleEvent(event: string): event is EventId {
  return event !== 'custom' && isTimerOrdinaryEvent(event);
}

export function clampTimerBulkScrambleCount(count: number): number {
  const { min, max } = TIMER_BULK_SCRAMBLE_COUNTS;
  return Math.max(min, Math.min(max, Math.round(count)));
}

export function timerBulkScrambleBatch(event: EventId, scrambles: readonly string[]) {
  const rows = scrambles.map((scramble, index) => ({ number: `${index + 1})`, scramble }));
  return {
    rows,
    text: rows.map(row => `${row.number} ${row.scramble}`).join('\n'),
    filename: `cuberoot-scrambles-${event}-${scrambles.length}.txt`,
    mime: 'text/plain;charset=utf-8',
  };
}
