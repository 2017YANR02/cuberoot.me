import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { redactAssistantText } from '../utils/site_assistant_monitor.js';
import { z } from 'zod';
import { query, type QueryRunner } from '../db/connection.js';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { assistantMonitorHealth } from '../utils/site_assistant_monitor.js';
import { diagnosticLog, currentDiagnosticRequestId } from '../observability/request.js';

const filters = z.object({
  days: z.coerce.number().refine(n => [7, 30, 90].includes(n)).default(30),
  status: z.enum(['all','running','success','error','cancelled','rejected','interrupted']).default('all'),
  feedback: z.enum(['all','negative','helpful','unreviewed']).default('all'),
  conversation: z.string().uuid().optional(),
  user: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(4000).default(1),
});
// Same Beijing calendar days as the existing quota. No pre-collection history is inferred.
const windowSql = `started_at >= (((NOW() AT TIME ZONE 'Asia/Shanghai')::date - (?::int - 1))::timestamp AT TIME ZONE 'Asia/Shanghai')
  AND started_at > NOW() - INTERVAL '90 days'`;
const counts = `COUNT(*)::int AS requests, COUNT(DISTINCT user_id)::int AS users,
  COUNT(*) FILTER (WHERE status='success')::int AS success,
  COUNT(*) FILTER (WHERE status='error')::int AS errors,
  COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
  COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
  COUNT(*) FILTER (WHERE status='running')::int AS running,
  COUNT(*) FILTER (WHERE status='interrupted')::int AS interrupted,
  COUNT(*) FILTER (WHERE image_count>0)::int AS images,
  ROUND(AVG(duration_ms) FILTER (WHERE status='success'))::int AS avg_ms,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status='success') AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status='success') AS p95_ms,
  ROUND(AVG(first_answer_ms) FILTER (WHERE status='success'))::int AS first_answer_ms`;

export function createAdminAssistantRoutes(options: { authorize?: (c: Context) => Promise<unknown>; runQuery?: QueryRunner } = {}) {
  const routes = new Hono(), run = options.runQuery ?? query;
  const actors = new WeakMap<Context,string>();
  routes.use('/admin/assistant/*', bodyLimit({ maxSize: 4096 }));
  routes.use('/admin/assistant/*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    const actor = await (options.authorize ?? requireAdminOrApiKey)(c) as { uid?: number; wcaId?: string } | undefined;
    actors.set(c, actor?.uid ? `uid:${actor.uid}` : actor?.wcaId ?? 'test-admin');
    await next();
  });
  routes.get('/admin/assistant/summary', async c => {
    const parsed = filters.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Invalid filters' }, 400);
    const { days } = parsed.data;
    const [state, totals, daily, models, tools, errors] = await Promise.all([
      run('SELECT enabled_at, last_cleanup_at,failed_writes,last_failure_at,last_replay_at FROM site_assistant_monitor_state WHERE id=TRUE'),
      run(`SELECT ${counts} FROM site_assistant_requests WHERE scope='chat' AND ${windowSql}`, [days]),
      run(`WITH actual AS (SELECT (started_at AT TIME ZONE 'Asia/Shanghai')::date AS day, ${counts}
        FROM site_assistant_requests WHERE ${windowSql} GROUP BY day), calendar AS (
        SELECT generate_series(GREATEST((NOW() AT TIME ZONE 'Asia/Shanghai')::date - (?::int - 1),
          (SELECT (enabled_at AT TIME ZONE 'Asia/Shanghai')::date FROM site_assistant_monitor_state WHERE id=TRUE)),
          (NOW() AT TIME ZONE 'Asia/Shanghai')::date, INTERVAL '1 day')::date AS day)
        SELECT calendar.day::text, COALESCE(requests,0) AS requests,COALESCE(users,0) AS users,
          COALESCE(success,0) AS success,COALESCE(errors,0) AS errors,COALESCE(cancelled,0) AS cancelled,
          COALESCE(rejected,0) AS rejected,COALESCE(running,0) AS running,COALESCE(interrupted,0) AS interrupted,
          COALESCE(images,0) AS images,avg_ms,p50_ms,p95_ms,first_answer_ms
        FROM calendar LEFT JOIN actual USING(day) ORDER BY calendar.day`, [days, days]),
      run(`WITH calls AS (
        SELECT m->>'model' AS model, m->>'input' AS input, m->>'output' AS output,
          m->>'cached' AS cached, m->>'reasoning' AS reasoning, m->>'thinking' AS thinking, 'chat' AS kind
        FROM site_assistant_requests, jsonb_array_elements(COALESCE(metrics->'models','[]')) m WHERE ${windowSql}
        UNION ALL SELECT m->>'model',m->>'tokens',NULL,NULL,NULL,NULL,CASE WHEN scope='index' THEN 'embedding_index' ELSE 'embedding' END
        FROM site_assistant_requests, jsonb_array_elements(COALESCE(metrics->'embeddings','[]')) m WHERE ${windowSql}
        UNION ALL SELECT m->>'model',m->>'tokens',NULL,NULL,NULL,NULL,'rerank'
        FROM site_assistant_requests, jsonb_array_elements(COALESCE(metrics->'reranks','[]')) m WHERE ${windowSql})
        SELECT model,kind,COUNT(*)::int AS calls,
          COUNT(*) FILTER (WHERE input IS NULL OR (kind='chat' AND output IS NULL))::int AS missing_usage,
          COUNT(*) FILTER (WHERE thinking='true')::int AS thinking_calls,
          SUM(input::bigint)::float8 AS input_tokens,SUM(output::bigint)::float8 AS output_tokens,
          SUM(cached::bigint)::float8 AS cached_tokens,SUM(reasoning::bigint)::float8 AS reasoning_tokens
        FROM calls GROUP BY model,kind ORDER BY calls DESC`, [days, days, days]),
      run(`SELECT t.key AS tool,SUM(t.value::int)::int AS calls FROM site_assistant_requests,
        jsonb_each_text(COALESCE(metrics->'tools','{}')) t WHERE ${windowSql} GROUP BY t.key ORDER BY calls DESC`, [days]),
      run(`SELECT error_code,COUNT(*)::int AS requests FROM site_assistant_requests
        WHERE scope='chat' AND ${windowSql} AND error_code IS NOT NULL GROUP BY error_code ORDER BY requests DESC`, [days]),
    ]);
    return c.json({ timeZone: 'Asia/Shanghai', days, updatedAt: new Date().toISOString(), state: state[0] ?? null,
      health: assistantMonitorHealth(), totals: totals[0], daily, models, tools, errors });
  });
  routes.get('/admin/assistant/requests', async c => {
    const parsed = filters.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Invalid filters' }, 400);
    const { days, status, q, page, feedback, conversation, user } = parsed.data;
    if (conversation && !user) return c.json({ error: 'Conversation user required' }, 400);
    const where = `scope='chat' AND ${windowSql} AND (?::uuid IS NULL OR (conversation_id=?::uuid AND user_id=?::bigint))
      AND (?='all' OR (?='negative' AND feedback IS NOT NULL AND feedback<>'helpful') OR (?='helpful' AND feedback='helpful') OR (?='unreviewed' AND feedback IS NOT NULL AND feedback<>'helpful' AND review_status='open')) AND (?='all' OR status=?) AND (?='' OR (started_at > NOW() - INTERVAL '30 days'
      AND (strpos(lower(question),lower(?))>0 OR strpos(lower(answer),lower(?))>0)))`;
    const args = [days,conversation??null,conversation??null,user??null,feedback,feedback,feedback,feedback,status,status,q,q,q];
    await run('INSERT INTO site_assistant_audit(actor,action) VALUES (?,?)', [actors.get(c), 'read_list']);
    const [rows, total] = await Promise.all([
      run(`SELECT id,user_id,conversation_id,parent_id,retry_of,feedback,review_status,started_at,status,error_code,lang,model,streaming,image_count,history_count,duration_ms,first_answer_ms,
        CASE WHEN started_at > NOW() - INTERVAL '30 days' THEN left(question,160) ELSE NULL END AS question
        FROM site_assistant_requests WHERE ${where} ORDER BY started_at DESC,id DESC LIMIT 25 OFFSET ?`, [...args, (page - 1) * 25]),
      run<{ total: number }>(`SELECT COUNT(*)::int AS total FROM site_assistant_requests WHERE ${where}`, args),
    ]);
    return c.json({ rows, total: total[0]?.total ?? 0, page, pageSize: 25 });
  });
  routes.get('/admin/assistant/requests/:id', async c => {
    const id = z.string().uuid().safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Invalid ID' }, 400);
    const rows = await run(`SELECT id,user_id,conversation_id,parent_id,retry_of,feedback,feedback_at,clicked_actions,review_status,reviewed_by,reviewed_at,started_at,finished_at,status,error_code,lang,model,streaming,image_count,history_count,duration_ms,first_answer_ms,metrics,
      started_at <= NOW() - INTERVAL '30 days' AS content_expired,
      CASE WHEN started_at > NOW() - INTERVAL '30 days' THEN question ELSE NULL END AS question,
      CASE WHEN started_at > NOW() - INTERVAL '30 days' THEN answer ELSE NULL END AS answer,
      CASE WHEN started_at > NOW() - INTERVAL '30 days' THEN response ELSE NULL END AS response,
      CASE WHEN started_at > NOW() - INTERVAL '30 days' THEN review_note ELSE NULL END AS review_note
      FROM site_assistant_requests WHERE id=? AND started_at > NOW() - INTERVAL '90 days'`, [id.data]);
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    await run('INSERT INTO site_assistant_audit(actor,action,record_id) VALUES (?,?,?)', [actors.get(c),'read_detail',id.data]);
    diagnosticLog('assistant_monitor_detail_read', { requestId: currentDiagnosticRequestId(), recordId: id.data });
    return c.json(rows[0]);
  });
  routes.post('/admin/assistant/requests/:id/review', async c => {
    const id = z.string().uuid().safeParse(c.req.param('id'));
    const data = z.object({ status: z.enum(['open','confirmed','resolved','dismissed']), note: z.string().trim().max(500).default('') }).strict().safeParse(await c.req.json().catch(() => null));
    if (!id.success || !data.success) return c.json({ error: 'Invalid review' }, 400);
    const rows = await run(`WITH changed AS (UPDATE site_assistant_requests SET review_status=?,review_note=?,reviewed_by=?,reviewed_at=NOW()
      WHERE id=? AND scope='chat' AND started_at>NOW()-INTERVAL '30 days' RETURNING id)
      INSERT INTO site_assistant_audit(actor,action,record_id) SELECT ?,?,id FROM changed RETURNING record_id`,
      [data.data.status,redactAssistantText(data.data.note),actors.get(c),id.data,actors.get(c),'review:'+data.data.status]);
    return rows.length ? c.json({ ok: true }) : c.json({ error: 'Not found or expired' },404);
  });
  routes.get('/admin/assistant/insights', async c => {
    const parsed = filters.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Invalid filters' },400);
    const { days } = parsed.data;
    const [feedback, retrievals, entries, alerts, daily, audit, cost] = await Promise.all([
      run(`SELECT feedback,review_status,COUNT(*)::int AS requests FROM site_assistant_requests WHERE scope='chat' AND ${windowSql} AND feedback IS NOT NULL GROUP BY feedback,review_status`,[days]),
      run(`SELECT r->>'mode' AS mode,r->>'reason' AS reason,COUNT(*)::int AS calls,COUNT(*) FILTER(WHERE jsonb_array_length(r->'hits')=0)::int AS empty
        FROM site_assistant_requests,jsonb_array_elements(COALESCE(metrics->'retrievals','[]')) r WHERE ${windowSql} GROUP BY mode,reason`,[days]),
      run(`SELECT code,SUM(requests)::int AS requests FROM site_assistant_entry_daily WHERE day >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date - (?::int - 1) GROUP BY code`,[days]),
      run('SELECT * FROM site_assistant_alerts ORDER BY active DESC,opened_at DESC'),
      run('SELECT day::text,metrics FROM site_assistant_daily WHERE day >= CURRENT_DATE - 729 ORDER BY day'),
      run('SELECT at,actor,action,record_id FROM site_assistant_audit ORDER BY at DESC LIMIT 50'),
      run(`SELECT COALESCE(SUM((metrics->'cost'->>'grossCny')::numeric),0)::float8 AS gross_cny,
        COALESCE(SUM((metrics->'cost'->>'unpricedCalls')::int),0)::int AS unpriced_calls,
        COUNT(*) FILTER(WHERE clicked_actions<>'{}'::jsonb AND scope='chat')::int AS clicked,
        COUNT(*) FILTER(WHERE scope='chat' AND (jsonb_array_length(COALESCE(response->'actions','[]'))>0 OR jsonb_array_length(COALESCE(response->'sources','[]'))>0))::int AS with_links
        FROM site_assistant_requests WHERE ${windowSql}`,[days]),
    ]);
    return c.json({feedback,retrievals,entries,alerts,daily,audit,cost:cost[0],updatedAt:new Date().toISOString()});
  });
  routes.get('/admin/assistant/health', async c => {
    const [state] = await run<{ healthy:boolean }>(`SELECT last_cleanup_at>NOW()-INTERVAL '5 minutes' AND last_replay_at>NOW()-INTERVAL '5 minutes' AS healthy FROM site_assistant_monitor_state WHERE id=TRUE`);
    const alerts = await run(`SELECT code,details FROM site_assistant_alerts WHERE active`);
    return c.json({ healthy:!!state?.healthy,alerts }, state?.healthy ? 200 : 503);
  });
  return routes;
}
export const adminAssistantRoutes = createAdminAssistantRoutes();
