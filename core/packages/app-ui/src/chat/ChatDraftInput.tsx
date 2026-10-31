import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type KeyboardEventHandler } from 'react';
import { splitChatExpressions, type ChatExpressionPack } from './ChatMessageText';

export interface ChatDraftInputHandle {
  readonly selectionStart: number;
  readonly selectionEnd: number;
  setSelectionRange(start: number, end: number): void;
  focus(): void;
  blur(): void;
}

/** Convert only editor-owned expression atoms to their lossless wire tokens. */
export function readChatDraft(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLElement) {
    if (node.dataset.chatToken) return node.dataset.chatToken;
    if (node.tagName === 'BR') return '\n';
  }
  let text = '';
  for (const child of node.childNodes) {
    const block = child instanceof HTMLElement && /^(DIV|P)$/.test(child.tagName);
    if (block && child.previousSibling) text += '\n';
    const emptyBlock = block && child.childNodes.length === 1 && child.firstChild instanceof HTMLBRElement;
    if (!emptyBlock) text += readChatDraft(child);
  }
  return text;
}

export const ChatDraftInput = forwardRef<ChatDraftInputHandle, {
  value: string;
  packs: ChatExpressionPack[];
  disabled: boolean;
  label: string;
  onChange(value: string): void;
  onCompositionStart(): void;
  onCompositionEnd(): void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}>(function ChatDraftInput({ value, packs, disabled, label, onChange, onCompositionStart, onCompositionEnd, onKeyDown }, ref) {
  const element = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const selection = useRef({ start: value.length, end: value.length });
  const pendingSelection = useRef(false);
  const rememberSelection = () => {
    const root = element.current;
    const selected = window.getSelection();
    if (!root || !selected?.rangeCount) return;
    const range = selected.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const prefix = document.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = readChatDraft(prefix.cloneContents()).length;
    prefix.setEnd(range.endContainer, range.endOffset);
    selection.current = { start, end: readChatDraft(prefix.cloneContents()).length };
  };
  const restoreSelection = () => {
    const root = element.current;
    if (!root) return;
    const point = (offset: number): [Node, number] => {
      let remaining = offset;
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes[i];
        const length = readChatDraft(node).length;
        if (remaining <= length) {
          if (node.nodeType === Node.TEXT_NODE) return [node, remaining];
          return [root, i + (remaining > 0 ? 1 : 0)];
        }
        remaining -= length;
      }
      return [root, root.childNodes.length];
    };
    const range = document.createRange();
    range.setStart(...point(selection.current.start));
    range.setEnd(...point(selection.current.end));
    const selected = window.getSelection();
    selected?.removeAllRanges(); selected?.addRange(range);
  };
  useImperativeHandle(ref, () => ({
    get selectionStart() { if (!pendingSelection.current) rememberSelection(); return selection.current.start; },
    get selectionEnd() { if (!pendingSelection.current) rememberSelection(); return selection.current.end; },
    setSelectionRange(start, end) {
      selection.current = { start, end };
      pendingSelection.current = end > readChatDraft(element.current ?? document.createDocumentFragment()).length;
      if (!pendingSelection.current) restoreSelection();
    },
    focus() { element.current?.focus(); restoreSelection(); },
    blur() { rememberSelection(); element.current?.blur(); },
  }));
  useLayoutEffect(() => {
    const root = element.current;
    if (!root || composing.current) return;
    const focused = document.activeElement === root;
    if (focused && !pendingSelection.current) rememberSelection();
    const parts = splitChatExpressions(value, packs);
    const expressions = parts.filter(part => typeof part !== 'string');
    const atoms = [...root.querySelectorAll<HTMLElement>('[data-chat-token]')];
    const flat = [...root.childNodes].every(node => node.nodeType === Node.TEXT_NODE || node instanceof HTMLElement && !!node.dataset.chatToken);
    // Leave native text edits intact, including the browser undo stack.
    if (flat && readChatDraft(root) === value && atoms.length === expressions.length
      && atoms.every((atom, index) => atom.dataset.chatToken === expressions[index].token
        && atom.querySelector('img')?.getAttribute('src') === expressions[index].src)) {
      if (pendingSelection.current) restoreSelection();
      pendingSelection.current = false;
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (typeof part === 'string') fragment.append(document.createTextNode(part));
      else {
        const atom = document.createElement('span');
        atom.setAttribute('contenteditable', 'false'); atom.dataset.chatToken = part.token;
        const image = document.createElement('img');
        image.src = part.src; image.alt = part.token; image.draggable = false;
        image.className = part.large ? 'friend-chat-pet-expression' : 'friend-chat-inline-expression';
        atom.append(image); fragment.append(atom);
      }
    }
    root.replaceChildren(fragment);
    if (focused || pendingSelection.current) restoreSelection();
    pendingSelection.current = false;
  }, [value, packs]);
  const publish = () => {
    rememberSelection();
    if (element.current) onChange(element.current.innerHTML === '<br>' ? '' : readChatDraft(element.current));
  };
  const insert = (text: string) => {
    rememberSelection();
    const { start, end } = selection.current;
    selection.current = { start: start + text.length, end: start + text.length };
    pendingSelection.current = true;
    onChange(value.slice(0, start) + text + value.slice(end));
  };
  return <div ref={element} id="friend-chat-message" className="friend-chat-input" role="textbox" aria-label={label}
    aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning
    onInput={() => { if (!composing.current) publish(); }}
    onSelect={rememberSelection} onBlur={rememberSelection} onMouseUp={rememberSelection} onKeyUp={rememberSelection}
    onCompositionStart={() => { composing.current = true; onCompositionStart(); }}
    onCompositionEnd={() => { composing.current = false; onCompositionEnd(); publish(); }}
    onPaste={event => { event.preventDefault(); if (!disabled) insert(event.clipboardData.getData('text/plain')); }}
    onDrop={event => event.preventDefault()}
    onCopy={event => { rememberSelection(); event.preventDefault(); event.clipboardData.setData('text/plain', value.slice(selection.current.start, selection.current.end)); }}
    onCut={event => { rememberSelection(); event.preventDefault(); event.clipboardData.setData('text/plain', value.slice(selection.current.start, selection.current.end)); if (!disabled) insert(''); }}
    onKeyDown={event => {
      onKeyDown(event);
      if (!event.defaultPrevented && event.key === 'Enter' && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) {
        event.preventDefault(); insert('\n');
      }
    }} />;
});
