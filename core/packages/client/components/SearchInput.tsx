'use client';

// IME 安全的受控文本搜索框。中文 / 日文等输入法在「合成」拼音途中,若每次按键就把值写回
// 一个会触发重渲染的外部 store(尤其 nuqs / URL、节流 store),重渲染会打断 IME 合成,
// 把 bei 拼成乱码。本组件用本地态承接显示,只在「非合成中」才回调 onChange,合成结束
// (compositionend)再提交一次。任何写 nuqs / 节流 store 的自由文本输入都该用它,别再裸写
// <input value={q} onChange={e => setQ(e.target.value)} />。CI 守卫:tests/ime-safe-search-input.test.ts。
import { useEffect, useRef, useState, type KeyboardEventHandler } from 'react';
import { ClearButton } from '@/components/ClearButton';

interface SearchInputProps {
  value: string;
  /** 已提交的值(IME 合成结束后才回调);直接喂给 setQ / 节流 setter 即可。 */
  onChange: (v: string) => void;
  /** 输入停止后再查询;默认即时回调,清空始终立即生效。 */
  debounceMs?: number;
  placeholder?: string;
  ariaLabel?: string;
  /** 外层 wrapper 类(布局 / flex 宽度由调用方给)。 */
  className?: string;
  /** input 自身类(内边距 / 字号 / 边框)。 */
  inputClassName?: string;
  /** 非空时显示行内清除 ×,默认开。 */
  clearable?: boolean;
  type?: 'text' | 'search';
  autoFocus?: boolean;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  maxLength?: number;
  name?: string;
  // 代码 / 记号类输入(打乱、alg)常要关掉拼写检查 / 自动补全 / 首字母大写。
  spellCheck?: boolean;
  autoComplete?: string;
  autoCapitalize?: string;
}

export function SearchInput({
  value, onChange, placeholder, ariaLabel, className, inputClassName,
  clearable = true, type = 'text', autoFocus, name,
  onFocus, onKeyDown, maxLength, spellCheck, autoComplete, autoCapitalize, debounceMs = 0,
}: SearchInputProps) {
  // 本地显示态:合成途中外部 value 的回灌不覆盖它(否则打断 IME)。
  const [text, setText] = useState(value);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitted = useRef<string | null>(null);
  const cancelPending = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => {
    // URL store 可能稍后回传上次提交的值,不要让这次回传覆盖新输入。
    const isEcho = value === emitted.current;
    emitted.current = null;
    if (isEcho) return;
    cancelPending();
    if (!composing.current) setText(value);
  }, [value]);
  useEffect(() => cancelPending, []);
  const commit = (v: string) => {
    setText(v);
    cancelPending();
    if (composing.current) return;
    const emit = () => { emitted.current = v; onChange(v); };
    if (debounceMs > 0 && v.trim()) {
      timer.current = setTimeout(() => { timer.current = null; emit(); }, debounceMs);
    } else emit();
  };
  return (
    <span
      className={['search-input', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <input
        type={type}
        name={name}
        value={text}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (!composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) onKeyDown?.(event);
        }}
        maxLength={maxLength}
        onChange={(e) => commit(e.target.value)}
        onCompositionStart={() => { composing.current = true; cancelPending(); }}
        onCompositionEnd={(e) => { composing.current = false; commit(e.currentTarget.value); }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={[
          'search-control',
          clearable && text ? 'search-control--with-clear' : '',
          inputClassName,
        ].filter(Boolean).join(' ')}
        spellCheck={spellCheck}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
      />
      {clearable && text && (
        <ClearButton onClick={() => { composing.current = false; commit(''); }} variant="inline" />
      )}
    </span>
  );
}

export default SearchInput;
