import bodies from '@/app/[lang]/regulation/_data/posts-search.json';
import { NEWS_INDEX } from '@/lib/regulation-posts';

const textById: Record<string, string[]> = bodies;
const rows = NEWS_INDEX.map(post => ({
  post,
  titles: [post.title.zh, post.title.en].map(s => s.toLowerCase()),
  bodies: (textById[post.id] ?? []).map(text => ({ text, lower: text.toLowerCase() })),
}));

type Match = (typeof NEWS_INDEX)[number] & { snippet?: string };

export function searchRegulationPosts(query: string): Match[] {
  const term = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!term) return NEWS_INDEX;
  const titles: Match[] = [];
  const contents: Match[] = [];
  for (const row of rows) {
    if (row.titles.some(title => title.includes(term))) {
      titles.push(row.post);
      continue;
    }
    for (const { text, lower } of row.bodies) {
      const index = lower.indexOf(term);
      if (index < 0) continue;
      const start = Math.max(0, index - 28);
      const end = Math.min(text.length, index + term.length + 48);
      const snippet = (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
      contents.push({ ...row.post, snippet });
      break;
    }
  }
  return [...titles, ...contents];
}
