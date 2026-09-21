'use client';

/**
 * 多个 AlgInput 公式行 + 共享虚拟键盘。
 *
 * 形态: 2D AlgEntry[][] (外层 ori,内层条数)。多 ori 时按 ori 分组显示。
 * 每行用 AlgInput markable 模式,内部 contenteditable,可有 inline 标签。
 * 提交时:alg = getText(), algHtml = getHtml()(若含标签)。
 *
 * 关键: layout 内部为每行配 stable uid,React key 用 uid 而非数组下标,
 * 否则删中间行后 React 会复用旁边 DOM,AlgInput uncontrolled 内容不刷新 → 视觉错位。
 */
import { useState, useRef, useImperativeHandle, useMemo, forwardRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, AlertTriangle, Copy, Check, Pin, FlipHorizontal2, Tags } from 'lucide-react';
import type { AlgCase, AlgEntry, AlgPuzzle } from '@cuberoot/shared/alg';
import { gen as algorithmGenerators } from '@cuberoot/shared/alg-notation';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import SortableAlgRow from '@/components/SortableAlgRow';
import AlgMirrorPanel, { hasMirror } from '@/components/AlgMirrorPanel';
import { useCopy } from '@/hooks/useCopy';
import { editedAlgEntry } from '@/lib/alg_editor';
import { sanitizeAlgHtml } from '@/lib/alg_html';
import { preferredAlgRef, preferredAlgSlot, usePreferredAlgs } from '@/lib/alg-preferred-algs';
import { algTagLabel, ALG_TAGS } from '@/lib/alg_tags';
import { CompactSelect } from '@/components/CompactSelect';
import AlgTagLabel from '@/components/AlgTagLabel';
import { sq1NotationText, type Sq1NotationMode } from '@/lib/sq1-pbl-notation';
import { canonicalSq1Alg } from '@cuberoot/shared/sq1-notation';
import { mirrorCascadeOnEdit, VIEWS, type MirrorCascadeEntry } from '@cuberoot/shared/alg-mirror';
import CubeKeyboardSection from '@/components/CubeKeyboardSection';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import AlgDeleteConfirm, { type AlgDeleteGroup } from '@/components/AlgDeleteConfirm';
import { displayAlg, shortOriName } from '@/lib/alg_display';
import { tr } from '@/i18n/tr';
import { displayedAlgorithmStm } from '@/lib/alg-metrics';

/** 一条「这行没过校验」的标记。`ai` 是**编辑器里的行号**(含空行),不是入库数组的下标。 */
export interface AlgInvalidMark { oi: number; ai: number; reason: string }

/**
 * 镜像上下文 —— 给了就能在删一条之前算出「这一删会连带抹掉哪几条生成公式」。
 *
 * 由 {@link AdminCaseEditor} 备好(它负责把伙伴 case 拉回来);没建链 / 不吃镜像同步的 set
 * 不传,那时删除仍然二次确认,只是没有连带这一段。
 */
export interface AlgEditorMirror {
  selfId: number;
  selfName: string;
  /** 伙伴 case。自镜像时 `id === selfId`(三份镜像都落回自己身上)。 */
  partner: { id: number; name: string; algs: AlgEntry[][] };
}

export interface AlgEditorHandle {
  getValue(): AlgEntry[][];
  /**
   * 把校验没过的行标红。
   *
   * 收到就立刻解析成行的 uid 存下来 —— 存下标的话,用户随手删一行,红标就飘到别的公式上了。
   */
  markInvalid(marks: AlgInvalidMark[]): void;
}

interface Props {
  initialValue: AlgEntry[][];
  puzzle?: AlgPuzzle;
  /** 只格式化输入框的初始显示；未编辑的行保存时仍原样返回，避免无意改写数据库。 */
  formatInitialAlg?: (alg: string) => string;
  formatInitialHtml?: (html: string) => string;
  caseContext?: { puzzle: AlgPuzzle; set: string; caseObj: AlgCase; sq1NotationMode?: Sq1NotationMode };
  /** 第三项始终是无损语义值，不能传仅供展示的 formatInitialAlg 结果。 */
  renderOrientation?: (rows: React.ReactNode, oi: number, firstEntry: AlgEntry | undefined) => React.ReactNode;
  /** 内联详情页中，在“新增公式”按钮之前插入社区公式等附加内容。 */
  renderBeforeAdd?: (oi: number) => React.ReactNode;
  /** 开局就标红的行(页面那轮全库校验已经知道谁挂了,不必等用户按一次保存才告诉他)。 */
  initialInvalid?: AlgInvalidMark[];
  oriNames?: string[] | null;
  /** 见 {@link AlgEditorMirror}。有值时删一条会把连带的生成公式列进确认弹层。 */
  mirror?: AlgEditorMirror | null;
  /** 伙伴 case 还在路上 —— 这期间弹层不让点删,免得在连带算清楚之前就下手。 */
  mirrorPending?: boolean;
  /** 伙伴 case 拉不回来的说明。有值就在弹层里明说,不假装「没有连带」。 */
  mirrorError?: string | null;
  /** 当前聚焦行的纯文本和专属 setup —— 父组件用来驱动左侧 AlgPlayer。 */
  onCurrentAlgChange?: (alg: string, setup?: string, oi?: number) => void;
  /** 聚焦行内 caret 之前的 token 数(光标 sync 用) */
  onCursorMoveCount?: (n: number, oi?: number) => void;
  /** 编辑内容发生变化。内联管理页用它触发自动保存。 */
  onChange?: () => void;
}

type Row = AlgEntry & { uid: string };

let _uidCounter = 0;
function newUid(): string {
  _uidCounter += 1;
  return `r${Date.now().toString(36)}_${_uidCounter}`;
}

/** 正在等确认的那次删除 —— 连带清单开弹层时算一次就定住,不跟着后续输入抖。 */
interface PendingRemoval {
  oi: number;
  uid: string;
  alg: string;
  /** 被删的这条本身是不是生成的(是的话删了会重新长出来,要提醒) */
  generated: boolean;
  cascade: MirrorCascadeEntry[];
}

function RowActions({ entry, text, oi, context, mirror }: { entry: AlgEntry; text: string; oi: number; context: NonNullable<Props['caseContext']>; mirror?: AlgEditorMirror | null }) {
  const { copied, copy } = useCopy();
  const [mirrorOpen, setMirrorOpen] = useState(false);
  const { puzzle, set, caseObj } = context;
  const preferred = usePreferredAlgs(state => state.snapshots[`${puzzle}/${set}`]);
  const setPreferred = usePreferredAlgs(state => state.setPreferred);
  const slot = preferredAlgSlot(caseObj, oi);
  const pinned = preferred?.items[slot] === preferredAlgRef(entry);
  const notation = puzzle === 'sq1' ? sq1NotationText(text, context.sq1NotationMode ?? 'compact', set === 'pbl' && canonicalSq1Alg(text) === canonicalSq1Alg(entry.alg) ? entry.note : undefined) : null;
  const shownText = notation ? tr(notation) : text;
  const length = displayedAlgorithmStm(puzzle, text);
  return <>
    {entry.note && !(puzzle === 'sq1' && set === 'pbl') && <span className="alg-alg-note">{tr(entry.note)}</span>}
    {notation && <code className="alg-editor-notation">{shownText}</code>}
    {length != null && <span className="alg-alg-len" title="STM">{length}</span>}
    <button type="button" className="alg-editor-del" aria-pressed={pinned} title={pinned ? tr({ zh: '取消置顶', en: 'Unpin algorithm' }) : tr({ zh: '置顶公式', en: 'Pin algorithm' })}
      onClick={() => setPreferred(puzzle, set, slot, pinned ? null : preferredAlgRef(entry))}><Pin size={12} fill={pinned ? 'currentColor' : 'none'} /></button>
    <button type="button" className="alg-editor-del" title={tr({ zh: '复制', en: 'Copy' })} onClick={() => copy(shownText)}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
    {hasMirror(puzzle, set) && <button type="button" className="alg-editor-del" aria-expanded={mirrorOpen} title={tr({ zh: '镜像公式', en: 'Mirrored algs' })} onClick={() => setMirrorOpen(open => !open)}><FlipHorizontal2 size={12} /></button>}
    {mirrorOpen && <div className="alg-editor-mirror"><AlgMirrorPanel alg={text} puzzle={puzzle} mirrorName={mirror?.partner.name ?? null} selfName={mirror?.selfName ?? caseObj.name} ori={oi} /></div>}
  </>;
}

const AlgEditor = forwardRef<AlgEditorHandle, Props>(({ initialValue, puzzle = '3x3', formatInitialAlg, formatInitialHtml, caseContext, renderOrientation = rows => rows, renderBeforeAdd, initialInvalid, oriNames, mirror, mirrorPending, mirrorError, onCurrentAlgChange, onCursorMoveCount, onChange }, ref) => {
  useTranslation(); // subscribe to language changes; text via tr()
  const [layout, setLayout] = useState<Row[][]>(() => {
    const src = initialValue.length === 0
      ? [[{ alg: '' }]]
      : initialValue.map(ori => (ori.length === 0 ? [{ alg: '' }] : ori));
    return src.map(ori => ori.map(e => ({ ...e, uid: newUid() })));
  });

  // NOTE: 用 row.uid 作 key,删行不会让别的 row 的 handle 漂移
  const handles = useRef<Map<string, AlgInputHandle>>(new Map());
  const elements = useRef<Map<string, HTMLTextAreaElement | HTMLDivElement>>(new Map());

  const [focusedUid, setFocusedUid] = useState<string | null>(null);
  const [keyboardToggleContainer, setKeyboardToggleContainer] = useState<HTMLSpanElement | null>(null);
  /** 校验没过的行:uid → 原因。按 uid 不按下标 —— 删一行下标就全串位了。 */
  const [invalid, setInvalid] = useState<Map<string, string>>(() => {
    // 挂载这一刻,layout 的行号和 initialValue 的下标还是一一对应的(空行是后来加的),
    // 所以 initialInvalid 的 (oi, ai) 可以直接查到 uid。之后一律按 uid 走。
    const m = new Map<string, string>();
    for (const { oi, ai, reason } of initialInvalid ?? []) {
      const uid = layout[oi]?.[ai]?.uid;
      if (uid) m.set(uid, reason);
    }
    return m;
  });
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => {
    const m = new Map<string, string>();
    for (const { oi, ai, reason } of initialInvalid ?? []) {
      const uid = layoutRef.current[oi]?.[ai]?.uid;
      if (uid) m.set(uid, reason);
    }
    setInvalid(m);
  }, [initialInvalid]);
  /** 实时跟踪当前 focused 行的纯文本,给 AlgPlayer 用 */
  const [currentAlg, setCurrentAlg] = useState('');
  const [editedText, setEditedText] = useState<Record<string, string>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const loadPreferred = usePreferredAlgs(state => state.load);
  useEffect(() => { if (caseContext) loadPreferred(caseContext.puzzle, caseContext.set); }, [loadPreferred, caseContext?.puzzle, caseContext?.set]);
  const initialHtmlOf = (row: Row) => row.algHtml ? sanitizeAlgHtml(formatInitialHtml?.(row.algHtml) ?? row.algHtml) : undefined;
  const readEntry = (row: Row): AlgEntry => {
    const { uid: _uid, ...original } = row;
    const handle = handles.current.get(row.uid);
    return handle ? editedAlgEntry(original, formatInitialAlg?.(row.alg) ?? row.alg, initialHtmlOf(row), handle.getText(), handle.getHtml()) : original;
  };
  const keyboardTargetRef = useMemo(
    () => ({ current: focusedUid ? (elements.current.get(focusedUid) ?? null) : null }),
    [focusedUid],
  );

  useEffect(() => {
    // blur 不清空,保留最后一次 alg —— 父组件左侧 player 可以一直播放
    if (!focusedUid) return;
    const h = handles.current.get(focusedUid);
    if (h) setCurrentAlg(h.getText());
  }, [focusedUid]);

  useEffect(() => {
    if (!focusedUid) return;
    const oi = layout.findIndex(rows => rows.some(item => item.uid === focusedUid));
    const row = layout[oi]?.find(item => item.uid === focusedUid);
    if (row) onCurrentAlgChange?.(readEntry(row).alg, row.setup, oi);
    // The input handles hold the draft; currentAlg triggers this after typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAlg, focusedUid, layout, onCurrentAlgChange]);

  useImperativeHandle(ref, () => ({
    getValue: (): AlgEntry[][] =>
      layout.map(ori =>
        ori.map(readEntry),
      ),
    markInvalid: (marks) => {
      const m = new Map<string, string>();
      for (const { oi, ai, reason } of marks) {
        const uid = layout[oi]?.[ai]?.uid;
        if (uid) m.set(uid, reason);
      }
      setInvalid(m);
    },
  }));

  const addAlg = (oi: number) => {
    const newRow: Row = { alg: '', uid: newUid() };
    setLayout(L => L.map((ori, i) => (i === oi ? [...ori, newRow] : ori)));
    requestAnimationFrame(() => {
      const el = elements.current.get(newRow.uid);
      if (el) { el.focus(); setFocusedUid(newRow.uid); }
    });
  };

  const removeAlg = (oi: number, uid: string) => {
    const remaining = layout[oi]?.filter(row => row.uid !== uid);
    if (!remaining?.length) return;
    setLayout(L => {
      const ori = L[oi];
      if (ori.length <= 1) return L;
      handles.current.delete(uid);
      elements.current.delete(uid);
      return L.map((o, i) => (i === oi ? o.filter(r => r.uid !== uid) : o));
    });
    if (focusedUid === uid) setFocusedUid(null);
    const next = readEntry(remaining[0]);
    onCurrentAlgChange?.(next.alg, next.setup, oi);
    onChange?.();
  };

  /**
   * 编辑器此刻的内容,形状与保存时入库的一致(空行剥掉)—— 算连带要拿它当「现状」,
   * 不能拿 `initialValue`:用户可能刚改过别的行,那些改动也参与生成。
   */
  const snapshot = (skipUid?: string): AlgEntry[][] =>
    layout.map(ori => ori.flatMap(row => {
      if (row.uid === skipUid) return [];
      const entry = readEntry(row);
      return entry.alg.trim() ? [entry] : [];
    }));

  const [pending, setPending] = useState<PendingRemoval | null>(null);

  /** 点删除按钮走这里:空行直接删(没什么可确认的),有内容的先算连带再问一句。 */
  const requestRemove = (oi: number, uid: string) => {
    const row = layout[oi]?.find(r => r.uid === uid);
    const alg = (handles.current.get(uid)?.getText() ?? row?.alg ?? '').trim();
    if (!alg) { removeAlg(oi, uid); return; }

    let cascade: MirrorCascadeEntry[] = [];
    if (mirror) {
      const self = { id: mirror.selfId, algs: snapshot() };
      // 自镜像时伙伴就是自己 —— 传现场那份,别传拉回来的旧副本
      const partner = mirror.partner.id === mirror.selfId
        ? self
        : { id: mirror.partner.id, algs: mirror.partner.algs };
      cascade = mirrorCascadeOnEdit(self, partner, snapshot(uid));
    }
    setPending({ oi, uid, alg, generated: !!row?.gen, cascade });
  };

  /** 连带清单按「落在谁的哪个视角」归堆,一堆一行标题。 */
  const cascadeGroups = useMemo<AlgDeleteGroup[]>(() => {
    if (!pending || !mirror) return [];
    const byWhere = new Map<string, string[]>();
    for (const e of pending.cascade) {
      const name = e.caseId === mirror.selfId ? mirror.selfName : mirror.partner.name;
      const where = `${name} ${VIEWS[e.view]}`;
      const list = byWhere.get(where);
      if (list) list.push(displayAlg(e.alg));
      else byWhere.set(where, [displayAlg(e.alg)]);
    }
    return [...byWhere].map(([where, algs]) => ({ where, algs }));
  }, [pending, mirror]);

  return (
    <div className="alg-editor">
      {layout.map((ori, oi) => {
        const first = ori[0];
        const firstEntry = first ? readEntry(first) : undefined;
        return (
        <div key={oi} className="alg-editor-ori">
          {oriNames && oriNames[oi] && (
            <div className="alg-editor-ori-name">{shortOriName(oriNames[oi])}</div>
          )}
          {renderOrientation(<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const from = ori.findIndex(row => row.uid === active.id);
            const to = ori.findIndex(row => row.uid === over.id);
            if (from < 0 || to < 0) return;
            setLayout(current => current.map((rows, i) => i === oi ? arrayMove(rows, from, to) : rows));
            onChange?.();
          }}><SortableContext items={ori.map(row => row.uid)} strategy={verticalListSortingStrategy}>
          {ori.map((row, ai) => {
            const isFocused = focusedUid === row.uid;
            const bad = invalid.get(row.uid);
            const initialText = formatInitialAlg?.(row.alg || '') ?? (row.alg || '');
            const currentText = editedText[row.uid] ?? initialText;
            return (
              <SortableAlgRow key={row.uid} id={row.uid} draggable={!!caseContext}>
              <div className={`alg-editor-row${ai === 0 ? ' has-gen-heading' : ''}${bad ? ' is-invalid' : ''}`}>
                <AlgInput
                  ref={(h: AlgInputHandle | null) => {
                    if (h) {
                      handles.current.set(row.uid, h);
                      const el = h.getElement();
                      if (el) elements.current.set(row.uid, el);
                    } else {
                      handles.current.delete(row.uid);
                      elements.current.delete(row.uid);
                    }
                  }}
                  markable
                  multiline={false}
                  autoSpace
                  initialText={initialText}
                  initialHtml={initialHtmlOf(row)}
                  placeholder={tr({ zh: "如 R U R' U'", en: "e.g. R U R' U'" })}
                  className="alg-editor-input"
                  spellCheck={false}
                  onFocus={() => setFocusedUid(row.uid)}
                  onBlur={e => {
                    const next = e.relatedTarget as HTMLElement | null;
                    if (next && next.closest('.alg-editor')) return;
                    setFocusedUid(prev => (prev === row.uid ? null : prev));
                  }}
                  onChange={text => {
                    setEditedText(current => ({ ...current, [row.uid]: text }));
                    onChange?.();
                    if (focusedUid === row.uid) setCurrentAlg(text);
                    // 一动这行就摘掉它的红标 —— 旧的判定已经不作数了,留着只会误导
                    setInvalid(prev => {
                      if (!prev.has(row.uid)) return prev;
                      const next = new Map(prev);
                      next.delete(row.uid);
                      return next;
                    });
                  }}
                  onCaretChange={(text, caret) => {
                    if (focusedUid !== row.uid) return;
                    // 与播放器同源解析:连写、指法记号和重复组都不能按空格计步。
                    onCursorMoveCount?.(resolveSimPreviewMoves(puzzle, text.slice(0, Math.max(0, caret))).length, oi);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addAlg(oi);
                    }
                  }}
                />
                <div className="alg-editor-tools" role="toolbar" aria-label={tr({ zh: '公式操作', en: 'Algorithm actions' })}>
                <div className="alg-editor-tools-group" data-site-surface="popover">
                {isFocused && <span className="alg-input-keyboard-toggle" ref={setKeyboardToggleContainer} />}
                <span className="alg-editor-gen">
                  {ai === 0 && <span className="alg-editor-gen-heading">{tr({ zh: '流', en: 'gen' })}</span>}
                  <code>{algorithmGenerators(currentText) || '—'}</code>
                </span>
                <CompactSelect
                  variant="plain"
                  className="alg-tag-select"
                  showArrow={false}
                  label={row.tags?.length ? <span className="alg-tag-symbol">{row.tags.map(tag => <AlgTagLabel key={tag} tag={tag} label={algTagLabel(tag)} />)}</span> : <Tags size={13} />}
                  ariaLabel={tr({ zh: '公式标签', en: 'Algorithm tags' })}
                  title={row.tags?.length ? row.tags.map(algTagLabel).join(', ') : tr({ zh: '公式标签', en: 'Algorithm tags' })}
                  selectedValues={row.tags ?? []}
                  items={[...new Set([...ALG_TAGS, ...(row.tags ?? [])])].map(tag => ({ value: tag, label: <AlgTagLabel tag={tag} label={algTagLabel(tag)} /> }))}
                  onChange={tag => {
                    setLayout(current => current.map(rows => rows.map(item => item.uid === row.uid
                      ? { ...item, tags: item.tags?.includes(tag) ? item.tags.filter(value => value !== tag) : [...(item.tags ?? []), tag] }
                      : item)));
                    onChange?.();
                  }}
                />
                {caseContext && <RowActions entry={row} text={currentText} oi={oi} context={caseContext} mirror={mirror} />}
                {ori.length > 1 && (
                  <button
                    type="button"
                    className="alg-editor-del alg-editor-remove"
                    onClick={() => requestRemove(oi, row.uid)}
                    title={tr({ zh: '删此条', en: 'Remove' })}
                    tabIndex={-1}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                </div>
                </div>
              </div>
                {bad && (
                  <div className="alg-editor-row-error">
                    <AlertTriangle size={12} />
                    <span>{bad}</span>
                  </div>
                )}
                {isFocused && (
                  <CubeKeyboardSection
                    target={keyboardTargetRef}
                    toggleContainer={keyboardToggleContainer}
                    enableMarks
                    mobileVisible={isFocused}
                    onActivate={() => handles.current.get(row.uid)?.focus()}
                  />
                )}
              </SortableAlgRow>
            );
          })}
          {renderBeforeAdd?.(oi)}
          <button type="button" className="alg-editor-add" onClick={() => addAlg(oi)} tabIndex={-1} title={tr({ zh: '加一条', en: 'Add' })}>
            <Plus size={12} />
          </button>
          </SortableContext></DndContext>, oi, firstEntry)}
        </div>
        );
      })}

      {pending && (
        <AlgDeleteConfirm
          title={tr({ zh: '删掉这条公式?', en: 'Delete this alg?' })}
          target={[{
            where: oriNames?.[pending.oi] ? shortOriName(oriNames[pending.oi]) : undefined,
            algs: [displayAlg(pending.alg)],
          }]}
          cascade={cascadeGroups}
          cascadePending={mirrorPending}
          cascadeError={mirrorError}
          note={pending.generated
            ? tr({
                zh: '这条是镜像自动生成的 —— 删掉后会按源公式重新长出来。要真去掉,得去删它的源。',
                en: 'This one is mirror-generated — it will come back after deletion. Delete its source instead.',
              })
            : tr({ zh: '确认后立即保存。', en: 'Saved immediately after confirmation.' })}
          onCancel={() => setPending(null)}
          onConfirm={() => { removeAlg(pending.oi, pending.uid); setPending(null); }}
        />
      )}
    </div>
  );
});

AlgEditor.displayName = 'AlgEditor';
export default AlgEditor;
