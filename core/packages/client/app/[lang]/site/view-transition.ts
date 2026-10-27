export type ViewSnapshot = Map<Element, DOMRect>;

export function visibleSiteElements(list: HTMLElement): Element[] {
  const visible: Element[] = [];
  // Both layouts preserve DOM order; stop reading after the viewport.
  for (const element of list.children) {
    if (!element.hasAttribute('data-flip-id')) continue;
    const bounds = element.getBoundingClientRect();
    if (bounds.top >= window.innerHeight) break;
    if (bounds.bottom > 0) visible.push(element);
  }
  return visible;
}

export function captureView(list: HTMLElement, next: 'list' | 'grid'): ViewSnapshot {
  const bounds = list.getBoundingClientRect();
  const style = getComputedStyle(list);
  const metric = (name: string) => Number.parseFloat(style.getPropertyValue(name));
  const grid = next === 'grid';
  const gap = metric(grid ? '--site-grid-gap' : '--site-list-gap');
  const minimumHeight = metric(grid ? '--site-grid-min-height' : '--site-list-min-height');
  const columns = grid
    ? metric('--site-grid-column-count') || Math.max(1, Math.floor((bounds.width + gap) / (metric('--site-grid-min-width') + gap)))
    : 1;
  const availableHeight = Math.max(0, window.innerHeight - Math.max(0, bounds.top));
  const capacity = Math.ceil((availableHeight + gap) / (minimumHeight + gap)) * columns;
  const roots = new Set(visibleSiteElements(list));
  // The switch controls are above the directory. Its destination can show more
  // entries than its source: premeasure a bounded prefix using the CSS layout's
  // minimum dimensions, including the rows just below the source viewport.
  let count = 0;
  for (const root of list.children) {
    if (!root.hasAttribute('data-flip-id')) continue;
    if (!Number.isFinite(capacity) || count++ >= capacity) break;
    roots.add(root);
  }
  return new Map([...roots].flatMap(root =>
    [...root.querySelectorAll('[data-flip-id]')].map(element => [element, element.getBoundingClientRect()] as const),
  ));
}
