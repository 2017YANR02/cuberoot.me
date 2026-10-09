import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';
const apiPath = (path: string) => workspaceFixturePath('@cuberoot/server', path);
const query = vi.fn();
const invalidate = vi.fn();
vi.doMock(apiPath('src/db/connection.ts'), () => ({ query }));
vi.doMock(apiPath('src/utils/recon_revalidate.ts'), () => ({ revalidateContentPages: invalidate }));
const { revalidateForumMutation } = await import(pathToFileURL(apiPath('src/utils/forum_revalidate.ts')).href);
const require = createRequire(apiPath('package.json'));
const { Hono } = await import(pathToFileURL(require.resolve('hono')).href);
function write(path: string, status = 200) {
  const app = new Hono();
  app.use('/v1/forum/*', revalidateForumMutation);
  app.post(path, () => Response.json({ id: 70 }, { status }));
  return app.request(path, { method: 'POST' });
}
beforeEach(() => {
  invalidate.mockReset().mockResolvedValue(undefined);
  query.mockReset().mockResolvedValue([{ thread_id: '42' }]);
});
it('targets the newly created thread or the parent of an edited post', async () => {
  await write('/v1/forum/threads');
  await write('/v1/forum/posts/70');
  expect(invalidate.mock.calls).toEqual([['forum', 70], ['forum', '42']]);
});
it('invalidates moderation changes including a multi-thread report resolution', async () => {
  await write('/v1/forum/review/thread/42/reject');
  await write('/v1/forum/reports/8/resolve');
  expect(invalidate.mock.calls).toEqual([['forum', '42'], ['forum']]);
});
it('does not notify deployments for views, reactions or failed writes', async () => {
  await write('/v1/forum/t/42/view');
  await write('/v1/forum/posts/70/react');
  await write('/v1/forum/threads/42', 403);
  expect(invalidate).not.toHaveBeenCalled();
  expect(query).not.toHaveBeenCalled();
});
