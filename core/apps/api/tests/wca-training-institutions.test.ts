import { beforeEach, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAdminOrApiKey: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: mocks.requireAdminOrApiKey }));
import { wcaTrainingInstitutionRoutes as app } from '../src/routes/wca_training_institutions.js';
const id = '11111111-1111-4111-8111-111111111111';
const put = (student = '2023GENG02', institutionId: unknown = id) => app.request(`/wca/training-institutions/${student}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institutionId }),
});
beforeEach(() => vi.resetAllMocks());
it('denies non-admin writes before querying', async () => {
  mocks.requireAdminOrApiKey.mockRejectedValue(new HTTPException(403));
  expect((await put()).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('validates both student types, institution IDs and lookup batch size', async () => {
  expect((await put('bad')).status).toBe(400);
  expect((await put('2023GENG02', 'bad')).status).toBe(400);
  expect((await app.request('/wca/training-institutions?students=named:bad')).status).toBe(400);
  expect((await app.request('/wca/training-institutions?students=' + Array.from({ length: 101 }, (_, i) => `${2000+i}TEST01`).join(','))).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('publicly reads only registered institutions and requested students', async () => {
  mocks.query.mockResolvedValueOnce([{ id, name: '上海魔方根科技有限公司' }]).mockResolvedValueOnce([]);
  const response = await app.request(`/wca/training-institutions?students=2023GENG02,named:${id}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(mocks.query.mock.calls[0][0]).toContain('wca_training_institutions');
  expect(mocks.query.mock.calls[1][1]).toEqual(['2023GENG02', id]);
});
it('assigns or clears institutions independently without changing teacher or team tables', async () => {
  for (const student of ['2023GENG02', `named:${id}`]) {
    mocks.query.mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([{ id: 1 }]);
    expect((await put(student)).status).toBe(200);
    mocks.query.mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([]);
    expect((await put(student, null)).status).toBe(200);
  }
  for (const [sql] of mocks.query.mock.calls) expect(sql).not.toMatch(/(?:INSERT INTO|DELETE FROM|UPDATE) (?:wca_teachers|wca_person_teams)\b/);
});
it('rejects a missing person or a private/unregistered institution', async () => {
  mocks.query.mockResolvedValueOnce([]);
  expect((await put()).status).toBe(404);
  mocks.query.mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([]);
  expect((await put()).status).toBe(404);
  expect(mocks.query.mock.calls.at(-1)?.[0]).toContain('FROM wca_training_institutions');
});
