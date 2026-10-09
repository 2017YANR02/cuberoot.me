import type { AlgEntry } from '@cuberoot/shared/alg';
import { editAlgHtmlText, sanitizeAlgHtml } from './alg_html';

/** Preserve hidden finishing moves and metadata when only presentation changed. */
export function editedAlgEntry(original: AlgEntry, initialText: string, initialHtml: string | undefined, text: string, html: string): AlgEntry {
  const cleanHtml = sanitizeAlgHtml(html);
  const marks = (value: string) => /<(u|s|em|strong|sub|sup)\b/i.test(value);
  const sameMarks = !marks(cleanHtml) && !marks(initialHtml ?? '')
    || cleanHtml === sanitizeAlgHtml(initialHtml ?? initialText);
  if (text === initialText && sameMarks) return original;
  const { algHtml: _oldHtml, ...rest } = original;
  const unchangedMoves = text === initialText;
  let algHtml = cleanHtml;
  if (unchangedMoves) {
    let common = 0;
    while (common < initialText.length && initialText[common] === original.alg[common]) common++;
    // Display stripping can remove AUF inside the last group: (R U') -> (R).
    // Restore the canonical ending without moving marks onto hidden moves.
    if (/^[)\s]*$/.test(initialText.slice(common))) {
      algHtml = editAlgHtmlText(cleanHtml, [{ start: common, end: initialText.length, text: original.alg.slice(common) }]);
    }
  }
  return { ...rest, alg: unchangedMoves ? original.alg : text, ...(marks(cleanHtml) ? { algHtml } : {}) };
}
