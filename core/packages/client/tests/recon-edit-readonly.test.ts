// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReconSubmitForm from '@/app/[lang]/recon/submit/ReconSubmitForm';
import { getRecon, updateRecon, deleteRecon, uploadReconVideo } from '@/lib/recon-api';
import { checkReconCompletion, type ReconCompletionResult } from '@cuberoot/shared/recon-completion';

const fixture = vi.hoisted(() => ({
  user: null as null | { uid: number; wcaId: string; name: string; isAdmin?: boolean },
  solve: { id: 2795, official: 'practice', event: '3x3', person: 'Example', solution: "\n  R U R' // original\n\n", scramble: "R U'", addedById: 'u7', note: 'Original note', rawTime: 2.51, regionalSingleRecord: 'WR' },
  changeSolution: null as null | ((value: string) => void),
}));
vi.mock('@cuberoot/shared/recon-completion', async original => ({
  ...await original<typeof import('@cuberoot/shared/recon-completion')>(),
  checkReconCompletion: vi.fn(async () => ({ status: 'unchecked' })),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'zh' }), useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth-store', async original => ({
  ...await original<typeof import('@/lib/auth-store')>(),
  getAuthUser: () => fixture.user, authActions: { login: vi.fn() },
  useAuthStore: Object.assign((selector: (state: unknown) => unknown) => selector({ user: fixture.user, login: vi.fn() }), { getState: () => ({ user: fixture.user }) }),
  useAuthUser: () => fixture.user,
}));
vi.mock('@/lib/recon-api', async original => ({
  ...await original<typeof import('@/lib/recon-api')>(),
  getRecon: vi.fn(), updateRecon: vi.fn(), deleteRecon: vi.fn(), uploadReconVideo: vi.fn(),
  checkDuplicate: vi.fn(async () => ({ duplicate: false })), fetchMethodCubeHistory: vi.fn(async () => ({ methods: [], cubes: [] })),
}));
vi.mock('@/hooks/useMembership', () => ({ useMembership: () => ({ isMember: true }) }));
vi.mock('@/hooks/useRequireMembership', () => ({ useRequireMembership: () => () => true }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/comp-search', async original => ({ ...await original<typeof import('@/lib/comp-search')>(), loadComps: vi.fn(async () => []) }));
vi.mock('@/components/ReconPlayerPane', () => ({ default: () => null }));
vi.mock('@/components/ReconSolutionField', () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  fixture.changeSolution = onChange;
  return createElement('textarea', { 'data-editor': true, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) });
} }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.user = null;
  vi.mocked(checkReconCompletion).mockReset().mockResolvedValue({ status: 'unchecked' });
  vi.mocked(getRecon).mockReset().mockResolvedValue(fixture.solve as Awaited<ReturnType<typeof getRecon>>);
  vi.mocked(updateRecon).mockClear(); vi.mocked(deleteRecon).mockClear(); vi.mocked(uploadReconVideo).mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = () => act(async () => root.render(createElement<{ editId?: string }>(ReconSubmitForm, { editId: '2795' })));

it.each([null, 8])('shows the saved form disabled for visitor %s and leaves original solution selectable', async uid => {
  fixture.user = uid === null ? null : { uid, wcaId: '', name: 'Viewer' };
  await render();
  const form = host.querySelector('fieldset')!;
  expect(form.disabled).toBe(true);
  expect(host.querySelector('.submit-readonly-source')?.textContent).toBe(fixture.solve.solution);
  expect(host.querySelector('.submit-readonly-source')?.closest('[inert]')).toBeNull();
  expect(host.querySelector('.submit-danger-zone')).toBeNull();
  expect(host.querySelectorAll('fieldset button:not(:disabled), fieldset input:not(:disabled), fieldset select:not(:disabled)')).toHaveLength(0);
  await act(async () => (host.querySelector('.submit-btn-primary') as HTMLButtonElement).click());
  expect(updateRecon).not.toHaveBeenCalled();
  expect(deleteRecon).not.toHaveBeenCalled();
  expect(uploadReconVideo).not.toHaveBeenCalled();
});

it.each([[7, false], [8, true]] as const)('keeps the full editor enabled for owner/admin (%s, %s)', async (uid, isAdmin) => {
  fixture.user = { uid, wcaId: '', name: 'Editor', isAdmin };
  await render();
  expect(host.querySelector('fieldset')?.disabled).toBe(false);
  expect(host.querySelector('.submit-readonly-source')).toBeNull();
  expect(host.querySelector('[data-editor]')).not.toBeNull();
  expect(host.querySelector('.submit-danger-zone')).not.toBeNull();
});

it('keeps a private or missing record out of the edit form', async () => {
  vi.mocked(getRecon).mockRejectedValue(new Error('private'));
  await render();
  expect(host.querySelector('fieldset')).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.textContent).not.toContain(fixture.solve.solution);
});

it('rechecks saved unsolved reasons and updates the requirement after edits', async () => {
  vi.useFakeTimers();
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  vi.mocked(getRecon).mockResolvedValue({ ...fixture.solve, unsolvedReason: 'Old reason', completionStatus: 'unsolved' } as Awaited<ReturnType<typeof getRecon>>);
  vi.mocked(checkReconCompletion).mockResolvedValue({ status: 'solved' });
  await render();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(checkReconCompletion).toHaveBeenCalledWith({ event: '3x3', scramble: fixture.solve.scramble, solution: fixture.solve.solution });
  expect(host.textContent).not.toContain('Reason the puzzle is not solved');
  expect(updateRecon).not.toHaveBeenCalled();

  vi.mocked(checkReconCompletion).mockResolvedValue({ status: 'unsolved' });
  await act(async () => fixture.changeSolution!('R'));
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(host.textContent).toContain('Reason the puzzle is not solved');
  expect([...host.querySelectorAll('textarea')].some(input => input.value === 'Old reason')).toBe(true);
});

it('ignores a stale completion check that finishes after a newer solution', async () => {
  vi.useFakeTimers();
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  let finishOld!: (result: ReconCompletionResult) => void;
  vi.mocked(checkReconCompletion).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  await render();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  vi.mocked(checkReconCompletion).mockResolvedValue({ status: 'solved' });
  await act(async () => fixture.changeSolution!("R'"));
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  await act(async () => finishOld({ status: 'unsolved' }));
  expect(host.textContent).not.toContain('Reason the puzzle is not solved');
});
