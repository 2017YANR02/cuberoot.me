'use client';

import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { tr } from '@/i18n/tr';

export default function SortableCard({ id, draggable, children, className = '', dragLabel, stretch = true }: {
  id: UniqueIdentifier;
  draggable: boolean;
  children: React.ReactNode;
  className?: string;
  dragLabel?: string;
  stretch?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-card ${className}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        height: stretch ? '100%' : undefined,
      }}
    >
      {draggable && (
        <button
          type="button"
          className="sortable-card-drag-handle"
          {...attributes}
          {...listeners}
          title={dragLabel ?? tr({ zh: '拖动调整卡片顺序', en: 'Drag to reorder cards' })}
        >
          <GripVertical size={14} />
        </button>
      )}
      {children}
    </div>
  );
}
