import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectPosts, parsePostsPage, postEntry, uniquePosts } from './posts.mts';
const post = (id: number) => ({ id, slug: 'post-' + id, title: 'Title ' + id, created_at: '2026-10-19T21:33:47.000Z', url: '/posts/post-' + id, body: 'Introduction\n<!-- break -->\nFull final paragraph [link](https://example.com).' });
test('all pages include full bodies and stable IDs; overlap reuses disciplinary source', async () => {
  const entries = await collectPosts(async page => ({ totalPages: 2, posts: [post(page)] }));
  assert.equal(entries.length, 2);
  assert.match(entries[0].content, /Full final paragraph/);
  assert.match(entries[0].key, /^posts:\/posts\//);
  assert.equal(uniquePosts(entries, [{ url: entries[0].url }]).length, 1);
  assert.notEqual(postEntry(post(1)).hash, postEntry({ ...post(1), body: 'Revised' }).hash);
});
test('truncated, shifted, duplicate and invalid pages abort instead of seeding', async () => {
  await assert.rejects(collectPosts(async page => ({ totalPages: 2, posts: page === 1 ? [post(1)] : [] })), /Invalid\/empty/);
  await assert.rejects(collectPosts(async () => ({ totalPages: 2, posts: [post(1)] })), /Duplicate/);
  await assert.rejects(collectPosts(async page => ({ totalPages: page === 1 ? 2 : 3, posts: [post(page)] })), /pagination changed/);
  let call = 0;
  await assert.rejects(collectPosts(async () => ({ totalPages: 1, posts: [post(++call)] })), /first page changed/);
  assert.throws(() => parsePostsPage({ totalPages: 1, posts: [{ ...post(1), url: 'https://evil.example/' }] }), /Incomplete/);
});
