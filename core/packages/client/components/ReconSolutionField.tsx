'use client';
/**
 * Recon solution input — AlgInput (autoSpace/autoResize) + ReconAutofill Tab
 * suggestions + virtual keyboard, sharing the exact same behavior between the
 * recon submit form and the add/edit-alternative form. Callers own the STM/TPS
 * label and any wrapping (submit-field/submit-block), so this only renders the
 * input trio.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import AlgInput from './AlgInput';
import ReconAutofill from './ReconAutofill';
import CubeKeyboardSection from './CubeKeyboardSection';
import { normalizeSolutionSlashes } from '@/lib/recon-alg-utils';

export interface ReconSolutionFieldHandle {
  /** Imperatively overwrite the textarea's DOM value (for async edit-mode loads
   *  that resolve after the field has already mounted with an empty value). */
  setText: (s: string) => void;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onCaretSync?: (textBeforeCaret: string) => void;
  scramble: string;
  isMobile: boolean;
  /** Mobile keyboard visibility — omit when this is the only editable field
   *  (keyboard follows CubeKeyboardSection's default: always shown on mobile). */
  mobileKeyboardVisible?: boolean;
  onFocusField?: () => void;
  onBlurField?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

const ReconSolutionField = forwardRef<ReconSolutionFieldHandle, Props>(function ReconSolutionField({
  value, onChange, onCaretSync, scramble, isMobile,
  mobileKeyboardVisible, onFocusField, onBlurField, autoFocus, placeholder,
}, ref) {
  const elRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    setText: (s: string) => {
      const el = elRef.current;
      if (!el) return;
      el.value = s;
      autoResize(el);
    },
  }), []);

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
      if (el) onCaretSync?.(el.value.slice(0, el.selectionStart ?? el.value.length));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <AlgInput
        elementRef={elRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
        initialText={value}
        className="submit-field-textarea submit-solution-textarea"
        rows={6}
        spellCheck={false}
        autoSpace
        autoResize
        style={{ overflow: 'hidden', resize: 'none', fontFamily: 'monospace' }}
        placeholder={placeholder}
        onChange={(text) => onChange(text)}
        onCaretChange={(text, caretIndex) => onCaretSync?.(text.slice(0, caretIndex))}
        onFocus={() => onFocusField?.()}
        onBlur={() => {
          onBlurField?.();
          const el = elRef.current;
          if (!el) return;
          const next = normalizeSolutionSlashes(el.value);
          if (next !== el.value) {
            el.value = next;
            onChange(next);
            autoResize(el);
          }
        }}
      />
      <ReconAutofill
        textareaRef={elRef}
        value={value}
        setValue={(next) => {
          onChange(next);
          if (elRef.current) {
            elRef.current.value = next;
            autoResize(elRef.current);
          }
        }}
        scramble={scramble}
        isMobile={isMobile}
      />
      <CubeKeyboardSection
        target={elRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
        mobileVisible={mobileKeyboardVisible}
        onInput={() => {
          const el = elRef.current;
          if (!el) return;
          onChange(el.value);
          autoResize(el);
          onCaretSync?.(el.value.slice(0, el.selectionStart ?? el.value.length));
        }}
      />
    </>
  );
});

export default ReconSolutionField;
