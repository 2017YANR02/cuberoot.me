import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const WEB_CHECK_NAME = 'Web checks';
const WORKFLOW_PATH = '.github/workflows/test.yml';
type Run = {
  id: number; run_attempt: number; head_sha: string; head_branch: string;
  event: string; path: string; status: string;
};
type Job = { name: string; status: string; conclusion: string | null };
type Gate = { state: 'wait' | 'success' | 'failure'; reason: string };

/** Never accept a similarly named check from another workflow, SHA or attempt. */
export function selectWebRun(runs: Run[], sha: string): Run | undefined {
  return runs.filter(run => run.head_sha === sha && run.head_branch === 'main'
    && run.event === 'push' && run.path === WORKFLOW_PATH)
    .sort((a, b) => b.id - a.id)[0];
}

export function assessWebCheck(run: Run | undefined, jobs: Job[]): Gate {
  if (!run) return { state: 'wait', reason: 'Waiting for the Test push run on this SHA' };
  const checks = jobs.filter(job => job.name === WEB_CHECK_NAME);
  if (checks.length > 1) return { state: 'failure', reason: 'Ambiguous Web checks jobs' };
  const check = checks[0];
  if (check?.status === 'completed') {
    return check.conclusion === 'success'
      ? { state: 'success', reason: `Test run ${run.id}, attempt ${run.run_attempt}: Web checks passed` }
      : { state: 'failure', reason: `Web checks concluded ${check.conclusion ?? 'unknown'}` };
  }
  if (run.status === 'completed') {
    return { state: 'failure', reason: 'Test run completed without successful Web checks' };
  }
  return { state: 'wait', reason: `Waiting for Web checks in Test run ${run.id}, attempt ${run.run_attempt}` };
}

export async function waitForWebChecks(options: {
  repository: string; sha: string; token: string;
  fetch?: typeof fetch; timeoutMs?: number; pollMs?: number;
  now?: () => number; sleep?: (ms: number) => Promise<void>; log?: (message: string) => void;
}): Promise<void> {
  const { repository, sha, token } = options;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f\d]{40}$/.test(sha) || !token) {
    throw new Error('GitHub repository, exact commit SHA and token are required');
  }
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(done => setTimeout(done, ms)));
  const log = options.log ?? console.log;
  const deadline = now() + (options.timeoutMs ?? 30 * 60_000);
  async function get<T>(path: string): Promise<T> {
    const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - now()))),
    });
    if (!response.ok) throw new Error(`Cannot verify Web checks: GitHub returned HTTP ${response.status}`);
    return await response.json() as T;
  }
  let previousReason = '';
  while (now() < deadline) {
    const data = await get<{ workflow_runs: Run[] }>(
      `actions/workflows/test.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=100`,
    );
    const run = selectWebRun(data.workflow_runs, sha);
    const jobs: Job[] = [];
    if (run) {
      for (let page = 1; ; page++) {
        const data = await get<{ jobs: Job[]; total_count: number }>(
          `actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`,
        );
        jobs.push(...data.jobs);
        if (jobs.length >= data.total_count) break;
        if (data.jobs.length === 0) throw new Error('Incomplete job list; cannot verify Web checks');
      }
    }
    const result = assessWebCheck(run, jobs);
    if (result.reason !== previousReason) log(result.reason);
    previousReason = result.reason;
    if (result.state === 'failure') throw new Error(result.reason);
    if (result.state === 'success') return;
    await sleep(Math.min(options.pollMs ?? 10_000, Math.max(0, deadline - now())));
  }
  throw new Error(`Timed out waiting for successful Web checks on ${sha}; deployment blocked`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await waitForWebChecks({ repository: process.env.GITHUB_REPOSITORY ?? '',
    sha: process.env.GITHUB_SHA ?? '', token: process.env.GITHUB_TOKEN ?? '' });
}
