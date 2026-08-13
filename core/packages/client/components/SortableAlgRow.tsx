'use client';

/**
 * 一条公式的 sortable 外壳(admin 才拖得动)—— case 列表页({@link AlgCategoryView})
 * 和 case 详情页(`AlgCaseView`)共用同一份,别各写一遍。
 *
 * handle 单独一个 —— 详情页公式行还负责展开动画,列表页公式行也要保留复制 / 镜像操作,
 * 都不能拿整行当拖把。
 * 内层 DndContext 嵌在 case 那层里:外层的 listeners 只挂在卡片的 grip 上,两边不打架。
 *
 * 落库端点由调用方给(`reorderCaseAlgs`),这里只管拖的那层壳。
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { tr } from '@/i18n/tr';

export default function SortableAlgRow({ id, draggable, children }: { id: string; draggable: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} className={draggable ? 'alg-alg-sortable' : undefined}>
      {draggable && (
        <button
          type="button"
          className="alg-alg-drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title={tr({ zh: '拖动调整公式顺序', en: 'Drag to reorder algs' })}
        >
          <GripVertical size={12} />
        </button>
      )}
      {children}
    </div>
  );
}
