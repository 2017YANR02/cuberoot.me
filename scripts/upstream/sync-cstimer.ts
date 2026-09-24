import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertClone, assertFiles, command, git, parseOptions, readUtf8, repoRoot, upstreamDir, versionRecord, writeUtf8 } from './lib.js';

interface Input { root: string; upstream: string; skipPull?: boolean }
export function syncCstimer({ root, upstream, skipPull = false }: Input): void {
  assertFiles(root, ['scripts/upstream/sync-cstimer.ts', 'scripts/upstream/lib.ts', 'docs/generated-artifacts.json']);
  assertClone(upstream);
  if (!skipPull) command('git', ['-C', upstream, 'pull', '--ff-only', 'origin', 'master']);
  if (process.platform === 'win32') {
    const bash = process.env.CUBE_GIT_BASH ?? 'bash';
    const prefix = process.env.CUBE_MINGW_BIN ? `export PATH="${process.env.CUBE_MINGW_BIN}:$PATH" && ` : '';
    command(bash, ['-c', `${prefix}mingw32-make local`], { cwd: upstream });
    command(bash, ['-c', `${prefix}mingw32-make battle_module`], { cwd: upstream });
  } else {
    command('make', ['local'], { cwd: upstream });
    command('make', ['battle_module'], { cwd: upstream });
  }
  const dist = join(upstream, 'dist/local');
  const target = join(root, 'tools/cstimer');
  mkdirSync(target, { recursive: true });
  for (const item of readdirSync(dist)) cpSync(join(dist, item), join(target, item), { recursive: true, force: true });
  cpSync(join(upstream, 'dist/js/scramble_module.js'), join(root, 'core/packages/client/public/scramble_module.js'), { force: true });
  const langTarget = join(target, 'lang');
  mkdirSync(langTarget, { recursive: true });
  for (const item of readdirSync(join(upstream, 'dist/lang')).filter(name => name.endsWith('.js'))) cpSync(join(upstream, 'dist/lang', item), join(langTarget, item), { force: true });
  const index = join(target, 'index.html');
  const anchor = "var LANG_CUR = 'en-us';";
  const html = readUtf8(index);
  if (!html.includes(anchor)) throw new Error('csTimer LANG_CUR patch anchor missing; version record was not advanced');
  const bootstrap = `\n// NOTE: CubeRoot static deployment language bootstrap\n(function() {\n  var m = location.search.match(/[?&]lang=([a-z]{2}-[a-z]{2})/);\n  if (m && m[1] !== 'en-us') {\n    LANG_CUR = m[1];\n    document.write('<script src="lang/' + m[1] + '.js"><\\/script>');\n  }\n})();`;
  writeUtf8(index, html.replace(anchor, anchor + bootstrap));
  versionRecord(root, 'tools.cstimer', upstream);
  console.log(`csTimer ${git(upstream, 'describe', '--tags', '--always')} synced; CubeRoot changes remain uncommitted`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(); const root = repoRoot(options);
  assertFiles(root, ['scripts/upstream/sync-cstimer.ts', 'scripts/upstream/lib.ts']);
  if (options.validateOnly) console.log('csTimer sync validated');
  else syncCstimer({ root, upstream: upstreamDir(root, 'cstimer', options, 'cstimerDir'), skipPull: Boolean(options.skipPull) });
}
