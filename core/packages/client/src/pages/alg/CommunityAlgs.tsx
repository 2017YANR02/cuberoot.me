/**
 * Community-submitted algs for one case. Loaded lazily on demand by the parent
 * (AlgCategoryPage groups all submissions by caseName). Logged-in users can
 * add; authors + admins can edit/delete their own.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import type { AlgSubmission } from '@cuberoot/shared';
import { addSubmission, updateSubmission, deleteSubmission } from '../../utils/alg_api';
import { useAuthStore } from '../../stores/auth_store';
import { ADMIN_WCA_IDS } from '../../stores/auth_store';

interface Props {
  puzzle: string;
  setSlug: string;
  caseName: string;
  /** All current submissions for this case (parent already filtered). */
  submissions: AlgSubmission[];
  /** Patch the page-level submissions array. caseName edits cross cases so we
   *  let the parent see the full add/update/delete intent rather than a per-case
   *  "next list". */
  onPatch: (action:
    | { type: 'add'; submission: AlgSubmission }
    | { type: 'update'; submission: AlgSubmission }
    | { type: 'delete'; id: number }
  ) => void;
}

export default function CommunityAlgs({ puzzle, setSlug, caseName, submissions, onPatch }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const user = useAuthStore(s => s.user);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);

  const [adding, setAdding] = useState(false);
  const [draftAlg, setDraftAlg] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAlg, setEditAlg] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCaseName, setEditCaseName] = useState('');

  const handleSubmit = async () => {
    if (!draftAlg.trim()) return;
    setBusy(true);
    try {
      const created = await addSubmission(puzzle, setSlug, caseName, draftAlg.trim(), draftNotes.trim() || undefined);
      onPatch({ type: 'add', submission: created });
      setDraftAlg('');
      setDraftNotes('');
      setAdding(false);
    } catch (e) {
      alert(`${isZh ? '提交失败' : 'Submit failed'}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editAlg.trim()) return;
    setBusy(true);
    try {
      const fields: { alg: string; notes?: string; caseName?: string } = {
        alg: editAlg.trim(),
        notes: editNotes.trim() || undefined,
      };
      // Only admins can re-target caseName; ignore for everyone else.
      if (isAdmin && editCaseName.trim() && editCaseName.trim() !== caseName) {
        fields.caseName = editCaseName.trim();
      }
      const updated = await updateSubmission(id, fields);
      onPatch({ type: 'update', submission: updated });
      setEditingId(null);
    } catch (e) {
      alert(`${isZh ? '保存失败' : 'Save failed'}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isZh ? '确定删除?' : 'Delete this alg?')) return;
    setBusy(true);
    try {
      await deleteSubmission(id);
      onPatch({ type: 'delete', id });
    } catch (e) {
      alert(`${isZh ? '删除失败' : 'Delete failed'}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: AlgSubmission) => {
    setEditingId(s.id);
    setEditAlg(s.alg);
    setEditNotes(s.notes ?? '');
    setEditCaseName(s.caseName);
  };

  return (
    <div className="alg-community">
      {submissions.map(s => {
        const isMine = user?.wcaId === s.authorId;
        const canEdit = isMine || isAdmin;
        const editing = editingId === s.id;
        return (
          <div key={s.id} className="alg-community-row">
            {editing ? (
              <div className="alg-community-edit">
                {isAdmin && (
                  <input
                    className="alg-community-case-input"
                    value={editCaseName}
                    onChange={e => setEditCaseName(e.target.value)}
                    placeholder={isZh ? 'Case 名 (admin)' : 'Case name (admin)'}
                    title={isZh ? '管理员可改 Case 名,把这条算法转移到别的 case' : 'Admin: re-target this alg to a different case'}
                  />
                )}
                <textarea
                  className="alg-community-textarea"
                  value={editAlg}
                  onChange={e => setEditAlg(e.target.value)}
                  rows={1}
                />
                <input
                  className="alg-community-notes-input"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder={isZh ? '注释 (可选)' : 'Notes (optional)'}
                />
                <button type="button" disabled={busy} onClick={() => handleSaveEdit(s.id)} title={isZh ? '保存' : 'Save'}>
                  <Check size={14} />
                </button>
                <button type="button" disabled={busy} onClick={() => setEditingId(null)} title={isZh ? '取消' : 'Cancel'}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="alg-community-author" title={s.authorId}>{s.authorName}</span>
                <code className="alg-community-alg">{s.alg}</code>
                {s.notes && <span className="alg-community-notes">{s.notes}</span>}
                {canEdit && (
                  <span className="alg-community-actions">
                    <button type="button" onClick={() => startEdit(s)} title={isZh ? '编辑' : 'Edit'}>
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id)} title={isZh ? '删除' : 'Delete'}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}

      {user ? (
        adding ? (
          <div className="alg-community-add">
            <textarea
              className="alg-community-textarea"
              value={draftAlg}
              onChange={e => setDraftAlg(e.target.value)}
              placeholder={isZh ? '输入算法 (例如 R U R\' U\')' : 'Enter alg (e.g. R U R\' U\')'}
              rows={1}
              autoFocus
            />
            <input
              className="alg-community-notes-input"
              value={draftNotes}
              onChange={e => setDraftNotes(e.target.value)}
              placeholder={isZh ? '注释 (可选)' : 'Notes (optional)'}
            />
            <button type="button" disabled={busy || !draftAlg.trim()} onClick={handleSubmit} title={isZh ? '提交' : 'Submit'}>
              <Check size={14} />
            </button>
            <button type="button" disabled={busy} onClick={() => { setAdding(false); setDraftAlg(''); setDraftNotes(''); }} title={isZh ? '取消' : 'Cancel'}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button type="button" className="alg-community-add-btn" onClick={() => setAdding(true)}>
            <Plus size={12} /> {isZh ? '添加我的算法' : 'Add my alg'}
          </button>
        )
      ) : (
        <div className="alg-community-login-hint">
          {isZh ? '登录后可添加自己的算法' : 'Log in to add your own alg'}
        </div>
      )}
    </div>
  );
}
