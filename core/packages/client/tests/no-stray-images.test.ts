// 死图守卫:仓库内 raster 图片只许落在各 public/ 资产目录。
// AI 产出的截图 / 调试图一律去 .tmp/png/(已 gitignore),禁 commit 进 core/ 任何非 public/ 路径。
//
// 分层:写入即拦(机器本地全局 hook block-repo-image-write.ps1 / redirect-screenshot.ps1)是第一层,
// .gitignore 的 /core/*.png 等模式挡 git add 是第二层,这条 CI 守卫是仓库常驻兜底 —— 对所有贡献者 / AI
// 生效,无论图是怎么进来的,只要 commit 进了 core/ 非 public/ 位置就红。
//
// 已清零,用硬断言 toEqual([]);真要随仓库带的图片资产请放 public/ 下,或加进 ALLOWLIST。
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

const RASTER = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

// 整路径豁免(确属必须随仓库、又不能进 public/ 的图;目前为空)。
const ALLOWLIST = new Set<string>([]);

function trackedFiles(): string[] {
  // git ls-files 读 index(全部已跟踪路径),CI sparse-checkout 下也能拿到 core/ 全量;
  // 只看路径不读内容,故不依赖工作树是否实际 checkout 了该文件。
  const top = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  return execSync('git ls-files', { cwd: top, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

describe('No stray raster images under core/ (debug-image guard)', () => {
  const files = trackedFiles();

  it('git ls-files returned a meaningful tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('every tracked raster under core/ lives in a public/ dir', () => {
    const offenders = files.filter(
      (f) =>
        f.startsWith('core/') &&
        RASTER.test(f) &&
        !f.includes('/public/') &&
        !ALLOWLIST.has(f),
    );
    expect(
      offenders,
      '发现 core/ 下非 public/ 的 raster 图片(疑似 AI / 调试产出)。\n' +
        'AI 截图 / 调试图请落 .tmp/png/(已 gitignore);合法图片资产放各 public/ 下。\n' +
        '若确为必须随仓库的图片资产,移到 public/ 或加进本测试的 ALLOWLIST。\n命中:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
