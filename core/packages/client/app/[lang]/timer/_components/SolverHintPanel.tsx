'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryState, parseAsBoolean } from 'nuqs';
import TimerSolverPanel, { type TimerSolverPanelProps } from '@cuberoot/timer-ui/TimerSolverPanel';
import '@/lib/rust-cross-tables';

export const HINTS_PARAM = 'hints';

/** Only Web navigation lives here; the responsive solver surface is shared. */
export default function SolverHintPanel({ isZh, ...props }: Omit<TimerSolverPanelProps, 'language' | 'sheetOpen' | 'onSheetOpenChange'> & {
  isZh: boolean; onPrevScramble?(): void; onNextScramble?(): void;
}) {
  const [sheetOpen, setSheetOpen] = useQueryState(HINTS_PARAM, parseAsBoolean.withDefault(false).withOptions({ history: 'push' }));
  const pushed = useRef(false);
  useEffect(() => { if (!sheetOpen) pushed.current = false; }, [sheetOpen]);
  const changeSheet = useCallback((open: boolean, replace = false) => {
    if (open) { pushed.current = !replace; void setSheetOpen(true, { history: replace ? 'replace' : 'push' }); }
    else if (pushed.current) { pushed.current = false; window.history.back(); }
    else void setSheetOpen(null, { history: 'replace' });
  }, [setSheetOpen]);
  return <TimerSolverPanel {...props} language={isZh ? 'zh' : 'en'} sheetOpen={sheetOpen} onSheetOpenChange={changeSheet} />;
}
