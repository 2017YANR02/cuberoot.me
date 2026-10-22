/** Complete public announcement feed. JSON body includes text after <!-- break -->. */
import { createHash } from 'node:crypto';

export type PostEntry = {
  key: string; kind: 'posts'; title: string; url: string; date: string;
  content: string; hash: string; format: 'markdown'; sourceId: number;
};
type Post = { id: number; slug: string; title: string; created_at: string; url: string; body: string };
export type PostsPage = { totalPages: number; posts: Post[] };

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function parsePostsPage(value: unknown): PostsPage {
  const data = value as PostsPage;
  assert(data && Number.isInteger(data.totalPages) && data.totalPages > 0 && data.totalPages <= 1000 && Array.isArray(data.posts) && data.posts.length > 0, 'Invalid/empty posts page');
  for (const post of data.posts) {
    assert(Number.isInteger(post.id) && post.id > 0 && typeof post.slug === 'string' && /^[a-z0-9-]+$/.test(post.slug) && post.url === '/posts/' + post.slug && typeof post.title === 'string' && post.title.trim() && typeof post.body === 'string' && post.body.trim() && Number.isFinite(Date.parse(post.created_at)), 'Incomplete public announcement');
  }
  return data;
}
export function postEntry(post: Post): PostEntry {
  const title = post.title.trim();
  const date = post.created_at;
  const content = post.body.replace(/\r\n/g, '\n').trim();
  return {
    key: 'posts:' + post.url, kind: 'posts', title, date,
    url: 'https://www.worldcubeassociation.org' + post.url, content,
    hash: createHash('sha256').update(JSON.stringify({ title, date, content })).digest('hex'),
    format: 'markdown', sourceId: post.id,
  };
}
export async function collectPosts(readPage: (page: number) => Promise<unknown> = async (page) => {
  const response = await fetch('https://www.worldcubeassociation.org/posts?page=' + page, {
    headers: { Accept: 'application/json', 'User-Agent': 'CubeRoot-WCA-log-monitor' },
    signal: AbortSignal.timeout(45_000),
  });
  assert(response.ok, 'Posts page ' + page + ': HTTP ' + response.status);
  return response.json();
}): Promise<PostEntry[]> {
  const first = parsePostsPage(await readPage(1));
  const all = [...first.posts];
  // Three list requests at a time; the feed already supplies full Markdown bodies.
  for (let page = 2; page <= first.totalPages; page += 3) {
    const pages = await Promise.all(Array.from({ length: Math.min(3, first.totalPages - page + 1) }, (_, offset) => readPage(page + offset)));
    for (const raw of pages) {
      const next = parsePostsPage(raw);
      assert(next.totalPages === first.totalPages, 'Posts pagination changed during scan');
      all.push(...next.posts);
    }
  }
  assert(new Set(all.map(p => p.id)).size === all.length && new Set(all.map(p => p.url)).size === all.length, 'Duplicate/shifted posts pagination; retry next run');
  // Detect new items shifting page boundaries while a long scan is in progress.
  const again = parsePostsPage(await readPage(1));
  assert(JSON.stringify(again) === JSON.stringify(first), 'Posts first page changed during scan; retry next run');
  return all.map(postEntry).sort((a, b) => a.key.localeCompare(b.key));
}

/** Keep existing disciplinary IDs/hashes authoritative for overlapping announcements. */
export function uniquePosts(posts: PostEntry[], disciplinary: { url: string }[]) {
  const urls = new Set(disciplinary.map(entry => entry.url));
  return posts.filter(entry => !urls.has(entry.url));
}
