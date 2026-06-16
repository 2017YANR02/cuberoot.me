'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Pencil, Check, Images, Loader2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import {
  usePaintCloud,
  openDrawing,
  newDrawing,
  renameDrawing,
  removeDrawing,
} from '../_lib/cloud-store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DrawingsPanel({ open, onClose }: Props) {
  const t = useT();
  const drawings = usePaintCloud((s) => s.drawings);
  const activeId = usePaintCloud((s) => s.activeId);
  const loading = usePaintCloud((s) => s.loading);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const startRename = (id: number, title: string) => {
    setEditingId(id);
    setDraft(title);
  };
  const commitRename = async (id: number) => {
    const title = draft.trim();
    setEditingId(null);
    if (title && title !== drawings.find((d) => d.id === id)?.title) {
      await renameDrawing(id, title);
    }
  };
  const open1 = async (id: number) => {
    if (id === activeId) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await openDrawing(id);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number, title: string) => {
    if (!window.confirm(t(`删除作品「${title}」?此操作不可撤销。`, `Delete "${title}"? This cannot be undone.`))) return;
    await removeDrawing(id);
  };

  return (
    <div className="paint-drawings-panel" role="dialog" aria-label={tr({ zh: '我的作品', en: 'My drawings' })}>
      <div className="paint-sh-head">
        <Images size={15} />
        <span className="paint-sh-title">{t('我的作品', 'My drawings')}</span>
        <button
          type="button"
          className="paint-btn paint-sh-close"
          onClick={onClose}
          aria-label={tr({ zh: '关闭', en: 'Close' })}
        >
          <X size={15} />
        </button>
      </div>

      <div className="paint-drawings-body">
        <button type="button" className="paint-btn paint-btn--accent paint-drawings-new" onClick={() => { newDrawing(); onClose(); }}>
          <Plus size={15} />
          <span>{t('新建作品', 'New drawing')}</span>
        </button>

        {loading && (
          <div className="paint-drawings-empty">
            <Loader2 size={16} className="paint-spin" />
            <span>{t('加载中…', 'Loading…')}</span>
          </div>
        )}

        {!loading && drawings.length === 0 && (
          <div className="paint-drawings-empty">{t('还没有作品。画点东西会自动保存到这里。', 'No drawings yet. Anything you draw is saved here automatically.')}</div>
        )}

        {!loading && drawings.length > 0 && (
          <ul className="paint-drawings-grid">
            {drawings.map((d) => (
              <li key={d.id} className={`paint-drawing-card${d.id === activeId ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="paint-drawing-thumb"
                  onClick={() => void open1(d.id)}
                  disabled={busy}
                  aria-label={tr({ zh: `打开 ${d.title}`, en: `Open ${d.title}` })}
                >
                  {d.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <span className="paint-drawing-noimg"><Images size={20} /></span>
                  )}
                </button>

                <div className="paint-drawing-meta">
                  {editingId === d.id ? (
                    <input
                      className="paint-drawing-rename"
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => void commitRename(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        else if (e.key === 'Escape') setEditingId(null);
                      }}
                      aria-label={tr({ zh: '重命名', en: 'Rename' })}
                    />
                  ) : (
                    <button type="button" className="paint-drawing-title" onClick={() => void open1(d.id)} title={d.title}>
                      {d.title}
                    </button>
                  )}
                  <div className="paint-drawing-actions">
                    {editingId === d.id ? (
                      <button type="button" className="paint-icon-btn" onClick={() => void commitRename(d.id)} aria-label={tr({ zh: '确认', en: 'Confirm' })}>
                        <Check size={13} />
                      </button>
                    ) : (
                      <button type="button" className="paint-icon-btn" onClick={() => startRename(d.id, d.title)} aria-label={tr({ zh: '重命名', en: 'Rename' })}>
                        <Pencil size={13} />
                      </button>
                    )}
                    <button type="button" className="paint-icon-btn paint-icon-btn--danger" onClick={() => void del(d.id, d.title)} aria-label={tr({ zh: '删除', en: 'Delete' })}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
