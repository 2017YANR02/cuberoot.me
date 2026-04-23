import fg from 'fast-glob';
import path from 'node:path';
import fs from 'fs-extra';
import type { DocxFile } from './types.js';

/** 递归扫描 docx，跳过规则见 CLAUDE 项目说明 */
const EXCLUDE_GLOBS = [
  '**/Images/**',
  '**/framecount/**',
  '**/old/**',
  '**/未发布/**',
  '**/need translate/**',
  '**/~$*',
  '**/.*/**', // 隐藏目录
];

/** 文件名启发：明显中间产物 */
const INTERMEDIATE_FILENAME_RE = /(草稿|临时|备份|副本|未完成|wip|draft|test|tmp|backup|copy\s*of)/i;

/** 从文件系统扫出所有要处理的 docx */
export async function walkDocx(srcRoot: string): Promise<DocxFile[]> {
  const absRoot = path.resolve(srcRoot);
  const relPaths = await fg('**/*.docx', {
    cwd: absRoot,
    ignore: EXCLUDE_GLOBS,
    dot: false,
    caseSensitiveMatch: false,
  });

  const results: DocxFile[] = [];
  for (const rel of relPaths) {
    const filename = path.basename(rel);
    // 二层启发过滤
    if (filename.startsWith('~$')) continue;
    if (/^[~_]/.test(filename)) continue;
    if (INTERMEDIATE_FILENAME_RE.test(filename)) continue;

    const abs = path.join(absRoot, rel);
    try {
      const stat = await fs.stat(abs);
      results.push({
        relPath: rel.replace(/\\/g, '/'),
        absPath: abs,
        filename,
        mtime: stat.mtimeMs,
        sizeBytes: stat.size,
      });
    } catch {
      // stat 失败（访问被拒等）跳过
    }
  }
  return results;
}
