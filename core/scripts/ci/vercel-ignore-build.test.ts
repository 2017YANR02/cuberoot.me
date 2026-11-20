import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifiedPreviousWebCheck } from '../vercel-ignore-build.ts';

const sha = 'a'.repeat(40);
const run = { id: 20, run_attempt: 2, head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/test.yml', status: 'completed' };
const success = { name: 'Web checks', status: 'completed', conclusion: 'success' };

test('only reuses the latest exact main/push verification attempt', async () => {
  const calls: string[] = [];
  const request = async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json(calls.length === 1 ? { workflow_runs: [{ ...run, id: 19, run_attempt: 1 }, run] }
      : { jobs: [success], total_count: 1 });
  };
  assert.equal(await verifiedPreviousWebCheck('owner/repo', sha, request as typeof fetch), true);
  assert.match(calls[1], /runs\/20\/attempts\/2\/jobs/);
});

test('builds again for failed, canceled, missing, ambiguous or unfinished web checks', async () => {
  for (const jobs of [[], [{ ...success, conclusion: 'failure' }], [{ ...success, conclusion: 'cancelled' }],
    [{ ...success, status: 'in_progress', conclusion: null }], [success, success]]) {
    let calls = 0;
    const request = async () => Response.json(++calls === 1 ? { workflow_runs: [run] } : { jobs, total_count: jobs.length });
    assert.equal(await verifiedPreviousWebCheck('owner/repo', sha, request as typeof fetch), false);
  }
});

test('builds on API errors, mismatched runs and incomplete job inventories', async () => {
  assert.equal(await verifiedPreviousWebCheck('owner/repo', sha, async () => new Response(null, { status: 403 })), false);
  assert.equal(await verifiedPreviousWebCheck('owner/repo', sha, async () => { throw new Error('offline'); }), false);
  const wrongRuns = [{ ...run, head_sha: 'b'.repeat(40) }, { ...run, event: 'workflow_dispatch' }, { ...run, head_branch: 'other' }];
  assert.equal(await verifiedPreviousWebCheck('owner/repo', sha, async () => Response.json({ workflow_runs: wrongRuns })), false);
  let calls = 0;
  assert.equal(await verifiedPreviousWebCheck('owner/repo', sha, async () => Response.json(++calls === 1
    ? { workflow_runs: [run] } : { jobs: [success], total_count: 2 })), false);
});
