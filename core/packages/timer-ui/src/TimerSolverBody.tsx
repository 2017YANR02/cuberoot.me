import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { ManualScrambleQueueEditor } from './ManualScrambleQueueEditor';
import StageSolver from './StageSolver';
import './TimerStepSolve.css';
import './manual-scramble-queue.css';
const TimerStepSolve = lazy(() => import('./TimerStepSolve'));

export default function TimerSolverBody({ view = 'solutions', scramble, onScrambleChange, language, compact, settingsSlot, onPrevScramble, onNextScramble, onDismissChange, onBlockingChange }: {
  view?: 'solutions' | 'steps';
  scramble: string; language: 'en' | 'zh'; compact: boolean; settingsSlot?: HTMLElement | null;
  onScrambleChange?(scramble: string): void;
  onPrevScramble?(): void; onNextScramble?(): void;
  onBlockingChange?(blocked: boolean): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
}) {
  const tr = (copy: { zh: string; en: string }) => copy[language];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const editorRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (editing) editorRef.current?.querySelector('textarea')?.focus(); }, [editing]);
  const dismissEditor = useCallback(() => {
    if (!editing) return false;
    setEditing(false);
    return true;
  }, [editing]);
  const applyScramble = () => {
    if (!draft.trim() || !onScrambleChange) return;
    onScrambleChange(draft.trim());
    setEditing(false);
  };
  const [stageBlocking, setStageBlocking] = useState(false);
  const [compareBlocking, setCompareBlocking] = useState(false);
  useEffect(() => {
    onBlockingChange?.(editing || stageBlocking || compareBlocking);
    return () => onBlockingChange?.(false);
  }, [editing, stageBlocking, compareBlocking, onBlockingChange]);
  const compareDismiss = useRef<(() => boolean) | null>(null);
  const stageDismiss = useRef<(() => boolean) | null>(null);
  const registerCompare = useCallback((dismiss: (() => boolean) | null) => { compareDismiss.current = dismiss; }, []);
  const registerStage = useCallback((dismiss: (() => boolean) | null) => { stageDismiss.current = dismiss; }, []);
  useEffect(() => {
    onDismissChange?.(() => dismissEditor() || compareDismiss.current?.() || stageDismiss.current?.() || false);
    return () => onDismissChange?.(null);
  }, [onDismissChange, dismissEditor]);
  return <div data-no-timer onKeyDown={event => {
    if (event.key === 'Escape' && (dismissEditor() || stageDismiss.current?.())) { event.preventDefault(); event.stopPropagation(); }
  }}>
    {view === 'solutions' ? <>
      {editing ? <form ref={editorRef} className="solver-panel-scramble solver-scramble-editor" data-no-swipe
        onSubmit={event => { event.preventDefault(); applyScramble(); }}
        onKeyDown={event => {
          if (event.target instanceof HTMLTextAreaElement && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault(); event.stopPropagation(); applyScramble();
          }
        }}>
        <ManualScrambleQueueEditor ariaLabel={tr({ zh: '手动输入打乱', en: 'Manual scramble input' })}
          value={draft} onChange={setDraft} />
        <button type="submit" className="solver-layout-action" disabled={!draft.trim() || !onScrambleChange}
          aria-label={tr({ zh: '应用打乱', en: 'Apply scramble' })}><Check size={16} /></button>
        <button type="button" className="solver-layout-action" onClick={dismissEditor}
          aria-label={tr({ zh: '取消', en: 'Cancel' })}><X size={16} /></button>
      </form> : (scramble.trim() || onScrambleChange) && <div className="solver-panel-scramble solver-scramble-row">
        <span>{scramble}</span>
        {onScrambleChange && <button type="button" className="solver-layout-action" data-no-swipe
          aria-label={tr({ zh: '编辑打乱', en: 'Edit scramble' })}
          onClick={() => { setDraft(scramble); setEditing(true); }}><Pencil size={16} /></button>}
      </div>}
      <StageSolver scramble={scramble} lang={language} compact={compact} expandedSolutions={!compact} settingsSlot={settingsSlot}
        onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} onDismissChange={registerStage} onBlockingChange={setStageBlocking} />
    </> : <Suspense fallback={null}>
      <TimerStepSolve scramble={scramble} isZh={language === 'zh'} onDismissChange={registerCompare} onBlockingChange={setCompareBlocking} />
    </Suspense>}
  </div>;
}
