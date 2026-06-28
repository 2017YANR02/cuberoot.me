'use client';

/**
 * AlgCategoryView — full port of packages/client-vite/src/pages/alg/AlgCategoryPage.tsx.
 *
 * Restored (2026-06-16) to parity with the Vite version:
 *   - CommunityAlgs (logged-in users add/edit/delete their own algs per case, validated on save)
 *   - Admin tooling: AdminCaseEditor + ValidationReportModal + dnd-kit reorder (admin-gated)
 *   - AlgPlayer (cubing.js TwistyPlayer) — click an alg row to expand + play the 3D animation
 *
 * Keeps: subgroup picker (umbrella sets), second-level picker, ori switcher,
 * per-case ori cycle, subgroup collapse, sticker/setup/HTML alg rendering.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Shuffle, Plus, Pencil, ShieldCheck, GripVertical, Flag } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  loadAlg, getAlgSetMeta, ALG_PUZZLES,
  type AlgCase, type AlgFile, type AlgPuzzle, type AlgSubmission,
} from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { CaseThumb } from '@/components/CaseThumb';
import CommunityAlgs from '@/components/CommunityAlgs';
import AdminCaseEditor, { type AdminEditorState } from '@/components/AdminCaseEditor';
import ValidationReportModal from '@/components/ValidationReportModal';
import AlgPlayer from '@/components/AlgPlayer';
import { listSubmissions } from '@/lib/alg_api';
import { reorderCases } from '@/lib/alg_sets_api';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { displayAlgCaseName, renameZbllGroupToken } from '@/lib/alg_case_display';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';

const ORI_SUFFIX = ['', 'y', 'y2', "y'"];
function oriAdjustSetup(setup: string, oriIdx: number): string {
  if (!setup || oriIdx === 0) return setup;
  return `${setup} ${ORI_SUFFIX[oriIdx]}`;
}

function shortOriName(name: string): string {
  const map: Record<string, string> = {
    'Front Right': 'FR', 'Front Left': 'FL', 'Back Left': 'BL', 'Back Right': 'BR',
  };
  return map[name] ?? name;
}

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

const ALG_HTML_TAG_WHITELIST = new Set(['u', 's', 'em', 'strong', 'sub', 'sup']);
function sanitizeAlgHtml(html: string): string {
  return html.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (_full, slash, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALG_HTML_TAG_WHITELIST.has(t)) return '';
    if (slash) return `</${t}>`;
    if (t === 'u' && /\bclass\s*=\s*["']?wavy["']?/i.test(attrs)) return '<u class="wavy">';
    return `<${t}>`;
  });
}

function AlgRow({ alg, algHtml, expanded, onToggle, animatable, puzzle, set, setup }: { alg: string; algHtml?: string; expanded: boolean; onToggle: () => void; animatable: boolean; puzzle: AlgPuzzle; set: string; setup?: string }) {
  const [copied, setCopied] = useState(false);
  const algShown = formatScrambleForEvent(puzzle, alg);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`alg-alg-row${expanded ? ' is-expanded' : ''}`}
        onClick={animatable ? onToggle : undefined}
        onKeyDown={(e) => {
          if (animatable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggle();
          }
        }}
        title={animatable ? (expanded ? 'collapse' : 'play') : 'copy'}
      >
        {algHtml && puzzle !== 'sq1'
          ? <span className="alg-alg-text" dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(algHtml) }} />
          : <span className="alg-alg-text">{algShown}</span>}
        <button
          type="button"
          className="alg-alg-copy-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(algShown).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
          title="copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
        </button>
      </div>
      {expanded && animatable && <AlgPlayer alg={alg} puzzle={puzzle} set={set} setup={setup} />}
    </>
  );
}

/** dnd-kit sortable wrapper:admin 模式下渲染拖动 handle,普通模式下退化成裸 div */
function SortableCaseCard({ id, draggable, children }: { id: number; draggable: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    height: '100%',
  };
  return (
    <div ref={setNodeRef} style={style}>
      {draggable && (
        <button
          type="button"
          className="alg-case-drag-handle"
          {...attributes}
          {...listeners}
          title="drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      )}
      {children}
    </div>
  );
}

function SubgroupIndex({
  puzzle, set, cases,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  isZh: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { sample: AlgCase; count: number }>();
    for (const c of cases) {
      const top = (c.subgroup || '').split('/', 1)[0];
      const existing = map.get(top);
      if (existing) existing.count++;
      else map.set(top, { sample: c, count: 1 });
    }
    return Array.from(map.entries());
  }, [cases]);

  const useF2lThumb = puzzle === '3x3' && set === 'zbls';

  return (
    <div className={`alg-subgroup-grid${useF2lThumb ? ' is-f2l-thumb' : ''}`}>
      {groups.map(([topLabel, { sample, count }]) => {
        const firstAlg = sample.algs.flat()[0]?.alg ?? sample.standard ?? '';
        const slug = encodeURIComponent(topLabel.toLowerCase()) || '_'; // slug 用原名(避免 "+" 进 URL)
        const dispTop = set === 'zbll' ? renameZbllGroupToken(topLabel) : topLabel; // 展示名:ZBLL S→S+, AS→S-
        return (
          <Link
            key={topLabel || '_root_'}
            href={`/alg/${puzzle}/${set}/${slug}`}
            className="alg-subgroup-card"
          >
            <div className="alg-subgroup-thumb">
              {useF2lThumb
                ? <CaseThumb puzzle={puzzle} set={set} sticker={sample.sticker} alg={firstAlg} setup={sample.setup} size={110} />
                : <VisualCube algorithm={firstAlg} view="oll" size={120} />}
            </div>
            <div className="alg-subgroup-card-title">{useF2lThumb ? (dispTop || tr({ zh: '其他', en: 'Other' })) : `${set.toUpperCase()} ${dispTop || tr({ zh: '其他', en: 'Other' })}`}</div>
            <div className="alg-subgroup-card-count">{count} {tr({ zh: '个', en: 'cases'
            })}</div>
          </Link>
        );
      })}
    </div>
  );
}

export interface AlgCategoryViewProps {
  puzzleParam: string;
  set: string;
  subgroupParam?: string;
}

export default function AlgCategoryView({ puzzleParam, set, subgroupParam }: AlgCategoryViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const validPuzzle = isPuzzle(puzzleParam);
  const meta = validPuzzle ? getAlgSetMeta(puzzleParam, set) : undefined;
  const algSetTitle = (() => {
    const fallback = tr({ zh: '公式库', en: 'Algorithms'
    });
    if (!puzzleParam || !set) return fallback;
    const setName = meta ? tr(meta) : set;
    return `${puzzleParam} · ${setName}`;
  })();
  useDocumentTitle(algSetTitle, algSetTitle);
  const [data, setData] = useState<AlgFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOri, setActiveOri] = useState(0);
  const [caseOri, setCaseOri] = useState<Record<string, number>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<AlgSubmission[]>([]);
  const user = useAuthStore(s => s.user);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
  const [editorState, setEditorState] = useState<AdminEditorState | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationRefreshKey, setValidationRefreshKey] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const animatable = true;

  // dnd-kit sensors:鼠标按住超过 5px 才认作 drag,避免误触发(普通点击不被吞)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!data) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const all = data.cases;
    const oldIdx = all.findIndex(c => c.id === Number(active.id));
    const newIdx = all.findIndex(c => c.id === Number(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(all, oldIdx, newIdx);
    setData({ ...data, cases: reordered });
    const ids = reordered.map(c => c.id).filter((x): x is number => typeof x === 'number');
    reorderCases(puzzleParam, set, ids).catch(err => {
      console.error('reorder failed', err);
      alert(`Reorder failed: ${err.message}`);
      setData(d => d ? { ...d, cases: all } : d);
    });
  };

  useEffect(() => {
    if (!validPuzzle || !meta) return;
    listSubmissions(puzzleParam, set)
      .then(setSubmissions)
      .catch(e => { console.warn('[alg] failed to load submissions', e); setSubmissions([]); });
  }, [puzzleParam, set, validPuzzle, meta]);

  const submissionsByCase = useMemo(() => {
    const map = new Map<string, AlgSubmission[]>();
    for (const s of submissions) {
      const arr = map.get(s.caseName) ?? [];
      arr.push(s);
      map.set(s.caseName, arr);
    }
    return map;
  }, [submissions]);

  useEffect(() => {
    if (!validPuzzle || !meta) { setError('unknown set'); setData(null); return; }
    setError(null);
    setData(null);
    loadAlg(puzzleParam, set).then(d => {
      setData(d);
      if (d.cases.length > 100 && !meta.umbrella) {
        const groups = new Set<string>();
        for (const c of d.cases) groups.add(c.subgroup || '');
        setCollapsedGroups(groups);
      } else {
        setCollapsedGroups(new Set());
      }
    }).catch(e => setError(String(e)));
  }, [puzzleParam, set, validPuzzle, meta]);

  const subgroupSlug = subgroupParam ? decodeURIComponent(subgroupParam).toLowerCase() : null;
  const slugLevel: 'top' | 'sub' | null = useMemo(() => {
    if (!subgroupSlug || !data) return null;
    for (const c of data.cases) {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (parts[0] === subgroupSlug) return 'top';
      if (parts[1] === subgroupSlug) return 'sub';
    }
    return null;
  }, [data, subgroupSlug]);

  const subParentSlug = useMemo(() => {
    if (!data || slugLevel !== 'sub' || !subgroupSlug) return null;
    for (const c of data.cases) {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (parts[1] === subgroupSlug) return parts[0];
    }
    return null;
  }, [data, slugLevel, subgroupSlug]);

  const visibleCases = useMemo(() => {
    if (!data) return [];
    if (!subgroupSlug) return data.cases;
    return data.cases.filter(c => {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (slugLevel === 'top') return parts[0] === subgroupSlug;
      if (slugLevel === 'sub') return parts[1] === subgroupSlug;
      return false;
    });
  }, [data, subgroupSlug, slugLevel]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleCases>();
    for (const c of visibleCases) {
      const key = c.subgroup || '';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visibleCases]);

  if (!validPuzzle || !meta) {
    return <div className="alg-root"><div className="alg-empty">Unknown set: {puzzleParam}/{set}</div></div>;
  }

  const showSubgroupPicker = !!meta.umbrella && !subgroupParam;

  const subSubgroups = useMemo(() => {
    if (!meta.umbrella || slugLevel !== 'top') return [];
    const map = new Map<string, { sample: AlgCase; count: number }>();
    for (const c of visibleCases) {
      const parts = (c.subgroup || '').split('/');
      if (parts.length < 2) continue;
      const sub = parts[1];
      const e = map.get(sub);
      if (e) e.count++;
      else map.set(sub, { sample: c, count: 1 });
    }
    return Array.from(map.entries());
  }, [visibleCases, slugLevel, meta.umbrella]);
  const showSubSubgroupPicker = subSubgroups.length > 1;

  const backTo = slugLevel === 'sub' && subParentSlug
    ? `/alg/${puzzleParam}/${set}/${subParentSlug}`
    : subgroupParam
      ? `/alg/${puzzleParam}/${set}`
      : `/alg/${puzzleParam}`;

  const dispToken = (slug: string) => set === 'zbll' ? renameZbllGroupToken(slug.toUpperCase()) : slug.toUpperCase();
  const subgroupDisplay = (
    slugLevel === 'sub' && subParentSlug && subgroupSlug
      ? `${dispToken(subParentSlug)} · ${dispToken(subgroupSlug)}`
      : subgroupSlug
        ? dispToken(subgroupSlug)
        : ''
  );

  const toggleGroup = (g: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href={backTo} className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <h1 className="alg-cat-title">
          <span className="alg-cat-puzzle">{puzzleParam}</span>
          {' '}
          {tr(meta)}
          {subgroupDisplay && <span className="alg-cat-subgroup"> {subgroupDisplay}</span>}
        </h1>
        {data && !showSubgroupPicker && (
          <span className="alg-cat-count">{visibleCases.length} {tr({ zh: '个', en: 'cases'
        })}</span>
        )}
        {data && !showSubgroupPicker && (
          <Link href={`/alg/${puzzleParam}/${set}/select`} className="alg-train-cta" prefetch={false}>
            <Flag size={14} /> {tr({ zh: '开始训练', en: 'Train' })}
          </Link>
        )}
        {isAdmin && data && !showSubgroupPicker && (
          <>
            <button
              type="button"
              className="alg-admin-add-btn"
              onClick={() => setEditorState({ mode: 'add' })}
              title={tr({ zh: '新增 case (admin)', en: 'Add case (admin)' })}
            >
              <Plus size={14} /> {tr({ zh: '新增 case', en: 'Add case' })}
            </button>
            <button
              type="button"
              className="alg-admin-add-btn"
              onClick={() => setValidationOpen(true)}
              title={tr({ zh: '校验此 set 所有公式', en: 'Validate this set' })}
            >
              <ShieldCheck size={14} /> {tr({ zh: '校验', en: 'Validate' })}
            </button>
          </>
        )}
      </div>

      {data && !showSubgroupPicker && (() => {
        const oriNames = data.cases[0]?.oriNames;
        if (!oriNames || oriNames.length <= 1) return null;
        return (
          <div className="alg-ori-tabs alg-ori-tabs-global">
            {oriNames.map((name, i) => (
              <button
                key={i}
                type="button"
                className={`alg-ori-tab${activeOri === i ? ' is-active' : ''}`}
                onClick={() => { setActiveOri(i); setCaseOri({}); }}
              >
                {shortOriName(name)}
              </button>
            ))}
          </div>
        );
      })()}

      {error && <div className="alg-empty">{error}</div>}
      {!data && !error && <div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…'
    })}</div>}

      {data && showSubgroupPicker && (
        <SubgroupIndex puzzle={puzzleParam as AlgPuzzle} set={set} cases={data.cases} isZh={isZh} />
      )}

      {data && showSubSubgroupPicker && (() => {
        const LEVEL2_PICKER_MASK: Record<string, string> = {
          zbll: 'coll', '1lll': 'coll', ollcp: 'coll',
        };
        const pickerMask = LEVEL2_PICKER_MASK[set];
        return (
          <div className="alg-subgroup-grid">
            {subSubgroups.map(([subLabel, { sample, count }]) => {
              const firstAlg = sample.algs.flat()[0]?.alg ?? sample.standard ?? '';
              const sub2Slug = encodeURIComponent(subLabel.toLowerCase());
              return (
                <Link
                  key={subLabel}
                  href={`/alg/${puzzleParam}/${set}/${sub2Slug}`}
                  className="alg-subgroup-card"
                >
                  <div className="alg-subgroup-thumb">
                    <CaseThumb
                      puzzle={puzzleParam as AlgPuzzle}
                      set={set}
                      sticker={sample.sticker}
                      alg={firstAlg}
                      setup={sample.setup}
                      size={120}
                      mask={pickerMask}
                    />
                  </div>
                  <div className="alg-subgroup-card-title">{set === 'zbll' ? renameZbllGroupToken(subLabel) : subLabel}</div>
                  <div className="alg-subgroup-card-count">{count} {tr({ zh: '个', en: 'cases'
                })}</div>
                </Link>
              );
            })}
          </div>
        );
      })()}

      {data && !showSubgroupPicker && !showSubSubgroupPicker && grouped.map(([subgroup, cases]) => {
        const collapsed = collapsedGroups.has(subgroup);
        const showHeader = !subgroupParam && (grouped.length > 1 || subgroup !== '');
        return (
          <section key={subgroup || '_root_'} className="alg-subgroup">
            {showHeader && (
              <h2
                className="alg-subgroup-title is-toggleable"
                onClick={() => toggleGroup(subgroup)}
                role="button"
                tabIndex={0}
              >
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {subgroup || tr({ zh: '其他', en: 'Other' })}
                <span className="alg-subgroup-count">{cases.length}</span>
              </h2>
            )}
            {!collapsed && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={cases.map(c => c.id).filter((x): x is number => typeof x === 'number')}
                  strategy={rectSortingStrategy}
                >
              <div className="alg-case-list">
                {cases.map(c => {
                  const rawOri = caseOri[c.name] ?? activeOri;
                  const oriIdx = rawOri < c.algs.length ? rawOri : 0;
                  const algsForOri = c.algs[oriIdx] ?? c.algs[0] ?? [];
                  const oriCount = c.algs.length;
                  const firstAlg = algsForOri[0]?.alg ?? c.standard ?? '';
                  return (
                    <SortableCaseCard key={c.id ?? c.name} id={c.id ?? 0} draggable={isAdmin && c.id != null}>
                    <article className="alg-case">
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
                      <div className="alg-case-head">
                        <div className="alg-case-cube">
                          <CaseThumb
                            puzzle={puzzleParam as AlgPuzzle}
                            set={set}
                            sticker={c.sticker}
                            alg={firstAlg || c.setup || ''}
                            setup={oriAdjustSetup(c.setup, oriIdx)}
                          />
                        </div>
                        <div className="alg-case-info">
                          <div className="alg-case-name">
                            <span className="alg-case-letter">{displayAlgCaseName(puzzleParam, set, c.name)}</span>
                            {c.number != null && <span className="alg-case-index">#{c.number}</span>}
                            {oriCount > 1 && (
                              <button
                                type="button"
                                className="alg-case-y-btn"
                                onClick={() => setCaseOri(prev => ({ ...prev, [c.name]: (oriIdx + 1) % oriCount }))}
                                title={`${shortOriName(c.oriNames?.[oriIdx] ?? '')} → ${shortOriName(c.oriNames?.[(oriIdx + 1) % oriCount] ?? '')}`}
                              >
                                y
                                <span className="alg-case-y-current">{shortOriName(c.oriNames?.[oriIdx] ?? '')}</span>
                              </button>
                            )}
                          </div>
                          {c.setup && (
                            <div className="alg-case-standard">
                              <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup'
                            })} />
                              <code>{formatScrambleForEvent(puzzleParam, c.setup)}</code>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="alg-case-algs">
                        {algsForOri.map((entry, i) => {
                          const rowKey = `${c.name}::${oriIdx}::${i}`;
                          const expanded = expandedKey === rowKey;
                          return (
                            <AlgRow
                              key={`${entry.altId ?? i}`}
                              alg={entry.alg}
                              algHtml={entry.algHtml}
                              expanded={expanded}
                              onToggle={() => setExpandedKey(expanded ? null : rowKey)}
                              animatable={animatable}
                              puzzle={puzzleParam as AlgPuzzle}
                              set={set}
                              setup={oriAdjustSetup(c.setup, oriIdx)}
                            />
                          );
                        })}
                      </div>
                      <CommunityAlgs
                        puzzle={puzzleParam}
                        setSlug={set}
                        caseName={c.name}
                        sticker={c.sticker}
                        setup={c.setup}
                        submissions={submissionsByCase.get(c.name) ?? []}
                        onPatch={(action) => {
                          setSubmissions(prev => {
                            if (action.type === 'add') return [...prev, action.submission];
                            if (action.type === 'update') return prev.map(s => s.id === action.submission.id ? action.submission : s);
                            return prev.filter(s => s.id !== action.id);
                          });
                        }}
                      />
                    </article>
                    </SortableCaseCard>
                  );
                })}
              </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
        );
      })}

      {editorState && (
        <AdminCaseEditor
          puzzle={puzzleParam as AlgPuzzle}
          setSlug={set}
          state={editorState}
          onClose={() => setEditorState(null)}
          onSaved={(action) => {
            if (!data) return;
            if (action.type === 'add') {
              setData({ ...data, cases: [...data.cases, action.created] });
            } else if (action.type === 'update') {
              setData({ ...data, cases: data.cases.map(c => c.id === action.updated.id ? action.updated : c) });
            } else {
              setData({ ...data, cases: data.cases.filter(c => c.id !== action.id) });
            }
            // 校验报告打开时,case saved 后让它重跑刷新结果
            if (validationOpen) setValidationRefreshKey(k => k + 1);
          }}
        />
      )}

      {validationOpen && (
        <ValidationReportModal
          scope={{ kind: 'set', puzzle: puzzleParam as AlgPuzzle, set }}
          onClose={() => setValidationOpen(false)}
          onPickCase={(_p, _s, c) => setEditorState({ mode: 'edit', existing: c })}
          refreshKey={validationRefreshKey}
        />
      )}
    </div>
  );
}
