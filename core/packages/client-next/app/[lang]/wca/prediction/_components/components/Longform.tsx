/**
 * Longform — render markdown-lite English chapter text.
 *
 * Supports: `## H2`, `### H3`, paragraphs (blank-line separated),
 * `- list items`, `**bold**`, `*italic*`, `` `code` ``.
 * Deliberately minimal to keep agent-authored chapter files un-fussy.
 *
 * Each chapter is ~12-16k words → parsing to JSX produces ~5000 elements.
 * On pages that mount 18 chapters at once (Prediction333Page) this freezes
 * the main thread for 5-10s. So Longform now self-defers via
 * IntersectionObserver: it renders a tall placeholder until the viewport is
 * within 800px of it, then mounts the parsed content. Stays mounted forever.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LongformProps {
  text: string;
  /** Skip the IntersectionObserver deferral (for pages that already gate via collapsibles). */
  eager?: boolean;
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    // **bold**
    if (s[i] === '*' && s[i + 1] === '*') {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) {
        out.push(<strong key={key++}>{s.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    // *italic*
    if (s[i] === '*' && s[i + 1] !== '*') {
      const end = s.indexOf('*', i + 1);
      if (end !== -1) {
        out.push(<em key={key++}>{s.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    // `code`
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1) {
        out.push(<code key={key++}>{s.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    let next = s.length;
    for (const m of ['**', '*', '`']) {
      const idx = s.indexOf(m, i);
      if (idx !== -1 && idx < next) next = idx;
    }
    out.push(s.slice(i, next));
    i = next;
  }
  return out;
}

function renderText(text: string): ReactNode {
  const blocks = text.trim().split(/\n\n+/);
  const out: ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      const items = [...listBuf];
      out.push(
        <ul className="pred-longform-list" key={`l${out.length}`}>
          {items.map((li, i) => <li key={i}>{inline(li)}</li>)}
        </ul>
      );
      listBuf = [];
    }
  };
  for (const blk of blocks) {
    const trimmed = blk.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('## ')) {
      flushList();
      out.push(<h3 key={`h${out.length}`}>{inline(trimmed.slice(3))}</h3>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      out.push(<h4 key={`h4${out.length}`}>{inline(trimmed.slice(4))}</h4>);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      const items = trimmed.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
      listBuf.push(...items);
      continue;
    }
    flushList();
    out.push(<p key={`p${out.length}`}>{inline(trimmed)}</p>);
  }
  flushList();
  return <div className="pred-longform">{out}</div>;
}

export function Longform({ text, eager = false }: LongformProps) {
  const [shown, setShown] = useState(eager);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shown || !ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          obs.disconnect();
        }
      },
      { rootMargin: '800px' },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [shown]);

  if (shown) return <>{renderText(text)}</>;
  // Placeholder: ~ proportional to chapter length so the page scroll length is
  // approximately final from the start (avoid scroll-position jumps as chapters
  // hydrate). Estimate ~7 chars per rendered px ≈ tuned for typical chapters.
  const estHeight = Math.max(400, Math.min(8000, Math.round(text.length / 4)));
  return (
    <div
      ref={ref}
      className="pred-longform-placeholder"
      style={{ minHeight: estHeight, color: 'var(--muted-foreground)', fontSize: 12, padding: 24 }}
    >
      Loading chapter…
    </div>
  );
}
