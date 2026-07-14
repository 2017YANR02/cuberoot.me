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
import { useQueryState, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Shuffle, Plus, Pencil, ShieldCheck, GripVertical, Flag, Info } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  loadAlg, getAlgSetMeta, ALG_PUZZLES,
  type AlgCase, type AlgEntry, type AlgFile, type AlgPuzzle, type AlgSubmission, type AlgTag,
} from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { CaseThumb } from '@/components/CaseThumb';
import CommunityAlgs from '@/components/CommunityAlgs';
import AdminCaseEditor, { type AdminEditorState } from '@/components/AdminCaseEditor';
import ValidationReportModal from '@/components/ValidationReportModal';
import AlgCaseMetaModal from '@/components/AlgCaseMetaModal';
import AlgPlayer from '@/components/AlgPlayer';
import { useCopy } from '@/hooks/useCopy';
import { stm } from '@cuberoot/shared/alg-notation';
import { listSubmissions } from '@/lib/alg_api';
import { reorderCases } from '@/lib/alg_sets_api';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { displayAlgCaseName, primaryCaseName, renameZbllGroupToken } from '@/lib/alg_case_display';
import { displayAlg } from '@/lib/alg_display';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';

/** 公式标签(站长 1LLL 表的 `[oh]` 等)。语义见 docs/1lll-migration.md §表里实际出现的形态。 */
const ALG_TAG_LABEL: Record<AlgTag, () => string> = {
  oh: () => tr({ zh: '单手', en: 'OH' }),
  ft: () => tr({ zh: '脚拧', en: 'Feet' }),
  fmc: () => tr({ zh: '最少步', en: 'FMC' }),
  big: () => tr({ zh: '高阶', en: 'Big cube' }),
  key: () => tr({ zh: '键盘', en: 'Keyboard' }),
};
const ALG_TAGS = Object.keys(ALG_TAG_LABEL) as AlgTag[];

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

function AlgRow({ entry, expanded, onToggle, animatable, puzzle, set, setup }: { entry: AlgEntry; expanded: boolean; onToggle: () => void; animatable: boolean; puzzle: AlgPuzzle; set: string; setup?: string }) {
  const { alg, algHtml } = entry;
  const { copied, copy } = useCopy();
  // 显示 / 复制都剥掉收尾 AUF;下面的 AlgPlayer 拿的仍是完整公式,动画才停在还原态。
  const algShown = formatScrambleForEvent(puzzle, displayAlg(alg));
  // 步数要数**屏幕上这一条**。`entry.stm` 是入库值(含收尾 AUF),拿它当徽章就会
  // 出现「显示 10 步、徽章写 11」。
  const shownStm = useMemo(() => (entry.stm == null ? null : stm(displayAlg(alg))), [entry.stm, alg]);
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
        {entry.tags?.map(t => (
          <span key={t} className={`alg-tag alg-tag-${t}`} title={ALG_TAG_LABEL[t]()}>{ALG_TAG_LABEL[t]()}</span>
        ))}
        {algHtml && puzzle !== 'sq1'
          ? <span className="alg-alg-text" dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(algHtml) }} />
          : <span className="alg-alg-text">{algShown}</span>}
        {shownStm != null && <span className="alg-alg-len" title="STM">{shownStm}</span>}
        <button
          type="button"
          className="alg-alg-copy-btn"
          onClick={(e) => { e.stopPropagation(); copy(algShown); }}
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
  puzzle, set, cases, ollByGroup,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  /** 组号 → 字母制 OLL 名。**校验过是单射才非空**(见主组件里的 ollByGroup)。 */
  ollByGroup: Map<string, string>;
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
        // 1lll 的组号是纯数字(`06`),没人看得懂 —— 换成字母制 OLL 名,数字降为副名。
        const ollName = ollByGroup.get(topLabel);
        return (
          <Link
            key={topLabel || '_root_'}
            href={`/alg/${puzzle}/${set}/${slug}`}
            className="alg-subgroup-card"
          >
            <div className="alg-subgroup-thumb">
              {useF2lThumb
                ? <CaseThumb puzzle={puzzle} set={set} sticker={sample.sticker} alg={firstAlg} setup={sample.setup} size={110} />
                : <VisualCube setup={sample.setup} algorithm={firstAlg} view="oll" size={120} />}
            </div>
            <div className="alg-subgroup-card-title">
              {ollName ?? (useF2lThumb ? (dispTop || tr({ zh: '其他', en: 'Other' })) : `${set.toUpperCase()} ${dispTop || tr({ zh: '其他', en: 'Other' })}`)}
            </div>
            <div className="alg-subgroup-card-count">
              {ollName && <span className="alg-subgroup-card-sub">{set.toUpperCase()} {dispTop}</span>}
              {count} {tr({ zh: '个', en: 'cases' })}
            </div>
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
  const [metaCase, setMetaCase] = useState<AlgCase | null>(null);
  // 筛选 → replace(不往历史里塞;CLAUDE.md「URL 状态」)
  const [tagFilter, setTagFilter] = useQueryState('tag', parseAsStringEnum<AlgTag | 'all'>(['all', ...ALG_TAGS]).withDefault('all'));
  const animatable = true;

  /** 这个 set 里实际出现过的标签 —— 没有就不渲染筛选器 */
  const availableTags = useMemo(() => {
    if (!data) return [];
    const seen = new Set<AlgTag>();
    for (const c of data.cases) for (const ori of c.algs) for (const a of ori) for (const t of a.tags ?? []) seen.add(t);
    return ALG_TAGS.filter(t => seen.has(t));
  }, [data]);

  /**
   * 组号 → 字母制 OLL 名(1lll:`06` → `O-`)。
   *
   * ⚠ 只有当这是个**单射**时才用得上 —— 光「组内唯一」不够。pll 每个 case 的 `meta.oll`
   * 都是常量 `"PLL"`,照那样贴标题,`Adj Swap` / `Diag Swap` / `EPLL` 三个组会全变成 `PLL`。
   * (我只在 1lll 上验了组内唯一就推广,pll 立刻被打脸。)组间撞名 ⟹ 整个 set 退回原组名。
   */
  const ollByGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data?.cases ?? []) {
      const top = (c.subgroup || '').split('/', 1)[0];
      if (c.meta?.oll && !m.has(top)) m.set(top, c.meta.oll);
    }
    const injective = new Set(m.values()).size === m.size;
    return injective ? m : new Map<string, string>();
  }, [data]);

  /** meta.no → case,给弹窗的镜像 / 逆做链接(**表编号**,不是 DB id) */
  const byNo = useMemo(() => {
    const m = new Map<number, AlgCase>();
    for (const c of data?.cases ?? []) if (c.meta?.no != null) m.set(c.meta.no, c);
    return m;
  }, [data]);

  /** 一个 case 在当前筛选下要显示的公式(标签筛选作用在**公式**上,不是 case 上) */
  const algsUnderFilter = (algs: AlgEntry[]) =>
    tagFilter === 'all' || !availableTags.includes(tagFilter)
      ? algs
      : algs.filter(a => a.tags?.includes(tagFilter));

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
    const inSubgroup = !subgroupSlug ? data.cases : data.cases.filter(c => {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (slugLevel === 'top') return parts[0] === subgroupSlug;
      if (slugLevel === 'sub') return parts[1] === subgroupSlug;
      return false;
    });
    // 选了标签就只留「至少有一条带该标签的公式」的 case —— 否则筛出来一堆空卡片。
    // ⚠ 这个 set 压根没有该标签(书签 / 后退带过来的 `?tag=oh` 落到 f2l 上)⟹ 当没筛 ——
    //    否则页面空空如也,而下拉根本不渲染,用户没有任何控件能把它改回来。
    if (tagFilter === 'all' || !availableTags.includes(tagFilter)) return inSubgroup;
    return inSubgroup.filter(c => c.algs.some(ori => ori.some(a => a.tags?.includes(tagFilter))));
  }, [data, subgroupSlug, slugLevel, tagFilter, availableTags]);

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

  const dispToken = (slug: string) => {
    const oll = ollByGroup.get(slug.toUpperCase()) ?? ollByGroup.get(slug);
    if (oll) return oll;
    return set === 'zbll' ? renameZbllGroupToken(slug.toUpperCase()) : slug.toUpperCase();
  };
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
        {data && !showSubgroupPicker && availableTags.length > 0 && (
          <select
            className="alg-tag-filter"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value as AlgTag | 'all')}
            aria-label={tr({ zh: '按标签筛选公式', en: 'Filter algs by tag' })}
          >
            <option value="all">{tr({ zh: '全部公式', en: 'All algs' })}</option>
            {availableTags.map(t => <option key={t} value={t}>{ALG_TAG_LABEL[t]()}</option>)}
          </select>
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
        <SubgroupIndex puzzle={puzzleParam as AlgPuzzle} set={set} cases={data.cases} ollByGroup={ollByGroup} isZh={isZh} />
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
                {ollByGroup.get(subgroup) ?? subgroup ?? tr({ zh: '其他', en: 'Other' })}
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
                  const allAlgsForOri = c.algs[oriIdx] ?? c.algs[0] ?? [];
                  const algsForOri = algsUnderFilter(allAlgsForOri);
                  const oriCount = c.algs.length;
                  // 缩略图始终用**未筛选**的首条 —— 筛选只该影响公式列表,不该换掉 case 的图
                  const firstAlg = allAlgsForOri[0]?.alg ?? c.standard ?? '';
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
                            <span className="alg-case-letter">{primaryCaseName(puzzleParam, set, c)}</span>
                            {/* 字母制主名接管之后,站上原来那个名字(`1LLL 6 7` / `ZBLL L 34`)降为副名 —— 不丢。
                                但 PLL 的 OLLCP 名剥掉 `PLL-` 前缀后就等于站上的名字,再挂一个副名纯属重复。 */}
                            {(() => {
                              if (!c.meta?.ollcp) return null;
                              const disp = displayAlgCaseName(puzzleParam, set, c.name);
                              const primary = primaryCaseName(puzzleParam, set, c);
                              return disp.startsWith(primary) ? null : <span className="alg-case-index">{disp}</span>;
                            })()}
                            {c.number != null && <span className="alg-case-index">#{c.number}</span>}
                            {c.meta && (
                              <button
                                type="button"
                                className="alg-case-meta-btn"
                                onClick={() => setMetaCase(c)}
                                title={tr({ zh: '元数据', en: 'Metadata' })}
                              >
                                <Info size={13} />
                              </button>
                            )}
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
                              entry={entry}
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

      {metaCase?.meta && (
        <AlgCaseMetaModal
          caseObj={metaCase}
          byNo={byNo}
          onClose={() => setMetaCase(null)}
          onJump={(c) => setMetaCase(c)}
        />
      )}
    </div>
  );
}
