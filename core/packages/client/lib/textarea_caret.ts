import { editorText, textPointAtOffset, type AlgEditorElement } from './alg-editor-dom';
/**
 * Compute the (left, top) of the caret inside a <textarea>, using the
 * well-known mirror-div technique: clone the textarea's text content into a
 * hidden div with identical box & font styles, place a marker span at the
 * caret offset, and measure the span's position.
 *
 * Returns coordinates relative to the textarea's offsetParent (so the popup
 * can be position:absolute inside the same offsetParent).
 */

const MIRROR_PROPS: (keyof CSSStyleDeclaration)[] = [
  'boxSizing', 'width', 'height',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
  'fontStretch', 'fontSizeAdjust', 'fontKerning',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign', 'textIndent',
  'textDecoration', 'textTransform', 'whiteSpace', 'wordWrap', 'wordBreak',
  'overflowWrap',
];

let MIRROR: HTMLDivElement | null = null;

function getMirror(): HTMLDivElement {
  if (MIRROR) return MIRROR;
  MIRROR = document.createElement('div');
  MIRROR.setAttribute('aria-hidden', 'true');
  MIRROR.style.position = 'absolute';
  MIRROR.style.visibility = 'hidden';
  MIRROR.style.pointerEvents = 'none';
  MIRROR.style.top = '0';
  MIRROR.style.left = '-9999px';
  MIRROR.style.overflow = 'hidden';
  document.body.appendChild(MIRROR);
  return MIRROR;
}

export interface CaretRect {
  /** Left of the caret in the textarea's local (offsetParent-relative) coords. */
  left: number;
  /** Top of the caret. */
  top: number;
  /** Line height — caller can place popup just below this caret line. */
  lineHeight: number;
}

export function getCaretRect(ta: AlgEditorElement, caretIndex: number): CaretRect {
  if (!(ta instanceof HTMLTextAreaElement)) {
    const point = textPointAtOffset(ta, caretIndex, 'backward');
    if (point) {
      const range = document.createRange();
      range.setStart(point.node, point.offset);
      range.collapse(true);
      const rect = range.getClientRects()[0];
      if (rect) {
        const box = ta.getBoundingClientRect();
        const style = getComputedStyle(ta);
        return { left: rect.left - box.left + ta.offsetLeft, top: rect.top - box.top + ta.offsetTop, lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 };
      }
    }
  }
  const mirror = getMirror();
  const cs = window.getComputedStyle(ta);
  for (const prop of MIRROR_PROPS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mirror.style as any)[prop] = (cs as any)[prop];
  }
  // Don't show scrollbars in the mirror — we want full content height.
  mirror.style.overflow = 'hidden';
  const before = editorText(ta).substring(0, caretIndex);
  const marker = document.createElement('span');
  marker.textContent = '​'; // zero-width space, won't affect line height
  mirror.textContent = before.replace(/\n$/, '\n ');
  mirror.appendChild(marker);

  // Account for textarea scroll offset
  const left = marker.offsetLeft - ta.scrollLeft + ta.offsetLeft;
  const top = marker.offsetTop - ta.scrollTop + ta.offsetTop;
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  // Cleanup
  mirror.removeChild(marker);
  mirror.textContent = '';

  return { left, top, lineHeight };
}
