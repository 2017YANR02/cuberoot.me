/** Admin release orchestration. GitHub owns builds; the API never receives signing keys. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HTTPException } from 'hono/http-exception';
import { releaseIdentity, type AppReleaseRequest, type AppReleaseRun, type AppReleaseStatus } from '@cuberoot/shared/android-release';
import { withTransaction } from '../db/connection.js';

const repository = '2017YANR02/cuberoot.me';
const workflow = 'app_release.yml';
interface Receipt extends AppReleaseRequest {
  state: 'dispatching' | 'accepted' | 'unknown' | 'rejected' | 'completed';
  createdAt: string;
  actor: string;
}
interface GithubRun { id: number; run_number: number; display_title: string; status: string; conclusion: string | null; html_url: string; created_at: string }
interface Dependencies {
  configured(): boolean;
  github(path: string, body?: unknown): Promise<unknown>;
  load(): Promise<Receipt[]>;
  save(receipts: Receipt[]): Promise<void>;
  locked<T>(fn: () => Promise<T>): Promise<T>;
}
class GithubError extends Error {
  constructor(readonly status: number) { super(`Release provider HTTP ${status}`); }
}
const statePath = () => process.env.APP_RELEASE_STATE_PATH || '/root/core-api/data/app-release-requests.json';
const defaults: Dependencies = {
  configured: () => Boolean(process.env.APP_RELEASE_GITHUB_TOKEN),
  async github(path, body) {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      method: body ? 'POST' : 'GET', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.APP_RELEASE_GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new GithubError(response.status);
    return response.status === 204 ? null : response.json();
  },
  async load() {
    try { return JSON.parse(await readFile(statePath(), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  },
  async save(receipts) {
    const path = statePath();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(`${path}.next`, JSON.stringify(receipts), { mode: 0o600 });
    await rename(`${path}.next`, path);
  },
  locked: fn => withTransaction(async query => {
    // Coordinates all API processes. The receipt file is on the API host's persistent data volume.
    await query("SELECT pg_advisory_xact_lock(hashtextextended('official-app-release', 0))");
    return fn();
  }),
};

export function createReleaseService(overrides: Partial<Dependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  const unresolved = (r: Receipt) => !['rejected', 'completed'].includes(r.state);
  async function reconcile(receipts: Receipt[], history: AppReleaseRun[]) {
    let changed = false;
    for (const receipt of receipts) {
      if (unresolved(receipt) && history.some(run => run.requestId === receipt.requestId && run.status === 'completed')) {
        receipt.state = 'completed'; changed = true;
      }
    }
    if (changed) await deps.save(receipts);
    return receipts;
  }
  async function runs(): Promise<AppReleaseRun[]> {
    const result = await deps.github(`actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=100`) as { workflow_runs: GithubRun[] };
    return result.workflow_runs.map(run => ({ id: run.id, requestId: run.display_title.replace(/^App release /, ''), status: run.status,
      conclusion: run.conclusion, url: `https://github.com/${repository}/actions/runs/${run.id}`,
      versionName: releaseIdentity(run.run_number).versionName, createdAt: run.created_at }));
  }
  async function main() {
    const ref = await deps.github('git/ref/heads/main') as { object: { sha: string } };
    if (!/^[a-f0-9]{40}$/.test(ref.object.sha)) throw new Error('Invalid main commit');
    return ref.object.sha;
  }
  async function status(): Promise<AppReleaseStatus> {
    if (!deps.configured()) return { configured: false, commit: null, runs: [], pending: null };
    const [commit, history] = await Promise.all([main(), runs()]);
    const receipts = await deps.locked(async () => reconcile(await deps.load(), history));
    const pending = receipts.find(r => unresolved(r) && !history.some(run => run.requestId === r.requestId));
    return { configured: true, commit, runs: history.slice(0, 10), pending: pending ? {
      requestId: pending.requestId, state: pending.state as 'dispatching' | 'accepted' | 'unknown', createdAt: pending.createdAt,
    } : null };
  }
  async function dispatch(request: AppReleaseRequest, actor: string) {
    if (!deps.configured()) throw new HTTPException(503, { message: 'Release service is not configured' });
    return deps.locked(async () => {
      const receipts = await deps.load();
      const existing = receipts.find(r => r.requestId === request.requestId);
      if (existing) {
        if (existing.commit !== request.commit || existing.platform !== request.platform || existing.notes !== request.notes) throw new HTTPException(409, { message: 'Request identity conflict' });
        return { requestId: existing.requestId, state: existing.state };
      }
      const [commit, history] = await Promise.all([main(), runs()]);
      await reconcile(receipts, history);
      if (commit !== request.commit) throw new HTTPException(409, { message: 'Main changed. Refresh before publishing.' });
      if (history.some(run => run.status !== 'completed') || receipts.some(r => unresolved(r) && !history.some(run => run.requestId === r.requestId))) {
        throw new HTTPException(409, { message: 'A release is active or awaiting confirmation' });
      }
      const receipt: Receipt = { ...request, actor, createdAt: new Date().toISOString(), state: 'dispatching' };
      receipts.push(receipt);
      // Durable intent precedes the network request. A timeout may already have dispatched a run.
      await deps.save(receipts);
      try {
        await deps.github(`actions/workflows/${workflow}/dispatches`, { ref: 'main', inputs: {
          request_id: request.requestId, source_commit: request.commit, platform: request.platform, notes: request.notes,
        } });
        receipt.state = 'accepted';
      } catch (error) {
        receipt.state = error instanceof GithubError && [400, 401, 403, 404, 422].includes(error.status) ? 'rejected' : 'unknown';
      }
      await deps.save(receipts);
      return { requestId: receipt.requestId, state: receipt.state };
    });
  }
  return { status, dispatch };
}
