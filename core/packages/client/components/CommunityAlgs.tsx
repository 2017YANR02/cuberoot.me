'use client';

/**
 * Community-submitted algs for one case — ported from
 * packages/client-vite/src/pages/alg/CommunityAlgs.tsx.
 * The parent (AlgCategoryView) groups all submissions by caseName and passes
 * each case its slice. Logged-in users can add; authors + admins edit/delete.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import type { AlgSubmission, AlgSticker } from '@cuberoot/shared';
import Link from '@/components/AppLink';
import { addSubmission, updateSubmission, deleteSubmission } from '@/lib/alg_api';
import { validateAlgCase } from '@/lib/alg_validation';
import { displayAlg } from '@/lib/alg_display';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { displayCuberName } from '@/lib/cuber-name-display';
import { tr } from '@/i18n/tr';

interface Props {
  puzzle: string;
  setSlug: string;
  caseName: string;
  /** Case sticker + setup — used to validate a submitted alg actually solves the case. */
  sticker: AlgSticker;
  setup: string;
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

export default function CommunityAlgs({ puzzle, setSlug, caseName, sticker, setup, submissions, onPatch }: Props) {
  const { i18n } = useTranslation(); // subscribe to language changes; text via tr()
  const isZh = i18n.language.startsWith('zh');
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
  // 所有权键(与服务端一致):非 WCA 账号也能认出自己提交的公式。
  const myKey = user ? computeOwnerKey(user.uid, user.wcaId) : '';

  /** 校验 + 补齐收尾 AUF。
   *
   *  魔友**不必自己写**结尾那个 U(他自己会转)—— 校验器算得出该补哪个,入库存补齐的完整式,
   *  显示时 `displayAlg()` 再剥掉。校验没过就让他自己决定要不要照样提交。
   *
   *  @returns 入库用的公式;`null` = 用户放弃提交。 */
  const prepareAlg = async (raw: string): Promise<string | null> => {
    const bare = displayAlg(raw);
    try {
      const res = await validateAlgCase(setup, bare, sticker, puzzle);
      if (res.ok) return res.auf ? `${bare} ${res.auf}` : bare;
      const ok = confirm(`${tr({ zh: '公式校验未通过', en: 'Validation failed' })}: ${res.reason ?? ''}\n\n${tr({ zh: '仍然提交?', en: 'Submit anyway?' })}`);
      return ok ? raw : null;
    } catch {
      return raw; // 校验设施自己炸了,不该拦人提交
    }
  };

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
    const alg = await prepareAlg(draftAlg.trim());
    if (alg === null) return;
    setBusy(true);
    try {
      const created = await addSubmission(puzzle, setSlug, caseName, alg, draftNotes.trim() || undefined);
      onPatch({ type: 'add', submission: created });
      setDraftAlg('');
      setDraftNotes('');
      setAdding(false);
    } catch (e) {
      alert(`${tr({ zh: '提交失败', en: 'Submit failed' })}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editAlg.trim()) return;
    const alg = await prepareAlg(editAlg.trim());
    if (alg === null) return;
    setBusy(true);
    try {
      const fields: { alg: string; notes?: string; caseName?: string } = {
        alg,
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
      alert(`${tr({ zh: '保存失败', en: 'Save failed' })}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(tr({ zh: '确定删除?', en: 'Delete this alg?' }))) return;
    setBusy(true);
    try {
      await deleteSubmission(id);
      onPatch({ type: 'delete', id });
    } catch (e) {
      alert(`${tr({ zh: '删除失败', en: 'Delete failed' })}: ${(e as Error).message}`);
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
        const isMine = !!myKey && myKey === s.authorId;
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
                    placeholder={tr({ zh: 'Case 名 (admin)', en: 'Case name (admin)' })}
                    title={tr({ zh: '管理员可改 Case 名,把这条算法转移到别的 case', en: 'Admin: re-target this alg to a different case' })}
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
                  placeholder={tr({ zh: '注释 (可选)', en: 'Notes (optional)' })}
                />
                <button type="button" className="alg-community-edit-btn" disabled={busy} onClick={() => handleSaveEdit(s.id)} title={tr({ zh: '保存', en: 'Save' })}>
                  <Check size={14} />
                </button>
                <button type="button" className="alg-community-edit-btn" disabled={busy} onClick={() => setEditingId(null)} title={tr({ zh: '取消', en: 'Cancel' })}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <code className="alg-community-alg">{s.alg}</code>
                {s.notes && <span className="alg-community-notes">{s.notes}</span>}
                <Link
                  href={`/wca/persons/${encodeURIComponent(s.authorId)}`}
                  className="alg-community-author"
                  title={`${tr({ zh: '投稿者', en: 'Submitted by' })}: ${s.authorName} (${s.authorId})`}
                >
                  {displayCuberName(s.authorName, isZh)}
                </Link>
                {canEdit && (
                  <span className="alg-community-actions">
                    <button type="button" className="alg-community-action-btn" onClick={() => startEdit(s)} title={tr({ zh: '编辑', en: 'Edit' })}>
                      <Pencil size={12} />
                    </button>
                    <button type="button" className="alg-community-action-btn" onClick={() => handleDelete(s.id)} title={tr({ zh: '删除', en: 'Delete' })}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}

      {user && adding ? (
        <div className="alg-community-add">
          <textarea
            className="alg-community-textarea"
            value={draftAlg}
            onChange={e => setDraftAlg(e.target.value)}
            placeholder={tr({ zh: '输入算法', en: 'Enter alg' })}
            rows={1}
            autoFocus
          />
          <input
            className="alg-community-notes-input"
            value={draftNotes}
            onChange={e => setDraftNotes(e.target.value)}
            placeholder={tr({ zh: '注释 (可选)', en: 'Notes (optional)' })}
          />
          <button type="button" className="alg-community-add-icon-btn" disabled={busy || !draftAlg.trim()} onClick={handleSubmit} title={tr({ zh: '提交', en: 'Submit' })}>
            <Check size={14} />
          </button>
          <button type="button" className="alg-community-add-icon-btn" disabled={busy} onClick={() => { setAdding(false); setDraftAlg(''); setDraftNotes(''); }} title={tr({ zh: '取消', en: 'Cancel' })}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="alg-community-add-btn"
          onClick={user ? () => setAdding(true) : login}
          title={user ? tr({ zh: '添加我的算法', en: 'Add my alg' }) : tr({ zh: '登录后添加自己的算法', en: 'Log in to add your own alg' })}
          aria-label={user ? tr({ zh: '添加我的算法', en: 'Add my alg' }) : tr({ zh: '登录添加算法', en: 'Log in to add alg' })}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
