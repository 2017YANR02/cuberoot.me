'use client';

import { useRef } from 'react';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  FileDown,
  Image as ImageIcon,
  Upload,
  FilePlus2,
  Boxes,
} from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { usePaint } from '../_lib/store';
import {
  downloadSvg,
  downloadPng,
  fromSvgString,
} from '../_lib/export';

interface Props {
  viewport: { w: number; h: number };
  onOpenShorthand: () => void;
}

export default function Topbar({ viewport, onOpenShorthand }: Props) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  const camera = usePaint((s) => s.camera);
  const canUndo = usePaint((s) => s._past.length > 0);
  const canRedo = usePaint((s) => s._future.length > 0);

  const undo = usePaint((s) => s.undo);
  const redo = usePaint((s) => s.redo);
  const zoomTo = usePaint((s) => s.zoomTo);
  const zoomToFit = usePaint((s) => s.zoomToFit);

  const doc = () => {
    const st = usePaint.getState();
    return { shapes: st.shapes, order: st.order };
  };

  const zoomStep = (factor: number) => {
    const st = usePaint.getState();
    st.zoomAt({ x: viewport.w / 2, y: viewport.h / 2 }, factor);
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const parsed = fromSvgString(text);
    if (parsed.shapes && parsed.order && parsed.order.length) {
      usePaint.getState().loadDocument({ shapes: parsed.shapes, order: parsed.order });
      zoomToFit(viewport.w, viewport.h);
    }
  };

  const onNew = () => {
    const st = usePaint.getState();
    if (st.order.length === 0) return;
    if (window.confirm(t('清空整个画布?此操作可撤销。', 'Clear the entire canvas? This can be undone.'))) {
      st.clearDocument();
    }
  };

  return (
    <div className="paint-topbar">
      <span className="paint-topbar-title">{t('绘制', 'Paint')}</span>

      <div className="paint-topbar-group">
        <button
          type="button"
          className="paint-btn"
          disabled={!canUndo}
          onClick={undo}
          title={`${tr({ zh: '撤销', en: 'Undo' })}  (Ctrl+Z)`}
          aria-label={tr({ zh: '撤销', en: 'Undo' })}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="paint-btn"
          disabled={!canRedo}
          onClick={redo}
          title={`${tr({ zh: '重做', en: 'Redo' })}  (Ctrl+Shift+Z)`}
          aria-label={tr({ zh: '重做', en: 'Redo' })}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="paint-divider" />

      <div className="paint-topbar-group">
        <button
          type="button"
          className="paint-btn"
          onClick={() => zoomStep(1 / 1.2)}
          title={tr({ zh: '缩小', en: 'Zoom out' })}
          aria-label={tr({ zh: '缩小', en: 'Zoom out' })}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          className="paint-btn paint-zoom-label"
          onClick={() => zoomTo(1)}
          title={tr({ zh: '重置为 100%', en: 'Reset to 100%' })}
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button
          type="button"
          className="paint-btn"
          onClick={() => zoomStep(1.2)}
          title={tr({ zh: '放大', en: 'Zoom in' })}
          aria-label={tr({ zh: '放大', en: 'Zoom in' })}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className="paint-btn"
          onClick={() => zoomToFit(viewport.w, viewport.h)}
          title={`${tr({ zh: '适应画布', en: 'Fit to view' })}  (0)`}
          aria-label={tr({ zh: '适应画布', en: 'Fit to view' })}
        >
          <Maximize size={16} />
        </button>
      </div>

      <div className="paint-divider" />

      <div className="paint-topbar-group">
        <button
          type="button"
          className="paint-btn"
          onClick={onOpenShorthand}
          title={tr({ zh: '魔方速记', en: 'Cube Shorthand' })}
        >
          <Boxes size={16} />
          <span className="paint-hide-narrow">{t('速记', 'Shorthand')}</span>
        </button>
      </div>

      <div className="paint-topbar-spacer" />

      <div className="paint-topbar-group">
        <button
          type="button"
          className="paint-btn"
          onClick={() => downloadSvg(doc())}
          title={tr({ zh: '导出 SVG', en: 'Export SVG' })}
        >
          <FileDown size={16} />
          <span className="paint-hide-narrow">SVG</span>
        </button>
        <button
          type="button"
          className="paint-btn"
          onClick={() => void downloadPng(doc())}
          title={tr({ zh: '导出 PNG', en: 'Export PNG' })}
        >
          <ImageIcon size={16} />
          <span className="paint-hide-narrow">PNG</span>
        </button>
        <button
          type="button"
          className="paint-btn"
          onClick={() => fileRef.current?.click()}
          title={tr({ zh: '导入 SVG', en: 'Import SVG' })}
          aria-label={tr({ zh: '导入 SVG', en: 'Import SVG' })}
        >
          <Upload size={16} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="paint-btn"
          onClick={onNew}
          title={tr({ zh: '新建 / 清空', en: 'New / Clear' })}
          aria-label={tr({ zh: '新建 / 清空', en: 'New / Clear' })}
        >
          <FilePlus2 size={16} />
        </button>
      </div>
    </div>
  );
}
