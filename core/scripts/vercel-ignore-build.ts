// Vercel runs this before installing dependencies. Keep it Node-only and use
// Deploy Next's path contract as the single source for frontend build inputs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assessWebCheck, selectWebRun } from './ci/wait-web-checks.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** A failed/canceled previous attempt must not hide frontend changes that never shipped. */
export async function verifiedPreviousWebCheck(repository: string, sha: string, request: typeof fetch = fetch): Promise<boolean> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f\d]{40}$/.test(sha)) return false;
  try {
    const get = async (path: string) => {
      const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error('Previous web verification unavailable');
      return response.json();
    };
    const data = await get(`actions/workflows/test.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=100`);
    const run = selectWebRun(data.workflow_runs, sha);
    if (!run) return false;
    const jobs = await get(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
    // Incomplete inventories are evidence to build, never permission to skip.
    if (!Array.isArray(jobs.jobs) || jobs.jobs.length !== jobs.total_count) return false;
    return assessWebCheck(run, jobs.jobs).state === 'success';
  } catch {
    return false;
  }
}

export async function runIgnoredBuildStep(): Promise<number> {
  try {
    const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
    if (!base) throw new Error('No previous deployment');
    // An explicit redeploy of the same revision must pick up runtime/env changes.
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (base === head) throw new Error('Explicit same-revision redeploy');
    const workflow = readFileSync(new URL('../../.github/workflows/deploy_next.yml', import.meta.url), 'utf8');
    const push = workflow.match(/\n  push:\n([\s\S]*?)(?=\n\S|$)/)?.[1];
    const block = push?.match(/    paths:\n((?:      - '[^']+'\n)+)/)?.[1];
    if (!block) throw new Error('Frontend build path contract unavailable');
    const paths = [...block.matchAll(/      - '([^']+)'/g)]
      .map(match => match[1]!)
      .filter(path => !path.startsWith('ops/') && !path.startsWith('.github/'))
      .map(path => path.startsWith('!')
        ? `:(exclude)${path.slice(1).replace(/\/\*\*$/, '')}`
        : path.replace(/\/\*\*$/, ''));
    if (!paths.length) throw new Error('Frontend build path contract is empty');
    execFileSync('git', ['-C', root, 'diff', '--quiet', base, 'HEAD', '--', ...paths], { stdio: 'inherit' });
    const repository = `${process.env.VERCEL_GIT_REPO_OWNER ?? ''}/${process.env.VERCEL_GIT_REPO_SLUG ?? ''}`;
    if (!await verifiedPreviousWebCheck(repository, base)) throw new Error('Previous frontend attempt is unverified');
    return 0; // Verified baseline and no frontend changes: skip the build.
  } catch {
    return 1; // Changed inputs or missing evidence: build.
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runIgnoredBuildStep();
}
