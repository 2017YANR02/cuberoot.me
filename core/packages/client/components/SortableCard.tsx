'use client';

import { GripVertical } from '@app-foundation/icons/lucide';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { tr } from '@/i18n/tr';

export default function SortableCard({ as: Tag = 'div', id, draggable, disabled = false, children, className = '', dragLabel, dragIcon, stretch = true, tourKey = '' }: {
  as?: 'div' | 'tr';
  id: UniqueIdentifier;
  draggable: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  dragLabel?: string;
  dragIcon?: React.ReactNode;
  stretch?: boolean;
  /** 新手引导锚点：透传为 data-tour，供 OnboardingGuideModal 高亮定位。 */
  tourKey?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable || disabled });
  const handle = draggable ? (
        <button type="button" disabled={disabled} className="sortable-card-drag-handle" {...attributes} {...listeners} aria-label={dragLabel ?? tr({ zh: '拖动调整卡片顺序', en: 'Drag to reorder cards' })}>
          {dragIcon ?? <GripVertical size={14} />}
        </button>
  ) : null;
  return (
    <Tag
      ref={setNodeRef}
      className={`sortable-card ${className}`}
      data-tour={tourKey || undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        height: stretch ? '100%' : undefined,
      }}
    >
      {Tag === 'tr' ? <td>{handle}</td> : handle}
      {children}
    </Tag>
  );
}
