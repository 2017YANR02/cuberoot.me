'use client';

/**
 * Community-submitted algs for one case — ported from
 * packages/client-vite/src/pages/alg/CommunityAlgs.tsx.
 * The parent (AlgCategoryView) groups all submissions by caseName and passes
 * each case its slice. Logged-in users can add; authors + admins edit/delete.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlgTextField } from '@/hooks/useAlgTextField';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { is3x3TopLayerSet, type AlgSubmission, type AlgSticker } from '@cuberoot/shared';
import { startsWithYRotation } from '@cuberoot/shared/alg-notation';
import PersonLink from '@/components/PersonLink';
import { UserIdLabel } from '@/components/UserIdLabel';
import { addSubmission, updateSubmission, deleteSubmission } from '@/lib/alg_api';
import { validateAlgCase, validateStoredAlgCase, setupForCase } from '@/lib/alg_validation';
import { caseViewAlg, displayAlg, type CaseViewAngle } from '@/lib/alg_display';
import { formatAlgNotation, type AlgNotationStyle } from '@/lib/alg-notation-display';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { ownerDisplayName } from '@/lib/cuber-name-display';
import { tr } from '@/i18n/tr';

interface Props {
  puzzle: string;
  setSlug: string;
  caseName: string;
  /** Case sticker + setup — used to validate a submitted alg actually solves the case. */
  sticker: AlgSticker;
  setup: string;
  /** 本 case 的首条公式 —— setup 为空的集合靠它反推 setup(见 `setupForCase`)。 */
  firstAlg?: string;
  /** All current submissions for this case (parent already filtered). */
  submissions: AlgSubmission[];
  /** 只改只读公式的显示；编辑框和提交值始终保持标准记号。 */
  notationStyle?: AlgNotationStyle;
  /** 只改只读公式的观察角度；编辑、校验和入库仍使用原始 case。 */
  viewAngle?: CaseViewAngle;
  /** Patch the page-level submissions array. caseName edits cross cases so we
   *  let the parent see the full add/update/delete intent rather than a per-case
   *  "next list". */
  onPatch: (action:
    | { type: 'add'; submission: AlgSubmission }
    | { type: 'update'; submission: AlgSubmission }
    | { type: 'delete'; id: number }
  ) => void;
}

export type PreparedCommunityAlg =
  | { ok: true; alg: string }
  | { ok: false; kind: 'invalid' | 'unavailable' | 'leading-y-rotation'; reason: string };

/**
 * 投稿前的强制状态校验。失败或校验器异常都不返回可入库公式,调用方不得继续写 API。
 */
export async function prepareCommunityAlgForSubmission({
  raw,
  puzzle,
  setSlug,
  sticker,
  setup,
  firstAlg,
}: Pick<Props, 'puzzle' | 'setSlug' | 'sticker' | 'setup' | 'firstAlg'> & { raw: string }): Promise<PreparedCommunityAlg> {
  const bare = displayAlg(raw);
  if (is3x3TopLayerSet(puzzle, setSlug) && startsWithYRotation(bare)) {
    return { ok: false, kind: 'leading-y-rotation', reason: '' };
  }
  try {
    // 空 setup 的集合(2x2 / 大魔方 parity / skewb)靠 case 的**首条**公式反推 —— 拿投稿者
    // 自己那条反推等于让他自证,永远通过。
    const result = await validateAlgCase(
      setupForCase(puzzle, setup, firstAlg),
      bare,
      sticker,
      puzzle,
      setSlug,
    );
    if (!result.ok) {
      return { ok: false, kind: 'invalid', reason: result.reason ?? '' };
    }
    const completed = result.auf ? `${bare} ${result.auf}` : bare;
    const stored = await validateStoredAlgCase(
      setupForCase(puzzle, setup, firstAlg),
      completed,
      sticker,
      puzzle,
      setSlug,
    );
    if (!stored.ok) {
      return { ok: false, kind: 'invalid', reason: stored.reason ?? '' };
    }
    return { ok: true, alg: completed };
  } catch (error) {
    return {
      ok: false,
      kind: 'unavailable',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export default function CommunityAlgs({
  puzzle,
  setSlug,
  caseName,
  sticker,
  setup,
  firstAlg,
  submissions,
  notationStyle = 'standard',
  viewAngle = 'default',
  onPatch,
}: Props) {
  const { i18n } = useTranslation(); // subscribe to language changes; text via tr()
  const isZh = i18n.language.startsWith('zh');
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
  // 所有权键(与服务端一致):非 WCA 账号也能认出自己提交的公式。
  const myKey = user ? computeOwnerKey(user.uid, user.wcaId) : '';

  /** 校验 + 补齐收尾 AUF。校验失败或校验器异常时都严格拦截。 */
  const prepareAlg = async (raw: string): Promise<string | null> => {
    const prepared = await prepareCommunityAlgForSubmission({
      raw,
      puzzle,
      setSlug,
      sticker,
      setup,
      firstAlg,
    });
    if (prepared.ok) return prepared.alg;
    const heading = prepared.kind === 'leading-y-rotation'
      ? tr({
        zh: '顶层公式不能以 y 转体开头,请改用对应的 U 层转动',
        en: 'Top-layer algs cannot start with a y rotation; use the corresponding U turn',
      })
      : prepared.kind === 'invalid'
        ? tr({ zh: '公式校验未通过,未提交', en: 'Validation failed; not submitted' })
        : tr({ zh: '暂时无法校验公式,未提交', en: 'Could not validate; not submitted' });
    alert(`${heading}${prepared.reason ? `: ${prepared.reason}` : ''}`);
    return null;
  };

  const [adding, setAdding] = useState(false);
  const [draftAlg, setDraftAlg] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAlg, setEditAlg] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCaseName, setEditCaseName] = useState('');

  // 公式框只收半角招式 —— 中文输入法开着也一样(全角转半角、汉字直接删)。注释框不管,
  // 那里本来就该能写中文。
  const draftAlgField = useAlgTextField(setDraftAlg);
  const editAlgField = useAlgTextField(setEditAlg);

  const handleSubmit = async () => {
    if (!draftAlg.trim()) return;
    setBusy(true);
    try {
      const alg = await prepareAlg(draftAlg.trim());
      if (alg === null) return;
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
    setBusy(true);
    try {
      const alg = await prepareAlg(editAlg.trim());
      if (alg === null) return;
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
                  {...editAlgField}
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
                <code className="alg-community-alg">
                  {formatAlgNotation(displayAlg(caseViewAlg(s.alg, viewAngle)), notationStyle)}
                </code>
                {s.notes && <span className="alg-community-notes">{s.notes}</span>}
                {/* authorId 是归属键 ownerKey,没绑 WCA 的账号是合成 `u<uid>`——
                    PersonLink 对非 WCA id 自动降级成纯文本,不出死链。 */}
                <PersonLink
                  wcaId={s.authorId}
                  className="alg-community-author"
                  title={`${tr({ zh: '投稿者', en: 'Submitted by' })}: ${s.authorName} (${s.authorId})`}
                >
                  {ownerDisplayName(s.authorId, s.authorName, isZh)}
                </PersonLink>
                <UserIdLabel userId={s.authorUserId} />
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
            {...draftAlgField}
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
