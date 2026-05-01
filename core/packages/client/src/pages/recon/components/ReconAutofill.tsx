/**
 * Inline autofill popup for the recon solution textarea.
 *
 * Two modes:
 *
 *   - **comment**: typed `//` on a line that has at least one move before it
 *     (or on a fresh line). Pops a list of canonical labels: insp, cross,
 *     1st pair…4th pair, OLL, PLL, etc. Already-used labels are filtered out.
 *
 *   - **alg**: previous line ends with a stage label (`// 1st pair`, `// OLL`,
 *     etc.), and the user is on a new line about to type. Pops a list of algs
 *     from the algdb library, ranked by how well they advance the cube state
 *     to the target stage.
 *
 * UX (mirrors cubedb.net):
 *   - Tab / Enter on the highlighted entry: insert.
 *   - Up / Down: change selection.
 *   - Esc: dismiss.
 *   - Click an entry: insert.
 *   - Click outside or blur: dismiss.
 */

import {
  useEffect, useMemo, useRef, useState, useCallback,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getCaretRect } from '../../../utils/textarea_caret';
import { cubeFromAlg, applyAlg, cloneCube, type CubeState } from '../../../utils/cube3_sim';
import { rankAlgs, type AlgSuggestion, type Stage } from '../../../utils/recon_alg_match';
import { loadAlgdb, type AlgdbFile, type AlgdbCategory } from '@cuberoot/shared';
import { MiniCube } from '../../algdb/MiniCube';
import './ReconAutofill.css';

/** Canonical comment labels we suggest (in order). */
const COMMENT_LABEL_GROUPS = [
  { kind: 'inspection', labels: ['insp'] },
  { kind: 'cross',      labels: ['cross', 'W cross', 'Y cross', 'xCross'] },
  { kind: 'pair',       labels: ['1st pair', '2nd pair', '3rd pair', '4th pair'] },
  { kind: 'll',         labels: ['OLL', 'OLL Skip', 'OCLL', 'COLL', 'PLL', 'PLL Skip', 'EPLL', 'OLS', 'WV', 'SV', 'VLS', 'ZBLL'] },
] as const;

/** Stage detection — given a comment label, infer what alg category to suggest. */
function stageForLabel(label: string): { stage: Stage; category: AlgdbCategory; pairIndex?: number } | null {
  const lc = label.toLowerCase().trim();
  // Pair X
  const pairMatch = lc.match(/^(1st|2nd|3rd|4th|first|second|third|fourth)\s+pair$/);
  if (pairMatch) {
    const map: Record<string, number> = {
      '1st': 1, 'first': 1, '2nd': 2, 'second': 2, '3rd': 3, 'third': 3, '4th': 4, 'fourth': 4,
    };
    const idx = map[pairMatch[1]];
    return { stage: { kind: 'pair', index: idx }, category: 'f2l', pairIndex: idx };
  }
  if (/pair$/.test(lc)) {
    // Generic "GR pair", "Green Red Pair" etc. — treat as F2L
    return { stage: { kind: 'pair', index: 0 }, category: 'f2l' };
  }
  if (lc === 'oll' || lc === 'ocll' || lc === 'coll' || lc === 'cmll') {
    return { stage: { kind: 'oll' }, category: 'oll' };
  }
  if (lc === 'pll' || lc === 'epll') {
    return { stage: { kind: 'pll' }, category: 'pll' };
  }
  if (lc === 'cross' || lc === 'w cross' || lc === 'y cross' || /cross$/.test(lc)) {
    // No 'cross' library — skip alg suggestions for cross
    return null;
  }
  return null;
}

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  setValue: (next: string) => void;
  /** WCA scramble — applied as the base before the user's moves. */
  scramble: string;
  /** Show comment popup at all? (false = disable) */
  enabled?: boolean;
}

interface CommentPopupState {
  kind: 'comment';
  query: string;       // text typed after // on this line
  insertAt: number;    // index where the inserted label should go
  /** Caret-relative position (top is below the caret) */
  pos: { left: number; top: number; lineHeight: number };
}

interface AlgPopupState {
  kind: 'alg';
  /** Cube state before the next alg (pre-state). */
  preState: CubeState;
  category: AlgdbCategory;
  stage: Stage;
  /** Position to insert the chosen alg (typically: just before the trailing newline of the comment line, on a fresh line) */
  insertAt: number;
  /** Caret-relative position */
  pos: { left: number; top: number; lineHeight: number };
}

type PopupState = CommentPopupState | AlgPopupState | null;

/** Get the line number + line text + offset where it begins, for a given caret index. */
function lineAt(text: string, idx: number): { lineStart: number; lineText: string } {
  let lineStart = idx;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = idx;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;
  return { lineStart, lineText: text.substring(lineStart, lineEnd) };
}

/** Find the comment label of the previous non-empty line (returns the label text without `//`) */
function previousLineCommentLabel(text: string, lineStart: number): string | null {
  let p = lineStart - 1; // skip the \n
  if (p < 0) return null;
  // Walk up over blank lines
  while (p > 0) {
    let ls = p;
    while (ls > 0 && text[ls - 1] !== '\n') ls--;
    const line = text.substring(ls, p);
    const trimmed = line.trim();
    if (trimmed) {
      // Look for // X
      const m = trimmed.match(/\/\/\s*(.+?)\s*$/);
      return m ? m[1] : null;
    }
    p = ls - 1; // jump to previous newline
    if (p <= 0) break;
  }
  return null;
}

/** Strip comments + non-move tokens, return moves only (linear). Used to rebuild pre-state. */
function movesUntil(text: string, idx: number): string {
  const before = text.substring(0, idx);
  const lines = before.split('\n');
  const cleaned: string[] = [];
  for (const line of lines) {
    const cidx = line.indexOf('//');
    const part = (cidx >= 0 ? line.substring(0, cidx) : line).trim();
    if (part) cleaned.push(part);
  }
  // Strip parens — keep contents (we ignore (..)N expansion — overestimates state, but fine for prefix)
  return cleaned.join(' ').replace(/[()]/g, ' ');
}

const POPUP_MAX_HEIGHT = 280;
const POPUP_WIDTH = 320;

export default function ReconAutofill({ textareaRef, value, setValue, scramble, enabled = true }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [popup, setPopup] = useState<PopupState>(null);
  const [selected, setSelected] = useState(0);
  const [algSuggestions, setAlgSuggestions] = useState<AlgSuggestion[] | null>(null);
  const [algLoading, setAlgLoading] = useState(false);
  const dbCacheRef = useRef<Partial<Record<AlgdbCategory, AlgdbFile>>>({});

  const closePopup = useCallback(() => {
    setPopup(null);
    setAlgSuggestions(null);
    setSelected(0);
  }, []);

  /** Recompute popup state from current caret position. */
  const recompute = useCallback(() => {
    if (!enabled) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const { lineStart, lineText } = lineAt(value, caret);

    // Comment popup: caret is after `//` on the current line
    const slashIdx = lineText.indexOf('//');
    if (slashIdx >= 0 && (caret - lineStart) >= slashIdx + 2) {
      const query = lineText.substring(slashIdx + 2, caret - lineStart).trim();
      // Trigger only if query is short (avoid disrupting typing of long comments)
      if (query.length <= 20) {
        const rect = getCaretRect(ta, caret);
        setPopup({
          kind: 'comment',
          query,
          insertAt: caret,
          pos: rect,
        });
        setSelected(0);
        return;
      }
    }

    // Alg popup: caret is on a line with no `//` AND previous line ends in a stage comment AND current line is empty/whitespace OR contains some moves
    if (slashIdx < 0) {
      const beforeCaret = lineText.substring(0, caret - lineStart);
      const prevLabel = previousLineCommentLabel(value, lineStart);
      if (prevLabel && /^[\s​]*$/.test(beforeCaret)) {
        // User just newlined after `// 1st pair` — show alg picker
        const stageInfo = stageForLabel(prevLabel);
        if (stageInfo) {
          const moves = movesUntil(value, lineStart);
          let pre = cubeFromAlg(scramble || '');
          pre = applyAlg(pre, moves);
          const rect = getCaretRect(ta, caret);
          setPopup({
            kind: 'alg',
            preState: pre,
            category: stageInfo.category,
            stage: stageInfo.stage,
            insertAt: caret,
            pos: rect,
          });
          setSelected(0);
          return;
        }
      }
    }

    closePopup();
  }, [textareaRef, value, scramble, enabled, closePopup]);

  // Recompute on value change + on textarea events
  useEffect(() => {
    recompute();
  }, [value, recompute]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onSel = () => recompute();
    ta.addEventListener('click', onSel);
    ta.addEventListener('keyup', onSel);
    ta.addEventListener('select', onSel);
    return () => {
      ta.removeEventListener('click', onSel);
      ta.removeEventListener('keyup', onSel);
      ta.removeEventListener('select', onSel);
    };
  }, [textareaRef, recompute]);

  // Lazy-load alg db when alg popup opens
  useEffect(() => {
    if (popup?.kind !== 'alg') return;
    const cat = popup.category;
    let cancelled = false;
    setAlgLoading(true);
    (async () => {
      let db = dbCacheRef.current[cat];
      if (!db) {
        db = await loadAlgdb(cat);
        dbCacheRef.current[cat] = db;
      }
      if (cancelled) return;
      const ranked = rankAlgs(cloneCube(popup.preState), db.cases, cat, popup.stage, 10);
      // Filter out clearly bad ones (negative score)
      const positive = ranked.filter(r => r.score > 0);
      setAlgSuggestions(positive.length > 0 ? positive : ranked.slice(0, 6));
      setAlgLoading(false);
    })().catch(() => {
      if (!cancelled) setAlgLoading(false);
    });
    return () => { cancelled = true; };
  }, [popup]);

  // Comment label list (filtered)
  const commentItems = useMemo(() => {
    if (popup?.kind !== 'comment') return [];
    const q = popup.query.toLowerCase();
    const used = new Set<string>();
    // Find which labels are already used in `value`
    for (const m of value.matchAll(/\/\/\s*([^/\n]+?)\s*$/gm)) {
      used.add(m[1].toLowerCase().trim());
    }
    const out: { label: string; kind: string }[] = [];
    for (const grp of COMMENT_LABEL_GROUPS) {
      for (const l of grp.labels) {
        const lc = l.toLowerCase();
        if (used.has(lc)) continue;
        if (q && !lc.includes(q)) continue;
        out.push({ label: l, kind: grp.kind });
      }
    }
    return out.slice(0, 12);
  }, [popup, value]);

  // Insert a comment label
  const insertComment = useCallback((label: string) => {
    if (popup?.kind !== 'comment') return;
    const ta = textareaRef.current;
    if (!ta) return;
    // Replace from `//` start to caret (i.e., overwrite the partial query)
    const caret = ta.selectionStart;
    const { lineStart, lineText } = lineAt(value, caret);
    const slashIdx = lineText.indexOf('//');
    if (slashIdx < 0) return;
    const replaceFrom = lineStart + slashIdx;
    const replaceTo = caret;
    const newText = value.substring(0, replaceFrom) + `// ${label}` + value.substring(replaceTo);
    setValue(newText);
    // Set caret to end of inserted comment
    const newCaret = replaceFrom + 3 + label.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
    closePopup();
  }, [popup, textareaRef, value, setValue, closePopup]);

  // Insert an alg
  const insertAlg = useCallback((alg: string) => {
    if (popup?.kind !== 'alg') return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const newText = value.substring(0, caret) + alg + value.substring(caret);
    setValue(newText);
    const newCaret = caret + alg.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
    closePopup();
  }, [popup, textareaRef, value, setValue, closePopup]);

  // Keyboard navigation
  useEffect(() => {
    if (!popup) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const onKey = (e: KeyboardEvent) => {
      if (popup.kind === 'comment') {
        if (commentItems.length === 0) return;
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          insertComment(commentItems[selected].label);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected(s => Math.min(s + 1, commentItems.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected(s => Math.max(s - 1, 0));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closePopup();
        }
      } else {
        if (!algSuggestions || algSuggestions.length === 0) return;
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          insertAlg(algSuggestions[selected].alg);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected(s => Math.min(s + 1, algSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected(s => Math.max(s - 1, 0));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closePopup();
        }
      }
    };
    ta.addEventListener('keydown', onKey);
    return () => ta.removeEventListener('keydown', onKey);
  }, [popup, commentItems, algSuggestions, selected, insertComment, insertAlg, closePopup, textareaRef]);

  // Close on click outside / blur
  useEffect(() => {
    if (!popup) return;
    const onClick = (e: MouseEvent) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const target = e.target as Node;
      if (target === ta) return; // click in textarea is fine — recompute will trigger
      // If click is in popup, swallow (handled by entry buttons)
      if ((target as HTMLElement).closest?.('[data-recon-autofill]')) return;
      closePopup();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [popup, textareaRef, closePopup]);

  if (!popup) return null;

  // Position popup just below caret
  const ta = textareaRef.current;
  if (!ta) return null;
  const taRect = ta.getBoundingClientRect();
  const left = Math.min(taRect.left + popup.pos.left - ta.offsetLeft, window.innerWidth - POPUP_WIDTH - 8);
  const top = taRect.top + popup.pos.top - ta.offsetTop + popup.pos.lineHeight + 4;

  if (popup.kind === 'comment') {
    if (commentItems.length === 0) return null;
    return createPortal(
      <div
        className="recon-autofill"
        data-recon-autofill="1"
        style={{
          position: 'fixed', left, top,
          width: POPUP_WIDTH, maxHeight: POPUP_MAX_HEIGHT,
        }}
      >
        {commentItems.map((it, i) => (
          <button
            key={it.label}
            type="button"
            className={`recon-autofill-row${selected === i ? ' is-selected' : ''}`}
            onMouseDown={e => { e.preventDefault(); insertComment(it.label); }}
            onMouseEnter={() => setSelected(i)}
          >
            <span className="recon-autofill-badge">{isZh ? '注释' : 'COMMENT'}</span>
            <span className="recon-autofill-text">// {it.label}</span>
            {i === 0 && <span className="recon-autofill-tab-hint">Tab</span>}
          </button>
        ))}
      </div>,
      document.body,
    );
  }

  // Alg popup
  return createPortal(
    <div
      className="recon-autofill"
      data-recon-autofill="1"
      style={{
        position: 'fixed', left, top,
        width: POPUP_WIDTH, maxHeight: POPUP_MAX_HEIGHT,
      }}
    >
      {algLoading && <div className="recon-autofill-loading">{isZh ? '排序中…' : 'ranking…'}</div>}
      {!algLoading && algSuggestions && algSuggestions.length === 0 && (
        <div className="recon-autofill-empty">{isZh ? '没有匹配的公式' : 'no matching algs'}</div>
      )}
      {!algLoading && algSuggestions?.map((s, i) => (
        <button
          key={`${s.caseName}-${i}`}
          type="button"
          className={`recon-autofill-row recon-autofill-row--alg${selected === i ? ' is-selected' : ''}`}
          onMouseDown={e => { e.preventDefault(); insertAlg(s.alg); }}
          onMouseEnter={() => setSelected(i)}
        >
          <span className="recon-autofill-badge recon-autofill-badge--alg">{popup.category.toUpperCase().replace('_', ' ')}</span>
          <span className="recon-autofill-thumb">
            <MiniCube
              state={s.preState}
              view={popup.category === 'oll' || popup.category === 'pll' ? 'll' : 'f2l'}
              size={28}
            />
          </span>
          <span className="recon-autofill-text recon-autofill-text--alg">{s.alg}</span>
          {i === 0 && <span className="recon-autofill-tab-hint">Tab</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}
