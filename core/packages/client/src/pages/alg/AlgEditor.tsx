/**
 * 多个 FormulaInput 公式行 + 共享虚拟键盘。
 *
 * 形态: 2D AlgEntry[][] (外层 ori,内层条数)。多 ori 时按 ori 分组显示。
 * 每行用 FormulaInput markable 模式,内部 contenteditable,可有 inline 标签。
 * 提交时:alg = getText(), algHtml = getHtml()(若含标签)。
 */
import { Fragment, useState, useRef, useImperativeHandle, useMemo, forwardRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { AlgEntry, AlgPuzzle } from '@cuberoot/shared';
import CubeVirtualKeyboard from '../../components/CubeVirtualKeyboard';
import FormulaInput, { type FormulaInputHandle } from '../../components/FormulaInput';
import AlgPlayer from '../../components/AlgPlayer';

export interface AlgEditorHandle {
  getValue(): AlgEntry[][];
}

interface Props {
  initialValue: AlgEntry[][];
  oriNames?: string[] | null;
  isZh: boolean;
  /** 给 AlgPlayer 预览用 — case 所属 puzzle / set / setup */
  puzzle: AlgPuzzle;
  setSlug: string;
  setup: string;
}

const AlgEditor = forwardRef<AlgEditorHandle, Props>(({ initialValue, oriNames, isZh, puzzle, setSlug, setup }, ref) => {
  const [layout, setLayout] = useState<AlgEntry[][]>(() => {
    if (initialValue.length === 0) return [[{ alg: '' }]];
    return initialValue.map(ori => (ori.length === 0 ? [{ alg: '' }] : ori));
  });

  const handles = useRef<Map<string, FormulaInputHandle>>(new Map());
  const elements = useRef<Map<string, HTMLTextAreaElement | HTMLDivElement>>(new Map());
  const refKey = (oi: number, ai: number) => `${oi}:${ai}`;

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  /** 实时跟踪当前 focused 行的纯文本,给 AlgPlayer 用 */
  const [currentAlg, setCurrentAlg] = useState('');
  const keyboardTargetRef = useMemo(
    () => ({ current: focusedKey ? (elements.current.get(focusedKey) ?? null) : null }),
    [focusedKey],
  );

  // NOTE: focused 行变化时,同步 currentAlg 给 player
  useEffect(() => {
    if (!focusedKey) { setCurrentAlg(''); return; }
    const h = handles.current.get(focusedKey);
    if (h) setCurrentAlg(h.getText());
  }, [focusedKey]);

  useImperativeHandle(ref, () => ({
    getValue: (): AlgEntry[][] =>
      layout.map((ori, oi) =>
        ori.map((_, ai) => {
          const h = handles.current.get(refKey(oi, ai));
          if (!h) return { alg: '' };
          const text = h.getText();
          const html = h.getHtml();
          if (!text) return { alg: '' };
          const hasTag = /<(u|s|em|strong|sub|sup)\b/i.test(html);
          return hasTag ? { alg: text, algHtml: html } : { alg: text };
        }),
      ),
  }), [layout]);

  const addAlg = (oi: number) => {
    const newAi = layout[oi].length;
    const newKey = refKey(oi, newAi);
    setLayout(L => L.map((ori, i) => (i === oi ? [...ori, { alg: '' }] : ori)));
    // NOTE: 新行渲染完后 focus 它,player + keyboard 立即出现
    requestAnimationFrame(() => {
      const el = elements.current.get(newKey);
      if (el) { el.focus(); setFocusedKey(newKey); }
    });
  };
  const removeAlg = (oi: number, ai: number) => {
    setLayout(L => {
      const ori = L[oi];
      if (ori.length <= 1) return L;
      handles.current.delete(refKey(oi, ai));
      elements.current.delete(refKey(oi, ai));
      // NOTE: 重排:被删行之后的索引也要前移
      for (let j = ai + 1; j < ori.length; j++) {
        const oldH = handles.current.get(refKey(oi, j));
        const oldE = elements.current.get(refKey(oi, j));
        handles.current.delete(refKey(oi, j));
        elements.current.delete(refKey(oi, j));
        if (oldH) handles.current.set(refKey(oi, j - 1), oldH);
        if (oldE) elements.current.set(refKey(oi, j - 1), oldE);
      }
      return L.map((o, i) => (i === oi ? o.filter((_, k) => k !== ai) : o));
    });
  };


  return (
    <div className="alg-editor">
      {layout.map((ori, oi) => (
        <div key={oi} className="alg-editor-ori">
          {oriNames && oriNames[oi] && (
            <div className="alg-editor-ori-name">{oriNames[oi]}</div>
          )}
          {ori.map((entry, ai) => {
            const k = refKey(oi, ai);
            const isFocused = focusedKey === k;
            return (
              <Fragment key={k}>
                {isFocused && (
                  <div className="alg-editor-player">
                    <AlgPlayer alg={currentAlg} puzzle={puzzle} set={setSlug} setup={setup} size={220} />
                  </div>
                )}
              <div className="alg-editor-row">
                <FormulaInput
                  ref={(h: FormulaInputHandle | null) => {
                    if (h) {
                      handles.current.set(k, h);
                      const el = h.getElement();
                      if (el) elements.current.set(k, el);
                    } else {
                      handles.current.delete(k);
                      elements.current.delete(k);
                    }
                  }}
                  markable
                  multiline={false}
                  autoSpace
                  initialText={entry.alg || ''}
                  initialHtml={entry.algHtml}
                  placeholder={isZh ? "如 R U R' U'" : "e.g. R U R' U'"}
                  className="alg-editor-input"
                  spellCheck={false}
                  onFocus={() => setFocusedKey(k)}
                  onBlur={e => {
                    // NOTE: focus 仍在 AlgEditor 内(切到另一行 / 键盘按钮)不清;
                    // 只有跳出整个 editor 才隐藏 player + keyboard
                    const next = e.relatedTarget as HTMLElement | null;
                    if (next && next.closest('.alg-editor')) return;
                    setFocusedKey(prev => (prev === k ? null : prev));
                  }}
                  onChange={text => { if (focusedKey === k) setCurrentAlg(text); }}
                  onKeyDown={e => {
                    // NOTE: Enter 不换行,而是加新公式行 + 焦点跳过去
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addAlg(oi);
                      requestAnimationFrame(() => {
                        const nk = refKey(oi, ai + 1);
                        const next = elements.current.get(nk);
                        if (next) { next.focus(); setFocusedKey(nk); }
                      });
                    }
                  }}
                />
                {ori.length > 1 && (
                  <button
                    type="button"
                    className="alg-editor-del"
                    onClick={() => removeAlg(oi, ai)}
                    title={isZh ? '删此条' : 'Remove'}
                    tabIndex={-1}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
                {isFocused && (
                  <CubeVirtualKeyboard target={keyboardTargetRef} enableMarks />
                )}
              </Fragment>
            );
          })}
          <button type="button" className="alg-editor-add" onClick={() => addAlg(oi)} tabIndex={-1}>
            <Plus size={12} /> {isZh ? '加一条' : 'Add'}
          </button>
        </div>
      ))}
    </div>
  );
});

AlgEditor.displayName = 'AlgEditor';
export default AlgEditor;
