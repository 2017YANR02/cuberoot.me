'use client';

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
import { X } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { getCaretRect } from '@/lib/textarea_caret';
import { isAlgPrefix } from '@/lib/cube3';
import { buildCommentSuggestions } from '@/lib/popup_suggest';
import { detectStage } from '@/lib/stage_detect';
import { suggestAlg, movesOnly, lineRange, resolveCommentPopupState } from '@/lib/recon_autofill_core';
import { computeFirstStage, getCachedFirstStage, type FirstStageResult, type FirstStageSet } from '@/lib/recon_first_stage';
import type { Alg3x3Set } from '@cuberoot/shared/alg';
import './ReconAutofill.css';
import { tr } from '@/i18n/tr';

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  setValue: (next: string) => void;
  /** WCA scramble — applied as the base before the user's moves. */
  scramble: string;
  enabled?: boolean;
  /** 手机端在第一行 Tab hint 槽位上显示 ✕ 关闭按钮(桌面 Tab hint 与之互斥)。 */
  isMobile?: boolean;
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
  /** Cube state after this line's moves is fully solved — used to suppress
   *  the trailing newline on accept (no point landing on a fresh line when
   *  there's nothing left to recon). */
  solved: boolean;
  /** 行号——光标移到不同行时关闭 popup(避免显示陈旧候选)。 */
  lineIdx: number;
  /** 由用户主动 Tab 触发(开启「cancel into」前瞻);重建时需沿用,否则会被自动逻辑清掉。 */
  explicit: boolean;
}

interface AlgPopup {
  kind: 'alg';
  pos: AnchorPos;
  entries: { text: string; category: Alg3x3Set | FirstStageSet; caseName: string }[];
  /** Insertion point: where the chosen alg goes (caret position). */
  insertAt: number;
  /** When entries is empty, render a single non-clickable info row with this i18n key. */
  emptyReasonKey?: string;
  /** 行号——光标移到不同行时关闭 popup(避免显示陈旧候选)。 */
  lineIdx: number;
  /** 首阶段(cross/xcross/xxcross)候选:走 WASM 引擎、按已缓存集做前缀过滤,不再问 suggestAlg。 */
  firstStage?: boolean;
  /** 首阶段引擎首次计算(含 27MB 表加载)期间显示加载行。 */
  loading?: boolean;
}

type Popup = CommentPopup | AlgPopup | null;

// 首阶段(无十字)候选按阶段分 3 列展示:cross / xcross / xxcross。
const FIRST_STAGE_COLS: FirstStageSet[] = ['cross', 'xcross', 'xxcross'];

/** 把首阶段 popup 的扁平 entries 按类别分成 [cross, xcross, xxcross] 三列(每列是 entries 的下标)。 */
function firstStageColumns(entries: AlgPopup['entries']): number[][] {
  return FIRST_STAGE_COLS.map(cat => {
    const out: number[] = [];
    entries.forEach((e, i) => { if (e.category === cat) out.push(i); });
    return out;
  });
}

/** 三列内 2D 方向键导航:←→ 切列(cross/xcross/xxcross),↑↓ 列内移动。返回新的扁平下标。 */
function navFirstStage(cols: number[][], selected: number, key: string): number {
  let col = cols.findIndex(c => c.includes(selected));
  if (col < 0) col = cols.findIndex(c => c.length > 0);
  if (col < 0) return selected;
  let row = Math.max(0, cols[col].indexOf(selected));
  const sideways = (dir: number): void => {
    for (let k = 0; k < cols.length; k++) {
      col = (col + dir + cols.length) % cols.length;
      if (cols[col].length > 0) break;
    }
    row = Math.min(row, cols[col].length - 1);
  };
  if (key === 'ArrowDown') row = Math.min(row + 1, cols[col].length - 1);
  else if (key === 'ArrowUp') row = Math.max(row - 1, 0);
  else if (key === 'ArrowLeft') sideways(-1);
  else if (key === 'ArrowRight') sideways(1);
  return cols[col][row] ?? selected;
}

/**
 * Main hook + JSX renderer. Always renders into a portal so positioning isn't
 * constrained by the textarea's containing layout.
 */
export default function ReconAutofill({ textareaRef, value, setValue, scramble, enabled = true, isMobile = false }: Props) {
  const { t } = useTranslation();
  const [popup, setPopup] = useState<Popup>(null);
  const [selected, setSelected] = useState(0);
  const lastBuildKeyRef = useRef<string>('');
  // NOTE: 自动弹出 — 用户在某行 Esc / 点外部主动关闭后,记住该行的行号,直到 caret
  // 移到别的行才允许自动重开;同行继续输入也不再骚扰。
  const dismissedLineIdxRef = useRef<number | null>(null);
  const lastAutoOpenKeyRef = useRef<string>('');
  // 首阶段(cross/xcross/xxcross)引擎异步求解的代次令牌:加载期间用户继续操作时丢弃过期结果。
  const firstStageTokenRef = useRef(0);
  // 光标位置版本号:caret 移动本身不改 value(parent 的 onCaretChange 只 sync 播放器),
  // 而 auto-open effect 的依赖里没有 caret,所以「单纯移动光标到某行行尾」原本不触发自动弹窗
  // (典型:回车把一行拆成两行后,把光标移回上一行行尾)。把 caret 变化提成版本号喂给 auto-open。
  const [caretVersion, setCaretVersion] = useState(0);

  const close = useCallback(() => {
    setPopup(null);
    setSelected(0);
  }, []);

  /** 关掉并记住当前行,跟 Esc 行为一致 — 同行不再骚扰,换行后才能重开。 */
  const dismiss = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      const caret = ta.selectionStart;
      dismissedLineIdxRef.current = (ta.value.substring(0, caret).match(/\n/g) ?? []).length;
    }
    close();
  }, [textareaRef, close]);

  /** Build a CommentPopup for the current line state. `explicit` = 用户主动 Tab(开 cancel-into 前瞻)。 */
  const buildCommentPopup = useCallback(async (caret: number, explicit = false): Promise<CommentPopup | null> => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const { prevPattern, currPattern, lineMovesText, prevMovesText, moveCount, replaceFrom } =
      await resolveCommentPopupState(scramble, value, caret);

    const entries = await buildCommentSuggestions({
      prevPattern,
      currPattern,
      lineMovesText,
      prevMovesText,
      moveCount,
      explicit,
    });

    if (entries.length === 0) return null;

    const currStage = await detectStage(currPattern);
    const rect = getCaretRect(ta, caret);
    const lineIdx = (value.substring(0, caret).match(/\n/g) ?? []).length;
    return {
      kind: 'comment',
      pos: rect,
      entries,
      replaceFrom,
      caret,
      solved: currStage.stage === 'solved',
      lineIdx,
      explicit,
    };
  }, [textareaRef, value, scramble]);

  /** Build an AlgPopup for the current line. */
  const buildAlgPopup = useCallback(async (caret: number): Promise<AlgPopup | null> => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const result = await suggestAlg(scramble, value, caret);
    if (!result) return null;
    const rect = getCaretRect(ta, caret);
    const lineIdx = (value.substring(0, caret).match(/\n/g) ?? []).length;
    if (result.kind === 'empty') {
      return {
        kind: 'alg',
        pos: rect,
        entries: [],
        insertAt: caret,
        emptyReasonKey: result.reasonKey,
        lineIdx,
      };
    }
    return {
      kind: 'alg',
      pos: rect,
      entries: result.suggestions.map(s => ({ text: s.text, category: s.category, caseName: s.caseName })),
      insertAt: caret,
      lineIdx,
    };
  }, [textareaRef, value, scramble]);

  /** Build a first-stage (cross/xcross/xxcross) AlgPopup from an engine result,
   *  prefix-filtered by whatever moves the user already typed on the line. */
  const buildFirstStagePopup = useCallback((caret: number, res: FirstStageResult): AlgPopup => {
    const ta = textareaRef.current!;
    const rect = getCaretRect(ta, caret);
    const lineIdx = (value.substring(0, caret).match(/\n/g) ?? []).length;
    if (res.kind === 'empty') {
      return { kind: 'alg', pos: rect, entries: [], insertAt: caret, emptyReasonKey: res.reasonKey, lineIdx, firstStage: true };
    }
    const { start } = lineRange(value, caret);
    const typed = movesOnly(value.substring(start, caret));
    const entries = res.suggestions
      .filter(s => isAlgPrefix(typed, s.text))
      .map(s => ({ text: s.text, category: s.category, caseName: s.caseName }));
    return { kind: 'alg', pos: rect, entries, insertAt: caret, lineIdx, firstStage: true };
  }, [textareaRef, value]);

  /** Explicit-Tab entry to first-stage suggestions: instant from cache, else
   *  show a loading row while the engine (and its ~27MB tables) spin up. */
  const openFirstStage = useCallback(async (caret: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { start } = lineRange(value, caret);
    const prevMoves = movesOnly(value.substring(0, start));
    const cached = getCachedFirstStage(scramble, prevMoves);
    if (cached) {
      setPopup(buildFirstStagePopup(caret, cached));
      setSelected(0);
      return;
    }
    const rect = getCaretRect(ta, caret);
    const lineIdx = (value.substring(0, caret).match(/\n/g) ?? []).length;
    setPopup({ kind: 'alg', pos: rect, entries: [], insertAt: caret, lineIdx, firstStage: true, loading: true });
    setSelected(0);
    const myToken = ++firstStageTokenRef.current;
    const res = await computeFirstStage(scramble, prevMoves);
    if (firstStageTokenRef.current !== myToken) return; // superseded by a newer action
    const ta2 = textareaRef.current;
    if (!ta2 || document.activeElement !== ta2) return;
    const caret2 = ta2.selectionStart;
    // Still on the same (no-cross) line with no comment? show results.
    const { start: s2, end: e2 } = lineRange(ta2.value, caret2);
    if (ta2.value.substring(s2, caret2).includes('//')) return;
    if (!/^\s*$/.test(ta2.value.substring(caret2, e2))) return;
    setPopup(buildFirstStagePopup(caret2, res));
    setSelected(0);
  }, [textareaRef, value, scramble, buildFirstStagePopup]);

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
      const p = await buildCommentPopup(caret, true);
      if (p) {
        setPopup(p);
        setSelected(0);
        return;
      }
    }

    // If line has moves but no `//`, comment popup
    const movesLineText = movesOnly(fullLine);
    if (movesLineText.length > 0 && !lineUpToCaret.includes('//')) {
      const p = await buildCommentPopup(caret, true);
      if (p) {
        setPopup(p);
        setSelected(0);
        return;
      }
    }

    // Otherwise try alg popup (fresh blank line after labeled line)
    if (movesLineText.length === 0 || !lineUpToCaret.includes('//')) {
      const p = await buildAlgPopup(caret);
      // No cross yet → there's no OLL/PLL/F2L to match; fall back to the
      // analyzer engine for optimal cross / xcross / xxcross suggestions.
      if (p && p.kind === 'alg' && p.entries.length === 0
        && (p.emptyReasonKey === 'recon.autofill.empty.no_cross'
          || p.emptyReasonKey === 'recon.autofill.empty.pscross')) {
        await openFirstStage(caret);
        return;
      }
      if (p) {
        setPopup(p);
        setSelected(0);
        return;
      }
    }

    // Nothing to suggest — leave popup closed but DO NOT let Tab escape the textarea.
    close();
  }, [enabled, textareaRef, value, buildCommentPopup, buildAlgPopup, openFirstStage, close]);

  // 监听光标移动:value 不变时(方向键 / 点击 / 拆行后移回上一行行尾)也能驱动下面的
  // auto-open effect 重新求值。仅在 textarea 聚焦时记数,避免无关 selection 触发渲染。
  useEffect(() => {
    if (!enabled) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const onSel = () => {
      if (document.activeElement === ta) setCaretVersion(v => v + 1);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [enabled, textareaRef]);

  /**
   * Auto-open popup as user types — matches cubedb.net behavior.
   * - Comment popup: line has moves (or already has `//`).
   * - Alg popup: empty line, and only if there are real suggestions
   *   (suppress the empty-reason info popups; those are only worth
   *   showing on explicit Tab).
   * Skipped on a line the user just dismissed; reset when caret moves to
   * a different line.
   */
  useEffect(() => {
    if (!enabled) return;
    if (popup) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;

    const lineIdx = (value.substring(0, caret).match(/\n/g) ?? []).length;
    if (dismissedLineIdxRef.current === lineIdx) return;
    if (dismissedLineIdxRef.current !== null) dismissedLineIdxRef.current = null;

    const { start, end } = lineRange(value, caret);
    const fullLine = value.substring(start, end);
    const lineUpToCaret = value.substring(start, caret);
    const movesLineText = movesOnly(fullLine);
    const hasSlash = lineUpToCaret.includes('//'); // 光标已越过 //
    const fullLineHasSlash = fullLine.includes('//'); // 整行已含 // (可能在光标后)
    const hasMoves = movesLineText.length > 0;

    // 行已经写完注释、光标只是停在 moves 段中间 → 不自动弹(已经有完整解读了,
    // 用户只是在浏览/光标定位)。光标越过 // 进入注释段时仍允许 auto-open 用于过滤。
    if (fullLineHasSlash && !hasSlash) return;

    // 光标必须停在行尾(后面只剩空白)才允许 auto-open —— 鼠标点到 moves 中间
    // 是浏览/编辑既有内容,不需要建议。
    const lineFromCaret = value.substring(caret, end);
    if (!/^\s*$/.test(lineFromCaret)) return;

    const key = `${value}\x00${caret}`;
    if (key === lastAutoOpenKeyRef.current) return;
    lastAutoOpenKeyRef.current = key;

    let cancelled = false;
    (async () => {
      let p: CommentPopup | AlgPopup | null = null;
      if (hasSlash || hasMoves) {
        p = await buildCommentPopup(caret);
      } else {
        const ap = await buildAlgPopup(caret);
        if (ap && ap.entries.length > 0) p = ap;
      }
      if (cancelled) return;
      if (p) {
        setPopup(p);
        setSelected(0);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, value, scramble, popup, caretVersion, textareaRef, buildCommentPopup, buildAlgPopup]);

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
      // 首阶段 popup:用已缓存的引擎结果按新前缀即时重过滤,绝不重跑 WASM 求解。
      if (popup.kind === 'alg' && popup.firstStage) {
        if (popup.loading) return; // 仍在首次计算,等 openFirstStage 收尾
        const { start } = lineRange(value, caret);
        const prevMoves = movesOnly(value.substring(0, start));
        const cached = getCachedFirstStage(scramble, prevMoves);
        if (cancelled) return;
        if (!cached) { close(); return; }
        const rebuilt = buildFirstStagePopup(caret, cached);
        if (rebuilt.entries.length === 0) { close(); return; }
        setPopup(rebuilt);
        setSelected(s => Math.min(s, rebuilt.entries.length - 1));
        return;
      }
      const next = popup.kind === 'comment'
        ? await buildCommentPopup(caret, popup.explicit)
        : await buildAlgPopup(caret);
      if (cancelled) return;
      // alg 空态(没匹配的提示文本)只在手动 Tab 触发时给反馈;边打边过滤遇到没
      // 匹配就静默关掉,不要骚扰用户("没有公式以你输入的开头"半成品时无意义)
      const isEmptyAlg = next && next.kind === 'alg' && next.entries.length === 0;
      if (next && !isEmptyAlg) {
        setPopup(next);
        setSelected(s => Math.min(s, next.entries.length - 1));
      } else {
        close();
      }
    })();
    return () => { cancelled = true; };
  }, [value, scramble, popup, textareaRef, buildCommentPopup, buildAlgPopup, buildFirstStagePopup, close]);

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
        } else if (popup && popup.kind === 'alg' && popup.emptyReasonKey) {
          // Popup is in the empty-reason state — second Tab dismisses it.
          close();
        } else {
          openPopup();
        }
        return;
      }
      if (!popup) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        const caret = ta.selectionStart;
        dismissedLineIdxRef.current = (ta.value.substring(0, caret).match(/\n/g) ?? []).length;
        close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // 首阶段三列:←→ 切 cross/xcross/xxcross 列,↑↓ 列内移动。
        if (popup.kind === 'alg' && popup.firstStage && popup.entries.length > 0) {
          e.preventDefault();
          const cols = firstStageColumns(popup.entries);
          setSelected(s => navFirstStage(cols, s, e.key));
          return;
        }
        // 其余 popup:仅 ↑↓ 循环扁平列表;←/→ 保留默认(移动光标)。
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (popup.entries.length === 0) return;
          setSelected(s => (s + 1) % popup.entries.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (popup.entries.length === 0) return;
          setSelected(s => (s - 1 + popup.entries.length) % popup.entries.length);
        }
      } else if (e.key === 'Enter') {
        // Cubedb behavior: Enter doesn't accept; it inserts newline (default).
        // Popup will close and re-open on the new line.
        // Allow default behavior.
      }
    };
    ta.addEventListener('keydown', onKey);
    return () => ta.removeEventListener('keydown', onKey);
  }, [textareaRef, popup, selected, openPopup, close]);

  // 光标在 textarea 内移动到不同行时(点击别处 / 方向键)关闭 popup —
  // popup 锚定在打开时的那行,跨行候选已陈旧。同行内移动不关(用户可能在编辑当前行)。
  useEffect(() => {
    if (!popup) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const checkCaret = () => {
      if (document.activeElement !== ta) return;
      const caret = ta.selectionStart;
      const v = ta.value;
      const lineIdx = (v.substring(0, caret).match(/\n/g) ?? []).length;
      if (lineIdx !== popup.lineIdx) { close(); return; }
      // 同行内但光标离开行尾(后面有非空白) → 关掉 popup
      let lineEnd = caret;
      while (lineEnd < v.length && v[lineEnd] !== '\n') lineEnd++;
      const tail = v.substring(caret, lineEnd);
      if (!/^\s*$/.test(tail)) close();
    };
    document.addEventListener('selectionchange', checkCaret);
    return () => document.removeEventListener('selectionchange', checkCaret);
  }, [popup, textareaRef, close]);

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
    // space if needed (so `<moves>` becomes `<moves> // ...`). Position the
    // caret on the next line afterward — append a `\n` if there isn't one,
    // otherwise advance past the existing one. Matches cubedb behavior.
    // EXCEPTION: when this line completes the solve, don't append `\n` and
    // don't advance — the recon is finished, no point dropping the user on
    // a fresh empty line that would only attract a "no algs left" popup.
    const before = value.substring(0, p.replaceFrom);
    const after = value.substring(p.caret);
    const needsSpace = p.replaceFrom > 0
      && before[p.replaceFrom - 1] !== ' '
      && before[p.replaceFrom - 1] !== '\n';
    const hasTrailingNewline = after.startsWith('\n');
    const appendNewline = !p.solved && !hasTrailingNewline;
    const insertion = (needsSpace ? ' ' : '') + text + (appendNewline ? '\n' : '');
    const next = before + insertion + after;
    setValue(next);
    // If solved → land at end of comment (no advancement). Otherwise advance
    // onto the next line (past the newline we just inserted, or past any that
    // was already there).
    const advancePastExisting = !p.solved && hasTrailingNewline;
    const newCaret = p.replaceFrom + insertion.length + (advancePastExisting ? 1 : 0);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
    // 接受注释后本行视为「已读完」——记成 dismissed,否则 auto-open 会立刻拿同一条注释
    // 再弹一次(尤其最后一行 solved:caret 不前进,会无限重弹同一条 // PLL-Xx)。
    // 用注释所在行的行号:非 solved 时 caret 已前进到下一行,auto-open 检到行号不同会
    // 自动清掉该标记并照常给下一行的 alg 建议。
    dismissedLineIdxRef.current = (value.substring(0, p.caret).match(/\n/g) ?? []).length;
    close();
  }, [value, setValue, textareaRef, close]);

  const insertAlg = useCallback((alg: string, p: AlgPopup) => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Suggestion is the FULL alg (including any prefix the user already
    // typed). Replace from line-start through caret so the typed prefix is
    // overwritten — otherwise selecting "R U R' U' L' U R U' L" while user
    // typed "R U " would produce duplicated moves.
    const { start } = lineRange(value, p.insertAt);
    const before = value.substring(0, start);
    const after = value.substring(p.insertAt);
    const next = before + alg + after;
    setValue(next);
    const newCaret = start + alg.length;
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
  // 首阶段(cross/xcross/xxcross)三列展示:固定占满分配宽度让三列均分;其余 popup 仍按内容自适应。
  const isCols = popup.kind === 'alg' && !!popup.firstStage && popup.entries.length > 0;
  // 弹窗宽度自适应内容(width:max-content),不再死锁 320:桌面右侧有空间就一行铺开,
  // 只有贴近右边缘 / 手机端放不下时才收窄到可用宽度并由 CSS 换行。
  const GUTTER = 8;
  const HARD_MAX = isCols ? 760 : 680;
  const MIN_W = isCols ? 360 : 280;
  const caretLeft = Math.max(0, taRect.left + popup.pos.left - ta.offsetLeft);
  const roomRight = window.innerWidth - caretLeft - GUTTER;
  let left: number;
  let maxWidth: number;
  if (roomRight >= MIN_W) {
    left = caretLeft;                                  // 锚在光标处
    maxWidth = Math.min(HARD_MAX, roomRight);
  } else {
    maxWidth = Math.min(HARD_MAX, window.innerWidth - 2 * GUTTER);
    left = Math.max(GUTTER, window.innerWidth - GUTTER - maxWidth);  // 贴右边缘
  }
  const top = taRect.top + popup.pos.top - ta.offsetTop + popup.pos.lineHeight + 4;

  const emptyReasonKey = popup.kind === 'alg' ? popup.emptyReasonKey : undefined;
  const loading = popup.kind === 'alg' && popup.loading;
  const colData = isCols && popup.kind === 'alg' ? firstStageColumns(popup.entries) : null;

  return createPortal(
    <div
      className="recon-autofill"
      data-recon-autofill="1"
      style={{ position: 'fixed', left, top, width: isCols ? maxWidth : 'max-content', maxWidth, maxHeight: 280 }}
    >
      {loading && (
        <div className="recon-autofill-empty recon-autofill-loading">
          <Spinner size={13} />
          {tr({ zh: '正在计算最优十字…', en: 'Solving optimal cross…' })}
        </div>
      )}
      {!loading && popup.entries.length === 0 && emptyReasonKey && (
        <div className="recon-autofill-empty">
          {t(emptyReasonKey)}
        </div>
      )}
      {colData && popup.kind === 'alg' ? (
        <div className="recon-autofill-cols">
          {isMobile && (
            <button
              type="button"
              className="recon-autofill-close recon-autofill-cols-close"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); dismiss(); }}
              aria-label={tr({ zh: '关闭自动补全', en: 'Close suggestions' })}
              title={tr({ zh: '关闭(本行不再自动弹)', en: 'Close (won\'t reopen on this line)' })}
            >
              <X size={12} />
            </button>
          )}
          {colData.map((idxs, ci) => (
            <div key={ci} className="recon-autofill-col">
              <div className="recon-autofill-col-head">{FIRST_STAGE_COLS[ci].toUpperCase()}</div>
              {idxs.length === 0 ? (
                <div className="recon-autofill-col-empty">—</div>
              ) : idxs.map(i => {
                const entry = popup.entries[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className={`recon-autofill-row recon-autofill-row--col${selected === i ? ' is-selected' : ''}`}
                    onMouseDown={e => { e.preventDefault(); insertAlg(entry.text, popup); }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <span className="recon-autofill-text">{entry.text}</span>
                    {!isMobile && i === selected && <span className="recon-autofill-tab-hint">Tab</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : popup.entries.map((entry, i) => {
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
            {popup.kind === 'comment' ? (
              <span className="recon-autofill-badge">{tr({ zh: '注释', en: 'COMMENT'
            })}</span>
            ) : cat === 'zbls' ? (
              <>
                <span className="recon-autofill-badge">F2L</span>
                <span className="recon-autofill-badge">ZBLS</span>
              </>
            ) : (
              <span className="recon-autofill-badge">{cat?.toUpperCase().replace('_', ' ') ?? 'F2L'}</span>
            )}
            <span className="recon-autofill-text">{text}</span>
            {/* 手机端第一行右侧给 ✕ 关闭按钮(占用 Tab hint 槽位);桌面保留原 Tab hint */}
            {isMobile && i === 0 ? (
              <span
                role="button"
                tabIndex={-1}
                className="recon-autofill-close"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); dismiss(); }}
                aria-label={tr({ zh: '关闭自动补全', en: 'Close suggestions'
                })}
                title={tr({ zh: '关闭(本行不再自动弹)', en: 'Close (won\'t reopen on this line)'
                })}
              >
                <X size={12} />
              </span>
            ) : (!isMobile && i === selected && <span className="recon-autofill-tab-hint">Tab</span>)}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
