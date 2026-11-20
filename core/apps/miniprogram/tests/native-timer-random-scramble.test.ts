import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createNativeWcaRandomScramble, nativeWcaRandomScrambleAvailable, nativeWcaScrambleProviderEvent,
} from '../src/lib/native-timer-random-scramble';

const fixtures = vi.hoisted(() => ({ api: {}, openPort: vi.fn() }));
vi.mock('../src/lib/platform', () => ({ miniProgramApi: () => fixtures.api }));
vi.mock('../src/lib/native-timer-worker', () => ({ openNativeTimerWorkerPort: fixtures.openPort }));

function mockPlatform(version: string) {
  Object.assign(fixtures.api, {
    createWorker: vi.fn(),
    getAppBaseInfo: () => ({ SDKVersion: version }),
    getRandomValues: vi.fn((options: { length: number; success(value: { randomValues: ArrayBuffer }): void }) => {
      options.success({ randomValues: new ArrayBuffer(options.length) });
    }),
  });
}

afterEach(() => {
  fixtures.api = {};
  fixtures.openPort.mockReset();
});

describe('native random scramble provider', () => {
  it('uses provider spellings where the installed Cubing worker has a dispatcher', () => {
    expect(nativeWcaScrambleProviderEvent('333bld')).toBe('333bf');
    expect(nativeWcaScrambleProviderEvent('333fm')).toBe('333fm');
    expect(nativeWcaScrambleProviderEvent('333ni')).toBe('333bf');
    expect(nativeWcaScrambleProviderEvent('redi')).toBe('redi_cube');
    expect(nativeWcaScrambleProviderEvent('555bld')).toBe('555bf');
    expect(nativeWcaScrambleProviderEvent('333mbld')).toBeNull();
  });

  it('only requires the Worker WebAssembly SDK for events using Twips', () => {
    mockPlatform('3.4.0');
    expect(nativeWcaRandomScrambleAvailable('333')).toBe(true);
    expect(nativeWcaRandomScrambleAvailable('333fm')).toBe(false);
    mockPlatform('3.5.0.0');
    expect(nativeWcaRandomScrambleAvailable('333fm')).toBe(true);
  });

  it('passes native entropy to the single-worker RPC and releases its port', async () => {
    mockPlatform('3.5.0');
    let onMessage: ((event: { data: unknown }) => void) | undefined;
    const postMessage = vi.fn(({ id }: { id: number }) => onMessage?.({ data: { id, ok: true, value: "R' U' F" } }));
    const terminate = vi.fn();
    fixtures.openPort.mockReturnValue({
      addEventListener: (type: string, listener: typeof onMessage) => { if (type === 'message') onMessage = listener; },
      postMessage,
      terminate,
    });
    const provider = createNativeWcaRandomScramble();
    await expect(provider.generate('333fm')).resolves.toBe("R' U' F");
    expect(fixtures.openPort).toHaveBeenCalledWith('wca-scramble');
    expect(postMessage.mock.calls[0][0]).toMatchObject({ id: 1, request: { event: '333fm', entropy: expect.any(ArrayBuffer) } });
    provider.dispose();
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
