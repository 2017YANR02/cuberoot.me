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
import { Fragment, useState, useRef, useImperativeHandle, useMemo, forwardRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, AlertTriangle } from 'lucide-react';
import type { AlgEntry } from '@cuberoot/shared';
import { mirrorCascadeOnEdit, VIEWS, type MirrorCascadeEntry } from '@cuberoot/shared/alg-mirror';
import CubeKeyboardSection from '@/components/CubeKeyboardSection';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import AlgDeleteConfirm, { type AlgDeleteGroup } from '@/components/AlgDeleteConfirm';
import { displayAlg, shortOriName } from '@/lib/alg_display';
import { tr } from '@/i18n/tr';

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
  /** 只格式化输入框的初始显示；未编辑的行保存时仍原样返回，避免无意改写数据库。 */
  formatInitialAlg?: (alg: string) => string;
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
  onCurrentAlgChange?: (alg: string, setup?: string) => void;
  /** 聚焦行内 caret 之前的 token 数(光标 sync 用) */
  onCursorMoveCount?: (n: number) => void;
}

/** caret 之前的 token 数(空白拆分,过滤空 token) */
function tokenCountBeforeCaret(text: string, caret: number): number {
  const prefix = text.slice(0, Math.max(0, caret));
  return prefix.trim().split(/\s+/).filter(Boolean).length;
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

const AlgEditor = forwardRef<AlgEditorHandle, Props>(({ initialValue, formatInitialAlg, initialInvalid, oriNames, mirror, mirrorPending, mirrorError, onCurrentAlgChange, onCursorMoveCount }, ref) => {
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
  /** 实时跟踪当前 focused 行的纯文本,给 AlgPlayer 用 */
  const [currentAlg, setCurrentAlg] = useState('');
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
    const row = layout.flat().find(item => item.uid === focusedUid);
    onCurrentAlgChange?.(currentAlg, row?.setup);
  }, [currentAlg, focusedUid, layout, onCurrentAlgChange]);

  useImperativeHandle(ref, () => ({
    getValue: (): AlgEntry[][] =>
      layout.map(ori =>
        ori.map(row => {
          // 这个编辑器只管 alg / algHtml 两个字段。AlgEntry 上其余的东西(altId、ytId、
          // 以及 1LLL 带来的 tags / source / stm / sqtm)它**不认识,但必须原样带回去** ——
          // 重建成 `{ alg }` 就等于编一次 case 把它们全抹掉,而且是静默的。
          const { uid: _uid, ...original } = row;
          const h = handles.current.get(row.uid);
          if (!h) return { ...original, alg: '' };
          const text = h.getText();
          if (!text) return { ...original, alg: '' };
          const initialText = formatInitialAlg?.(row.alg) ?? row.alg;
          if (text === initialText) return original;
          const { alg: _alg, algHtml: _algHtml, ...rest } = original;
          const html = h.getHtml();
          const hasTag = /<(u|s|em|strong|sub|sup)\b/i.test(html);
          return hasTag ? { ...rest, alg: text, algHtml: html } : { ...rest, alg: text };
        }),
      ),
    markInvalid: (marks) => {
      const m = new Map<string, string>();
      for (const { oi, ai, reason } of marks) {
        const uid = layout[oi]?.[ai]?.uid;
        if (uid) m.set(uid, reason);
      }
      setInvalid(m);
    },
  }), [formatInitialAlg, layout]);

  const addAlg = (oi: number) => {
    const newRow: Row = { alg: '', uid: newUid() };
    setLayout(L => L.map((ori, i) => (i === oi ? [...ori, newRow] : ori)));
    requestAnimationFrame(() => {
      const el = elements.current.get(newRow.uid);
      if (el) { el.focus(); setFocusedUid(newRow.uid); }
    });
  };

  const removeAlg = (oi: number, uid: string) => {
    setLayout(L => {
      const ori = L[oi];
      if (ori.length <= 1) return L;
      handles.current.delete(uid);
      elements.current.delete(uid);
      return L.map((o, i) => (i === oi ? o.filter(r => r.uid !== uid) : o));
    });
    if (focusedUid === uid) setFocusedUid(null);
  };

  /**
   * 编辑器此刻的内容,形状与保存时入库的一致(空行剥掉)—— 算连带要拿它当「现状」,
   * 不能拿 `initialValue`:用户可能刚改过别的行,那些改动也参与生成。
   */
  const snapshot = (skipUid?: string): AlgEntry[][] =>
    layout.map(ori => ori.flatMap(row => {
      if (row.uid === skipUid) return [];
      const text = (handles.current.get(row.uid)?.getText() ?? row.alg ?? '').trim();
      if (!text) return [];
      const { uid: _uid, alg: _alg, ...rest } = row;
      return [{ ...rest, alg: text }];
    }));

  const [pending, setPending] = useState<PendingRemoval | null>(null);

  /** 点 × 走这里:空行直接删(没什么可确认的),有内容的先算连带再问一句。 */
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
      {layout.map((ori, oi) => (
        <div key={oi} className="alg-editor-ori">
          {oriNames && oriNames[oi] && (
            <div className="alg-editor-ori-name">{oriNames[oi]}</div>
          )}
          {ori.map(row => {
            const isFocused = focusedUid === row.uid;
            const bad = invalid.get(row.uid);
            const initialText = formatInitialAlg?.(row.alg || '') ?? (row.alg || '');
            return (
              <Fragment key={row.uid}>
              <div className={`alg-editor-row${bad ? ' is-invalid' : ''}`}>
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
                  initialHtml={initialText === row.alg ? row.algHtml : undefined}
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
                    onCursorMoveCount?.(tokenCountBeforeCaret(text, caret));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addAlg(oi);
                    }
                  }}
                />
                {ori.length > 1 && (
                  <button
                    type="button"
                    className="alg-editor-del"
                    onClick={() => requestRemove(oi, row.uid)}
                    title={tr({ zh: '删此条', en: 'Remove' })}
                    tabIndex={-1}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
                {bad && (
                  <div className="alg-editor-row-error">
                    <AlertTriangle size={12} />
                    <span>{bad}</span>
                  </div>
                )}
                {(isFocused || (!focusedUid && oi === 0 && row === ori[0])) && (
                  <CubeKeyboardSection
                    target={keyboardTargetRef}
                    enableMarks
                    mobileVisible={isFocused}
                    onActivate={() => handles.current.get(row.uid)?.focus()}
                  />
                )}
              </Fragment>
            );
          })}
          <button type="button" className="alg-editor-add" onClick={() => addAlg(oi)} tabIndex={-1} title={tr({ zh: '加一条', en: 'Add' })}>
            <Plus size={12} />
          </button>
        </div>
      ))}

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
                zh: '这条是镜像自动生成的 —— 删掉保存后会按源公式重新长出来。要真去掉,得去删它的源。',
                en: 'This one is mirror-generated — it will come back on save. Delete its source instead.',
              })
            : tr({ zh: '删除在保存后才生效。', en: 'Takes effect when you save.' })}
          onCancel={() => setPending(null)}
          onConfirm={() => { removeAlg(pending.oi, pending.uid); setPending(null); }}
        />
      )}
    </div>
  );
});

AlgEditor.displayName = 'AlgEditor';
export default AlgEditor;
