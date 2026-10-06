import { describe, expect, it, vi } from 'vitest';
import { createVideoMediaSession } from '@cuberoot/timer-ui/video/local-media';

describe('battle media ownership', () => {
  it('immediately stops permission results arriving after leave, without publishing them', async () => {
    const track = { stop: vi.fn() };
    let resolve!: (value: typeof track) => void;
    const publish = vi.fn(async () => undefined);
    const error = vi.fn();
    const media = createVideoMediaSession({ acquire: () => new Promise<typeof track>(done => { resolve = done; }),
      publish, unpublish: vi.fn(async () => undefined), error, busy: vi.fn() });
    const pending = media.enable('camera', true);
    media.dispose(); resolve(track); await pending;
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });

  it('stops capture immediately while publish is pending and ignores late failure', async () => {
    const track = { stop: vi.fn() };
    let reject!: (error: Error) => void;
    const error = vi.fn();
    const media = createVideoMediaSession({ acquire: async () => track,
      publish: () => new Promise((_resolve, fail) => { reject = fail; }),
      unpublish: vi.fn(async () => undefined), error, busy: vi.fn() });
    const pending = media.enable('microphone', true);
    await Promise.resolve(); media.dispose();
    expect(track.stop).toHaveBeenCalled();
    reject(new Error('disconnected')); await pending;
    expect(error).not.toHaveBeenCalled();
  });
});
