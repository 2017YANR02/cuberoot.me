import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasVideoEncoder, isCanvasVideoExportSupported } from '@/lib/canvas-video-export';

const muxer = vi.hoisted(() => ({ addVideoChunk: vi.fn(), finalize: vi.fn() }));
vi.mock('mp4-muxer', () => ({
  ArrayBufferTarget: class { buffer = new ArrayBuffer(4); },
  Muxer: class {
    addVideoChunk = muxer.addVideoChunk;
    finalize = muxer.finalize;
  },
}));

let callbacks: VideoEncoderInit;
let queueSize = 0;
const configure = vi.fn();
const encode = vi.fn();
const flush = vi.fn();
const close = vi.fn();
const isConfigSupported = vi.fn();
let frames: Array<{ init: VideoFrameInit; close: ReturnType<typeof vi.fn> }>;
const source = {} as OffscreenCanvas;
const options = () => ({ width: 1920, height: 1080, fps: 30, bitrate: 12_000_000, abortRef: { aborted: false } });

beforeEach(() => {
  vi.clearAllMocks();
  configure.mockReset();
  encode.mockReset();
  flush.mockReset().mockResolvedValue(undefined);
  close.mockReset();
  muxer.addVideoChunk.mockReset();
  muxer.finalize.mockReset();
  isConfigSupported.mockReset().mockResolvedValue({ supported: true });
  frames = [];
  queueSize = 0;
  vi.stubGlobal('VideoEncoder', class {
    static isConfigSupported = isConfigSupported;
    configure = configure;
    encode = encode;
    flush = flush;
    close = close;
    get encodeQueueSize() { return queueSize; }
    constructor(init: VideoEncoderInit) { callbacks = init; }
  });
  vi.stubGlobal('VideoFrame', class {
    close = vi.fn();
    constructor(_source: CanvasImageSource, init: VideoFrameInit) { frames.push({ init, close: this.close }); }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shared canvas video encoder', () => {
  it('keeps adjacent frame timestamps and durations contiguous without 30 fps drift', async () => {
    const exporter = await createCanvasVideoEncoder(options());
    for (let index = 0; index < 90; index++) await exporter.encode(source, index);
    expect(frames.slice(0, 3).map(frame => frame.init)).toEqual([
      { timestamp: 0, duration: 33333 },
      { timestamp: 33333, duration: 33334 },
      { timestamp: 66667, duration: 33333 },
    ]);
    expect(frames[89].init.timestamp! + frames[89].init.duration!).toBe(3_000_000);
    expect(frames.every(frame => frame.close.mock.calls.length === 1)).toBe(true);
    expect(encode.mock.calls.flatMap((args, index) => args[1].keyFrame ? [index] : [])).toEqual([0, 60]);
    const blob = await exporter.finish();
    expect(blob.type).toBe('video/mp4');
    expect(blob.size).toBe(4);
    expect(flush).toHaveBeenCalledOnce();
    expect(muxer.finalize).toHaveBeenCalledOnce();
    exporter.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('preserves the simulator one-second keyframe interval', async () => {
    const exporter = await createCanvasVideoEncoder({ ...options(), keyFrameInterval: 30 });
    for (let index = 0; index < 31; index++) await exporter.encode(source, index);
    expect(encode.mock.calls.flatMap((args, index) => args[1].keyFrame ? [index] : [])).toEqual([0, 30]);
    exporter.close();
  });

  it.each([{ width: 1919 }, { height: 0 }, { fps: NaN }, { fps: 0 }, { bitrate: -1 }])(
    'rejects invalid input before configuring a codec: %s', async override => {
      await expect(createCanvasVideoEncoder({ ...options(), ...override })).rejects.toThrow();
      expect(isConfigSupported).not.toHaveBeenCalled();
    },
  );

  it('preflights actual H.264 support and fails before creating an encoder', async () => {
    isConfigSupported.mockResolvedValue({ supported: false });
    await expect(createCanvasVideoEncoder(options())).rejects.toThrow('H.264 video encoding unsupported');
    expect(configure).not.toHaveBeenCalled();
    vi.stubGlobal('VideoFrame', undefined);
    expect(isCanvasVideoExportSupported()).toBe(false);
    await expect(createCanvasVideoEncoder(options())).rejects.toThrow('WebCodecs unsupported');
  });

  it('aborts preparation before allocating the encoder', async () => {
    const opts = options();
    isConfigSupported.mockImplementation(async () => {
      opts.abortRef.aborted = true;
      return { supported: true };
    });
    await expect(createCanvasVideoEncoder(opts)).rejects.toThrow('aborted');
    expect(configure).not.toHaveBeenCalled();
  });

  it('closes an encoder whose configure method fails', async () => {
    configure.mockImplementation(() => { throw new Error('configure failed'); });
    await expect(createCanvasVideoEncoder(options())).rejects.toThrow('configure failed');
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes both the frame and encoder when encode throws', async () => {
    const exporter = await createCanvasVideoEncoder(options());
    encode.mockImplementation(() => { throw new Error('encode failed'); });
    await expect(exporter.encode(source, 0)).rejects.toThrow('encode failed');
    expect(frames[0].close).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(['abort', 'codec error'] as const)('exits backpressure on %s even while the queue stays full', async reason => {
    vi.useFakeTimers();
    const opts = options();
    const exporter = await createCanvasVideoEncoder(opts);
    queueSize = 5;
    const pending = exporter.encode(source, 0);
    const rejection = expect(pending).rejects.toThrow(reason === 'abort' ? 'aborted' : 'codec failed');
    if (reason === 'abort') opts.abortRef.aborted = true;
    else callbacks.error(new DOMException('codec failed'));
    await vi.runAllTimersAsync();
    await rejection;
    expect(close).toHaveBeenCalledOnce();
  });

  it('surfaces muxer output errors and releases the encoder', async () => {
    const exporter = await createCanvasVideoEncoder(options());
    muxer.addVideoChunk.mockImplementation(() => { throw new Error('mux failed'); });
    callbacks.output({} as EncodedVideoChunk, {});
    await expect(exporter.encode(source, 0)).rejects.toThrow('mux failed');
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(['flush', 'finalize'] as const)('closes when %s fails', async phase => {
    const exporter = await createCanvasVideoEncoder(options());
    await exporter.encode(source, 0);
    if (phase === 'flush') flush.mockRejectedValue(new Error('flush failed'));
    else muxer.finalize.mockImplementation(() => { throw new Error('finalize failed'); });
    await expect(exporter.finish()).rejects.toThrow(`${phase} failed`);
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not finalize or download when cancelled during flush', async () => {
    const opts = options();
    const exporter = await createCanvasVideoEncoder(opts);
    await exporter.encode(source, 0);
    flush.mockImplementation(async () => { opts.abortRef.aborted = true; });
    await expect(exporter.finish()).rejects.toThrow('aborted');
    expect(muxer.finalize).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects an empty video or out-of-order frames and releases resources', async () => {
    const empty = await createCanvasVideoEncoder(options());
    await expect(empty.finish()).rejects.toThrow('empty video');
    const unordered = await createCanvasVideoEncoder(options());
    await expect(unordered.encode(source, 1)).rejects.toThrow('consecutive');
    expect(frames).toHaveLength(0);
    expect(close).toHaveBeenCalledTimes(2);
  });
});
