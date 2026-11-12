import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishDrift, sourceMarker } from './drift-issue.mts';

function fixture() {
  const issues: any[] = [], comments = new Map<number, any[]>(), writes: string[] = [];
  const github = async (path: string, method = 'GET', body?: any) => {
    if (method === 'GET') {
      const number = path.match(/^\/issues\/(\d+)\/comments/)?.[1];
      if (!number) return [...issues];
      const page = Number(new URL('https://example.test' + path).searchParams.get('page'));
      return (comments.get(Number(number)) ?? []).slice((page - 1) * 100, page * 100);
    }
    writes.push(method + ' ' + path);
    if (path === '/issues') { const issue = { number: issues.length + 1, state: 'open', ...body }; issues.push(issue); return issue; }
    const number = Number(path.split('/')[2]);
    if (method === 'PATCH') { Object.assign(issues.find(i => i.number === number), body); return {}; }
    comments.set(number, [...comments.get(number) ?? [], body]);
    return body;
  };
  return { issues, comments, writes, github };
}
const report = (version: string) => `Report\n${sourceMarker({ content: version })}`;
test('repeat runs and closed handled versions stay quiet; new versions and reverts reuse one issue', async () => {
  const f = fixture();
  const publish = (version: string) => publishDrift('icons-drift', 'Icons', report(version), f.github);
  assert.equal(await publish('a'), 'created');
  assert.equal(await publish('a'), 'unchanged');
  f.issues[0].state = 'closed';
  assert.equal(await publish('a'), 'unchanged');
  assert.equal(f.issues[0].state, 'closed');
  assert.equal(await publish('b'), 'updated');
  assert.equal(await publish('b'), 'unchanged');
  assert.equal(await publish('a'), 'updated');
  assert.equal(f.issues.length, 1);
  assert.equal(f.comments.get(1)?.length, 2);
});
test('comment pagination and lost write responses do not duplicate notifications', async () => {
  const f = fixture();
  f.issues.push({ number: 7, state: 'open', body: 'Human original' });
  f.comments.set(7, Array.from({ length: 101 }, () => ({ body: 'Human notes' })));
  await assert.rejects(publishDrift('icons-drift', 'Icons', report('a'), async (path, method, body) => {
    const result = await f.github(path, method, body);
    if (method === 'POST') throw Error('response lost');
    return result;
  }));
  const writes = f.writes.length;
  assert.equal(await publishDrift('icons-drift', 'Icons', report('a'), f.github), 'unchanged');
  assert.equal(f.writes.length, writes);
  assert.equal(f.issues[0].body, 'Human original');
});
test('failed history reads and missing source fingerprints never publish', async () => {
  const f = fixture();
  await assert.rejects(publishDrift('icons-drift', 'Icons', 'unversioned', f.github));
  assert.equal(f.writes.length, 0);
  f.issues.push({ number: 1, state: 'open', body: 'Existing' });
  await assert.rejects(publishDrift('icons-drift', 'Icons', report('a'), async (path, method, body) => {
    if (path.includes('/comments')) throw Error('history unavailable');
    return f.github(path, method, body);
  }));
  assert.equal(f.writes.length, 0);
});
