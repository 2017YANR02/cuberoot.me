// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createStackmatMicSource } from '@/app/[lang]/timer/_lib/stackmat/source';
afterEach(() => vi.unstubAllGlobals());
it('releases late microphone permission without reopening a cancelled Stackmat source', async () => {
  let resolve!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const media = {getTracks: () => [{stop}]} as unknown as MediaStream;
  vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: () => new Promise<MediaStream>(done => {resolve = done;})}});
  const source = createStackmatMicSource();
  const pending = source.connect();
  await source.disconnect();
  resolve(media);await pending;
  expect(stop).toHaveBeenCalledOnce();
  expect(source.connected).toBe(false);
  expect(source.snapshot().listening).toBe(false);
});
