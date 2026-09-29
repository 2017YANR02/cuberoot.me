import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

/** Publish one saved statistics update on remote main, without publishing local code. */
export async function publishStatsCommit(cwd: string, source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'scramble-git-'));
  const git = async (args: string[], isolated = false, raw = false) => {
    const { stdout } = await promisify(execFile)('git', args, {
      cwd, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, ...(isolated ? { GIT_INDEX_FILE: join(dir, 'index') } : {}) },
    });
    return raw ? stdout : stdout.trim();
  };
  try {
    const patch = await git(['diff', '--binary', `${source}^`, source, '--', 'stats/scramble'], false, true);
    if (!patch) throw new Error('Statistics commit contains no statistics changes');
    await writeFile(join(dir, 'stats.patch'), patch);
    await git(['fetch', 'origin', 'main']);
    const parent = await git(['rev-parse', 'FETCH_HEAD']);
    await git(['read-tree', parent], true);
    // Three-way application preserves remote changes; conflicts stop before any push.
    await git(['apply', '--cached', '--3way', join(dir, 'stats.patch')], true);
    const tree = await git(['write-tree'], true);
    if (tree === await git(['rev-parse', `${parent}^{tree}`])) {
      console.log('[git] statistics already published');
      return parent;
    }
    const message = await git(['show', '-s', '--format=%B', source]);
    const commit = await git(['commit-tree', tree, '-p', parent, '-m', message]);
    // A concurrent remote update is rejected normally. Never force-push.
    await git(['push', 'origin', `${commit}:refs/heads/main`]);
    console.log(`[git] statistics published ${commit.slice(0, 10)}`);
    return commit;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
