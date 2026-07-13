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
import { X, Plus } from 'lucide-react';
import type { AlgEntry } from '@cuberoot/shared';
import CubeKeyboardSection from '@/components/CubeKeyboardSection';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import { tr } from '@/i18n/tr';

export interface AlgEditorHandle {
  getValue(): AlgEntry[][];
}

interface Props {
  initialValue: AlgEntry[][];
  oriNames?: string[] | null;
  /** 当前聚焦行的纯文本(无聚焦则空)—— 父组件用来驱动左侧 AlgPlayer */
  onCurrentAlgChange?: (alg: string) => void;
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

const AlgEditor = forwardRef<AlgEditorHandle, Props>(({ initialValue, oriNames, onCurrentAlgChange, onCursorMoveCount }, ref) => {
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
    onCurrentAlgChange?.(currentAlg);
  }, [currentAlg, onCurrentAlgChange]);

  useImperativeHandle(ref, () => ({
    getValue: (): AlgEntry[][] =>
      layout.map(ori =>
        ori.map(row => {
          // 这个编辑器只管 alg / algHtml 两个字段。AlgEntry 上其余的东西(altId、ytId、
          // 以及 1LLL 带来的 tags / source / stm / sqtm)它**不认识,但必须原样带回去** ——
          // 重建成 `{ alg }` 就等于编一次 case 把它们全抹掉,而且是静默的。
          const { uid: _uid, alg: _alg, algHtml: _algHtml, ...rest } = row;
          const h = handles.current.get(row.uid);
          if (!h) return { ...rest, alg: '' };
          const text = h.getText();
          if (!text) return { ...rest, alg: '' };
          const html = h.getHtml();
          const hasTag = /<(u|s|em|strong|sub|sup)\b/i.test(html);
          return hasTag ? { ...rest, alg: text, algHtml: html } : { ...rest, alg: text };
        }),
      ),
  }), [layout]);

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

  return (
    <div className="alg-editor">
      {layout.map((ori, oi) => (
        <div key={oi} className="alg-editor-ori">
          {oriNames && oriNames[oi] && (
            <div className="alg-editor-ori-name">{oriNames[oi]}</div>
          )}
          {ori.map(row => {
            const isFocused = focusedUid === row.uid;
            return (
              <Fragment key={row.uid}>
              <div className="alg-editor-row">
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
                  initialText={row.alg || ''}
                  initialHtml={row.algHtml}
                  placeholder={tr({ zh: "如 R U R' U'", en: "e.g. R U R' U'" })}
                  className="alg-editor-input"
                  spellCheck={false}
                  onFocus={() => setFocusedUid(row.uid)}
                  onBlur={e => {
                    const next = e.relatedTarget as HTMLElement | null;
                    if (next && next.closest('.alg-editor')) return;
                    setFocusedUid(prev => (prev === row.uid ? null : prev));
                  }}
                  onChange={text => { if (focusedUid === row.uid) setCurrentAlg(text); }}
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
                    onClick={() => removeAlg(oi, row.uid)}
                    title={tr({ zh: '删此条', en: 'Remove' })}
                    tabIndex={-1}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
                {isFocused && (
                  <CubeKeyboardSection target={keyboardTargetRef} enableMarks />
                )}
              </Fragment>
            );
          })}
          <button type="button" className="alg-editor-add" onClick={() => addAlg(oi)} tabIndex={-1}>
            <Plus size={12} /> {tr({ zh: '加一条', en: 'Add' })}
          </button>
        </div>
      ))}
    </div>
  );
});

AlgEditor.displayName = 'AlgEditor';
export default AlgEditor;
