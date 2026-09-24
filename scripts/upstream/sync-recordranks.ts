import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertClone, assertFiles, command, git, gitAncestor, gitPrint, parseOptions, readUtf8, repoRoot, upstreamDir, writeUtf8 } from './lib.js';

interface Input { root: string; upstream: string; skipPull?: boolean; dryRun?: boolean; skipInstall?: boolean }
const validationEnv = { NEXT_PUBLIC_PROJECT_NAME: 'CubeRoot Contests', PROJECT_ID: 'cuberoot-contests', NEXT_PUBLIC_AUTH_PROVIDERS: 'credential', NEXT_PUBLIC_MULTITENANCY_ENABLED: 'false' };

export function syncRecordRanks({ root, upstream, skipPull = false, dryRun = false, skipInstall = false }: Input): void {
  assertFiles(root, ['scripts/upstream/sync-recordranks.ts', 'scripts/upstream/lib.ts', 'ops/contests/recordranks-ref.txt']);
  assertClone(upstream);
  const refPath = join(root, 'ops/contests/recordranks-ref.txt');
  const current = readUtf8(refPath).trim();
  if (!/^[a-f\d]{40}$/.test(current)) throw new Error(`Invalid RecordRanks deployment SHA: ${current}`);
  if (git(upstream, 'branch', '--show-current') !== 'main') throw new Error('RecordRanks must be on main');
  if (git(upstream, 'status', '--porcelain=v1', '--untracked-files=all')) throw new Error('RecordRanks working tree is dirty');
  const origin = git(upstream, 'remote', 'get-url', 'origin');
  const remote = git(upstream, 'remote', 'get-url', 'upstream');
  if (!/github\.com[:/]2017YANR02\/RecordRanks(?:\.git)?$/i.test(origin)) throw new Error(`Unexpected RecordRanks origin: ${origin}`);
  if (!/github\.com[:/]mintydev789\/RecordRanks(?:\.git)?$/i.test(remote)) throw new Error(`Unexpected RecordRanks upstream: ${remote}`);
  if (!skipPull) {
    gitPrint(upstream, 'fetch', '--prune', 'origin', 'main');
    gitPrint(upstream, 'fetch', '--prune', 'upstream', 'main');
    let comparison = 'HEAD';
    if (!gitAncestor(upstream, 'origin/main', 'HEAD')) {
      if (!gitAncestor(upstream, 'HEAD', 'origin/main')) throw new Error('RecordRanks local main diverged from origin/main');
      if (dryRun) comparison = 'origin/main';
      else gitPrint(upstream, 'merge', '--ff-only', 'origin/main');
    }
    const range = `${comparison}..upstream/main`;
    const count = Number(git(upstream, 'rev-list', '--count', range));
    if (dryRun) {
      console.log(`RecordRanks pending upstream commits: ${count}`);
      if (count) gitPrint(upstream, 'log', '--oneline', '--decorate', range);
      return;
    }
    if (count) {
      try { gitPrint(upstream, 'merge', '--no-edit', 'upstream/main'); }
      catch (error) {
        try { gitPrint(upstream, 'merge', '--abort'); }
        catch (abortError) { throw new Error(`RecordRanks merge and abort failed: ${String(error)} / ${String(abortError)}`); }
        throw new Error(`RecordRanks merge aborted: ${String(error)}`);
      }
    }
  } else if (dryRun) { console.log('RecordRanks dry run with skip pull: no changes'); return; }
  const revision = git(upstream, 'rev-parse', 'HEAD');
  if (git(upstream, 'cat-file', '-t', current) !== 'commit') throw new Error(`Pinned RecordRanks SHA not found: ${current}`);
  if (current !== revision) {
    const critical = git(upstream, 'diff', '--name-only', `${current}..${revision}`, '--', 'client/.env.example', 'client/package.json5', 'client/pnpm-lock.yaml', 'client/proxy.ts', 'client/server/db/drizzle', 'client/server/logger.ts', 'client/app/api/healthcheck/healthcheck.ts');
    if (critical) console.warn(`Review RecordRanks sensitive files:\n${critical}`);
    const migrations = git(upstream, 'diff', '--name-status', `${current}..${revision}`, '--', ':(glob)client/server/db/drizzle/*/migration.sql').split('\n').filter(line => line && !/^A\s/.test(line));
    if (migrations.length) throw new Error(`Published RecordRanks migrations changed:\n${migrations.join('\n')}`);
  }
  const logger = readUtf8(join(upstream, 'client/server/logger.ts'));
  const health = readUtf8(join(upstream, 'client/app/api/healthcheck/healthcheck.ts'));
  const proxy = readUtf8(join(upstream, 'client/proxy.ts'));
  if (!logger.includes('const logflareConfigured = Boolean(') || !logger.includes('transport ? pino(transport) : pino()')) throw new Error('RecordRanks Logflare compatibility patch missing');
  if (!health.includes('!process.env.EMAIL_HOST || !process.env.EMAIL_PORT') || !health.includes('configured: false')) throw new Error('RecordRanks SMTP compatibility patch missing');
  if (!proxy.includes('function getSingleTenantDestination') || !proxy.includes('NextResponse.redirect(getSingleTenantDestination') || proxy.includes('NextResponse.rewrite(request.url.replace')) throw new Error('RecordRanks single tenant compatibility patch missing');
  const client = join(upstream, 'client');
  const env: NodeJS.ProcessEnv = { ...process.env, ...validationEnv };
  delete env.CIRCLE_NODE_TOTAL;
  if (!skipInstall) command('pnpm', ['install', '--frozen-lockfile'], { cwd: client, env });
  command('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: client, env });
  command('pnpm', ['test'], { cwd: client, env });
  command('pnpm', ['build'], { cwd: client, env: {
    ...env, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=4096', PORT: '3005', TZ: 'UTC', PROD_HOSTNAME: 'contests.cuberoot.me', NEXT_PUBLIC_BASE_URL: 'https://contests.cuberoot.me', NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL: 'https://contests.cuberoot.me', BETTER_AUTH_URL: 'https://contests.cuberoot.me', BETTER_AUTH_SECRET: 'build-only-secret-not-used-at-runtime', DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'recordranks', DB_USERNAME: 'recordranks_app', DB_PASSWORD: 'build-only-password', NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(), NEXT_PUBLIC_VERSION: revision,
  } });
  gitPrint(upstream, 'push', 'origin', 'HEAD:main');
  const remoteRevision = git(upstream, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
  if (remoteRevision !== revision) throw new Error(`RecordRanks fork SHA mismatch: ${remoteRevision} vs ${revision}`);
  if (current !== revision) writeUtf8(refPath, `${revision}\n`);
  console.log(`RecordRanks ${revision.slice(0, 7)} fork synced; CubeRoot deployment SHA updated but not committed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(); const root = repoRoot(options);
  assertFiles(root, ['scripts/upstream/sync-recordranks.ts', 'scripts/upstream/lib.ts', 'ops/contests/recordranks-ref.txt']);
  if (options.validateOnly) console.log('RecordRanks sync validated');
  else syncRecordRanks({ root, upstream: upstreamDir(root, 'recordranks', options, 'recordRanksDir'), skipPull: Boolean(options.skipPull), dryRun: Boolean(options.dryRun), skipInstall: Boolean(options.skipInstall) });
}
