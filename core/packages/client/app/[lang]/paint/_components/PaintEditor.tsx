'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePaint } from '../_lib/store';
import {
  matchCommand,
  matchTool,
  NUDGE_BIG,
  NUDGE_SMALL,
} from '../_lib/shortcuts';
import Topbar from './Topbar';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import Inspector from './Inspector';
import ShorthandPanel from './ShorthandPanel';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

export default function PaintEditor() {
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [shorthandOpen, setShorthandOpen] = useState(false);
  const spacePan = useRef(false);

  // measure the canvas grid cell
  useLayoutEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setViewport({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setViewport({ w: Math.round(r.width), h: Math.round(r.height) });
    return () => ro.disconnect();
  }, []);

  // global keyboard
  useEffect(() => {
    const setCanvasSpace = (v: boolean) => {
      spacePan.current = v;
      (Canvas as unknown as { _setSpace?: (v: boolean) => void })._setSpace?.(v);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const st = usePaint.getState();

      // text editing target: let it through (except Escape blurs)
      if (isTypingTarget(e.target) || st.editing) {
        if (e.key === 'Escape') (e.target as HTMLElement)?.blur?.();
        return;
      }

      if (e.key === ' ' && !spacePan.current) {
        setCanvasSpace(true);
        e.preventDefault();
        return;
      }

      const cmd = matchCommand(e);
      if (cmd) {
        e.preventDefault();
        const big = e.shiftKey && cmd.bigWithShift;
        const n = big ? NUDGE_BIG : NUDGE_SMALL;
        switch (cmd.command) {
          case 'undo':
            st.undo();
            break;
          case 'redo':
            st.redo();
            break;
          case 'group':
            st.group();
            break;
          case 'ungroup':
            st.ungroup();
            break;
          case 'forward':
            for (const id of st.selection) st.reorder(id, 'forward');
            break;
          case 'backward':
            for (const id of st.selection) st.reorder(id, 'backward');
            break;
          case 'toFront':
            for (const id of st.selection) st.reorder(id, 'front');
            break;
          case 'toBack':
            for (const id of st.selection) st.reorder(id, 'back');
            break;
          case 'duplicate':
            st.duplicateSelected();
            break;
          case 'copy':
            st.copy();
            break;
          case 'cut':
            st.copy();
            st.removeSelected();
            break;
          case 'paste':
            st.paste();
            break;
          case 'selectAll':
            st.selectAll();
            break;
          case 'delete':
            st.removeSelected();
            break;
          case 'nudgeLeft':
            st.nudge(-n, 0);
            break;
          case 'nudgeRight':
            st.nudge(n, 0);
            break;
          case 'nudgeUp':
            st.nudge(0, -n);
            break;
          case 'nudgeDown':
            st.nudge(0, n);
            break;
          case 'zoomIn':
            st.zoomAt({ x: viewport.w / 2, y: viewport.h / 2 }, 1.2);
            break;
          case 'zoomOut':
            st.zoomAt({ x: viewport.w / 2, y: viewport.h / 2 }, 1 / 1.2);
            break;
          case 'zoomFit':
            st.zoomToFit(viewport.w, viewport.h);
            break;
          case 'zoom100':
            st.zoomTo(1);
            break;
          case 'escape':
            st.clearSelection();
            st.setEphemeral(null);
            st.setTool('select');
            break;
        }
        return;
      }

      const tool = matchTool(e);
      if (tool) {
        e.preventDefault();
        st.setTool(tool);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setCanvasSpace(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [viewport.w, viewport.h]);

  return (
    <>
      <Topbar viewport={viewport} onOpenShorthand={() => setShorthandOpen(true)} />
      <Toolbar />
      <div className="paint-canvas-host" ref={canvasAreaRef} style={{ gridArea: 'canvas', position: 'relative', overflow: 'hidden' }}>
        <Canvas viewport={viewport} />
        <ShorthandPanel open={shorthandOpen} onClose={() => setShorthandOpen(false)} viewport={viewport} />
      </div>
      <Inspector />
    </>
  );
}
