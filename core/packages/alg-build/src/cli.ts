#!/usr/bin/env node
/**
 * alg-build CLI 入口
 *
 * 用法：
 *   pnpm --filter @cuberoot/alg-build build -- --src <docx root> --out <output dir>
 *
 * 产物：
 *   <out>/catalog.json
 *   <out>/posts/<slug>.json
 *   <out>/media/<slug>/{en,zh}/*
 *   <package>/data/build_report.md
 *   <package>/data/alg_detections.log
 *
 * Phase 1 V1 只做 article 视图。algset 视图 (ZBLL/PLL/OLL 等) 是 Phase 1.5 的工作。
 */
import path from 'node:path';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';
import { walkDocx } from './walkDocx.js';
import { pairCnEn } from './pairCnEn.js';
import { extractDocx } from './extractDocx.js';
import { detectAlgs, dedupeAlgs } from './detectAlgs.js';
import { transformHtml } from './transformHtml.js';
import {
  applyOverridesAndOrder,
  writeCatalogAndPosts,
  loadOverrides,
  loadTitlesZh,
  loadHiddenSlugs,
} from './writeCatalog.js';
import type {
  CatalogEntry,
  ExtractedArticle,
  ExtractedPost,
  Lang,
  SlugGroup,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CliArgs {
  src: string;
  out: string;
  incremental?: boolean;
  verbose?: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--src':
        args.src = argv[++i];
        break;
      case '--out':
        args.out = argv[++i];
        break;
      case '--incremental':
        args.incremental = true;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--limit':
        args.limit = Number(argv[++i]);
        break;
    }
  }
  if (!args.src || !args.out) {
    console.error('Usage: alg-build --src <docx root> --out <output dir> [--limit N] [--verbose]');
    process.exit(1);
  }
  return args as CliArgs;
}

interface BuildReport {
  startTime: number;
  endTime: number;
  totalDocxScanned: number;
  totalSlugGroups: number;
  totalPostsExtracted: number;
  totalSkipped: number;
  mammothWarnings: number;
  detectedAlgsCount: number;
  outputSize: { catalog: number; postsCount: number; mediaCount: number };
  /** {reason: [slug list]} */
  skippedByReason: Record<string, string[]>;
  degradedQuality: string[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = path.resolve(__dirname, '..', 'data');
  const outRoot = path.resolve(args.out);

  console.log('[alg-build] starting');
  console.log(`  src:     ${path.resolve(args.src)}`);
  console.log(`  out:     ${outRoot}`);
  console.log(`  dataDir: ${dataDir}`);

  await fs.ensureDir(outRoot);
  await fs.ensureDir(path.join(outRoot, 'posts'));
  await fs.ensureDir(path.join(outRoot, 'media'));

  const report: BuildReport = {
    startTime: Date.now(),
    endTime: 0,
    totalDocxScanned: 0,
    totalSlugGroups: 0,
    totalPostsExtracted: 0,
    totalSkipped: 0,
    mammothWarnings: 0,
    detectedAlgsCount: 0,
    outputSize: { catalog: 0, postsCount: 0, mediaCount: 0 },
    skippedByReason: {},
    degradedQuality: [],
  };
  const detectionLogLines: string[] = [];

  // 1. 扫描 docx
  const files = await walkDocx(args.src);
  report.totalDocxScanned = files.length;
  console.log(`[alg-build] scanned ${files.length} docx`);

  // 2. 中英配对
  const groupsAll = pairCnEn(files);
  report.totalSlugGroups = groupsAll.length;
  console.log(`[alg-build] paired into ${groupsAll.length} slug groups`);

  const groups = args.limit ? groupsAll.slice(0, args.limit) : groupsAll;
  if (args.limit) console.log(`[alg-build] --limit ${args.limit} active`);

  // 3. 读 overrides / hidden
  const [overrides, titlesZh, hiddenSlugs] = await Promise.all([
    loadOverrides(dataDir),
    loadTitlesZh(dataDir),
    loadHiddenSlugs(dataDir),
  ]);

  // 4. 每个 slug group 处理
  const catalogEntries: CatalogEntry[] = [];
  const posts = new Map<string, ExtractedPost>();

  const addSkipped = (slug: string, reason: string) => {
    report.totalSkipped++;
    (report.skippedByReason[reason] ??= []).push(slug);
  };

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    try {
      const post = await processGroup(g, outRoot, detectionLogLines);
      if (!post) {
        addSkipped(g.slug, 'empty-content (<50 chars)');
        continue;
      }

      report.mammothWarnings += post.warningCount;
      report.detectedAlgsCount += post.algs.length;

      const { post: finalPost, entry } = applyOverridesAndOrder(
        post,
        overrides,
        titlesZh,
        hiddenSlugs,
      );
      entry.mtime = g.primaryMtime;
      if (entry.quality === 'degraded') report.degradedQuality.push(g.slug);

      catalogEntries.push(entry);
      posts.set(g.slug, finalPost);
      report.totalPostsExtracted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addSkipped(g.slug, `error: ${msg.slice(0, 80)}`);
      if (args.verbose) console.error(`[skip] ${g.slug}:`, err);
    }

    if ((i + 1) % 20 === 0) {
      console.log(`[alg-build] progress: ${i + 1}/${groups.length}`);
    }
  }

  // 5. 写产物
  await writeCatalogAndPosts(catalogEntries, posts, outRoot);
  console.log(`[alg-build] wrote catalog.json (${catalogEntries.length} entries)`);
  console.log(`[alg-build] wrote ${posts.size} posts/*.json`);

  // 6. 写 detections log + build_report
  await fs.writeFile(
    path.join(dataDir, 'alg_detections.log'),
    detectionLogLines.join('\n') + '\n',
    'utf8',
  );

  report.endTime = Date.now();
  const catalogSize = (await fs.stat(path.join(outRoot, 'catalog.json'))).size;
  report.outputSize.catalog = catalogSize;
  report.outputSize.postsCount = posts.size;

  await fs.writeFile(
    path.join(dataDir, 'build_report.md'),
    formatReport(report),
    'utf8',
  );

  console.log('[alg-build] done in', ((report.endTime - report.startTime) / 1000).toFixed(1), 's');
  console.log(`  extracted: ${report.totalPostsExtracted}`);
  console.log(`  skipped:   ${report.totalSkipped}`);
  console.log(`  detected:  ${report.detectedAlgsCount} algs`);
  console.log(`  degraded:  ${report.degradedQuality.length}`);
}

async function processGroup(
  g: SlugGroup,
  outRoot: string,
  detectionLog: string[],
): Promise<ExtractedArticle | null> {
  const post: ExtractedArticle = {
    view: 'article',
    slug: g.slug,
    category: g.category,
    subcategory: g.subcategory,
    topDir: g.topDir,
    title: {},
    content: {},
    algs: [],
    thumb: null,
    warningCount: 0,
    hasImages: false,
    hasTables: false,
  };

  const langs: Lang[] = [];
  if (g.versions.en) langs.push('en');
  if (g.versions.zh) langs.push('zh');

  let plainLenMax = 0;

  for (const lang of langs) {
    const docx = g.versions[lang]!;
    const ex = await extractDocx(docx, lang, g.slug, outRoot);
    post.warningCount += ex.warningCount;
    post.hasImages ||= ex.hasImages;
    post.hasTables ||= ex.hasTables;
    if (ex.title) post.title[lang] = ex.title;
    if (ex.thumbSrc && !post.thumb) post.thumb = ex.thumbSrc;

    // detectAlgs → chip 替换
    const { html: htmlWithChips, detected } = detectAlgs(ex.html, g.slug);
    for (const d of detected) {
      detectionLog.push(`${g.slug}[${lang}] ${d.context ?? ''}: ${d.alg}`);
    }

    // transformHtml cleanup + see-also
    const finalHtml = transformHtml(htmlWithChips, g.slug);
    post.content[lang] = finalHtml;
    post.algs.push(...detected.map(d => d.alg));
    plainLenMax = Math.max(plainLenMax, ex.plainTextLen);
  }

  // 中间产物启发：plain text 太短 → 跳
  if (plainLenMax < 50) return null;

  post.algs = dedupeAlgs(post.algs.map(a => ({ alg: a, source: 'auto' as const })));

  // fallback title: 从 filename 推（去 -CHS、去扩展名）
  if (!post.title.en && !post.title.zh) {
    const src = g.versions.en ?? g.versions.zh;
    if (src) {
      const t = src.filename.replace(/\.docx$/i, '').replace(/[-_\s]?CHS\b/gi, '').trim();
      if (langs.includes('en')) post.title.en = t;
      if (langs.includes('zh')) post.title.zh = t;
    }
  }

  return post;
}

function formatReport(r: BuildReport): string {
  const durSec = ((r.endTime - r.startTime) / 1000).toFixed(1);
  const lines: string[] = [];
  lines.push(`# alg-build report`);
  lines.push('');
  lines.push(`- 执行时间: ${new Date(r.startTime).toISOString()} (${durSec}s)`);
  lines.push(`- 扫描 docx: **${r.totalDocxScanned}**`);
  lines.push(`- slug groups: **${r.totalSlugGroups}**`);
  lines.push(`- 成功提取: **${r.totalPostsExtracted}**`);
  lines.push(`- 跳过: **${r.totalSkipped}**`);
  lines.push(`- mammoth 警告总数: ${r.mammothWarnings}`);
  lines.push(`- 识别 chip (可能重复): ${r.detectedAlgsCount}`);
  lines.push(`- quality=degraded: ${r.degradedQuality.length}`);
  lines.push(`- catalog.json 大小: ${(r.outputSize.catalog / 1024).toFixed(1)} KB`);
  lines.push(`- posts/*.json 数: ${r.outputSize.postsCount}`);
  lines.push('');

  if (Object.keys(r.skippedByReason).length) {
    lines.push('## 跳过明细');
    for (const [reason, slugs] of Object.entries(r.skippedByReason)) {
      lines.push(`### ${reason} (${slugs.length})`);
      for (const s of slugs.slice(0, 20)) lines.push(`- ${s}`);
      if (slugs.length > 20) lines.push(`  ... 还有 ${slugs.length - 20} 项`);
      lines.push('');
    }
  }

  if (r.degradedQuality.length) {
    lines.push('## degraded quality (mammoth warnings > 10)');
    for (const s of r.degradedQuality.slice(0, 30)) lines.push(`- ${s}`);
    if (r.degradedQuality.length > 30) lines.push(`  ... 还有 ${r.degradedQuality.length - 30} 项`);
    lines.push('');
  }

  return lines.join('\n');
}

main().catch(err => {
  console.error('[alg-build] fatal:', err);
  process.exit(1);
});
