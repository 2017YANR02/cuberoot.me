/**
 * 公式输入框 — 统一封装 textarea 与 contenteditable 两种底层。
 *
 * - markable=false (默认):textarea,纯文本
 * - markable=true:contenteditable div,支持 <u>/<u.wavy>/<s>/<em> 等 finger-trick 标签
 *
 * 共享:autoSpace、placeholder、onChange、onCaretChange、键盘 target 接入。
 *
 * 用法:
 *   const el = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
 *   const handle = useRef<FormulaInputHandle>(null);
 *   <FormulaInput ref={handle} elementRef={el} markable autoSpace ... />
 *   <CubeVirtualKeyboard target={el} />
 *   ...
 *   handle.current?.getText()  // 提交时取文本
 */
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  type RefObject,
} from 'react';
import { autoSpaceMoves, autoSpaceMovesCE, getTextBeforeCaret, normalizePunctuationTA, normalizePunctuationCE } from '../../utils/formula_autospace';
import { useIsMobile } from '../../hooks/useIsMobile';

export interface FormulaInputHandle {
  /** 纯文本(去标签、去零宽空格、trim) */
  getText(): string;
  /** HTML(含 inline 标签;markable=false 时 = text) */
  getHtml(): string;
  /** 替换内容(markable 模式按 HTML 写入,否则按文本) */
  setText(s: string): void;
  /** caret 在纯文本中的字符位置 */
  getCaretIndex(): number;
  focus(): void;
  /** 拿底层 element(给虚拟键盘 target 用,不要依赖具体类型) */
  getElement(): HTMLTextAreaElement | HTMLDivElement | null;
}

export interface FormulaInputProps {
  initialText?: string;
  /** markable=true 时若提供则按 HTML 初始化;否则用 initialText */
  initialHtml?: string;
  /** 是否支持 finger-trick 标签 → 决定底层是 textarea 还是 div */
  markable?: boolean;
  /** 是否允许 Enter 换行(textarea 默认 true;contenteditable 默认 false) */
  multiline?: boolean;
  /** 启用敲相邻 move 自动加空格 */
  autoSpace?: boolean;
  /** 仅 textarea 模式:内容变化时跟随高度 */
  autoResize?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  spellCheck?: boolean;
  /** 文本/HTML 变化回调 */
  onChange?: (text: string, html: string) => void;
  /** caret 移动回调(给 player 同步等用) */
  onCaretChange?: (text: string, caretIndex: number) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  /** 暴露底层 element 给虚拟键盘 target */
  elementRef?: RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  /** textarea 模式透传的额外属性,如 inputMode */
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode'];
  style?: React.CSSProperties;
}

/** 自动调高 textarea 到内容高度 */
function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

const FormulaInput = forwardRef<FormulaInputHandle, FormulaInputProps>(function FormulaInput(props, ref) {
  const {
    initialText = '',
    initialHtml,
    markable = false,
    multiline = !markable,
    autoSpace = true,
    autoResize = false,
    placeholder,
    className,
    rows = 1,
    spellCheck = false,
    onChange,
    onCaretChange,
    onKeyDown,
    onClick,
    onFocus,
    onBlur,
    elementRef,
    inputMode,
    style,
  } = props;

  // 移动端默认屏蔽系统键盘 (改用站内虚拟键盘);caller 显式传 inputMode 优先
  const isMobile = useIsMobile();
  const effectiveInputMode = inputMode ?? (isMobile ? 'none' : undefined);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const ceRef = useRef<HTMLDivElement | null>(null);

  // NOTE: 把内部 ref 同步到 props.elementRef
  const attachEl = (el: HTMLTextAreaElement | HTMLDivElement | null) => {
    if (markable) ceRef.current = el as HTMLDivElement | null;
    else taRef.current = el as HTMLTextAreaElement | null;
    if (elementRef) {
      (elementRef as { current: HTMLTextAreaElement | HTMLDivElement | null }).current = el;
    }
  };

  // NOTE: 初始化(textarea 用 defaultValue;contenteditable 用 effect 写 innerHTML 一次)
  useEffect(() => {
    if (!markable) return;
    const el = ceRef.current;
    if (el && !el.dataset.inited) {
      el.innerHTML = initialHtml ?? initialText ?? '';
      el.dataset.inited = '1';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: textarea 自动撑高(初始 + 通过 setText 更新后)
  useEffect(() => {
    if (markable || !autoResize) return;
    const el = taRef.current;
    if (el) autoResizeTextarea(el);
  }, [markable, autoResize]);

  useImperativeHandle(ref, () => ({
    getText: () => {
      if (markable) {
        const el = ceRef.current;
        if (!el) return '';
        return (el.textContent ?? '').trim();
      }
      return taRef.current?.value ?? '';
    },
    getHtml: () => {
      if (markable) {
        const el = ceRef.current;
        if (!el) return '';
        return el.innerHTML.trim();
      }
      return taRef.current?.value ?? '';
    },
    setText: (s: string) => {
      if (markable) {
        const el = ceRef.current;
        if (el) el.innerHTML = s;
      } else {
        const el = taRef.current;
        if (el) {
          el.value = s;
          if (autoResize) autoResizeTextarea(el);
        }
      }
    },
    getCaretIndex: () => {
      if (markable) {
        const el = ceRef.current;
        if (!el) return 0;
        return getTextBeforeCaret(el).length;
      }
      return taRef.current?.selectionStart ?? 0;
    },
    focus: () => {
      if (markable) ceRef.current?.focus();
      else taRef.current?.focus();
    },
    getElement: () => (markable ? ceRef.current : taRef.current),
  }), [markable, autoResize]);

  // ── textarea 模式 ──
  if (!markable) {
    return (
      <textarea
        ref={attachEl as (el: HTMLTextAreaElement | null) => void}
        defaultValue={initialText}
        rows={rows}
        spellCheck={spellCheck}
        placeholder={placeholder}
        className={className}
        style={style}
        inputMode={effectiveInputMode}
        onInput={e => {
          const el = e.target as HTMLTextAreaElement;
          const native = e.nativeEvent as InputEvent;
          // 强制英文标点(IME 中文标点立即转)
          normalizePunctuationTA(el);
          if (autoSpace) {
            const adj = autoSpaceMoves(el.value, el.selectionStart ?? 0, native.inputType ?? '');
            if (adj.value !== el.value) {
              el.value = adj.value;
              el.setSelectionRange(adj.cursor, adj.cursor);
            }
          }
          if (autoResize) autoResizeTextarea(el);
          onChange?.(el.value, el.value);
          onCaretChange?.(el.value, el.selectionStart ?? 0);
        }}
        onClick={e => {
          onClick?.(e);
          const el = e.target as HTMLTextAreaElement;
          onCaretChange?.(el.value, el.selectionStart ?? 0);
        }}
        onKeyUp={e => {
          const el = e.target as HTMLTextAreaElement;
          onCaretChange?.(el.value, el.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
  }

  // ── contenteditable 模式 ──
  return (
    <div
      ref={attachEl as (el: HTMLDivElement | null) => void}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={style}
      spellCheck={spellCheck}
      inputMode={effectiveInputMode}
      data-placeholder={placeholder}
      onInput={e => {
        const el = e.target as HTMLDivElement;
        const native = e.nativeEvent as InputEvent;
        // 强制英文标点(IME 中文标点立即转)
        normalizePunctuationCE(el);
        if (autoSpace) {
          autoSpaceMovesCE(el, native.inputType ?? '');
        }
        const text = (el.textContent ?? '');
        const html = el.innerHTML;
        onChange?.(text, html);
        onCaretChange?.(text, getTextBeforeCaret(el).length);
      }}
      onClick={e => {
        onClick?.(e);
        const el = e.currentTarget as HTMLDivElement;
        onCaretChange?.(
          (el.textContent ?? ''),
          getTextBeforeCaret(el).length,
        );
      }}
      onKeyDown={e => {
        if (!multiline && e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
        }
        onKeyDown?.(e);
      }}
      onPaste={e => {
        // NOTE: 只取纯文本,避免外部 HTML 把样式带进来
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
});

export default FormulaInput;
