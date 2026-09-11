import { useEffect, useRef, type HTMLAttributes } from 'react';

/** Spread on the backdrop, not the dialog. Pointer origin protects drag-out gestures. */
export function useModalBackdrop(onClose: () => void, disabled = false) {
  const startedOutside = useRef(false);
  return {
    onPointerDownCapture: (event) => {
      startedOutside.current = event.button === 0 && event.target === event.currentTarget;
    },
    onPointerCancel: () => { startedOutside.current = false; },
    onClick: (event) => {
      const outside = startedOutside.current;
      startedOutside.current = false;
      if (!disabled && outside && event.target === event.currentTarget) {
        event.stopPropagation();
        onClose();
      }
    },
  } satisfies HTMLAttributes<HTMLElement>;
}

/**
 * Standard modal dismissal wiring, shared by the hand-rolled modals (8 of them
 * each re-added these two effects): while mounted, Escape closes the modal and
 * the page body scroll is locked; both are reset on unmount.
 *
 * `disabled` suppresses Escape (e.g. while a submit is in flight, so the user
 * can't Escape away mid-request).
 *
 * Spread the returned props on the backdrop for outside-click/tap dismissal.
 * Pages with an already-managed modal lifecycle can use useModalBackdrop alone.
 */
export function useModalDismiss(onClose: () => void, disabled = false) {
  const backdropProps = useModalBackdrop(onClose, disabled);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !disabled) onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, disabled]);
  return backdropProps;
}
