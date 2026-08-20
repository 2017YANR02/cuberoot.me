import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');
const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('forum video upload contract', () => {
  it('keeps the migration and schema snapshot aligned', async () => {
    const [migration, schema] = await Promise.all([
      read('../migrations/0163_forum_videos.sql'),
      read('../src/db/schema.pg.sql'),
    ]);

    expect(migration).toContain('CREATE TABLE forum_videos');
    expect(migration).toContain('post_id      BIGINT REFERENCES forum_posts(id) ON DELETE CASCADE');
    expect(migration).toContain("mime IN ('video/mp4', 'video/webm', 'video/quicktime')");
    expect(migration).toContain('size_bytes BETWEEN 1 AND 209715200');
    expect(migration).toContain('ON forum_videos(created_at) WHERE post_id IS NULL');
    expect(migration).toContain('ON forum_videos(post_id) WHERE post_id IS NOT NULL');
    expect(normalizeSql(schema)).toContain(normalizeSql(migration));
  });

  it('allows every signed-in user while enforcing server-side quotas and container duration', async () => {
    const route = await read('../src/routes/forum.ts');
    const start = route.indexOf("forumRoutes.post('/forum/video'");
    const end = route.indexOf("forumRoutes.delete('/forum/video/:id'", start);
    const upload = route.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(upload).toContain('requireAuth(c)');
    expect(upload).not.toContain('hasActiveMembership');
    expect(upload).toContain('FORUM_VIDEO_MAX_BYTES');
    expect(upload).toContain('FORUM_VIDEO_DAILY_BYTES');
    expect(upload).toContain('FORUM_VIDEO_DAILY_COUNT');
    expect(upload).toContain('cleanupExpiredForumVideos()');
    expect(upload).toContain('receiveVideoUpload');
    expect(upload).toContain('readVideoDurationMs');
    expect(upload).toContain('FORUM_VIDEO_MAX_DURATION_MS');
    expect(upload).toContain('await fs.rename(tempPath, finalPath)');
  });

  it('serves only videos attached to public posts and cleans expired drafts', async () => {
    const route = await read('../src/routes/forum.ts');

    expect(route).toContain("post_id IS NULL AND created_at < NOW() - INTERVAL '1 day'");
    expect(route).toContain("NOT p.is_deleted AND p.status = 'approved'");
    expect(route).toContain("NOT t.is_deleted AND t.status = 'approved'");
  });

  it('binds an owned unexpired upload to the first post in the thread transaction', async () => {
    const route = await read('../src/routes/forum.ts');
    const start = route.indexOf("forumRoutes.post('/forum/threads'");
    const end = route.indexOf("forumRoutes.post('/forum/posts'", start);
    const createThread = route.slice(start, end);

    expect(createThread).toContain('videoId?: number');
    expect(createThread).toContain('FOR UPDATE');
    expect(createThread).toContain("created_at >= NOW() - INTERVAL '1 day'");
    expect(createThread).toContain('UPDATE forum_videos v SET post_id = np.id, attached_at = NOW()');
    expect(createThread).toContain('WHERE id = ? AND owner_id = ? AND post_id IS NULL');
  });

  it('configures the API proxy for a streamed 200MB raw upload', async () => {
    const nginx = await read('../../../../ops/nginx/www.cuberoot.me.conf');
    const start = nginx.indexOf('location = /v1/forum/video');
    const block = nginx.slice(start, nginx.indexOf('\n    }', start));

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('client_max_body_size 200m');
    expect(block).toContain('proxy_request_buffering off');
    expect(block).toContain('proxy_buffering off');
  });
});
