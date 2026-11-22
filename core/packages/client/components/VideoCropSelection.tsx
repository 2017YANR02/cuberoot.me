'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { videoCropBounds } from '@/lib/video-tools/crop';
import './video-tools.css';

type Point = { x: number; y: number };
type Bounds = ReturnType<typeof videoCropBounds>;

function selectionPoint(event: PointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

export function VideoCropSelection({ onSelect, onCancel }: {
  onSelect: (bounds: Bounds) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const start = useRef<Point | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  useEffect(() => {
    function cancelWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', cancelWithEscape);
    return () => window.removeEventListener('keydown', cancelWithEscape);
  }, [onCancel]);

  function clearSelection() {
    start.current = null;
    setBounds(null);
  }

  return <div className="video-crop-overlay"
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      start.current = selectionPoint(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }}
    onPointerMove={event => {
      if (event.isPrimary && start.current) setBounds(videoCropBounds(start.current, selectionPoint(event)));
    }}
    onPointerUp={event => {
      if (!event.isPrimary || !start.current) return;
      const next = videoCropBounds(start.current, selectionPoint(event));
      clearSelection();
      if (next.right - next.left >= 0.01 && next.bottom - next.top >= 0.01) onSelect(next);
    }}
    onLostPointerCapture={clearSelection}>
    {bounds ? <div className="video-crop-selection" style={{
      top: `${bounds.top * 100}%`, left: `${bounds.left * 100}%`,
      right: `${(1 - bounds.right) * 100}%`, bottom: `${(1 - bounds.bottom) * 100}%`,
    }} /> : <span className="video-crop-hint">{t('frameCount.video.cropHint')}</span>}
  </div>;
}
