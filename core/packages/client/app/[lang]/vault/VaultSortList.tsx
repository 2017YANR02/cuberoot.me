'use client';

import type { ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Ellipsis } from '@app-foundation/icons/lucide';
import SortableCard from '@/components/SortableCard';

export default function VaultSortList<T>({ items, getId, enabled, busy, label, onMove, children, rowClass }: {
  items: readonly T[];
  getId: (item: T) => string;
  enabled: boolean;
  busy: boolean;
  label: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
  rowClass?: (item: T) => string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const draggable = enabled && items.length > 1;
  const ids = items.map(getId);
  if (!draggable) return items.map((item, index) => (
    <div key={ids[index]} className={rowClass?.(item)}>{children(item, index, null)}</div>
  ));
  const rows = items.map((item, index) => <SortableCard key={ids[index]} id={ids[index]}
    draggable={draggable} disabled={busy} stretch={false} className={rowClass?.(item)}
    dragIcon={<Ellipsis size={16} aria-hidden="true" />} dragLabel={label(item, index)}>
    {handle => children(item, index, handle)}
  </SortableCard>);
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
    if (busy || !over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  }}>
    <SortableContext items={ids} strategy={rectSortingStrategy}>{rows}</SortableContext>
  </DndContext>;
}
