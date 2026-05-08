/**
 * Admin-only modal for editing / adding / deleting one alg case.
 *
 * 普通 case: 用户填 caseName / subgroup / setup + 一行一条公式即可,sticker
 * 自动推断默认值。多 orientation (F2L) / 自定义 sticker 等放在"高级"区。
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import type { AlgCase, AlgEntry, AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { createCase, updateCase, deleteCase, type AlgCaseInput } from '../../utils/alg_sets_api';
import { validateAlgCase } from '../../utils/alg_validation';
import AlgEditor, { type AlgEditorHandle } from './AlgEditor';
import AlgInput from '../../components/AlgInput';
import AlgPlayer, { type AlgPlayerHandle } from '../../components/AlgPlayer';
import CubeKeyboardSection from '../../components/CubeKeyboardSection';
import { syncPlayerToMoveCount } from '../../utils/recon_alg_utils';

export type AdminEditorState =
  | { mode: 'edit'; existing: AlgCase }
  | { mode: 'add' };

interface Props {
  puzzle: AlgPuzzle;
  setSlug: string;
  state: AdminEditorState;
  onClose: () => void;
  onSaved: (action:
    | { type: 'add'; created: AlgCase }
    | { type: 'update'; updated: AlgCase }
    | { type: 'delete'; id: number }
  ) => void;
}

/** Default sticker for new cases — depends on puzzle/set; rendering needs SOMETHING. */
function defaultStickerFor(puzzle: string, set: string): AlgSticker {
  // ZBLS / F2L-shaped sets use the f2l kind (single fl-pattern key)
  if (puzzle === '3x3' && (set === 'zbls' || set === 'f2l' || set === 'adv-f2l' || set === 'sbls')) {
    return { kind: 'f2l', fl: '' };
  }
  // 3x3 OLL/PLL/COLL/etc. use the face kind (5 face strings)
  if (puzzle === '3x3') {
    return { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' };
  }
  // 2x2/4x4/5x5 — face kind too
  if (puzzle === '2x2' || puzzle === '4x4' || puzzle === '5x5') {
    return { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' };
  }
  // sq1/megaminx/pyraminx/skewb — raw kind, admin needs to fill from elsewhere
  return { kind: 'raw', tag: '', attrs: {} };
}

function blankCase(puzzle: string, set: string): AlgCase {
  return {
    name: '',
    subgroup: '',
    setup: '',
    sticker: defaultStickerFor(puzzle, set),
    algs: [[{ alg: '' }]],
  };
}

export default function AdminCaseEditor({ puzzle, setSlug, state, onClose, onSaved }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const initial = state.mode === 'edit' ? state.existing : blankCase(puzzle, setSlug);

  const [caseName, setCaseName] = useState(initial.name);
  const [subgroup, setSubgroup] = useState(initial.subgroup);
  const [setup, setSetup] = useState(initial.setup);
  const algEditorRef = useRef<AlgEditorHandle>(null);
  const setupElRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  const [setupFocused, setSetupFocused] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [standard, setStandard] = useState(initial.standard ?? '');
  const [stickerJson, setStickerJson] = useState(JSON.stringify(initial.sticker, null, 2));
  const [algsJson, setAlgsJson] = useState('');
  const [oriNamesJson, setOriNamesJson] = useState(initial.oriNames ? JSON.stringify(initial.oriNames) : '');
  const [trainerKey, setTrainerKey] = useState(initial.trainerKey ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAlg, setPreviewAlg] = useState(() => initial.algs[0]?.[0]?.alg ?? '');
  const handlePreviewAlg = useCallback((a: string) => {
    if (a.trim()) setPreviewAlg(a);
  }, []);
  // Debounce previewAlg → debouncedPreviewAlg(给 AlgPlayer);避免每次按键都重建 TwistyPlayer
  const [debouncedPreviewAlg, setDebouncedPreviewAlg] = useState(previewAlg);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPreviewAlg(previewAlg), 400);
    return () => clearTimeout(t);
  }, [previewAlg]);

  // 光标 sync:AlgEditor 上报 prefix token 数,这里转成 player.timestamp
  const playerHandleRef = useRef<AlgPlayerHandle>(null);
  const lastMoveCountRef = useRef(0);
  const handleCursorMoveCount = useCallback((n: number) => {
    lastMoveCountRef.current = n;
    const p = playerHandleRef.current?.getPlayer();
    if (p) syncPlayerToMoveCount(p, n);
  }, []);
  // alg 重建后 player ready 也要再 sync 一次到当前 caret(否则停在 0)
  useEffect(() => {
    const tries = [50, 200, 500].map(d =>
      setTimeout(() => {
        const p = playerHandleRef.current?.getPlayer();
        if (p) syncPlayerToMoveCount(p, lastMoveCountRef.current);
      }, d),
    );
    return () => tries.forEach(clearTimeout);
  }, [debouncedPreviewAlg, setup]);

  const advancedDirty = useMemo(() => {
    if (algsJson.trim() && algsJson !== JSON.stringify(initial.algs, null, 2)) return true;
    if (stickerJson !== JSON.stringify(initial.sticker, null, 2)) return true;
    if (oriNamesJson) return true;
    return false;
  }, [algsJson, stickerJson, oriNamesJson, initial]);

  const handleSave = async () => {
    setError(null);
    if (!caseName.trim()) { setError(isZh ? 'Case 名不能为空' : 'caseName required'); return; }

    // Algs: prefer advanced JSON if user filled it; else read from AlgEditor
    let algs: AlgEntry[][];
    if (advancedOpen && algsJson.trim()) {
      try {
        const parsed = JSON.parse(algsJson);
        if (!Array.isArray(parsed)) throw new Error('not array');
        algs = parsed as AlgEntry[][];
      } catch {
        setError(isZh ? '高级 algs JSON 格式错' : 'Advanced algs JSON invalid'); return;
      }
    } else {
      const raw = algEditorRef.current?.getValue() ?? [];
      algs = raw.map(ori => ori.filter(e => e.alg.trim()));
      const total = algs.reduce((n, ori) => n + ori.length, 0);
      if (total === 0) {
        setError(isZh ? '至少要写一条公式' : 'At least one alg required'); return;
      }
    }

    // Sticker: parse advanced JSON, default to existing/inferred if empty
    let sticker: AlgSticker;
    try { sticker = JSON.parse(stickerJson) as AlgSticker; }
    catch { setError(isZh ? 'Sticker JSON 格式错' : 'Sticker JSON invalid'); return; }

    let oriNames: string[] | null = null;
    if (oriNamesJson.trim()) {
      try {
        const v = JSON.parse(oriNamesJson);
        if (!Array.isArray(v)) throw new Error('not array');
        oriNames = v as string[];
      } catch {
        setError(isZh ? 'oriNames JSON 格式错' : 'oriNames JSON invalid'); return;
      }
    }

    const body: AlgCaseInput = {
      caseName: caseName.trim(),
      subgroup: subgroup.trim(),
      setup: setup.trim(),
      standard: standard.trim() || null,
      sticker,
      algs,
      oriNames,
      trainerKey: trainerKey.trim() || null,
    };

    setBusy(true);

    // 校验每条公式 setup + alg 后是否完成对应阶段(3x3 face/f2l 启用,其它先放过)
    try {
      const checks = await Promise.all(
        algs.flatMap((ori, oi) => ori.map((entry, ai) =>
          validateAlgCase(body.setup, entry.alg, sticker, puzzle)
            .then(r => ({ oi, ai, alg: entry.alg, ...r }))
        ))
      );
      const bad = checks.filter(c => !c.ok);
      if (bad.length > 0) {
        setError(
          (isZh ? '以下公式没通过校验:\n' : 'Validation failed:\n') +
          bad.map(b => `• "${b.alg}" — ${b.reason}`).join('\n')
        );
        setBusy(false);
        return;
      }
    } catch (e) {
      setError((isZh ? '校验出错: ' : 'Validation error: ') + (e as Error).message);
      setBusy(false);
      return;
    }

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
    <div className="alg-admin-modal-backdrop alg-admin-modal-backdrop-top" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal alg-admin-modal-fullscreen" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} title={isZh ? '关闭' : 'Close'}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-main">
          <aside className="alg-admin-modal-side">
            {setup.trim() ? (
              <AlgPlayer ref={playerHandleRef} alg={debouncedPreviewAlg} puzzle={puzzle} set={setSlug} setup={setup} fillPane />
            ) : (
              <div className="alg-admin-modal-side-empty">
                {isZh ? '填入 Setup 公式后,左侧会显示动画演示' : 'Enter a setup to preview here'}
              </div>
            )}
          </aside>

          <div className="alg-admin-modal-body">
          <label>
            <span>{isZh ? 'Case 名' : 'Case Name'} *</span>
            <input value={caseName} onChange={e => setCaseName(e.target.value)} maxLength={128} autoFocus />
          </label>
          <label>
            <span>{isZh ? '子分组' : 'Subgroup'}</span>
            <input value={subgroup} onChange={e => setSubgroup(e.target.value)} maxLength={64}
              placeholder={isZh ? '例如 Geng / U / Adj Swap' : 'e.g. Geng / U / Adj Swap'} />
          </label>
          <label className="alg-admin-setup-label">
            <span>{isZh ? '打乱 (Setup)' : 'Setup'}</span>
            <AlgInput
              elementRef={setupElRef}
              initialText={initial.setup}
              autoSpace
              multiline={false}
              placeholder={isZh ? '把魔方变成此 case 的公式' : 'scramble that produces this case'}
              onChange={t => setSetup(t)}
              onFocus={() => setSetupFocused(true)}
              onBlur={e => {
                const next = e.relatedTarget as HTMLElement | null;
                if (next && next.closest('.alg-admin-setup-label')) return;
                setSetupFocused(false);
              }}
            />
            {setupFocused && (
              <CubeKeyboardSection target={setupElRef} />
            )}
          </label>

          <div className="alg-admin-algs-block">
            <span className="alg-admin-algs-label">
              {isZh ? '公式 (Enter 加新行,记号键 ✎ 切下划/波浪/删除)' : 'Algs (Enter to add row; ✎ for marks)'} *
            </span>
            <AlgEditor
              ref={algEditorRef}
              initialValue={initial.algs}
              oriNames={initial.oriNames}
              isZh={isZh}
              onCurrentAlgChange={handlePreviewAlg}
              onCursorMoveCount={handleCursorMoveCount}
            />
          </div>

          {/* Advanced 区:sticker / 多 orientation algs / oriNames / standard / trainerKey */}
          <div className="alg-admin-advanced">
            <button
              type="button"
              className="alg-admin-advanced-toggle"
              onClick={() => setAdvancedOpen(o => !o)}
            >
              {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {isZh ? '高级' : 'Advanced'}
              {!advancedOpen && advancedDirty && <span className="alg-admin-advanced-dot" title="modified" />}
            </button>
            {advancedOpen && (
              <div className="alg-admin-advanced-body">
                <label>
                  <span>{isZh ? 'Standard 公式 (可选,展示给 trainer)' : 'Standard alg (optional)'}</span>
                  <input value={standard} onChange={e => setStandard(e.target.value)} />
                </label>
                <label>
                  <span>{isZh ? 'Algs 2D JSON (覆盖上方编辑器,空则忽略)' : 'Algs 2D JSON (overrides editor when filled)'}</span>
                  <textarea value={algsJson} onChange={e => setAlgsJson(e.target.value)} rows={6} spellCheck={false}
                    placeholder={JSON.stringify(initial.algs, null, 2)} />
                </label>
                <label>
                  <span>{isZh ? 'Sticker JSON (魔方图渲染数据)' : 'Sticker JSON (cube preview data)'}</span>
                  <textarea value={stickerJson} onChange={e => setStickerJson(e.target.value)} rows={4} spellCheck={false} />
                </label>
                <label>
                  <span>{isZh ? 'oriNames (F2L 4 个朝向名,JSON 数组)' : 'oriNames (F2L 4-orientation labels, JSON)'}</span>
                  <textarea value={oriNamesJson} onChange={e => setOriNamesJson(e.target.value)} rows={2} spellCheck={false}
                    placeholder='["Front Right","Front Left","Back Left","Back Right"]' />
                </label>
                <label>
                  <span>{isZh ? 'trainerKey (ZBLS 才用)' : 'trainerKey (ZBLS only)'}</span>
                  <input value={trainerKey} onChange={e => setTrainerKey(e.target.value)} maxLength={32} />
                </label>
              </div>
            )}
          </div>

          {error && <div className="alg-admin-modal-error">{error}</div>}
          </div>
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
