'use client';
import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import type { EventId, TimerScrambleRequest } from '@cuberoot/shared/timer';
import { TimerRoomDialog } from './TimerRoomDialog';
import './timer-tools.css';
const Bulk = lazy(() => import('./TimerBulkScrambleModal'));
const Bld = lazy(() => import('./TimerBldHelperModal'));
const Solver = lazy(() => import('./TimerGeneralSolverModal'));
export type TimerTool = 'bulk' | 'bld-helper' | 'solver';
export interface TimerToolTransport {
  copy(text: string): Promise<void>;
  download(text: string, filename: string): Promise<void>;
}
export const browserTimerToolTransport: TimerToolTransport = {
  copy: text => navigator.clipboard.writeText(text),
  async download(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
export interface TimerToolsProps {
  tool: TimerTool | null; event: EventId; scramble: string; language: 'en' | 'zh';
  randomOptions: Pick<TimerScrambleRequest, 'cnMode' | 'scramble222Mode'>;
  onClose(): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
  transport: TimerToolTransport;
}
/** One tool surface and nested-dismiss contract in both Web and installed Solo. */
export function TimerTools(props: TimerToolsProps) {
  const { tool, language, onClose, onDismissChange } = props;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const nested = useRef<(() => boolean) | null>(null);
  const registerNested = useCallback((dismiss: (() => boolean) | null) => { nested.current = dismiss; }, []);
  useEffect(() => {
    if (!tool) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dismiss = () => { if (!nested.current?.()) closeRef.current(); return true; };
    // Disabling the focused Generate/Solve button can move focus to the body.
    // Own Escape here as well as Back so it still closes the innermost surface.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); event.stopImmediatePropagation(); dismiss();
    };
    window.addEventListener('keydown', onKey, true);
    onDismissChange?.(dismiss);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow; onDismissChange?.(null);
    };
  }, [tool, onDismissChange]);
  if (!tool) return null;
  const title = { bulk: { zh: '批量打乱', en: 'Bulk scrambles' }, 'bld-helper': { zh: '盲拧助手', en: 'BLD helper' }, solver: { zh: '通用求解器', en: 'Solver' } }[tool][language];
  return <Suspense fallback={<TimerRoomDialog title={title} language={language} onClose={onClose}><p role="status">{{ zh: '加载中…', en: 'Loading…' }[language]}</p></TimerRoomDialog>}>
    {tool === 'bulk' && <Bulk defaultEvent={props.event} language={language} onClose={onClose} onDismissChange={registerNested} transport={props.transport} randomOptions={props.randomOptions} />}
    {tool === 'bld-helper' && <Bld scramble={props.scramble} event={props.event} isZh={language === 'zh'} onClose={onClose} />}
    {tool === 'solver' && <Solver language={language} onClose={onClose} transport={props.transport} />}
  </Suspense>;
}
