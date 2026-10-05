import { useEffect, type RefObject } from 'react';
import { modalFocusableElements } from '../modal-focus';
import { useModalDismiss } from '../useModalDismiss';

/** Keep asynchronous device/prompt transitions inside the same modal focus scope. */
export function useDeviceModal(dialogRef: RefObject<HTMLDivElement | null>, close: () => void) {
  const backdrop = useModalDismiss(close);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focus = () => {
      if (!dialog.contains(document.activeElement) || document.activeElement?.hasAttribute('disabled')) {
        (dialog.querySelector<HTMLElement>('input:not([disabled])') ?? modalFocusableElements(dialog)[0] ?? dialog).focus();
      }
    };
    focus();
    const observer = new MutationObserver(focus);
    observer.observe(dialog, {childList:true, subtree:true, attributes:true, attributeFilter:['disabled']});
    const trap = (event: KeyboardEvent) => {
      if(event.key !== 'Tab') return;
      const items = modalFocusableElements(dialog);
      const first = items[0] ?? dialog, last = items[items.length - 1] ?? dialog;
      if(!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    dialog.addEventListener('keydown', trap);
    return () => { observer.disconnect(); dialog.removeEventListener('keydown',trap); if(previous?.isConnected) previous.focus(); };
  }, [dialogRef]);
  return backdrop;
}
