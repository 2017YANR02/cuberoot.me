'use client';

/**
 * 受控公式输入框的输入清洗 —— **中文输入法开着也只落半角招式**。
 *
 * 网页改不了操作系统的输入法(`ime-mode` 只有 IE / Firefox 认,Chrome 从来不支持,也没有
 * 任何 API 能替用户切回英文),所以不「强制」,而是让它**打不进来**:全角字符转半角、
 * 汉字 / 假名 / 中文标点直接删。规则和边界见 `cleanAlgText`。
 *
 * 两个坑:
 * 1. **组字中别碰 value** —— IME 缓冲区还开着,一改就错乱、字会重复。等 `compositionend`。
 * 2. **受控 textarea 改了 value,光标会被 React 甩到行尾** —— 在中间删掉一个汉字,光标
 *    就跑了。所以洗掉字符时把光标位置记下来,渲染后补回去。
 *
 * 非受控的用 `components/AlgInput`(它自己洗)。
 */
import { useLayoutEffect, useRef } from 'react';
import { cleanAlgText } from '@/lib/alg-autospace';

export function useAlgTextField(setValue: (v: string) => void) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const apply = (el: HTMLTextAreaElement) => {
    const c = cleanAlgText(el.value, el.selectionStart ?? 0);
    if (c.value !== el.value) caret.current = c.cursor;
    setValue(c.value);
  };

  return {
    ref,
    lang: 'en',
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if ((e.nativeEvent as InputEvent).isComposing) { setValue(e.currentTarget.value); return; }
      apply(e.currentTarget);
    },
    onCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => apply(e.currentTarget),
  };
}
