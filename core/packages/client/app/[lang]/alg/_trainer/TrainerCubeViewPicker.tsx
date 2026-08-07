'use client';

/**
 * 智能魔方显示方式选择器。
 *
 * 原生 select 的 option 画不了图片,而 qCube / qLast / q2Look 只看名字无法猜出
 * 差别。这里把当前模式的缩略图留在触发钮上,展开后再用同一套 VisualCube 渲染
 * 五个图文选项。None 没有实时投影,所以用“题图”占位明确表示会保留原 case 图。
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Image as ImageIcon } from 'lucide-react';

import { FaceletsCube } from '@/components/FaceletsCube';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { tr } from '@/i18n/tr';
import type { TrainerCubeView } from './useTrainerCube';

const SAMPLE_FACELETS = 'u'.repeat(9) + 'r'.repeat(9) + 'f'.repeat(9)
  + 'd'.repeat(9) + 'l'.repeat(9) + 'b'.repeat(9);

interface ViewOption {
  value: TrainerCubeView;
  name: string;
  description: string;
}

function viewOptions(): ViewOption[] {
  return [
    {
      value: 'none',
      name: 'None',
      description: tr({ zh: '保留题图', en: 'Keep case image' }),
    },
    {
      value: '3d',
      name: 'Virtual',
      description: tr({ zh: '三维跟手转动', en: 'Rotating 3D mirror' }),
    },
    {
      value: 'qcube',
      name: 'qCube',
      description: tr({ zh: '顶面和正面', en: 'Top and front faces' }),
    },
    {
      value: 'qlast',
      name: 'qLast',
      description: tr({ zh: '完整末层色块', en: 'Full last-layer colors' }),
    },
    {
      value: 'q2look',
      name: 'q2Look',
      description: tr({ zh: '两步法精简图', en: 'Two-look projection' }),
    },
  ];
}

function ViewPreview({ view, size }: { view: TrainerCubeView; size: number }) {
  if (view === 'none') {
    return (
      <span className="trainer-cube-view-none" style={{ width: size, height: size }} aria-hidden="true">
        <ImageIcon size={size * 0.4} />
        <span>{tr({ zh: '题图', en: 'Case' })}</span>
      </span>
    );
  }

  const cubeView = view === '3d' ? 'iso' : view;
  return (
    <span className="trainer-cube-view-cube" aria-hidden="true">
      <FaceletsCube fd={SAMPLE_FACELETS} view={cubeView} size={size} alt="" />
    </span>
  );
}

export default function TrainerCubeViewPicker({
  value,
  onChange,
}: {
  value: TrainerCubeView;
  onChange: (view: TrainerCubeView) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const options = viewOptions();
  const active = options.find(option => option.value === value) ?? options[0];
  const pick = (next: TrainerCubeView) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="trainer-cube-view-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`trainer-cube-view-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tr({
          zh: `智能魔方显示方式:${active.name}`,
          en: `Smart-cube display: ${active.name}`,
        })}
      >
        <ViewPreview view={active.value} size={42} />
        <span className="trainer-cube-view-trigger-copy">
          <strong>{active.name}</strong>
          <span>{active.description}</span>
        </span>
        <ChevronDown size={14} className="trainer-cube-view-caret" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="trainer-cube-view-panel"
          role="listbox"
          aria-label={tr({ zh: '智能魔方显示方式', en: 'Smart-cube display' })}
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`trainer-cube-view-option${option.value === value ? ' is-active' : ''}`}
              onClick={() => pick(option.value)}
            >
              <ViewPreview view={option.value} size={56} />
              <strong>{option.name}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
