// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReconSubmitForm from '@/app/[lang]/recon/submit/ReconSubmitForm';
import { getRecon, listRecons, updateRecon, deleteRecon, uploadReconVideo, RECON_VIDEO_MAX_BYTES } from '@/lib/recon-api';
import { checkReconCompletion, type ReconCompletionResult } from '@cuberoot/shared/recon-completion';
import type { VerifiedVideoDraft } from '@/app/[lang]/video-recon/VideoSolveAnalysis';

const fixture = vi.hoisted(() => ({
  user: null as null | { uid: number; wcaId: string; name: string; isAdmin?: boolean },
  member: true,
  searchParams: new URLSearchParams(),
  solve: { id: 2795, official: 'practice', event: '3x3', person: 'Example', solution: "\n  R U R' // original\n\n", scramble: "R U'", addedById: 'u7', note: 'Original note', rawTime: 2.51, regionalSingleRecord: 'WR' },
  changeSolution: null as null | ((value: string) => void),
}));
vi.mock('@cuberoot/shared/recon-completion', async original => ({
  ...await original<typeof import('@cuberoot/shared/recon-completion')>(),
  checkReconCompletion: vi.fn(async () => ({ status: 'unchecked' })),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/zh/recon/edit', useParams: () => ({ lang: 'zh' }), useSearchParams: () => fixture.searchParams, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/app/[lang]/recon/revalidate-action', () => ({ revalidateRecon: vi.fn(async () => {}) }));
vi.mock('@/lib/auth-store', async original => ({
  ...await original<typeof import('@/lib/auth-store')>(),
  getAuthUser: () => fixture.user, authActions: { login: vi.fn() },
  useAuthStore: Object.assign((selector: (state: unknown) => unknown) => selector({ user: fixture.user, login: vi.fn() }), { getState: () => ({ user: fixture.user }) }),
  useAuthUser: () => fixture.user,
}));
vi.mock('@/lib/recon-api', async original => ({
  ...await original<typeof import('@/lib/recon-api')>(),
  getRecon: vi.fn(), listRecons: vi.fn(), updateRecon: vi.fn(), deleteRecon: vi.fn(), uploadReconVideo: vi.fn(),
  checkDuplicate: vi.fn(async () => ({ duplicate: false })), fetchMethodCubeHistory: vi.fn(async () => ({ methods: [], cubes: [] })),
}));
vi.mock('@/hooks/useMembership', () => ({ useMembership: () => ({ isMember: fixture.member }) }));
vi.mock('@/hooks/useRequireMembership', () => ({ useRequireMembership: () => () => true }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/comp-search', async original => ({ ...await original<typeof import('@/lib/comp-search')>(), loadComps: vi.fn(async () => []) }));
vi.mock('@/lib/comp-wcif', async original => ({
  ...await original<typeof import('@/lib/comp-wcif')>(),
  fetchCompRounds: vi.fn(async () => ({})),
}));
vi.mock('@/lib/wca-results-api', async original => ({
  ...await original<typeof import('@/lib/wca-results-api')>(),
  fetchAttempts: vi.fn(async () => null), fetchResultRow: vi.fn(async () => null),
  fetchScrambleGroups: vi.fn(async () => ['A', 'E']),
  fetchMatchingScrambleGroup: vi.fn(async () => null),
  fetchScrambles: vi.fn(async () => null), fetchOptimalScrambles: vi.fn(async () => null),
}));
vi.mock('@/components/ReconPlayerPane', () => ({ default: () => null }));
vi.mock('@/app/[lang]/video-recon/VideoReconClient', () => ({
  VideoReconWorkspace: ({ submission }: { submission: { file: File; onApply?: (draft: VerifiedVideoDraft) => void } }) =>
    createElement('div', null,
      createElement('output', { 'data-video-review': true, 'data-can-apply': !!submission.onApply }, submission.file.name),
      submission.onApply && createElement('button', {
        type: 'button', 'data-use-video-solution': true, onClick: () => submission.onApply!({ solution: "R' // verified" }),
      }, 'Use this solution')),
}));
vi.mock('@/components/ReconSolutionField', () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  fixture.changeSolution = onChange;
  return createElement('textarea', { 'data-editor': true, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) });
} }));

let host: HTMLDivElement;
let root: Root;
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = vi.fn();
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.user = null;
  fixture.member = true;
  fixture.searchParams = new URLSearchParams();
  vi.mocked(listRecons).mockReset().mockResolvedValue([]);
  vi.mocked(checkReconCompletion).mockReset().mockResolvedValue({ status: 'unchecked' });
  vi.mocked(getRecon).mockReset().mockResolvedValue(fixture.solve as Awaited<ReturnType<typeof getRecon>>);
  vi.mocked(updateRecon).mockReset().mockResolvedValue({ ok: true }); vi.mocked(deleteRecon).mockClear(); vi.mocked(uploadReconVideo).mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = (editId: string | null = '2795') => act(async () =>
  root.render(createElement<{ editId?: string }>(ReconSubmitForm, { editId: editId ?? undefined })));

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

it('requires an explanation for an unsolved reconstruction only after submitting', async () => {
  vi.useFakeTimers();
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  vi.mocked(checkReconCompletion).mockResolvedValue({ status: 'unsolved' });
  await render();
  await act(async () => fixture.changeSolution!('R'));
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(checkReconCompletion).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Reason the puzzle is not solved');

  const submit = () => (host.querySelector('.submit-btn-primary') as HTMLButtonElement).click();
  await act(async () => submit());
  expect(checkReconCompletion).toHaveBeenCalledWith({ event: '3x3', scramble: fixture.solve.scramble, solution: 'R' });
  expect(host.textContent).toContain('Reason the puzzle is not solved');
  expect(updateRecon).not.toHaveBeenCalled();

  vi.mocked(checkReconCompletion).mockResolvedValue({ status: 'solved' });
  await act(async () => fixture.changeSolution!("U R'"));
  expect(host.textContent).not.toContain('Reason the puzzle is not solved');
  await act(async () => submit());
  expect(updateRecon).toHaveBeenCalledWith(2795, expect.objectContaining({ unsolvedReason: null }));
});

it('ignores a stale completion check that finishes after a newer solution', async () => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  let finishOld!: (result: ReconCompletionResult) => void;
  vi.mocked(checkReconCompletion).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  await render();
  await act(async () => (host.querySelector('.submit-btn-primary') as HTMLButtonElement).click());
  await act(async () => fixture.changeSolution!("R'"));
  await act(async () => finishOld({ status: 'unsolved' }));
  expect(host.textContent).not.toContain('Reason the puzzle is not solved');
});

it('lets an editor review an existing explanation after submitting', async () => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  vi.mocked(getRecon).mockResolvedValue({ ...fixture.solve, unsolvedReason: 'Old reason' } as Awaited<ReturnType<typeof getRecon>>);
  vi.mocked(checkReconCompletion).mockResolvedValue({ status: 'unsolved' });
  await render();
  expect(host.textContent).not.toContain('Reason the puzzle is not solved');

  const submit = () => (host.querySelector('.submit-btn-primary') as HTMLButtonElement).click();
  await act(async () => submit());
  expect([...host.querySelectorAll('textarea')].some(input => input.value === 'Old reason' && !input.disabled)).toBe(true);
  expect(updateRecon).not.toHaveBeenCalled();
  await act(async () => submit());
  expect(updateRecon).toHaveBeenCalledWith(2795, expect.objectContaining({ unsolvedReason: 'Old reason' }));
});

it.each([null, 8])('opens local video reconstruction without membership for visitor %s', async uid => {
  fixture.member = false;
  fixture.user = uid === null ? null : { uid, wcaId: '', name: 'Editor' };
  await render(null);
  const input = host.querySelector<HTMLInputElement>('#recon-video-local')!;
  expect(input.disabled).toBe(false);
  expect(host.querySelector('.submit-video-save input')).toBeNull();
  const file = new File(['local video'], 'solve.mp4', { type: 'video/mp4' });
  Object.defineProperty(file, 'size', { value: RECON_VIDEO_MAX_BYTES + 1 });
  Object.defineProperty(input, 'files', { value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await act(async () => vi.waitFor(() => expect(document.querySelector('[data-video-review="true"]')?.textContent).toBe(file.name)));
  expect(document.querySelector('[data-video-review]')?.getAttribute('data-can-apply')).toBe(String(uid !== null));
  expect(uploadReconVideo).not.toHaveBeenCalled();
});

async function openVideoLinkEntry() {
  const opener = [...host.querySelectorAll('button')].find(button => button.textContent === 'Reconstruct from a link')!;
  await act(async () => opener.click());
  return host.querySelector<HTMLInputElement>('.submit-video-link-entry input')!;
}

async function pasteVideoLink(url: string) {
  const field = await openVideoLinkEntry();
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => url } });
  await act(async () => field.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
}

it('runs the same review for a direct link without replacing the attached URLs or uploading it', async () => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  const existingLink = 'https://example.com/existing.mp4';
  vi.mocked(getRecon).mockResolvedValue({ ...fixture.solve, videoUrl: existingLink } as Awaited<ReturnType<typeof getRecon>>);
  await render();
  await selectMemberVideo();
  const checkbox = host.querySelector<HTMLInputElement>('.submit-video-save input')!;
  await act(async () => checkbox.click());

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('video bytes', {
    headers: { 'Content-Type': 'video/mp4' },
  }));
  try {
    const url = 'https://api.cuberoot.me/v1/recon/video/1';
    await pasteVideoLink(url);
    await act(async () => vi.waitFor(() => expect(document.querySelector('[data-video-review]')?.textContent).toBe('1')));
    expect(fetchSpy).toHaveBeenCalledWith(new URL(url), expect.objectContaining({ credentials: 'omit' }));
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);
    expect(host.querySelector<HTMLTextAreaElement>('#recon-video-urls')?.value).toBe(existingLink);

    await act(async () => document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.submit-btn-primary')!.click());
    expect(updateRecon).toHaveBeenCalledExactlyOnceWith(2795, expect.objectContaining({ videoUrl: existingLink }));
    expect(uploadReconVideo).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});

it('cancels a pending link read without opening a stale video', async () => {
  await render(null);
  let finish!: (response: Response) => void;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  try {
    await pasteVideoLink('https://files.example/solve.mp4');
    const signal = fetchSpy.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    const cancel = [...host.querySelectorAll<HTMLButtonElement>('.submit-video-link-entry button')].find(button => button.textContent === 'Cancel')!;
    await act(async () => cancel.click());
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(new Response('video bytes', { headers: { 'Content-Type': 'video/mp4' } })));
    expect(document.querySelector('[data-video-review]')).toBeNull();
  } finally {
    fetchSpy.mockRestore();
  }
});

async function openVideoReview() {
  const file = new File(['local video'], 'solve.mp4', { type: 'video/mp4' });
  const input = host.querySelector<HTMLInputElement>('#recon-video-local')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await act(async () => vi.waitFor(() => expect(document.querySelector('[data-video-review="true"]')).not.toBeNull()));
  return file;
}

it('fills the solution before closing video review when the group comes from an earlier solve', async () => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  fixture.searchParams = new URLSearchParams({
    event: '3x3', round: '2', solveNum: '2', official: 'wca', scramble: 'R', compWcaId: 'Example2026',
    comp: 'Example 2026', personId: '2025TEST01', person: 'Example',
  });
  vi.mocked(listRecons).mockResolvedValue([{
    ...fixture.solve, official: 'wca', compWcaId: 'Example2026', personId: '2025TEST01', round: '2', solveNum: 1, groupId: 'E',
  } as Awaited<ReturnType<typeof listRecons>>[number]]);
  await render(null);
  const group = [...host.querySelectorAll('label')].find(label => label.querySelector('.submit-group-compare'))?.querySelector('select');
  expect(group?.value).toBe('E');
  await openVideoReview();
  expect(host.querySelector<HTMLTextAreaElement>('[data-editor]')?.value).toBe('');

  await act(async () => document.querySelector<HTMLButtonElement>('[data-use-video-solution]')!.click());
  expect(host.querySelector<HTMLTextAreaElement>('[data-editor]')?.value).toBe("R' // verified");
  expect(document.querySelector('[data-video-review]')).toBeNull();
  expect(group?.value).toBe('E');
});

async function selectMemberVideo() {
  const file = await openVideoReview();
  await act(async () => document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]')!.click());
  return file;
}

it.each([false, true])('uploads on submit only when the member opts in (%s)', async checked => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  const url = 'https://example.com/recon/video/7';
  vi.mocked(uploadReconVideo).mockResolvedValue({ id: 7, url });
  await render();
  const checkbox = host.querySelector<HTMLInputElement>('.submit-video-save input')!;
  expect(checkbox.checked).toBe(false);
  expect(checkbox.disabled).toBe(true);
  const file = await selectMemberVideo();
  expect(checkbox.checked).toBe(false);
  expect(checkbox.disabled).toBe(false);
  if (checked) await act(async () => checkbox.click());
  expect(checkbox.checked).toBe(checked);
  expect(uploadReconVideo).not.toHaveBeenCalled();
  const submit = host.querySelector<HTMLButtonElement>('.submit-btn-primary')!;
  await act(async () => submit.click());
  expect(updateRecon).toHaveBeenCalledExactlyOnceWith(2795, expect.objectContaining({ videoUrl: checked ? url : '' }));
  if (checked) {
    expect(uploadReconVideo).toHaveBeenCalledExactlyOnceWith(file);
    expect(vi.mocked(uploadReconVideo)).toHaveBeenCalledBefore(vi.mocked(updateRecon));
  } else expect(uploadReconVideo).not.toHaveBeenCalled();
});

it('reuses the uploaded URL if saving the reconstruction needs a retry', async () => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  const url = 'https://example.com/recon/video/7';
  vi.mocked(uploadReconVideo).mockResolvedValue({ id: 7, url });
  vi.mocked(updateRecon).mockRejectedValueOnce(new Error('temporarily unavailable'));
  await render();
  const file = await selectMemberVideo();
  await act(async () => host.querySelector<HTMLInputElement>('.submit-video-save input')!.click());
  const submit = host.querySelector<HTMLButtonElement>('.submit-btn-primary')!;
  await act(async () => submit.click());
  expect(host.textContent).toContain('temporarily unavailable');
  await act(async () => submit.click());
  expect(uploadReconVideo).toHaveBeenCalledExactlyOnceWith(file);
  expect(updateRecon).toHaveBeenCalledTimes(2);
  expect(updateRecon).toHaveBeenLastCalledWith(2795, expect.objectContaining({ videoUrl: url }));
});

it('keeps the form open on upload failure and allows submitting after opting out', async () => {
  fixture.user = { uid: 7, wcaId: '', name: 'Editor' };
  vi.mocked(uploadReconVideo).mockRejectedValueOnce(new Error('upload unavailable'));
  await render();
  const file = await selectMemberVideo();
  const checkbox = host.querySelector<HTMLInputElement>('.submit-video-save input')!;
  const submit = host.querySelector<HTMLButtonElement>('.submit-btn-primary')!;
  await act(async () => checkbox.click());
  await act(async () => submit.click());
  expect(host.textContent).toContain('upload unavailable');
  expect(checkbox.checked).toBe(true);
  expect(updateRecon).not.toHaveBeenCalled();
  await act(async () => checkbox.click());
  await act(async () => submit.click());
  expect(uploadReconVideo).toHaveBeenCalledExactlyOnceWith(file);
  expect(updateRecon).toHaveBeenCalledExactlyOnceWith(2795, expect.objectContaining({ videoUrl: '' }));
});
