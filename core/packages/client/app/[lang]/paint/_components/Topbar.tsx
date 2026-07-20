'use client';

import { useRef, useState } from 'react';
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
  Images,
  Check,
  CloudOff,
  Keyboard,
} from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { usePaint } from '../_lib/store';
import { usePaintCloud, setActiveTitle } from '../_lib/cloud-store';
import {
  downloadSvg,
  downloadPng,
  fromSvgString,
} from '../_lib/export';

interface Props {
  viewport: { w: number; h: number };
  onOpenShorthand: () => void;
  onOpenDrawings: () => void;
  onOpenShortcuts: () => void;
}

// Paper presets: light / white / dark / black. Theme-locked artboard colors —
// same rationale as paint.css --canvas-bg (NOT theme tokens).
const PAPER_PRESETS: { hex: string; zh: string; en: string }[] = [
  { hex: '#f5f6f8', zh: '浅', en: 'Light' },
  { hex: '#ffffff', zh: '白', en: 'White' },
  { hex: '#1e1e1e', zh: '深', en: 'Dark' },
  { hex: '#0a0a0a', zh: '黑', en: 'Black' },
];

export default function Topbar({ viewport, onOpenShorthand, onOpenDrawings, onOpenShortcuts }: Props) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  const camera = usePaint((s) => s.camera);
  const canUndo = usePaint((s) => s._past.length > 0);
  const canRedo = usePaint((s) => s._future.length > 0);
  const paper = usePaint((s) => s.paper);
  const selCount = usePaint((s) => s.selection.length);

  const title = usePaintCloud((s) => s.title);
  const saveState = usePaintCloud((s) => s.saveState);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const undo = usePaint((s) => s.undo);
  const redo = usePaint((s) => s.redo);
  const zoomTo = usePaint((s) => s.zoomTo);
  const zoomToFit = usePaint((s) => s.zoomToFit);
  const setPaper = usePaint((s) => s.setPaper);

  // Export the current selection if any shapes are selected (cropped to their
  // bounds), otherwise the whole canvas. z-order is preserved by filtering order.
  const exportDoc = () => {
    const st = usePaint.getState();
    const sel = st.selection;
    if (sel.length === 0) return { shapes: st.shapes, order: st.order, paper: st.paper };
    const ids = new Set(sel);
    const shapes: typeof st.shapes = {};
    for (const id of sel) if (st.shapes[id]) shapes[id] = st.shapes[id];
    return { shapes, order: st.order.filter((id) => ids.has(id)), paper: st.paper };
  };

  const zoomStep = (factor: number) => {
    const st = usePaint.getState();
    st.zoomAt({ x: viewport.w / 2, y: viewport.h / 2 }, factor);
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const parsed = fromSvgString(text);
    if (parsed.shapes && parsed.order && parsed.order.length) {
      usePaint.getState().loadDocument({
        shapes: parsed.shapes,
        order: parsed.order,
        paper: parsed.paper ?? usePaint.getState().paper,
      });
      zoomToFit(viewport.w, viewport.h);
    }
  };

  const onNew = () => {
    if (usePaint.getState().order.length === 0) return;
    setConfirmClear(true);
  };

  const startTitle = () => {
    setTitleDraft(title);
    setEditingTitle(true);
  };
  const commitTitle = () => {
    setEditingTitle(false);
    const v = titleDraft.trim();
    if (v && v !== title) void setActiveTitle(v);
  };

  return (
    <>
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
          title={`${tr({ zh: '缩小', en: 'Zoom out' })}  (-)`}
          aria-label={tr({ zh: '缩小', en: 'Zoom out' })}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          className="paint-btn paint-zoom-label"
          onClick={() => zoomTo(1)}
          title={`${tr({ zh: '重置为 100%', en: 'Reset to 100%' })}  (1)`}
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button
          type="button"
          className="paint-btn"
          onClick={() => zoomStep(1.2)}
          title={`${tr({ zh: '放大', en: 'Zoom in' })}  (=)`}
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
        <button
          type="button"
          className="paint-btn"
          onClick={onOpenShortcuts}
          title={`${tr({ zh: '快捷键 / 手势', en: 'Shortcuts & gestures' })}  (?)`}
          aria-label={tr({ zh: '快捷键', en: 'Shortcuts' })}
        >
          <Keyboard size={16} />
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
        <button
          type="button"
          className="paint-btn"
          onClick={onOpenDrawings}
          title={tr({ zh: '我的作品', en: 'My drawings' })}
        >
          <Images size={16} />
          <span className="paint-hide-narrow">{t('我的作品', 'My drawings')}</span>
        </button>
      </div>

      <div className="paint-divider" />

      <div className="paint-doc-status">
        {editingTitle ? (
          <input
            className="paint-doc-title-input"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              else if (e.key === 'Escape') setEditingTitle(false);
            }}
            aria-label={tr({ zh: '作品名称', en: 'Drawing title' })}
          />
        ) : (
          <button
            type="button"
            className="paint-doc-title"
            onClick={startTitle}
            title={tr({ zh: '重命名当前作品', en: 'Rename this drawing' })}
          >
            {title}
          </button>
        )}
        {saveState === 'saving' && (
          <span className="paint-save-badge">
            <Spinner size={12} />
            <span className="paint-hide-narrow">{t('保存中', 'Saving')}</span>
          </span>
        )}
        {saveState === 'saved' && (
          <span className="paint-save-badge">
            <Check size={12} />
            <span className="paint-hide-narrow">{t('已保存', 'Saved')}</span>
          </span>
        )}
        {saveState === 'error' && (
          <span className="paint-save-badge is-error">
            <CloudOff size={12} />
            <span className="paint-hide-narrow">{t('未保存', 'Not saved')}</span>
          </span>
        )}
      </div>

      <div className="paint-topbar-spacer" />

      <div
        className="paint-topbar-group paint-paper-group"
        role="group"
        aria-label={tr({ zh: '纸张颜色', en: 'Paper color' })}
      >
        <span className="paint-paper-label paint-hide-narrow">{t('纸', 'Paper')}</span>
        {PAPER_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            className={`paint-paper-swatch${paper.toLowerCase() === p.hex ? ' is-active' : ''}`}
            style={{ background: p.hex }}
            onClick={() => setPaper(p.hex)}
            title={t(p.zh, p.en)}
            aria-label={t(p.zh, p.en)}
            aria-pressed={paper.toLowerCase() === p.hex}
          />
        ))}
        <label
          className="paint-paper-custom"
          title={tr({ zh: '自定义颜色', en: 'Custom color' })}
        >
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(paper) ? paper : '#f5f6f8'}
            onChange={(e) => setPaper(e.target.value)}
            aria-label={tr({ zh: '自定义纸张颜色', en: 'Custom paper color' })}
          />
        </label>
      </div>

      <div className="paint-divider" />

      <div className="paint-topbar-group">
        <button
          type="button"
          className="paint-btn"
          onClick={() => downloadSvg(exportDoc(), selCount > 0 ? 'selection.svg' : 'drawing.svg')}
          title={
            selCount > 0
              ? tr({ zh: '导出所选图形为 SVG', en: 'Export selection as SVG' })
              : tr({ zh: '导出整个画布为 SVG', en: 'Export whole canvas as SVG' })
          }
        >
          <FileDown size={16} />
          <span className="paint-hide-narrow">SVG</span>
        </button>
        <button
          type="button"
          className="paint-btn"
          onClick={() => void downloadPng(exportDoc(), selCount > 0 ? 'selection.png' : 'drawing.png')}
          title={
            selCount > 0
              ? tr({ zh: '导出所选图形为 PNG', en: 'Export selection as PNG' })
              : tr({ zh: '导出整个画布为 PNG', en: 'Export whole canvas as PNG' })
          }
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

    {confirmClear && (
      <div
        className="paint-modal-overlay"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setConfirmClear(false);
        }}
      >
        <div className="paint-modal paint-confirm" role="dialog" aria-modal="true">
          <div className="paint-confirm-title">{t('清空整个画布?', 'Clear the entire canvas?')}</div>
          <div className="paint-confirm-text">
            {t('画布上的所有内容会被移除。可以用 Ctrl+Z 撤销。', 'Everything on the canvas will be removed. You can undo with Ctrl+Z.')}
          </div>
          <div className="paint-confirm-actions">
            <button type="button" className="paint-btn" onClick={() => setConfirmClear(false)}>
              {t('取消', 'Cancel')}
            </button>
            <button
              type="button"
              className="paint-btn paint-btn--danger"
              onClick={() => {
                usePaint.getState().clearDocument();
                setConfirmClear(false);
              }}
            >
              {t('清空', 'Clear')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
