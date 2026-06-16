'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { tr } from '@/i18n/tr';
import type { Bounds, HandleId, Point, Shape, TextShape, ToolId } from '../_lib/types';
import { usePaint, SHAPE_UTILS, getSelectionBounds } from '../_lib/store';
import {
  getShapeBounds,
  getUtil,
  genId,
  makeFreehand,
  smoothPath,
  buildPenD,
  makePath,
  remeasureText,
  TEXT_DEFAULTS,
  type PenAnchor,
} from '../_lib/registry';
import {
  screenToScene,
  sceneToScreen,
  toLocalFrame,
  boundsCenter,
  rotatePoint,
  resizeBounds,
  marqueeIntersectsRotated,
  aabbOfRotated,
  unionBounds,
} from '../_lib/geometry';
import { computeSnap } from '../_lib/snapping';
import { paperInk } from '../_lib/paper';
import Overlay from './Overlay';
import CreateHint from './CreateHint';

const HIT_PX = 6;
const SNAP_PX = 6;
const DRAG_THRESHOLD = 3; // screen px before a create/move drag counts
const DEFAULT_SIZE = 120; // click (no drag) shape size, scene units
const PEN_CLOSE_PX = 9; // screen px around the first anchor that closes the path

type Mode =
  | { kind: 'idle' }
  | { kind: 'create'; tool: ToolId; start: Point }
  | { kind: 'pencil' }
  // pen: multi-click bezier path. `dragging` true while a click-drag is forming
  // a smooth anchor's control handles.
  | { kind: 'pen'; dragging: boolean; downAt: Point }
  // text: a click placed a new text shape and entered inline edit mode.
  | { kind: 'text' }
  | { kind: 'pan'; lastClient: Point }
  | { kind: 'marquee'; start: Point; additive: boolean }
  | { kind: 'move'; start: Point; origins: Record<string, Point>; moved: boolean }
  | {
      kind: 'resize';
      handle: HandleId;
      id: string;
      startBounds: Bounds;
      rotation: number;
      startCenter: Point;
      startAngle: number;
      startRotation: number;
    }
  | {
      kind: 'groupResize';
      handle: Exclude<HandleId, 'rotate'>;
      startBounds: Bounds;
      origins: Record<string, Shape>;
    };

interface Props {
  viewport: { w: number; h: number };
}

const CREATE_TOOLS: Record<string, boolean> = {
  rect: true,
  roundRect: true,
  ellipse: true,
  line: true,
  polygon: true,
  star: true,
};

function toolToShapeType(tool: ToolId): Shape['type'] {
  if (tool === 'roundRect') return 'rect';
  if (
    tool === 'rect' ||
    tool === 'ellipse' ||
    tool === 'line' ||
    tool === 'polygon' ||
    tool === 'star'
  )
    return tool;
  return 'rect';
}

export default function Canvas({ viewport }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const modeRef = useRef<Mode>({ kind: 'idle' });
  const spaceRef = useRef(false);
  // live polygon-sides / star-points override while create-dragging (arrow keys)
  const createCountRef = useRef<number | null>(null);
  const lastCreateRef = useRef<{ start: Point; cur: Point; shift: boolean; alt: boolean } | null>(
    null
  );
  // live freehand capture (scene-space points) while drawing with the pencil
  const pencilRef = useRef<Array<[number, number]>>([]);
  const [pencilD, setPencilD] = useState<string | null>(null);
  // in-progress pen path: placed anchors (scene coords) + live cursor + close hint
  const penRef = useRef<PenAnchor[]>([]);
  const [penAnchors, setPenAnchors] = useState<PenAnchor[]>([]);
  const [penCursor, setPenCursor] = useState<Point | null>(null);
  const [penHoverFirst, setPenHoverFirst] = useState(false);
  // live handle preview while click-dragging a smooth anchor (in/out, scene)
  const [penDragHandles, setPenDragHandles] = useState<{
    pt: Point;
    out: Point;
    in: Point;
  } | null>(null);

  const shapes = usePaint((s) => s.shapes);
  const order = usePaint((s) => s.order);
  const camera = usePaint((s) => s.camera);
  const paper = usePaint((s) => s.paper);
  const tool = usePaint((s) => s.tool);
  const ephemeral = usePaint((s) => s.ephemeral);
  const selection = usePaint((s) => s.selection);
  const editing = usePaint((s) => s.editing);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  // when a fresh placeholder text was just placed, select-all on focus so the
  // first keystroke replaces it (vs. re-editing an existing string = cursor end).
  const selectAllOnFocusRef = useRef(false);

  const vw = viewport.w || 1;
  const vh = viewport.h || 1;
  const viewBox = `${camera.x} ${camera.y} ${vw / camera.zoom} ${vh / camera.zoom}`;

  // client -> scene
  const toScene = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current?.getBoundingClientRect();
      const lx = clientX - (rect?.left ?? 0);
      const ly = clientY - (rect?.top ?? 0);
      return screenToScene({ x: lx, y: ly }, usePaint.getState().camera);
    },
    []
  );

  // top-most shape under a scene point (skips hidden/locked)
  const hitTopShape = useCallback(
    (scene: Point, opts: { includeLocked?: boolean } = {}): string | null => {
      const st = usePaint.getState();
      const tol = HIT_PX / st.camera.zoom;
      for (let i = st.order.length - 1; i >= 0; i--) {
        const id = st.order[i];
        const s = st.shapes[id];
        if (!s || s.hidden) continue;
        if (s.locked && !opts.includeLocked) continue;
        const b = getShapeBounds(s);
        const local = toLocalFrame(scene, b, s.rotation);
        if (getUtil(s.type).hitTest(s, local, tol)) return id;
      }
      return null;
    },
    []
  );

  // ---- handle hit-test (screen space) for the selection overlay ----
  const hitHandle = useCallback(
    (scene: Point): { handle: HandleId; id: string | null; group: boolean } | null => {
      const st = usePaint.getState();
      const tol = 11 / st.camera.zoom;
      // multi-selection: hit-test the 8 handles of the axis-aligned group bbox
      // (no rotation, no rotate handle).
      if (st.selection.length >= 2) {
        const bb = getSelectionBounds(st);
        if (!bb) return null;
        const handles: Exclude<HandleId, 'rotate'>[] = [
          'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w',
        ];
        for (const h of handles) {
          const p = handleLocal(h, bb);
          if (Math.hypot(scene.x - p.x, scene.y - p.y) <= tol) {
            return { handle: h, id: null, group: true };
          }
        }
        return null;
      }
      if (st.selection.length !== 1) return null;
      const s = st.shapes[st.selection[0]];
      if (!s || s.locked) return null;
      const b = getShapeBounds(s);
      const rotOffset = 26 / st.camera.zoom;
      const handles: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate'];
      for (const h of handles) {
        const local =
          h === 'rotate'
            ? { x: b.x + b.width / 2, y: b.y - rotOffset }
            : handleLocal(h, b);
        const scenePos = s.rotation ? rotatePoint(local, boundsCenter(b), s.rotation) : local;
        if (Math.hypot(scene.x - scenePos.x, scene.y - scenePos.y) <= tol) {
          return { handle: h, id: s.id, group: false };
        }
      }
      return null;
    },
    []
  );

  // Focus the inline editor when entering edit mode. Deferred a frame so the
  // pointerup/click that placed the text fully settles first — otherwise the
  // click lands on the (non-focusable) SVG and blurs the textarea, which would
  // immediately commit + exit the brand-new edit.
  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => {
      const el = textAreaRef.current;
      if (!el) return;
      el.focus();
      if (selectAllOnFocusRef.current) {
        el.select();
        selectAllOnFocusRef.current = false;
      } else {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [editing]);

  // ---- text helpers ----
  // Commit the currently-edited text shape: re-measure, drop empties, end edit.
  const commitEdit = useCallback(() => {
    const st = usePaint.getState();
    const id = st.editing;
    if (!id) return;
    const s = st.shapes[id];
    st.setEditing(null);
    if (!s || s.type !== 'text') return;
    if (!s.text.trim()) {
      st.removeShapes([id]);
      return;
    }
    const m = remeasureText(s);
    st.updateShape(id, { width: m.width, height: m.height }, true);
  }, []);

  // Enter edit mode for an existing text shape.
  const enterEdit = useCallback((id: string) => {
    const st = usePaint.getState();
    st.setSelection([id]);
    st.setEditing(id);
  }, []);

  // ---- pen helpers ----
  const resetPen = useCallback(() => {
    penRef.current = [];
    setPenAnchors([]);
    setPenCursor(null);
    setPenHoverFirst(false);
    setPenDragHandles(null);
  }, []);

  // Commit the in-progress pen path (closed appends Z), select it, back to select.
  const finishPen = useCallback(
    (closed: boolean) => {
      const anchors = penRef.current;
      const raw = makePath(anchors, closed);
      const shape = raw ? withInk(raw) : raw;
      resetPen();
      modeRef.current = { kind: 'idle' };
      if (shape) {
        const st = usePaint.getState();
        st.addShape(shape, true);
        st.setSelection([shape.id]);
        st.setTool('select');
      } else if (anchors.length) {
        // not enough points for a path — just drop and switch to select
        usePaint.getState().setTool('select');
      }
    },
    [resetPen]
  );

  // Remove the last placed anchor (Backspace while drawing).
  const popPenAnchor = useCallback(() => {
    const anchors = penRef.current;
    if (!anchors.length) return;
    anchors.pop();
    if (!anchors.length) {
      resetPen();
      modeRef.current = { kind: 'idle' };
    } else {
      setPenAnchors([...anchors]);
    }
  }, [resetPen]);

  // Keyboard while the pen is active: Enter closes (if ≥3 anchors) else finishes
  // open; Esc/double-handled elsewhere; Backspace removes last anchor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // active whenever the pen tool has an in-progress path (mode is 'idle'
      // between clicks, so don't gate on mode).
      if (usePaint.getState().tool !== 'pen' || !penRef.current.length) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishPen(penRef.current.length >= 3);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishPen(false);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        popPenAnchor();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finishPen, popPenAnchor]);

  // Leaving the pen tool (toolbar / shortcut) commits any open path.
  useEffect(() => {
    if (tool !== 'pen' && penRef.current.length) {
      const anchors = penRef.current;
      const raw = makePath(anchors, false);
      const shape = raw ? withInk(raw) : raw;
      resetPen();
      if (modeRef.current.kind === 'pen') modeRef.current = { kind: 'idle' };
      if (shape) {
        const st = usePaint.getState();
        st.addShape(shape, true);
      }
    }
  }, [tool, resetPen]);

  // Up/Down while create-dragging a polygon/star changes sides/points live.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = modeRef.current;
      if (m.kind !== 'create' || (m.tool !== 'polygon' && m.tool !== 'star')) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      e.stopPropagation();
      const st = usePaint.getState();
      const cur =
        createCountRef.current ??
        (st.ephemeral && (st.ephemeral.type === 'polygon' || st.ephemeral.type === 'star')
          ? st.ephemeral.type === 'polygon'
            ? st.ephemeral.sides
            : st.ephemeral.points
          : 5);
      const next = Math.max(3, cur + (e.key === 'ArrowUp' ? 1 : -1));
      createCountRef.current = next;
      const lc = lastCreateRef.current;
      if (lc) {
        st.setEphemeral(
          buildCreateEphemeral(m.tool, lc.start, lc.cur, lc.shift, lc.alt, next)
        );
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // ================= POINTER DOWN =================
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button === 1 || e.button === 2) return;
      svgRef.current?.setPointerCapture(e.pointerId);
      const st = usePaint.getState();
      const scene = toScene(e.clientX, e.clientY);

      // pan: hand tool or space held or middle-ish
      if (st.tool === 'hand' || spaceRef.current) {
        modeRef.current = { kind: 'pan', lastClient: { x: e.clientX, y: e.clientY } };
        return;
      }

      // pencil: start collecting scene points for a freehand stroke
      if (st.tool === 'pencil') {
        pencilRef.current = [[scene.x, scene.y]];
        setPencilD(`M ${scene.x} ${scene.y}`);
        modeRef.current = { kind: 'pencil' };
        return;
      }

      // pen: place anchors for a bezier path (multi-click gesture)
      if (st.tool === 'pen') {
        const anchors = penRef.current;
        // clicking the FIRST anchor closes the path
        if (anchors.length >= 2) {
          const first = anchors[0].pt;
          const closeTol = PEN_CLOSE_PX / st.camera.zoom;
          if (Math.hypot(scene.x - first[0], scene.y - first[1]) <= closeTol) {
            finishPen(true);
            return;
          }
        }
        anchors.push({ pt: [scene.x, scene.y] });
        setPenAnchors([...anchors]);
        setPenCursor(scene);
        setPenHoverFirst(false);
        modeRef.current = { kind: 'pen', dragging: false, downAt: scene };
        return;
      }

      // text: clicking an existing text re-enters its edit; otherwise place a
      // new empty text shape at the click and start editing immediately.
      if (st.tool === 'text') {
        // release the capture so the textarea can take focus/interaction.
        try {
          svgRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (st.editing) commitEdit();
        const hit = hitTopShape(scene);
        const hitShape = hit ? st.shapes[hit] : null;
        if (hitShape && hitShape.type === 'text') {
          enterEdit(hit!);
          modeRef.current = { kind: 'text' };
          return;
        }
        const fontSize = TEXT_DEFAULTS.fontSize;
        const text = tr({ zh: '文字', en: 'Text' });
        const m = remeasureText({
          ...(TEXT_DEFAULTS as unknown as TextShape),
          text,
          fontSize,
        });
        const shape: TextShape = {
          id: genId('text'),
          type: 'text',
          x: scene.x,
          y: scene.y - fontSize * 0.41, // center the cap-height roughly on the click
          width: m.width,
          height: m.height,
          rotation: 0,
          fill: currentInk(),
          stroke: 'none',
          strokeWidth: 0,
          opacity: 1,
          ...TEXT_DEFAULTS,
          text,
        };
        st.addShape(shape, true);
        st.setSelection([shape.id]);
        st.setEditing(shape.id);
        // a fresh placeholder gets selected so typing replaces it.
        selectAllOnFocusRef.current = true;
        modeRef.current = { kind: 'text' };
        return;
      }

      // eyedropper: sample the shape under the cursor, apply to selection
      if (st.tool === 'eyedropper') {
        const id = hitTopShape(scene, { includeLocked: true });
        if (id) {
          const src = st.shapes[id];
          const sel = st.selection.filter((sid) => sid !== id);
          if (src && sel.length) {
            st.updateShapes(
              sel,
              {
                fill: src.fill,
                stroke: src.stroke,
                strokeWidth: src.strokeWidth,
                opacity: src.opacity,
              },
              true
            );
          }
        }
        modeRef.current = { kind: 'idle' };
        return;
      }

      // create tools
      if (CREATE_TOOLS[st.tool]) {
        createCountRef.current = null;
        lastCreateRef.current = { start: scene, cur: scene, shift: false, alt: false };
        modeRef.current = { kind: 'create', tool: st.tool, start: scene };
        return;
      }

      // ---- select tool ----
      // 1) handle drag (resize / rotate)?
      const handleHit = hitHandle(scene);
      if (handleHit && handleHit.group) {
        // group resize: snapshot every selected shape; scale all proportionally
        const startBounds = getSelectionBounds(st)!;
        const origins: Record<string, Shape> = {};
        for (const id of st.selection) {
          const sh = st.shapes[id];
          if (sh && !sh.locked) origins[id] = { ...sh };
        }
        st.beginHistory();
        modeRef.current = {
          kind: 'groupResize',
          handle: handleHit.handle as Exclude<HandleId, 'rotate'>,
          startBounds,
          origins,
        };
        return;
      }
      if (handleHit && handleHit.id) {
        const s = st.shapes[handleHit.id];
        const b = getShapeBounds(s);
        const center = boundsCenter(b);
        st.beginHistory();
        modeRef.current = {
          kind: 'resize',
          handle: handleHit.handle,
          id: handleHit.id,
          startBounds: b,
          rotation: s.rotation,
          startCenter: center,
          startAngle: Math.atan2(scene.y - center.y, scene.x - center.x),
          startRotation: s.rotation,
        };
        return;
      }

      // 2) shape under cursor?
      const hitId = hitTopShape(scene);
      const additive = e.shiftKey;
      if (hitId) {
        const already = st.selection.includes(hitId);
        if (additive) {
          st.toggleSelection(hitId);
        } else if (!already) {
          st.setSelection([hitId]);
        }
        // begin a move drag of the (possibly new) selection
        const sel = usePaint.getState().selection;
        const origins: Record<string, Point> = {};
        for (const id of sel) {
          const sh = usePaint.getState().shapes[id];
          if (sh && !sh.locked) origins[id] = { x: sh.x, y: sh.y };
        }
        st.beginHistory();
        modeRef.current = { kind: 'move', start: scene, origins, moved: false };
        return;
      }

      // 3) empty: start marquee (clear unless additive)
      if (!additive) st.clearSelection();
      modeRef.current = { kind: 'marquee', start: scene, additive };
      st.setMarquee({ x: scene.x, y: scene.y, width: 0, height: 0 });
    },
    [toScene, hitHandle, hitTopShape, finishPen, enterEdit, commitEdit]
  );

  // ================= POINTER MOVE =================
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const st = usePaint.getState();
      const m = modeRef.current;
      const scene = toScene(e.clientX, e.clientY);

      // hover highlight when idle + select tool
      if (m.kind === 'idle') {
        if (st.tool === 'select') {
          const id = hitTopShape(scene);
          setHoverId(id);
        } else if (hoverId) {
          setHoverId(null);
        }
        // pen rubber-band between clicks: track cursor + first-anchor close hint
        if (st.tool === 'pen' && penRef.current.length) {
          setPenCursor(scene);
          const first = penRef.current[0].pt;
          const closeTol = PEN_CLOSE_PX / st.camera.zoom;
          setPenHoverFirst(
            penRef.current.length >= 2 &&
              Math.hypot(scene.x - first[0], scene.y - first[1]) <= closeTol
          );
        }
        return;
      }

      switch (m.kind) {
        case 'pan': {
          const dx = e.clientX - m.lastClient.x;
          const dy = e.clientY - m.lastClient.y;
          st.panBy(dx, dy);
          m.lastClient = { x: e.clientX, y: e.clientY };
          break;
        }
        case 'pencil': {
          const pts = pencilRef.current;
          const last = pts[pts.length - 1];
          // throttle: skip points closer than ~1.5 screen px to the last one
          const minD = 1.5 / st.camera.zoom;
          if (!last || Math.hypot(scene.x - last[0], scene.y - last[1]) >= minD) {
            pts.push([scene.x, scene.y]);
            setPencilD(smoothPath(pts));
          }
          break;
        }
        case 'pen': {
          // dragging past threshold turns the just-placed anchor into a smooth
          // one with symmetric handles (out = cursor, in = mirror).
          const anchors = penRef.current;
          if (!anchors.length) break;
          const moved = Math.hypot(
            (scene.x - m.downAt.x) * st.camera.zoom,
            (scene.y - m.downAt.y) * st.camera.zoom
          );
          if (m.dragging || moved >= DRAG_THRESHOLD) {
            m.dragging = true;
            const a = anchors[anchors.length - 1];
            const px = a.pt[0];
            const py = a.pt[1];
            a.hOut = [scene.x, scene.y];
            a.hIn = [2 * px - scene.x, 2 * py - scene.y];
            setPenDragHandles({
              pt: { x: px, y: py },
              out: { x: scene.x, y: scene.y },
              in: { x: a.hIn[0], y: a.hIn[1] },
            });
            setPenAnchors([...anchors]);
            setPenCursor(scene);
          }
          break;
        }
        case 'create': {
          lastCreateRef.current = {
            start: m.start,
            cur: scene,
            shift: e.shiftKey,
            alt: e.altKey,
          };
          st.setEphemeral(
            buildCreateEphemeral(
              m.tool,
              m.start,
              scene,
              e.shiftKey,
              e.altKey,
              createCountRef.current
            )
          );
          break;
        }
        case 'marquee': {
          const b = normRect(m.start, scene);
          st.setMarquee(b);
          break;
        }
        case 'move': {
          let dx = scene.x - m.start.x;
          let dy = scene.y - m.start.y;
          if (!m.moved && Math.hypot(dx * st.camera.zoom, dy * st.camera.zoom) < DRAG_THRESHOLD) {
            break;
          }
          m.moved = true;
          const ids = Object.keys(m.origins);
          // snapping (disabled while ctrl/meta held)
          if (!(e.ctrlKey || e.metaKey) && ids.length) {
            const movedBoxes = ids.map((id) => {
              const o = m.origins[id];
              const sh = st.shapes[id];
              return aabbOfRotated(
                { x: o.x + dx, y: o.y + dy, width: sh.width, height: sh.height },
                sh.rotation
              );
            });
            const moving = unionBounds(movedBoxes);
            if (moving) {
              const targets = st.order
                .filter((id) => !m.origins[id])
                .map((id) => st.shapes[id])
                .filter((s): s is Shape => !!s && !s.hidden)
                .map((s) => aabbOfRotated(getShapeBounds(s), s.rotation));
              const snap = computeSnap(moving, targets, SNAP_PX / st.camera.zoom);
              dx += snap.dx;
              dy += snap.dy;
              st.setSnapLines(
                snap.lines.x.length || snap.lines.y.length ? snap.lines : null
              );
            }
          } else {
            st.setSnapLines(null);
          }
          st.updateShapes(
            ids,
            (s) => {
              const o = m.origins[s.id];
              return { x: o.x + dx, y: o.y + dy };
            },
            false
          );
          break;
        }
        case 'resize': {
          if (m.handle === 'rotate') {
            const ang = Math.atan2(scene.y - m.startCenter.y, scene.x - m.startCenter.x);
            let deg = m.startRotation + ((ang - m.startAngle) * 180) / Math.PI;
            if (e.shiftKey) deg = Math.round(deg / 15) * 15;
            deg = ((deg % 360) + 360) % 360;
            st.updateShape(m.id, { rotation: deg }, false);
          } else {
            const nb = resizeBounds(
              m.handle as Exclude<HandleId, 'rotate'>,
              m.startBounds,
              m.rotation,
              scene,
              { shift: e.shiftKey, alt: e.altKey }
            );
            const sh = st.shapes[m.id];
            const patch = getUtil(sh.type).resize?.(sh, nb) ?? {
              x: nb.x,
              y: nb.y,
              width: nb.width,
              height: nb.height,
            };
            st.updateShape(m.id, patch, false);
          }
          break;
        }
        case 'groupResize': {
          const nb = resizeBounds(m.handle, m.startBounds, 0, scene, {
            shift: e.shiftKey,
            alt: e.altKey,
          });
          const sx = m.startBounds.width === 0 ? 1 : nb.width / m.startBounds.width;
          const sy = m.startBounds.height === 0 ? 1 : nb.height / m.startBounds.height;
          const patchById: Record<string, Partial<Shape>> = {};
          for (const id in m.origins) {
            const orig = m.origins[id];
            const ob = getShapeBounds(orig);
            const childNB = {
              x: nb.x + (ob.x - m.startBounds.x) * sx,
              y: nb.y + (ob.y - m.startBounds.y) * sy,
              width: ob.width * sx,
              height: ob.height * sy,
            };
            patchById[id] = getUtil(orig.type).resize?.(orig, childNB) ?? {
              x: childNB.x,
              y: childNB.y,
              width: childNB.width,
              height: childNB.height,
            };
          }
          st.updateShapes(Object.keys(patchById), (s) => patchById[s.id], false);
          break;
        }
      }
    },
    [toScene, hitTopShape, hoverId]
  );

  // ================= POINTER UP =================
  const onPointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const st = usePaint.getState();
      const m = modeRef.current;
      modeRef.current = { kind: 'idle' };
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      switch (m.kind) {
        case 'create': {
          let eph = st.ephemeral;
          const scene = toScene(e.clientX, e.clientY);
          const drag = Math.hypot(
            (scene.x - m.start.x) * st.camera.zoom,
            (scene.y - m.start.y) * st.camera.zoom
          );
          const type = toolToShapeType(m.tool);
          if (drag < DRAG_THRESHOLD || !eph) {
            // click: default-sized shape centered on click (line = horizontal stroke)
            const isLine = type === 'line';
            const b: Bounds = {
              x: m.start.x - DEFAULT_SIZE / 2,
              y: isLine ? m.start.y : m.start.y - DEFAULT_SIZE / 2,
              width: DEFAULT_SIZE,
              height: isLine ? 0 : DEFAULT_SIZE,
            };
            const rx = m.tool === 'roundRect' ? DEFAULT_SIZE * 0.18 : 0;
            eph = withInk(SHAPE_UTILS[type].create(b, { rx }));
            eph = applyCount(eph, createCountRef.current);
          }
          createCountRef.current = null;
          lastCreateRef.current = null;
          st.setEphemeral(null);
          if (eph) {
            st.addShape(eph, true);
            st.setSelection([eph.id]);
            st.setTool('select');
          }
          break;
        }
        case 'pencil': {
          const pts = pencilRef.current;
          pencilRef.current = [];
          setPencilD(null);
          const raw = makeFreehand(pts);
          const shape = raw ? withInk(raw) : raw;
          if (shape) {
            st.addShape(shape, true);
            st.setSelection([shape.id]);
            st.setTool('select');
          }
          break;
        }
        case 'pen': {
          // finish this anchor; stay in the pen gesture (idle resumes rubber-band).
          setPenDragHandles(null);
          break;
        }
        case 'marquee': {
          const marq = st.marquee;
          st.setMarquee(null);
          if (marq && (Math.abs(marq.width) > 1 || Math.abs(marq.height) > 1)) {
            const hits = st.order.filter((id) => {
              const s = st.shapes[id];
              if (!s || s.hidden || s.locked) return false;
              return marqueeIntersectsRotated(marq, getShapeBounds(s), s.rotation);
            });
            st.setSelection(m.additive ? [...new Set([...st.selection, ...hits])] : hits);
          }
          break;
        }
        case 'move': {
          st.setSnapLines(null);
          if (m.moved) st.commit();
          break;
        }
        case 'resize': {
          st.commit();
          break;
        }
        case 'groupResize': {
          st.commit();
          break;
        }
      }
    },
    [toScene]
  );

  // ================= WHEEL =================
  const onWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    const st = usePaint.getState();
    const rect = svgRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left ?? 0);
    const py = e.clientY - (rect?.top ?? 0);
    if (e.ctrlKey || e.metaKey) {
      // pinch / ctrl-wheel zoom
      st.zoomAt({ x: px, y: py }, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    } else if (Math.abs(e.deltaX) > 0 || e.shiftKey) {
      st.panBy(-(e.shiftKey ? e.deltaY : e.deltaX), e.shiftKey ? 0 : -e.deltaY);
    } else {
      st.panBy(0, -e.deltaY);
    }
  }, []);

  const cursor = computeCursor(tool, modeRef.current.kind, hoverId, selection, spaceRef.current);

  const wrapStyle: CSSProperties = { cursor };

  // expose space toggling to PaintEditor via window-less ref
  (Canvas as unknown as { _setSpace?: (v: boolean) => void })._setSpace = (v: boolean) => {
    spaceRef.current = v;
  };

  return (
    <div className="paint-canvas-wrap" style={wrapStyle}>
      <svg
        ref={svgRef}
        className="paint-canvas-svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={(e) => {
          // pen: double-click finishes an open path (drop the duplicate anchor
          // the second click placed).
          if (usePaint.getState().tool === 'pen' && penRef.current.length) {
            if (penRef.current.length > 1) penRef.current.pop();
            finishPen(false);
            return;
          }
          const scene = toScene(e.clientX, e.clientY);
          const id = hitTopShape(scene);
          if (id) {
            const s = usePaint.getState().shapes[id];
            // double-click a text shape -> re-enter inline editing
            if (s && s.type === 'text') {
              enterEdit(id);
              return;
            }
            usePaint.getState().setSelection([id]);
          } else usePaint.getState().clearSelection();
        }}
      >
        {order.map((id) => {
          const s = shapes[id];
          if (!s || s.hidden) return null;
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          const util = SHAPE_UTILS[s.type];
          const isHover = hoverId === id && tool === 'select' && !selection.includes(id);
          const isEditing = editing === id && s.type === 'text';
          return (
            <g
              key={id}
              transform={s.rotation ? `rotate(${s.rotation} ${cx} ${cy})` : undefined}
            >
              {/* the live <textarea> overlay shows the text while editing */}
              {!isEditing && util.render(s)}
              {isHover && (
                <rect
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={1 / camera.zoom}
                  pointerEvents="none"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}

        {ephemeral &&
          (() => {
            const s = ephemeral;
            const cx = s.x + s.width / 2;
            const cy = s.y + s.height / 2;
            return (
              <g transform={s.rotation ? `rotate(${s.rotation} ${cx} ${cy})` : undefined}>
                {SHAPE_UTILS[s.type].render(s)}
              </g>
            );
          })()}

        {pencilD && (
          <path
            d={pencilD}
            fill="none"
            stroke={paperInk(paper).ink}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}

        {tool === 'pen' &&
          penAnchors.length > 0 &&
          (() => {
            const z = camera.zoom;
            const r = 4 / z; // anchor dot radius
            const sw = 1.5 / z;
            // committed path so far
            const committed = buildPenD(penAnchors, false);
            // rubber-band from last anchor to the cursor (corner segment)
            const rubber =
              penCursor && !penHoverFirst
                ? buildPenD(
                    [penAnchors[penAnchors.length - 1], { pt: [penCursor.x, penCursor.y] }],
                    false
                  )
                : null;
            const first = penAnchors[0].pt;
            return (
              <g pointerEvents="none">
                {committed && (
                  <path
                    d={committed}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {rubber && (
                  <path
                    d={rubber}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={1}
                    strokeDasharray={`${4 / z} ${3 / z}`}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {/* live control handles while dragging a smooth anchor */}
                {penDragHandles && (
                  <>
                    <line
                      x1={penDragHandles.in.x}
                      y1={penDragHandles.in.y}
                      x2={penDragHandles.out.x}
                      y2={penDragHandles.out.y}
                      stroke="#2563eb"
                      strokeWidth={sw}
                    />
                    <circle cx={penDragHandles.in.x} cy={penDragHandles.in.y} r={r * 0.8} fill="#2563eb" />
                    <circle cx={penDragHandles.out.x} cy={penDragHandles.out.y} r={r * 0.8} fill="#2563eb" />
                  </>
                )}
                {/* anchor dots */}
                {penAnchors.map((a, i) => (
                  <circle
                    key={i}
                    cx={a.pt[0]}
                    cy={a.pt[1]}
                    r={r}
                    fill={i === 0 ? '#ffffff' : '#2563eb'}
                    stroke="#2563eb"
                    strokeWidth={sw}
                  />
                ))}
                {/* close affordance on the first anchor */}
                {penAnchors.length >= 2 && (
                  <circle
                    cx={first[0]}
                    cy={first[1]}
                    r={(penHoverFirst ? 7 : 5.5) / z}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={(penHoverFirst ? 2 : 1) / z}
                  />
                )}
              </g>
            );
          })()}
      </svg>

      <Overlay viewport={viewport} />

      <CreateHint />

      {editing &&
        shapes[editing] &&
        shapes[editing].type === 'text' &&
        (() => {
          const s = shapes[editing] as TextShape;
          const tl = sceneToScreen({ x: s.x, y: s.y }, camera);
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          const cScreen = sceneToScreen({ x: cx, y: cy }, camera);
          // +2px keeps the caret from clipping at the right edge.
          const w = Math.max(s.width, s.fontSize * 0.4) * camera.zoom + 2;
          const h = Math.max(s.height, s.fontSize * 1.25) * camera.zoom;
          return (
            <textarea
              ref={textAreaRef}
              className="paint-text-edit"
              spellCheck={false}
              value={s.text}
              onChange={(e) => {
                const text = e.target.value;
                const m = remeasureText({ ...s, text });
                usePaint.getState().updateShape(
                  editing,
                  { text, width: m.width, height: m.height },
                  false
                );
              }}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                left: tl.x,
                top: tl.y,
                width: w,
                height: h,
                fontSize: s.fontSize * camera.zoom,
                fontFamily: s.fontFamily,
                fontWeight: s.fontWeight,
                lineHeight: 1.25,
                textAlign: s.textAlign,
                color: s.fill === 'none' ? 'transparent' : s.fill,
                transform: s.rotation
                  ? `rotate(${s.rotation}deg)`
                  : undefined,
                transformOrigin: `${cScreen.x - tl.x}px ${cScreen.y - tl.y}px`,
              }}
            />
          );
        })()}

      {order.length === 0 && !ephemeral && penAnchors.length === 0 && (
        <div className="paint-empty-hint">
          {tr({
            zh: '选一个形状工具，在画布上拖动开始绘制',
            en: 'Pick a shape tool and drag on the canvas to start',
          })}
        </div>
      )}
    </div>
  );
}

// ---- helpers ----

// Current default ink (stroke / text color) for the active paper. Read lazily
// from the store so dark paper -> light ink, light paper -> dark ink. The fill
// gray from COMMON_DEFAULTS is left alone (reads on both papers).
function currentInk(): string {
  return paperInk(usePaint.getState().paper).ink;
}

// Override a freshly-created shape's default stroke (and text fill) with the
// paper-derived ink, so the outline / strokes / text stay visible on any paper.
// The default fill gray is intentionally left untouched.
function withInk<S extends Shape>(shape: S): S {
  const ink = currentInk();
  if (shape.type === 'text') return { ...shape, fill: ink } as S;
  return { ...shape, stroke: ink } as S;
}

// Build the create-preview shape, applying a live sides/points override.
function buildCreateEphemeral(
  tool: ToolId,
  start: Point,
  cur: Point,
  shift: boolean,
  alt: boolean,
  count?: number | null
): Shape {
  const bounds = boundsFromDrag(start, cur, shift, alt);
  const type = toolToShapeType(tool);
  const rx = tool === 'roundRect' ? Math.min(bounds.width, bounds.height) * 0.18 : 0;
  return withInk(applyCount(SHAPE_UTILS[type].create(bounds, { rx }), count ?? null));
}

function applyCount<S extends Shape>(shape: S, count: number | null): S {
  if (count == null) return shape;
  if (shape.type === 'polygon') return { ...shape, sides: Math.max(3, count) };
  if (shape.type === 'star') return { ...shape, points: Math.max(3, count) };
  return shape;
}

function handleLocal(h: HandleId, b: Bounds): Point {
  const fx = h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5;
  const fy = h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}

function normRect(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

// shift=square/45deg, alt=from center
function boundsFromDrag(start: Point, cur: Point, shift: boolean, alt: boolean): Bounds {
  let dx = cur.x - start.x;
  let dy = cur.y - start.y;
  if (shift) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * m;
    dy = Math.sign(dy || 1) * m;
  }
  if (alt) {
    return { x: start.x - dx, y: start.y - dy, width: dx * 2, height: dy * 2 };
  }
  return { x: start.x, y: start.y, width: dx, height: dy };
}

function computeCursor(
  tool: ToolId,
  mode: Mode['kind'],
  hoverId: string | null,
  selection: string[],
  space: boolean
): string {
  if (space || tool === 'hand') return mode === 'pan' ? 'grabbing' : 'grab';
  if (CREATE_TOOLS[tool]) return 'crosshair';
  if (tool === 'pencil') return 'crosshair';
  if (tool === 'pen') return 'crosshair';
  if (tool === 'text') return 'text';
  if (tool === 'eyedropper') return 'copy';
  if (mode === 'move') return 'move';
  if (tool === 'select' && hoverId) {
    return selection.includes(hoverId) ? 'move' : 'pointer';
  }
  return 'default';
}
