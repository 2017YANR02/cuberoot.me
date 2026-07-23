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
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Shuffle, Plus, Pencil, ShieldCheck, GripVertical, AlertTriangle } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  loadAlg, getAlgSetMeta, ALG_PUZZLES,
  type AlgCase, type AlgEntry, type AlgFile, type AlgPuzzle, type AlgSubmission, type AlgTag,
} from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { CaseThumb } from '@/components/CaseThumb';
import CommunityAlgs from '@/components/CommunityAlgs';
import AdminCaseEditor, { type AdminEditorState } from '@/components/AdminCaseEditor';
import type { AlgInvalidMark } from '@/components/AlgEditor';
import ValidationReportModal from '@/components/ValidationReportModal';
import AlgPlayer from '@/components/AlgPlayer';
import { useCopy } from '@/hooks/useCopy';
import { stm } from '@cuberoot/shared/alg-notation';
import { listSubmissions } from '@/lib/alg_api';
import { reorderCases, reorderCaseAlgs } from '@/lib/alg_sets_api';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { scanCases } from '@/lib/alg_validation_scan';
import { caseAnchor, findCaseByHash, algCaseDetailHref, buildCaseSlugMap, caseSlugBase } from '@/lib/alg_case_link';
import { replaceHash } from '@/lib/url_hash';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { displayAlgCaseName, primaryCaseName, displayZbllToken } from '@/lib/alg_case_display';
import { canonicalZbllSubgroupSlug } from '@/lib/alg_zbll_subgroups';
import { ALG_TAG_LABEL, ALG_TAGS } from '@/lib/alg_tags';
import { displayAlg } from '@/lib/alg_display';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useHashHighlight } from '@/hooks/useHashHighlight';
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

/** 打乱行。复制的是**屏幕上这一条**(sq1 之类会重排格式),不是库里的原文。 */
function SetupLine({ puzzle, setup }: { puzzle: string; setup: string }) {
  const { copied, copy } = useCopy();
  const text = formatScrambleForEvent(puzzle, setup);
  return (
    <div className="alg-case-standard">
      <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup' })} />
      <code>{text}</code>
      <button
        type="button"
        className="alg-alg-copy-btn alg-case-setup-copy"
        onClick={() => copy(text)}
        title={tr({ zh: '复制打乱', en: 'Copy setup' })}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function AlgRow({ entry, expanded, onToggle, animatable, puzzle, set, setup, invalid }: { entry: AlgEntry; expanded: boolean; onToggle: () => void; animatable: boolean; puzzle: AlgPuzzle; set: string; setup?: string; invalid?: string }) {
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
        className={`alg-alg-row${expanded ? ' is-expanded' : ''}${invalid ? ' is-invalid' : ''}`}
        onClick={animatable ? onToggle : undefined}
        onKeyDown={(e) => {
          if (animatable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggle();
          }
        }}
        title={invalid ?? (animatable ? (expanded ? 'collapse' : 'play') : 'copy')}
      >
        {/* 就是这条过不了校验 —— 卡片红框只说「这张有问题」,不说是哪条 */}
        {invalid && <AlertTriangle size={13} className="alg-alg-invalid-icon" aria-label={invalid} />}
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

/**
 * 一条公式的 sortable 外壳(admin 才拖得动)。
 *
 * handle 单独一个 —— 整行是「点了播放动画」的 role=button,不能拿它当拖把。
 * 内层 DndContext 嵌在 case 那层里:外层的 listeners 只挂在卡片的 grip 上,两边不打架。
 */
function SortableAlgRow({ id, draggable, children }: { id: string; draggable: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} className={draggable ? 'alg-alg-sortable' : undefined}>
      {draggable && (
        <button
          type="button"
          className="alg-alg-drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title={tr({ zh: '拖动调整公式顺序', en: 'Drag to reorder algs' })}
        >
          <GripVertical size={12} />
        </button>
      )}
      {children}
    </div>
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
        const dispTop = set === 'zbll' ? displayZbllToken(topLabel) : topLabel; // 展示名:ZBLL S→S+, AS→S-, Pi 保留小写 i
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
  /** 上层(哨兵壳分流)已经加载好的整份 set,直接复用免二次拉。admin 仍会 fresh 重拉。 */
  initialData?: AlgFile;
}

export default function AlgCategoryView({ puzzleParam, set, subgroupParam, initialData }: AlgCategoryViewProps) {
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
  const [data, setData] = useState<AlgFile | null>(initialData ?? null);
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
  const [flashId, setFlashId] = useState<number | null>(null);
  /** 点中的那张卡(黄框)。它同时是 URL 片段的来源 —— 复制地址栏就能把这张卡发给别人。 */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /**
   * 校验不过的**公式**:`${caseId}:${oriIdx}:${algIdx}` → 原因。卡片红框由它推出来。
   * 存到公式这一级,是因为「这张卡有问题」不够用 —— 一张卡挂四条公式,得指出是哪条。
   * **只给 admin 跑**:每个访客的浏览器都跑一遍 cubing.js 纯属浪费,而红框是给能修的人看的。
   */
  const [invalidAlgs, setInvalidAlgs] = useState<Map<string, string>>(new Map());
  const invalidIds = useMemo(() => {
    const s = new Set<number>();
    for (const k of invalidAlgs.keys()) s.add(Number(k.split(':', 1)[0]));
    return s;
  }, [invalidAlgs]);
  /** 某个 case 的坏行,拆回 (oi, ai) 交给编辑器。挂载那刻编辑器行号 == algs 下标。 */
  const invalidMarksOf = useCallback((caseId: number): AlgInvalidMark[] => {
    const out: AlgInvalidMark[] = [];
    for (const [k, reason] of invalidAlgs) {
      const [cid, oi, ai] = k.split(':').map(Number);
      if (cid === caseId) out.push({ oi, ai, reason });
    }
    return out;
  }, [invalidAlgs]);
  /** 这个 case 的红标全撤。保存成功 ⟹ 它每条公式都刚过了校验,旧结论不作数了。 */
  const clearInvalidFor = useCallback((caseId: number) => {
    setInvalidAlgs(prev => {
      const next = new Map(prev);
      for (const k of prev.keys()) if (Number(k.split(':', 1)[0]) === caseId) next.delete(k);
      return next.size === prev.size ? prev : next;
    });
  }, []);
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

  /** 标签筛选真的在生效吗(选了 `oh`、且这个 set 确实有 `oh`)—— 生效时公式列表是个子集 */
  const filtering = tagFilter !== 'all' && availableTags.includes(tagFilter);

  /** 一个 case 在当前筛选下要显示的公式(标签筛选作用在**公式**上,不是 case 上) */
  const algsUnderFilter = (algs: AlgEntry[]) =>
    filtering ? algs.filter(a => a.tags?.includes(tagFilter)) : algs;

  // dnd-kit sensors:鼠标按住超过 5px 才认作 drag,避免误触发(普通点击不被吞)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /** 一条公式的拖动 id。真下标(未筛选)编进去,drop 的时候直接读回来。 */
  const algDragId = (caseId: number, ori: number, i: number) => `alg-${caseId}-${ori}-${i}`;

  /**
   * 一个 case 内部重排公式 —— 第一条是主推解法,顺序是有意义的。
   * 乐观更新,失败回滚(和 case 重排同一套路)。
   */
  const handleAlgDragEnd = (c: AlgCase, oriIdx: number) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || c.id == null) return;
    const idxOf = (id: string | number) => Number(String(id).split('-').pop());
    const from = idxOf(active.id);
    const to = idxOf(over.id);
    const rows = c.algs[oriIdx] ?? [];
    const sane = (n: number) => Number.isInteger(n) && n >= 0 && n < rows.length;
    if (!sane(from) || !sane(to)) return;

    const before = c.algs;
    const after = c.algs.map((ori, i) => (i === oriIdx ? arrayMove(ori, from, to) : ori));
    const swap = (algs: AlgCase['algs']) =>
      setData(d => (d ? { ...d, cases: d.cases.map(x => (x.id === c.id ? { ...x, algs } : x)) } : d));

    swap(after);
    reorderCaseAlgs(puzzleParam, set, c, after).catch(err => {
      console.error('reorder algs failed', err);
      alert(`Reorder failed: ${err.message}`);
      swap(before);
    });
  };

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
    // >100 个 case 的非 umbrella set 默认全折(zbll/1lll 走子组页不折)。
    const applyCollapse = (d: AlgFile) => {
      if (d.cases.length > 100 && !meta.umbrella) {
        const groups = new Set<string>();
        for (const c of d.cases) groups.add(c.subgroup || '');
        setCollapsedGroups(groups);
      } else {
        setCollapsedGroups(new Set());
      }
    };
    // 哨兵壳分流已经把整份 set 拉好传下来(initialData):非 admin 直接复用,免二次 fetch。
    if (initialData && !isAdmin) { setData(initialData); applyCollapse(initialData); return; }
    setData(null);
    // admin 必须绕开那 1 小时的 Cache-Control。他刚删掉的那条公式,DB 里确实没了,
    // 但浏览器缓存里那份旧响应还在 —— 而 Ctrl+Shift+R 只绕文档和子资源的缓存,
    // **绕不过页面加载后 JS 自己发的 fetch()**,那一发照样命中旧响应。结果就是:
    // 保存成功、页面也对,一强刷,删掉的公式原地复活。fresh 就是为这个留的口子。
    loadAlg(puzzleParam, set, { fresh: isAdmin }).then(d => {
      setData(d);
      applyCollapse(d);
    }).catch(e => setError(String(e)));
  }, [puzzleParam, set, validPuzzle, meta, isAdmin, initialData]);

  /** admin 才扫。case 改完(data 变 / validationRefreshKey)重扫,红标跟着消。 */
  useEffect(() => {
    if (!isAdmin || !data || !validPuzzle) { setInvalidAlgs(new Map()); return; }
    let cancelled = false;
    scanCases(puzzleParam, set, data.cases, { shouldCancel: () => cancelled })
      .then(fails => {
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const f of fails) {
          if (f.caseObj.id == null) continue;
          m.set(`${f.caseObj.id}:${f.oriIdx}:${f.algIdx}`, f.reason);
        }
        setInvalidAlgs(m);
      })
      .catch(e => console.warn('[alg] validation scan failed', e));
    return () => { cancelled = true; };
  }, [isAdmin, data, puzzleParam, set, validPuzzle, validationRefreshKey]);

  /**
   * `#<case 名>` 锚点:分享出去的链接、元数据弹窗的「在列表中打开」、个人页的校验汇总都落这儿
   * (目标多半在别的组)。落地后:选中它(黄框)+ 滚过去 + 闪一下 —— 一组七十来个 case,
   * 不指出来等于没跳。(锚点不是页内状态,是 URL 片段,和 nuqs 那条约定不冲突。)
   *
   * 目标卡在**折叠的组**里(>100 个 case 的 set 默认全折)⟹ 先把那组展开,否则
   * `getElementById` 拿到 null,跳转静默失败。
   */
  // `#<case 名>` 锚点(分享链接 / 元数据弹窗「在列表中打开」/ 个人页校验汇总都落这儿,目标多半
  // 在别的、可能还折叠着的组):选中它(黄框)+ 滚过去 + 闪一下。走共享 useHashHighlight ——
  // reveal 负责选中并展开目标所在折叠组(展开后返回 false,collapsedGroups 进 deps 触发重试);
  // 闪一下用 flashId(React state,免得卡片重渲染把命令式 class 冲掉),故不传 highlightClass。
  const { setHash } = useHashHighlight({
    block: 'center',
    linger: 1800, // 闪一下语义(同一锚点不重放);实际的闪由下面 onScroll→flashId 渲染
    deps: [data, collapsedGroups, puzzleParam, set, subgroupParam],
    resolve: (h) => {
      const c = findCaseByHash(data?.cases ?? [], h, puzzleParam, set);
      return c?.id != null ? document.getElementById(`case-${c.id}`) : null;
    },
    reveal: (h) => {
      const c = findCaseByHash(data?.cases ?? [], h, puzzleParam, set);
      if (c?.id == null) return;
      setSelectedId(c.id);
      const g = c.subgroup || '';
      if (collapsedGroups.has(g)) {
        setCollapsedGroups(prev => { const next = new Set(prev); next.delete(g); return next; });
        return false; // 组刚展开,卡还没挂 → 等 collapsedGroups 变化后重试
      }
    },
    onScroll: (el) => {
      const id = Number(el.id.slice('case-'.length));
      setFlashId(id);
      window.setTimeout(() => setFlashId(cur => (cur === id ? null : cur)), 1800);
    },
  });

  // 点卡片现在是**跳到该 case 的独立页**(卡上的 <a class="alg-case-cardlink"> 覆盖层),不再是
  // 选中 + 写 hash。`selectedId` 仅由下面的 hash hook(从详情页返回带 #name 落地时)设置,用来高亮。

  const rawSubgroupSlug = subgroupParam ? decodeURIComponent(subgroupParam).toLowerCase() : null;
  // 旧数字制子组 slug(u1 / pi 1 / as1 …)→ 新方向制(ur / pif / asf …),老链接不失效(migration 0081)
  const subgroupSlug = canonicalZbllSubgroupSlug(set, rawSubgroupSlug);
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

  /** 整个 set 的 case → 唯一短链 slug(点卡片跳转用)。落地解析用同一份算法,见 alg_case_link。 */
  const slugMap = useMemo(() => (data ? buildCaseSlugMap(data.cases, set) : null), [data, set]);
  const caseDetailHref = useCallback(
    (c: AlgCase) => algCaseDetailHref(puzzleParam, set, (c.id != null && slugMap?.byId.get(c.id)) || caseSlugBase(set, c)),
    [slugMap, puzzleParam, set],
  );

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
    return set === 'zbll' ? displayZbllToken(slug) : slug.toUpperCase();
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
        {/* set 级(含 umbrella 落地页)从全集选;subgroup 页带 ?scope= 只从该组选 */}
        {data && (
          <Link
            href={`/alg/${puzzleParam}/${set}/select${subgroupSlug ? `?scope=${encodeURIComponent(subgroupSlug)}` : ''}`}
            className="alg-train-cta"
            prefetch={false}
          >
            {tr({ zh: '训练', en: 'Train' })}
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
              <Plus size={14} />
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
                  <div className="alg-subgroup-card-title">{set === 'zbll' ? displayZbllToken(subLabel) : subLabel}</div>
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
                    <article
                      className={`alg-case${flashId === c.id ? ' is-flash' : ''}${selectedId === c.id ? ' is-selected' : ''}${c.id != null && invalidIds.has(c.id) ? ' is-invalid' : ''}`}
                      id={c.id != null ? `case-${c.id}` : undefined}
                      title={c.id != null && invalidIds.has(c.id)
                        ? tr({ zh: '这个 case 有公式校验不通过', en: 'This case has failing algs' })
                        : undefined}
                    >
                      {/* 整卡跳到这张 case 的独立页(缩略图 + 名字 = 跳转区;公式/复制/播放/社区区
                          z-index 抬到覆盖层之上,照常交互)。真 <a>,中键可新开。 */}
                      <Link
                        href={caseDetailHref(c)}
                        className="alg-case-cardlink"
                        prefetch={false}
                        aria-label={primaryCaseName(puzzleParam, set, c)}
                      />
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
                          {c.setup && <SetupLine puzzle={puzzleParam} setup={c.setup} />}
                        </div>
                      </div>
                      <div className="alg-case-algs">
                        {(() => {
                          // 筛了标签就别拖:看到的是子集,拖出来的顺序对不上真实数组
                          const dragAlgs = isAdmin && c.id != null && !filtering;
                          const rows = algsForOri.map((entry, i) => {
                            const rowKey = `${c.name}::${oriIdx}::${i}`;
                            const expanded = expandedKey === rowKey;
                            // 校验结果 / 拖动 id 都按**未筛选**的下标走(标签筛选只是个视图)——
                            // 拿对象身份换回真下标
                            const trueIdx = allAlgsForOri.indexOf(entry);
                            const row = (
                              <AlgRow
                                entry={entry}
                                expanded={expanded}
                                onToggle={() => setExpandedKey(expanded ? null : rowKey)}
                                animatable={animatable}
                                puzzle={puzzleParam as AlgPuzzle}
                                set={set}
                                setup={oriAdjustSetup(c.setup, oriIdx)}
                                invalid={c.id != null ? invalidAlgs.get(`${c.id}:${oriIdx}:${trueIdx}`) : undefined}
                              />
                            );
                            const key = `${entry.altId ?? ''}::${trueIdx}`;
                            // 不拖的时候一层壳都不加 —— AlgRow 是 fragment(行 + 展开的播放器),
                            // 套个 div 会把它俩和列表的 gap 关系改掉
                            return dragAlgs
                              ? (
                                <SortableAlgRow key={key} id={algDragId(c.id!, oriIdx, trueIdx)} draggable>
                                  {row}
                                </SortableAlgRow>
                              )
                              : <Fragment key={key}>{row}</Fragment>;
                          });
                          if (!dragAlgs) return rows;
                          return (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAlgDragEnd(c, oriIdx)}>
                              <SortableContext
                                items={algsForOri.map(e => algDragId(c.id!, oriIdx, allAlgsForOri.indexOf(e)))}
                                strategy={verticalListSortingStrategy}
                              >
                                {rows}
                              </SortableContext>
                            </DndContext>
                          );
                        })()}
                      </div>
                      <CommunityAlgs
                        puzzle={puzzleParam}
                        setSlug={set}
                        caseName={c.name}
                        sticker={c.sticker}
                        setup={c.setup}
                        firstAlg={c.algs[0]?.[0]?.alg}
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
          initialInvalid={
            editorState.mode === 'edit' && editorState.existing.id != null
              ? invalidMarksOf(editorState.existing.id)
              : undefined
          }
          onClose={() => setEditorState(null)}
          onSaved={(action) => {
            if (!data) return;
            if (action.type === 'add') {
              setData({ ...data, cases: [...data.cases, action.created] });
            } else if (action.type === 'update') {
              setData({ ...data, cases: data.cases.map(c => c.id === action.updated.id ? action.updated : c) });
              if (action.updated.id != null) clearInvalidFor(action.updated.id);
              // 改的正是选中那张 ⟹ 片段跟着换名字,否则地址栏还挂着旧名(分享出去就是个死链)
              if (selectedId === action.updated.id) {
                const frag = caseAnchor(action.updated.name);
                replaceHash(frag);
                setHash(`#${frag}`, { markActed: true });
              }
            } else {
              setData({ ...data, cases: data.cases.filter(c => c.id !== action.id) });
              clearInvalidFor(action.id); // case 没了,它的红标也别留着
              if (selectedId === action.id) { setSelectedId(null); replaceHash(''); setHash('', { markActed: true }); }
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
