/**
 * Longform — render markdown-lite English chapter text.
 *
 * Supports: `## H2`, `### H3`, paragraphs (blank-line separated),
 * `- list items`, `**bold**`, `*italic*`, `` `code` ``.
 * Deliberately minimal to keep agent-authored chapter files un-fussy.
 */
import type { ReactNode } from 'react';

interface LongformProps {
  text: string;
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

export function Longform({ text }: LongformProps) {
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
