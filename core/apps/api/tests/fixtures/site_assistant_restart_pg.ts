/** Run with tsx against an opt-in, dedicated loopback PostgreSQL database. */
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import postgres from 'postgres';

assert.equal(process.env.ASSISTANT_RESTART_PG_TEST, '1');
assert.equal(process.env.DB_HOST, '127.0.0.1');
assert.equal(process.env.DB_NAME, 'assistant_restart_test');
assert.ok(Number(process.env.DB_PORT) > 0, 'Explicit test database port is required');
const options = { host: '127.0.0.1', port: Number(process.env.DB_PORT),
  username: process.env.DB_USER, password: process.env.DB_PASS,
  database: 'assistant_restart_test', max: 1 };

function launch(schema: string) {
  const child = fork(new URL('./site_assistant_restart_worker_pg.ts', import.meta.url), [schema], {
    execArgv: ['--import', import.meta.resolve('tsx')], silent: true,
    env: { ...process.env, VITEST: '1' },
  });
  const state = { port: 0, checkpoint: false, log: '', exited: false };
  for (const stream of [child.stdout, child.stderr]) stream?.on('data', chunk => {
    state.log = (state.log + String(chunk)).slice(-12_000);
  });
  child.on('message', (message: { type: string; port?: number }) => {
    if (message.type === 'ready') state.port = message.port!;
    if (message.type === 'checkpoint-ready') state.checkpoint = true;
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('error', error => { state.log += error.stack; state.exited = true; resolve({ code: -1, signal: null }); });
    child.once('exit', (code, signal) => { state.exited = true; resolve({ code, signal }); });
  });
  return { child, state, exited };
}
type WorkerProcess = ReturnType<typeof launch>;
async function waitFor<T>(worker: WorkerProcess, read: () => Promise<T> | T, label: string, timeout = 15_000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    assert.equal(worker.state.exited, false, `Worker exited during ${label}: ${worker.state.log}`);
    const result = await read();
    if (result) return result as NonNullable<T>;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${worker.state.log}`);
}
async function request(worker: WorkerProcess, path: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${worker.state.port}/v1/site-assistant/${path}`, {
    signal: AbortSignal.timeout(5000), ...(body ? { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify({ status: response.status, data }));
  return data;
}

await test('durable assistant survives real process restarts', { concurrency: 3, timeout: 120_000 }, async t => {
  await Promise.all((['SIGINT', 'SIGTERM', 'SIGKILL'] as const).map(signal => t.test(signal, { timeout: 100_000 }, async () => {
    const schema = `restart_${randomUUID().replaceAll('-', '')}`;
    const admin = postgres(options), db = postgres({ ...options, connection: { search_path: schema } });
    const processes: WorkerProcess[] = [];
    try {
      await admin.unsafe(`CREATE SCHEMA ${schema}`);
      await db.unsafe('CREATE TABLE app_users(id BIGINT PRIMARY KEY); INSERT INTO app_users VALUES (7)');
      await db.unsafe(await readFile(new URL('../../migrations/0335_assistant_durable_queue.sql', import.meta.url), 'utf8'));
      await db.unsafe('CREATE TABLE tool_reads(id BIGSERIAL PRIMARY KEY,tool TEXT); CREATE TABLE execution_log(id BIGSERIAL PRIMARY KEY,question TEXT)');
      let worker = launch(schema); processes.push(worker);
      await waitFor(worker, () => worker.state.port, 'initial listen');
      const conversation = randomUUID(), path = `conversations/${conversation}`;
      const entries = ['original task', 'first correction', 'second correction', 'queued task'].map((question, i) => ({
        id: randomUUID(), mode: i === 1 || i === 2 ? 'steer' : 'queue',
        input: { question, lang: 'en', thinking: 'auto', provider: 'bailian', timeZone: 'UTC', history: [] },
      }));
      await request(worker, `${path}/messages`, entries[0]);
      await waitFor(worker, () => worker.state.checkpoint, 'persisted tool and draft');
      for (const entry of entries.slice(1)) await request(worker, `${path}/messages`, entry);
      const before = await db`SELECT id,payload,checkpoints FROM site_assistant_messages ORDER BY sequence`;
      assert.equal(Object.keys(before[0].checkpoints).length, 1);
      assert.deepEqual(before.map(m => m.id), entries.map(e => e.id));
      assert.ok(worker.child.kill(signal));
      assert.deepEqual(await worker.exited, { code: null, signal });
      // Read durable state with the old process dead and no replacement yet.
      const offline = await db`SELECT id,payload,checkpoints FROM site_assistant_messages ORDER BY sequence`;
      assert.deepEqual([...offline], [...before]);
      const [lease] = await db`SELECT lease_until>NOW() AS active FROM site_assistant_conversations`;
      assert.equal(lease.active, true);

      worker = launch(schema); processes.push(worker);
      await waitFor(worker, () => worker.state.port, 'replacement listen');
      for (const entry of entries) await request(worker, `${path}/messages`, entry);
      const reconnect = await request(worker, path);
      assert.equal(reconnect.messages[0].attempts, 1, 'replacement must not steal an unexpired lease');
      assert.deepEqual(reconnect.messages.map((m: { id: string }) => m.id), entries.map(e => e.id));
      assert.equal((await db`SELECT count(*)::int AS n FROM execution_log`)[0].n, 1);
      // Wait for the real 45-second lease: never edit DB time, leases or attempts.
      const done = await waitFor(worker, async () => {
        const snapshot = await request(worker, path);
        assert.ok(!snapshot.messages.some((m: { state: string }) => m.state === 'error'), JSON.stringify(snapshot));
        return snapshot.messages.every((m: { state: string }) => ['completed', 'applied'].includes(m.state)) ? snapshot : null;
      }, 'automatic recovery and queued completion', 65_000);
      assert.deepEqual(done.messages.map((m: { state: string }) => m.state), ['completed', 'applied', 'applied', 'completed']);
      assert.deepEqual(done.messages.map((m: { attempts: number }) => m.attempts), [2, 0, 0, 1]);
      assert.deepEqual(done.messages.map((m: { id: string }) => m.id), entries.map(e => e.id));
      assert.deepEqual(done.messages.map((m: { input: { question: string } }) => m.input.question), entries.map(e => e.input.question));
      assert.deepEqual(done.messages.slice(1, 3).map((m: { targetId: string }) => m.targetId), [entries[0].id, entries[0].id]);
      assert.equal(done.activeId, undefined); assert.equal(done.paused, false);
      assert.equal(done.messages[0].progress.filter((p: { reused?: boolean }) => p.reused).length, 1);
      const executions = (await db`SELECT question FROM execution_log ORDER BY id`).map(r => r.question as string);
      assert.equal(executions.length, 3, 'one interrupted attempt, one recovery, one queued task');
      assert.equal(executions[0], 'original task');
      assert.equal(executions[2], 'queued task');
      const recovered = executions[1];
      assert.ok(recovered.startsWith('original task'));
      assert.ok(recovered.indexOf('first correction') > 0);
      assert.ok(recovered.indexOf('second correction') > recovered.indexOf('first correction'));
      assert.equal(done.messages[0].answer.answer, recovered);
      assert.equal(done.messages[3].answer.answer, 'queued task');
      const after = await db`SELECT id,payload,checkpoints FROM site_assistant_messages ORDER BY sequence`;
      assert.deepEqual([...after], [...before], 'payloads and checkpoint content/timestamp survive unchanged');
      assert.deepEqual((await db`SELECT tool FROM tool_reads ORDER BY id`).map(r => r.tool), ['glossary:F2L'], 'completed tool executed exactly once across processes');
      const [settled] = await db`SELECT lease,active_id FROM site_assistant_conversations`;
      assert.deepEqual(settled, { lease: null, active_id: null });
    } finally {
      for (const worker of processes) {
        if (!worker.state.exited) worker.child.kill('SIGKILL');
        await worker.exited;
      }
      await db.end();
      await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  })));
});
