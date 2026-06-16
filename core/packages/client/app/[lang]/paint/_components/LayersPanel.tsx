'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Square,
  Circle,
  Slash,
  Hexagon,
  Star,
  Spline,
  PenTool,
  Type,
  Group as GroupIcon,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers as LayersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { Shape, ShapeType } from '../_lib/types';
import { usePaint } from '../_lib/store';

const TYPE_ICON: Record<ShapeType, LucideIcon> = {
  rect: Square,
  ellipse: Circle,
  line: Slash,
  polygon: Hexagon,
  star: Star,
  path: PenTool,
  text: Type,
  freehand: Spline,
  group: GroupIcon,
};

const TYPE_NAME: Record<ShapeType, { zh: string; en: string }> = {
  rect: { zh: '矩形', en: 'Rectangle' },
  ellipse: { zh: '椭圆', en: 'Ellipse' },
  line: { zh: '直线', en: 'Line' },
  polygon: { zh: '多边形', en: 'Polygon' },
  star: { zh: '星形', en: 'Star' },
  path: { zh: '路径', en: 'Path' },
  text: { zh: '文本', en: 'Text' },
  freehand: { zh: '手绘', en: 'Drawing' },
  group: { zh: '编组', en: 'Group' },
};

// Stable per-type display index: nth shape of its type in bottom->top order.
function buildDisplayNames(order: string[], shapes: Record<string, Shape>) {
  const names: Record<string, { type: ShapeType; index: number; custom?: string }> = {};
  const counts: Partial<Record<ShapeType, number>> = {};
  for (const id of order) {
    const s = shapes[id];
    if (!s) continue;
    const n = (counts[s.type] = (counts[s.type] ?? 0) + 1);
    names[id] = { type: s.type, index: n, custom: s.name };
  }
  return names;
}

export default function LayersPanel() {
  const t = useT();
  const order = usePaint((s) => s.order);
  const shapes = usePaint((s) => s.shapes);
  const selection = usePaint((s) => s.selection);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Synchronous mirror of dragId so drop logic works even if React hasn't
  // flushed the state update between drag events.
  const dragRef = useRef<string | null>(null);

  const displayNames = useMemo(
    () => buildDisplayNames(order, shapes),
    [order, shapes]
  );

  // Top of the list = front-most = end of order[].
  const rows = useMemo(() => [...order].reverse(), [order]);

  const selSet = useMemo(() => new Set(selection), [selection]);

  const onRowClick = (e: React.MouseEvent, id: string) => {
    const st = usePaint.getState();
    if (e.shiftKey || e.metaKey || e.ctrlKey) st.toggleSelection(id);
    else st.setSelection([id]);
  };

  const finishRename = (id: string, value: string) => {
    const v = value.trim();
    usePaint.getState().updateShape(id, { name: v || undefined }, true);
    setRenaming(null);
  };

  // Drop `dragId` so it lands directly above `targetId` in visual order
  // (i.e. just in front of it in z-order).
  const onDrop = (targetId: string) => {
    const did = dragRef.current;
    const clear = () => {
      dragRef.current = null;
      setDragId(null);
      setOverId(null);
    };
    if (!did || did === targetId) {
      clear();
      return;
    }
    const st = usePaint.getState();
    const cur = st.order;
    const targetIdx = cur.indexOf(targetId);
    const fromIdx = cur.indexOf(did);
    if (targetIdx < 0 || fromIdx < 0) {
      clear();
      return;
    }
    // Land the dragged shape directly in front of the target (one z-slot
    // above). moveShapeTo's index is into the POST-removal array. After pulling
    // dragId out: if it sat below target, target shifts down by one so "in
    // front of target" = index targetIdx; if it sat above, target keeps its
    // index so "in front" = targetIdx + 1.
    const toIdx = fromIdx < targetIdx ? targetIdx : targetIdx + 1;
    st.moveShapeTo(did, toIdx);
    clear();
  };

  return (
    <div className={`paint-layers${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="paint-layers-head"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <LayersIcon size={13} />
        <span>{t('图层', 'Layers')}</span>
        <span className="paint-layers-count">{order.length}</span>
      </button>

      {!collapsed && (
        <div className="paint-layers-list" role="list">
          {rows.length === 0 ? (
            <div className="paint-layers-empty">
              {t('暂无图层', 'No layers yet')}
            </div>
          ) : (
            rows.map((id) => {
              const s = shapes[id];
              if (!s) return null;
              const meta = displayNames[id];
              const Icon = TYPE_ICON[s.type] ?? Square;
              const label =
                meta?.custom ||
                `${t(TYPE_NAME[s.type].zh, TYPE_NAME[s.type].en)} ${meta?.index ?? ''}`.trim();
              const selected = selSet.has(id);
              const isOver = overId === id && dragId !== null && dragId !== id;

              return (
                <div
                  key={id}
                  role="listitem"
                  className={`paint-layer-row${selected ? ' is-selected' : ''}${
                    isOver ? ' is-drop' : ''
                  }${s.hidden ? ' is-hidden' : ''}${dragId === id ? ' is-dragging' : ''}`}
                  draggable={renaming !== id}
                  onClick={(e) => onRowClick(e, id)}
                  onDragStart={(e) => {
                    dragRef.current = id;
                    setDragId(id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (dragRef.current === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (overId !== id) setOverId(id);
                  }}
                  onDragLeave={() => {
                    if (overId === id) setOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop(id);
                  }}
                  onDragEnd={() => {
                    dragRef.current = null;
                    setDragId(null);
                    setOverId(null);
                  }}
                >
                  <span className="paint-layer-icon">
                    <Icon size={14} />
                  </span>

                  {renaming === id ? (
                    <input
                      className="paint-layer-rename"
                      autoFocus
                      defaultValue={meta?.custom ?? label}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={(e) => finishRename(id, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        else if (e.key === 'Escape') {
                          e.currentTarget.value = meta?.custom ?? '';
                          setRenaming(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="paint-layer-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenaming(id);
                      }}
                      title={label}
                    >
                      {label}
                    </span>
                  )}

                  <button
                    type="button"
                    className="paint-layer-act"
                    title={s.hidden ? t('显示', 'Show') : t('隐藏', 'Hide')}
                    aria-label={s.hidden ? t('显示', 'Show') : t('隐藏', 'Hide')}
                    onClick={(e) => {
                      e.stopPropagation();
                      usePaint.getState().updateShape(id, { hidden: !s.hidden }, true);
                    }}
                  >
                    {s.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className={`paint-layer-act${s.locked ? ' is-on' : ''}`}
                    title={s.locked ? t('解锁', 'Unlock') : t('锁定', 'Lock')}
                    aria-label={s.locked ? t('解锁', 'Unlock') : t('锁定', 'Lock')}
                    onClick={(e) => {
                      e.stopPropagation();
                      usePaint.getState().updateShape(id, { locked: !s.locked }, true);
                    }}
                  >
                    {s.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
