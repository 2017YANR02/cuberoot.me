import { useEffect, useState } from 'react';

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

const CATALOG_URL = '/stats/alg/catalog.json';

let catalogCache: CatalogEntry[] | null = null;
let catalogPromise: Promise<CatalogEntry[]> | null = null;

function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (catalogPromise) return catalogPromise;
  catalogPromise = fetch(CATALOG_URL)
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

export function useAlgCatalog(): {
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
    fetch(`/stats/alg/posts/${encodeURIComponent(slug)}.json`)
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
