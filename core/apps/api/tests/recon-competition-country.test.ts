import { beforeEach, expect, it, vi } from 'vitest';
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query }));
import { normalizeReconCompetitionCountry } from '../src/utils/recon_helpers.js';
beforeEach(() => { query.mockReset(); query.mockResolvedValue([{ country_id: 'China' }]); });
it('fills missing host country on create from the competition, not the solver', async () => {
  const row = { comp_wca_id: 'GuangzhouGrandOpen2026', person_country: 'hk' };
  await normalizeReconCompetitionCountry(row);
  expect(row).toEqual({ comp_wca_id: 'GuangzhouGrandOpen2026', person_country: 'hk', country: 'cn' });
});
it('repairs missing country on a partial edit', async () => {
  const row = { method: 'ZB' };
  await normalizeReconCompetitionCountry(row, { comp_wca_id: 'GuangzhouGrandOpen2026' });
  expect(row).toEqual({ method: 'ZB', country: 'cn' });
});
it('replaces a stale country when the competition changes', async () => {
  const row = { comp_wca_id: 'GuangzhouGrandOpen2026', country: 'us' };
  await normalizeReconCompetitionCountry(row, { comp_wca_id: 'Old', country: 'us' });
  expect(row.country).toBe('cn');
});
it('does not retain the old host when the competition is cleared', async () => {
  const row = { comp_wca_id: '' };
  await normalizeReconCompetitionCountry(row, { comp_wca_id: 'Old', country: 'us' });
  expect(row).toEqual({ comp_wca_id: '', country: null });
  expect(query).not.toHaveBeenCalled();
});
it('preserves explicit country for a competition not yet indexed', async () => {
  query.mockResolvedValue([]);
  const row = { comp_wca_id: 'NewCompetition', country: 'hk' };
  await normalizeReconCompetitionCountry(row);
  expect(row.country).toBe('hk');
});
