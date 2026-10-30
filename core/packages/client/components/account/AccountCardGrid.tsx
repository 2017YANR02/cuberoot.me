'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, SortableContext } from '@dnd-kit/sortable';
import { ACCOUNT_CARD_GROUP_ID, ACCOUNT_CARD_IDS } from '@cuberoot/shared/site-directory';
import SortableCard from '@/components/SortableCard';
import { applyCardOrder } from '@/lib/card-order';
import { getHomeCardOrders, reorderHomeCards } from '@/lib/home-card-order-api';
import { hasAdminAccess, useAuthStore } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';

const ALL_CARDS = ACCOUNT_CARD_IDS.map(id => ({ id }));

export default function AccountCardGrid({ cards }: { cards: { id: string; content: ReactNode }[] }) {
  const isAdmin = useAuthStore(s => hasAdminAccess(s.user));
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    let active = true;
    getHomeCardOrders(true).then(orders => {
      if (!active) return;
      setSavedIds(orders[ACCOUNT_CARD_GROUP_ID] ?? []);
      setLoaded(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, []);
  const fullOrder: string[] = applyCardOrder(ALL_CARDS, savedIds).map(card => card.id);
  const ordered = applyCardOrder(cards, fullOrder);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!hasAdminAccess(useAuthStore.getState().user) || !loaded || savingRef.current || !over || active.id === over.id) return;
    const from = fullOrder.indexOf(String(active.id));
    const to = fullOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(fullOrder, from, to);
    savingRef.current = true;
    setSaving(true);
    setSavedIds(next);
    try {
      await reorderHomeCards(ACCOUNT_CARD_GROUP_ID, next);
    } catch {
      setSavedIds(fullOrder);
      alert(tr({ zh: '卡片排序保存失败，请重试。', en: 'Could not save the card order. Please try again.' }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return <>
    {isAdmin && loadFailed && <p role="alert">{tr({ zh: '卡片顺序加载失败，请刷新页面重试。', en: 'Could not load the card order. Refresh the page to try again.' })}</p>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map(card => card.id)} strategy={rectSortingStrategy}>
        <nav className="account-cards">
          {ordered.map(card => <SortableCard key={card.id} id={card.id} draggable={isAdmin} disabled={!loaded || saving}>
            {card.content}
          </SortableCard>)}
        </nav>
      </SortableContext>
    </DndContext>
  </>;
}
