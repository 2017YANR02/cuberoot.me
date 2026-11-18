/** Use the CSS sizing contract when a lesson animates its cube with transforms. */
export function tutorialCubeSizer(element: HTMLElement) {
  const style = getComputedStyle(element);
  const target = Number.parseFloat(style.getPropertyValue('--tutorial-cube-target'));
  const share = Number.parseFloat(style.getPropertyValue('--tutorial-cube-height-share'));
  return (width: number, availableHeight: number) => Math.min(target, width, Math.max(0, availableHeight) * share);
}
