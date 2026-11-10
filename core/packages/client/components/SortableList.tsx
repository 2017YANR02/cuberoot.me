'use client';

import type { ReactNode } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

type SortableItem = { id: UniqueIdentifier };

/** Replace only the displayed slots, preserving hidden items and other groups. */
export function replaceSortableItems<T extends SortableItem>(all: T[], reordered: T[]): T[] {
  const ids = new Set(reordered.map(item => item.id));
  let index = 0;
  return all.map(item => ids.has(item.id) ? reordered[index++] : item);
}

/** Shared vertical drag sorting; persistence and row presentation stay with callers. */
export default function SortableList<T extends SortableItem>({ items, disabled = false, onReorder, children }: {
  items: T[];
  disabled?: boolean;
  onReorder: (items: T[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
    if (disabled || !over || active.id === over.id) return;
    const from = items.findIndex(item => item.id === active.id);
    const to = items.findIndex(item => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }}>
    <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>{children}</SortableContext>
  </DndContext>;
}
