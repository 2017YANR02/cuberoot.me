import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build, transform } from 'esbuild';

// Factor shared dependencies once, then lower each chunk to the native
// Mini Program CommonJS loader. No ESM or browser script loader is shipped.
export async function buildWechatBundle(options) {
  const result = await build({
    ...options,
    format: 'esm',
    splitting: true,
    write: false,
    chunkNames: 'shared/[name]-[hash]',
    sourcemap: options.sourcemap ? 'inline' : false,
  });
  await Promise.all(result.outputFiles.map(async (file) => {
    const transformed = await transform(file.text, {
      format: 'cjs',
      target: options.target,
      sourcefile: file.path,
      sourcemap: options.sourcemap ? 'inline' : false,
      minify: !options.sourcemap,
    });
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, transformed.code);
  }));
  return result;
}
