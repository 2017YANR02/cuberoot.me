import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { tr } from '@/i18n/tr';

interface Group {
  letter: string;
  rows: { title: string; body: string }[];
}

interface Drag {
  id: number;
  bounds: DOMRect;
  width: number;
  index: number;
  ctx: CanvasRenderingContext2D;
  textColor: string;
  accent: string;
  accentText: string;
  font: string;
  reducedMotion: boolean;
}

const section = (letter: string) => document.getElementById(`wiki-section-${letter}`);
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

export default function WikiAlphabet({ groups }: { groups: Group[] }) {
  const [active, setActive] = useState(groups[0].letter);
  const gesture = useRef<Drag | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLElement>(null);
  const previewPage = useRef<HTMLDivElement>(null);
  const transition = useRef<Animation | null>(null);
  const arrival = useRef<Animation | null>(null);
  const pending = useRef<number | null>(null);
  const latest = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible && !gesture.current) setActive((visible.target as HTMLElement).dataset.letter!);
    }, { rootMargin: '-80px 0px -65% 0px' });
    for (const { letter } of groups) {
      const target = section(letter);
      if (target) observer.observe(target);
    }
    return () => {
      observer.disconnect();
      arrival.current?.cancel();
      transition.current?.cancel();
      if (pending.current !== null) cancelAnimationFrame(pending.current);
    };
  }, [groups]);

  function jump(letter: string, button: HTMLButtonElement) {
    const target = section(letter);
    const bar = button.parentElement;
    if (!target || !bar) return;
    arrival.current?.cancel();
    if (getComputedStyle(bar).position === 'fixed') {
      target.scrollIntoView({ behavior: 'instant' });
      return;
    }

    // The sticky desktop index can wrap to a second line on narrower screens.
    const inset = parseFloat(getComputedStyle(bar).top) + bar.offsetHeight + 8;
    window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - inset, behavior: 'instant' });
    setActive(letter);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      arrival.current = target.animate([{ opacity: 0.72 }, { opacity: 1 }], {
        duration: 110, easing: 'ease-out',
      });
    }
  }

  function paint() {
    pending.current = null;
    const drag = gesture.current;
    if (!drag) return;
    const { x, y } = latest.current;
    const rowHeight = drag.bounds.height / groups.length;
    const position = clamp((y - drag.bounds.top) / rowHeight - 0.5, groups.length - 1);
    const pull = clamp(drag.bounds.right - drag.bounds.width / 2 - x + 20, drag.width - 88);
    const index = Math.round(position);
    const ctx = drag.ctx;
    const center = drag.width - drag.bounds.width / 2;
    ctx.clearRect(0, 0, drag.width, drag.bounds.height + 48);
    ctx.font = drag.font;
    for (let i = 0; i < groups.length; i++) {
      const distance = (i - position) / 4;
      const offset = pull * Math.exp(-0.5 * distance * distance);
      ctx.fillStyle = i === index ? drag.accent : drag.textColor;
      ctx.fillText(groups[i].letter, center - offset, 24 + (i + 0.5) * rowHeight);
    }
    const bx = center - pull - 38;
    const by = 24 + (position + 0.5) * rowHeight;
    ctx.fillStyle = drag.accent;
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = '600 24px system-ui';
    ctx.fillStyle = drag.accentText;
    ctx.fillText(groups[index].letter, bx, by);

    if (index === drag.index) return;
    const direction = index < drag.index ? -1 : 1;
    drag.index = index;
    const page = previewPage.current!;
    const group = groups[index];
    // Reuse text nodes. No React commit or subtree replacement during the gesture.
    page.firstChild!.firstChild!.nodeValue = group.letter;
    const slots = page.lastElementChild!.children;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i] as HTMLElement;
      const row = group.rows[i];
      slot.hidden = !row;
      if (!row) continue;
      slot.firstChild!.firstChild!.nodeValue = row.title;
      slot.lastChild!.firstChild!.nodeValue = row.body;
    }
    transition.current?.cancel();
    if (!drag.reducedMotion) {
      transition.current = page.animate([
        { transform: `translateY(${direction * 8}px)`, opacity: 0.8 },
        { transform: 'none', opacity: 1 },
      ], { duration: 95, easing: 'ease-out' });
    }
  }

  function start(e: PointerEvent<HTMLElement>) {
    const nav = e.currentTarget;
    if (gesture.current || e.button !== 0 || getComputedStyle(nav).position !== 'fixed') return;
    const layer = canvas.current!;
    const ctx = layer.getContext('2d');
    if (!ctx) return;
    const bounds = nav.getBoundingClientRect();
    const width = Math.ceil(window.innerWidth * 0.62 + 88);
    const height = Math.ceil(bounds.height + 48);
    const scale = Math.min(window.devicePixelRatio, 2);
    layer.style.width = width + 'px';
    layer.style.height = height + 'px';
    layer.width = Math.ceil(width * scale);
    layer.height = Math.ceil(height * scale);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const style = getComputedStyle(nav.querySelector('button')!);
    gesture.current = {
      id: e.pointerId, bounds, width, index: -1, ctx,
      textColor: style.getPropertyValue('--muted-foreground').trim(),
      accent: style.getPropertyValue('--accent').trim(),
      accentText: style.getPropertyValue('--accent-foreground').trim(),
      font: `500 ${style.fontSize} ${style.fontFamily}`,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
    const search = nav.parentElement?.querySelector('.wiki-search-wrap');
    preview.current!.style.top = Math.max(0, search?.getBoundingClientRect().bottom ?? 64) + 'px';
    nav.dataset.dragging = '';
    nav.setPointerCapture(e.pointerId);
    latest.current = { x: e.clientX, y: e.clientY };
    paint();
  }

  function move(e: PointerEvent<HTMLElement>) {
    if (gesture.current?.id !== e.pointerId) return;
    latest.current = { x: e.clientX, y: e.clientY };
    if (pending.current === null) pending.current = requestAnimationFrame(paint);
  }

  function finish(e: PointerEvent<HTMLElement>) {
    if (gesture.current?.id !== e.pointerId) return;
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = null;
    if (e.type === 'pointerup') {
      latest.current = { x: e.clientX, y: e.clientY };
      paint();
    }
    const letter = groups[gesture.current.index].letter;
    section(letter)?.scrollIntoView({ behavior: 'instant' });
    setActive(letter);
    transition.current?.cancel();
    delete e.currentTarget.dataset.dragging;
    gesture.current = null;
  }

  return (
    <>
    <nav className="wiki-alpha-bar" aria-label={tr({ zh: '按字母跳转', en: 'Jump by letter' })}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={finish} onLostPointerCapture={finish}>
      {groups.map(({ letter }) => (
        <button key={letter} type="button" className={`wiki-alpha-btn${active === letter ? ' is-active' : ''}`}
          aria-current={active === letter ? 'location' : undefined}
          onClick={e => jump(letter, e.currentTarget)}>
          <span className="wiki-alpha-glyph">{letter}</span>
        </button>
      ))}
      <canvas ref={canvas} className="wiki-alpha-canvas" aria-hidden="true" />
    </nav>
    <aside ref={preview} className="wiki-alpha-preview" aria-hidden="true" inert>
      <div ref={previewPage}>
        <h2 className="wiki-section-title">{' '}</h2>
        <ul className="wiki-entries">{Array.from({ length: 18 }, (_, i) => (
          <li key={i} className="wiki-entry">
            <h3 className="wiki-entry-head">{' '}</h3>
            <div className="wiki-entry-body">{' '}</div>
          </li>
        ))}</ul>
      </div>
    </aside>
    </>
  );
}
