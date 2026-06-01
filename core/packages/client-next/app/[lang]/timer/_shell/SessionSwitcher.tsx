'use client';

/**
 * SessionSwitcher — cstimer/dctimer-style named-session control. Lives at the
 * top of the Times tab in the side panel (NOT on the clean timing surface).
 *
 * A clean dropdown lists sessions; small lucide-icon controls create / rename
 * / clear / delete. All persistence goes through storage/db session API; the
 * parent (SoloView) is told to re-load byEvent whenever the active session
 * changes (switch / clear / delete / rename can change counts/labels).
 *
 * data-no-timer on the root so taps here never arm the timer.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Pencil, Eraser, Trash2, Check } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import {
  listSessions, getActiveSessionId, setActiveSession,
  createSession, renameSession, clearSession, deleteSession,
  type SessionMeta,
} from '../_lib/storage/db';

interface Props {
  isZh: boolean;
  /** Called after any change that affects the active session's data set
   *  (switch / clear / delete) so the parent re-runs loadAll(). Also called
   *  after rename so the label refreshes. */
  onSessionsChanged: () => void;
}

export default function SessionSwitcher({ isZh, onSessionsChanged }: Props) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => {
    setSessions(listSessions());
    setActiveId(getActiveSessionId());
  };
  useEffect(() => { refresh(); }, []);

  // Focus the rename/create input when it appears.
  useEffect(() => {
    if (creating || renamingId) inputRef.current?.focus();
  }, [creating, renamingId]);

  // Close dropdown on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeAll = () => {
    setOpen(false);
    setCreating(false);
    setRenamingId(null);
    setDraft('');
  };

  const active = sessions.find(s => s.id === activeId);

  const handleSwitch = (id: string) => {
    if (id === activeId) { closeAll(); return; }
    setActiveSession(id);
    refresh();
    closeAll();
    onSessionsChanged();
  };

  const startCreate = () => {
    setRenamingId(null);
    setCreating(true);
    setDraft(isZh ? '新分组' : 'New session');
  };

  const commitCreate = () => {
    const name = draft.trim();
    if (!name) { setCreating(false); setDraft(''); return; }
    const id = createSession(name);
    setActiveSession(id);
    refresh();
    setCreating(false);
    setDraft('');
    setOpen(false);
    onSessionsChanged();
  };

  const startRename = (s: SessionMeta) => {
    setCreating(false);
    setRenamingId(s.id);
    setDraft(s.name);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const name = draft.trim();
    if (name) renameSession(renamingId, name);
    setRenamingId(null);
    setDraft('');
    refresh();
    onSessionsChanged();
  };

  const handleClear = (s: SessionMeta) => {
    const ok = window.confirm(isZh
      ? `清空分组「${s.name}」的全部成绩？此操作无法撤销。`
      : `Clear all solves in "${s.name}"? This cannot be undone.`);
    if (!ok) return;
    clearSession(s.id);
    refresh();
    if (s.id === activeId) onSessionsChanged();
  };

  const handleDelete = (s: SessionMeta) => {
    if (sessions.length <= 1) return;
    const ok = window.confirm(isZh
      ? `删除分组「${s.name}」及其全部成绩？此操作无法撤销。`
      : `Delete session "${s.name}" and all its solves? This cannot be undone.`);
    if (!ok) return;
    const newActive = deleteSession(s.id);
    refresh();
    if (newActive !== null && s.id === activeId) onSessionsChanged();
  };

  return (
    <div className="session-switcher" ref={rootRef} data-no-timer>
      <button
        type="button"
        className="session-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={isZh ? '切换分组' : 'Switch session'}
      >
        <span className="session-trigger-name">{active?.name ?? (isZh ? '分组' : 'Session')}</span>
        <ChevronDown size={14} className="session-trigger-caret" />
      </button>

      {open && (
        <div className="session-menu" role="listbox">
          <div className="session-menu-list">
            {sessions.map(s => {
              const isActive = s.id === activeId;
              const isRenaming = renamingId === s.id;
              return (
                <div key={s.id} className={`session-item${isActive ? ' active' : ''}`}>
                  {isRenaming ? (
                    <div className="session-rename">
                      <div className="session-rename-input-wrap">
                        <input
                          ref={inputRef}
                          type="text"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') { setRenamingId(null); setDraft(''); }
                          }}
                          aria-label={isZh ? '分组名称' : 'Session name'}
                        />
                        {draft && (
                          <ClearButton
                            onClick={() => setDraft('')}
                            isZh={isZh}
                            preserveFocus
                            ariaLabel={isZh ? '清空' : 'Clear'}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="session-icon-btn confirm"
                        onClick={commitRename}
                        title={isZh ? '确认' : 'Confirm'}
                        aria-label={isZh ? '确认重命名' : 'Confirm rename'}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="session-name-btn"
                        onClick={() => handleSwitch(s.id)}
                        role="option"
                        aria-selected={isActive}
                      >
                        {isActive && <Check size={13} className="session-check" />}
                        <span className="session-name-text">{s.name}</span>
                      </button>
                      <div className="session-item-actions">
                        <button
                          type="button"
                          className="session-icon-btn"
                          onClick={() => startRename(s)}
                          title={isZh ? '重命名' : 'Rename'}
                          aria-label={isZh ? '重命名分组' : 'Rename session'}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="session-icon-btn"
                          onClick={() => handleClear(s)}
                          title={isZh ? '清空成绩' : 'Clear solves'}
                          aria-label={isZh ? '清空分组成绩' : 'Clear session solves'}
                        >
                          <Eraser size={13} />
                        </button>
                        <button
                          type="button"
                          className="session-icon-btn danger"
                          onClick={() => handleDelete(s)}
                          disabled={sessions.length <= 1}
                          title={sessions.length <= 1
                            ? (isZh ? '至少保留一个分组' : 'Keep at least one session')
                            : (isZh ? '删除分组' : 'Delete session')}
                          aria-label={isZh ? '删除分组' : 'Delete session'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="session-menu-footer">
            {creating ? (
              <div className="session-rename">
                <div className="session-rename-input-wrap">
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitCreate();
                      if (e.key === 'Escape') { setCreating(false); setDraft(''); }
                    }}
                    aria-label={isZh ? '新分组名称' : 'New session name'}
                  />
                  {draft && (
                    <ClearButton
                      onClick={() => setDraft('')}
                      isZh={isZh}
                      preserveFocus
                      ariaLabel={isZh ? '清空' : 'Clear'}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="session-icon-btn confirm"
                  onClick={commitCreate}
                  title={isZh ? '创建' : 'Create'}
                  aria-label={isZh ? '创建分组' : 'Create session'}
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="session-add-btn" onClick={startCreate}>
                <Plus size={14} />
                <span>{isZh ? '新建分组' : 'New session'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
