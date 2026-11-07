'use client';

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from '@app-foundation/icons/lucide';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared/alg';
import { pllCommentName } from '@cuberoot/shared/recon/alg-case-display';
import { CaseThumb } from '@/components/CaseThumb';
import { caseKey } from '@/lib/trainer-case-key';
import { tr } from '@/i18n/tr';
import './alg-case-order-grid.css';

function SortableCase({ c, puzzle, setSlug, index, compact }: {
  c: AlgCase; puzzle: AlgPuzzle; setSlug: string; index: number; compact: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: caseKey(c) });
  const alg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  const label = setSlug === 'pll' ? pllCommentName(c.name) : c.name;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`${compact ? 'alg-case-order-item' : 'alg-time-attack-case'}${isDragging ? ' is-dragging' : ''}`}>
    {compact ? <span>{label}</span> : <div className="alg-time-attack-thumb">
      <CaseThumb local puzzle={puzzle} set={setSlug} sticker={c.sticker} alg={alg} setup={c.setup}
        size={116} loading={index < 9 ? 'eager' : 'lazy'} />
    </div>}
    <button type="button" className={compact ? 'alg-case-order-handle' : 'alg-time-attack-handle'}
      aria-label={tr({ zh: `移动 ${label}，第 ${index + 1} 项`, en: `Move ${label}, item ${index + 1}` })}
      {...attributes} {...listeners}><GripVertical size={17} /></button>
  </div>;
}

/** Same pointer, touch and keyboard reorder behavior for diagrams and compact names. */
export function AlgCaseOrderGrid({ cases, order, puzzle, setSlug, compact = false, onChange }: {
  cases: readonly AlgCase[]; order: string[]; puzzle: AlgPuzzle; setSlug: string;
  compact?: boolean; onChange(order: string[]): void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = order.indexOf(String(event.active.id));
    const to = order.indexOf(String(event.over.id));
    if (from >= 0 && to >= 0) onChange(arrayMove(order, from, to));
  }}>
    <SortableContext items={order} strategy={rectSortingStrategy}>
      <div className={compact ? 'alg-case-order-names' : 'alg-time-attack-grid'}>
        {cases.map((c, index) => <SortableCase key={caseKey(c)} {...{ c, index, puzzle, setSlug, compact }} />)}
      </div>
    </SortableContext>
  </DndContext>;
}
