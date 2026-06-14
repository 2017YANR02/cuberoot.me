'use client';
// 全部成绩表内联旧成绩:某行单次 / 平均被后来取消或修正时,在当前值前补一个划掉的旧值。
// 旧值为 null(该字段未变)时不渲染,保持表格紧凑。

import { formatWcaResult } from '@/lib/wca-format-result';
import { tr } from '@/i18n/tr';

export function ChangedResultValue({ oldValue, eventId, kind }: {
  oldValue: number | null;
  eventId: string;
  kind: 'single' | 'average';
}) {
  if (oldValue == null) return null;
  return (
    <s className="wp-old-result" title={tr({ zh: '此前成绩(已变更)', en: 'previous mark (changed)'
    })}>
      {formatWcaResult(oldValue, eventId, kind)}
    </s>
  );
}
