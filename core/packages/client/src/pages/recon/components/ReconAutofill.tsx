/**
 * Cubedb.net-style autofill for the recon solution textarea.
 *
 * **Trigger:** Tab key when focus is in the textarea. We always preventDefault
 * — Tab never moves focus out of the textarea. This matches cubedb's behavior.
 *
 * **Comment popup:** opens when Tab is pressed and the current line either
 *   - has typed moves but no `//` yet, OR
 *   - is `x'` / `x'<space>` style (inspection rotation only).
 *   The popup contents are derived from the cube-state diff between the end
 *   of the previous labeled line and the end of the current line. We mirror
 *   cubedb's three-form aliases for F2L pairs (ordinal / 2-letter / full color)
 *   plus a `(N)` move-count variant for each.
 *
 * **Alg popup:** opens when Tab is pressed on a fresh blank line directly
 *   after a labeled line. Filters algdb candidates by what (if anything) the
 *   user already typed on the line via cubing.js Move-by-Move prefix matching.
 *
 * **Inside the popup:**
 *   - Tab / mouse click / Enter on highlighted: accept (insert at caret).
 *   - ArrowUp / ArrowDown: navigate. Wraps.
 *   - Esc / blur / outside click: close.
 *   - Continuing to type characters: re-derives query and updates the popup.
 */

import {
  useCallback, useEffect, useRef, useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getCaretRect } from '../../../utils/textarea_caret';
import { patternFromAlg, countMoves, isAlgPrefix } from '../../../utils/cube3';
import { detectStage } from '../../../utils/stage_detect';
import { buildCommentSuggestions } from '../../../utils/popup_suggest';
import { loadAlgdb, type AlgdbCategory, type AlgdbFile } from '@cuberoot/shared';
import './ReconAutofill.css';

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  setValue: (next: string) => void;
  /** WCA scramble — applied as the base before the user's moves. */
  scramble: string;
  enabled?: boolean;
}

interface AnchorPos { left: number; top: number; lineHeight: number }

interface CommentPopup {
  kind: 'comment';
  /** Where the popup is anchored (caret-relative coords). */
  pos: AnchorPos;
  /** Suggestion entries (the strings the user sees). */
  entries: string[];
  /** Where in `value` to insert/replace. The chosen entry replaces from
   *  `replaceFrom` to caret (so any partial `// xx` already typed gets
   *  overwritten). */
  replaceFrom: number;
  caret: number;
}

interface AlgPopup {
  kind: 'alg';
  pos: AnchorPos;
  entries: { text: string; category: AlgdbCategory; caseName: string }[];
  /** Insertion point: where the chosen alg goes (caret position). */
  insertAt: number;
}

type Popup = CommentPopup | AlgPopup | null;

/** Parse "x' // insp\nL D R..." — return start/end of the line containing `idx`. */
function lineRange(text: string, idx: number): { start: number; end: number } {
  let s = idx;
  while (s > 0 && text[s - 1] !== '\n') s--;
  let e = idx;
  while (e < text.length && text[e] !== '\n') e++;
  return { start: s, end: e };
}

/** Strip comments + paren grouping, return a string with only move tokens. */
function movesOnly(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return (i >= 0 ? line.substring(0, i) : line);
    })
    .join(' ')
    .replace(/[()]/g, ' ')
    // Strip non-move annotations (regrip arrows, etc.)
    .replace(/[↑↓·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Number of pair labels that already appeared in the text before `endOffset`. */
function countPriorPairs(text: string, endOffset: number): number {
  const before = text.substring(0, endOffset);
  // Match `// (1st|2nd|3rd|4th|GR|...|<color> <color>) pair[s]?`
  const m = before.match(/\/\/\s*([1-4]\w*\s+pair|\w{2}\s+Pair|\w+\s+\w+\s+Pair)/gi);
  return m ? m.length : 0;
}

/**
 * Main hook + JSX renderer. Always renders into a portal so positioning isn't
 * constrained by the textarea's containing layout.
 */
export default function ReconAutofill({ textareaRef, value, setValue, scramble, enabled = true }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [popup, setPopup] = useState<Popup>(null);
  const [selected, setSelected] = useState(0);
  const dbCacheRef = useRef<Partial<Record<AlgdbCategory, AlgdbFile>>>({});
  const lastBuildKeyRef = useRef<string>('');

  const close = useCallback(() => {
    setPopup(null);
    setSelected(0);
  }, []);

  /** Build a CommentPopup for the current line state. */
  const buildCommentPopup = useCallback(async (caret: number): Promise<CommentPopup | null> => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const { start, end } = lineRange(value, caret);
    const lineUpToCaret = value.substring(start, caret);
    const fullLine = value.substring(start, end);

    // Where will we insert the chosen entry? Replace from start of any partial `//`
    // (so user can begin typing `// 1` and have us replace with `// 1st pair`).
    const slashIdx = lineUpToCaret.indexOf('//');
    const replaceFrom = slashIdx >= 0 ? start + slashIdx : caret;

    // Compute moves-only text up to and including this line's moves
    // (everything in `value` from start..caret minus comments).
    const linesBefore = value.substring(0, start);
    const linesUpToHere = value.substring(0, end);
    const prevMoves = movesOnly(linesBefore);
    const currMoves = movesOnly(linesUpToHere);

    // Count how many move tokens are on JUST this line (for the (N) suffix).
    const thisLineMovesText = movesOnly(fullLine);
    const moveCount = countMoves(thisLineMovesText);
    const lineHasMoves = moveCount > 0;

    // Apply scramble + prev moves → prevPattern; +current line moves → currPattern.
    const prevAlg = [scramble, prevMoves].filter(Boolean).join(' ');
    const currAlg = [scramble, currMoves].filter(Boolean).join(' ');
    const prevPattern = await patternFromAlg(prevAlg);
    const currPattern = await patternFromAlg(currAlg);

    const pairsBeforeLine = countPriorPairs(value, start);
    const entries = await buildCommentSuggestions({
      prevPattern,
      currPattern,
      lineHasMoves,
      moveCount,
      pairsBeforeLine,
    });

    if (entries.length === 0) return null;

    const rect = getCaretRect(ta, caret);
    return {
      kind: 'comment',
      pos: rect,
      entries,
      replaceFrom,
      caret,
    };
  }, [textareaRef, value, scramble]);

  /** Build an AlgPopup for the current line. */
  const buildAlgPopup = useCallback(async (caret: number): Promise<AlgPopup | null> => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const { start } = lineRange(value, caret);
    const lineUpToCaret = value.substring(start, caret);
    if (lineUpToCaret.includes('//')) return null;

    // Walk back to find the previous labeled line.
    let p = start - 1;
    let prevLabel: string | null = null;
    while (p >= 0) {
      const ls = (() => { let s = p; while (s > 0 && value[s - 1] !== '\n') s--; return s; })();
      const line = value.substring(ls, p);
      const m = line.match(/\/\/\s*(.+?)\s*$/);
      if (m) { prevLabel = m[1]; break; }
      p = ls - 1;
    }
    if (!prevLabel) return null;

    // Determine target category
    const lc = prevLabel.toLowerCase();
    let category: AlgdbCategory;
    if (/oll/.test(lc) || /cmll/.test(lc)) category = 'oll';
    else if (/pll/.test(lc) || /epll/.test(lc)) category = 'pll';
    else if (/pair/.test(lc) || /cross/.test(lc)) category = 'f2l';
    else return null;

    // Determine the cube state at start of current line
    const linesBefore = value.substring(0, start);
    const prevMoves = movesOnly(linesBefore);
    const lineMovesUpToCaret = movesOnly(value.substring(start, caret));
    const stageBeforeLine = await detectStage(await patternFromAlg([scramble, prevMoves].filter(Boolean).join(' ')));
    void stageBeforeLine;

    // Lazy-load algdb
    let db = dbCacheRef.current[category];
    if (!db) {
      db = await loadAlgdb(category);
      dbCacheRef.current[category] = db;
    }

    // Flatten alg list and filter by user's typed prefix
    const candidates: { text: string; category: AlgdbCategory; caseName: string }[] = [];
    const seen = new Set<string>();
    for (const c of db.cases) {
      if (c.standard && !seen.has(c.standard)) {
        candidates.push({ text: c.standard, category, caseName: c.name });
        seen.add(c.standard);
      }
      for (const ori of c.algs) {
        for (const e of ori) {
          if (!seen.has(e.alg)) {
            candidates.push({ text: e.alg, category, caseName: c.name });
            seen.add(e.alg);
          }
        }
      }
    }
    const filtered = candidates.filter(c => isAlgPrefix(lineMovesUpToCaret, c.text));
    // Sort by length (shorter first), tie-break by case name
    filtered.sort((a, b) => a.text.length - b.text.length || a.caseName.localeCompare(b.caseName));
    const top = filtered.slice(0, 12);
    if (top.length === 0) return null;

    const rect = getCaretRect(ta, caret);
    return { kind: 'alg', pos: rect, entries: top, insertAt: caret };
  }, [textareaRef, value, scramble]);

  /** Open popup based on current caret state. Called from Tab handler. */
  const openPopup = useCallback(async () => {
    if (!enabled) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const { start, end } = lineRange(value, caret);
    const lineUpToCaret = value.substring(start, caret);
    const fullLine = value.substring(start, end);

    // If line has any `//` already with the caret AFTER it, treat as comment popup
    // (user might be filtering by partial query).
    const slashIdx = lineUpToCaret.indexOf('//');
    if (slashIdx >= 0) {
      const p = await buildCommentPopup(caret);
      if (p) {
        setPopup(p);
        setSelected(0);
        return;
      }
    }

    // If line has moves but no `//`, comment popup
    const movesLineText = movesOnly(fullLine);
    if (movesLineText.length > 0 && !lineUpToCaret.includes('//')) {
      const p = await buildCommentPopup(caret);
      if (p) {
        setPopup(p);
        setSelected(0);
        return;
      }
    }

    // Otherwise try alg popup (fresh blank line after labeled line)
    if (movesLineText.length === 0 || !lineUpToCaret.includes('//')) {
      const p = await buildAlgPopup(caret);
      if (p) {
        setPopup(p);
        setSelected(0);
        return;
      }
    }

    // Nothing to suggest — leave popup closed but DO NOT let Tab escape the textarea.
    close();
  }, [enabled, textareaRef, value, buildCommentPopup, buildAlgPopup, close]);

  /** Live-update popup as user types (after it's open). */
  useEffect(() => {
    if (!popup) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const key = `${value}\x00${caret}\x00${popup.kind}`;
    if (key === lastBuildKeyRef.current) return;
    lastBuildKeyRef.current = key;

    let cancelled = false;
    (async () => {
      const next = popup.kind === 'comment'
        ? await buildCommentPopup(caret)
        : await buildAlgPopup(caret);
      if (cancelled) return;
      if (next) {
        setPopup(next);
        setSelected(s => Math.min(s, next.entries.length - 1));
      } else {
        close();
      }
    })();
    return () => { cancelled = true; };
  }, [value, popup, textareaRef, buildCommentPopup, buildAlgPopup, close]);

  // Tab interception: ALWAYS preventDefault while focus is in textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Tab always handled by us — never let it escape the textarea.
        e.preventDefault();
        if (popup && popup.entries.length > 0) {
          const entry = popup.entries[selected];
          if (popup.kind === 'comment') {
            const text = typeof entry === 'string' ? entry : '';
            insertComment(text, popup);
          } else {
            const alg = typeof entry === 'string' ? entry : entry.text;
            insertAlg(alg, popup);
          }
        } else {
          openPopup();
        }
        return;
      }
      if (!popup) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected(s => (s + 1) % popup.entries.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(s => (s - 1 + popup.entries.length) % popup.entries.length);
      } else if (e.key === 'Enter') {
        // Cubedb behavior: Enter doesn't accept; it inserts newline (default).
        // Popup will close and re-open on the new line.
        // Allow default behavior.
      }
    };
    ta.addEventListener('keydown', onKey);
    return () => ta.removeEventListener('keydown', onKey);
  }, [textareaRef, popup, selected, openPopup, close]);

  // Click outside / blur closes popup
  useEffect(() => {
    if (!popup) return;
    const onClick = (e: MouseEvent) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const target = e.target as HTMLElement;
      if (target === ta) return;
      if (target.closest?.('[data-recon-autofill]')) return;
      close();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [popup, textareaRef, close]);

  const insertComment = useCallback((text: string, p: CommentPopup) => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Replace from `replaceFrom` to caret with the chosen text. Add a leading
    // space if needed (so `<moves>` becomes `<moves> // ...`).
    const before = value.substring(0, p.replaceFrom);
    const after = value.substring(p.caret);
    const needsSpace = p.replaceFrom > 0
      && before[p.replaceFrom - 1] !== ' '
      && before[p.replaceFrom - 1] !== '\n';
    const insertion = (needsSpace ? ' ' : '') + text;
    const next = before + insertion + after;
    setValue(next);
    const newCaret = p.replaceFrom + insertion.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
    close();
  }, [value, setValue, textareaRef, close]);

  const insertAlg = useCallback((alg: string, p: AlgPopup) => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Insert at caret, then continue typing.
    const before = value.substring(0, p.insertAt);
    const after = value.substring(p.insertAt);
    const next = before + alg + after;
    setValue(next);
    const newCaret = p.insertAt + alg.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
    close();
  }, [value, setValue, textareaRef, close]);

  if (!popup) return null;

  // Position popup relative to caret
  const ta = textareaRef.current;
  if (!ta) return null;
  const taRect = ta.getBoundingClientRect();
  const POPUP_WIDTH = 320;
  const left = Math.min(
    taRect.left + popup.pos.left - ta.offsetLeft,
    window.innerWidth - POPUP_WIDTH - 8,
  );
  const top = taRect.top + popup.pos.top - ta.offsetTop + popup.pos.lineHeight + 4;

  return createPortal(
    <div
      className="recon-autofill"
      data-recon-autofill="1"
      style={{ position: 'fixed', left, top, width: POPUP_WIDTH, maxHeight: 280 }}
    >
      {popup.entries.map((entry, i) => {
        const text = typeof entry === 'string' ? entry : entry.text;
        const cat = typeof entry === 'string' ? null : entry.category;
        return (
          <button
            key={i}
            type="button"
            className={`recon-autofill-row${selected === i ? ' is-selected' : ''}`}
            onMouseDown={e => {
              e.preventDefault();
              if (popup.kind === 'comment') insertComment(text, popup);
              else insertAlg(text, popup);
            }}
            onMouseEnter={() => setSelected(i)}
          >
            <span className="recon-autofill-badge">
              {popup.kind === 'comment' ? (isZh ? '注释' : 'COMMENT') : (cat?.toUpperCase().replace('_', ' ') ?? 'F2L')}
            </span>
            <span className="recon-autofill-text">{text}</span>
            {i === selected && <span className="recon-autofill-tab-hint">Tab</span>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
