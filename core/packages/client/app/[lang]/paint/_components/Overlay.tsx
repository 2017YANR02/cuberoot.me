'use client';

import { useMemo } from 'react';
import type { HandleId, Point } from '../_lib/types';
import { usePaint, getSelectionBounds } from '../_lib/store';
import { getShapeBounds } from '../_lib/registry';
import {
  sceneToScreen,
  getRotatedCorners,
  boundsCenter,
  rotatePoint,
} from '../_lib/geometry';

const ROTATE_OFFSET_SCREEN = 26;
const HANDLE_SIZE = 9; // screen px
const ACCENT = '#2563eb';

interface Props {
  viewport: { w: number; h: number };
}

const RESIZE_HANDLES: Exclude<HandleId, 'rotate'>[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

const HANDLE_CURSOR: Record<Exclude<HandleId, 'rotate'>, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

export default function Overlay({ viewport }: Props) {
  const camera = usePaint((s) => s.camera);
  const selection = usePaint((s) => s.selection);
  const shapes = usePaint((s) => s.shapes);
  const marquee = usePaint((s) => s.marquee);
  const snapLines = usePaint((s) => s.snapLines);

  // single-shape selection: rotation-aware box; multi: AABB box (no rotate handle)
  const single = selection.length === 1 ? shapes[selection[0]] : null;

  const selBox = useMemo(() => {
    if (single) {
      const b = getShapeBounds(single);
      const corners = getRotatedCorners(b, single.rotation).map((p) =>
        sceneToScreen(p, camera)
      );
      const center = boundsCenter(b);
      // resize handle screen positions
      const handles = RESIZE_HANDLES.map((h) => {
        const fx = h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5;
        const fy = h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
        const local = { x: b.x + b.width * fx, y: b.y + b.height * fy };
        const scene = single.rotation
          ? rotatePoint(local, center, single.rotation)
          : local;
        return { id: h, p: sceneToScreen(scene, camera) };
      });
      const topMidLocal = { x: b.x + b.width / 2, y: b.y };
      const topMidScene = single.rotation
        ? rotatePoint(topMidLocal, center, single.rotation)
        : topMidLocal;
      const topMid = sceneToScreen(topMidScene, camera);
      // rotate handle sits ROTATE_OFFSET above the (rotated) top edge, along the box's up vector
      const upLocal = { x: b.x + b.width / 2, y: b.y - 100 };
      const upScene = single.rotation ? rotatePoint(upLocal, center, single.rotation) : upLocal;
      const upScreen = sceneToScreen(upScene, camera);
      const vlen = Math.hypot(upScreen.x - topMid.x, upScreen.y - topMid.y) || 1;
      const rotate = {
        x: topMid.x + ((upScreen.x - topMid.x) / vlen) * ROTATE_OFFSET_SCREEN,
        y: topMid.y + ((upScreen.y - topMid.y) / vlen) * ROTATE_OFFSET_SCREEN,
      };
      return { corners, handles, topMid, rotate, rotation: single.rotation };
    }
    if (selection.length < 2) return null;
    const bb = getSelectionBounds(usePaint.getState());
    if (!bb) return null;
    const corners = [
      { x: bb.x, y: bb.y },
      { x: bb.x + bb.width, y: bb.y },
      { x: bb.x + bb.width, y: bb.y + bb.height },
      { x: bb.x, y: bb.y + bb.height },
    ].map((p) => sceneToScreen(p, camera));
    // resize handles on the axis-aligned group bbox (no rotation, no rotate handle)
    const handles = RESIZE_HANDLES.map((h) => {
      const fx = h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5;
      const fy = h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
      return {
        id: h,
        p: sceneToScreen({ x: bb.x + bb.width * fx, y: bb.y + bb.height * fy }, camera),
      };
    });
    return { corners, handles, topMid: null, rotate: null, rotation: 0 };
  }, [single, selection, shapes, camera]);

  const cornerPath = (corners: Point[]) =>
    corners.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' Z';

  return (
    <svg
      className="paint-overlay-svg"
      width={viewport.w}
      height={viewport.h}
      viewBox={`0 0 ${viewport.w} ${viewport.h}`}
    >
      {/* snap guide lines (scene -> screen) */}
      {snapLines?.x?.map((x, i) => {
        const a = sceneToScreen({ x, y: camera.y }, camera);
        return (
          <line
            key={`sx${i}`}
            x1={a.x}
            y1={0}
            x2={a.x}
            y2={viewport.h}
            stroke={ACCENT}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.9}
          />
        );
      })}
      {snapLines?.y?.map((y, i) => {
        const a = sceneToScreen({ x: camera.x, y }, camera);
        return (
          <line
            key={`sy${i}`}
            x1={0}
            y1={a.y}
            x2={viewport.w}
            y2={a.y}
            stroke={ACCENT}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.9}
          />
        );
      })}

      {/* marquee */}
      {marquee && (
        <rect
          x={sceneToScreen({ x: marquee.x, y: marquee.y }, camera).x}
          y={sceneToScreen({ x: marquee.x, y: marquee.y }, camera).y}
          width={marquee.width * camera.zoom}
          height={marquee.height * camera.zoom}
          fill={`${ACCENT}1a`}
          stroke={ACCENT}
          strokeWidth={1}
        />
      )}

      {/* selection box + handles */}
      {selBox && (
        <>
          <path
            d={cornerPath(selBox.corners)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
          />
          {selBox.rotate && selBox.topMid && (
            <>
              <line
                x1={selBox.topMid.x}
                y1={selBox.topMid.y}
                x2={selBox.rotate.x}
                y2={selBox.rotate.y}
                stroke={ACCENT}
                strokeWidth={1.5}
              />
              <circle
                className="paint-handle"
                cx={selBox.rotate.x}
                cy={selBox.rotate.y}
                r={HANDLE_SIZE / 2 + 1}
                fill="var(--card)"
                stroke={ACCENT}
                strokeWidth={1.5}
                style={{ cursor: 'grab' }}
              />
            </>
          )}
          {selBox.handles.map((h) => (
            <rect
              key={h.id}
              className="paint-handle"
              x={h.p.x - HANDLE_SIZE / 2}
              y={h.p.y - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              rx={2}
              fill="var(--card)"
              stroke={ACCENT}
              strokeWidth={1.5}
              style={{ cursor: HANDLE_CURSOR[h.id as Exclude<HandleId, 'rotate'>] }}
            />
          ))}
        </>
      )}
    </svg>
  );
}
