'use client';

import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef } from 'react';
import AlgInput, { type AlgInputHandle, type AlgInputProps } from './AlgInput';
import { algHtmlText, editAlgHtmlText } from '@/lib/alg_html';

/** Only the suffix is editable; editor handles still expose the full algorithm. */
export const AlgEditorPrefix = createContext('');
export default forwardRef<AlgInputHandle, AlgInputProps>(function AlgEditorProjectedInput(props, ref) {
  const prefix = useContext(AlgEditorPrefix);
  const input = useRef<AlgInputHandle>(null);
  const hidden = useRef({ text: '', html: '' });
  useEffect(() => {
    const handle = input.current;
    if (!handle) return;
    const fullHtml = hidden.current.html + handle.getHtml();
    const fullText = algHtmlText(fullHtml);
    const wanted = prefix && fullText.startsWith(prefix + ' ') ? prefix + ' ' : '';
    if (wanted === hidden.current.text) return;
    hidden.current = { text: wanted, html: wanted
      ? editAlgHtmlText(fullHtml, [{ start: wanted.length, end: fullText.length, text: '' }]) : '' };
    handle.setText(wanted ? editAlgHtmlText(fullHtml, [{ start: 0, end: wanted.length, text: '' }]) : fullHtml);
  }, [prefix]);
  useImperativeHandle(ref, () => ({
    getText: () => hidden.current.text + (input.current?.getText() ?? ''),
    getHtml: () => hidden.current.html + (input.current?.getHtml() ?? ''),
    setText: value => input.current?.setText(hidden.current.text && value.startsWith(hidden.current.text) ? value.slice(hidden.current.text.length) : value),
    getCaretIndex: () => hidden.current.text.length + (input.current?.getCaretIndex() ?? 0),
    focus: () => input.current?.focus(),
    getElement: () => input.current?.getElement() ?? null,
  }), []);
  return <AlgInput {...props} ref={input}
    onChange={(text, html) => props.onChange?.(hidden.current.text + text, hidden.current.html + html)}
    onCaretChange={(text, caret) => props.onCaretChange?.(hidden.current.text + text, hidden.current.text.length + caret)} />;
});
