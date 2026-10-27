import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAdmin: vi.fn(), checkRateLimit: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdmin: mocks.requireAdmin, checkRateLimit: mocks.checkRateLimit }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
import { careerApplicationRoutes } from '../src/routes/career_applications.js';
const id = 'a583944b-1fb2-4f2e-a372-a9cda825bc64';
function application() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id, position: 'engineering', city: 'shanghai', name: 'Test', phone: '123456', email: 'test@example.test', education: '', experience: '', channel: '', consent: 'yes' })) form.set(key, value);
  form.set('resume', new File(['%PDF-1.4 test'], 'resume.pdf', { type: 'application/pdf' }));
  return form;
}
describe('career applications', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAdmin.mockRejectedValue(new Error('Not authorized')); });
  it('exposes only availability without returning applicant data', async () => {
    mocks.query.mockResolvedValue([]);
    const response = await careerApplicationRoutes.request('/career-applications/status');
    expect(await response.json()).toEqual({ available: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.query.mock.calls[0][0]).toBe('SELECT 1 FROM career_applications LIMIT 1');
  });
  it('rejects anonymous access before querying applications or attachments', async () => {
    for (const path of ['/career-applications', `/career-applications/${id}/resume`]) {
      const response = await careerApplicationRoutes.request(path);
      expect(response.status).not.toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects missing consent and invalid attachment contents before saving', async () => {
    const missingConsent = application(); missingConsent.delete('consent');
    expect((await careerApplicationRoutes.request('/career-applications', { method: 'POST', body: missingConsent })).status).toBe(400);
    const invalid = application(); invalid.set('resume', new File(['not a pdf'], 'resume.pdf'));
    expect((await careerApplicationRoutes.request('/career-applications', { method: 'POST', body: invalid })).status).toBe(400);
    const invalidPhoto = application(); invalidPhoto.set('photo', new File(['not an image'], 'photo.'));
    expect((await careerApplicationRoutes.request('/career-applications', { method: 'POST', body: invalidPhoto })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects oversized resume before saving', async () => {
    const form = application(); form.set('resume', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'resume.pdf'));
    expect((await careerApplicationRoutes.request('/career-applications', { method: 'POST', body: form })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('saves an application once and rejects a reused id with changed content', async () => {
    mocks.query.mockImplementation(async (_sql, params) => [{ payload_hash: params[1] }]);
    const response = await careerApplicationRoutes.request('/career-applications', { method: 'POST', body: application() });
    expect(response.status).toBe(201); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.query.mock.calls[0][1][12]).toBeInstanceOf(Buffer);
    mocks.query.mockResolvedValue([{ payload_hash: 'different' }]);
    expect((await careerApplicationRoutes.request('/career-applications', { method: 'POST', body: application() })).status).toBe(409);
  });
  it('downloads only for an authorized administrator as an attachment', async () => {
    mocks.requireAdmin.mockResolvedValue({ isAdmin: true });
    mocks.query.mockResolvedValue([{ data: Buffer.from('%PDF-1.4 test'), ext: 'pdf' }]);
    const response = await careerApplicationRoutes.request(`/career-applications/${id}/resume`);
    expect(response.status).toBe(200); expect(response.headers.get('content-disposition')).toBe('attachment; filename="resume.pdf"');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('requires administrator access to delete, and deletes the entire application including its attachments', async () => {
    const denied = await careerApplicationRoutes.request(`/career-applications/${id}`, { method: 'DELETE' });
    expect(denied.status).not.toBe(200);
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.requireAdmin.mockResolvedValue({ isAdmin: true });
    mocks.query.mockResolvedValue([]);
    const result = await careerApplicationRoutes.request(`/career-applications/${id}`, { method: 'DELETE' });
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(mocks.query).toHaveBeenCalledWith('DELETE FROM career_applications WHERE id = ?', [id]);
    const invalid = await careerApplicationRoutes.request('/career-applications/not-a-uuid', { method: 'DELETE' });
    expect(invalid.status).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
