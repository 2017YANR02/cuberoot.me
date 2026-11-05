/** Browser-level product controls, not DRM: content already delivered to a
 * viewer cannot be protected against screenshots or external extraction. */
export function restrictDocumentOutput(selector: string, blocked: boolean): () => void {
  if (!blocked) return () => undefined;
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) return () => undefined;
  root.dataset.exportBlocked = 'true';
  const stopClipboard = (event: Event) => {
    if (event.target instanceof Node && root.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  const stopShortcut = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'p'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  window.addEventListener('copy', stopClipboard, true);
  window.addEventListener('cut', stopClipboard, true);
  window.addEventListener('keydown', stopShortcut, true);
  return () => {
    delete root.dataset.exportBlocked;
    window.removeEventListener('copy', stopClipboard, true);
    window.removeEventListener('cut', stopClipboard, true);
    window.removeEventListener('keydown', stopShortcut, true);
  };
}
