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

test('bulk drift creates bounded digests and archives originals only after saving replacements', async () => {
  const { publishDigests, issueVersions } = await import('./check.mts');
  const entries = Array.from({ length: 142 }, (_, i) => ({ ...entry, key: `incidents:${i + 1}` }));
  const issues: import('./check.mts').Issue[] = entries.map((e, i) => ({ number: i + 1, body: marker(e), state: 'open', html_url: '', user: { login: 'github-actions[bot]' } }));
  let writes = 0;
  const github = async (path: string, method = 'GET', body?: any) => {
    writes++;
    if (method === 'POST') {
      const result = { number: issues.length + 1, html_url: '', ...body };
      issues.push({ ...result, state: 'open' });
      return result;
    }
    const issue = issues.find(i => i.number === Number(path.split('/').at(-1)))!;
    if (body.state === 'closed') {
      const key = issueVersions(issue.body)[0].key;
      assert.ok(issues.some(i => i.body?.startsWith('<!-- wca-news-digest') && issueVersions(i.body).some(v => v.key === key)));
    }
    Object.assign(issue, body);
    return { ...issue };
  };
  await publishDigests(entries, [], [...issues], github);
  assert.equal(issues.filter(i => i.state === 'open').length, 3);
  assert.ok(issues.filter(i => i.state === 'open').every(i => issueVersions(i.body).length <= 50));
  assert.match(issues[0].body!, /not|合并/);
  assert.equal(changed(entries, {}, issues).length, 0);
  const count = writes;
  await publishDigests(entries, [], issues, github);
  assert.equal(writes, count);
});

test('digest revisions reopen only the changed item and preserve human notes and completed items', async () => {
  const { publishDigests } = await import('./check.mts');
  const other = { ...entry, key: 'incidents:2' };
  const body = `<!-- wca-news-digest incidents 1 -->\nHuman notes\n<!-- wca-news-items:start -->\n- [x] Done ${marker(entry)}\n- [x] Also done ${marker(other)}\n<!-- wca-news-items:end -->\nKeep this footer`;
  const issue = { number: 100, body, state: 'closed', html_url: '' };
  const revised = { ...entry, hash: fingerprint('New version') };
  let patch: any;
  await publishDigests([revised, other], [revised], [issue], async (_path, _method, value) => { patch = value; return { ...issue, ...value }; });
  assert.equal(patch.state, 'open');
  assert.match(patch.body, /Human notes/);
  assert.match(patch.body, /Keep this footer/);
  assert.match(patch.body, /- \[x\] Also done/);
  assert.match(patch.body, /- \[ \] \[Example\]/);
  assert.equal(changed([revised, other], {}, [{ ...issue, ...patch }, { number: 1, body: marker(entry), state: 'closed', html_url: '' }]).length, 0);
});

test('failed digest writes cannot close originals; retry preserves existing checkboxes', async () => {
  const { publishDigests } = await import('./check.mts');
  const legacy = { number: 1, body: marker(entry), state: 'open', html_url: '', user: { login: 'github-actions[bot]' } };
  const calls: string[] = [];
  await assert.rejects(publishDigests([entry], [], [legacy], async (path) => { calls.push(path); throw new Error('network'); }));
  assert.deepEqual(calls, ['/issues']);
  const summary = { number: 2, state: 'open', html_url: '', body: `<!-- wca-news-digest incidents 1 -->\n<!-- wca-news-items:start -->\n- [x] Done ${marker(entry)}\n<!-- wca-news-items:end -->` };
  calls.length = 0;
  await publishDigests([entry], [], [summary, legacy], async (path, _method, body) => { calls.push(path); return { ...legacy, ...body as object }; });
  assert.deepEqual(calls, ['/issues/1']);
});

test('incident translation drift ignores metadata but catches title and body revisions', async () => {
  const { incidentFingerprint } = await import('./check.mts');
  const raw = { title: 'Title', public_summary: 'Body\r\nText', competitions: [{ id: 'Test', name: 'Old' }], tags: ['old'] };
  assert.equal(incidentFingerprint(raw), incidentFingerprint({ ...raw, competitions: [], tags: [] }));
  assert.notEqual(incidentFingerprint(raw), incidentFingerprint({ ...raw, title: 'Changed title' }));
  assert.notEqual(incidentFingerprint(raw), incidentFingerprint({ ...raw, public_summary: 'Changed body' }));
  const { default: migration } = await import('./incident-hash-aliases.json', { with: { type: 'json' } });
  const [oldHash, currentHash] = Object.entries(migration.aliases)[0];
  const migrated = { ...entry, hash: currentHash };
  assert.equal(changed([migrated], { [entry.key]: oldHash }, []).length, 0);
  assert.equal(changed([migrated], {}, [{ number: 1, body: marker({ ...entry, hash: oldHash }), state: 'closed', html_url: '' }]).length, 0);
});

test('unexpected bulk content changes stop before any issue write', async () => {
  const { publishDigests } = await import('./check.mts');
  const changes = Array.from({ length: 51 }, (_, i) => ({ ...entry, key: `incidents:${i}` }));
  let writes = 0;
  await assert.rejects(publishDigests(changes, changes, [], async () => { writes++; }), /Unexpected bulk drift/);
  assert.equal(writes, 0);
});
