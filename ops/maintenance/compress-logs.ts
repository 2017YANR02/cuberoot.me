import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processReferences } from './prune-api-releases.ts';

export const logPolicies = [
  { root: '/www/wwwlogs', pattern: /^(?:.*cuberoot\.me.*\.log|127\.0\.0\.1.*\.log|access\.log|nginx_error\.log|tcp-access\.log|tcp-error\.log)-\d{8}$/ },
  { root: '/var/log', pattern: /^(?:cron|maillog|messages|secure|spooler|kern)-\d{8}$/ },
  { root: '/root/.pm2/logs', pattern: /^core-api-(?:out|error)\.log-\d{8}$/ },
];

// Run under the same lock as the daily logrotate wrapper. Keep delaycompress: nginx
// reopens asynchronously, so an archive is compressed only after its writers close.
export function compressLogs(policies = logPolicies, references = processReferences(), now = Date.now()) {
  const compressed: string[] = [], skipped: string[] = [];
  for (const { root, pattern } of policies) {
    if (realpathSync(root) !== root || !lstatSync(root).isDirectory()) throw new Error(`Unsafe log directory: ${root}`);
    for (const name of readdirSync(root).filter((name) => pattern.test(name)).sort()) {
      const path = join(root, name), stat = lstatSync(path);
      if (!stat.isFile() || stat.nlink !== 1 || existsSync(`${path}.gz`)
        || now - stat.mtimeMs < 10 * 60_000 || references.some((reference) => reference.includes(path))) {
        skipped.push(path);
        continue;
      }
      execFileSync('gzip', ['--', path], { timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
      compressed.push(path);
    }
  }
  return { compressed, skipped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Unexpected arguments');
  console.log(JSON.stringify(compressLogs()));
}
