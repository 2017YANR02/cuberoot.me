import { afterEach, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({ build: vi.fn(), correct: vi.fn(), warm: vi.fn(), load: vi.fn() }));
vi.mock('@cuberoot/shared/timer/reconstruct/recon-text', () => ({ buildReconText: services.build, retainConfirmedRecon: (result: unknown) => result, simplifyF2lRotations: (result: unknown) => result }));
vi.mock('@cuberoot/shared/timer/reconstruct/library-correction', () => ({ correctReconFromLibrary: services.correct }));
vi.mock('@cuberoot/shared/timer/reconstruct/reference', () => ({}));
vi.mock('@cuberoot/timer-ui/reconstruct/library-cache', () => ({ reconstructionLibraries: { warm: services.warm, load: services.load } }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); vi.resetModules(); });
async function worker() {
  const host = { postMessage: vi.fn(), onmessage: null as null | ((event: unknown) => Promise<void>) };
  vi.stubGlobal('self', host);
  await import('@cuberoot/timer-ui/reconstruct/analysis.worker');
  return host;
}
const request = { data: { id: 1, input: { text: {}, scoreable: false } } };

it('publishes the original report before the library result and then publishes correction', async () => {
  const original = { text: 'original' }, corrected = { text: 'corrected' };
  services.build.mockResolvedValue(original);
  let finish!: (value: unknown) => void;
  services.correct.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const host = await worker();
  const run = host.onmessage!(request);
  await vi.waitFor(() => expect(host.postMessage).toHaveBeenCalledWith({ id: 1, patch: { text: original } }));
  expect(host.postMessage).toHaveBeenCalledTimes(1);
  finish(corrected);
  await run;
  expect(host.postMessage.mock.calls.map(call => call[0])).toEqual([
    { id: 1, patch: { text: original } }, { id: 1, patch: { text: { ...corrected, presentation: { ...corrected, presentation: undefined } } } }, { id: 1, done: true },
  ]);
});

it('keeps a usable report when optional library correction fails', async () => {
  services.build.mockResolvedValue({ text: 'original' });
  services.correct.mockRejectedValue(new Error('offline'));
  const host = await worker();
  await host.onmessage!(request);
  expect(host.postMessage.mock.calls.map(call => call[0])).toEqual([
    { id: 1, patch: { text: { text: 'original' } } },
    { id: 1, patch: { text: { text: 'original', presentation: { text: 'original', presentation: undefined } } } },
    { id: 1, done: true },
  ]);
});

it('does not rerun correction when reusing the completed text cache', async () => {
  const host = await worker();
  await host.onmessage!({ data: { ...request.data, skipText: true } });
  expect(services.build).not.toHaveBeenCalled();
  expect(services.correct).not.toHaveBeenCalled();
  expect(host.postMessage).toHaveBeenCalledWith({ id: 1, done: true });
});


it('warms library data without starting reconstruction or publishing an analysis result', async () => {
  services.warm.mockResolvedValue(undefined);
  const host = await worker();
  await host.onmessage!({ data: { type: 'warmup' } });
  expect(services.warm).toHaveBeenCalledTimes(1);
  expect(services.build).not.toHaveBeenCalled();
  expect(host.postMessage).not.toHaveBeenCalled();
});


it('does not publish an uncorrected draft over a confirmed live prefix', async () => {
  const original = { text: 'draft' }, corrected = { text: 'corrected' };
  services.build.mockResolvedValue(original);
  let finish!: (value: unknown) => void;
  services.correct.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const host = await worker();
  const run = host.onmessage!({ data: { ...request.data, input: { ...request.data.input, text: { confirmed: { lines: [{ toIdx: 3 }] } } } } });
  await vi.waitFor(() => expect(services.correct).toHaveBeenCalled());
  expect(host.postMessage).not.toHaveBeenCalled();
  finish(corrected);
  await run;
  expect(host.postMessage.mock.calls.map(call => call[0])).toEqual([
    { id: 1, patch: { text: { ...corrected, presentation: { ...corrected, presentation: undefined } } } },
    { id: 1, done: true },
  ]);
});
