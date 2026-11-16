import type { AssistantRunState } from '@cuberoot/shared/site-assistant';
import { query, type QueryRunner } from '../db/connection.js';

/** Durable, owner-scoped cancellation works across API workers. No chat content. */
export function assistantRunStore(run: QueryRunner = query) {
  const expire = async (uid: number) => {
    await run(`UPDATE site_assistant_runs SET state='interrupted',finished_at=NOW()
      WHERE user_id=? AND state IN ('running','stopping') AND expires_at<=NOW()`, [uid]);
    await run(`DELETE FROM site_assistant_runs WHERE user_id=? AND created_at<NOW()-INTERVAL '1 day' AND state NOT IN ('running','stopping')`, [uid]);
  };
  return {
    async start(uid: number, conversationId: string, id: string): Promise<boolean> {
      await expire(uid);
      // Both the run ID and active-conversation index participate in conflict handling.
      return !!(await run(`INSERT INTO site_assistant_runs(id,user_id,conversation_id,state)
        VALUES (?,?,?,'running') ON CONFLICT DO NOTHING RETURNING id`, [id,uid,conversationId])).length;
    },
    async read(uid: number, id: string): Promise<AssistantRunState | undefined> {
      return (await run<{state:AssistantRunState}>(`SELECT CASE WHEN state IN ('running','stopping') AND expires_at<=NOW() THEN 'interrupted' ELSE state END AS state FROM site_assistant_runs WHERE id=? AND user_id=?`, [id,uid]))[0]?.state;
    },
    async cancel(uid: number, conversationId: string, id: string): Promise<AssistantRunState | undefined> {
      await expire(uid);
      // A cancellation can arrive before admission. Its tombstone prevents late start.
      return (await run<{state:AssistantRunState}>(`INSERT INTO site_assistant_runs(id,user_id,conversation_id,state,finished_at)
        VALUES (?,?,?,'cancelled',NOW()) ON CONFLICT (id) DO UPDATE
        SET state=CASE WHEN site_assistant_runs.state='running' THEN 'stopping' ELSE site_assistant_runs.state END
        WHERE site_assistant_runs.user_id=EXCLUDED.user_id AND site_assistant_runs.conversation_id=EXCLUDED.conversation_id
        RETURNING state`, [id,uid,conversationId]))[0]?.state;
    },
    async finish(uid: number, id: string, state: 'completed'|'cancelled'|'error'): Promise<AssistantRunState | undefined> {
      // Completion and cancellation race in one row lock. A stopped/expired run
      // cannot commit a successful answer, even if its provider returns late.
      const rows=await run<{state:AssistantRunState}>(`UPDATE site_assistant_runs SET
        state=CASE WHEN expires_at<=NOW() THEN 'interrupted' WHEN state='stopping' THEN 'cancelled' ELSE ? END,
        finished_at=NOW() WHERE id=? AND user_id=? AND state IN ('running','stopping') RETURNING state`, [state,id,uid]);
      return rows[0]?.state ?? this.read(uid,id);
    },
  };
}

/** Poll serially: a slow database must not create overlapping queries. */
export function watchAssistantRun(store: ReturnType<typeof assistantRunStore>, uid: number, id: string, controller: AbortController) {
  let closed=false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll=async()=>{
    try { const state=await store.read(uid,id); if(!closed && state!=='running' && state!=='completed') controller.abort(state==='stopping' || state==='cancelled' ? 'user_cancel' : new Error('run_unavailable')); }
    catch { if(!closed) controller.abort(new Error('run_unavailable')); } // Fail closed if execution ownership cannot be checked.
    if(!closed && !controller.signal.aborted) timer=setTimeout(()=>void poll(),250);
  };
  timer=setTimeout(()=>void poll(),250);
  return ()=>{closed=true;clearTimeout(timer);};
}
