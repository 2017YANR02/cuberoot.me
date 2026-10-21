'use client';

import { Fragment, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { Move } from 'cubing/alg';
import { Undo2, PencilLine, X } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { mirrorAlg, rotateAlg } from '@/lib/cube3';
import { editCubeText, cubeTextMoves, oppositeMove, transformCubeText, hasHandNotation, moveSourceGroup, moveAtFirstExecution } from './alg-manipulation';

export default function AlgTransformPanel({ text, setup, order, onApply, editing, onEditingChange, editorSlot, onSelect, basicTools, undoTool, endTools }: {
  text: string; setup: string; order: number;
  basicTools: ReactNode; undoTool: ReactNode; endTools: ReactNode;
  onApply: (setup: string, text: string, caret?: number) => () => void;
  editing: boolean; onEditingChange: (editing: boolean) => void; editorSlot: HTMLElement | null;
  onSelect: (caret: number) => void;
}) {
  const t = useT();
  const [scopeChoice, setScopeChoice] = useState<'solution' | 'both' | null>(null);
  const scope = scopeChoice ?? (setup.trim() ? 'both' : 'solution');
  const [selected, setSelected] = useState<{ text: string; index: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreEditFocus = useRef(false);
  const [history, setHistory] = useState<{ setup: string; result: string; undo: () => void }[]>([]);
  const parsed = useMemo(() => {
    try {
      return { tokens: cubeTextMoves(text) };
    } catch { return null; }
  }, [text]);
  const enabled = !!parsed?.tokens.length;
  const index = selected?.text === text && parsed && selected.index < parsed.tokens.length ? selected.index : null;
  // Selecting another source move mounts a new anchored menu; remeasure that anchor.
  const panelRef = useMemo<{ current: HTMLDivElement | null }>(() => ({ current: null }), [index]);
  const move = useMemo(() => {
    try { return index !== null ? moveAtFirstExecution(text, index) : null; } catch { return null; }
  }, [text, index]);
  const open = editing && menuOpen && index !== null;
  useLayoutEffect(() => {
    if (restoreEditFocus.current && !open) {
      restoreEditFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [text, index, open]);
  useLayoutEffect(() => {
    const panel = panelRef.current, trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;
    // The sim sidebar is a scrolling backdrop root: render outside it and clamp
    // against the visual viewport, including the space above/below the move.
    const position = () => {
      const anchor = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const rightEdge = leftEdge + (viewport?.width ?? document.documentElement.clientWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height ?? document.documentElement.clientHeight) - 16;
      const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - panel.offsetWidth));
      const below = anchor.bottom + 4;
      const top = Math.max(topEdge, Math.min(below + panel.offsetHeight <= bottomEdge ? below : anchor.top - panel.offsetHeight - 4, bottomEdge - panel.offsetHeight));
      const nextLeft = `${left}px`, nextTop = `${top}px`;
      if (panel.style.left !== nextLeft) panel.style.left = nextLeft;
      if (panel.style.top !== nextTop) panel.style.top = nextTop;
    };
    position();
    panel.querySelector<HTMLButtonElement>('button')?.focus();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(panel);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open, panelRef]);
  usePopoverDismiss(open, () => setMenuOpen(false), panelRef, triggerRef);
  const replacement = order === 3 && move ? oppositeMove(move) : null;
  const canUndo = history.length > 0 && history[history.length - 1].result === text && history[history.length - 1].setup === setup;
  const apply = (next: string, nextSetup = setup, caret?: number) => {
    if (next === text && nextSetup === setup) return;
    const undo = onApply(nextSetup, next, caret);
    setHistory(previous => [...(canUndo ? previous : []), { setup: nextSetup, result: next, undo }].slice(-20));
  };
  const setupValid = useMemo(() => {
    try { transformCubeText(setup, move => move); return true; } catch { return false; }
  }, [setup]);
  const transformEnabled = !!parsed && (enabled || (scope === 'both' && !!setup.trim())) && (scope !== 'both' || setupValid);
  const transform = (fn: (move: string) => string) => {
    const next = transformCubeText(text, fn);
    const nextSetup = scope === 'both' ? transformCubeText(setup, fn) : setup;
    apply(next, nextSetup);
  };
  const edit = (action: string) => {
    if (index === null) return;
    try {
      const next = editCubeText(text, index, action);
      const tokens = cubeTextMoves(next.text);
      let nextIndex = tokens.findIndex(token => token.start >= next.caret);
      if (nextIndex < 0) nextIndex = tokens.length - 1;
      apply(next.text, setup, tokens[nextIndex]?.end ?? 0);
      restoreEditFocus.current = true;
      setSelected({ text: next.text, index: nextIndex });
      setMenuOpen(false);
      setError('');
    } catch {
      setError(t('无法改写此步骤（分组最多展开 2000 项）；原文保留。', 'Cannot rewrite this move (groups expand to at most 2,000 items); the original is preserved.'));
    }
  };
  const rotations = ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"];
  const select = (i: number) => {
    setSelected({ text, index: i });
    setMenuOpen(true);
    setError('');
    onSelect(parsed?.tokens[i]?.end ?? 0);
  };
  const menu = open && createPortal(<div ref={panelRef} className="sim-move-menu" data-site-surface="popover" role="dialog"
    aria-label={t('改写选中步骤', 'Rewrite selected move')}>
    <span className="sim-move-menu-heading">
      {index === -1 ? t('在解法开头插入', 'Insert at solution start') : t('在此步后插入', 'Insert after this move')}
      <button type="button" aria-label={t('关闭菜单', 'Close menu')} onClick={() => { setMenuOpen(false); triggerRef.current?.focus(); }}><X size={14} /></button>
    </span>
    <span className="sim-move-rotations">
      {rotations.map(value => <button type="button" key={value} onClick={() => edit(value)}
        aria-label={t('插入 ', 'Insert ') + value}>{value}</button>)}
    </span>
    {replacement && <button type="button" onClick={() => edit('opposite')}>{move!.toString()} → {replacement.toString()} · {t('换到另一侧', 'Use opposite side')}</button>}
    {move && /^[xyz]$/.test(move.family) && <button type="button" onClick={() => edit('remove')}>{t('移除转体并改写后续', 'Remove rotation and rewrite following moves')}</button>}
    {index !== null && index >= 0 && parsed && moveSourceGroup(text, parsed.tokens[index].start) && <span className="sim-move-note">
      {t('修改首次执行；仅展开所在分组。', 'Edit the first execution; expand only its enclosing group.')}
    </span>}
    {error && <span role="status" className="sim-move-note">{error}</span>}
  </div>, document.fullscreenElement ?? document.body);
  const inlineEditor = editing && editorSlot && createPortal(<div className="sim-inline-moves" aria-label={t('选择解法步骤', 'Select solution move')}>
    <span className="sim-move-anchor">
      <button type="button" className="sim-move-start" ref={index === -1 ? triggerRef : undefined} aria-pressed={index === -1}
        aria-label={t('第一步之前', 'Before first move')} onClick={() => select(-1)}>{t('起点', 'Start')}</button>
      {index === -1 && menu}
    </span>{' '}
    {parsed?.tokens.map((token, i) => <Fragment key={token.start}>
      {text.slice(i === 0 ? 0 : parsed.tokens[i - 1].end, token.start)}
      <span className="sim-move-anchor">
        <button type="button" className="sim-move-token" ref={index === i ? triggerRef : undefined} aria-pressed={index === i}
          aria-label={t('动作 ', 'Move ') + (i + 1) + ': ' + token.text} onClick={() => select(i)}>{token.text}</button>
        {index === i && menu}
      </span>
    </Fragment>)}
    {text.slice(parsed?.tokens.at(-1)?.end ?? 0)}
  </div>, editorSlot);
  return <>
    {inlineEditor}
    <div className="sim-player-tools sim-player-tools-row">
      {basicTools}
      <button type="button" aria-expanded={editing} className={editing ? 'sim-transform-active' : undefined}
        disabled={!enabled && !editing} onClick={() => { onEditingChange(!editing); setSelected(null); setMenuOpen(false); }}>
        <PencilLine size={14} />{editing ? t('完成改写', 'Done editing') : t('改一步', 'Edit move')}
      </button>
      <select className="sim-transform-select" aria-label={t('换朝向', 'Orientation')} value="" disabled={!transformEnabled}
        onChange={event => {
          const rotation = new Move(event.target.value);
          transform(move => rotateAlg(move, rotation.family as 'x' | 'y' | 'z', rotation.amount));
        }}>
        <option value="" disabled>{t('换朝向', 'Orientation')}</option>
        {rotations.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <select className="sim-transform-select" aria-label={t('镜像', 'Mirror')} value="" disabled={!transformEnabled}
        onChange={event => { const axis = event.target.value as 'M' | 'S' | 'E'; transform(move => mirrorAlg(move, axis)); }}>
        <option value="" disabled>{t('镜像', 'Mirror')}</option>
        <option value="M">{t('LR 镜像', 'LR mirror')}</option>
        <option value="S">{t('FB 镜像', 'FB mirror')}</option>
        <option value="E">{t('UD 镜像', 'UD mirror')}</option>
      </select>
      <select className="sim-transform-select" aria-label={t('转换范围', 'Transform scope')} value={scope}
        onChange={event => setScopeChoice(event.target.value as 'solution' | 'both')}>
        <option value="solution">{t('仅解法', 'Solution only')}</option>
        <option value="both">{t('打乱与解法', 'Scramble and solution')}</option>
      </select>
    </div>
    <div className="sim-player-tools sim-player-tools-row">
      {canUndo ? <button type="button" onClick={() => {
        history[history.length - 1].undo();
        setHistory(previous => previous.slice(0, -1));
        setSelected(null);
      }}><Undo2 size={14} />{t('撤销', 'Undo')}</button> : undoTool}
      {endTools}
    </div>
    {(hasHandNotation(text) || (scope === 'both' && hasHandNotation(setup))) && <span className="sim-move-note" role="status">
      {t('含指法记号，暂不支持无损转换；原文保留。', 'Finger notation cannot yet be transformed losslessly; the original is preserved.')}
    </span>}
  </>;
}
