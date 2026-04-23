import path from 'node:path';
import fs from 'fs-extra';
import type {
  ExtractedPost,
  CatalogEntry,
  ManualOverrides,
} from './types.js';
import { categoryOrder, slugOrder } from './inferCategory.js';

/** 应用 manual_overrides，生成最终的 post + catalog entry */
export function applyOverridesAndOrder(
  post: ExtractedPost,
  overrides: ManualOverrides,
  titlesZh: Record<string, string>,
  hiddenSlugs: Record<string, string>,
): { post: ExtractedPost; entry: CatalogEntry } {
  const ov = overrides[post.slug];

  if (ov?.title) post.title = { ...post.title, ...ov.title };
  if (!post.title.zh && titlesZh[post.slug]) post.title.zh = titlesZh[post.slug];
  if (ov?.category) post.category = ov.category;
  if (ov?.subcategory !== undefined) post.subcategory = ov.subcategory;

  const hidden = !!(hiddenSlugs[post.slug] || ov?.hidden);

  let order: number;
  if (ov?.order !== undefined) order = ov.order;
  else {
    const skw = slugOrder(post.slug);
    order = skw !== null ? skw : categoryOrder(post.category);
  }

  const quality: 'ok' | 'degraded' = post.warningCount > 10 ? 'degraded' : 'ok';

  // 根据 view 算 hasEn/hasZh/algCount
  let hasEn: boolean;
  let hasZh: boolean;
  let algCount: number;
  if (post.view === 'article') {
    hasEn = !!post.content.en;
    hasZh = !!post.content.zh;
    algCount = post.algs.length;
  } else {
    // algset: 内容跨语言共享，只看 title 是否有
    hasEn = !!post.title.en;
    hasZh = !!post.title.zh;
    algCount = post.cases.length;
  }

  const entry: CatalogEntry = {
    slug: post.slug,
    view: post.view,
    title: post.title,
    category: post.category,
    subcategory: post.subcategory,
    topDir: post.topDir,
    thumb: post.thumb,
    mtime: 0,
    hasEn,
    hasZh,
    order,
    hidden,
    quality,
    algCount,
  };

  return { post, entry };
}

/** 写 catalog.json + posts/<slug>.json */
export async function writeCatalogAndPosts(
  entries: CatalogEntry[],
  posts: Map<string, ExtractedPost>,
  outputRoot: string,
): Promise<void> {
  // catalog 排序：order ASC, 同 order 按 mtime DESC
  entries.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return b.mtime - a.mtime;
  });

  await fs.ensureDir(outputRoot);
  const catalogPath = path.join(outputRoot, 'catalog.json');
  await fs.writeJSON(catalogPath, entries, { spaces: 2 });

  const postsDir = path.join(outputRoot, 'posts');
  await fs.ensureDir(postsDir);
  for (const [slug, post] of posts) {
    const p = path.join(postsDir, `${slug}.json`);
    await fs.writeJSON(p, post, { spaces: 0 });
  }
}

/** 读 data/manual_overrides.json (忽略 _schema / _doc) */
export async function loadOverrides(dataDir: string): Promise<ManualOverrides> {
  const p = path.join(dataDir, 'manual_overrides.json');
  if (!(await fs.pathExists(p))) return {};
  const raw = (await fs.readJSON(p)) as Record<string, unknown>;
  const out: ManualOverrides = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    out[k] = v as ManualOverrides[string];
  }
  return out;
}

export async function loadTitlesZh(dataDir: string): Promise<Record<string, string>> {
  const p = path.join(dataDir, 'titles_zh.json');
  if (!(await fs.pathExists(p))) return {};
  const raw = (await fs.readJSON(p)) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export async function loadHiddenSlugs(dataDir: string): Promise<Record<string, string>> {
  const p = path.join(dataDir, 'hidden_slugs.json');
  if (!(await fs.pathExists(p))) return {};
  const raw = (await fs.readJSON(p)) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
