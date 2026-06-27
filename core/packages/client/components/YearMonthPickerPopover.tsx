'use client';

// 年/月滚筒选择浮层 — 从 wca/calendar/page.tsx 提取为共享组件,供 calendar / globe 复用。
// yearMonthsMap(年 → 该年有数据的月份集)驱动滚筒跳过空年/空月;关闭浮层时一次性 onCommit。

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { WheelPicker } from './WheelPicker';
import './year-month-picker.css';
import { tr } from '@/i18n/tr';

export function YearMonthPickerPopover({ year, month, yearMonthsMap, anchor, onCommit }: {
  year: number;
  month: number; // 1..12
  /** 年 → 该年有数据的月份集;滚筒按此表跳过空年/空月 */
  yearMonthsMap: Map<number, Set<number>>;
  anchor: DOMRect | null;
  /** 关闭浮层时一次性提交 pending 值 + 关闭;拖拽中不调用 */
  onCommit: (y: number, m: number) => void;
  isZh: boolean;
}) {
  const validYears = useMemo(
    () => [...yearMonthsMap.keys()].sort((a, b) => a - b),
    [yearMonthsMap],
  );

  // NOTE: pending 本地态 — 拖拽只改本地,关闭浮层才 flush 给父
  // 用索引存储:WheelPicker 连续整数步进,非连续真实年/月从对应数组反查
  // 若 viewDate 的年不在 validYears(例如 Top 模式未加载数据、或打开到纯空年),fall back 到最近年
  const [pendingYIdx, setPendingYIdx] = useState(() => {
    const exact = validYears.indexOf(year);
    if (exact >= 0) return exact;
    if (validYears.length === 0) return 0;
    let bestIdx = 0;
    for (let i = 1; i < validYears.length; i++) {
      if (Math.abs(validYears[i] - year) < Math.abs(validYears[bestIdx] - year)) bestIdx = i;
    }
    return bestIdx;
  });
  const [pendingM, setPendingM] = useState(month);

  const currentYear = validYears[pendingYIdx] ?? year;

  const validMonths = useMemo(() => {
    const set = yearMonthsMap.get(currentYear);
    if (!set || set.size === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return [...set].sort((a, b) => a - b);
  }, [yearMonthsMap, currentYear]);

  // NOTE: 当 validMonths 变化(切年)若 pendingM 越界,snap 到最近的合法月份
  useEffect(() => {
    if (validMonths.includes(pendingM)) return;
    let closest = validMonths[0];
    for (const m of validMonths) {
      if (Math.abs(m - pendingM) < Math.abs(closest - pendingM)) closest = m;
    }
    setPendingM(closest);
  }, [validMonths, pendingM]);

  const pendingMIdx = Math.max(0, validMonths.indexOf(pendingM));

  const yearRenderSlot = useCallback(
    (i: number) => (i >= 0 && i < validYears.length) ? String(validYears[i]) : '',
    [validYears],
  );
  const monthRenderSlot = useCallback(
    (i: number) => (i >= 0 && i < validMonths.length) ? String(validMonths[i]).padStart(2, '0') : '',
    [validMonths],
  );
  const monthOnChange = useCallback(
    (i: number) => setPendingM(validMonths[i] ?? pendingM),
    [validMonths, pendingM],
  );

  const pendingRef = useRef({ yIdx: pendingYIdx, mIdx: pendingMIdx });
  pendingRef.current = { yIdx: pendingYIdx, mIdx: pendingMIdx };

  const commit = useCallback(() => {
    const y = validYears[pendingRef.current.yIdx] ?? year;
    const monthsForY = yearMonthsMap.get(y);
    const months = monthsForY && monthsForY.size > 0
      ? [...monthsForY].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const m = months[pendingRef.current.mIdx] ?? months[0] ?? month;
    onCommit(y, m);
  }, [validYears, yearMonthsMap, year, month, onCommit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') commit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit]);

  // NOTE: 根据按钮位置定位面板;贴在按钮下方偏右 8px,越界时夹到视口内
  const panelStyle: CSSProperties = anchor
    ? (() => {
        const W = 220, H = 280;
        const top = Math.min(anchor.bottom + 6, window.innerHeight - H - 8);
        const left = Math.max(8, Math.min(anchor.left, window.innerWidth - W - 8));
        return { top, left };
      })()
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="ym-popover-overlay" onClick={commit}>
      <div className="ym-popover-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <WheelPicker
          value={pendingYIdx}
          minValue={0}
          maxValue={Math.max(0, validYears.length - 1)}
          renderSlot={yearRenderSlot}
          onChange={setPendingYIdx}
          width={96}
          ariaLabel={tr({ zh: '年', en: 'Year' })}
        />
        <WheelPicker
          value={pendingMIdx}
          minValue={0}
          maxValue={Math.max(0, validMonths.length - 1)}
          renderSlot={monthRenderSlot}
          onChange={monthOnChange}
          width={80}
          ariaLabel={tr({ zh: '月', en: 'Month' })}
        />
      </div>
    </div>
  );
}
