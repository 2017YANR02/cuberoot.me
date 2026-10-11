import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
const processMock = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: processMock.spawn }));
const chunk = (type: string, payload: Buffer) => {
  const head = Buffer.alloc(8); head.write(type); head.writeUInt32LE(payload.length, 4);
  return Buffer.concat([head, payload, Buffer.alloc(payload.length % 2)]);
};
const webp = (...chunks: Buffer[]) => {
  const body = Buffer.concat([Buffer.from('WEBP'), ...chunks]);
  const head = Buffer.alloc(8); head.write('RIFF'); head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
};
const source = webp(chunk('VP8L', Buffer.alloc(100)));
const thumbnail = webp(chunk('VP8L', Buffer.alloc(5)));
const children: Array<EventEmitter & { stdin: PassThrough; stdout: PassThrough; kill: ReturnType<typeof vi.fn> }> = [];
function mockEncoder() {
  processMock.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill: vi.fn() });
    children.push(child); return child;
  });
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.resetModules(); processMock.spawn.mockReset(); children.length = 0; });
describe('bounded gallery thumbnail conversion', () => {
  it('preserves originals with animation, orientation, profiles, unknown chunks or truncation', async () => {
    const { canThumbnailWebp } = await import('../src/utils/image_thumbnail.js');
    expect(canThumbnailWebp(source, 'image/webp')).toBe(true);
    for (const tag of ['ANIM', 'ANMF', 'ICCP', 'EXIF', 'XMP ', '????']) expect(canThumbnailWebp(webp(chunk(tag, Buffer.alloc(4)), chunk('VP8L', Buffer.alloc(5))), 'image/webp')).toBe(false);
    expect(canThumbnailWebp(source.subarray(0, -1), 'image/webp')).toBe(false);
    expect(canThumbnailWebp(source, 'image/png')).toBe(false);
  });
  it('merges identical work, caches success and caps concurrent native encoders at two', async () => {
    mockEncoder(); vi.stubEnv('DRIVE_FFMPEG_BIN_DIR', '/existing/ffmpeg');
    const { imageThumbnail } = await import('../src/utils/image_thumbnail.js');
    const first = imageThumbnail(1, source, 'image/webp', 512);
    expect(imageThumbnail(1, source, 'image/webp', 512)).toBe(first);
    const second = imageThumbnail(2, source, 'image/webp', 1024);
    const third = imageThumbnail(3, source, 'image/webp', 512);
    await Promise.resolve(); expect(children).toHaveLength(2);
    children[0].stdout.emit('data', thumbnail); children[0].emit('close', 0);
    expect(await first).toEqual(thumbnail);
    await Promise.resolve(); expect(children).toHaveLength(3);
    for (const child of children.slice(1)) { child.stdout.emit('data', thumbnail); child.emit('close', 0); }
    await Promise.all([second, third]);
    expect(await imageThumbnail(1, source, 'image/webp', 512)).toEqual(thumbnail);
    expect(processMock.spawn).toHaveBeenCalledTimes(3);
    expect(processMock.spawn.mock.calls[0][1]).toContain('8388608');
    expect(processMock.spawn.mock.calls[0][2].shell).toBe(false);
  });
  it('bounds execution, falls back on missing encoder and never enlarges the downloaded image', async () => {
    vi.useFakeTimers(); mockEncoder(); vi.stubEnv('DRIVE_FFMPEG_BIN_DIR', '/existing/ffmpeg');
    const { imageThumbnail } = await import('../src/utils/image_thumbnail.js');
    const timeout = imageThumbnail(1, source, 'image/webp', 512);
    await Promise.resolve(); await vi.advanceTimersByTimeAsync(2500);
    expect(children[0].kill).toHaveBeenCalledWith('SIGKILL');
    // Killing is not exit: do not release a native-process slot until close.
    let settled = false; void timeout.then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    children[0].emit('close', null);
    expect(await timeout).toBeNull();
    expect(await imageThumbnail(2, source, 'image/webp', 512)).toBeNull();
    await vi.advanceTimersByTimeAsync(30_001);
    const large = imageThumbnail(3, source, 'image/webp', 512); await Promise.resolve();
    children[1].stdout.emit('data', webp(chunk('VP8L', Buffer.alloc(200)))); children[1].emit('close', 0);
    expect(await large).toEqual(source);
    expect(await imageThumbnail(4, source, 'image/webp', 600)).toBeNull();
    vi.stubEnv('DRIVE_FFMPEG_BIN_DIR', '');
    expect(await imageThumbnail(5, source, 'image/webp', 512)).toBeNull();
  });
});
