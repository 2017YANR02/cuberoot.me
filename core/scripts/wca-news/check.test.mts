import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changed, divContent, fingerprint, marker, parsePost, type Entry } from './check.mts';

const entry: Entry = { key: 'incidents:1', kind: 'incidents', title: 'Example', date: '2026-10-01', url: 'https://www.worldcubeassociation.org/incidents/1', content: 'Original', hash: fingerprint('Original') };
test('baseline and closed issues suppress duplicates; revisions and reverts create work', () => {
  assert.equal(changed([entry], { [entry.key]: entry.hash }, []).length, 0);
  assert.equal(changed([entry], {}, []).length, 1);
  const issue = { number: 1, body: marker(entry), state: 'closed', html_url: '' };
  assert.equal(changed([entry], {}, [issue]).length, 0);
  const revised = { ...entry, hash: fingerprint('Revised') };
  assert.equal(changed([revised], { [entry.key]: entry.hash }, [issue]).length, 1);
  assert.equal(changed([entry], { [entry.key]: entry.hash }, [{ ...issue, body: marker(revised) }]).length, 1);
});
test('nested article body preserves complete text and links, ignores footer', () => {
  const html = '<div class="panel-wca-post"><h3 class="panel-title">Title</h3><div class="panel-body"><div><span data-utc-time="2026-10-08T14:17:34Z"></span></div><p>First complete paragraph.</p><div>Nested <div>inner</div> end</div><p>Final <a href="/source">source</a>.</p></div></div><footer>Not the article</footer>';
  const post = parsePost(html, '/posts/example');
  assert.match(post.content, /Final <a href="\/source">source<\/a>/);
  assert.match(post.content, /inner<\/div> end/);
  assert.doesNotMatch(post.content, /Not the article|data-utc-time/);
  assert.throws(() => divContent('<div class="panel-body">broken', 'panel-body'));
  assert.throws(() => parsePost('<html>Sign in</html>', '/posts/example'));
});
