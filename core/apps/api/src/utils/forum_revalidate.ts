import type { MiddlewareHandler } from 'hono';
import { query } from '../db/connection.js';
import { revalidateContentPages } from './recon_revalidate.js';

/** Only successful content edits affect cards; views/reactions never do. */
export const revalidateForumMutation: MiddlewareHandler = async (c, next) => {
  await next();
  if (!['POST', 'PATCH', 'DELETE'].includes(c.req.method) || !c.res.ok) return;
  const path = c.req.path;
  if (!/\/forum\/(?:threads(?:\/\d+)?|posts(?:\/\d+)?|review\/(?:thread|post)\/\d+\/(?:approve|reject)|reports\/\d+\/resolve)$/.test(path)) return;
  try {
    const thread = path.match(/\/threads\/(\d+)$|\/review\/thread\/(\d+)\//);
    if (thread) return await revalidateContentPages('forum', thread[1] ?? thread[2]);
    if (path.endsWith('/threads')) {
      const body = await c.res.clone().json() as { id: number };
      return await revalidateContentPages('forum', body.id);
    }
    if (/\/reports\//.test(path)) {
      // A moderation resolution can hide several posts or the entire thread.
      return await revalidateContentPages('forum');
    }
    const post = path.match(/\/posts\/(\d+)$|\/review\/post\/(\d+)\//);
    const id = post ? post[1] ?? post[2] : (await c.res.clone().json() as { id: number }).id;
    const [row] = await query<{ thread_id: string }>('SELECT thread_id FROM forum_posts WHERE id = ?', [id]);
    if (row) await revalidateContentPages('forum', row.thread_id);
  } catch {
    console.error('[forum-cache] invalidation failed', { path });
  }
};
