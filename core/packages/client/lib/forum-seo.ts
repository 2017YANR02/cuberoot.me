// Server-safe SEO helpers for /forum/t/[id] (runs in the metadata/RSC pass, so
// NO client singletons / browser APIs). Mirrors lib/recon-seo.ts: fetch the
// thread server-side with ISR caching so a shared link carries a per-thread
// social card (title + first-post excerpt) instead of the generic site card.

import { apiUrl } from './api-base';

const REVALIDATE = 3600; // 1h — a thread's title/first post rarely change; replies don't affect the card

export interface ThreadSeo {
  title: string;
  excerpt: string;   // first-post plain-text snippet (may be '')
  forumName: string; // subforum display name for the caller's locale
}

interface ThreadApiResp {
  thread?: { title?: string };
  forum?: { nameEn?: string; nameZh?: string };
  posts?: { content?: string; postNo?: number }[];
}

/** Cache tag for a thread's SEO fetch — a future thread mutation can revalidateTag() this. */
export function forumThreadCacheTag(id: string | number): string {
  return `forum-thread-${id}`;
}

/** Server-side fetch of a thread's card data. The SSR fetch is UNAUTHENTICATED,
 *  so the API returns 404 for non-approved (待审 / 驳回) threads — a moderated or
 *  hidden thread yields null and the page falls back to the generic site card,
 *  never leaking its title. null on 404 / network failure. */
export async function fetchThreadForSeo(id: string, isZh: boolean): Promise<ThreadSeo | null> {
  try {
    const res = await fetch(apiUrl(`/v1/forum/t/${encodeURIComponent(id)}?page=1&size=1`), {
      next: { revalidate: REVALIDATE, tags: [forumThreadCacheTag(id)] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ThreadApiResp;
    const title = data.thread?.title?.trim();
    if (!title) return null;
    const first = data.posts?.find((p) => (p.postNo ?? 1) === 1) ?? data.posts?.[0];
    return {
      title,
      excerpt: excerptFromMarkdown(first?.content ?? ''),
      forumName: (isZh ? data.forum?.nameZh : data.forum?.nameEn) ?? '',
    };
  } catch {
    return null;
  }
}

/** Strip common Markdown to a plain one-line snippet, capped ~120 chars. */
export function excerptFromMarkdown(md: string): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code blocks
    .replace(/`[^`]*`/g, ' ')                 // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // links → link text
    .replace(/^\s{0,3}>+\s?/gm, ' ')          // blockquotes
    .replace(/[#*_~>`|]+/g, ' ')              // residual md punctuation
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 120 ? `${plain.slice(0, 120).trimEnd()}…` : plain;
}
