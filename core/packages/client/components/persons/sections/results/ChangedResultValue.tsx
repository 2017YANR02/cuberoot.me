'use client';
// 全部成绩表内联旧成绩:某行单次 / 平均被取消或修正时,在当前值前补划掉的旧值。
// 支持「同一成绩多次更改」:依次划掉历次旧值(0.78 → 2.83 → 当前 → ~~0.78~~ ~~2.83~~ 当前)。

import { formatWcaResult } from '@/lib/wca-format-result';
import { tr } from '@/i18n/tr';
import './result-change.css';

/** 单个划掉的旧值(保留:某些地方只有一个旧值)。 */
export function ChangedResultValue({ oldValue, eventId, kind }: {
  oldValue: number | null;
  eventId: string;
  kind: 'single' | 'average';
}) {
  if (oldValue == null) return null;
  return (
    <s className="wp-old-result" title={tr({ zh: '此前成绩(已变更)', en: 'previous mark (changed)' })}>
      {formatWcaResult(oldValue, eventId, kind)}
    </s>
  );
}

/** 变更链:依次划掉历次旧值(oldest→newest);当前值由调用方在其后渲染。 */
export function ResultChangeChain({ oldValues, eventId, kind, note }: {
  oldValues: number[];
  eventId: string;
  kind: 'single' | 'average';
  note?: string | null;
}) {
  if (!oldValues.length) return null;
  const title = note || tr({ zh: '此前成绩(已变更)', en: 'previous mark (changed)' });
  return (
    <>
      {oldValues.map((v, i) => (
        <s key={i} className="wp-old-result" title={title}>
          {formatWcaResult(v, eventId, kind)}
        </s>
      ))}
    </>
  );
}
