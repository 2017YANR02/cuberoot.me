import { useEffect, useRef, type CSSProperties, type ReactNode, type MouseEvent } from 'react';

export default function ChapterNavigation({ items, selected, label, onSelect, onMouseDown }: {
  items: readonly { id: string; title: ReactNode; completed?: boolean }[];
  selected: number;
  label: string;
  onSelect: (index: number) => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const centerChapter = () => {
      const button = nav.querySelector<HTMLElement>('[aria-current="step"]');
      if (!button) return;
      const navRect = nav.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      nav.scrollTo({
        left: nav.scrollLeft + buttonRect.left - navRect.left - (nav.clientWidth - buttonRect.width) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    };
    centerChapter();
    const resize = new ResizeObserver(centerChapter);
    resize.observe(nav);
    return () => resize.disconnect();
  }, [selected]);
  return <nav className="lbl-chapters" ref={navRef} aria-label={label}>
    <div className="lbl-chapter-track" style={{ '--chapter': selected, '--chapter-count': items.length } as CSSProperties}>
      {selected >= 0 && <span className="lbl-indicator" aria-hidden="true" />}
      {items.map((item, index) => <button key={item.id} className="lbl-chapter-button" type="button"
        aria-current={selected === index ? 'step' : undefined} onMouseDown={onMouseDown} onClick={() => onSelect(index)}>
        <span className="lbl-chapter-line" data-completed={item.completed || undefined} /><span>{item.title}</span>
      </button>)}
    </div>
  </nav>;
}
