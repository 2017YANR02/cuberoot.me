'use client';

// 3BLD 公式库 (commutator library) — 角 / 棱换位子字典的字母对矩阵。
//
// 数据源 = PG `alg_sets`/`alg_cases` 的两套 3x3 set(`comm-corner` 378 条 /
// `comm-edge` 440 条),走 `loadAlg` 拉。原来是 ../_data/comm-{corner,edge}.json
// 两个静态 JSON(migration 0090_alg_3bld_comm.sql 搬的),只能读不能改;进库后这页
// 才吃得上 admin 三件套:编辑笔(AdminCaseEditor)/ 校验(AlgAdminValidate)/
// 拖拽公式顺序(SortableAlgRow)。中文联想词仍是静态 JSON —— 那是记忆提示,不是公式。
//
// 每条换位子都是一个三循环。库里:
//   • `setup` = 该字母对的 **case 态**(= 公式取逆)⟹ 缩略图 / 播放器的起始态就是它;
//   • `name`  = 字母对(`AD` = 缓冲打到 A 再打到 D),`subgroup` = 第一个目标字母。
//
// ⚠ **这两套禁用 `displayAlg`**:它剥末尾 AUF,而换位子里 818 条有 229 条**真的**以
//   U / U' / U2 收尾(`U' R2 D R' U2 R D' R' U2 R' U`),剥了就是条错公式。显示 / 复制
//   一律用库里的原文。(AdminCaseEditor 存盘时剥了又按校验器补回来,来回是幂等的。)

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Lightbulb, Boxes, Square, Pencil, Copy, Check, AlertTriangle } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { loadAlg, type AlgCase, type AlgEntry, type AlgFile } from '@cuberoot/shared';
import { useCopy } from '@/hooks/useCopy';
import { ClearButton } from '@/components/ClearButton';
import { Spinner } from '@/components/Spinner/Spinner';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useAlgViewMode } from '@/components/AlgViewModeToggle';
import AlgPdfButton from '@/components/AlgPdfButton';
import { algSheetFromCases } from '@/lib/alg_pdf/from_cases';
import AdminCaseEditor, { type AdminEditorState } from '@/components/AdminCaseEditor';
import AlgAdminValidate from '@/components/AlgAdminValidate';
import AlgPlayer from '@/components/AlgPlayer';
import SortableAlgRow from '@/components/SortableAlgRow';
import { reorderCaseAlgs } from '@/lib/alg_sets_api';
import { scanCases } from '@/lib/alg_validation_scan';
import { useIsAdmin } from '@/lib/auth-store';
import '../3bld.css';
import '../../alg.css';
import { tr } from '@/i18n/tr';

type Kind = 'corner' | 'edge';
type AssocMap = Record<string, string>;

const PUZZLE = '3x3' as const;
const SET_SLUG: Record<Kind, string> = { corner: 'comm-corner', edge: 'comm-edge' };

/** 一条公式在拖拽里的 id。case id + 下标编进去,drop 时直接读回。 */
const algDragId = (caseId: number, i: number) => `alg-${caseId}-${i}`;

/** 一条公式行:文本 + 复制 +(admin)校验红标。**不过 displayAlg** —— 见文件头注。 */
function CommAlgRow({ entry, invalid }: { entry: AlgEntry; invalid?: string }): JSX.Element {
  const { copied, copy } = useCopy();
  return (
    <div className={`alg-alg-row${invalid ? ' is-invalid' : ''}`} title={invalid}>
      {invalid && <AlertTriangle size={13} className="alg-alg-invalid-icon" aria-label={invalid} />}
      <span className="alg-alg-text">{entry.alg}</span>
      <button
        type="button"
        className="alg-alg-copy-btn"
        onClick={() => copy(entry.alg)}
        title={tr({ zh: '复制公式', en: 'Copy alg' })}
      >
        {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
      </button>
    </div>
  );
}

export default function CommLibraryPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const isAdmin = useIsAdmin();

  const [kind, setKind] = useState<Kind>('corner');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  // 全站共用的「图 / 公式」偏好:图 = 只留缩略图 + 编码(认图),公式 = 卡上内联公式 + 联想词。
  const [view, changeView] = useAlgViewMode();
  const showAlgs = view === 'full';

  const [files, setFiles] = useState<Partial<Record<Kind, AlgFile>>>({});
  const [error, setError] = useState<string | null>(null);
  const [assoc, setAssoc] = useState<AssocMap>({});

  const [editorState, setEditorState] = useState<AdminEditorState | null>(null);
  /**
   * 校验不过的**公式**:`${caseId}:${oriIdx}:${algIdx}` → 原因。卡片红框由它推出来。
   * 只给 admin 跑 —— 每个访客都跑一遍 cubing.js 纯属浪费,红框是给能修的人看的。
   */
  const [invalidAlgs, setInvalidAlgs] = useState<Map<string, string>>(new Map());

  // 两套一起拉(切换 corner/edge 是本页的 tab,不该各等一次网络)。
  // admin 走 fresh 绕开那 1 小时 Cache-Control —— 否则刚改完一强刷就复活旧数据。
  useEffect(() => {
    let alive = true;
    setError(null);
    void (async () => {
      try {
        const [corner, edge, a] = await Promise.all([
          loadAlg(PUZZLE, SET_SLUG.corner, { fresh: isAdmin }),
          loadAlg(PUZZLE, SET_SLUG.edge, { fresh: isAdmin }),
          import('../_data/assoc-words.json'),
        ]);
        if (!alive) return;
        setFiles({ corner, edge });
        setAssoc((a.default ?? a) as AssocMap);
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const file = files[kind] ?? null;
  const loading = file === null && error === null;

  /** 把某一套里的 case 就地换掉(编辑 / 拖拽后回写已加载的那份数据)。 */
  const patchCases = useCallback((k: Kind, updater: (cases: AlgCase[]) => AlgCase[]) => {
    setFiles(prev => {
      const f = prev[k];
      if (!f) return prev;
      return { ...prev, [k]: { ...f, cases: updater(f.cases) } };
    });
  }, []);

  /** admin 才扫;case 改完(file 变)重扫,红标跟着消。 */
  useEffect(() => {
    if (!isAdmin || !file) { setInvalidAlgs(new Map()); return; }
    let cancelled = false;
    scanCases(PUZZLE, SET_SLUG[kind], file.cases, { shouldCancel: () => cancelled })
      .then(fails => {
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const f of fails) {
          if (f.caseObj.id == null) continue;
          m.set(`${f.caseObj.id}:${f.oriIdx}:${f.algIdx}`, f.reason);
        }
        setInvalidAlgs(m);
      })
      .catch(e => console.warn('[3bld/comm] validation scan failed', e));
    return () => { cancelled = true; };
  }, [isAdmin, file, kind]);

  const invalidIds = useMemo(() => {
    const s = new Set<number>();
    for (const k of invalidAlgs.keys()) s.add(Number(k.split(':', 1)[0]));
    return s;
  }, [invalidAlgs]);

  // 筛选:字母对 / 任意一条公式 / 联想词(子串,大小写不敏感)。"ad" 也能找到 "AD"。
  const shown = useMemo(() => {
    const all = file?.cases ?? [];
    const q = query.trim();
    if (!q) return all;
    const qUpper = q.toUpperCase();
    const qLower = q.toLowerCase();
    return all.filter(c => {
      if (c.name.includes(qUpper)) return true;
      if (c.algs.some(ori => ori.some(a => a.alg.toLowerCase().includes(qLower)))) return true;
      const word = assoc[c.name];
      return word ? word.toLowerCase().includes(qLower) : false;
    });
  }, [file, query, assoc]);

  const selectedCase = useMemo(
    () => (selected ? (file?.cases.find(c => c.name === selected) ?? null) : null),
    [file, selected],
  );

  // 切换块类型 / 数据重载后,选中项还在才留着。
  useEffect(() => {
    if (selected && file && !file.cases.some(c => c.name === selected)) setSelected(null);
  }, [file, selected]);

  // dnd-kit:按住超过 5px 才认作 drag,普通点击不被吞。
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /**
   * 一个 case 内部重排公式 —— 第一条是主推解法,顺序有意义。
   * 乐观更新,失败回滚(和 AlgCategoryView 同一套路)。
   */
  const handleAlgDragEnd = (c: AlgCase) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || c.id == null) return;
    const idxOf = (id: string | number) => Number(String(id).split('-').pop());
    const from = idxOf(active.id);
    const to = idxOf(over.id);
    const rows = c.algs[0] ?? [];
    const sane = (n: number) => Number.isInteger(n) && n >= 0 && n < rows.length;
    if (!sane(from) || !sane(to)) return;

    const before = c.algs;
    const after = c.algs.map((ori, i) => (i === 0 ? arrayMove(ori, from, to) : ori));
    const swap = (algs: AlgCase['algs']) =>
      patchCases(kind, cs => cs.map(x => (x.id === c.id ? { ...x, algs } : x)));

    swap(after);
    reorderCaseAlgs(PUZZLE, SET_SLUG[kind], c, after).catch((err: Error) => {
      console.error('reorder algs failed', err);
      alert(`Reorder failed: ${err.message}`);
      swap(before);
    });
  };

  const kindLabel = (k: Kind) =>
    k === 'corner'
      ? tr({ zh: '角块', en: 'Corner' })
      : tr({ zh: '棱块', en: 'Edge' });

  const selAssoc = selected ? assoc[selected] : undefined;
  const selFirstAlg = selectedCase?.algs[0]?.[0]?.alg ?? '';

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{tr({ zh: '3BLD 公式库', en: '3BLD Commutator Library' })}</h1>
      </div>

      <p className="bld-input-summary">
        {tr({
          zh: '角块 / 棱块换法公式库,每条公式在还原态魔方上即一组三循环。点选可交互播放,带中文联想词作记忆提示。',
          en: 'Corner / edge commutator dictionary — each alg is a 3-cycle on a solved cube. Tap a pair to scrub it interactively; Chinese association words shown as a memory hint where available.',
        })}
      </p>

      {/* ── toolbar: kind toggle + search ── */}
      <div className="bld-comm-toolbar">
        <div className="bld-seg" role="tablist" aria-label={tr({ zh: '块类型', en: 'Piece type' })}>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'corner'}
            className={`bld-seg-btn${kind === 'corner' ? ' is-on' : ''}`}
            onClick={() => setKind('corner')}
          >
            <Boxes size={15} />
            {kindLabel('corner')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'edge'}
            className={`bld-seg-btn${kind === 'edge' ? ' is-on' : ''}`}
            onClick={() => setKind('edge')}
          >
            <Square size={15} />
            {kindLabel('edge')}
          </button>
        </div>

        <div className="bld-comm-search-wrap">
          <span className="bld-comm-search-icon">
            <Search size={15} />
          </span>
          <input
            className="bld-comm-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr({ zh: '搜索编码 / 公式 / 联想词', en: 'Search pair / alg / word' })}
            spellCheck={false}
            autoComplete="off"
            aria-label={tr({ zh: '搜索', en: 'Search' })}
          />
          {query && (
            <ClearButton isZh={isZh} onClick={() => setQuery('')} preserveFocus />
          )}
        </div>

        {/* 与全站 case 列表共用同一个偏好(alg-list-view),但这页没有图,
            所以不套 AlgViewModeToggle 的「图 / 公式」字样。 */}
        <PillToggle
          value={showAlgs}
          onChange={(on) => changeView(on ? 'full' : 'cards')}
          offLabel={tr({ zh: '编码', en: 'Letters' })}
          onLabel={tr({ zh: '公式', en: 'Algs' })}
          ariaLabel={tr({ zh: '切换只看编码 / 看公式', en: 'Toggle letters-only / show algs' })}
        />

        <span className="bld-comm-count">
          {loading
            ? tr({ zh: '加载中…', en: 'Loading…' })
            : tr({ zh: `${shown.length} 组`, en: `${shown.length}` })}
        </span>

        {/* 打印用的字母对字典:不出图(818 张缩略图对认编码没用),中文联想词跟着印 */}
        {file && shown.length > 0 && (
          <AlgPdfButton
            build={() => algSheetFromCases({
              puzzle: PUZZLE,
              set: SET_SLUG[kind],
              cases: shown,
              title: tr({
                zh: `3BLD ${kindLabel(kind)}换位子`,
                en: `3BLD ${kind} commutators`,
              }),
              sourcePath: '/alg/3bld/comm',
              filename: `3bld-comm-${kind}`,
              rawAlg: true,   // 收尾 AUF 不能剥 —— 见文件头注
              thumbs: false,
              setups: false,
              subOf: (c) => assoc[c.name],
            })}
          />
        )}

        {/* 校验作用在**当前这一套**上;报告里点失败项由本页的编辑器接管(免两份叠着) */}
        {isAdmin && file && (
          <AlgAdminValidate
            scope={{ kind: 'set', puzzle: PUZZLE, set: SET_SLUG[kind] }}
            onPickCase={(_p, _s, c) => setEditorState({ mode: 'edit', existing: c })}
          />
        )}
      </div>

      {/* ── focused pair (interactive playback) ── */}
      {selectedCase && (
        <div className="bld-comm-focus">
          <div className="bld-comm-focus-cube">
            <div className="bld-cube-wrap">
              {/* case 态起手 + 公式当 alg ⟹ 拖进度条就是「这条换位子怎么解掉它」 */}
              <AlgPlayer
                puzzle={PUZZLE}
                set={SET_SLUG[kind]}
                setup={selectedCase.setup}
                alg={selFirstAlg}
                size={300}
              />
            </div>
          </div>

          <div className="bld-comm-focus-info">
            <div className="bld-comm-focus-pair">
              <span className="bld-comm-focus-letters">{selectedCase.name}</span>
              <span className="bld-comm-kind-tag">{kindLabel(kind)}</span>
              {isAdmin && selectedCase.id != null && (
                <button
                  type="button"
                  className="alg-admin-edit-btn"
                  onClick={() => setEditorState({ mode: 'edit', existing: selectedCase })}
                  title={tr({ zh: '编辑 case (admin)', en: 'Edit case (admin)' })}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>

            <div>
              <div className="bld-comm-alg-label">{tr({ zh: '公式', en: 'Algorithm' })}</div>
              <div className="bld-comm-alg-list">
              {(() => {
                const rows = (selectedCase.algs[0] ?? []).map((entry, i) => {
                  const row = (
                    <CommAlgRow
                      entry={entry}
                      invalid={selectedCase.id != null ? invalidAlgs.get(`${selectedCase.id}:0:${i}`) : undefined}
                    />
                  );
                  const key = `${entry.altId ?? ''}::${i}`;
                  return isAdmin && selectedCase.id != null
                    ? <SortableAlgRow key={key} id={algDragId(selectedCase.id, i)} draggable>{row}</SortableAlgRow>
                    : <div key={key}>{row}</div>;
                });
                if (!(isAdmin && selectedCase.id != null)) return rows;
                return (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAlgDragEnd(selectedCase)}>
                    <SortableContext
                      items={(selectedCase.algs[0] ?? []).map((_, i) => algDragId(selectedCase.id!, i))}
                      strategy={verticalListSortingStrategy}
                    >
                      {rows}
                    </SortableContext>
                  </DndContext>
                );
              })()}
              </div>
            </div>

            {selAssoc && (
              <div className="bld-comm-assoc">
                <span className="bld-comm-assoc-icon">
                  <Lightbulb size={16} />
                </span>
                <span className="bld-comm-assoc-text">
                  {selAssoc}
                  {!isZh && (
                    <span className="bld-comm-alg-label"> (memory hint, zh)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── grid of all (filtered) pairs ── */}
      <div className="bld-comm-grid">
        {error ? (
          <div className="bld-comm-empty">{error}</div>
        ) : loading ? (
          <div className="bld-comm-empty">
            <Spinner size={18} label={tr({ zh: '加载中', en: 'Loading' })} />
          </div>
        ) : shown.length === 0 ? (
          <div className="bld-comm-empty">
            {tr({ zh: '无匹配公式', en: 'No matching algs' })}
          </div>
        ) : (
          shown.map((c) => {
            const word = assoc[c.name];
            const bad = c.id != null && invalidIds.has(c.id);
            return (
              <div key={c.id ?? c.name} className="bld-comm-card-wrap">
                <button
                  type="button"
                  className={`bld-comm-card${selected === c.name ? ' is-active' : ''}${bad ? ' is-invalid' : ''}`}
                  onClick={() => setSelected(c.name)}
                  title={bad ? tr({ zh: '这个 case 有公式校验不通过', en: 'This case has failing algs' }) : undefined}
                >
                  {/* 盲拧按编码认 case,不看图 —— 这里不出缩略图(点开有可交互播放) */}
                  <span className="bld-comm-card-head">
                    <span className="bld-comm-card-pair">{c.name}</span>
                  </span>
                  {showAlgs && <span className="bld-comm-card-alg">{c.algs[0]?.[0]?.alg}</span>}
                  {showAlgs && word && <span className="bld-comm-card-assoc">{word}</span>}
                </button>
                {isAdmin && c.id != null && (
                  <button
                    type="button"
                    className="alg-admin-edit-btn alg-admin-edit-btn-corner"
                    onClick={() => setEditorState({ mode: 'edit', existing: c })}
                    title={tr({ zh: '编辑 case (admin)', en: 'Edit case (admin)' })}
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {editorState && (
        <AdminCaseEditor
          puzzle={PUZZLE}
          setSlug={SET_SLUG[kind]}
          state={editorState}
          onClose={() => setEditorState(null)}
          onSaved={(action) => {
            if (action.type === 'add') {
              patchCases(kind, cs => [...cs, action.created]);
            } else if (action.type === 'update') {
              patchCases(kind, cs => cs.map(c => (c.id === action.updated.id ? action.updated : c)));
              // 改名了就把选中项跟过去,否则焦点面板会因为找不到旧名字直接消失
              if (editorState.mode === 'edit' && selected === editorState.existing.name) {
                setSelected(action.updated.name);
              }
            } else {
              patchCases(kind, cs => cs.filter(c => c.id !== action.id));
              if (editorState.mode === 'edit' && selected === editorState.existing.name) setSelected(null);
            }
          }}
        />
      )}
    </div>
  );
}
