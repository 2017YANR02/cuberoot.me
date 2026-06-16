'use client';

import { tr } from '@/i18n/tr';
import { usePaint } from '../_lib/store';
import { getShapeBounds } from '../_lib/registry';
import { sceneToScreen } from '../_lib/geometry';

// Discoverability hints for the polygon / star "drag + ↑/↓ to change count" gesture.
//
// Two unobtrusive overlays (both pointer-events:none so they never interfere
// with drawing), driven entirely by reactive store state:
//  - static pill: tool is polygon/star AND no create-drag in progress
//    (no polygon/star ephemeral preview).
//  - live count badge: a polygon/star ephemeral preview exists (= mid create-drag);
//    shows the live sides/points just above the preview's bbox top-center, and
//    re-renders as ↑/↓ mutates the ephemeral.
export default function CreateHint() {
  const tool = usePaint((s) => s.tool);
  const camera = usePaint((s) => s.camera);
  const ephemeral = usePaint((s) => s.ephemeral);

  const dragging =
    ephemeral != null && (ephemeral.type === 'polygon' || ephemeral.type === 'star');

  // ---- live count badge during a create-drag ----
  if (dragging) {
    const count = ephemeral.type === 'polygon' ? ephemeral.sides : ephemeral.points;
    const label =
      ephemeral.type === 'polygon'
        ? tr({ zh: '边数', en: 'Sides' })
        : tr({ zh: '角数', en: 'Points' });
    // top-center of the ephemeral bbox, scene -> screen.
    const b = getShapeBounds(ephemeral);
    const top = sceneToScreen({ x: b.x + b.width / 2, y: b.y }, camera);
    return (
      <div
        className="paint-create-badge"
        style={{ left: top.x, top: top.y }}
      >
        <span className="paint-create-badge-label">{label}</span>
        <span className="paint-create-badge-count">{count}</span>
        <span className="paint-create-badge-keys">↑↓</span>
      </div>
    );
  }

  // ---- static tool hint pill (top-center) ----
  if (tool !== 'polygon' && tool !== 'star') return null;
  const text =
    tool === 'polygon'
      ? tr({ zh: '拖动绘制    ↑ ↓ 改变边数', en: 'Drag to draw    ↑ ↓ change sides' })
      : tr({ zh: '拖动绘制    ↑ ↓ 改变角数', en: 'Drag to draw    ↑ ↓ change points' });
  return <div className="paint-create-pill">{text}</div>;
}
