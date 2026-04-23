import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import type { DocxFile, Lang } from './types.js';

interface MediaEntry {
  filename: string;
  bytes: Buffer;
  /** 前 16 位 sha1 hex */
  contentHash: string;
  ext: string;
}

interface DocxAssets {
  /** filename → MediaEntry (word/media/ 下全部文件) */
  media: Map<string, MediaEntry>;
  /** contentHash → MediaEntry，用于 mammoth 回调按 bytes 反查 filename */
  byHash: Map<string, MediaEntry>;
  /** PNG filename → 对应的 SVG filename (ECMA-376 svgBlip 扩展关系) */
  svgPairing: Map<string, string>;
}

/**
 * 解包 docx 拿 media + svgBlip 配对关系
 *
 * ECMA-376 扩展 (svgBlip): Office 在插入 SVG 时，同时保留一个 PNG fallback，
 * document.xml 里形如:
 *   <a:blip r:embed="rId1">
 *     <a:extLst>
 *       <a:ext uri="{96DAC541-...}">
 *         <asvg:svgBlip r:embed="rId2"/>
 *       </a:ext>
 *     </a:extLst>
 *   </a:blip>
 *
 * 我们解 rels 拿 rId → filename，再扫 blip/svgBlip 拿配对关系。
 */
function extractAssets(docxPath: string): DocxAssets {
  const media = new Map<string, MediaEntry>();
  const byHash = new Map<string, MediaEntry>();
  const svgPairing = new Map<string, string>();

  const zip = new AdmZip(docxPath);

  // 1. 所有 word/media/*
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const en = entry.entryName.replace(/\\/g, '/');
    if (!en.startsWith('word/media/')) continue;
    const filename = path.basename(en);
    const bytes = entry.getData();
    const contentHash = crypto
      .createHash('sha1')
      .update(bytes)
      .digest('hex')
      .slice(0, 16);
    const ext = path.extname(filename).toLowerCase();
    const e: MediaEntry = { filename, bytes, contentHash, ext };
    media.set(filename, e);
    byHash.set(contentHash, e);
  }

  // 2. word/_rels/document.xml.rels → rId → filename
  const relsEntry = zip.getEntry('word/_rels/document.xml.rels');
  const relsXml = relsEntry ? relsEntry.getData().toString('utf8') : '';
  const rIdToFile = new Map<string, string>();
  const relRe = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relRe.exec(relsXml)) !== null) {
    const rId = relMatch[1];
    const target = relMatch[2];
    // Target 可能是 'media/image1.png' 或 '../media/image1.png'
    rIdToFile.set(rId, path.basename(target));
  }

  // 3. word/document.xml → blip + svgBlip 配对
  const docEntry = zip.getEntry('word/document.xml');
  const docXml = docEntry ? docEntry.getData().toString('utf8') : '';

  // 匹配 <a:blip r:embed="..."> ... </a:blip> (可能跨多行 + 自闭合变体)
  const blipRe = /<a:blip\b[^>]*r:embed="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/a:blip>)/g;
  let bm: RegExpExecArray | null;
  while ((bm = blipRe.exec(docXml)) !== null) {
    const pngRid = bm[1];
    const inner = bm[2] ?? '';
    // 在 inner 里找 svgBlip (前缀可能是 asvg: 或其他)
    const svgMatch = /<[A-Za-z]+:svgBlip[^>]*r:embed="([^"]+)"/.exec(inner);
    if (!svgMatch) continue;
    const svgRid = svgMatch[1];
    const pngFile = rIdToFile.get(pngRid);
    const svgFile = rIdToFile.get(svgRid);
    if (pngFile && svgFile) svgPairing.set(pngFile, svgFile);
  }

  return { media, byHash, svgPairing };
}

export interface ExtractResult {
  html: string;
  title: string | null;
  warningCount: number;
  thumbSrc: string | null;
  hasImages: boolean;
  hasTables: boolean;
  /** 写出的媒体文件相对路径（用于 debug / asset 清单） */
  mediaFiles: string[];
  /** 内容 plain text 去空白后的总字符数（用于 < 50 过滤） */
  plainTextLen: number;
}

/**
 * 提取单个 docx 为 HTML + 媒体资源。
 * - mammoth 做 docx → HTML
 * - imgHandler 通过字节 hash 找回原 filename，查 svgPairing 换 SVG，并把文件落盘到 media/<slug>/<lang>/
 * - PNG 仍落盘作为 <img onerror> 兜底（transformHtml 阶段添加 onerror）
 */
export async function extractDocx(
  docxFile: DocxFile,
  lang: Lang,
  slug: string,
  outputRoot: string,
): Promise<ExtractResult> {
  const assets = extractAssets(docxFile.absPath);
  const mediaOutDir = path.join(outputRoot, 'media', slug, lang);
  await fs.ensureDir(mediaOutDir);
  const writtenFiles: string[] = [];
  const writtenSet = new Set<string>();

  const writeOnce = async (filename: string, bytes: Buffer): Promise<string> => {
    const outPath = path.join(mediaOutDir, filename);
    if (!writtenSet.has(filename)) {
      await fs.writeFile(outPath, bytes);
      writtenSet.add(filename);
      writtenFiles.push(filename);
    }
    return `/stats/data/alg/media/${slug}/${lang}/${filename}`;
  };

  const imgHandler = async (
    element: { contentType: string; read(encoding?: string): Promise<Buffer | string> },
  ): Promise<{ src: string }> => {
    const bufRaw = await element.read();
    const buf: Buffer =
      typeof bufRaw === 'string' ? Buffer.from(bufRaw, 'base64') : bufRaw;
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const origEntry = assets.byHash.get(hash);

    if (!origEntry) {
      // 回退：用 mammoth 的 contentType 猜扩展名
      const ct = (element.contentType || 'image/png').toLowerCase();
      const ext = ct.includes('svg')
        ? '.svg'
        : ct.includes('jpeg') || ct.includes('jpg')
          ? '.jpg'
          : ct.includes('gif')
            ? '.gif'
            : ct.includes('emf')
              ? '.emf'
              : ct.includes('wmf')
                ? '.wmf'
                : '.png';
      const fname = `img-${hash}${ext}`;
      const src = await writeOnce(fname, buf);
      return { src };
    }

    // 找到了原 filename。查 SVG 配对
    const svgFilename = assets.svgPairing.get(origEntry.filename);
    if (svgFilename) {
      const svgEntry = assets.media.get(svgFilename);
      if (svgEntry) {
        // 写 SVG + PNG fallback
        const svgSrc = await writeOnce(svgFilename, svgEntry.bytes);
        await writeOnce(origEntry.filename, origEntry.bytes);
        return { src: svgSrc };
      }
    }
    // 没配对 → 直接写原文件
    const src = await writeOnce(origEntry.filename, origEntry.bytes);
    return { src };
  };

  const result = await mammoth.convertToHtml(
    { path: docxFile.absPath },
    {
      convertImage: mammoth.images.imgElement(imgHandler),
    },
  );

  const html = result.value;
  const warningCount = result.messages.filter(
    (m: { type: string }) => m.type === 'warning' || m.type === 'error',
  ).length;

  const $ = cheerio.load(html, null, false);

  // 从 H1 / 标题样式段推标题
  let title: string | null = null;
  const h1 = $('h1').first();
  if (h1.length) title = h1.text().trim() || null;
  if (!title) {
    const p = $('p').first();
    if (p.length) {
      const t = p.text().trim();
      if (t) title = t.slice(0, 80);
    }
  }

  const thumbSrc = $('img').first().attr('src') ?? null;
  const hasImages = $('img').length > 0;
  const hasTables = $('table').length > 0;
  const plainTextLen = $.root().text().replace(/\s+/g, '').length;

  return {
    html,
    title,
    warningCount,
    thumbSrc,
    hasImages,
    hasTables,
    mediaFiles: writtenFiles,
    plainTextLen,
  };
}
