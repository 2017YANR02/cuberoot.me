'use client';
/**
 * 公式输入框 — 统一封装 textarea 与 contenteditable 两种底层。
 * Ported from packages/client-vite/src/components/AlgInput/AlgInput.tsx
 *
 * - markable=false (默认):textarea,纯文本
 * - markable=true:contenteditable div,支持 finger-trick 标签
 * 移动端默认 inputMode='none' 屏蔽系统键盘 — 改走站内 CubeKeyboardSection。
 */
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  type RefObject,
} from 'react';
import {
  autoSpaceMoves, autoSpaceMovesCE, getTextBeforeCaret,
  cleanAlgText, cleanAlgTextCE,
  autoSpaceAfterComment, autoCloseBracket,
} from '@/lib/alg-autospace';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface AlgInputHandle {
  getText(): string;
  getHtml(): string;
  setText(s: string): void;
  getCaretIndex(): number;
  focus(): void;
  getElement(): HTMLTextAreaElement | HTMLDivElement | null;
}

export interface AlgInputProps {
  initialText?: string;
  initialHtml?: string;
  markable?: boolean;
  multiline?: boolean;
  autoSpace?: boolean;
  autoResize?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  spellCheck?: boolean;
  onChange?: (text: string, html: string) => void;
  onCaretChange?: (text: string, caretIndex: number) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  elementRef?: RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode'];
  style?: React.CSSProperties;
  title?: string;
}

function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

const AlgInput = forwardRef<AlgInputHandle, AlgInputProps>(function AlgInput(props, ref) {
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
    title,
  } = props;

  const isMobile = useIsMobile();
  const effectiveInputMode = inputMode ?? (isMobile ? 'none' : undefined);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const ceRef = useRef<HTMLDivElement | null>(null);

  const attachEl = (el: HTMLTextAreaElement | HTMLDivElement | null) => {
    if (markable) ceRef.current = el as HTMLDivElement | null;
    else taRef.current = el as HTMLTextAreaElement | null;
    if (elementRef) {
      (elementRef as { current: HTMLTextAreaElement | HTMLDivElement | null }).current = el;
    }
  };

  useEffect(() => {
    if (!markable) return;
    const el = ceRef.current;
    if (el && !el.dataset.inited) {
      el.innerHTML = initialHtml ?? initialText ?? '';
      el.dataset.inited = '1';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** 洗一遍 + 自动加空格 + 回调。组字**结束后**也要走一遍(那时候字才真正落进 value)。 */
  const runTextareaInput = (el: HTMLTextAreaElement, inputType: string) => {
    // 全角 / 中日韩 / 零宽字符输入即洗,不进数据(中文输入法开着也能打;见 cleanAlgText)
    const c = cleanAlgText(el.value, el.selectionStart ?? 0);
    if (c.value !== el.value) {
      el.value = c.value;
      el.setSelectionRange(c.cursor, c.cursor);
    }
    if (autoSpace) {
      let adj = autoSpaceMoves(el.value, el.selectionStart ?? 0, inputType);
      adj = autoSpaceAfterComment(adj.value, adj.cursor, inputType);
      adj = autoCloseBracket(adj.value, adj.cursor, inputType);
      if (adj.value !== el.value) {
        el.value = adj.value;
        el.setSelectionRange(adj.cursor, adj.cursor);
      }
    }
    if (autoResize) autoResizeTextarea(el);
    onChange?.(el.value, el.value);
    onCaretChange?.(el.value, el.selectionStart ?? 0);
  };

  const runCeInput = (el: HTMLDivElement, inputType: string) => {
    cleanAlgTextCE(el);
    if (autoSpace) autoSpaceMovesCE(el, inputType);
    const text = el.textContent ?? '';
    onChange?.(text, el.innerHTML);
    onCaretChange?.(text, getTextBeforeCaret(el).length);
  };

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
        title={title}
        inputMode={effectiveInputMode}
        lang="en"
        onInput={e => {
          const el = e.target as HTMLTextAreaElement;
          const native = e.nativeEvent as InputEvent;
          // 组字中(IME 缓冲区还开着):**别碰 value** —— 一改缓冲区就错乱、字会重复。
          // 等 compositionend,那时候字落地了再洗。
          if (native.isComposing) return;
          runTextareaInput(el, native.inputType ?? '');
        }}
        onCompositionEnd={e => runTextareaInput(e.currentTarget, 'insertText')}
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

  return (
    <div
      ref={attachEl as (el: HTMLDivElement | null) => void}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={style}
      title={title}
      spellCheck={spellCheck}
      inputMode={effectiveInputMode}
      data-placeholder={placeholder}
      lang="en"
      onInput={e => {
        const el = e.target as HTMLDivElement;
        const native = e.nativeEvent as InputEvent;
        if (native.isComposing) return; // 见 textarea 分支:组字中别碰内容
        runCeInput(el, native.inputType ?? '');
      }}
      onCompositionEnd={e => runCeInput(e.currentTarget as HTMLDivElement, 'insertText')}
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
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
});

export default AlgInput;
