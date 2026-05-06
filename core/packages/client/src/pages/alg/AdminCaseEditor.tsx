/**
 * Admin-only modal for editing / adding / deleting one alg case.
 *
 * Most fields use plain inputs. `sticker` / `algs` / `oriNames` are JSON
 * blobs — we render them as textareas with parse-on-save. Bad JSON shows
 * an inline error and blocks submit.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Trash2 } from 'lucide-react';
import type { AlgCase } from '@cuberoot/shared';
import { createCase, updateCase, deleteCase, type AlgCaseInput } from '../../utils/alg_sets_api';

export type AdminEditorState =
  | { mode: 'edit'; existing: AlgCase }
  | { mode: 'add' };

interface Props {
  puzzle: string;
  setSlug: string;
  state: AdminEditorState;
  onClose: () => void;
  onSaved: (action: { type: 'add'; created: AlgCase } | { type: 'update'; updated: AlgCase } | { type: 'delete'; id: number }) => void;
}

function blankCase(): AlgCase {
  return {
    name: '',
    subgroup: '',
    setup: '',
    sticker: { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' } as AlgCase['sticker'],
    algs: [[{ alg: '' }]],
  };
}

export default function AdminCaseEditor({ puzzle, setSlug, state, onClose, onSaved }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const initial = state.mode === 'edit' ? state.existing : blankCase();

  const [caseName, setCaseName] = useState(initial.name);
  const [subgroup, setSubgroup] = useState(initial.subgroup);
  const [setup, setSetup] = useState(initial.setup);
  const [standard, setStandard] = useState(initial.standard ?? '');
  const [stickerJson, setStickerJson] = useState(JSON.stringify(initial.sticker, null, 2));
  const [algsJson, setAlgsJson] = useState(JSON.stringify(initial.algs, null, 2));
  const [oriNamesJson, setOriNamesJson] = useState(initial.oriNames ? JSON.stringify(initial.oriNames) : '');
  const [trainerKey, setTrainerKey] = useState(initial.trainerKey ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!caseName.trim()) { setError(isZh ? 'Case 名不能为空' : 'caseName required'); return; }
    let sticker: unknown, algs: unknown, oriNames: string[] | null = null;
    try { sticker = JSON.parse(stickerJson); }
    catch { setError(isZh ? 'sticker JSON 格式错' : 'sticker JSON invalid'); return; }
    try { algs = JSON.parse(algsJson); }
    catch { setError(isZh ? 'algs JSON 格式错' : 'algs JSON invalid'); return; }
    if (!Array.isArray(algs)) { setError('algs must be an array'); return; }
    if (oriNamesJson.trim()) {
      try { oriNames = JSON.parse(oriNamesJson) as string[]; }
      catch { setError(isZh ? 'oriNames JSON 格式错' : 'oriNames JSON invalid'); return; }
      if (!Array.isArray(oriNames)) { setError('oriNames must be an array'); return; }
    }

    const body: AlgCaseInput = {
      caseName: caseName.trim(),
      subgroup: subgroup.trim(),
      setup: setup.trim(),
      standard: standard.trim() ? standard.trim() : null,
      sticker,
      algs,
      oriNames,
      trainerKey: trainerKey.trim() ? trainerKey.trim() : null,
    };

    setBusy(true);
    try {
      if (state.mode === 'add') {
        const created = await createCase(puzzle, setSlug, body);
        onSaved({ type: 'add', created });
      } else {
        const updated = await updateCase(puzzle, setSlug, state.existing.id!, body);
        onSaved({ type: 'update', updated });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (state.mode !== 'edit') return;
    if (!confirm(isZh ? `确定删除 "${state.existing.name}"?` : `Delete "${state.existing.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCase(puzzle, setSlug, state.existing.id!);
      onSaved({ type: 'delete', id: state.existing.id! });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = state.mode === 'edit'
    ? (isZh ? `编辑 case: ${state.existing.name}` : `Edit case: ${state.existing.name}`)
    : (isZh ? '新增 case' : 'Add new case');

  return (
    <div className="alg-admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} title={isZh ? '关闭' : 'Close'}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-body">
          <label>
            <span>Case Name *</span>
            <input value={caseName} onChange={e => setCaseName(e.target.value)} maxLength={128} />
          </label>
          <label>
            <span>Subgroup</span>
            <input value={subgroup} onChange={e => setSubgroup(e.target.value)} maxLength={64} />
          </label>
          <label>
            <span>Setup</span>
            <input value={setup} onChange={e => setSetup(e.target.value)} />
          </label>
          <label>
            <span>{isZh ? 'Standard 公式 (可选)' : 'Standard alg (optional)'}</span>
            <input value={standard} onChange={e => setStandard(e.target.value)} />
          </label>
          <label>
            <span>Sticker (JSON) *</span>
            <textarea value={stickerJson} onChange={e => setStickerJson(e.target.value)} rows={4} spellCheck={false} />
          </label>
          <label>
            <span>Algs (JSON, 2D array) *</span>
            <textarea value={algsJson} onChange={e => setAlgsJson(e.target.value)} rows={6} spellCheck={false} />
          </label>
          <label>
            <span>{isZh ? 'oriNames (F2L 才用,JSON 数组)' : 'oriNames (F2L only, JSON array)'}</span>
            <textarea value={oriNamesJson} onChange={e => setOriNamesJson(e.target.value)} rows={2} spellCheck={false}
              placeholder='e.g. ["Front Right","Front Left","Back Left","Back Right"]' />
          </label>
          <label>
            <span>{isZh ? 'trainerKey (ZBLS 才用)' : 'trainerKey (ZBLS only)'}</span>
            <input value={trainerKey} onChange={e => setTrainerKey(e.target.value)} maxLength={32} />
          </label>

          {error && <div className="alg-admin-modal-error">{error}</div>}
        </div>

        <div className="alg-admin-modal-foot">
          {state.mode === 'edit' && (
            <button type="button" className="alg-admin-modal-delete" disabled={busy} onClick={handleDelete}>
              <Trash2 size={14} /> {isZh ? '删除' : 'Delete'}
            </button>
          )}
          <div className="alg-admin-modal-foot-spacer" />
          <button type="button" disabled={busy} onClick={onClose}>{isZh ? '取消' : 'Cancel'}</button>
          <button type="button" className="alg-admin-modal-save" disabled={busy} onClick={handleSave}>
            <Save size={14} /> {isZh ? '保存' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
