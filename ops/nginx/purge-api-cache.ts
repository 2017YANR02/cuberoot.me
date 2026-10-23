// Keep this TypeScript entry JS-compatible: workflows stream it to remote
// `node --input-type=module`, without installing or compiling server-side files.
import { lstatSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Intentionally fixed: no argument or environment variable can widen deletion.
const cacheRoot = '/var/cache/nginx/api';
const root = lstatSync(cacheRoot);
if (!root.isDirectory() || root.isSymbolicLink() || realpathSync(cacheRoot) !== cacheRoot) {
  throw new Error('Refusing cache purge: expected a real directory at ' + cacheRoot);
}
process.chdir(cacheRoot);
if (realpathSync('.') !== cacheRoot) {
  throw new Error('Refusing cache purge: cache directory changed during validation');
}

// nginx uses levels=1:2 and 32-character MD5 cache filenames. Leave temporary
// writes, unexpected files, symlinks and all directories untouched. Never follow
// links or cross filesystem boundaries; concurrent file expiry is harmless.
const hex = '[0-9a-f]';
const cacheFile = `./${hex}/${hex}${hex}/${hex.repeat(32)}`;
const result = spawnSync('/usr/bin/find', [
  '-P', '.', '-xdev', '-ignore_readdir_race', '-mindepth', '3', '-maxdepth', '3',
  '-type', 'f', '-path', cacheFile, '-delete',
], { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
if (result.error) throw result.error;
if (result.stderr) process.stderr.write(result.stderr);
// Some find implementations report unlink errors only on stderr, with exit 0.
if (result.status !== 0 || result.stderr) {
  throw new Error(`API cache purge failed (exit ${result.status}, signal ${result.signal})`);
}
// Cache files are checked on lookup; purging does not require an nginx reload.
console.log('API cache files purged; directories and non-cache files preserved');
