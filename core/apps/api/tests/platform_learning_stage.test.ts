import { expect, it, vi } from 'vitest';
import { platformRouter } from '../src/platform/http.js';
import { registerStageRoutes } from '../src/platform/learning/stage-routes.js';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), query: vi.fn() }));
vi.mock('../src/platform/auth.js', () => ({ requirePlatformActor: mocks.actor }));
vi.mock('../src/platform/db.js', () => ({ platformDb: () => ({}), platformQuery: mocks.query }));

it('scopes reads and writes to the session and imports old device data only when absent', async () => {
  const app = platformRouter();
  registerStageRoutes(app);
  mocks.actor.mockResolvedValue({ userId: 12 });
  mocks.query.mockResolvedValue([{stage: 'sub30'}]);
  const path = '/me/learning-stage';
  const read = await app.request(path);
  expect(await read.json()).toEqual({stage: 'sub30'});
  expect(read.headers.get('Cache-Control')).toBe('private, no-store');
  const put = (body: object) => app.request(path, {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(body)});
  expect(await (await put({stage:'sub15', userId:99, initializeOnly:true})).json()).toEqual({stage:'sub30'});
  expect(mocks.query.mock.calls[1].slice(1)).toEqual([expect.stringContaining('DO NOTHING'), [12, 'sub15']]);
  expect(await (await put({stage:'sub20'})).json()).toEqual({stage:'sub20'});
  expect(mocks.query.mock.calls.at(-1)!.slice(1)).toEqual([expect.stringContaining('DO UPDATE'), [12, 'sub20']]);
  expect((await put({stage:'unknown'})).status).toBe(400);
});
