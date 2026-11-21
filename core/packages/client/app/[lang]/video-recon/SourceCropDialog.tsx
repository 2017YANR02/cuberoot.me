import { useId, useRef, useState } from 'react';
import SettingsDialog from '@/components/SettingsDialog';
import { useT } from '@/hooks/useT';
import { FULL_CROP, boundedCrop, cropFromPoints, cropPixels, dragCrop, type CropHandle, type SourceCrop } from '@/lib/video-recon/engine/source-crop';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Point = { x: number; y: number };

export function SourceCropDialog({ url, width, height, initial, onApply, onCancel }: {
  url: string;
  width: number;
  height: number;
  initial?: SourceCrop;
  onApply: (crop?: SourceCrop) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const hint = useId();
  const [crop, setCrop] = useState(() => boundedCrop(initial ?? FULL_CROP));
  const drag = useRef<{ id: number; rect: SourceCrop; start: Point; handle?: CropHandle } | null>(null);
  const ratio = width / height;
  const pixels = cropPixels(crop, width, height);
  const fullFrame = !pixels;
  const selection = { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` };
  function point(element: HTMLDivElement, clientX: number, clientY: number) {
    const bounds = element.getBoundingClientRect();
    return { x: (clientX - bounds.left) / bounds.width, y: (clientY - bounds.top) / bounds.height };
  }
  return <SettingsDialog label={t('裁剪检测区域', 'Crop detection area')} heading panelClassName="video-recon-modal" onClose={onCancel}>
    <div className="video-recon-modal-body">
      <p id={hint} className="video-recon-muted">{t('拖动绘制选区。选区内可移动，拖动边缘可调整大小。', 'Drag to draw a selection. Drag inside to move it, or drag an edge to resize it.')}</p>
      <div className="video-recon-crop" role="group" aria-describedby={hint} data-full-frame={fullFrame}
        style={{ width: `min(100%, ${56 * ratio}dvh)` }}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return;
          const start = point(event.currentTarget, event.clientX, event.clientY);
          const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-crop-handle]')?.dataset.cropHandle as CropHandle | undefined;
          const resizeOrMove = fullFrame && handle === 'move' ? undefined : handle;
          drag.current = { id: event.pointerId, rect: crop, start, handle: resizeOrMove };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={event => {
          const active = drag.current;
          if (!active || active.id !== event.pointerId) return;
          const next = point(event.currentTarget, event.clientX, event.clientY);
          setCrop(active.handle ? dragCrop(active.rect, active.handle, next.x - active.start.x, next.y - active.start.y) : cropFromPoints(active.start, next));
        }}
        onLostPointerCapture={() => { drag.current = null; }}>
        {/* This preview is a browser-generated object URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t('待裁剪的源画面', 'Source frame to crop')} width={width} height={height} draggable={false} />
        <div className="video-recon-crop-selection" style={selection} data-crop-handle="move">
          {HANDLES.map(handle => <span className="video-recon-crop-handle" data-crop-handle={handle} key={handle} />)}
        </div>
      </div>
      <div className="video-recon-crop-fields">
        {([
          ['x', t('左侧', 'Left')], ['y', t('顶部', 'Top')],
          ['width', t('宽度', 'Width')], ['height', t('高度', 'Height')],
        ] as const).map(([edge, label]) => <label className="video-recon-inline-label" key={edge}>{label}
          <input type="number" min={edge === 'x' || edge === 'y' ? 0 : 1} max={100} step={1}
            aria-label={`${label} (%)`} value={Math.round(crop[edge] * 100)}
            onChange={event => setCrop(boundedCrop({ ...crop, [edge]: Number(event.currentTarget.value) / 100 }))} />%
        </label>)}
      </div>
      <div className="video-recon-actions">
        <button type="button" className="btn-secondary" onClick={() => setCrop(FULL_CROP)}>{t('重置', 'Reset')}</button>
        <button type="button" className="btn-primary" onClick={() => onApply(pixels ? {
          x: pixels.x / width, y: pixels.y / height, width: pixels.width / width, height: pixels.height / height,
        } : undefined)}>{t('应用裁剪', 'Apply crop')}</button>
      </div>
    </div>
  </SettingsDialog>;
}
