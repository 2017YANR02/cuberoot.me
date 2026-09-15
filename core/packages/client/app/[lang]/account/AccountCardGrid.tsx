'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, SortableContext } from '@dnd-kit/sortable';
import SortableCard from '@/components/SortableCard';
import { applyCardOrder } from '@/lib/card-order';
import { persistItem } from '@/lib/safe-storage';
import { useAuthStore } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';

const CHANGE_EVENT = 'account-card-order-change';

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

function orderKey(user: ReturnType<typeof useAuthStore.getState>['user']) {
  const owner = user?.uid ? `u${user.uid}` : user?.wcaId;
  return owner ? `cuberoot-account-card-order:${owner}` : null;
}

export default function AccountCardGrid({ cards }: { cards: { id: string; content: ReactNode }[] }) {
  const user = useAuthStore(s => s.user);
  const key = orderKey(user);
  const read = useCallback(() => {
    try { return key ? localStorage.getItem(key) : null; }
    catch { return null; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  let savedIds: string[] = [];
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (Array.isArray(value)) savedIds = value.filter((id): id is string => typeof id === 'string');
  } catch { /* Invalid saved preferences fall back to the default order. */ }
  const ordered = applyCardOrder(cards, savedIds);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!key || orderKey(useAuthStore.getState().user) !== key || !over || active.id === over.id) return;
    const ids = ordered.map(card => card.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    if (!persistItem(key, JSON.stringify(arrayMove(ids, from, to)))) {
      alert(tr({ zh: '无法保存卡片顺序，请检查浏览器存储空间后重试。', en: 'Could not save the card order. Check browser storage and try again.' }));
      return;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={ordered.map(card => card.id)} strategy={rectSortingStrategy}>
      <nav className="account-cards">
        {ordered.map(card => <SortableCard key={card.id} id={card.id} draggable={Boolean(key)}>
          {card.content}
        </SortableCard>)}
      </nav>
    </SortableContext>
  </DndContext>;
}
