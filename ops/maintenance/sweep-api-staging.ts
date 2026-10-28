// Runs on the Actions runner. GitHub credentials never reach the server.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { DeploymentAttempt } from './prune-api-releases.ts';

const { DEPLOY_HOST: host, DEPLOY_USER: user, SSH_KEY_FILE: key } = process.env;
if (!host || !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) || !user || !/^[a-z_][a-z0-9_-]*$/.test(user) || !key) throw new Error('Missing or invalid SSH configuration');
const source = readFileSync(new URL('./prune-api-releases.ts', import.meta.url), 'utf8');
const remote = (expression: string) => JSON.parse(execFileSync('ssh', [
  '-T', '-o', 'BatchMode=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-i', key,
  `${user}@${host}`, 'flock -n /run/lock/cuberoot-api-releases.lock node --input-type=module-typescript',
], { input: `${source}\nconsole.log(JSON.stringify(${expression}));\n`, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 ** 2 }));

const names: string[] = remote("listStaging('/root/core-api')");
const attempts: DeploymentAttempt[] = [];
for (const name of names) {
  const match = /^\.(\d+)-(\d+)-[a-f0-9]{40}\.staging$/.exec(name);
  if (!match) throw new Error('Unexpected staging inventory');
  // A failed API lookup aborts before any deletion; do not treat 404 as completed.
  const run = JSON.parse(execFileSync('gh', ['api', `repos/2017YANR02/cuberoot.me/actions/runs/${match[1]}/attempts/${match[2]}`],
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 ** 2 }));
  attempts.push({ id: run.id, run_attempt: run.run_attempt, head_sha: run.head_sha, status: run.status,
    path: run.path, head_branch: run.head_branch, repository: { full_name: run.repository?.full_name } });
}
const result = remote(`pruneStaging('/root/core-api', processReferences(), ${JSON.stringify(attempts)}, true)`);
console.log(JSON.stringify(result, null, 2));
if (result.kept.length) throw new Error('Staging directories retained because a deployment is active, referenced, or its identity cannot be verified; inspect this run before manual intervention');
