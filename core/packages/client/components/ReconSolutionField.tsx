'use client';
/**
 * Recon solution input — AlgInput (autoSpace/autoResize) + ReconAutofill Tab
 * suggestions + virtual keyboard, sharing the exact same behavior between the
 * recon submit form and the add/edit-alternative form. Callers own the STM/TPS
 * label and any wrapping (submit-field/submit-block), so this only renders the
 * input trio.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import AlgInput, { type AlgInputHandle } from './AlgInput';
import { editorText, editorCaret, setEditorCaret, type AlgEditorElement } from '@/lib/alg-editor-dom';
import { sanitizeAlgHtml, escapeAlgText, replaceAlgHtmlText } from '@/lib/alg_html';
import ReconAutofill from './ReconAutofill';
import CubeKeyboardSection from './CubeKeyboardSection';
import { normalizeSolutionSlashes, reconInspectionOrientations, showReconInspectionColors } from '@/lib/recon-alg-utils';
import { normalizeReconMoveSuffixOrder } from '@cuberoot/shared/recon-completion';
import CubeColorChip from './CubeColorChip/CubeColorChip';
import { getCaretRect } from '@/lib/textarea_caret';
import './solution_view.css';

export interface ReconSolutionFieldHandle {
  /** Imperatively overwrite the editor's DOM value (for async edit-mode loads
   *  that resolve after the field has already mounted with an empty value). */
  setText: (s: string, html?: string) => void;
}

interface Props {
  value: string;
  html?: string;
  onChange: (text: string, html: string) => void;
  onCaretSync?: (textBeforeCaret: string) => void;
  scramble: string;
  event?: string;
  isMobile: boolean;
  /** Mobile keyboard visibility — omit when this is the only editable field
   *  (keyboard follows CubeKeyboardSection's default: always shown on mobile). */
  mobileKeyboardVisible?: boolean;
  onFocusField?: () => void;
  onBlurField?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

const ReconSolutionField = forwardRef<ReconSolutionFieldHandle, Props>(function ReconSolutionField({
  value, html, onChange, onCaretSync, scramble, event, isMobile,
  mobileKeyboardVisible, onFocusField, onBlurField, autoFocus, placeholder,
}, ref) {
  const elRef = useRef<AlgEditorElement | null>(null);
  const inputRef = useRef<AlgInputHandle>(null);
  const inspections = useMemo(() => showReconInspectionColors(event) ? reconInspectionOrientations(value) : [], [value, event]);
  const [inspectionChips, setInspectionChips] = useState<{ left: number; top: number; colors: string }[]>([]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const update = () => setInspectionChips(inspections.map(item => {
      const rect = getCaretRect(el, item.offset);
      return { colors: item.colors, left: rect.left + 6, top: rect.top + (rect.lineHeight - 16) / 2 };
    }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update);
    return () => { observer.disconnect(); el.removeEventListener('scroll', update); };
  }, [inspections]);

  const writeNormalizedText = useCallback((text: string, markup?: string): string => {
    const next = normalizeReconMoveSuffixOrder(text);
    const el = elRef.current;
    const currentHtml = markup ?? (el instanceof HTMLDivElement ? el.innerHTML : escapeAlgText(text));
    const nextHtml = sanitizeAlgHtml(next === text ? currentHtml : normalizeReconMoveSuffixOrder(currentHtml));
    if (el instanceof HTMLDivElement && editorText(el) !== next) {
      const caret = editorCaret(el);
      el.innerHTML = nextHtml;
      setEditorCaret(el, Math.min(caret, next.length));
    }
    onChange(next, nextHtml);
    return next;
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    setText: (text: string, markup?: string) => {
      inputRef.current?.setText(markup ? sanitizeAlgHtml(markup) : escapeAlgText(text));
      writeNormalizedText(text, markup ?? escapeAlgText(text));
    },
  }), [writeNormalizedText]);

  useEffect(() => {
    if (autoFocus) elRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync the player once the text settles (typing already syncs live via
  // onCaretChange below; this catches programmatic writes — autofill picks,
  // keyboard taps, edit-mode loads — that don't fire that handler).
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = elRef.current;
      if (el) onCaretSync?.(editorText(el).slice(0, editorCaret(el)));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <div className="recon-solution-input">
      <AlgInput
        ref={inputRef}
        markable
        multiline
        initialHtml={html ? sanitizeAlgHtml(html) : undefined}
        elementRef={elRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
        initialText={value}
        className="submit-field-textarea submit-solution-textarea"
        rows={6}
        spellCheck={false}
        autoSpace
        autoResize
        style={{ overflow: 'hidden', minHeight: '9em', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
        placeholder={placeholder}
        onChange={writeNormalizedText}
        onCaretChange={(text, caretIndex) => {
          const normalized = normalizeReconMoveSuffixOrder(text);
          onCaretSync?.(normalized.slice(0, caretIndex));
        }}
        onFocus={() => onFocusField?.()}
        onBlur={() => {
          onBlurField?.();
          const el = elRef.current;
          if (!el) return;
          const next = normalizeSolutionSlashes(editorText(el));
          if (next !== editorText(el)) writeNormalizedText(next, normalizeSolutionSlashes(inputRef.current?.getHtml() ?? ''));
        }}
      />
      {inspectionChips.map((chip, i) => (
        <span key={i} className="recon-inspection-overlay" style={{ left: chip.left, top: chip.top }}>
          <CubeColorChip colors={chip.colors} className="cube-orientation-chip" />
        </span>
      ))}
      </div>
      <ReconAutofill
        textareaRef={elRef}
        value={value}
        setValue={(next) => {
          writeNormalizedText(next, replaceAlgHtmlText(inputRef.current?.getHtml() ?? '', next));
        }}
        scramble={scramble}
        isMobile={isMobile}
      />
      <CubeKeyboardSection
        enableMarks
        target={elRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
        mobileVisible={mobileKeyboardVisible}
        onInput={() => {
          const el = elRef.current;
          if (!el) return;
          const next = writeNormalizedText(editorText(el));
          onCaretSync?.(next.slice(0, editorCaret(el)));
        }}
      />
    </>
  );
});

export default ReconSolutionField;
