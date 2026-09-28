// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechToText } from '@/hooks/useSpeechToText';

class Recognition {
  static instances: Recognition[] = [];
  static startError: Error | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: { resultIndex: number; results: Array<{ 0: { transcript: string }; isFinal: boolean; length: number }> }) => void) | null = null;
  start = vi.fn((_track?: MediaStreamTrack) => { if (Recognition.startError) throw Recognition.startError; });
  stop = vi.fn();
  abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
  result(words: Array<[string, boolean]>, resultIndex = 0) {
    this.onresult?.({ resultIndex, results: words.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal, length: 1 })) });
  }
}

describe('browser speech recognition lifecycle', () => {
  let root: Root;
  let host: HTMLDivElement;
  let speech: ReturnType<typeof useSpeechToText>;
  const onResult = vi.fn();
  function Probe() { speech = useSpeechToText({ lang: 'zh-CN', onResult }); return null; }
  const current = () => Recognition.instances.at(-1)!;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('SpeechRecognition', Recognition);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    Recognition.instances = [];
    Recognition.startError = null;
    onResult.mockClear();
    host = document.createElement('div');
    root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(['network', 'not-allowed', 'audio-capture', 'service-not-allowed', 'language-not-supported'])('surfaces %s and releases the microphone', async (error) => {
    await act(async () => speech.start());
    await act(async () => current().onerror?.({ error }));
    expect(speech.error).toBe(error);
    expect(speech.listening).toBe(false);
    expect(current().abort).toHaveBeenCalledOnce();
  });

  it.each([false, true])('times out with no callbacks (started=%s)', async (started) => {
    await act(async () => speech.start());
    if (started) await act(async () => current().onstart?.());
    await act(async () => vi.advanceTimersByTime(started ? 15_000 : 12_000));
    expect(speech.error).toBe('timeout');
    expect(speech.status).toBe('idle');
    expect(current().abort).toHaveBeenCalledOnce();
  });

  it('waits for a final result on stop but bounds an unresponsive stop', async () => {
    await act(async () => speech.start());
    await act(async () => current().onstart?.());
    await act(async () => speech.stop());
    expect(speech.status).toBe('stopping');
    expect(current().abort).not.toHaveBeenCalled();
    await act(async () => { current().onstart?.(); current().result([['魔', false]]); });
    expect(speech.status).toBe('stopping');
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(speech.status).toBe('idle');
    expect(speech.error).toBe('timeout');
  });

  it('preserves earlier words when resultIndex advances and accepts the final result after stop', async () => {
    await act(async () => speech.start());
    await act(async () => current().result([['魔方', true], ['教', false]]));
    expect(onResult).toHaveBeenLastCalledWith('魔方教', false);
    await act(async () => speech.stop());
    await act(async () => current().result([['魔方', true], ['教程', true]], 1));
    expect(onResult).toHaveBeenLastCalledWith('魔方教程', true);
    expect(speech.error).toBeNull();
    expect(speech.status).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports an empty normal end rather than silently resetting', async () => {
    await act(async () => speech.start());
    await act(async () => current().onend?.());
    expect(speech.error).toBe('no-speech');
  });

  it('ignores late callbacks from a replaced session', async () => {
    await act(async () => speech.start());
    const staleEnd = current().onend;
    const staleError = current().onerror;
    await act(async () => speech.start());
    await act(async () => { staleEnd?.(); staleError?.({ error: 'aborted' }); });
    expect(speech.status).toBe('starting');
    expect(speech.error).toBeNull();
    await act(async () => current().result([['计时', true]]));
    expect(onResult).toHaveBeenLastCalledWith('计时', true);
  });

  it('surfaces synchronous permission errors and clears them on retry', async () => {
    Recognition.startError = new DOMException('Denied', 'NotAllowedError');
    await act(async () => speech.start());
    expect(speech.error).toBe('not-allowed');
    Recognition.startError = null;
    await act(async () => speech.start());
    expect(speech.error).toBeNull();
    expect(speech.status).toBe('starting');
  });

  it('explains unsupported browsers and supports the prefixed constructor', async () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    await act(async () => speech.start());
    expect(speech.error).toBe('unsupported');
    vi.stubGlobal('webkitSpeechRecognition', Recognition);
    await act(async () => speech.start());
    expect(current().lang).toBe('zh-CN');
    expect(speech.error).toBeNull();
  });

  it('aborts on unmount and removes timers and handlers', async () => {
    await act(async () => speech.start());
    await act(async () => root.unmount());
    expect(current().abort).toHaveBeenCalledOnce();
    expect(current().onresult).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('system default microphone', () => {
    const desktopUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/153.0.0.0 Safari/537.36';
    function capture(getUserMedia = vi.fn()) {
      vi.stubGlobal('navigator', { userAgent: desktopUA, mediaDevices: { getUserMedia } });
      const track = { label: 'Default - Wireless Mic Rx', readyState: 'live', onended: null as (() => void) | null, stop: vi.fn() };
      const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
      return { getUserMedia, track, stream };
    }

    it('passes the OS default track to recognition and displays its actual name', async () => {
      const { getUserMedia, track, stream } = capture();
      getUserMedia.mockResolvedValue(stream);
      await act(async () => speech.start());
      expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: { deviceId: { exact: 'default' } } });
      expect(current().start).toHaveBeenCalledExactlyOnceWith(track);
      expect(speech.microphone).toBe('Default - Wireless Mic Rx');
      await act(async () => current().result([['计时器', true]]));
      expect(track.stop).toHaveBeenCalledOnce();
      expect(track.onended).toBeNull();
    });

    it.each([
      ['desktop Chrome 135', 'Chrome/135.0.0.0 Safari/537.36', true],
      ['desktop Edge', 'Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', true],
      ['older Chrome', 'Chrome/134.0.0.0 Safari/537.36', false],
      ['Android Chrome', 'Mozilla/5.0 (Linux; Android 16) Chrome/153.0.0.0 Mobile Safari/537.36', false],
      ['Safari', 'Mozilla/5.0 (Macintosh) Version/26.0 Safari/605.1.15', false],
      ['iOS Chrome', 'Mozilla/5.0 (iPhone) CriOS/153.0.0.0 Mobile/15E148 Safari/604.1', false],
    ])('uses the supported capture path on %s', async (_name, userAgent, supported) => {
      const { getUserMedia, track, stream } = capture();
      vi.stubGlobal('navigator', { userAgent, mediaDevices: { getUserMedia } });
      getUserMedia.mockResolvedValue(stream);
      await act(async () => speech.start());
      if (supported) expect(current().start).toHaveBeenCalledExactlyOnceWith(track);
      else {
        expect(getUserMedia).not.toHaveBeenCalled();
        expect(current().start).toHaveBeenCalledExactlyOnceWith();
        expect(speech.microphone).toBeNull();
      }
    });

    it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError'])('handles capture failure %s without silently opening another input', async (name) => {
      const { getUserMedia } = capture();
      getUserMedia.mockRejectedValue(new DOMException('Capture failed', name));
      await act(async () => speech.start());
      expect(speech.error).toBe(name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
      expect(speech.status).toBe('idle');
      expect(current().start).not.toHaveBeenCalled();
    });

    it.each(['stop', 'unmount', 'timeout'] as const)('releases late permission results after %s', async (action) => {
      const { getUserMedia, track, stream } = capture();
      let resolve!: (value: typeof stream) => void;
      getUserMedia.mockReturnValue(new Promise(r => { resolve = r; }));
      await act(async () => speech.start());
      await act(async () => {
        if (action === 'stop') speech.stop();
        else if (action === 'unmount') root.unmount();
        else vi.advanceTimersByTime(30_000);
      });
      await act(async () => resolve(stream));
      expect(track.stop).toHaveBeenCalledOnce();
      expect(current().start).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not let an old permission result take over a newer session', async () => {
      const { getUserMedia, track, stream } = capture();
      let resolve!: (value: typeof stream) => void;
      const otherTrack = { ...track, label: 'Second input', stop: vi.fn() };
      getUserMedia.mockReturnValueOnce(new Promise(r => { resolve = r; }))
        .mockResolvedValueOnce({ getTracks: () => [otherTrack], getAudioTracks: () => [otherTrack] });
      await act(async () => speech.start());
      await act(async () => speech.start());
      await act(async () => resolve(stream));
      expect(track.stop).toHaveBeenCalledOnce();
      expect(speech.microphone).toBe('Second input');
      expect(current().start).toHaveBeenCalledExactlyOnceWith(otherTrack);
    });

    it('reports a disconnected input and releases capture on unmount', async () => {
      const { getUserMedia, track, stream } = capture();
      getUserMedia.mockResolvedValue(stream);
      await act(async () => speech.start());
      await act(async () => track.onended?.());
      expect(speech.error).toBe('audio-capture');
      expect(track.stop).toHaveBeenCalledOnce();
      await act(async () => speech.start());
      await act(async () => root.unmount());
      expect(track.stop).toHaveBeenCalledTimes(2);
    });

    it('requests a final result when speech ends or interim updates stop', async () => {
      const { getUserMedia, track, stream } = capture();
      getUserMedia.mockResolvedValue(stream);
      await act(async () => speech.start());
      await act(async () => current().result([['魔方', false]]));
      await act(async () => vi.advanceTimersByTime(15_000));
      expect(current().stop).toHaveBeenCalledOnce();
      expect(speech.status).toBe('stopping');
      expect(track.stop).not.toHaveBeenCalled();
      await act(async () => current().result([['魔方', true]]));
      expect(speech.error).toBeNull();
      expect(track.stop).toHaveBeenCalledOnce();

      await act(async () => speech.start());
      await act(async () => current().onspeechend?.());
      expect(current().stop).toHaveBeenCalledOnce();
    });
  });
});
