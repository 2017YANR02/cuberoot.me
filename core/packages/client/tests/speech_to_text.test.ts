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
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: { resultIndex: number; results: Array<{ 0: { transcript: string }; isFinal: boolean; length: number }> }) => void) | null = null;
  start = vi.fn(() => { if (Recognition.startError) throw Recognition.startError; });
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
});
