import path from 'node:path';
import fs from 'fs-extra';
import type {
  ExtractedArticle,
  ExtractedPost,
  CatalogEntry,
  ManualOverrides,
} from './types.js';
import { categoryOrder, slugOrder } from './inferCategory.js';

/** 应用 manual_overrides，生成最终的 post + catalog entry */
export function applyOverridesAndOrder(
  post: ExtractedArticle,
  overrides: ManualOverrides,
  titlesZh: Record<string, string>,
  hiddenSlugs: Record<string, string>,
): { post: ExtractedPost; entry: CatalogEntry } {
  const ov = overrides[post.slug];

  // title override
  if (ov?.title) {
    post.title = { ...post.title, ...ov.title };
  }
  // zh title fallback from titles_zh.json
  if (!post.title.zh && titlesZh[post.slug]) {
    post.title.zh = titlesZh[post.slug];
  }
  // category override
  if (ov?.category) post.category = ov.category;
  if (ov?.subcategory !== undefined) post.subcategory = ov.subcategory;

  const hidden = !!(hiddenSlugs[post.slug] || ov?.hidden);

  // 排序权重：manual > slug keyword > category
  let order: number;
  if (ov?.order !== undefined) order = ov.order;
  else {
    const skw = slugOrder(post.slug);
    order = skw !== null ? skw : categoryOrder(post.category);
  }

  // quality: mammoth warnings > 10 → degraded
  const quality: 'ok' | 'degraded' = post.warningCount > 10 ? 'degraded' : 'ok';

  // mtime 从 post 外部传入 (见 cli.ts)
  // 此函数不处理 mtime；由调用者合并

  const entry: CatalogEntry = {
    slug: post.slug,
    view: post.view,
    title: post.title,
    category: post.category,
    subcategory: post.subcategory,
    topDir: post.topDir,
    thumb: post.thumb,
    mtime: 0, // 占位，由调用者填
    hasEn: !!post.content.en,
    hasZh: !!post.content.zh,
    order,
    hidden,
    quality,
    algCount: post.algs.length,
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
