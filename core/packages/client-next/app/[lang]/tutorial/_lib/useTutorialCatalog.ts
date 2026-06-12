import { useEffect, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';

export type Lang = 'en' | 'zh';
export type PostView = 'article' | 'algset';

export interface CatalogEntry {
  slug: string;
  view: PostView;
  title: Partial<Record<Lang, string>>;
  category: string;
  subcategory: string | null;
  topDir: string;
  thumb: string | null;
  mtime: number;
  hasEn: boolean;
  hasZh: boolean;
  order: number;
  hidden: boolean;
  quality: 'ok' | 'degraded';
  algCount: number;
}

export interface CaseAlg {
  alg: string;
  /** Word 指法记号渲染用 HTML 片段(<u>/<s>/<em>/<strong>/<sub>/<sup>);省略时与 alg 等价 */
  algHtml?: string;
  primary: boolean;
  author?: string;
  setup?: string;
}

export interface AlgsetCase {
  id: string;
  label: string;
  group: string;
  image: string | null;
  algs: CaseAlg[];
  notes?: string;
}

export interface AlgsetGroup {
  id: string;
  label: string;
  count: number;
  order: number;
}

export interface ArticlePostContent {
  view: 'article';
  slug: string;
  category: string;
  subcategory: string | null;
  topDir: string;
  title: Partial<Record<Lang, string>>;
  content: Partial<Record<Lang, string>>;
  algs: string[];
  thumb: string | null;
  warningCount: number;
  hasImages: boolean;
  hasTables: boolean;
}

export interface AlgsetPostContent {
  view: 'algset';
  slug: string;
  category: string;
  subcategory: string | null;
  topDir: string;
  title: Partial<Record<Lang, string>>;
  cases: AlgsetCase[];
  groups: AlgsetGroup[];
  thumb: string | null;
  warningCount: number;
}

export type PostContent = ArticlePostContent | AlgsetPostContent;

const CATALOG_URL = '/stats/tutorial/catalog.json';

// Media/thumb/case-image paths in catalog + post JSON are stored as '/stats/…'.
// Serve them via statsUrl so prod goes straight to static.cuberoot.me instead
// of bouncing off the Vercel /stats route handler (307 + a function invocation
// per image).
export function tutorialMediaUrl(src: string): string {
  return src.startsWith('/stats/') ? statsUrl(src) : src;
}

let catalogCache: CatalogEntry[] | null = null;
let catalogPromise: Promise<CatalogEntry[]> | null = null;

function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (catalogPromise) return catalogPromise;
  catalogPromise = fetch(statsUrl(CATALOG_URL))
    .then(r => {
      if (!r.ok) throw new Error(`catalog fetch ${r.status}`);
      return r.json() as Promise<CatalogEntry[]>;
    })
    .then(data => {
      catalogCache = data;
      return data;
    })
    .catch(err => {
      catalogPromise = null;
      throw err;
    });
  return catalogPromise;
}

export function useTutorialCatalog(): {
  catalog: CatalogEntry[] | null;
  loading: boolean;
  error: string | null;
} {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(catalogCache);
  const [loading, setLoading] = useState(catalogCache === null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (catalogCache) {
      setCatalog(catalogCache);
      setLoading(false);
      return;
    }
    fetchCatalog()
      .then(c => { setCatalog(c); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);
  return { catalog, loading, error };
}

export function usePostContent(slug: string | undefined): {
  post: PostContent | null;
  loading: boolean;
  error: string | null;
} {
  const [post, setPost] = useState<PostContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(statsUrl(`/stats/tutorial/posts/${encodeURIComponent(slug)}.json`))
      .then(r => {
        if (!r.ok) throw new Error(`post ${slug} not found`);
        return r.json() as Promise<PostContent>;
      })
      .then(setPost)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);
  return { post, loading, error };
}
