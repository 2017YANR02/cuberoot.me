'use client';

/**
 * Admin-only modal for editing / adding / deleting one alg case.
 *
 * 普通 case: 用户填 caseName / subgroup / setup + 一行一条公式即可,sticker
 * 自动推断默认值。多 orientation (F2L) / 自定义 sticker 等放在"高级"区。
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { X, Save, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { loadAlg, MIRROR_ALG_SYNC_SETS, requires3x3AlgCaseSetup, type AlgCase, type AlgEntry, type AlgPuzzle, type AlgSticker } from '@cuberoot/shared';
import { mirrorCascadeOnDelete, VIEWS } from '@cuberoot/shared/alg-mirror';
import { canonicalSq1Alg, formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { createCase, updateCase, deleteCase, type AlgCaseInput } from '@/lib/alg_sets_api';
import { validateAlgCase, validateStoredAlgCase, setupForCase } from '@/lib/alg_validation';
import { displayAlg, shortOriName } from '@/lib/alg_display';
import { primaryCaseName } from '@/lib/alg_case_display';
import AlgEditor, { type AlgEditorHandle, type AlgEditorMirror, type AlgInvalidMark } from '@/components/AlgEditor';
import AlgDeleteConfirm, { type AlgDeleteGroup } from '@/components/AlgDeleteConfirm';
import AlgInput from '@/components/AlgInput';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer';
import CubeKeyboardSection from '@/components/CubeKeyboardSection';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { DEFAULT_ALG_CUBE_ORIENTATION } from '@/lib/alg_thumb_plan';
import { tr } from '@/i18n/tr';
import { SQ1_NOTATION_MODES, type Sq1NotationMode } from '@/lib/sq1-pbl-notation';

export type AdminEditorState =
  | { mode: 'edit'; existing: AlgCase }
  | { mode: 'add' };

interface Props {
  puzzle: AlgPuzzle;
  setSlug: string;
  state: AdminEditorState;
  /** 页面那轮校验已经判出的坏行 —— 一开编辑器就标红,不用先按一次保存。 */
  initialInvalid?: AlgInvalidMark[];
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

export default function AdminCaseEditor({ puzzle, setSlug, state, initialInvalid, onClose, onSaved }: Props) {
  useTranslation(); // subscribe to language changes; text via tr()
  const initial = state.mode === 'edit' ? state.existing : blankCase(puzzle, setSlug);
  const [orientation] = useQueryState(
    'orientation',
    parseAsStringEnum<string>(CUBE_ORIENTATIONS.map(option => option.value))
      .withDefault(DEFAULT_ALG_CUBE_ORIENTATION),
  );
  const [sq1NotationMode] = useQueryState(
    'sq1-notation',
    parseAsStringEnum<Sq1NotationMode>([...SQ1_NOTATION_MODES]).withDefault('compact'),
  );
  const formatSq1EditorAlg = useCallback(
    (alg: string) => puzzle === 'sq1' && sq1NotationMode === 'full'
      ? canonicalSq1Alg(alg)
      : formatScrambleForEvent(puzzle, alg),
    [puzzle, sq1NotationMode],
  );
  const initialSetupText = formatSq1EditorAlg(initial.setup);

  const [caseName, setCaseName] = useState(initial.name);
  const [subgroup, setSubgroup] = useState(initial.subgroup);
  const [setup, setSetup] = useState(initialSetupText);
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
  const initialPreviewEntry = initial.algs[0]?.[0];
  const [preview, setPreview] = useState(() => ({
    alg: initialPreviewEntry?.alg ?? '',
    setup: initialPreviewEntry?.setup,
  }));
  const handlePreviewAlg = useCallback((alg: string, entrySetup?: string) => {
    if (alg.trim()) setPreview({ alg, setup: entrySetup });
  }, []);
  // Debounce preview(给 AlgPlayer);避免每次按键都重建播放器。
  const [debouncedPreview, setDebouncedPreview] = useState(preview);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPreview(preview), 400);
    return () => clearTimeout(t);
  }, [preview]);

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
  }, [debouncedPreview, setup]);

  /**
   * 镜像伙伴(issue #40 T5)—— 删一条公式 / 删整张 case 之前要算「会连带抹掉哪些生成公式」,
   * 而那些公式落在**伙伴那张 case** 上,本组件手上只有自己这张,所以得去拉一次。
   *
   * 在这儿拉不在调用方传:AdminCaseEditor 有四处宿主(case 详情页 / case 列表页 /
   * 校验报告 ×2),其中两处手上根本没有整个 set 的数据 —— 靠传参就会在那两处静默少一段
   * 连带清单,而这个弹层存在的意义正是不静默。只对真会写回公式的 set 拉(`MIRROR_ALG_SYNC_SETS`),
   * 且必须已建链:没链就一条都不生成,自然没有连带。
   */
  const selfId = state.mode === 'edit' ? state.existing.id ?? null : null;
  const linkedId = state.mode === 'edit' ? state.existing.mirrorCaseId ?? null : null;
  const mirrorWanted = selfId != null && linkedId != null && MIRROR_ALG_SYNC_SETS.has(`${puzzle}/${setSlug}`);
  const [mirrorCtx, setMirrorCtx] = useState<AlgEditorMirror | null>(null);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  useEffect(() => {
    if (!mirrorWanted) { setMirrorCtx(null); setMirrorError(null); return; }
    const self = (state as { existing: AlgCase }).existing;
    let live = true;
    setMirrorCtx(null);
    setMirrorError(null);
    loadAlg(puzzle, setSlug, { fresh: true })
      .then(d => {
        if (!live) return;
        const p = d.cases.find(c => c.id === linkedId);
        if (!p || p.id == null) {
          setMirrorError(tr({
            zh: `镜像伙伴 case ${linkedId} 不在这个 set 里 —— 连带清单算不出来,请自行确认。`,
            en: `Mirror partner case ${linkedId} is not in this set — cannot compute the cascade.`,
          }));
          return;
        }
        // zbls 里伙伴常常**同名**(A+ 的 VM ↔ A- 的 VM)—— 光写 case 名分不出连带落在哪边,
        // 同名时补上子分组。不同名就别加,免得把「A+ / A-」这种本来就清楚的写长。
        const selfLabel = primaryCaseName(puzzle, setSlug, self);
        const partnerLabel = primaryCaseName(puzzle, setSlug, p);
        const tag = (label: string, c: AlgCase) =>
          selfLabel === partnerLabel && c.subgroup ? `${label} ${c.subgroup}` : label;
        setMirrorCtx({
          selfId: selfId!,
          selfName: tag(selfLabel, self),
          partner: { id: p.id, name: tag(partnerLabel, p), algs: p.algs },
        });
      })
      .catch((e: Error) => {
        if (!live) return;
        setMirrorError(tr({
          zh: `拉镜像伙伴失败(${e.message})—— 连带清单算不出来,请自行确认。`,
          en: `Failed to load the mirror partner (${e.message}) — cannot compute the cascade.`,
        }));
      });
    return () => { live = false; };
    // `state` 只在开弹层时定下来,用 id 当依赖就够,免得对象换引用触发重拉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, setSlug, mirrorWanted, selfId, linkedId]);
  const mirrorPending = mirrorWanted && !mirrorCtx && !mirrorError;

  const advancedDirty = useMemo(() => {
    if (algsJson.trim() && algsJson !== JSON.stringify(initial.algs, null, 2)) return true;
    if (stickerJson !== JSON.stringify(initial.sticker, null, 2)) return true;
    if (oriNamesJson) return true;
    return false;
  }, [algsJson, stickerJson, oriNamesJson, initial]);

  const handleSave = async () => {
    setError(null);
    if (!caseName.trim()) { setError(tr({ zh: 'Case 名不能为空', en: 'caseName required' })); return; }

    // Algs: prefer advanced JSON if user filled it; else read from AlgEditor
    let algs: AlgEntry[][];
    /** 入库数组的下标 → **编辑器里的行号**。空行不入库,两边的下标因此对不上 ——
     *  照 `ai` 直接标红会标到隔壁那条公式上。高级 JSON 那条路没有行可标,留 null。 */
    let editorRowOf: number[][] | null = null;
    if (advancedOpen && algsJson.trim()) {
      try {
        const parsed = JSON.parse(algsJson);
        if (!Array.isArray(parsed)) throw new Error('not array');
        algs = parsed as AlgEntry[][];
      } catch {
        setError(tr({ zh: '高级 algs JSON 格式错', en: 'Advanced algs JSON invalid' })); return;
      }
    } else {
      const raw = algEditorRef.current?.getValue() ?? [];
      const rows: number[][] = [];
      algs = raw.map(ori => {
        const kept: AlgEntry[] = [];
        const idx: number[] = [];
        ori.forEach((e, i) => { if (e.alg.trim()) { kept.push(e); idx.push(i); } });
        rows.push(idx);
        return kept;
      });
      editorRowOf = rows;
      const total = algs.reduce((n, ori) => n + ori.length, 0);
      if (total === 0) {
        setError(tr({ zh: '至少要写一条公式', en: 'At least one alg required' })); return;
      }
    }

    // Sticker: parse advanced JSON, default to existing/inferred if empty
    let sticker: AlgSticker;
    try { sticker = JSON.parse(stickerJson) as AlgSticker; }
    catch { setError(tr({ zh: 'Sticker JSON 格式错', en: 'Sticker JSON invalid' })); return; }

    let oriNames: string[] | null = null;
    if (oriNamesJson.trim()) {
      try {
        const v = JSON.parse(oriNamesJson);
        if (!Array.isArray(v)) throw new Error('not array');
        oriNames = v as string[];
      } catch {
        setError(tr({ zh: 'oriNames JSON 格式错', en: 'oriNames JSON invalid' })); return;
      }
    }

    const body: AlgCaseInput = {
      caseName: caseName.trim(),
      subgroup: subgroup.trim(),
      setup: (setup === initialSetupText ? initial.setup : setup).trim(),
      standard: standard.trim() || null,
      sticker,
      algs,
      oriNames,
      trainerKey: trainerKey.trim() || null,
    };

    if (requires3x3AlgCaseSetup(puzzle, setSlug) && !body.setup) {
      setError(tr({
        zh: 'F2L 和非标 F2L 必须填写可解析的 Setup 公式',
        en: 'F2L and Advanced F2L require a valid setup algorithm',
      }));
      return;
    }

    setBusy(true);

    // 校验每条公式 setup + alg 后是否完成对应阶段(3x3 face/f2l 启用,其它先放过)。
    // 收尾 AUF **不用手写**:校验器算得出该补哪个 U,入库前补齐(显示时 displayAlg 再剥)。
    try {
      const checks = await Promise.all(
        algs.flatMap((ori, oi) => ori.map((entry, ai) => {
          const bare = displayAlg(entry.alg);
          // setup 只描述第 0 个朝向;别的槽位要共轭过去。空 setup 的集合由首条公式反推。
          const oriSetup = setupForCase(puzzle, body.setup, algs[0]?.[0]?.alg, oi);
          const entrySetup = entry.setup ?? oriSetup;
          return validateAlgCase(entrySetup, bare, sticker, puzzle, setSlug)
            .then(async r => {
              if (!r.ok) return { oi, ai, alg: entry.alg, bare, completed: bare, ...r };
              const completed = r.auf ? `${bare} ${r.auf}` : bare;
              const stored = await validateStoredAlgCase(entrySetup, completed, sticker, puzzle, setSlug);
              return { oi, ai, alg: entry.alg, bare, completed, ...stored };
            });
        }))
      );
      const bad = checks.filter(c => !c.ok);
      if (bad.length > 0) {
        // 原因标到**行上**(红框 + 行下一句话)。行上已经写清楚了,底部就别再说一遍。
        if (editorRowOf) {
          algEditorRef.current?.markInvalid(bad.map(b => ({
            oi: b.oi,
            ai: editorRowOf[b.oi]?.[b.ai] ?? b.ai,
            reason: b.reason ?? '',
          })));
          setError('');
        } else {
          // 高级 JSON:没有行可标,还是把原文列出来
          setError(
            tr({ zh: '以下公式没通过校验:\n', en: 'Validation failed:\n' }) +
            bad.map(b => `• "${b.alg}" — ${b.reason}`).join('\n')
          );
        }
        setBusy(false);
        return;
      }
      algEditorRef.current?.markInvalid([]); // 全过了,把上一轮的红标清掉
      body.algs = algs.map((ori, oi) => ori.map((entry, ai) => {
        const c = checks.find(x => x.oi === oi && x.ai === ai)!;
        return { ...entry, alg: c.completed };
      }));
    } catch (e) {
      setError(tr({ zh: '校验出错: ', en: 'Validation error: ' }) + (e as Error).message);
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

  // ── 删整张 case:先摊开「这张自己的全部公式」+「伙伴那边会被剥掉的生成公式」再问一句。
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** 这张 case 自己的公式,按视角分组 —— 删掉就是这些全没。 */
  const ownAlgGroups = useMemo<AlgDeleteGroup[]>(() =>
    initial.algs.flatMap((view, vi) => {
      const algs = view.filter(e => e.alg.trim()).map(e => displayAlg(e.alg));
      if (!algs.length) return [];
      const name = initial.oriNames?.[vi];
      return [{ where: name ? shortOriName(name) : undefined, algs }];
    }),
    [initial],
  );

  /**
   * 伙伴那边的连带。链一断伙伴整批生成条都不再生成 —— 连它**自己的 y² 那份**也一起没,
   * 理由在 `mirrorCascadeOnDelete` 的注释里,这里只负责把结果摆出来。
   */
  const deleteCascade = useMemo<AlgDeleteGroup[]>(() => {
    if (!mirrorCtx) return [];
    const gone = mirrorCascadeOnDelete(
      { id: mirrorCtx.selfId, algs: initial.algs },
      { id: mirrorCtx.partner.id, algs: mirrorCtx.partner.algs },
    );
    const byWhere = new Map<string, string[]>();
    for (const e of gone) {
      const where = `${mirrorCtx.partner.name} ${VIEWS[e.view]}`;
      const list = byWhere.get(where);
      if (list) list.push(displayAlg(e.alg));
      else byWhere.set(where, [displayAlg(e.alg)]);
    }
    return [...byWhere].map(([where, algs]) => ({ where, algs }));
  }, [mirrorCtx, initial]);

  const handleDelete = async () => {
    if (state.mode !== 'edit') return;
    setBusy(true);
    setError(null);
    try {
      await deleteCase(puzzle, setSlug, state.existing.id!);
      onSaved({ type: 'delete', id: state.existing.id! });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const title = state.mode === 'edit'
    ? tr({ zh: `编辑 case: ${state.existing.name}`, en: `Edit case: ${state.existing.name}` })
    : tr({ zh: '新增 case', en: 'Add new case' });
  const previewSetup = debouncedPreview.setup ?? setup;

  return (
    <div className="alg-admin-modal-backdrop alg-admin-modal-backdrop-top" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal alg-admin-modal-fullscreen" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>{title}</h2>
          <button type="button" className="alg-admin-modal-head-btn" onClick={onClose} title={tr({ zh: '关闭', en: 'Close' })}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-main">
          <aside className="alg-admin-modal-side">
            {previewSetup.trim() ? (
              // 统一走 AlgPlayer 的默认分流：公式库支持的拼图复用 /sim 播放器，
              // getPlayer() 仍提供同一份可 seek handle 给光标同步。
              <AlgPlayer
                ref={playerHandleRef}
                alg={debouncedPreview.alg}
                puzzle={puzzle}
                set={setSlug}
                setup={previewSetup}
                orientation={orientation}
                fillPane
              />
            ) : (
              <div className="alg-admin-modal-side-empty">
                {tr({ zh: '填入 Setup 公式后,左侧会显示动画演示', en: 'Enter a setup to preview here' })}
              </div>
            )}
          </aside>

          <div className="alg-admin-modal-body">
          <label>
            <span>{tr({ zh: 'Case 名', en: 'Case Name' })} *</span>
            <input className="alg-admin-modal-input" value={caseName} onChange={e => setCaseName(e.target.value)} maxLength={128} autoFocus />
          </label>
          <label>
            <span>{tr({ zh: '子分组', en: 'Subgroup' })}</span>
            <input className="alg-admin-modal-input" value={subgroup} onChange={e => setSubgroup(e.target.value)} maxLength={64}
              placeholder={tr({ zh: '例如 Geng / U / Adj Swap', en: 'e.g. Geng / U / Adj Swap' })} />
          </label>
          <label className="alg-admin-setup-label">
              <span>{tr({ zh: '打乱', en: 'Setup' })}</span>
            <AlgInput
              className="alg-admin-setup-textarea"
              elementRef={setupElRef}
              initialText={initialSetupText}
              autoSpace
              multiline={false}
              placeholder={tr({ zh: '把魔方变成此 case 的公式', en: 'scramble that produces this case' })}
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
              {tr({ zh: '公式 (Enter 加新行,记号键 ✎ 切下划/波浪/删除)', en: 'Algs (Enter to add row; ✎ for marks)' })} *
            </span>
            <AlgEditor
              ref={algEditorRef}
              initialValue={initial.algs}
              formatInitialAlg={puzzle === 'sq1' ? formatSq1EditorAlg : undefined}
              initialInvalid={initialInvalid}
              oriNames={initial.oriNames}
              mirror={mirrorCtx}
              mirrorPending={mirrorPending}
              mirrorError={mirrorError}
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
              {tr({ zh: '高级', en: 'Advanced' })}
              {!advancedOpen && advancedDirty && <span className="alg-admin-advanced-dot" title="modified" />}
            </button>
            {advancedOpen && (
              <div className="alg-admin-advanced-body">
                <label>
                  <span>{tr({ zh: 'Standard 公式 (可选,展示给 trainer)', en: 'Standard alg (optional)' })}</span>
                  <input className="alg-admin-modal-input" value={standard} onChange={e => setStandard(e.target.value)} />
                </label>
                <label>
                  <span>{tr({ zh: 'Algs 2D JSON (覆盖上方编辑器,空则忽略)', en: 'Algs 2D JSON (overrides editor when filled)' })}</span>
                  <textarea className="alg-admin-modal-textarea" value={algsJson} onChange={e => setAlgsJson(e.target.value)} rows={6} spellCheck={false}
                    placeholder={JSON.stringify(initial.algs, null, 2)} />
                </label>
                <label>
                  <span>{tr({ zh: 'Sticker JSON (魔方图渲染数据)', en: 'Sticker JSON (cube preview data)' })}</span>
                  <textarea className="alg-admin-modal-textarea" value={stickerJson} onChange={e => setStickerJson(e.target.value)} rows={4} spellCheck={false} />
                </label>
                <label>
                  <span>{tr({ zh: 'oriNames (F2L 4 个朝向名,JSON 数组)', en: 'oriNames (F2L 4-orientation labels, JSON)' })}</span>
                  <textarea className="alg-admin-modal-textarea" value={oriNamesJson} onChange={e => setOriNamesJson(e.target.value)} rows={2} spellCheck={false}
                    placeholder='["Front Right","Front Left","Back Left","Back Right"]' />
                </label>
                <label>
                  <span>{tr({ zh: 'trainerKey (ZBLS 才用)', en: 'trainerKey (ZBLS only)' })}</span>
                  <input className="alg-admin-modal-input" value={trainerKey} onChange={e => setTrainerKey(e.target.value)} maxLength={32} />
                </label>
              </div>
            )}
          </div>

          {error && <div className="alg-admin-modal-error">{error}</div>}
          </div>
        </div>

        <div className="alg-admin-modal-foot">
          {/* 开删除弹层时顺手清掉上一次保存留下的报错 —— 它和「要不要删」无关,顶在弹层里只会误导 */}
          {state.mode === 'edit' && (
            <button type="button" className="alg-admin-modal-delete alg-admin-modal-foot-btn" disabled={busy} onClick={() => { setError(null); setConfirmingDelete(true); }}>
              <Trash2 size={14} /> {tr({ zh: '删除', en: 'Delete' })}
            </button>
          )}
          <div className="alg-admin-modal-foot-spacer" />
          <button type="button" className="alg-admin-modal-foot-btn" disabled={busy} onClick={onClose}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button type="button" className="alg-admin-modal-save alg-admin-modal-foot-btn" disabled={busy} onClick={handleSave}>
            <Save size={14} /> {tr({ zh: '保存', en: 'Save' })}
          </button>
        </div>
      </div>

      {confirmingDelete && state.mode === 'edit' && (
        <AlgDeleteConfirm
          title={tr({
            zh: `删掉整张 case「${primaryCaseName(puzzle, setSlug, state.existing)}」?`,
            en: `Delete the whole case “${primaryCaseName(puzzle, setSlug, state.existing)}”?`,
          })}
          target={ownAlgGroups}
          cascade={deleteCascade}
          cascadePending={mirrorPending}
          cascadeError={mirrorError}
          note={tr({ zh: '这一步立刻生效,不可撤销。', en: 'This takes effect immediately and cannot be undone.' })}
          confirmLabel={tr({ zh: '删除 case', en: 'Delete case' })}
          busy={busy}
          error={error}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
