export function measureLearningPath(list: HTMLElement) {
  const box = list.getBoundingClientRect();
  return {
    height: box.height,
    cards: Array.from(list.children, node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height };
    }),
  };
}

// Keep both text layouts at their natural sizes. Crossfade between the compact
// card and the revealed summary without wrapping or resizing text mid-frame.
export async function animateLearningPath(grid: HTMLOListElement, index: number, opening: boolean, signal: AbortSignal, before = measureLearningPath(grid)) {
  const viewport = grid.parentElement;
  if (!viewport || !grid.animate || signal.aborted) return false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return false;

  const destination = grid.cloneNode(true) as HTMLOListElement;
  destination.inert = true;
  destination.setAttribute('aria-hidden', 'true');
  destination.classList.add('path-measure');
  destination.dataset.layout = opening ? 'expanded' : 'compact';
  grid.after(destination);
  const after = measureLearningPath(destination);
  const compact = opening ? grid : destination;
  const summary = opening ? destination : grid;
  const card = compact.children[index] as HTMLElement;
  const panel = summary.children[index] as HTMLElement;
  const start = (opening ? before : after).cards[index]!;
  const end = (opening ? after : before).cards[index]!;
  const dx = end.left + (end.width - start.width) / 2 - start.left;
  const dy = end.top - start.top;
  const mobile = window.matchMedia('(width < 700px)').matches;
  const animations: Animation[] = [];
  const play = (node: Element, frames: Keyframe[], duration: number, delay = 0) => {
    animations.push(node.animate(frames, {duration, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both'}));
  };
  const cancel = () => animations.forEach(animation => animation.cancel());
  try {
    grid.dataset.motion = 'running';
    compact.style.zIndex = '1';
    const shift = `translate(${dx}px, ${dy}px)`;
    const move = [{transform: 'translate(0px, 0px)'}, {transform: shift}];
    play(card, opening ? move : move.reverse(), opening ? 330 : 240, opening ? 100 : 130);
    const opacity = [{opacity: 1}, {opacity: 0}];
    play(card, opening ? opacity : opacity.slice().reverse(), 150, opening ? 335 : 100);

    for (const [i, peer] of Array.from(compact.children).entries()) {
      if (i === index) continue;
      const offset = mobile ? 0 : Math.sign(i-index) * 18;
      const frames = [{opacity: 1, transform: 'none'}, {opacity: 0, transform: `translateX(${offset}px) scale(.97)`}];
      play(peer, opening ? frames : frames.reverse(), 190, (opening ? 0 : 265) + (Math.abs(i-index)-1)*22);
    }

    const inset = Math.max(0, (end.width - start.width) / 2);
    const bottom = Math.max(0, end.height - start.height);
    const reveal = [
      {opacity: 0, clipPath: `inset(0px ${inset}px ${bottom}px round 8px)`},
      {opacity: 1, clipPath: 'inset(0px 0px 0px round 0px)'},
    ];
    play(panel, opening ? reveal : reveal.reverse(), opening ? 300 : 230, opening ? 315 : 0);
    const groups = Array.from(panel.querySelectorAll('.path-columns > div'), group => Array.from(group.querySelectorAll('a')));
    if (opening) {
      let order = 0;
      for (let row = 0; row < Math.max(0, ...groups.map(group => group.length)); row++) {
        for (const group of groups) {
          const entry = group[row];
          if (entry) play(entry, [{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'none'}], 150, 455 + 45 * order++);
        }
      }
    }
    play(viewport, [{height: before.height + 'px'}, {height: after.height + 'px'}], opening ? 300 : 270, opening ? 315 : 0);
    signal.addEventListener('abort', cancel, {once:true});
    reduced.addEventListener('change', cancel);
    window.addEventListener('resize', cancel);
    await Promise.allSettled(animations.map(animation => animation.finished));
    return true;
  } finally {
    signal.removeEventListener('abort', cancel);
    reduced.removeEventListener('change', cancel);
    window.removeEventListener('resize', cancel);
    cancel();
    compact.style.removeProperty('z-index');
    if (!compact.style.length) compact.removeAttribute('style');
    destination.remove();
    delete grid.dataset.motion;
  }
}
