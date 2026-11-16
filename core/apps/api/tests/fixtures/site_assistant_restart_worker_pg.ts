/** Real routes/store/worker in a disposable process; model and data read are deterministic. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { transactionQuery, type QueryRunner } from '../../src/db/connection.js';
import { assistantQueueStore } from '../../src/utils/site_assistant_queue.js';
import { createAssistantQueueWorker } from '../../src/utils/site_assistant_worker.js';
import { checkpointAssistantTool } from '../../src/utils/site_assistant_execution.js';
import { assistantStage } from '../../src/utils/site_assistant_diagnostics.js';
import { createSiteAssistantRoutes } from '../../src/routes/site_assistant.js';

assert.equal(process.env.ASSISTANT_RESTART_PG_TEST, '1');
assert.equal(process.env.DB_HOST, '127.0.0.1');
assert.equal(process.env.DB_NAME, 'assistant_restart_test');
const schema = process.argv[2];
assert.match(schema, /^restart_[a-f0-9]{32}$/);
globalThis.fetch = async () => { throw new Error('External HTTP is forbidden in restart regression'); };
const db = postgres({ host: '127.0.0.1', port: Number(process.env.DB_PORT),
  username: process.env.DB_USER, password: process.env.DB_PASS,
  database: 'assistant_restart_test', max: 4, connection: { search_path: schema } });
const run: QueryRunner = async <T>(statement: string, params: unknown[] = []) => {
  let n = 0;
  return await db.unsafe(statement.replace(/\?/g, () => `$${++n}`), params as never[]) as unknown as T[];
};
const store = assistantQueueStore(run, async fn => await db.begin(tx => fn(transactionQuery(tx))) as never);
const config = () => ({ key: 'unused-test-key', model: 'deterministic', baseUrl: 'https://model.invalid' });
const reserve = async () => ({ allowed: true, retryAfter: 0 });
const worker = createAssistantQueueWorker({ store, config, reserve, authorize: async () => '2099TEST01',
  answer: async (...args) => {
    const question = args[0];
    await db`INSERT INTO execution_log(question) VALUES (${question})`;
    if (question === 'queued task') {
      const [first] = await db`SELECT state FROM site_assistant_messages WHERE target_id IS NULL ORDER BY sequence LIMIT 1`;
      assert.equal(first.state, 'completed', 'queued task must start after main task commits');
      return { answer: question, sources: [] };
    }
    await assistantStage('tool', () => checkpointAssistantTool({ tool: 'glossary', query: 'F2L' }, async () => {
      await db`INSERT INTO tool_reads(tool) VALUES ('glossary:F2L')`;
      return { evidence: { definition: 'First Two Layers' },
        sources: [{ id: 'wiki:test', title: 'F2L', href: '/wiki', read: true }], artifacts: [] };
    }), 0, 'glossary');
    if (question === 'original task') {
      await args[7]?.({ type: 'answer', answer: 'unfinished draft', sources: [] });
      process.send?.({ type: 'checkpoint-ready' });
      await new Promise<void>((_resolve, reject) => {
        const abort = () => reject(args[3].reason);
        if (args[3].aborted) abort();
        else args[3].addEventListener('abort', abort, { once: true });
      });
    }
    return { answer: question, sources: [] };
  },
});
const app = new Hono();
app.route('/v1', createSiteAssistantRoutes({ config, reserve, now: Date.now,
  answer: async () => { throw new Error('Only durable queue routes are tested'); },
  authenticate: async () => ({ uid: 7, wcaId: '2099TEST01' }), queue: { store, worker } }));
worker.start();
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, info => {
  process.send?.({ type: 'ready', port: info.port });
});
// No signal handler: match production index.ts default SIGINT/SIGTERM termination,
// rather than replacing process death with worker.stop() or an in-memory reset.
