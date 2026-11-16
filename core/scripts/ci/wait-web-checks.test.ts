import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { assessWebCheck, selectWebRun, waitForWebChecks } from './wait-web-checks.ts';

const sha = 'a'.repeat(40);
const run = { id: 1, run_attempt: 2, head_sha: sha, head_branch: 'main', event: 'push',
  path: '.github/workflows/test.yml', status: 'in_progress' };
const passed = { name: 'Web checks', status: 'completed', conclusion: 'success' };

test('accepts only the latest Test push run for the exact main SHA', () => {
  const invalid = [
    { head_sha: 'b'.repeat(40) }, { event: 'pull_request' }, { event: 'workflow_dispatch' },
    { head_branch: 'other' }, { path: '.github/workflows/other.yml' },
  ].map((change, index) => ({ ...run, id: 100 + index, ...change }));
  assert.equal(selectWebRun(invalid, sha), undefined);
  assert.equal(selectWebRun([run, { ...run, id: 2 }, ...invalid], sha)?.id, 2);
});

test('web success does not wait for unrelated jobs', () => {
  assert.equal(assessWebCheck(run, [passed, { name: 'mobile', status: 'in_progress', conclusion: null }]).state, 'success');
});

test('failure, cancelled, skipped and missing results cannot allow deployment', () => {
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', null]) {
    assert.equal(assessWebCheck(run, [{ ...passed, conclusion }]).state, 'failure');
  }
  assert.equal(assessWebCheck({ ...run, status: 'completed' }, []).state, 'failure');
  assert.equal(assessWebCheck(run, [passed, passed]).state, 'failure');
  assert.equal(assessWebCheck(undefined, [passed]).state, 'wait');
  assert.equal(assessWebCheck(run, []).state, 'wait');
});

test('queries the exact workflow and current attempt, including all job pages', async () => {
  const urls: string[] = [];
  const responses = [{ workflow_runs: [run] }, { jobs: [], total_count: 0 }];
  let attempts = 0;
  await waitForWebChecks({ repository: 'owner/repo', sha, token: 'test-only', pollMs: 0,
    log: () => {}, fetch: (async (url) => {
      urls.push(String(url));
      if (responses.length) return Response.json(responses.shift());
      attempts++;
      if (attempts === 1) return Response.json({ workflow_runs: [run] });
      if (attempts === 2) return Response.json({ jobs: [{ name: 'test', status: 'completed', conclusion: 'success' }], total_count: 2 });
      return Response.json({ jobs: [passed], total_count: 2 });
    }) as typeof fetch,
  });
  assert.match(urls[0]!, /actions\/workflows\/test.yml\/runs\?head_sha=a{40}&branch=main&event=push/);
  assert.match(urls[1]!, /actions\/runs\/1\/attempts\/2\/jobs/);
  assert.match(urls.at(-1)!, /page=2$/);
});

test('fails closed on API errors and timeout', async () => {
  const common = { repository: 'owner/repo', sha, token: 'test-only', log: () => {} };
  await assert.rejects(waitForWebChecks({ ...common,
    fetch: (async () => new Response('', { status: 403 })) as typeof fetch,
  }), /HTTP 403/);
  let clock = 0;
  await assert.rejects(waitForWebChecks({ ...common, timeoutMs: 20, pollMs: 10,
    now: () => clock, sleep: async ms => { clock += ms; },
    fetch: (async () => Response.json({ workflow_runs: [] })) as typeof fetch,
  }), /Timed out.*deployment blocked/);
});
