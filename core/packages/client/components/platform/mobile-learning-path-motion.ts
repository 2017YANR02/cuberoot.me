type Box = { left: number; top: number; width: number; height: number };

function frame(box: Box) {
  return { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' };
}

export async function animateMobilePath(grid: HTMLOListElement, index: number, opening: boolean, signal: AbortSignal) {
  const viewport = grid.parentElement!;
  const tip = viewport.querySelector<HTMLElement>('.path-prompt')!;
  const layout = grid.dataset.layout!;
  const copy = grid.cloneNode(true) as HTMLOListElement;
  copy.classList.add('path-measure');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  copy.dataset.layout = opening ? 'expanded' : 'compact';
  copy.style.visibility = 'hidden';
  grid.after(copy);

  const startHeight = viewport.getBoundingClientRect().height;
  const compact = opening ? grid : copy;
  const origin = compact.getBoundingClientRect();
  // The prompt sits above the grid in normal flow, including on the way back.
  const tipStyle = getComputedStyle(tip);
  const promptHeight = parseFloat(tipStyle.lineHeight) + parseFloat(tipStyle.paddingBottom);
  const compactHeight = origin.height + promptHeight;
  const boxes = Array.from(compact.children, child => {
    const r = child.getBoundingClientRect();
    return { left: r.left - origin.left, top: r.top - origin.top + promptHeight, width: r.width, height: r.height };
  });
  const panel = (opening ? copy : grid).children[index] as HTMLElement;
  const full = panel.getBoundingClientRect();
  const cards = Array.from(compact.children) as HTMLElement[];
  const card = cards[index]!;
  const home = boxes[index]!;
  const dx = (full.width - home.width) / 2 - home.left;
  const dy = (full.height - home.height) / 2 - home.top;
  const centered = `translate(${dx}px, ${dy}px)`;
  const enlarged = centered + ` scale(${full.width / home.width}, ${full.height / home.height})`;
  const distance = (box: Box) => Math.hypot(box.left + box.width / 2 - home.left - home.width / 2, box.top + box.height / 2 - home.top - home.height / 2);
  const peers = cards.map((element, i) => ({element, distance: distance(boxes[i]!)}))
    .filter(peer => peer.element !== card).sort((a, b) => a.distance - b.distance);
  const details = panel.querySelector<HTMLElement>('.path-details')!;
  const header = panel.querySelector<HTMLElement>('.path-stage')!;
  const change = panel.querySelector<HTMLElement>('.path-change')!;
  const compactHeader = card.querySelector<HTMLElement>('.path-stage')!;
  const columns = Array.from(details.querySelectorAll('.path-columns > div'), group => Array.from(group.querySelectorAll('a')));
  const entries = Array.from({length: Math.max(...columns.map(group => group.length))}, (_, row) => columns.flatMap(group => group.slice(row, row + 1))).flat();
  const animations: Animation[] = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = false;
  function stop() {
    stopped = true;
    for (const animation of animations) animation.cancel();
  }
  function play(element: Element, keyframes: Keyframe[], duration: number, delay = 0) {
    const animation = element.animate(opening ? keyframes : [...keyframes].reverse(), { duration, delay, fill: 'both', easing: 'cubic-bezier(.2,.8,.2,1)' });
    animations.push(animation);
    return animation.finished.catch(() => {});
  }
  const fadePeers = () => Promise.all(peers.map(({element}, i) => play(element, [
    {opacity: 1, transform: 'scale(1)', filter: 'blur(0px)'}, {opacity: 0, transform: 'scale(.9)', filter: 'blur(4px)'},
  ], 190, i * 22 + (opening ? 0 : 35))));
  const move = () => play(card, [{transform: 'none'}, {transform: centered}], opening ? 315 : 240);
  const reveal = () => Promise.all(entries.map((entry, i) => play(entry, [
    {opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'translateY(0)'},
  ], opening ? 150 : 90, opening ? 140 + i * 45 : 0)));

  const touched = [viewport, compact, panel, ...cards, details, change];
  const originalStyles = touched.map(el => el.getAttribute('style'));
  try {
    viewport.style.height = startHeight + 'px';
    grid.dataset.motion = 'running';
    cards.forEach((el, i) => Object.assign(el.style, frame(boxes[i]!), {position: 'absolute', overflow: 'hidden'}));
    compact.style.zIndex = '1';
    copy.style.visibility = 'visible';
    change.style.visibility = 'hidden';
    if (opening) panel.style.visibility = 'hidden';
    else compact.style.visibility = 'hidden';
    window.addEventListener('resize', stop);
    signal.addEventListener('abort', stop);
    reduced.addEventListener('change', stop);
    if (opening) {
      // Start moving as the surrounding tiles clear. Growth waits for arrival.
      await Promise.all([fadePeers(), move()]);
    }
    if (stopped) return;
    panel.style.visibility = 'visible';
    compact.style.visibility = 'visible';
    if (!opening) peers.forEach(({element}) => { element.style.opacity = '0'; });
    const expandDuration = opening ? 300 : 230;
    // Transform the compact surface around its center. The final text is already
    // laid out at its natural width and does not rewrap or stretch each frame.
    await Promise.all([
      reveal(),
      play(details, [{opacity: 0}, {opacity: 1}], opening ? 100 : 90, opening ? 115 : 0),
      play(card, [{transform: centered, opacity: 1}, {transform: enlarged, opacity: 0}], expandDuration),
      play(compactHeader, [{opacity: 1}, {opacity: 0, offset: .3}, {opacity: 0}], expandDuration),
      play(header, [{opacity: 0}, {opacity: 0, offset: .4}, {opacity: 1}], expandDuration),
      play(viewport, [{height: compactHeight + 'px'}, {height: full.height + 'px'}], expandDuration),
    ]);
    if (stopped) return;
    if (!opening) {
      panel.style.visibility = 'hidden';
      await Promise.all([move(), fadePeers()]);
    }
  } finally {
    window.removeEventListener('resize', stop);
    signal.removeEventListener('abort', stop);
    reduced.removeEventListener('change', stop);
    stop();
    touched.forEach((el, i) => {
      const previous = originalStyles[i];
      if (!previous) {
        el.style.cssText = '';
        el.removeAttribute('style');
      }
      else el.setAttribute('style', previous);
    });
    copy.remove();
    grid.dataset.layout = layout;
    delete grid.dataset.motion;
  }
}
