/** This authorized corner study keeps one boot/swap baseline across all stages. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cornerDirectory } from './corner-policy.mts';
import { observeStatsResources } from './stats-resume-review.mts';
import { resumeDigest, resumeHistory } from './zbll-resume-review.mts';

export const cornerSessionPath = resolve(cornerDirectory, 'session.json');
export const cornerStopPath = resolve(cornerDirectory, 'protected-stop.json');
const authorization = '现在要做什么？你可以跑计算的';
type Observation = { boot: string; swapouts: number; pressure: number };

export function validateCornerSession(session: any, now: Observation,
    history: Record<string, string>, stopped: boolean) {
  assert(!stopped, 'This corner study hit its stop boundary; do not reset or automatically restart');
  assert.equal(session.schema, 'cuberoot.corner96-session.v1');
  assert.equal(session.authorization, authorization);
  assert.equal(session.boot, now.boot, 'The corner study cannot cross system boots');
  assert.equal(session.swapouts, 0, 'This study was authorized and prepared with Swapouts 0');
  assert.equal(now.swapouts, session.swapouts, 'Swapouts changed during the corner study');
  assert.equal(now.pressure, 1, 'Abnormal memory pressure');
  assert(Number.isFinite(Date.parse(session.preparedAt)));
  assert.deepEqual(session.history, history, 'Historical protection records changed');
  return session;
}

export function readCornerSession(now: Observation) {
  const bytes = readFileSync(cornerSessionPath);
  assert(bytes.length < 256 * 1024, 'Oversized corner session');
  const session = validateCornerSession(JSON.parse(bytes.toString()), now,
    resumeHistory(), existsSync(cornerStopPath));
  return { ...session, sha256: resumeDigest(bytes), stopPath: cornerStopPath };
}

export function prepareCornerSession() {
  assert(!existsSync(cornerSessionPath), 'The existing corner baseline must not be replaced');
  assert(!existsSync(cornerStopPath), 'A prior corner stop needs review');
  const now = observeStatsResources();
  assert(!now.computeRunning && !now.lockExists, 'Another computation or retained lock is present');
  const history = resumeHistory();
  // Old-boot counters cannot be compared with this boot. Preserve all of them,
  // but never use a new study to evade a stop from the current system boot.
  for (const path of Object.keys(history)) {
    const record = JSON.parse(readFileSync(path, 'utf8'));
    assert(!(record.boot === now.boot && record.stopped), `Current-boot stop requires review: ${path}`);
  }
  const session = { schema: 'cuberoot.corner96-session.v1', authorization,
    preparedAt: new Date().toISOString(), boot: now.boot, swapouts: 0, history };
  validateCornerSession(session, now, history, false);
  mkdirSync(cornerDirectory, { recursive: true });
  writeFileSync(cornerSessionPath, JSON.stringify(session, null, 2) + '\n', { flag: 'wx' });
  return { session: cornerSessionPath, boot: now.boot, swapouts: now.swapouts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['prepare']);
  console.log(JSON.stringify(prepareCornerSession()));
}
