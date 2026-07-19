import { useEffect } from 'react';

/**
 * Standard modal dismissal wiring, shared by the hand-rolled modals (8 of them
 * each re-added these two effects): while mounted, Escape closes the modal and
 * the page body scroll is locked; both are reset on unmount.
 *
 * `disabled` suppresses Escape (e.g. while a submit is in flight, so the user
 * can't Escape away mid-request).
 *
 * The backdrop/overlay click and the close button stay in each modal — they
 * genuinely vary (onClick vs onMouseDown+target-check, a ✕ text button vs a
 * lucide icon), so folding them into a shared shell would over-abstract. This
 * hook owns only the two universal bits.
 */
export function useModalDismiss(onClose: () => void, disabled = false): void {
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
}
